import type { DatabaseSync } from "node:sqlite";

import {
  EXPENSE_STATUSES,
  type Expense,
  type ExpenseDecision,
  type ExpenseStatus,
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
    employeeId: requiredString(row, "employee_id"),
    description: requiredString(row, "description"),
    amountCents,
    currency: requiredString(row, "currency"),
    status: expenseStatus(requiredString(row, "status")),
    reviewerId: nullableString(row, "reviewer_id"),
    decisionNote: nullableString(row, "decision_note"),
    createdAt: requiredString(row, "created_at"),
    updatedAt: requiredString(row, "updated_at")
  };
}

export class ExpenseRepository {
  public constructor(private readonly database: DatabaseSync) {}

  public create(input: NewExpense): Expense {
    this.database.prepare(`
      INSERT INTO expenses (
        id,
        employee_id,
        description,
        amount_cents,
        currency,
        status,
        reviewer_id,
        decision_note,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, 'SUBMITTED', NULL, NULL, ?, ?)
    `).run(
      input.id,
      input.employeeId,
      input.description,
      input.amountCents,
      input.currency,
      input.createdAt,
      input.createdAt
    );

    const expense = this.findById(input.id);

    if (expense === undefined) {
      throw new Error("Created expense could not be read");
    }

    return expense;
  }

  public list(): Expense[] {
    const rows = this.database.prepare(`
      SELECT *
      FROM expenses
      ORDER BY updated_at DESC, id ASC
    `).all();

    return rows.map(mapExpense);
  }

  public findById(expenseId: string): Expense | undefined {
    const row = this.database.prepare(`
      SELECT *
      FROM expenses
      WHERE id = ?
    `).get(expenseId);

    return row === undefined ? undefined : mapExpense(row);
  }

  public decide(
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
      WHERE id = ? AND status = 'SUBMITTED'
    `).run(
      decision.status,
      decision.reviewerId,
      decision.note,
      decision.decidedAt,
      expenseId
    );

    if (result.changes === 0) {
      return undefined;
    }

    return this.findById(expenseId);
  }
}
