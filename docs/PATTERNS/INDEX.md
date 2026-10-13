> Auto-generated pattern index. Do not edit manually.

# Patterns Index

## Zod Strict Schema Definition - strict request objects; create/decision bodies export inferred types, params do not
## Fastify Route Handler with safeParse Validation - routes validate params/body with `schema.safeParse()` and 400 on failure before any business logic
## Structured Error Response - every error reply shares the `{ error: { code, message, details? } }` shape via `errorBody`/`validationError`
## Find-or-404 Route Guard - single-resource routes look up by id, 404 if missing, then guard preconditions with a 409 before mutating
## SQLite Repository Method - prepared parameterized SQL; mutations include a mapped readback
## Typed Row Field Extraction - runtime guards, including inline checks and validated status casts, protect row mapping
## Domain Entity Input Variants - a domain concept is split into separate Entity/New/Decision interfaces instead of one interface with optional fields
## Deterministic Fastify Inject Test Case - tests build the app with injected id/now factories and exercise routes via `app.inject()` with shared afterEach cleanup
