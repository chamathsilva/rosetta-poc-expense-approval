# Baseline API

## Create an expense

```http
POST /expenses
Content-Type: application/json

{
  "employeeId": "employee-1",
  "description": "Conference registration",
  "amountCents": 12500,
  "currency": "USD"
}
```

The service assigns an ID and returns `201` with status `SUBMITTED`.

## List expenses

```http
GET /expenses
```

Returns `{ "expenses": [...] }`, ordered by most recently updated and then ID.

## Read an expense

```http
GET /expenses/:expenseId
```

Returns `404` with code `EXPENSE_NOT_FOUND` when the ID does not exist.

## Decide an expense

```http
PATCH /expenses/:expenseId/decision
Content-Type: application/json

{
  "status": "APPROVED",
  "reviewerId": "reviewer-1",
  "note": "Within budget"
}
```

`status` must be `APPROVED` or `REJECTED`. A submission can be decided once; a later attempt returns `409` with code `EXPENSE_ALREADY_DECIDED`.

## Validation

- `employeeId`: non-empty string, at most 100 characters.
- `description`: non-empty string, at most 500 characters.
- `amountCents`: positive integer, at most 100,000,000.
- `currency`: exactly three uppercase ASCII letters.
- `reviewerId`: non-empty string, at most 100 characters.
- `note`: optional non-empty string, at most 500 characters.

Invalid input returns `400` with code `VALIDATION_ERROR`.
