# EXP-003 Implementation Plan (HOW)

Status: Phase 4 draft, revised after the Phase 5 review (`plans/EXP-003/phase5-review-findings.md`) and the evaluator plan-reconciliation (`plans/EXP-003/evaluator-plan-review.md`), still awaiting Phase 6 HITL — no approval of this document exists yet. WHAT lives in `plans/EXP-003/EXP-003-SPECS.md` (`S<n>` anchors). This file names steps, files, order, gates. It does not repeat contracts.

Phase/step mapping (explicit, per evaluator-plan-review.md items 2–3 — do not infer phase boundaries from step numbers alone):
- **Phase 7 (Implementation)**: P0 (pinned mechanical probe, ignored/skipped — not a counted test), P1–P5 (all `src/` changes). Ends with a build check and manual implementation validation (`npm run typecheck`/build, plus hand-driven `inject` calls) — **not** a green full automated suite, since writing/running the feature and baseline test suites is Phase 11 work (TDD was not requested).
- **Phase 8 (Review Code)**: reviewer subagent inspects the Phase 7 diff. The P8 documentation steps below are drafted once, at the end of Phase 7, so the reviewer sees docs that describe the implementation as built — then updated again after Phase 11.
- **Phase 9 (Impl Validation)** / **Phase 10 (User Review Impl, HITL)**: unchanged from the workflow; no plan steps of their own.
- **Phase 11 (Tests, after Phase10 author approval)**: P6 baseline migration and P7 formal tests,
  including newly authored smoke/type tests. No skipped test file is created in Phase7.
- **Phase 12 (Review Tests)**: reviewer subagent; no plan steps of its own.
- **Phase 13 (Final Validation)**: P9 — clean-install gate, requirement map, and the P8 documentation steps' test-count/evidence update pass.
Single sequential session chain. A `HANDOFF.md` is required for this single-session plan per the loaded `planning` skill and evaluator-plan-review.md item 4; see `plans/EXP-003/HANDOFF.md`.

## Changelog (Phase-5 review + evaluator-plan-review.md reconciliation, 2026-10-14)

Advisory-only (Phase 5 reviewer subagent + AI evaluator), not a human decision or an approval of any kind; see `plans/EXP-003/phase5-review-findings.md` and `plans/EXP-003/evaluator-plan-review.md`. No tier, human decision or Revision 2 rule changed. Each entry cites the finding it closes.

- **M1, m5**: P7.5 atomicity fault injection now covers both fault points (F-A, F-I) × all 4 mutations = 8 cases, proving an already-committed audit row rolls back (F-I), not just that the expense write rolls back (F-A alone).
- **M2**: P8.3/Open Items OI-2 item 7 — body-parser errors keep their native 400/413/415 status (SPECS S5.7/S8), not flattened to 400; the TODO.md closure for "Preserve 4xx status for framework errors" is now accurate.
- **item 2 (evaluator)**: P0 is a pinned, ignored scratch probe outside `tests/` (Phase 7); P6 baseline test migration and P7 new tests move to Phase 11; P8 documentation is explicitly a two-pass step (Phase 7 end, then Phase 11/13 tail), not "Phase 7 tail or ∥ P7".
- **item 3 (evaluator)**: explicit Phase/step mapping added above; P8 Pass 1 vs. Pass 2 split documented.
- **item 4 (evaluator)**: `plans/EXP-003/HANDOFF.md` added.
- **item 5 (evaluator)**: restore window tightened to an explicit nonnegative `[0, 30d)` bound (negative elapsed throws instead of counting as open); `restoreStateCheck` and the repository `restore()` SQL both add a `status === "SUBMITTED"` check (SPECS S5.3/S5.8) instead of relying only on the tombstone invariant.
- **item 6 (evaluator)**: confirmed — the mandatory compile-time `NotPromise<T>` constraint (m12) is unchanged, no fallback weakening.
- **item 7 (evaluator)**: terminology clarified in SPECS S2/S5.7 addendum — semantic business authorization, Rosetta review/HITL gates, and host tool permissions are three distinct concepts.
- **item 8 (evaluator)**: see ledger correction below (stale "Phase3 NOT APPROVED" checkpoint annotated as historical, m14).
- **item 9 (evaluator)**: OI-1 and OI-2 item 7 reworded as proposed defaults pending Phase 6 confirmation, not decided answers.
- **m4**: P6.1 pins both Node and npm.
- **m6**: P7.4 adds the cross-tenant restore and cross-tenant decision-with-stored-key cases.
- **m7**: P7.3 no-echo scope narrowed to header/key/body values; key names exempt.
- **m8**: P7.6 states both `T0+30d` and `T0+30d+1ms` are asserted in the same test.
- **m9**: AC Traceability table (AC-012, AC-014 rows) aligned with SPECS S1.
- **m13**: P6.4 added (break-to-evidence map).
- **m14**: P8.1 lists breaks; P8 phase ambiguity resolved; ledger stale-checkpoint note added.

