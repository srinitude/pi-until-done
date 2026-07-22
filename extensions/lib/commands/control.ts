import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	HARD_BUDGET_CEILING,
	LARGE_BUDGET_CONFIRM_THRESHOLD,
} from "../constants";
import { resetGoalState } from "../initial-state";
import { persist, type Store } from "../store";
import { DIALOGS, NOTIFY } from "../strings";
import { refreshStatus } from "../ui/status-line";
import { refreshWidget } from "../ui/widget";

export const cmdPause = async (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
): Promise<void> => {
	const s = store.state.status;
	if (s !== "active" && s !== "blocked") {
		ctx.ui.notify(NOTIFY.nothingToPause(s), "warning");
		return;
	}
	persist(pi, store, "pause", {
		status: "paused",
		pausedReason: "user-paused",
	});
	ctx.ui.notify(NOTIFY.paused, "info");
	refreshStatus(store, ctx);
	refreshWidget(store, ctx, true);
};

const confirmDoneResume = async (
	store: Store,
	ctx: ExtensionCommandContext,
): Promise<boolean> =>
	store.state.status !== "done" ||
	!ctx.hasUI ||
	ctx.ui.confirm(
		DIALOGS.resumeDoneTitle,
		DIALOGS.resumeDoneMessage(store.state.goal),
	);

const resumeMessage = (goal: string, challengingDone: boolean): string =>
	challengingDone
		? `User has disputed the previous /until-done_complete. Resume work on goal: ${goal}. New evidence is required before re-completion.`
		: `Resume work on the standing /until-done goal: ${goal}`;

export const cmdResume = async (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
): Promise<void> => {
	const state = store.state;
	if (state.status === "cleared" || !state.goal) {
		ctx.ui.notify(NOTIFY.nothingToResume, "warning");
		return;
	}
	if (!(await confirmDoneResume(store, ctx))) return;
	const challengingDone = state.status === "done";
	persist(
		pi,
		store,
		"resume",
		{
			status: "active",
			turnsUsed: 0,
			cleanEndPrompts: 0,
			pausedReason: undefined,
		},
		challengingDone ? "resumed after disputed completion" : undefined,
	);
	ctx.ui.notify(NOTIFY.resumed(state.goal), "info");
	pi.sendUserMessage(resumeMessage(state.goal, challengingDone));
	refreshStatus(store, ctx);
	refreshWidget(store, ctx);
};

export const cmdCancel = async (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
): Promise<void> => {
	if (!store.state.goal) {
		ctx.ui.notify(NOTIFY.noGoalToCancel, "info");
		return;
	}
	const ok = ctx.hasUI
		? await ctx.ui.confirm(
				DIALOGS.cancelTitle,
				DIALOGS.cancelMessage(store.state.goal),
			)
		: true;
	if (!ok) return;
	persist(pi, store, "cancel", resetGoalState(store.state), "user cancelled");
	ctx.ui.notify(NOTIFY.cancelled, "info");
	refreshStatus(store, ctx);
	refreshWidget(store, ctx, true);
};

const confirmLargeBudget = async (
	ctx: ExtensionCommandContext,
	n: number,
): Promise<boolean> => {
	if (n <= LARGE_BUDGET_CONFIRM_THRESHOLD || !ctx.hasUI) return true;
	return ctx.ui.confirm(
		DIALOGS.largeBudgetTitle,
		DIALOGS.largeBudgetMessage(n, LARGE_BUDGET_CONFIRM_THRESHOLD),
	);
};

export const cmdBudget = async (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
	raw: string,
): Promise<void> => {
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || n < 1 || n > HARD_BUDGET_CEILING) {
		ctx.ui.notify(NOTIFY.budgetRange(HARD_BUDGET_CEILING), "error");
		return;
	}
	const okay = await confirmLargeBudget(ctx, n);
	if (!okay) return;
	persist(pi, store, "budget", { maxTurns: n }, `budget set to ${n}`);
	ctx.ui.notify(NOTIFY.budgetSet(n), "info");
	refreshStatus(store, ctx);
	refreshWidget(store, ctx, true);
};

export const cmdAutopilot = async (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
): Promise<void> => {
	const autopilotEnabled = !store.state.autopilotEnabled;
	persist(pi, store, "preference", { autopilotEnabled }, "autopilot toggled");
	ctx.ui.notify(
		autopilotEnabled ? NOTIFY.autopilotEnabled : NOTIFY.autopilotDisabled,
		"warning",
	);
};
