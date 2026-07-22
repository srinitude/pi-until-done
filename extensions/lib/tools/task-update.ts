import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import { TaskUpdateParams } from "../schemas/task-update";
import { persist, type Store } from "../store";
import {
	REFUSAL,
	TOOL_DESCRIPTIONS,
	TOOL_LABELS,
	TOOL_RESULTS,
} from "../strings";
import type { Phase, Task } from "../types";
import { writeTasksYaml } from "../yaml-writer";
import { failed, ok } from "./result";
import { applyTaskPatch } from "./task-update-apply";

type Args = Static<typeof TaskUpdateParams>;

interface NextPointers {
	currentTaskId: string | undefined;
	phase: Phase;
}

const isReady = (t: Task, all: Task[]): boolean =>
	t.status === "pending" &&
	t.dependencies.every((d) => all.find((x) => x.id === d)?.status === "done");

const advancePointers = (
	tasks: Task[],
	updatedId: string,
	next: Task,
	prev: NextPointers,
	patchStatus: Task["status"] | undefined,
): NextPointers => {
	if (patchStatus === "done" && prev.currentTaskId === updatedId) {
		const ready = tasks.find((t) => isReady(t, tasks));
		return { currentTaskId: ready?.id, phase: ready?.phase ?? prev.phase };
	}
	if (patchStatus === "in_progress" && prev.currentTaskId !== updatedId) {
		return { currentTaskId: updatedId, phase: next.phase };
	}
	return prev;
};

const computePointers = (
	store: Store,
	args: Args,
	tasks: Task[],
	next: Task,
): NextPointers =>
	advancePointers(
		tasks,
		args.id,
		next,
		{ currentTaskId: store.state.currentTaskId, phase: store.state.phase },
		args.patch.status,
	);

const executeTaskUpdate = async (
	pi: ExtensionAPI,
	store: Store,
	args: Args,
	ctx: ExtensionContext,
) => {
	const original = store.state.tasks.find((t) => t.id === args.id);
	if (!original) return failed(REFUSAL.taskNotFound(args.id), "not_found");
	const next = applyTaskPatch(original, args.patch);
	const tasks = store.state.tasks.map((t) => (t === original ? next : t));
	const ptrs = computePointers(store, args, tasks, next);
	persist(
		pi,
		store,
		"task_update",
		{ tasks, currentTaskId: ptrs.currentTaskId, phase: ptrs.phase },
		`task ${args.id} → ${args.patch.status ?? "patched"}`,
	);
	writeTasksYaml(ctx.cwd, store.state);
	const tail = ptrs.currentTaskId ? ` Current: ${ptrs.currentTaskId}` : "";
	return ok(TOOL_RESULTS.taskUpdated(args.id, tail), {
		currentTaskId: ptrs.currentTaskId,
	});
};

export const registerTaskUpdateTool = (
	pi: ExtensionAPI,
	store: Store,
): void => {
	pi.registerTool({
		name: "until_done_task_update",
		label: TOOL_LABELS.taskUpdate,
		description: TOOL_DESCRIPTIONS.taskUpdate,
		parameters: TaskUpdateParams,
		async execute(_id, args, _signal, _onUpdate, ctx) {
			return executeTaskUpdate(pi, store, args, ctx);
		},
	});
};
