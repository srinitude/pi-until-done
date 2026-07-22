import { readFile, writeFile } from "node:fs/promises";

const LABELS = new Set([
	"bug",
	"documentation",
	"duplicate",
	"enhancement",
	"invalid",
	"needs-human",
	"question",
]);
const DISPOSITIONS = new Set([
	"confirmed",
	"feature_request",
	"fixed_on_main",
	"manual_review",
	"needs_information",
	"not_reproduced",
	"question",
	"released",
	"security_review",
]);
const NEXT_STEPS = new Set([
	"answer",
	"design_review",
	"fix",
	"maintainer_review",
	"monitor_release",
	"private_security_review",
	"request_confirmation",
	"request_details",
]);
const ITEM_KEYS = new Set([
	"assessment",
	"disposition",
	"evidence",
	"item_number",
	"label",
	"next_step",
	"type",
	"version",
]);

const fail = (message) => {
	throw new Error(`issue triage validation failed: ${message}`);
};

const configuredTargets = () => {
	const values = (process.env.TRIAGE_ALLOWED_TARGETS ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	if (values.some((value) => !/^\d+$/.test(value))) fail("invalid target set");
	return new Set(values.map(Number));
};

const configuredLimit = () => {
	const value = Number(process.env.TRIAGE_MAX_ITEMS);
	if (!Number.isInteger(value) || value < 1 || value > 25) {
		fail("invalid item limit");
	}
	return value;
};

const checkPrivateOutput = (source) => {
	const terms = (process.env.PRIVATE_COPY_DENYLIST ?? "")
		.split(/\r?\n/)
		.map((term) => term.trim().toLowerCase())
		.filter(Boolean);
	if (terms.length === 0) fail("private-output protection unavailable");
	const normalized = source.toLowerCase();
	if (terms.some((term) => normalized.includes(term))) {
		fail("protected content detected");
	}
};

const issueNumber = (value) => {
	const normalized = String(value ?? "");
	if (!/^\d+$/.test(normalized)) fail("item number must be numeric");
	const number = Number(normalized);
	if (!Number.isSafeInteger(number) || number < 1) fail("invalid item number");
	return number;
};

const assessment = (value) => {
	if (typeof value !== "string") fail("assessment must be text");
	const normalized = value.trim();
	if (!normalized || normalized.length > 1200) fail("assessment length");
	return normalized;
};

const version = (value) => {
	if (value === undefined || value === "") return undefined;
	if (typeof value !== "string" || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(value)) {
		fail("invalid version");
	}
	return value;
};

const evidence = (value, repository) => {
	if (value === undefined || value === "") return [];
	if (typeof value !== "string") fail("evidence must be text");
	const links = value.split(/\r?\n/).map((link) => link.trim()).filter(Boolean);
	if (links.length > 3) fail("too many evidence links");
	for (const link of links) {
		const url = URL.parse(link);
		const prefix = `/${repository}/`;
		if (!url || url.protocol !== "https:" || url.hostname !== "github.com") {
			fail("external evidence is not allowed");
		}
		if (!url.pathname.startsWith(prefix)) fail("wrong evidence repository");
	}
	return links;
};

const normalizeItem = (item, repository) => {
	if (!item || typeof item !== "object" || Array.isArray(item)) fail("invalid item");
	if (Object.keys(item).some((key) => !ITEM_KEYS.has(key))) fail("unexpected field");
	if (!LABELS.has(item.label)) fail("unsupported label");
	if (!DISPOSITIONS.has(item.disposition)) fail("unsupported disposition");
	if (!NEXT_STEPS.has(item.next_step)) fail("unsupported next step");
	const normalized = {
		issueNumber: issueNumber(item.item_number),
		label: item.label,
		disposition: item.disposition,
		nextStep: item.next_step,
		assessment: assessment(item.assessment),
		evidence: evidence(item.evidence, repository),
	};
	const release = version(item.version);
	if (item.disposition === "released" && !release) fail("released version required");
	if (release) normalized.version = release;
	return normalized;
};

const normalizeOutput = (source) => {
	checkPrivateOutput(source);
	const parsed = JSON.parse(source);
	if (!parsed || !Array.isArray(parsed.items)) fail("items array missing");
	const allowed = configuredTargets();
	const limit = configuredLimit();
	if (allowed.size > limit) fail("target set exceeds item limit");
	const unknown = parsed.items.filter(
		(item) => item?.type !== "stage_triage" && item?.type !== "noop",
	);
	if (unknown.length > 0) fail("unsupported output type");
	const staged = parsed.items.filter((item) => item?.type === "stage_triage");
	const repository = process.env.TRIAGE_REPOSITORY ?? "";
	if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) fail("invalid repository");
	const items = staged.map((item) => normalizeItem(item, repository));
	const actual = new Set(items.map((item) => item.issueNumber));
	const exact = actual.size === items.length && actual.size === allowed.size;
	if (!exact || [...allowed].some((target) => !actual.has(target))) {
		fail("output does not match target set");
	}
	return { schema: 1, items: items.sort((a, b) => a.issueNumber - b.issueNumber) };
};

const main = async () => {
	const [input, output] = process.argv.slice(2);
	if (!input) fail("input path required");
	const source = await readFile(input, "utf8");
	if (source.length > 1_000_000) fail("agent output is too large");
	const artifact = normalizeOutput(source);
	if (output) await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`);
};

try {
	await main();
} catch (error) {
	console.error(error instanceof Error ? error.message : "issue triage validation failed");
	process.exitCode = 1;
}
