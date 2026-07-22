import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { SETUP_CONFIRM_TIMEOUT_MS } from "../constants";
import { resetGoalState } from "../initial-state";
import { persist, type Store } from "../store";
import { DIALOGS, NOTIFY } from "../strings";
import { refreshStatus } from "../ui/status-line";
import { refreshWidget } from "../ui/widget";
import { setupPrompt } from "./setup-prompt";

const isReplaceable = (status: string): boolean =>
	status === "active" || status === "paused" || status === "blocked";

const confirmReplace = async (
	store: Store,
	ctx: ExtensionCommandContext,
): Promise<boolean> => {
	const choice = await ctx.ui.select(DIALOGS.replaceGoalTitle, [
		DIALOGS.replaceGoalChoice(store.state.status),
		DIALOGS.keepGoalChoice,
		DIALOGS.cancelChoice,
	]);
	return choice === DIALOGS.replaceGoalChoice(store.state.status);
};

const initSetupState = (
	pi: ExtensionAPI,
	store: Store,
	intent: string,
): void => {
	const id = `ud-${Math.random().toString(36).slice(2, 8)}`;
	store.state = {
		...resetGoalState(store.state),
		id,
		goal: intent,
		status: "setup",
		createdAt: Date.now(),
	};
	persist(
		pi,
		store,
		"set",
		{ id, goal: intent, status: "setup" },
		"setup begin",
	);
};

const grantContractApproval = (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
	note: string,
): void => {
	store.state.confirmedByUser = true;
	persist(pi, store, "confirm", { confirmedByUser: true }, note);
	ctx.ui.notify(NOTIFY.contractApproved, "info");
	pi.sendUserMessage("Approved. Call `until_done_set` now and begin work.");
};

const rejectContract = (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
): void => {
	persist(
		pi,
		store,
		"cancel",
		resetGoalState(store.state),
		"user rejected contract",
	);
	ctx.ui.notify(NOTIFY.contractRejected, "info");
};

export const cmdApprove = async (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
): Promise<void> => {
	if (store.state.status !== "setup" || !store.state.goal) {
		ctx.ui.notify(NOTIFY.noContractToApprove, "warning");
		return;
	}
	if (store.state.confirmedByUser) {
		ctx.ui.notify(NOTIFY.contractAlreadyApproved, "info");
		return;
	}
	if (!ctx.hasUI) {
		ctx.ui.notify(NOTIFY.contractApprovalNeedsUi, "warning");
		return;
	}
	const confirmed = await ctx.ui.confirm(
		DIALOGS.approveTitle,
		DIALOGS.approveMessage,
		{ timeout: SETUP_CONFIRM_TIMEOUT_MS },
	);
	if (confirmed)
		grantContractApproval(pi, store, ctx, "user approved contract");
	else rejectContract(pi, store, ctx);
	refreshStatus(store, ctx);
	refreshWidget(store, ctx, true);
};

export const cmdSetup = async (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
	intent: string,
): Promise<void> => {
	if (isReplaceable(store.state.status)) {
		const replace = await confirmReplace(store, ctx);
		if (!replace) return;
		persist(
			pi,
			store,
			"cancel",
			resetGoalState(store.state),
			"replaced by new setup",
		);
	}
	initSetupState(pi, store, intent);
	pi.sendUserMessage(setupPrompt(intent));
	ctx.ui.notify(NOTIFY.setupStarted(intent), "info");
	if (store.state.autopilotEnabled) {
		grantContractApproval(pi, store, ctx, "autopilot");
	}
	refreshStatus(store, ctx);
	refreshWidget(store, ctx, true);
};
