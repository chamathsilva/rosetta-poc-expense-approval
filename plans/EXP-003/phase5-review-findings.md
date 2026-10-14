# EXP-003 Phase 5 Review Findings (specs + plan)

Reviewer: independent reviewer subagent (AI). Advisory only; the orchestrator and the human author decide.
Inputs reviewed: `plans/EXP-003/REQUEST.md`, `plans/EXP-003/architecture-notes.md` (Revision 2 + reconciliation controlling), `agents/TEMP/EXP-003/coding-flow-state.md`, `src/*.ts`, `tests/app.test.ts`, `docs/{CONTEXT,ARCHITECTURE,BASELINE-API,ASSUMPTIONS,TODO}.md`, `docs/PATTERNS/INDEX.md`, `tsconfig*.json`, `plans/EXP-003/EXP-003-SPECS.md`, `plans/EXP-003/EXP-003-PLAN.md`. Fastify 5.12.4 behavior spot-checked in `node_modules/fastify/lib` (read-only, no runtime command run).

## TLDR

**Verdict: approve-with-minor-fixes.** SPECS S4 matches the approved Revision 2 tier table with no reordering. All 3 human decisions are honored exactly. All 14 ACs and all 13 matrix items trace to concrete sections, steps and named tests. No cross-tenant leak path found. Two Major items need small text edits before Phase 6:
- (M1) The planned atomicity fault point cannot prove that an audit row is rolled back.
- (M2) Mapping 413/415 to 400 contradicts an open TODO that P8.5 would mark DONE.

Counts: Critical 0, Major 2, Minor 14.

## Critical

None.

## Major

### M1. The atomicity fault injection cannot show an audit row being rolled back (AC-004)
- Where: `EXP-003-SPECS.md:491` (S12.1), `EXP-003-PLAN.md:113` (P7.5), checklist `EXP-003-PLAN.md:177`.
- What's wrong: the only planned fault is `test_fail_audit BEFORE INSERT ON audit_events`. The T9 order is write, then `audit.append`, then `idempotency.save` (`SPECS:213`). With that fault, the audit row is never inserted and idempotency save is never reached. So "no audit row" and "no idempotency record" pass trivially, and the test proves only that the expense write was rolled back. The checklist claim "proves rollback of state, audit and idempotency" (`PLAN:177`) is not backed.
- Why it matters: AC-004 requires the mutation and exactly one audit event to commit together. The case the test must exclude is "audit row committed, later step failed".
- Fix: add a second fault point, `test_fail_idem BEFORE INSERT ON idempotency_records ... RAISE(ABORT)`. Assert 500, expense row unchanged, **zero** audit rows for the expense, and no idempotency record. Keep the audit-trigger case too. Run both for create and delete at minimum (see m5).

