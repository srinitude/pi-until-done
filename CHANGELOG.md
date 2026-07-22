# Changelog

All notable changes to `pi-until-done` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `/until-done approve` opens the contract gate only after the contract and
  full task plan are visible.
- A bounded, read-only issue-triage workflow stages structured assessments
  for local maintainer review without receiving issue-write credentials.

### Fixed
- Setup no longer races into the contract confirmation dialog immediately
  after queuing the drafting prompt. This fixes issue #1.

### Changed
- Issue comments and label changes require local maintainer approval and use
  that maintainer's authenticated GitHub account.
- `docs/superpowers/` is excluded from the current and future repository tree.

## [0.3.0] — 2026-07-22

### Breaking
- **Strict Pi lockstep.** This release supports only
  `@earendil-works/pi-coding-agent`, `pi-ai`, and `pi-tui` `0.81.1` on
  Node `>=22.19.0`. Older Pi releases remain supported by older
  `pi-until-done` releases.
- Replaced the retired `@mariozechner/*` API surface with Pi 0.81's
  `@earendil-works/*` packages and exact peer dependencies.
- Production subprocesses now use Node `child_process`; Bun is a pinned
  development tool, not a runtime requirement.

### Changed
- Automatic continuation moved from `agent_end` to Pi 0.81's settled
  `agent_settled` lifecycle event.
- `before_agent_start` composes with `event.systemPrompt`, and compaction
  restores the North Star with a hidden session entry on the next turn.
- Session state now uses schema-v3 typed events and active-branch replay.
  Valid `0.2.x` state migrates one way without rewriting history; invalid
  legacy state pauses safely.
- Autopilot and judge defaults persist as session preferences.
- Judge responses require strict JSON with a non-empty reason while
  preserving the visible judge-infrastructure fail-open behavior.

### Added
- Exact compatibility metadata in `compatibility/pi.json`.
- Official-Node import, subprocess, mise-discovery, pack-manifest, and
  packed-install tests.
- Pinned `mise.lock`, AST-based production structure checks, and strict
  gh-aw/actionlint workflow policy in the canonical CI gate.
- Guarded upstream compatibility automation: deterministic package
  detection, Grok 4.5/high repair, repository-only App mutation, bounded
  patch and AI-credit budgets, conditional GLM 5.2/xhigh runtime review,
  protected three-OS CI, two-SHA versioning, and trusted npm publishing.

## [0.2.2] — 2026-05-04

### Fixed
- **CI runner Windows support: cancel pipe readers on kill.** The
  v0.2.1 fix used `detached: true` + `process.kill(-pid, SIGKILL)` to
  take whole descendant trees on Unix, which fixed Linux. Windows has
  no process groups, so `sh -c 'sleep 5'` orphaned descendants kept
  the stdout/stderr pipes open even after the shell died, and
  `drainStream` blocked on the pipe read until the orphan exited.
  Refactored to capture each pipe's `ReadableStreamDefaultReader` in a
  `ProcState` so that `killTree` can `reader.cancel()` them after
  killing the process — the drain returns immediately on every
  platform regardless of orphan lifetime. v0.2.1 never reached npm
  (publish workflow held at the CI gate again on Windows). v0.2.2
  ships the same feature set as v0.2.0/v0.2.1 plus the fully
  cross-platform runner kill semantics.

## [0.2.1] — 2026-05-04

### Fixed
- **CI runner: kill the whole process group on timeout / signal abort.**
  On Linux and Windows, `Bun.spawn(["sh", "-c", "sleep 5"])` left the
  child `sleep` orphaned holding the stdout/stderr pipes open, so
  `proc.exited` blocked for the full sleep duration even after
  `proc.kill()` terminated the shell. Tests that asserted `< 2000ms`
  observed `~5000ms` and v0.2.0's CI matrix went red on
  ubuntu-latest / windows-latest. Fix: spawn with `detached: true` on
  Unix so the spawn is its own process-group leader, then SIGKILL the
  negative PID on timeout/abort to take the whole tree. v0.2.0 never
  reached npm — the publish workflow correctly held at the CI gate.
  v0.2.1 ships the same feature set as v0.2.0 plus this fix.

