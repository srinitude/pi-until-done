import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import { PlanParams } from "../schemas/plan";
import { persist, type Store } from "../store";
import {
	REFUSAL,
	TOOL_DESCRIPTIONS,
	TOOL_LABELS,
	TOOL_RESULTS,
} from "../strings";
import type { Task } from "../types";
import { writeTasksYaml } from "../yaml-writer";
import { ok, refused } from "./result";

type PlanInput = Static<typeof PlanParams>;

const validateDeps = (tasks: Task[]): string | undefined => {
	const ids = new Set(tasks.map((t) => t.id));
	for (const t of tasks) {
		for (const dep of t.dependencies) {
			if (!ids.has(dep)) return REFUSAL.planUnknownDep(t.id, dep);
		}
	}
	return undefined;
};

const persistPlan = (
	pi: ExtensionAPI,
	store: Store,
	params: PlanInput,
	first: Task | undefined,
): void => {
	persist(
		pi,
		store,
		"plan",
		{
			tasks: params.tasks,
			currentTaskId: first?.id,
			planComplete: true,
			phase: first?.phase ?? store.state.phase,
		},
		`plan with ${params.tasks.length} tasks`,
	);
};

const executePlan = async (
	pi: ExtensionAPI,
	store: Store,
	params: PlanInput,
	ctx: ExtensionContext,
) => {
	const s = store.state;
	if (s.status !== "active" && s.status !== "planning") {
		return refused(REFUSAL.planWrongStatus(s.status), "wrong_status");
	}
	const err = validateDeps(params.tasks);
	if (err) return refused(err, "unknown_dep");
	const first = params.tasks.find((task) => task.dependencies.length === 0);
	persistPlan(pi, store, params, first);
	writeTasksYaml(ctx.cwd, store.state);
	return ok(
		TOOL_RESULTS.planAccepted(params.tasks.length, first?.id ?? "(none)"),
		{ count: params.tasks.length, currentTaskId: first?.id },
	);
};

export const registerPlanTool = (pi: ExtensionAPI, store: Store): void => {
	pi.registerTool({
		name: "until_done_plan",
		label: TOOL_LABELS.plan,
		description: TOOL_DESCRIPTIONS.plan,
		parameters: PlanParams,
		async execute(_id, params, _signal, _onUpdate, ctx) {
			return executePlan(pi, store, params, ctx);
		},
	});
};
