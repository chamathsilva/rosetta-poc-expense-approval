# Strict Zod Schema Definition

## Description
Every input schema is a `z.object({...}).strict()` with explicit field-level constraints (trim, min/max length, numeric bounds, regex/enum). `.strict()` rejects unknown keys instead of silently dropping them. Use this for any new request-body/params/env schema to keep validation behavior consistent and catch client typos early.

Found in: `src/schemas.ts` — `createExpenseSchema`, `expenseDecisionSchema`, `expenseParamsSchema`; also `src/server.ts` — `environmentSchema` (same object+constraints style, though not `.strict()` since env vars carry extra keys).

## Template/Example
```ts
export const createResourceSchema = z.object({
  ownerId: z.string().trim().min(1).max(100),      // EXTENSION POINT: add fields here
  label: z.string().trim().min(1).max(500),
  amountCents: z.number().int().positive().max(100_000_000),
  code: z.string().regex(/^[A-Z]{3}$/)
}).strict(); // rejects unexpected keys

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
```

Rules:
- Export the inferred TS type (`z.infer<...>`) alongside the schema for downstream typing.
- Use `.strict()` for any body/params schema coming from an external client.
- Keep enums (`z.enum([...])`) aligned with domain constants (see Domain Type Paired with Zod Schema pattern).
