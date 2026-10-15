import { z } from "zod";

export const createExpenseSchema = z.object({
  employeeId: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().min(1).max(500),
  amountCents: z.number().int().positive().max(100_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).strict();

export const expenseDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewerId: z.string().trim().min(1).max(100).optional(),
  note: z.string().trim().min(1).max(500).optional()
}).strict();

export const expenseParamsSchema = z.object({
  expenseId: z.string().trim().min(1).max(100)
}).strict();

export const emptyMutationBodySchema = z.object({}).strict().optional();

export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9._:-]{1,128}$/);

export function parseIdempotencyKey(
  value: string | string[] | undefined
):
  | { ok: true; key: string }
  | { ok: false; code: "IDEMPOTENCY_KEY_REQUIRED" | "IDEMPOTENCY_KEY_INVALID" } {
  if (value === undefined) {
    return { ok: false, code: "IDEMPOTENCY_KEY_REQUIRED" };
  }

  if (Array.isArray(value)) {
    return { ok: false, code: "IDEMPOTENCY_KEY_INVALID" };
  }

  const parsed = idempotencyKeySchema.safeParse(value);

  if (!parsed.success) {
    return { ok: false, code: "IDEMPOTENCY_KEY_INVALID" };
  }

  return { ok: true, key: parsed.data };
}

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ExpenseDecisionInput = z.infer<typeof expenseDecisionSchema>;
