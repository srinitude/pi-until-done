import { HARD_BUDGET_CEILING } from "../constants";

export const HELP_TEXT = [
	"/until-done <intent>          — start setup for a new goal",
	"/until-done status            — show current state",
	"/until-done pause             — pause autonomous continuation",
	"/until-done resume            — resume after pause/block (resets budget)",
	"/until-done approve           — approve the visible contract and task plan",
	"/until-done cancel            — clear the active goal (only way to change North Star)",
	`/until-done budget <n>        — set turn budget (1..${HARD_BUDGET_CEILING})`,
	"/until-done detail            — open full contract overlay",
	"/until-done tasks             — print the live YAML task list",
	"/until-done plan              — open .until-done/tasks.yaml location",
	"/until-done northstar         — print the locked goal contract",
	"/until-done replan-log        — show every replan and its reason",
	"/until-done ask <question>    — side question (does not preempt the loop)",
	"/until-done autopilot         — toggle skipping the contract dialog",
	"/until-done help              — this message",
].join("\n");

export const COMMAND_DESCRIPTION =
	"Pi-led autonomous goal pursuit (Ralph loop with self-judge).";

export const SHORTCUT_DESCRIPTION = "/until-done · toggle status widget";

export const FLAG_DESCRIPTION =
	"Set a standing goal at startup and pursue it autonomously.";

export const TOOL_PROMPT_SNIPPET =
	"until_done_set: lock in a /until-done goal contract once the user has approved it.";

export const WORKING_MESSAGE_PREFIX = "pursuing: ";

export const TITLE_PREFIX = "pi · ";
