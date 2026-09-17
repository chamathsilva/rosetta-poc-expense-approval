import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(databasePath: string): DatabaseSync {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
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

    CREATE INDEX IF NOT EXISTS expenses_tenant_id_idx
      ON expenses(tenant_id);
  `);

  return database;
}
