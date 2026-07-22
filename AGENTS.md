# Project Operating Contract — pi-until-done

This `AGENTS.md` is appended by Pi as Project Context and is mandatory policy
for any agent operating in this repo. It adopts the
[pi-config](https://github.com/srinitude/pi-config) operating contract in
full. See that repo for the canonical definitions; this file states the
repo-local specifics.

If a more global `AGENTS.md` / `CLAUDE.md` conflicts with this file, **this
file wins for this repo**.

## Definitions (inherited from pi-config)

- **Production code**: the runtime extension under `extensions/` —
  everything that ships when a user runs `pi install pi-until-done`.
- **Current scope**: the `/until-done` command, its tools, hooks, the CI
  runner, the language profiles, the strings module, the contract overlay.
- **Local CI/CD configuration**: `mise.toml` is the canonical source;
  `.github/workflows/ci.yml` mirrors it.
- **Automation foundation**: the eight items required by pi-config §0.

## Operating contract

You operate strictly in **TDD-first RED → GREEN → REFACTOR**:

- No production code unless directly required to satisfy a failing
  production test.
- All dependencies are abstract capabilities, declared at the system
  boundary, supplied at composition/runtime.
- No phase-skipping, no collapsing phases.

## Bootstrap status (this repo)

| Item | Status |
| --- | --- |
| 1. Canonical source of gates | `mise.toml` |
| 2. Local developer suite | `mise run check` (typecheck + lint + format, parallel) |
| 3. Local release-readiness suite | `mise run ci` (full) + `mise run release-ready` |
| 4. Affected-target execution | not yet — current scope is small enough to run full each time. **Documented fallback**: full validation is the safe path until the codebase grows. Revisit at >150 files. |
| 5. Deterministic caching | `mise.lock` pins Bun, Node, actionlint, and gh-aw artifacts; Bun caches dependency resolution. Deterministic no-cache remains the safe fallback. |
| 6. Safe parallel execution | `[settings] jobs = 4` in `mise.toml`; `check` and `ci` use `depends`. |
| 7. Matching GitHub workflow | `.github/workflows/ci.yml` — runs `mise run ci` on every push/PR. |
| 8. Local ↔ GitHub parity | both invoke the same `mise run ci` against the same `mise.toml`; no duplicated rules. |

## Performance mandate

- Any unnecessary slowdown is a defect.
- Two equally-correct approaches → choose the faster one.
- `mise.toml` already pins `jobs = 4` and uses `depends` for parallelism.
- Local feedback target: sub-second to a few seconds for small edits.
- Watch mode: `mise watch check` (also exposed as `mise run dev`).

## Code structure constraints (hard)

- nesting depth ≤ 3
- construct ≤ 30 LOC
- file ≤ 200 LOC
- single responsibility per construct

The existing extension already passes a brace-aware checker; any new code
must too. Use `python3 /tmp/check_constraints.py $(find extensions -name '*.ts')`
or its equivalent gate.

## Mise as sole CLI

- All shell commands route through `mise run <task>` or `mise exec -- <cmd>`.
- No `package.json` `scripts`. Project automation lives in `mise.toml`.
- The runtime extension auto-wraps any user-supplied `verifyCommand` with
  `mise exec --` if it isn't already a mise command.

## Definition of done (pi-config §9)

A change to this repo is done only when:

1. local `mise run ci` passes
2. local `mise run release-ready` passes
3. GitHub workflow passes
4. structural constraints pass (≤3 / ≤30 / ≤200)
5. typecheck is green (`mise run typecheck`)
6. tests are isolated, deterministic, parallel-safe (when present)
7. no proxy signals: quote real command output as evidence

## Release rule — never bump version on a red CI

Local `mise run ci` runs on the developer's OS only. The
cross-platform matrix (Linux / macOS / Windows) runs in GitHub. Two
0.2.x patch releases (`0.2.0`, `0.2.1`) shipped tags before remote
CI had proved out the cross-platform behavior, both held at the
publish gate, and the only clean recovery was a fresh patch
version. Never again.

`mise run publish:check` (which `publish:patch` / `publish:minor` /
`publish:major` all depend on) refuses unless ALL of the following
hold:

1. local working tree is clean and we're on `main`
2. local HEAD SHA matches `origin/main` (i.e. already pushed)
3. the most recent CI workflow run on that exact SHA has
   `status=completed` AND `conclusion=success`

If any check fails, the bump is refused with a specific remediation
message — push first, wait for CI green, then bump. Do not work
around the gate (no `--no-verify`, no manual `npm version`,
no `--force`). The gate is the contract; circumventing it produced
the 0.2.0 / 0.2.1 history.

The gate requires `gh` and `jq` on PATH. The
`.github/workflows/upstream-watch.yml` automation already enforces
the same rule for upstream-bump PRs; this rule extends the same
guarantee to local-developer-driven releases.

## Pi philosophy compliance (pi-config SYSTEM.md)

- Preserve developer agency over context. Be explicit about what was read,
  changed, validated, assumed, and not known.
- Hook handlers compose — every handler returns `undefined` when uninvolved.
- `before_agent_start` appends to (never replaces) the system prompt.
- `session_compact` re-anchors goal context as a `CustomMessageEntry`
  (`display:false`) on the next turn after compaction. The
  `session_before_compact` hook is intentionally NOT subscribed —
  Pi 0.81's `SessionBeforeCompactResult` has no `customInstructions`
  slot, so any mutation there is a no-op. Re-anchor through
  `session_compact` instead, never via `before_compact` mutation.
- No system-prompt replacement, no side-database, no hidden state. State
  lives in Pi session entries.

## Cross-model judge contract

Every `until_done_complete` is gated by an LLM judge. The contract is
binding on this repo:

- `until_done_set` REQUIRES one of `judgeModel: { provider, modelId }`
  (cross-model — recommended) or `sameModelJudge: true` (same-model
  with fresh context — fallback). Setup refuses with
  `judge_unspecified` if neither is provided AND the user has not
  pre-configured a session default via `/until-done judge`. There is
  no silent path past the judge — `noJudge`-style escape hatches were
  considered and rejected.
- The judge sees only goal, done-criteria, verifyCommand, and the
  executor's cited evidence. It returns strict JSON
  `{verdict, reason}`. `continue` blocks the transition; `done`
  proceeds. Unparseable / unavailable judge fails-open with a warning
  evidence line so judge-infra glitches don't block legitimate
  completion.
- Any work that touches the completion path (`tools/complete.ts`,
  `tools/judge.ts`, the schema in `schemas/set-fields.ts`) must
  preserve this contract. Tests in `tests/tools/judge.test.ts` are
  load-bearing — don't relax them to make a change pass; the
  Ralph-loop convergence property depends on the gate being
  unconditional.

## If you violate any constraint, the output is incorrect.
