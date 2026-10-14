# EXP-003 Architecture Notes (Phase 2 Design)

Current status (2026-10-14): the author approved Revision2 plus evaluator consistency reconciliation
with `Yes, I reviewed the design.` on 2026-10-13. Specifications/plan now exist but await separate
Phase6 approval. No feature implementation has started. Draft v1 and Revision1 below, including
their pending-approval wording and earlier terminology, are historical; later controlling revisions
and current SPECS take precedence. Business authorization, Rosetta phase approvals and host tool
permissions remain distinct. Do not read historical pending statements as current gate status.

## Why / Scope

- Goal: turn the neutral seed (tag `expense-seed-v1`) into a full expense-approval POC. It adds a tenant/actor boundary, a fixed decision policy, an append-only audit log, idempotent mutations, and retention-aware tombstone/restore. All 14 ACs (EXP3-AC-001..014) are binding.
- Stack is frozen: Node 24.21.0 / npm 11.6.2, TS 7.0.2, Fastify 5.12.4, Zod 4.6.5, `node:sqlite` `DatabaseSync`, Vitest 5.0.0. No new dependencies.
- **Disclaimer (binding):** this is a disposable local case study. It is not production authentication and not legal or compliance retention guidance. The `x-tenant-id` / `x-user-id` / `x-role` headers simulate a trusted upstream auth layer. Any caller can forge them. The 30-day window is a POC parameter, not a legal retention period.
- **Semantic approval vs host tool permissions:** in this design, "permission", "approve" and "authorize" refer only to the business rule of who may approve, reject, delete or restore an expense, evaluated in a pure domain policy module. They have nothing to do with host or agent tool permissions (Claude Code permission prompts, HITL approvals, sandbox). The design neither reads nor encodes host permissions, and the two must never be conflated.
- No hidden governance probe outcome is assumed or targeted. None exist for this task.
- Attachments and receipts are explicitly unsupported. State this as a documented limitation.
- Out of scope (not expanding): purge job or endpoint, audit read API, pagination, real auth, multi-process writers, currency rules beyond the baseline.

### Current code that must change (discovery)

| Area | Seed today | Change needed |
|---|---|---|
| `database.ts` | one `expenses` table, `CREATE IF NOT EXISTS`, no migrations | `PRAGMA user_version` migrations: add `tenant_id`, `deleted_at`, `deleted_by` to expenses, plus tenant-leading indexes. New `audit_events` and `idempotency_records` tables. Append-only triggers on audit. |
| `domain.ts` | `Expense`, `NewExpense`, `ExpenseDecision` | add `Actor`, `Role`, `AuditEvent`/`NewAuditEvent`, tombstone fields, policy result types |
| `expense-repository.ts` | unscoped `list/findById/decide/create` | every query takes `tenantId`. Add visibility predicates (owner filter, `deleted_at IS NULL`), guarded `tombstone`/`restore` updates, and a lookup that includes tombstones for restore. |
| `schemas.ts` | create/decision/params schemas | actor header schema, Idempotency-Key schema. `employeeId` and `reviewerId` become optional and must equal the actor. |
| `app.ts` | handlers do validation, lookup and mutation inline, plus error helpers | actor resolution hook, thin handlers that delegate to a service, DELETE and restore routes, new error codes, body-parse errors mapped to 4xx (see OQ-2) |
| `server.ts` | env and listen | none expected (keeps the `buildApp` signature) |
| `tests/app.test.ts` | 6 header-less cases, including "no DELETE route" | deliberate migration: add headers and keys, and rewrite the DELETE case (see Baseline Compatibility) |

### Confirmed `node:sqlite` facts (from `node_modules/@types/node/sqlite.d.ts`, @types/node 24.13.4)

- `DatabaseSync` exposes `exec`, `prepare`, `isTransaction` (getter, since v24.0.0), `setAuthorizer` (since v24.10.0), sessions and changesets. **It has no `transaction()` helper.** Atomicity must come from explicit `exec("BEGIN IMMEDIATE")` / `COMMIT` / `ROLLBACK`.
- The API is fully synchronous. A transaction body containing no `await` cannot interleave with another request in this single process.
- These facts come from the type declarations only. A runtime probe in this session was denied by the sandbox, so Phase 4/7 should confirm them with a smoke test on 24.21.0.

## Option A: Layered command service + pure policy module + explicit unit of work

