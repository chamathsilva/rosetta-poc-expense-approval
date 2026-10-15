import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, expectTypeOf, it } from "vitest";

import { openDatabase } from "../src/database.js";
import { TransactionNestingError, withTransaction } from "../src/transaction.js";
import type { NotPromise } from "../src/transaction.js";

/**
 * Written fresh in Phase 11 (PLAN P7.0) directly from SPECS S11 "Runtime
 * facts relied on" — NOT a reuse or un-skip of the Phase 7 scratch probe at
 * `agents/TEMP/EXP-003/sqlite-runtime-probe.mjs`. That script is never
 * imported here or anywhere else under tests/.
 */
describe("node:sqlite runtime facts (S11)", () => {
  it("DatabaseSync has no built-in #transaction method", () => {
    const database = new DatabaseSync(":memory:");

    expect((database as unknown as Record<string, unknown>)["transaction"]).toBeUndefined();
    database.close();
  });

  it("isTransaction tracks BEGIN/COMMIT/ROLLBACK", () => {
    const database = new DatabaseSync(":memory:");

    expect(database.isTransaction).toBe(false);
    database.exec("BEGIN IMMEDIATE");
    expect(database.isTransaction).toBe(true);
    database.exec("COMMIT");
    expect(database.isTransaction).toBe(false);

    database.exec("BEGIN IMMEDIATE");
    expect(database.isTransaction).toBe(true);
    database.exec("ROLLBACK");
    expect(database.isTransaction).toBe(false);

    database.close();
  });

  it("a nested BEGIN throws instead of silently succeeding", () => {
    const database = new DatabaseSync(":memory:");

    database.exec("BEGIN IMMEDIATE");
    expect(() => database.exec("BEGIN IMMEDIATE")).toThrow();
    // the outer transaction remains open/untouched by the failed nested BEGIN
    expect(database.isTransaction).toBe(true);
    database.exec("ROLLBACK");
    database.close();
  });

  it("a trigger RAISE(ABORT) surfaces as a thrown Error, transaction stays open", () => {
    const database = new DatabaseSync(":memory:");

    database.exec(`
      CREATE TABLE t (id INTEGER PRIMARY KEY);
      CREATE TRIGGER t_block BEFORE INSERT ON t
        BEGIN SELECT RAISE(ABORT, 'blocked'); END;
    `);

    database.exec("BEGIN IMMEDIATE");
    expect(() => database.prepare("INSERT INTO t (id) VALUES (1)").run()).toThrow();
    expect(database.isTransaction).toBe(true);
    database.exec("ROLLBACK");

    database.close();
  });

  it("PRAGMA user_version and DDL both roll back with the transaction", () => {
    const database = new DatabaseSync(":memory:");

    database.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    database.exec("BEGIN IMMEDIATE");
    database.exec("PRAGMA user_version = 7");
    database.exec("CREATE TABLE rollback_me (id INTEGER PRIMARY KEY)");
    database.exec("ROLLBACK");

    const version = database.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };

    expect(version.user_version).toBe(0);
    expect(() => database.prepare("SELECT * FROM rollback_me").all()).toThrow();

    database.close();
  });

  it("json_valid exists as a scalar function", () => {
    const database = new DatabaseSync(":memory:");
    const row = database.prepare("SELECT json_valid('{}') AS v").get() as {
      v: number;
    };

    expect(row.v).toBe(1);
    database.close();
  });

  it("ADD COLUMN ... NOT NULL DEFAULT works on a populated table", () => {
    const database = new DatabaseSync(":memory:");

    database.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    database.prepare("INSERT INTO t (id) VALUES (1)").run();
    expect(() =>
      database.exec("ALTER TABLE t ADD COLUMN tag TEXT NOT NULL DEFAULT 'x'")
    ).not.toThrow();

    const row = database.prepare("SELECT tag FROM t WHERE id = 1").get() as {
      tag: string;
    };

    expect(row.tag).toBe("x");
    database.close();
  });

  it("run().changes is a number", () => {
    const database = new DatabaseSync(":memory:");

    database.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    const result = database.prepare("INSERT INTO t (id) VALUES (1)").run();

    expect(typeof result.changes).toBe("number");
    database.close();
  });

  it("a BEFORE INSERT trigger sees the DEFAULT when the column is omitted", () => {
    const database = new DatabaseSync(":memory:");

    database.exec(`
      CREATE TABLE t (id INTEGER PRIMARY KEY, tag TEXT NOT NULL DEFAULT 'quarantine');
      CREATE TABLE seen (tag TEXT NOT NULL);
      CREATE TRIGGER t_capture BEFORE INSERT ON t
        BEGIN INSERT INTO seen (tag) VALUES (NEW.tag); END;
    `);

    database.prepare("INSERT INTO t (id) VALUES (1)").run();
    const row = database.prepare("SELECT tag FROM seen").get() as { tag: string };

    expect(row.tag).toBe("quarantine");
    database.close();
  });

  it("a persistent trigger created through a second connection affects writes through the first", () => {
    // node:sqlite's ":memory:" is per-connection, not shared, so this fact
    // is proven against a real temp file the same way S12.1's fault
    // injection does in tests/audit.test.ts.
    const directory = mkdtempSync(join(tmpdir(), "exp-003-sqlite-runtime-"));
    const filePath = join(directory, "db.sqlite");

    const first = new DatabaseSync(filePath);
    first.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");

    const second = new DatabaseSync(filePath);
    second.exec(`
      CREATE TRIGGER t_block BEFORE INSERT ON t
        BEGIN SELECT RAISE(ABORT, 'blocked by second connection'); END;
    `);

    expect(() => first.prepare("INSERT INTO t (id) VALUES (1)").run()).toThrow();

    first.close();
    second.close();
    rmSync(directory, { recursive: true, force: true });
  });
});

