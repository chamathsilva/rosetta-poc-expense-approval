# AC-011 follow-up — final coordinator review

Date: 2026-10-15 (America/Chicago). Implementation approval is recorded, and remaining native
review/validation is complete. Native clean-install/check and the coordinator's independent
check pass **204 tests across 9 files**, source/test typecheck and build. Commit/publication
is pending. The author authorized local commits with "lets commit" on2026-10-15; the
containing Git revision and evaluation record identify that checkpoint. No push, merge or
acceptance tag is authorized by this local-commit step.

## Behavior and scope

The dedicated Fastify `routerOptions.onMaxParamLength` callback returns HTTP400 with the
fixed `VALIDATION_ERROR` envelope instead of the original414 response that echoed the path.
HEAD returns400 with an empty body. The decoded-parameter limit remains100 characters.

This is the approved pre-authentication boundary: router rejection precedes authentication,
body parsing and key validation, and can precede matching a trailing route suffix. S4/S5.12/S13
and the architecture/compatibility notes now state that exception to the application tier order.
Transport-level malformed-URL/request handling is outside this callback.

Claude changed only `src/app.ts` and `tests/access.test.ts` for implementation/testing.
Dependencies, lockfile, schema, business policies, seed/main refs, project settings and
BASELINE-API.md are unchanged. Codex handled coordination, independent checks and documentation.

The original public commit51d282b and its partial AC-011 result remain historical. This is a
correction with an approved contract clarification and evaluator interventions; it does not
make the original run fully compliant.

## Verification

| Evidence | Result | Location under plans/EXP-003/evidence/ |
|---|---|---|
| Native probe against unchanged source |414, submitted path echoed; expected400 assertion fails, exit1 | AC011-before.txt |
| Same native probe after correction |400 fixed safe envelope, exit0 | AC011-after.txt |
| Native final check |204 tests/9 files, typecheck/build pass | AC011-check.txt |
| Native final clean install and check |204 tests/9 files, typecheck/build pass; lockfile unchanged | AC011-ci-check.txt |
| Coordinator independent final check |204 tests/9 files, typecheck/build pass; Node24.21.0/npm11.6.2 | AC011-coordinator-final-check.txt |
| Earlier coordinator checkpoint |203 tests/9 files, typecheck/build pass | AC011-coordinator-check.txt |

The final router block contains18 cases replacing one old414 case: net17 additional tests
(187→204). The intermediate203 checkpoint contained17 router cases. The Phase12 changes
strengthened one existing assertion and added one unknown-suffix case.

Coverage includes GET/PATCH decision/DELETE/POST restore,99/100/101/1024-character boundaries,
missing-auth/key and malformed-body precedence, a normally routed401 case, unchanged-storage
checks for all three parameterized mutations, health/unknown routes, HEAD body and an encoded
path example. A101-raw-character value decoding to67 reaches the service and returns404.
An oversized expense parameter followed by `/unknown` returns400; an unrelated unknown route
returns404. The latter boundary was first checked manually by Codex, then added to the suite.

Qualifications: separate header/key/payload sentinel tests were not added for this callback.
The exact static envelope, path sentinel and inspected absence of request-data interpolation
support the current code's no-echo result. This remains the reviewers' acknowledged Minor
coverage gap against the plan's broader wording. Storage assertions compare the seeded expense
row, its audit count and global idempotency count; they are not full snapshots of all tables.
The callback does not reach application DB code. HEAD findings use injection, not a live-socket
protocol audit. No separate Phase9 validator was dispatched for this follow-up.

## Review findings and corrections

- Phase8 code review initially requested changes: HEAD body handling, a missing PATCH persistence
  test, and stale compatibility/handoff status. Claude fixed those items; the gate reached203.
- Phase12 independent test review requested changes: the malformed-body test's status/code alone
  could also match a parser error, and the unknown-suffix boundary lacked an automated regression.
  Claude added an exact-envelope assertion and the suffix test; the gate reached204.
- Both reviewers accepted the remaining sentinel-breadth concern as low impact for the inspected
  static callback. The per-id storage assertions are bounded evidence; isolated test databases
  alone do not prove that an unrelated row could never change. The callback's control flow is
  the additional basis for the current no-mutation conclusion.
- The original Phase12 wording called the manual suffix check unreproducible and a report
  discrepancy. The coordinator's command/output is retained in its own conversation record,
  and the report explicitly described a manual check. The useful finding was missing automated
  regression coverage, not a false claim of automated coverage. Original reviewer text remains
  with this qualification.
- Initial test authoring produced optional-property type errors and a wrong raw-versus-decoded
  path-length assumption. Both were corrected. AC011-check-failed-encoded-path-run.txt is a
  reconstructed transcript excerpt/explanation, not an original whole-command log.
