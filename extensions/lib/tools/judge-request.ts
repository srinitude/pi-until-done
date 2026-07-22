import type {
	Api,
	Context,
	Model,
	Provider,
	ProviderEnv,
	ProviderHeaders,
} from "@earendil-works/pi-ai";
import type { GoalState } from "../types";

export interface JudgeAuth {
	apiKey?: string;
	headers?: ProviderHeaders;
	env?: ProviderEnv;
}

const systemPrompt = (): string =>
	[
		"You are a strict completion judge for /until-done.",
		"The executor will claim a goal is done with cited evidence.",
		"Your job: decide whether the done-criteria are LITERALLY satisfied.",
		"Treat uncertainty as not-yet-done. Reject proxy signals (e.g. 'looks fine', 'should work').",
		"",
		'Respond ONLY with a single JSON object: {"verdict": "done" | "continue", "reason": "<one sentence>"}.',
		'"done" means the criteria are literally satisfied per the cited evidence.',
		'"continue" means the executor needs more work or stronger evidence.',
		"No prose outside the JSON.",
	].join("\n");

const userPrompt = (
	state: GoalState,
	evidence: string,
	summary: string | undefined,
): string =>
	[
		`Goal: ${state.goal}`,
		`Done criteria: ${state.doneCriteria}`,
		`Verify command: ${state.verifyCommand ?? "(none)"}`,
		"",
		"Evidence claimed by executor:",
		evidence,
		summary ? `\nSummary: ${summary}` : "",
		"",
		"Is the goal achieved?",
	]
		.filter(Boolean)
		.join("\n");

const judgeContext = (
	state: GoalState,
	evidence: string,
	summary: string | undefined,
): Context => ({
	systemPrompt: systemPrompt(),
	messages: [
		{
			role: "user",
			content: [{ type: "text", text: userPrompt(state, evidence, summary) }],
			timestamp: Date.now(),
		},
	],
});

export const requestJudge = async (
	provider: Provider,
	model: Model<Api>,
	auth: JudgeAuth,
	signal: AbortSignal | undefined,
	state: GoalState,
	evidence: string,
	summary: string | undefined,
): Promise<string> => {
	const stream = provider.streamSimple(
		model,
		judgeContext(state, evidence, summary),
		{ ...auth, signal },
	);
	const result = await stream.result();
	return result.content
		.filter((block): block is { type: "text"; text: string } =>
			Boolean(block && block.type === "text"),
		)
		.map((block) => block.text)
		.join("\n");
};
