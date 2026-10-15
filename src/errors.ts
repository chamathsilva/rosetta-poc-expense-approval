import type { ZodError } from "zod";

export interface ServiceResult {
  statusCode: number;
  body: object;
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_KEY_INVALID"
  | "UNAUTHENTICATED"
  | "FORBIDDEN_ROLE"
  | "ACTOR_MISMATCH"
  | "SELF_DECISION_FORBIDDEN"
  | "APPROVAL_LIMIT_EXCEEDED"
  | "NOT_EXPENSE_OWNER"
  | "EXPENSE_NOT_FOUND"
  | "ROUTE_NOT_FOUND"
  | "IDEMPOTENCY_KEY_CONFLICT"
  | "EXPENSE_ALREADY_DECIDED"
  | "EXPENSE_DECISION_CONFLICT"
  | "EXPENSE_RETENTION_LOCKED"
  | "EXPENSE_ALREADY_DELETED"
  | "EXPENSE_NOT_DELETED"
  | "RESTORE_WINDOW_EXPIRED"
  | "INTERNAL_ERROR";

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
}

export const BODY_PARSE_ERROR_MESSAGE = "Request body could not be parsed";

export const ERROR_CATALOG: {
  readonly [C in ErrorCode]: { status: number; message: string };
} = {
  VALIDATION_ERROR: { status: 400, message: "Request validation failed" },
  PAYLOAD_TOO_LARGE: { status: 413, message: "Request body is too large" },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 415,
    message: "Unsupported request content type"
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    status: 400,
    message: "Idempotency-Key header is required"
  },
  IDEMPOTENCY_KEY_INVALID: {
    status: 400,
    message: "Idempotency-Key header is invalid"
  },
  UNAUTHENTICATED: { status: 401, message: "Valid actor headers are required" },
  FORBIDDEN_ROLE: {
    status: 403,
    message: "Role is not permitted to perform this action"
  },
  ACTOR_MISMATCH: {
    status: 403,
    message: "Request identity does not match the actor"
  },
  SELF_DECISION_FORBIDDEN: {
    status: 403,
    message: "Actors cannot decide their own expense"
  },
  APPROVAL_LIMIT_EXCEEDED: {
    status: 403,
    message: "Approval exceeds the manager approval limit"
  },
  NOT_EXPENSE_OWNER: {
    status: 403,
    message: "Only the expense owner may perform this action"
  },
  EXPENSE_NOT_FOUND: { status: 404, message: "Expense not found" },
  ROUTE_NOT_FOUND: { status: 404, message: "Route not found" },
  IDEMPOTENCY_KEY_CONFLICT: {
    status: 409,
    message: "Idempotency-Key was already used for a different request"
  },
  EXPENSE_ALREADY_DECIDED: {
    status: 409,
    message: "Expense is already decided"
  },
  EXPENSE_DECISION_CONFLICT: {
    status: 409,
    message: "Expense decision conflicted"
  },
  EXPENSE_RETENTION_LOCKED: {
    status: 409,
    message: "Decided expenses cannot be deleted"
  },
  EXPENSE_ALREADY_DELETED: {
    status: 409,
    message: "Expense is already deleted"
  },
  EXPENSE_NOT_DELETED: { status: 409, message: "Expense is not deleted" },
  RESTORE_WINDOW_EXPIRED: {
    status: 409,
    message: "Restore window has expired"
  },
  INTERNAL_ERROR: { status: 500, message: "An unexpected error occurred" }
};

export function errorBody(code: ErrorCode): ErrorBody {
  return {
    error: {
      code,
      message: ERROR_CATALOG[code].message
    }
  };
}

export function errorResult(code: ErrorCode): ServiceResult {
  return {
    statusCode: ERROR_CATALOG[code].status,
    body: errorBody(code)
  };
}

export function validationError(error: ZodError): ErrorBody {
  return {
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    }
  };
}

const BODY_PARSE_400_CODES = new Set([
  "FST_ERR_CTP_INVALID_JSON_BODY",
  "FST_ERR_CTP_EMPTY_JSON_BODY",
  "FST_ERR_CTP_INVALID_CONTENT_LENGTH"
]);

export function bodyParserErrorResult(error: unknown): ServiceResult | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;

  if (typeof code !== "string") {
    return undefined;
  }

  if (BODY_PARSE_400_CODES.has(code)) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: BODY_PARSE_ERROR_MESSAGE
        }
      }
    };
  }

  if (code === "FST_ERR_CTP_BODY_TOO_LARGE") {
    return errorResult("PAYLOAD_TOO_LARGE");
  }

  if (code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
    return errorResult("UNSUPPORTED_MEDIA_TYPE");
  }

  return undefined;
}
