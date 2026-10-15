# EXP-003 AC-011 correction follow-up

Date: 2026-10-15 (America/Chicago).
Status: **Phase 6 (User Review Plan) APPROVED directly in this session, 2026-10-15** — the human
author's own message: "Yes, I approve plans/EXP-003/AC-011-FOLLOWUP-PLAN.md, including early
router rejection. I authorize the Codex coordinator to resume this session and coordinate
execution. Record this approval only, then stop without implementation." This supersedes the
coordinator-chat relay below, which the actor declined under its interpretation of `hitl`.
The skill does not explicitly require same-terminal approval. The approval-recording turn was
record-only; implementation subsequently ran on coordinator resumption. Current status:
implemented and reviewed; Phase10 human implementation approval received; remaining native
review/validation complete with204 tests/typecheck/build passing. Coordinator verification
also passes204. Local commit is authorized; push/publication remains pending. See AC-011-FOLLOWUP-REPORT.md and the
ignored ledger for chronology and qualifications.

## Historical resume attempt — 2026-10-15 (resolved by direct approval above)

After the author closed the original terminal and authorized coordinator-controlled resumption,
the coordinator resumed the same saved Claude task with the existing settings. Pinned runtime
checks returned Node24.21.0/npm11.6.2. Installed Claude was2.1.300 (previous checkpoint2.1.299);
the Rosetta3.1.13 cache still matched the frozen artifact, excluding README.md/.in_use.

Claude refused the relayed approval at07:06:42 UTC. After the coordinator pointed out that
the frozen HITL rule does not say "typed directly" or "in this session", Claude acknowledged
that those words were its paraphrase at07:08:36 UTC, but maintained the refusal as its
interpretation of the approval boundary. No implementation, tests or reviews ran. The
coordinator exited the idle process normally and verified source/tests/dependencies/settings
were unchanged. Human approval in the coordinator chat remains recorded; native acceptance
of that approval remains unresolved. This is actor interpretation, not demonstrated hook or
host enforcement. The native transcript preserves both responses.

Next at that historical checkpoint: obtain a direct author approval event in the saved Claude task, record it without starting
implementation, and exit. The coordinator can then resume the same task for the approved work.
Do not invent a direct author message or opt out of HITL to bypass this observed limitation.

## Approval and provenance

The author replied, "This plan is good.", to the coordinator's concrete proposal to customize
the oversized-parameter response and explicitly document its pre-authentication rejection.
This is a human approval relayed by the AI coordinator, not a direct event in the Claude
transcript. Do not attribute coordinator messages or tool approvals to the human.

Preserve the original published checkpoint `51d282b7879d01c771e6b56401005b5b7978e374`, its
187-test result, and its partial AC-011 assessment. This is a separately reviewed correction
and specification clarification, not proof that the original implementation met the contract.

## Evidence and approved behavior

Read-only inspection found that Fastify 5.12.4's default `onMaxParamLength` sends HTTP 414
and includes the submitted path in its message. Routing rejects the parameter before
`registerActorHook`, body parsing, route handlers, or `expenseParamsSchema` run.
The existing access test asserts only the 414 status for a 101-character identifier.

Keep the router's 100-character parameter limit. Configure the dedicated
`routerOptions.onMaxParamLength` callback to send HTTP 400 with the existing fixed
`errorBody("VALIDATION_ERROR")` envelope. Do not echo the path or other request values.
Confirm the installed callback signature and raw Node response behavior before coding.
Avoid a broad framework-error override, increasing the limit, or relaxing the schema.

Explicit approved clarification: a parameter rejected by the router returns the safe 400
response before authentication, body parsing, or idempotency-key validation, including when
those inputs are also invalid. T1–T9 continue to describe requests successfully routed to
the application. This is a narrow pre-routing exception, not a claim of unconditional
authentication-first processing. Transport/parser-level failures are not normalized by this
callback. Unknown routes retain existing behavior except where the router itself selects
its oversized-parameter callback; characterize that boundary rather than promising otherwise.

## Scope and execution ownership

- Claude Code remains the implementation actor; Codex coordinates and reviews evidence.
- Use the existing saved task and frozen full Rosetta 3.1.13 setup. Preserve existing account,
  model/effort/permissions/MCP settings and the pinned Node 24.21.0/npm 11.6.2 runtime.
- Record actual host version and any drift before work. Do not switch accounts or update tools.
- Expected code changes: `src/app.ts` and `tests/access.test.ts` only. A shared test fixture
  change is allowed only if necessary and explained. No dependencies, lockfile, database
  schema, business policies, seed refs, or `docs/BASELINE-API.md` changes.
- Use the existing Rosetta workflow to implement, review, test and validate the bounded
  follow-up. Do not restart the three-project study or silently mark new semantic gates approved.
- Write a separate follow-up report and logs. Add clearly dated current-state clarifications
  to specs S4/S5.12/S13, compatibility notes, architecture and handoff as needed. Correct stale
  current-status text in touched documents; preserve historical review reports and evidence.

## Acceptance and verification

1. Exercise all four parameterized expense operations: GET, PATCH decision, DELETE, POST restore.
2. Test 99/100-character valid identifiers with deterministic fixtures where useful and verify
   they are not rejected for length. Test 101 and a larger bounded value (for example 1024).
3. Over-limit requests return 400 with the exact safe code/message envelope and JSON content
   type. Sentinel path, headers, key and payload values must not appear in the response.
4. Mixed-invalid requests demonstrate the approved early 400 (missing/bad auth, bad key or
   malformed body); normally routed requests retain their existing 401 and 400/413/415 order.
5. Use before/after assertions to show rejected mutations leave expenses, audit and idempotency
   storage unchanged. Confirm normal `/health`, unknown-route and lifecycle behavior.
6. Cover encoded path length and the generated HEAD route's status/body behavior; characterize
   actual router selection without introducing URL normalization or new endpoint policy.
7. Preserve a failing regression against unchanged code, then the corrected focused tests and
   full `npm run check` output. Verify runtime versions explicitly. No fixed new test count.
8. Review code and docs before final acceptance. Coordinator independently checks the diff and
   runs the full gate. Do not claim tests or review succeeded until evidence exists.

## Close-out and publication

Stop the native actor with a reviewable diff, reports, test evidence and any remaining findings;
do not have it commit, push, create a tag, merge, or claim human implementation acceptance.
The coordinator then records original-versus-corrected behavior, residual boundaries and exact
commit mapping, performs the privacy/identity checks, and publishes a separate follow-up commit
under Chamath using the already-authorized publication workflow. Keep original manifests and
hashes historical; add supplemental records rather than overwriting baseline evidence.
If actual changes require broader scope, report it before proceeding.

After verified close-out: cross-project evidence table, Article 1 review gates, then Articles 2/3.
