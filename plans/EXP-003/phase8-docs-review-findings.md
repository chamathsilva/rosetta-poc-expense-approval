# P8 Pass 1 Documentation Review Findings — EXP-003

Date: 2026-10-14. Independent reviewer subagent (claude-sonnet-5, fresh context, no prior-session
knowledge). Scope: the 8 newly-written/updated "P8 Pass 1" documentation files against the actual
implemented `src/` code and against `plans/EXP-003/EXP-003-PLAN.md`'s P8.1–P8.7 task list.

**Process context:** this review exists because of a workflow finding — PLAN.md's own "File
Ownership and Sequencing" places P8 Pass 1 *before* Phase 8 (Review Code)/Phase 9 (Impl
Validation), but the orchestrator ran Phase 8/9 first and wrote P8 Pass 1 afterward, as corrective
action once the author caught the sequencing miss. See `agents/TEMP/EXP-003/coding-flow-state.md`
Phase 10 row.

Preserved verbatim below as received from the subagent. Both findings (M1, M2) and the one minor
note were fixed directly by the orchestrator after this review; see "Orchestrator fixes" at the
end of this file.

---

## Verdict: approve-with-minor-fixes

The eight "P8 Pass 1" docs are, on the whole, unusually well-grounded: nearly every file:line citation I independently checked against `src/` resolved exactly (including specific line numbers like `expense-service.ts:271`/`371`, `errors.ts:138-176`, `schemas.ts:22-46`, `domain.ts:19-32`/`51-54`, `app.ts:54,98,131,163`, `app.ts:127-189`, `app.ts:195-205`). Behavioral claims (manager limit 100,000 cents inclusive, half-open 30-day restore window, self-decision ban, tenant scoping, quarantine tenant unreachable via header charset, idempotency key charset, body-parser 4xx preservation, audit append-only triggers, same-tenant disclosure asymmetry) all matched the actual code precisely. No doc overstates Phase 11 (automated Vitest suite) status — all explicitly say Phase 11 hasn't run. `docs/BASELINE-API.md` has a genuinely empty diff. `docs/ASSUMPTIONS.md` preserves all history (no deletions, each item carries its original substance plus a `[RESOLVED 2026-10-14]` annotation). Line budgets are respected (CONTEXT.md 88/100, ARCHITECTURE.md 128/150). No marketing/hype language found.

There are two real defects, detailed below, plus minor notes.

## Major findings

**M1 — `docs/ARCHITECTURE.md` Modules table omits `src/errors.ts` and undercounts the module total.**
- Doc claim: `docs/ARCHITECTURE.md` line ~16: `"src/: application source (12 modules, below)."`, and the Modules table (lines ~24-37) lists exactly 12 rows: `server.ts, app.ts, actor.ts, policy.ts, transaction.ts, expense-service.ts, schemas.ts, domain.ts, expense-repository.ts, audit-repository.ts, idempotency-repository.ts, database.ts`.
- Contradicting evidence: `ls src/` shows 13 files — the table is missing `errors.ts` entirely, even though the same document's request-pipeline diagram (`--> setErrorHandler (errors.ts)`) and Error Model section (`src/errors.ts` `bodyParserErrorResult`) both reference it as a real module.
- Cross-doc inconsistency: `docs/CODEMAP.md` (same P8 pass) correctly states `"## src (13 files)"` and lists `errors.ts` in its file list. So two docs updated in the same pass disagree on the module count, and one of them (ARCHITECTURE.md) is simply missing a module it elsewhere discusses. This is a P8.2 completeness gap ("new modules table") — the table is not just under-described, it is missing a row.
- Recommendation: add an `errors.ts` row to the Modules table and correct the count to 13.

