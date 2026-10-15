# Rosetta Implementation Summary

This file is a brief and durable summary of the current implementation state.
It is intentionally concise and should not be used as a chronological work log.

For detailed change history, use git history and PRs instead of expanding this file.

Purpose: concise durable implementation summary; baseline first, then one `###` entry per major workstream, not a chronological change log.
Style: terse bullets with keywords and references; DRY, link to `docs/CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/BASELINE-API.md` instead of restating them.

## Baseline State

- Neutral expense-approval seed (commit `34f08e4`, 2026-09-15; confirmed on remote at tag `expense-seed-v1`); `src/` now diverges from the seed per the EXP-003 workstream below, the six seed cases have been migrated and the final suite contains187 passing cases across9 test files.
- Endpoints: health, create, list, read, decide (approve/reject once); contract in `docs/BASELINE-API.md`. EXP-003 adds delete/restore and tenant/role scoping; see `docs/EXP-003-COMPATIBILITY.md`.
- Fastify 5 + Zod 4 + `node:sqlite` persistence; structure in `docs/ARCHITECTURE.md`.
- **Test-count note (2026-10-14, Pass 2/Phase 13 final):** Phase 11 (PLAN P6/P7) wrote and ran the EXP-003 feature test suite (`tests/policy.test.ts`, `tests/access.test.ts`, `tests/audit.test.ts`, `tests/lifecycle.test.ts`, `tests/migration.test.ts`, `tests/errors.test.ts`, `tests/sqlite-runtime.test.ts`, `tests/fingerprint.test.ts`, `tests/support.ts`) plus the migrated `tests/app.test.ts`. Phase 12 (Review Tests) found one Major gap (missing 401-precedence tests for oversize/unsupported-media-type bodies, PLAN P7.8) and it was fixed, raising the suite from 185 to 187 tests. Phase 13 final validation re-ran `npm ci && npm run check` under the pin (Node v24.21.0/npm 11.6.2): **187/187 tests passing** across 9 test files, clean typecheck, clean build. Evidence: `plans/EXP-003/evidence/P9-ci-check.txt`. Full requirement-to-test traceability: `plans/EXP-003/EXP-003-REQUIREMENT-MAP.md`.

## Major Implemented Workstreams

### EXP-003 tenancy, RBAC, audit, idempotency, lifecycle (Phase 7 implementation; P8 Pass 1 docs): 2026-10-14

- Modules added under `src/`: `actor.ts` (header auth simulation + `onRequest` hook), `policy.ts` (pure decision/authorization rules), `transaction.ts` (`withTransaction`, synchronous unit of work), `expense-service.ts` (`ExpenseService`: create/decide/delete/restore/list/get, one transaction per mutation), `audit-repository.ts` (append-only), `idempotency-repository.ts` (find/save + fingerprinting), `errors.ts` (catalog + body-parser mapping, moved out of `app.ts`).
- Modules changed: `domain.ts` (actor/role/tombstone/audit/idempotency types), `schemas.ts` (optional identity fields, idempotency key schema), `expense-repository.ts` (every method tenant-scoped; `findById`/`list` removed), `database.ts` (`PRAGMA user_version` migrations), `app.ts` (actor hook wiring, thin routes, new DELETE/restore routes, body-parser error mapping).
- Schema v2 (`src/database.ts`): migration 0→1 is the verbatim seed DDL; migration 1→2 adds `tenant_id`/`deleted_at`/`deleted_by` to `expenses` plus new `audit_events` and `idempotency_records` tables, with append-only/tenant-match triggers and a quarantine-insert guard.
- 8 deliberate baseline breaks (actor headers required, idempotency key required, optional identity fields derived from actor, `tenantId`/`deletedAt` added to responses, tenant/role-scoped reads with tombstone hiding, new DELETE/restore routes, in-place schema migration with legacy quarantine, native 400/413/415 for body-parser errors instead of a flattened 500) — full list and file:line verification: `docs/EXP-003-COMPATIBILITY.md`.
- Independent Phase 8 code review (`plans/EXP-003/phase8-review-findings.md`): approve-with-minor-fixes, zero critical/major findings. Independent Phase 9 runtime validation (`plans/EXP-003/phase9-validation-findings.md`): ad hoc manual `inject()` assertions across 5 throwaway scripts, 78/78 passing (reconciled 2026-10-14 by re-running all 5 scripts and summing their own printed totals — the subagent's report had mis-summed its own numbers as "65/65") — tenant isolation, role/decision policy, audit atomicity incl. live fault injection, idempotency, tombstone/restore lifecycle incl. a real injected-clock boundary test, error handling, migration/compatibility. This is a manual Phase 9 validation count, a different and already-completed phase from the Phase 11 automated Vitest suite the test-count note above refers to; neither Phase 8 nor Phase 9 touched or ran `tests/`.
- Evidence path (committed): `plans/EXP-003/evidence/` (`P0-sqlite-runtime.txt`, `P6-baseline-before.txt`, `P6-baseline-edits.md`, `P7-check.txt`, `P9-ci-check.txt`).
- Phase 11 (Tests): `tests/app.test.ts` baseline migration (6 cases) plus 9 new test files written and run. Phase 12 (Review Tests): approve-with-minor-fixes, 1 Major (missing 401-precedence tests) fixed, 3 Minor accepted as-is; see `plans/EXP-003/HANDOFF.md` Phase 12 row. Phase 13 (Final Validation): clean-install gate green (187/187) and requirement map written — `plans/EXP-003/EXP-003-REQUIREMENT-MAP.md`. Workstream complete.
- Full design/spec/plan record: `plans/EXP-003/architecture-notes.md`, `plans/EXP-003/EXP-003-SPECS.md`, `plans/EXP-003/EXP-003-PLAN.md`.

### Rosetta workspace initialization: completed, 2026-10-13

- Added `gain.json`, `docs/TECHSTACK.md`, `docs/CODEMAP.md`, `docs/DEPENDENCIES.md`, `docs/PATTERNS/` (8 patterns + INDEX + CHANGES).
- Added `docs/CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/ASSUMPTIONS.md`, `docs/TODO.md`, `agents/IMPLEMENTATION.md`, `agents/MEMORY.md`.
- Updated `.gitignore` (Rosetta entries), added `.prettierignore`. No source or test changes.
- Code navigation: default `docs/CODEMAP.md` only (no code-graph backend).
- Phase 8 HITL resolved assumptions A6, A7, A8, A9, A10, A14; A1-A5, A11-A13 deferred to a future requirements session.
- Phase 9 found two documentation gaps, subsequently corrected, and one unverified coding-reference checkpoint. The latter remains a conformance deviation, not a verified pass; see `agents/init-workspace-flow-state.md`.

### Evaluator setup reconciliation: 2026-10-13

- Initial and actor-final generated artifacts were preserved privately before corrections. Evaluator qualified pattern universals, persistence-test scope, static health, test categories and local helper portability against seed source/tests.
- Initialization question selections were evaluator responses, not direct new human product decisions. No source/test/dependency/seed-contract changes; independent pinned baseline gate passed six tests/typecheck/build.
- Historical setup instruction: implementation had not started at that checkpoint. EXP-003 was subsequently executed in its separate feature task, summarized above.
