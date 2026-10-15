# ARCHITECTURE

Purpose: technical architecture of the workspace: modules, layering, data flow, persistence, error model, configuration, testing, build.
Excludes: business context (see `docs/CONTEXT.md`); versions and scripts (see `docs/TECHSTACK.md`, `docs/DEPENDENCIES.md`); file listing (see `docs/CODEMAP.md`); code templates (see `docs/PATTERNS/INDEX.md`).
Style: terse bullets and tables, grep-friendly `##` headers, describe structure and intent, not line-by-line code. Keep under 150 lines.

## Overview

- Single repository, single service: one Fastify HTTP API process with an embedded SQLite file database. Single process only (`src/transaction.ts` synchronous `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`; no horizontal scaling, no concurrent writers beyond this process).
- Small layered design, no framework plugins, no DI container; dependencies passed through `buildApp(options)`.
- Layers: entry point -> actor hook -> app factory (thin routes) -> `ExpenseService` (one transaction per mutation) -> pure `policy.ts` -> tenant-scoped repositories -> SQLite.

```
server.ts --(env)--> buildApp() in app.ts
  --> registerActorHook (actor.ts) ──(401)
  --> routes: schemas.ts parse ──(400/413/415)
        --> ExpenseService (expense-service.ts)
              --> policy.ts (pure)                 ──(403/404-visibility/409)
              --> transaction.ts withTransaction
              --> ExpenseRepository                ──(404 tenant existence)
              --> AuditRepository (append-only)
              --> IdempotencyRepository + requestFingerprint ──(replay/409)
  --> setErrorHandler (errors.ts)
  --> database.ts openDatabase + migrate (user_version)
```

## Workspace Structure

- `src/`: application source (13 modules, below). Built to `dist/` (gitignored).
- `tests/`: Vitest suite (migrated/extended in a later pass; see Testing below).
- `docs/`: project and Rosetta documentation. `agents/`: Rosetta agent state, memory, implementation log.
- `data/`: default runtime database location (gitignored, created on demand).
- Full file list: `docs/CODEMAP.md`.

## Modules

| Module | Responsibility |
|---|---|
| `src/server.ts` | Process entry: validates env with Zod, builds app, listens, closes on SIGINT/SIGTERM. |
| `src/app.ts` | `buildApp(options)`: opens DB, wires 3 repositories + `ExpenseService`, registers actor hook, thin routes, 404/error handlers. |
| `src/actor.ts` | Validates `x-tenant-id`/`x-user-id`/`x-role`, sets `request.actor` via an `onRequest` hook scoped to `/expenses*`; `requireActor` reads it. |
| `src/policy.ts` | Pure functions: role capability, identity agreement, self-decision, approval limit, ownership, state preconditions, restore-window math. No I/O. |
| `src/transaction.ts` | `withTransaction(db, work)`: `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`; rejects nesting; compile-time `NotPromise<T>` plus a runtime thenable backstop reject async `work`. |
| `src/expense-service.ts` | `ExpenseService`: one command per mutation (`create`/`decide`/`delete`/`restore`) plus `list`/`get`, each running its tier checks inside one transaction. |
| `src/schemas.ts` | Zod strict schemas for create/decision/params bodies, empty mutation body, Idempotency-Key format; inferred input types. |
| `src/domain.ts` | Types: `Actor`, `Role`, `Expense` (+ tombstone fields), `NewAuditEvent`/`AuditEvent`, `IdempotencyRecord`. No logic. |
| `src/expense-repository.ts` | `ExpenseRepository`: every method tenant-scoped (`findInTenant`, `listVisible`, `create`, `decide`, `tombstone`, `restore`); no unscoped method remains. |
| `src/audit-repository.ts` | `AuditRepository`: `append` (insert-only) and `listForExpense` (read, tests/review only). No update/delete method exists. |
| `src/idempotency-repository.ts` | `IdempotencyRepository` (`find`/`save`, plain INSERT) plus `canonicalJson`/`requestFingerprint` (SHA-256 of a canonicalized request). |
| `src/database.ts` | `openDatabase(path)`: creates parent dir, opens `DatabaseSync`, runs `migrate`. `migrate` applies `PRAGMA user_version`-gated steps. |
| `src/errors.ts` | Error catalog (code/message/status), `errorBody`/`errorResult`/`validationError`, `bodyParserErrorResult` (exact Fastify-code allow-list mapping to 400/413/415). |

## Request Pipeline

