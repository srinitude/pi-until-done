import { afterEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import {
	makeJudgeModel,
	makeNorthStar,
	makeSetParams,
} from "../helpers/factories";
import {
	createTestRuntime,
	type TestRuntime,
} from "../helpers/runtime-harness";

let rt: TestRuntime | undefined;

afterEach(async () => {
	await rt?.dispose();
	rt = undefined;
});

const driveToolCall = async (
	runtime: TestRuntime,
	name: string,
	args: Record<string, unknown>,
) => {
	runtime.setLLM([
		fauxAssistantMessage([fauxToolCall(name, args)], { stopReason: "toolUse" }),
		fauxAssistantMessage("done", { stopReason: "stop" }),
	]);
	await runtime.prompt("run the tool");
};

const seedSetup = (runtime: TestRuntime) => {
	runtime.store.state.status = "setup";
	runtime.store.state.id = "ud-test";
	runtime.store.state.confirmedByUser = true;
};

const seedActiveWithJudge = (runtime: TestRuntime) => {
	const ns = makeNorthStar();
	runtime.store.state = {
		...runtime.store.state,
		status: "active",
		id: "ud-test",
		goal: "ship X",
		northStar: { ...ns, judgeModel: makeJudgeModel() },
		confirmedByUser: true,
		maxTurns: 100,
	};
};

describe("until_done_set with judgeModel parameter", () => {
	test("schema accepts judgeModel field; round-trips through executeSet → northStar", async () => {
		rt = await createTestRuntime({ withJudge: true });
		seedSetup(rt);
		await driveToolCall(rt, "until_done_set", {
			...makeSetParams(),
			judgeModel: makeJudgeModel(),
		});
		expect(rt.store.state.status).toBe("active");
		expect(rt.store.state.northStar?.judgeModel).toEqual(makeJudgeModel());
	});

	test("judgeModel is optional — backwards compatible", async () => {
		rt = await createTestRuntime();
		seedSetup(rt);
		await driveToolCall(rt, "until_done_set", makeSetParams());
		expect(rt.store.state.status).toBe("active");
		expect(rt.store.state.northStar?.judgeModel).toBeUndefined();
	});
});

describe("until_done_complete default behavior (judge ON, self-judge against executor)", () => {
	test("self-judge approves → goal transitions active → done; judge reason recorded", async () => {
		rt = await createTestRuntime();
		const ns = makeNorthStar();
		rt.store.state = {
			...rt.store.state,
			status: "active",
			id: "ud-test",
			goal: "ship X",
			northStar: ns,
			confirmedByUser: true,
			maxTurns: 100,
		};
		// The self-judge consumes one response from the same executor faux queue.
		rt.setLLM([
			fauxAssistantMessage(
				[
					fauxToolCall("until_done_complete", {
						evidence: "tests pass: 42 / 0 fail",
						summary: "shipped",
					}),
				],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage(
				JSON.stringify({
					verdict: "done",
					reason: "verifyCommand output literally satisfies criteria",
				}),
				{ stopReason: "stop" },
			),
			fauxAssistantMessage("ack", { stopReason: "stop" }),
		]);
		await rt.prompt("complete");
		expect(rt.store.state.status).toBe("done");
		expect(rt.store.state.lastVerdict).toBe("done");
		expect(
			rt.store.state.evidence.some((e) =>
				e.includes("verifyCommand output literally satisfies"),
			),
		).toBe(true);
	});

	test("self-judge rejects → completion refused; reason recorded as evidence", async () => {
		rt = await createTestRuntime();
		const ns = makeNorthStar();
		rt.store.state = {
			...rt.store.state,
			status: "active",
			id: "ud-test",
			goal: "ship X",
			northStar: ns,
			confirmedByUser: true,
			maxTurns: 100,
		};
		rt.setLLM([
			fauxAssistantMessage(
				[
					fauxToolCall("until_done_complete", { evidence: "all green" }),
				],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage(
				JSON.stringify({
					verdict: "continue",
					reason: "evidence does not quote the verifyCommand output",
				}),
				{ stopReason: "stop" },
			),
			fauxAssistantMessage("ack", { stopReason: "stop" }),
		]);
		await rt.prompt("complete");
		expect(rt.store.state.status).toBe("active");
		expect(rt.store.state.lastVerdict).not.toBe("done");
		expect(
			rt.store.state.evidence.some((e) => e.includes("judge rejected")),
		).toBe(true);
	});
});

describe("until_done_set requires an explicit judge mode", () => {
	test("refuses when neither judgeModel nor sameModelJudge is provided", async () => {
		rt = await createTestRuntime();
		seedSetup(rt);
		const params = { ...makeSetParams() };
		// @ts-expect-error — strip the test-default sameModelJudge to simulate
		// a setup call with no judge mode picked
		params.sameModelJudge = undefined;
		await driveToolCall(rt, "until_done_set", params);
		// Setup remains in `setup` (not advanced to `active`)
		expect(rt.store.state.status).toBe("setup");
	});

	test("sameModelJudge: true round-trips through executeSet → northStar", async () => {
		rt = await createTestRuntime();
		seedSetup(rt);
		await driveToolCall(rt, "until_done_set", {
			...makeSetParams(),
			sameModelJudge: true,
		});
		expect(rt.store.state.status).toBe("active");
		expect(rt.store.state.northStar?.sameModelJudge).toBe(true);
		expect(rt.store.state.northStar?.judgeModel).toBeUndefined();
	});
});

describe("until_done_complete with judgeModel — judge approves", () => {
	test("judge says 'done' → status: active → done; judge reason recorded as evidence", async () => {
		rt = await createTestRuntime({ withJudge: true });
		seedActiveWithJudge(rt);
		// Pre-arm the judge response
		rt.setJudgeLLM([
			fauxAssistantMessage(
				JSON.stringify({
					verdict: "done",
					reason: "verifyCommand output literally satisfies criteria",
				}),
				{ stopReason: "stop" },
			),
		]);
		await driveToolCall(rt, "until_done_complete", {
			evidence: "bun test → 42 pass / 0 fail",
			summary: "shipped",
		});
		expect(rt.store.state.status).toBe("done");
		expect(
			rt.store.state.evidence.some((e) =>
				e.includes("verifyCommand output literally satisfies"),
			),
		).toBe(true);
	});
});

describe("until_done_complete with judgeModel — judge rejects (Ralph-loop convergence)", () => {
	test("judge says 'continue' → status stays active; reason appended to evidence", async () => {
		rt = await createTestRuntime({ withJudge: true });
		seedActiveWithJudge(rt);
		rt.setJudgeLLM([
			fauxAssistantMessage(
				JSON.stringify({
					verdict: "continue",
					reason: "evidence cites a different test file than the verifyCommand",
				}),
				{ stopReason: "stop" },
			),
		]);
		await driveToolCall(rt, "until_done_complete", {
			evidence: "all green",
			summary: "shipped",
		});
		expect(rt.store.state.status).toBe("active");
		expect(rt.store.state.lastVerdict).not.toBe("done");
		expect(
			rt.store.state.evidence.some((e) => e.includes("judge rejected")),
		).toBe(true);
		expect(
			rt.store.state.evidence.some((e) =>
				e.includes("different test file than the verifyCommand"),
			),
		).toBe(true);
	});
});

describe("until_done_complete with judgeModel — malformed judge response", () => {
	test("rejects prose-wrapped JSON as non-strict output", async () => {
		rt = await createTestRuntime({ withJudge: true });
		seedActiveWithJudge(rt);
		rt.setJudgeLLM([
			fauxAssistantMessage(
				'Judgment: {"verdict":"continue","reason":"more work"}',
				{ stopReason: "stop" },
			),
		]);
		await driveToolCall(rt, "until_done_complete", { evidence: "tests pass" });
		expect(rt.store.state.status).toBe("done");
		expect(
			rt.store.state.evidence.some((entry) =>
				entry.includes("judge response could not be parsed"),
			),
		).toBe(true);
	});

	test("requires a non-empty reason in strict JSON", async () => {
		rt = await createTestRuntime({ withJudge: true });
		seedActiveWithJudge(rt);
		rt.setJudgeLLM([
			fauxAssistantMessage('{"verdict":"continue","reason":""}', {
				stopReason: "stop",
			}),
		]);
		await driveToolCall(rt, "until_done_complete", { evidence: "tests pass" });
		expect(rt.store.state.status).toBe("done");
		expect(
			rt.store.state.evidence.some((entry) =>
				entry.includes("judge response could not be parsed"),
			),
		).toBe(true);
	});

	test("judge returns non-JSON → fail-open with warning evidence; goal still completes", async () => {
		rt = await createTestRuntime({ withJudge: true });
		seedActiveWithJudge(rt);
		rt.setJudgeLLM([
			fauxAssistantMessage("absolutely. ship it.", { stopReason: "stop" }),
		]);
		await driveToolCall(rt, "until_done_complete", {
			evidence: "tests pass",
			summary: "shipped",
		});
		// Fail-open semantics: existing behavior preserved (don't block on judge bug).
		expect(rt.store.state.status).toBe("done");
		expect(
			rt.store.state.evidence.some((e) =>
				e.includes("judge response could not be parsed"),
			),
		).toBe(true);
	});
});
