# EXP-003 Phase 5 Re-Review (documentation-consistency check of the fix-up pass)

Reviewer: independent reviewer subagent (AI). Advisory only. **This is not a Phase 6 approval and
grants none, implied or otherwise.** Implementation (Phase 7 onward) must not start regardless of
this review's verdict — that requires the human author's own Phase 6 approval sentence.

Inputs reviewed: `plans/EXP-003/phase5-review-findings.md` (baseline, untouched), `plans/EXP-003/evaluator-plan-review.md`,
current on-disk `plans/EXP-003/EXP-003-SPECS.md`, `plans/EXP-003/EXP-003-PLAN.md`, `docs/EXP-003-COMPATIBILITY.md`,
`plans/EXP-003/HANDOFF.md`, `agents/TEMP/EXP-003/coding-flow-state.md`, `plans/EXP-003/architecture-notes.md`,
`plans/EXP-003/REQUEST.md`, plus `docs/TODO.md` and `docs/ASSUMPTIONS.md` (A9/A10) as chased cross-references.
No `src/` or `tests/` file was read, touched, or assumed. No command was run.

## TLDR

**Verdict: fix-up is substantively applied in the document bodies, not just claimed in changelogs — but two
new, purely cosmetic issues were introduced, and one wording nuance is worth the author's attention before
Phase 6.** Of the 2 Major + 14 Minor Phase-5 findings and the 9 evaluator-reconciliation items, every one that
I could check against body text is **CLOSED** with a real textual correction, not a bare changelog assertion.
I found **0 Critical, 0 Major, 2 Minor (new)** issues introduced by the fix-up itself, both cosmetic/ordering,
neither a semantic regression. Approval-status language (Phase 3 approved, Phase 6 pending) is accurate and
consistent across `coding-flow-state.md`, `HANDOFF.md`, `EXP-003-SPECS.md`, and `EXP-003-PLAN.md`.

**This review does not constitute Phase 6 approval. No implementation may start until the human author gives
the explicit Phase 6 approval sentence, independent of this review's findings.**

## Critical

None.

## Major

None.

## Minor (new, introduced by the fix-up)

### n1. `EXP-003-PLAN.md` lists step `P7.9` before step `P7.8`, breaking the ascending-order convention used everywhere else in the file
- Where: `EXP-003-PLAN.md:170-173`. The `## P7 New tests (Phase 11)` section runs P7.0 (:154), P7.0 again as a second paragraph (:155), P7.1 (:158), P7.2 (:159), P7.3 (:163), P7.4 (:164), P7.5 (:165), P7.6 (:166), P7.7 (:167), **P7.9 (:170)**, then **P7.8 (:173)**.
- What's wrong: every other step list in this document (P0–P6, P8, P9) is in strict ascending numeric order. P7.9 (`tests/errors.test.ts`) appears textually before P7.8 (the full `npm run check` gate), which is out of sequence. This is likely a residual of inserting a new test file step without renumbering the pre-existing gate step.
- Why it matters: it is purely cosmetic — all cross-references (e.g. SPECS S1's AC-013 row citing `P7.8`, PLAN's own AC-013 row) still resolve correctly by step ID, so nothing is actually broken. But it is the kind of small inconsistency a human reviewer skimming step order could misread as "the gate runs before the last test file is written." Not present in the original Phase 5 findings list (m1–m14), since P7.9 did not exist until this fix-up added `tests/errors.test.ts` as its own step.
- Fix: renumber so P7.8 (gate) is the last step in the P7 list, e.g. rename the current P7.8/P7.9 so the gate is P7.10, or move the gate step after P7.9 in reading order.

### n2. Step `P7.0` is used as the heading for two separate, non-contiguous paragraphs
- Where: `EXP-003-PLAN.md:154` and `:155-157`. Both paragraphs are labeled `P7.0` with no sub-letter (`P7.0a`/`P7.0b`) distinguishing them.
- What's wrong: the first `P7.0` paragraph describes writing `tests/sqlite-runtime.test.ts` from the S11 facts; the second, also labeled `P7.0`, describes the transaction-helper's commit/rollback/nesting/thenable coverage and the three-write rollback case (the evaluator-plan-review.md item 1 fix). Both are legitimate, substantive content — nothing is lost or contradictory — but one step ID now covers two distinct units of work, unlike every other `P<n>.<m>` step in the document, which is one paragraph.
- Why it matters: cosmetic only; `SPECS:616-620` and the checklist (`PLAN:246`) both reference "P7.0" generically and remain resolvable. Worth a tidy-up (e.g. split into P7.0 and P7.0b, or fold into one paragraph) so a future cross-reference naming "P7.0" unambiguously points at one paragraph.
- Fix: merge the two paragraphs under one `P7.0` bullet, or split into `P7.0`/`P7.0b`.

