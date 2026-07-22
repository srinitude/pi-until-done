import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { GoalState, JudgeModel } from "../types";
import { requestJudge } from "./judge-request";

export type JudgeVerdict = "done" | "continue" | "parse_error" | "unavailable";

export interface JudgeDecision {
	verdict: JudgeVerdict;
	reason: string;
}

const unavailable = (reason: string): JudgeDecision => ({
	verdict: "unavailable",
	reason,
});

const tryParse = (text: string): unknown => {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
};

const interpretJudge = (raw: string): JudgeDecision => {
	const parsed = tryParse(raw.trim()) as
		| { verdict?: unknown; reason?: unknown }
		| undefined;
	if (!parsed || typeof parsed !== "object") {
		return {
			verdict: "parse_error",
			reason: "judge response could not be parsed as JSON",
		};
	}
	const verdict = parsed.verdict;
	const reason = typeof parsed.reason === "string" ? parsed.reason : "";
	if ((verdict !== "done" && verdict !== "continue") || !reason.trim()) {
		return {
			verdict: "parse_error",
			reason: "judge response could not be parsed: invalid verdict or reason",
		};
	}
	return { verdict, reason };
};

const runJudge = async (
	ctx: ExtensionContext,
	model: Model<Api>,
	state: GoalState,
	evidence: string,
	summary: string | undefined,
): Promise<JudgeDecision> => {
	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
	if (!auth.ok) return unavailable(`judge auth failed: ${auth.error}`);
	const provider = ctx.modelRegistry.getProvider(model.provider);
	if (!provider)
		return unavailable(
			`judge provider ${model.provider} not found in registry`,
		);
	try {
		const raw = await requestJudge(
			provider,
			model,
			auth,
			ctx.signal,
			state,
			evidence,
			summary,
		);
		return interpretJudge(raw);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		return unavailable(`judge call threw: ${reason}`);
	}
};

export const consultJudge = async (
	ctx: ExtensionContext,
	judge: JudgeModel,
	state: GoalState,
	evidence: string,
	summary: string | undefined,
): Promise<JudgeDecision> => {
	const model = ctx.modelRegistry.find(judge.provider, judge.modelId);
	if (!model) {
		return unavailable(
			`judge model ${judge.provider}/${judge.modelId} not found in registry`,
		);
	}
	return runJudge(ctx, model, state, evidence, summary);
};

export const consultSelfJudge = async (
	ctx: ExtensionContext,
	state: GoalState,
	evidence: string,
	summary: string | undefined,
): Promise<JudgeDecision> => {
	if (!ctx.model) {
		return unavailable("no active executor model — judge step skipped");
	}
	return runJudge(ctx, ctx.model, state, evidence, summary);
};
