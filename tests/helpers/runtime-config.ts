import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Model } from "@earendil-works/pi-ai";
import {
	type CreateAgentSessionRuntimeFactory,
	createAgentSessionFromServices,
	createAgentSessionServices,
	type ExtensionAPI,
	type ModelRuntime,
} from "@earendil-works/pi-coding-agent";

export const seedDir = (
	cwd: string,
	seeds: Record<string, string> | undefined,
): void => {
	if (!seeds) return;
	for (const [relativePath, content] of Object.entries(seeds)) {
		const fullPath = join(cwd, relativePath);
		const directory = fullPath.slice(0, fullPath.lastIndexOf("/"));
		if (directory && !existsSync(directory)) {
			mkdirSync(directory, { recursive: true });
		}
		writeFileSync(fullPath, content);
	}
};

export const buildRuntimeFactory = (
	modelRuntime: ModelRuntime,
	model: Model<string>,
	factory: (pi: ExtensionAPI) => void,
): CreateAgentSessionRuntimeFactory => {
	const runtimeOptions = {
		modelRuntime,
		resourceLoaderOptions: {
			extensionFactories: [factory],
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
			noContextFiles: true,
		},
	};
	return async ({ cwd, sessionManager, sessionStartEvent }) => {
		const services = await createAgentSessionServices({
			...runtimeOptions,
			cwd,
			agentDir: cwd,
		});
		return {
			...(await createAgentSessionFromServices({
				services,
				sessionManager,
				sessionStartEvent,
				model,
			})),
			services,
			diagnostics: services.diagnostics,
		};
	};
};
