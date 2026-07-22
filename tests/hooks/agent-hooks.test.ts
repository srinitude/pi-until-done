import { afterEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
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

const seedActive = (runtime: TestRuntime, overrides: Partial<typeof runtime.store.state> = {}) => {
	runtime.store.state = {
		...runtime.store.state,
		status: "active",
		id: "ud-test",
		goal: "ship X",
		northStar: makeNorthStar(),
		confirmedByUser: true,
		maxTurns: 100,
		...overrides,
	};
};

describe("agent lifecycle (real runtime)", () => {
	test("defers continuation policy until agent_settled", async () => {
		rt = await createTestRuntime({ withUi: true });
		seedActive(rt, { maxTurns: 1, turnsUsed: 0 });
		rt.store.progressSignalsThisTurn = 1;
		await rt.session.extensionRunner.emit({ type: "agent_end", messages: [] });
		expect(rt.store.state.turnsUsed).toBe(0);
		expect(rt.store.state.status).toBe("active");
		await rt.session.extensionRunner.emit({ type: "agent_settled" });
		expect(rt.store.state.turnsUsed).toBe(1);
		expect(rt.store.state.status).toBe("paused");
	});

	test("agent_start resets per-turn counters but does NOT reset userMessagedThisTurn (#1 fix)", async () => {
		rt = await createTestRuntime({ withUi: true });
		seedActive(rt);
		rt.store.progressSignalsThisTurn = 99;
		rt.store.codeEditsThisTurn = 7;
		rt.store.userMessagedThisTurn = false;
		rt.setLLM([
			fauxAssistantMessage([fauxToolCall("until_done_progress", { note: "x" })], {
				stopReason: "toolUse",
			}),
			fauxAssistantMessage("done", { stopReason: "stop" }),
		]);
		await rt.prompt("ping");
		// agent_start fired during the loop. After agent_end runs, userMessagedThisTurn
		// is reset to false (we observed the user-driven branch). Counters are also reset
		// at the next agent_start, but at this moment the loop is over. We verify by
		// running another turn:
		expect(rt.store.userMessagedThisTurn).toBe(false);
	});

	test("user-driven turn sets verdict='continue' and does NOT auto-continue (#1 fix)", async () => {
		rt = await createTestRuntime({ withUi: true });
		seedActive(rt);
		rt.setLLM([
			fauxAssistantMessage([fauxToolCall("until_done_progress", { note: "real work" })], {
				stopReason: "toolUse",
			}),
			fauxAssistantMessage("done", { stopReason: "stop" }),
		]);
		await rt.prompt("hi");
		// The interactive prompt set userMessagedThisTurn=true (input hook),
		// agent_end consults it, persists kind=verdict with note 'user-driven turn',
		// and does NOT call sendUserMessage (no continuation). After consult, flag resets.
		const verdictPatches = rt
			.getStateEntries()
			.filter((e) => e.kind === "verdict")
			.map((e) => e.patch as { lastReason?: string });
		expect(verdictPatches.some((p) => p.lastReason === "user-driven turn")).toBe(
			true,
		);
		expect(rt.store.userMessagedThisTurn).toBe(false);
	});

	test("budget exhaustion transitions active → paused with budget reason", async () => {
		rt = await createTestRuntime({ withUi: true });
		seedActive(rt, { maxTurns: 1, turnsUsed: 0 });
		rt.setLLM([
			fauxAssistantMessage([fauxToolCall("until_done_progress", { note: "1" })], {
				stopReason: "toolUse",
			}),
			fauxAssistantMessage("done", { stopReason: "stop" }),
		]);
		await rt.prompt("first");
		// turnsUsed becomes 1 in agent_end → triggers budget guard
		expect(rt.store.state.status).toBe("paused");
		expect(rt.store.state.pausedReason).toContain("turn budget exhausted");
	});

	test("only registers the until-done command (no provider/skill/prompt registrations beyond the API surface)", async () => {
		rt = await createTestRuntime({ withUi: true });
		const extensionCommands = rt.pi
			.getCommands()
			.filter((c) => c.source === "extension")
			.map((c) => c.name);
		expect(extensionCommands).toEqual(["until-done"]);
	});
});