## Read First

0. `plans/EXP-003/REQUEST.md` (original request + EXP3-AC-001..014).
1. `plans/EXP-003/architecture-notes.md` → `## Design Review Revision 2` + `### Evaluator consistency reconciliation` (controlling; earlier sections are history).
2. `plans/EXP-003/EXP-003-SPECS.md` (S0–S15).
3. `agents/TEMP/EXP-003/coding-flow-state.md` (ledger, the 3 human decisions, probe-provenance correction).
4. `docs/ARCHITECTURE.md`, `docs/CONTEXT.md`, `docs/PATTERNS/INDEX.md` + pattern files, `agents/MEMORY.md`.

## Governing Rules

- Tier order is fixed: SPECS S4 (authority: design `### Corrected, non-contradictory tier order`). Do not reorder.
- Human decisions are closed: employee-only create/delete/restore; legacy quarantine; half-open 30-day window (ledger "Human policy decisions"). Malformed JSON → 400 is accepted evaluator feedback.
- `NOT_EXPENSE_OWNER` is **reachable** and must be tested. Do not mark it unreachable (design Revision 2 "Bug fixed: same-tenant ownership denial…").
- Stack frozen, no new dependencies, `package.json`/lockfile/tsconfig/vitest config untouched (SPECS S2 NFR-5).
- Every `node`/`npm`/`npx` command shows its version pin inline (ledger "Probe-provenance correction"). Run only with host permission. Three distinct concepts, never conflated (SPECS S2/S5.7 addendum, evaluator-plan-review.md item 7): semantic business authorization (`policy.ts`), Rosetta coding-flow review/HITL approval gates (phase approvals), and host tool permissions (file/shell access grants).
- Follow `docs/PATTERNS/*` for schemas, repository methods, row mapping, error bodies, inject tests.

## AC Traceability

| AC | Plan steps | SPECS |
|---|---|---|
| EXP3-AC-001 Every expense query/mutation tenant-scoped; cross-tenant probes 404/no changes | P1.2, P3.1, P4.1, P7.4 | S4 T4, S5.8, S5.9, S6.2 |
| EXP3-AC-002 Employee/manager/finance permissions match fixed actor/decision policies | P2.3, P4.1, P5.1, P7.2, P7.4 | S4 T1/T4b/T5/T6, S5.2, S5.3 |
| EXP3-AC-003 Self-approval and manager approval > 100,000 cents rejected, no state/audit change | P2.3, P4.1, P7.2, P7.4 | S4 T6, S5.3, S5.5, S8 |
| EXP3-AC-004 Every successful mutation + exactly one audit event, atomic | P0.2, P1.1, P4.1, P7.5 | S4 T9, S5.4, S5.5, S9, S11, S12.1 |
| EXP3-AC-005 Audit has no app update/delete path; survives logical deletion | P1.2, P3.2, P7.5 | S5.10, S6.2, S9 |
| EXP3-AC-006 Idempotency replays identical / rejects conflicts, no cross-tenant leak | P3.3, P4.1, P7.2, P7.6 | S4 T7, S5.5, S5.11, S10 |
| EXP3-AC-007 Only owner tombstones a SUBMITTED expense; reads/lists hide it | P3.1, P4.1, P7.6 | S4 T4b/T6/T8, S5.3, S5.8 |
| EXP3-AC-008 Decided expenses not employee-deletable; stable retention-policy 409 | P4.1, P7.6 | S4 T8, S8 (`EXPENSE_RETENTION_LOCKED`) |
| EXP3-AC-009 Owner restore within 30 days, one audit event, idempotent replay | P4.1, P7.6 | S4 T7/T8/T9, S5.3, S5.5, S9 |
| EXP3-AC-010 Injected-clock retention tests before/at/after 30 days | P7.2, P7.6 | S5.3 (`isRestoreWindowOpen`), S12 |
| EXP3-AC-011 Invalid/missing auth headers, keys, payloads, ids → stable safe errors | P2.1, P2.4, P5.1, P5.2, P7.2, P7.3 | S4 T1–T3, S5.2, S5.6, S5.7, S7, S8 |
| EXP3-AC-012 Starter deliberately migrated/preserved; breaks documented | P1.2, P6.1–P6.4, P7.3, P7.7, P8.1–P8.6 | S5.7, S6.1, S7.4 |
| EXP3-AC-013 Clean `npm ci` + typecheck/unit/integration/build pass | P6.3, P7.9, P9.1 | S3.3, S15 |
| EXP3-AC-014 Review maps requirements → code/tests; misses/corrections/limits recorded | P6.2, P6.4, P8.6, P9.2 | S1, S12.3, S14 |

