import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { persist, type Store } from "../store";
import { WORKING_MESSAGE_PREFIX } from "../strings";
import type { GoalState } from "../types";
import { refreshStatus } from "../ui/status-line";
import { runCiOnStop } from "./agent-end-ci";
import {
	handleBudgetExhausted,
	handleCleanEnd,
	handleSpinGuard,
	queueContinuation,
} from "./agent-end-helpers";
import { registerBeforeAgentStart } from "./before-agent-start";

const allTasksDone = (s: GoalState): boolean =>
	s.tasks.length > 0 &&
	s.tasks.every((t) => t.status === "done" || t.status === "skipped");

const onAgentStart = (pi: ExtensionAPI, store: Store) => {
	pi.on("agent_start", (_event, ctx) => {
		store.progressSignalsThisTurn = 0;
		store.codeEditsThisTurn = 0;
		if (store.state.status === "active" && ctx.hasUI) {
			ctx.ui.setWorkingMessage(`${WORKING_MESSAGE_PREFIX}${store.state.goal}`);
		}
	});
};

const handleEndTransitions = async (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionContext,
): Promise<void> => {
	if (store.state.turnsUsed >= store.state.maxTurns) {
		handleBudgetExhausted(pi, store, ctx);
		return;
	}
	if (store.userMessagedThisTurn) {
		persist(pi, store, "verdict", {
			lastVerdict: "continue",
			lastReason: "user-driven turn",
		});
		refreshStatus(store, ctx);
		return;
	}
	if (store.progressSignalsThisTurn === 0) {
		handleSpinGuard(pi, store, ctx);
		return;
	}
	const ci = await runCiOnStop(pi, store, ctx);
	if (ci.failed) return;
	if (allTasksDone(store.state) && store.state.cleanEndPrompts < 2) {
		handleCleanEnd(pi, store, ctx);
		return;
	}
	queueContinuation(pi, store, ctx);
};

const onAgentSettled = (pi: ExtensionAPI, store: Store) => {
	pi.on("agent_settled", async (_event, ctx) => {
		if (store.state.status !== "active") {
			store.userMessagedThisTurn = false;
			refreshStatus(store, ctx);
			return;
		}
		store.state.turnsUsed += 1;
		store.state.lastTurnAt = Date.now();
		try {
			await handleEndTransitions(pi, store, ctx);
		} finally {
			store.userMessagedThisTurn = false;
		}
	});
};

export const registerAgentHooks = (pi: ExtensionAPI, store: Store): void => {
	registerBeforeAgentStart(pi, store);
	onAgentStart(pi, store);
	onAgentSettled(pi, store);
};
