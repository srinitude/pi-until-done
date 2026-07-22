import type {
	ExtensionAPI,
	InputEventResult,
} from "@earendil-works/pi-coding-agent";
import type { Store } from "../store";

export const registerInputHook = (pi: ExtensionAPI, store: Store): void => {
	pi.on("input", (event): InputEventResult => {
		if (event.source !== "extension") store.userMessagedThisTurn = true;
		return { action: "continue" };
	});
};
