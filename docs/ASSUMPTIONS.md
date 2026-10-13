# ASSUMPTIONS

Purpose: register of unverified assumptions and open unknowns that affect how agents work in this repo.
Each entry: `###` header with ID and short title, then the assumption, evidence, confidence (High/Medium/Low), and target file to update once resolved.
Style: one entry per unknown, terse, grep-friendly. When resolved, move the fact into the target file and mark the entry `[RESOLVED YYYY-MM-DD]`; do not delete history.

## Open

### A1 Future requirements extend the existing expense domain
- Assumption: upcoming requirements build on this service, stack, and domain rather than replacing them.
- Evidence: README frames the seed as the shared starting point; no requirements in repo yet.
- Confidence: Medium
- Resolve in: `docs/CONTEXT.md`, `agents/IMPLEMENTATION.md`; `docs/REQUIREMENTS/INDEX.md` once requirements authoring starts (does not exist yet — not created by this init phase, requirements are out of scope until a future session)

### A2 Baseline behavior is a contract to preserve
- Assumption: behavior in `docs/BASELINE-API.md` and `tests/app.test.ts` must keep working unless a requirement explicitly changes it.
- Evidence: README "documents only the behavior present in the neutral starter"; tests pin exact responses.
- Confidence: Medium
- Resolve in: `docs/CONTEXT.md`, `docs/ARCHITECTURE.md`

### A3 Built-in node:sqlite is a deliberate choice
- Assumption: persistence intentionally uses Node's built-in `node:sqlite` (`DatabaseSync`); no SQLite driver or ORM npm package should be added.
- Evidence: zero SQLite packages in `package.json`; Node >= 24 required; TECHSTACK records "no SQLite npm package".
- Confidence: High
- Resolve in: `docs/ARCHITECTURE.md` (Persistence), `docs/TECHSTACK.md`

### A4 No authentication or authorization is intentional
- Assumption: caller-supplied `employeeId` / `reviewerId` with no identity or role checks (including self-approval) is a deliberate seed simplification.
- Evidence: no auth code or dependency; README lists no auth capability.
- Confidence: Medium
- Resolve in: `docs/CONTEXT.md` (Actors), `docs/ARCHITECTURE.md`

### A5 Decisions are final and deletion is deliberately absent
- Assumption: no edit, withdraw, reopen, or delete exists on purpose.
- Evidence: test "does not expose an expense deletion route in the starter"; 409 `EXPENSE_ALREADY_DECIDED`.
- Confidence: High (baseline); unknown for future scope
- Resolve in: `docs/CONTEXT.md` (Expense Lifecycle)

### A11 Currency handling is format-only, no conversion
- Assumption: any three uppercase letters are accepted (not checked against ISO 4217); amounts are minor units per currency; the 100,000,000 cap applies regardless of currency; no conversion or aggregation across currencies.
- Evidence: `currency` regex `^[A-Z]{3}$`; DB `length(currency) = 3`.
- Confidence: Medium
- Resolve in: `docs/CONTEXT.md` (Business Rules)

### A12 Timestamps are UTC ISO-8601 strings
- Assumption: all stored timestamps are UTC ISO strings, so lexicographic `ORDER BY updated_at` equals chronological order.
- Evidence: default `now` = `new Date().toISOString()`; tests inject same format.
- Confidence: High
- Resolve in: `docs/ARCHITECTURE.md` (Persistence)

### A13 Single-process deployment
- Assumption: one process owns the SQLite file; no horizontal scaling or concurrent writers beyond the guarded decision update.
- Evidence: synchronous `DatabaseSync`, local file default, no hosting config.
- Confidence: Medium
- Resolve in: `docs/ARCHITECTURE.md` (Overview)

## Resolved

### A14 Seed tag lives on the remote [RESOLVED 2026-10-12]
- Resolution: confirmed via `git ls-remote origin 'refs/tags/expense-seed-v1*'` — tag exists, dereferences to commit `34f08e4`. Fact now implicit in `agents/IMPLEMENTATION.md` (Baseline State).

### A6 Absence of CI, linter, formatter, container is intentional [RESOLVED 2026-10-12]
- Resolution: evaluator supplied the seed-only tooling boundary — local-only POC, no CI, do not invent tooling. Recorded in `gain.json` and `docs/ARCHITECTURE.md` (Build and Quality Gate).

### A7 Ignore status does not authorize database reset [RESOLVED 2026-10-12]
- Resolution: evaluator clarified ignored/disposable status is NOT authorization to delete or reset data. Migration/reset remains an explicit future approval. The missing migration mechanism is a known limitation; the initial unsafe assumption is retained privately.

### A8 Health endpoint is liveness, not a DB probe [RESOLVED 2026-10-12]
- Resolution: evaluator selected recording the mismatch without changing the frozen README. Static liveness behavior is documented in `docs/ARCHITECTURE.md` (Health).

### A9 Undocumented error codes are part of the contract [RESOLVED 2026-10-12]
- Resolution: evaluator selected leaving `docs/BASELINE-API.md` unchanged; the three codes are documented in `docs/ARCHITECTURE.md` (Error Model) instead.

### A10 Malformed JSON bodies return 500, not 400 [RESOLVED 2026-10-12]
- Resolution: actor inferred this from `src/app.ts`; evaluator independently confirmed it with an in-memory built-seed probe and selected record-only/no seed fix. See `docs/ARCHITECTURE.md` (Error Model). No successful actor-run probe is claimed.
