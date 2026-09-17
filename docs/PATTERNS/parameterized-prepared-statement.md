# Parameterized Prepared Statement Query

## Description
Every repository method builds its SQL as a template literal with `?` placeholders and calls `.prepare(sql).run/get/all(...args)` — never string-interpolated values. Use this for any new repository query to avoid SQL injection and keep query shape colocated with its parameters.

Found in: `src/expense-repository.ts` — `create()` (`.run`), `list()` (`.all`), `findById()` (`.get`), `decide()` (`.run`).

## Template/Example
```ts
public findByOwner(ownerId: string): DomainType[] {
  const rows = this.database.prepare(`
    SELECT *
    FROM resource_table
    WHERE owner_id = ?
    ORDER BY updated_at DESC, id ASC
  `).all(ownerId); // EXTENSION POINT: bind params positionally, matching each `?`

  return rows.map(mapRow);
}
```

Rules:
- Use `.run()` for INSERT/UPDATE, `.get()` for a single expected row, `.all()` for a list.
- Always pass values as bind parameters, in the same order as the `?` placeholders.
- Route every returned row through the Defensive SQL Row Mapper before returning it to callers.
