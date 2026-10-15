# EXP-003 Compatibility Changes

Status: **Initial implementation published 2026-10-14; AC-011 follow-up approved, implemented, reviewed and validated locally 2026-10-15; publication pending.** This file originated in planning and records implemented compatibility changes. Inline line numbers describe their original inspection checkpoint and may shift; current follow-up status is below.

Source of record for all behavior described here: `plans/EXP-003/EXP-003-SPECS.md` §S7.4 and §S4. If this file and SPECS ever disagree, SPECS is authoritative and this file must be corrected to match.

This file exists so the compatibility notes required by the approved design do not depend on editing the human-owned `docs/BASELINE-API.md`. Per the author's Phase 6 approval ("Keep BASELINE-API.md unchanged, use separate compatibility notes..."), **`docs/BASELINE-API.md` gets zero edits** — this is a decided, closed item, not an open one.

## Deliberate breaks from the neutral starter (implemented)

1. Actor headers (`x-tenant-id`, `x-user-id`, `x-role`) are required on every `/expenses*` route; missing, malformed, or an invalid `x-role` value ⇒ 401 `UNAUTHENTICATED`. Verified: `src/actor.ts:9-34` (schema + `onRequest` hook). These simulate trusted upstream authentication; they are **not** production authentication.
2. `Idempotency-Key` is required on the four mutations (create, decide, delete, restore); absent ⇒ 400 `IDEMPOTENCY_KEY_REQUIRED`, malformed/array ⇒ 400 `IDEMPOTENCY_KEY_INVALID`. Verified: `src/schemas.ts:22-46`, called at `src/app.ts:54,98,131,163`.
3. `employeeId`/`reviewerId` become optional and derive from `x-user-id` when absent. Verified optional: `src/schemas.ts:4,12`. A supplied value that disagrees with the actor ⇒ 403 `ACTOR_MISMATCH` (`src/policy.ts:62-74` create, `src/policy.ts:81-86` decide). A body id outside the actor-id charset (`^[A-Za-z0-9._-]{1,100}$`, `src/actor.ts:7`) can never equal `actor.userId`, so it always falls through to `ACTOR_MISMATCH` once earlier tiers pass; no coercion/normalization occurs in the comparison.
4. Expense responses gain `tenantId` and `deletedAt` fields. Verified: `src/domain.ts:19-32` (`Expense` interface), mapped in `src/expense-repository.ts:55-69`.
5. `GET /expenses` and `GET /expenses/:id` are role- and tenant-scoped, and tombstoned expenses are hidden from ordinary reads/lists. Verified: `src/policy.ts:30-46` (`listScope`, `canViewExpense`), applied at `src/expense-service.ts:26-27,39`.
6. `DELETE /expenses/:expenseId` and `POST /expenses/:expenseId/restore` are new routes (`src/app.ts:127-189`). The seed's "no DELETE route" test is replaced in the test-migration pass, not merely extended.
7. Schema migrates in place via `PRAGMA user_version` (seed v0/v1 → v2, `src/database.ts:72-119`). Existing rows are preserved; rows with no prior tenant are quarantined under the fixed marker `legacy:seed` (`src/database.ts:7,32`), never deleted and never guessed into a real tenant (human decision 1), hardened by the `expenses_no_quarantine_insert` trigger (`src/database.ts:37-39`) so a buggy INSERT aborts loudly instead of landing silently in quarantine.
8. Body-parser errors keep their Fastify-native 4xx status instead of the seed's catch-all 500. Verified: `src/errors.ts:138-176` (`bodyParserErrorResult`, an exact-code allow-list) and `src/app.ts:195-205` (`setErrorHandler`):
   - malformed JSON, `Content-Type: application/json` with an empty body, and a Content-Length mismatch ⇒ 400 `VALIDATION_ERROR`, message `"Request body could not be parsed"` (a fixed constant, never input-derived);
   - a body over the 1 MiB Fastify default ⇒ 413 `PAYLOAD_TOO_LARGE`;
   - an unsupported content type ⇒ 415 `UNSUPPORTED_MEDIA_TYPE`.
   All of these were 500 `INTERNAL_ERROR` in the seed.

Also documented (not separate numbered breaks):

- Decisions are restricted to `manager`/`finance` roles (`src/policy.ts:48-60`), and a reviewer may never decide their own expense (`src/policy.ts:88-90`) — policy, not a shape change.
- `DELETE`/`restore` with `Content-Type: application/json` and an empty body hit Fastify's empty-JSON-body rejection (400) before route logic ever runs (T2, before T3); clients that always send that header must send `{}`.

## Judgment calls within design latitude (OI-2, as implemented)

