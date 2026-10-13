# ARCHITECTURE

Purpose: technical architecture of the workspace: modules, layering, data flow, persistence, error model, configuration, testing, build.
Excludes: business context (see `docs/CONTEXT.md`); versions and scripts (see `docs/TECHSTACK.md`, `docs/DEPENDENCIES.md`); file listing (see `docs/CODEMAP.md`); code templates (see `docs/PATTERNS/INDEX.md`).
Style: terse bullets and tables, grep-friendly `##` headers, describe structure and intent, not line-by-line code. Keep under 150 lines.

## Overview

- Single repository, single service: one Fastify HTTP API process with an embedded SQLite file database.
- Small layered design, no framework plugins, no DI container; dependencies passed through `buildApp(options)`.
- Layers: entry point -> app factory (routes, validation, error mapping) -> repository -> SQLite.

```
server.ts --(env)--> buildApp() in app.ts --> schemas.ts (Zod validation)
                                          --> ExpenseRepository --> database.ts (node:sqlite) --> expenses table
                                          --> domain.ts types shared by repository and app
```

## Workspace Structure

- `src/`: application source (6 modules, below). Built to `dist/` (gitignored).
- `tests/`: Vitest integration suite.
- `docs/`: project and Rosetta documentation. `agents/`: Rosetta agent state, memory, implementation log; `agents/TEMP/` is gitignored scratch.
- `data/`: default runtime database location (gitignored, created on demand).
- Full file list: `docs/CODEMAP.md`. The initialization helper was ignored local tooling, not a committed clone dependency; regenerate through Rosetta's codemap workflow or repository file inventory.

## Modules

| Module | Responsibility |
|---|---|
| `src/server.ts` | Process entry: validates env with Zod, builds app with logger on, listens, closes on SIGINT/SIGTERM. |
| `src/app.ts` | `buildApp(options)` factory: opens DB, wires repository, registers routes, 404 and error handlers, error body helpers. |
| `src/schemas.ts` | Zod strict schemas for create body, decision body, `expenseId` params; inferred input types. |
| `src/domain.ts` | Status constants and domain types: `Expense`, `NewExpense`, `ExpenseDecision`. No logic. |
| `src/expense-repository.ts` | `ExpenseRepository` (create, list, findById, decide) plus row mapping with runtime type guards. |
| `src/database.ts` | `openDatabase(path)`: creates parent dir, opens `DatabaseSync`, applies schema idempotently. |

## Request Flow

- Route handler `safeParse`s params/body; failure -> 400 `VALIDATION_ERROR` before any DB access.
- Single-resource routes: `findById` -> 404 if missing -> state precondition (409) -> mutate.
- Repository returns domain objects; handlers wrap them as `{ expense }` or `{ expenses }`.
- IDs come from `idFactory` (default `crypto.randomUUID`); timestamps from `now` (default `new Date().toISOString()`, UTC).

## Composition and Test Seams

- `BuildAppOptions`: `databasePath` (default `data/expenses.sqlite`), `idFactory`, `now`, `logger` (default off).
- All non-determinism (ids, time, storage location) is injectable; tests rely on this.
- DB connection lifetime = app lifetime; closed in Fastify `onClose` hook.

## Persistence

- Engine: Node built-in `node:sqlite` `DatabaseSync` (synchronous API, no npm driver, no ORM).
- `:memory:` supported for ephemeral DBs; otherwise parent directory is created automatically.
- Schema: one table `expenses` (snake_case columns), created with `CREATE TABLE IF NOT EXISTS` on every open.
- DB-level `CHECK` constraints mirror domain rules: `amount_cents > 0`, `length(currency) = 3`, status in the three statuses.
- Index `expenses_updated_at_idx (updated_at DESC, id ASC)` backs list ordering.
- Timestamps stored as ISO-8601 TEXT; ordering relies on lexicographic order of UTC ISO strings.
- No migration mechanism: schema changes to an existing table need an explicit strategy (see `docs/ASSUMPTIONS.md`).
- Decision write is guarded: `UPDATE ... WHERE id = ? AND status = 'SUBMITTED'`; zero changed rows -> 409 `EXPENSE_DECISION_CONFLICT` (lost race after the pre-check).
- Row mapping never casts blindly: `requiredString` / `nullableString` / `expenseStatus` throw on unexpected persisted data (surfaces as 500).
- `PRAGMA foreign_keys = ON` is set although no foreign keys exist yet.

