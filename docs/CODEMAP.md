> Auto-generated structural map. Do not edit manually.
> The ignored local initialization helper is not committed. Regenerate with Rosetta's codemap workflow or a repository file inventory.
>
> Purpose: list of folders and files in the codebase. Content: workspace-relative path headers with recursive child counts and a short description, immediate child filenames only. Style: 3-4 levels deep, generated, no manual edits.

# . (79 files) — Expense approval API service

- .editorconfig
- .gitignore
- .nvmrc
- .prettierignore
- README.md
- gain.json
- package-lock.json
- package.json
- tsconfig.json
- tsconfig.test.json
- vitest.config.ts


## agents (3 files) — Rosetta workflow state and notes

- IMPLEMENTATION.md
- MEMORY.md
- init-workspace-flow-state.md


## docs (19 files) — Project documentation

- ARCHITECTURE.md
- ASSUMPTIONS.md
- BASELINE-API.md
- CODEMAP.md
- CONTEXT.md
- DEPENDENCIES.md
- EXP-003-COMPATIBILITY.md
- TECHSTACK.md
- TODO.md


### docs/PATTERNS (10 files) — Documentation files

- CHANGES.md
- INDEX.md
- deterministic-fastify-inject-test.md
- domain-entity-input-variants.md
- fastify-route-safeparse-validation.md
- find-or-404-route-guard.md
- sqlite-repository-method.md
- structured-error-response.md
- typed-row-field-extraction.md
- zod-strict-schema.md


## plans (23 files) — Documentation files


### plans/EXP-003 (23 files) — Documentation files

- COORDINATOR-CLOSEOUT.md
- EXP-003-REQUIREMENT-MAP.md
- phase12-review-findings.md
- phase8-docs-review-findings.md
- phase8-review-findings.md
- phase9-validation-findings.md
- EXP-003-PLAN.md
- EXP-003-SPECS.md
- HANDOFF.md
- REQUEST.md
- architecture-notes.md
- evaluator-plan-review.md
- phase5-rereview.md
- phase5-review-findings.md


#### plans/EXP-003/evidence (9 files) — Documentation files

- COORDINATOR-CHECK.txt
- EVALUATOR-SQLITE-PREFLIGHT.txt
- FINAL-WORKFLOW.md
- P0-sqlite-runtime.txt
- P6-baseline-before.txt
- P6-baseline-edits.md
- P7-before-review-185.txt
- P7-check.txt
- P9-ci-check.txt


## src (13 files) — Primary application source code

- actor.ts
- audit-repository.ts
- errors.ts
- expense-service.ts
- idempotency-repository.ts
- policy.ts
- transaction.ts
- app.ts
- database.ts
- domain.ts
- expense-repository.ts
- schemas.ts
- server.ts


## tests (10 files) — Vitest test suites

- access.test.ts
- audit.test.ts
- errors.test.ts
- fingerprint.test.ts
- lifecycle.test.ts
- migration.test.ts
- policy.test.ts
- sqlite-runtime.test.ts
- support.ts
- app.test.ts
