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

## AC-011 follow-up (2026-10-15)

- Plan: `plans/EXP-003/AC-011-FOLLOWUP-PLAN.md` (oversized-parameter router rejection: 414 → 400
  `VALIDATION_ERROR` via `routerOptions.onMaxParamLength`, a narrow pre-authentication exception;
  scope limited to `src/app.ts` + `tests/access.test.ts`).
- Phase 6 (User Review Plan): **APPROVED.** Human author, direct message in this session
  (2026-10-15): "Yes, I approve plans/EXP-003/AC-011-FOLLOWUP-PLAN.md, including early router
  rejection. I authorize the Codex coordinator to resume this session and coordinate execution.
  Record this approval only, then stop without implementation." Three earlier relay attempts to
  satisfy this gate via a "Codex AI coordinator" message (reporting approval given to Codex in a
  separate chat, not to this session) were declined as not meeting the direct-approval bar; the
  gate was resolved only by the author's own direct statement above. Codex is authorized to
  coordinate execution going forward; this does not transfer approval authority — future gates
  still require the author's own direct statement in this session.
- Phase 7 (Implementation): **DONE.** Codex coordinator, authorized directly by the author's
  Phase 6 message above to coordinate execution, directed the orchestrator to resume
  implementation. `src/app.ts` now rejects an over-length route param with a safe 400
  `VALIDATION_ERROR` envelope via `routerOptions.onMaxParamLength`, instead of Fastify's
  default 414. Genuine failing-before/passing-after regression pair captured against
  unmodified vs. corrected `src/` (`plans/EXP-003/evidence/AC011-before.txt`,
  `AC011-after.txt`), independently re-derived by the Phase 8 reviewer via `git stash`
  (confirmed byte-for-byte match, not fabricated).
- Phase 8 (Review Code): **DONE.** Independent reviewer (fresh context, no implementer
  knowledge), verdict **request-changes** on the first pass. Confirmed sound: scope discipline
  (only `src/app.ts`/`tests/access.test.ts` changed), the failing-before/passing-after pair,
  router-precedence over missing-auth/missing-key/malformed-body, and the encoded-path
  characterization. Found 1 genuine implementation defect (HEAD responses from the
  router-rejection path carried a body, violating HTTP HEAD semantics — Fastify's normal
  route-handler path correctly strips HEAD bodies, but the raw-response `onMaxParamLength`
  callback bypassed that) plus 1 missing test (PATCH-decision before/after unchanged-storage
  case) and 2 stale-documentation gaps (this file and `docs/EXP-003-COMPATIBILITY.md` not
  yet updated to reflect implementation). All four fixed directly: HEAD callback now
  explicitly special-cases `req.method === "HEAD"`; PATCH-decision before/after test added;
  both docs updated. Two raised "coverage concerns" (broader sentinel no-echo coverage;
  globally-scoped vs. per-id `rawCounts`) were independently assessed by the reviewer and
  confirmed non-issues for current correctness, with code-level reasoning (the callback never
  references the request, and no code path reaches the database before a router-level
  rejection) rather than taken on faith either way.
- Gate after fixes: **203/203 tests passing**, clean typecheck/build (independently
  re-counted via `npx vitest run --reporter=verbose`, not inferred by diff arithmetic).
  `plans/EXP-003/evidence/AC011-check.txt`. Scope confirmed unchanged beyond `src/app.ts` +
  `tests/access.test.ts` + this file + `docs/EXP-003-COMPATIBILITY.md` + the plan/evidence
  files — no dependency, schema, or policy changes. Full Phase 8 review persisted at
  `plans/EXP-003/ac011-phase8-review-findings.md`, matching the established findings-file
  pattern for this project.
- Phase 10 (User Review Impl): **APPROVED.** Human author, direct message in this session
  (2026-10-15): "Yes, I approve the AC-011 implementation and reviewed findings in
  AC-011-FOLLOWUP-REPORT.md, including the disclosed deviations. I authorize Codex to
  coordinate remaining validation. Record this approval only, then stop." Before recording,
  independently checked rather than taken on faith: file hashes for `src/app.ts`/
  `tests/access.test.ts` match `AC-011-FOLLOWUP-REPORT.md`'s claims exactly (Codex touched
  only docs/evidence); its doc edits are consistent with facts already established in this
  session; its independent gate run matches 203/203; its permission-mode-changed-to-auto
  claim is independently corroborated (this orchestrator directly observed that mode-change
  system notice earlier in this session). Codex is authorized to coordinate remaining
  validation — coordination, not approval, authority; future gates still require the
  author's own direct statement.
- Phase 12 (Review Tests): **DONE.** Second independent reviewer (fresh context), dedicated
  test-quality pass distinct from Phase 8's code-correctness lens. Verdict
  **request-changes**, 2 Major (a weak malformed-body-precedence assertion that could pass
  for the wrong reason; an unknown-suffix boundary the follow-up report accurately described
  as manually, independently probed but which had no codified regression test — a
  test-coverage gap, not an inaccuracy in the report), 1 Minor (left as-is, independently
  reasoned as a
  non-issue by both reviewers). Both Major items fixed directly. Findings:
  `plans/EXP-003/ac011-phase12-review-findings.md`.
- Phase 13 (Final Validation): **DONE.** `npm ci && npm run check` under the pin:
  **204/204 tests passing**, clean typecheck/build, lockfile unchanged
  (`plans/EXP-003/evidence/AC011-ci-check.txt`). `EXP-003-REQUIREMENT-MAP.md`'s AC-011 row
  updated from "Partial (router 414 exception)" to "Full," history preserved, not deleted.
- **All applicable phases of this bounded follow-up are complete.** Uncommitted, unpushed,
  untagged, unmerged, unpublished. No further native work proceeds without a genuinely new
  human decision — this is a completion record, not a claim of any further approval.
  See `agents/TEMP/EXP-003/coding-flow-state.md` for the full ledger entry.

## What's pending

Current AC-011 follow-up: implementation and tests are locally complete; Phase10 human review
is approved and native test review/final validation are complete. Formal tests were initially
written before that gate; review corrections and final verification followed it. Native clean
install/check and coordinator verification pass204 tests/typecheck/build. Publication is pending. See the dated
AC-011-FOLLOWUP-REPORT.md for actual workflow deviations and supplemental evidence. Native
permission mode changed to auto during coordinator prompt handling; do not describe this
follow-up as manual-mode throughout. The coordinator exited the process; any later resume must
explicitly use the original default/manual mode. Direct-terminal approval was actor interpretation,
not a literal requirement in the frozen HITL wording. The initial result below remains historical.

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