## Disposition of Phase 5 and evaluator-reconciliation items

Legend: changelog claim cited first (file:line, quoted briefly), then the actual body text verified against it (file:line, quoted/paraphrased).

| Item | Disposition | Evidence |
|---|---|---|
| **M1** atomicity fault point proves nothing about audit rollback | **CLOSED** | Claim: `SPECS:10` "a second fault point `test_fail_idem`... proves that an already-inserted audit row is rolled back." Body: `SPECS:622-634` (S12.1) defines fault points **F-A** and **F-I**, 8 cases = {F-A,F-I}×{create,decide,delete,restore}, with F-I explicitly described (`SPECS:625`, `:632`) as "the audit row inserted before the fault was rolled back." `PLAN:165` (P7.5) mirrors the 8-case matrix. Matches the claim exactly. |
| **M2** 413/415→400 contradicts open TODO marked DONE | **CLOSED** | Claim: `SPECS:12` "body-parser errors keep their native status... The 413/415 change from the seed's 500 is documented in break #8." Body: `SPECS:313-324` (S5.7) preserves native 400/413/415 per Fastify's own `error.code`→status table; `SPECS:543-544` (S8) adds `PAYLOAD_TOO_LARGE`/`UNSUPPORTED_MEDIA_TYPE`; `SPECS:526-530` (S7.4 break #8) documents it. Cross-checked live `docs/TODO.md:17-18`: the "Preserve 4xx status for framework errors" item is still **Open** (not yet marked done on disk), and `PLAN:206-207` (P8.5) correctly describes marking it DONE as a **future, Phase 7/13 action**, not a present claim — so there is no false-closure. |
| **m1** `errorBody` can't produce T2 message | **CLOSED** | Claim: `SPECS:13`. Body: `SPECS:306-310` adds `BODY_PARSE_ERROR_MESSAGE` constant and `bodyParserErrorResult()`; `errorBody` stays catalog-only (`SPECS:307`, explicit "no override"). |
| **m2** circular import (`ServiceResult`) | **CLOSED** | Claim: `SPECS:14`. Body: `SPECS:254` ("declared in errors.ts (m2): no errors.ts → expense-service.ts import exists"), `SPECS:302` (`ServiceResult` now defined in `errors.ts`). |
| **m3** migration robustness (3 sub-issues) | **CLOSED** | Claim: `SPECS:15`. Body: `SPECS:397-398` guards `MIGRATIONS[v]` undefined; `SPECS:400-402` re-reads `user_version` inside the per-step transaction with TOCTOU skip/regress handling; `SPECS:352` + `SPECS:394` close the DB handle before rethrowing on a too-new schema. All three sub-issues addressed in the same body section (S5.9/S6.1). |
| **m4** P6.1 pins Node only | **CLOSED** | Claim: `PLAN:29` "P6.1 pins both Node and npm." Body: `PLAN:138` — `test "$(node --version)" = "v24.21.0" && test "$(npm --version)" = "11.6.2" && npx vitest run ...`. Both pins present. |
| **m5** fault injection covers only create/delete | **CLOSED** | Claim: `SPECS:11`/`PLAN:19`. Body: `SPECS:626` "{F-A, F-I} × {create, decide, delete, restore} = 8 cases"; `PLAN:165` same 8-case list. |
| **m6** no cross-tenant restore/decision-replay test | **CLOSED** | Claim: `PLAN:30`. Body: `SPECS:672-675` (S12.3 note) lists both named cases; `PLAN:164` (P7.4) names them explicitly with the "unchanged row/audit/idempotency count" assertion. |
| **m7** "no echo" conflicts with Zod strict-mode key names | **CLOSED** | Claim: `SPECS:17`. Body: `SPECS:81` (NFR-3) — "No stack, SQL, header values, idempotency-key values or body field values are echoed... Body key names may appear... and that is allowed (m7)." `PLAN:163` (P7.3) mirrors this scoping. |
| **m8** AC-010 boundary wording ambiguous | **CLOSED** | Claim: `SPECS:18`. Body: `SPECS:663` (matrix #6) — "Both `T0+30d` and `T0+30d+1ms` are asserted in this integration test on the same tombstoned expense"; `PLAN:166` (P7.6) states the same. |
| **m9** traceability tables drift (SPECS vs PLAN) | **CLOSED** | Claim: `SPECS:19` "this table is canonical. PLAN mirrors it row for row." Verified row-for-row: SPECS S1 (`SPECS:58-73`) vs. PLAN AC Traceability (`PLAN:57-71`) — all 14 AC rows match (e.g. AC-012: SPECS "S5.7, S6.1, S7.4 / P1.2, P6.1–P6.4, P7.3, P7.7, P8.1–P8.6" = PLAN "P1.2, P6.1–P6.4, P7.3, P7.7, P8.1–P8.6 / S5.7, S6.1, S7.4"; AC-013: SPECS "S3.3, S15 / P6.3, P7.8, P9.1" = PLAN "P6.3, P7.8, P9.1 / S3.3, S15"). No drift found. |
| **m10** undocumented break from header charset | **CLOSED** | Claim: `SPECS:20`. Body: `SPECS:517-521` (S7.4 break #3) documents the charset consequence explicitly, with the exact tier (T6, `ACTOR_MISMATCH`) and precedence notes. |
| **m11** same-tenant existence disclosure not listed as accepted limit | **CLOSED** | Claim: `SPECS:21`. Body: `SPECS:685` (S13 table, "Info disclosure (same tenant)" row) documents it as an accepted limitation with the design citation (`architecture-notes.md:299-303`). |
| **m12** thenable guard can't contain async `work` | **CLOSED** | Claim: `SPECS:22`. Body: `SPECS:238-249` (S5.4) makes the compile-time `NotPromise<T>` constraint mandatory and documents the residual risk explicitly (`SPECS:249`, mitigation: Phase 8 code review checks for async/await/.then). |
| **m13** AC-012 before/after evidence gaps | **CLOSED** | Claim: `SPECS:23`/`PLAN:34`. Body: `PLAN:150` (P6.4, new step) — explicit break-1-to-8 → after-test → before-evidence map requirement. |
| **m14** docs/ledger hygiene (3 sub-issues) | **CLOSED** | Claim: `SPECS:23`/`PLAN:35`. Body: (a) `PLAN:186` (P8.1) lists breaks, citing `architecture-notes.md:193` directly; (b) `PLAN:175` section header now reads "P8 Documentation (two passes, per evaluator-plan-review.md item 3 — explicit, not 'Phase 7 tail or ∥ P7')" — ambiguity resolved; (c) `coding-flow-state.md:63` annotates the stale "Phase3 remains NOT APPROVED" checkpoint as historical, pointing to the current Phase Log row. |
| **evaluator item 1** (M1/M2 disposition, 3-write rollback test, accurate proof language) | **CLOSED** | Claim: `PLAN:19`. Body: `SPECS:617-620` (S12.1) — "a callback that writes expense, audit and idempotency rows then throws. The last case snapshots all three tables and verifies all writes roll back. BEFORE-insert route fault tests alone do not prove rollback of an idempotency row that was never inserted." `PLAN:154-157` (P7.0) implements this. Proof language matches the evaluator's own requested wording almost verbatim. |
| **evaluator item 2** (Phase 7 excludes tests; P0 pinned ignored probe; P6 moved to Phase 11) | **CLOSED** | Claim: `PLAN:21`. Body: `PLAN:5-12` (explicit phase/step mapping), `PLAN:87-95` (P0 "creates no file under `tests/` — not even a skipped one"), `PLAN:134-136` (P6 section header: "Corrected per evaluator-plan-review.md item 2: baseline test editing... belongs in Phase 11"). |
| **evaluator item 3** (explicit phase/dependency table; no hiding behind "Phase7 tail or ∥ P7") | **CLOSED** | Claim: `PLAN:22`. Body: `PLAN:5-12` phase mapping, `PLAN:78-85` (File Ownership and Sequencing, explicit execution order), `PLAN:175-178` (P8 two-pass split spelled out). |
| **evaluator item 4** (HANDOFF.md required) | **CLOSED** | Claim: `PLAN:23`. Body: `HANDOFF.md` exists in full, with current status, references, next gate, and an explicit "grants no approval" framing (`HANDOFF.md:3`). |
| **evaluator item 5** (restore window nonnegative bound; SUBMITTED repository predicate) | **CLOSED** | Claim: `PLAN:24`. Body: `SPECS:230-232` (S5.3) — explicit `[0,30d)` bound, negative-elapsed throw, added `status !== "SUBMITTED"` clause with rationale; `SPECS:341` (S5.8) — repository `restore()` SQL adds the matching `status = 'SUBMITTED'` predicate. Both tiers covered as requested. |
| **evaluator item 6** (mandatory compile-time non-Promise constraint, no fallback) | **CLOSED** | Claim: `PLAN:25`. Body: `SPECS:241` "the compile-time constraint is mandatory"; `SPECS:248` "Never weaken to unrestricted `work: () => T`." |
| **evaluator item 7** (terminology: 3 distinct concepts) | **CLOSED** | Claim: `PLAN:26`. Body: `SPECS:33-37` (changelog addendum) spells out the three concepts (business authorization / Rosetta HITL gates / host tool permissions) verbatim; `SPECS:84-85` (S2) and `PLAN:51` (Governing Rules) restate the same distinction. |
| **evaluator item 8** (ledger correction, stale checkpoint historical) | **CLOSED** | Claim: `PLAN:27`. Body: `coding-flow-state.md:63` (correction note) + Phase Log row 16 (current, APPROVED). Matches `HANDOFF.md:7-8`'s identical framing. |
| **evaluator item 9** (OI-1/OI-2 item 7 reworded as proposed, not decided) | **CLOSED** | Claim: `PLAN:28`. Body: `PLAN:220-233` (Open Items) — both headed "proposed safe defaults carried forward for Phase 6 author confirmation... not yet an author decision"; `docs/EXP-003-COMPATIBILITY.md:3,25,30` repeats the same framing in the standalone artifact. |
| **OI-1** (BASELINE-API.md) | **CLOSED, correctly framed as PROPOSED** | `PLAN:224` "Proposed default: zero edits... Append-only... only if the human explicitly opts in at Phase 6." Not claimed as decided anywhere I found. |
| **OI-2 / item 7** (413/415 superseded by M2) | **CLOSED, correctly framed as PROPOSED** | `PLAN:232` "~~mapped to 400~~ — superseded by M2... this is the proposed default (also carried into Phase 6 for confirmation, not yet decided)." |
| **Internal consistency: SPECS S1 vs PLAN AC table** | **CLOSED** (no drift) | See m9 row above — all 14 rows cross-checked. |
| **Internal consistency: SPECS-referenced PLAN step IDs exist** | **CLOSED**, with 2 new cosmetic issues (n1, n2 above) | Checked `P7.0` (`SPECS:616-617`), `P7.4` (`SPECS:673`), `P8.3` (`SPECS:513`), `P0` (`SPECS:605`) — all resolve to real PLAN steps. Ordering/duplication issues (n1, n2) are cosmetic, not broken references. |
| **Approval-status accuracy** | **CLOSED**, consistent | `coding-flow-state.md` Phase Log row 16 ("APPROVED... 'Yes, I reviewed the design.'") = `HANDOFF.md:7` (same sentence, same framing) = `SPECS:3`/`PLAN:3` ("approved at Phase 3, controlling... still awaiting Phase 6 HITL"). No phase beyond 6 claimed started anywhere (ledger Phase 7-13 rows all PENDING). |

## Requested-checks summary

- 0 of the 2 Major findings remain open.
- 0 of the 14 Minor findings remain open.
- 0 of the 9 evaluator-reconciliation items remain open.
- 2 new Minor (cosmetic-only) issues found in the fix-up itself (n1, n2 above), neither a semantic regression nor a broken cross-reference.
- No drift from the approved Revision 2 design or the 3 human policy decisions was found anywhere in the current document bodies.

## Evaluator disposition — 2026-10-14 (original review above preserved)

- n1 corrected: error-contract tests are P7.8; the full gate is P7.9, last in reading order.
  SPECS and PLAN AC-013 references were updated together.
- n2 corrected: the helper coverage paragraph is a continuation of one P7.0 bullet.
- Evidence correction: the reviewer used static shell reads/searches of planning documents
  (`sed`, `rg` and similar). Therefore the original sentence "No command was run" is inaccurate.
  No feature runtime probe, application test, product edit or dependency change occurred.
- These are document-review dispositions, not passing feature tests or author Phase6 approval.