## Validation

- Request-body/params Zod objects use `.strict()` (unknown keys rejected), with trimmed string fields. Environment configuration is non-strict.
- Validation lives only at the HTTP boundary (`schemas.ts`); repository trusts typed input; DB constraints are a second guard.
- Environment config is also Zod-validated (`server.ts`).

## Error Model

- Every error response: `{ error: { code, message, details? } }`; `details` (`[{ path, message }]`) only for validation errors.

| Code | HTTP | Source |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod `safeParse` failure on params or body |
| `EXPENSE_NOT_FOUND` | 404 | Unknown `expenseId` |
| `ROUTE_NOT_FOUND` | 404 | Fastify not-found handler (any unregistered route/method) |
| `EXPENSE_ALREADY_DECIDED` | 409 | Decision on non-`SUBMITTED` expense |
| `EXPENSE_DECISION_CONFLICT` | 409 | Guarded update changed no rows |
| `INTERNAL_ERROR` | 500 | Global error handler; hides error details from clients |

- Global error handler always replies 500 and ignores the thrown error's own status code; confirmed: malformed JSON body surfaces as 500, not 400. Known baseline quirk, not fixed (seed is frozen at tag `expense-seed-v1`).

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `DATABASE_PATH` | `data/expenses.sqlite` | `:memory:` for ephemeral |
| `HOST` | `127.0.0.1` | Listen address |
| `PORT` | `3000` | Integer 1-65535 |

- Invalid env throws at startup (fail fast). No config files, no secrets.

## Health

- `GET /health` returns static `{ status: "ok" }`; it does not query the DB. Readiness is implied by DB opening synchronously in `buildApp`.

## Testing

- Vitest, one integration suite `tests/app.test.ts`; config `vitest.config.ts` (`tests/**/*.test.ts`, `clearMocks`).
- Tests drive routes via `app.inject()` (no network socket), in-memory DB by default, deterministic `idFactory`/`now`.
- File persistence is tested by closing/rebuilding app instances in the same process. No actual API-process restart test exists in the seed. Shared `afterEach` closes apps and removes owned temp dirs.
- No mocks of internal modules; no separate repository unit tests; no coverage thresholds configured.
- Covered: health, create/read/list, approve-once + 409, invalid create input, persistence, absent DELETE route.
- New behavior: add cases to the same suite following `docs/PATTERNS/deterministic-fastify-inject-test.md`.

## Build and Quality Gate

- `npm run check` = typecheck (src + tests) -> `vitest run` -> `tsc` build. This is the only quality gate.
- Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`); ESM with NodeNext resolution, so relative imports use `.js` suffixes and type-only imports use `import type`.
- No CI, linter, formatter, or container config (local-only POC). Formatting follows `.editorconfig` (2 spaces, LF).

## Extending the Service (Change Path)

1. Domain type/status in `src/domain.ts`.
2. Strict Zod schema in `src/schemas.ts`.
3. Table/column change in `src/database.ts` (mind missing migrations).
4. Repository method in `src/expense-repository.ts` (prepared SQL and mapped reads; mutations currently include readback).
5. Route in `src/app.ts` (safeParse -> find-or-404 -> precondition 409 -> mutate), errors via `errorBody`.
6. Integration test in `tests/app.test.ts`; run `npm run check`.
- Patterns for each step: `docs/PATTERNS/INDEX.md`.

## Not Present

- Authentication/authorization, rate limiting, CORS, OpenAPI/Swagger, Fastify route schemas, pagination, logging beyond Fastify's built-in logger (on in `server.ts`, off in tests), metrics, migrations.

## Related Docs

- `docs/CONTEXT.md`, `docs/BASELINE-API.md`, `docs/TECHSTACK.md`, `docs/DEPENDENCIES.md`, `docs/CODEMAP.md`, `docs/PATTERNS/INDEX.md`
- `agents/IMPLEMENTATION.md`, `docs/ASSUMPTIONS.md`, `docs/TODO.md`, `agents/MEMORY.md`
