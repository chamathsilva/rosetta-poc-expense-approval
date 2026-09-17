export const EXPENSE_STATUSES = [
  "SUBMITTED",
  "APPROVED",
  "REJECTED"
] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export interface Expense {
  id: string;
  tenantId: string;
  employeeId: string;
  description: string;
  amountCents: number;
  currency: string;
  status: ExpenseStatus;
  reviewerId: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewExpense {
  id: string;
  tenantId: string;
  employeeId: string;
  description: string;
  amountCents: number;
  currency: string;
  createdAt: string;
}

export interface ExpenseDecision {
  status: Exclude<ExpenseStatus, "SUBMITTED">;
  reviewerId: string;
  note: string | null;
  decidedAt: string;
}
