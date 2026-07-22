import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { OUTPUT_TRUNCATION_CHARS, OUTPUT_TRUNCATION_MARKER } from "./constants";
import type { CiCheck, CiResult } from "./types";

const isWindows = process.platform === "win32";

type Child = ChildProcessWithoutNullStreams;

interface ProcState {
	child: Child;
	chunks: Buffer[];
	finished: boolean;
	killed: boolean;
}

const truncate = (output: string): string =>
	output.length <= OUTPUT_TRUNCATION_CHARS
		? output
		: OUTPUT_TRUNCATION_MARKER + output.slice(-OUTPUT_TRUNCATION_CHARS);

const start = (argv: string[], cwd: string): Child => {
	const child = spawn(argv[0], argv.slice(1), {
		cwd,
		detached: !isWindows,
		stdio: ["pipe", "pipe", "pipe"],
		windowsHide: true,
	});
	child.stdin.end();
	return child;
};

const killWindowsTree = (child: Child): void => {
	if (child.pid === undefined) return;
	const killer = spawn(
		"taskkill.exe",
		["/PID", String(child.pid), "/T", "/F"],
		{ stdio: "ignore", windowsHide: true },
	);
	killer.once("error", () => child.kill("SIGKILL"));
};

const killUnixTree = (child: Child): void => {
	if (child.pid === undefined) return;
	try {
		process.kill(-child.pid, "SIGKILL");
	} catch {
		child.kill("SIGKILL");
	}
};

const killTree = (state: ProcState): void => {
	if (state.finished || state.killed) return;
	state.killed = true;
	try {
		if (isWindows) killWindowsTree(state.child);
		else killUnixTree(state.child);
	} catch {
		state.child.kill("SIGKILL");
	}
};

const collect = (state: ProcState): Promise<number | null> =>
	new Promise((resolve) => {
		const capture = (chunk: Buffer | string) =>
			state.chunks.push(Buffer.from(chunk));
		state.child.stdout.on("data", capture);
		state.child.stderr.on("data", capture);
		state.child.once("error", (error) => {
			state.chunks.push(Buffer.from(error.message));
		});
		state.child.once("close", (code) => {
			state.finished = true;
			resolve(code);
		});
	});

const armAbort = (
	state: ProcState,
	signal: AbortSignal | undefined,
): (() => void) => {
	if (!signal) return () => {};
	const abort = () => killTree(state);
	if (signal.aborted) abort();
	else signal.addEventListener("abort", abort, { once: true });
	return () => signal.removeEventListener("abort", abort);
};

const failure = (
	check: CiCheck,
	started: number,
	error: unknown,
): CiResult => ({
	verb: check.verb,
	command: check.argv.join(" "),
	skipped: false,
	ok: false,
	exitCode: null,
	output: error instanceof Error ? error.message : String(error),
	durationMs: Date.now() - started,
});

const result = (
	check: CiCheck,
	state: ProcState,
	exitCode: number | null,
	started: number,
): CiResult => ({
	verb: check.verb,
	command: check.argv.join(" "),
	skipped: false,
	ok: exitCode === 0,
	exitCode,
	output: truncate(Buffer.concat(state.chunks).toString("utf8")),
	durationMs: Date.now() - started,
});

export const runOne = async (
	check: CiCheck,
	cwd: string,
	signal?: AbortSignal,
): Promise<CiResult> => {
	const started = Date.now();
	try {
		const state: ProcState = {
			child: start(check.argv, cwd),
			chunks: [],
			finished: false,
			killed: false,
		};
		const timer = setTimeout(() => killTree(state), check.timeoutMs);
		const detachAbort = armAbort(state, signal);
		const exitCode = await collect(state);
		clearTimeout(timer);
		detachAbort();
		return result(check, state, exitCode, started);
	} catch (error) {
		return failure(check, started, error);
	}
};

export const runAll = async (
	checks: readonly CiCheck[],
	cwd: string,
	signal?: AbortSignal,
): Promise<CiResult[]> =>
	Promise.all(checks.map((check) => runOne(check, cwd, signal)));
