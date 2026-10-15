import type { DatabaseSync } from "node:sqlite";

export class TransactionNestingError extends Error {}

export type NotPromise<T> = T extends PromiseLike<unknown> ? never : T;

function isThenable(value: unknown): value is PromiseLike<unknown> {
  if (value === null) {
    return false;
  }

  if (typeof value !== "object" && typeof value !== "function") {
    return false;
  }

  return typeof (value as { then?: unknown }).then === "function";
}

function rollbackSwallowingFailure(database: DatabaseSync): void {
  try {
    database.exec("ROLLBACK");
  } catch {
    // A rollback failure here must not mask the error that triggered it.
  }
}

export function withTransaction<T>(
  database: DatabaseSync,
  work: () => NotPromise<T>
): T {
  if (database.isTransaction) {
    throw new TransactionNestingError(
      "withTransaction does not support nested transactions"
    );
  }

  database.exec("BEGIN IMMEDIATE");

  let result: NotPromise<T>;

  try {
    result = work();
  } catch (error) {
    if (database.isTransaction) {
      rollbackSwallowingFailure(database);
    }

    throw error;
  }

  if (isThenable(result)) {
    if (database.isTransaction) {
      rollbackSwallowingFailure(database);
    }

    throw new TypeError("withTransaction work must be synchronous");
  }

  try {
    database.exec("COMMIT");
  } catch (error) {
    if (database.isTransaction) {
      rollbackSwallowingFailure(database);
    }

    throw error;
  }

  return result;
}
