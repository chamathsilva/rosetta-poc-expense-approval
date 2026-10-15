# Phase 12 (Review Tests) Findings — EXP-003

Date: 2026-10-14. Independent reviewer subagent (claude-sonnet-5, fresh context, no prior-session
knowledge). Scope: Phase 11's 185 tests across 9 files against SPECS/PLAN for coverage, scenario
correctness, and mocking/isolation discipline (not a re-review of `src/`, which was Phase 8's job).

**Process note (added by the orchestrator):** unlike Phase 8, Phase 9, and the P8 Pass 1
documentation review, this report was not originally persisted as a standalone file — only
summarized in `agents/TEMP/EXP-003/coding-flow-state.md` and `plans/EXP-003/HANDOFF.md`. The
Phase 13 validator flagged this inconsistency (not a defect, a process gap) in
`plans/EXP-003/EXP-003-REQUIREMENT-MAP.md` Part 3. This file closes that gap, matching the
pattern of `phase8-review-findings.md`, `phase9-validation-findings.md`, and
`phase8-docs-review-findings.md`.

Preserved verbatim below as received from the subagent. The one Major finding was fixed by the
orchestrator after this review and is noted at the end, not folded into the verbatim text.

---

## TLDR verdict: **approve-with-minor-fixes**

185/185 tests pass under my own independently-run pinned gate (`npm run check`: typecheck + vitest + build, all green — matches the engineer's P7-check.txt exactly). Coverage against SPECS/PLAN is excellent: every S12.3 matrix row, all 8 atomicity fault-injection cases, all 6 restore-window boundaries, the full error catalog, the compile-time `NotPromise` proof, and the P6 baseline migration are present, correctly named, and assert real behavior against the real implementation. I found one Major gap (missing 401-precedence coverage for oversize/unsupported bodies) and a few Minor observations. Nothing masks a real defect; nothing is faked.

## Critical findings
None.

## Major findings

1. **Incomplete 401-precedence coverage (PLAN P7.8).** PLAN P7.8 explicitly requires `tests/errors.test.ts` to cover "401 precedence over malformed/oversize/unsupported bodies" (plural — all three), and SPECS S13 states this as a load-bearing fact ("T1 precedes T2... never 400/413/415"). Only one case exists: `tests/access.test.ts:147` ("401 precedes a malformed body: bad headers + malformed JSON ⇒ 401, not 400"). There is no test asserting 401 (not 413) for an unauthenticated request with an oversize body, nor 401 (not 415) for an unauthenticated request with an unsupported content type. I grepped both `tests/errors.test.ts` and `tests/access.test.ts` for any such case and found none. The behavior is almost certainly correct (the actor hook is a global `onRequest`, which always runs before Fastify's body parser, per `src/actor.ts:24-29`), but it is an explicitly named required test that was not written. Recommend adding the two missing cases before sign-off, or recording the omission as a disclosed, justified deviation if the author accepts the architectural argument as sufficient.

## Minor findings

1. `tests/audit.test.ts:404-422` ("F-I specifically proves...") duplicates the F-I/create case already covered in the parameterized loop at `tests/audit.test.ts:265-308`. Harmless (belt-and-suspenders), not a gap, but adds a slightly redundant test — no action needed.
2. `tests/audit.test.ts:147-161` ("zero audit events on a denial") exercises only one denial type (employee decide ⇒ FORBIDDEN_ROLE). SPECS S9 says audit is zero for denials across T4-T8 broadly; this is a representative sample, not exhaustive, but the T4-T8 denial paths are independently audit-count-checked elsewhere (`access.test.ts`'s "unchanged" assertions, `lifecycle.test.ts`'s state-check denials), so overall coverage is adequate — flagging only because a reviewer should confirm this was an intentional sampling choice, not an oversight.
3. `tests/access.test.ts:361-373` asserts a 414 (not 400) for a 101-char `expenseId` param, attributing it to find-my-way's router-level `maxParamLength`. This is empirically true (test passes) and well-commented, but it is a framework-internal detail rather than a SPECS-declared contract; acceptable as documented, observed behavior, not a defect.

## Per-numbered-item disposition

1. **S12.3 required test matrix — PASS.** All 13 rows present with SPECS-exact names, verified against `plans/EXP-003/EXP-003-SPECS.md` S12.3 table line by line (rows 1–9, 11 are verbatim in `tests/lifecycle.test.ts`; row 10 is disclosed-split into 10a/10b, both halves independently covering create-retry-conflict and decision-retry-conflict, matching the PLAN's own note "(create and decision)"; rows 12–13 are in `tests/access.test.ts:638,652` with `matrix #12`/`matrix #13` labels). The two m6 additions (cross-tenant restore, cross-tenant decision replay) are present at `tests/access.test.ts:679,707`.

2. **S12.2 test data completeness — PASS.** Bad headers (6/6), bad keys (4/4), bad bodies (malformed JSON, empty-JSON DELETE/restore, oversize, unsupported type, unknown field, employeeId/amountCents/currency invalid, charset-mismatch employeeId/reviewerId) and bad ids (101-char, whitespace-only) are all exercised in `tests/access.test.ts`. No-echo sentinel test at `tests/access.test.ts:400-433` checks header values, idempotency key, and body values, and separately confirms unknown-key-NAME is exempt per m7 — exactly matching SPECS S12.2's carve-out.

3. **Atomicity fault injection (S12.1/M1/m5) — PASS.** All 8 cases ({F-A,F-I}×{create,decide,delete,restore}) in `tests/audit.test.ts:212-402`, each asserting 500, unchanged expense snapshot, unchanged audit count, absent idempotency record, and a successful recovery retry with exactly one new audit event. Triggers are created via `installFault()` as plain `CREATE TRIGGER` (not TEMP) through a second `DatabaseSync` connection opened on a real temp-file path (`createTempDatabasePath()` + `openReader()`), satisfying S12.1's PERSISTENT-trigger-via-second-connection requirement. Confirmed via grep: no `TEMP TRIGGER` anywhere in tests/.

4. **Restore window boundary tests — PASS.** All 6 cases present twice (unit in `tests/policy.test.ts:321-366` for `isRestoreWindowOpen`, integration in `tests/lifecycle.test.ts` items #3 and #6): -1ms throws, 0 open, 30d-1ms open, exactly-30d closed, 30d+1ms closed, unparsable-clock throws. The service-level surfacing of the throw as 500 is separately tested at `tests/lifecycle.test.ts:465-486`.

5. **Isolation and mocking discipline — PASS.** Grep for `vi.mock|vi.spyOn|vi.fn|jest\.|sinon` across all of `tests/` returned zero hits. All tests use real `node:sqlite` (temp files or `:memory:`) and real Fastify `inject()`. The only "fakes" are the clock (`createMutableClock`/`createAutoAdvancingClock`) and id factory (`createIdFactory`) — both legitimate injected dependencies per SPECS S5.5/NFR-1, not internal implementation mocks.

5b. **Test independence/idempotency — PASS.** `tests/support.ts:104-160` (`createTestRegistry`) centralizes `afterEach` cleanup: closes readers, closes apps, and `rm`s temp directories, all via `splice(0)` so repeated calls across test files don't double-clean or leak state. Each test file calls `createTestRegistry()` once at module scope and gets its own closures, avoiding cross-file shared mutable state.

6. **Audit payload exactness (S9) — PASS.** `tests/audit.test.ts:54-122` asserts exact payloads for all 4 event types: `{amountCents,currency}` for SUBMITTED, `{status:"APPROVED"|"REJECTED"}` for decide, `{}` for DELETED/RESTORED — matching SPECS S9's table exactly, not just "an event exists."

7. **Idempotency replay correctness (S10) — PASS.** Replay tests (`tests/lifecycle.test.ts` #1–#3) assert byte-identical JSON (`toEqual`) and zero new audit rows. Conflict tests (#10a/#10b) use genuinely different canonical payloads (different `amountCents`, different `status`), not canonically-equal variations. `tests/fingerprint.test.ts:113-125` separately proves key-order-only changes are canonically equal (not a false-conflict), confirming the conflict tests are testing real differences.

8. **Type-level NotPromise test (S5.4/m12) — PASS.** `tests/sqlite-runtime.test.ts:313-339` uses `@ts-expect-error` on `withTransaction(database, asyncWork)` and the mixed-type variant, checked by `tsc -p tsconfig.test.json --noEmit` (confirmed part of `npm run typecheck`, which passed). The "throwing callback" type-only case (`tests/sqlite-runtime.test.ts:301-311`) uses `undefined as unknown as () => number` and is never invoked — confirmed by reading the test body; no live `withTransaction` call is made with a rejected-shape callback anywhere in the suite.

9. **P6 baseline migration correctness — PASS.** Compared `plans/EXP-003/evidence/P6-baseline-before.txt` (genuine, showing 5× `expected 401 to be 2xx/4xx` failures from running the unmodified seed test against the new actor-gated implementation) against `plans/EXP-003/evidence/P6-baseline-edits.md`'s claims — they match exactly, and the 6 migrated tests in `tests/app.test.ts` match PLAN P6.2's table (names, added headers/keys, expected body additions) verbatim, including the deliberate rename of test 6.

10. **Gate result — PASS.** I independently ran `npm run check` under the pin; output: `Test Files 9 passed (9)`, `Tests 185 passed (185)`, clean typecheck, clean build — identical to the engineer's `plans/EXP-003/evidence/P7-check.txt`.

11. **Scope/history discipline — PASS.** `git diff --stat src/` shows only the 5 files SPECS S15 lists as "Changed" (`app.ts`, `database.ts`, `domain.ts`, `expense-repository.ts`, `schemas.ts`), plus the untracked new files SPECS S15 lists as "New" — consistent with Phase 7 implementation scope, not Phase-11 test-authoring scope. Grep confirms `agents/TEMP/EXP-003/sqlite-runtime-probe.mjs` is mentioned only in doc comments inside `tests/sqlite-runtime.test.ts` (explaining it is NOT reused), never imported.

12. **Weak/over-specific assertions — PARTIAL.** See Minor findings 1–3 above. No instance found of a test that "just checks status code, not body" for anything load-bearing — the suite consistently asserts error codes and, for audit/idempotency, exact payloads/rows.

## Recommendation (as originally given)
Approve for Phase 13, with one recommended fix before final sign-off: add the two missing 401-precedence cases (oversize body, unsupported content-type) to `tests/errors.test.ts` or `tests/access.test.ts`, per PLAN P7.8's explicit requirement. This is a small, mechanical addition (pattern already exists at `tests/access.test.ts:147`) and does not block everything else, which is in excellent shape.

---

## Orchestrator fix (2026-10-14, applied after this review, re-verified)

The Major finding was fixed: two tests added directly to `tests/access.test.ts` ("401 precedes an
oversize body..." and "401 precedes an unsupported content type...", mirroring the existing
pattern and the 413/415 test bodies). Full gate re-run clean: **187/187 passing** (185 + 2),
typecheck/build clean; `plans/EXP-003/evidence/P7-check.txt` regenerated. The 3 Minor findings
were accepted as-is (no action needed) — see rationale inline above.