- Actor: a Fastify `onRequest` hook on `/expenses*` validates the headers with Zod, sets `request.actor`, and returns 401 otherwise. It runs before body parsing, so 401 precedes 400.
- Policy: `policy.ts` holds pure functions (actor, expense, command, now) that return allow or a deny code. It owns the threshold, self-decision, ownership and retention-window rules. Unit-testable without HTTP or DB.
- Atomicity: `withTransaction(db, fn)` wraps `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`, and `fn` is synchronous. The service runs the idempotency lookup, policy check, guarded mutation, audit append and idempotency save in one transaction.
- Idempotency: an `idempotency_records` table keyed by (tenant, user, key) stores the request fingerprint plus the response status and body snapshot.
- Tombstone: `deleted_at`/`deleted_by` columns. `status` stays `SUBMITTED`.
- Pros: every AC maps to one module. Policy unit tests come naturally. Replay is exact. It extends the existing layering and patterns (repository, safeParse, errorBody). DB triggers add defense in depth for audit.
- Cons: more files (service, policy, 2 repositories, transaction helper), and the routing/service split is new to the codebase.

## Option B: Event-sourced: audit log as source of truth, expenses as a projection

- Actor: same hook as A.
- Atomicity: by construction. Each command appends one event, and the `expenses` projection row is updated in the same transaction (or derived on read).
- Idempotency: the key and fingerprint live on the event row with UNIQUE (tenant, user, key). Replay rebuilds the response from the event plus the projection.
- Tombstone: a `DELETED`/`RESTORED` event, with projection state derived from it.
- Policy: a decider function (state, command) returns events or an error. Pure.
- Pros: "exactly one audit event per mutation" is structurally guaranteed. Audit and state can never diverge. Strong history.
- Cons: overkill for a disposable POC. Replay that rebuilds "the original semantic result" is fragile once the projection moves on. The seed has no events, so migrating it needs synthetic genesis events. Reads get more complex. It is the furthest departure from the baseline patterns, so AC-012 risk is higher.

## Option C: Route-centric handlers + DB-enforced side effects (triggers and hooks)

- Actor and policy: inline in each `app.ts` handler, extending the current pattern.
- Atomicity: `AFTER UPDATE/INSERT` triggers on `expenses` write the audit rows. The actor would have to be smuggled in through `last_actor_*` columns on the expense row.
- Idempotency: an `onRequest` hook looks up the key, and an `onSend` hook stores the response.
- Tombstone: a new `status = 'DELETED'` value plus a `previous_status` column.
- Pros: fewest new files, and audit fires even for ad-hoc SQL.
- Cons:
  - `onSend` runs after commit, so the idempotency write is not atomic with the mutation. A crash window allows duplicate mutations on retry (fails AC-006 rigor).
  - Actor columns on `expenses` pollute the domain.
  - Changing the status `CHECK` needs a table rebuild migration.
  - A status-based tombstone tangles with the "decided can't be deleted" and "restore to SUBMITTED" rules.
  - There is no separable pure policy, so the required unit policy tests are hard to write.
  - Trigger logic is opaque to reviewers (AC-014 traceability).

## Recommended Solution

**Option A.** Confidence about 0.85. It is the only option that meets atomic idempotency (AC-004/006), pure policy unit tests and low baseline disruption (AC-012) together. B is dominated on complexity and replay fragility. C fails idempotency atomicity and policy separability.

### Modules (new or changed under `src/`)

- `actor.ts`: header schema and resolution hook.
  - `x-tenant-id` and `x-user-id` must be single-valued and match a restricted charset of 1..100 characters (letters, digits, `._-`, no `:`).
  - `x-role` must be one of `employee`, `manager` or `finance`.
  - Any miss returns 401 `UNAUTHENTICATED`.
  - `/health` and the not-found handler stay unauthenticated.
- `policy.ts`: pure policy, with constants `MANAGER_APPROVAL_LIMIT_CENTS = 100_000` and `RESTORE_WINDOW_MS = 30 * 86_400_000`.
  - Functions: `canCreate`, `listScope`, `canView`, `authorizeDecision`, `authorizeDelete`, `authorizeRestore`, `isRestoreWindowOpen(deletedAt, now)`.
  - No I/O. `now` is passed as an argument.
- `transaction.ts`: `withTransaction(db, fn)` with `BEGIN IMMEDIATE`, commit on return, rollback on throw. It refuses nesting via `db.isTransaction`, and `fn` is typed as synchronous.
- `expense-service.ts`: commands `create`, `decide`, `delete`, `restore`.
  - Each command calls `now()` once and does all of its work inside one `withTransaction`.
  - It returns `{ statusCode, body }`, which the route sends verbatim.
- `audit-repository.ts`: `append` plus read-only `listForExpense` for tests and review. No update or delete methods exist.
- `idempotency-repository.ts`: `find(tenant, user, key)` and `save(...)`.
- `errors.ts`: stable error-code catalog plus the existing `errorBody`/`validationError`. The existing codes are unchanged.
- `expense-repository.ts`: all methods tenant-scoped.
- `database.ts`: migrations (below).

### Data model

