import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();
const temp = mkdtempSync(join(tmpdir(), "pi-until-done-pack-"));

try {
	writeFileSync(join(temp, "package.json"), '{"private":true,"type":"module"}');
	const output = execFileSync(
		"npm",
		["pack", "--json", "--pack-destination", temp],
		{ cwd: root, encoding: "utf8", maxBuffer: 2_000_000 },
	);
	const [{ filename }] = JSON.parse(output);
	execFileSync(
		"npm",
		[
			"install",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			join(temp, filename),
			"jiti@2.7.0",
		],
		{ cwd: temp, encoding: "utf8", maxBuffer: 2_000_000 },
	);
	const require = createRequire(join(temp, "package.json"));
	const { createJiti } = require("jiti");
	const jiti = createJiti(join(temp, "loader.cjs"));
	const entry = resolve(temp, "node_modules/pi-until-done/extensions/until-done.ts");
	const extension = await jiti.import(entry);
	assert.equal(typeof extension.default, "function");
	console.log("packed Node install: green");
} finally {
	rmSync(temp, { recursive: true, force: true });
}
