import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { FastifyInstance } from "fastify";
import { afterEach } from "vitest";

import { buildApp, type BuildAppOptions } from "../src/app.js";
import type { Role } from "../src/domain.js";

/** Mutable ISO-UTC clock for injected-time tests (NFR-1 determinism). */
export interface MutableClock {
  now: () => string;
  set: (iso: string) => void;
  advanceMs: (ms: number) => void;
}

export function createMutableClock(initial: string): MutableClock {
  let current = initial;

  return {
    now: () => current,
    set: (iso: string) => {
      current = iso;
    },
    advanceMs: (ms: number) => {
      current = new Date(Date.parse(current) + ms).toISOString();
    }
  };
}

/**
 * Default test clock: starts at T0 and auto-advances by one second on every
 * `now()` read, matching the pre-EXP-003 seed test fixture's behavior
 * (`now: () => ...${String(nextSecond++)}...`). Use for ordinary mutation
 * sequencing where distinct timestamps are expected; use `createMutableClock`
 * plus explicit `.set`/`.advanceMs` for restore-window boundary tests.
 */
export function createAutoAdvancingClock(initial = T0): MutableClock {
  let current = initial;
  let frozen: string | undefined;

  return {
    now: () => {
      if (frozen !== undefined) {
        return frozen;
      }

      const value = current;

      current = new Date(Date.parse(current) + 1000).toISOString();
      return value;
    },
    set: (iso: string) => {
      current = iso;
      frozen = iso;
    },
    advanceMs: (ms: number) => {
      const base = frozen ?? current;

      frozen = new Date(Date.parse(base) + ms).toISOString();
      current = frozen;
    }
  };
}

/** Deterministic incrementing id factory, e.g. "expense-1", "expense-2". */
export function createIdFactory(prefix = "expense"): () => string {
  let next = 1;

  return () => `${prefix}-${next++}`;
}

/** Deterministic incrementing idempotency-key generator. */
export function createKeyGenerator(prefix = "key"): () => string {
  let next = 1;

  return () => `${prefix}-${next++}`;
}

export interface TestAppOptions {
  databasePath?: string;
  clock?: MutableClock;
  idFactory?: () => string;
}

export interface TestRegistry {
  createTestApp: (options?: TestAppOptions) => {
    app: FastifyInstance;
    clock: MutableClock;
  };
  createTempDatabasePath: () => string;
  openReader: (databasePath: string) => DatabaseSync;
  nextKey: () => string;
}

/**
 * Per-test-file registry of apps/temp dirs/reader connections, drained by one
 * shared `afterEach`. Call once per test file (module-level), per
 * docs/PATTERNS/deterministic-fastify-inject-test.md.
 */
export function createTestRegistry(): TestRegistry {
  const openApps: FastifyInstance[] = [];
  const temporaryDirectories: string[] = [];
  const readers: DatabaseSync[] = [];
  const nextKey = createKeyGenerator();

  function createTestApp(
    options: TestAppOptions = {}
  ): { app: FastifyInstance; clock: MutableClock } {
    const clock = options.clock ?? createAutoAdvancingClock();
    const idFactory = options.idFactory ?? createIdFactory();

    const buildOptions: BuildAppOptions = {
      databasePath: options.databasePath ?? ":memory:",
      idFactory,
      now: clock.now
    };

    const app = buildApp(buildOptions);

    openApps.push(app);
    return { app, clock };
  }

  function createTempDatabasePath(): string {
    const directory = mkdtempSync(join(tmpdir(), "exp-003-"));

    temporaryDirectories.push(directory);
    return join(directory, "expenses.sqlite");
  }

  function openReader(databasePath: string): DatabaseSync {
    const database = new DatabaseSync(databasePath);

    readers.push(database);
    return database;
  }

  afterEach(async () => {
    for (const reader of readers.splice(0)) {
      try {
        reader.close();
      } catch {
        // already closed by the test; ignore.
      }
    }

    await Promise.all(openApps.splice(0).map((app) => app.close()));
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true }))
    );
  });

  return { createTestApp, createTempDatabasePath, openReader, nextKey };
}

/** Builds the three actor headers (plus any raw header overrides/extras). */
export function actorHeaders(
  actor: { tenantId: string; userId: string; role: Role },
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    "x-tenant-id": actor.tenantId,
    "x-user-id": actor.userId,
    "x-role": actor.role,
    ...extra
  };
}

export const T0 = "2026-09-15T12:00:00.000Z";