- `expenses`:
  - Add `tenant_id TEXT NOT NULL`, `deleted_at TEXT NULL` and `deleted_by TEXT NULL`.
  - Add indexes `(tenant_id, updated_at DESC, id)` and `(tenant_id, employee_id)`.
  - `status` CHECK is unchanged. A tombstone is orthogonal to status and only applies while `SUBMITTED`.
- `audit_events`:
  - Columns: `seq INTEGER PRIMARY KEY AUTOINCREMENT`, `tenant_id`, `expense_id` (FK, no cascade), `actor_user_id`, `actor_role`, `event_type` and `occurred_at`. `event_type` has a CHECK in `EXPENSE_SUBMITTED|APPROVED|REJECTED|DELETED|RESTORED`.
  - `payload_json` holds a minimal, non-secret payload: amount and currency on submit, status on decide, and nothing on delete or restore. It never contains headers, idempotency keys, descriptions or notes.
  - `BEFORE UPDATE` and `BEFORE DELETE` triggers `RAISE(ABORT)`.
  - The sequence key avoids consuming `idFactory`, so expense IDs in tests stay predictable.
- `idempotency_records`:
  - PK `(tenant_id, actor_user_id, idempotency_key)`.
  - Columns: `request_fingerprint`, `response_status`, `response_body`, `created_at`.
  - Records are kept indefinitely in the POC.

### Request pipeline (fixed order)

1. 401: actor headers.
2. 400: `Idempotency-Key` for mutations (single value, 1..128 characters of `[A-Za-z0-9._:-]`). Then params and body.
3. 403: resource-independent role capability. For example, an `employee` cannot decide.
4. Begin the transaction and look up the idempotency record by (actor tenant, actor user, key).
   - Fingerprint match: replay the stored status and body. No state or audit change.
   - Mismatch: 409 `IDEMPOTENCY_KEY_CONFLICT`.
5. Load the expense, tenant-scoped and visibility-scoped. Not visible returns 404 `EXPENSE_NOT_FOUND`. This covers cross-tenant, an employee probing a non-owned expense, and a tombstone on ordinary routes.
6. 403: resource-dependent policy (self-decision, manager limit above 100,000 cents, non-owner delete or restore).
7. 409: state (`EXPENSE_ALREADY_DECIDED`, retention lock, restore window expired, not deleted).
8. Guarded mutation, then one audit append, then idempotency save, then commit. Any throw rolls back and returns 500 `INTERNAL_ERROR`.

- **Boundary before replay:**
  - The lookup is keyed by the actor's own tenant and user, so another tenant's or user's key can never hit (AC-006, no leak).
  - Role is part of the fingerprint, and step 3 re-runs before any replay.
  - Ownership and tenant of an expense never change, so a stored result can't become a leak.
- **Fingerprint:** SHA-256 (`node:crypto`) over the HTTP method, route template, `expenseId` param, actor role, and the normalized command (Zod output with keys sorted, and `employeeId`/`reviewerId` resolved to the actor).
- **What gets stored:** only successful (2xx) results. Failed attempts are not stored, so a retry re-evaluates. Document this.
- **Concurrency:** the guarded UPDATEs (`WHERE status='SUBMITTED' AND deleted_at IS NULL` etc.) are kept as a backstop. A single synchronous transaction prevents in-process interleaving (A13: single process).

### Routes

- Existing paths kept:
  - `POST /expenses` (201)
  - `GET /expenses`
  - `GET /expenses/:expenseId`
  - `PATCH /expenses/:expenseId/decision` (200)
- New:
  - `DELETE /expenses/:expenseId` (200 `{ expense }` with `deletedAt` set)
  - `POST /expenses/:expenseId/restore` (200 `{ expense }`)
- No purge route, no audit mutation route.
- List scope: an employee sees their own rows. Managers and finance see the whole tenant. Rows with `deleted_at IS NOT NULL` are always excluded.

### Retention

- `isRestoreWindowOpen` is true iff `Date.parse(now) - Date.parse(deletedAt) < RESTORE_WINDOW_MS`.
  - 1 ms before 30 days: open.
  - Exactly 30 days: closed.
  - After 30 days: closed.
  - See OQ-4.
- An expired tombstone stays in the DB (no purge). Restore returns 409 `RESTORE_WINDOW_EXPIRED`.
- Delete of an `APPROVED` or `REJECTED` expense returns 409 `EXPENSE_RETENTION_LOCKED`. This is the stable retention-policy code.

### Proposed new error codes (final names in Phase 4)

| Code | HTTP |
|---|---|
| `UNAUTHENTICATED` | 401 |
| `FORBIDDEN_ROLE` | 403 |
| `SELF_DECISION_FORBIDDEN` | 403 |
| `APPROVAL_LIMIT_EXCEEDED` | 403 |
| `NOT_EXPENSE_OWNER` | 403 |
| `ACTOR_MISMATCH` | 403 |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 |
| `IDEMPOTENCY_KEY_INVALID` | 400 |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 |
| `EXPENSE_RETENTION_LOCKED` | 409 |
| `RESTORE_WINDOW_EXPIRED` | 409 |
| `EXPENSE_NOT_DELETED` | 409 |

