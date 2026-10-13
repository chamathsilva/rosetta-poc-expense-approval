# Deterministic Fastify Inject Test Case

## Description

Tests build the app through `buildApp()` with injected `idFactory` and `now` functions so ids and timestamps are deterministic and assertable, exercise routes with `app.inject()` instead of a real listening socket, and register every created app/temp directory for cleanup in a shared `afterEach`. Found throughout `tests/app.test.ts` (all six test cases). Use this shape for any new route test.

## Template/Example

```ts
function createTestApp(databasePath = ":memory:"): FastifyInstance {
  let nextId = 1;
  let nextSecond = 0;

  const app = buildApp({
    databasePath,
    idFactory: () => `expense-${nextId++}`,
    now: () => `2026-09-15T12:00:${String(nextSecond++).padStart(2, "0")}.000Z`
  });

  openApps.push(app); // tracked for the shared afterEach app.close()
  return app;
}

it("<behavior under test>", async () => {
  const app = createTestApp();

  const response = await app.inject({
    method: "POST", // <extension point>: GET/PATCH/DELETE as needed
    url: "/<resource>",
    payload: { /* ... */ }
  });

  expect(response.statusCode).toBe(<expected>);
  expect(response.json()).toEqual({ /* exact expected body, not a subset */ });
});
```

## Notes

- `openApps` and `temporaryDirectories` arrays are module-level and drained in one shared `afterEach` — new tests push onto these rather than writing their own teardown.
- Prefer `:memory:` databases unless the test specifically needs cross-instance persistence (see the "persists expenses across application instances" case, which uses `mkdtempSync` + a real file path).
- Assertions use `toEqual` on the full body for exact-shape checks and `toMatchObject` only when intentionally ignoring some fields (e.g. `updatedAt` timing).
