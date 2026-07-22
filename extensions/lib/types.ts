export type GoalStatus =
	| "setup"
	| "planning"
	| "active"
	| "paused"
	| "blocked"
	| "done"
	| "cleared";

export type TaskStatus =
	| "pending"
	| "in_progress"
	| "done"
	| "blocked"
	| "skipped";

export type Phase =
	| "analysis"
	| "bootstrap"
	| "red"
	| "green"
	| "refactor"
	| "cleanup"
	| "none";

/**
 * Two distinct goal shapes (informed by Codex /goal lessons):
 *
 *   "ticket"      — the solution shape is known up-front; full TDD discipline
 *                   applies; tasks are decomposed before activation.
 *   "exploratory" — only the destination is known; the path is discovered by
 *                   running. TDD is relaxed in early phases; replans are
 *                   expected; a final cleanup/distill step is required.
 */
export type GoalType = "ticket" | "exploratory";

/**
 * A "surface" is anything Pi can act on while pursuing the goal — a log
 * stream, a metrics dashboard, a staging URL, a flame graph, a cost table,
 * a sandbox cluster. Goals are only as effective as the surfaces they have
 * access to. The setup interview captures these explicitly so Pi knows
 * what's reachable and the user knows what was promised.
 */
export interface Surface {
	kind: string;
	location: string;
	notes?: string;
}

export interface Prerequisite {
	description: string;
	cleared: boolean;
}

export interface ContextRef {
	path?: string;
	url?: string;
	why: string;
}

export interface Task {
	id: string;
	title: string;
	phase: Phase;
	status: TaskStatus;
	dependencies: string[];
	blocks: string[];
	prerequisites: Prerequisite[];
	validationSteps: string[];
	ciCommands: string[];
	styleguideRules: string[];
	guardrails: string[];
	learnings: string[];
	gotchas: string[];
	context: ContextRef[];
	notes?: string;
}

export interface JudgeModel {
	provider: string;
	modelId: string;
}

export type JudgeDefault =
	| { mode: "cross"; provider: string; modelId: string }
	| { mode: "same" }
	| null;

export interface NorthStar {
	goal: string;
	doneCriteria: string;
	verifyCommand?: string;
	askBefore: string[];
	decisionStyle: string;
	goalType: GoalType;
	surfaces: Surface[];
	judgeModel?: JudgeModel;
	sameModelJudge?: boolean;
}

export interface ReplanLogEntry {
	at: number;
	reason: string;
	opsCount: number;
}

export interface GoalState {
	id: string;
	goal: string;
	doneCriteria: string;
	askBefore: string[];
	decisionStyle: string;
	verifyCommand?: string;
	northStar?: NorthStar;
	evidence: string[];
	status: GoalStatus;
	phase: Phase;
	turnsUsed: number;
	maxTurns: number;
	createdAt: number;
	lastTurnAt: number;
	lastVerdict?: "done" | "continue" | "blocked";
	lastReason?: string;
	pausedReason?: string;
	confirmedByUser: boolean;
	tasks: Task[];
	replanLog: ReplanLogEntry[];
	currentTaskId?: string;
	planComplete: boolean;
	cleanEndPrompts: number;
	goalType: GoalType;
	surfaces: Surface[];
	distilled?: string;
	autopilotEnabled: boolean;
	judgeDefault: JudgeDefault;
}

export type StateEventKind =
	| "set"
	| "confirm"
	| "pause"
	| "resume"
	| "cancel"
	| "complete"
	| "block"
	| "progress"
	| "budget"
	| "verdict"
	| "plan"
	| "replan"
	| "task_update"
	| "clean_end_nudge"
	| "migrate"
	| "preference";

export interface StateEvent {
	schemaVersion?: 3;
	kind: StateEventKind;
	goalId: string;
	at: number;
	patch?: Partial<GoalState>;
	taskId?: string;
	note?: string;
}

export interface Stats {
	providerRequests: number;
	providerResponses: number;
	userBashRuns: number;
	modelSwitches: number;
	thinkingSwitches: number;
	messageUpdates: number;
	toolStarts: number;
	toolEnds: number;
}
