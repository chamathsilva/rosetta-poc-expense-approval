# Test Resource Cleanup via Registry + afterEach

## Description
Side-effecting resources created during a test (open Fastify app instances, temp directories on disk) are pushed onto module-level arrays as they're created, and a single `afterEach` drains each array, closing/removing everything — regardless of which test created it or whether it failed. Use this whenever a test allocates a resource that must be released (open handle, temp file/dir, server instance) to avoid leaks across the suite.

Found in: `tests/app.test.ts` — `openApps: FastifyInstance[]` + `temporaryDirectories: string[]`, both drained in one `afterEach`.

## Template/Example
```ts
const openApps: FastifyInstance[] = [];
const temporaryDirectories: string[] = [];        // EXTENSION POINT: add more resource registries as needed

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

function createTestApp(): FastifyInstance {
  const app = buildApp({ /* ... */ });
  openApps.push(app); // register immediately at creation time
  return app;
}
```

Rules:
- Register a resource for cleanup at the moment it's created, not at the end of the test.
- Use `.splice(0)` (or equivalent) to drain the array so cleanup runs exactly once even if the array is reused across tests.
