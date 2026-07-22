import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import type { Store } from "../store";
import { COMMAND_DESCRIPTION } from "../strings";
import { cmdAsk } from "./ask";
import {
	cmdAutopilot,
	cmdBudget,
	cmdCancel,
	cmdPause,
	cmdResume,
} from "./control";
import {
	cmdDetail,
	cmdHelp,
	cmdNorthStar,
	cmdPlanPath,
	cmdReplanLog,
	cmdStatus,
	cmdTasks,
} from "./info";
import { cmdJudge } from "./judge";
import { cmdApprove, cmdSetup } from "./setup";

export const subcommands = [
	"status",
	"pause",
	"resume",
	"cancel",
	"approve",
	"budget",
	"detail",
	"plan",
	"tasks",
	"northstar",
	"replan-log",
	"ask",
	"help",
	"autopilot",
	"judge",
] as const;

const ZERO_ARG_SUBCOMMANDS = new Set([
	"status",
	"pause",
	"resume",
	"cancel",
	"approve",
	"detail",
	"tasks",
	"plan",
	"northstar",
	"replan-log",
	"autopilot",
]);

const isPositiveInteger = (s: string): boolean => /^\d+$/.test(s);

const looksLikeJudgeArg = (rest: string[]): boolean => {
	if (rest.length === 0) return true;
	const head = rest[0];
	if (head === "same" || head === "clear" || head === "off" || head === "none")
		return true;
	return head.includes("/");
};

const dispatchZero = async (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
	head: string,
): Promise<boolean> => {
	if (head === "status") cmdStatus(store, ctx);
	else if (head === "pause") await cmdPause(pi, store, ctx);
	else if (head === "resume") await cmdResume(pi, store, ctx);
	else if (head === "cancel") await cmdCancel(pi, store, ctx);
	else if (head === "approve") await cmdApprove(pi, store, ctx);
	else if (head === "detail") await cmdDetail(store, ctx);
	else if (head === "tasks") cmdTasks(store, ctx);
	else if (head === "plan") cmdPlanPath(ctx);
	else if (head === "northstar") cmdNorthStar(store, ctx);
	else if (head === "replan-log") cmdReplanLog(store, ctx);
	else if (head === "autopilot") await cmdAutopilot(pi, store, ctx);
	else return false;
	return true;
};

const dispatch = async (
	pi: ExtensionAPI,
	store: Store,
	ctx: ExtensionCommandContext,
	head: string,
	rest: string[],
	args: string,
): Promise<void> => {
	if (!args || (head === "help" && rest.length === 0)) return cmdHelp(ctx);
	if (
		ZERO_ARG_SUBCOMMANDS.has(head) &&
		rest.length === 0 &&
		(await dispatchZero(pi, store, ctx, head))
	) {
		return;
	}
	if (head === "budget" && rest.length === 1 && isPositiveInteger(rest[0])) {
		return cmdBudget(pi, store, ctx, rest[0]);
	}
	if (head === "ask" && rest.length >= 1) {
		return cmdAsk(pi, store, ctx, rest.join(" "));
	}
	if (head === "judge" && looksLikeJudgeArg(rest)) {
		return cmdJudge(pi, store, ctx, rest);
	}
	return cmdSetup(pi, store, ctx, args);
};

const completionFor = (s: string) => ({ value: s, label: s });

const argumentCompletions = (prefix: string) => {
	const lower = prefix.toLowerCase();
	return subcommands.filter((s) => s.startsWith(lower)).map(completionFor);
};

const handlerFor =
	(pi: ExtensionAPI, store: Store) =>
	async (raw: string, ctx: ExtensionCommandContext) => {
		const args = raw.trim();
		const [head = "", ...rest] = args.split(/\s+/);
		await dispatch(pi, store, ctx, head, rest, args);
	};

export const registerCommand = (pi: ExtensionAPI, store: Store): void => {
	pi.registerCommand("until-done", {
		description: COMMAND_DESCRIPTION,
		getArgumentCompletions: argumentCompletions,
		handler: handlerFor(pi, store),
	});
};
