# Structured JSON Error Response

## Description
All error responses (validation, not-found, conflict, unhandled) share one JSON shape: `{ error: { code, message, details? } }`. Use this for any new failure path so API consumers can branch on `error.code` consistently. Solves inconsistent ad-hoc error payloads across routes.

Found in: `src/app.ts` — `validationError()` (400s), `errorBody()` (404 not-found, 409 conflicts, 500 handler, 404 not-found-route handler).

## Template/Example
```ts
interface ErrorBody {
  error: {
    code: string;                 // EXTENSION POINT: stable machine-readable code, SCREAMING_SNAKE_CASE
    message: string;              // human-readable summary
    details?: Array<{ path: string; message: string }>; // only for validation errors
  };
}

function errorBody(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}

// usage in a handler
if (existing === undefined) {
  return reply.code(404).send(errorBody("RESOURCE_NOT_FOUND", "Resource not found"));
}
```

Rules:
- Pick the HTTP status that matches the failure class (400 validation, 404 missing, 409 conflicting state, 500 unexpected).
- Register `setNotFoundHandler` and `setErrorHandler` once at app build time so unmatched routes/uncaught errors also emit this shape.
