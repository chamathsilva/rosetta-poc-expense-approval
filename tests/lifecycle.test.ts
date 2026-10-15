import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";

import { restoreStateCheck } from "../src/policy.js";
import {
  T0,
  actorHeaders,
  createAutoAdvancingClock,
  createMutableClock,
  createTestRegistry
} from "./support.js";

const { createTestApp, createTempDatabasePath, openReader } = createTestRegistry();

const EMPLOYEE_A1 = { tenantId: "tenant-a", userId: "employee-1", role: "employee" as const };
const EMPLOYEE_A2 = { tenantId: "tenant-a", userId: "employee-2", role: "employee" as const };
const EMPLOYEE_B1 = { tenantId: "tenant-b", userId: "employee-1", role: "employee" as const };
const MANAGER_A = { tenantId: "tenant-a", userId: "manager-1", role: "manager" as const };

async function createExpense(
  app: FastifyInstance,
  key: string,
  overrides: Record<string, unknown> = {}
) {
  return app.inject({
    method: "POST",
    url: "/expenses",
    headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": key },
    payload: { description: "d", amountCents: 100, currency: "USD", ...overrides }
  });
}

function snapshot(database: DatabaseSync, expenseId: string) {
  return {
    expense: database.prepare("SELECT * FROM expenses WHERE id = ?").get(expenseId),
    auditCount: (
      database
        .prepare("SELECT count(*) AS n FROM audit_events WHERE expense_id = ?")
        .get(expenseId) as { n: number }
    ).n,
    idempotencyCount: (
      database.prepare("SELECT count(*) AS n FROM idempotency_records").get() as {
        n: number;
      }
    ).n
  };
}

