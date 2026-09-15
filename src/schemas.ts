import { z } from "zod";

export const createExpenseSchema = z.object({
  employeeId: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  amountCents: z.number().int().positive().max(100_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).strict();

export const expenseDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewerId: z.string().trim().min(1).max(100),
  note: z.string().trim().min(1).max(500).optional()
}).strict();

export const expenseParamsSchema = z.object({
  expenseId: z.string().trim().min(1).max(100)
}).strict();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ExpenseDecisionInput = z.infer<typeof expenseDecisionSchema>;
