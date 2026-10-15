# P6 Baseline Test Migration — Edit Log (EXP-003, Phase 11)

Source: `plans/EXP-003/EXP-003-PLAN.md` P6.2 table. Before-output (original, unmodified
`tests/app.test.ts` run under the pin): `plans/EXP-003/evidence/P6-baseline-before.txt`
(5 failed / 1 passed — all 5 failures are 401 `UNAUTHENTICATED`, since the seed test never sent
actor headers; this is the expected, documented consequence of break #1).

All 6 original test names are either kept verbatim or renamed per the PLAN table; no test was
deleted. `tests/support.ts` (P7.1) supplies `createTestRegistry`/`actorHeaders`, replacing the
seed's private `createTestApp`/`openApps`/`temporaryDirectories` module-level state.

## Per-test edit log

1. **`reports database readiness`** — unchanged. `/health` needs no actor headers (S5.2); only the
   `createTestApp` plumbing moved to `tests/support.ts`.

2. **`creates, reads, and lists an expense`** — added `actorHeaders(EMPLOYEE)` (tenant-a/employee-1/
   employee) to the create/read/list requests and an `idempotency-key` header to the create
   request (breaks #1, #2). Expected create body gained `tenantId: "tenant-a"` and
   `deletedAt: null` (break #4).

3. **`approves a submitted expense once`** — decision now sent as `reviewer-1`/manager with a key;
   the repeat decision sent as `reviewer-2`/finance with a *new* key. Both mutations needed
   `idempotency-key` headers (break #2) and actor headers. Expected outcome preserved: still
   409 `EXPENSE_ALREADY_DECIDED` on the repeat, `updatedAt` still `2026-09-15T12:00:01.000Z`
   (`decide` is called at test-clock tick 1, one tick after `create`'s tick 0).

4. **`rejects invalid expense input`** — added valid actor headers and an idempotency key so the
   request reaches T3 (schema validation) instead of failing earlier at T1; still 400
   `VALIDATION_ERROR`.

5. **`persists expenses across application instances`** — both app instances now use the same
   `actorHeaders(EMPLOYEE)` on their requests (break #1); otherwise unchanged (same temp-file
   database path reused across instances).

6. **`does not expose an expense deletion route in the starter`** — **renamed** to
   `lets the owner delete an expense and keeps unknown routes unrouted` per the PLAN table. The
   DELETE route now exists (break #6): owner `DELETE /expenses/:id` (with actor headers + key)
   returns 200 with `deletedAt` set. The second half keeps the original "unrouted" assertion
   shape by probing `PUT /expenses/expense-1` (still genuinely unrouted) with **no** headers —
   `registerActorHook` is a no-op for URLs that never match a route
   (`request.routeOptions.url === undefined`, SPECS S5.2), so this reaches
   `setNotFoundHandler` and returns 404 `ROUTE_NOT_FOUND` exactly as the seed's original
   DELETE-not-routed assertion did.

## P6.4 Break-to-evidence map (SPECS S7.4, breaks 1–8)

| # | Break | After-test (Phase 11) | Before-evidence (seed doc/test) |
|---|---|---|---|
| 1 | Actor headers required on `/expenses*` (401 otherwise) | `tests/app.test.ts` every case (headers added); `tests/access.test.ts` › authentication block (missing/bad header cases) | `plans/EXP-003/evidence/P6-baseline-before.txt` (all 5 originally-passing-without-headers cases now 401) |
| 2 | `Idempotency-Key` required on the 4 mutations | `tests/app.test.ts` create/decide/delete cases (key headers added); `tests/access.test.ts` bad-key cases | seed `tests/app.test.ts` (pre-migration) never sent this header; `docs/BASELINE-API.md` (seed API, no `Idempotency-Key` documented) |
| 3 | `employeeId`/`reviewerId` optional, derived from `x-user-id`; mismatch ⇒ 403 `ACTOR_MISMATCH` (incl. charset consequence, m10) | `tests/access.test.ts` › tenancy and decision policy (`ACTOR_MISMATCH` on create and decision, charset body-id cases) | `docs/BASELINE-API.md` (seed `employeeId`/`reviewerId` were required, unchecked against any identity) — no seed test exercised identity matching, so cited by doc only, not a seed test |
| 4 | Responses gain `tenantId` and `deletedAt` | `tests/app.test.ts` "creates, reads, and lists an expense" (expected body literal) | seed `tests/app.test.ts:64-76` (original expected body, preserved in `P6-baseline-before.txt`, has neither field) |
| 5 | List/read role- and tenant-scoped; tombstones hidden | `tests/access.test.ts` › tenancy block (scoped list/read, cross-tenant 404); `tests/lifecycle.test.ts` (tombstone hidden from GET/list) | `docs/ARCHITECTURE.md` (seed description: unscoped `findById`/`list`) — no seed test exercised multi-tenant scoping (single-tenant fixture), so cited by doc only |
| 6 | `DELETE /expenses/:expenseId` now exists (seed "no DELETE route" test replaced) | `tests/app.test.ts` "lets the owner delete an expense and keeps unknown routes unrouted" | seed `tests/app.test.ts:165-181` ("does not expose an expense deletion route in the starter", preserved in `P6-baseline-before.txt`) |
| 7 | In-place `user_version` migration; legacy rows quarantined | `tests/migration.test.ts` (all cases) | `docs/ARCHITECTURE.md:"No migration mechanism"` (pre-EXP-003 wording, to be replaced in P8.2 Pass 2) — no seed test exercised migration (seed had none), so cited by doc only |
| 8 | Body-parser errors keep native 4xx (400/413/415) instead of the seed's catch-all 500 | `tests/access.test.ts` › authentication and validation (malformed JSON ⇒ 400, oversize ⇒ 413, unsupported media type ⇒ 415); `tests/errors.test.ts` (`bodyParserErrorResult` unit coverage of every S5.7 row) | `docs/ARCHITECTURE.md:83` ("malformed JSON body ... 500") / `src/app.ts:160-164` pre-EXP-003 — no seed test exercised a malformed body, so cited by doc/code-line only |

Breaks 3, 5, 7, 8 (and the 413/415 behavior specifically) have no seed **test** to diff against —
the seed fixture was single-tenant, pre-migration, and never sent a malformed/oversize/wrong-type
body — so each cites the seed documentation or source line instead, per PLAN P6.4's instruction.
