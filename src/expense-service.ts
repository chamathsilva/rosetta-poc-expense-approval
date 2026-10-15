import type { DatabaseSync } from "node:sqlite";

import type { AuditRepository } from "./audit-repository.js";
import type { Actor, IdempotencyRecord } from "./domain.js";
import { errorResult, type ServiceResult } from "./errors.js";
import type { ExpenseRepository } from "./expense-repository.js";
import type { IdempotencyRepository } from "./idempotency-repository.js";
import { requestFingerprint } from "./idempotency-repository.js";
import * as policy from "./policy.js";
import type { CreateExpenseInput, ExpenseDecisionInput } from "./schemas.js";
import { withTransaction } from "./transaction.js";

export interface ExpenseServiceDependencies {
  database: DatabaseSync;
  expenses: ExpenseRepository;
  audit: AuditRepository;
  idempotency: IdempotencyRepository;
  idFactory: () => string;
  now: () => string;
}

export class ExpenseService {
  public constructor(private readonly deps: ExpenseServiceDependencies) {}

  public list(actor: Actor): ServiceResult {
    const scope = policy.listScope(actor);
    const expenses = this.deps.expenses.listVisible(scope);

    return { statusCode: 200, body: { expenses } };
  }

  public get(actor: Actor, expenseId: string): ServiceResult {
    const expense = this.deps.expenses.findInTenant(actor.tenantId, expenseId);

    if (expense === undefined) {
      return errorResult("EXPENSE_NOT_FOUND");
    }

    if (!policy.canViewExpense(actor, expense)) {
      return errorResult("EXPENSE_NOT_FOUND");
    }

    return { statusCode: 200, body: { expense } };
  }

  public create(
    actor: Actor,
    idempotencyKey: string,
    input: CreateExpenseInput
  ): ServiceResult {
    return withTransaction(this.deps.database, () => {
      const now = this.deps.now();

      // T5: role-capability.
      const roleCheck = policy.authorizeRole(actor, "create");

      if (!roleCheck.allowed) {
        return errorResult(roleCheck.code);
      }

      // T6: actor/body identity agreement.
      const createCheck = policy.authorizeCreate(actor, input.employeeId);

      if (!createCheck.allowed) {
        return errorResult(createCheck.code);
      }

      // T7: idempotency lookup.
      const fingerprint = requestFingerprint({
        method: "POST",
        route: "/expenses",
        expenseId: null,
        role: actor.role,
        command: {
          amountCents: input.amountCents,
          currency: input.currency,
          description: input.description,
          employeeId: actor.userId
        }
      });
      const existingRecord = this.deps.idempotency.find(
        actor.tenantId,
        actor.userId,
        idempotencyKey
      );

      if (existingRecord !== undefined) {
        if (existingRecord.requestFingerprint === fingerprint) {
          return this.replayResult(existingRecord);
        }

        return errorResult("IDEMPOTENCY_KEY_CONFLICT");
      }

      // T9: guarded mutation + audit + idempotency save.
      const expense = this.deps.expenses.create({
        id: this.deps.idFactory(),
        tenantId: actor.tenantId,
        employeeId: actor.userId,
        description: input.description,
        amountCents: input.amountCents,
        currency: input.currency,
        createdAt: now
      });

      this.deps.audit.append({
        tenantId: actor.tenantId,
        expenseId: expense.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
        eventType: "EXPENSE_SUBMITTED",
        occurredAt: now,
        payload: {
          amountCents: expense.amountCents,
          currency: expense.currency
        }
      });

      const body = { expense };

      this.deps.idempotency.save({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        idempotencyKey,
        requestFingerprint: fingerprint,
        responseStatus: 201,
        responseBody: JSON.stringify(body),
        createdAt: now
      });

      return { statusCode: 201, body };
    });
  }

