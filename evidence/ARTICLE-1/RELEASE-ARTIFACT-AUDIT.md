# Release and Artifact Audit

Publication copy,2026-10-15, of the September setup/release audit, not a new execution.
Local temporary paths are redacted where present. See [README.md](README.md) for scope and links.
Historical follow-up tasks are not evidence of unfinished implementation; the later case studies
are separately published and retain their own outcomes and limitations.

## Outcome

Rosetta `v3.1.13` provides equivalent full Claude Code and Codex packages, but their archive names are `core-claude` and `core-codex`. The initial concern that full packages were missing was incorrect. The real issue is release identity: the same semantic version and release contain multiple date-stamped generations, and the release workflow force-moves the version tag.

## Claim Taxonomy

### Documented claim

- Plugin delivery is the primary mode and works from local files after installation.
- The `core-claude` and `core-codex` packages are the generated host targets in the evaluated release.
- Deterministic hooks are available in source but shipped plugins are generated with `--deterministic-hooks false`.

Sources:

- [Architecture at the frozen commit](https://github.com/griddynamics/rosetta/blob/35c65a046259700a63b4ba8281f711d34060563b/docs/ARCHITECTURE.md)
- [Installation guide at the frozen commit](https://github.com/griddynamics/rosetta/blob/35c65a046259700a63b4ba8281f711d34060563b/INSTALLATION.md)
- [Release workflow at the frozen commit](https://github.com/griddynamics/rosetta/blob/35c65a046259700a63b4ba8281f711d34060563b/.github/workflows/publish-instructions.yml)

### Observed result

- GitHub release metadata on 2026-09-15 showed four dated generations of several `3.1.13` assets: 2026-08-31, 2026-09-01, 2026-09-02, and 2026-09-15.
- The remote `v3.1.13` tag resolved to `35c65a046259700a63b4ba8281f711d34060563b` at freeze time. The clone's earlier local tag resolved to a different commit, which demonstrates that the tag had moved.
- The selected Claude and Codex ZIPs each contain 369 files and exactly match their plugin trees at commit `35c65a046259700a63b4ba8281f711d34060563b`.
- Both manifests report plugin name `rosetta`, version `3.1.13`, and descriptions that include workflows and guardrails.
- Both archives contain coding flow, HITL, dangerous-action guidance, reviewer, and validator units.
- Both shipped `hooks.json` files register only `SessionStart`; no dangerous-action JavaScript bundle is present in either selected archive.

### Interpretation

- The selected pair is suitable for a matched host probe because the content profile is equivalent and the source commit is shared.
- Reporting only `v3.1.13` would not make the study reproducible. Every article and experiment must cite the exact archive filename, SHA-256, and observed source commit.
- The published experience should call these the full `v3.1.13` Rosetta packages and include their actual `core-*` filenames. Calling them domain-only packages would apply a later packaging model to an earlier release.
- The case study must not claim that the published artifacts provide executable dangerous-action interception. They provide instruction-based guardrails plus session-start context. The hook implementation and tests are design evidence only unless a separately identified hook-enabled build is tested.

## Publication Wording

Use:

> I evaluated the full Rosetta 3.1.13 packages published as `core-claude-3.1.13-2026-09-15.zip` and `core-codex-3.1.13-2026-09-15.zip`, frozen by SHA-256. In this release, `core-*` is the package name for the full generated plugin, not a domain-only subset.

Avoid:

- "The latest 3.1.13 artifact" without a date and hash.
- "Rosetta hooks blocked the action" unless the experiment proves an active registered hook caused the block.
- "The full plugin was missing."

## Follow-up Checks

- Verify the installed package path and active manifest in a throwaway workspace.
- Capture the host transcript showing the selected plugin's `SessionStart` hook fired.
- Record the Claude Code and Codex versions, model identifiers, reasoning settings, permissions, tools, and filesystem/network policy used in each run.
