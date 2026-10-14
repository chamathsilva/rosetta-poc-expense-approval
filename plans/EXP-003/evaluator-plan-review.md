# Evaluator plan reconciliation — reviewed, author plan approval pending

AI evaluator review after the independent Phase5 report; not an author approval.
Preserve that report and the initial/delivered artifacts. No feature code/test-suite changes.

2026-10-14: actor revisions were preserved privately before the evaluator corrected remaining
stale text, premature closure claims, exact traceability and planned coverage. The numbered findings
below remain the original review checklist; the Sonnet re-review and final cosmetic dispositions
are recorded in phase5-rereview.md, not author approval. The additional
post-three-write rollback test is planned, not executed. Source/test/dependency preservation is checked.

## Required corrections before Phase6

1. Resolve the report's M1/M2 and minor findings with an explicit disposition for each. Add late
   idempotency-save fault coverage for all four mutations, not only create/delete. Describe the
   proof accurately: a BEFORE-idempotency-insert fault proves earlier state/audit rollback, while
   no idempotency row was inserted. If claiming all three writes roll back, add a transaction-helper
   test that writes all three and throws afterwards. No production fault hook needed.
2. Align with the frozen full coding-flow: Phase7 excludes tests; feature/baseline test writing is
   Phase11 after Phase10 approval unless TDD was requested (it was not). Make P0 a pinned ignored
   mechanical smoke probe, with formal smoke tests in Phase11. Move P6 baseline test edits/gates to
   Phase11. Phase7 ends with build/manual implementation validation, not a falsely green full suite.
3. Initial product docs must reflect implementation before code review (Phase8). Later test counts
   and validation results update after tests run. Make the dependency/phase table explicit; do not
   hide this split behind P8 “Phase7 tail or parallel with Phase11.”
4. Add HANDOFF.md as required by the loaded planning skill for a single-session plan. Include
   current factual status, references, next gate, preserved findings and no implied future approval.
5. The author-approved restore window is [0,30d). Current policy labels that half-open but admits
   negative elapsed time. State an explicit nonnegative bound/invalid-clock policy and test it.
   Restore must check SUBMITTED, including a repository predicate, rather than relying only on
   the historical assumption that every tombstone is submitted.
6. Keep a compile-time non-Promise callback constraint, plus the honest runtime limitation from
   report m12. The evaluator's pinned TypeScript7 CLI checks found that the original conditional
   signature preserves number/void/throwing return inference and rejects async/mixed-Promise
   callbacks in the tested cases. The relaxed work:()=>T signature permits both and triggers two
   unused @ts-expect-error diagnostics. Do not assert the original is broken without evidence.
7. Keep messages implementable by their helper contracts (report m1); narrow “no echo” to actual
   sensitive values, not every property name (m7). Distinguish expense business authorization,
   Rosetta design/plan/implementation review gates, and host tool permissions in terminology.
8. Update current design/ledger approval status while marking old checkpoints historical. Include
   current README/API usage documentation and all compatibility breaks, not stale seed examples.
9. Author choices are pending: separate compatibility doc versus baseline append permission, and
   preserved400/413/415 versus flattening parser statuses. Present proposed safe defaults without
   claiming the author answered. No plan/implementation approval follows from this review.

## Evidence / boundaries

- Phase5 report contains two Major and fourteen Minor findings; keep its original verdict even
  after remediation. This evaluator adds workflow/handoff and remaining semantic consistency checks.
- Type diagnostics used evaluator-owned ignored scratch fixtures, not app source or suite tests.
  Initial compiler-API setup failed accessing `ts.ScriptTarget.ES2024` through the attempted import;
  this does not establish that every compiler API is unavailable. CLI required --ignoreConfig.
  Those attempts were retained.
  Both constrained candidates exit0 on the tested cases; unconstrained candidate reports TS2578;
  a deliberately invalid-number control reports TS2322. These are typing checks, not runtime
  transaction/atomicity proof. Exact logs/fixtures remain privately retained for reconciliation.
