import { afterEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { makeNorthStar } from "../helpers/factories";
import {
	createTestRuntime,
	type TestRuntime,
} from "../helpers/runtime-harness";

let rt: TestRuntime | undefined;

afterEach(async () => {
	await rt?.dispose();
	rt = undefined;
});

const seedActiveGoal = (runtime: TestRuntime) => {
	runtime.store.state = {
		...runtime.store.state,
		status: "active",
		id: "ud-test",
		goal: "ship X",
		northStar: makeNorthStar(),
		confirmedByUser: true,
		maxTurns: 100,
		cleanEndPrompts: 2,
	};
};

describe("/until-done pause", () => {
	test("transitions active → paused", async () => {
		rt = await createTestRuntime({ withUi: true });
		seedActiveGoal(rt);
		await rt.prompt("/until-done pause");
		expect(rt.store.state.status).toBe("paused");
		expect(rt.store.state.pausedReason).toBe("user-paused");
	});

	test("declines when nothing to pause", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done pause");
		expect(
			rt.ui.notifies.some((n) => n.message.startsWith("Nothing to pause")),
		).toBe(true);
	});
});

describe("/until-done resume", () => {
	test("paused → active and resets cleanEndPrompts (#13 fix)", async () => {
		rt = await createTestRuntime({ withUi: true });
		seedActiveGoal(rt);
		rt.store.state.status = "paused";
		expect(rt.store.state.cleanEndPrompts).toBe(2);
		// Faux response so the resume's sendUserMessage doesn't hang the loop
		rt.setLLM([fauxAssistantMessage("ack", { stopReason: "stop" })]);
		await rt.prompt("/until-done resume");
		expect(rt.store.state.status).toBe("active");
		expect(rt.store.state.cleanEndPrompts).toBe(0);
		expect(rt.store.state.turnsUsed).toBe(0);
	});

	test("from done with confirm=true: transitions and queues new-evidence prompt (#14 fix)", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { confirm: () => true },
		});
		seedActiveGoal(rt);
		rt.store.state.status = "done";
		rt.setLLM([fauxAssistantMessage("ack", { stopReason: "stop" })]);
		await rt.prompt("/until-done resume");
		expect(rt.store.state.status).toBe("active");
		expect(rt.ui.confirms.some((c) => c.title.includes("challenge"))).toBe(true);
	});

	test("from done with confirm=false: no transition", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { confirm: () => false },
		});
		seedActiveGoal(rt);
		rt.store.state.status = "done";
		await rt.prompt("/until-done resume");
		expect(rt.store.state.status).toBe("done");
	});

	test("from cleared: refuses with 'nothing to resume'", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done resume");
		expect(
			rt.ui.notifies.some((n) => n.message === "Nothing to resume."),
		).toBe(true);
	});
});

describe("/until-done cancel", () => {
	test("clears state on confirm", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { confirm: () => true },
		});
		seedActiveGoal(rt);
		await rt.prompt("/until-done cancel");
		expect(rt.store.state.goal).toBe("");
		expect(rt.store.state.status).toBe("setup");
	});

	test("preserves state on confirm=false", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { confirm: () => false },
		});
		seedActiveGoal(rt);
		await rt.prompt("/until-done cancel");
		expect(rt.store.state.goal).toBe("ship X");
		expect(rt.store.state.status).toBe("active");
	});

	test("noops when no goal", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done cancel");
		expect(
			rt.ui.notifies.some((n) => n.message === "No goal to cancel."),
		).toBe(true);
	});
});

describe("/until-done budget", () => {
	test("rejects out-of-range values", async () => {
		rt = await createTestRuntime({ withUi: true });
		const before = rt.store.state.maxTurns;
		await rt.prompt("/until-done budget 0");
		expect(rt.store.state.maxTurns).toBe(before);
		expect(
			rt.ui.notifies.some((n) => n.message.includes("Budget must be an integer")),
		).toBe(true);
	});

	test("large budget triggers a confirm dialog over the threshold", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { confirm: () => true },
		});
		await rt.prompt("/until-done budget 1000");
		expect(rt.store.state.maxTurns).toBe(1000);
		expect(rt.ui.confirms.some((c) => c.title.includes("large budget"))).toBe(
			true,
		);
	});

	test("large budget honored only when user confirms", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { confirm: () => false },
		});
		const before = rt.store.state.maxTurns;
		await rt.prompt("/until-done budget 1000");
		expect(rt.store.state.maxTurns).toBe(before);
	});
});