### M2. Mapping 413/415 body-parse errors to 400 contradicts an open TODO that the plan marks DONE (AC-011, AC-012)
- Where: `SPECS:253` (`isBodyParseError`: every `FST_ERR_CTP_*` with 4xx status), `SPECS:314`, `SPECS:528` ("413 ⇒ 400 via T2"), `SPECS:412` (break #8 mentions malformed JSON only), `PLAN:146` (marks TODO "Preserve 4xx status for framework errors" `[DONE]`), `PLAN:166` (OI-2 item 7).
- What's wrong: `docs/TODO.md:17-18` asks to *preserve* the framework's 4xx status. The spec instead rewrites `FST_ERR_CTP_BODY_TOO_LARGE` (413), `FST_ERR_CTP_INVALID_MEDIA_TYPE` (415) and `FST_ERR_CTP_INVALID_CONTENT_LENGTH` to 400 `VALIDATION_ERROR`, then marks the TODO done. The accepted evaluator feedback (`architecture-notes.md:236`, `:312`) names malformed JSON. Fastify already emits that as `FST_ERR_CTP_INVALID_JSON_BODY` with status 400 (`node_modules/fastify/lib/content-type-parser.js:325`). Break #8 (`SPECS:412`) documents only the JSON case, so the 413/415 changes are also undocumented breaks.
- Why it matters: this is an undocumented compatibility change (AC-012), and the backlog closure is false (AC-014 traceability). Its HTTP semantics go beyond what the evaluator feedback covered.
- Fix (pick one and record it):
  - (a) Preserve `error.statusCode` for `FST_ERR_CTP_*` (400/413/415). Use `VALIDATION_ERROR` for 400 and a stable code for 413/415, for example `PAYLOAD_TOO_LARGE` / `UNSUPPORTED_MEDIA_TYPE` added to S8.
  - (b) Keep "all to 400", but surface it at Phase 6 as a decision, list 413/415/empty-JSON-body in break #8 and S13, and don't mark the TODO done.

  Also note: `Content-Type: application/json` with an empty DELETE/restore body hits `FST_ERR_CTP_EMPTY_JSON_BODY` and returns 400. That contradicts "absent or `{}`" (`SPECS:396-397`) for clients that always send the header. Document it.

## Minor

- **m1. `errorBody(code)` cannot produce the T2 message.** `SPECS:250` takes the message from the catalog, which gives "Request validation failed". `SPECS:314` and `SPECS:420` require "Request body could not be parsed" for the same code. Fix: add an optional message override, or a `parseError()` helper in S5.7.
- **m2. Circular import.** `ServiceResult` is declared in `expense-service.ts` (`SPECS:199`), but `errors.ts` returns it (`SPECS:251`), and `expense-service.ts` imports `errors.ts`. A type-only import is legal under `verbatimModuleSyntax`, but it is an avoidable cycle. Fix: declare `ServiceResult` in `errors.ts` or `domain.ts`.
- **m3. Migration robustness** (`SPECS:320`):
  - `db.exec(MIGRATIONS[v])` does not compile under `noUncheckedIndexedAccess` (`string | undefined`). The spec should state the guard.
  - `user_version` is read outside the transaction. Re-read it inside each `withTransaction` and skip the step if it already advanced (TOCTOU, two openers).
  - On a `> SCHEMA_VERSION` throw, close the `DatabaseSync` before rethrowing, so the P7.7 "user_version = 3 ⇒ open throws" test does not leak a handle.
- **m4. P6.1 pins Node only.** `PLAN:94` checks `node --version` only. P0.2, P6.3 and P9.1 also check npm. The Governing Rule (`PLAN:19`) and the probe-provenance correction (`coding-flow-state.md:32`) require both. Fix: add `test "$(npm --version)" = "11.6.2"`.
- **m5. Atomicity faults cover only create and delete** (`PLAN:113`). AC-004 says "every successful state mutation". Fix: extend the fault cases to decide and restore. They are cheap with the same trigger.
- **m6. No cross-tenant restore test.** Matrix #7 and #12 cover delete, and #13 covers read/decision. AC-001 says "every … mutation" and "no changes". Fix: add cross-tenant restore, and cross-tenant decision with a stored key, each asserting 404 and unchanged row/audit/idempotency counts (P7.4).
- **m7. The "no echo" assertion conflicts with Zod output.** `PLAN:111` says "No response echoes the input". Zod 4 strict unknown-key messages include the key name (`node_modules/zod/v4/locales/en.js:102`: `Unrecognized key: "extra"`), and the baseline already returns them. Fix: scope the assertion to header values, idempotency keys and body *values*.
- **m8. AC-010 integration boundaries are not fully explicit.** Matrix #6 is named "at or after 30 days" (`SPECS:509`), and P7.6 names only −1 ms explicitly (`PLAN:114`). Fix: state that both `T0+30d` and `T0+30d+1ms` are asserted in integration, which the checklist at `PLAN:179` already claims.
- **m9. Traceability tables drift.** S1 lists AC-013 → P6.3, P9.1 (`SPECS:30`), while the PLAN lists P6.3, P7.8, P9.1 (`PLAN:38`). S1 uses `P8.*` for AC-012. Fix: align them.
- **m10. Undocumented break from the header charset.** The seed accepted any 1..100-character `employeeId`/`reviewerId`, spaces included. Since actor headers are restricted to `[A-Za-z0-9._-]` (`SPECS:152`), any supplied body id outside that charset can never match, so the request is always 403 `ACTOR_MISMATCH`. Fix: add this to break 3 (`SPECS:412`).
- **m11. Same-tenant existence disclosure is not listed as an accepted limit.** An employee gets 404 on `GET` for a non-owned same-tenant expense, but 403 `NOT_EXPENSE_OWNER` on `DELETE`/restore, so existence is revealed. The design mandates this (`architecture-notes.md:299-303`) and it stays within the tenant, so it is not an AC-001 issue. Fix: add it to S13 "Info disclosure" or S14.
- **m12. The thenable guard cannot contain an async `work`.** `SPECS:194`, `SPECS:477`: an async `work` that writes after `await` runs those writes in autocommit, after the wrapper has rolled back. The runtime guard cannot prevent this. Fix: make a compile-time non-Promise constraint mandatory, for example `work: () => T extends PromiseLike<unknown> ? never : T` via an overload that keeps inference, or document this residual risk explicitly.
- **m13. AC-012 before/after evidence covers only breaks that affect baseline tests.** P6 (`PLAN:92-105`) records before/after for breaks 1, 2, 4 and 6. Breaks 3, 5, 7 and 8 (and the new 413/415 behavior) have after-tests in P7 but no before reference. Fix: have `P6-baseline-edits.md` map each break 1–8 to its after-test and its before evidence (seed doc/test line, for example `docs/ARCHITECTURE.md:83` for the 500 on malformed JSON).
- **m14. Docs and ledger hygiene:**
  - P8.1 (`PLAN:120-126`) does not say CONTEXT lists the breaks, but design `architecture-notes.md:193` requires breaks to be documented in CONTEXT as well.
  - P8 is labeled "Phase 7 tail or ∥ P7" while P7 is Phase 11 (`PLAN:107`, `:118`), which is ambiguous.
  - Outside the review target: `coding-flow-state.md:16` (Phase 3 APPROVED) contradicts `:59-61` ("Phase3 remains NOT APPROVED … No specs/plan … started"). Annotate the stale checkpoint as historical so the AC-014 evidence trail is not self-contradictory.

## Requested checks — results

1. **Traceability.** All 14 ACs have rows in both tables (`SPECS:16-31`, `PLAN:24-39`). Spot-checked against the cited text:
   - AC-001: S5.8 binds `tenant_id` in every statement (`SPECS:267-271`), T4 is 404 (`SPECS:102`), and matrix #12/#13 are in P7.4. **Satisfied**, gap m6.
   - AC-004: S11 (`SPECS:472-481`) and S5.5 (`SPECS:211-213`). **Satisfied in design**, test gap M1.
   - AC-006: S10 (`SPECS:456-468`) plus T6-before-T7 (`SPECS:125`). **Satisfied.**
   - AC-008: `deleteStateCheck` (`SPECS:184`) and `EXPENSE_RETENTION_LOCKED` (`SPECS:434`), tested in P7.6. **Satisfied.**
   - AC-010: `isRestoreWindowOpen` (`SPECS:186`), data (`SPECS:497`), unit tests in P7.2. **Satisfied**, clarity m8.
   - AC-011: S7.1/S8 and S12.2 bad inputs, tested in P7.3. **Satisfied**, m1 and m7.
   - AC-012: S6.1/S7.4 and P6/P7.7/P8. **Satisfied**, M2/m10/m13.
2. **Fidelity to Revision 2.**
   - The tiers in S4 (`SPECS:97-108`) match `architecture-notes.md:309-320` one-for-one, in the same order: T1 401, T2 parse, T3 syntax, T4 tombstone-blind tenant existence, T4b ordinary visibility for GET/:id, list and decision only, T5 role, T6 identity, self, limit and ownership, T7 idempotency, T8 state, T9 mutate.
   - The tombstone split is correct: delete and restore skip T4b (`SPECS:118-119`).
   - `NOT_EXPENSE_OWNER` is reachable (`SPECS:123`, `:182`, `:428`; `PLAN:17`).
   - Two refinements stay within latitude: the T3 internal order and the placement of `now()` (`SPECS:127`).
   - **No drift found.**
3. **Human decisions.** All three are honored exactly.
   - Employee-only create/delete/restore: `SPECS:179`, `:116-119`; `PLAN:112`.
   - Quarantine, never deleted and no guessed tenant: `SPECS:322-323`; `PLAN:115`.
   - Half-open window with exactly 30 days counted as expired: `SPECS:186`, `:497`.
   - Malformed JSON → 400 is correctly attributed as evaluator feedback, not a human decision (`SPECS:11`, `PLAN:16`).
4. **Matrix (13).** Every item has a named test (`SPECS:504-516`), placed in P7.6 (#1–#11) and P7.4 (#12–#13).
   - #1 is a true same-key replay after tombstoning.
   - #3 depends on T7 preceding T8 and passes by construction.
   - #7, #8 and #9 assert precedence before replay.
   - #10 covers create and decision.
   - Only wording issue: #6 (m8).
5. **Atomicity.** The S11 contract (explicit `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`, `isTransaction` nesting guard, rollback on trigger ABORT) is sound and consistent with the probe-provenance correction, and the facts are pinned for verification in P0. The fault injection is concrete, but at the wrong point to prove audit rollback (M1).
6. **Idempotency boundary.**
   - Scope is `(tenant, user, key)` (`SPECS:458`).
   - T4–T6 run before T7 (`SPECS:122-125`), and conflicts never fall through (`SPECS:125`).
   - Cross-tenant attempts get 404 at T4, cross-user attempts get 403 at T6 or are a separate scope, and cross-role attempts get 403 at T5 or 409 on fingerprint mismatch.
   - The stored record is never consulted before authorization. **Satisfied.**
7. **AC-012.** Breaks 1–8 are carried in S7.4 (`SPECS:412`), and P6 migrates all 6 seed tests with before output and an edit log. Gaps: M2, m10, m13.
8. **AC-013.** P9.1 (`PLAN:153`) runs `npm ci && npm run check` with both version pins inline and requires host approval for `npm ci`. Consistent with the probe-provenance correction. P6.1 lacks the npm pin (m4).
9. **OI-1/OI-2.** Answered below.
10. **Other Phase 8/13 risks.**
    - Strict-mode notes: m3 (`noUncheckedIndexedAccess`), m2. The `reviewerId?: string | undefined` typing (`SPECS:169`) is already compatible with `exactOptionalPropertyTypes`.
    - Verified in Fastify 5.12.4: the hook's `routeOptions.url === undefined` for 404s (`node_modules/fastify/lib/request.js:192`, `is404` at `:207-210`). Malformed JSON surfaces as `FST_ERR_CTP_INVALID_JSON_BODY` (400), so `isBodyParseError` will match it.
    - No cross-tenant leak path found.

## OI-1 / OI-2 answers

**OI-1 (BASELINE-API.md append-only): (b) escalate. The fallback should change.**
- Appending is non-destructive. But editing that file at all conflicts with two recorded positions:
  - ASSUMPTIONS A9 records that the evaluator chose to leave `docs/BASELINE-API.md` unchanged (`docs/ASSUMPTIONS.md:71-72`).
  - TODO marks edits to that file "with human approval only" (`docs/TODO.md:23-24`).
- The plan already routes OI-1 to Phase 6, which is correct.
- Recommendation: make the default when no approval is given **zero edits to BASELINE-API.md**. Put the compatibility notes in a new `docs/EXP-003-COMPATIBILITY.md`, linked from ARCHITECTURE and CONTEXT. This still meets design `:193` ("BASELINE-API change notes") and AC-012. Append only if the human explicitly approves at Phase 6.

**OI-2 (8 judgment calls):**

| # | Item | Class | Note |
|---|---|---|---|
| 1 | `updated_at` bumped on delete/restore | (a) | Consistent with decide. Side effect: a restored expense moves to the top of the list. Document it. |
| 2 | `deletedBy` not serialized | (a) | It always equals `employeeId` under the owner-only rule, so nothing is lost. |
| 3 | T3 order key → params → body | (a) | The design does not fix the order inside T3. |
| 4 | Decision T6 order mismatch → self → limit | (a) | Matches the listing order in design `:317`. |
| 5 | Quarantine via column DEFAULT | (a), with hardening | SQLite needs a DEFAULT to add a NOT NULL column to a populated table, so the mechanism is fine. The "fail-closed" claim (`SPECS:323`) is really fail-*silent*: a buggy INSERT would vanish into quarantine. Optionally add a `BEFORE INSERT ON expenses WHEN NEW.tenant_id = 'legacy:seed' RAISE(ABORT)` trigger after the migration, and reword the claim. |
| 6 | Extra `audit_events_tenant_match` trigger | (a) | Harmless defense in depth. |
| 7 | 413/415 → 400 | **(b) escalate** | Goes beyond the "malformed JSON" evaluator feedback and contradicts `docs/TODO.md:17` while P8.5 marks it done. See M2. |
| 8 | Exact error message strings | (a) | Stable and non-echoing. |

None of the 8 is category (c).
