# ASSUMPTIONS

**Purpose**: register every inference this workspace's documentation rests on that a human has not yet confirmed. Prevents an inferred detail from hardening into a stated fact.
**Contains**: one `###` entry per assumption — what is assumed, why, confidence, and the document that absorbs it once confirmed.
**Excludes**: confirmed facts (they belong in the target doc), and work items (they belong in `TODO.md`).
**Style**: `### <assumption> — <HIGH|MEDIUM|LOW>`, then Basis / Risk if wrong / Resolves to. Remove an entry when resolved; do not archive it here.
**Maintenance**: revalidate after any change to `CONTEXT.md`, `ARCHITECTURE.md`, or `PATTERNS/`.

## Domain

### A decision is irreversible by design, with no reopen or correction path intended — HIGH

- Basis: enforced in two places (app-layer pre-check and the SQL `WHERE status = 'SUBMITTED'` guard), asserted by test, and documented in `BASELINE-API.md`.
- Risk if wrong: low. Double enforcement plus a test makes accidental intent unlikely.
- Resolves to: `CONTEXT.md` § Business Rules.

### `expenseId` is opaque to clients and its format is not part of the contract — MEDIUM

- Basis: production uses `randomUUID`, tests inject `expense-1`, and the param schema accepts any 1–100 character string rather than a UUID. Nothing validates UUID shape.
- Risk if wrong: a consumer depends on UUID format, or a future change to the id factory silently breaks it.
- Resolves to: `BASELINE-API.md` § Validation.

## Architecture

### `EXPENSE_DECISION_CONFLICT` is a race-condition guard, not a reachable contract in single-threaded use — HIGH

- Basis: the app-layer pre-check intercepts every already-decided case in sequential use, so the SQL-guard branch only fires when a concurrent writer wins. It is documented in neither `BASELINE-API.md` nor README, unlike the other error codes, and no test covers it.
- Risk if wrong: someone removes the branch as dead code and loses the correctness boundary.
- Resolves to: `ARCHITECTURE.md` § Concurrency Invariant.

### Synchronous `node:sqlite` is acceptable for the expected load and is not a placeholder for an async driver — MEDIUM

- Basis: chosen with zero external dependencies on Node >=24; every repository method is sync while handlers are `async`, so each query blocks the event loop. Fine for a disposable starter, not an obvious production choice.
- Risk if wrong: an agent swaps in an async driver and changes every repository signature, diverging from the baseline.
- Resolves to: `ARCHITECTURE.md` § Persistence.

### Schema evolution is intended to happen by editing the `CREATE TABLE` DDL, with no migration tool planned — MEDIUM

- Basis: `database.ts` runs idempotent `IF NOT EXISTS` DDL on every open; there is no migrations directory, version table, or migration dependency. Works only because no deployed database needs altering.
- Risk if wrong: a column added to the DDL silently fails to apply to an existing `data/expenses.sqlite`, producing confusing runtime errors.
- Resolves to: `ARCHITECTURE.md` § Persistence. Tracked in `TODO.md`.

## Patterns and Conventions

### The ten catalogued patterns are project-wide conventions, not incidental repetition within one file — LOW

- Basis: carried from Phase 5. The repo has one route module and one repository, so several patterns (structured error shape, validation guard, prepared statements) are extrapolated from 2–4 call sites inside a single file rather than from cross-module recurrence.
- Risk if wrong: an agent enforces a single-file habit as a project rule across new modules where it does not fit, or the "starter" nature means the conventions were never meant to scale.
- Resolves to: `PATTERNS/INDEX.md`. Needs human confirmation — flagged for Phase 8.

### The two test patterns are meant to be extracted to a shared helper once a second test file appears — MEDIUM

- Basis: carried from Phase 5. `createTestApp()` and the cleanup registry live inside `tests/app.test.ts` with no `tests/helpers.ts`. The cleanup registry is module-scoped, so a second file would get its own copy and the two would diverge silently.
- Risk if wrong: duplicated, drifting test setup; or premature extraction adds indirection the starter does not want.
- Resolves to: `ARCHITECTURE.md` § Testing. Tracked in `TODO.md`.

### Single-occurrence idioms in `server.ts` are patterns-in-waiting, not one-offs — LOW

- Basis: carried from Phase 5. Env validation via a Zod schema over `process.env`, and the Fastify `onClose` / SIGINT / SIGTERM lifecycle handling, each appear exactly once, below the two-occurrence bar for the catalogue.
- Risk if wrong: a second entrypoint or worker process is written without them, diverging on config handling and shutdown.
- Resolves to: `PATTERNS/INDEX.md` if a second entrypoint is added.