describe("withTransaction (S11 contract, S5.4)", () => {
  it("commits a returned value", () => {
    const database = new DatabaseSync(":memory:");

    database.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    const result = withTransaction(database, () => {
      database.prepare("INSERT INTO t (id) VALUES (1)").run();
      return 42;
    });

    expect(result).toBe(42);
    expect(database.prepare("SELECT * FROM t").all()).toHaveLength(1);
    expect(database.isTransaction).toBe(false);
    database.close();
  });

  it("rolls back and rethrows when work() throws", () => {
    const database = new DatabaseSync(":memory:");

    database.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    expect(() =>
      withTransaction(database, () => {
        database.prepare("INSERT INTO t (id) VALUES (1)").run();
        throw new Error("boom");
      })
    ).toThrow("boom");

    expect(database.prepare("SELECT * FROM t").all()).toHaveLength(0);
    expect(database.isTransaction).toBe(false);
    database.close();
  });

  it("rejects nested transactions before issuing any SQL, outer transaction untouched", () => {
    const database = new DatabaseSync(":memory:");

    database.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    database.exec("BEGIN IMMEDIATE");
    database.prepare("INSERT INTO t (id) VALUES (1)").run();

    expect(() => withTransaction(database, () => 1)).toThrow(
      TransactionNestingError
    );
    // outer transaction is untouched: still open, insert still pending
    expect(database.isTransaction).toBe(true);
    database.exec("COMMIT");

    expect(database.prepare("SELECT * FROM t").all()).toHaveLength(1);
    database.close();
  });

  it("rejects a thenable return at runtime (backstop) and rolls back", () => {
    const database = new DatabaseSync(":memory:");

    database.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");

    const work = (): unknown => {
      database.prepare("INSERT INTO t (id) VALUES (1)").run();
      return { then: () => undefined };
    };

    expect(() =>
      withTransaction(
        database,
        work as unknown as () => NotPromise<unknown>
      )
    ).toThrow(TypeError);

    expect(database.prepare("SELECT * FROM t").all()).toHaveLength(0);
    expect(database.isTransaction).toBe(false);
    database.close();
  });

  it("rolls back all three table writes (expenses, audit_events, idempotency_records) on a post-write throw", () => {
    const database = openDatabase(":memory:");

    const before = {
      expenses: database.prepare("SELECT * FROM expenses").all(),
      audit: database.prepare("SELECT * FROM audit_events").all(),
      idempotency: database.prepare("SELECT * FROM idempotency_records").all()
    };

    expect(() =>
      withTransaction(database, () => {
        database
          .prepare(
            `INSERT INTO expenses (id, tenant_id, employee_id, description, amount_cents, currency, status, created_at, updated_at)
             VALUES ('e1', 'tenant-a', 'employee-1', 'd', 100, 'USD', 'SUBMITTED', 't0', 't0')`
          )
          .run();
        database
          .prepare(
            `INSERT INTO audit_events (tenant_id, expense_id, actor_user_id, actor_role, event_type, occurred_at, payload_json)
             VALUES ('tenant-a', 'e1', 'employee-1', 'employee', 'EXPENSE_SUBMITTED', 't0', '{}')`
          )
          .run();
        database
          .prepare(
            `INSERT INTO idempotency_records (tenant_id, actor_user_id, idempotency_key, request_fingerprint, response_status, response_body, created_at)
             VALUES ('tenant-a', 'employee-1', 'k1', '${"a".repeat(64)}', 200, '{}', 't0')`
          )
          .run();

        throw new Error("post-write failure");
      })
    ).toThrow("post-write failure");

    expect(database.prepare("SELECT * FROM expenses").all()).toEqual(before.expenses);
    expect(database.prepare("SELECT * FROM audit_events").all()).toEqual(before.audit);
    expect(database.prepare("SELECT * FROM idempotency_records").all()).toEqual(
      before.idempotency
    );

    database.close();
  });
});

