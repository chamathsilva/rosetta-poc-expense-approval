# CONTEXT

Purpose: business and behavioral context for this workspace, from a stakeholder point of view.
Contains: why the project exists, domain, actors, lifecycle, business rules, scope boundary, vocabulary.
Excludes: technical details (see `docs/ARCHITECTURE.md`, `docs/TECHSTACK.md`); exact HTTP contract (see `docs/BASELINE-API.md`, `docs/EXP-003-COMPATIBILITY.md`).
Style: terse bullets, grep-friendly `##` headers, no code. Keep under 100 lines.

## Why This Project Exists

- Disposable, public, deliberately simple expense-approval service ("Rosetta POC: Expense Approval").
- Serves as the shared, neutral starting point for an independent, evidence-backed Rosetta evaluation / case study.
- Immutable starting point: Git tag `expense-seed-v1`. EXP-003 extends that seed with tenancy, roles, audit and lifecycle; it does not replace it.
- Not a production system; no real users, money, or data.

## Study Boundary

- Experiment prompts, hidden evaluation expectations, and scoring criteria live outside this repository by design.
- Do not guess, search for, or optimize toward hidden evaluation criteria.
- Do not invent product scope beyond what is implemented or what approved requirements state.

## Domain

- An employee submits an expense claim; a manager or finance reviewer approves or rejects it once.
- Expense data: tenant, employee identifier, description, amount, currency, status, reviewer identifier, optional decision note, created/updated/deleted times.

## Actors and Simulated Auth

- Every `/expenses*` request carries `x-tenant-id`, `x-user-id`, `x-role` headers, resolved into an `actor` by a request hook.
- **Disclaimer (binding): these headers simulate a trusted upstream authentication layer. They are not production authentication.** Any caller can forge them; nothing here verifies real identity.
- Roles: `employee` (submits, deletes and restores own expenses only), `manager` (decides within approval limit), `finance` (decides any amount). A role never acts as another.
- All data and actions are scoped to the caller's tenant; no cross-tenant visibility or mutation.

## Decision Policy (fixed)

- Only `manager` or `finance` may approve/reject; `employee` cannot decide, including on its own expense.
- No actor may decide (approve or reject) an expense it submitted (self-decision forbidden), regardless of role.
- `manager` may approve up to and including 100,000 cents; above that, approval is rejected (reject is unlimited for a manager). `finance` may approve or reject any amount.
- Only `employee` may create, delete or restore an expense, and only its own.

## Expense Lifecycle

- New submission always starts as `SUBMITTED`.
- `SUBMITTED` -> `APPROVED` or `SUBMITTED` -> `REJECTED`. A second decision is refused ("already decided").
- A `SUBMITTED` (not yet decided) expense may be logically deleted (tombstoned) by its owner; a decided expense cannot be deleted.
- A tombstoned expense is restorable by its owner within 30 days of deletion (half-open window: the 30-day instant itself is already expired). After the window, or for a non-tombstoned expense, restore is refused.
- There is no purge: expired tombstones are retained indefinitely. No edit, withdraw or reopen exists.

## Audit and Idempotency (business terms)

- Every successful create/decide/delete/restore is recorded once in an append-only history, with who/when/what and no sensitive request content. History cannot be edited or erased through the API, and it survives deletion of the expense it concerns.
- Every create/decide/delete/restore call must carry a client-supplied idempotency key, so a retried request (e.g. after a dropped connection) returns the original result instead of repeating the effect. A key reused with different request content is rejected, not silently replayed.

## Attachments

- Attachments/receipts are unsupported. Treat as out of scope, not planned.

## Baseline Compatibility

- This workstream deliberately changes 8 points of behavior from the neutral seed (new required headers and idempotency keys, tenant/role scoping, new delete/restore routes, schema migration, and framework error statuses). Full list, rationale and judgment calls: `docs/EXP-003-COMPATIBILITY.md`.
- `docs/BASELINE-API.md` is unchanged (human-owned; see `docs/ASSUMPTIONS.md` A9).

## Capabilities

- Liveness check; submit, list (tenant/role-scoped), read, approve/reject, delete, restore an expense.
- Persistent SQLite storage with in-place schema migration preserving pre-existing rows.

## Not In Baseline / Out of Scope

- Real authentication, multi-process writers, pagination, audit read API, purge job, attachments/receipts, currency conversion.
- Treat these as unknown, not as forbidden or planned, until requirements say otherwise.

## Stakeholders

- Study owner / evaluator: owns the hidden evaluation and the seed tag.
- Coding agent under evaluation: works from this repository and approved requirements only.

## Vocabulary

- Tenant: an isolation boundary; nothing crosses it, ever.
- Tombstone: a logical delete (`deletedAt` set); the row is retained, hidden from ordinary reads.
- Idempotency key: a client-supplied token scoping a mutation to "this exact call happened once."
- Seed / Baseline: the neutral starter state at tag `expense-seed-v1`, documented in `docs/BASELINE-API.md`.

## Related Docs

- `docs/BASELINE-API.md`: seed request/response examples (human-owned; preserve).
- `docs/EXP-003-COMPATIBILITY.md`: full list of breaks and judgment calls.
- `docs/ARCHITECTURE.md`: technical structure. `docs/ASSUMPTIONS.md`: open unknowns. `agents/IMPLEMENTATION.md`: implementation state.
