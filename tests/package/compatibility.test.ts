import { describe, expect, test } from "bun:test";
import { access, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const readJson = async (path: string): Promise<Record<string, unknown>> =>
	JSON.parse(await readFile(resolve(root, path), "utf8"));

const piPackages = [
	"@earendil-works/pi-ai",
	"@earendil-works/pi-coding-agent",
	"@earendil-works/pi-tui",
];

describe("strict Pi compatibility metadata", () => {
	test("declares the exact Pi 0.81.1 host packages", async () => {
		const pkg = await readJson("package.json");
		const peers = pkg.peerDependencies as Record<string, string>;
		const dev = pkg.devDependencies as Record<string, string>;
		for (const name of piPackages) {
			expect(peers[name]).toBe("0.81.1");
			expect(dev[name]).toBe("0.81.1");
		}
	});

	test("describes mandatory completion judging without claiming self-judgment", async () => {
		const pkg = await readJson("package.json");
		const description = String(pkg.description);
		expect(description).toContain("LLM judge");
		expect(description).not.toContain("self-judges every turn");
	});

	test("does not retain the retired Pi package namespace", async () => {
		const contents = await readFile(resolve(root, "package.json"), "utf8");
		expect(contents).not.toContain("@mariozechner/");
	});

	test("imports Pi only from the supported namespace", async () => {
		const extensionRoot = resolve(root, "extensions");
		const files = await readdir(extensionRoot, { recursive: true });
		const sources = await Promise.all(
			files
				.filter((file) => file.endsWith(".ts"))
				.map((file) => readFile(resolve(extensionRoot, file), "utf8")),
		);
		expect(sources.join("\n")).not.toContain("@mariozechner/");
		expect(sources.join("\n")).toContain("@earendil-works/");
	});

	test("pins every shipped and development dependency exactly", async () => {
		const pkg = await readJson("package.json");
		const dependencies = {
			...(pkg.dependencies as Record<string, string>),
			...(pkg.devDependencies as Record<string, string>),
		};
		for (const version of Object.values(dependencies)) {
			expect(version).toMatch(/^\d+\.\d+\.\d+$/);
		}
	});

	test("declares Pi's official minimum Node runtime", async () => {
		const pkg = await readJson("package.json");
		expect(pkg.engines).toEqual({ node: ">=22.19.0" });
	});

	test("runs official Node compatibility checks in the canonical CI gate", async () => {
		const mise = await readFile(resolve(root, "mise.toml"), "utf8");
		expect(mise).toContain("[tasks.test-node]");
		expect(mise).toContain('"test-node"');
		expect(mise).toContain('"structure"');
		expect(mise).toContain("node tests/node/runner.mjs");
		expect(mise).toContain("node tests/node/mise-tasks.mjs");
		expect(mise).toContain("node tests/node/package-load.mjs");
		expect(mise).toContain("node tests/node/pack-manifest.mjs");
		expect(mise).toContain("node tests/node/packed-install.mjs");
	});

	test("keeps one canonical Pi and Node version pair", async () => {
		const compatibility = await readJson("compatibility/pi.json");
		expect(compatibility).toEqual({
			piVersion: "0.81.1",
			nodeVersion: "22.19.0",
		});
	});

	test("documents explicit approval and staged issue triage", async () => {
		const readme = await readFile(resolve(root, "README.md"), "utf8");
		expect(readme).toContain("`/until-done approve`");
		expect(readme).toContain("stages read-only assessments");
		expect(readme).toContain("authenticated account");
	});

	test("records the published 0.3.1 release in the changelog", async () => {
		const changelog = await readFile(resolve(root, "CHANGELOG.md"), "utf8");
		expect(changelog).toContain("## [0.3.1] — 2026-07-22");
		expect(changelog).toContain("compare/v0.3.1...HEAD");
	});

	test("keeps local design scratch out of the repository tree", async () => {
		const ignore = await readFile(resolve(root, ".gitignore"), "utf8");
		expect(ignore.split(/\r?\n/)).toContain("/docs/superpowers/");
		for (const path of [
			"docs/superpowers/plans/2026-07-22-pi-081-lockstep-rewrite.md",
			"docs/superpowers/specs/2026-07-22-pi-081-lockstep-rewrite-design.md",
		]) {
			await expect(access(resolve(root, path))).rejects.toBeDefined();
		}
	});
});
