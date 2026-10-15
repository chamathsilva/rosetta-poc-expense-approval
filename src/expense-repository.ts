import type { DatabaseSync } from "node:sqlite";

import {
  EXPENSE_STATUSES,
  type Expense,
  type ExpenseDecision,
  type ExpenseRestoration,
  type ExpenseStatus,
  type ExpenseTombstone,
  type NewExpense
} from "./domain.js";

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];

  if (typeof value !== "string") {
    throw new Error(`Invalid persisted expense field: ${key}`);
  }

  return value;
}

function nullableString(
  row: Record<string, unknown>,
  key: string
): string | null {
  const value = row[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid persisted expense field: ${key}`);
  }

  return value;
}

function expenseStatus(value: string): ExpenseStatus {
  if (!EXPENSE_STATUSES.includes(value as ExpenseStatus)) {
    throw new Error("Invalid persisted expense status");
  }

  return value as ExpenseStatus;
}

function mapExpense(row: Record<string, unknown>): Expense {
  const amountCents = row.amount_cents;

  if (typeof amountCents !== "number") {
    throw new Error("Invalid persisted expense field: amount_cents");
  }

  return {
    id: requiredString(row, "id"),
    tenantId: requiredString(row, "tenant_id"),
    employeeId: requiredString(row, "employee_id"),
    description: requiredString(row, "description"),
    amountCents,
    currency: requiredString(row, "currency"),
    status: expenseStatus(requiredString(row, "status")),
    reviewerId: nullableString(row, "reviewer_id"),
    decisionNote: nullableString(row, "decision_note"),
    createdAt: requiredString(row, "created_at"),
    updatedAt: requiredString(row, "updated_at"),
    deletedAt: nullableString(row, "deleted_at")
  };
}

export class ExpenseRepository {
  public constructor(private readonly database: DatabaseSync) {}

  public create(input: NewExpense): Expense {
    this.database.prepare(`
      INSERT INTO expenses (
        id,
        tenant_id,
        employee_id,
        description,
        amount_cents,
        currency,
        status,
        reviewer_id,
        decision_note,
        created_at,
        updated_at,
        deleted_at,
        deleted_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'SUBMITTED', NULL, NULL, ?, ?, NULL, NULL)
    `).run(
      input.id,
      input.tenantId,
      input.employeeId,
      input.description,
      input.amountCents,
      input.currency,
      input.createdAt,
      input.createdAt
    );

    const expense = this.findInTenant(input.tenantId, input.id);

    if (expense === undefined) {
      throw new Error("Created expense could not be read");
    }

    return expense;
  }

  public listVisible(scope: {
    tenantId: string;
    employeeId: string | null;
  }): Expense[] {
    const rows = this.database.prepare(`
      SELECT *
      FROM expenses
      WHERE tenant_id = ?
        AND deleted_at IS NULL
        AND (? IS NULL OR employee_id = ?)
      ORDER BY updated_at DESC, id ASC
    `).all(scope.tenantId, scope.employeeId, scope.employeeId);

    return rows.map(mapExpense);
  }

  public findInTenant(
    tenantId: string,
    expenseId: string
  ): Expense | undefined {
    const row = this.database.prepare(`
      SELECT *
      FROM expenses
      WHERE tenant_id = ? AND id = ?
    `).get(tenantId, expenseId);

    return row === undefined ? undefined : mapExpense(row);
  }

  public decide(
    tenantId: string,
    expenseId: string,
    decision: ExpenseDecision
  ): Expense | undefined {
    const result = this.database.prepare(`
      UPDATE expenses
      SET
        status = ?,
        reviewer_id = ?,
        decision_note = ?,
        updated_at = ?
      WHERE tenant_id = ? AND id = ? AND status = 'SUBMITTED' AND deleted_at IS NULL
    `).run(
      decision.status,
      decision.reviewerId,
      decision.note,
      decision.decidedAt,
      tenantId,
      expenseId
    );

    if (result.changes === 0) {
      return undefined;
    }

    return this.findInTenant(tenantId, expenseId);
  }

  public tombstone(
    tenantId: string,
    expenseId: string,
    tombstone: ExpenseTombstone
  ): Expense | undefined {
    const result = this.database.prepare(`
      UPDATE expenses
      SET
        deleted_at = ?,
        deleted_by = ?,
        updated_at = ?
      WHERE tenant_id = ? AND id = ? AND status = 'SUBMITTED' AND deleted_at IS NULL
    `).run(
      tombstone.deletedAt,
      tombstone.deletedBy,
      tombstone.deletedAt,
      tenantId,
      expenseId
    );

    if (result.changes === 0) {
      return undefined;
    }

    return this.findInTenant(tenantId, expenseId);
  }

  public restore(
    tenantId: string,
    expenseId: string,
    restoration: ExpenseRestoration
  ): Expense | undefined {
    const result = this.database.prepare(`
      UPDATE expenses
      SET
        deleted_at = NULL,
        deleted_by = NULL,
        updated_at = ?
      WHERE tenant_id = ? AND id = ? AND deleted_at IS NOT NULL AND status = 'SUBMITTED'
    `).run(restoration.restoredAt, tenantId, expenseId);

    if (result.changes === 0) {
      return undefined;
    }

    return this.findInTenant(tenantId, expenseId);
  }
}
