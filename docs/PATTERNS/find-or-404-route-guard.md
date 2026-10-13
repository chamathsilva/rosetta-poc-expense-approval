# Find-or-404 Route Guard

## Description

After request validation, single-resource routes look up the id and return 404 if absent. The decision route then checks state and returns 409 on conflict. Found in `GET /expenses/:expenseId` and `PATCH /expenses/:expenseId/decision` in `src/app.ts`. This describes the unauthenticated seed, not a substitute for any future authorization requirements.

## Template/Example

```ts
const existing = repository.findById(parsedParams.data.<id>);

if (existing === undefined) {
  return reply
    .code(404)
    .send(errorBody("<RESOURCE>_NOT_FOUND", "<Resource> not found"));
}

// <extension point>: add further precondition checks here, each returning
// its own specific error code before any mutation is attempted, e.g.:
if (existing.status !== "SUBMITTED") {
  return reply
    .code(409)
    .send(errorBody("<RESOURCE>_ALREADY_DECIDED", "<Resource> is already decided"));
}

const result = repository.<mutate>(/* ... */);

if (result === undefined) {
  // repository re-checks the precondition atomically at write time;
  // treat a missed write the same as a conflict, not a 500.
  return reply.code(409).send(errorBody("<RESOURCE>_DECISION_CONFLICT", "..."));
}
```

## Notes

- The repository's mutating method re-validates the same precondition in its `WHERE` clause (see SQLite Repository Method pattern), so a race between the guard check and the write still surfaces as a 409, not a crash or silent no-op.
