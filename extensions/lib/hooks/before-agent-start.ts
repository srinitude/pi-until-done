import type {
	BeforeAgentStartEventResult,
	ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import type { Store } from "../store";
import {
	MISE_CLI_BLOCK,
	PI_CONFIG_PRINCIPLES,
	REMINDER,
	VERIFIABILITY_BLOCK,
} from "../strings";
import { STRUCTURAL_CONSTRAINTS_BLOCK } from "../structural-constraints";
import type { GoalState, NorthStar } from "../types";

const northStarBlock = (
	ns: NorthStar | undefined,
	fallbackGoal: string,
): string => {
	if (!ns) return `Goal: ${fallbackGoal}\n`;
	const lines = [`Goal: ${ns.goal}`, `Goal type: ${ns.goalType}`];
	if (ns.doneCriteria) lines.push(`Done when: ${ns.doneCriteria}`);
	if (ns.verifyCommand) lines.push(`Verify: \`${ns.verifyCommand}\``);
	if (ns.askBefore.length) lines.push(`Ask before: ${ns.askBefore.join(", ")}`);
	if (ns.decisionStyle) lines.push(`Decision style: ${ns.decisionStyle}`);
	if (ns.surfaces.length) {
		const list = ns.surfaces.map((s) => `${s.kind}: ${s.location}`).join("; ");
		lines.push(`Surfaces available: ${list}`);
	}
	return `${lines.join("\n")}\n`;
};

const taskBlock = (s: GoalState): string => {
	const total = s.tasks.length;
	if (!total) return "";
	const done = s.tasks.filter((t) => t.status === "done").length;
	const current = s.tasks.find((t) => t.id === s.currentTaskId);
	return REMINDER.tasksLine(
		done,
		total,
		current?.id ?? "(none)",
		current?.title ?? "",
	);
};

const STATIC_REMINDER = [
	REMINDER.tdd,
	VERIFIABILITY_BLOCK,
	"",
	PI_CONFIG_PRINCIPLES,
	"",
	MISE_CLI_BLOCK,
	"",
	STRUCTURAL_CONSTRAINTS_BLOCK,
	"",
	REMINDER.planning,
	REMINDER.tools,
].join("\n");

const buildReminder = (s: GoalState): string => {
	const meta =
		REMINDER.phaseLine(s.phase) + REMINDER.budgetLine(s.turnsUsed, s.maxTurns);
	return (
		REMINDER.northStarHeader +
		northStarBlock(s.northStar, s.goal) +
		meta +
		taskBlock(s) +
		STATIC_REMINDER
	);
};

export const registerBeforeAgentStart = (
	pi: ExtensionAPI,
	store: Store,
): void => {
	pi.on(
		"before_agent_start",
		(event): BeforeAgentStartEventResult | undefined => {
			if (store.state.status !== "active") return undefined;
			return { systemPrompt: event.systemPrompt + buildReminder(store.state) };
		},
	);
};
