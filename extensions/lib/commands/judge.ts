import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { persist, type Store } from "../store";
import type { JudgeDefault } from "../types";

const showCurrent = (store: Store, ctx: ExtensionCommandContext): void => {
	const current = store.state.judgeDefault;
	if (!current) {
		ctx.ui.notify(
			"/until-done judge — no default set. `until_done_set` will require an explicit `judgeModel` (cross-model) or `sameModelJudge: true` per goal.\n\nSet a session default with:\n  /until-done judge <provider>/<modelId>     — cross-model (recommended)\n  /until-done judge same                     — same-model self-judge\n  /until-done judge clear                    — unset",
			"info",
		);
		return;
	}
	if (current.mode === "same") {
		ctx.ui.notify(
			"/until-done judge default: same-model self-judge (executor judges its own claim with fresh context). Cross-model is strictly stronger.",
			"info",
		);
		return;
	}
	ctx.ui.notify(
		`/until-done judge default: cross-model — ${current.provider}/${current.modelId}.`,
		"info",
	);
};

const saveDefault = (
	pi: ExtensionAPI,
	store: Store,
	judgeDefault: JudgeDefault,
): void => {
	persist(pi, store, "preference", { judgeDefault }, "judge default changed");
};

const setSame = (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
): void => {
	saveDefault(pi, store, { mode: "same" });
	ctx.ui.notify(
		"/until-done judge default = same-model self-judge. Future setups will inject sameModelJudge:true unless overridden.",
		"warning",
	);
};

const clearDefault = (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
): void => {
	saveDefault(pi, store, null);
	ctx.ui.notify(
		"/until-done judge default cleared. `until_done_set` will require an explicit choice per goal.",
		"info",
	);
};

const setCross = (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
	provider: string,
	modelId: string,
): void => {
	const exists = ctx.modelRegistry.find(provider, modelId);
	saveDefault(pi, store, { mode: "cross", provider, modelId });
	const note = exists
		? `cross-model judge default = ${provider}/${modelId}.`
		: `cross-model judge default = ${provider}/${modelId} (warning: not found in current model registry; will fail-open at completion if still missing then).`;
	ctx.ui.notify(`/until-done judge ${note}`, exists ? "info" : "warning");
};

export const cmdJudge = async (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
	rest: string[],
): Promise<void> => {
	if (rest.length === 0) return showCurrent(store, ctx);
	const argument = rest.join(" ").trim();
	if (argument === "same") return setSame(pi, store, ctx);
	if (["clear", "off", "none"].includes(argument)) {
		return clearDefault(pi, store, ctx);
	}
	const slash = argument.indexOf("/");
	if (slash <= 0 || slash === argument.length - 1) {
		ctx.ui.notify(
			`/until-done judge — bad model spec "${argument}". Expected "<provider>/<modelId>", "same", or "clear".`,
			"error",
		);
		return;
	}
	setCross(pi, store, ctx, argument.slice(0, slash), argument.slice(slash + 1));
};
