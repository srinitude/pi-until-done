import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Store } from "../store";

export const registerTelemetryHooks = (
	pi: ExtensionAPI,
	store: Store,
): void => {
	pi.on("context", () => undefined);

	pi.on("before_provider_request", () => {
		store.stats.providerRequests++;
	});

	pi.on("after_provider_response", () => {
		store.stats.providerResponses++;
	});

	pi.on("model_select", () => {
		store.stats.modelSwitches++;
	});

	pi.on("thinking_level_select", () => {
		store.stats.thinkingSwitches++;
	});

	pi.on("user_bash", () => {
		store.stats.userBashRuns++;
		return undefined;
	});
};