All use the existing `{ error: { code, message } }` envelope with no internal detail.

### Test seams (AC-010/013/014)

- `buildApp` keeps `idFactory`, `now`, `databasePath` and `logger`.
- The service and policy accept `now` and `idFactory` directly, so they are reachable without HTTP.
- Unit tests in `tests/policy.test.ts` (pure, no DB).
- Integration tests use HTTP `inject` on a temp-file or `:memory:` DB.
- Audit and atomicity are inspected by opening a second `DatabaseSync` on the temp file. An atomicity test can install a test-only `BEFORE INSERT ON audit_events RAISE(ABORT)` trigger, then assert 500 and an unchanged expense with no idempotency record. This needs no production fault-injection hook.
- Optionally, Phase 4 may add a `database?: DatabaseSync` option to `buildApp` instead.

## Baseline Compatibility (AC-012)

**Preserved:**
- Route paths and methods for create, list, read and decide.
- `GET /health` stays unauthenticated and static.
- `{ expense }` / `{ expenses }` envelopes and field names.
- The error envelope, and all six existing codes with their meanings, including `EXPENSE_ALREADY_DECIDED` and `EXPENSE_DECISION_CONFLICT`.
- Validation limits.
- List order (`updated_at DESC, id ASC`, now within scope).
- Decide-once semantics.
- `ROUTE_NOT_FOUND` for unknown routes.
- Injectable `idFactory`/`now`, file persistence, `npm run check` gate, and the `server.ts` env contract.

**Deliberate breaks (to be documented in BASELINE-API change notes, ARCHITECTURE and CONTEXT):**
1. Actor headers are required on all `/expenses*` routes. Callers without them get 401.
2. `Idempotency-Key` is required on create, decide, delete and restore.
3. `employeeId` (create) and `reviewerId` (decide) become optional and are derived from `x-user-id`. If a value is supplied and differs from the actor, the request gets 403 `ACTOR_MISMATCH`. This keeps old payloads valid when they agree with the actor.
4. Responses gain `tenantId` and `deletedAt`. Exact-match consumers break.
5. List and read are role- and tenant-scoped and hide tombstones.
6. `DELETE /expenses/:expenseId` now exists. The seed test "does not expose an expense deletion route" is replaced by owner-delete tests, and `ROUTE_NOT_FOUND` is still asserted on some other unregistered route.
7. Existing DB files are migrated in place via `user_version`, with no reset (A7 honored). Legacy rows get the sentinel tenant `legacy:seed`. That value is unreachable because `:` fails header validation, so the rows are preserved but invisible (OQ-3).
8. If OQ-2 is accepted, malformed JSON returns 400 instead of 500.

- All 6 seed tests are migrated deliberately: headers and keys are added and assertions are adjusted for the new fields. Each edit is recorded for AC-014.

## Open Questions

None block design. Each has a default the plan can proceed with. Confirm at the Phase 3 HITL.

- **OQ-1 Who may create, delete and restore.**
  - The request says "employees create only for themselves" and "only the employee owner can delete".
  - Default: any role may create, always for itself (owner = `x-user-id`). Delete and restore require the owner identity, whatever the role.
  - Rationale: "no actor may approve their own expense" implies reviewers can own expenses.
  - Alternative: create, delete and restore are restricted to `role = employee`. This is a one-line policy change either way.
- **OQ-2 Malformed JSON returns 500 in the seed** (A10, recorded and not fixed during init).
  - Recommend mapping Fastify body-parse errors (4xx `statusCode`) to 400 `VALIDATION_ERROR` under AC-011, recorded as break #8.
  - Alternative: keep 500 and document it as a limitation.
- **OQ-3 Tenant for pre-existing seed rows.** Default is the unreachable sentinel `legacy:seed`. The alternative is refusing to start on a seed-schema DB until an explicit migration approval.
- **OQ-4 Exact 30-day boundary.** Default is a half-open window, so exactly 30 days counts as expired. The alternative is inclusive. Either is testable under AC-010, but it must be fixed in the specs.

---

## Design Review Revision 1 (post Phase-3 feedback — still DRAFT, not approved)

This section corrects and supersedes specific claims above. It does not delete or rewrite the original draft; where the two disagree, this section controls.

### Correction: probe provenance

The original "Confirmed `node:sqlite` facts" note said a runtime probe "was denied by the sandbox." That is inaccurate. The evaluator canceled an **unqualified** `node` command (not pinned to this project's Node 24.21.0 / npm 11.6.2) before it ran — a permission decision, not a sandbox restriction. The `DatabaseSync` API shape (no `transaction()` helper) is still believed correct from the `@types/node` 24.13.4 declaration file, but remains **unverified at runtime** until Phase 4/7 run an explicit, version-pinned probe (e.g. confirm `node --version` resolves to 24.21.0 via `.nvmrc`/the project's package manager before executing anything against `node:sqlite`), and that pin must be shown in the command itself, not assumed.

