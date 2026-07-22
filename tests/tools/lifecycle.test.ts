import { afterEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { makeNorthStar, makeSetParams } from "../helpers/factories";
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

const seedSetup = (runtime: TestRuntime, confirmed = true): void => {
	runtime.store.state.status = "setup";
	runtime.store.state.id = "ud-test";
	runtime.store.state.confirmedByUser = confirmed;
};

const seedActive = (runtime: TestRuntime): void => {
	runtime.store.state = {
		...runtime.store.state,
		status: "active",
		id: "ud-test",
		goal: "ship X",
		northStar: makeNorthStar(),
		confirmedByUser: true,
		maxTurns: 100,
	};
};

describe("until_done_set", () => {
	test("activates the goal and locks the North Star (status: setup → active)", async () => {
		rt = await createTestRuntime();
		seedSetup(rt);
		await driveToolCall(rt, "until_done_set", makeSetParams());
		expect(rt.store.state.status).toBe("active");
		expect(rt.store.state.northStar?.goal).toBe("ship X");
		expect(rt.store.state.northStar?.doneCriteria).toBe("all green");
		// verifyCommand auto-routed through mise exec
		expect(rt.store.state.verifyCommand).toContain("mise");
	});

	test("rejects when status is anything other than 'setup' (closes README #22 hole)", async () => {
		rt = await createTestRuntime();
		seedActive(rt);
		await driveToolCall(rt, "until_done_set", makeSetParams());
		expect(rt.store.state.status).toBe("active");
		// Original North Star unchanged
		expect(rt.store.state.northStar?.goal).toBe("ship X");
	});

	test("rejects when confirmedByUser=false", async () => {
		rt = await createTestRuntime();
		seedSetup(rt, false);
		await driveToolCall(rt, "until_done_set", makeSetParams());
		expect(rt.store.state.status).toBe("setup");
		expect(rt.store.state.northStar).toBeUndefined();
	});

	test("rejects when status=done", async () => {
		rt = await createTestRuntime();
		seedActive(rt);
		rt.store.state.status = "done";
		await driveToolCall(rt, "until_done_set", makeSetParams());
		expect(rt.store.state.status).toBe("done");
	});

	test("honors a within-range maxTurns override", async () => {
		rt = await createTestRuntime();
		seedSetup(rt);
		await driveToolCall(rt, "until_done_set", {
			...makeSetParams(),
			maxTurns: 250,
		});
		expect(rt.store.state.maxTurns).toBe(250);
	});

	test("schema rejects maxTurns past HARD_BUDGET_CEILING (LLM never sees the run)", async () => {
		rt = await createTestRuntime();
		seedSetup(rt);
		await driveToolCall(rt, "until_done_set", {
			...makeSetParams(),
			maxTurns: 99999,
		});
		// Schema validation rejected; tool body did not run; status stays in setup.
		expect(rt.store.state.status).toBe("setup");
	});
});

describe("until_done_complete", () => {
	test("rejects when status !== active", async () => {
		rt = await createTestRuntime();
		rt.store.state.status = "setup";
		await driveToolCall(rt, "until_done_complete", { evidence: "x" });
		expect(rt.store.state.status).toBe("setup");
	});

	test("appends evidence and transitions active → done (with default self-judge approving)", async () => {
		rt = await createTestRuntime();
		seedActive(rt);
		rt.store.state.evidence = ["prior"];
		// Judge defaults to ON; self-judge consumes one response from the
		// executor faux queue between the toolCall and the final stop.
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
				JSON.stringify({ verdict: "done", reason: "criteria met" }),
				{ stopReason: "stop" },
			),
			fauxAssistantMessage("ack", { stopReason: "stop" }),
		]);
		await rt.prompt("complete it");
		expect(rt.store.state.status).toBe("done");
		expect(rt.store.state.evidence).toContain("tests pass: 42 / 0 fail");
		expect(rt.store.state.lastVerdict).toBe("done");
	});
});

describe("until_done_block", () => {
	test("transitions active → blocked with reason and question", async () => {
		rt = await createTestRuntime();
		seedActive(rt);
		await driveToolCall(rt, "until_done_block", {
			question: "auth provider?",
			reason: "two equally valid choices",
		});
		expect(rt.store.state.status).toBe("blocked");
		expect(rt.store.state.pausedReason).toBe("two equally valid choices");
		expect(rt.store.state.lastReason).toBe("auth provider?");
	});

	test("rejects when not active", async () => {
		rt = await createTestRuntime();
		seedActive(rt);
		rt.store.state.status = "paused";
		await driveToolCall(rt, "until_done_block", {
			question: "?",
			reason: "stuck",
		});
		expect(rt.store.state.status).toBe("paused");
	});
});

describe("until_done_progress", () => {
	test("appends note to evidence; phase is optional", async () => {
		rt = await createTestRuntime();
		seedActive(rt);
		rt.store.state.phase = "analysis";
		await driveToolCall(rt, "until_done_progress", {
			note: "discovered the right surface",
		});
		expect(rt.store.state.evidence).toContain("discovered the right surface");
		expect(rt.store.state.phase).toBe("analysis");
	});

	test("phase is updated when supplied", async () => {
		rt = await createTestRuntime();
		seedActive(rt);
		await driveToolCall(rt, "until_done_progress", {
			note: "first failing test landed",
			phase: "red",
		});
		expect(rt.store.state.phase).toBe("red");
	});
});
