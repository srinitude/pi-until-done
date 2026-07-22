import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const cwd = process.cwd();
const require = createRequire(resolve(cwd, "package.json"));
const { createJiti } = require("jiti");
const jiti = createJiti(resolve(cwd, "tests/node/loader.cjs"));
const { runOne } = await jiti.import(resolve(cwd, "extensions/lib/ci/runner.ts"));
const check = (argv, timeoutMs = 5_000) => ({ verb: "test", argv, timeoutMs });

const success = await runOne(
	check([process.execPath, "-e", "console.log('node-ok')"]),
	tmpdir(),
);
assert.equal(success.ok, true);
assert.equal(success.exitCode, 0);
assert.match(success.output, /node-ok/);

const failure = await runOne(
	check([
		process.execPath,
		"-e",
		"process.stderr.write('node-err');process.exit(7)",
	]),
	tmpdir(),
);
assert.equal(failure.ok, false);
assert.equal(failure.exitCode, 7);
assert.match(failure.output, /node-err/);

const truncated = await runOne(
	check([process.execPath, "-e", "process.stdout.write('x'.repeat(5000))"]),
	tmpdir(),
);
assert.match(truncated.output, /^\[output truncated;/);

const started = Date.now();
const timed = await runOne(
	check([process.execPath, "-e", "setTimeout(()=>{},5000)"], 100),
	tmpdir(),
);
assert.equal(timed.ok, false);
assert.ok(Date.now() - started < 2_000, "timeout must terminate promptly");

const controller = new AbortController();
setTimeout(() => controller.abort(), 50);
const aborted = await runOne(
	check([process.execPath, "-e", "setTimeout(()=>{},5000)"], 60_000),
	tmpdir(),
	controller.signal,
);
assert.equal(aborted.ok, false);
assert.ok(aborted.durationMs < 2_000, "abort must terminate promptly");

console.log("node runner compatibility: green");
