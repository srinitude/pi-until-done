import { describe, expect, test } from "bun:test";
import { createStore, persist, replayStateEntries } from "../extensions/lib/store";

const legacyEntry = (patch: Record<string, unknown>) => ({
	type: "custom",
	customType: "until-done.state",
	data: {
		kind: "set",
		goalId: "legacy-goal",
		at: 1,
		patch,
	},
});

describe("versioned session state", () => {
	test("marks valid 0.2 state for a one-way migration", () => {
		const result = replayStateEntries([
			legacyEntry({
				id: "legacy-goal",
				goal: "ship legacy goal",
				status: "active",
			}),
		]);
		expect(result.state.status).toBe("active");
		expect(result.state.goal).toBe("ship legacy goal");
		expect(result.needsMigration).toBe(true);
		expect(result.migrationError).toBeUndefined();
	});

	test("does not migrate a branch that already has version 3 state", () => {
		const result = replayStateEntries([
			legacyEntry({ goal: "old", status: "active" }),
			{
				type: "custom",
				customType: "until-done.state",
				data: {
					schemaVersion: 3,
					kind: "migrate",
					goalId: "legacy-goal",
					at: 2,
					patch: { goal: "old", status: "active" },
				},
			},
		]);
		expect(result.needsMigration).toBe(false);
	});

	test("pauses invalid legacy state instead of guessing it active", () => {
		const result = replayStateEntries([
			legacyEntry({ goal: "unsafe", status: "unknown-status" }),
		]);
		expect(result.state.status).toBe("paused");
		expect(result.state.pausedReason).toContain("legacy state migration failed");
		expect(result.needsMigration).toBe(true);
		expect(result.migrationError).toBeDefined();
	});

	test("persists every new event with schema version 3", () => {
		const store = createStore();
		let captured: unknown;
		const pi = {
			appendEntry: (_type: string, data: unknown) => {
				captured = data;
			},
		};
		persist(pi as never, store, "progress", { goal: "versioned" });
		expect(captured).toMatchObject({ schemaVersion: 3, kind: "progress" });
	});
});
