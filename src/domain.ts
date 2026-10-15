export const EXPENSE_STATUSES = [
  "SUBMITTED",
  "APPROVED",
  "REJECTED"
] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const ROLES = ["employee", "manager", "finance"] as const;

export type Role = (typeof ROLES)[number];

export interface Actor {
  tenantId: string;
  userId: string;
  role: Role;
}

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
  deletedAt: string | null;
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

export interface ExpenseTombstone {
  deletedAt: string;
  deletedBy: string;
}

export interface ExpenseRestoration {
  restoredAt: string;
}

export const AUDIT_EVENT_TYPES = [
  "EXPENSE_SUBMITTED",
  "EXPENSE_APPROVED",
  "EXPENSE_REJECTED",
  "EXPENSE_DELETED",
  "EXPENSE_RESTORED"
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export type AuditPayload =
  | { amountCents: number; currency: string }
  | { status: "APPROVED" | "REJECTED" }
  | Record<string, never>;

export interface NewAuditEvent {
  tenantId: string;
  expenseId: string;
  actorUserId: string;
  actorRole: Role;
  eventType: AuditEventType;
  occurredAt: string;
  payload: AuditPayload;
}

export interface AuditEvent {
  seq: number;
  tenantId: string;
  expenseId: string;
  actorUserId: string;
  actorRole: Role;
  eventType: AuditEventType;
  occurredAt: string;
  payload: AuditPayload;
}

export interface IdempotencyRecord {
  tenantId: string;
  actorUserId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  responseStatus: number;
  responseBody: string;
  createdAt: string;
}
