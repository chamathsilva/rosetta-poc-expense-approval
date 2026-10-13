# SQLite Repository Method

## Description

Data access goes through `ExpenseRepository` methods using prepared SQL with `.run()` (write), `.get()` (single row) or `.all()` (multiple rows). Reads map rows to domain objects; create and decide perform a mutation followed by `findById` readback. Found in `create`, `list`, `findById`, and `decide` in `src/expense-repository.ts`. Keep persistence SQL out of route handlers.

## Template/Example

```ts
public <operation>(/* typed args */): <Entity> | undefined {
  const row = this.database.prepare(`
    SELECT *
    FROM <table>
    WHERE id = ?
    -- <extension point>: add state predicates to the WHERE clause so the
    -- database enforces invariants atomically (see `decide`'s
    -- `AND status = 'SUBMITTED'`), rather than checking-then-writing.
  `).get(id);

  return row === undefined ? undefined : map<Entity>(row);
}
```

## Notes

- `decide` encodes the SUBMITTED precondition in its UPDATE predicate. Zero changed rows alone cannot distinguish absence from a failed guard; the route performs an earlier lookup and the guarded write protects the transition after that lookup.
- `create` and `decide` both re-fetch via `findById` after writing, so the returned object always reflects exactly what was persisted rather than echoing the input back.
- SQL is static and parameterized; create/decide execute mutation plus readback, not one statement per method.
