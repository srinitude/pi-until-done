import { afterEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { makeSetParams } from "../helpers/factories";
import {
	createTestRuntime,
	type TestRuntime,
} from "../helpers/runtime-harness";

let rt: TestRuntime | undefined;

afterEach(async () => {
	await rt?.dispose();
	rt = undefined;
});

describe("/until-done judge — show current default", () => {
	test("with no default set, prints how to set one", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done judge");
		expect(
			rt.ui.notifies.some((n) =>
				n.message.includes("/until-done judge — no default set"),
			),
		).toBe(true);
	});

	test("with cross-model default, reports the configured pair", async () => {
		rt = await createTestRuntime({ withUi: true, withJudge: true });
		await rt.prompt("/until-done judge faux-judge/faux-1");
		await rt.prompt("/until-done judge");
		expect(
			rt.ui.notifies.some((n) =>
				n.message.includes("cross-model — faux-judge/faux-1"),
			),
		).toBe(true);
	});
});

describe("/until-done judge <provider>/<modelId>", () => {
	test("sets a cross-model default for future setups", async () => {
		rt = await createTestRuntime({ withUi: true, withJudge: true });
		await rt.prompt("/until-done judge faux-judge/faux-1");
		expect(rt.store.state.judgeDefault).toEqual({
			mode: "cross",
			provider: "faux-judge",
			modelId: "faux-1",
		});
	});

	test("warns when the model is not in the registry but still sets the preference", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done judge unknown/not-real");
		expect(rt.store.state.judgeDefault).toEqual({
			mode: "cross",
			provider: "unknown",
			modelId: "not-real",
		});
		expect(
			rt.ui.notifies.some(
				(n) => n.type === "warning" && n.message.includes("not found in current model registry"),
			),
		).toBe(true);
	});

	test("rejects malformed specs (no slash)", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done judge anthropic-no-slash");
		// Malformed spec doesn't match the judge dispatch pattern, falls through
		// to cmdSetup which begins a goal — judgeDefault remains unset.
		expect(rt.store.state.judgeDefault).toBeNull();
	});
});

describe("/until-done judge same | clear", () => {
	test("`same` selects same-model self-judge default", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done judge same");
		expect(rt.store.state.judgeDefault).toEqual({ mode: "same" });
		expect(rt.getStateEntries().at(-1)?.kind).toBe("preference");
	});

	test("`clear` unsets the default", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done judge same");
		expect(rt.store.state.judgeDefault).toEqual({ mode: "same" });
		await rt.prompt("/until-done judge clear");
		expect(rt.store.state.judgeDefault).toBeNull();
	});
});

describe("judgeDefault feeds into until_done_set", () => {
	test("with same-model default set, until_done_set succeeds without explicit args", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done judge same");
		// Force store into setup mode and confirmedByUser so until_done_set can proceed
		rt.store.state.status = "setup";
		rt.store.state.id = "ud-test";
		rt.store.state.confirmedByUser = true;
		// Strip the test-default sameModelJudge so the LLM submits no judge mode
		const params = { ...makeSetParams() };
		// @ts-expect-error — testing the no-judge-args path explicitly
		params.sameModelJudge = undefined;
		rt.setLLM([
			fauxAssistantMessage(
				[fauxToolCall("until_done_set", params)],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage("done", { stopReason: "stop" }),
		]);
		await rt.prompt("trigger");
		expect(rt.store.state.status).toBe("active");
		expect(rt.store.state.northStar?.sameModelJudge).toBe(true);
	});

	test("with cross-model default set, until_done_set fills in the judgeModel", async () => {
		rt = await createTestRuntime({ withUi: true, withJudge: true });
		await rt.prompt("/until-done judge faux-judge/faux-1");
		rt.store.state.status = "setup";
		rt.store.state.id = "ud-test";
		rt.store.state.confirmedByUser = true;
		const params = { ...makeSetParams() };
		// @ts-expect-error — testing fill-in
		params.sameModelJudge = undefined;
		rt.setLLM([
			fauxAssistantMessage(
				[fauxToolCall("until_done_set", params)],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage("done", { stopReason: "stop" }),
		]);
		await rt.prompt("trigger");
		expect(rt.store.state.status).toBe("active");
		expect(rt.store.state.northStar?.judgeModel).toEqual({
			provider: "faux-judge",
			modelId: "faux-1",
		});
	});

	test("explicit args in until_done_set override the user default", async () => {
		rt = await createTestRuntime({ withUi: true, withJudge: true });
		await rt.prompt("/until-done judge faux-judge/faux-1");
		rt.store.state.status = "setup";
		rt.store.state.id = "ud-test";
		rt.store.state.confirmedByUser = true;
		const params = { ...makeSetParams(), sameModelJudge: true };
		rt.setLLM([
			fauxAssistantMessage(
				[fauxToolCall("until_done_set", params)],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage("done", { stopReason: "stop" }),
		]);
		await rt.prompt("trigger");
		// Explicit sameModelJudge wins over the cross-model preconfigured default
		expect(rt.store.state.northStar?.sameModelJudge).toBe(true);
		expect(rt.store.state.northStar?.judgeModel).toBeUndefined();
	});
});
