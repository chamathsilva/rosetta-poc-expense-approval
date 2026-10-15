# TODO

Purpose: backlog of technical improvement notes found by agents or humans; not product requirements and not a work log.
Each entry: `###` header "priority | when | what | where", then a short body with details and links (e.g. to `docs/ASSUMPTIONS.md`).
Priority: P1 (blocking) / P2 (should) / P3 (nice to have). Remove or mark `[DONE YYYY-MM-DD]` when addressed.
Style: terse, one entry per item, grep-friendly. Do not act on entries without an approved requirement or user request.

## Open

### P3 | when the study needs remote verification | Add CI running `npm run check` | .github/workflows/
- No CI today by design (local-only POC). See ASSUMPTIONS A6.

### P3 | when readiness matters | Make /health probe the database | src/app.ts
- README calls it "API and database readiness" but handler returns static `ok`. See ASSUMPTIONS A8.

### P3 | with human approval only | Document all error codes in baseline API doc | docs/BASELINE-API.md
- `EXPENSE_DECISION_CONFLICT`, `ROUTE_NOT_FOUND`, `INTERNAL_ERROR`, plus the full EXP-003 catalog, are missing. File is human-owned; `docs/BASELINE-API.md` gets zero edits by default (Phase 6 author instruction). See ASSUMPTIONS A9 and `docs/EXP-003-COMPATIBILITY.md`.

### P3 | when the retention policy is revisited | Add a tombstone purge job | src/database.ts, src/expense-service.ts
- Expired tombstones are retained indefinitely in this POC (no purge endpoint or job). See `docs/EXP-003-COMPATIBILITY.md` (Accepted limitations) and SPECS S14.

### P3 | when idempotency storage is revisited | Add idempotency-record expiry | src/idempotency-repository.ts, src/database.ts
- `idempotency_records` rows are kept indefinitely (POC; SPECS S6.2). No expiry/cleanup mechanism exists.

### P3 | when audit needs to be surfaced | Add an audit read API | src/audit-repository.ts, src/app.ts
- `AuditRepository.listForExpense` exists for tests/review only; no HTTP route reads audit history. Out of scope per SPECS S2 ("Out").

### P3 | when docs/PATTERNS/ is next regenerated | Regenerate docs/PATTERNS/ for new EXP-003 patterns | docs/PATTERNS/
- New patterns introduced by EXP-003 are not yet captured as pattern files: the `ServiceResult`/returned-denial shape (`src/errors.ts`, `src/expense-service.ts`), `withTransaction`'s synchronous unit-of-work (`src/transaction.ts`), and the 9-tier request pipeline (`src/expense-service.ts`, SPECS S4). `docs/PATTERNS/INDEX.md` is auto-generated — do not hand-edit it; regenerate through Rosetta's codemap/pattern workflow.
- Also noted: `docs/PATTERNS/structured-error-response.md:5` still says `errorBody`/`validationError` live in `src/app.ts`; they moved to `src/errors.ts` (Phase 8 review finding 1).

## Done

### P3 | when future work changes the expenses table | Decide schema migration approach | src/database.ts [DONE 2026-10-14]
- Resolved: `PRAGMA user_version` migrations (0→1 verbatim seed DDL, 1→2 EXP-003 tenancy/audit/idempotency) preserve existing rows; no reset. See `docs/ARCHITECTURE.md` (Persistence), ASSUMPTIONS A7.

### P3 | when error handling is next touched | Preserve 4xx status for framework errors | src/app.ts setErrorHandler [DONE 2026-10-14]
- Resolved: `bodyParserErrorResult` (`src/errors.ts`) maps Fastify body-parser error codes to their native 400/413/415 status instead of a flattened 500. See `docs/ARCHITECTURE.md` (Error Model), ASSUMPTIONS A10.
