import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  requestFingerprint
} from "../src/idempotency-repository.js";

describe("canonicalJson (S10)", () => {
  it("serializes primitives via JSON.stringify", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(true)).toBe("true");
    expect(canonicalJson(false)).toBe("false");
    expect(canonicalJson("x")).toBe('"x"');
    expect(canonicalJson(42)).toBe("42");
  });

  it("throws on non-finite numbers", () => {
    expect(() => canonicalJson(Number.NaN)).toThrow();
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => canonicalJson(Number.NEGATIVE_INFINITY)).toThrow();
  });

  it("joins array elements with commas, recursing into each", () => {
    expect(canonicalJson([1, "a", null])).toBe('[1,"a",null]');
  });

  it("sorts object keys by default .sort() (UTF-16 code unit) order", () => {
    expect(canonicalJson({ b: 1, a: 2, Z: 3 })).toBe('{"Z":3,"a":2,"b":1}');
  });

  it("drops keys whose value is undefined", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("emits no whitespace", () => {
    expect(canonicalJson({ a: [1, 2], b: "x" })).toBe('{"a":[1,2],"b":"x"}');
  });

  it("throws on an unsupported value type", () => {
    expect(() => canonicalJson(Symbol("x"))).toThrow();
    expect(() => canonicalJson(() => undefined)).toThrow();
    expect(() => canonicalJson(undefined)).toThrow();
  });
});

describe("requestFingerprint (S10)", () => {
  const base = {
    method: "POST",
    route: "/expenses",
    expenseId: null,
    role: "employee" as const,
    command: {
      amountCents: 12_500,
      currency: "USD",
      description: "d",
      employeeId: "employee-1"
    }
  };

  it("is a 64-char lowercase hex SHA-256 digest", () => {
    const fp = requestFingerprint(base);

    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches a manually computed canonical SHA-256 digest", () => {
    const expected = createHash("sha256")
      .update(
        canonicalJson({
          v: 1,
          method: base.method,
          route: base.route,
          expenseId: base.expenseId,
          role: base.role,
          command: base.command
        }),
        "utf8"
      )
      .digest("hex");

    expect(requestFingerprint(base)).toBe(expected);
  });

  it("is stable for identical input", () => {
    expect(requestFingerprint(base)).toBe(requestFingerprint({ ...base }));
  });

  it("is sensitive to a changed command field (different amountCents)", () => {
    const changed = { ...base, command: { ...base.command, amountCents: 999 } };

    expect(requestFingerprint(changed)).not.toBe(requestFingerprint(base));
  });

  it("is sensitive to a changed route", () => {
    const changed = { ...base, route: "/expenses/:expenseId" };

    expect(requestFingerprint(changed)).not.toBe(requestFingerprint(base));
  });

  it("is sensitive to a changed expenseId", () => {
    const changed = { ...base, expenseId: "expense-1" };

    expect(requestFingerprint(changed)).not.toBe(requestFingerprint(base));
  });

  it("is sensitive to a changed role", () => {
    const changed = { ...base, role: "manager" as const };

    expect(requestFingerprint(changed)).not.toBe(requestFingerprint(base));
  });

  it("is insensitive to command key order (canonical ordering)", () => {
    const reordered = {
      ...base,
      command: {
        employeeId: "employee-1",
        currency: "USD",
        description: "d",
        amountCents: 12_500
      }
    };

    expect(requestFingerprint(reordered)).toBe(requestFingerprint(base));
  });
});
