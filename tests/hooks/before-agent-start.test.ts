import { afterEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
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
		],
		currentTaskId: "T-001",
	};
};

describe("before_agent_start (real runtime)", () => {
	test("appends North Star + reminder to the system prompt only when active", async () => {
		rt = await createTestRuntime({ withUi: true });
		seedActiveWithPlan(rt);
		rt.setLLM([fauxAssistantMessage("ack", { stopReason: "stop" })]);
		await rt.prompt("ping");
		await rt.awaitIdle();
		const finalPrompt = rt.session.systemPrompt;
		expect(finalPrompt).toContain("until-done — North Star");
		expect(finalPrompt).toContain("ship X");
		expect(finalPrompt).toContain("Phase: analysis");
		expect(finalPrompt).toContain("Tasks: 0/1 done");
	});

	test("does NOT augment the system prompt when status !== active", async () => {
		rt = await createTestRuntime({ withUi: true });
		// Default state: status = setup, no northStar
		rt.setLLM([fauxAssistantMessage("ack", { stopReason: "stop" })]);
		await rt.prompt("ping");
		await rt.awaitIdle();
		const finalPrompt = rt.session.systemPrompt;
		expect(finalPrompt).not.toContain("until-done — North Star");
	});

	test("includes verifyCommand line when northStar.verifyCommand is set", async () => {
		rt = await createTestRuntime({ withUi: true });
		seedActiveWithPlan(rt);
		rt.setLLM([fauxAssistantMessage("ack", { stopReason: "stop" })]);
		await rt.prompt("ping");
		await rt.awaitIdle();
		expect(rt.session.systemPrompt).toContain("Verify:");
		expect(rt.session.systemPrompt).toContain("mise");
	});
});