## Recording and Evidence

- Evidence dir (committed): `plans/EXP-003/evidence/`. Files: `P0-sqlite-runtime.txt`, `P6-baseline-before.txt` (original failing output), `P6-baseline-edits.md` (per-test edit log), `P6-check.txt`, `P7-check.txt`, `P9-ci-check.txt`.
- Phase status → `agents/TEMP/EXP-003/coding-flow-state.md`. Deviations (any SPECS change) → recorded there and in SPECS with a dated note, never silently.

## File Ownership and Sequencing

- Sequential. Each batch depends on the previous one. Typecheck is expected red from P3.1 (unscoped `findById`/`list` removed) until P5.2. Run no gate in between.
- One owner per file: P1 → `transaction.ts`, `database.ts`; P2 → `errors.ts`, `domain.ts`, `policy.ts`, `schemas.ts`; P3 → the three repositories; P4 → `expense-service.ts`; P5 → `actor.ts`, `app.ts`; P6 → `tests/app.test.ts`; P7 → all new test files; P8 → docs.
- Execution order: P0–P5 → P8 Pass1 and build/manual validation → Phase8 code review →
  Phase9 implementation validation → Phase10 author approval → P6/P7 tests → Phase12 review →
  P9 final validation and P8 Pass2. Only test-phase documentation preparation can run alongside
  P7; final counts/results wait for the completed gates. This plan does not authorize implementation.

## P0 Pre-flight: pinned, ignored mechanical smoke probe (Phase 7, mandatory, first)

Per evaluator-plan-review.md item 2 (frozen coding-flow: Phase 7 excludes tests; no TDD was requested). P0 creates **no file under `tests/`** — not even a skipped one, since a skipped Vitest file is still test-writing. It is a throwaway scratch probe, outside the committed test suite, used only to unblock P1 (`transaction.ts`) by confirming the SPECS S11 runtime facts before building on them.

- P0.1 Write a one-off scratch script at `agents/TEMP/EXP-003/sqlite-runtime-probe.mjs` (SCM-excluded `agents/TEMP` location, not `tests/`) using raw `DatabaseSync` (no `src/` imports), that exercises and prints a pass/fail line for every runtime fact listed in SPECS S11 "Runtime facts relied on". (AC-004, AC-012)
- P0.2 Run it once with the pin shown in the command itself: `test "$(node --version)" = "v24.21.0" && test "$(npm --version)" = "11.6.2" && node agents/TEMP/EXP-003/sqlite-runtime-probe.mjs`. Save the raw output to `evidence/P0-sqlite-runtime.txt`, labeled as a manual scratch probe, not an automated test run, and not Phase 7 test-suite evidence.
  - Pin mismatch ⇒ STOP and report. Do not run unpinned, and do not switch Node versions without approval.
  - Any fact false ⇒ STOP and escalate as a SPECS S11/S6 deviation. Do not work around it in code.
- Phase 11 step P7.0 (below) writes the real, formal `tests/sqlite-runtime.test.ts` **from the SPECS S11 requirements directly**, as new committed test code — it does not un-skip or reuse the P0 scratch script, which stays a disposable, non-committed probe.

## P1 Persistence foundation (Phase 7)

