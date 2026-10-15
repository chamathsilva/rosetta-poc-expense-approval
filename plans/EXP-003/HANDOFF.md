# EXP-003 Handoff

Required by the `planning` skill for a single-session plan and by `plans/EXP-003/evaluator-plan-review.md` item 4. This file states current factual status only — it grants no approval and implies none for the future.

## Current status (as of 2026-10-14)

- Phase 3 (User Review Design): **APPROVED.** Human author's exact sentence, recorded verbatim: "Yes, I reviewed the design." Given after Design Review Revision 2 plus the evaluator's consistency reconciliation. Approved design of record: `plans/EXP-003/architecture-notes.md` → `## Design Review Revision 2` + `### Evaluator consistency reconciliation`.
  - A later checkpoint note appended to `agents/TEMP/EXP-003/coding-flow-state.md` ("Evaluator design checkpoint (2026-10-13)") states "Phase3 remains NOT APPROVED" — that note was written **before** the human's approval sentence arrived and is historical/stale, not the current status. See the ledger's annotation.
- Phase 4 (Tech Plan): DONE. `plans/EXP-003/EXP-003-SPECS.md` + `plans/EXP-003/EXP-003-PLAN.md`.
- Phase 5 (Review Plan): DONE. `plans/EXP-003/phase5-review-findings.md` — approve-with-minor-fixes, 0 Critical / 2 Major / 14 Minor.
- Fix-up: actor revisions were retained privately before evaluator reconciliation on 2026-10-14.
  Further stale-body, traceability, sequencing and premature-completion defects required evaluator
  corrections. Independent Sonnet re-review found no Critical/Major issues and marked the original
  findings addressed in the document bodies; two new cosmetic findings were then corrected by the
  evaluator. See phase5-rereview.md, including the static-command evidence correction. This is a
  planning review only, not feature acceptance or author approval.
- Phase 6 (User Review Plan, HITL): **APPROVED.** Human author, typed directly in this session
  (2026-10-14): "Yes, I reviewed the plan and specs. Keep BASELINE-API.md unchanged, use separate
  compatibility notes, and preserve HTTP 400/413/415. Proceed with the original implementation
  plan and stop at Phase10 for my review." Two earlier attempts to satisfy this gate via cross-host
  relay — a quoted Codex transcript line ("approved. what should be the next") and an
  evaluator-paraphrased "can u start the work" — were explicitly declined as not meeting the
  actor's interpretation of the `hitl` skill as requiring direct in-session approval. Those
  refusals remain historical observations; the skill does not expressly mandate same-terminal
  approval, so they are not independently classified as correct enforcement. OI-1 and OI-2 item 7 are confirmed per the
  author's message (see below). The earlier literal "1" messages remain evaluator UI mistakes,
  not author approval; unaffected by this entry.
- Phase 7 (Implementation): **DONE.** P0 (pinned scratch probe, all 10 SPECS S11 runtime facts
  PASS) plus P1–P5 (`src/` implementation) by an engineer subagent, independently re-verified by
  the orchestrator (build, diff scope, two central contract claims read directly from source).
- Phase 8 (Review Code): **DONE.** Independent reviewer, approve-with-minor-fixes, 0 Critical/
  0 Major, 2 cosmetic notes deferred. Findings persisted at `plans/EXP-003/phase8-review-findings.md`.
- Phase 9 (Impl Validation): **DONE.** Independent validator drove live runtime assertions across
  5 throwaway scripts against the real app; 0 bugs found. Corrected total: **78/78 PASS**
  (43 + 12 + 11 + 3 + 9, by script) — the subagent's own report had mis-summed this as "65/65";
  the orchestrator reconciled it on 2026-10-14 by re-running all 5 scripts from a clean rebuild
  and summing each script's own printed total. Findings (with the correction noted) persisted at
  `plans/EXP-003/phase9-validation-findings.md`.
- **Workflow finding (2026-10-14):** the AI evaluator caught that P8 Pass 1 documentation should have
  run *before* Phase 8/9 per PLAN.md's own sequencing, not after; the author relayed the feedback.
  Corrective action taken: P8
  Pass 1 (P8.1–P8.7) was written and independently reviewed against the real `src/` code; 2 Major
  doc-accuracy findings (missing module in an ARCHITECTURE.md table; a self-contradictory test-count
  sentence in IMPLEMENTATION.md) were found and fixed, plus 1 minor stale cross-reference. `src/`,
  `tests/`, and config remained untouched throughout the doc pass (verified by diff). The Phase 8/9
  code findings themselves are unaffected — only the documentation timing was out of order.
