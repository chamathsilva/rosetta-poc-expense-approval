# Rosetta Implementation Summary

This file is a brief and durable summary of the current implementation state.
It is intentionally concise and should not be used as a chronological work log.

For detailed change history, use git history and PRs instead of expanding this file.

**Style**: "Baseline" section states where the code started and stays fixed. Each later workstream is its own `###` header with status and modified date, a few keyword-dense bullets, and references to `docs/` rather than restated detail.

## Baseline

State at tag `expense-seed-v1`, commit `34f08e4` "feat: create neutral expense service seed" — the neutral starting point for the Rosetta evaluation. Everything below this line is seed content; nothing has been implemented on top of it yet.

- Fastify HTTP service exposing `/health`, `POST /expenses`, `GET /expenses`, `GET /expenses/:expenseId`, `PATCH /expenses/:expenseId/decision`.
- Expense lifecycle `SUBMITTED → APPROVED | REJECTED`, terminal and one-time; second decision refused with `EXPENSE_ALREADY_DECIDED`.
- Zod validation of all client input; uniform `{ error: { code, message, details? } }` failure body.
- `node:sqlite` persistence, single `expenses` table, prepared statements, schema created on open, no migration tool.
- `buildApp(options)` composition root with injectable database path, id factory, clock, logger.
- Six vitest integration tests via `app.inject()`, including a deliberate assertion that no `DELETE` route exists.
- `npm run check` (typecheck + test + build) as the acceptance gate.
- No authentication, authorization, paging, editing, deletion, notification, or audit trail — deliberate, see `docs/CONTEXT.md` § Deliberate Non-Goals.

Architecture and layering: `docs/ARCHITECTURE.md`. Domain and rules: `docs/CONTEXT.md`. API examples: `docs/BASELINE-API.md`.

## Major Implemented Workstreams

_None yet. The workspace is at baseline. Add one `###` entry per workstream as work lands, newest first._

### [Workstream name]: [status], [YYYY-MM-DD]

- [Brief change with keywords and a reference to the doc or module that carries the detail]
