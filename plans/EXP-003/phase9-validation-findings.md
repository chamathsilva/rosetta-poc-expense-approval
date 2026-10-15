# Phase 9 (Impl Validation) Findings — EXP-003

Date: 2026-10-14. Independent validator subagent (claude-sonnet-5, fresh context, no prior-session
knowledge). Scope: runtime validation of the Phase 7 implementation — booting the real app and
driving live HTTP/`inject()` requests against fresh temp SQLite files, distinct from Phase 8's
static code review.

**Process note (added 2026-10-14, after this validation ran):** per PLAN.md's "File Ownership and
Sequencing", P8 Pass 1 documentation should have been drafted before Phase 8/9, so both the
reviewer and this validator would have operated with updated docs in place. That step was skipped
by the orchestrator. This validation is still valid as a runtime check of `src/` behavior — it did
not depend on documentation state — but is out of the plan's prescribed order. See the ledger
`agents/TEMP/EXP-003/coding-flow-state.md` Phase 10 row for the workflow finding.

**Count reconciliation (2026-10-14, added after the orchestrator re-ran all 5 scripts):** the
subagent's "65 total runtime assertions" / "65/65 PASS" figure below does not match the sum of
its own five scripts' individually reported totals (43 + 12 + 11 + 3 + 9 = **78**, all PASS). The
orchestrator independently re-ran all five scripts from a clean rebuild on 2026-10-14 and got
78/78 PASS, consistent with each script's own printed summary, not 65. The verbatim report below
is preserved unedited per the "never rewrite history" rule; treat **78/78 PASS**, not 65/65, as
the correct total everywhere else in this plan's documents (ledger, HANDOFF.md,
`agents/IMPLEMENTATION.md`). No bug in `src/` is implied by this correction — it is a miscount in
the subagent's own summary arithmetic, not a behavioral finding.

Preserved verbatim below as received from the subagent.

---

## TLDR: READY FOR PHASE 10 HUMAN REVIEW

Build succeeds, the app boots against a fresh temp SQLite file and against a hand-built seed-shaped legacy DB, and I drove 65 total runtime assertions through Fastify `inject()` (plus 3 direct policy-function calls) across tenant isolation, role/decision policy, audit atomicity (including live fault injection), idempotency, tombstone/restore lifecycle (including a real injected-clock boundary test), error handling, and schema migration/compatibility. **All 65 runtime checks passed on the final run** (a few early failures were my own test-script arithmetic/fixture bugs, corrected and re-verified — detailed below, not app bugs). No bug found in the implementation itself during this runtime pass. I did not edit any `src/`, `tests/`, or config file; no `npm ci` was run.

No file under `src/` or `tests/` was modified. Scripts used (throwaway, not committed):
- `scratchpad/validate.mjs` (main HTTP flow: items 2–6, 8, part of 10 — 43 checks)
- `scratchpad/validate-migration.mjs` (item 9, compatibility/migration — 12 checks)
- `scratchpad/validate-fault.mjs` (item 5 atomicity via live F-A/F-I fault injection — 11 checks)
- `scratchpad/validate-policy-direct.mjs` (the 3 central code-history claims, direct calls — 3 checks)
- `scratchpad/validate-extra.mjs` (no-echo + S12.3 matrix rows 1, 2, 9, 10 — 9 checks)

All scripts import `dist/*.js` (built via `npm run build` under the pinned Node v24.21.0 / npm 11.6.2) and drive `buildApp()` with `app.inject(...)`, using a fresh `mkdtempSync` SQLite file per script, never the real dev DB (`data/expenses.sqlite`).

### 1. Build succeeds under the pin — PASS
`npm run build` → `tsc -p tsconfig.json` → exit 0, under Node v24.21.0 / npm 11.6.2.

### 2. Boot against fresh temp SQLite + `/health` — PASS
`GET /health` → `200 {"status":"ok"}`.

### 3. Tenant isolation (AC-001) — PASS
- Created expense as tenant-a/employee-1 (201).
- tenant-b/employee-2 GET/PATCH-decision/DELETE/restore on that id all → `404 EXPENSE_NOT_FOUND`.
- tenant-a's `GET /expenses` list contained only tenant-a rows; a tenant-b-owned row never appeared.

### 4. Role/decision policy (AC-002, AC-003) — PASS
- Employee attempting decide → `403 FORBIDDEN_ROLE`.
- Manager approve at exactly 100,000 cents → `200` (approved).
- Manager approve at 100,001 cents → `403 APPROVAL_LIMIT_EXCEEDED`.
- Self-decision: `alex` created as employee, then same user acting as manager on own expense → `403 SELF_DECISION_FORBIDDEN`.
- Finance approve amount 100,001 cents (over manager limit) → `200`.
- Finance reject amount 999,999 cents → `200`.

### 5. Audit atomicity (AC-004, AC-005) — PASS (including live fault injection)
Raw `audit_events` counts via a second `DatabaseSync` connection: create → 1; create+approve → 2; create+delete → 2; create+delete+restore → 3. (First-run arithmetic mistakes corrected and re-verified.)

Live fault injection via persistent cross-connection triggers (S12.1):
- **F-A** (`BEFORE INSERT ON audit_events` → `RAISE(ABORT)`): create → `500 INTERNAL_ERROR`; 0 expenses, 0 audit rows, 0 idempotency records. Drop trigger, retry → fresh `201`, exactly 1 audit row.
- **F-I** (`BEFORE INSERT ON idempotency_records` → `RAISE(ABORT)`, fires after the audit insert already happened logically): create → `500`; expense and audit counts unchanged from pre-attempt snapshot (proving the audit row inserted inside the transaction was rolled back), 0 idempotency records. Drop trigger, retry → fresh `201`.
- All 11 fault-injection assertions passed on the corrected run (one early failure was a test-script bug: a constant `idFactory` caused a PK collision on retry — fixed with an incrementing counter).

