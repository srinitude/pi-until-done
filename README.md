# pi-until-done

![pi-until-done preview](./assets/preview.png)

A Pi extension for durable, evidence-driven goal pursuit. `/until-done` turns an intent into a confirmed contract, a dependency-aware plan, and a bounded Ralph loop. Every completion claim is checked by an LLM judge before the goal can become `done`.

[![npm version](https://img.shields.io/npm/v/pi-until-done.svg?logo=npm&logoColor=white)](https://www.npmjs.com/package/pi-until-done)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/srinitude/pi-until-done/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/srinitude/pi-until-done/actions/workflows/ci.yml)

## Compatibility

`pi-until-done` is intentionally lockstep with Pi. Each release supports one exact Pi release; install an older package release when using an older Pi.

| pi-until-done | Pi packages | Runtime |
| --- | --- | --- |
| `0.3.0` | `@earendil-works/pi-{coding-agent,ai,tui}@0.81.1` | Node `>=22.19.0` |

The machine-readable contract is [`compatibility/pi.json`](compatibility/pi.json). Production code uses Node APIs and does not depend on the Bun runtime. Bun remains a pinned development/test tool.

## Install

```bash
pi install npm:pi-until-done
```

Other Pi-supported sources work too:

```bash
pi install github:srinitude/pi-until-done
pi install /path/to/pi-until-done
pi -e /path/to/pi-until-done/extensions/until-done.ts
```

Requirements:

- the exact compatible Pi release listed above;
- Node `>=22.19.0`;
- [`mise`](https://mise.jdx.dev/) on `PATH` for verification commands.

## Use

Start with an intent:

```text
/until-done finish migrating auth tests to Vitest
```

Pi will:

1. clarify the outcome, goal type, accessible evidence surfaces, and verification command;
2. display the complete contract and task plan;
3. wait for the user to run `/until-done approve`;
4. call `until_done_set` and `until_done_plan` after approval;
5. work through ANALYSIS → BOOTSTRAP → RED → GREEN → REFACTOR → VERIFY → DONE;
6. continue only after Pi emits `agent_settled`;
7. run the completion judge against the cited evidence;
8. mark the goal done only on an approving verdict.

A non-mise verification command is automatically routed through `mise exec --`. A command already beginning with `mise run` or `mise exec` is preserved.

### Judge selection

A judge is mandatory. Cross-model judging is recommended:

```text
/until-done judge anthropic/claude-sonnet-4-5
```

If no second model is available, explicitly choose a fresh-context same-model judge:

```text
/until-done judge same
```

Clear the session default with `/until-done judge clear`. Without a session default, `until_done_set` must receive one of:

```ts
judgeModel: { provider: "anthropic", modelId: "claude-sonnet-4-5" }
// or
sameModelJudge: true
```

The judge sees only the goal, done criteria, verification command, and executor-cited evidence. It must return strict JSON `{ "verdict": "done" | "continue", "reason": "..." }`. A `continue` verdict blocks completion. Judge infrastructure failures fail open only with a visible warning evidence line; there is no user-facing no-judge bypass.

### Commands

| Command | Purpose |
| --- | --- |
| `/until-done <intent>` | Draft and display a new goal contract and task plan |
| `/until-done approve` | Open the approval dialog for the visible draft |
| `/until-done status` | Show concise state |
| `/until-done detail` | Show full state and task detail |
| `/until-done tasks` | Show the current plan |
| `/until-done pause` / `resume` | Pause or resume pursuit |
| `/until-done cancel` | Clear the current goal after confirmation |
| `/until-done budget <n>` | Set the bounded turn budget |
| `/until-done autopilot` | Toggle setup confirmation bypass for this session |
| `/until-done judge [provider/model\|same\|clear]` | Inspect or set the judge default |
| `/until-done ask <question>` | Ask a side question without mutating goal state |
| `/until-done northstar` | Show locked outcome fields |
| `/until-done replan-log` | Show plan revisions |
| `/until-done help` | Show built-in help |

## Runtime contract

### Pi-native state

Typed custom entries on the active Pi session branch are authoritative. The reducer replays those entries on load and branch changes. `.until-done/tasks.yaml` and `.until-done/distilled.md` are inspectable exports, not a side database.

Valid `0.2.x` session state is migrated once by appending a schema-v3 migration event; history is never rewritten. Invalid legacy state is preserved and the goal pauses safely for review.

### Hook composition

- `before_agent_start` appends the active North Star to `event.systemPrompt`; it never replaces another extension's prompt.
- `agent_settled` owns automatic continuation. `agent_end` is not used to queue work.
- `session_compact` schedules a hidden `CustomMessageEntry` re-anchor on the next turn.
- `session_before_compact` is intentionally not used for ineffective prompt mutation.
- Uninvolved hook handlers return `undefined`.

### Bounded execution

The extension tracks turn budget, spin signals, user interjections, blocked state, and verification evidence. Subprocesses use Node `child_process` with abort, timeout, output truncation, and process-tree cleanup behavior covered by Node smoke tests.

## Development

```bash
mise install
mise run install-deps
mise run check
mise run ci
mise run release-ready
```

Canonical automation lives in [`mise.toml`](mise.toml):

- `mise run check` — typecheck, lint, and format checks in parallel;
- `mise run ci` — complete tests, official-Node smoke tests, package/pack checks, structure checks, and workflow policy;
- `mise run release-ready` — full CI plus release-surface and local/remote parity checks;
- `mise run workflows` — strict gh-aw compilation, generated-workflow patching for pinned compiler defects, actionlint, and workflow invariants;
- `mise run dev` — watch mode.

CI runs the same `mise run ci` gate on Linux, macOS, and Windows. Production TypeScript must remain at nesting depth ≤3, construct length ≤30 lines, and file length ≤200 lines.

## Upstream lockstep automation

A deterministic daily workflow compares all three latest `@earendil-works/pi-*` package versions. Version skew fails closed. A new exact release dispatches a sandboxed [GitHub Agentic Workflow](https://github.github.com/gh-aw/) with:

- Grok 4.5 at high reasoning as the primary repair model;
- three fresh attempts, up to 16 Copilot continuations each;
- a combined `$5` AI-credit ceiling per run and a provider-side `$25` monthly cap;
- no repository or publishing credential in the model sandbox;
- a repository-only GitHub App for bounded safe output;
- at most 20 non-generated files and 1,500 non-generated changed lines;
- immutable workflow, security, structure, package, and Node contract tests;
- blocking GLM 5.2/xhigh review for `extensions/**` changes;
- protected-branch Linux/macOS/Windows CI before auto-merge.

Future compatibility releases use two separately verified `main` SHAs: one after the compatibility merge and one after a version-only PR. Initial `0.3.0` publishing remains manually initiated. npm publishing uses trusted publishing with provenance and re-runs release readiness on the exact tag SHA.

## Maintainer issue triage

The issue workflow stages read-only assessments as short-lived Actions artifacts. It cannot comment, label, close, or edit an issue, and it receives no issue-write credential. A maintainer reviews the staged evidence and final wording locally. Approved labels and comments are then applied through that maintainer's authenticated account.

## Security and privacy

The extension sends completion evidence to the configured judge model. Do not include secrets in goals, evidence, task notes, or exported artifacts. See [SECURITY.md](SECURITY.md) for reporting instructions and the automation trust boundary.

## License

[MIT](LICENSE)
