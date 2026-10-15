# AC-011 follow-up supplemental manifest — publication pending

Date: 2026-10-15. Target: `chamathsilva/rosetta-poc-expense-approval`.
Existing branch: `experiment/EXP-003`. Parent/original published checkpoint:
`51d282b7879d01c771e6b56401005b5b7978e374`.
Follow-up commit: the Git revision containing this manifest; its exact SHA is recorded in the
evaluation repository after commit. Remote publication/verification remains pending.
No new tag, main update, merge or PR.

This is one bounded corrective follow-up, not a new experiment or replacement for the initial
partial AC-011 result. Human plan/implementation approvals are recorded; remaining validation
is complete. The author authorized local commits on2026-10-15; pushing remains a separate
step. Do not mark this manifest published yet.

## Runtime and execution

Existing saved Claude task, full Rosetta3.1.13 at project scope, Sonnet5/medium, pinned
Node24.21.0/npm11.6.2, strict empty MCP and Chrome disabled. Host CLI2.1.300 differs from the
prior2.1.299 checkpoint. Initial correction coordination accidentally switched to auto mode;
the later final-validation resume explicitly used default/manual mode. Accounts were not
switched. This is a qualified follow-up, not an unchanged-runtime conformance result.

## Public artifacts

- Code/test correction in app.ts/access.test.ts; current specs, compatibility, architecture,
  README, implementation summary and generated file index.
- Follow-up plan/report, original Phase8/12 reviewer wording with later fix notes/qualifications.
- Sanitized red/green probe logs, current204 native check/clean-install logs, current204
  coordinator check and intermediate203 coordinator check. The reconstructed failed-test
  excerpt is labelled as reconstructed rather than original command output.

| Artifact | SHA256 |
|---|---|
| src/app.ts | 7bd0542c376624adc348a267aad97d05cd309928d44f4578e8a2565d46914c6c |
| tests/access.test.ts | a6a427a924142ae4302f788371fa504de10c74d496f52b0f2adcf50d485197a8 |
| AC-011-FOLLOWUP-REPORT.md | 9722d509e900a4609c82843d1afebddda5689aab7dcbd511293fb5df8d2f3726 |
| evidence/AC011-check.txt | 554bf09ef0fe1ab16efd83d8e7b6dfd8118829c5140cf8ed8e0933e4b60dea09 |
| evidence/AC011-ci-check.txt | 996454fbcaba66ab4e0da5b0a693de27fbce1ff1d1cd4878a1fd6f3993631eb1 |
| evidence/AC011-coordinator-final-check.txt | f01be806d8c08dfa8b57818e3cee01f1ecbd73e63e7661074557fa528cc07f77 |

Code paths above are repository-relative; other paths are relative to `plans/EXP-003/`.
Verification: native clean install/check and coordinator check pass204 tests/9 files,
typecheck/build. Source/test hashes match the independently tested tree after metadata edits.
Three dependency advisories remain:2 moderate,1 high; frozen dependencies were not changed.

## Private and excluded artifacts

Pre-reconciliation native plan/report/handoff/ledger/logs, final source/test/probe copies,
and full native/reviewer transcripts are retained in ignored private coordination evidence.
Final native-task snapshot SHA256:
`c7228188689b631bc3d0df2ea5cf42afbbea82c6dd999a09556afe28139557d6`.
Phase12 reviewer snapshot SHA256:
`96869608f5daf2235fd8f0eb12241ba82602d4479415a31da331cde62a2f8d32`.
Earlier203 snapshots and hashes remain documented in the follow-up report.

Public copies replace local checkout/toolchain paths and omit timing fields. Original logs
remain private. No product/test code was sanitized or improved by Codex. Runtime databases,
dependencies/build outputs, caches, account details and unrelated data are excluded.

## Remaining publication checks

Chamath author/committer and active GitHub identity were verified for the local-commit step.
The coordinator records the resulting exact SHA and private verified bundle in evaluation
evidence. Before pushing, reconfirm the publication decision/identity; push the correction
normally and record remote verification. Keep expense seed/main refs and original manifests
fixed. This manifest's containing revision identifies the local code checkpoint without a
self-referential embedded commit hash.

Passing the correction does not remove the original workflow, artifact-quality and runtime
findings. This POC remains header-auth simulation with the other documented limitations.
