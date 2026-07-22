import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";

export interface UiTrace {
	confirms: Array<{ title: string; message: string }>;
	confirmAnswers: Array<boolean | "timeout">;
	selects: Array<{ title: string; options: string[] }>;
	selectAnswers: Array<string | undefined>;
	notifies: Array<{ message: string; type: string | undefined }>;
	statuses: Array<{ key: string; text: string | undefined }>;
	widgets: Array<{ key: string; hasContent: boolean }>;
	titles: string[];
	workingMessages: Array<string | undefined>;
}

export interface UiPolicy {
	confirm?: (
		title: string,
		message: string,
	) => boolean | Promise<boolean>;
	select?: (
		title: string,
		options: string[],
	) => string | undefined | Promise<string | undefined>;
	input?: (title: string) => string | undefined | Promise<string | undefined>;
}

export const createUiTrace = (): UiTrace => ({
	confirms: [],
	confirmAnswers: [],
	selects: [],
	selectAnswers: [],
	notifies: [],
	statuses: [],
	widgets: [],
	titles: [],
	workingMessages: [],
});

export const buildUi = (
	trace: UiTrace,
	policy: UiPolicy,
): ExtensionUIContext => ({
	confirm: async (title, message) => {
		trace.confirms.push({ title, message });
		const answer = policy.confirm
			? await policy.confirm(title, message)
			: true;
		trace.confirmAnswers.push(answer);
		return answer;
	},
	select: async (title, options) => {
		trace.selects.push({ title, options: [...options] });
		const answer = policy.select
			? await policy.select(title, options)
			: options[0];
		trace.selectAnswers.push(answer);
		return answer;
	},
	input: async (title) =>
		policy.input ? await policy.input(title) : undefined,
	notify: (message, type) => {
		trace.notifies.push({ message, type });
	},
	onTerminalInput: () => () => {},
	setStatus: (key, text) => {
		trace.statuses.push({ key, text });
	},
	setWorkingMessage: (m) => {
		trace.workingMessages.push(m);
	},
	setWorkingVisible: () => {},
	setWorkingIndicator: () => {},
	setHiddenThinkingLabel: () => {},
	setWidget: ((key: string, content: unknown) => {
		trace.widgets.push({ key, hasContent: content !== undefined });
	}) as ExtensionUIContext["setWidget"],
	setFooter: () => {},
	setHeader: () => {},
	setTitle: (title) => {
		trace.titles.push(title);
	},
	custom: async () => undefined as never,
	pasteToEditor: () => {},
	setEditorText: () => {},
	getEditorText: () => "",
	editor: async () => undefined,
	addAutocompleteProvider: () => {},
	setEditorComponent: () => {},
	getEditorComponent: () => undefined,
	get theme() {
		return {
			fg: (_kind: unknown, s: string) => s,
			bg: (_kind: unknown, s: string) => s,
		} as never;
	},
	getAllThemes: () => [],
	getTheme: () => undefined,
	setTheme: () => ({ success: true }),
	getToolsExpanded: () => false,
	setToolsExpanded: () => {},
});
