import { afterEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { setupPrompt } from "../../extensions/lib/commands/setup-prompt";
import {
	createTestRuntime,
	type TestRuntime,
} from "../helpers/runtime-harness";

let rt: TestRuntime | undefined;

afterEach(async () => {
	await rt?.dispose();
	rt = undefined;
});

describe("/until-done <intent> setup flow", () => {
	test("shows the draft before offering contract approval (#1)", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { confirm: () => true },
		});
		rt.setLLM([
			fauxAssistantMessage("Contract and full task plan", {
				stopReason: "stop",
			}),
		]);
		await rt.prompt("/until-done implement auth");
		expect(rt.store.state.confirmedByUser).toBe(false);
		expect(rt.store.state.status).toBe("setup");
		expect(rt.store.state.goal).toBe("implement auth");
		expect(rt.ui.confirms).toHaveLength(0);
	});

	test("approve command opens the contract dialog", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { confirm: () => true },
		});
		rt.setLLM([fauxAssistantMessage("Contract and full task plan")]);
		await rt.prompt("/until-done implement auth");
		rt.setLLM([fauxAssistantMessage("Activating approved contract")]);
		await rt.prompt("/until-done approve");
		expect(rt.store.state.confirmedByUser).toBe(true);
		expect(rt.store.state.goal).toBe("implement auth");
		expect(rt.ui.confirms).toHaveLength(1);
		expect(rt.ui.confirms[0]?.title).toContain("approve contract");
	});

	test("rejected approval clears setup", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { confirm: () => false },
		});
		rt.setLLM([fauxAssistantMessage("Contract and full task plan")]);
		await rt.prompt("/until-done implement auth");
		expect(rt.store.state.goal).toBe("implement auth");
		await rt.prompt("/until-done approve");
		expect(rt.store.state.confirmedByUser).toBe(false);
		expect(rt.store.state.goal).toBe("");
	});

	test("approve without a pending setup does not create a goal", async () => {
		rt = await createTestRuntime({ withUi: true });
		await rt.prompt("/until-done approve");
		expect(rt.store.state.goal).toBe("");
		expect(rt.ui.confirms).toHaveLength(0);
	});

	test("approve without UI cannot silently activate setup", async () => {
		rt = await createTestRuntime();
		rt.setLLM([fauxAssistantMessage("Contract and full task plan")]);
		await rt.prompt("/until-done implement auth");
		await rt.prompt("/until-done approve");
		expect(rt.store.state.confirmedByUser).toBe(false);
		expect(rt.store.state.goal).toBe("implement auth");
	});

	test("setup prompt requests explicit approval after the full plan", () => {
		const prompt = setupPrompt("implement auth");
		const plan = prompt.indexOf("Show the contract AND the full YAML task list");
		const approval = prompt.indexOf("/until-done approve");
		expect(plan).toBeGreaterThan(-1);
		expect(approval).toBeGreaterThan(plan);
		expect(prompt).not.toContain("(yes/no)");
	});

	test("autopilot=true skips the contract dialog (#4 fix)", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { confirm: () => false },
		});
		await rt.prompt("/until-done autopilot");
		expect(rt.store.state.autopilotEnabled).toBe(true);
		const beforeConfirms = rt.ui.confirms.length;
		rt.setLLM([fauxAssistantMessage("Contract and full task plan")]);
		await rt.prompt("/until-done implement auth");
		expect(rt.ui.confirms.length).toBe(beforeConfirms);
		expect(rt.store.state.confirmedByUser).toBe(true);
		expect(rt.store.state.goal).toBe("implement auth");
	});

	test("replace-goal flow: prompts user when overriding an active goal", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { select: (_t, options) => options[0] },
		});
		rt.store.state = {
			...rt.store.state,
			status: "active",
			goal: "old goal",
			id: "ud-old",
		};
		rt.setLLM([fauxAssistantMessage("Contract and full task plan")]);
		await rt.prompt("/until-done new goal");
		expect(rt.ui.selects.some((s) => s.title.includes("already has a goal"))).toBe(
			true,
		);
		expect(rt.store.state.status).toBe("setup");
		expect(rt.store.state.goal).toBe("new goal");
		const kinds = rt.getStateEntries().map((e) => e.kind);
		expect(kinds).toContain("cancel");
		expect(kinds).toContain("set");
	});

	test("replace-goal flow: keep-current-goal preserves the original", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: {
				select: (_t, options) => options[1], // "Keep current goal"
			},
		});
		rt.store.state = {
			...rt.store.state,
			status: "active",
			goal: "keep me",
			id: "ud-keep",
		};
		await rt.prompt("/until-done other goal");
		expect(rt.store.state.goal).toBe("keep me");
		expect(rt.store.state.status).toBe("active");
	});
});
