import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

const openApps: FastifyInstance[] = [];
const temporaryDirectories: string[] = [];

function createTestApp(databasePath = ":memory:"): FastifyInstance {
  let nextId = 1;
  let nextSecond = 0;

  const app = buildApp({
    databasePath,
    idFactory: () => `expense-${nextId++}`,
    now: () => `2026-09-15T12:00:${String(nextSecond++).padStart(2, "0")}.000Z`
  });

  openApps.push(app);
  return app;
}

async function createExpense(app: FastifyInstance) {
  return app.inject({
    method: "POST",
    url: "/expenses",
    payload: {
      employeeId: "employee-1",
      description: "Conference registration",
      amountCents: 125_00,
      currency: "USD"
    }
  });
}

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("expense starter API", () => {
  it("reports database readiness", async () => {
    const app = createTestApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("creates, reads, and lists an expense", async () => {
    const app = createTestApp();
    const created = await createExpense(app);

    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({
      expense: {
        id: "expense-1",
        employeeId: "employee-1",
        description: "Conference registration",
        amountCents: 12500,
        currency: "USD",
        status: "SUBMITTED",
        reviewerId: null,
        decisionNote: null,
        createdAt: "2026-09-15T12:00:00.000Z",
        updatedAt: "2026-09-15T12:00:00.000Z"
      }
    });

    const read = await app.inject({
      method: "GET",
      url: "/expenses/expense-1"
    });
    const listed = await app.inject({ method: "GET", url: "/expenses" });

    expect(read.json()).toEqual(created.json());
    expect(listed.json()).toEqual({
      expenses: [created.json().expense]
    });
  });

  it("approves a submitted expense once", async () => {
    const app = createTestApp();
    await createExpense(app);

    const approved = await app.inject({
      method: "PATCH",
      url: "/expenses/expense-1/decision",
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
      payload: {
        status: "REJECTED",
        reviewerId: "reviewer-2"
      }
    });

    expect(repeated.statusCode).toBe(409);
    expect(repeated.json().error.code).toBe("EXPENSE_ALREADY_DECIDED");
  });

  it("rejects invalid expense input", async () => {
    const app = createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/expenses",
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
    const directory = mkdtempSync(join(tmpdir(), "expense-seed-"));
    const databasePath = join(directory, "expenses.sqlite");
    temporaryDirectories.push(directory);

    const firstApp = createTestApp(databasePath);
    await createExpense(firstApp);
    await firstApp.close();
    openApps.splice(openApps.indexOf(firstApp), 1);

    const secondApp = createTestApp(databasePath);
    const response = await secondApp.inject({
      method: "GET",
      url: "/expenses/expense-1"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().expense.description).toBe(
      "Conference registration"
    );
  });

  it("does not expose an expense deletion route in the starter", async () => {
    const app = createTestApp();
    await createExpense(app);

    const response = await app.inject({
      method: "DELETE",
      url: "/expenses/expense-1"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Route not found"
      }
    });
  });
});
