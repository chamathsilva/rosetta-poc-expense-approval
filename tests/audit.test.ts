import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";

import { actorHeaders, createTestRegistry } from "./support.js";

const { createTestApp, createTempDatabasePath, openReader } = createTestRegistry();

const EMPLOYEE = { tenantId: "tenant-a", userId: "employee-1", role: "employee" as const };
const MANAGER = { tenantId: "tenant-a", userId: "manager-1", role: "manager" as const };

async function createExpense(
  app: FastifyInstance,
  key: string,
  overrides: Record<string, unknown> = {}
) {
  return app.inject({
    method: "POST",
    url: "/expenses",
    headers: { ...actorHeaders(EMPLOYEE), "idempotency-key": key },
    payload: { description: "d", amountCents: 100, currency: "USD", ...overrides }
  });
}

function auditRows(database: DatabaseSync, expenseId: string) {
  return database
    .prepare("SELECT * FROM audit_events WHERE expense_id = ? ORDER BY seq ASC")
    .all(expenseId);
}

function auditCount(database: DatabaseSync, expenseId?: string): number {
  const row = expenseId
    ? (database
        .prepare("SELECT count(*) AS n FROM audit_events WHERE expense_id = ?")
        .get(expenseId) as { n: number })
    : (database.prepare("SELECT count(*) AS n FROM audit_events").get() as {
        n: number;
      });

  return row.n;
}

function expenseCount(database: DatabaseSync): number {
  return (
    database.prepare("SELECT count(*) AS n FROM expenses").get() as { n: number }
  ).n;
}

function expenseRow(database: DatabaseSync, expenseId: string) {
  return database.prepare("SELECT * FROM expenses WHERE id = ?").get(expenseId);
}

