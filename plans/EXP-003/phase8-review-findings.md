# Phase 8 (Review Code) Findings — EXP-003

Date: 2026-10-14. Independent reviewer subagent (claude-sonnet-5, fresh context, no prior-session
knowledge). Scope: Phase 7 `src/` implementation diff against `plans/EXP-003/EXP-003-SPECS.md`,
`plans/EXP-003/EXP-003-PLAN.md` P0–P5, and the approved design
(`plans/EXP-003/architecture-notes.md` Revision 2 + evaluator consistency reconciliation).

**Process note (added 2026-10-14, after this review ran):** per PLAN.md's "File Ownership and
Sequencing", P8 Pass 1 documentation should have been drafted *before* this review, so the
reviewer would have seen updated docs alongside the code. That step was skipped by the
orchestrator; this review proceeded on `src/` alone, which is still valid as a code review, but
is out of the plan's prescribed order. See the ledger `agents/TEMP/EXP-003/coding-flow-state.md`
Phase 10 row for the workflow finding. A supplemental documentation-focused review is being
commissioned separately rather than re-running this one.

Preserved verbatim below as received from the subagent.

---

## TLDR verdict: **approve-with-minor-fixes**

Phase 7 implementation is a faithful, high-fidelity realization of EXP-003-SPECS/PLAN. I found zero critical defects and zero major defects after a line-by-line pass through all 12 touched/new `src/` files against S4-S14, the PLAN P0-P5 steps, and the architecture-notes.md Design Review Revision 2 + evaluator reconciliation. Two minor, non-blocking observations below. The ledger's Phase 7 self-report is accurate on every point I independently checked (it did not overclaim).

## Critical findings (block Phase 9)
None.

## Major findings (should fix before Phase 10)
None.

## Minor findings (nice-to-have)

1. **Stale pattern doc location reference** — `docs/PATTERNS/structured-error-response.md:5` still says `errorBody`/`validationError` live in `src/app.ts`; they moved to `src/errors.ts` per SPECS S5.7/m2 (confirmed `src/errors.ts:109,125`, and `src/app.ts:8` now imports them). This is pre-existing content, `docs/PATTERNS/` has zero diff this phase (confirmed), and PLAN P8.5 explicitly defers "regenerate `docs/PATTERNS/` for new patterns" to a backlog item — so this is correctly out of Phase 7 scope, not a defect introduced by this phase. Flagging only so it isn't forgotten at the P8.5 documentation pass.

2. **Defensive dead-code branch in `parseIdempotencyKey`** — `src/schemas.ts:35-37` checks `Array.isArray(value)`, but Node's default header handling joins duplicate non-array-type headers (like `idempotency-key`) with `", "` into a single string rather than producing an array; `string[]` only occurs for headers Node treats specially (e.g. `set-cookie`). The branch is therefore likely unreachable via real HTTP traffic today, but it is explicitly licensed by SPECS S5.6 ("array ... ⇒ INVALID") as defense-in-depth against the declared input type `string | string[] | undefined`, so this is a judgment call, not a bug — noting for awareness only.

## Per-checklist-item disposition

1. **Tier order per route — PASS.** Verified route-by-route in `src/expense-service.ts`:
   - `list()` (lines 25-30): no tiers beyond T1 (handled in `app.ts`/`actor.ts`), matches table (all dashes).
   - `get()` (32-44): T4 `findInTenant` (33) → T4b `canViewExpense` (39), matches table.
   - `create()` (46-133): T5 `authorizeRole` (55) → T6 `authorizeCreate` (62) → T7 idempotency (69-93) → T9 (96-131); no T4/T4b/T8 called, matching the table's dashes for `POST /expenses`.
   - `decide()` (135-245): T4 (145) → T4b (152) → T5 (157) → T6 `authorizeDecision` (164) → T7 (174-197) → T8 `decisionStateCheck` (200) → T9 (207-241). Exact match to table.
   - `delete()` (247-345): T4 (257) → T5 (264) → T6 `authorizeOwnerMutation` (271, T4b correctly skipped) → T7 (278-297) → T8 `deleteStateCheck` (300) → T9 (307-341).
   - `restore()` (347-444): same shape as delete, T8 is `restoreStateCheck(expense, now)` (402).
   - App-layer T1→T2→T3 order: `registerActorHook` runs as Fastify `onRequest` (`src/actor.ts:24`), which precedes body parsing in the Fastify lifecycle, and short-circuits via `reply.send()` before parsing ever runs — confirms T1 precedes T2 (S13). Route handlers call `requireActor` → `parseIdempotencyKey` (key) → params → body in that exact order (e.g. `src/app.ts:94-125` for decide), matching S5.12's "key → params → body."

