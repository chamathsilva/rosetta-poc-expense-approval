import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { ROLES, type Actor } from "./domain.js";
import { errorBody } from "./errors.js";

const identifierSchema = z.string().regex(/^[A-Za-z0-9._-]{1,100}$/);

export const actorHeadersSchema = z.object({
  "x-tenant-id": identifierSchema,
  "x-user-id": identifierSchema,
  "x-role": z.enum(ROLES)
});

declare module "fastify" {
  interface FastifyRequest {
    actor: Actor | null;
  }
}

export function registerActorHook(app: FastifyInstance): void {
  app.decorateRequest("actor", null);

  app.addHook("onRequest", async (request, reply) => {
    const url = request.routeOptions.url;

    if (url === undefined || !url.startsWith("/expenses")) {
      return;
    }

    const parsed = actorHeadersSchema.safeParse(request.headers);

    if (!parsed.success) {
      return reply.code(401).send(errorBody("UNAUTHENTICATED"));
    }

    request.actor = {
      tenantId: parsed.data["x-tenant-id"],
      userId: parsed.data["x-user-id"],
      role: parsed.data["x-role"]
    };
  });
}

export function requireActor(request: FastifyRequest): Actor {
  if (request.actor === null) {
    throw new Error("requireActor: actor was not set by registerActorHook");
  }

  return request.actor;
}
