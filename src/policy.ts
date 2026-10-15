import type { Actor, Expense } from "./domain.js";

export const MANAGER_APPROVAL_LIMIT_CENTS = 100_000;
export const RESTORE_WINDOW_MS = 2_592_000_000; // 30 * 86_400_000

export type MutationCommand = "create" | "decide" | "delete" | "restore";

export type PolicyDenialCode =
  | "FORBIDDEN_ROLE"
  | "ACTOR_MISMATCH"
  | "SELF_DECISION_FORBIDDEN"
  | "APPROVAL_LIMIT_EXCEEDED"
  | "NOT_EXPENSE_OWNER"
  | "EXPENSE_ALREADY_DECIDED"
  | "EXPENSE_RETENTION_LOCKED"
  | "EXPENSE_ALREADY_DELETED"
  | "EXPENSE_NOT_DELETED"
  | "RESTORE_WINDOW_EXPIRED";

export type PolicyResult =
  | { allowed: true }
  | { allowed: false; code: PolicyDenialCode };

const ALLOWED: PolicyResult = { allowed: true };

function denied(code: PolicyDenialCode): PolicyResult {
  return { allowed: false, code };
}

export function listScope(actor: Actor): {
  tenantId: string;
  employeeId: string | null;
} {
  return {
    tenantId: actor.tenantId,
    employeeId: actor.role === "employee" ? actor.userId : null
  };
}

export function canViewExpense(actor: Actor, expense: Expense): boolean {
  return (
    expense.tenantId === actor.tenantId &&
    expense.deletedAt === null &&
    (actor.role !== "employee" || expense.employeeId === actor.userId)
  );
}

export function authorizeRole(
  actor: Actor,
  command: MutationCommand
): PolicyResult {
  if (command === "create" || command === "delete" || command === "restore") {
    return actor.role === "employee" ? ALLOWED : denied("FORBIDDEN_ROLE");
  }

  // command === "decide"
  return actor.role === "manager" || actor.role === "finance"
    ? ALLOWED
    : denied("FORBIDDEN_ROLE");
}

export function authorizeCreate(
  actor: Actor,
  requestedEmployeeId: string | undefined
): PolicyResult {
  if (
    requestedEmployeeId !== undefined &&
    requestedEmployeeId !== actor.userId
  ) {
    return denied("ACTOR_MISMATCH");
  }

  return ALLOWED;
}

export function authorizeDecision(
  actor: Actor,
  expense: Expense,
  decision: { status: "APPROVED" | "REJECTED"; reviewerId?: string | undefined }
): PolicyResult {
  if (
    decision.reviewerId !== undefined &&
    decision.reviewerId !== actor.userId
  ) {
    return denied("ACTOR_MISMATCH");
  }

  if (expense.employeeId === actor.userId) {
    return denied("SELF_DECISION_FORBIDDEN");
  }

  if (
    actor.role === "manager" &&
    decision.status === "APPROVED" &&
    expense.amountCents > MANAGER_APPROVAL_LIMIT_CENTS
  ) {
    return denied("APPROVAL_LIMIT_EXCEEDED");
  }

  return ALLOWED;
}

export function authorizeOwnerMutation(
  actor: Actor,
  expense: Expense
): PolicyResult {
  return expense.employeeId !== actor.userId
    ? denied("NOT_EXPENSE_OWNER")
    : ALLOWED;
}

export function decisionStateCheck(expense: Expense): PolicyResult {
  return expense.status !== "SUBMITTED"
    ? denied("EXPENSE_ALREADY_DECIDED")
    : ALLOWED;
}

export function deleteStateCheck(expense: Expense): PolicyResult {
  if (expense.status !== "SUBMITTED") {
    return denied("EXPENSE_RETENTION_LOCKED");
  }

  if (expense.deletedAt !== null) {
    return denied("EXPENSE_ALREADY_DELETED");
  }

  return ALLOWED;
}

export function restoreStateCheck(expense: Expense, now: string): PolicyResult {
  if (expense.deletedAt === null) {
    return denied("EXPENSE_NOT_DELETED");
  }

  if (expense.status !== "SUBMITTED") {
    return denied("EXPENSE_NOT_DELETED");
  }

  if (!isRestoreWindowOpen(expense.deletedAt, now)) {
    return denied("RESTORE_WINDOW_EXPIRED");
  }

  return ALLOWED;
}

export function isRestoreWindowOpen(deletedAt: string, now: string): boolean {
  const elapsed = Date.parse(now) - Date.parse(deletedAt);

  if (Number.isNaN(elapsed)) {
    throw new Error("invalid clock input");
  }

  if (elapsed < 0) {
    throw new Error("invalid clock: now precedes deletedAt");
  }

  return elapsed < RESTORE_WINDOW_MS;
}