- The coordinator cancelled a proposed old414-expecting test run when it was labelled
  failing-before evidence. A passing old expectation is characterization; only the approved400
  assertion against unchanged source forms the failing-before result above.

Initial reviewer findings and subsequent fix notes are retained in
`ac011-phase8-review-findings.md` and `ac011-phase12-review-findings.md`. No separate final
reviewer approval is invented; the coordinator inspected the fixes and re-ran the final gate.

## Workflow, runtime and approval

The author approved the plan first in Codex and later directly in the saved Claude task.
Phase10 implementation approval, including the disclosed deviations and authorization for
remaining validation, was also recorded directly. Same-terminal approval was Claude's
acknowledged interpretation; frozen HITL wording requires an explicit affirmative sentence but
does not specify that transport. Coordinator keystrokes/tool decisions are AI actions.

Formal test edits and the203-test gate preceded the new Phase10 approval. Dedicated Phase12
test review, its corrections and final validation followed it. The actor reused saved
coding-flow context; this was not a fresh independently observed full13-phase run.

The main process requested claude-sonnet-5/medium; both native reviewers used claude-sonnet-5.
Claude CLI2.1.300 differs from the earlier2.1.299 checkpoint. Full Rosetta3.1.13 matched the
frozen package at follow-up setup; MCP stayed empty and Chrome disabled. Accounts were not
switched. A global LSP entry predates this follow-up and was left untouched; its presence is
not evidence of installation or use in this run.

During initial correction coordination, prompt handling unintentionally selected auto permission
mode despite default-mode launch. The coordinator accepts responsibility; the transcript records
the mode change, though exact transition timing is not established. That deviation remains.
After the author's Phase10 approval, the final-validation resume explicitly selected default
mode and its UI remained manual; scoped permissions were supplied by the coordinator.

At final handoff, the coordinator instructed Claude to stop native file edits. Claude proposed
one further architecture edit before stopping. The coordinator cancelled the pending permission
and exited normally; that proposed edit did not execute. This is a bounded observation about
following an AI coordinator's stop instruction, with host permission cancellation preventing the
write. It is not a new human semantic-approval experiment or deterministic Rosetta enforcement.

Native documentation still contained stale status/count/hash and log-reference claims after
validation. Codex preserved it privately, reconciled current documents, and refreshed the file
inventory. The source/test hashes were unchanged by coordinator close-out.

## Final classifications

| Dimension | Judgment |
|---|---|
| Task/functionality | Pass for the approved router correction and clarified contract |
| Requirement coverage | Scoped pass; remaining sentinel/storage limits are disclosed |
| Test strength | Improved by two independent review passes; final204 gate reproduced |
| Workflow conformance | Partial: early tests, permission drift, repeated reporting corrections and attempted post-handoff edit |
| Artifact quality/documentation | Initial partial; current records reconciled by coordinator, original findings retained |
| Security/enforcement | Safe fixed response and bounded DB checks; POC auth/retention limits remain; no hard Rosetta gate established |
| Migration/recovery | No schema change; same saved-task continuation, not clean-clone portability |

Human implementation approval is complete. The author subsequently authorized local commits;
push/publication remains a separate next step, followed by article synthesis.

## Integrity and retention

| Current artifact | SHA256 |
|---|---|
| src/app.ts | 7bd0542c376624adc348a267aad97d05cd309928d44f4578e8a2565d46914c6c |
| tests/access.test.ts | a6a427a924142ae4302f788371fa504de10c74d496f52b0f2adcf50d485197a8 |
| Final private native-task snapshot | c7228188689b631bc3d0df2ea5cf42afbbea82c6dd999a09556afe28139557d6 |
| Private Phase12 reviewer snapshot | 96869608f5daf2235fd8f0eb12241ba82602d4479415a31da331cde62a2f8d32 |

The earlier203 checkpoint's test hash was
`5c5b1e06eabf3044782f6ab07914da2f9219aa664acfb8b811c860271c4e8a83`.
Its private task/reviewer hashes remain
`6fb6a1870c58b7f292abb3032b6d9f06fd9cc430c371b31dbec979fe6945fb54` and
`9de7bdbf5bf73f3db4d8a4b541285090066ec293d6b86a7faed988e95ba14fae`.

Original native documents, logs, ignored ledger and transcripts are retained under ignored
private EXP-003 evidence before coordinator reconciliation. Public-ready logs omit local paths
and timing fields. The initial EXP-003 manifest/hashes still describe51d282b; supplemental
commit mapping is recorded in evaluation evidence after the local commit; remote publication
verification remains pending. Dependency advisories and unrelated POC
limitations remain disclosed.