## [0.2.0] — 2026-05-04

### Added
- **Cross-model judge gate on `until_done_complete` (default-on).**
  Every completion claim is verified by an LLM judge before the goal
  transitions to `done`. `until_done_set` requires an explicit choice:
  `judgeModel: { provider, modelId }` (cross-model — recommended; the
  judge is a DIFFERENT model than the executor and the standard fix
  for Ralph-loop oscillation) or `sameModelJudge: true` (same-model
  self-judge with fresh, completion-focused context — use only when no
  second model is available). Setup refuses with `judge_unspecified`
  if neither is provided — there is no silent path past the judge.
- `/until-done judge` slash command — user-side picker for the
  session-default judge mode. `/until-done judge <provider>/<modelId>`
  configures cross-model (recommended), `/until-done judge same`
  configures same-model self-judge, `/until-done judge clear` unsets,
  bare `/until-done judge` shows the current default. Per-goal
  `until_done_set` parameters always win over the user default.
- Judge verdict semantics: strict-JSON `{verdict: "done"|"continue",
  reason}`. `continue` blocks the transition and appends the judge's
  reason as evidence (loop stays active); `done` proceeds and the
  judge's reason is appended too; unparseable or unavailable judge
  fails open with a warning evidence line so judge-infra glitches
  don't block legitimate completion.
- `opensrc` (vercel-labs/opensrc) added as a dev dependency for fetching
  upstream source on demand. Run
  `bun x opensrc fetch github:badlogic/pi-mono` to cache pi-mono's source
  at `~/.opensrc/repos/github.com/badlogic/pi-mono/main`.
- **Upstream Pi auto-update** — two cooperating workflows keep
  `@mariozechner/pi-coding-agent` / `@mariozechner/pi-ai` current with
  zero manual ceremony when the bump is clean, and **zero merges**
  when it isn't:
  - `.github/workflows/upstream-watch.yml` (daily 06:13 UTC + manual
    dispatch) checks npm for new releases, runs `bun update`, runs
    `mise run ci` against the bumped versions, and opens / updates a
    PR `upstream/pi-bump` with `coderabbitai` requested as reviewer
    and the `auto-merge` label.
  - `.github/workflows/upstream-pi-merge-gate.yml` fires on every PR
    review submission and every CI workflow completion. It evaluates
    the latest head SHA against two **explicit gates** — (a) every
    check run on the SHA reports `success`/`skipped` AND at least 3
    checks have completed (the OS matrix), AND (b) the most recent
    review from `coderabbitai[bot]` is `APPROVED` — and squash-merges
    only when both are green on the same SHA. Either gate failing
    keeps the PR open. Re-evaluates on every push, CI completion, and
    review submission so push-fixes converge automatically. Gate
    enforcement lives in workflow source, not in branch-protection
    settings — branch protection is a useful defense-in-depth but
    unnecessary for the gate to work.
  - Prerequisites: `UPSTREAM_PAT` repo secret (PAT with
    `repo`+`workflow` scope so the PR-triggered CI matrix actually
    fires; `GITHUB_TOKEN`-created PRs trigger no downstream
    workflows), and CodeRabbit installed on the repo. See README
    §"Upstream Pi watcher" for full setup notes.

### Changed
- Status-widget shortcut: `Ctrl+G` → **`Ctrl+Shift+G`** to avoid colliding
  with Pi's built-in `app.editor.external` (open in `$VISUAL`/`$EDITOR`).
- Skill/prompt discovery: dropped the `resources_discover` runtime hook
  (which resolved relative paths against the user's cwd, not the
  extension dir, producing a "skill path does not exist" warning).
  Discovery is now declarative via `package.json#pi.skills` and
  `pi.prompts` only.
- Autopilot is now a sticky session toggle (run `/until-done autopilot`
  once; future setups skip the contract-confirmation dialog until you
  toggle again). Previously the toggle was scoped to a setup state that
  was unreachable through normal flow.
