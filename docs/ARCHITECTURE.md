# ARCHITECTURE

**Purpose**: how this workspace is built — layers, modules, contracts, data, testing, conventions. Read before writing code.
**Contains**: structure, responsibilities, boundaries, invariants, commands.
**Excludes**: business context (see `CONTEXT.md`), file inventory (see `CODEMAP.md`), API examples (see `BASELINE-API.md`), dependency versions (see `TECHSTACK.md`, `DEPENDENCIES.md`), reusable idioms (see `PATTERNS/INDEX.md`).
**Style**: terse, grep-friendly headers, no code transcription. Max 150 lines. If it grows, split into `<AREA>-ARCHITECTURE.md` and index them here.

## Shape

Single TypeScript service, one process, no network dependencies. Three layers, strictly one-directional:

```
server.ts        process entrypoint: env parsing, listen, signal shutdown
   │
app.ts           HTTP layer: routes, validation, status codes, error bodies
   │
expense-repository.ts   persistence layer: SQL, row→domain mapping
   │
database.ts      connection + schema bootstrap

domain.ts        types shared by all layers, depends on nothing
schemas.ts       client-input validation, depends on nothing
```

Rules: the repository never imports HTTP types; `app.ts` never writes SQL; `domain.ts` and `schemas.ts` are leaves. Keep it that way.

## Module Responsibilities

- **`src/server.ts`** — the only module that reads `process.env` or binds a port. Validates `DATABASE_PATH`, `HOST`, `PORT` and fails fast on bad config. Registers SIGINT/SIGTERM handlers that close the app.
- **`src/app.ts`** — `buildApp(options)` returns a configured Fastify instance and is the composition root: opens the database, constructs the repository, resolves the id factory and clock. Owns every route, the `EXPENSE_ALREADY_DECIDED` pre-check, the not-found handler, and the catch-all error handler. Closes the database on the Fastify `onClose` hook.
- **`src/expense-repository.ts`** — `ExpenseRepository` class over an open database handle. All SQL lives here. Maps snake_case rows to camelCase domain objects through guard helpers that throw on unexpected column types.
- **`src/database.ts`** — `openDatabase(path)`: creates the parent directory unless `:memory:`, opens the handle, enables foreign keys, runs idempotent `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` DDL. There is no migration tool; schema evolution means editing this DDL.
- **`src/domain.ts`** — `Expense`, `NewExpense`, `ExpenseDecision`, `ExpenseStatus`, `EXPENSE_STATUSES`. No behavior, no imports.
- **`src/schemas.ts`** — Zod schemas for request bodies and params. Narrower than the domain types on purpose: the client may not set `status`, `reviewerId`, or timestamps at creation.

## Composition and Determinism

`buildApp` takes `databasePath`, `idFactory`, `now`, and `logger`, each with a production default. This is the single seam that makes the service testable: tests inject an in-memory database, a counting id factory, and a fixed clock, so responses are byte-comparable. Nothing else in the codebase reads the wall clock or generates an id. Preserve this — adding a direct `randomUUID()` or `new Date()` call inside a route or the repository breaks test determinism.

See `PATTERNS/injected-dependencies-for-testability.md` and `PATTERNS/deterministic-test-app-factory.md`.

## Request Contract

Every route follows the same shape: `safeParse` the params and/or body, return `400 VALIDATION_ERROR` with per-field details on failure, then act. Routes are declared inline in `buildApp`; there is no router registry, plugin, or controller class.

`/health` is a liveness check only — it returns a constant body and issues no database query; a database that fails after startup still reports `ok`. Do not treat it as a readiness probe.

All failures share one body shape — `{ error: { code, message, details? } }` — including the not-found and catch-all handlers, so a client can parse errors uniformly. The catch-all deliberately discards the underlying error and returns an opaque `INTERNAL_ERROR`.

Error codes: `VALIDATION_ERROR` (400), `EXPENSE_NOT_FOUND` (404), `ROUTE_NOT_FOUND` (404), `EXPENSE_ALREADY_DECIDED` (409), `EXPENSE_DECISION_CONFLICT` (409), `INTERNAL_ERROR` (500).