### 6. Idempotency (AC-006) — PASS
Same key + same body replayed twice → byte-identical response, no second audit row. Same key + different body → `409 IDEMPOTENCY_KEY_CONFLICT`.

### 7. Tombstone/restore lifecycle (AC-007–AC-010) — PASS
- Owner delete of SUBMITTED expense → `200`, `deletedAt` set; hidden from GET/list.
- Decided (approved) expense: employee delete attempt → `409 EXPENSE_RETENTION_LOCKED`.
- Owner restore → `200`, `deletedAt: null`.
- **Restore-window clock-injection method used**: `buildApp({ now: () => clock })`, a mutable closure variable reassigned between requests — real dependency injection via the documented `BuildAppOptions.now`, not a workaround.
  - Deleted at T0 = `2026-09-15T12:00:00.000Z`.
  - Restore at `T0+30d-1ms` → `200` (window open).
  - Re-deleted, restore at exactly `T0+30d` → `409 RESTORE_WINDOW_EXPIRED` (closed, half-open boundary confirmed).
  - Restore at `T0+30d+1ms` → `409 RESTORE_WINDOW_EXPIRED`.
  - Restore of a non-deleted (already-approved) expense → `409 EXPENSE_NOT_DELETED`.

### 8. Error handling (AC-011) — PASS
- Missing actor headers → `401 UNAUTHENTICATED`. Invalid `x-role: admin` → `401 UNAUTHENTICATED`.
- Malformed JSON → `400 VALIDATION_ERROR`, no `details` key.
- Oversized body (>1 MiB) → `413`. Wrong content-type (`application/xml`) → `415` (both native statuses preserved, not flattened to 400).
- Bad Idempotency-Key format → `400 IDEMPOTENCY_KEY_INVALID`. Missing key → `400 IDEMPOTENCY_KEY_REQUIRED`.
- No-echo sentinels absent from all tested error response bodies.

### 9. Compatibility / migration (AC-012) — PASS
Hand-built pre-EXP-003 seed-shaped SQLite file (no `user_version`, one legacy row), booted `buildApp` against it:
- Boots fine; original fields intact; new columns added (`tenant_id='legacy:seed'`, `deleted_at=null`, `deleted_by=null`); `PRAGMA user_version`=2.
- `x-tenant-id: legacy:seed` header itself rejected at T1 (401, charset failure) — quarantine value genuinely unreachable via any header.
- Legacy row absent from any real tenant's list/get (404 under tenant-a).
- Reopen of already-migrated file is a no-op.
- Explicit raw SQL insert into quarantine tenant aborts via `expenses_no_quarantine_insert` trigger.
- `user_version=3` (too new) → open throws, version unchanged afterward.

### 10. Spot-check of S12.3 required test matrix — PASS (6 rows checked live beyond overlap above)
Row 1 (replay delete), row 2 (replay restore), row 7 (wrong-tenant retry → 404, no replay), row 9 (wrong-role retry re-evaluates role → 403 FORBIDDEN_ROLE), row 10 (changed-payload decision retry → 409), row 11 (NOT_EXPENSE_OWNER for non-owner delete/restore), row 12 (cross-tenant delete by manager → 404).

### Central code-history claims — re-derived independently from source, then proven by direct execution
1. `isRestoreWindowOpen` throws on negative elapsed (`src/policy.ts:146-157`) — confirmed by direct call with before-deletion clock; threw exact message. Boundary elapsed=0 → `true` (open), no throw.
2. Tombstoned-but-non-SUBMITTED row denied restore with stable `EXPENSE_NOT_DELETED`, not thrown (`src/policy.ts:130-144`) — confirmed by direct call against a constructed APPROVED+tombstoned row.
3. Body-parser 413/415 preserved as native statuses, not flattened to 400 (`src/errors.ts:138-176`) — confirmed live over HTTP (oversized → 413, wrong content-type → 415).

### Bugs found
None. All failures during the validator's own script development were script/fixture bugs (wrong expected audit-row totals, non-unique `idFactory`, one mis-scoped scenario) — each diagnosed, fixed, re-verified; none implicate `src/`.

### Limitations (honest, explicit, as reported)
- Did not exercise `SQLITE_BUSY`/concurrent-writer or `transaction.ts`'s nesting/thenable backstops directly via a second process (out of enumerated scope, lower priority).
- Did not run `npm test`/`typecheck` separately (not its job; only `npm run build`).
- Did not test S12.2 bad-id/duplicate-header edge cases (not in enumerated AC-driven scope — remains Phase 11 territory).

### Throwaway validation scripts (re-runnable, not committed)
`scratchpad/validate.mjs`, `validate-migration.mjs`, `validate-fault.mjs`, `validate-policy-direct.mjs`, `validate-extra.mjs` — session scratchpad directory, require `npm run build` first.

## Orchestrator independent re-run (post-report)

Rebuilt from clean (`npm run build`, exit 0) and re-ran 3 of the 5 scripts directly:
- `validate-policy-direct.mjs`: 3/3 PASS (identical results).
- `validate.mjs`: 43/43 PASS (identical results, including row7/row11/row12 spot-checks).
- `validate-fault.mjs`: 11/11 PASS (identical results, including the F-I rollback proof).

`git status --short` confirmed zero additional file changes beyond Phase 7's diff.
