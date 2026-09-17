# Guarded State-Transition Update

## Description
State transitions are enforced both at the application layer (check current status before attempting the transition) and at the SQL layer (`UPDATE ... WHERE id = ? AND status = 'SUBMITTED'`), so a row is only mutated if it is still in the expected prior state. If zero rows change, the repository returns `undefined` and the route reports a 409 conflict. Use this for any operation that transitions a resource through a finite set of states and must not double-apply.

Found in: `src/app.ts` — pre-check `existing.status !== "SUBMITTED"` (409 `EXPENSE_ALREADY_DECIDED`) plus post-check on `repository.decide()` returning `undefined` (409 `EXPENSE_DECISION_CONFLICT`); `src/expense-repository.ts` — `decide()`'s `WHERE ... AND status = 'SUBMITTED'` clause and `result.changes === 0` check.

## Template/Example
```ts
// repository layer
public transition(id: string, next: NextStateInput): DomainType | undefined {
  const result = this.database.prepare(`
    UPDATE resource_table
    SET status = ?, updated_at = ?
    WHERE id = ? AND status = 'EXPECTED_PRIOR_STATE' -- EXTENSION POINT: the guard condition
  `).run(next.status, next.updatedAt, id);

  if (result.changes === 0) {
    return undefined; // nothing transitioned: already moved on, or didn't exist
  }
  return this.findById(id);
}

// route layer
const existing = repository.findById(id);
if (existing === undefined) return reply.code(404).send(errorBody("NOT_FOUND", "..."));
if (existing.status !== "EXPECTED_PRIOR_STATE") {
  return reply.code(409).send(errorBody("ALREADY_TRANSITIONED", "..."));
}
const updated = repository.transition(id, input);
if (updated === undefined) {
  return reply.code(409).send(errorBody("TRANSITION_CONFLICT", "..."));
}
```

Rules:
- Always double-guard: an application-level pre-check for a fast, clear error, and a SQL-level `WHERE` guard for race-safety.
- Distinguish "not found" (404) from "found but wrong state" (409) from "raced to conflict" (409, different code).
