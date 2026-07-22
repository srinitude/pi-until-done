# Pi 0.81 Lockstep Rewrite Implementation Plan

**Design:** `docs/superpowers/specs/2026-07-22-pi-081-lockstep-rewrite-design.md`

Every production behavior follows RED → GREEN → REFACTOR. Each phase ends with the smallest relevant gate, then `mise run ci` before commit.

## Phase 0: Preserve and normalize the worktree

1. Save the pre-rewrite tracked diff outside the repository and record untracked paths without copying credential-bearing transcripts.
2. Restore tracked production/test/config changes to the committed baseline; retain the approved design and plan.
3. Confirm the baseline state and run its existing gates as evidence, without treating known Node failures as green.
4. Add no production changes in this phase.

## Phase 1: Pi 0.81 and official Node runtime

1. Add a RED package/import test for the `@earendil-works` Pi 0.81 API surface.
2. Migrate package metadata and imports minimally until typecheck reaches behavioral failures.
3. Add RED Node subprocess tests covering success, failure, output, timeout, abort, truncation, and descendant cleanup.
4. Replace Bun process execution with an injected Node process capability.
5. Add a RED Node mise-discovery test and replace Bun task discovery.
6. Add Node package-load and official Pi CLI smoke gates to mise.
7. Refactor only while all new tests remain green.

## Phase 2: Pi-native hooks, state, and completion

1. Add RED tests proving `before_agent_start` composes with prior prompt text.
2. Add RED tests proving automatic continuation runs at `agent_settled`, not `agent_end`.
3. Add RED tests for hidden post-compaction re-anchoring.
4. Add RED branch replay tests for session switching/fork semantics.
5. Add RED migration tests for valid, repeated, and invalid `0.2.x` state.
6. Implement a versioned session-entry repository and pure transitions.
7. Add RED tests for durable judge defaults and autopilot preferences.
8. Add RED judge tests for explicit mode, Pi runtime auth, isolated evidence, strict verdicts, rejection, and infrastructure fail-open evidence.
9. Implement the Pi 0.81 judge adapter without weakening existing load-bearing tests.
10. Run integration goal-flow and structural gates.

## Phase 3: Exact compatibility and package readiness

1. Add RED consistency tests for `compatibility/pi.json`, exact Pi dependency versions, and Node minimum.
2. Add the compatibility metadata and make static gates consume it.
3. Add RED pack-content and clean-install tests.
4. Correct package engines, files, peer/development metadata, README, and changelog.
5. Create `mise.lock` and keep automation solely in `mise.toml`.
6. Add transcript/secret exclusion checks.
7. Run `mise run ci`, `mise run release-ready`, and package dry-run.

## Phase 4: Lockstep workflow foundation

1. Install and pin the official `gh-aw` extension used for compilation.
2. Add RED offline tests for upstream detection, exact-version skew, deduplication, patch validation, immutable contract tests, line/file caps, stale SHA, and merge eligibility.
3. Implement deterministic detector and trusted patch-validator components.
4. Add RED workflow-invariant tests for permissions, secrets, models, reasoning effort, retries, spend limits, network allowlists, and safe outputs.
5. Create the Grok repair Markdown workflow and compile it strictly.
6. Create the read-only Z.AI/OpenCode GLM review workflow and compile it strictly.
7. Replace stale upstream workflows with detector, actuator, matrix gate, and escalation wiring.
8. Verify generated lockfiles have no source drift.

## Phase 5: Release automation and remote controls

1. Add RED tests for the two-SHA release sequence and no-bump-on-red rule.
2. Implement patch-version PR creation and trusted post-green publishing.
3. Configure the repository-only GitHub App with least privilege.
4. Store App ID/key, OpenRouter key, and Z.AI Coding Plan key as repository variable/secrets.
5. Configure OpenRouter $25 monthly limit and workflow $5/version accounting.
6. Enable protected `main`, required checks, and guarded auto-merge with no bypass.
7. Run strict Grok and Z.AI/OpenCode live preflights.

## Phase 6: Remote proof and `0.3.0`

1. Remove the local transcript and prove it is absent from git and package output.
2. Run fresh local `mise run ci` and `mise run release-ready`.
3. Commit and push the rewrite branch; open a PR.
4. Require Linux, macOS, and Windows CI green on the exact repair SHA before merge.
5. Merge the rewrite without changing the package version.
6. Require remote CI green on the resulting `main` SHA.
7. Open a dedicated `0.3.0` version PR and run the full matrix.
8. Merge, then require remote CI green on the new exact `main` SHA.
9. Manually initiate the trusted publish gate; verify npm and GitHub release metadata.
10. Report exact SHAs, workflow runs, package version, and command output as release evidence.
