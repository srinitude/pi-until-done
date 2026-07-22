import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import type { CompleteParams } from "../schemas/lifecycle";
import { persist, type Store } from "../store";
import { REFUSAL, TOOL_RESULTS } from "../strings";
import { consultJudge, consultSelfJudge, type JudgeDecision } from "./judge";
import { failed, ok, refused } from "./result";

type CompleteInput = Static<typeof CompleteParams>;

const judgeAnnotation = (decision: JudgeDecision): string => {
	if (decision.verdict === "done") return `judge approved: ${decision.reason}`;
	if (decision.verdict === "continue")
		return `judge rejected: ${decision.reason}`;
	if (decision.verdict === "parse_error")
		return `judge response could not be parsed: ${decision.reason}`;
	return `judge unavailable: ${decision.reason}`;
};

const refuseCompletion = (
	pi: ExtensionAPI,
	store: Store,
	decision: JudgeDecision,
	params: CompleteInput,
) => {
	const s = store.state;
	persist(
		pi,
		store,
		"verdict",
		{
			lastVerdict: "continue",
			lastReason: `judge rejected completion: ${decision.reason}`,
			evidence: [...s.evidence, params.evidence, judgeAnnotation(decision)],
		},
		"judge rejected completion",
	);
	return refused(
		`Judge rejected completion: ${decision.reason}. Address the gap and call until_done_complete again with stronger evidence.`,
		"judge_rejected",
	);
};

const completeWithApproval = (
	pi: ExtensionAPI,
	store: Store,
	params: CompleteInput,
	decision: JudgeDecision | undefined,
) => {
	const s = store.state;
	const augmentedEvidence = decision
		? [...s.evidence, params.evidence, judgeAnnotation(decision)]
		: [...s.evidence, params.evidence];
	persist(
		pi,
		store,
		"complete",
		{
			status: "done",
			lastVerdict: "done",
			lastReason: params.summary ?? params.evidence.slice(0, 200),
			evidence: augmentedEvidence,
		},
		params.summary,
	);
	return ok(TOOL_RESULTS.completeMarked(params.summary ?? params.evidence), {
		status: "done",
		judge: decision?.verdict,
	});
};

const decideJudge = async (
	ctx: ExtensionContext,
	store: Store,
	params: CompleteInput,
): Promise<JudgeDecision> => {
	const s = store.state;
	if (s.northStar?.judgeModel) {
		return consultJudge(
			ctx,
			s.northStar.judgeModel,
			s,
			params.evidence,
			params.summary,
		);
	}
	if (s.northStar?.sameModelJudge) {
		return consultSelfJudge(ctx, s, params.evidence, params.summary);
	}
	return {
		verdict: "unavailable",
		reason:
			"contract has neither judgeModel nor sameModelJudge — judge step skipped (this should have been caught at until_done_set)",
	};
};

export const executeComplete = async (
	pi: ExtensionAPI,
	store: Store,
	params: CompleteInput,
	ctx: ExtensionContext,
) => {
	const s = store.state;
	if (s.status !== "active")
		return failed(REFUSAL.noActiveGoal(s.status), "no_active_goal");
	const decision = await decideJudge(ctx, store, params);
	if (decision.verdict === "continue") {
		return refuseCompletion(pi, store, decision, params);
	}
	return completeWithApproval(pi, store, params, decision);
};
