# Zod Strict Schema Definition

## Description

The three request-body and route-params objects in `src/schemas.ts` use `.strict()` to reject unknown keys. Create and decision bodies also export inferred input types; params do not. Environment validation in `src/server.ts` is non-strict. Use the request convention for new API input shapes without applying it indiscriminately to environment configuration.

## Template/Example

```ts
import { z } from "zod";

export const <name>Schema = z.object({
  // Field-level validation: trim strings, bound lengths, constrain ranges.
  // Add one line per field; keep fields required unless explicitly optional.
  fieldA: z.string().trim().min(1).max(100),
  fieldB: z.number().int().positive().max(100_000_000),
  // Enums for closed sets of allowed values:
  fieldC: z.enum(["VALUE_ONE", "VALUE_TWO"]),
  // Optional fields use `.optional()` explicitly:
  fieldD: z.string().trim().min(1).max(500).optional()

  // <extension point>: add new fields here following the same style
  // (trim + bounds for strings, int/positive/max for numeric amounts).
}).strict(); // always .strict() — rejects unexpected properties

// Export an inferred input type when consumers need one (as for create/decision).
export type <Name>Input = z.infer<typeof <name>Schema>;
```

## Notes

- `.strict()` applies to the three request schemas, not the environment schema.
- Regex is used for fixed-format strings (e.g. `currency: z.string().regex(/^[A-Z]{3}$/)`).
- Existing exported request types are CreateExpenseInput and ExpenseDecisionInput; no params alias is exported.
