import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { STATUS_KEY } from "../constants";
import type { Store } from "../store";
import { STATUS, TITLE_PREFIX } from "../strings";
import type { GoalState } from "../types";
import { phaseGlyph } from "./phase-glyph";

const truncateGoal = (goal: string): string =>
	goal.length > 50 ? `${goal.slice(0, 47)}…` : goal;

const taskCounter = (s: GoalState): string => {
	const total = s.tasks.length;
	if (!total) return "";
	const done = s.tasks.filter((x) => x.status === "done").length;
	return ` ${done}/${total}`;
};

const activeLine = (s: GoalState, trunc: string): string => {
	const t = `${s.turnsUsed}/${s.maxTurns}`;
	const ph = `${phaseGlyph(s.phase)} ${s.phase}`;
	return STATUS.active(t, ph, taskCounter(s), trunc);
};

const pausedLine = (s: GoalState, trunc: string): string => {
	const t = `${s.turnsUsed}/${s.maxTurns}`;
	const reason = s.pausedReason ? ` — ${s.pausedReason}` : "";
	return STATUS.paused(t, reason, trunc);
};

export const statusLine = (s: GoalState): string | undefined => {
	if (s.status === "cleared" || !s.goal) return undefined;
	const trunc = truncateGoal(s.goal);
	const t = `${s.turnsUsed}/${s.maxTurns}`;
	switch (s.status) {
		case "setup":
			return STATUS.setup(trunc);
		case "planning":
			return STATUS.planning(trunc);
		case "active":
			return activeLine(s, trunc);
		case "paused":
			return pausedLine(s, trunc);
		case "blocked":
			return STATUS.blocked(t, trunc);
		case "done":
			return STATUS.done(trunc);
	}
};

export const refreshStatus = (store: Store, ctx: ExtensionContext): void => {
	const line = statusLine(store.state);
	ctx.ui.setStatus(STATUS_KEY, line);
	if (line && store.state.status === "active") {
		ctx.ui.setTitle(`${TITLE_PREFIX}${line}`);
	}
};
