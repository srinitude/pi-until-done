# Security policy

## Reporting a vulnerability

Report security issues privately rather than opening a public issue.

- Email: kiren@fantasymetals.com
- Subject: `[security] pi-until-done — <short description>`
- Expected initial response: within 7 days

Include the `pi-until-done`, exact Pi, Node, and mise versions; a minimal reproduction; likely impact; and redacted logs or session entries. Never send API keys or unredacted credentials.

## Runtime threat model

`/until-done` is a continuation-loop extension with model and subprocess authority already granted through Pi. It adds these behaviors:

- typed goal events appended to the active Pi session branch;
- a composed North Star reminder in `before_agent_start`;
- automatic continuation only after `agent_settled`;
- verification routed through `mise` and Node subprocesses;
- an LLM judge request before every completion transition;
- optional `.until-done/tasks.yaml` and `.until-done/distilled.md` exports.

The judge sees the goal, done criteria, verification command, and executor-cited evidence. Cross-model judging is recommended; same-model judging requires explicit opt-in. A `continue` verdict blocks completion. Unparseable or unavailable judge infrastructure fails open only with a visible warning evidence entry. There is no no-judge setup mode.

The extension does not replace the system prompt, disable active tools, maintain a side database, emit telemetry, auto-update itself, or read credentials directly. Judge traffic is sent by Pi's configured model provider through Pi's model runtime.

## Authorization boundaries

- `askBefore[]` causes matching shell invocations to require interactive confirmation.
- Goal, done criteria, verification command, and ask-before rules are locked after `until_done_set`; replanning cannot change them.
- Turn budgets have a hard ceiling, while pause, block, spin, user-input, and verification gates remain independent.
- Invalid legacy state is preserved and paused instead of guessed or silently discarded.
- Tools unavailable in the user's Pi configuration remain unavailable to the extension.

Prompt injection remains possible when an executor reads untrusted files, pages, logs, or API responses. Treat all such content as data, retain the locked North Star, and require literal verification evidence rather than proxy signals.

## Upstream repair automation

Compatibility automation separates reasoning from mutation:

- Grok and GLM run in sandboxed gh-aw jobs without repository, npm, or publishing credentials.
- A repository-only GitHub App can apply only bounded safe-output patches.
- Workflow, security, App, mise-gate, and immutable contract-test paths are excluded.
- Runtime patches require independent GLM review plus exact-head Linux, macOS, and Windows CI.
- Patch size, AI-credit spend, protected branch rules, and two-SHA release sequencing fail closed.
- npm publishing uses GitHub OIDC trusted publishing and provenance; models cannot publish.

Compiler-generated workflows and action/container references are pinned and checked by `mise run workflows`. Two documented gh-aw v0.82.14 generator defects are patched deterministically before actionlint; remove those workarounds when a pinned compiler release fixes them.

## Supported versions

Support is strict lockstep rather than a floating range. `pi-until-done@0.3.0` supports `@earendil-works/pi-{coding-agent,ai,tui}@0.81.1` on Node `>=22.19.0`. Older package releases remain available for their corresponding Pi release. See [`compatibility/pi.json`](compatibility/pi.json).
