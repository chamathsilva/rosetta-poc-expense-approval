# AC-011 Follow-up — Phase 8 (Review Code) Findings

Date: 2026-10-15. Independent reviewer subagent (claude-sonnet-5, fresh context, no
implementer knowledge). Scope: the AC-011 router-rejection correction (`src/app.ts` +
`tests/access.test.ts`) against `plans/EXP-003/AC-011-FOLLOWUP-PLAN.md`'s 8 acceptance
items, plus three specific coverage concerns raised during implementation (broader
sentinel no-echo coverage; PATCH-decision before/after + `rawCounts` id-scoping
robustness; HEAD route body-vs-status-only).

Preserved verbatim below as received from the subagent. The fixes it recommended were
applied by the orchestrator afterward and are noted at the end, not folded into the
verbatim text.

---

## Verdict: REQUEST CHANGES

Core fix is sound and independently verified, but two plan-mandated doc updates were skipped, one plan-required test is missing, and I found one real (if minor) behavioral defect that the plan's own "characterize" requirement should have caught. None of this is a security issue; all of it is concretely fixable.

### Independent verification performed (not just read — executed)
- `git diff --stat`: only `plans/EXP-003/HANDOFF.md`, `src/app.ts` (+18/-1), `tests/access.test.ts` (+251/-11) changed in tracked files, plus untracked `plans/EXP-003/AC-011-FOLLOWUP-PLAN.md` and 4 evidence files. No package/lockfile/schema changes. → **Plan item 8 scope discipline: confirmed.**
- `export PATH=.../v24.21.0/bin:$PATH && npm run check` → `node v24.21.0`, `npm 11.6.2`, **202/202 tests pass**, clean typecheck, clean build. Matches `plans/EXP-003/evidence/AC011-check.txt` verbatim (202 tests, CHECK_EXIT=0). → **Plan item 7 (full-gate evidence): confirmed genuine.**
- Reproduced the **before** regression myself: `git stash push -- src/app.ts` (reverting only the fix), ran a direct `app.inject()` GET with a 101-char id via `tsx` → got `414`, body `{"error":"Bad Request","code":"FST_ERR_MAX_PARAM_LENGTH",...echoes the full path...}`, byte-for-byte matching `plans/EXP-003/evidence/AC011-before.txt`. Restored with `git stash pop`; `git status` confirmed clean restore. → **Plan item 7 (failing-before/passing-after pair): confirmed genuine, not fabricated.**
- Read `src/app.ts:42-59`: `onMaxParamLength: (_path, _req, res) => { const payload = JSON.stringify(errorBody("VALIDATION_ERROR")); res.statusCode = 400; res.setHeader(...); res.end(payload); }`. Both `_path` and `_req` are unused (underscore-prefixed, never referenced in the body). `errorBody()` (`src/errors.ts:109-116`) returns a fully static object — `{error:{code, message}}` with zero request-derived interpolation anywhere in the function. → used this to ground concern A and B below.
- Read `node_modules/find-my-way/index.js:93-94,652-653,699-700,715-745,797-805`: the `maxParamLength` check runs inside the router's own `lookup`/match loop; on exceedance it returns `this._onMaxParamLength(originPath)` directly as the matched "handler," short-circuiting before any registered route handler, and before Fastify's normal dispatch populates `request.routeOptions`. Cross-checked against `src/actor.ts:24-27`: `registerActorHook`'s `onRequest` hook reads `request.routeOptions.url` and no-ops if it's `undefined`/doesn't start with `/expenses` — confirming the actor hook (and therefore all downstream service/DB code) never runs for a router-rejected request.
- Ran a live HEAD-request check myself (`tsx` against `src/app.ts`, in-memory DB): oversized-param HEAD → `statusCode: 400`, **`res.body` is the full 75-byte JSON payload** (`{"error":{"code":"VALIDATION_ERROR",...}}`), not empty. Same app, same HEAD method, through a *normal* route (valid-length id) → `statusCode: 404`, `res.body` is `""` (0 bytes) — Fastify's normal reply pipeline correctly strips HEAD bodies, but the raw `res.end(payload)` in `onMaxParamLength` bypasses that and writes a body anyway.

