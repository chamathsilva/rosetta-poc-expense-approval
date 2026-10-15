import { describe, expect, it } from "vitest";

import type { Actor, Expense } from "../src/domain.js";
import {
  MANAGER_APPROVAL_LIMIT_CENTS,
  authorizeCreate,
  authorizeDecision,
  authorizeOwnerMutation,
  authorizeRole,
  canViewExpense,
  decisionStateCheck,
  deleteStateCheck,
  isRestoreWindowOpen,
  listScope,
  restoreStateCheck
} from "../src/policy.js";

const T0 = "2026-09-15T12:00:00.000Z";

function actor(role: Actor["role"], userId = "employee-1", tenantId = "tenant-a"): Actor {
  return { tenantId, userId, role };
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "expense-1",
    tenantId: "tenant-a",
    employeeId: "employee-1",
    description: "d",
    amountCents: 12_500,
    currency: "USD",
    status: "SUBMITTED",
    reviewerId: null,
    decisionNote: null,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides
  };
}

describe("policy.ts (pure, unit, S5.3)", () => {
  describe("listScope", () => {
    it("employee is scoped to own rows", () => {
      expect(listScope(actor("employee", "employee-1"))).toEqual({
        tenantId: "tenant-a",
        employeeId: "employee-1"
      });
    });

    it("manager sees the whole tenant", () => {
      expect(listScope(actor("manager", "manager-1"))).toEqual({
        tenantId: "tenant-a",
        employeeId: null
      });
    });

    it("finance sees the whole tenant", () => {
      expect(listScope(actor("finance", "finance-1"))).toEqual({
        tenantId: "tenant-a",
        employeeId: null
      });
    });
  });

  describe("canViewExpense", () => {
    it("denies a different tenant", () => {
      expect(
        canViewExpense(actor("manager", "manager-1", "tenant-b"), expense())
      ).toBe(false);
    });

    it("denies a tombstoned expense", () => {
      expect(
        canViewExpense(actor("manager", "manager-1"), expense({ deletedAt: T0 }))
      ).toBe(false);
    });

    it("employee sees own expense", () => {
      expect(canViewExpense(actor("employee", "employee-1"), expense())).toBe(
        true
      );
    });

    it("employee cannot see a same-tenant non-owned expense", () => {
      expect(canViewExpense(actor("employee", "employee-2"), expense())).toBe(
        false
      );
    });

    it("manager/finance see any same-tenant, non-deleted expense", () => {
      expect(canViewExpense(actor("manager", "manager-1"), expense())).toBe(true);
      expect(canViewExpense(actor("finance", "finance-1"), expense())).toBe(true);
    });
  });

  describe("authorizeRole (role capability matrix)", () => {
    const commands = ["create", "delete", "restore"] as const;

    for (const command of commands) {
      it(`${command}: employee allowed, manager/finance denied FORBIDDEN_ROLE`, () => {
        expect(authorizeRole(actor("employee"), command)).toEqual({ allowed: true });
        expect(authorizeRole(actor("manager"), command)).toEqual({
          allowed: false,
          code: "FORBIDDEN_ROLE"
        });
        expect(authorizeRole(actor("finance"), command)).toEqual({
          allowed: false,
          code: "FORBIDDEN_ROLE"
        });
      });
    }

    it("decide: manager/finance allowed, employee denied FORBIDDEN_ROLE", () => {
      expect(authorizeRole(actor("manager"), "decide")).toEqual({ allowed: true });
      expect(authorizeRole(actor("finance"), "decide")).toEqual({ allowed: true });
      expect(authorizeRole(actor("employee"), "decide")).toEqual({
        allowed: false,
        code: "FORBIDDEN_ROLE"
      });
    });
  });

  describe("authorizeCreate", () => {
    it("allows an omitted employeeId", () => {
      expect(authorizeCreate(actor("employee", "employee-1"), undefined)).toEqual({
        allowed: true
      });
    });

    it("allows employeeId matching the actor", () => {
      expect(
        authorizeCreate(actor("employee", "employee-1"), "employee-1")
      ).toEqual({ allowed: true });
    });

    it("denies a mismatched employeeId with ACTOR_MISMATCH", () => {
      expect(
        authorizeCreate(actor("employee", "employee-1"), "employee-2")
      ).toEqual({ allowed: false, code: "ACTOR_MISMATCH" });
    });
  });

  describe("authorizeDecision", () => {
    it("denies a mismatched reviewerId with ACTOR_MISMATCH", () => {
      expect(
        authorizeDecision(
          actor("manager", "manager-1"),
          expense({ employeeId: "employee-1" }),
          { status: "APPROVED", reviewerId: "someone-else" }
        )
      ).toEqual({ allowed: false, code: "ACTOR_MISMATCH" });
    });

    it("allows an omitted reviewerId (derived from actor)", () => {
      expect(
        authorizeDecision(
          actor("manager", "manager-1"),
          expense({ employeeId: "employee-1" }),
          { status: "APPROVED" }
        )
      ).toEqual({ allowed: true });
    });

    it("denies self-approval with SELF_DECISION_FORBIDDEN", () => {
      expect(
        authorizeDecision(
          actor("manager", "alex"),
          expense({ employeeId: "alex" }),
          { status: "APPROVED", reviewerId: "alex" }
        )
      ).toEqual({ allowed: false, code: "SELF_DECISION_FORBIDDEN" });
    });

    it("denies self-rejection with SELF_DECISION_FORBIDDEN", () => {
      expect(
        authorizeDecision(
          actor("manager", "alex"),
          expense({ employeeId: "alex" }),
          { status: "REJECTED", reviewerId: "alex" }
        )
      ).toEqual({ allowed: false, code: "SELF_DECISION_FORBIDDEN" });
    });

    it(`manager approve at exactly the limit (${MANAGER_APPROVAL_LIMIT_CENTS}) is allowed`, () => {
      expect(
        authorizeDecision(
          actor("manager", "manager-1"),
          expense({ employeeId: "employee-1", amountCents: MANAGER_APPROVAL_LIMIT_CENTS }),
          { status: "APPROVED", reviewerId: "manager-1" }
        )
      ).toEqual({ allowed: true });
    });

    it(`manager approve one cent over the limit (${MANAGER_APPROVAL_LIMIT_CENTS + 1}) is denied APPROVAL_LIMIT_EXCEEDED`, () => {
      expect(
        authorizeDecision(
          actor("manager", "manager-1"),
          expense({
            employeeId: "employee-1",
            amountCents: MANAGER_APPROVAL_LIMIT_CENTS + 1
          }),
          { status: "APPROVED", reviewerId: "manager-1" }
        )
      ).toEqual({ allowed: false, code: "APPROVAL_LIMIT_EXCEEDED" });
    });

    it("manager reject is allowed at any amount (no limit on reject)", () => {
      expect(
        authorizeDecision(
          actor("manager", "manager-1"),
          expense({
            employeeId: "employee-1",
            amountCents: MANAGER_APPROVAL_LIMIT_CENTS + 1
          }),
          { status: "REJECTED", reviewerId: "manager-1" }
        )
      ).toEqual({ allowed: true });
    });

    it("finance approve is allowed over the manager limit (no limit for finance)", () => {
      expect(
        authorizeDecision(
          actor("finance", "finance-1"),
          expense({
            employeeId: "employee-1",
            amountCents: MANAGER_APPROVAL_LIMIT_CENTS + 1
          }),
          { status: "APPROVED", reviewerId: "finance-1" }
        )
      ).toEqual({ allowed: true });
    });
  });

  describe("authorizeOwnerMutation", () => {
    it("allows the owner", () => {
      expect(
        authorizeOwnerMutation(actor("employee", "employee-1"), expense({ employeeId: "employee-1" }))
      ).toEqual({ allowed: true });
    });

    it("denies a non-owner (same tenant) with NOT_EXPENSE_OWNER (reachable)", () => {
      expect(
        authorizeOwnerMutation(actor("employee", "employee-2"), expense({ employeeId: "employee-1" }))
      ).toEqual({ allowed: false, code: "NOT_EXPENSE_OWNER" });
    });
  });

  describe("decisionStateCheck", () => {
    it("allows a SUBMITTED expense", () => {
      expect(decisionStateCheck(expense({ status: "SUBMITTED" }))).toEqual({
        allowed: true
      });
    });

    it("denies an already-decided expense with EXPENSE_ALREADY_DECIDED", () => {
      expect(decisionStateCheck(expense({ status: "APPROVED" }))).toEqual({
        allowed: false,
        code: "EXPENSE_ALREADY_DECIDED"
      });
    });
  });

  describe("deleteStateCheck", () => {
    it("allows a SUBMITTED, non-deleted expense", () => {
      expect(deleteStateCheck(expense())).toEqual({ allowed: true });
    });

    it("denies a decided expense with EXPENSE_RETENTION_LOCKED (checked before deletedAt)", () => {
      expect(deleteStateCheck(expense({ status: "APPROVED" }))).toEqual({
        allowed: false,
        code: "EXPENSE_RETENTION_LOCKED"
      });
    });

    it("denies an already-deleted SUBMITTED expense with EXPENSE_ALREADY_DELETED", () => {
      expect(deleteStateCheck(expense({ deletedAt: T0 }))).toEqual({
        allowed: false,
        code: "EXPENSE_ALREADY_DELETED"
      });
    });
  });

  describe("restoreStateCheck", () => {
    it("denies a non-deleted expense with EXPENSE_NOT_DELETED", () => {
      expect(restoreStateCheck(expense({ deletedAt: null }), T0)).toEqual({
        allowed: false,
        code: "EXPENSE_NOT_DELETED"
      });
    });

    it("denies a non-SUBMITTED tombstoned row with the stable EXPENSE_NOT_DELETED denial (not a throw)", () => {
      // Synthetic row: tombstoned but status !== SUBMITTED cannot occur via
      // the app's own invariants (tombstone() requires SUBMITTED), but
      // restoreStateCheck must independently guard this precondition.
      const synthetic = expense({ status: "APPROVED", deletedAt: T0 });

      expect(() => restoreStateCheck(synthetic, T0)).not.toThrow();
      expect(restoreStateCheck(synthetic, T0)).toEqual({
        allowed: false,
        code: "EXPENSE_NOT_DELETED"
      });
    });

    it("allows a tombstoned SUBMITTED row within the window", () => {
      expect(restoreStateCheck(expense({ deletedAt: T0 }), T0)).toEqual({
        allowed: true
      });
    });

    it("denies a tombstoned SUBMITTED row outside the window with RESTORE_WINDOW_EXPIRED", () => {
      const thirtyDaysLater = new Date(Date.parse(T0) + 2_592_000_000).toISOString();

      expect(restoreStateCheck(expense({ deletedAt: T0 }), thirtyDaysLater)).toEqual({
        allowed: false,
        code: "RESTORE_WINDOW_EXPIRED"
      });
    });
  });

  describe("isRestoreWindowOpen (restore window boundaries)", () => {
    it("throws on an unparsable clock input (NaN elapsed)", () => {
      expect(() => isRestoreWindowOpen(T0, "not-a-date")).toThrow(
        "invalid clock input"
      );
      expect(() => isRestoreWindowOpen("not-a-date", T0)).toThrow(
        "invalid clock input"
      );
    });

    it("throws when now precedes deletedAt by 1ms (negative elapsed)", () => {
      const oneMsBefore = new Date(Date.parse(T0) - 1).toISOString();

      expect(() => isRestoreWindowOpen(T0, oneMsBefore)).toThrow(
        "invalid clock: now precedes deletedAt"
      );
    });

    it("is open at elapsed = 0", () => {
      expect(isRestoreWindowOpen(T0, T0)).toBe(true);
    });

    it("is open at elapsed = 30d - 1ms", () => {
      const almostThirtyDays = new Date(
        Date.parse(T0) + 2_592_000_000 - 1
      ).toISOString();

      expect(isRestoreWindowOpen(T0, almostThirtyDays)).toBe(true);
    });

    it("is closed at exactly elapsed = 30d (half-open upper bound)", () => {
      const exactlyThirtyDays = new Date(
        Date.parse(T0) + 2_592_000_000
      ).toISOString();

      expect(isRestoreWindowOpen(T0, exactlyThirtyDays)).toBe(false);
    });

    it("is closed at elapsed = 30d + 1ms", () => {
      const overThirtyDays = new Date(
        Date.parse(T0) + 2_592_000_000 + 1
      ).toISOString();

      expect(isRestoreWindowOpen(T0, overThirtyDays)).toBe(false);
    });
  });
});
