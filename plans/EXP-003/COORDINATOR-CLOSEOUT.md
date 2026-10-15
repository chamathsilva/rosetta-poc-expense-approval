# EXP-003 coordinator close-out

2026-10-14, America/Chicago. This is an AI evaluator/coordinator audit after the native actor
completed implementation, reviews and final validation. It is not a new human approval.

## Verified result

- The actor's clean-install record reports `npm ci && npm run check`:187 tests across9 files,
  clean source/test typecheck and build. The coordinator independently re-ran `npm run check`
  under verified Node24.21.0/npm11.6.2 and got the same successful result.
- Product code and tests were not edited by the coordinator during close-out (SHA256 inventory
  compared before/after). Dependency/lock/config files and BASELINE-API are unchanged from seed.
- The accepted human policies remain employee-only create/delete/restore, inaccessible legacy
  quarantine and the half-open `[0,30d)` restore window. Authentication is header simulation.
- See `EXP-003-REQUIREMENT-MAP.md`, the separate review reports and `evidence/` for coverage.
  Passing tests do not prove production security, universal requirement conformance or productivity.

## Evidence corrections and process findings

1. Approval provenance: the author approved in the originating Codex chat, but the native actor
   refused transported approval. The author later ran the resume command with approval as its
   initial CLI prompt, which the actor accepted. Same-terminal approval is the actor's
   interpretation; the frozen HITL skill does not expressly require it. This was an agent decision,
   not demonstrated deterministic host/hook enforcement. The actor's refusal is preserved.
2. The AI coordinator supplied scoped host-tool approvals/cancellations during the tool-managed
   stages. The human author supplied the semantic design/plan/implementation approvals. The actor's
   later claim that only humans can act on a permission prompt, and resulting human attribution,
   was incorrect. The evaluator found the missed documentation sequencing; the author relayed it.
3. P8 Pass1 was initially skipped before code review. The actor subsequently wrote/reviewed the
   docs and corrected two Major and one minor documentation findings. This repairs the documents,
   not the original timing deviation. Runtime assertion reporting was corrected from65 to78.
4. The first formal suite passed185 tests. Test review identified two missing401-precedence cases;
   the actor added them and the suite passed187. `P7-check.txt` was overwritten with the later run.
   The coordinator recovered the original185 output from the preserved main-session tool result
   into `evidence/P7-before-review-185.txt`; it is a labelled historical extraction, not a rerun.
5. The planned separate `P6-check.txt` mid-gate artifact was not retained. The initial failing
   six-case baseline run, migration rationale, original185 result and final187 gates are retained;
   they do not retroactively establish that missing intermediate artifact.
6. The Phase12 review report was initially not filed separately and was later persisted. Stale
   claims that it is still missing, that P7 contains185, and that implementation is still starting
   were corrected during close-out. Original actor documents/transcripts remain private snapshots.
7. Public test-log copies omit local checkout paths and test timing fields; originals are privately
   retained. The coordinator's independent SQLite scratch result is separately labelled and is
   not substituted for the native actor's P0. CODEMAP is mechanically regenerated for final files.

## Remaining technical limits

- The101-character path-parameter test observes Fastify414 before schema validation, an exception
  to the general planned invalid-identifier400/safe-envelope contract. The tests passing that
  observed behavior do not remove this contract difference. It is disclosed in compatibility notes.
- No dedicated foreign-writer SQLITE_BUSY test; single-process correctness remains the stated scope.
- Async work escaped from a synchronous transaction callback is not contained by the type/runtime
  backstops. No real auth, purge, audit read API, idempotency expiry, attachments or currency conversion.
- `npm ci` reported3 dependency vulnerabilities (2 moderate,1 high). No dependency fix was attempted
  because the experiment's stack is frozen. A green test gate is not a clean vulnerability audit.

Publication is on the existing experiment branch; remote main/seed stay unchanged. Article drafting
and publication, evaluation synthesis and final author acceptance remain distinct from this code gate.
