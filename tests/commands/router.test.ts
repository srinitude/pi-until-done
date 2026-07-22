import { afterEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { subcommands } from "../../extensions/lib/commands/router";
import {
	createTestRuntime,
	type TestRuntime,
} from "../helpers/runtime-harness";

let rt: TestRuntime | undefined;

afterEach(async () => {
	await rt?.dispose();
	rt = undefined;
});

describe("subcommand registry", () => {
	test("declares the documented subcommand list", () => {
		for (const s of [
			"status",
			"pause",
			"resume",
			"cancel",
			"budget",
			"detail",
			"plan",
			"tasks",
			"northstar",
			"replan-log",
			"ask",
			"help",
			"autopilot",
		]) {
			expect(subcommands).toContain(s as never);
		}
	});

	test("registers a slash command with autocomplete provider", async () => {
		rt = await createTestRuntime();
		const cmd = rt.pi.getCommands().find((c) => c.name === "until-done");
		expect(cmd).toBeDefined();
	});
});

describe("dispatch (real runtime)", () => {
	test("/until-done with no args opens help — no setup-prompt sent to LLM", async () => {
		rt = await createTestRuntime({ withUi: true });
		// Empty queue is fine since extension commands don't call the LLM
		await rt.prompt("/until-done");
		const helpShown = rt.ui.notifies.some((n) =>
			n.message.startsWith("/until-done <intent>"),
		);
		expect(helpShown).toBe(true);
		expect(rt.store.state.status).toBe("setup");
		expect(rt.store.state.goal).toBe("");
	});

	test("/until-done status routes to cmdStatus when no goal", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done status");
		expect(
			rt.ui.notifies.some((n) => n.message === "No active /until-done goal."),
		).toBe(true);
	});

	test("/until-done status report on the migration is treated as a goal (#15 fix)", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { confirm: () => false }, // reject the contract dialog so we don't run further
		});
		// cmdSetup will sendUserMessage(setupPrompt), which fires the agent loop;
		// the faux LLM response can be empty/no-op.
		rt.setLLM([fauxAssistantMessage("ack", { stopReason: "stop" })]);
		await rt.prompt("/until-done status report on the migration");
		// The setup status should have been entered (then cleared by rejection)
		const stateEntries = rt.getStateEntries();
		const kinds = stateEntries.map((e) => e.kind);
		expect(kinds).toContain("set"); // initSetupState persists kind="set"
		// And the no-active-goal status notice was NOT printed
		expect(
			rt.ui.notifies.some((n) => n.message === "No active /until-done goal."),
		).toBe(false);
	});

	test("/until-done budget 50 sets budget", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done budget 50");
		expect(rt.store.state.maxTurns).toBe(50);
	});

	test("/until-done budget for fixing X falls through to setup (#15 fix)", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { confirm: () => false },
		});
		rt.setLLM([fauxAssistantMessage("ack", { stopReason: "stop" })]);
		const before = rt.store.state.maxTurns;
		await rt.prompt("/until-done budget for fixing X");
		// Budget command was NOT applied
		expect(rt.store.state.maxTurns).toBe(before);
		// Setup flow ran (kind=set persisted)
		const kinds = rt.getStateEntries().map((e) => e.kind);
		expect(kinds).toContain("set");
	});

	test("/until-done autopilot persists the session preference", async () => {
		rt = await createTestRuntime({ withUi: true });
		expect(rt.store.state.autopilotEnabled).toBe(false);
		await rt.prompt("/until-done autopilot");
		expect(rt.store.state.autopilotEnabled).toBe(true);
		expect(rt.getStateEntries().at(-1)?.kind).toBe("preference");
		expect(
			rt.ui.notifies.some((n) =>
				n.message.startsWith("/until-done · autopilot ON"),
			),
		).toBe(true);
		await rt.prompt("/until-done autopilot");
		expect(rt.store.state.autopilotEnabled).toBe(false);
		expect(
			rt.ui.notifies.some((n) =>
				n.message.startsWith("/until-done · autopilot OFF"),
			),
		).toBe(true);
	});
});