- P1.1 `src/transaction.ts` (new): `withTransaction`, `TransactionNestingError` per SPECS S5.4/S11. (AC-004)
- P1.2 `src/database.ts`: add `QUARANTINE_TENANT_ID`, `SCHEMA_VERSION`, `MIGRATIONS[0..1]`, exported `migrate`. `openDatabase` = mkdir → open → `PRAGMA foreign_keys = ON` (outside any transaction) → `migrate`. DDL verbatim from SPECS S6.2. Migration 0→1 = current seed DDL, unchanged. (AC-001, AC-005, AC-012)

## P2 Domain, errors, policy, schemas (Phase 7)

- P2.1 `src/errors.ts` (new): catalog + helpers per SPECS S5.7/S8. Move `errorBody`/`validationError` out of `app.ts` without changing their output shape. (AC-011)
- P2.2 `src/domain.ts`: additions per SPECS S5.1. Keep `EXPENSE_STATUSES` as the source of truth.
- P2.3 `src/policy.ts` (new): pure functions per SPECS S5.3. No imports beyond `domain.ts`. (AC-002, AC-003, AC-007–AC-010)
- P2.4 `src/schemas.ts`: optional `employeeId`/`reviewerId`, `emptyMutationBodySchema`, `idempotencyKeySchema`, `parseIdempotencyKey` per SPECS S5.6. (AC-011)

## P3 Repositories (Phase 7)

- P3.1 `src/expense-repository.ts`: replace `findById`/`list` with tenant-scoped `findInTenant`/`listVisible`. Add the `tenant_id` guard to `decide`. Add `tombstone`/`restore`. Map `tenantId`/`deletedAt`. All per SPECS S5.8. (AC-001, AC-007)
- P3.2 `src/audit-repository.ts` (new): `append`, `listForExpense` only. (AC-004, AC-005)
- P3.3 `src/idempotency-repository.ts` (new): `find`, `save`, `canonicalJson`, `requestFingerprint` per SPECS S5.11/S10. (AC-006)

## P4 Service (Phase 7)

- P4.1 `src/expense-service.ts` (new): `ExpenseService` per SPECS S5.5, following the per-route tier table in S4. Traps:
  - `now()` is called once, as the first statement inside the transaction.
  - `idFactory()` is called only at T9 of a fresh create.
  - Denials are returned, not thrown.
  - Delete/restore skip T4b.
  - No `await` inside the transaction.
  (AC-001–AC-009)

## P5 HTTP layer (Phase 7)

- P5.1 `src/actor.ts` (new): schema, `registerActorHook`, `requireActor`, Fastify augmentation per SPECS S5.2. The hook keys off `request.routeOptions.url`. (AC-002, AC-011)
- P5.2 `src/app.ts`: wiring, thin handlers (T3 order: key → params → body), DELETE/restore routes,
  and safe parser-error mapping to 400/413/415 per SPECS S5.7/S5.12. BuildAppOptions and server.ts unchanged.
- P5.3 End Phase7 with pinned `npm run build` and manual implementation validation, recording
  original failures and fixes. No test edits or full-suite-success claim. P8 Pass1 must finish
  before Phase8 code review; frozen seed tests may remain incompatible until P6 in Phase11.

## P6 Baseline test migration (Phase 11; deliberate breaks, AC-012)

Corrected per evaluator-plan-review.md item 2: baseline test editing is test-suite work, so it belongs in Phase 11 (after Phase 10 approval), not Phase 7. Moved here from its originally mis-scoped Phase 7 placement; step IDs P6.1–P6.3 are unchanged so SPECS/PLAN cross-references stay valid.

- P6.1 Before editing `tests/app.test.ts`, run it unmodified with the pin: `test "$(node --version)" = "v24.21.0" && test "$(npm --version)" = "11.6.2" && npx vitest run tests/app.test.ts`. Save the expected failures to `evidence/P6-baseline-before.txt` (original test output for AC-014). (m4: npm pin added)
- P6.2 Migrate all 6 cases and log each edit and its reason in `evidence/P6-baseline-edits.md`. Keep the test names unless a change is listed below. (AC-012, AC-014)

  | Seed test | Migration |
  |---|---|
  | `reports database readiness` | unchanged (no headers) |
  | `creates, reads, and lists an expense` | employee headers (`tenant-a`/`employee-1`/`employee`) + key; expected body gains `tenantId: "tenant-a"`, `deletedAt: null` |
  | `approves a submitted expense once` | decide as `reviewer-1`/`manager` with key; repeat as `reviewer-2`/`finance` with a new key ⇒ still 409 `EXPENSE_ALREADY_DECIDED`; `updatedAt` still `12:00:01` |
  | `rejects invalid expense input` | valid headers + key; still 400 `VALIDATION_ERROR` |
  | `persists expenses across application instances` | same headers on both instances |
  | `does not expose an expense deletion route in the starter` | renamed `lets the owner delete an expense and keeps unknown routes unrouted`: owner DELETE ⇒ 200 with `deletedAt`; unauthenticated `PUT /expenses/expense-1` ⇒ 404 `ROUTE_NOT_FOUND` |
