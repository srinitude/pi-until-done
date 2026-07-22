import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { stringify as yamlStringify } from "yaml";
import type { Store } from "../store";
import { HELP_TEXT, NOTIFY } from "../strings";
import type { Task } from "../types";
import { ContractOverlay } from "../ui/contract-overlay";
import { statusLine } from "../ui/status-line";

export const cmdStatus = (store: Store, ctx: ExtensionCommandContext): void => {
	ctx.ui.notify(statusLine(store.state) ?? NOTIFY.noActiveGoal, "info");
};

export const cmdHelp = (ctx: ExtensionCommandContext): void => {
	ctx.ui.notify(HELP_TEXT, "info");
};

export const cmdDetail = async (
	store: Store,
	ctx: ExtensionCommandContext,
): Promise<void> => {
	if (!ctx.hasUI) {
		ctx.ui.notify(JSON.stringify(store.state, null, 2), "info");
		return;
	}
	await ctx.ui.custom<void>(
		(_tui, theme, _kb, done) => new ContractOverlay(store.state, theme, done),
	);
};

const taskCounts = (tasks: Task[]) => ({
	total: tasks.length,
	done: tasks.filter((t) => t.status === "done").length,
	in_progress: tasks.filter((t) => t.status === "in_progress").length,
	blocked: tasks.filter((t) => t.status === "blocked").length,
	pending: tasks.filter((t) => t.status === "pending").length,
});

export const cmdTasks = (store: Store, ctx: ExtensionCommandContext): void => {
	if (store.state.tasks.length === 0) {
		ctx.ui.notify(NOTIFY.noTasksYet, "info");
		return;
	}
	const yamlText = yamlStringify({
		currentTaskId: store.state.currentTaskId,
		counts: taskCounts(store.state.tasks),
		tasks: store.state.tasks.map((t) => ({
			id: t.id,
			title: t.title,
			phase: t.phase,
			status: t.status,
			deps: t.dependencies,
		})),
	});
	ctx.ui.notify(yamlText, "info");
};

export const cmdPlanPath = (ctx: ExtensionCommandContext): void => {
	const p = path.join(ctx.cwd, ".until-done", "tasks.yaml");
	ctx.ui.notify(
		fs.existsSync(p) ? NOTIFY.livePlanAt(p) : NOTIFY.noPlanYet,
		"info",
	);
};

export const cmdNorthStar = (
	store: Store,
	ctx: ExtensionCommandContext,
): void => {
	if (!store.state.northStar) {
		ctx.ui.notify(NOTIFY.noNorthStar, "info");
		return;
	}
	ctx.ui.notify(yamlStringify({ northStar: store.state.northStar }), "info");
};

export const cmdReplanLog = (
	store: Store,
	ctx: ExtensionCommandContext,
): void => {
	if (store.state.replanLog.length === 0) {
		ctx.ui.notify(NOTIFY.noReplans, "info");
		return;
	}
	const lines = store.state.replanLog.map(
		(r) => `${new Date(r.at).toISOString()}  (${r.opsCount} ops)  ${r.reason}`,
	);
	ctx.ui.notify(lines.join("\n"), "info");
};
