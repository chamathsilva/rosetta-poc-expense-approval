import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";

import { actorHeaders, createTestRegistry } from "./support.js";

const { createTestApp, createTempDatabasePath } = createTestRegistry();

const EMPLOYEE = { tenantId: "tenant-a", userId: "employee-1", role: "employee" as const };
const MANAGER = { tenantId: "tenant-a", userId: "reviewer-1", role: "manager" as const };
const FINANCE = { tenantId: "tenant-a", userId: "reviewer-2", role: "finance" as const };

async function createExpense(app: FastifyInstance, key = "create-key-1") {
  return app.inject({
    method: "POST",
    url: "/expenses",
    headers: { ...actorHeaders(EMPLOYEE), "idempotency-key": key },
    payload: {
      employeeId: "employee-1",
      description: "Conference registration",
      amountCents: 125_00,
      currency: "USD"
    }
  });
}

describe("expense starter API (migrated baseline, P6)", () => {
  it("reports database readiness", async () => {
    const { app } = createTestApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("creates, reads, and lists an expense", async () => {
    const { app } = createTestApp();
    const created = await createExpense(app);

    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({
      expense: {
        id: "expense-1",
        tenantId: "tenant-a",
        employeeId: "employee-1",
        description: "Conference registration",
        amountCents: 12500,
        currency: "USD",
        status: "SUBMITTED",
        reviewerId: null,
        decisionNote: null,
        createdAt: "2026-09-15T12:00:00.000Z",
        updatedAt: "2026-09-15T12:00:00.000Z",
        deletedAt: null
      }
    });

    const read = await app.inject({
      method: "GET",
      url: "/expenses/expense-1",
      headers: actorHeaders(EMPLOYEE)
    });
    const listed = await app.inject({
      method: "GET",
      url: "/expenses",
      headers: actorHeaders(EMPLOYEE)
    });

    expect(read.json()).toEqual(created.json());
    expect(listed.json()).toEqual({
      expenses: [created.json().expense]
    });
  });

  it("approves a submitted expense once", async () => {
    const { app } = createTestApp();
    await createExpense(app);

    const approved = await app.inject({
      method: "PATCH",
      url: "/expenses/expense-1/decision",
      headers: { ...actorHeaders(MANAGER), "idempotency-key": "decide-key-1" },
      payload: {
        status: "APPROVED",
        reviewerId: "reviewer-1",
        note: "Within budget"
      }
    });

    expect(approved.statusCode).toBe(200);
    expect(approved.json().expense).toMatchObject({
      status: "APPROVED",
      reviewerId: "reviewer-1",
      decisionNote: "Within budget",
      updatedAt: "2026-09-15T12:00:01.000Z"
    });

    const repeated = await app.inject({
      method: "PATCH",
      url: "/expenses/expense-1/decision",
      headers: { ...actorHeaders(FINANCE), "idempotency-key": "decide-key-2" },
      payload: {
        status: "REJECTED",
        reviewerId: "reviewer-2"
      }
    });

    expect(repeated.statusCode).toBe(409);
    expect(repeated.json().error.code).toBe("EXPENSE_ALREADY_DECIDED");

    const reread = await app.inject({
      method: "GET",
      url: "/expenses/expense-1",
      headers: actorHeaders(MANAGER)
    });

    expect(reread.json().expense.updatedAt).toBe("2026-09-15T12:00:01.000Z");
  });

  it("rejects invalid expense input", async () => {
    const { app } = createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: { ...actorHeaders(EMPLOYEE), "idempotency-key": "bad-create-key" },
      payload: {
        employeeId: "",
        description: "",
        amountCents: 0,
        currency: "usd"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("persists expenses across application instances", async () => {
    const databasePath = createTempDatabasePath();

    const { app: firstApp } = createTestApp({ databasePath });
    await createExpense(firstApp);
    await firstApp.close();

    const { app: secondApp } = createTestApp({ databasePath });
    const response = await secondApp.inject({
      method: "GET",
      url: "/expenses/expense-1",
      headers: actorHeaders(EMPLOYEE)
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().expense.description).toBe(
      "Conference registration"
    );
  });

  it("lets the owner delete an expense and keeps unknown routes unrouted", async () => {
    const { app } = createTestApp();
    await createExpense(app);

    const deleted = await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1",
      headers: { ...actorHeaders(EMPLOYEE), "idempotency-key": "delete-key-1" }
    });

    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().expense.deletedAt).toBe("2026-09-15T12:00:01.000Z");

    const unrouted = await app.inject({
      method: "PUT",
      url: "/expenses/expense-1"
    });

    expect(unrouted.statusCode).toBe(404);
    expect(unrouted.json()).toEqual({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Route not found"
      }
    });
  });
});