2. **tenant_id binding — PASS.** `src/expense-repository.ts`: `listVisible` (118), `findInTenant` (134), `decide` (152), `tombstone` (180), `restore` (207) — every SELECT/UPDATE WHERE clause binds `tenant_id = ?`. No `findById`/unscoped `list` exist in the file (grepped; only `findInTenant`/`listVisible` present).

3. **NOT_EXPENSE_OWNER reachable — PASS.** `src/policy.ts:103-110` (`authorizeOwnerMutation`) returns the denial by value, never throws; called at T6 in both `delete()` (`src/expense-service.ts:271`) and `restore()` (371), strictly after the tenant-bound T4 existence check and before any idempotency/state tier — never folded into the T4/404 path.

4. **ACTOR_MISMATCH reachable, charset-robust — PASS.** `authorizeCreate` (`src/policy.ts:62-74`) and the `reviewerId` branch of `authorizeDecision` (76-86) use plain strict inequality against `actor.userId`; since `actor.userId` is guaranteed to match the identifier charset (`src/actor.ts:7-13`) and the body field has no such charset constraint (`src/schemas.ts:4,12` — only trim/length), any out-of-charset body id (e.g. `"employee 1"`) simply fails the equality test and falls through to `ACTOR_MISMATCH`. No coercion/normalization occurs anywhere in the comparison path.

5. **`transaction.ts` matches S11 — PASS.** `src/transaction.ts`: nesting check before any SQL (31-35, `database.isTransaction` tested before `BEGIN IMMEDIATE`), `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK` exactly per S11 steps 2-3 (37, 60, rollback via `rollbackSwallowingFailure` at 19-25), thenable backstop throws `TypeError` and still rolls back (51-57). The `NotPromise<T>` type (line 5: `T extends PromiseLike<unknown> ? never : T`) is verbatim the SPECS S5.4 signature, not weakened to `work: () => T`.

6. **now()/idFactory()/same-transaction/denial-vs-throw — PASS.** In every mutation method, `const now = this.deps.now();` is the literal first statement inside the `withTransaction` callback (`src/expense-service.ts:52,142,253,353`). `idFactory()` appears only once, inside `create()`'s T9 write (97). State write + `audit.append` + `idempotency.save` all occur inside the same `work()` closure for every mutation. Denials use `return errorResult(...)` throughout (never throw) — the only two `throw` sites are the delete/restore "guarded UPDATE matched zero rows" invariant backstops (318, 417), both of which are genuinely unreachable in normal single-process operation given the preceding state checks, and both are explicitly documented as such in SPECS S5.5/S5.8 and inline comments. I judge these correctly modeled as invariant violations, not secretly-reachable business logic — the repository SQL predicates (`status = 'SUBMITTED' AND deleted_at IS NULL`/`IS NOT NULL`) exactly mirror the policy checks that ran immediately before, so a mismatch can only occur from a programming error or impossible concurrent mutation outside this single process.