- Subcommand parser no longer swallows goal intents that start with a
  subcommand keyword (e.g. `/until-done status report on the migration`
  is now treated as a goal, not as `cmdStatus`).
- CI subprocesses now thread the agent's `ctx.signal` through
  `Bun.spawn`, so user `Esc` aborts in-flight checks instead of letting
  them run to their per-verb timeout.
- Language detection no longer cross-pollutes ambiguous-marker
  languages: `KOTLIN_GRADLE`/`KOTLIN_MAVEN` require a Kotlin signal in
  the build script; `PYTHON_UV` ordered before `PYTHON` so uv-managed
  projects don't fall back to bare `mypy`/`ruff`/`pytest`; `LUAU`
  markers no longer overlap with Roblox-only `default.project.json`/
  `rojo.json`.

### Fixed
- `agent_start` no longer wipes `userMessagedThisTurn` before
  `agent_end` consults it — user-interjects-mid-loop now actually
  yields (README edge case 6).
- `session_before_compact` no longer attempts to mutate
  `event.customInstructions` (no-op against pi-mono — there is no
  `customInstructions` slot in `SessionBeforeCompactResult`). Goal
  context is re-anchored on `session_compact` via a `CustomMessageEntry`
  (LLM-bound, `display:false`) so recent evidence + learnings survive
  the compaction summary.
- Continuation tick no longer sent to the LLM twice. Previously
  `pi.sendMessage` (which produces a `CustomMessageEntry` and DOES go
  to LLM context) and `pi.sendUserMessage` were both called per loop
  iteration with the same text.
- Ask-before list is no longer silently bypassed when there is no
  interactive UI (`!ctx.hasUI` — print/RPC mode). Matching tools are
  blocked with an explanatory refusal.
- `until_done_set` now refuses any status other than `setup`
  (previously accepted `done`/`cleared`/`blocked`, which let the agent
  silently overwrite a locked North Star without re-approval — README
  edge case 22).
- `cmdResume` now allows resuming from `done` with a confirm dialog
  (README edge case 9 — challenge a false `until_done_complete`),
  resets `cleanEndPrompts` so the clean-end nudge can re-fire.
- `until_done_*` meta-tool calls no longer score progress signals,
  closing a hole that let the model satisfy the spin-guard without
  doing real work.
- CI runner `output` truncation marker is now visible (`[output
  truncated; showing last 4000 chars]`) so the LLM knows when output
  was cut.

### Removed
- `prompts/until-done.md` template (was permanently shadowed by the
  `/until-done` extension command — extension commands take precedence
  over prompt templates of the same name).
- `extensions/lib/renderer.ts` (custom renderer for the doubled-up
  continuation-tick message — became dead code with the duplication
  fix).

## [0.1.1] — 2026-05-04

### Added
- pi-config principles injected every turn (bootstrap mandate, performance
  mandate, capability injection + test model, definition of done, working
  style)
- `goalType: ticket | exploratory` and `surfaces[]` on the contract;
  PHASE 0 brainstorm step in setup
- `until_done_distill` tool — compiles the journey into
  `.until-done/distilled.md` after completion
- `/until-done ask <question>` — side question primitive that does not
  preempt the loop
- 18 language profiles for the runtime CI hook (Swift, C++, Kotlin, Lua,
  Luau, Roblox, Python, Go, Rust, Ruby, Elixir, Erlang, Zig, Java, .NET,
  TypeScript bun/pnpm/npm/yarn, Deno) — every CLI invocation routed
  through `mise exec --`
- `verifyCommand` auto-wrapped with `mise exec --` on `until_done_set`
- `mise.toml` with publish tasks (`publish`, `publish:dry`,
  `publish:patch/minor/major`)
- `.gitattributes` forcing LF on Windows checkouts
- `.github/workflows/ci.yml` 3-OS matrix (ubuntu/macos/windows)
- AGENTS.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md,
  CHANGELOG.md, LICENSE, .github/PULL_REQUEST_TEMPLATE.md, ISSUE_TEMPLATE/,
  CODEOWNERS, FUNDING.yml
