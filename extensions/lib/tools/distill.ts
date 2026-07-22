import * as fs from "node:fs";
import * as path from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import { DistillParams } from "../schemas/distill";
import { persist, type Store } from "../store";
import { failed, ok } from "./result";

type DistillInput = Static<typeof DistillParams>;

const writeDistilledFile = (
	cwd: string,
	prdMarkdown: string,
): string | undefined => {
	try {
		const dir = path.join(cwd, ".until-done");
		fs.mkdirSync(dir, { recursive: true });
		const file = path.join(dir, "distilled.md");
		fs.writeFileSync(file, prdMarkdown);
		return file;
	} catch {
		return undefined;
	}
};

const executeDistill = async (
	pi: ExtensionAPI,
	store: Store,
	params: DistillInput,
	ctx: ExtensionContext,
) => {
	const s = store.state;
	if (s.status !== "done") {
		return failed(
			`Refused: distill only runs after until_done_complete (status=${s.status}).`,
			"not_done",
		);
	}
	persist(
		pi,
		store,
		"progress",
		{ distilled: params.prdMarkdown },
		"distilled",
	);
	const written = writeDistilledFile(ctx.cwd, params.prdMarkdown);
	const tail = written ? ` Wrote ${written}.` : "";
	return ok(`✓ Distilled the journey into a PRD.${tail}`, { wrote: written });
};

export const registerDistillTool = (pi: ExtensionAPI, store: Store): void => {
	pi.registerTool({
		name: "until_done_distill",
		label: "Until-done distill",
		description:
			"After until_done_complete, compile the loop's journey into a PRD-shaped summary: problem, discovered solution shape, learnings, gotchas, useful surfaces, follow-up tasks. Exploratory goals especially benefit — the scrappy branch that achieved the goal becomes a spec future builds can implement cleanly. Output is written to .until-done/distilled.md.",
		parameters: DistillParams,
		async execute(_id, params, _signal, _onUpdate, ctx) {
			return executeDistill(pi, store, params, ctx);
		},
	});
};
