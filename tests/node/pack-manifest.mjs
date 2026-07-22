import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
	cwd: process.cwd(),
	encoding: "utf8",
	maxBuffer: 2_000_000,
});
const [manifest] = JSON.parse(output);
const files = new Set(manifest.files.map((entry) => entry.path));

for (const required of [
	"compatibility/pi.json",
	"extensions/until-done.ts",
	"mise.lock",
	"package.json",
	"README.md",
]) {
	assert.ok(files.has(required), `package must include ${required}`);
}

for (const path of files) {
	assert.doesNotMatch(path, /local-command|transcript|\.env|^tests\//i);
}

console.log(`npm pack manifest: green (${files.size} files)`);