### Acceptance items 1–4, 6 (first half): CONFIRMED MET
1. All four operations (GET/PATCH-decision/DELETE/POST-restore) exercised via `it.each` at `tests/access.test.ts:420-461`, each asserting 400 VALIDATION_ERROR not 414.
2. 99-char (`:404`) and 100-char (`:392-403`) reach the service; 101-char (`:420-461`) and 1024-char (`:463-475`) both rejected identically.
4. Mixed-invalid cases at `:477-528` (no auth headers, no Idempotency-Key, malformed JSON body) all show router-400-wins; normal-length-param 401-precedence case at `:517-528` confirmed unaffected.
6 (router-selection half): encoded-path test at `:609-634` correctly characterizes (doesn't assume) that find-my-way measures the *decoded* segment — and the evidence file `AC011-check-failed-encoded-path-run.txt` genuinely documents the authors' first (wrong) assumption being caught and corrected. Good practice, verified.

### Coverage concern A (sentinel no-echo breadth): CONFIRMED NON-ISSUE for current code, cheap hardening available
The AC-011-specific tests (`:420-461`, `:463-475`) only sentinel-check the **path** value. Header/key/payload sentinel non-leak for *this specific code path* is not separately tested — the existing generic no-echo test (`:661-694`) covers those categories but against a different code path (401/validation-error responses), not the router-rejection path. Given the grounding above (callback never references `_req`, and `errorBody()` is 100% static), there is no mechanism by which header/key/payload values could leak through this path today — the concern's broader categories are not load-bearing for present correctness. Recommend adding header/Idempotency-Key/payload sentinels to the existing 101-char `it.each` as cheap regression insurance against a *future* change to this callback, but this is optional polish, not a defect.

### Coverage concern B — two parts, split verdict
**(a) Missing PATCH-decision before/after test — CONFIRMED GAP, Major.** Before/after unchanged-storage tests exist only for DELETE (`:530-550`) and POST restore (`:552-577`). No equivalent test exists for PATCH decision's oversized-param case, even though plan item 5 says "rejected mutations" generically and PATCH decision is a mutation. Fix: add one more before/after test mirroring the DELETE/restore pattern for PATCH `/expenses/:expenseId/decision`.
**(b) Per-id-scoped `rawCounts` vs. a global total-row check — CONFIRMED NON-ISSUE, with reasoning.** `rawCounts` (`tests/access.test.ts:38-54`) scopes `expense` and `auditCount` by id, but its `idempotencyCount` query (`:47-51`) already has **no WHERE clause at all** — it's already a global count. For the `expense`/`audit_events` per-id scoping: per the find-my-way/actor-hook trace above, an oversized param is intercepted entirely inside the router's match loop and never reaches `registerActorHook`, any route handler, or `ExpenseService`/repository code — there is no reachable code path that could insert a differently-keyed row or mutate an unrelated row. A global total-row check would be redundant belt-and-suspenders for *this* regression class, not a load-bearing safeguard. (It would matter for a different bug class — e.g. a service-layer logic error — but that's outside this change's blast radius.)

### Coverage concern C (HEAD body check) — CONFIRMED GAP, Major, and it's a real defect, not just a thin test
The existing HEAD test (`tests/access.test.ts:594-607`) checks only `response.statusCode`. My own run (above) shows this was the wrong call to skip: checking body here is not merely "meaningful," it would have caught a genuine, observable implementation defect — **the `onMaxParamLength` callback (`src/app.ts:51-57`) writes a full JSON body on HEAD requests**, violating HTTP HEAD semantics, while the same app's normal route-handler path correctly produces an empty body for HEAD (verified: Fastify's own reply pipeline strips it there, but the raw `res.end(payload)` here bypasses that pipeline entirely). Given plan item 6 explicitly scopes this as "status/body behavior," the body half was dropped. Recommend: either (preferred, small fix) guard the callback with `if (_req.method !== "HEAD") { res.end(payload); } else { res.end(); }`, or at minimum add a test assertion documenting the current (non-compliant) body-present behavior, consistent with how the encoded-path test documents actual rather than assumed behavior.

