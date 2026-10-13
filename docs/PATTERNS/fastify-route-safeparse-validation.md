# Fastify Route Handler with safeParse Validation

## Description

Every Fastify route handler that accepts params or a body validates it with the matching Zod schema's `.safeParse()`, and returns a 400 with a structured validation error body on failure before touching any business logic. Found in all three mutating/lookup routes in `src/app.ts` (`POST /expenses`, `GET /expenses/:expenseId`, `PATCH /expenses/:expenseId/decision`). Use this shape for any new route that takes untrusted input.

## Template/Example

```ts
app.post("/<resource>", async (request, reply) => {
  const parsed = <name>Schema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send(validationError(parsed.error));
  }

  // <extension point>: for routes with both params and body, validate
  // the decision route parses both before checking the results, then
  // returns a params error before a body error when both are invalid.

  // business logic goes here, using parsed.data (fully typed, trusted)
  const result = /* repository call using parsed.data */;

  return reply.code(201).send({ <resource>: result });
});
```

## Notes

- Never read `request.body` / `request.params` directly in business logic — always go through `parsed.data` after a successful `safeParse`.
- Each validation failure returns immediately; validations are not combined or deferred.
- Pairs with the "Structured Error Response" pattern for the 400 body shape.
