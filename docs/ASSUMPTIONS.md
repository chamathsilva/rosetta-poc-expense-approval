# ASSUMPTIONS

Purpose: register of unverified assumptions and open unknowns that affect how agents work in this repo.
Each entry: `###` header with ID and short title, then the assumption, evidence, confidence (High/Medium/Low), and target file to update once resolved.
Style: one entry per unknown, terse, grep-friendly. When resolved, move the fact into the target file and mark the entry `[RESOLVED YYYY-MM-DD]`; do not delete history.

## Open

### A11 Currency handling is format-only, no conversion — open limitation
- Assumption: any three uppercase letters are accepted (not checked against ISO 4217); amounts are minor units per currency; the 100,000,000 cap applies regardless of currency; no conversion or aggregation across currencies.
- Evidence: `currency` regex `^[A-Z]{3}$`; DB `length(currency) = 3`.
- EXP-003 note (2026-10-14): confirmed unchanged — the manager approval limit (`MANAGER_APPROVAL_LIMIT_CENTS = 100_000`, `src/policy.ts:3`) compares minor units regardless of currency, with no conversion. This is a documented limitation, not planned to be fixed; see `docs/EXP-003-COMPATIBILITY.md`.
- Confidence: Medium
- Resolve in: `docs/CONTEXT.md` (Decision Policy)

## Resolved

### A14 Seed tag lives on the remote [RESOLVED 2026-10-12]
- Resolution: confirmed via `git ls-remote origin 'refs/tags/expense-seed-v1*'` — tag exists, dereferences to commit `34f08e4`. Fact now implicit in `agents/IMPLEMENTATION.md` (Baseline State).

### A6 Absence of CI, linter, formatter, container is intentional [RESOLVED 2026-10-12]
- Resolution: evaluator supplied the seed-only tooling boundary — local-only POC, no CI, do not invent tooling. Recorded in `gain.json` and `docs/ARCHITECTURE.md` (Build and Quality Gate).

### A7 Ignore status does not authorize database reset [RESOLVED 2026-10-12]
- Resolution: evaluator clarified ignored/disposable status is NOT authorization to delete or reset data. Migration/reset remains an explicit future approval. The missing migration mechanism is a known limitation; the initial unsafe assumption is retained privately.
- EXP-003 note (2026-10-14): a `user_version` migration mechanism now exists (`src/database.ts`, migrations 0→1, 1→2) and preserves all pre-existing rows; no reset was performed. Legacy (tenantless) rows are quarantined under `legacy:seed`, never deleted. See `docs/ARCHITECTURE.md` (Persistence).

### A8 Health endpoint is liveness, not a DB probe [RESOLVED 2026-10-12]
- Resolution: evaluator selected recording the mismatch without changing the frozen README. Static liveness behavior is documented in `docs/ARCHITECTURE.md` (Health).

### A9 Undocumented error codes are part of the contract [RESOLVED 2026-10-12]
- Resolution: evaluator selected leaving `docs/BASELINE-API.md` unchanged; the three codes are documented in `docs/ARCHITECTURE.md` (Error Model) instead.

### A10 Malformed JSON bodies return 500, not 400 [RESOLVED 2026-10-12]
- Resolution: actor inferred this from `src/app.ts`; evaluator independently confirmed it with an in-memory built-seed probe and selected record-only/no seed fix. See `docs/ARCHITECTURE.md` (Error Model). No successful actor-run probe is claimed.
- EXP-003 note (2026-10-14): superseded. Malformed JSON, an empty JSON body with `Content-Type: application/json`, and a Content-Length mismatch now return 400 `VALIDATION_ERROR` (evaluator feedback accepted under AC-011); oversize and unsupported-media-type bodies return their native 413/415. Verified `src/errors.ts:138-176`. See `docs/EXP-003-COMPATIBILITY.md` break #8.

### A1 Future requirements extend the existing expense domain [RESOLVED 2026-10-14]
- Original assumption: upcoming requirements build on this service, stack, and domain rather than replacing them.
- Resolution: EXP-003 extends the same service, stack and domain (tenancy, roles, audit, idempotency, lifecycle added to the same Fastify/Zod/`node:sqlite` service). Fact recorded in `docs/CONTEXT.md` and `agents/IMPLEMENTATION.md`.

### A2 Baseline behavior is a contract to preserve [RESOLVED 2026-10-14]
- Original assumption: behavior in `docs/BASELINE-API.md` and `tests/app.test.ts` must keep working unless a requirement explicitly changes it.
- Resolution: baseline preserved except for the 8 documented breaks (`docs/EXP-003-COMPATIBILITY.md`) and the error-model changes in `docs/ARCHITECTURE.md`. Do not assume permission to append to `docs/BASELINE-API.md` — it stays human-owned and unedited (A9, Phase 6 author instruction).

### A4 No authentication or authorization is intentional [RESOLVED 2026-10-14]
- Original assumption: caller-supplied `employeeId`/`reviewerId` with no identity or role checks is a deliberate seed simplification.
- Resolution: superseded by simulated header auth (`x-tenant-id`/`x-user-id`/`x-role`) plus RBAC (`src/actor.ts`, `src/policy.ts`) — explicitly **not** production authentication. Fact recorded in `docs/CONTEXT.md` (Actors and Simulated Auth) and `docs/ARCHITECTURE.md`.

### A5 Decisions are final and deletion is deliberately absent [RESOLVED 2026-10-14]
- Original assumption: no edit, withdraw, reopen, or delete exists on purpose.
- Resolution: decisions stay final (unchanged). Deletion is now an owner-only logical tombstone of a `SUBMITTED` expense, restorable within a half-open 30-day window, never purged. Fact recorded in `docs/CONTEXT.md` (Expense Lifecycle).

### A12 Timestamps are UTC ISO-8601 strings [RESOLVED 2026-10-14]
- Original assumption: all stored timestamps are UTC ISO strings, so lexicographic `ORDER BY updated_at` equals chronological order.
- Resolution: confirmed and now also load-bearing for restore-window arithmetic (`Date.parse` difference in `src/policy.ts:146-157`) and audit `occurred_at`, not just list ordering — an injected `now` must return UTC ISO or restore-window math and ordering both break. Recorded in `docs/ARCHITECTURE.md` (Persistence).

### A13 Single-process deployment [RESOLVED 2026-10-14]
- Original assumption: one process owns the SQLite file; no horizontal scaling or concurrent writers beyond the guarded decision update.
- Resolution: confirmed as a documented constraint. Correctness relies on a single process plus synchronous `BEGIN IMMEDIATE` transactions (`src/transaction.ts`); a foreign writer holding a conflicting lock causes `SQLITE_BUSY`, which surfaces as 500 `INTERNAL_ERROR`, not a retry. Recorded in `docs/ARCHITECTURE.md` (Overview).

### A3 Built-in node:sqlite is a deliberate choice — unchanged, still holds
- No change from the original entry: persistence intentionally uses Node's built-in `node:sqlite` (`DatabaseSync`); no SQLite driver or ORM npm package has been added.
