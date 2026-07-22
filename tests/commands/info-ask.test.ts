import { afterEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { makeNorthStar, makeTask } from "../helpers/factories";
import {
	createTestRuntime,
	type TestRuntime,
} from "../helpers/runtime-harness";

let rt: TestRuntime | undefined;

afterEach(async () => {
	await rt?.dispose();
	rt = undefined;
});

const seedActiveWithPlan = (runtime: TestRuntime) => {
	runtime.store.state = {
		...runtime.store.state,
		status: "active",
		id: "ud-test",
		goal: "ship X",
		northStar: makeNorthStar(),
		confirmedByUser: true,
		maxTurns: 100,
		tasks: [
			makeTask({ id: "T-001", title: "first", status: "in_progress" }),
			makeTask({ id: "T-002", title: "second", dependencies: ["T-001"] }),
		],
		currentTaskId: "T-001",
	};
};

describe("/until-done tasks", () => {
	test("with no tasks: explains how to populate", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done tasks");
		expect(
			rt.ui.notifies.some((n) => n.message.startsWith("No tasks yet")),
		).toBe(true);
	});

	test("with tasks: prints YAML containing each task id", async () => {
		rt = await createTestRuntime({ withUi: true });
		seedActiveWithPlan(rt);
		await rt.prompt("/until-done tasks");
		const dump = rt.ui.notifies.find((n) => n.message.includes("T-001"));
		expect(dump).toBeDefined();
		expect(dump!.message).toContain("T-002");
	});
});

describe("/until-done northstar", () => {
	test("when none set: prompts the user to begin setup", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done northstar");
		expect(
			rt.ui.notifies.some((n) =>
				n.message.startsWith("No active goal."),
			),
		).toBe(true);
	});

	test("with northStar set: dumps the contract YAML", async () => {
		rt = await createTestRuntime({ withUi: true });
		seedActiveWithPlan(rt);
		await rt.prompt("/until-done northstar");
		const dump = rt.ui.notifies.find((n) => n.message.includes("northStar:"));
		expect(dump).toBeDefined();
		expect(dump!.message).toContain("ship X");
	});
});

describe("/until-done plan", () => {
	test("when no tasks.yaml exists: explains that Pi must call until_done_plan first", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done plan");
		expect(
			rt.ui.notifies.some((n) => n.message === "No plan written yet. Pi must call until_done_plan first."),
		).toBe(true);
	});

	test("when tasks.yaml exists: announces the live plan path", async () => {
		rt = await createTestRuntime({ withUi: true });
		mkdirSync(join(rt.cwd, ".until-done"), { recursive: true });
		await writeFile(join(rt.cwd, ".until-done", "tasks.yaml"), "tasks: []\n");
		await rt.prompt("/until-done plan");
		const path = join(rt.cwd, ".until-done", "tasks.yaml");
		expect(
			rt.ui.notifies.some((n) => n.message.includes(path)),
		).toBe(true);
	});
});

describe("/until-done replan-log", () => {
	test("with no replans: announces empty log", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done replan-log");
		expect(
			rt.ui.notifies.some((n) => n.message === "No replans on record."),
		).toBe(true);
	});

	test("with replans: prints each entry", async () => {
		rt = await createTestRuntime({ withUi: true });
		rt.store.state.replanLog = [
			{ at: Date.parse("2026-01-15T10:00:00Z"), reason: "discovered X", opsCount: 2 },
			{ at: Date.parse("2026-01-15T11:00:00Z"), reason: "merged tasks", opsCount: 1 },
		];
		await rt.prompt("/until-done replan-log");
		const dump = rt.ui.notifies.find((n) => n.message.includes("discovered X"));
		expect(dump).toBeDefined();
		expect(dump!.message).toContain("merged tasks");
	});
});

describe("/until-done ask <question>", () => {
	test("when goal not active: refuses with status notice", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done ask why this approach");
		expect(
			rt.ui.notifies.some((n) =>
				n.message.startsWith("/until-done ask only applies"),
			),
		).toBe(true);
	});

	test("when active: delivers a side-question prefixed message", async () => {
		rt = await createTestRuntime({ withUi: true });
		seedActiveWithPlan(rt);
		rt.setLLM([fauxAssistantMessage("ack", { stopReason: "stop" })]);
		await rt.prompt("/until-done ask why this approach");
		// cmdAsk fires pi.sendUserMessage synchronously but the resulting agent
		// loop is awaited via the runtime's stream; wait for streaming to settle.
		await rt.awaitIdle();
		const branch = rt.session.sessionManager.getBranch();
		const containsAsk = branch.some(
			(e) =>
				JSON.stringify(e).includes("/until-done · side question") &&
				JSON.stringify(e).includes("why this approach"),
		);
		expect(containsAsk).toBe(true);
		// And the loop's confirmation notification fired
		expect(
			rt.ui.notifies.some((n) => n.message.includes("side question delivered")),
		).toBe(true);
	});
});
