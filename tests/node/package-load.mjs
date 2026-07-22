import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const cwd = process.cwd();
const require = createRequire(resolve(cwd, "package.json"));
const { createJiti } = require("jiti");
const jiti = createJiti(resolve(cwd, "tests/node/loader.cjs"));
const extension = await jiti.import(resolve(cwd, "extensions/until-done.ts"));

assert.equal(typeof extension.default, "function");
assert.equal(globalThis.Bun, undefined, "official Node smoke must not inject Bun");
console.log("node package load: green");