7. **Idempotency — PASS.** `canonicalJson` (`src/idempotency-repository.ts:86-120`) matches S10 exactly: primitives via `JSON.stringify`, finite-number guard (96-98, throws on non-finite), arrays joined manually, objects with `undefined`-dropped keys sorted via default `.sort()` (UTF-16 code-unit order per spec) and emitted with no whitespace. `requestFingerprint` (122-135) hashes `{v:1, method, route, expenseId, role, command}` exactly per S10, with `command` resolving identity fields to `actor.userId`/`actor.role` in the service layer (e.g. `src/expense-service.ts:74-79` for create, 179-184 for decide) — not from raw input. `find()` (`src/idempotency-repository.ts:41-53`) scopes its SQL WHERE by `tenant_id`/`actor_user_id`/`idempotency_key` together, so the tenant/actor boundary is structurally enforced *before* any record can be returned, not as an after-the-fact filter — a cross-tenant or cross-actor retry simply finds no record (and in practice is intercepted earlier at T4 by `findInTenant` 404ing first, for resource-targeted routes). Mismatched fingerprint on a reused key → `IDEMPOTENCY_KEY_CONFLICT` (409) at each call site (e.g. 92, 196, 296, 396). `save()` is a plain INSERT with no `OR REPLACE`/UPSERT (55-75) — PK collision will throw, matching "no accidental overwrite."

8. **Restore window — PASS.** `src/policy.ts:146-158`: `Number.isNaN(elapsed)` throws (149-151) before the negative check; `elapsed < 0` throws separately with a distinct message (153-155), never treated as "open." Boundary: `return elapsed < RESTORE_WINDOW_MS` (157) — strict less-than gives the exact half-open `[0, 30d)` domain (elapsed === RESTORE_WINDOW_MS at exactly 30 days evaluates false → closed, matching human decision 3 literally). `RESTORE_WINDOW_MS = 2_592_000_000` (line 4) = `30 * 86_400_000` exactly, per inline comment and arithmetic check.

9. **restoreStateCheck / repository backstop — PASS.** `src/policy.ts:130-137`: non-SUBMITTED tombstoned row returns `denied("EXPENSE_NOT_DELETED")` (136) — a `return`, not a throw, with the same stable code the spec mandates, in the exact order (deletedAt-null check first, then status check, then window). `src/expense-repository.ts:207`: `restore()`'s UPDATE WHERE clause independently adds `AND status = 'SUBMITTED'` alongside `deleted_at IS NOT NULL` — a genuine second control, not merely delegating to the service-layer check.

10. **Body-parser error mapping — PASS.** `src/errors.ts:138-176`: `BODY_PARSE_400_CODES` is an explicit `Set` of exact Fastify codes (`FST_ERR_CTP_INVALID_JSON_BODY`, `FST_ERR_CTP_EMPTY_JSON_BODY`, `FST_ERR_CTP_INVALID_CONTENT_LENGTH`) checked via `.has()` (155) — an allow-list by exact match, not a prefix/substring test. `FST_ERR_CTP_BODY_TOO_LARGE` → 413 (167-169), `FST_ERR_CTP_INVALID_MEDIA_TYPE` → 415 (171-173), anything else → `undefined` → caller's 500 path. `src/app.ts:195-205`: `setErrorHandler` calls `bodyParserErrorResult` and falls back to 500 `INTERNAL_ERROR` only when it returns `undefined`. 401-precedence confirmed structurally: `registerActorHook` is an `onRequest` hook (`src/actor.ts:24`) and Fastify's body-content-type parsing runs later in the lifecycle (after `onRequest`), and a `reply.send()` inside `onRequest` short-circuits the rest of the pipeline — so a request that is both unauthenticated and malformed-bodied never reaches the body parser at all.

11. **Legacy quarantine — PASS.** `src/database.ts:32` sets the DEFAULT `'legacy:seed'` on migration; `src/database.ts:37-39` creates `expenses_no_quarantine_insert` as a genuine `BEFORE INSERT ... WHEN NEW.tenant_id = 'legacy:seed' ... RAISE(ABORT, ...)` trigger — a hardening trigger that aborts the write (not a silently-misfiring DEFAULT alone), matching S6.1/S6.2 exactly. No migration step deletes or rewrites any row's identity; the `ALTER TABLE ADD COLUMN` statements only add columns (32-34).

