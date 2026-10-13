# CONTEXT

Purpose: business and behavioral context for this workspace, from a stakeholder point of view.
Contains: why the project exists, domain, actors, lifecycle, business rules, scope boundary, vocabulary.
Excludes: technical details (see `docs/ARCHITECTURE.md`, `docs/TECHSTACK.md`); exact HTTP contract (see `docs/BASELINE-API.md`).
Style: terse bullets, grep-friendly `##` headers, no code. Keep under 100 lines.

## Why This Project Exists

- Disposable, public, deliberately simple expense-approval service ("Rosetta POC: Expense Approval").
- Serves as the shared, neutral starting point for an independent, evidence-backed Rosetta evaluation / case study.
- Immutable starting point: Git tag `expense-seed-v1` (expense case study and governance probes start from it).
- Not a production system; no real users, money, or data.

## Study Boundary

- Experiment prompts, hidden evaluation expectations, and scoring criteria live outside this repository by design.
- Do not guess, search for, or optimize toward hidden evaluation criteria.
- Implementation requirements arrive in later sessions; until then, the baseline behavior below is the full scope.
- Do not invent product scope beyond what the baseline does or what approved requirements state.

## Domain

- An employee submits an expense claim; a reviewer approves or rejects it once.
- Expense data: employee identifier, description, amount, currency, status, reviewer identifier, optional decision note, created/updated times.

## Actors

- Employee: submits expenses (identified only by a free-form employee identifier supplied with the request).
- Reviewer: approves or rejects a submitted expense (identified only by a free-form reviewer identifier).
- No sign-in, roles, or permission checks in the baseline; anyone calling the service can act as either actor.

## Expense Lifecycle

- New submission always starts as `SUBMITTED`.
- `SUBMITTED` -> `APPROVED` or `SUBMITTED` -> `REJECTED`.
- `APPROVED` and `REJECTED` are final: a second decision is refused ("already decided").
- No edit, withdraw, reopen, or delete in the baseline (deletion is explicitly absent).

## Business Rules (Baseline)

- Amount is a positive whole number of minor currency units (cents), capped at 100,000,000 (1,000,000.00 in major units).
- Currency is a three-letter uppercase code (e.g. `USD`); only the format is checked, not membership in a currency list.
- No currency conversion; each expense keeps its own currency.
- Employee and reviewer identifiers: required, up to 100 characters.
- Description: required, up to 500 characters; decision note: optional, up to 500 characters.
- Surrounding whitespace is trimmed; blank text counts as missing.
- Unknown or extra fields in a request are rejected as invalid input.
- Expense listing shows most recently updated first (ties broken by identifier).
- Outcomes users can see: created, found, not found, invalid input, already decided.

## Capabilities (Baseline)

- Check static service liveness (not a database readiness probe).
- Submit an expense.
- List all expenses (no filtering, search, or paging).
- Read one expense.
- Approve or reject a submitted expense.
- Data is stored persistently; seed tests verify closing/reopening app instances in one process, not an actual service-process restart.

## Not In Baseline

- Authentication, authorization, roles, self-approval prevention.
- Multi-step or threshold-based approval, delegation, notifications.
- Reporting, budgets, policies, attachments/receipts, reimbursement/payment.
- Treat these as unknown, not as forbidden or planned, until requirements say otherwise.

## Stakeholders

- Study owner / evaluator: owns the hidden evaluation and the seed tag.
- Coding agent under evaluation: works from this repository and approved requirements only.

## Vocabulary

- Expense submission: a request created by submitting an expense, starting in status `SUBMITTED`.
- Decision: the approve/reject action applied once to a `SUBMITTED` expense.
- Seed: the neutral starter state at tag `expense-seed-v1`.
- Baseline: behavior present in the seed, documented in `docs/BASELINE-API.md`.

## Related Docs

- `docs/BASELINE-API.md`: request/response examples and validation limits (human-owned; preserve).
- `docs/ARCHITECTURE.md`: technical structure.
- `docs/ASSUMPTIONS.md`: open unknowns, including future scope.
- `agents/IMPLEMENTATION.md`: implementation state and change log.
