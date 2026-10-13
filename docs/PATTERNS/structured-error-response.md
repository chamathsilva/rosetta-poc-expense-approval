# Structured Error Response

## Description

All error responses (validation failures, not-found, conflicts, unknown routes, and uncaught exceptions) share one JSON shape: `{ error: { code, message, details? } }`. Built by two small helpers in `src/app.ts` — `validationError(zodError)` for Zod failures and `errorBody(code, message)` for everything else — and reused by `setNotFoundHandler` and `setErrorHandler`. This is the one error contract for the API; do not invent ad hoc error shapes per route.

## Template/Example

```ts
interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
}

function errorBody(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}

// Usage in a route handler:
return reply
  .code(404) // <extension point>: pick the HTTP status that matches the failure
  .send(errorBody("<RESOURCE>_NOT_FOUND", "<Resource> not found"));

// Usage for Zod validation failures:
return reply.code(400).send(validationError(parsed.error));
```

## Notes

- Error codes use SCREAMING_SNAKE_CASE; resource errors may use EXPENSE_ prefixes, while VALIDATION_ERROR and INTERNAL_ERROR are generic.
- `setErrorHandler` always returns a generic `INTERNAL_ERROR` 500 — it never leaks internal exception details to the client.
