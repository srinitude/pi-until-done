import { describe, expect, test } from "bun:test";
import { access, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const workflow = (name: string) =>
	readFile(resolve(root, `.github/workflows/${name}`), "utf8");
const optionalWorkflow = (name: string) => workflow(name).catch(() => "");

describe("Pi lockstep agentic workflows", () => {
	test("uses Grok 4.5 high as the bounded primary repair model", async () => {
		const source = await workflow("pi-upstream-lockstep.md");
		expect(source).toContain("x-ai/grok-4.5");
		expect(source).not.toContain("--effort=high");
		expect(source).toContain("max-turns: 3");
		expect(source).toContain("max-continuations: 16");
		expect(source).toContain("max-ai-credits: 475");
		expect(source).toContain("max-daily-ai-credits: 500");
		expect(source).toContain("max-ai-credits: 25");
		expect(source).toContain('version: "1.0.71"');
		expect(source).toContain('input: "2.27e-06"');
		expect(source).toContain('output: "6.8e-06"');
		expect(source).toContain("secrets.OPENROUTER_API_KEY");
		expect(source).not.toContain("GITHUB_OPENROUTER_API_KEY");
		expect(source).toContain("https://openrouter.ai/api/v1");
	});

	test("fails closed unless Grok defaults to mandatory high reasoning", async () => {
		for (const name of ["pi-upstream-lockstep", "issue-triage"]) {
			const source = await workflow(`${name}.md`);
			const lock = await workflow(`${name}.lock.yml`);
			expect(source).toContain('default_effort == "high"');
			expect(source).toContain(".reasoning.mandatory == true");
			expect(source).toContain("COPILOT_PROVIDER_WIRE_API: completions");
			expect(source).not.toContain("COPILOT_PROVIDER_WIRE_MODEL");
			expect(lock).toContain("openrouter.ai,awmg-mcpg,packagecloud.io");
			expect(lock).toContain('"openrouter.ai","awmg-mcpg","packagecloud.io"');
			expect(lock).toContain('NO_PROXY="${NO_PROXY:+$NO_PROXY,}awmg-mcpg"');
			expect(lock).toContain("COPILOT_MODEL: x-ai/grok-4.5");
			expect(lock).not.toContain("COPILOT_MODEL: gpt-5.4");
		}
	});

	test("uses an isolated GitHub App safe output with patch limits", async () => {
		const source = await workflow("pi-upstream-lockstep.md");
		expect(source).toContain("PI_LOCKSTEP_APP_CLIENT_ID");
		expect(source).toContain("PI_LOCKSTEP_APP_PRIVATE_KEY");
		expect(source).toContain("max-patch-files: 20");
		expect(source).toContain('github-token-for-extra-empty-commit: "app"');
		expect(source).toContain('"$changed_lines" -gt 1500');
		expect(source).toContain('"$changed_files" -gt 20');
		expect(source).toContain('"extensions/**/*.ts"');
		expect(source).not.toContain('".github/workflows/**"');
	});

	test("compiled Grok workflows define every conclusion guard output", async () => {
		for (const name of [
			"pi-upstream-lockstep.lock.yml",
			"issue-triage.lock.yml",
		]) {
			const source = await workflow(name);
			const activation = source.match(/jobs:\n  activation:[\s\S]*?\n  agent:/)?.[0];
			expect(activation).toContain("secret_verification_result:");
		}
	});

	test("routes runtime review through read-only Z.AI OpenCode", async () => {
		const source = await workflow("pi-runtime-review.md");
		expect(source).toContain("id: opencode");
		expect(source).toContain("openai/glm-5.2");
		expect(source).toContain('version: "1.2.14"');
		expect(source).toContain('input: "1.1268e-06"');
		expect(source).toContain('output: "3.9438e-06"');
		expect(source).toContain("max-turns: 48");
		expect(source).toContain("max-ai-credits: 100");
		expect(source).toContain("stop exploring and submit the review immediately");
		expect(source).toContain("https://api.z.ai/api/coding/paas/v4");
		expect(source).toContain("OPENAI_BASE_URL");
		expect(source).toContain("reasoningEffort");
		expect(source).toContain('"xhigh"');
		expect(source).not.toContain("create-pull-request:");
		expect(source).not.toContain("tools:\n  edit:");
	});

	test("compiled OpenCode config routes GLM through the OpenAI proxy", async () => {
		const source = await workflow("pi-runtime-review.lock.yml");
		expect(source).toContain('"model": "awf-proxy/glm-5.2"');
		expect(source).toContain('"api": "http://172.30.0.30:10000"');
		expect(source).toContain('"apiKey": "awf-openai-proxy"');
		expect(source).not.toContain('"api": "http://172.30.0.30:10002"');
		expect(source).not.toContain('"apiKey": "awf-copilot-proxy"');
	});

	test("conditionally requires exact-head GLM approval only for runtime changes", async () => {
		const source = await workflow("runtime-review-gate.yml");
		expect(source).toContain("extensions/");
		expect(source).toContain("pi-runtime-review.lock.yml");
		expect(source).toContain("commit_id == $sha");
		expect(source).toContain("APPROVED");
		expect(source).toContain("No runtime files changed; GLM review is not required");
	});

	test("detects all exact Pi package versions without an LLM", async () => {
		const source = await workflow("upstream-watch.yml");
		for (const name of [
			"@earendil-works/pi-coding-agent",
			"@earendil-works/pi-ai",
			"@earendil-works/pi-tui",
		]) {
			expect(source).toContain(name);
		}
		expect(source).toContain("pi-upstream-lockstep.lock.yml");
	});

	test("bounds issue triage to event targets or 25 open issues", async () => {
		const source = await optionalWorkflow("issue-triage.md");
		expect(source).toContain("workflow_dispatch:");
		expect(source).toContain("types: [opened, reopened, edited]");
		expect(source).toContain("roles: all");
		expect(source).toContain("x-ai/grok-4.5");
		expect(source).toContain("max-turns: 16");
		expect(source).toContain("max-continuations: 16");
		expect(source).toContain("call `task_complete` immediately");
		expect(source).toContain("at most 25");
		expect(source).toContain("TRIAGE_MAX_ITEMS");
	});

	test("stages structured triage without issue write access", async () => {
		const source = await optionalWorkflow("issue-triage.md");
		expect(source).toContain("issues: read");
		expect(source).not.toContain("issues: write");
		expect(source).toContain("stage-triage:");
		expect(source).toContain("engine: false");
		expect(source).toContain("max: 25");
		expect(source).toContain("upload-artifact");
		expect(source).toContain("validate-issue-triage-output.mjs");
		expect(source).toContain("PRIVATE_COPY_DENYLIST");
		expect(source).not.toContain("add-comment:");
		expect(source).not.toContain("add-labels:");
		expect(source).not.toContain("github-app:");
		expect(source).not.toContain("\nskills:");
	});

	test("gives the triage model no repository mutation tools", async () => {
		const source = await optionalWorkflow("issue-triage.md");
		expect(source).toContain("staged assessment is not issue copy");
		expect(source).toContain("Do not comment, label, close, edit");
		expect(source).not.toContain("tools:\n  edit:");
		expect(source).not.toContain("create-pull-request:");
		expect(source).not.toContain("close-issue:");
	});

	test("tracks the compiled triage workflow as generated output", async () => {
		const runner = await readFile(
			resolve(root, ".github/scripts/verify-workflows.mjs"),
			"utf8",
		);
		const lock = await optionalWorkflow("issue-triage.lock.yml");
		expect(runner).toContain("issue-triage.lock.yml");
		expect(lock).toContain("validate-issue-triage-output.mjs");
		expect(lock).toContain("RUN_DETECTION: false");
		expect(lock).toContain("DETECTION_AGENTIC_EXECUTION_OUTCOME: skipped");
		expect(lock).not.toContain(
			"RUN_DETECTION: ${{ steps.detection_guard.outputs.run_detection }}",
		);
		expect(lock).not.toContain("steps.detection_agentic_execution.outcome");
		expect(lock).not.toContain("issues: write");
	});

	test("pins every conventional workflow action to an immutable SHA", async () => {
		const directory = resolve(root, ".github/workflows");
		const files = (await readdir(directory)).filter((name) => name.endsWith(".yml"));
		for (const file of files) {
			const source = await readFile(resolve(directory, file), "utf8");
			const actions = [...source.matchAll(/^\s*uses:\s*(\S+)/gm)].map(
				(match) => match[1],
			);
			for (const action of actions) expect(action).toMatch(/@(?:[a-f0-9]{40}|\.\/)/);
		}
	});

	test("keeps workflow validation portable when Docker is unavailable", async () => {
		const mise = await readFile(resolve(root, "mise.toml"), "utf8");
		const runner = await readFile(
			resolve(root, ".github/scripts/verify-workflows.mjs"),
			"utf8",
		);
		expect(mise).toContain('run = "node .github/scripts/verify-workflows.mjs"');
		expect(runner).toContain('run("gh-aw", ["compile", "--strict"])');
		expect(runner).toContain(
			'process.platform !== "win32" && canRun("docker", ["info"])',
		);
		expect(runner).toContain("Docker unavailable; strict gh-aw compile completed");
	});

	test("serializes generated workflow writes before the full test suite", async () => {
		const source = await readFile(resolve(root, "mise.toml"), "utf8");
		const testCi = source.match(/\[tasks\.test-ci\][\s\S]*?\n\n/)?.[0];
		const ci = source.match(/\[tasks\.ci\][\s\S]*?\n\n/)?.[0];
		expect(testCi).toContain('depends = ["workflows"]');
		expect(testCi).toContain('run = "mise run test"');
		expect(ci).toContain('"test-ci"');
		expect(ci).not.toContain('\n  "test",');
	});

	test("removes the stale PAT and CodeRabbit merge gate", async () => {
		const path = resolve(
			root,
			".github/workflows/upstream-pi-merge-gate.yml",
		);
		await expect(access(path)).rejects.toBeDefined();
	});

	test("keeps initial 0.3.0 publishing manual", async () => {
		const source = await workflow("post-compat-release.yml");
		expect(source).toContain('if [ "$version" = "0.3.0" ]');
		expect(source).toContain("mise run ci");
		expect(source).toContain("PI_LOCKSTEP_APP_PRIVATE_KEY");
	});
});
