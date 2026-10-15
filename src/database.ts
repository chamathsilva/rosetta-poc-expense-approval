import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { withTransaction } from "./transaction.js";

export const QUARANTINE_TENANT_ID = "legacy:seed";
export const SCHEMA_VERSION = 2;

// Migration 0 -> 1: verbatim seed DDL (idempotent via IF NOT EXISTS so it is
// a no-op against an already-seeded file and a create against a fresh one).
const MIGRATION_0_TO_1 = `
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

  CREATE INDEX IF NOT EXISTS expenses_updated_at_idx
    ON expenses(updated_at DESC, id ASC);
`;

// Migration 1 -> 2: EXP-003 tenancy, tombstone/restore, audit and idempotency.
const MIGRATION_1_TO_2 = `
  ALTER TABLE expenses ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'legacy:seed';
  ALTER TABLE expenses ADD COLUMN deleted_at TEXT;
  ALTER TABLE expenses ADD COLUMN deleted_by TEXT;
  CREATE INDEX expenses_tenant_updated_idx ON expenses(tenant_id, updated_at DESC, id ASC);
  CREATE INDEX expenses_tenant_employee_idx ON expenses(tenant_id, employee_id);
  CREATE TRIGGER expenses_no_quarantine_insert BEFORE INSERT ON expenses
    WHEN NEW.tenant_id = 'legacy:seed'
    BEGIN SELECT RAISE(ABORT, 'quarantine tenant is not insertable'); END;

  CREATE TABLE audit_events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    actor_user_id TEXT NOT NULL,
    actor_role TEXT NOT NULL CHECK (actor_role IN ('employee','manager','finance')),
    event_type TEXT NOT NULL CHECK (event_type IN ('EXPENSE_SUBMITTED','EXPENSE_APPROVED','EXPENSE_REJECTED','EXPENSE_DELETED','EXPENSE_RESTORED')),
    occurred_at TEXT NOT NULL,
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
  );
  CREATE INDEX audit_events_expense_idx ON audit_events(tenant_id, expense_id, seq);
  CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events
    BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
  CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events
    BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
  CREATE TRIGGER audit_events_tenant_match BEFORE INSERT ON audit_events
    WHEN NEW.tenant_id IS NOT (SELECT tenant_id FROM expenses WHERE id = NEW.expense_id)
    BEGIN SELECT RAISE(ABORT, 'audit tenant mismatch'); END;

  CREATE TABLE idempotency_records (
    tenant_id TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64),
    response_status INTEGER NOT NULL CHECK (response_status BETWEEN 200 AND 299),
    response_body TEXT NOT NULL CHECK (json_valid(response_body)),
    created_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, actor_user_id, idempotency_key)
  ) WITHOUT ROWID;
`;

export const MIGRATIONS: readonly string[] = [
  MIGRATION_0_TO_1,
  MIGRATION_1_TO_2
];

function readUserVersion(database: DatabaseSync): number {
  const row = database.prepare("PRAGMA user_version").get() as
    | { user_version: unknown }
    | undefined;
  const value = row?.user_version;

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("Invalid PRAGMA user_version value");
  }

  return value;
}

export function migrate(database: DatabaseSync): void {
  const current = readUserVersion(database);

  if (current > SCHEMA_VERSION) {
    throw new Error("Unsupported database schema version");
  }

  for (let v = current; v < SCHEMA_VERSION; v += 1) {
    const step = MIGRATIONS[v];

    if (step === undefined) {
      throw new Error(`Missing migration step ${v}`);
    }

    withTransaction(database, () => {
      const inTx = readUserVersion(database);

      if (inTx > v) {
        return;
      }

      if (inTx < v) {
        throw new Error("Schema version regressed during migration");
      }

      database.exec(step);
      database.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

export function openDatabase(databasePath: string): DatabaseSync {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);

  try {
    database.exec("PRAGMA foreign_keys = ON");
    migrate(database);
  } catch (error) {
    database.close();
    throw error;
  }

  return database;
}