describe("audit (P7.5, S9, S5.10)", () => {
  it("create produces exactly one EXPENSE_SUBMITTED event with the exact S9 payload", async () => {
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath });

    await createExpense(app, "k1", { amountCents: 12_500, currency: "USD" });

    const reader = openReader(databasePath);
    const rows = auditRows(reader, "expense-1") as Record<string, unknown>[];

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenant_id: "tenant-a",
      expense_id: "expense-1",
      actor_user_id: "employee-1",
      actor_role: "employee",
      event_type: "EXPENSE_SUBMITTED",
      occurred_at: "2026-09-15T12:00:00.000Z"
    });
    expect(JSON.parse(rows[0]!.payload_json as string)).toEqual({
      amountCents: 12_500,
      currency: "USD"
    });
  });

  it("decide APPROVED/REJECTED produce the exact S9 payload", async () => {
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath });
    await createExpense(app, "k1");

    await app.inject({
      method: "PATCH",
      url: "/expenses/expense-1/decision",
      headers: { ...actorHeaders(MANAGER), "idempotency-key": "d1" },
      payload: { status: "APPROVED" }
    });

    const reader = openReader(databasePath);
    const rows = auditRows(reader, "expense-1") as Record<string, unknown>[];

    expect(rows).toHaveLength(2);
    expect(rows[1]!.event_type).toBe("EXPENSE_APPROVED");
    expect(JSON.parse(rows[1]!.payload_json as string)).toEqual({ status: "APPROVED" });
  });

  it("delete and restore produce EXPENSE_DELETED/EXPENSE_RESTORED with an empty payload ({})", async () => {
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath });
    await createExpense(app, "k1");

    await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE), "idempotency-key": "del1" }
    });
    await app.inject({
      method: "POST",
      url: "/expenses/expense-1/restore",
      headers: { ...actorHeaders(EMPLOYEE), "idempotency-key": "r1" }
    });

    const reader = openReader(databasePath);
    const rows = auditRows(reader, "expense-1") as Record<string, unknown>[];

    expect(rows).toHaveLength(3);
    expect(rows[1]!.event_type).toBe("EXPENSE_DELETED");
    expect(JSON.parse(rows[1]!.payload_json as string)).toEqual({});
    expect(rows[2]!.event_type).toBe("EXPENSE_RESTORED");
    expect(JSON.parse(rows[2]!.payload_json as string)).toEqual({});
  });

  it("never includes headers, idempotency keys, description, note, or reviewer/employee ids in the payload", async () => {
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath });
    await createExpense(app, "SENTINEL-KEY", { description: "SENTINEL-DESCRIPTION" });

    await app.inject({
      method: "PATCH",
      url: "/expenses/expense-1/decision",
      headers: { ...actorHeaders(MANAGER), "idempotency-key": "d1" },
      payload: { status: "APPROVED", note: "SENTINEL-NOTE" }
    });

    const reader = openReader(databasePath);
    const rows = auditRows(reader, "expense-1") as Record<string, unknown>[];

    for (const row of rows) {
      const payload = row.payload_json as string;
      expect(payload).not.toContain("SENTINEL");
      expect(payload).not.toContain("employee-1");
      expect(payload).not.toContain("manager-1");
    }
  });

  it("zero audit events on a denial (validation/auth/role/state)", async () => {
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath });
    await createExpense(app, "k1");

    await app.inject({
      method: "PATCH",
      url: "/expenses/expense-1/decision",
      headers: { ...actorHeaders(EMPLOYEE), "idempotency-key": "d1" },
      payload: { status: "APPROVED" }
    });

    const reader = openReader(databasePath);
    expect(auditCount(reader, "expense-1")).toBe(1); // only the create event
  });

  it("zero audit events on a replay", async () => {
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath });
    await createExpense(app, "k1");
    await createExpense(app, "k1"); // same key, same body ⇒ replay

    const reader = openReader(databasePath);
    expect(auditCount(reader, "expense-1")).toBe(1);
  });

  it("audit rows survive tombstoning (tombstone is an UPDATE on expenses only)", async () => {
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath });
    await createExpense(app, "k1");

    await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE), "idempotency-key": "del1" }
    });

    const reader = openReader(databasePath);
    expect(auditCount(reader, "expense-1")).toBe(2); // create + delete, both intact
  });

  it("raw UPDATE on audit_events through a second connection throws (append-only)", async () => {
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath });
    await createExpense(app, "k1");

    const reader = openReader(databasePath);

    expect(() =>
      reader.prepare("UPDATE audit_events SET event_type = 'EXPENSE_DELETED'").run()
    ).toThrow();
    void app;
  });

  it("raw DELETE on audit_events through a second connection throws (append-only)", async () => {
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath });
    await createExpense(app, "k1");

    const reader = openReader(databasePath);

    expect(() => reader.prepare("DELETE FROM audit_events").run()).toThrow();
    void app;
  });

  describe("atomicity fault injection (S12.1, 8 cases: {F-A, F-I} x {create, decide, delete, restore})", () => {
    const FAULT_POINTS = ["F-A", "F-I"] as const;

    function installFault(reader: DatabaseSync, point: "F-A" | "F-I"): void {
      const table = point === "F-A" ? "audit_events" : "idempotency_records";
      const triggerName = point === "F-A" ? "test_fail_audit" : "test_fail_idem";

      reader.exec(`
        CREATE TRIGGER ${triggerName} BEFORE INSERT ON ${table}
          BEGIN SELECT RAISE(ABORT,'test'); END;
      `);
    }

    function dropFault(reader: DatabaseSync, point: "F-A" | "F-I"): void {
      const triggerName = point === "F-A" ? "test_fail_audit" : "test_fail_idem";

      reader.exec(`DROP TRIGGER ${triggerName};`);
    }

    for (const point of FAULT_POINTS) {
      it(`${point}: create fails atomically (500, no expense/audit/idempotency row), recovers on retry`, async () => {
        const databasePath = createTempDatabasePath();
        const { app } = createTestApp({ databasePath });
        const reader = openReader(databasePath);

        const expensesBefore = expenseCount(reader);
        const auditBefore = auditCount(reader);

        installFault(reader, point);

        const key = `create-fault-${point}`;
        const failed = await createExpense(app, key, { amountCents: 777 });

        expect(failed.statusCode).toBe(500);
        expect(expenseCount(reader)).toBe(expensesBefore);
        expect(auditCount(reader)).toBe(auditBefore);
        expect(
          reader
            .prepare(
              "SELECT * FROM idempotency_records WHERE tenant_id = 'tenant-a' AND actor_user_id = 'employee-1' AND idempotency_key = ?"
            )
            .get(key)
        ).toBeUndefined();

        dropFault(reader, point);

        const retried = await createExpense(app, key, { amountCents: 777 });

        expect(retried.statusCode).toBe(201);
        expect(auditCount(reader)).toBe(auditBefore + 1);
      });
    }

    for (const point of FAULT_POINTS) {
      it(`${point}: decide fails atomically, recovers on retry`, async () => {
        const databasePath = createTempDatabasePath();
        const { app } = createTestApp({ databasePath });
        await createExpense(app, "setup-create");

        const reader = openReader(databasePath);
        const snapshot = expenseRow(reader, "expense-1");
        const auditBefore = auditCount(reader, "expense-1");

        installFault(reader, point);

        const key = `decide-fault-${point}`;
        const failed = await app.inject({
          method: "PATCH",
          url: "/expenses/expense-1/decision",
          headers: { ...actorHeaders(MANAGER), "idempotency-key": key },
          payload: { status: "APPROVED" }
        });

        expect(failed.statusCode).toBe(500);
        expect(expenseRow(reader, "expense-1")).toEqual(snapshot);
        expect(auditCount(reader, "expense-1")).toBe(auditBefore);
        expect(
          reader
            .prepare(
              "SELECT * FROM idempotency_records WHERE tenant_id = 'tenant-a' AND actor_user_id = 'manager-1' AND idempotency_key = ?"
            )
            .get(key)
        ).toBeUndefined();

        dropFault(reader, point);

        const retried = await app.inject({
          method: "PATCH",
          url: "/expenses/expense-1/decision",
          headers: { ...actorHeaders(MANAGER), "idempotency-key": key },
          payload: { status: "APPROVED" }
        });

        expect(retried.statusCode).toBe(200);
        expect(auditCount(reader, "expense-1")).toBe(auditBefore + 1);
      });
    }

    for (const point of FAULT_POINTS) {
      it(`${point}: delete fails atomically, recovers on retry`, async () => {
        const databasePath = createTempDatabasePath();
        const { app } = createTestApp({ databasePath });
        await createExpense(app, "setup-create");

        const reader = openReader(databasePath);
        const snapshot = expenseRow(reader, "expense-1");
        const auditBefore = auditCount(reader, "expense-1");

        installFault(reader, point);

        const key = `delete-fault-${point}`;
        const failed = await app.inject({
          method: "DELETE",
          url: "/expenses/expense-1",
          headers: { ...actorHeaders(EMPLOYEE), "idempotency-key": key }
        });

        expect(failed.statusCode).toBe(500);
        expect(expenseRow(reader, "expense-1")).toEqual(snapshot);
        expect(auditCount(reader, "expense-1")).toBe(auditBefore);
        expect(
          reader
            .prepare(
              "SELECT * FROM idempotency_records WHERE tenant_id = 'tenant-a' AND actor_user_id = 'employee-1' AND idempotency_key = ?"
            )
            .get(key)
        ).toBeUndefined();

        dropFault(reader, point);

        const retried = await app.inject({
          method: "DELETE",
          url: "/expenses/expense-1",
          headers: { ...actorHeaders(EMPLOYEE), "idempotency-key": key }
        });

        expect(retried.statusCode).toBe(200);
        expect(auditCount(reader, "expense-1")).toBe(auditBefore + 1);
      });
    }

    for (const point of FAULT_POINTS) {
      it(`${point}: restore fails atomically, recovers on retry`, async () => {
        const databasePath = createTempDatabasePath();
        const { app } = createTestApp({ databasePath });
        await createExpense(app, "setup-create");
        // Setup mutations (create, then delete) must happen before the
        // fault is installed -- F-A would otherwise block this setup.
        await app.inject({
          method: "DELETE",
          url: "/expenses/expense-1",
          headers: { ...actorHeaders(EMPLOYEE), "idempotency-key": "setup-delete" }
        });

        const reader = openReader(databasePath);
        const snapshot = expenseRow(reader, "expense-1");
        const auditBefore = auditCount(reader, "expense-1");

        installFault(reader, point);

        const key = `restore-fault-${point}`;
        const failed = await app.inject({
          method: "POST",
          url: "/expenses/expense-1/restore",
          headers: { ...actorHeaders(EMPLOYEE), "idempotency-key": key }
        });

        expect(failed.statusCode).toBe(500);
        expect(expenseRow(reader, "expense-1")).toEqual(snapshot);
        expect(auditCount(reader, "expense-1")).toBe(auditBefore);
        expect(
          reader
            .prepare(
              "SELECT * FROM idempotency_records WHERE tenant_id = 'tenant-a' AND actor_user_id = 'employee-1' AND idempotency_key = ?"
            )
            .get(key)
        ).toBeUndefined();

        dropFault(reader, point);

        const retried = await app.inject({
          method: "POST",
          url: "/expenses/expense-1/restore",
          headers: { ...actorHeaders(EMPLOYEE), "idempotency-key": key }
        });

        expect(retried.statusCode).toBe(200);
        expect(auditCount(reader, "expense-1")).toBe(auditBefore + 1);
      });
    }
  });

  it("F-I specifically proves an already-inserted audit row (post expense-write) is rolled back on create", async () => {
    const databasePath = createTempDatabasePath();
    const { app } = createTestApp({ databasePath });
    const reader = openReader(databasePath);

    reader.exec(`
      CREATE TRIGGER test_fail_idem BEFORE INSERT ON idempotency_records
        BEGIN SELECT RAISE(ABORT,'test'); END;
    `);

    const failed = await createExpense(app, "fi-proof-key");

    expect(failed.statusCode).toBe(500);
    // Zero audit rows for the would-be expense: if the audit insert (which
    // ran before the idempotency insert, per T9 order) had survived, this
    // count would be 1, not 0.
    expect(auditCount(reader)).toBe(0);
    expect(expenseCount(reader)).toBe(0);
  });
});
