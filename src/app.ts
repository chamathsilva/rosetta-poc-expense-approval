import { randomUUID } from "node:crypto";

import Fastify, { type FastifyInstance } from "fastify";

import { registerActorHook, requireActor } from "./actor.js";
import { AuditRepository } from "./audit-repository.js";
import { openDatabase } from "./database.js";
import { bodyParserErrorResult, errorBody, validationError } from "./errors.js";
import { ExpenseRepository } from "./expense-repository.js";
import { ExpenseService } from "./expense-service.js";
import { IdempotencyRepository } from "./idempotency-repository.js";
import {
  createExpenseSchema,
  emptyMutationBodySchema,
  expenseDecisionSchema,
  expenseParamsSchema,
  parseIdempotencyKey
} from "./schemas.js";

export interface BuildAppOptions {
  databasePath?: string;
  idFactory?: () => string;
  now?: () => string;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const database = openDatabase(options.databasePath ?? "data/expenses.sqlite");
  const expenses = new ExpenseRepository(database);
  const audit = new AuditRepository(database);
  const idempotency = new IdempotencyRepository(database);
  const idFactory = options.idFactory ?? randomUUID;
  const now = options.now ?? (() => new Date().toISOString());
  const service = new ExpenseService({
    database,
    expenses,
    audit,
    idempotency,
    idFactory,
    now
  });
  const app = Fastify({ logger: options.logger ?? false });

  app.addHook("onClose", () => {
    database.close();
  });

  registerActorHook(app);

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/expenses", async (request, reply) => {
    const actor = requireActor(request);
    const keyResult = parseIdempotencyKey(request.headers["idempotency-key"]);

    if (!keyResult.ok) {
      return reply.code(400).send(errorBody(keyResult.code));
    }

    const parsedBody = createExpenseSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send(validationError(parsedBody.error));
    }

    const result = service.create(actor, keyResult.key, parsedBody.data);

    return reply.code(result.statusCode).send(result.body);
  });

  app.get("/expenses", async (request, reply) => {
    const actor = requireActor(request);
    const result = service.list(actor);

    return reply.code(result.statusCode).send(result.body);
  });

  app.get<{ Params: { expenseId: string } }>(
    "/expenses/:expenseId",
    async (request, reply) => {
      const actor = requireActor(request);
      const parsedParams = expenseParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send(validationError(parsedParams.error));
      }

      const result = service.get(actor, parsedParams.data.expenseId);

      return reply.code(result.statusCode).send(result.body);
    }
  );

  app.patch<{ Params: { expenseId: string } }>(
    "/expenses/:expenseId/decision",
    async (request, reply) => {
      const actor = requireActor(request);
      const keyResult = parseIdempotencyKey(request.headers["idempotency-key"]);

      if (!keyResult.ok) {
        return reply.code(400).send(errorBody(keyResult.code));
      }

      const parsedParams = expenseParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send(validationError(parsedParams.error));
      }

      const parsedBody = expenseDecisionSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send(validationError(parsedBody.error));
      }

      const result = service.decide(
        actor,
        keyResult.key,
        parsedParams.data.expenseId,
        parsedBody.data
      );

      return reply.code(result.statusCode).send(result.body);
    }
  );

  app.delete<{ Params: { expenseId: string } }>(
    "/expenses/:expenseId",
    async (request, reply) => {
      const actor = requireActor(request);
      const keyResult = parseIdempotencyKey(request.headers["idempotency-key"]);

      if (!keyResult.ok) {
        return reply.code(400).send(errorBody(keyResult.code));
      }

      const parsedParams = expenseParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send(validationError(parsedParams.error));
      }

      const parsedBody = emptyMutationBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send(validationError(parsedBody.error));
      }

      const result = service.delete(
        actor,
        keyResult.key,
        parsedParams.data.expenseId
      );

      return reply.code(result.statusCode).send(result.body);
    }
  );

  app.post<{ Params: { expenseId: string } }>(
    "/expenses/:expenseId/restore",
    async (request, reply) => {
      const actor = requireActor(request);
      const keyResult = parseIdempotencyKey(request.headers["idempotency-key"]);

      if (!keyResult.ok) {
        return reply.code(400).send(errorBody(keyResult.code));
      }

      const parsedParams = expenseParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send(validationError(parsedParams.error));
      }

      const parsedBody = emptyMutationBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send(validationError(parsedBody.error));
      }

      const result = service.restore(
        actor,
        keyResult.key,
        parsedParams.data.expenseId
      );

      return reply.code(result.statusCode).send(result.body);
    }
  );

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send(errorBody("ROUTE_NOT_FOUND"))
  );

  app.setErrorHandler((error, request, reply) => {
    const mapped = bodyParserErrorResult(error);

    if (mapped !== undefined) {
      return reply.code(mapped.statusCode).send(mapped.body);
    }

    request.log.error(error);

    return reply.code(500).send(errorBody("INTERNAL_ERROR"));
  });

  return app;
}