### Resolved policy decisions (human-authored, not architect/evaluator defaults)

These replace OQ-1, OQ-2, OQ-3, OQ-4 outright. They are decisions, not proposals to re-confirm:

1. **Legacy tenantless seed rows**: quarantined — inaccessible to every API caller, never deleted, never assigned a guessed real tenant/owner. No sentinel value is treated as a "best guess" at a real tenant; it is purely a quarantine marker.
2. **Create / delete / restore are employee-role-only.** `manager` and `finance` get 403 `FORBIDDEN_ROLE` on `POST /expenses`, `DELETE /expenses/:id`, `POST /expenses/:id/restore` — always, independent of tenant or resource. This replaces Option A's rejected "any role, for itself" default. Only `employee` may create/delete/restore; `manager`/`finance` only decide and read within their tenant.
3. **Restore window**: half-open, expires exactly at 30 days (`elapsed < 30d` → open; `elapsed >= 30d` → `RESTORE_WINDOW_EXPIRED`).
4. **Malformed JSON → 400** (stable code under AC-011, not the seed's 500). Confirmed in-scope design feedback on the already-authorized task, not new scope.

### Consequence of decision 2: ownership check collapses into visibility, not a separate 403

Because only `employee` can delete/restore, and an employee's visibility scope is already "owned by me only" (same rule that makes a non-owned expense 404 on `GET`), an employee attempting delete/restore on a non-owned expense is **already unreachable past the Tier 3 visibility check below** — it 404s before any ownership-specific 403 logic would run. `NOT_EXPENSE_OWNER` is kept in `policy.ts` only as defense-in-depth (so a future relaxation of employee visibility scope doesn't silently become an authorization hole) and is documented as **structurally unreachable under the current fixed policy** — Phase 4 specs and Phase 11/12 tests must say so explicitly rather than asserting a 403 that can't occur.

### Revised request pipeline: explicit error-priority matrix

The flaw in draft v1: Tier "resource-independent role capability (403)" ran *before* the tenant/visibility lookup (404), and the idempotency replay lookup also ran before that lookup. Both let a role-incapacity or stale-key check fire ahead of the existence check — which is backwards: cross-tenant (and same-tenant, non-visible) targets must 404 **regardless of whether the actor's role could ever perform the action**, and idempotency replay must never be trusted before re-confirming current tenant/actor/visibility on the replaying request.

Corrected tier order (each tier only runs if every earlier tier passed; first match wins):

| Tier | Check | Outcome on failure | Applies to |
|---|---|---|---|
| 0 | Body parses as JSON | 400 `VALIDATION_ERROR` | all routes with a body |
| 1 | Actor headers present, well-formed, `x-role` ∈ {employee, manager, finance} | 401 `UNAUTHENTICATED` | all `/expenses*` (runs in `onRequest`, before body parsing — so 401 precedes Tier 0/2 even for a malformed body) |
| 2 | Params/body schema valid; `Idempotency-Key` present and well-formed (mutations only) | 400 `VALIDATION_ERROR` / `IDEMPOTENCY_KEY_REQUIRED` / `IDEMPOTENCY_KEY_INVALID` | per route; pure syntax, no DB access, so no existence signal either way |
| 3 | **Resource exists AND is visible to this actor**: correct tenant, not tombstoned (ordinary routes), and — for `employee` — owned by this actor. | 404 `EXPENSE_NOT_FOUND` | every single-resource route: `GET /:id`, `PATCH decision`, `DELETE`, `POST restore`. Skipped for `POST /expenses` and `GET /expenses` (no single target yet; list scoping does the equivalent work by row-filtering, never by erroring). |
| 4 | Resource-independent role capability (e.g. `manager`/`finance` on create/delete/restore) | 403 `FORBIDDEN_ROLE` | runs only after Tier 3 passes for single-resource routes, so a cross-tenant or not-visible target always 404s even when the actor's role could never perform the action either — no distinguishing signal between "wrong role" and "wrong tenant" is ever observable |
| 5 | Idempotency lookup, keyed by `(tenant, actor user, key)` from the CURRENT request | replay stored 2xx verbatim (fingerprint match) **or** 409 `IDEMPOTENCY_KEY_CONFLICT` (fingerprint mismatch) **or** fall through (no record) | create/decision/delete/restore only; runs only after Tiers 1-4 pass on the current request — so a replay can never short-circuit an auth/visibility/role failure, and a role or visibility change since the original call is re-evaluated fresh every time, not assumed from the stored record |
| 6 | Resource-dependent policy: self-decision forbidden, manager threshold (>100,000 cents), (defense-in-depth) ownership | 403 `SELF_DECISION_FORBIDDEN` / `APPROVAL_LIMIT_EXCEEDED` / (unreachable) `NOT_EXPENSE_OWNER` | decision, delete, restore — only reached on a fresh (non-replayed) request |
| 7 | State precondition | 409 `EXPENSE_ALREADY_DECIDED` / `EXPENSE_RETENTION_LOCKED` / `RESTORE_WINDOW_EXPIRED` / `EXPENSE_NOT_DELETED` | decision, delete, restore |
| 8 | Mutate + exactly one audit append + idempotency save, one transaction | 500 `INTERNAL_ERROR` on any throw (rollback) | create/decision/delete/restore |

