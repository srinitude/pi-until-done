# Pi 0.81 Lockstep Rewrite Design

**Status:** Approved
**Date:** 2026-07-22
**Release target:** `pi-until-done@0.3.0`
**Initial Pi target:** `@earendil-works/pi-*@0.81.1`

## Purpose

Rewrite `pi-until-done` against Pi's official 0.81 extension APIs and Node runtime, then keep it in strict lockstep with new Pi releases through bounded, independently verified repair automation.

The system must preserve developer control of context, keep durable state in Pi session entries, retain the unconditional completion judge, route project commands through mise, and never publish from an unverified SHA.

## Chosen approach

A full boundary-oriented rewrite was selected over:

1. **Compatibility patch:** fastest, but preserves Bun coupling and lifecycle debt.
2. **Incremental adapters:** lower initial risk, but leaves two runtime architectures during migration.
3. **Full rewrite:** selected because it creates explicit capabilities, one Pi-native state model, and testable automation boundaries.

For upstream repair, a split-trust design was selected over a write-enabled agent or a PAT-driven workflow. Models reason in a sandbox without mutation credentials; a repository-only GitHub App validates and applies eligible output.

## Binding decisions

- Pi support is **strict lockstep latest**: each package release supports one exact Pi release.
- Production runs on Node. The initial minimum is Node `22.19.0`, matching Pi 0.81.1.
- Bun may remain a fast development tool but is not a production runtime dependency.
- `0.2.x` session state receives a one-way, history-preserving migration.
- Grok repair model: `x-ai/grok-4.5`, reasoning `high`.
- Grok receives at most three fresh-context attempts per Pi release.
- OpenRouter limits: $5 per Pi release and a $25 provider-side monthly cap.
- GLM reviewer: Z.AI Coding Plan, `glm-5.2`, reasoning `xhigh`, through gh-aw's OpenCode engine.
- GLM is never the primary executor for unknown upstream breakage.
- Runtime-code repairs require a blocking GLM review; metadata-only repairs do not.
- Eligible repair PRs use guarded auto-merge.
- Future compatibility repairs use guarded automatic patch releases.
- The initial `0.3.0` publish remains manually initiated after remote CI is green.

### Existing worktree

The current uncommitted namespace/API migration is preserved as input, not accepted as a correct implementation. Before production work, capture its patch and inventory. Reuse a change only after a new RED test demonstrates the requirement and the change makes that test green. The local transcript is never committed or packed and must be removed before release readiness.

## Runtime architecture

### Composition root

`extensions/until-done.ts` is a small composition root. It constructs adapters from Pi's `ExtensionAPI`, injects them into focused handlers, and registers commands, tools, and hooks. Domain modules do not import process globals, Pi concrete runtime services, or UI implementations.

Abstract capabilities cover:

- session-entry reading and appending;
- process execution and cancellation;
- filesystem reads and artifact exports;
- clock access;
- model lookup, authentication, and inference;
- UI status, widgets, and confirmations.

Each capability is supplied at composition time. Tests use deterministic fakes; production uses Pi and Node adapters.

### State and persistence

The current Pi session branch is the only durable source of truth. State transitions append typed custom entries under `until-done.state`; the data envelope carries an explicit schema version.

The repository reconstructs state by replaying only the active branch returned by Pi's session manager. Session switching, forking, tree navigation, and restart therefore inherit Pi's own branch semantics without a side database.

Durable state includes:

- North Star and lifecycle status;
- plan, task status, evidence, and replan log;
- turn budget and completion facts;
- session judge default and autopilot preference.

Per-event counters may remain ephemeral, but no durable decision may depend on hidden memory that cannot be reconstructed from entries.

`.until-done/tasks.yaml` and `.until-done/distilled.md` are user-visible exports. They are regenerated from session state and are never authoritative inputs.

### Legacy migration

On first load of a branch containing `0.2.x` entries but no `0.3` entry:

1. Replay the recognized legacy event shape into an isolated legacy model.
2. Validate the reconstructed result.
3. Convert it once to the new state envelope.
4. Append a migration entry; never rewrite historical entries.