- P6.3 Mid gate with the pin: `test "$(node --version)" = "v24.21.0" && test "$(npm --version)" = "11.6.2" && npm run check`. Save to `evidence/P6-check.txt`. It must be green before Phase 12 (Review Tests). (AC-013)
- P6.4 (m13, new) Write `evidence/P6-baseline-edits.md` as an explicit map, breaks 1–8 (SPECS S7.4) → its Phase 11 after-test (P6.2 row or a named P7 test) → its before evidence (seed doc/test line, for example `docs/ARCHITECTURE.md:83` for the malformed-JSON 500). Breaks 3, 5, 7, 8 and the 413/415 behavior have after-tests in P7 but no baseline "before" test, so cite the seed doc/line instead. (AC-012, AC-014)

## P7 New tests (Phase 11)

- P7.0 (new, per P0 correction above) Write `tests/sqlite-runtime.test.ts` from the SPECS S11 "Runtime facts relied on" list directly, as fresh committed assertions — not a reuse or un-skip of the Phase 7 scratch probe (`agents/TEMP/EXP-003/sqlite-runtime-probe.mjs`). This is the first real, counted run of these facts in the test suite. (AC-004, AC-012)
  This step also covers the transaction helper's commit/rollback/nesting/thenable behavior, a write to
  each of the three tables followed by a thrown error, and formal type assertions from S5.4.
  The three-write case proves rollback of inserted idempotency rows; F-I alone cannot.
- P7.1 `tests/support.ts`: `createTestApp({ databasePath?, clock? })`, a mutable ISO clock, actor header builders, a key generator, a temp-file DB helper plus a second `DatabaseSync` reader. Use shared `openApps`/temp-dir cleanup per `docs/PATTERNS/deterministic-fastify-inject-test.md`.
- P7.2 `tests/policy.test.ts`: each S5.3 function; role matrix; self-decision for approve/reject;
  100,000/100,001 limit cases; restore elapsed -1ms (throws), 0 (open), 30d-1ms (open),
  exactly30d/+1ms (closed), unparsable clocks (throws), and non-SUBMITTED tombstone denial.
  Also fingerprint/canonical-JSON tests per S10. (AC-002, AC-003, AC-006, AC-010)
