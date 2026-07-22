import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const generated = [
	".github/workflows/pi-runtime-review.lock.yml",
	".github/workflows/pi-upstream-lockstep.lock.yml",
	".github/workflows/agentics-maintenance.yml",
];

function result(command, args, stdio = "inherit") {
	return spawnSync(command, args, { cwd: root, stdio, env: process.env });
}

function run(command, args) {
	const child = result(command, args);
	if (child.error) throw child.error;
	if (child.status !== 0) process.exit(child.status ?? 1);
}

function canRun(command, args) {
	const child = result(command, args, "ignore");
	return !child.error && child.status === 0;
}

async function conventionalWorkflows() {
	const directory = resolve(root, ".github/workflows");
	const files = await readdir(directory);
	return files
		.filter((file) => file.endsWith(".yml") && !file.endsWith(".lock.yml"))
		.map((file) => `.github/workflows/${file}`);
}

function verifyGeneratedFiles() {
	if (canRun("git", ["diff", "--quiet", "--", ...generated])) return;
	console.error("Compiled gh-aw workflows are stale. Run mise run workflows and commit them.");
	run("git", ["diff", "--stat", "--", ...generated]);
	process.exit(1);
}

run("gh-aw", ["compile", "--strict"]);
run(process.execPath, [".github/scripts/patch-gh-aw-lock.mjs"]);
if (canRun("docker", ["info"])) run("gh-aw", ["lint"]);
else console.log("Docker unavailable; strict gh-aw compile completed (generated lint runs on Docker-capable matrix jobs).");
run("actionlint", await conventionalWorkflows());
run("bun", ["test", "tests/workflows"]);
verifyGeneratedFiles();
