# Defensive SQL Row Mapper

## Description
Raw rows returned from `node:sqlite` are `Record<string, unknown>`. A mapper function converts each row into a typed domain object, using small guard helpers (`requiredString`, `nullableString`, a value-set guard like `expenseStatus`) that throw if a persisted value doesn't match the expected shape. Use this whenever reading rows from a new table — it solves the loss of type safety at the DB boundary and fails loudly on data corruption instead of silently propagating `unknown`.

Found in: `src/expense-repository.ts` — `requiredString()`, `nullableString()`, `expenseStatus()` each called multiple times inside `mapExpense()`.

## Template/Example
```ts
function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`Invalid persisted field: ${key}`); // EXTENSION POINT: reuse for every non-null text column
  }
  return value;
}

function nullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`Invalid persisted field: ${key}`);
  }
  return value;
}

function mapRow(row: Record<string, unknown>): DomainType {
  return {
    id: requiredString(row, "id"),
    // EXTENSION POINT: one guarded field access per column, mirroring the table schema
    optionalNote: nullableString(row, "note")
  };
}
```

Rules:
- One guard function per primitive shape (required string, nullable string, numeric, closed-set/enum).
- Never cast a raw row directly to the domain type — always go through the mapper.
