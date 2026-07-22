import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { WIDGET_KEY } from "../constants";
import type { Store } from "../store";
import { WIDGET } from "../strings";
import type { GoalState } from "../types";
import { phaseGlyph } from "./phase-glyph";

const widgetLines = (s: GoalState): string[] => {
	const verdict = s.lastReason
		? WIDGET.verdict(s.lastVerdict ?? "?", s.lastReason)
		: "";
	return [
		WIDGET.header(s.status, phaseGlyph(s.phase), s.phase),
		WIDGET.goal(s.goal),
		s.doneCriteria ? WIDGET.doneWhen(s.doneCriteria) : "",
		s.verifyCommand ? WIDGET.verify(s.verifyCommand) : "",
		s.askBefore.length ? WIDGET.askBefore(s.askBefore) : "",
		WIDGET.budget(s.turnsUsed, s.maxTurns),
		verdict,
	].filter(Boolean);
};

const shouldSkip = (s: GoalState, force: boolean): boolean =>
	!force && s.status === "active";

export const refreshWidget = (
	store: Store,
	ctx: ExtensionContext,
	force = false,
): void => {
	if (!ctx.hasUI) return;
	const s = store.state;
	if (s.status === "cleared" || !s.goal) {
		ctx.ui.setWidget(WIDGET_KEY, undefined);
		return;
	}
	if (shouldSkip(s, force)) return;
	ctx.ui.setWidget(WIDGET_KEY, widgetLines(s), { placement: "aboveEditor" });
};
