import { readFile, writeFile } from "node:fs/promises";

const workflows = new URL("../workflows/", import.meta.url);

async function patchCopilotByokOutput() {
	const path = new URL("pi-upstream-lockstep.lock.yml", workflows);
	const source = await readFile(path, "utf8");
	const activation = source.match(/jobs:\n  activation:[\s\S]*?\n  agent:/)?.[0];
	if (!activation) throw new Error("gh-aw activation job not found");
	if (activation.includes("secret_verification_result:")) return;
	const marker =
		"      stale_lock_file_failed: ${{ steps.check-lock-file.outputs.stale_lock_file_failed == 'true' }}";
	if (!activation.includes(marker)) throw new Error("gh-aw output marker not found");
	const note = "# v0.82.14 BYOK compiler workaround; remove after upstream fixes conclusion guards.";
	await writeFile(
		path,
		source.replace(marker, `${marker}\n      ${note}\n      secret_verification_result: ""`),
	);
}

async function patchOpenCodeProvider() {
	const path = new URL("pi-runtime-review.lock.yml", workflows);
	const source = await readFile(path, "utf8");
	const markers = [
		['"autoupdate": false,', '"autoupdate": false,\n            "model": "awf-proxy/glm-5.2",'],
		['"api": "http://172.30.0.30:10002"', '"api": "http://172.30.0.30:10000"'],
		['"apiKey": "awf-copilot-proxy"', '"apiKey": "awf-openai-proxy"'],
		['"claude-sonnet-4.5": {}', '"glm-5.2": {}'],
	];
	let patched = source;
	for (const [oldValue, newValue] of markers) {
		if (!patched.includes(oldValue) && !patched.includes(newValue)) {
			throw new Error(`gh-aw OpenCode marker not found: ${oldValue}`);
		}
		if (!patched.includes(newValue)) patched = patched.replaceAll(oldValue, newValue);
	}
	await writeFile(path, patched);
}

async function patchMaintenanceChoice() {
	const path = new URL("agentics-maintenance.yml", workflows);
	const source = await readFile(path, "utf8");
	if (source.includes("        default: 'none'\n        options:\n          - 'none'")) return;
	const patched = source.replace("        default: ''\n        options:\n          - ''", "        default: 'none'\n        options:\n          - 'none'");
	if (patched === source) throw new Error("gh-aw maintenance choice marker not found");
	await writeFile(path, patched);
}

await patchCopilotByokOutput();
await patchOpenCodeProvider();
await patchMaintenanceChoice();
