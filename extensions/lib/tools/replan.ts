import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import { detectCycle } from "../cycle";
import { ReplanParams } from "../schemas/plan";
import { persist, type Store } from "../store";
import {
	REFUSAL,
	TOOL_DESCRIPTIONS,
	TOOL_LABELS,
	TOOL_RESULTS,
} from "../strings";
import { writeTasksYaml } from "../yaml-writer";
import { applyAll, tagAffected } from "./replan-apply";
import { ok, refused } from "./result";

type ReplanInput = Static<typeof ReplanParams>;

const preflight = (store: Store, reason: string): string | undefined => {
	const s = store.state;
	if (s.status !== "active") return REFUSAL.replanWrongStatus(s.status);
	if (!s.northStar) return REFUSAL.replanNoNorthStar;
	if (!reason.trim()) return REFUSAL.replanEmptyReason;
	return undefined;
};

const persistReplan = (
	pi: ExtensionAPI,
	store: Store,
	tasks: ReturnType<typeof tagAffected>,
	params: ReplanInput,
): void => {
	persist(
		pi,
		store,
		"replan",
		{
			tasks,
			replanLog: [
				...store.state.replanLog,
				{
					at: Date.now(),
					reason: params.reason,
					opsCount: params.operations.length,
				},
			],
		},
		params.reason,
	);
};

const executeReplan = async (
	pi: ExtensionAPI,
	store: Store,
	params: ReplanInput,
	ctx: ExtensionContext,
) => {
	const pf = preflight(store, params.reason);
	if (pf) return refused(pf, "preflight");
	const ctxOps = {
		tasks: store.state.tasks.map((t) => ({ ...t })),
		reason: params.reason,
	};
	const err = applyAll(ctxOps, params.operations);
	if (err) return refused(err, "op_invalid");
	const cyc = detectCycle(ctxOps.tasks);
	if (cyc) return refused(REFUSAL.replanCycle(cyc), "cycle");
	const tagged = tagAffected(store.state.tasks, ctxOps.tasks, params.reason);
	persistReplan(pi, store, tagged, params);
	writeTasksYaml(ctx.cwd, store.state);
	return ok(
		TOOL_RESULTS.replanApplied(params.operations.length, params.reason),
		{
			totalTasks: tagged.length,
		},
	);
};

export const registerReplanTool = (pi: ExtensionAPI, store: Store): void => {
	pi.registerTool({
		name: "until_done_replan",
		label: TOOL_LABELS.replan,
		description: TOOL_DESCRIPTIONS.replan,
		parameters: ReplanParams,
		async execute(_id, params, _signal, _onUpdate, ctx) {
			return executeReplan(pi, store, params, ctx);
		},
	});
};
