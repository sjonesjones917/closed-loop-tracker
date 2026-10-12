# Complete-system repair — continuation, 2026-10-12

This note is separate from `complete-system-repair-20261007.md` on purpose: that record's digest is bound by the
2026-10-11 handoff publication, so it is left byte-for-byte unchanged. Everything here is limited to what was
observed. Local runs used Node 22.22.0 on 2 CPUs (CI pins 22.23.3) and are **not** CI-equivalent.

## Concurrent change and hosted result

- 75bcc721 ("Publish scoped repair handoff and correct verification boundaries", pushed 2026-10-12T08:36Z by the
  repository owner) replaced the earlier head 9ff2d617. It started run 38224620857.
- 38224620857 (head 75bcc721): foundation, deferred-matrix, workflow-gates, conformance-counterpart and
  conformance-creation succeeded. conformance-core failed at "Execute complete conformance group" after 6 min 51 s
  (12:29:07–12:35:58Z) and `test` failed behind it; deploy, live verification and publish-status were skipped.
- The check annotations carry only "Process completed with exit code 1"; hosted logs and uploaded reports are
  not readable from the review session, so **the failing core suite is not identified**. The runner stops at its
  first failing gate, and the counterpart/creation groups run the same runner-contract first and passed.
- Not reproduced: the same head's first core suite (`verify-executed-evidence.mjs`, after the three ownership
  producers) passes locally. The cause of the hosted core failure is therefore unproven.

## Local findings and repairs (rebased onto 75bcc721)

The earlier local commits were rebased onto 75bcc721. Two overlaps were resolved without discarding either side:

- Runner descendant control: the owner's readiness-based trigger replaces my wider wall-clock budget for the same
  oracle. The owner's handoff validator pins the retained automatic deadlines (stalled gate 250 ms, nested timeout
  case 1500 ms); my earlier widening of those two values made the runner-contract report fail that validator
  (`CONFORMANCE_RUNNER_AUTOMATIC_DEADLINE_ORACLE`, 1500 !== 250). Only those two values are restored; all other
  budget changes remain. Both outcomes were observed.
- Evidence preload: the owner's failure-annotation scoping and my injected-fault exemption are both kept.

New defect found by running the gate sequence on the final tree: the stale-genuine-release lifecycle regression
raised the project-lifecycle producer from 94 to 95 reports (81 to 82 named storage regressions) while the evidence
catalog still required exactly 94/81, so the producer receipt was rejected. The catalog population is updated
(`verification-evidence-catalog.mjs`); the lifecycle producer now yields a valid receipt.

Diagnosability: the workflow-invoked conformance group run now emits one `::error` annotation naming its first
non-passing suite with outcome, exit and a bounded stderr tail. It observes the finished report only; results, exit
codes and saved bytes are unchanged (an injected failing gate was observed to annotate once and keep exit 1).

## Local results on the final tree (7c52beae)

All run in CI environment variables with the evidence preload, one suite at a time per stream:

- Runner contract (`--runner-contract-only`): pass, and the owner's `validateRunnerDescendantReport` accepts its report.
- Core group: all 84 suites pass locally (79 in two streams, plus executed-evidence after the ownership producers,
  primary-guidance, project-lifecycle, io-boundary-faults, checkpoint-boundary and delivery-transfer-boundary).
- Gate suites: proposal-acceptance-memory, verification-routing, independent-preflight, external-result-determination,
  stage28-artifact-delivery-intent, stage29-evidence-chain-checkpoint, production-baseline-authority, the prompt
  and semantic gates, v3/spec3 contracts, verified-site and the conformance-handoff controls pass.

## Not established

- `verify-complete.mjs` locally: it executes `verify-due-stage-timing.mjs` (the hosted deferred matrix is about three
  hours) and was not completed locally; `verify-definition-of-done.mjs` and `verify-v3-definition-of-done.mjs`
  depend on its receipt and were therefore not run on this tree.
- Any hosted pass on the combined tree, the protected `test` job's remaining steps (conformance handoff,
  stage-30 terminal mobile boundary, evidence collection, browser steps), merge, deployment, live verification,
  physical-iPhone evidence (user-only), and the real external-agent Stage 1 journey.
- Fixture and verifier changes were reviewed by their author only; no independent review exists.
- The 2026-10-11 handoff packet (`handoff-publication-20261011.json`, `requirement-traceability-manifest-20261011.json`) pins
  file digests as of 75bcc721. The commits above change several listed files (`app-core.js`, `project-store.js`, the evidence
  catalog, the evidence preload and the conformance runner among them), so those digests describe the earlier
  bytes and were not regenerated here. No workflow step reads them; `verification/check-handoff-batch-20261011.mjs`
  exits 0 on this tree.