  public decide(
    actor: Actor,
    idempotencyKey: string,
    expenseId: string,
    input: ExpenseDecisionInput
  ): ServiceResult {
    return withTransaction(this.deps.database, () => {
      const now = this.deps.now();

      // T4: tenant-bound existence (tombstone-blind).
      const expense = this.deps.expenses.findInTenant(actor.tenantId, expenseId);

      if (expense === undefined) {
        return errorResult("EXPENSE_NOT_FOUND");
      }

      // T4b: ordinary visibility (hides tombstones and non-owned employee rows).
      if (!policy.canViewExpense(actor, expense)) {
        return errorResult("EXPENSE_NOT_FOUND");
      }

      // T5: role-capability.
      const roleCheck = policy.authorizeRole(actor, "decide");

      if (!roleCheck.allowed) {
        return errorResult(roleCheck.code);
      }

      // T6: identity agreement, self-decision, approval limit.
      const decisionCheck = policy.authorizeDecision(actor, expense, {
        status: input.status,
        reviewerId: input.reviewerId
      });

      if (!decisionCheck.allowed) {
        return errorResult(decisionCheck.code);
      }

      // T7: idempotency lookup.
      const fingerprint = requestFingerprint({
        method: "PATCH",
        route: "/expenses/:expenseId/decision",
        expenseId,
        role: actor.role,
        command: {
          note: input.note ?? null,
          reviewerId: actor.userId,
          status: input.status
        }
      });
      const existingRecord = this.deps.idempotency.find(
        actor.tenantId,
        actor.userId,
        idempotencyKey
      );

      if (existingRecord !== undefined) {
        if (existingRecord.requestFingerprint === fingerprint) {
          return this.replayResult(existingRecord);
        }

        return errorResult("IDEMPOTENCY_KEY_CONFLICT");
      }

      // T8: state precondition.
      const stateCheck = policy.decisionStateCheck(expense);

      if (!stateCheck.allowed) {
        return errorResult(stateCheck.code);
      }

      // T9: guarded mutation + audit + idempotency save.
      const decided = this.deps.expenses.decide(actor.tenantId, expenseId, {
        status: input.status,
        reviewerId: actor.userId,
        note: input.note ?? null,
        decidedAt: now
      });

      if (decided === undefined) {
        // Baseline backstop: the guarded UPDATE matched zero rows even
        // though the earlier lookup/state checks passed. No audit, no save.
        return errorResult("EXPENSE_DECISION_CONFLICT");
      }

      this.deps.audit.append({
        tenantId: actor.tenantId,
        expenseId: decided.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
        eventType:
          input.status === "APPROVED" ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED",
        occurredAt: now,
        payload: { status: input.status }
      });

      const body = { expense: decided };

      this.deps.idempotency.save({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        idempotencyKey,
        requestFingerprint: fingerprint,
        responseStatus: 200,
        responseBody: JSON.stringify(body),
        createdAt: now
      });

      return { statusCode: 200, body };
    });
  }

  public delete(
    actor: Actor,
    idempotencyKey: string,
    expenseId: string
  ): ServiceResult {
    return withTransaction(this.deps.database, () => {
      const now = this.deps.now();

      // T4: tenant-bound existence (tombstone-blind; delete is tombstone-aware
      // from here on, so T4b is skipped).
      const expense = this.deps.expenses.findInTenant(actor.tenantId, expenseId);

      if (expense === undefined) {
        return errorResult("EXPENSE_NOT_FOUND");
      }

      // T5: role-capability (employee only).
      const roleCheck = policy.authorizeRole(actor, "delete");

      if (!roleCheck.allowed) {
        return errorResult(roleCheck.code);
      }

      // T6: ownership (reachable 403 NOT_EXPENSE_OWNER).
      const ownerCheck = policy.authorizeOwnerMutation(actor, expense);

      if (!ownerCheck.allowed) {
        return errorResult(ownerCheck.code);
      }

      // T7: idempotency lookup.
      const fingerprint = requestFingerprint({
        method: "DELETE",
        route: "/expenses/:expenseId",
        expenseId,
        role: actor.role,
        command: {}
      });
      const existingRecord = this.deps.idempotency.find(
        actor.tenantId,
        actor.userId,
        idempotencyKey
      );

      if (existingRecord !== undefined) {
        if (existingRecord.requestFingerprint === fingerprint) {
          return this.replayResult(existingRecord);
        }

        return errorResult("IDEMPOTENCY_KEY_CONFLICT");
      }

      // T8: state precondition (retention lock / already deleted).
      const stateCheck = policy.deleteStateCheck(expense);

      if (!stateCheck.allowed) {
        return errorResult(stateCheck.code);
      }

      // T9: guarded mutation + audit + idempotency save.
      const tombstoned = this.deps.expenses.tombstone(actor.tenantId, expenseId, {
        deletedAt: now,
        deletedBy: actor.userId
      });

      if (tombstoned === undefined) {
        // Invariant violation: the state check above said this row was a
        // SUBMITTED, non-deleted row owned by this actor; the guarded UPDATE
        // disagreeing means the precondition was bypassed somehow. Single
        // process: this can only mean a programming/data error, not a
        // legitimate race. Let the transaction roll back as a 500.
        throw new Error("tombstone: guarded update matched zero rows");
      }

      this.deps.audit.append({
        tenantId: actor.tenantId,
        expenseId: tombstoned.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
        eventType: "EXPENSE_DELETED",
        occurredAt: now,
        payload: {}
      });

      const body = { expense: tombstoned };

      this.deps.idempotency.save({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        idempotencyKey,
        requestFingerprint: fingerprint,
        responseStatus: 200,
        responseBody: JSON.stringify(body),
        createdAt: now
      });

      return { statusCode: 200, body };
    });
  }

