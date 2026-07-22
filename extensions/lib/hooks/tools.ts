import type {
	ExtensionAPI,
	ExtensionContext,
	ToolCallEvent,
	ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { ASK_BEFORE_TIMEOUT_MS } from "../constants";
import type { Store } from "../store";
import { DIALOGS, REFUSAL } from "../strings";

const matchesAskBefore = (
	askBefore: string[],
	cmd: string,
): string | undefined => {
	const needle = cmd.toLowerCase();
	return askBefore.find((p) => needle.includes(p.toLowerCase()));
};

const handleBash = async (
	store: Store,
	event: ToolCallEvent,
	ctx: ExtensionContext,
): Promise<ToolCallEventResult | undefined> => {
	if (!isToolCallEventType("bash", event)) return undefined;
	const hit = matchesAskBefore(
		store.state.askBefore,
		event.input.command ?? "",
	);
	if (hit) {
		if (!ctx.hasUI) return { block: true, reason: REFUSAL.noUiAskBefore(hit) };
		const ok = await ctx.ui.confirm(
			DIALOGS.askBeforeTitle,
			DIALOGS.askBeforeMessage(hit, event.input.command),
			{ timeout: ASK_BEFORE_TIMEOUT_MS },
		);
		if (!ok) return { block: true, reason: REFUSAL.userDenied(hit) };
	}
	store.progressSignalsThisTurn += 2;
	return undefined;
};

const isStrongEdit = (event: ToolCallEvent): boolean =>
	isToolCallEventType("edit", event) || isToolCallEventType("write", event);

const isSearch = (event: ToolCallEvent): boolean =>
	isToolCallEventType("grep", event) ||
	isToolCallEventType("find", event) ||
	isToolCallEventType("ls", event);

const scoreBuiltin = (store: Store, event: ToolCallEvent): boolean => {
	if (isStrongEdit(event)) {
		store.progressSignalsThisTurn += 3;
		store.codeEditsThisTurn += 1;
		return true;
	}
	if (isToolCallEventType("read", event) || isSearch(event)) {
		store.progressSignalsThisTurn += 1;
		return true;
	}
	return false;
};

export const registerToolHooks = (pi: ExtensionAPI, store: Store): void => {
	pi.on("tool_call", async (event, ctx) => {
		if (store.state.status !== "active") return undefined;
		if (isToolCallEventType("bash", event))
			return handleBash(store, event, ctx);
		if (scoreBuiltin(store, event)) return undefined;
		if (event.toolName.startsWith("until_done_")) return undefined;
		store.progressSignalsThisTurn += 2;
		return undefined;
	});

	pi.on("tool_result", () => undefined);
	pi.on("tool_execution_start", () => {
		store.stats.toolStarts++;
	});
	pi.on("tool_execution_update", () => undefined);
	pi.on("tool_execution_end", () => {
		store.stats.toolEnds++;
	});
};
