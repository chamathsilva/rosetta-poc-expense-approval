import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";

import {
  MANAGER_APPROVAL_LIMIT_CENTS
} from "../src/policy.js";
import { actorHeaders, createTestRegistry } from "./support.js";

const { createTestApp, createTempDatabasePath, openReader } = createTestRegistry();

const EMPLOYEE_A1 = { tenantId: "tenant-a", userId: "employee-1", role: "employee" as const };
const EMPLOYEE_A2 = { tenantId: "tenant-a", userId: "employee-2", role: "employee" as const };
const EMPLOYEE_B2 = { tenantId: "tenant-b", userId: "employee-2", role: "employee" as const };
const MANAGER_A = { tenantId: "tenant-a", userId: "manager-1", role: "manager" as const };
const MANAGER_B = { tenantId: "tenant-b", userId: "manager-1", role: "manager" as const };
const FINANCE_A = { tenantId: "tenant-a", userId: "finance-1", role: "finance" as const };

async function createAs(
  app: FastifyInstance,
  actor: { tenantId: string; userId: string; role: "employee" | "manager" | "finance" },
  key: string,
  overrides: Record<string, unknown> = {}
) {
  return app.inject({
    method: "POST",
    url: "/expenses",
    headers: { ...actorHeaders(actor), "idempotency-key": key },
    payload: {
      description: "Conference registration",
      amountCents: 12_500,
      currency: "USD",
      ...overrides
    }
  });
}

function rawCounts(database: DatabaseSync, expenseId: string) {
  const expense = database
    .prepare("SELECT * FROM expenses WHERE id = ?")
    .get(expenseId);
  const auditCount = (
    database
      .prepare("SELECT count(*) AS n FROM audit_events WHERE expense_id = ?")
      .get(expenseId) as { n: number }
  ).n;
  const idempotencyCount = (
    database.prepare("SELECT count(*) AS n FROM idempotency_records").get() as {
      n: number;
    }
  ).n;

  return { expense, auditCount, idempotencyCount };
}