**M2 — `agents/IMPLEMENTATION.md` reports a "65/65" pass count in the same entry that disclaims reporting test counts.**
- The new `## Baseline State` bullet (added this pass) says verbatim: *"Do not report a passing-test count for EXP-003 until that phase lands; this is the Pass 1 documentation update, not Pass 2."*
- Two bullets later, under the new `### EXP-003 …` workstream entry, the same file says: *"Independent Phase 9 runtime validation (`plans/EXP-003/phase9-validation-findings.md`): 65/65 live `inject()` assertions passed…"*
- I traced "65/65" to `plans/EXP-003/phase9-validation-findings.md` ("I drove 65 total runtime assertions through Fastify `inject()`… All 65 runtime checks passed on the final run") — the number itself is accurate to its source, and the entry does correctly distinguish this manual Phase 9 validation from the not-yet-run Phase 11 Vitest suite ("Neither review touched or ran `tests/`"). So this is not a fabrication, but it is a direct self-contradiction within one file: it explicitly promises "no passing-test count" and then states one. A reader skimming IMPLEMENTATION.md would reasonably read "65/65 passed" as exactly the kind of test-count claim the preceding sentence just forbade.
- Additional context (not a doc-accuracy defect, but relevant): `phase9-validation-findings.md` itself contains a "Process note" admitting this documentation pass should have run *before* Phase 8/9 per PLAN.md's stated two-pass ordering ("Pass 1… before Phase 8 Review Code"), and that the step was skipped by the orchestrator. The doc content reviewed here is accurate to what actually happened, but it was drafted later in the sequence than PLAN.md prescribes, which is how a Phase-9-validation count ended up inside what's labeled "P8 Pass 1" documentation.
- Recommendation: either drop the "65/65" phrasing (reference the findings file by path only, without the count) or clarify in the same sentence that this number is manual Phase 9 validation, not the Phase 11 automated-suite count the preceding sentence refers to.

## Minor findings

- `docs/ASSUMPTIONS.md` A11's "Resolve in" line still says `docs/CONTEXT.md (Business Rules)`, but CONTEXT.md's Pass-1 rewrite removed the "Business Rules (Baseline)" header entirely (replaced by "Decision Policy" and other sections) — a stale cross-reference, low impact since the currency/limit fact is now actually recorded under "Decision Policy".
- No tone/hype issues found in any of the 8 files — style stays plain and factual throughout, consistent with the "disposable local case study" framing.
- `docs/TODO.md`'s new PATTERNS item correctly flags and cites the pre-existing stale `errors.ts`/`app.ts` location note in `docs/PATTERNS/structured-error-response.md:5` — verified accurate (file still says `src/app.ts`, code is actually in `src/errors.ts`).

## Per-numbered-item disposition

