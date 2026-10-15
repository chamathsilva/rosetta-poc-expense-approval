import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import {
  QUARANTINE_TENANT_ID,
  SCHEMA_VERSION,
  migrate,
  openDatabase
} from "../src/database.js";

const temporaryDirectories: string[] = [];

function tempDbPath(): string {
  const directory = mkdtempSync(join(tmpdir(), "exp-003-migration-"));

  temporaryDirectories.push(directory);
  return join(directory, "expenses.sqlite");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((d) => rm(d, { recursive: true, force: true }))
  );
});

const SEED_DDL = `
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL CHECK (length(currency) = 3),
    status TEXT NOT NULL CHECK (status IN ('SUBMITTED', 'APPROVED', 'REJECTED')),
    reviewer_id TEXT,
    decision_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS expenses_updated_at_idx ON expenses(updated_at DESC, id ASC);
`;

function buildSeedShapedFile(path: string): void {
  const database = new DatabaseSync(path);

  // No PRAGMA user_version set at all -- a genuine pre-EXP-003 seed file
  // never wrote one, so it defaults to 0.
  database.exec(SEED_DDL);
  database
    .prepare(
      `INSERT INTO expenses (id, employee_id, description, amount_cents, currency, status, created_at, updated_at)
       VALUES ('legacy-1', 'legacy-employee', 'Pre-EXP-003 row', 5000, 'USD', 'SUBMITTED', 't0', 't0')`
    )
    .run();
  database.close();
}

describe("schema migration (P7.7, S6, S12.1)", () => {
  it("migrates a seed-shaped file to v2, preserving the row under legacy:seed, invisible via tenant-scoped queries", () => {
    const path = tempDbPath();

    buildSeedShapedFile(path);

    const database = openDatabase(path);

    const version = database.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    expect(version.user_version).toBe(SCHEMA_VERSION);

    const row = database
      .prepare("SELECT * FROM expenses WHERE id = 'legacy-1'")
      .get() as Record<string, unknown>;

    expect(row.tenant_id).toBe(QUARANTINE_TENANT_ID);
    expect(row.deleted_at).toBeNull();
    expect(row.deleted_by).toBeNull();
    expect(row.description).toBe("Pre-EXP-003 row");

    // Invisible via any real tenant's tenant-scoped query.
    const visibleToRealTenant = database
      .prepare("SELECT * FROM expenses WHERE tenant_id = 'tenant-a' AND id = 'legacy-1'")
      .get();
    expect(visibleToRealTenant).toBeUndefined();

    database.close();
  });

  it("reopening an already-migrated file is a no-op (idempotent)", () => {
    const path = tempDbPath();

    buildSeedShapedFile(path);
    const first = openDatabase(path);
    const countBefore = (
      first.prepare("SELECT count(*) AS n FROM expenses").get() as { n: number }
    ).n;
    first.close();

    const second = openDatabase(path);
    const version = second.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    const countAfter = (
      second.prepare("SELECT count(*) AS n FROM expenses").get() as { n: number }
    ).n;

    expect(version.user_version).toBe(SCHEMA_VERSION);
    expect(countAfter).toBe(countBefore);

    second.close();
  });

  it("refuses to open a newer-than-supported schema version, leaving the version unchanged and the handle closed", () => {
    const path = tempDbPath();

    buildSeedShapedFile(path);
    const prep = openDatabase(path);
    prep.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    prep.close();

    expect(() => openDatabase(path)).toThrow("Unsupported database schema version");

    // The version on disk is unchanged by the failed open.
    const checker = new DatabaseSync(path);
    const version = checker.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    expect(version.user_version).toBe(SCHEMA_VERSION + 1);

    // The failed openDatabase() call closed its own handle rather than
    // leaking it: this fresh connection to the same file does not hit a
    // "database is locked" error, proving no lingering write lock.
    expect(() => checker.exec("BEGIN IMMEDIATE; ROLLBACK;")).not.toThrow();
    checker.close();
  });

  it("aborts a raw INSERT that omits tenant_id (DEFAULT resolves to legacy:seed)", () => {
    const path = tempDbPath();

    buildSeedShapedFile(path);
    const database = openDatabase(path);

    expect(() =>
      database
        .prepare(
          `INSERT INTO expenses (id, employee_id, description, amount_cents, currency, status, created_at, updated_at)
           VALUES ('new-1', 'employee-x', 'd', 100, 'USD', 'SUBMITTED', 't1', 't1')`
        )
        .run()
    ).toThrow();

    database.close();
  });

  it("aborts a raw INSERT that explicitly targets the quarantine tenant", () => {
    const path = tempDbPath();

    buildSeedShapedFile(path);
    const database = openDatabase(path);

    expect(() =>
      database
        .prepare(
          `INSERT INTO expenses (id, tenant_id, employee_id, description, amount_cents, currency, status, created_at, updated_at)
           VALUES ('new-2', ?, 'employee-x', 'd', 100, 'USD', 'SUBMITTED', 't1', 't1')`
        )
        .run(QUARANTINE_TENANT_ID)
    ).toThrow();

    database.close();
  });

  it("migrates a genuinely fresh (empty) database to v2 as well", () => {
    const path = tempDbPath();
    const database = openDatabase(path);

    const version = database.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    expect(version.user_version).toBe(SCHEMA_VERSION);

    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining(["expenses", "audit_events", "idempotency_records"])
    );

    database.close();
  });

  it("migrate() is directly callable and re-entrant on an already-current database", () => {
    const database = openDatabase(":memory:");

    expect(() => migrate(database)).not.toThrow();
    const version = database.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    expect(version.user_version).toBe(SCHEMA_VERSION);

    database.close();
  });
});