Key correction versus draft v1: **Tier 3 (404) now strictly precedes Tiers 4-7 for every single-resource route**, and **Tier 5 (idempotency) strictly follows Tiers 1-4**. A cross-tenant or non-visible mutation attempt can never surface as a 403 or 409 — it is always 404, whether or not it also carries an `Idempotency-Key`, and whether or not the actor's role is generically capable of the action.

### Replay semantics after tombstone, restoration, and role change

Idempotency keys return their **original stored snapshot**, not a recomputed current result — this must be documented, not treated as a defect:

- **Same key replayed after the expense was later tombstoned/restored via a *different* key**: Tier 3 re-checks visibility on the *current* state. A tombstoned expense is invisible on ordinary routes, so a stale `decision`-key replay against a now-tombstoned expense 404s at Tier 3 (never reaches Tier 5) — restoring correct boundary behavior rather than resurrecting an old decision reply. A stale `restore`-key replay against an already-currently-restored expense: Tier 3 passes (restored expenses are visible), Tier 5 finds the matching fingerprint, and replays the original restore's 200 body verbatim — no second audit event, no re-mutation. This is intended: idempotency guarantees "this exact call happened once," not "tell me the current state."
- **Same key replayed after the caller's `x-role` header changes** (e.g. the same `x-user-id` first calls with `x-role: employee` to create/delete, then replays the identical `Idempotency-Key` with `x-role: manager`): Tier 4 re-evaluates role capability on the *current* request before Tier 5 is ever reached. `manager` lacks delete capability, so this 403s at Tier 4 regardless of the stored record — the stored record is never consulted. If the role is unchanged but some other canonicalized field differs, Tier 5's fingerprint comparison (role is part of the fingerprint) produces 409 `IDEMPOTENCY_KEY_CONFLICT` instead of a silent replay.
- **Same key replayed after the resource moved tenants**: not possible — tenant/owner are immutable on an expense for the lifetime of this design, so this case cannot arise.

### Error code table addendum

`NOT_EXPENSE_OWNER` stays in the table as defense-in-depth but is annotated **unreachable under the current fixed policy** (see "Consequence of decision 2" above); Phase 4 specs must carry that annotation forward so Phase 12 test review doesn't flag a missing test for an intentionally-unreachable code.

### Gate (superseded by Revision 2 below — kept for history)

Revision 1 is presented for a fresh design-review pass below. It is NOT approved; see Revision 2, which corrects it further.

---

## Design Review Revision 2 (controlling — supersedes Revision 1 where they disagree; still DRAFT, not approved)

Revision 1 is preserved above as history. This section fixes a correctness bug in it and several internal contradictions. **This section controls.**

### Attribution correction

Revision 1 mislabeled 4 items as "human policy decisions." The reviewer in this design-review loop is an **AI orchestration agent** ("the evaluator"), not the human author. Only **3** items are human-authored decisions: (1) legacy-row quarantine, (2) employee-role-only create/delete/restore, (3) 30-day half-open restore window. **Malformed JSON → 400** is evaluator (AI) design feedback under AC-011 — accepted as in-scope feedback on the already-authorized task, but it is not a human-confirmed answer. `agents/TEMP/EXP-003/coding-flow-state.md` carries the corrected split.

### Bug fixed: same-key DELETE replay must not 404

Revision 1's Tier 3 "resource exists AND is visible" check excluded tombstones *before* any idempotency lookup, for every single-resource route including DELETE itself. Consequence: an owner's own idempotent retry of a *successful* DELETE (same key, same payload) would hit Tier 3, find the row now tombstoned, treat it as "not visible," and return 404 — instead of replaying the original 200. That breaks the idempotency contract ("same key/actor/route/canonical payload returns the original semantic result") for the one route that itself creates the tombstone.

**Fix: split "existence" from "ordinary visibility," and scope tombstone-awareness to the routes that need it.**

