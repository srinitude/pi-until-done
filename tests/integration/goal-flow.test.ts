import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { makeTask } from "../helpers/factories";
import {
	createTestRuntime,
	type TestRuntime,
} from "../helpers/runtime-harness";

let rt: TestRuntime | undefined;

afterEach(async () => {
	await rt?.dispose();
	rt = undefined;
});

describe("end-to-end happy path: setup → set → plan → progress → complete → distill", () => {
	test("threads through every state transition with real tasks.yaml + distilled.md", async () => {
		rt = await createTestRuntime({
			withUi: true,
			uiPolicy: { confirm: () => true },
		});

		// Step 1: user starts setup. Pi auto-confirms via the UI policy.
		// Faux response acknowledges and stops.
		rt.setLLM([fauxAssistantMessage("ack", { stopReason: "stop" })]);
		await rt.prompt("/until-done implement /healthz endpoint");
		await rt.awaitIdle();
		expect(rt.store.state.confirmedByUser).toBe(true);
		expect(rt.store.state.status).toBe("setup");
		expect(rt.store.state.goal).toBe("implement /healthz endpoint");

		// Step 2: agent calls until_done_set. status: setup → active.
		// `sameModelJudge: true` opts into self-judge for this single-faux
		// integration test; production contracts default to cross-model via
		// the `judgeModel: { provider, modelId }` parameter.
		rt.setLLM([
			fauxAssistantMessage(
				[
					fauxToolCall("until_done_set", {
						goal: "implement /healthz endpoint",
						doneCriteria: "GET /healthz returns 200 with {ok:true}",
						verifyCommand: "bun test",
						askBefore: ["git push"],
						decisionStyle: "ship the smallest correct slice",
						goalType: "ticket",
						surfaces: [],
						maxTurns: 50,
						sameModelJudge: true,
					}),
				],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage("locked", { stopReason: "stop" }),
		]);
		await rt.prompt("Set the contract.");
		await rt.awaitIdle();
		expect(rt.store.state.status).toBe("active");
		expect(rt.store.state.northStar?.goal).toBe(
			"implement /healthz endpoint",
		);
		expect(rt.store.state.maxTurns).toBe(50);

		// Step 3: agent calls until_done_plan with two tasks.
		rt.setLLM([
			fauxAssistantMessage(
				[
					fauxToolCall("until_done_plan", {
						tasks: [
							makeTask({ id: "T-001", title: "add route", phase: "red" }),
							makeTask({
								id: "T-002",
								title: "wire health check",
								phase: "green",
								dependencies: ["T-001"],
							}),
						],
					}),
				],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage("planned", { stopReason: "stop" }),
		]);
		await rt.prompt("Lay out the plan.");
		await rt.awaitIdle();
		expect(rt.store.state.tasks).toHaveLength(2);
		expect(rt.store.state.currentTaskId).toBe("T-001");
		expect(rt.store.state.planComplete).toBe(true);

		// tasks.yaml landed on disk
		const yamlPath = join(rt.cwd, ".until-done", "tasks.yaml");
		expect(existsSync(yamlPath)).toBe(true);
		expect(await readFile(yamlPath, "utf8")).toContain("T-001");

		// Step 4: progress + task_update for T-001 → done. cursor should advance to T-002.
		rt.setLLM([
			fauxAssistantMessage(
				[
					fauxToolCall("until_done_progress", {
						note: "wrote failing test for /healthz",
						phase: "red",
					}),
				],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage(
				[
					fauxToolCall("until_done_task_update", {
						id: "T-001",
						patch: { status: "done", addLearning: "fastify route added" },
					}),
				],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage("T-001 done", { stopReason: "stop" }),
		]);
		await rt.prompt("Make progress on T-001.");
		await rt.awaitIdle();
		expect(rt.store.state.tasks[0].status).toBe("done");
		expect(rt.store.state.tasks[0].learnings).toContain("fastify route added");
		expect(rt.store.state.currentTaskId).toBe("T-002");

		// Step 5: complete + distill. The judge defaults to ON since the
		// contract didn't opt out (no `noJudge` and no explicit
		// `judgeModel`), so a self-judge LLM call fires inside
		// `until_done_complete` against the active executor model. Queue a
		// JSON verdict for the judge to consume between complete and distill.
		rt.setLLM([
			fauxAssistantMessage(
				[
					fauxToolCall("until_done_task_update", {
						id: "T-002",
						patch: { status: "done" },
					}),
				],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage(
				[
					fauxToolCall("until_done_complete", {
						evidence:
							'`bun test` output: "1 pass, 0 fail" — /healthz returns 200',
						summary: "shipped /healthz",
					}),
				],
				{ stopReason: "toolUse" },
			),
			// Judge consumes this response (self-judge path; same faux queue).
			fauxAssistantMessage(
				JSON.stringify({
					verdict: "done",
					reason: "verifyCommand output 1 pass, 0 fail satisfies criteria",
				}),
				{ stopReason: "stop" },
			),
			fauxAssistantMessage(
				[
					fauxToolCall("until_done_distill", {
						prdMarkdown:
							"# /healthz endpoint\n\n## Problem\nKubernetes probes need a liveness signal.\n\n## Outcome\nRoute `GET /healthz` returns 200 with `{ok:true}`.",
					}),
				],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage("complete + distilled", { stopReason: "stop" }),
		]);
		await rt.prompt("Wrap it up.");
		await rt.awaitIdle();

		expect(rt.store.state.status).toBe("done");
		expect(rt.store.state.lastVerdict).toBe("done");
		expect(rt.store.state.evidence.length).toBeGreaterThan(0);

		// distilled.md landed on disk with the user's content
		const mdPath = join(rt.cwd, ".until-done", "distilled.md");
		expect(existsSync(mdPath)).toBe(true);
		const md = await readFile(mdPath, "utf8");
		expect(md).toContain("/healthz endpoint");
		expect(md).toContain("Kubernetes probes");

		// Sequence of state-event kinds in JSONL
		const kinds = rt.getStateEntries().map((e) => e.kind);
		expect(kinds).toContain("set"); // setup begin
		expect(kinds).toContain("confirm"); // user approved
		expect(kinds).toContain("plan"); // until_done_plan
		expect(kinds).toContain("progress"); // until_done_progress
		expect(kinds).toContain("task_update"); // T-001 + T-002 patches
		expect(kinds).toContain("complete"); // until_done_complete
		// "set" appears for both initSetupState AND executeSet (contract activated)
		const setCount = kinds.filter((k) => k === "set").length;
		expect(setCount).toBeGreaterThanOrEqual(2);
	});
});
