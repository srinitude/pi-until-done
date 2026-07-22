import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	fauxAssistantMessage,
	fauxProvider,
	type FauxProviderHandle,
	type FauxResponseStep,
} from "@earendil-works/pi-ai/providers/faux";
import {
	createAgentSessionFromServices,
	createAgentSessionRuntime,
	type ExtensionAPI,
	ModelRuntime,
	SessionManager,
} from "@earendil-works/pi-coding-agent";
import untilDoneExtension from "../../extensions/until-done";
import type { Store } from "../../extensions/lib/store";
import { buildRuntimeFactory, seedDir } from "./runtime-config";
import { buildUi, createUiTrace, type UiPolicy, type UiTrace } from "./ui-mock";

export type { UiPolicy, UiTrace } from "./ui-mock";

export interface CreateTestRuntimeOptions {
	withUi?: boolean;
	uiPolicy?: UiPolicy;
	seedFiles?: Record<string, string>;
	withJudge?: boolean;
}

export interface TestRuntime {
	cwd: string;
	store: Store;
	pi: ExtensionAPI;
	ui: UiTrace;
	faux: FauxProviderHandle;
	judgeFaux: FauxProviderHandle | undefined;
	session: Awaited<ReturnType<typeof createAgentSessionFromServices>>["session"];
	runtimeHost: Awaited<ReturnType<typeof createAgentSessionRuntime>>;
	setLLM: (responses: FauxResponseStep[]) => void;
	appendLLM: (responses: FauxResponseStep[]) => void;
	setJudgeLLM: (responses: FauxResponseStep[]) => void;
	prompt: (text: string) => Promise<void>;
	awaitIdle: () => Promise<void>;
	getTaskTexts: () => string[];
	getStateEntries: () => Array<{ kind: string; patch?: unknown; note?: string }>;
	dispose: () => Promise<void>;
}

interface BranchEntry {
	type: string;
	customType?: string;
	data?: { kind: string; patch?: unknown; note?: string };
}

const collectStateEntries = (
	branch: ReadonlyArray<BranchEntry>,
): Array<{ kind: string; patch?: unknown; note?: string }> => {
	const out: Array<{ kind: string; patch?: unknown; note?: string }> = [];
	for (const e of branch) {
		if (e.type !== "custom" || e.customType !== "until-done.state") continue;
		if (e.data) out.push({ kind: e.data.kind, patch: e.data.patch, note: e.data.note });
	}
	return out;
};

export const createTestRuntime = async (
	options: CreateTestRuntimeOptions = {},
): Promise<TestRuntime> => {
	const cwd = join(
		tmpdir(),
		`pi-until-done-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(cwd, { recursive: true });
	seedDir(cwd, options.seedFiles);

	const faux = fauxProvider({ provider: "faux-pi-until-done" });
	faux.setResponses([fauxAssistantMessage("ok")]);
	const modelRuntime = await ModelRuntime.create({
		authPath: join(cwd, "auth.json"),
		modelsPath: null,
	});
	modelRuntime.registerNativeProvider(faux.provider);
	await modelRuntime.setRuntimeApiKey(faux.getModel().provider, "faux-key");
	const judgeFaux = options.withJudge
		? fauxProvider({ provider: "faux-judge" })
		: undefined;
	if (judgeFaux) {
		modelRuntime.registerNativeProvider(judgeFaux.provider);
		await modelRuntime.setRuntimeApiKey(
			judgeFaux.getModel().provider,
			"faux-judge-key",
		);
	}

	const trace = createUiTrace();
	let store: Store | undefined;
	let captured: ExtensionAPI | undefined;
	const factory = (pi: ExtensionAPI) => {
		captured = pi;
		untilDoneExtension(pi, { onStore: (s) => (store = s) });
	};

	const runtimeHost = await createAgentSessionRuntime(
		buildRuntimeFactory(modelRuntime, faux.getModel(), factory),
		{ cwd, agentDir: cwd, sessionManager: SessionManager.create(cwd) },
	);
	await runtimeHost.session.bindExtensions(
		options.withUi ? { uiContext: buildUi(trace, options.uiPolicy ?? {}) } : {},
	);

	if (!store || !captured)
		throw new Error("untilDoneExtension did not bind store/pi");

	return {
		cwd,
		store,
		pi: captured,
		ui: trace,
		faux,
		judgeFaux,
		session: runtimeHost.session,
		runtimeHost,
		setLLM: (responses) => faux.setResponses(responses),
		appendLLM: (responses) => faux.appendResponses(responses),
		setJudgeLLM: (responses) => {
			if (!judgeFaux)
				throw new Error("createTestRuntime called without withJudge:true");
			judgeFaux.setResponses(responses);
		},
		prompt: (text) =>
			runtimeHost.session.prompt(text, { source: "interactive" }),
		awaitIdle: async () => {
			while (runtimeHost.session.isStreaming) {
				await new Promise((r) => setTimeout(r, 5));
			}
		},
		getTaskTexts: () => store.state.tasks.map((t) => `${t.id}:${t.status}`),
		getStateEntries: () =>
			collectStateEntries(
				runtimeHost.session.sessionManager.getBranch() as BranchEntry[],
			),
		dispose: async () => {
			await runtimeHost.dispose();
			if (existsSync(cwd)) rmSync(cwd, { recursive: true, force: true });
		},
	};
};