- Fixed 9-tier error-priority order; first failing tier wins, each tier runs only if all earlier tiers passed. Full tier table and per-route applicability: `plans/EXP-003/EXP-003-SPECS.md` S4.
- AC-011 follow-up (2026-10-15): before those tiers, the router rejects decoded parameters over100 characters with400 `VALIDATION_ERROR` (no request echo; HEAD has no body). This precedes auth/body/key checks and may precede suffix matching. See the dated compatibility notes and follow-up report; the router limit itself is unchanged.
- T1 actor headers (401) runs in `onRequest`, before body parsing, so an unauthenticated request with a malformed body still gets 401. T2 body-parse (400/413/415) and T3 schema/key (400) are syntax-only. T4 is tenant-bound existence (tombstone-blind, 404); T4b is ordinary visibility (tombstone-hiding + employee read-scope, 404) and applies only to `GET /:id`, list and decision — delete/restore skip T4b because they are tombstone-aware. T5 role capability (403), T6 identity/ownership/limit (403), T7 idempotency lookup (replay or 409), T8 state precondition (409), T9 guarded mutation + audit + idempotency save (500 on any throw, rollback).
- `now()` is called exactly once per mutating command, as the first statement inside its transaction; `idFactory()` only at T9 of a fresh create.

## Persistence

- Engine: Node built-in `node:sqlite` `DatabaseSync` (synchronous, no npm driver/ORM). `PRAGMA foreign_keys = ON`.
- Schema versioned via `PRAGMA user_version` (`src/database.ts`): migration 0->1 is the verbatim seed DDL (`IF NOT EXISTS`, no-op on an already-seeded file); migration 1->2 adds `tenant_id`/`deleted_at`/`deleted_by` to `expenses`, plus `audit_events` and `idempotency_records`. Each step runs inside `withTransaction`, re-reads `user_version` under the write lock (so a second opener skips an already-applied step), and refuses to open a file with a newer `user_version` than this build supports (handle closed before rethrow).
- Quarantine: pre-existing rows with no prior tenant get `tenant_id` from a column `DEFAULT 'legacy:seed'`. That value is unreachable as a real `x-tenant-id` (the identifier charset excludes `:`), so quarantined rows are preserved but invisible to every API caller. Hardened by trigger `expenses_no_quarantine_insert`, which aborts any later INSERT whose `tenant_id` resolves to `legacy:seed` — a loud failure (rollback + 500) instead of a silent landing in quarantine.
- Audit: `audit_events` is append-only by trigger (`audit_events_no_update`/`audit_events_no_delete` both `RAISE(ABORT)`), FK `RESTRICT` additionally blocks deleting an expense with audit rows, and `audit_events_tenant_match` aborts an insert whose tenant disagrees with its expense's tenant.
- Idempotency: `idempotency_records` PK `(tenant_id, actor_user_id, idempotency_key)`, `WITHOUT ROWID`; plain INSERT (no upsert) so a key collision throws rather than silently overwriting.
- Timestamps stored as UTC ISO-8601 TEXT; load-bearing for both list ordering (lexicographic = chronological) and restore-window arithmetic (`Date.parse` difference), so an injected `now` must return UTC ISO.
- Row mapping never casts blindly: typed-row-field-extraction guards throw on unexpected persisted data (surfaces as 500) across all three repositories.

## Error Model

- Every error response: `{ error: { code, message, details? } }`; `details` only for Zod validation failures.

| Code | HTTP | Tier | Source |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | Router/T2/T3 | Over-limit router parameter, Zod failure, or body-parse mapping (fixed message, no details) |
| `PAYLOAD_TOO_LARGE` | 413 | T2 | Body over Fastify's 1 MiB default limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | T2 | Content type with no parser |
| `IDEMPOTENCY_KEY_REQUIRED` / `_INVALID` | 400 | T3 | Missing / malformed `Idempotency-Key` |
| `UNAUTHENTICATED` | 401 | T1 | Missing/invalid actor headers |
| `FORBIDDEN_ROLE` | 403 | T5 | Role lacks capability for the command |
| `ACTOR_MISMATCH` | 403 | T6 | Body identity disagrees with the actor |
| `SELF_DECISION_FORBIDDEN` | 403 | T6 | Actor decides its own expense |
| `APPROVAL_LIMIT_EXCEEDED` | 403 | T6 | Manager approval over 100,000 cents |
| `NOT_EXPENSE_OWNER` | 403 | T6 | Non-owner delete/restore (reachable) |
| `EXPENSE_NOT_FOUND` | 404 | T4/T4b | Cross-tenant, tombstoned, or non-owned (employee) target |
| `ROUTE_NOT_FOUND` | 404 | – | Unregistered route/method |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | T7 | Same key, different fingerprint |
| `EXPENSE_ALREADY_DECIDED` | 409 | T8 | Second decision attempt |
| `EXPENSE_DECISION_CONFLICT` | 409 | T9 | Guarded decide update matched zero rows (backstop) |
| `EXPENSE_RETENTION_LOCKED` | 409 | T8 | Delete attempt on a decided expense |
| `EXPENSE_ALREADY_DELETED` | 409 | T8 | Fresh-key delete of an already-tombstoned expense |
| `EXPENSE_NOT_DELETED` | 409 | T8 | Restore of a non-tombstoned (or non-SUBMITTED-tombstoned) expense |
| `RESTORE_WINDOW_EXPIRED` | 409 | T8 | Restore attempted at/after the 30-day boundary |
| `INTERNAL_ERROR` | 500 | T9/any | Unmapped thrown error (rollback; no detail leaked) |

