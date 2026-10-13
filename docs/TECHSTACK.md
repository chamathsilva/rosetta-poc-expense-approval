# TECHSTACK

Purpose: current project stack and key stack decisions. Content: language, runtime, frameworks, build/tooling, scripts, explicit absences. Style: flat bullets under `##` headers, current state only, no changelog.

## Language

- TypeScript 7.0.2 (`devDependencies.typescript`), ES modules (`"type": "module"`)
- Compiler target ES2024, module and resolution `NodeNext`, strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`

## Runtime

- Node.js >= 24 (`engines.node`); `.nvmrc` pins 24.21.0
- npm 11.6.2 (`packageManager`)
- Node built-in `node:sqlite` (`DatabaseSync`) for persistence; no SQLite npm package

## Framework and libraries

- Fastify 5.12.4: HTTP server and routing
- Zod 4.6.5: request input validation

## Persistence

- SQLite via Node built-in `node:sqlite`
- Default database file `data/expenses.sqlite`, override with `DATABASE_PATH`; `:memory:` supported

## Build and tooling

- `tsc` (TypeScript compiler) builds `src/` into `dist/` (`tsconfig.json`, `rootDir` `src`, `outDir` `dist`)
- `tsconfig.test.json` extends the base config, `noEmit`, includes `src/`, `tests/`, and `vitest.config.ts` for typechecking
- `tsx` runs TypeScript directly in dev (`tsx watch src/server.ts`)
- Vitest 5.0.0 test runner (`vitest.config.ts`: includes `tests/**/*.test.ts`, `clearMocks: true`)
- `@types/node` 24.13.4 for Node type definitions

## Scripts

- `build`: `tsc -p tsconfig.json`
- `dev`: `tsx watch src/server.ts`
- `start`: `node dist/server.js`
- `typecheck`: typecheck both `tsconfig.json` and `tsconfig.test.json`
- `test`: `vitest run`; `test:watch`: `vitest`
- `check`: typecheck, test, build

## Not present

- CI configuration (no `.github`), intentional: local only
- Linter and formatter config (no ESLint or Prettier config; `.prettierignore` exists for docs only)
- Containerization

## Editor settings

- `.editorconfig`: UTF-8, LF, 2-space indent, final newline, trimmed trailing whitespace
