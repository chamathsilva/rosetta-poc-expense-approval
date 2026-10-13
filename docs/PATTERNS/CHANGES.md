# Patterns Changelog

## [2026-10-12] Initial creation of docs/PATTERNS/ (plugin mode, no prior PATTERNS to upgrade)
- Scoped extraction to CODEMAP's `src` (6 files) and `tests` (1 file) modules; `agents`, `docs`, and root config files contain no recurring code structures to extract.
- Read all 6 src files and the 1 test file directly (small enough to review in full rather than sampling).
- Created 8 pattern files, each found in 2+ distinct call sites or exercised 2+ times within the same file:
  - zod-strict-schema.md
  - fastify-route-safeparse-validation.md
  - structured-error-response.md
  - find-or-404-route-guard.md
  - sqlite-repository-method.md
  - typed-row-field-extraction.md
  - domain-entity-input-variants.md
  - deterministic-fastify-inject-test.md
- Created INDEX.md referencing all 8 pattern files.
- No existing human-curated pattern content to preserve.

## [2026-10-13] Evaluator source-accuracy reconciliation
- Qualified strict request schemas versus environment validation, exported type coverage, mutation/readback statements, guard-failure ambiguity, generic error codes, guarded row casts, and decision-route parsing order. Initial actor artifacts remain privately retained; no product or test changes.