`DELETE /expenses/:expenseId?tenantId=...` removes an expense scoped to its tenant. A missing expense or a `tenantId` that does not match the owning tenant both return `404 EXPENSE_NOT_FOUND` (not `403`), so a caller cannot distinguish "does not exist" from "belongs to another tenant." Success returns `204` with no body.

Routes and payload examples: `BASELINE-API.md`. Field limits are defined once, in `schemas.ts`, and mirrored in that doc.

## Persistence

- Node's built-in `node:sqlite` (`DatabaseSync`) — synchronous, no driver dependency, no connection pool. Repository methods are therefore synchronous even though route handlers are `async`.
- One table, `expenses`. Application-level constraints are duplicated as SQL `CHECK` constraints (positive amount, three-character currency, status enum) — a second line of defence against a bad write, not the primary validation.
- Every expense carries a `tenant_id`, caller-supplied at creation like `employee_id`. It is not verified against any caller identity (no auth exists); it exists solely so deletion (and only deletion, today) can be scoped: `DELETE ... WHERE id = ? AND tenant_id = ?`. List and read are not tenant-scoped.
- Index on `(updated_at DESC, id ASC)` matching the single list ordering — a stable, pagination-ready contract, not an arbitrary choice, though no pagination exists yet. Sorting the list any other way means adding an index. A secondary index on `tenant_id` supports the delete lookup.
- Every query is a prepared statement with `?` bind parameters. No string interpolation into SQL, ever.
- Timestamps are ISO-8601 strings, not numbers. Ids are strings supplied by the caller of the repository, not generated by the database.

## Concurrency Invariant

A decision is guarded twice: `app.ts` reads the expense and rejects a non-`SUBMITTED` one with `EXPENSE_ALREADY_DECIDED`, and the `UPDATE` itself carries `WHERE id = ? AND status = 'SUBMITTED'`. Zero affected rows means another writer won the race, surfaced as `EXPENSE_DECISION_CONFLICT`. The pre-check produces the friendly error; the SQL guard is the actual correctness boundary. Do not remove the `WHERE` clause on the assumption the pre-check suffices.

See `PATTERNS/guarded-state-transition-update.md`.

## Testing

- **vitest**, `tests/**/*.test.ts`, run with `npm test`.
- Integration-style: tests drive the real app through Fastify's `app.inject()`, with a real (in-memory or temp-file) database. No mocking of internal modules.
- `createTestApp()` in `tests/app.test.ts` is the shared factory. Open apps and temp directories are pushed to module-level arrays and drained by one `afterEach`, so a failing test still releases its handles.
- Persistence is proven by writing through one app instance, closing it, and reading through a second against the same file.
- Helpers currently live inside the single test file. A second test file should extract them rather than copy them.

See `PATTERNS/test-resource-cleanup-registry.md`.

## Type System Conventions

`strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`. ESM throughout (`"type": "module"`), NodeNext resolution — relative imports must carry the `.js` extension even in TypeScript source. `tsconfig.json` compiles `src/` to `dist/`; `tsconfig.test.json` extends it for type-checking tests and config with `noEmit`.

Domain types are hand-written, not inferred from Zod. Zod types describe client input only. Keep the two aligned manually — see `PATTERNS/domain-type-schema-pair.md`.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Watch-mode server via tsx |
| `npm test` | Run the suite once |
| `npm run typecheck` | Type-check src and tests, no emit |
| `npm run build` | Compile to `dist/` |
| `npm run check` | typecheck + test + build — the gate before any commit |
| `npm start` | Run the compiled server |

`npm run check` is the acceptance gate. Run it before reporting work complete.

## Configuration

`DATABASE_PATH` (default `data/expenses.sqlite`, `:memory:` for ephemeral), `HOST` (default `127.0.0.1`), `PORT` (default `3000`). Validated by a Zod schema at startup; an invalid value aborts the process rather than falling back.

## Related

`CONTEXT.md` · `CODEMAP.md` · `BASELINE-API.md` · `TECHSTACK.md` · `DEPENDENCIES.md` · `PATTERNS/INDEX.md` · `ASSUMPTIONS.md` · `TODO.md`
