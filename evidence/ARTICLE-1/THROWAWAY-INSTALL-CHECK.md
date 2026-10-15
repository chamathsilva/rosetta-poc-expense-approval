# Throwaway Session-Load and Bootstrap Check

Publication copy,2026-10-15, of the September setup/release audit, not a new execution.
Local temporary paths are redacted where present. See [README.md](README.md) for scope and links.
Historical follow-up tasks are not evidence of unfinished implementation; the later case studies
are separately published and retain their own outcomes and limitations.

## Purpose

Verify that the two frozen Rosetta packages load on their intended hosts and inject their shipped `SessionStart` context before any seeded case-study repository is touched.

This is a bootstrap check, not a workflow-quality experiment. For Claude Code it uses the supported session-local `--plugin-dir` mechanism, not Rosetta's documented persistent marketplace/install/initialize path. It does not support claims about productivity, correctness, governance effectiveness, or full coding-flow behavior. The documented Claude path is checked separately in `RECOMMENDED-CLAUDE-PATH-CHECK.md`.

## Frozen Inputs

- Date: 2026-09-15
- Rosetta release: `v3.1.13`
- Frozen source commit: `35c65a046259700a63b4ba8281f711d34060563b`
- Claude package: `core-claude-3.1.13-2026-09-15.zip`
- Claude SHA-256: `3fc9f6d10d879dfa5036378fbec1801cc69875b7ffea030f27d69eea6f4d7f1b`
- Codex package: `core-codex-3.1.13-2026-09-15.zip`
- Codex SHA-256: `5266cfdbefcb5c51887eab784c904a993ced1f588661e04aebddbf1b04753d95`

The packages were extracted only into throwaway directories under `<temporary-root>`. None of the three immutable seed repositories was used.

## Claude Code Check

### Environment

- Host: Claude Code `2.1.270`
- Model: `claude-sonnet-5`
- Effort: `medium`
- Plugin source: extracted frozen Claude package loaded with `--plugin-dir`
- Setting sources: project only
- MCP configuration: strict empty configuration
- Session persistence: disabled
- Permission request: `manual`; no permission handler was needed because the prompt prohibited tool use

### Observed Result

- `claude plugin validate` passed on the extracted plugin directory.
- The validator rejected the ZIP itself as an input file, although Claude Code documents `.zip` support for `--plugin-dir`. The experiment therefore uses the extracted directory and treats this as validator input friction, not evidence that the package is invalid.
- Claude Code identified plugin `rosetta`, version `3.1.13`.
- All five registered `SessionStart` hook commands completed successfully: plugin mode, always-on bootstrap, rules index, workflow index, and plugin path.
- The model returned the requested literal bootstrap-check response.
- No model tool call or subagent invocation occurred.
- No Rosetta MCP server was active.

### Limitation

The stream initialization metadata reported permission mode `default` even though `manual` was requested. Because no tool permission was exercised, this check does not establish interactive permission behavior. Every real experiment must record the visible host permission mode and the actual approval events separately.

## Codex Check

### Environment

- Host: Codex CLI `0.148.0-alpha.9`
- Model: `gpt-5.6-terra`
- Reasoning effort: `medium`
- Delivery: frozen Codex package extracted at the throwaway repository root, following Rosetta's documented Codex installation path
- Codex configuration: temporary isolated configuration directory containing only an authentication link
- User configuration and rules: ignored
- Global Codex plugins, apps, and remote-plugin discovery: disabled
- MCP configuration: none
- Hooks: enabled
- Sandbox: read-only
- Hook trust: bypassed for this non-interactive probe only after direct review of the frozen four-command `SessionStart` registry

### Observed Result

- The isolated configuration reported: `No MCP servers configured yet`.
- The model returned the exact path injected by Rosetta's fourth `SessionStart` command: `<disposable-workspace>/.agents`.
- No tool call occurred.
- No unrelated plugin, app, or MCP startup appeared in the accepted run.

Codex JSON output did not emit individual successful hook events. The path response is runtime evidence that the `SessionStart` additional context reached the model; direct inspection of the frozen hook registry identifies the command that supplied it.

### Rejected Contaminated Attempts

Two earlier Codex attempts are excluded from Rosetta evidence:

1. `--ignore-user-config` alone still allowed account/runtime integrations to appear, including a stale `cloudflare-api` OAuth refresh attempt.
2. A temporary Codex configuration removed local MCP entries, but authenticated remote plugin synchronization still restored the unrelated integration.

The accepted run additionally disabled the global `plugins`, `apps`, and `remote_plugin` features. This setup friction is a host-isolation observation, not a Rosetta defect.

## Experiment Baseline Derived from the Check

### Frozen-path Claude Code probes

- Model: `claude-sonnet-5`
- Effort: `medium`
- Permission mode: `manual` in an interactive session
- Rosetta runs: extracted frozen Claude package loaded session-locally with `--plugin-dir`
- Control run: no `--plugin-dir`
- MCP: strict empty configuration
- Chrome, WebFetch, and WebSearch: disabled
- Project dependencies: prepared before the session
- Network limitation: Bash is not placed behind a separate OS-level network deny; prompts do not require network access, and any attempted network use must be recorded as a confound

### Bounded Codex run

- Model: `gpt-5.6-terra`
- Reasoning effort: `medium`
- Approval policy: `on-request`
- Sandbox: `workspace-write`
- Rosetta package: extracted frozen Codex package at the disposable repository root
- Hooks: enabled
- User configuration and rules: ignored
- Global plugins, apps, remote-plugin discovery, MCP servers, and web search: disabled
- Configuration directory: fresh temporary directory with authentication only

Host permission semantics are intentionally recorded, not treated as equivalent. GOV-005 compares one bounded behavior across hosts and must not generalize from the pair.

Primary user-experience case studies use the documented marketplace/install/verify/initialize/restart/explicit-workflow path recorded in `RECOMMENDED-CLAUDE-PATH-CHECK.md`. Results from the two paths must be labeled separately.

## Evidence Classification

| Statement | Classification | Evidence |
|---|---|---|
| Both frozen packages contain a Rosetta manifest and `SessionStart` configuration. | Observed result | Frozen archive inspection and release audit |
| Claude Code executed all five shipped bootstrap commands. | Observed result | Claude Code hook-event stream |
| Codex delivered Rosetta's plugin-path context to the model. | Observed result | Exact path returned without file or tool access |
| The packages implement the full Rosetta coding workflow successfully. | Not yet established | Initialization is now observed separately; coding-flow experiments remain required |
| Host integrations can contaminate a comparison unless explicitly isolated. | Interpretation | Rejected Codex attempts followed by clean rerun |

No time, token, cost, or productivity data from these probes will be published.
