import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const cwd = process.cwd();
const require = createRequire(resolve(cwd, "package.json"));
const { createJiti } = require("jiti");
const jiti = createJiti(resolve(cwd, "tests/node/loader.cjs"));
const { fetchMiseTaskNames, matchedVerbs } = await jiti.import(
	resolve(cwd, "extensions/lib/ci/mise-tasks.ts"),
);

const names = await fetchMiseTaskNames(cwd);
assert.ok(names.size > 0, "Node must discover mise tasks");
for (const expected of ["ci", "test", "typecheck", "lint", "format", "build"]) {
	assert.ok(names.has(expected), `expected mise task: ${expected}`);
}

const verbs = matchedVerbs(names);
for (const expected of ["test", "typecheck", "lint", "format", "build"]) {
	assert.ok(verbs.includes(expected), `expected matched verb: ${expected}`);
}

console.log("node mise discovery: green");
