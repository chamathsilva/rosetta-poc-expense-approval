import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { IdempotencyRecord, Role } from "./domain.js";

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];

  if (typeof value !== "string") {
    throw new Error(`Invalid persisted idempotency record field: ${key}`);
  }

  return value;
}

function requiredNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];

  if (typeof value !== "number") {
    throw new Error(`Invalid persisted idempotency record field: ${key}`);
  }

  return value;
}

function mapIdempotencyRecord(row: Record<string, unknown>): IdempotencyRecord {
  return {
    tenantId: requiredString(row, "tenant_id"),
    actorUserId: requiredString(row, "actor_user_id"),
    idempotencyKey: requiredString(row, "idempotency_key"),
    requestFingerprint: requiredString(row, "request_fingerprint"),
    responseStatus: requiredNumber(row, "response_status"),
    responseBody: requiredString(row, "response_body"),
    createdAt: requiredString(row, "created_at")
  };
}

export class IdempotencyRepository {
  public constructor(private readonly database: DatabaseSync) {}

  public find(
    tenantId: string,
    actorUserId: string,
    idempotencyKey: string
  ): IdempotencyRecord | undefined {
    const row = this.database.prepare(`
      SELECT *
      FROM idempotency_records
      WHERE tenant_id = ? AND actor_user_id = ? AND idempotency_key = ?
    `).get(tenantId, actorUserId, idempotencyKey);

    return row === undefined ? undefined : mapIdempotencyRecord(row);
  }

  public save(record: IdempotencyRecord): void {
    this.database.prepare(`
      INSERT INTO idempotency_records (
        tenant_id,
        actor_user_id,
        idempotency_key,
        request_fingerprint,
        response_status,
        response_body,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.tenantId,
      record.actorUserId,
      record.idempotencyKey,
      record.requestFingerprint,
      record.responseStatus,
      record.responseBody,
      record.createdAt
    );
  }
}

export interface FingerprintInput {
  method: string;
  route: string;
  expenseId: string | null;
  role: Role;
  command: Record<string, string | number | null>;
}

export function canonicalJson(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonicalJson: number must be finite");
    }

    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    const parts = keys.map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`
    );

    return `{${parts.join(",")}}`;
  }

  throw new Error("canonicalJson: unsupported value type");
}

export function requestFingerprint(input: FingerprintInput): string {
  const canonicalInput = {
    v: 1,
    method: input.method,
    route: input.route,
    expenseId: input.expenseId,
    role: input.role,
    command: input.command
  };

  return createHash("sha256")
    .update(canonicalJson(canonicalInput), "utf8")
    .digest("hex");
}