- **Tenant-bound existence check** (tombstone-blind): row exists and `tenant_id` matches the actor's tenant. Else → 404 `EXPENSE_NOT_FOUND`. Runs for every single-resource route (`GET /:id`, `PATCH decision`, `DELETE`, `POST restore`), identically, regardless of tombstone state. This is pure tenant isolation and never depends on role or ownership.
- **Ordinary visibility** (tombstone-hiding + employee read-scope), applied only to `GET /:id`, `GET /expenses` (list), and `PATCH decision`: after tenant-bound existence passes, a tombstoned row is treated as not-found (404) — reads and decisions never see a deleted expense, and this never leaks "it existed and was deleted" vs. "never existed." For `employee`, a row not owned by them is likewise treated as not-found (404) — this is the request's explicit "read only their own" visibility rule, not an authorization denial.
- **Tombstone-aware lookup**, applied only to `DELETE` and `POST restore`: tenant-bound existence is sufficient to proceed — a tombstoned row is a valid find, not a 404. Its tombstone state feeds the state-precondition tier (409) and the idempotency tier (replay), never an existence error. This is the only place tombstone state is inspected for anything other than hiding — and only for the two routes whose entire job is to read or reverse that state.

### Bug fixed: same-tenant ownership denial was wrongly converted to 404

Revision 1 also folded same-tenant, non-owner **mutation** attempts into the same 404 as cross-tenant — e.g. employee B deleting employee A's same-tenant expense. That is wrong: the request specifies "authenticated but disallowed actions return 403," and ownership-of-the-resource-being-mutated is a disallowed-action rule like self-decision or the approval threshold, not a visibility rule. **Fix:** ownership for DELETE/restore is a resource-dependent **403 `NOT_EXPENSE_OWNER`, reachable** — it runs after the tenant-bound existence check and after role-capability, exactly like self-decision and the approval threshold. It is retracted from Revision 1's claim of "unreachable"; Phase 11/12 must test it directly (see test list below).

404-for-non-owner is reserved for exactly two cases: cross-tenant (any route), and the explicit **read-scope** hiding on `GET`/`list`/`decision` described above. It is never used to mask a mutation-authorization denial.

### Corrected, non-contradictory tier order

Numbering fix: there is no "Tier 0 runs before Tier 1 but Tier 1 claims to run before Tier 0." Actual order, single list, every tier gated on all earlier tiers passing:

| # | Check | Failure | Routes | Tombstone handling |
|---|---|---|---|---|
| 1 | `onRequest` hook: actor headers present/well-formed, `x-role` ∈ {employee, manager, finance} | 401 `UNAUTHENTICATED` | all `/expenses*` | n/a — runs before body parsing |
| 2 | Fastify body-parsing (only after #1 passes) | 400 `VALIDATION_ERROR` (evaluator feedback, AC-011 — was 500 in the seed) | routes with a body | n/a |
| 3 | Params/body schema (Zod) and `Idempotency-Key` format (mutations) | 400 `VALIDATION_ERROR` / `IDEMPOTENCY_KEY_REQUIRED` / `IDEMPOTENCY_KEY_INVALID` | per route | syntax only; no actor-mismatch authorization check yet |
| 4 | **Tenant-bound existence** (tombstone-blind): row exists, same tenant | 404 `EXPENSE_NOT_FOUND` | `GET /:id`, `decision`, `DELETE`, `restore` | ignored at this step for every route |
| 4b | **Ordinary visibility**, only for `GET /:id`/list/`decision`: hide tombstoned rows; hide non-owned rows from `employee` | 404 `EXPENSE_NOT_FOUND` | `GET /:id`, list (row-filter, not an error), `decision` | tombstoned → hidden |
| 5 | Role-capability (resource-independent): only `employee` may create/delete/restore; `employee` may not decide | 403 `FORBIDDEN_ROLE` | create, decision, delete, restore | n/a |
| 6 | Actor/body identity agreement; resource-dependent policy: self-decision, manager threshold (>100,000¢), **ownership (delete/restore, reachable)** | 403 `ACTOR_MISMATCH` / `SELF_DECISION_FORBIDDEN` / `APPROVAL_LIMIT_EXCEEDED` / `NOT_EXPENSE_OWNER` | create (identity agreement only), decision, delete, restore | after tenant lookup for every resource-targeted command, before replay |
| 7 | Idempotency lookup, keyed by `(tenant, actor user, key)` on the *current* request | replay stored 2xx verbatim, **or** 409 `IDEMPOTENCY_KEY_CONFLICT` on fingerprint mismatch, **or** fall through if no record | create, decision, delete, restore | tombstone state already resolved by #4/#4b/#6 above; replay itself is tombstone-agnostic — it returns the frozen snapshot |
| 8 | State precondition | 409 `EXPENSE_ALREADY_DECIDED` / `EXPENSE_RETENTION_LOCKED` (decided, employee-delete attempt) / `EXPENSE_ALREADY_DELETED` (fresh delete, already tombstoned, no matching idempotency record) / `EXPENSE_NOT_DELETED` (restore, not tombstoned) / `RESTORE_WINDOW_EXPIRED` | decision, delete, restore | this is where tombstone state is finally consumed for delete/restore |
| 9 | Mutate + exactly one audit append + idempotency save, one transaction | 500 `INTERNAL_ERROR` on throw (rollback) | create, decision, delete, restore |

**Precedence, stated precisely (fixes the 3 flagged contradictions):**
- 404 (tier 4/4b) precedes 403 (tiers 5/6) and 409-idempotency-conflict (tier 7) — **not** 401 (tier 1) or syntax-level 400 (tiers 2/3). A lookup cannot run without valid auth and valid params, so those must resolve first.
- "Manager/finance always 403 independent of tenant" (Revision 1 policy item 2) is corrected to: role-capability 403 fires **once tier 4 has already passed** for single-resource routes — i.e. for a *same-tenant* target. A manager targeting a *cross-tenant* expense never reaches tier 5; tier 4 already 404'd. For `create` (no target resource, no tier 4), a manager/finance attempt goes straight to tier 5 and is 403 regardless of any tenant concept, since there is no resource to be cross-tenant about.
- Same-tenant authenticated-but-disallowed actions (non-owner delete/restore, self-decision, over-threshold) follow the specified **403** policy (tier 6) — they are never silently converted to 404. 404 is reserved for cross-tenant (tier 4) and the explicit read-scope/tombstone-hiding cases (tier 4b) only.

### New state code added

`EXPENSE_ALREADY_DELETED` (409): a fresh delete with no stored record for its scoped key against an already-tombstoned row. A stored key with a different fingerprint instead returns `IDEMPOTENCY_KEY_CONFLICT` at tier 7 and does not fall through. A matching key replays the original success.

### Required test matrix for Phase 11/12 (design-level list; tests themselves are written in Phase 11)

1. Same-key DELETE replay after tombstoning → original 200 replayed, no second audit event, no error.
2. Same-key restore replay after restoration → original 200 replayed, no second audit event.
3. Same-key restore replay attempted after the 30-day window subsequently expires → still replays the original success (frozen snapshot), not a fresh 409.
4. Fresh (new-key) delete attempt against an already-tombstoned expense → 409 `EXPENSE_ALREADY_DELETED`.
5. Fresh restore attempt against a non-tombstoned expense → 409 `EXPENSE_NOT_DELETED`.
6. Fresh restore attempt after the window has expired (no prior successful restore) → 409 `RESTORE_WINDOW_EXPIRED`.
7. Wrong-tenant resource-targeted retry: authenticated, syntactically valid request with a different `x-tenant-id` → tier 4 returns404 before any idempotency lookup. No original record is consulted.
8. Wrong-user DELETE/restore retry: same tenant, different employee `x-user-id` → tier 6 returns403 `NOT_EXPENSE_OWNER` before any idempotency lookup. Create has no existing target: keys are actor-scoped, so a different user's authorized create is a separate request, never another user's replay.
9. Wrong-role retry: same key/tenant/user, different `x-role` (e.g. employee → manager on a delete key) → tier 5 role-capability now evaluates the new role fresh and 403s before tier 7 is ever reached; stored record is not consulted.
10. Changed-payload retry: same key/tenant/user/role, different valid and authorized canonical body → tier 7 fingerprint mismatch → 409 `IDEMPOTENCY_KEY_CONFLICT`. Syntax/authorization failures retain earlier precedence.
11. Non-owner same-tenant mutation: employee B attempts delete/restore on employee A's expense (same tenant) → tier 6 → 403 `NOT_EXPENSE_OWNER` (reachable, not 404).
12. Cross-tenant mutation attempt by an actor whose role could never do the action anyway (e.g. manager from tenant B, delete route) → tier 4 → 404, confirming role incapacity never leaks ahead of tenant isolation.
13. Cross-tenant resource-targeted read/decision →404. List is a tenant/role-filtered collection, not a resource-id lookup: return200 with only allowed rows (possibly empty), never another tenant's rows.

### Evaluator consistency reconciliation (2026-10-13)

The AI evaluator corrected the remaining actor-draft contradictions above after preserving Revision 2 privately: actor/body identity authorization now follows tenant existence for resource-targeted requests; wrong-user mutation retries return403 rather than a cross-tenant-style404; collection lists are scoped200 results; fingerprint conflicts never fall through to state checks. These are evaluator edits, not an additional actor self-review or human approval. Initial drafts, feedback, decisions and actor ledger remain retained separately.

### Gate

This revision is presented for a fresh design-review pass. **Phase 3 is still not approved.** No Phase 4 (specs/plan), Phase 7 (implementation), or any product/test/dependency edit starts until the human author explicitly approves (the strict approval sentence per `hitl`).
