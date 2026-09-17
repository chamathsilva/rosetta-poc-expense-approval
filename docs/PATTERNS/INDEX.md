# PATTERNS INDEX

> Auto-generated pattern catalog. Do not edit manually.

## Zod-Validated Route Handler (Safe-Parse Guard) - validate request body/params with `.safeParse()` and return structured 400 on failure

## Structured JSON Error Response - shared `{ error: { code, message, details? } }` shape across all failure responses

## Strict Zod Schema Definition - `.strict()` object schemas with explicit field constraints for all client input

## Defensive SQL Row Mapper - typed guard helpers converting raw SQLite rows into domain objects, throwing on corruption

## Parameterized Prepared Statement Query - `.prepare(sql).run/get/all(...)` with `?` bind params for every repository query

## Guarded State-Transition Update - app-layer pre-check plus SQL `WHERE status = ...` guard to prevent double state transitions

## Constructor-Injected Dependencies for Testability - `buildApp(options)` injects db path, id factory, clock, logger with production defaults

## Domain Type Paired with Zod Schema - domain.ts owns types/enums, schemas.ts defines narrower per-operation client-input validation

## Deterministic Test App Factory - `createTestApp()` helper wiring in-memory DB, incrementing id/clock fakes, driven via `app.inject()`

## Test Resource Cleanup via Registry + afterEach - resources pushed to module-level arrays at creation, drained by one shared `afterEach`