- 48 tests covering mise routing, every package-manager profile, and
  cross-platform path/discovery neutrality
- Per-developer agent-tool config dirs (`.claude/`, `.cursor/`,
  `.continue/`, `.windsurf/`, `.codex/`, `.cody/`, `.codeium/`, `.aider*`,
  Copilot instructions) added to `.gitignore` — kept local

### Changed
- `HARD_BUDGET_CEILING` raised 200 → **20000** (~333h / ~14 days at 1
  turn/min). New `LARGE_BUDGET_CONFIRM_THRESHOLD = 500` triggers a
  confirm dialog in `/until-done budget <n>` above that. Default
  `maxTurns = 20` unchanged.

### Fixed
- Windows CI failures from CRLF line endings (biome format/lint) — fixed
  via `.gitattributes`
- Windows build failure from inline `bun --print 'import(...)'` quoting
  — moved to `tests/build-smoke.ts`
- npm publish workflow 404 — switched runner to Node 24 (ships npm 11.x
  natively for OIDC trusted publishing); removed `setup-node`'s
  `registry-url` which was injecting a placeholder `NODE_AUTH_TOKEN`
  and fighting the OIDC handshake

## [0.1.0] — 2026-05-04

### Added

- `/until-done <intent>` slash command with PHASE 0 brainstorm interview
  (goalType + surfaces + verifyCommand) before locking the North Star
  contract.
- All 29 Pi hook events addressed with compose-don't-replace semantics.
- 8 tools: `until_done_set`, `until_done_plan`, `until_done_replan`,
  `until_done_task_update`, `until_done_complete`, `until_done_block`,
  `until_done_progress`, `until_done_distill`.
- `/until-done ask <question>` side-question primitive that does not
  preempt the loop.
- `until_done_distill` — after completion, compiles the journey (goal,
  surfaces, learnings, gotchas, replan log) into a PRD-shaped summary at
  `.until-done/distilled.md`.
- Verifiability discipline injected every turn: do not accept proxy
  signals, treat uncertainty as not achieved, quote evidence, cleanup
  before complete.
- Mise-first CLI policy: every shell command routed through `mise run` or
  `mise exec --`. `verifyCommand` auto-wrapped on lock-in.
- CI on stop event: parallel typecheck/lint/format/compile/test/build via
  mise across 18 language profiles (Swift, C++, Kotlin, Lua, Luau,
  Roblox, Python pip+uv, Go, Rust, Ruby, Elixir, Erlang, Zig, Java
  Gradle+Maven, .NET, TypeScript bun/pnpm/npm/yarn, Deno).
- pi-config principles injected every turn: bootstrap mandate, performance
  mandate, capability injection + test model, definition of done, working
  style.
- Structural-constraints rule applied to every language Pi generates
  code in: ≤3 nesting, ≤30 LOC per construct, ≤200 LOC per file.
- `Ctrl+G` keyboard shortcut to toggle the contract widget.
- `--until-done <text>` CLI flag for setting a goal at startup.
- Compaction annotation that grows the thread's signal-to-noise ratio
  with last 6 evidence + last 8 learnings, preserved verbatim.
- AGENTS.md adopting pi-config's contract for this repo.
- `.github/workflows/ci.yml` matching GitHub Agentic Workflow.
- `mise.toml` as sole CI/CD orchestrator.
- Smoke tests in `tests/`.
- LICENSE (MIT), SECURITY.md.

[Unreleased]: https://github.com/srinitude/pi-until-done/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/srinitude/pi-until-done/releases/tag/v0.2.2
[0.2.1]: https://github.com/srinitude/pi-until-done/releases/tag/v0.2.1
[0.2.0]: https://github.com/srinitude/pi-until-done/releases/tag/v0.2.0
[0.1.1]: https://github.com/srinitude/pi-until-done/releases/tag/v0.1.1
[0.1.0]: https://github.com/srinitude/pi-until-done/releases/tag/v0.1.0