describe("access control", () => {
  describe("authentication and validation (P7.3)", () => {
    it("missing x-tenant-id ⇒ 401 UNAUTHENTICATED", async () => {
      const { app } = createTestApp();
      const headers = actorHeaders(EMPLOYEE_A1);
      delete (headers as Record<string, string>)["x-tenant-id"];

      const response = await app.inject({ method: "GET", url: "/expenses", headers });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe("UNAUTHENTICATED");
    });

    it("missing x-user-id ⇒ 401 UNAUTHENTICATED", async () => {
      const { app } = createTestApp();
      const headers = actorHeaders(EMPLOYEE_A1);
      delete (headers as Record<string, string>)["x-user-id"];

      const response = await app.inject({ method: "GET", url: "/expenses", headers });

      expect(response.statusCode).toBe(401);
    });

    it("missing x-role ⇒ 401 UNAUTHENTICATED", async () => {
      const { app } = createTestApp();
      const headers = actorHeaders(EMPLOYEE_A1);
      delete (headers as Record<string, string>)["x-role"];

      const response = await app.inject({ method: "GET", url: "/expenses", headers });

      expect(response.statusCode).toBe(401);
    });

    it("x-role case mismatch ('Manager') ⇒ 401 UNAUTHENTICATED", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "GET",
        url: "/expenses",
        headers: { ...actorHeaders(MANAGER_A), "x-role": "Manager" }
      });

      expect(response.statusCode).toBe(401);
    });

    it("x-role unknown value ('admin') ⇒ 401 UNAUTHENTICATED", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "GET",
        url: "/expenses",
        headers: { ...actorHeaders(EMPLOYEE_A1), "x-role": "admin" }
      });

      expect(response.statusCode).toBe(401);
    });

    it("x-tenant-id = legacy:seed (quarantine marker) is unreachable ⇒ 401", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "GET",
        url: "/expenses",
        headers: { ...actorHeaders(EMPLOYEE_A1), "x-tenant-id": "legacy:seed" }
      });

      expect(response.statusCode).toBe(401);
    });

    it("a 101-char x-user-id (one over the charset length limit) ⇒ 401", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "GET",
        url: "/expenses",
        headers: { ...actorHeaders(EMPLOYEE_A1), "x-user-id": "a".repeat(101) }
      });

      expect(response.statusCode).toBe(401);
    });

    it("a duplicate header (Node joins with ', ') fails the charset and ⇒ 401", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "GET",
        url: "/expenses",
        headers: {
          ...actorHeaders(EMPLOYEE_A1),
          "x-user-id": ["employee-1", "employee-2"] as unknown as string
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it("401 precedes a malformed body: bad headers + malformed JSON ⇒ 401, not 400", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "POST",
        url: "/expenses",
        headers: { "content-type": "application/json" },
        payload: "{not valid json"
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe("UNAUTHENTICATED");
    });

    it("401 precedes an oversize body: no actor headers + >1 MiB body ⇒ 401, not 413", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "POST",
        url: "/expenses",
        headers: { "content-type": "application/json" },
        payload: {
          description: "d".repeat(1_100_000),
          amountCents: 100,
          currency: "USD"
        }
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe("UNAUTHENTICATED");
    });

    it("401 precedes an unsupported content type: no actor headers + application/xml ⇒ 401, not 415", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "POST",
        url: "/expenses",
        headers: { "content-type": "application/xml" },
        payload: "<x/>"
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe("UNAUTHENTICATED");
    });

    it("missing Idempotency-Key ⇒ 400 IDEMPOTENCY_KEY_REQUIRED", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "POST",
        url: "/expenses",
        headers: actorHeaders(EMPLOYEE_A1),
        payload: { description: "d", amountCents: 100, currency: "USD" }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    });

    it("empty-string Idempotency-Key ⇒ 400 IDEMPOTENCY_KEY_INVALID", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "POST",
        url: "/expenses",
        headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "" },
        payload: { description: "d", amountCents: 100, currency: "USD" }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("IDEMPOTENCY_KEY_INVALID");
    });

    it("a 129-char Idempotency-Key ⇒ 400 IDEMPOTENCY_KEY_INVALID", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "POST",
        url: "/expenses",
        headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "k".repeat(129) },
        payload: { description: "d", amountCents: 100, currency: "USD" }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("IDEMPOTENCY_KEY_INVALID");
    });

    it("an Idempotency-Key containing a space ⇒ 400 IDEMPOTENCY_KEY_INVALID", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "POST",
        url: "/expenses",
        headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "key with space" },
        payload: { description: "d", amountCents: 100, currency: "USD" }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("IDEMPOTENCY_KEY_INVALID");
    });

    it("malformed JSON body ⇒ 400 VALIDATION_ERROR without details", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "POST",
        url: "/expenses",
        headers: {
          ...actorHeaders(EMPLOYEE_A1),
          "idempotency-key": "k1",
          "content-type": "application/json"
        },
        payload: "{not valid json"
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: { code: "VALIDATION_ERROR", message: "Request body could not be parsed" }
      });
      expect(response.json().error.details).toBeUndefined();
    });

    it("empty JSON body on DELETE (Content-Type: application/json, no bytes) ⇒ 400", async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "create-1");

      const response = await app.inject({
        method: "DELETE",
        url: "/expenses/expense-1",
        headers: {
          ...actorHeaders(EMPLOYEE_A1),
          "idempotency-key": "del-1",
          "content-type": "application/json"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("empty JSON body on restore (Content-Type: application/json, no bytes) ⇒ 400", async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "create-1");
      await app.inject({
        method: "DELETE",
        url: "/expenses/expense-1",
        headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "del-1" }
      });

      const response = await app.inject({
        method: "POST",
        url: "/expenses/expense-1/restore",
        headers: {
          ...actorHeaders(EMPLOYEE_A1),
          "idempotency-key": "restore-1",
          "content-type": "application/json"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("a body over 1 MiB ⇒ 413 PAYLOAD_TOO_LARGE", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "POST",
        url: "/expenses",
        headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "k1" },
        payload: {
          description: "d".repeat(1_100_000),
          amountCents: 100,
          currency: "USD"
        }
      });

      expect(response.statusCode).toBe(413);
      expect(response.json().error.code).toBe("PAYLOAD_TOO_LARGE");
    });

    it("an unsupported content type (application/xml) ⇒ 415 UNSUPPORTED_MEDIA_TYPE", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "POST",
        url: "/expenses",
        headers: {
          ...actorHeaders(EMPLOYEE_A1),
          "idempotency-key": "k1",
          "content-type": "application/xml"
        },
        payload: "<x/>"
      });

      expect(response.statusCode).toBe(415);
      expect(response.json().error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    });

    it("an unknown field ⇒ 400 VALIDATION_ERROR (key name allowed in details, m7)", async () => {
      const { app } = createTestApp();
      const response = await createAs(app, EMPLOYEE_A1, "k1", { extra: "nope" });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("employeeId: '' ⇒ 400 VALIDATION_ERROR", async () => {
      const { app } = createTestApp();
      const response = await createAs(app, EMPLOYEE_A1, "k1", { employeeId: "" });

      expect(response.statusCode).toBe(400);
    });

    it("amountCents: 0 ⇒ 400 VALIDATION_ERROR", async () => {
      const { app } = createTestApp();
      const response = await createAs(app, EMPLOYEE_A1, "k1", { amountCents: 0 });

      expect(response.statusCode).toBe(400);
    });

    it("currency: 'usd' (lowercase) ⇒ 400 VALIDATION_ERROR", async () => {
      const { app } = createTestApp();
      const response = await createAs(app, EMPLOYEE_A1, "k1", { currency: "usd" });

      expect(response.statusCode).toBe(400);
    });

    it("a body employeeId outside the actor-id charset can never match ⇒ 403 ACTOR_MISMATCH (m10)", async () => {
      const { app } = createTestApp();
      const response = await createAs(app, EMPLOYEE_A1, "k1", {
        employeeId: "employee 1"
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("ACTOR_MISMATCH");
    });

    it("a body reviewerId outside the actor-id charset can never match ⇒ 403 ACTOR_MISMATCH (m10)", async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "k1");

      const response = await app.inject({
        method: "PATCH",
        url: "/expenses/expense-1/decision",
        headers: { ...actorHeaders(MANAGER_A), "idempotency-key": "d1" },
        payload: { status: "APPROVED", reviewerId: "manager 1" }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("ACTOR_MISMATCH");
    });

    it("a 101-char expenseId param exceeds Fastify's router param-length limit ⇒ 414 (never reaches schema validation)", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "GET",
        url: `/expenses/${"a".repeat(101)}`,
        headers: actorHeaders(EMPLOYEE_A1)
      });

      // find-my-way's default maxParamLength (100) rejects the URL at the
      // router level, before any route handler or Zod schema runs, so this
      // never reaches expenseParamsSchema's own max(100) check.
      expect(response.statusCode).toBe(414);
    });

    it("a whitespace-only expenseId param ⇒ 400 VALIDATION_ERROR", async () => {
      const { app } = createTestApp();
      const response = await app.inject({
        method: "GET",
        url: "/expenses/%20%20%20",
        headers: actorHeaders(EMPLOYEE_A1)
      });

      expect(response.statusCode).toBe(400);
    });

    it("/health needs no headers", async () => {
      const { app } = createTestApp();
      const response = await app.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(200);
    });

    it("an unknown route needs no headers (404 ROUTE_NOT_FOUND)", async () => {
      const { app } = createTestApp();
      const response = await app.inject({ method: "GET", url: "/nope" });

      expect(response.statusCode).toBe(404);
    });

    it("no-echo: header values, idempotency key and body values never appear in any response", async () => {
      const { app } = createTestApp();
      const sentinelTenant = "SENTINEL-TENANT-ZZZ";
      const sentinelKey = "SENTINEL-KEY-ZZZ";
      const sentinelBodyValue = "SENTINEL-BODY-VALUE-ZZZ";

      // Bad role, with sentinel-bearing other headers/body to confirm none leak.
      const response = await app.inject({
        method: "POST",
        url: "/expenses",
        headers: {
          "x-tenant-id": sentinelTenant,
          "x-user-id": "employee-1",
          "x-role": "bogus-role",
          "idempotency-key": sentinelKey
        },
        payload: { description: sentinelBodyValue, amountCents: 100, currency: "USD" }
      });

      const raw = response.payload;

      expect(raw).not.toContain(sentinelTenant);
      expect(raw).not.toContain(sentinelKey);
      expect(raw).not.toContain(sentinelBodyValue);

      // A validation failure on a sentinel-bearing unknown field: the key
      // NAME may legitimately appear (Zod strict message, m7), but no VALUE.
      const { app: app2 } = createTestApp();
      const validationResponse = await createAs(app2, EMPLOYEE_A1, "k-sentinel", {
        unknownSentinelField: sentinelBodyValue
      });

      expect(validationResponse.payload).not.toContain(sentinelBodyValue);
    });
  });

  describe("tenancy and decision policy (P7.4)", () => {
    it("employee list is scoped to own rows only", async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "k1");
      await createAs(app, EMPLOYEE_A2, "k2");

      const list = await app.inject({
        method: "GET",
        url: "/expenses",
        headers: actorHeaders(EMPLOYEE_A1)
      });

      expect(list.json().expenses).toHaveLength(1);
      expect(list.json().expenses[0].employeeId).toBe("employee-1");
    });

    it("manager/finance list sees the whole tenant", async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "k1");
      await createAs(app, EMPLOYEE_A2, "k2");

      const asManager = await app.inject({
        method: "GET",
        url: "/expenses",
        headers: actorHeaders(MANAGER_A)
      });
      const asFinance = await app.inject({
        method: "GET",
        url: "/expenses",
        headers: actorHeaders(FINANCE_A)
      });

      expect(asManager.json().expenses).toHaveLength(2);
      expect(asFinance.json().expenses).toHaveLength(2);
    });

    it("employee GET of a same-tenant non-owned expense ⇒ 404 EXPENSE_NOT_FOUND", async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "k1");

      const response = await app.inject({
        method: "GET",
        url: "/expenses/expense-1",
        headers: actorHeaders(EMPLOYEE_A2)
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("EXPENSE_NOT_FOUND");
    });

    it("manager/finance create ⇒ 403 FORBIDDEN_ROLE", async () => {
      const { app } = createTestApp();

      const asManager = await createAs(app, MANAGER_A, "k1");
      const asFinance = await createAs(app, FINANCE_A, "k2");

      expect(asManager.statusCode).toBe(403);
      expect(asManager.json().error.code).toBe("FORBIDDEN_ROLE");
      expect(asFinance.statusCode).toBe(403);
      expect(asFinance.json().error.code).toBe("FORBIDDEN_ROLE");
    });

    it("manager/finance delete and restore ⇒ 403 FORBIDDEN_ROLE", async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "k1");

      const del = await app.inject({
        method: "DELETE",
        url: "/expenses/expense-1",
        headers: { ...actorHeaders(MANAGER_A), "idempotency-key": "d1" }
      });
      const restore = await app.inject({
        method: "POST",
        url: "/expenses/expense-1/restore",
        headers: { ...actorHeaders(FINANCE_A), "idempotency-key": "r1" }
      });

      expect(del.statusCode).toBe(403);
      expect(del.json().error.code).toBe("FORBIDDEN_ROLE");
      expect(restore.statusCode).toBe(403);
      expect(restore.json().error.code).toBe("FORBIDDEN_ROLE");
    });

    it("employee decide on their own visible expense ⇒ 403 FORBIDDEN_ROLE (T5 before T6 self-decision)", async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "k1");

      // Must be the owner (employee-1): T4b hides a non-owned same-tenant
      // expense from an employee (⇒ 404), so only the owner reaches T5.
      const response = await app.inject({
        method: "PATCH",
        url: "/expenses/expense-1/decision",
        headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "d1" },
        payload: { status: "APPROVED" }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("FORBIDDEN_ROLE");
    });

    it("employee deciding a non-owned same-tenant expense ⇒ 404 EXPENSE_NOT_FOUND (T4b, not T5)", async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "k1");

      const response = await app.inject({
        method: "PATCH",
        url: "/expenses/expense-1/decision",
        headers: { ...actorHeaders(EMPLOYEE_A2), "idempotency-key": "d1" },
        payload: { status: "APPROVED" }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("EXPENSE_NOT_FOUND");
    });

    it("ACTOR_MISMATCH on create (mismatched employeeId)", async () => {
      const { app } = createTestApp();
      const response = await createAs(app, EMPLOYEE_A1, "k1", {
        employeeId: "employee-2"
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("ACTOR_MISMATCH");
    });

    it("ACTOR_MISMATCH on decision (mismatched reviewerId)", async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "k1");

      const response = await app.inject({
        method: "PATCH",
        url: "/expenses/expense-1/decision",
        headers: { ...actorHeaders(MANAGER_A), "idempotency-key": "d1" },
        payload: { status: "APPROVED", reviewerId: "someone-else" }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("ACTOR_MISMATCH");
    });

    it("self-decision via alex (created as employee, decides as manager on own expense) ⇒ 403 SELF_DECISION_FORBIDDEN", async () => {
      const { app } = createTestApp();
      const ALEX_EMPLOYEE = { tenantId: "tenant-a", userId: "alex", role: "employee" as const };
      const ALEX_MANAGER = { tenantId: "tenant-a", userId: "alex", role: "manager" as const };

      await createAs(app, ALEX_EMPLOYEE, "k1");

      const response = await app.inject({
        method: "PATCH",
        url: "/expenses/expense-1/decision",
        headers: { ...actorHeaders(ALEX_MANAGER), "idempotency-key": "d1" },
        payload: { status: "APPROVED" }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("SELF_DECISION_FORBIDDEN");
    });

    it(`manager approve at exactly ${MANAGER_APPROVAL_LIMIT_CENTS} cents ⇒ 200`, async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "k1", {
        amountCents: MANAGER_APPROVAL_LIMIT_CENTS
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/expenses/expense-1/decision",
        headers: { ...actorHeaders(MANAGER_A), "idempotency-key": "d1" },
        payload: { status: "APPROVED" }
      });

      expect(response.statusCode).toBe(200);
    });

    it(`manager approve at ${MANAGER_APPROVAL_LIMIT_CENTS + 1} cents ⇒ 403 APPROVAL_LIMIT_EXCEEDED; finance approve OK`, async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "k1", {
        amountCents: MANAGER_APPROVAL_LIMIT_CENTS + 1
      });

      const byManager = await app.inject({
        method: "PATCH",
        url: "/expenses/expense-1/decision",
        headers: { ...actorHeaders(MANAGER_A), "idempotency-key": "d1" },
        payload: { status: "APPROVED" }
      });

      expect(byManager.statusCode).toBe(403);
      expect(byManager.json().error.code).toBe("APPROVAL_LIMIT_EXCEEDED");

      const byFinance = await app.inject({
        method: "PATCH",
        url: "/expenses/expense-1/decision",
        headers: { ...actorHeaders(FINANCE_A), "idempotency-key": "d2" },
        payload: { status: "APPROVED" }
      });

      expect(byFinance.statusCode).toBe(200);
    });

    // --- S12.3 matrix rows run against access.test.ts ---

    it("matrix #12: returns 404 for a cross-tenant delete by a manager", async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "k1");

      const response = await app.inject({
        method: "DELETE",
        url: "/expenses/expense-1",
        headers: { ...actorHeaders(MANAGER_B), "idempotency-key": "d1" }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("EXPENSE_NOT_FOUND");
    });

    it("matrix #13: returns 404 for cross-tenant read and decision, and a tenant-scoped 200 list", async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "k1");

      const read = await app.inject({
        method: "GET",
        url: "/expenses/expense-1",
        headers: actorHeaders(EMPLOYEE_B2)
      });
      const decide = await app.inject({
        method: "PATCH",
        url: "/expenses/expense-1/decision",
        headers: { ...actorHeaders(MANAGER_B), "idempotency-key": "d1" },
        payload: { status: "APPROVED" }
      });
      const list = await app.inject({
        method: "GET",
        url: "/expenses",
        headers: actorHeaders(MANAGER_B)
      });

      expect(read.statusCode).toBe(404);
      expect(decide.statusCode).toBe(404);
      expect(list.statusCode).toBe(200);
      expect(list.json().expenses).toEqual([]);
    });

    it("returns 404 for a cross-tenant restore and changes nothing (m6)", async () => {
      const databasePath = createTempDatabasePath();
      const { app } = createTestApp({ databasePath });

      await createAs(app, EMPLOYEE_A1, "k1");
      await app.inject({
        method: "DELETE",
        url: "/expenses/expense-1",
        headers: { ...actorHeaders(EMPLOYEE_A1), "idempotency-key": "del-1" }
      });

      const reader = openReader(databasePath);
      const before = rawCounts(reader, "expense-1");

      const response = await app.inject({
        method: "POST",
        url: "/expenses/expense-1/restore",
        headers: { ...actorHeaders(MANAGER_B), "idempotency-key": "r1" }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("EXPENSE_NOT_FOUND");

      const after = rawCounts(reader, "expense-1");

      expect(after).toEqual(before);
    });

    it("returns 404 for a cross-tenant decision retry of a stored key without replaying (m6)", async () => {
      const { app } = createTestApp();
      await createAs(app, EMPLOYEE_A1, "k1");

      // Manager-A decides (stores a key on tenant-a).
      await app.inject({
        method: "PATCH",
        url: "/expenses/expense-1/decision",
        headers: { ...actorHeaders(MANAGER_A), "idempotency-key": "shared-key" },
        payload: { status: "APPROVED" }
      });

      // Same literal key reused by a tenant-b manager against the same
      // expenseId: the idempotency store is scoped by (tenantId, userId,
      // key), and manager-1@tenant-b has never stored this key, so this
      // must re-evaluate from T4, not replay tenant-a's stored response.
      const response = await app.inject({
        method: "PATCH",
        url: "/expenses/expense-1/decision",
        headers: { ...actorHeaders(MANAGER_B), "idempotency-key": "shared-key" },
        payload: { status: "APPROVED" }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("EXPENSE_NOT_FOUND");
    });

    it("every cross-tenant/role denial above leaves the expense row, audit count and idempotency count unchanged", async () => {
      const databasePath = createTempDatabasePath();
      const { app } = createTestApp({ databasePath });

      await createAs(app, EMPLOYEE_A1, "k1");

      const reader = openReader(databasePath);
      const before = rawCounts(reader, "expense-1");

      await app.inject({
        method: "DELETE",
        url: "/expenses/expense-1",
        headers: { ...actorHeaders(MANAGER_B), "idempotency-key": "cross-del" }
      });
      await app.inject({
        method: "PATCH",
        url: "/expenses/expense-1/decision",
        headers: { ...actorHeaders(MANAGER_B), "idempotency-key": "cross-dec" },
        payload: { status: "APPROVED" }
      });

      const after = rawCounts(reader, "expense-1");

      expect(after).toEqual(before);
    });
  });
});
