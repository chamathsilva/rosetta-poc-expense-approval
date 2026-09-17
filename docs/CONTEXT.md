# CONTEXT

**Purpose**: business context for this workspace — what the product is, who it serves, what it promises. Read this first, every session.
**Contains**: domain, actors, capabilities, rules, boundaries, vocabulary.
**Excludes**: technology, file layout, code structure — see `ARCHITECTURE.md` and `CODEMAP.md`.
**Style**: bullets, stakeholder language, terse. Max 100 lines. If it grows, split into `<FEATURE>-CONTEXT.md` and index them here.

## Agent Directives

- MUST USE SKILL `codemap` FOR CODE NAVIGATION — `docs/CODEMAP.md` is the only code-navigation mechanism installed in this workspace.

## What This Is

- **Rosetta POC: Expense Approval** — a deliberately small expense submission-and-approval service.
- It is a **disposable, public, neutral starter**: the shared, identical starting point given to every participant of an independent, evidence-backed Rosetta evaluation.
- The service is not a product. Its value is that it is small, boring, and the same for everyone, so differences observed later are attributable to the evaluation, not to the codebase.
- The immutable starting point is the git tag `expense-seed-v1`.

## Study Boundary

- This public repository documents **only the behavior present in the neutral starter**.
- Experiment-specific prompts, hidden evaluation expectations, and scoring criteria are **intentionally kept outside this repository** so they cannot influence a coding agent before a run.
- Consequence for agents: absence of a feature here is not evidence it is out of scope for a task. Do not infer evaluation intent from this repo. Ask the human.
- Consequence for agents: do not add evaluation, scoring, or prompt material to this repo.

## Actors

- **Employee** — submits an expense for reimbursement. Identified by a caller-supplied employee reference.
- **Reviewer** — approves or rejects a submitted expense, optionally with a note. Identified by a caller-supplied reviewer reference.
- **API consumer** — any client of the service. The starter has no user interface.
- **Evaluation operator** — a human running the study, working from the `expense-seed-v1` baseline.

## Core Concept: Expense

An expense is one reimbursement claim. It carries:

- who submitted it, a free-text description, an amount, and a currency;
- its decision status, and — once decided — who decided it and an optional note;
- when it was created and when it last changed.

## Capabilities

- **Submit an expense** — an employee records a claim; it enters the system already submitted and awaiting a decision.
- **List expenses** — all claims, most recently changed first.
- **Read one expense** — retrieve a single claim by its reference.
- **Decide an expense** — a reviewer approves or rejects a claim awaiting decision, optionally attaching a note.
- **Readiness check** — confirm the service is up.

## Business Rules

- A new claim is always **awaiting decision (SUBMITTED)**. A caller cannot submit a claim that is already approved or rejected.
- A decision is **approve or reject** — there is no third outcome, no "pending" decision, no partial approval.
- A decision is **final and one-time**. Once approved or rejected, a claim cannot be re-decided, reversed, amended, or withdrawn. A second attempt is refused as a conflict.
- A claim **cannot be edited** after submission. There is no update capability.
- A claim **cannot be deleted**. This is deliberate, not an oversight — it is asserted by test.
- A decision note is **optional**; a reviewer reference is **mandatory**.
- An amount must be **positive** and capped at 100,000,000 cents — an input-sanity bound, not an approval threshold. A currency must be a three-letter code — format-checked only, not validated against ISO-4217 or converted.
- Rejected input is refused outright rather than corrected or partially accepted.

## Lifecycle

```
SUBMITTED ──approve──> APPROVED  (terminal)
    └──────reject────> REJECTED  (terminal)
```

## Deliberate Non-Goals

The starter has none of the following, by design. Their absence is part of the neutral baseline:

- authentication, authorization, or any check that a reviewer may decide a given claim (including self-approval);
- separation of duties, approval thresholds, delegation, or multi-step approval chains;
- an audit trail beyond the last-changed timestamp;
- editing, withdrawal, deletion, or reopening of a claim;
- filtering, searching, or paging of the claim list;
- currency conversion, tax handling, receipts, attachments, or payment;
- notification of any party about a submission or a decision;
- reporting, budgets, or spend limits.

## Vocabulary

- **Expense** — one reimbursement claim. Not "claim", "request", or "report" in code or docs; use **expense**.
- **Submission** — the act of creating an expense; also the state it lands in.
- **Decision** — the approve-or-reject act. Use **decide/decision**, not "review", "sign-off", or "authorize".
- **Reviewer** — the decider. Not "approver" (they may also reject) and not "manager".
- **Baseline / seed** — the untouched `expense-seed-v1` state.

## Related

- `ARCHITECTURE.md` — how it is built. `CODEMAP.md` — where things are.
- `BASELINE-API.md` — request/response examples and validation limits.
- `ASSUMPTIONS.md` — what is inferred and not yet confirmed by a human.
