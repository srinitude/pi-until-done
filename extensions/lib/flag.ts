import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { FLAG_DESCRIPTION } from "./strings";

export const registerFlag = (pi: ExtensionAPI): void => {
	pi.registerFlag("until-done", {
		type: "string",
		description: FLAG_DESCRIPTION,
	});
};
