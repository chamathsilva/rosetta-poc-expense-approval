# EXP-003 Compatibility Changes (draft)

Status: **Phase 4/5 planning artifact — drafted now, finalized in Phase 7.** Nothing in this repository has been implemented yet; this file describes the *planned* behavior changes from `plans/EXP-003/EXP-003-SPECS.md` (`S7.4`), not a change that has happened. It exists so the compatibility notes required by the approved design (`plans/EXP-003/architecture-notes.md:193`) do not depend on editing the human-owned `docs/BASELINE-API.md` (see OI-1 in `plans/EXP-003/EXP-003-PLAN.md`, a proposed default pending Phase 6 author confirmation, not yet decided).

Source of record for all behavior described here: `plans/EXP-003/EXP-003-SPECS.md` §S7.4 and §S4. If this file and SPECS ever disagree after Phase 7, SPECS (updated in Phase 7) is authoritative and this file must be corrected to match.

## Deliberate breaks from the neutral starter (planned)

1. Actor headers (`x-tenant-id`, `x-user-id`, `x-role`) are required on every `/expenses*` route; missing or invalid ⇒ 401 `UNAUTHENTICATED`. These simulate trusted upstream authentication; they are **not** production authentication.
2. `Idempotency-Key` is required on the four mutations (create, decide, delete, restore).
3. employeeId/reviewerId become optional and derive from x-user-id when absent. A seed-valid body
   id outside the actor-id charset cannot match the actor. Once preceding tiers pass, T6 returns
   403 ACTOR_MISMATCH; earlier authentication, syntax, visibility and role denials still take priority.
4. Expense responses gain `tenantId` and `deletedAt` fields.
5. `GET /expenses` and `GET /expenses/:id` become role- and tenant-scoped, and tombstoned (deleted) expenses are hidden from ordinary reads/lists.
6. `DELETE /expenses/:expenseId` and `POST /expenses/:expenseId/restore` are new routes. The seed's "no DELETE route" test is replaced, not merely extended.
7. Schema migrates in place via `PRAGMA user_version` (seed v0/v1 → v2). Existing rows are preserved; rows with no prior tenant are quarantined under a fixed, unreachable-as-a-real-tenant marker (`legacy:seed`), never deleted and never guessed into a real tenant (human decision 1).
8. Body-parser errors keep their Fastify-native 4xx status instead of the seed's catch-all 500: malformed JSON, an empty JSON body on a route with `Content-Type: application/json`, and a Content-Length mismatch ⇒ 400 `VALIDATION_ERROR`; a body over the 1 MiB default limit ⇒ 413 `PAYLOAD_TOO_LARGE`; an unsupported content type ⇒ 415 `UNSUPPORTED_MEDIA_TYPE`. All of these were 500 `INTERNAL_ERROR` in the seed.

Also documented (not separate numbered breaks):

- Decisions are restricted to `manager`/`finance` roles, and a reviewer may never decide their own expense (policy, not a shape change).
- `DELETE`/`restore` with `Content-Type: application/json` and an empty body hit Fastify's empty-JSON-body rejection (400) before reaching route logic; clients that always send that header must send `{}`.

## Judgment calls within design latitude (OI-2, proposed defaults — not yet author-confirmed)

- `updated_at` is bumped on delete and restore (a restored expense moves to the top of the list).
- `deletedBy` is tracked but not serialized in API responses (always equals the owning `employeeId` under the owner-only deletion rule).
- Quarantine assignment uses a column `DEFAULT`, hardened by a trigger that aborts any new insert that would land in the quarantine tenant.
- Body-parser 413/415 preservation is proposed for Phase6 confirmation; no author answer is assumed.

## Accepted limitations (not breaks, documented so they are not mistaken for defects)

- Same-tenant existence disclosure: an employee gets 404 probing a non-owned same-tenant expense via `GET`, but 403 `NOT_EXPENSE_OWNER` via `DELETE`/`restore` — so existence (not content) of a same-tenant id can be inferred. Confined to the actor's own tenant; design-mandated.
- Attachments/receipts are unsupported.
- No purge endpoint; expired tombstones and idempotency records are retained indefinitely in this POC.
- The manager approval limit compares minor units regardless of currency, with no conversion.

## Not yet true of this repository

Everything above is a plan. As of this draft, `src/` and `tests/` are unchanged from the neutral seed. This file will be corrected to the past tense and cross-linked from `docs/ARCHITECTURE.md`/`docs/CONTEXT.md` once Phase 7 implementation lands.
