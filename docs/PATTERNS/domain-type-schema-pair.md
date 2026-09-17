# Domain Type Paired with Zod Schema

## Description
Each domain concept has a plain TS interface in `domain.ts` describing its persisted/full shape, and one or more narrower Zod schemas in `schemas.ts` describing the subset of fields accepted from a client for a given operation (create vs. decide vs. lookup). The Zod schema's enum values are drawn from the same source-of-truth constant as the domain type. Use this when introducing a new domain entity or a new mutating operation on an existing one.

Found in: `src/domain.ts` (`Expense`, `NewExpense`, `ExpenseDecision`, `EXPENSE_STATUSES`) paired with `src/schemas.ts` (`createExpenseSchema` mirrors `NewExpense`, `expenseDecisionSchema` mirrors `ExpenseDecision`, both reuse status values from `EXPENSE_STATUSES`/`ExpenseStatus`).

## Template/Example
```ts
// domain.ts — source of truth
export const RESOURCE_STATUSES = ["DRAFT", "ACTIVE", "CLOSED"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export interface Resource {              // full persisted shape
  id: string;
  status: ResourceStatus;
  // ...
}

export interface NewResource {           // fields required to create one
  id: string;
  // EXTENSION POINT: subset of Resource needed at creation time, no status/timestamps
}

// schemas.ts — client-facing validation, narrower than the domain type
export const createResourceSchema = z.object({
  // mirror NewResource's client-supplied fields only (no id, no server-set fields)
}).strict();
```

Rules:
- The domain module owns status/enum constants; schemas reference them, never redefine the list of allowed values.
- A schema's fields are a strict subset of the domain type's fields relevant to that one operation (creation input excludes server-assigned fields like `id`/`status`/timestamps).
