import type { DatabaseSync } from "node:sqlite";

import {
  AUDIT_EVENT_TYPES,
  ROLES,
  type AuditEvent,
  type AuditEventType,
  type AuditPayload,
  type NewAuditEvent,
  type Role
} from "./domain.js";

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];

  if (typeof value !== "string") {
    throw new Error(`Invalid persisted audit event field: ${key}`);
  }

  return value;
}

function requiredNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];

  if (typeof value !== "number") {
    throw new Error(`Invalid persisted audit event field: ${key}`);
  }

  return value;
}

function auditRole(value: string): Role {
  if (!ROLES.includes(value as Role)) {
    throw new Error("Invalid persisted audit event actor_role");
  }

  return value as Role;
}

function auditEventType(value: string): AuditEventType {
  if (!AUDIT_EVENT_TYPES.includes(value as AuditEventType)) {
    throw new Error("Invalid persisted audit event event_type");
  }

  return value as AuditEventType;
}

function auditPayload(value: string): AuditPayload {
  const parsed: unknown = JSON.parse(value);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid persisted audit event payload_json");
  }

  return parsed as AuditPayload;
}

function mapAuditEvent(row: Record<string, unknown>): AuditEvent {
  return {
    seq: requiredNumber(row, "seq"),
    tenantId: requiredString(row, "tenant_id"),
    expenseId: requiredString(row, "expense_id"),
    actorUserId: requiredString(row, "actor_user_id"),
    actorRole: auditRole(requiredString(row, "actor_role")),
    eventType: auditEventType(requiredString(row, "event_type")),
    occurredAt: requiredString(row, "occurred_at"),
    payload: auditPayload(requiredString(row, "payload_json"))
  };
}

export class AuditRepository {
  public constructor(private readonly database: DatabaseSync) {}

  public append(event: NewAuditEvent): void {
    this.database.prepare(`
      INSERT INTO audit_events (
        tenant_id,
        expense_id,
        actor_user_id,
        actor_role,
        event_type,
        occurred_at,
        payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.tenantId,
      event.expenseId,
      event.actorUserId,
      event.actorRole,
      event.eventType,
      event.occurredAt,
      JSON.stringify(event.payload)
    );
  }

  public listForExpense(tenantId: string, expenseId: string): AuditEvent[] {
    const rows = this.database.prepare(`
      SELECT *
      FROM audit_events
      WHERE tenant_id = ? AND expense_id = ?
      ORDER BY seq ASC
    `).all(tenantId, expenseId);

    return rows.map(mapAuditEvent);
  }
}
