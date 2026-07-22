export const DIALOGS = {
	leaveActiveTitle: "/until-done active",
	leaveActiveMessage: (used: number, max: number) =>
		`A goal is in progress (${used}/${max} turns). Leave it behind?`,
	forkTitle: "/until-done · forking session",
	forkChoiceCarry: "Carry the goal into the fork",
	forkChoiceLeave: "Leave the goal in this session",
	forkChoiceCancel: "Cancel fork",
	cancelTitle: "/until-done · cancel?",
	cancelMessage: (g: string) => `Cancel goal: ${g}`,
	approveTitle: "/until-done · approve contract?",
	approveMessage:
		"Review the visible contract and task plan. Approve to let Pi call `until_done_set` and begin pursuit.",
	askBeforeTitle: "/until-done · ask-before",
	askBeforeMessage: (kind: string, command: string | undefined) =>
		`Pi wants to run a "${kind}" command:\n\n${command ?? ""}\n\nAllow?`,
	replaceGoalTitle: "/until-done already has a goal",
	replaceGoalChoice: (status: string) => `Replace current goal (${status})`,
	keepGoalChoice: "Keep current goal",
	cancelChoice: "Cancel",
	largeBudgetTitle: "/until-done · large budget",
	largeBudgetMessage: (n: number, threshold: number) =>
		`Budget of ${n} turns is past the "go to lunch" zone (>${threshold}). At ~1 turn/min that's ${Math.round((n / 60) * 10) / 10}h of agent time and proportional API spend. Continue?`,
	resumeDoneTitle: "/until-done · challenge completion?",
	resumeDoneMessage: (g: string) =>
		`Pi marked this goal done. Resume to challenge the completion (Pi must produce new evidence)?\n\nGoal: ${g}`,
};
