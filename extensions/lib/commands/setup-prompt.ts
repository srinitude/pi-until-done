import {
	MISE_CLI_BLOCK,
	PI_CONFIG_PRINCIPLES,
	VERIFIABILITY_BLOCK,
} from "../strings";
import { STRUCTURAL_CONSTRAINTS_BLOCK } from "../structural-constraints";

const PHASE_0 = [
	"PHASE 0 — BRAINSTORM (refine the goal before locking it)",
	"0a. The value of good instructions has never been higher. A vague goal will burn turns and produce drift; a sharp goal terminates cleanly.",
	"0b. Before drafting the contract, classify the work:",
	'     • TICKET — solution shape is known up-front ("add X to Y", "fix bug Z"). Decompose into TDD tasks.',
	'     • EXPLORATORY — only the destination is known ("cut p95 by 20%", "feature parity with Mac"). Plan emerges by running.',
	"0c. Interview the user — one or two short questions — to nail down: the verifyCommand (or measurable target), goal type, and which surfaces (logs, metrics, staging URL, flame graphs, cost data, sandbox cluster, etc.) are accessible. A goal is only as effective as the surfaces it can act on.",
	"0d. If the goal is exploratory and the user has not yet pointed you at any surfaces, surface that gap explicitly before proceeding.",
];

const PHASE_1 = [
	"PHASE 1 — CONTRACT (you draft, user approves)",
	"1. Apply pi-config TDD discipline: ANALYSIS → BOOTSTRAP → RED → GREEN → REFACTOR → CLEANUP.",
	"2. Draft the contract:",
	"   • outcome — one-line restatement",
	"   • done-criteria — externally verifiable; must include 'all tests in <verifyCommand> pass' for production-code goals",
	"   • verifyCommand — the single shell command that proves done (e.g. 'bun test'); omit for research/doc",
	"   • ask-before — operations requiring user approval (be specific)",
	"   • decisionStyle — one short sentence on trade-offs",
	"   • goalType — ticket | exploratory (see PHASE 0)",
	"   • surfaces[] — list of {kind, location, notes?} for every data source / staging access / dashboard / sandbox the user has provided",
	"   • startPhase — analysis | bootstrap | red | green | refactor | cleanup | none",
	"   • Judge mode — REQUIRED. Every until_done_complete is gated by an LLM judge. Pick exactly one (until_done_set will refuse with judge_unspecified if both are missing AND the user has not pre-configured /until-done judge):",
	"       - judgeModel: { provider, modelId } — RECOMMENDED. A model DIFFERENT from the executor. Cross-model is the standard fix for Ralph-loop oscillation. If the user has not specified one in their intent, ASK in the contract dialog: 'Which model should judge completion? Pick one different from the executor for strongest convergence (e.g. anthropic/claude-opus-4-7 if the executor is claude-sonnet-4-6).'",
	"       - sameModelJudge: true — fallback when no second model is available. The executor self-judges with a fresh, completion-focused context. Strictly weaker than cross-model.",
	"     The user can also pre-configure a session default with /until-done judge <provider>/<modelId> (or /until-done judge same). If they have, the extension fills it in when you omit both fields — surface that to the user in the contract dialog so they can confirm.",
];

const PHASE_2 = [
	"PHASE 2 — TASK LIST (you draft as YAML, then activate)",
	"3. Decompose the goal into a TDD-first task list. Each task must have:",
	"     id (T-001, T-002, ...), title, phase, status: pending,",
	"     dependencies, blocks, prerequisites (each {description, cleared}),",
	"     validationSteps (ordered), ciCommands, styleguideRules,",
	"     guardrails, learnings: [], gotchas, context: [{path|url, why}].",
	"   - Bootstrap tasks come first.",
	"   - Every code-changing task must be preceded by a RED task that adds a failing test.",
	"   - For exploratory goals, the early tasks may be measurement/investigation; the plan can replan freely as findings come in.",
	"   - Include a final CLEANUP task: strip debug prints, scratch files, and any guardrail violations the loop introduced. The diff must be production-shaped before complete.",
	"   - The very last task is verification: run verifyCommand, confirm done-criteria, quote the output.",
	"4. Show the contract AND the full YAML task list back to the user as plain markdown.",
	"5. After showing the full draft, ask the user to run `/until-done approve` to open the approval dialog.",
];

const PHASE_3 = [
	"PHASE 3 — ACTIVATION",
	"6. After `/until-done approve` succeeds (or explicit autopilot approval is present):",
	"   a. Call `until_done_set` with the contract fields (including goalType, surfaces, AND the judge-mode field — judgeModel or sameModelJudge — chosen in PHASE 1).",
	"   b. Call `until_done_plan` with the full tasks array.",
	"7. Begin work on the first task with no dependencies.",
];

const PHASE_4 = [
	"PHASE 4 — EXECUTION",
	"8. For each task:",
	"   - Call `until_done_task_update` with status='in_progress' before starting.",
	"   - Apply phase discipline: RED before GREEN, GREEN before REFACTOR, REFACTOR before CLEANUP.",
	"   - Append learnings (`addLearning`) and gotchas (`addGotcha`) as you discover them — these feed `until_done_distill` at the end.",
	"   - Add files/URLs you needed via `addContext`.",
	"   - Run validationSteps and ciCommands.",
	"   - When done, `until_done_task_update` with status='done'.",
	"9. When ALL tasks are done AND verifyCommand passes (with quoted output), call `until_done_complete`. The cross-model judge runs inside that call: it sees only the goal, done-criteria, verifyCommand, and your cited evidence — nothing else from this conversation. Cite evidence the judge can verify literally (paste command output, reference file paths). Don't paraphrase. If the judge returns 'continue', re-read its reason, address the specific gap, then call `until_done_complete` again with stronger evidence — re-running with the same evidence will be rejected again.",
	"10. After complete, call `until_done_distill` to compile the journey into a PRD-shaped summary the user can act on.",
	"11. If blocked at any point, call `until_done_block`.",
];

export const setupPrompt = (intent: string): string =>
	[
		`/until-done setup for: ${intent}`,
		"",
		"Read this carefully and follow it strictly.",
		"",
		VERIFIABILITY_BLOCK,
		"",
		PI_CONFIG_PRINCIPLES,
		"",
		MISE_CLI_BLOCK,
		"",
		STRUCTURAL_CONSTRAINTS_BLOCK,
		"",
		...PHASE_0,
		"",
		...PHASE_1,
		"",
		...PHASE_2,
		"",
		...PHASE_3,
		"",
		...PHASE_4,
		"",
		"DO NOT call any until_done_* tool until PHASE 2 approval succeeds.",
	].join("\n");
