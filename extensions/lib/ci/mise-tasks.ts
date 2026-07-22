import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CiVerb } from "./types";

const TASK_LIST_TIMEOUT_MS = 5_000;
const execFileAsync = promisify(execFile);
const KNOWN_VERBS: readonly CiVerb[] = [
	"typecheck",
	"lint",
	"format",
	"compile",
	"test",
	"build",
];

interface TaskListEntry {
	name?: string;
}

const parseNames = (json: string): Set<string> => {
	try {
		const data = JSON.parse(json);
		if (!Array.isArray(data)) return new Set();
		return new Set(
			(data as TaskListEntry[])
				.map((task) => task?.name)
				.filter((name): name is string => Boolean(name)),
		);
	} catch {
		return new Set();
	}
};

export const fetchMiseTaskNames = async (cwd: string): Promise<Set<string>> => {
	try {
		const { stdout } = await execFileAsync("mise", ["tasks", "ls", "--json"], {
			cwd,
			timeout: TASK_LIST_TIMEOUT_MS,
			maxBuffer: 1_000_000,
		});
		return parseNames(stdout);
	} catch {
		return new Set();
	}
};

export const matchedVerbs = (taskNames: Set<string>): CiVerb[] =>
	KNOWN_VERBS.filter((verb) => taskNames.has(verb));
