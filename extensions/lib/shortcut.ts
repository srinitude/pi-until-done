import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Store } from "./store";
import { SHORTCUT_DESCRIPTION } from "./strings";
import { refreshWidget } from "./ui/widget";

export const registerShortcut = (pi: ExtensionAPI, store: Store): void => {
	pi.registerShortcut("ctrl+shift+g", {
		description: SHORTCUT_DESCRIPTION,
		handler: (ctx) => {
			refreshWidget(store, ctx, true);
		},
	});
};
