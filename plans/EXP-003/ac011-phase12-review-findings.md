# AC-011 Follow-up — Phase 12 (Review Tests) Findings

Date: 2026-10-15. Independent test-quality reviewer subagent (claude-sonnet-5, fresh context,
no implementer knowledge, no knowledge of the Phase 8 reviewer's report until after forming
its own independent view). Scope: test-suite quality (coverage completeness, scenario
correctness, isolation/mocking discipline) of the AC-011 "router-level oversized-parameter
rejection" test block, distinct from Phase 8's code-correctness review.

Reviewer wording is preserved below; the local toolchain path is replaced with a placeholder
for publication. The raw original is retained privately. The two Major fixes it recommended
were applied by the orchestrator afterward and are noted at the end, not folded into the
verbatim text.

---

## Phase 12 (Review Tests) — Independent Verdict: REQUEST CHANGES

**Scope reviewed:** `tests/access.test.ts:391-663` (the "router-level oversized-parameter rejection (AC-011 follow-up)" describe block, 17 test cases per `it`/`it.each` count), `tests/support.ts` (fixture/cleanup pattern), `src/app.ts:42-66` (`onMaxParamLength`), `src/errors.ts:109-176` (`errorBody`/`bodyParserErrorResult`), `plans/EXP-003/AC-011-FOLLOWUP-PLAN.md`, `plans/EXP-003/AC-011-FOLLOWUP-REPORT.md`, `plans/EXP-003/ac011-phase8-review-findings.md`.

**Gate I ran myself:** `export PATH=<pinned-node-bin>:$PATH && npm run check` → `node v24.21.0`, `npm 11.6.2`, **203 passed (203)**, 9 test files, clean typecheck (both tsconfigs), clean build. Confirms the report's claim independently.

### Isolation/mocking, independence, determinism (checklist 1-3) — clean, no findings
- `grep -n "vi\.\(mock\|spyOn\|fn\)" tests/access.test.ts` → zero matches. All AC-011 tests use real `app.inject()` and the real `node:sqlite`-backed `buildApp`, consistent with the rest of the file.
- Cleanup goes through `createTestRegistry()`'s shared `afterEach` (`tests/support.ts:104-166`): every `app`, temp-dir, and `reader` connection opened via the registry is closed/removed per test. The three storage tests (`access.test.ts:530-600`) each call `createTempDatabasePath()`/`openReader()` fresh — no shared mutable fixture across tests.
- Sentinel chars (`"a"`/`"b"`/.../`"p"` repeated) are local literals per test; since the router always rejects before any write, there's no possibility of id collision mutating shared state. No ordering dependency found.