- Phase 10 (User Review Impl, HITL): **APPROVED.** Human author, direct message in this session
  (2026-10-14): "Yes, I approve the implementation. Proceed with Phase 11 according to the
  original plan." Three cleanup items requested alongside approval, all completed before Phase 11
  started: (1) Phase 9 count reconciliation (65/65 → 78/78, see above); (2) an evaluator-vs-author
  attribution error in the ledger's "Probe-provenance correction" note (had said "the evaluator
  (human)," contradicting the ledger's own later note that the evaluator is AI, not human; fixed
  initially reattributed to the human author using the false premise that only humans can act
  on permission prompts. Coordinator close-out corrects this: the AI evaluator sent scoped tool
  approvals/cancellations, as distinct from the author's design/plan/implementation approvals); (3) the P8 Pass 1 documentation-review report persisted as a durable
  file, `plans/EXP-003/phase8-docs-review-findings.md`, matching the Phase 8/9 pattern.
- Phase 11 (Tests): **DONE.** P6 (6 baseline cases migrated) + P7.0-P7.8 (9 new test files, 185
  tests total: `support.ts`, `sqlite-runtime.test.ts`, `policy.test.ts`, `fingerprint.test.ts`,
  `errors.test.ts`, `migration.test.ts`, `access.test.ts`, `audit.test.ts`, `lifecycle.test.ts`).
  `npm run check` (typecheck + test + build) is green: **185/185 tests passing**, independently
  re-run by the orchestrator with identical results. Zero `src/`/config/dependency changes.
  Evidence: `plans/EXP-003/evidence/P6-baseline-before.txt`, `P6-baseline-edits.md`, `P7-check.txt`.

- Phase 12 (Review Tests): **DONE.** Independent reviewer independently re-ran the gate itself,
  then reviewed coverage/correctness/isolation. approve-with-minor-fixes: 1 Major (missing
  401-precedence tests for oversize/unsupported-media-type bodies, per PLAN P7.8) fixed directly
  by the orchestrator; 3 Minor accepted as-is. Gate now **187/187 passing**, clean typecheck/build.

- Phase 13 (Final Validation): **DONE.** P9.1 clean-install gate (`npm ci && npm run check`) run
  by the orchestrator: lockfile untouched, 187/187 passing, clean typecheck/build. P9.2
  requirement map (`plans/EXP-003/EXP-003-REQUIREMENT-MAP.md`, 39 rows covering all REQUEST.md
  requirements + all 14 ACs) and P8 Pass 2 doc updates (`docs/ARCHITECTURE.md`'s Testing section,
  `agents/IMPLEMENTATION.md`'s test-count note) written by an independent validator subagent, who
  also re-read all `src/`/`tests/` files in full as manual QA. One process gap it honestly
  flagged — Phase 12 had no standalone findings file, unlike every other phase — closed by the
  orchestrator: `plans/EXP-003/phase12-review-findings.md`.

## What's pending

The actor completed the implementation/test workflow; the final gate is green (187/187 tests,
clean typecheck/build). Coordinator close-out corrects reporting and attribution, preserves
original artifacts, and documents remaining evidence gaps in `COORDINATOR-CLOSEOUT.md`.
Publication/remote verification is separate from the actor's local completion; the article series
is not complete merely because this POC passes its tests.

## References

- Design: `plans/EXP-003/architecture-notes.md`
- Specs: `plans/EXP-003/EXP-003-SPECS.md`
- Plan: `plans/EXP-003/EXP-003-PLAN.md`
- Phase 5 findings: `plans/EXP-003/phase5-review-findings.md`
- Evaluator reconciliation: `plans/EXP-003/evaluator-plan-review.md`
- Phase 8 code review: `plans/EXP-003/phase8-review-findings.md`
- Phase 9 impl validation: `plans/EXP-003/phase9-validation-findings.md`
- P8 Pass 1 documentation review: `plans/EXP-003/phase8-docs-review-findings.md`
- Phase 12 test review: `plans/EXP-003/phase12-review-findings.md`
- Requirement map (AC-014): `plans/EXP-003/EXP-003-REQUIREMENT-MAP.md`
- Compatibility notes (implemented): `docs/EXP-003-COMPATIBILITY.md`
- Ledger: `agents/TEMP/EXP-003/coding-flow-state.md`
- Original request + ACs: `plans/EXP-003/REQUEST.md`
