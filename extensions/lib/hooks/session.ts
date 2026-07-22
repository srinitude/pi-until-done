import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	COMPACTION_CONTEXT_CUSTOM_TYPE,
	STATUS_KEY,
	WIDGET_KEY,
} from "../constants";
import { persist, reconstructFromSession, type Store } from "../store";
import { DIALOGS, NOTIFY } from "../strings";
import { refreshStatus } from "../ui/status-line";
import { refreshWidget } from "../ui/widget";
import { compactionAnnotation } from "./compaction-context";

const handleStartupFlag = (
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	reason: string,
): void => {
	const flagValue = pi.getFlag("until-done");
	if (reason !== "startup") return;
	if (typeof flagValue !== "string" || !flagValue.trim()) return;
	ctx.ui.notify(NOTIFY.flagOpening(flagValue), "info");
	pi.sendUserMessage(`/until-done ${flagValue}`);
};

const warnGoalCollision = (pi: ExtensionAPI, ctx: ExtensionContext): void => {
	const cmds = pi.getCommands();
	const collision = cmds.some(
		(c) => c.name === "goal" && c.source === "extension",
	);
	if (!collision) return;
	ctx.ui.notify(NOTIFY.coexistGoal, "info");
};

const onSessionStart = (pi: ExtensionAPI, store: Store) => {
	pi.on("session_start", async (event, ctx) => {
		reconstructFromSession(pi, store, ctx);
		refreshStatus(store, ctx);
		refreshWidget(store, ctx);
		handleStartupFlag(pi, ctx, event.reason);
		warnGoalCollision(pi, ctx);
		return undefined;
	});
};

const onSessionBeforeSwitch = (pi: ExtensionAPI, store: Store) => {
	pi.on("session_before_switch", async (_event, ctx) => {
		if (store.state.status !== "active" || !ctx.hasUI) return undefined;
		const ok = await ctx.ui.confirm(
			DIALOGS.leaveActiveTitle,
			DIALOGS.leaveActiveMessage(store.state.turnsUsed, store.state.maxTurns),
		);
		return ok ? undefined : { cancel: true };
	});
};

const forkChoices = [
	DIALOGS.forkChoiceCarry,
	DIALOGS.forkChoiceLeave,
	DIALOGS.forkChoiceCancel,
] as const;

const LEAVE_GOAL_RESULT = {
	cancel: false,
	skipConversationRestore: false,
} as const;

const onSessionBeforeFork = (pi: ExtensionAPI, store: Store) => {
	pi.on("session_before_fork", async (_event, ctx) => {
		if (store.state.status !== "active" || !ctx.hasUI) return undefined;
		const choice = await ctx.ui.select(DIALOGS.forkTitle, [...forkChoices]);
		if (choice === DIALOGS.forkChoiceCancel) return { cancel: true };
		if (choice === DIALOGS.forkChoiceLeave) return LEAVE_GOAL_RESULT;
		return undefined;
	});
};

const onSessionCompact = (pi: ExtensionAPI, store: Store) => {
	pi.on("session_compact", () => {
		if (store.state.status !== "active") return;
		persist(pi, store, "verdict", undefined, "post-compaction re-anchor");
		pi.sendMessage(
			{
				customType: COMPACTION_CONTEXT_CUSTOM_TYPE,
				content: compactionAnnotation(store.state),
				display: false,
			},
			{ triggerTurn: false },
		);
	});
};

const onSessionTree = (pi: ExtensionAPI, store: Store) => {
	pi.on("session_tree", async (_event, ctx) => {
		reconstructFromSession(pi, store, ctx);
		refreshStatus(store, ctx);
		refreshWidget(store, ctx, true);
	});
};

const onSessionShutdown = (pi: ExtensionAPI) => {
	pi.on("session_shutdown", async (_event, ctx) => {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		ctx.ui.setWidget(WIDGET_KEY, undefined);
	});
};

export const registerSessionHooks = (pi: ExtensionAPI, store: Store): void => {
	onSessionStart(pi, store);
	onSessionBeforeSwitch(pi, store);
	onSessionBeforeFork(pi, store);
	onSessionCompact(pi, store);
	pi.on("session_before_tree", async () => undefined);
	onSessionTree(pi, store);
	onSessionShutdown(pi);
};
