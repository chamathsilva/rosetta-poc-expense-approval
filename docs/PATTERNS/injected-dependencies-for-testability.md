# Constructor-Injected Dependencies for Testability

## Description
Non-deterministic or environment-bound dependencies (DB path, ID generation, current time, logging) are passed into `buildApp(options)` with production defaults, so tests can override them without touching global state or mocking modules. Use this whenever adding a new source of non-determinism or external resource to the app factory.

Found in: `src/app.ts` — `BuildAppOptions.databasePath` (defaults to `data/expenses.sqlite`), `idFactory` (defaults to `randomUUID`), `now` (defaults to `() => new Date().toISOString()`), `logger` (defaults to `false`).

## Template/Example
```ts
export interface BuildAppOptions {
  databasePath?: string;   // EXTENSION POINT: add new overridable dependency here
  idFactory?: () => string;
  now?: () => string;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const databasePath = options.databasePath ?? "data/expenses.sqlite"; // production default
  const idFactory = options.idFactory ?? randomUUID;
  const now = options.now ?? (() => new Date().toISOString());
  // ... use these instead of calling randomUUID()/Date.now() directly anywhere else
}
```

Rules:
- Every new nondeterministic dependency gets an optional field on the options interface plus a real-world default.
- Business logic must call the injected function/value, never the underlying global (`Date`, `crypto.randomUUID`, etc.) directly.
