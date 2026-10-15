# Rosetta POC: Expense Approval

A disposable public TypeScript service used as the shared starting point for an independent, evidence-backed Rosetta evaluation.

## Baseline service

The starter is a deliberately simple API. It supports:

- creating an expense submission;
- listing and reading submissions;
- approving or rejecting a submitted expense;
- SQLite persistence;
- input validation and deterministic integration tests.

The immutable starting point for the expense case study and governance probes is the Git tag `expense-seed-v1`.

## EXP-003: tenancy, roles, audit, idempotency, lifecycle

The EXP-003 workstream extends the baseline above with a tenant/actor boundary, RBAC, an append-only audit log, idempotent mutations, and a delete/restore lifecycle. Full list of behavior changes from the baseline: [`docs/EXP-003-COMPATIBILITY.md`](docs/EXP-003-COMPATIBILITY.md).

AC-011 follow-up (2026-10-15): oversized route parameters now receive a safe400 response;
HEAD responses have no body. The unchanged router limit applies before authentication and
body parsing. Native clean-install/check and independent coordinator checks pass204 tests,
typecheck and build. See the [review report](plans/EXP-003/AC-011-FOLLOWUP-REPORT.md) and
[supplemental manifest](plans/EXP-003/AC-011-FOLLOWUP-MANIFEST.md). Publication is pending.

**Disclaimer: the headers below simulate a trusted upstream authentication layer. They are not production authentication** — any caller can forge them.

Every normally routed `/expenses*` operation requires three headers (oversized parameters can
be rejected earlier by the router, as described above):

| Header | Rule |
|---|---|
| `x-tenant-id` | 1-100 chars, `[A-Za-z0-9._-]` |
| `x-user-id` | 1-100 chars, `[A-Za-z0-9._-]` |
| `x-role` | one of `employee`, `manager`, `finance` |

Role assumptions (fixed): only `employee` may create, delete or restore, and only its own expenses; only `manager`/`finance` may approve/reject, never their own expense; `manager` approval is capped at 100,000 cents, `finance` has no cap.

Every create/decide/delete/restore call also requires an `Idempotency-Key` header (1-128 chars, `[A-Za-z0-9._:-]`) so a retried request replays the original result instead of repeating the effect.

```bash
# Create an expense (employee only; employeeId defaults to x-user-id if omitted)
curl -X POST http://localhost:3000/expenses \
  -H "x-tenant-id: tenant-a" -H "x-user-id: employee-1" -H "x-role: employee" \
  -H "Idempotency-Key: create-1" -H "Content-Type: application/json" \
  -d '{"description":"Conference registration","amountCents":12500,"currency":"USD"}'

# Approve it (manager/finance only; reviewerId defaults to x-user-id)
curl -X PATCH "http://localhost:3000/expenses/<expenseId>/decision" \
  -H "x-tenant-id: tenant-a" -H "x-user-id: manager-1" -H "x-role: manager" \
  -H "Idempotency-Key: decide-1" -H "Content-Type: application/json" \
  -d '{"status":"APPROVED"}'

# Delete a separate, still-SUBMITTED expense (owner only; decided expenses return409)
curl -X DELETE "http://localhost:3000/expenses/<expenseId>" \
  -H "x-tenant-id: tenant-a" -H "x-user-id: employee-1" -H "x-role: employee" \
  -H "Idempotency-Key: delete-1"

# Restore within 30 days of deletion (owner only; 409 after the window)
curl -X POST "http://localhost:3000/expenses/<expenseId>/restore" \
  -H "x-tenant-id: tenant-a" -H "x-user-id: employee-1" -H "x-role: employee" \
  -H "Idempotency-Key: restore-1"
```

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Static liveness response (unauthenticated; no database query). |
| `POST` | `/expenses` | Create a submitted expense (employee only). |
| `GET` | `/expenses` | List expenses, tenant- and role-scoped; tombstones hidden. |
| `GET` | `/expenses/:expenseId` | Read one expense (tenant/role/tombstone-scoped). |
| `PATCH` | `/expenses/:expenseId/decision` | Approve or reject a submitted expense (manager/finance only). |
| `DELETE` | `/expenses/:expenseId` | Tombstone a submitted expense (owner only). |
| `POST` | `/expenses/:expenseId/restore` | Restore a tombstoned expense within 30 days (owner only). |

See [Baseline API](docs/BASELINE-API.md) for the unauthenticated seed-era examples and [EXP-003 Compatibility](docs/EXP-003-COMPATIBILITY.md) for every behavior change from that baseline.

## Local development

```bash
nvm use
npm ci
npm run check
npm run dev
```

The default database is `data/expenses.sqlite`. Override it with `DATABASE_PATH`; set it to `:memory:` for an ephemeral database.

## Study boundary

This public repository documents only the behavior present in the neutral starter. Experiment-specific prompts, hidden evaluation expectations, and scoring criteria are intentionally maintained outside the target repository so they cannot influence the coding agent before a run.