- P7.3 `tests/access.test.ts` › `authentication and validation`: S12.2 bad headers ⇒ 401 (including a malformed body plus bad headers ⇒ 401, not 400). Bad keys ⇒ REQUIRED/INVALID. Malformed JSON ⇒ 400 `VALIDATION_ERROR` without details. Unknown field, bad ids ⇒ 400. Over-size body ⇒ 413 `PAYLOAD_TOO_LARGE`; unsupported content type ⇒ 415 `UNSUPPORTED_MEDIA_TYPE` (M2, S5.7/S8). No-echo sentinels in header values, idempotency keys and body **values** must not appear in any response; unknown body **key names** are exempt, since Zod's strict-mode message legitimately echoes them (m7, SPECS S12.2). `/health` and an unknown route need no headers. (AC-011, AC-012)
- P7.4 `tests/access.test.ts` › `tenancy and decision policy`: matrix #12, #13, plus the two m6 additions named in SPECS S12.3 (not in the numbered matrix): a cross-tenant restore that changes nothing, and a cross-tenant decision retry of a stored idempotency key that does not replay. Employee list/read scoped to own rows; manager/finance see the tenant. Employee GET of a same-tenant non-owned expense ⇒ 404. Manager/finance create/delete/restore ⇒ 403 `FORBIDDEN_ROLE`. Employee decide ⇒ 403. `ACTOR_MISMATCH` on create and on decision. Self-decision via `alex`. Limit cases. Each denial (including the two m6 additions) asserts the expense row, audit count and idempotency-record count are unchanged. (AC-001–AC-003, AC-006)
- P7.5 `tests/audit.test.ts`: exactly one event per successful mutation, with the exact S9 payload and actor/tenant/time. Zero events on denials and replays. Audit rows remain after a tombstone. Raw `UPDATE`/`DELETE` on `audit_events` through the second connection throws. Atomicity fault injection per SPECS S12.1 (M1, m5): both fault points **F-A** (`test_fail_audit` on `audit_events`) and **F-I** (`test_fail_idem` on `idempotency_records`, which proves an already-inserted audit row is rolled back) × all four mutations (create, decide, delete, restore) = 8 cases, each asserting 500, unchanged expense row, unchanged audit count, no idempotency record, plus the recovery retry (drop trigger, retry succeeds with exactly one new audit event). `AuditRepository` exposes only `append` and `listForExpense`. (AC-004, AC-005)
- P7.6 `tests/lifecycle.test.ts`: SPECS S12.3 matrix #1–#11, using the exact test names given there; matrix #6 explicitly asserts both `T0+30d` and `T0+30d+1ms` as `RESTORE_WINDOW_EXPIRED` in the same test, with the first 409 changing no state (m8). Also cover: owner tombstone hides the expense from GET/list/decision (404); decided ⇒ 409 `EXPENSE_RETENTION_LOCKED`; restore at `T0+30d−1ms` ⇒ 200 with one `EXPENSE_RESTORED` event; create replay returns the same `expense-1` and the next create gets `expense-2` (no id consumed by the replay); `isRestoreWindowOpen` invalid-clock case (`now` before `deletedAt`) throws, surfaced by the service as 500 (evaluator-plan-review.md item 5); and a direct `restoreStateCheck`/`policy.test.ts` case where `status !== "SUBMITTED"` on an (otherwise synthetic) tombstoned row returns the stable `EXPENSE_NOT_DELETED` denial rather than throwing. (AC-006–AC-010)
- P7.7 `tests/migration.test.ts`: seed row retained in inaccessible quarantine; migration v2,
  reopen no-op, newer version refused without changing it and handle closed on migration failure;
  omitted/quarantine tenant inserts abort. Cross-check SPECS S12.1. (AC-012)
- P7.8 `tests/errors.test.ts`: every S5.7 parser-code mapping and safe-message contract, unmapped
  and non-object inputs, complete catalog; 401 precedence over malformed/oversize/unsupported bodies.
  Route-level empty JSON body behavior for DELETE/restore belongs in P7.3. (AC-011)
- P7.9 Full gate with the pin (as P6.3), after all P7.0–P7.8 tests are written. Save to `evidence/P7-check.txt`. (AC-013)

## P8 Documentation (two passes, per evaluator-plan-review.md item 3 — explicit, not "Phase 7 tail or ∥ P7")

- **Pass 1 (end of Phase 7, before Phase 8 Review Code)**: draft P8.1, P8.2, P8.4, P8.5, P8.6 (and P8.3/compatibility doc, below) to describe the implementation exactly as built in Phase 7 — module list, schema, error catalog, breaks. No test counts yet, since Phase 11 has not run.
- **Pass 2 (Phase 11 tail, folded into Phase 13 P9.2)**: revisit the same files to add/update test-suite counts, the requirement map, and final evidence links once Phase 11 tests exist and P9.1's gate is green. This pass does not change Pass-1 facts about the implementation, only appends test/evidence information.

- P8.1 `docs/CONTEXT.md`:
  - Actors/roles and simulated-auth disclaimer.
  - Decision policy.
  - Lifecycle: tombstone and restore within 30 days, no purge.
  - Audit and idempotency in business terms.
  - Attachments unsupported.
  - List the baseline compatibility breaks (design `architecture-notes.md:193` requires this; m14), with a pointer to `docs/EXP-003-COMPATIBILITY.md` for the full list.
  - Update "Not In Baseline" and "Capabilities". Keep it under 100 lines.
- P8.2 `docs/ARCHITECTURE.md`:
  - New modules table and the layering diagram.
  - Request pipeline (tiers, pointing to SPECS S4).
  - Persistence: `user_version` migrations, quarantine, audit triggers, idempotency table. Remove "No migration mechanism".
  - Error model: full S8 table. Replace the malformed-JSON-500 quirk note.
  - Testing: new suites (added in Pass 2, once they exist). Update "Not Present". Keep it under 150 lines.
