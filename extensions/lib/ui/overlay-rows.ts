import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { OVERLAY } from "../strings";
import type { GoalState } from "../types";

export const headerLines = (theme: Theme, width: number): string[] => {
	const title = theme.fg("accent", OVERLAY.title);
	const left = theme.fg("borderMuted", "─".repeat(3));
	const right = theme.fg("borderMuted", "─".repeat(Math.max(0, width - 26)));
	return ["", truncateToWidth(left + title + right, width), ""];
};

const row = (
	theme: Theme,
	label: string,
	value: string,
	width: number,
): string =>
	truncateToWidth(`  ${theme.fg("muted", `${label}:`)}        ${value}`, width);

export const coreRows = (
	s: GoalState,
	theme: Theme,
	width: number,
): string[] => [
	row(theme, OVERLAY.rowLabels.status, s.status, width),
	row(theme, OVERLAY.rowLabels.budget, `${s.turnsUsed}/${s.maxTurns}`, width),
	row(theme, OVERLAY.rowLabels.goal, s.goal, width),
	row(theme, OVERLAY.rowLabels.phase, s.phase, width),
];

export const optionalRows = (
	s: GoalState,
	theme: Theme,
	width: number,
): string[] => {
	const out: string[] = [];
	const r = OVERLAY.rowLabels;
	if (s.doneCriteria) out.push(row(theme, r.doneWhen, s.doneCriteria, width));
	if (s.verifyCommand) out.push(row(theme, r.verify, s.verifyCommand, width));
	if (s.askBefore.length)
		out.push(row(theme, r.askBefore, s.askBefore.join(", "), width));
	if (s.decisionStyle)
		out.push(row(theme, r.decisions, s.decisionStyle, width));
	if (s.lastReason) {
		const v = `${s.lastVerdict ?? "?"} — ${s.lastReason}`;
		out.push(row(theme, r.lastVerdict, v, width));
	}
	return out;
};

export const evidenceRows = (
	s: GoalState,
	theme: Theme,
	width: number,
): string[] => {
	if (!s.evidence.length) return [];
	const out = [
		truncateToWidth(`  ${theme.fg("muted", OVERLAY.evidenceHeader)}`, width),
	];
	for (const e of s.evidence.slice(-8)) {
		out.push(truncateToWidth(`    · ${theme.fg("text", e)}`, width));
	}
	out.push("");
	return out;
};