Repeated loads are idempotent because the new entry marks completion. Invalid legacy state is preserved, transitioned to a safe paused state where possible, and accompanied by actionable recovery instructions. Unknown data is never guessed into an active goal.

### Lifecycle hooks

- `before_agent_start` returns `undefined` unless a goal is active. When active, it appends the North Star reminder to `event.systemPrompt`; it never replaces prior handlers' prompt text.
- `agent_settled` owns automatic continuation because Pi guarantees no retry, compaction retry, or queued follow-up remains. `agent_end` does not trigger continuation.
- `session_compact` appends a hidden `CustomMessageEntry` that re-anchors the goal on the next turn. `session_before_compact` is not used for ineffective custom-instruction mutation.
- Tool and input hooks compose and return `undefined` when uninvolved.
- Headless ask-before policy fails closed.

### Commands and tools

The command router distinguishes exact documented subcommands from free-form setup intent. Existing user-facing command and tool names remain stable unless Pi 0.81 requires a schema correction.

Tool handlers validate input, call pure transitions, append accepted state, and return explicit evidence. They do not mutate shared state before validation succeeds.

The completion path remains binding:

1. Route the configured verification command through `mise exec --` unless it is already a mise command.
2. Run it with timeout, abort, bounded output, and process-tree cleanup.
3. Resolve the required cross-model or fresh-context same-model judge.
4. Show the judge only goal, done criteria, verification command, and cited evidence.
5. Parse strict `{ "verdict": "done" | "continue", "reason": string }` JSON.
6. `continue` blocks completion; `done` permits it.
7. Unavailable or unparseable judge infrastructure follows the existing fail-open contract and appends a warning evidence line.

No judge bypass is introduced.

### Node process execution

The process adapter uses `node:child_process`. It preserves:

- separate stdout/stderr capture;
- deterministic output truncation;
- timeout and `AbortSignal` cancellation;
- non-zero and signal-derived failure reporting;
- Unix process-group termination;
- Windows descendant cleanup through `taskkill.exe /PID <pid> /T /F`, with direct-child termination as a best-effort fallback;
- listener and timer cleanup on every exit path.

No production module references `Bun`, `Bun.spawn`, or Bun-only stream types.

## Strict Pi compatibility contract

The package records one exact compatible Pi version across its direct development and peer metadata. The three host packages must agree:

- `@earendil-works/pi-coding-agent`;
- `@earendil-works/pi-ai`;
- `@earendil-works/pi-tui`.

Version skew blocks automation. A tested older `pi-until-done` release remains available for older Pi installations; the latest extension release does not claim cumulative compatibility.

`compatibility/pi.json` is the canonical machine-readable pair:

```json
{
  "piVersion": "0.81.1",
  "nodeVersion": "22.19.0"
}
```

Static workflows and package-consistency tests read this file. A future Pi Node-minimum change updates data rather than workflow permissions. Mise consumes the matching Node version, and `mise.lock` plus package lockfiles remain the reproducible tool boundary.

`package.json` declares Node rather than Bun as the runtime engine and follows Pi's official package shape.

## Upstream detection and repair

### Detection

A deterministic scheduled and manually dispatchable workflow queries the npm registry. It compares the newest Pi release with compatibility metadata, verifies all required Pi packages exist at that version, and deduplicates by target version. Detection does not invoke a model.

There is one repair branch and at most one repair PR per Pi version.

### Grok repair job

The gh-aw source workflow runs Copilot CLI in BYOK mode against `https://openrouter.ai/api/v1` using repository secret `OPENROUTER_API_KEY`:

- model `x-ai/grok-4.5`;
- reasoning `high`;
- maximum three attempts;
- maximum 16 agent turns per attempt;
- $5 charged-cost ceiling per target version;
- $25 provider-side monthly key limit.

Before and after each attempt, trusted steps sample OpenRouter key usage and retain response-reported cost. Accounting conservatively charges the greater available value, waits for delayed usage settlement before another attempt, and refuses a new attempt without remaining budget. Turn, token, and timeout bounds limit a single in-flight overrun; the provider-side monthly limit is the final hard stop.

The agent receives the target version, upstream API/release evidence, repository contract, current candidate diff, and exact gate failures. Attempts retain the candidate workspace but start with fresh model context. Unknown upstream text is treated as untrusted data, not instructions.

