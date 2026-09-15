import { randomUUID } from "node:crypto";

import Fastify, { type FastifyInstance } from "fastify";
import type { ZodError } from "zod";

import { openDatabase } from "./database.js";
import { ExpenseRepository } from "./expense-repository.js";
import {
  createExpenseSchema,
  expenseDecisionSchema,
  expenseParamsSchema
} from "./schemas.js";

export interface BuildAppOptions {
  databasePath?: string;
  idFactory?: () => string;
  now?: () => string;
  logger?: boolean;
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{
      path: string;
      message: string;
    }>;
  };
}

function validationError(error: ZodError): ErrorBody {
  return {
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    }
  };
}

function errorBody(code: string, message: string): ErrorBody {
  return {
    error: {
      code,
      message
    }
  };
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const database = openDatabase(options.databasePath ?? "data/expenses.sqlite");
  const repository = new ExpenseRepository(database);
  const idFactory = options.idFactory ?? randomUUID;
  const now = options.now ?? (() => new Date().toISOString());
  const app = Fastify({ logger: options.logger ?? false });

  app.addHook("onClose", () => {
    database.close();
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/expenses", async (request, reply) => {
    const parsed = createExpenseSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(validationError(parsed.error));
    }

    const createdAt = now();
    const expense = repository.create({
      id: idFactory(),
      employeeId: parsed.data.employeeId,
      description: parsed.data.description,
      amountCents: parsed.data.amountCents,
      currency: parsed.data.currency,
      createdAt
    });

    return reply.code(201).send({ expense });
  });

  app.get("/expenses", async () => ({
    expenses: repository.list()
  }));

  app.get<{ Params: { expenseId: string } }>(
    "/expenses/:expenseId",
    async (request, reply) => {
      const parsedParams = expenseParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send(validationError(parsedParams.error));
      }

      const expense = repository.findById(parsedParams.data.expenseId);

      if (expense === undefined) {
        return reply
          .code(404)
          .send(errorBody("EXPENSE_NOT_FOUND", "Expense not found"));
      }

      return { expense };
    }
  );

  app.patch<{
    Params: { expenseId: string };
  }>("/expenses/:expenseId/decision", async (request, reply) => {
    const parsedParams = expenseParamsSchema.safeParse(request.params);
    const parsedBody = expenseDecisionSchema.safeParse(request.body);

    if (!parsedParams.success) {
      return reply.code(400).send(validationError(parsedParams.error));
    }

    if (!parsedBody.success) {
      return reply.code(400).send(validationError(parsedBody.error));
    }

    const existing = repository.findById(parsedParams.data.expenseId);

    if (existing === undefined) {
      return reply
        .code(404)
        .send(errorBody("EXPENSE_NOT_FOUND", "Expense not found"));
    }

    if (existing.status !== "SUBMITTED") {
      return reply
        .code(409)
        .send(errorBody("EXPENSE_ALREADY_DECIDED", "Expense is already decided"));
    }

    const expense = repository.decide(parsedParams.data.expenseId, {
      status: parsedBody.data.status,
      reviewerId: parsedBody.data.reviewerId,
      note: parsedBody.data.note ?? null,
      decidedAt: now()
    });

    if (expense === undefined) {
      return reply
        .code(409)
        .send(errorBody("EXPENSE_DECISION_CONFLICT", "Expense decision conflicted"));
    }

    return { expense };
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send(errorBody("ROUTE_NOT_FOUND", "Route not found"))
  );

  app.setErrorHandler((_error, _request, reply) =>
    reply
      .code(500)
      .send(errorBody("INTERNAL_ERROR", "An unexpected error occurred"))
  );

  return app;
}
