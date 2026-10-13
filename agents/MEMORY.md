# AGENT MEMORY

Generalized reusable lessons from agent sessions.
Root causes converted into preventive rules, not incident-specific notes.
Entries are h3 headers with [ACTIVE|RETIRED] status.
Content: brief, grep-friendly, MECE across sections.
Style: one-liner per entry, optional sub-bullets for context.
Keep template entries so that AI knows how to fill them in later on.

## Preventive Rules

### <Generalized Preventive Rule> [ACTIVE|RETIRED]
[Root cause, Reasons, Problems]

## What Worked

### <Generalized What Worked> [ACTIVE|RETIRED]
[Root cause, Reasons, Problems]

## What Failed

### <Generalized What Failed> [ACTIVE|RETIRED]
[Hypothesis, Root cause, Reasons, Problems]

## Discoveries

### <Generalized Discovery> [ACTIVE|RETIRED]
[Usage, Reasons, Problems]

### SQLite comes from Node built-in `node:sqlite`, not an npm package [ACTIVE]
- Usage: import `DatabaseSync` from `node:sqlite`; synchronous `prepare().run/get/all()`; this study pins Node 24.21.0. The API's minimum supported Node version was not evaluated.
- Reasons: no `sqlite3`/`better-sqlite3` in `package.json`; do not add one or look for it in `node_modules`.
- Problems: older Node versions fail to import it; rows come back as `Record<string, unknown>`, so map them with type guards.
