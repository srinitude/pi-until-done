import { DEFAULT_MAX_TURNS } from "./constants";
import type { GoalState, Stats } from "./types";

export const initialState = (): GoalState => ({
	id: "",
	goal: "",
	doneCriteria: "",
	askBefore: [],
	decisionStyle: "",
	evidence: [],
	status: "setup",
	phase: "analysis",
	turnsUsed: 0,
	maxTurns: DEFAULT_MAX_TURNS,
	createdAt: 0,
	lastTurnAt: 0,
	confirmedByUser: false,
	tasks: [],
	replanLog: [],
	planComplete: false,
	cleanEndPrompts: 0,
	goalType: "ticket",
	surfaces: [],
	autopilotEnabled: false,
	judgeDefault: null,
});

export const resetGoalState = (previous: GoalState): GoalState => ({
	...initialState(),
	autopilotEnabled: previous.autopilotEnabled,
	judgeDefault: previous.judgeDefault,
});

export const initialStats = (): Stats => ({
	providerRequests: 0,
	providerResponses: 0,
	userBashRuns: 0,
	modelSwitches: 0,
	thinkingSwitches: 0,
	messageUpdates: 0,
	toolStarts: 0,
	toolEnds: 0,
});
