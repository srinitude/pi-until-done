import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import type { Store } from "../store";

const SIDE_QUESTION_PREFIX =
	"[/until-done · side question — answer briefly, do NOT change goal state, do NOT call any until_done_* tool, do NOT modify files. The standing goal continues unaffected.]\n\n";

/**
 * Side-question primitive (modeled on Codex's `/side`). The user can probe
 * the running loop without preempting it: the question is delivered as a
 * normal user message but prefixed with a meta-instruction that tells Pi to
 * answer in-place without mutating goal state. The next continuation tick
 * resumes the loop on its existing trajectory.
 */
export const cmdAsk = async (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
	question: string,
): Promise<void> => {
	if (!question.trim()) {
		ctx.ui.notify("/until-done ask <question> — needs a question.", "warning");
		return;
	}
	if (store.state.status !== "active") {
		ctx.ui.notify(
			`/until-done ask only applies when a goal is active (status=${store.state.status}).`,
			"warning",
		);
		return;
	}
	pi.sendUserMessage(SIDE_QUESTION_PREFIX + question);
	ctx.ui.notify(
		"/until-done · side question delivered. Loop will resume next tick.",
		"info",
	);
};
