const LIFECYCLE = {
	flagOpening: (g: string) => `/until-done flag set — opening setup for: ${g}`,
	coexistGoal:
		"Note: @qhn/pi-goal is also installed. /until-done and /goal coexist — pick one per session.",
	setupStarted: (intent: string) =>
		`/until-done · setup started for "${intent}"`,
	contractApproved: "/until-done · contract approved. Pi will activate now.",
	contractAlreadyApproved: "/until-done · contract is already approved.",
	contractApprovalNeedsUi:
		"Contract approval requires an interactive UI. Re-run `/until-done approve` there.",
	noContractToApprove: "No pending contract to approve.",
	contractRejected: "/until-done · contract rejected. Goal cleared.",
	paused: "/until-done paused.",
	resumed: (g: string) => `/until-done resumed (budget reset). Goal: ${g}`,
	cancelled: "/until-done cancelled.",
	noGoalToCancel: "No goal to cancel.",
	nothingToResume: "Nothing to resume.",
	nothingToPause: (status: string) => `Nothing to pause (status=${status}).`,
	autopilotEnabled:
		"/until-done · autopilot ON. Future setups will skip the contract confirmation dialog.",
	autopilotDisabled:
		"/until-done · autopilot OFF. Future setups will require the contract confirmation dialog.",
};

const INSPECTION = {
	noActiveGoal: "No active /until-done goal.",
	noTasksYet:
		"No tasks yet. After /until-done <intent> is approved, Pi will call `until_done_plan` to generate the list.",
	noPlanYet: "No plan written yet. Pi must call until_done_plan first.",
	livePlanAt: (p: string) => `Live task list: ${p}`,
	noNorthStar: "No active goal. Run /until-done <intent> first.",
	noReplans: "No replans on record.",
};

const BUDGET = {
	budgetRange: (max: number) => `Budget must be an integer 1..${max}.`,
	budgetSet: (n: number) => `/until-done · budget set to ${n}.`,
	budgetExhausted: (used: number, max: number) =>
		`/until-done paused: budget exhausted (${used}/${max}). Use /until-done resume to continue.`,
	spinGuard:
		"/until-done blocked: agent made no progress this turn. /until-done resume to retry.",
};

export const NOTIFY = { ...LIFECYCLE, ...INSPECTION, ...BUDGET };
