import { describe, expect, it } from "vitest";

import {
  BODY_PARSE_ERROR_MESSAGE,
  ERROR_CATALOG,
  type ErrorCode,
  bodyParserErrorResult,
  errorBody,
  errorResult
} from "../src/errors.js";

const ALL_CODES: ErrorCode[] = Object.keys(ERROR_CATALOG) as ErrorCode[];

describe("ERROR_CATALOG (S8)", () => {
  it("has a non-empty message for every catalog entry", () => {
    for (const code of ALL_CODES) {
      expect(ERROR_CATALOG[code].message.length).toBeGreaterThan(0);
      expect(typeof ERROR_CATALOG[code].status).toBe("number");
    }
  });

  it("matches the exact S8 status for every code", () => {
    const expected: Record<ErrorCode, number> = {
      VALIDATION_ERROR: 400,
      PAYLOAD_TOO_LARGE: 413,
      UNSUPPORTED_MEDIA_TYPE: 415,
      IDEMPOTENCY_KEY_REQUIRED: 400,
      IDEMPOTENCY_KEY_INVALID: 400,
      UNAUTHENTICATED: 401,
      FORBIDDEN_ROLE: 403,
      ACTOR_MISMATCH: 403,
      SELF_DECISION_FORBIDDEN: 403,
      APPROVAL_LIMIT_EXCEEDED: 403,
      NOT_EXPENSE_OWNER: 403,
      EXPENSE_NOT_FOUND: 404,
      ROUTE_NOT_FOUND: 404,
      IDEMPOTENCY_KEY_CONFLICT: 409,
      EXPENSE_ALREADY_DECIDED: 409,
      EXPENSE_DECISION_CONFLICT: 409,
      EXPENSE_RETENTION_LOCKED: 409,
      EXPENSE_ALREADY_DELETED: 409,
      EXPENSE_NOT_DELETED: 409,
      RESTORE_WINDOW_EXPIRED: 409,
      INTERNAL_ERROR: 500
    };

    for (const code of ALL_CODES) {
      expect(ERROR_CATALOG[code].status).toBe(expected[code]);
    }
  });
});

describe("errorBody / errorResult", () => {
  it("errorBody never includes a details field", () => {
    for (const code of ALL_CODES) {
      expect(errorBody(code)).toEqual({
        error: { code, message: ERROR_CATALOG[code].message }
      });
      expect(Object.keys(errorBody(code).error)).not.toContain("details");
    }
  });

  it("errorResult pairs the catalog status with errorBody", () => {
    for (const code of ALL_CODES) {
      expect(errorResult(code)).toEqual({
        statusCode: ERROR_CATALOG[code].status,
        body: errorBody(code)
      });
    }
  });
});

describe("bodyParserErrorResult (S5.7 mapping table, unit-level)", () => {
  it("maps FST_ERR_CTP_INVALID_JSON_BODY to 400 VALIDATION_ERROR with the dedicated message", () => {
    const result = bodyParserErrorResult({ code: "FST_ERR_CTP_INVALID_JSON_BODY" });

    expect(result).toEqual({
      statusCode: 400,
      body: { error: { code: "VALIDATION_ERROR", message: BODY_PARSE_ERROR_MESSAGE } }
    });
  });

  it("maps FST_ERR_CTP_EMPTY_JSON_BODY to 400 VALIDATION_ERROR with the dedicated message", () => {
    const result = bodyParserErrorResult({ code: "FST_ERR_CTP_EMPTY_JSON_BODY" });

    expect(result).toEqual({
      statusCode: 400,
      body: { error: { code: "VALIDATION_ERROR", message: BODY_PARSE_ERROR_MESSAGE } }
    });
  });

  it("maps FST_ERR_CTP_INVALID_CONTENT_LENGTH to 400 VALIDATION_ERROR with the dedicated message", () => {
    // Hard to produce via a real inject() call; constructed directly per S12.1.
    const result = bodyParserErrorResult({
      code: "FST_ERR_CTP_INVALID_CONTENT_LENGTH"
    });

    expect(result).toEqual({
      statusCode: 400,
      body: { error: { code: "VALIDATION_ERROR", message: BODY_PARSE_ERROR_MESSAGE } }
    });
  });

  it("the 400 rows never use the generic VALIDATION_ERROR catalog message", () => {
    const result = bodyParserErrorResult({ code: "FST_ERR_CTP_EMPTY_JSON_BODY" });

    expect(result?.body).not.toEqual(expect.objectContaining({
      error: expect.objectContaining({ message: ERROR_CATALOG.VALIDATION_ERROR.message })
    }));
  });

  it("maps FST_ERR_CTP_BODY_TOO_LARGE to 413 PAYLOAD_TOO_LARGE", () => {
    const result = bodyParserErrorResult({ code: "FST_ERR_CTP_BODY_TOO_LARGE" });

    expect(result).toEqual(errorResult("PAYLOAD_TOO_LARGE"));
    expect(result?.statusCode).toBe(413);
  });

  it("maps FST_ERR_CTP_INVALID_MEDIA_TYPE to 415 UNSUPPORTED_MEDIA_TYPE", () => {
    const result = bodyParserErrorResult({ code: "FST_ERR_CTP_INVALID_MEDIA_TYPE" });

    expect(result).toEqual(errorResult("UNSUPPORTED_MEDIA_TYPE"));
    expect(result?.statusCode).toBe(415);
  });

  it("returns undefined for an unmapped Fastify code (caller falls through to 500)", () => {
    expect(bodyParserErrorResult({ code: "FST_ERR_SOMETHING_ELSE" })).toBeUndefined();
  });

  it("returns undefined for a payload-stream error carrying statusCode: 400 but no allow-listed code", () => {
    expect(
      bodyParserErrorResult({ code: "FST_ERR_SOME_OTHER", statusCode: 400 })
    ).toBeUndefined();
  });

  it("returns undefined for an object with no code property", () => {
    expect(bodyParserErrorResult({ message: "oops" })).toBeUndefined();
  });

  it("returns undefined for a non-string code", () => {
    expect(bodyParserErrorResult({ code: 123 })).toBeUndefined();
  });

  it("returns undefined for every non-object input", () => {
    expect(bodyParserErrorResult(null)).toBeUndefined();
    expect(bodyParserErrorResult(undefined)).toBeUndefined();
    expect(bodyParserErrorResult("a string error")).toBeUndefined();
    expect(bodyParserErrorResult(42)).toBeUndefined();
    expect(bodyParserErrorResult(true)).toBeUndefined();
  });

  it("matches by exact code, not by prefix/substring", () => {
    // A code that merely contains an allow-listed substring must not match.
    expect(
      bodyParserErrorResult({ code: "FST_ERR_CTP_INVALID_JSON_BODY_EXTRA" })
    ).toBeUndefined();
  });
});
