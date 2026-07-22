import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { TICK_INTERVAL_MS } from "../constants";
import type { Store } from "../store";
import { refreshStatus } from "../ui/status-line";

const hasContentArray = (msg: unknown): msg is { content: unknown[] } =>
	typeof msg === "object" &&
	msg !== null &&
	"content" in msg &&
	Array.isArray((msg as { content: unknown }).content);

const isAssistant = (
	msg: unknown,
): msg is { role: "assistant"; content: unknown[] } =>
	typeof msg === "object" &&
	msg !== null &&
	(msg as { role?: string }).role === "assistant" &&
	hasContentArray(msg);

const extractAssistantText = (msg: unknown): string => {
	if (!isAssistant(msg)) return "";
	return msg.content
		.filter((c): c is { type: "text"; text: string } =>
			Boolean(c && (c as { type?: string }).type === "text"),
		)
		.map((c) => c.text)
		.join("\n");
};

export const registerTurnHooks = (pi: ExtensionAPI, store: Store): void => {
	pi.on("turn_start", (_event, ctx) => {
		refreshStatus(store, ctx);
	});

	pi.on("turn_end", (event) => {
		const text = extractAssistantText(event.message);
		if (text) store.lastAssistantText = text;
	});

	pi.on("message_start", () => undefined);

	pi.on("message_update", (_event, ctx) => {
		store.stats.messageUpdates++;
		const now = Date.now();
		if (now - store.lastTickAt < TICK_INTERVAL_MS) return;
		store.lastTickAt = now;
		if (store.state.status === "active") refreshStatus(store, ctx);
	});

	pi.on("message_end", (event) => {
		const text = extractAssistantText(event.message);
		if (text) store.lastAssistantText = text;
	});
};
