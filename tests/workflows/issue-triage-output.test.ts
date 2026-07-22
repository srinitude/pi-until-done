import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dir, "../..");
const validator = resolve(
	root,
	".github/scripts/validate-issue-triage-output.mjs",
);
const dirs: string[] = [];

const validItem = {
	type: "stage_triage",
	item_number: "1",
	label: "bug",
	disposition: "confirmed",
	next_step: "fix",
	assessment: "Current source and tests confirm the reported setup ordering.",
	evidence:
		"https://github.com/srinitude/pi-until-done/blob/main/extensions/lib/commands/setup.ts",
	version: "0.3.1",
};

const runValidator = (
	items: unknown[],
	env: Record<string, string> = {},
) => {
	const dir = mkdtempSync(resolve(tmpdir(), "issue-triage-output-"));
	dirs.push(dir);
	const input = resolve(dir, "agent-output.json");
	const output = resolve(dir, "triage.json");
	writeFileSync(input, JSON.stringify({ items }));
	const result = spawnSync("node", [validator, input, output], {
		cwd: root,
		encoding: "utf8",
		env: {
			...process.env,
			TRIAGE_ALLOWED_TARGETS: "1",
			TRIAGE_MAX_ITEMS: "1",
			TRIAGE_REPOSITORY: "srinitude/pi-until-done",
			PRIVATE_COPY_DENYLIST: "private-marker\nprivate-source",
			...env,
		},
	});
	return {
		...result,
		artifact: result.status === 0 ? JSON.parse(readFileSync(output, "utf8")) : null,
	};
};

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("staged issue triage output", () => {
	test("normalizes one bounded assessment without issue copy", () => {
		const result = runValidator([validItem]);
		expect(result.status).toBe(0);
		expect(result.artifact).toEqual({
			schema: 1,
			items: [
				{
					issueNumber: 1,
					label: "bug",
					disposition: "confirmed",
					nextStep: "fix",
					assessment: validItem.assessment,
					evidence: [validItem.evidence],
					version: "0.3.1",
				},
			],
		});
	});

	test("requires one assessment for every allowed target", () => {
		const result = runValidator([validItem], {
			TRIAGE_ALLOWED_TARGETS: "1,2",
			TRIAGE_MAX_ITEMS: "25",
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("target set");
	});

	test("rejects targets outside the event or backfill set", () => {
		const result = runValidator([{ ...validItem, item_number: "2" }]);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("target set");
	});

	test("rejects unsupported labels and dispositions", () => {
		const result = runValidator([
			{ ...validItem, label: "release", disposition: "close_as_fixed" },
		]);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("label");
	});

	test("rejects external evidence and oversized prose", () => {
		const result = runValidator([
			{
				...validItem,
				assessment: "x".repeat(1201),
				evidence: "https://example.com/untrusted",
			},
		]);
		expect(result.status).toBe(1);
	});

	test("fails closed when private-output protection is absent or matched", () => {
		const missing = runValidator([validItem], { PRIVATE_COPY_DENYLIST: "" });
		expect(missing.status).toBe(1);
		expect(missing.stderr).toContain("protection unavailable");
		const matched = runValidator([
			{ ...validItem, assessment: "Contains PRIVATE-MARKER." },
		]);
		expect(matched.status).toBe(1);
		expect(matched.stderr).toContain("protected content");
	});
});
