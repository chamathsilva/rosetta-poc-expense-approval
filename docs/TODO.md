# TODO

**Purpose**: the workspace's open work items — things known to need doing that no one is doing right now.
**Contains**: one `###` entry per item, header formatted `P<n> · <when> · <what> · <where>`, body giving why it matters and what "done" looks like.
**Excludes**: unconfirmed inferences (`ASSUMPTIONS.md`), completed work (`agents/IMPLEMENTATION.md`), and anything already tracked in an issue.
**Style**: priority `P0`–`P3`; `when` is the trigger (`now`, or the condition that makes it due). Delete an entry when done — this is not a history.

## Open Items

### P2 · when a second test file is added · Extract shared test helpers — `tests/`

`createTestApp()` and the cleanup registry (`openApps`, `temporaryDirectories`, the shared `afterEach`) live inside `tests/app.test.ts`, and the registry arrays are module-scoped. A second test file that copies them rather than importing them gets its own arrays and its own drift, and the divergence will be silent. Done when both helpers sit in a shared module — `tests/helpers.ts` — imported by every test file. Not due while there is exactly one test file; extracting early adds indirection the starter does not need.

### P2 · before the first schema change reaches an existing database · Decide the schema-evolution mechanism — `src/database.ts`

`openDatabase` runs `CREATE TABLE IF NOT EXISTS` on every open and there is no migration tool, version table, or migrations directory. That works only while no database outlives a schema change: add a column to the DDL and an existing `data/expenses.sqlite` silently keeps the old shape, surfacing as confusing row-mapping errors rather than a clear failure. Done when either a migration mechanism exists, or `ARCHITECTURE.md` states that databases are disposable and must be deleted after a schema change.

### P3 · when a second entrypoint or worker process is added · Promote the `server.ts` lifecycle idioms to patterns — `docs/PATTERNS/`

Env validation via a Zod schema over `process.env`, and the shutdown path (Fastify `onClose` plus `SIGINT`/`SIGTERM` handlers), each appear exactly once and so fell below the two-occurrence bar in Phase 5. A second entrypoint written without them would diverge on config handling and on releasing the database handle. Done when both are catalogued in `PATTERNS/INDEX.md` and the second entrypoint follows them.
