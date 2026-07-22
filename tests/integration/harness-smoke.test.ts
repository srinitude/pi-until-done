import { afterEach, describe, expect, test } from "bun:test";
import {
	createTestRuntime,
	type TestRuntime,
} from "../helpers/runtime-harness";

let runtime: TestRuntime | undefined;

afterEach(async () => {
	await runtime?.dispose();
	runtime = undefined;
});

describe("runtime harness smoke", () => {
	test("boots with extension loaded and store available", async () => {
		runtime = await createTestRuntime();
		expect(runtime.store.state.status).toBe("setup");
		expect(runtime.store.state.autopilotEnabled).toBe(false);
	});

	test("registers all 8 until_done_* tools", async () => {
		runtime = await createTestRuntime();
		const tools = runtime.session.getAllTools().map((t) => t.name);
		const required = [
			"until_done_set",
			"until_done_complete",
			"until_done_block",
			"until_done_progress",
			"until_done_plan",
			"until_done_replan",
			"until_done_task_update",
			"until_done_distill",
		];
		for (const name of required) expect(tools).toContain(name);
	});

	test("registers /until-done command", async () => {
		runtime = await createTestRuntime();
		const cmds = runtime.pi.getCommands();
		const ud = cmds.find((c) => c.name === "until-done");
		expect(ud).toBeDefined();
	});

	test("session_start fires on startup (status reflects setup, no goal yet)", async () => {
		runtime = await createTestRuntime({ withUi: true });
		// session_start fires during bindExtensions; the extension reconstructs
		// state and refreshes status/widget. With UI, those calls are observable.
		expect(runtime.ui.statuses.length).toBeGreaterThan(0);
	});
});