The model receives no GitHub App key, npm credential, publishing credential, or repository-write token.

### Patch policy

Eligible paths are limited to:

- compatibility metadata and Node-version metadata;
- exact Pi dependency metadata and generated lockfiles;
- `extensions/**`;
- ordinary tests needed for API adaptation;
- compatibility-facing README and changelog content.

Forbidden paths include workflows, App/publish configuration, `AGENTS.md`, security policy, mise gate definitions, and immutable compatibility-contract tests.

Static limits are:

- at most 20 changed non-generated files;
- at most 1,500 changed non-generated lines;
- no binary additions or symlink escapes;
- generated lockfiles validated separately;
- no deleted/skipped tests, reduced test count, or mechanically weakened assertions.

Semantic test changes are additionally reviewed when runtime code changes.

### Trusted actuator

A separate trusted job consumes the structured patch artifact. Before minting a token it verifies:

- expected target Pi version and base SHA;
- allowed paths and patch limits;
- no path traversal, symlink escape, binary payload, or workflow mutation;
- immutable contract-test hashes;
- test-count and anti-weakening checks;
- deterministic gates succeeded against the same patch SHA.

Only then does it mint a short-lived token from a GitHub App installed solely on `srinitude/pi-until-done`. Its numeric App ID is repository variable `PI_LOCKSTEP_APP_ID`, its client ID is repository variable `PI_LOCKSTEP_APP_CLIENT_ID`, and its private key is repository secret `PI_LOCKSTEP_APP_PRIVATE_KEY`. The App has repository contents, pull-request, and issue permissions needed for branches and escalation, but no Actions administration, secrets, package publishing, or repository administration permission.

The actuator creates or updates the single draft repair PR. The model never handles the token. Repository settings enable auto-merge and protect `main` with required matrix, contract, and review checks; neither the App nor administrators bypass those checks, and direct pushes to `main` are disallowed.

## Independent verification and merge

The repair SHA must pass the same `mise run ci` contract on Linux, macOS, and Windows. Checks report against the exact branch-head SHA.

Any `extensions/**` change starts a separate read-only gh-aw review using:

- engine `opencode`;
- model `openai/glm-5.2`;
- Z.AI Coding Plan endpoint `https://api.z.ai/api/coding/paas/v4`;
- reasoning `xhigh`;
- repository secret `OPENAI_API_KEY` containing the personal Z.AI Coding Plan key, as required by gh-aw's universal OpenCode provider contract;
- network access limited to required GitHub/AWF and `api.z.ai` endpoints.

OpenCode is used because Z.AI lists it as a supported Coding Plan tool. The Coding Plan key is not routed through Copilot CLI. Pinned gh-aw `0.82.14` incorrectly emits its Copilot proxy as OpenCode's default provider even when `openai/glm-5.2` is selected; the deterministic post-compile patch rewrites both generated OpenCode configs to `awf-proxy/glm-5.2` on the OpenAI proxy, and an invariant test rejects any Copilot fallback. Remove this workaround only after a pinned gh-aw upgrade proves the generated provider correct. The generated OpenCode provider configuration must demonstrably forward `reasoning_effort: xhigh`; silent fallback to a default effort fails preflight. A strict compilation and live tool/structured-output smoke test must pass before auto-merge is enabled.

The reviewer sees the contract, diff, test changes, and CI evidence. It cannot edit, push, approve with a GitHub identity, or access the App key. It emits a strict verdict and findings. Rejection, malformed output, quota exhaustion, or unavailability blocks auto-merge and escalates.

Metadata/lockfile-only changes skip GLM review but still require every deterministic and matrix gate.

Guarded auto-merge requires all checks, review decisions, target version, and PR head to reference the same SHA. Any mismatch fails closed. Three unsuccessful Grok attempts leave sanitized evidence in a draft PR and require human intervention; GLM does not take over the repair.

## Release flow

A repair PR never combines compatibility work with a package version bump.

For future Pi releases:

1. Merge the verified compatibility repair.
2. Require remote CI success on that exact `main` SHA.
3. Have trusted automation open a patch-version PR.
4. Run the complete matrix on the version PR.
5. Guardedly auto-merge it.
6. Require remote CI success on the new exact `main` SHA.
7. Tag, create the GitHub release, and publish with npm provenance through a non-agent trusted publisher.

For `0.3.0`, merge and verify the rewrite first, then create and verify the version PR. The final publish is manually initiated. No version is bumped on a red, unpushed, stale, or non-`main` SHA.

## Error handling

Runtime adapters return structured failures with sanitized evidence. Expected user errors do not throw through Pi's event loop. Cleanup runs in `finally` paths.

Automation fails closed for:

- target-version skew;
- budget or quota exhaustion;
- invalid model output;
- patch-policy violations;
- stale SHA or branch movement;
- App-token failure;
- CI, reviewer, release, or provenance failure.

The sole fail-open behavior is the already approved completion-judge infrastructure fallback, which is visible in goal evidence. A judge verdict of `continue` never fails open.

## Test strategy

Implementation follows strict RED → GREEN → REFACTOR. Production changes require a failing production test first.

### Runtime regression tests

Add failing tests for:

- importing and executing the extension under Node `22.19.0`;
- subprocess success, failure, timeout, abort, truncation, and descendant cleanup;
- mise-task discovery under Node;
- chained system-prompt composition;
- continuation only at `agent_settled`;
- hidden compaction re-anchoring;
- current-branch state replay and idempotent legacy migration;
- invalid legacy-state recovery;
- exact intent routing and headless policy;
- task dependency readiness;
- explicit judge selection, Pi-auth resolution, isolated input, rejection, strict parsing, and infrastructure fail-open evidence.

Existing load-bearing judge tests may be extended but not relaxed.

### Package and platform tests

- Unit and integration tests remain isolated and deterministic.
- Bun may run fast unit tests, but Node-specific smoke and integration gates are mandatory.
- `npm pack` output is inspected for the official Pi package shape and absence of secrets/transcripts.
- The packed artifact is installed into a clean Node environment with the exact Pi release and loaded by the official Pi CLI.
- Linux, macOS, and Windows run the canonical mise suite.
- Structural limits remain nesting depth ≤3, construct ≤30 LOC, and production file ≤200 LOC.

### Workflow tests

Offline tests verify detector deduplication, version skew, patch validation, immutable test hashes, App permissions, stale-SHA rejection, retry limits, cost limits, GLM routing, merge eligibility, and two-SHA release sequencing.

`gh aw compile <workflow> --strict` must succeed, and generated `.lock.yml` files must match their Markdown sources with no drift. Tests inspect generated permissions, network allowlists, safe outputs, model IDs, reasoning settings, and secret isolation.

Paid provider smoke tests are explicit preflight/operational checks, not substitutes for deterministic CI.

## Documentation and observability

README and release notes describe Node as Pi's runtime, the exact supported Pi release, the judge requirement, state migration, automation boundaries, and escalation behavior.

Repair PRs report sanitized attempt counts, model/provider, token and cost totals, target and head SHAs, gate results, and reviewer verdict. They never log prompts containing credentials, API keys, App material, or raw environment dumps.

## Acceptance criteria

The rewrite is ready for the `0.3.0` version PR only when:

- all specified RED tests have been observed failing before their production fixes;
- `mise run ci` and `mise run release-ready` pass locally;
- typecheck and structural constraints pass;
- Node package/load/process smoke tests pass;
- gh-aw strict compilation and workflow invariant tests pass;
- Grok and Z.AI/OpenCode live preflights pass without exposing credentials;
- the Linux/macOS/Windows remote matrix passes on the rewrite SHA;
- the worktree contains no credential or benchmark transcript;
- GitHub App installation and least-privilege permissions are verified.

The version bump and publication then follow the separate remote-green sequence above.

Implementation is sequenced as four gated workstreams: Pi-native runtime, Node/package gates, lockstep repair and review automation, then guarded release automation. A later workstream cannot weaken or bypass an earlier gate.

## Known limitation

No workflow can guarantee repair of every unknown future Pi change. This design bounds model authority, cost, retries, and mutations; independently verifies successful repairs; and fails closed with actionable evidence when automatic convergence is not achieved.
