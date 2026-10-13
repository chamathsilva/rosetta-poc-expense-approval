# TODO

Purpose: backlog of technical improvement notes found by agents or humans; not product requirements and not a work log.
Each entry: `###` header "priority | when | what | where", then a short body with details and links (e.g. to `docs/ASSUMPTIONS.md`).
Priority: P1 (blocking) / P2 (should) / P3 (nice to have). Remove or mark `[DONE YYYY-MM-DD]` when addressed.
Style: terse, one entry per item, grep-friendly. Do not act on entries without an approved requirement or user request.

## Open

### P3 | when future work changes the expenses table | Decide schema migration approach | src/database.ts
- Schema is applied with `CREATE TABLE IF NOT EXISTS`; altered columns won't reach existing DB files.
- Choose an explicit compatibility/migration strategy that preserves existing data. Any proposed destructive reset is a separate approval decision; ignored/disposable status is not authorization. See ASSUMPTIONS A7.

### P3 | when the study needs remote verification | Add CI running `npm run check` | .github/workflows/
- No CI today by design (local-only POC). See ASSUMPTIONS A6.

### P3 | when error handling is next touched | Preserve 4xx status for framework errors | src/app.ts setErrorHandler
- Handler forces 500 for every thrown error; confirmed malformed JSON returns 500 `INTERNAL_ERROR`, not 400. Known quirk, not fixed in the frozen seed. See ASSUMPTIONS A10.

### P3 | when readiness matters | Make /health probe the database | src/app.ts
- README calls it "API and database readiness" but handler returns static `ok`. See ASSUMPTIONS A8.

### P3 | with human approval only | Document all error codes in baseline API doc | docs/BASELINE-API.md
- `EXPENSE_DECISION_CONFLICT`, `ROUTE_NOT_FOUND`, `INTERNAL_ERROR` are missing. File is human-owned. See ASSUMPTIONS A9.

## Done

### [Priority] | [when] | [what] | [where] [DONE YYYY-MM-DD]
- [Details]
