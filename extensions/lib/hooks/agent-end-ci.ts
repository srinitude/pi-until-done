import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { renderFailureBlock, renderHeadline, runCi } from "../ci";
import { persist, type Store } from "../store";
import { CI_LABELS } from "../strings";
import { refreshStatus } from "../ui/status-line";
import { refreshWidget } from "../ui/widget";

const notifyHeadline = (
	ctx: ExtensionContext,
	headline: string,
	ok: boolean,
): void => {
	ctx.ui.notify(headline, ok ? "info" : "warning");
};

export interface CiOutcome {
	ranAnything: boolean;
	failed: boolean;
}

const blockOnFailure = (
	pi: ExtensionAPI,
	store: Store,
	failureBlock: string,
): void => {
	persist(
		pi,
		store,
		"block",
		{
			status: "blocked",
			pausedReason: CI_LABELS.pausedReason,
			lastVerdict: "blocked",
			lastReason: CI_LABELS.failureReason,
		},
		CI_LABELS.failureReason,
	);
	pi.sendUserMessage(
		[CI_LABELS.failureHead, CI_LABELS.failureGuide, "", failureBlock].join(
			"\n",
		),
		{ deliverAs: "followUp" },
	);
};

export const runCiOnStop = async (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionContext,
): Promise<CiOutcome> => {
	if (store.codeEditsThisTurn === 0)
		return { ranAnything: false, failed: false };
	const summary = await runCi(ctx.cwd, ctx.signal);
	if (summary.results.length === 0)
		return { ranAnything: false, failed: false };
	notifyHeadline(ctx, renderHeadline(summary), !summary.hasFailure);
	if (!summary.hasFailure) return { ranAnything: true, failed: false };
	blockOnFailure(pi, store, renderFailureBlock(summary));
	refreshStatus(store, ctx);
	refreshWidget(store, ctx, true);
	return { ranAnything: true, failed: true };
};
