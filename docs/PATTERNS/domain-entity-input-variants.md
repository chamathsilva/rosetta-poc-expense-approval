# Domain Entity Input Variants

## Description

A domain concept is modeled as multiple narrow interfaces instead of one interface with optional fields: the full persisted entity (`Expense`), the shape needed to create one (`NewExpense`), and the shape needed to mutate it (`ExpenseDecision`). Found in `src/domain.ts`. Use this split whenever a new domain concept has meaningfully different "create" vs "read" vs "update" shapes, instead of making entity fields optional to accommodate partial writes.

## Template/Example

```ts
// Full persisted shape — every field always present once stored.
export interface <Entity> {
  id: string;
  // ...all persisted fields, including server-assigned ones (status, timestamps)
}

// Shape required to create one — only caller-supplied + server-generated-at-creation fields.
export interface New<Entity> {
  id: string; // <extension point>: server-generated fields (id, createdAt) still
  createdAt: string; // belong here since the caller (route handler) supplies them
  // ...caller-supplied fields only, no derived/default fields like `status`
}

// Shape required for a specific mutation — only the fields that mutation touches.
export interface <Entity>Decision {
  // ...fields relevant to this one mutation only
}
```

## Notes

- `ExpenseStatus` itself is a `const` array (`EXPENSE_STATUSES`) plus a derived union type (`(typeof EXPENSE_STATUSES)[number]`), not a hand-written `enum` or union literal — keep the array as the single source of truth so repository guards (`expenseStatus` in the Typed Row Field Extraction pattern) can validate membership against it.
- `ExpenseDecision.status` narrows with `Exclude<ExpenseStatus, "SUBMITTED">` to make illegal states (deciding into "SUBMITTED") unrepresentable at the type level.
