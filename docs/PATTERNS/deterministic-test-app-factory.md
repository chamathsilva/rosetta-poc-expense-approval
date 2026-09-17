# Deterministic Test App Factory

## Description
Tests build the app through a local `createTestApp()` helper that injects an in-memory database (`:memory:`), a predictable incrementing `idFactory`, and a predictable incrementing `now()` clock, then drive it exclusively through `app.inject(...)` (no real network sockets). Use this for any new test file exercising the HTTP layer — it solves flaky/non-reproducible assertions on IDs and timestamps.

Found in: `tests/app.test.ts` — `createTestApp()` used by every `it(...)` block; `createExpense()` as a shared request-builder helper reused across multiple tests.

## Template/Example
```ts
function createTestApp(databasePath = ":memory:"): FastifyInstance {
  let nextId = 1;
  let nextSecond = 0;

  const app = buildApp({
    databasePath,
    idFactory: () => `resource-${nextId++}`,               // EXTENSION POINT: deterministic id sequence
    now: () => `2026-09-15T12:00:${String(nextSecond++).padStart(2, "0")}.000Z` // deterministic clock
  });

  openApps.push(app); // registered for teardown — see Test Resource Cleanup pattern
  return app;
}

// usage
const app = createTestApp();
const response = await app.inject({ method: "POST", url: "/resource", payload: { /* ... */ } });
expect(response.statusCode).toBe(201);
```

Rules:
- Never assert on a real `randomUUID()` or `Date.now()` value; always inject fakes via the app's dependency-injection options.
- Prefer `app.inject()` over starting a real listener/port in tests.