describe("NotPromise<T> compile-time constraint (S5.4, m12)", () => {
  it("infers number and void for sync work (runtime + type check)", () => {
    const database = new DatabaseSync(":memory:");
    database.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");

    // Sync number-returning work: T is correctly inferred as number.
    const numberResult = withTransaction(database, () => 1);
    expectTypeOf(numberResult).toEqualTypeOf<number>();

    // Sync void-returning work (the migration shape): T infers as void.
    const voidResult = withTransaction(database, () => {
      database.exec("SELECT 1");
    });
    expectTypeOf(voidResult).toEqualTypeOf<void>();

    database.close();
  });

  it("infers the declared return type for a throwing callback (type-only, never invoked)", () => {
    const database = new DatabaseSync(":memory:");

    // Type-checked only: calling this would throw at runtime, so it is
    // referenced (for the type assertion) but never invoked.
    const throwingWork = undefined as unknown as () => number;
    const typedThrowingCall = () => withTransaction(database, throwingWork);

    expectTypeOf(typedThrowingCall).returns.toEqualTypeOf<number>();
    database.close();
  });

  it("rejects async/Promise-returning work at compile time (type-only, never invoked)", () => {
    const database = new DatabaseSync(":memory:");

    const asyncWork = undefined as unknown as () => Promise<number>;
    const maybeAsyncWork = undefined as unknown as () =>
      | number
      | Promise<number>;

    // An async (Promise-returning) work must not type-check: NotPromise<T>
    // collapses T's false branch to `never`, so the parameter type becomes
    // `() => never` and a real async function is not assignable to it.
    // Wrapped in an un-invoked closure: ts-expect-error proves the compile
    // error exists without ever calling withTransaction with async work.
    const typedAsyncCall = () =>
      // @ts-expect-error -- async work must be rejected at compile time
      withTransaction(database, asyncWork);

    // A work that can return a value OR a Promise (mixed) must also be
    // rejected, since T would infer as a Promise union and collapse to never.
    const typedMixedCall = () =>
      // @ts-expect-error -- mixed sync/Promise work must be rejected at compile time
      withTransaction(database, maybeAsyncWork);

    expect(typeof typedAsyncCall).toBe("function");
    expect(typeof typedMixedCall).toBe("function");
    database.close();
  });
});