- `updated_at` is bumped on delete and restore — verified: `src/expense-repository.ts:174-194,196-215` both set `updated_at` — so a restored expense moves to the top of the list (`ORDER BY updated_at DESC`).
- `deletedBy` is persisted (`src/domain.ts:51-54`, `src/expense-repository.ts:182-183`) but never mapped into the API response — `mapExpense` (`src/expense-repository.ts:48-69`) has no `deletedBy` field. It always equals the owning `employeeId` under the owner-only deletion rule, so omitting it loses no information.
- T3 order is key → params → body, verified at every mutation route handler, e.g. `src/app.ts:94-125` (decide: key at 98, params at 104, body at 110).
- Decision T6 order is mismatch → self → limit, verified `src/policy.ts:76-100` (`authorizeDecision`: lines 81-86 mismatch, 88-90 self, 92-98 limit).
- Quarantine is applied via a column `DEFAULT 'legacy:seed'` (`src/database.ts:32`), hardened by `expenses_no_quarantine_insert` (`src/database.ts:37-39`) so a buggy INSERT aborts loudly instead of vanishing into quarantine.
- An extra `audit_events_tenant_match` trigger (`src/database.ts:56-58`) aborts an audit insert whose tenant disagrees with its expense's tenant.
- Parse errors 413/415 are **not** flattened to 400: body-parser errors keep their native 400/413/415 status with the new `PAYLOAD_TOO_LARGE`/`UNSUPPORTED_MEDIA_TYPE` codes (verified `src/errors.ts:155-173`), per the author's Phase 6 approval ("preserve HTTP 400/413/415").

## Accepted limitations (not breaks, documented so they are not mistaken for defects)

- Same-tenant existence disclosure: an employee gets 404 probing a non-owned same-tenant expense via `GET`/decision, but 403 `NOT_EXPENSE_OWNER` via `DELETE`/`restore` (verified: `src/expense-service.ts:271,371` reach `authorizeOwnerMutation` only after the tenant-bound T4 existence check) — so existence (not content) of a same-tenant id can be inferred. Confined to the actor's own tenant; design-mandated.
- Attachments/receipts are unsupported.
- No purge endpoint; expired tombstones and idempotency records are retained indefinitely in this POC.
- The manager approval limit (`MANAGER_APPROVAL_LIMIT_CENTS = 100_000`, `src/policy.ts:3`) compares minor units regardless of currency, with no conversion.

## Validation and framework boundary

The final suite passed 187 tests across 9 files as of Phase 13 (2026-10-14), with clean
typecheck/build. See `plans/EXP-003/evidence/P9-ci-check.txt` and
`plans/EXP-003/EXP-003-REQUIREMENT-MAP.md`.

**AC-011 follow-up correction (2026-10-15, approved
`plans/EXP-003/AC-011-FOLLOWUP-PLAN.md`):** an over-length (>100 char) expense path parameter
is now rejected with a safe `400 VALIDATION_ERROR` envelope (`src/app.ts`'s
`routerOptions.onMaxParamLength`), not Fastify's default `414`. This is a narrow
*pre-authentication, pre-body-parsing* exception: find-my-way's router rejects the request
before the actor hook, idempotency-key check, or body parsing run, so this 400 wins even over
an otherwise-invalid request (missing auth headers, missing Idempotency-Key, malformed body) —
characterized, not merely asserted, in `tests/access.test.ts`'s "router-level oversized-parameter
rejection (AC-011 follow-up)" block. Separately characterized there: find-my-way measures the
*decoded* path segment's length, not the raw/encoded one; and the oversized-param HEAD-route
rejection correctly carries no body (the raw-response callback explicitly special-cases
`HEAD`, mirroring Fastify's own body-stripping behavior for normal routes). The suite is now
204 tests across the same9 files after test-review corrections; see the native `AC011-check.txt`
and `AC011-ci-check.txt`, and the independent `AC011-coordinator-final-check.txt` under
`plans/EXP-003/evidence/`. The intermediate coordinator log `AC011-coordinator-check.txt`
records203; private snapshots preserve the corresponding original native logs. Original Phase13
evidence (`P9-ci-check.txt`,187 tests) is unchanged, and the requirement map retains its original
qualification alongside the dated follow-up update.

Foreign-writer SQLITE_BUSY behavior remains untested.

The router may select its over-limit callback before matching a trailing route suffix:
`/expenses/<over-limit-id>/unknown` returns400, while an unrelated unregistered route still
returns404. This is the preserved router-selection boundary, not a new endpoint. HEAD body
behavior was verified through injection; this follow-up does not claim a live-socket protocol audit.