- P8.3 Compatibility documentation (OI-1, resolved default — see Open Items below): create `docs/EXP-003-COMPATIBILITY.md` listing breaks 1–8 (SPECS S7.4), the new routes/headers/codes, and the OI-2 judgment calls. Link it from `docs/ARCHITECTURE.md` and `docs/CONTEXT.md`. `docs/BASELINE-API.md` gets **zero edits** by default (it is human-owned per `docs/ASSUMPTIONS.md` A9 and `docs/TODO.md` "with human approval only"). This is the proposed default carried into Phase 6 for author confirmation, not a decision already made (evaluator-plan-review.md item 9) — only append a dated `## EXP-003 Compatibility Changes` section to `BASELINE-API.md` if the human explicitly opts in at Phase 6; existing seed text there would stay byte-identical either way.
- P8.4 `docs/ASSUMPTIONS.md`. Never delete history; mark resolved entries `[RESOLVED 2026-…]` and move them:
  - A1 → RESOLVED: EXP-003 extends the same service, stack and domain. Fact recorded in CONTEXT and IMPLEMENTATION.
  - A2 → RESOLVED after implementation: baseline preserved except breaks documented in the separate compatibility notes and ARCHITECTURE; do not assume baseline append permission.
  - A4 → RESOLVED: superseded by simulated header auth + RBAC (not production auth). Fact recorded in CONTEXT Actors and ARCHITECTURE.
  - A5 → RESOLVED: decisions stay final; deletion is now an owner-only logical tombstone of SUBMITTED expenses, restorable for 30 days, never purged.
  - A7 (already resolved) → append a note: a `user_version` migration now exists and preserves rows. No reset was performed. Legacy rows are quarantined.
  - A10 (already resolved) → append a note: superseded, malformed JSON now returns 400 (evaluator feedback, AC-011).
  - A11 → stays Open, updated: the manager limit compares minor units regardless of currency, with no conversion. This is a documented limitation.
  - A12 → RESOLVED into ARCHITECTURE Persistence. UTC ISO is now load-bearing for retention arithmetic and audit times, so the injected `now` must return UTC ISO.
  - A13 → RESOLVED as a documented constraint in ARCHITECTURE. Correctness relies on a single process plus `BEGIN IMMEDIATE`. A foreign writer may cause `SQLITE_BUSY` ⇒ 500.
  - A3 is unchanged and still holds.
- P8.5 `docs/TODO.md`:
  - Mark `[DONE]`: "Decide schema migration approach" and "Preserve 4xx status for framework errors".
  - Add P3 items: tombstone purge job; idempotency-record expiry; audit read API; regenerate `docs/PATTERNS/` for new patterns (service result, `withTransaction`, tier pipeline). `INDEX.md` is auto-generated, so do not hand-edit it.
  - Keep the A9 BASELINE-API error-code item open.
- P8.6 `agents/IMPLEMENTATION.md`: a new `### EXP-003 …` workstream entry with modules, schema v2, breaks, test suites and evidence path. Update the "Baseline State" test count. Also update `docs/CODEMAP.md` with the new files. (AC-012, AC-014)
- P8.7 `README.md`: update runnable API examples with actor headers/idempotency keys, role
  assumptions and delete/restore behavior. Link compatibility notes and retain simulated-auth disclaimer.
  Pass1 has no new passing-test count; Pass2 records actual validation results, not projected outcomes.

## P9 Final gate and requirement map (Phase 13)

- P9.1 Clean install plus gate with the pin (host approval required, because `npm ci` rewrites `node_modules`): `test "$(node --version)" = "v24.21.0" && test "$(npm --version)" = "11.6.2" && npm ci && npm run check`. Save to `evidence/P9-ci-check.txt`. (AC-013)
- P9.2 `plans/EXP-003/EXP-003-REQUIREMENT-MAP.md`: each requirement in `plans/EXP-003/REQUEST.md` and each AC → code file:line and test name. Record misses, corrections (incl. P6 baseline edits and review findings), limits (SPECS S14), and original vs. corrected test output (links to `evidence/`). (AC-014)