describe("lifecycle: tombstone, restore, idempotency matrix (S12.3)", () => {
  it("1. replays a same-key DELETE after tombstoning with the original 200 and no second audit event", async () => {
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath });
    await createExpense(app, "create-1");

    const first = await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "del-key" }
    });
    const second = await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "del-key" }
    });

    expect(second.statusCode).toBe(first.statusCode);
    expect(second.json()).toEqual(first.json());

    const reader = openReader(databasePath);
    expect(
      (
        reader
          .prepare("SELECT count(*) AS n FROM audit_events WHERE expense_id = 'expense-1' AND event_type = 'EXPENSE_DELETED'")
          .get() as { n: number }
      ).n
    ).toBe(1);
  });

  it("2. replays a same-key restore after restoration without a second audit event", async () => {
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath });
    await createExpense(app, "create-1");
    await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "del-1" }
    });

    const first = await app.inject({
      method: "POST",
      url: "/expenses/expense-1/restore",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "restore-key" }
    });
    const second = await app.inject({
      method: "POST",
      url: "/expenses/expense-1/restore",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "restore-key" }
    });

    expect(second.json()).toEqual(first.json());

    const reader = openReader(databasePath);
    expect(
      (
        reader
          .prepare("SELECT count(*) AS n FROM audit_events WHERE expense_id = 'expense-1' AND event_type = 'EXPENSE_RESTORED'")
          .get() as { n: number }
      ).n
    ).toBe(1);
  });

  it("3. replays a same-key restore after the 30-day window later expires", async () => {
    const clock = createMutableClock(T0);
    const { app } = createTestApp({ clock });
    await createExpense(app, "create-1");

    await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "del-1" }
    });

    const key = "restore-key-3";
    const first = await app.inject({
      method: "POST",
      url: "/expenses/expense-1/restore",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": key }
    });

    expect(first.statusCode).toBe(200);

    // Advance the clock well past the 30-day window; the replay must still
    // return the frozen original 200, ignoring current time entirely.
    clock.advanceMs(2_592_000_000 * 2);

    const second = await app.inject({
      method: "POST",
      url: "/expenses/expense-1/restore",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": key }
    });

    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
  });

  it("4. rejects a fresh-key delete of a tombstoned expense with EXPENSE_ALREADY_DELETED", async () => {
    const { app } = createTestApp();
    await createExpense(app, "create-1");
    await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "del-1" }
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "fresh-key" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("EXPENSE_ALREADY_DELETED");
  });

  it("5. rejects restoring a non-tombstoned expense with EXPENSE_NOT_DELETED", async () => {
    const { app } = createTestApp();
    await createExpense(app, "create-1");

    const response = await app.inject({
      method: "POST",
      url: "/expenses/expense-1/restore",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "restore-key" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("EXPENSE_NOT_DELETED");
  });

  it("6. rejects a fresh restore at exactly 30 days and at 30 days plus 1 ms with RESTORE_WINDOW_EXPIRED", async () => {
    const clock = createMutableClock(T0);
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath, clock });
    await createExpense(app, "create-1");

    await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "del-1" }
    });

    const reader = openReader(databasePath);
    const before = snapshot(reader, "expense-1");

    clock.set(new Date(Date.parse(T0) + 2_592_000_000).toISOString()); // exactly 30d
    const atThirty = await app.inject({
      method: "POST",
      url: "/expenses/expense-1/restore",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "restore-at-30" }
    });

    expect(atThirty.statusCode).toBe(409);
    expect(atThirty.json().error.code).toBe("RESTORE_WINDOW_EXPIRED");
    expect(snapshot(reader, "expense-1")).toEqual(before); // no state change

    clock.set(new Date(Date.parse(T0) + 2_592_000_000 + 1).toISOString()); // 30d+1ms
    const overThirty = await app.inject({
      method: "POST",
      url: "/expenses/expense-1/restore",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "restore-at-30-plus-1" }
    });

    expect(overThirty.statusCode).toBe(409);
    expect(overThirty.json().error.code).toBe("RESTORE_WINDOW_EXPIRED");
  });

  it("7. returns 404 for a wrong-tenant retry of a stored delete key without replaying", async () => {
    const { app } = createTestApp();
    await createExpense(app, "create-1");

    await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "shared-key" }
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_B1), "idempotency-key": "shared-key" }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("EXPENSE_NOT_FOUND");
  });

  it("8. returns 403 NOT_EXPENSE_OWNER for a wrong-user delete/restore retry without replaying", async () => {
    const { app } = createTestApp();
    await createExpense(app, "create-1");

    await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "shared-del-key" }
    });

    const deleteRetry = await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A2), "idempotency-key": "shared-del-key" }
    });

    expect(deleteRetry.statusCode).toBe(403);
    expect(deleteRetry.json().error.code).toBe("NOT_EXPENSE_OWNER");

    await app.inject({
      method: "POST",
      url: "/expenses/expense-1/restore",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "shared-restore-key" }
    });
    await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "shared-del-key-2" }
    });

    const restoreRetry = await app.inject({
      method: "POST",
      url: "/expenses/expense-1/restore",
      headers: { ...actorHeaders(EMPLOYEE_A2), "idempotency-key": "shared-restore-key" }
    });

    expect(restoreRetry.statusCode).toBe(403);
    expect(restoreRetry.json().error.code).toBe("NOT_EXPENSE_OWNER");
  });

  it("9. re-evaluates the role on a wrong-role retry and returns 403 FORBIDDEN_ROLE", async () => {
    const { app } = createTestApp();
    await createExpense(app, "create-1");

    await app.inject({
      method: "PATCH",
      url: "/expenses/expense-1/decision",
      headers: { ...actorHeaders(MANAGER_A), "idempotency-key": "shared-key" },
      payload: { status: "APPROVED" }
    });

    // Reuse the literal key string, but now as an employee -- the stored
    // record belongs to (tenant-a, manager-1, shared-key), not
    // (tenant-a, employee-1, shared-key), so this is a *fresh* lookup that
    // re-evaluates the role at T5, not a replay.
    const response = await app.inject({
      method: "PATCH",
      url: "/expenses/expense-1/decision",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "shared-key" },
      payload: { status: "APPROVED" }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN_ROLE");
  });

  it("10a. returns 409 IDEMPOTENCY_KEY_CONFLICT for a changed-payload create retry", async () => {
    const { app } = createTestApp();
    await createExpense(app, "same-key", { amountCents: 100 });

    const response = await createExpense(app, "same-key", { amountCents: 200 });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
  });

  it("10b. returns 409 IDEMPOTENCY_KEY_CONFLICT for a changed-payload decision retry", async () => {
    const { app } = createTestApp();
    await createExpense(app, "create-1");

    await app.inject({
      method: "PATCH",
      url: "/expenses/expense-1/decision",
      headers: { ...actorHeaders(MANAGER_A), "idempotency-key": "same-key" },
      payload: { status: "APPROVED" }
    });

    // Create a second, still-SUBMITTED expense so the conflicting retry can
    // reach T7 instead of being pre-empted by T8 EXPENSE_ALREADY_DECIDED on
    // the same expense.
    await createExpense(app, "create-2");

    const response = await app.inject({
      method: "PATCH",
      url: "/expenses/expense-2/decision",
      headers: { ...actorHeaders(MANAGER_A), "idempotency-key": "same-key" },
      payload: { status: "REJECTED" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
  });

  it("11. returns 403 NOT_EXPENSE_OWNER for same-tenant non-owner delete and restore", async () => {
    const { app } = createTestApp();
    await createExpense(app, "create-1");

    const deleteByNonOwner = await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A2), "idempotency-key": "d1" }
    });

    expect(deleteByNonOwner.statusCode).toBe(403);
    expect(deleteByNonOwner.json().error.code).toBe("NOT_EXPENSE_OWNER");

    await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "d2" }
    });

    const restoreByNonOwner = await app.inject({
      method: "POST",
      url: "/expenses/expense-1/restore",
      headers: { ...actorHeaders(EMPLOYEE_A2), "idempotency-key": "r1" }
    });

    expect(restoreByNonOwner.statusCode).toBe(403);
    expect(restoreByNonOwner.json().error.code).toBe("NOT_EXPENSE_OWNER");
  });

  // --- Further required cases (non-matrix, named in PLAN P7.6) ---

  it("owner tombstone hides the expense from GET, list and decision (404)", async () => {
    const { app } = createTestApp();
    await createExpense(app, "create-1");
    await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "del-1" }
    });

    const get = await app.inject({
      method: "GET",
      url: "/expenses/expense-1",
      headers: actorHeaders(EMPLOYEE_A1)
    });
    const list = await app.inject({
      method: "GET",
      url: "/expenses",
      headers: actorHeaders(MANAGER_A)
    });
    const decide = await app.inject({
      method: "PATCH",
      url: "/expenses/expense-1/decision",
      headers: { ...actorHeaders(MANAGER_A), "idempotency-key": "d1" },
      payload: { status: "APPROVED" }
    });

    expect(get.statusCode).toBe(404);
    expect(list.json().expenses).toEqual([]);
    expect(decide.statusCode).toBe(404);
  });

  it("a decided expense cannot be deleted by the owner: 409 EXPENSE_RETENTION_LOCKED", async () => {
    const { app } = createTestApp();
    await createExpense(app, "create-1");
    await app.inject({
      method: "PATCH",
      url: "/expenses/expense-1/decision",
      headers: { ...actorHeaders(MANAGER_A), "idempotency-key": "d1" },
      payload: { status: "APPROVED" }
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "del-1" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("EXPENSE_RETENTION_LOCKED");
  });

  it("restore at exactly T0+30d-1ms succeeds with one EXPENSE_RESTORED event", async () => {
    const clock = createMutableClock(T0);
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath, clock });
    await createExpense(app, "create-1");
    await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "del-1" }
    });

    clock.set(new Date(Date.parse(T0) + 2_592_000_000 - 1).toISOString());
    const response = await app.inject({
      method: "POST",
      url: "/expenses/expense-1/restore",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "restore-1" }
    });

    expect(response.statusCode).toBe(200);

    const reader = openReader(databasePath);
    expect(
      (
        reader
          .prepare("SELECT count(*) AS n FROM audit_events WHERE expense_id = 'expense-1' AND event_type = 'EXPENSE_RESTORED'")
          .get() as { n: number }
      ).n
    ).toBe(1);
  });

  it("create replay returns the same expense-1; the next (non-replayed) create still gets expense-2", async () => {
    const { app } = createTestApp();
    const first = await createExpense(app, "same-key");
    const replay = await createExpense(app, "same-key");

    expect(replay.json()).toEqual(first.json());
    expect(replay.json().expense.id).toBe("expense-1");

    const second = await createExpense(app, "different-key");

    expect(second.json().expense.id).toBe("expense-2");
  });

  it("isRestoreWindowOpen's invalid-clock case (now before deletedAt) throws, surfaced by the service as 500", async () => {
    const clock = createMutableClock(T0);
    const { app } = createTestApp({ clock });
    await createExpense(app, "create-1");
    await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "del-1" }
    });

    // Move the clock BEFORE deletedAt (clock regression).
    clock.set(new Date(Date.parse(T0) - 1).toISOString());

    const response = await app.inject({
      method: "POST",
      url: "/expenses/expense-1/restore",
      headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "restore-1" }
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe("INTERNAL_ERROR");
  });

  it("restoreStateCheck: a non-SUBMITTED synthetic tombstoned row returns the stable EXPENSE_NOT_DELETED denial, not a throw", () => {
    const synthetic = {
      id: "e1",
      tenantId: "tenant-a",
      employeeId: "employee-1",
      description: "d",
      amountCents: 100,
      currency: "USD",
      status: "APPROVED" as const,
      reviewerId: "manager-1",
      decisionNote: null,
      createdAt: T0,
      updatedAt: T0,
      deletedAt: T0
    };

    expect(() => restoreStateCheck(synthetic, T0)).not.toThrow();
    expect(restoreStateCheck(synthetic, T0)).toEqual({
      allowed: false,
      code: "EXPENSE_NOT_DELETED"
    });
  });

  it("default auto-advancing test clock sanity check (sequencing, not a matrix row)", async () => {
    const { app } = createTestApp({ clock: createAutoAdvancingClock() });
    const created = await createExpense(app, "create-1");

    expect(created.json().expense.createdAt).toBe(T0);
  });
});
