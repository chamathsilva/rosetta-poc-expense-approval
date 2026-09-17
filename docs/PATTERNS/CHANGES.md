# PATTERNS CHANGES

## [2026-09-16] Initial pattern extraction (install mode)
Created docs/PATTERNS/ from scratch (did not previously exist). Read docs/CODEMAP.md to scope modules, then read all 6 files under src/ and the single test file under tests/ (small repo, single pass, no subagent fan-out needed per state.file_count=17).

## [2026-09-16] Created 10 pattern files
- zod-validated-route-handler.md
- structured-json-error-response.md
- strict-zod-schema.md
- defensive-sql-row-mapper.md
- parameterized-prepared-statement.md
- guarded-state-transition-update.md
- injected-dependencies-for-testability.md
- domain-type-schema-pair.md
- deterministic-test-app-factory.md
- test-resource-cleanup-registry.md

## [2026-09-16] Created INDEX.md
Lists all 10 patterns with one header per pattern, grep-able by markdown `##` headers, no tables.

## [2026-09-16] Skipped weaker candidates
Did not extract standalone patterns for: single-occurrence environment-variable parsing in server.ts (only one call site, no second instance to confirm recurrence); Fastify lifecycle hooks (`onClose`, signal handlers) — only one instance each, not yet a recurring structure per the "2+ places" rule.
