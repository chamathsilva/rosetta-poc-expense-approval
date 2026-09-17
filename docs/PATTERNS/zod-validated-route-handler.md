# Zod-Validated Route Handler (Safe-Parse Guard)

## Description
Every route that accepts client input (body or params) validates it with a Zod schema's `.safeParse()` before touching business logic, and returns a structured 400 on failure. Use this whenever adding a new Fastify route that reads `request.body` or `request.params`. It solves untrusted-input handling without throwing exceptions into the framework's error handler, keeping validation failures explicit and typed.

Found in: `src/app.ts` — `POST /expenses` (body), `GET /expenses/:expenseId` (params), `PATCH /expenses/:expenseId/decision` (params + body).

## Template/Example
```ts
app.post("/resource", async (request, reply) => {
  const parsed = someSchema.safeParse(request.body); // EXTENSION POINT: swap schema per route/input source

  if (!parsed.success) {
    return reply.code(400).send(validationError(parsed.error));
  }

  // EXTENSION POINT: use parsed.data (fully typed) for business logic
  const result = doSomething(parsed.data);

  return reply.code(201).send({ result });
});
```

Rules:
- Validate params and body separately when both are present; check params first.
- Never trust `request.body`/`request.params` directly past this guard.
- Always route failures through the shared `validationError()` helper (see Structured JSON Error Response pattern).