12. **No new dependency — PASS.** `git diff --stat -- package.json package-lock.json tsconfig.json tsconfig.test.json` returned empty output.

13. **Scope discipline — PASS.** `git diff --stat -- tests/ docs/ agents/IMPLEMENTATION.md` returned empty output; `git status --short` shows no changes under those paths (only `plans/EXP-003/*`, `src/*`, and the new `plans/EXP-003/evidence/` dir, which is explicitly PLAN-sanctioned evidence storage, not test/doc/implementation-record work).

14. **Scope creep / missing P0-P5 scope — PASS, none found either direction.** Every file listed in SPECS S15 "New"/"Changed" for the `src/` set is present and matches its contract exactly (no extra public methods, no extra routes, no extra error codes beyond S8's catalog — verified `ErrorCode` union in `src/errors.ts:8-29` against S8's table 1:1). I found no functionality implemented beyond P0-P5's remit (e.g., no audit-read route, no purge endpoint, no pagination — all correctly absent per S2 "Out" scope), and no P0-P5 item left undone (P0 probe evidence confirms all 10 S11 facts PASS at `plans/EXP-003/evidence/P0-sqlite-runtime.txt`; P1-P5 files all present and wired).

15. **General code quality — PASS, no embarrassing issues found.** Naming is consistent with `docs/PATTERNS/typed-row-field-extraction.md` and `docs/PATTERNS/domain-entity-input-variants.md` conventions (runtime-guarded row mappers with `requiredString`/`nullableString`/`requiredNumber` helpers repeated consistently across `expense-repository.ts`, `audit-repository.ts`, `idempotency-repository.ts`). `errorBody`/`validationError` relocation into `errors.ts` is clean with no circular import (verified `errors.ts` imports only `type { ZodError }` from `zod`). Pinned `npm run build` (tsc) completes with zero errors under the pinned Node v24.21.0/npm 11.6.2 toolchain. I found no obvious logic bugs, no unhandled edge cases beyond the two minor notes above, and no behavior that would embarrass the team on a close read.

## Could not verify

- **Runtime HTTP behavior** (actual tier firing under `inject`, e.g. exact precedence races, replay byte-equality, trigger fault-injection outcomes) — this requires the Phase 11 test suite (`tests/`), which this review was explicitly scoped NOT to touch or run (`tests/` is out of scope for Phase 7/8; `npm test` was correctly not run per the task's instructions since the test suite has not been migrated yet). All findings above are from static code reading plus the pinned `npm run build` typecheck, not from executing the server. (Orchestrator note: this gap was subsequently covered by the Phase 9 validator — see `phase9-validation-findings.md`.)
- **The P0 scratch-probe script's own correctness** (`agents/TEMP/EXP-003/sqlite-runtime-probe.mjs`) — I read its recorded output (`plans/EXP-003/evidence/P0-sqlite-runtime.txt`, all 10 facts PASS) but did not re-run it myself; re-running was not necessary to this code review's checklist and the task scoped me to read-only review, not re-execution of probes.
- **`docs/EXP-003-COMPATIBILITY.md` and other P8 documentation artifacts** — out of this review's checklist scope (the task's 15-item checklist is `src/` implementation-focused); `docs/` has zero diff this phase per item 13, consistent with P8 Pass 1 not yet having run.

## Files referenced
- `src/transaction.ts`, `src/policy.ts`, `src/errors.ts`, `src/expense-service.ts`, `src/actor.ts`, `src/expense-repository.ts`, `src/audit-repository.ts`, `src/idempotency-repository.ts`, `src/database.ts`, `src/app.ts`, `src/domain.ts`, `src/schemas.ts`, `docs/PATTERNS/structured-error-response.md` (minor finding 1).

## Orchestrator independent spot-check (post-report)

Re-read `src/errors.ts` (`BODY_PARSE_400_CODES` set) and `src/database.ts` (`legacy:seed` DEFAULT + `expenses_no_quarantine_insert` trigger) directly — both match the reviewer's claims exactly, file:line.