  public restore(
    actor: Actor,
    idempotencyKey: string,
    expenseId: string
  ): ServiceResult {
    return withTransaction(this.deps.database, () => {
      const now = this.deps.now();

      // T4: tenant-bound existence (tombstone-blind; restore is
      // tombstone-aware from here on, so T4b is skipped).
      const expense = this.deps.expenses.findInTenant(actor.tenantId, expenseId);

      if (expense === undefined) {
        return errorResult("EXPENSE_NOT_FOUND");
      }

      // T5: role-capability (employee only).
      const roleCheck = policy.authorizeRole(actor, "restore");

      if (!roleCheck.allowed) {
        return errorResult(roleCheck.code);
      }

      // T6: ownership (reachable 403 NOT_EXPENSE_OWNER).
      const ownerCheck = policy.authorizeOwnerMutation(actor, expense);

      if (!ownerCheck.allowed) {
        return errorResult(ownerCheck.code);
      }

      // T7: idempotency lookup.
      const fingerprint = requestFingerprint({
        method: "POST",
        route: "/expenses/:expenseId/restore",
        expenseId,
        role: actor.role,
        command: {}
      });
      const existingRecord = this.deps.idempotency.find(
        actor.tenantId,
        actor.userId,
        idempotencyKey
      );

      if (existingRecord !== undefined) {
        if (existingRecord.requestFingerprint === fingerprint) {
          return this.replayResult(existingRecord);
        }

        return errorResult("IDEMPOTENCY_KEY_CONFLICT");
      }

      // T8: state precondition (not deleted / window expired). May throw on
      // an invalid injected clock (NaN or negative elapsed) -- that is an
      // unexpected failure, surfaced as a rollback + 500, not a denial.
      const stateCheck = policy.restoreStateCheck(expense, now);

      if (!stateCheck.allowed) {
        return errorResult(stateCheck.code);
      }

      // T9: guarded mutation + audit + idempotency save.
      const restored = this.deps.expenses.restore(actor.tenantId, expenseId, {
        restoredAt: now
      });

      if (restored === undefined) {
        // Invariant violation, matching the delete() rationale above: the
        // state check just confirmed a tombstoned SUBMITTED row within the
        // window, so a zero-row UPDATE means the precondition was bypassed.
        throw new Error("restore: guarded update matched zero rows");
      }

      this.deps.audit.append({
        tenantId: actor.tenantId,
        expenseId: restored.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
        eventType: "EXPENSE_RESTORED",
        occurredAt: now,
        payload: {}
      });

      const body = { expense: restored };

      this.deps.idempotency.save({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        idempotencyKey,
        requestFingerprint: fingerprint,
        responseStatus: 200,
        responseBody: JSON.stringify(body),
        createdAt: now
      });

      return { statusCode: 200, body };
    });
  }

  private replayResult(record: IdempotencyRecord): ServiceResult {
    const parsed: unknown = JSON.parse(record.responseBody);

    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("stored idempotency response body is not an object");
    }

    return { statusCode: record.responseStatus, body: parsed };
  }
}