1. **Claim-vs-code accuracy** — PASS. Every claim I independently checked (manager limit, restore window half-open semantics, self-decision rule, tenant scoping, quarantine marker unreachability, idempotency key charset, body-parser status codes, audit triggers, T-tier ordering, `deletedBy` omission from responses) matched `src/` exactly, often down to the cited line number.
2. **No premature test/Phase-11 claims** — PARTIAL. No doc claims the Phase 11 automated suite ran or passed. But see M2: `agents/IMPLEMENTATION.md` reports a "65/65" pass count from Phase 9 manual validation in the same breath as a sentence disclaiming test-count reporting — an internal self-contradiction, even though the underlying number is accurate and correctly attributed to a different (already-completed) phase.
3. **Internal consistency across the 8 files** — PARTIAL. Break count ("8") is consistent across CONTEXT.md/COMPATIBILITY.md/IMPLEMENTATION.md. But ARCHITECTURE.md's "12 modules" conflicts with CODEMAP.md's correct "13 files" (M1).
4. **`docs/BASELINE-API.md` zero edits** — PASS. `git diff --stat -- docs/BASELINE-API.md` is empty; confirmed independently.
5. **`docs/ASSUMPTIONS.md` history preservation** — PASS. No entries deleted; all moved entries retain their original assumption text (restated as "Original assumption:") plus a dated `[RESOLVED 2026-10-14]` tag and resolution. A3 kept in place with an "unchanged, still holds" note.
6. **`agents/IMPLEMENTATION.md` test-count fabrication** — PARTIAL/borderline FAIL on tone — see M2. No fabricated Phase 11 count, but a confusing self-contradiction with a real Phase 9 count.
7. **README curl examples vs. real routes** — PASS. Checked all 4 examples (POST /expenses, PATCH decision, DELETE, POST restore) against `src/app.ts` and `src/schemas.ts`: header names, body shapes, and route paths all match exactly.
8. **PLAN.md P8.1-P8.7 completeness** — PASS except M1. P8.1 (CONTEXT.md actors/policy/lifecycle/audit/attachments/breaks-pointer/capabilities, <100 lines): done. P8.2 (ARCHITECTURE.md modules/pipeline/persistence/errors/<150 lines): done but modules table incomplete (M1). P8.3 (COMPATIBILITY.md breaks 1-8, zero BASELINE-API edits): done, very thorough. P8.4 (ASSUMPTIONS.md A1/A2/A4/A5/A7/A10-A13 resolved, A11 updated, A3 untouched): done. P8.5 (TODO.md DONE items, new P3 items, A9 kept open): done. P8.6 (IMPLEMENTATION.md new entry + CODEMAP.md update): done, modulo M2 wording. P8.7 (README examples/headers/roles/delete-restore/links): done.
9. **Line-count budgets** — PASS. CONTEXT.md 88 lines (<100), ARCHITECTURE.md 128 lines (<150).
10. **Marketing/hype tone** — PASS. No instances found across all 8 files.

## Files reviewed
- `docs/CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/EXP-003-COMPATIBILITY.md`, `docs/ASSUMPTIONS.md`, `docs/TODO.md`, `agents/IMPLEMENTATION.md`, `docs/CODEMAP.md`, `README.md`.
- Ground truth: all of `src/` (`actor.ts`, `app.ts`, `audit-repository.ts`, `database.ts`, `domain.ts`, `errors.ts`, `expense-repository.ts`, `expense-service.ts`, `idempotency-repository.ts`, `policy.ts`, `schemas.ts`, `transaction.ts`).
- `plans/EXP-003/EXP-003-PLAN.md` (P8 section), `plans/EXP-003/EXP-003-SPECS.md` (S4), `plans/EXP-003/phase9-validation-findings.md`, `plans/EXP-003/phase8-review-findings.md`.

This review is advisory; recommendations above are findings for the orchestrator/author to act on, not changes made by the reviewer itself.

---

## Orchestrator fixes (2026-10-14, applied after this review, re-verified)

- **M1 fixed**: `docs/ARCHITECTURE.md` modules table now includes an `src/errors.ts` row; the count line now says "13 modules," matching `docs/CODEMAP.md`.
- **M2 fixed**: `agents/IMPLEMENTATION.md`'s EXP-003 entry reworded so the Phase 9 validation count is explicitly labeled as a manual, already-completed-phase figure distinct from the Phase 11 automated-suite claim the preceding sentence disclaims. The count itself was separately found to be wrong (see below) and corrected to 78/78.
- **Minor note fixed**: `docs/ASSUMPTIONS.md` A11's "Resolve in" cross-reference updated from the removed "Business Rules" header to "Decision Policy" (the section that now actually carries the fact).
- **Separately found (not from this review, from a direct author request)**: the Phase 9 "65/65" figure this review traced to `phase9-validation-findings.md` was itself a miscount by that subagent — summing its own 5 scripts' printed totals (43+12+11+3+9) gives 78, not 65. Reconciled to **78/78 PASS** across the ledger, `HANDOFF.md`, `agents/IMPLEMENTATION.md`, and `phase9-validation-findings.md` (which carries the correction note while preserving its original verbatim text).
- Pinned `npm run build` re-run clean after all fixes; `git diff --stat` on `src/`/`tests/`/config confirmed unchanged throughout.
