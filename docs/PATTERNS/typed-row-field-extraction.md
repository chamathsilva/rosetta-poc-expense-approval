# Typed Row Field Extraction

## Description

SQLite rows come back as `Record<string, unknown>`. Mapping checks strings/nulls through helpers, checks amount inline with `typeof`, and validates status membership before guarded casts. Unexpected persisted values throw; blind casts are not the convention. Found in `src/expense-repository.ts`'s `mapExpense` and helpers. Use runtime guards when mapping unknown records into domain objects.

## Template/Example

```ts
function required<Type>(row: Record<string, unknown>, key: string): <Type> {
  const value = row[key];

  if (typeof value !== "<expected-typeof>") {
    throw new Error(`Invalid persisted <entity> field: ${key}`);
  }

  return value;
}

// <extension point>: for closed-set string columns (enums), add a guard
// like `expenseStatus` that checks membership in the allowed constant
// array and throws `Invalid persisted <entity> <field>` otherwise.

function map<Entity>(row: Record<string, unknown>): <Entity> {
  return {
    fieldA: required<Type>(row, "field_a"), // snake_case column -> camelCase prop
    // ...
  };
}
```

## Notes

- Guards throw rather than silently coercing — a malformed row is treated as a programming/data-corruption error, not a value to default.
- Nullable columns get a `nullableString`-style variant that passes `null` through but still type-checks non-null values.
- Column names are snake_case in SQL, mapped to camelCase domain fields at this boundary only.