- Body-parser errors keep Fastify's native 4xx status (`src/errors.ts` `bodyParserErrorResult`, an exact-code allow-list), not a flattened 500 — this replaces the former "malformed JSON surfaces as 500" baseline quirk.
- No stack, SQL, header values, idempotency-key values or body values are ever echoed; body key names may appear in a Zod strict-mode `details` message.

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `DATABASE_PATH` | `data/expenses.sqlite` | `:memory:` for ephemeral |
| `HOST` | `127.0.0.1` | Listen address |
| `PORT` | `3000` | Integer 1-65535 |

- Invalid env throws at startup (fail fast). `BuildAppOptions` unchanged: `databasePath`, `idFactory`, `now`, `logger`.

## Health

- `GET /health` returns static `{ status: "ok" }`, unauthenticated, unchanged from the seed.

## Testing

- Current AC-011 follow-up (2026-10-15, Phase 10 approved, Phase 12-13 complete): **204**
  tests across 9 files; native and coordinator `npm run check` pass with Node 24.21.0/npm
  11.6.2. Evidence: `plans/EXP-003/evidence/AC011-ci-check.txt` and `AC011-check.txt` (current),
  `AC011-coordinator-final-check.txt` (independent204), and `AC011-coordinator-check.txt` (203, the intermediate count
  between the Phase 8 and Phase 12 review fixes). The 187-test record below is historical
  (pre-AC-011-follow-up).
- 9 test files, **187 tests passing** (Phase 11/13; gate evidence: `plans/EXP-003/evidence/P9-ci-check.txt`): `tests/app.test.ts` (6 migrated baseline cases), `tests/policy.test.ts` (pure `policy.ts` unit cases, incl. restore-window boundaries), `tests/access.test.ts` (authentication/validation + tenancy/decision-policy integration, incl. the S12.3 matrix cross-tenant rows), `tests/audit.test.ts` (exact audit payload/count per mutation, append-only triggers, 8-case F-A/F-I atomicity fault injection), `tests/lifecycle.test.ts` (S12.3 idempotency/tombstone/restore matrix), `tests/migration.test.ts` (schema v2, legacy quarantine, reopen/newer-version handling), `tests/errors.test.ts` (`bodyParserErrorResult` S5.7 mapping, full catalog), `tests/sqlite-runtime.test.ts` (S11 runtime facts + `withTransaction` contract + `NotPromise<T>` compile-time constraint), `tests/fingerprint.test.ts` (`canonicalJson`/`requestFingerprint`). Shared helpers in `tests/support.ts`.
- Clean-install gate (`npm ci && npm run check`, pinned Node v24.21.0/npm 11.6.2): typecheck (src+tests) → `vitest run` → `tsc` build, all green. Full requirement-to-test traceability: `plans/EXP-003/EXP-003-REQUIREMENT-MAP.md`.

## Build and Quality Gate

- `npm run check` = typecheck (src + tests) -> `vitest run` -> `tsc` build. No new dependency; `package.json`/lockfile/tsconfig/vitest config unchanged from the seed.
- Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`); ESM NodeNext, `.js` import suffixes, `import type` for types.

## Not Present

- Real authentication, rate limiting, CORS, OpenAPI/Swagger, pagination, audit read API, purge job/endpoint, metrics, multi-process coordination.

## Related Docs

- `docs/CONTEXT.md`, `docs/BASELINE-API.md`, `docs/EXP-003-COMPATIBILITY.md`, `docs/TECHSTACK.md`, `docs/DEPENDENCIES.md`, `docs/CODEMAP.md`, `docs/PATTERNS/INDEX.md`
- `agents/IMPLEMENTATION.md`, `docs/ASSUMPTIONS.md`, `docs/TODO.md`, `agents/MEMORY.md`
