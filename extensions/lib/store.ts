import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { STATE_CUSTOM_TYPE } from "./constants";
import { initialState, initialStats, resetGoalState } from "./initial-state";
import type { GoalState, StateEvent, StateEventKind, Stats } from "./types";

export interface Store {
	state: GoalState;
	stats: Stats;
	lastAssistantText: string;
	progressSignalsThisTurn: number;
	codeEditsThisTurn: number;
	userMessagedThisTurn: boolean;
	lastTickAt: number;
}

interface EntryLike {
	type: string;
	customType?: string;
	data?: unknown;
}

export interface ReplayResult {
	state: GoalState;
	needsMigration: boolean;
	migrationError?: string;
}

const VALID_STATUSES = new Set([
	"setup",
	"planning",
	"active",
	"paused",
	"blocked",
	"done",
	"cleared",
]);

export const createStore = (): Store => ({
	state: initialState(),
	stats: initialStats(),
	lastAssistantText: "",
	progressSignalsThisTurn: 0,
	codeEditsThisTurn: 0,
	userMessagedThisTurn: false,
	lastTickAt: 0,
});

export const persist = (
	pi: ExtensionAPI,
	store: Store,
	kind: StateEventKind,
	patch?: Partial<GoalState>,
	note?: string,
): void => {
	store.state = { ...store.state, ...patch };
	const event: StateEvent = {
		schemaVersion: 3,
		kind,
		goalId: store.state.id,
		at: Date.now(),
		patch,
		note,
	};
	pi.appendEntry<StateEvent>(STATE_CUSTOM_TYPE, event);
};

const stateEvent = (entry: EntryLike): StateEvent | undefined => {
	if (entry.type !== "custom" || entry.customType !== STATE_CUSTOM_TYPE) {
		return undefined;
	}
	if (!entry.data || typeof entry.data !== "object") return undefined;
	return entry.data as StateEvent;
};

const applyEvent = (state: GoalState, event: StateEvent): GoalState => {
	if (event.kind === "cancel") {
		return { ...resetGoalState(state), ...event.patch };
	}
	return event.patch ? { ...state, ...event.patch } : state;
};

const validState = (state: GoalState): boolean =>
	VALID_STATUSES.has(state.status) &&
	typeof state.id === "string" &&
	typeof state.goal === "string" &&
	typeof state.doneCriteria === "string" &&
	Array.isArray(state.evidence) &&
	Array.isArray(state.tasks) &&
	Number.isFinite(state.turnsUsed) &&
	Number.isFinite(state.maxTurns);

const pausedMigration = (state: GoalState, reason: string): GoalState => ({
	...resetGoalState(state),
	id: typeof state.id === "string" ? state.id : "",
	goal: typeof state.goal === "string" ? state.goal : "",
	status: "paused",
	pausedReason: reason,
});

export const replayStateEntries = (
	entries: readonly EntryLike[],
): ReplayResult => {
	let state = initialState();
	let sawLegacy = false;
	let sawV3 = false;
	for (const entry of entries) {
		const event = stateEvent(entry);
		if (!event) continue;
		if (event.schemaVersion === 3) sawV3 = true;
		else sawLegacy = true;
		state = applyEvent(state, event);
	}
	const needsMigration = sawLegacy && !sawV3;
	if (validState(state)) return { state, needsMigration };
	const migrationError = "legacy state migration failed validation";
	return {
		state: pausedMigration(state, migrationError),
		needsMigration,
		migrationError,
	};
};

export const reconstructFromSession = (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionContext,
): void => {
	const result = replayStateEntries(ctx.sessionManager.getBranch());
	store.state = result.state;
	if (!result.needsMigration) return;
	persist(
		pi,
		store,
		"migrate",
		{ ...result.state },
		result.migrationError ?? "migrated session state from 0.2.x",
	);
};