### Finding 1 (Major) — weak assertion lets the "router-wins-over-malformed-body" test pass for the wrong reason
`access.test.ts:500-515`, title: *"an oversized param wins over a malformed JSON body: router rejects before body parsing runs"*. Assertion is only:
```
expect(response.statusCode).toBe(400);
expect(response.json().error.code).toBe("VALIDATION_ERROR");
```
`src/errors.ts:144-165` (`bodyParserErrorResult`) shows that a genuine malformed-JSON body error is *also* mapped to `statusCode: 400, body.error.code: "VALIDATION_ERROR"` — just with a different `message` (`BODY_PARSE_ERROR_MESSAGE = "Request body could not be parsed"`, `errors.ts:39,160-161`) and no `details` field, vs. the router callback's fixed envelope (`errorBody("VALIDATION_ERROR")` → message `"Request validation failed"`, `errors.ts:44`). The test checks neither the message nor the full envelope, so if a future change broke the router-precedence this test's comment claims to guard (e.g., the oversized param stopped being router-rejected and fell through to Fastify's body parser instead), **this test would still pass** — same status code, same error code, by coincidence, for the wrong reason. This is exactly the failure mode checklist item 4 asked me to hunt for.
Contrast: the `it.each` 101-char block (`:451-457`) uses `toEqual` on the *entire* body including absence of `details` — that one *does* correctly distinguish router-level rejection from service-level `expenseParamsSchema` rejection (which, per `src/schemas.ts:17`, `expenseId: z.string().trim().min(1).max(100)`, would also fire on a 101-char id and would populate `details` via `validationError()`). That's a genuinely precise test; the malformed-body test is not held to the same bar.
**Fix:** assert the exact envelope (or at minimum the message) in the malformed-body test, the same way the `it.each` block already does.

### Finding 2 (Major) — the "unknown-suffix" boundary from the plan's approved-behavior paragraph is not in the automated suite, only in an unreproducible manual check
The plan's "Evidence and approved behavior" section (`AC-011-FOLLOWUP-PLAN.md:63-64`) says: *"Unknown routes retain existing behavior except where the router itself selects its oversized-parameter callback; characterize that boundary rather than promising otherwise."* The report (`AC-011-FOLLOWUP-REPORT.md:44-45`) claims this was checked: *"Unknown-suffix behavior was independently probed by the coordinator in memory: an oversized expense parameter plus `/unknown` returns 400; an unrelated unregistered route returns 404."* I grepped the whole test file for any case combining an oversized id with an unregistered suffix (`grep -n "unknown\|does-not-exist"`) — the only matches are the pre-existing, unrelated `/does-not-exist` and `/nope` tests (`access.test.ts:602-615`, `683-688`), neither of which uses an oversized id. **The specific boundary the plan calls out, and that the report explicitly claims was verified, exists nowhere in the committed, regression-safe test suite** — only as an ephemeral manual probe ("in memory," per the report's own wording) that leaves no artifact and will not catch a future regression. This is a real scenario-completeness gap per checklist item 5, and a report/test discrepancy per checklist item 7: the report presents this as covered evidence, but it is not codified as a test.
**Fix:** add one test, e.g. `GET /expenses/${"x".repeat(101)}/unknown` → expect 400 VALIDATION_ERROR (router still wins), alongside the existing unrelated-unknown-route test.

### Finding 3 (Minor, concur with Phase 8's reasoning but with a note) — sentinel no-echo breadth
`access.test.ts:459,474` only sentinel-check the **path** value for the router-rejection path; headers/Idempotency-Key/payload sentinels aren't exercised there (only on the unrelated 401/validation path at `:690-719`). The follow-up report (`:38-39`) self-discloses this as a "coverage qualification," not a hidden gap. I independently re-derived the same conclusion Phase 8 reached: `src/app.ts:51-64`'s callback never reads `req` for anything but `req.method`, and `errorBody()` (`src/errors.ts:109-116`) is a 100%-static object with zero interpolation — so no header/key/payload value could leak through this code path regardless of what's tested. I agree this is a non-issue for current correctness. From a pure test-quality/traceability lens it's still a literal gap against plan acceptance item 3's wording ("Sentinel path, headers, key and payload values must not appear in the response") — cheap to close, not urgent.

### Finding 4 (non-issue, independently confirmed) — global vs per-id `rawCounts`
`access.test.ts:38-54`: `idempotencyCount` has no `WHERE` clause (global), `expense`/`auditCount` are id-scoped. I confirmed independently (not just trusting Phase 8's framing) that this is safe here because each storage test uses its own fresh temp-file database via `createTempDatabasePath()`/`openReader()` (`support.ts:128-139`) — there is no shared/global DB across tests, so a "global" count is actually scoped to that single test's isolated database. I agree with Phase 8's non-issue call, and additionally verified the isolation mechanism that makes it safe (Phase 8's writeup reasoned from unreachable-code-path grounds; mine adds the per-test-DB-isolation grounds, which independently closes the same question).

