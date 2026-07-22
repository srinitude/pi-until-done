import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { RESPONSE_SNIPPET_CHARS } from "../constants";
import { continuationMessage } from "../continuation";
import { persist, type Store } from "../store";
import { CLEAN_END, NOTIFY } from "../strings";
import type { NorthStar } from "../types";
import { refreshStatus } from "../ui/status-line";
import { refreshWidget } from "../ui/widget";

export const handleBudgetExhausted = (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionContext,
): void => {
	const { turnsUsed, maxTurns } = store.state;
	persist(pi, store, "budget", {
		status: "paused",
		pausedReason: `turn budget exhausted (${turnsUsed}/${maxTurns})`,
	});
	ctx.ui.notify(NOTIFY.budgetExhausted(turnsUsed, maxTurns), "warning");
	refreshStatus(store, ctx);
	refreshWidget(store, ctx, true);
};

export const handleSpinGuard = (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionContext,
): void => {
	persist(pi, store, "block", {
		status: "blocked",
		pausedReason: "no tool calls or progress signals this turn",
		lastVerdict: "blocked",
		lastReason: "spin guard",
	});
	ctx.ui.notify(NOTIFY.spinGuard, "warning");
	refreshStatus(store, ctx);
	refreshWidget(store, ctx, true);
};

const cleanEndPrompt = (ns: NorthStar | undefined): string =>
	[
		CLEAN_END.header,
		CLEAN_END.intro,
		"",
		CLEAN_END.cleanupCheck,
		"",
		ns?.verifyCommand
			? CLEAN_END.withVerify(ns.verifyCommand)
			: CLEAN_END.withoutVerify,
		CLEAN_END.residual,
		"",
		CLEAN_END.distillReminder,
		"",
		CLEAN_END.footer,
	].join("\n");

export const handleCleanEnd = (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionContext,
): void => {
	persist(pi, store, "clean_end_nudge", {
		cleanEndPrompts: store.state.cleanEndPrompts + 1,
	});
	pi.sendUserMessage(cleanEndPrompt(store.state.northStar), {
		deliverAs: "followUp",
	});
	refreshStatus(store, ctx);
	refreshWidget(store, ctx, true);
};

export const queueContinuation = (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionContext,
): void => {
	persist(pi, store, "verdict", {
		lastVerdict: "continue",
		lastReason: "auto-continue",
	});
	const s = store.state;
	const text = continuationMessage(
		s.goal,
		s.doneCriteria,
		s.askBefore,
		s.phase,
		s.verifyCommand,
	).slice(0, RESPONSE_SNIPPET_CHARS);
	pi.sendUserMessage(text, { deliverAs: "followUp" });
	refreshStatus(store, ctx);
	refreshWidget(store, ctx);
};