### Additional gaps found beyond the stated checklist
1. **Major — stale/wrong doc, plan violation.** `docs/EXP-003-COMPATIBILITY.md:48-53` still says "The final suite passes 187 tests" and "A 101-character expense path parameter is rejected by Fastify's router with 414 before Zod validation... it is an exception to the general planned invalid-identifier 400 contract" — this is now **factually false**: the suite is 202 tests and the behavior is 400, not 414. `src/app.ts:50`'s own comment points to this exact file ("See docs/EXP-003-COMPATIBILITY.md") as if it reflects current behavior. `git status` confirms this file was **not touched**. The plan's "Scope and execution ownership" section explicitly requires: "Add clearly dated current-state clarifications to specs S4/S5.12/S13, compatibility notes, architecture and handoff as needed. Correct stale current-status text in touched documents." This was not done.
2. **Major — stale/self-contradictory doc.** `plans/EXP-003/HANDOFF.md`'s new "AC-011 follow-up" section (diff, added lines ~78-93) states: *"Per explicit instruction, this is a record-only entry. No implementation has started... `src/app.ts` and `tests/access.test.ts` are unmodified."* This is now false — both files are modified (confirmed via `git diff --stat`: app.ts +18/-1, access.test.ts +251/-11) and 202 tests reflecting the implemented fix pass. This text was evidently written at the approval-recording step and never updated after implementation actually proceeded, leaving the handoff doc asserting something directly contradicted by the current repo state.
3. **Minor — process note.** The plan's "Scope and execution ownership" section calls for "a separate follow-up report and logs"; I found only the plan file itself and the 4 evidence files, no distinct report document. This may be intentionally deferred to the coordinator's close-out step (per the plan's own "Close-out and publication" section, which assigns final reporting/publication to the coordinator, not the implementer) — flagging for the orchestrator to confirm ownership rather than treating it as a hard gap.

### Summary
- Functional correctness of the fix itself: verified solid (400 envelope, no interpolation, router-precedence, mixed-invalid ordering, encoded-path characterization, genuine before/after regression pair, full gate green at 202/202).
- Two Major documentation items violate the plan's own explicit requirements (compatibility notes and handoff stale-text correction) and must be fixed before close-out per plan item 8.
- One Major test gap (PATCH-decision before/after) should be added for completeness.
- One Major finding is a genuine (if low-severity, POC-scope) implementation defect — HEAD responses from the router-rejection path carry a body, contrary to HTTP semantics and contrary to this same app's own normal-route HEAD behavior — caught precisely because I pushed on the "is checking HEAD body actually meaningless" question instead of accepting the premise.
- Concerns A and B(b) are confirmed non-issues for current correctness, with evidence/reasoning given rather than taken on faith.

This is not a rubber stamp and not a block-everything verdict: recommend the orchestrator route back to the implementer for (1) `docs/EXP-003-COMPATIBILITY.md` update, (2) `HANDOFF.md` stale-text correction, (3) add PATCH-decision before/after test, (4) fix or at least characterize the HEAD-body behavior — then a quick re-check (the 202/202 gate and scope discipline are already solid and shouldn't need rework).

---

## Orchestrator fixes (2026-10-15, applied after this review, re-verified)

All four recommended items were fixed directly, in the order the reviewer's summary listed:

1. **HEAD-body defect fixed, not merely characterized** — `src/app.ts`'s `onMaxParamLength`
   now explicitly branches on `req.method === "HEAD"` (`res.end()`, no body) vs. every other
   method (`res.end(JSON.stringify(errorBody("VALIDATION_ERROR")))`), matching Fastify's own
   HEAD-body-stripping behavior on normal routes. The HEAD test
   (`tests/access.test.ts`, "...also router-rejected at 400, with no body...") now asserts
   `response.body === ""` in addition to the status code.
2. **PATCH-decision before/after test added** — mirrors the existing DELETE/POST-restore
   pattern exactly (`rawCounts` before/after `toEqual`), using a distinct sentinel id
   (`"p".repeat(101)`) and idempotency key.
3. **`docs/EXP-003-COMPATIBILITY.md` updated** — the stale "187 tests"/"414" text is now a
   dated AC-011 section describing the 400 behavior, the pre-auth/pre-body-parsing precedence,
   the decoded-length characterization, and the HEAD no-body behavior; the original Phase 13
   figures are preserved as explicitly historical, not overwritten.
4. **`HANDOFF.md` corrected** — the self-contradictory "record-only, unmodified" text (written
   before implementation began, never updated after) is replaced with an accurate Phase
   7/8 account, including this review's verdict and fixes.

Full gate re-run after all four fixes: **203/203 tests passing**, clean typecheck, clean
build (independently re-counted via `npx vitest run --reporter=verbose`, not inferred by
arithmetic on the diff — the HEAD-body fix added an assertion to an existing test, not a
new test; the one new test is the PATCH-decision before/after case). See
`plans/EXP-003/evidence/AC011-check.txt`. `git diff --stat` confirmed scope stayed within
`src/app.ts`, `tests/access.test.ts`, `docs/EXP-003-COMPATIBILITY.md`, `HANDOFF.md`, and the
plan/evidence files — no dependency, schema, or policy changes.

The reviewer's two confirmed-non-issue findings (sentinel no-echo breadth; per-id vs. global
`rawCounts` scoping) were left as-is, per the reviewer's own reasoning: no fix applied,
no action needed. The "separate follow-up report" minor note is addressed by this file
itself plus `HANDOFF.md`'s AC-011 section, pending the coordinator's own close-out report.
