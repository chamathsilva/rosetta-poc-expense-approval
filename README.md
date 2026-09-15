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

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Check API and database readiness. |
| `POST` | `/expenses` | Create a submitted expense. |
| `GET` | `/expenses` | List all expenses. |
| `GET` | `/expenses/:expenseId` | Read one expense. |
| `PATCH` | `/expenses/:expenseId/decision` | Approve or reject a submitted expense. |

See [Baseline API](docs/BASELINE-API.md) for request and response examples.

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
