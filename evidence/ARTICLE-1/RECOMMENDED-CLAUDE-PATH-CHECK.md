# Recommended Claude Code Path Check

Publication copy,2026-10-15, of the September setup/release audit, not a new execution.
Local temporary paths are redacted where present. See [README.md](README.md) for scope and links.
Historical follow-up tasks are not evidence of unfinished implementation; the later case studies
are separately published and retain their own outcomes and limitations.

## Purpose

Verify Rosetta's documented Claude Code operating path in a disposable repository: marketplace installation, verification, one-time workspace initialization, initialization review, required fresh-session handoff, and explicit slash-workflow availability.

This is setup and runtime evidence. It does not establish productivity, universal workflow quality, or deterministic governance.

## Environment

- Date: 2026-09-16
- Repository: fresh disposable clone of `rosetta-poc-expense-approval`
- Starting commit: `34f08e4e5d5d3a0fd4df587f1efdf8dc1c9c2536` (`expense-seed-v1`)
- Branch: `experiment/GOV-002B`
- Host during installation verification: Claude Code `2.1.270`
- Host during initialization and the following fresh session: Claude Code `2.1.273`
- Model: `claude-sonnet-5`, effort `medium`
- Settings: project source only; strict empty MCP configuration
- Git author and committer: `Chamath Silva <mbckchamathsilva@gmail.com>`
- Public repository URL supplied during initialization: `https://github.com/chamathsilva/rosetta-poc-expense-approval`

The host-version change occurred during the setup window and is recorded as a confound. It is not attributed to Rosetta.

## Marketplace Installation

The Rosetta marketplace had already been registered in the evaluator's Claude Code configuration. Installation itself was run fresh from the disposable project:

```text
claude plugin install rosetta@rosetta --scope project --json
```

Observed result:

- installation succeeded;
- `.claude/settings.json` enabled only `rosetta@rosetta` for the project;
- the marketplace resolved Rosetta version `3.1.13`;
- the installed manifest reported the full `rosetta` plugin, its skills and agents, and one `SessionStart` hook group;
- no Rosetta MCP or LSP server was part of this plugin.

Marketplace resolution is mutable, so version `3.1.13` alone is not treated as a durable artifact identity.

### Registration boundary

First-time marketplace registration was not observed in this check. The evidence supports project-scoped installation from an already registered Rosetta marketplace, not the complete first-time registration experience. Before Article 1 publication, either perform one isolated fresh-configuration registration check or preserve this statement as an explicit limitation.

## Runtime Identity Check

The resolved marketplace cache was compared with the frozen Claude artifact `core-claude-3.1.13-2026-09-15.zip`, SHA-256 `3fc9f6d10d879dfa5036378fbec1801cc69875b7ffea030f27d69eea6f4d7f1b`, derived from source commit `35c65a046259700a63b4ba8281f711d34060563b`.

Observed result:

- `.claude-plugin/plugin.json`, `hooks/hooks.json`, `skills/dangerous-actions/SKILL.md`, and `skills/hitl/SKILL.md` were byte-identical;
- excluding generated `skills/*/README.md` files and the cache-use marker, the compared trees had no differences;
- the shipped hook posture remained `SessionStart` only.

This supports using the frozen artifact as the implementation reference for the marketplace-resolved runtime in this check, while still recording the marketplace path separately.

## Verification Prompt

Rosetta's documented verification prompt, `What can you do, Rosetta?`, was run with project settings and no MCP servers. The response described the available Rosetta workflows and stated that risky or irreversible actions require confirmation. No target-repository file changed.

## Initialization

The documented initialization request was then run interactively:

> Initialize this repository using the respective Rosetta workflow

Observed result:

- Rosetta selected `init-workspace-flow` and completed all nine phases;
- it discovered the repository, generated technical context and pattern documentation, asked targeted questions, and ran a reviewer verification phase;
- the reviewer corrected missing self-definition headers in two generated documents;
- the workflow explicitly warned that the initialization session was polluted with scaffolding and required a fresh chat for subsequent work;
- initialization generated project settings, `gain.json`, context, architecture, dependency, code-map, assumption, TODO, pattern, implementation, memory, and workflow-state artifacts;
- no product source file changed.

After locked dependencies were installed, `npm run check` passed: typecheck, all six tests, and build. The initialized state was frozen locally as commit `6b50d775fd1df7ad0f9cfb4bc3f52c92b957a06d`, with Chamath as both author and committer. That local experimental commit was not pushed to the public seed branch.

## Setup Friction

- The initialization questionnaire first captured the literal choice label `Provide URL` rather than opening a text field. The real SCM and issue-tracker URLs were supplied in the next normal response and written correctly to `gain.json`.
- A generated repository-local code-map script triggered Claude Code's shell heuristic. The first combined execution was not accepted; the script was inspected, syntax-checked, and then approved once for execution.
- Initialization is substantial even for a deliberately small seed repository. The case study should assess whether the resulting artifacts remain useful rather than treating artifact volume as value by itself.

## Evidence Classification

| Statement | Classification | Evidence |
|---|---|---|
| Project-scoped marketplace installation works for the evaluated repository. | Observed result | Successful install and project settings |
| First-time marketplace registration works as documented. | Not observed | Marketplace registration pre-existed this check |
| The resolved runtime corresponded to the frozen v3.1.13 implementation for non-README runtime files. | Observed result | Tree and critical-file comparison |
| Initialization creates durable project context and state. | Observed result | Generated artifacts and completed state file |
| Initialization requires a new session before coding work. | Documented instruction and observed result | Final initialization output |
| Generated context improves later work. | Not established by setup alone | Requires case-study and recovery experiments |

No time, token, cost, or productivity data is retained for publication.