## Open Items

Both items below are **proposed safe defaults carried forward for Phase 6 author confirmation** — the Phase 5 reviewer's recommendation, adopted into this draft, but not yet an author decision (evaluator-plan-review.md item 9). Nothing here is claimed as already approved.

- OI-1 (confirm at Phase 6 HITL): `docs/BASELINE-API.md` is human-owned (ASSUMPTIONS A9, TODO "with human approval only"); the approved design requires compatibility notes to exist somewhere. Proposed default: **zero edits** to `BASELINE-API.md`; breaks live in a new `docs/EXP-003-COMPATIBILITY.md` instead (P8.3). Append-only to `BASELINE-API.md` only if the human explicitly opts in at Phase 6.
- OI-2 (Phase 5 visibility): spec-level choices made within design latitude, which a reviewer may challenge without reopening the design:
  - `updated_at` is bumped on delete and restore (intended: a restored expense moves to the top of the list).
  - `deletedBy` is not serialized (always equals `employeeId` under the owner-only rule).
  - T3 order is key → params → body.
  - Decision T6 order is mismatch → self → limit.
  - Quarantine is applied via a column DEFAULT, hardened by the `expenses_no_quarantine_insert` trigger so a buggy INSERT aborts loudly instead of vanishing into quarantine (fail-silent reworded as a hardened control).
  - An extra `audit_events_tenant_match` trigger.
  - ~~Parse errors 413/415 are mapped to 400~~ — **superseded by M2**: body-parser errors keep their native 400/413/415 status with new `PAYLOAD_TOO_LARGE`/`UNSUPPORTED_MEDIA_TYPE` codes (SPECS S5.7/S8); this is the proposed default (also carried into Phase 6 for confirmation, not yet decided), not the flattened-to-400 behavior this row originally described.
  - Exact error message strings.

## Checklist

Phrased as planned outcomes for work not yet started — nothing below is implemented, run, or proven yet; this is the Phase 7–13 target, not a status report.

- [ ] (Planned) P0 pinned scratch probe (not a `tests/` file) run once with evidence saved; no unpinned runtime command run
- [ ] (Planned) All SPECS S5 signatures implemented as written; any deviation recorded
- [ ] (Planned) Tier order matches SPECS S4 for every route (per-route table)
- [ ] (Planned) No unscoped repository method remains; every SQL statement on `expenses` binds `tenant_id`
- [ ] (Planned) `NOT_EXPENSE_OWNER` reachable and tested; `ACTOR_MISMATCH` at T6 tested for create and decision
- [ ] (Planned) Exactly one audit event per successful mutation; zero on denial, replay or rollback
- [ ] (Planned) Eight route faults prove unchanged expense/audit and absent failed-key records;
  the helper's post-three-write throw separately proves rollback of all three inserted writes
- [ ] (Planned) Idempotency: 13-item matrix (S12.3) plus the 2 m6 additions covered with the named tests
- [ ] (Planned) Restore elapsed -1ms throws; 0/30d-1ms open; exact30d/+1ms expired, with unit/integration coverage
- [ ] (Planned) Non-SUBMITTED tombstone denied at policy with 409; SQL status predicate is a
  backstop returning undefined on zero matches, not an HTTP-code-producing repository method
- [ ] (Planned) Migration preserves seed rows under `legacy:seed`; reopen idempotent; newer version refused
- [ ] (Planned) 6 baseline tests migrated in Phase 11 (not Phase 7); before-output and edit log saved; P6-baseline-edits.md maps all 8 breaks to after-test + before-evidence
- [ ] (Planned) Malformed JSON ⇒ 400; oversize ⇒ 413; unsupported media type ⇒ 415; 401 precedes all of them
- [ ] (Planned) No new dependency; `package.json`, lockfile, tsconfig and vitest config unchanged
- [ ] (Planned) Docs updated in two passes (P8.1–P8.6); `docs/EXP-003-COMPATIBILITY.md` created; ASSUMPTIONS A1, A2, A4, A5, A7, A10–A13 handled as listed
- [ ] (Planned) `npm ci && npm run check` green under the pin (AC-013)
- [ ] (Planned) Requirement map with misses, corrections and limits (AC-014)
- [ ] (Planned) `plans/EXP-003/HANDOFF.md` kept current through every phase (evaluator-plan-review.md item 4)