### Strengths worth noting (not findings, but relevant to the verdict)
- The HEAD-body assertion (`:629-635`, `response.body).toBe("")`) genuinely re-fails if the Phase-8 HEAD fix (`src/app.ts:59-63`) were reverted: mentally removing the `if (req.method === "HEAD")` branch would make the callback always `res.end(JSON.stringify(...))`, producing a non-empty body for HEAD, which this assertion would catch. It's a real regression test, not cosmetic.
- The encoded-path test (`:638-662`) asserts `error.code === "EXPENSE_NOT_FOUND"` specifically (not just `404`), which does distinguish "reached the service and queried a nonexistent id" from a coincidental `ROUTE_NOT_FOUND` 404 — checked `registerActorHook` (`src/actor.ts:23-41`) confirms the actor hook never itself returns 404, so this isn't a false-positive 404 path.
- Report's "17 cases replacing one old 414 case" (`AC-011-FOLLOWUP-REPORT.md:32`) checks out exactly: I counted 13 standalone `it()` + 1 `it.each` expanding to 4 = 17, net +16 against 187→203.

### Comment-vs-assertion check (checklist item 6)
- `:477-486` ("router runs before the actor hook"): the assertion (400 not 401 for missing headers) does logically prove the ordering claim — if the actor hook ran first, missing headers would yield 401. No mismatch.
- `:625-628` HEAD comment ("runs before method dispatch"): editorial framing beyond what's strictly asserted (only the HEAD-specific outcome is checked, not dispatch ordering generically) — harmless, not misleading, not worth a finding on its own.
- `:500-515` malformed-body comment: this is the one true mismatch — see Finding 1.

### Comparison to Phase 8
This pass found two issues Phase 8's code-correctness-focused review did not surface: the malformed-body test's weak/ambiguous assertion (Finding 1) and the uncovered unknown-suffix scenario despite the report claiming it was checked (Finding 2) — both are test-quality-specific blind spots outside Phase 8's remit (code correctness), which is consistent with why this dedicated pass exists. I independently re-derived and **agree with** both of Phase 8's "confirmed non-issue" calls (sentinel-breadth, global-vs-per-id `rawCounts`), reaching the same conclusions by partially overlapping, partially distinct reasoning (per-test DB isolation, for `rawCounts`).

### Verdict
**Request changes** — two Major, concretely fixable test-quality gaps (Finding 1: strengthen the malformed-body test's assertion; Finding 2: add the unknown-suffix-with-oversized-id test the report already claims was checked), one Minor optional-hardening item (Finding 3). The implementation itself (`src/app.ts`) is not in question here — all findings are about test-suite precision and regression durability, not about current behavior being wrong.

---

## Orchestrator fixes (2026-10-15, applied after this review, re-verified)

Both Major findings fixed directly:

1. **Finding 1 fixed** — the malformed-body-precedence test now asserts the full exact
   envelope (`toEqual({ error: { code: "VALIDATION_ERROR", message: "Request validation
   failed" } })`) instead of status+code alone, so it can no longer pass by coincidence if
   the router-precedence it claims to guard were ever broken.
2. **Finding 2 fixed** — a new test was added asserting `GET /expenses/<101-char>/unknown`
   still returns `400 VALIDATION_ERROR` (router rejection wins over the unregistered
   suffix), codifying the exact boundary the plan calls out and the follow-up report had
   claimed (inaccurately, as an uncodified manual check) was already covered.
3. **Finding 3 (Minor) left as-is** — both independent reviewers (Phase 8 and this pass)
   reached the same non-issue conclusion via different but convergent reasoning; no fix
   applied, consistent with the established "accepted as-is" pattern for Minor findings
   elsewhere in this project.

Full gate re-run after both fixes: **204/204 tests passing**, clean typecheck, clean build
(`plans/EXP-003/evidence/AC011-check.txt`). Clean-install gate (`npm ci && npm run check`)
also re-run and green, lockfile unchanged (`plans/EXP-003/evidence/AC011-ci-check.txt`).

## Coordinator qualification

Finding2 identifies a useful automated-regression gap. The earlier coordinator report explicitly
described its suffix check as manual, and the command/output remains in the coordinator record;
it did not falsely claim automated coverage. The reviewer's "unreproducible" characterization
and the orchestrator's "inaccurately" wording above are not endorsed as established facts.
Adding the test improves reproducibility without invalidating the earlier manual observation.
The current independent204-test check is in `evidence/AC011-coordinator-final-check.txt`.
