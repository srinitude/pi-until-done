/**
 * pi-until-done — Pi-led "/until-done" extension.
 *
 * Replicates Hermes Agent's `/goal` (Ralph loop with judge) on top of Pi,
 * using every Pi primitive and deferring every judgment to Pi itself.
 *
 * This file is the thin composition root. The implementation is split across
 * `extensions/lib/**` per the operating contract: every file ≤200 LOC,
 * every construct ≤30 LOC, nesting depth ≤3.
 *
 * Pi philosophy: hooks COMPOSE — every handler returns `undefined` when it
 * has no opinion so other extensions stay in charge of their own surface.
 * `before_agent_start` appends to (never replaces) the system prompt.
 * `session_before_compact` appends to (never replaces) `customInstructions`.
 * `tool_call` only blocks when the user's ask-before list explicitly fires.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCommand } from "./lib/commands/router";
import { registerFlag } from "./lib/flag";
import { registerHooks } from "./lib/hooks";
import { registerShortcut } from "./lib/shortcut";
import { createStore, type Store } from "./lib/store";
import { registerTools } from "./lib/tools";

export interface UntilDoneOptions {
	onStore?: (store: Store) => void;
}

export default function untilDoneExtension(
	pi: ExtensionAPI,
	options?: UntilDoneOptions,
): void {
	const store = createStore();
	options?.onStore?.(store);
	registerFlag(pi);
	registerTools(pi, store);
	registerHooks(pi, store);
	registerShortcut(pi, store);
	registerCommand(pi, store);
}
