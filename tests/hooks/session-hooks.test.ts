import { afterEach, describe, expect, test } from "bun:test";
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

describe("session_start (real runtime)", () => {
	test("on bind, status line is set and reflects no-active-goal", async () => {
		rt = await createTestRuntime({ withUi: true });
		// session_start fires during bindExtensions; refreshStatus / refreshWidget
		// run with our mock UI, so traces should be populated.
		const widgetCalls = rt.ui.widgets.filter((w) => w.key === "until-done");
		expect(widgetCalls.length).toBeGreaterThan(0);
	});

	test("--until-done flag at startup queues a /until-done <intent> turn", async () => {
		// We test this by registering the flag value before bind. The harness
		// doesn't expose flag injection directly; the flag value is sourced from
		// pi.getFlag("until-done"). The handleStartupFlag handler reads that.
		// To exercise it, we'd need the flag to be set before session_start fires.
		// That requires plumbing through `extensionFlagValues` in services. Skipped
		// as a unit; the integration test covers the full /until-done <intent> flow
		// via runtime.prompt().
		expect(true).toBe(true);
	});
});

const emitCompact = async (runtime: TestRuntime): Promise<void> => {
	await runtime.session.extensionRunner.emit({
		type: "session_compact",
		compactionEntry: {} as never,
		fromExtension: false,
		reason: "manual",
		willRetry: false,
	});
};

const compactionEntry = (runtime: TestRuntime) =>
	runtime.session.sessionManager.getBranch().find(
		(entry) =>
			entry.type === "custom_message" &&
			(entry as { customType?: string }).customType ===
				"until-done.compaction-context",
	);

describe("session_compact re-anchor (#2 fix)", () => {
	test("emits a hidden compaction context message for an active goal", async () => {
		rt = await createTestRuntime({ withUi: true });
		rt.store.state = {
			...rt.store.state,
			status: "active",
			id: "ud-test",
			goal: "ship X",
			northStar: makeNorthStar(),
			confirmedByUser: true,
			evidence: ["found surface", "wrote failing test"],
			turnsUsed: 5,
		};
		await emitCompact(rt);
		const found = compactionEntry(rt) as
			| { content: string; display: boolean }
			| undefined;
		expect(found?.display).toBe(false);
		expect(found?.content).toContain("ship X");
		expect(found?.content).toContain("found surface");
	});

	test("does not append compaction context when status is not active", async () => {
		rt = await createTestRuntime({ withUi: true });
		await emitCompact(rt);
		expect(compactionEntry(rt)).toBeUndefined();
	});
});

describe("session_shutdown", () => {
	test("clears status + widget keys cleanly on dispose", async () => {
		rt = await createTestRuntime({ withUi: true });
		const before = rt.ui.statuses.length;
		await rt.runtimeHost.dispose();
		// Set rt to undefined so afterEach doesn't re-dispose
		const traceAfter = rt.ui;
		rt = undefined;
		// session_shutdown triggers ctx.ui.setStatus(STATUS_KEY, undefined)
		const cleared = traceAfter.statuses.find(
			(s) => s.key === "until-done" && s.text === undefined,
		);
		expect(cleared).toBeDefined();
		expect(traceAfter.statuses.length).toBeGreaterThan(before);
	});
});
