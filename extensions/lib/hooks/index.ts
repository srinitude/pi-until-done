import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Store } from "../store";
import { registerAgentHooks } from "./agent";
import { registerInputHook } from "./input";
import { registerSessionHooks } from "./session";
import { registerTelemetryHooks } from "./telemetry";
import { registerToolHooks } from "./tools";
import { registerTurnHooks } from "./turn";

export const registerHooks = (pi: ExtensionAPI, store: Store): void => {
	registerSessionHooks(pi, store);
	registerAgentHooks(pi, store);
	registerTurnHooks(pi, store);
	registerToolHooks(pi, store);
	registerInputHook(pi, store);
	registerTelemetryHooks(pi, store);
};
