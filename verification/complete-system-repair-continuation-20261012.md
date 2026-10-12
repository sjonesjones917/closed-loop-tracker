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


## Later candidate status — 2026-10-12

This continuation retains its historical observations. See [Publication candidate status](requirement-traceability.md#publication-candidate-status--2026-10-12-1600-pdt) for the reviewed 257-path candidate, historical receipt limits, corrected intake and workflow checks, terminal CI6016 observation and remaining fresh publication guards. No full consumer, current whole-clause proof or release PASS is implied.


## PR1248 history and pending foundation correction — 2026-10-12

PR1248 was published at `5b017adc48fca6304e7a054a673269436e532305`; the retained local `HEAD` `427b1010707ff4566a54b2acb0392e9e702b14d9` is distinct. The approved PR scope is 257 paths (251 changed, 6 unchanged). The user monitor reported CI run `38320380501` terminal at foundation step 8 on merge `de669517347716dbeddf0960c362f8ef88ddbf18`: a Stage 04 route-fixture prerequisite mismatch with accepted Stage 02 search (§8.3), not an established runtime cause; other phases were skipped. The preserved owner/consumer archive remains historical-only (archive SHA-256 `563fe4fbaab7861485de3115e7e74de0a7eb6d3ad9bbee871eadd156cfbe42e3`, readback SHA-256 `27bffdad9c1246d32a02ca6a5524a1de5c6203cda8ea5b7dae79ee25412bdb10`); reuse requires the documented verified restoration and readback. It is not included, and prior source-bound receipts remain historical.

A reviewed correction is prepared for `verify-spec-grounded-route-oracle.mjs` (`fe707f3c399af2720b124a3464975295f870b130a894b13df3805f9d3c53e298`), `verify.mjs` (`f499e2b404f243f3041ff67133d973868454ab5e3c94bac8c5c72d6690c34a2e`), and `workflow-schema.js` (`12c397f735f7e7154581131a79e19be2ef1f6bf374985dba4af5e445370812e6`). The first supplies the accepted Stage 02 route fixture and independent expected-contract checks; the `verify.mjs` change is fixture-only. The schema change is limited to two current writer digest literals under §34.3, with no historical restamp. Scoped review hashes are `c921027e1601116ff7ce7b8c4e76afcc8e4761b679f4f00fdafef4784f759926`, `d38fbd03c1978e2be4c9f62ac5e8937b4eb8e2316fe05d4f08286462e8ba994e`, and `9edafb4e96eb79966b5d96987ae0bdfe8ddda625cd01a1d820f5794ab1ae52c8`; detailed evidence remains private and requires authorized access.

The completed root-owned foundation sequence ran in a clean Git-derived snapshot of published commit `5b017adc48fca6304e7a054a673269436e532305` plus the three approved overrides, not the retained dirty checkout. From the repository root, these five commands each exited 0 on Node.js v22.23.3: `node build-test-project.mjs` (3.640326842 s), `node verify.mjs` (1.614931630 s), `node verify-contract-closure.mjs` (168.594436338 s), `node verify-stage-operation-registry.mjs` (0.159361912 s), and `node verify-stage-contract-closure.mjs` (1.154060428 s). The recorded result-set SHA-256 is `57c3c7778b0530f876ea32b69278b3b3f47e56de85d36b7bf4b04f9d42c87db6`; the sequence ran 2026-10-12 23:42:32–23:45:27 UTC. This establishes success only for these five commands on that snapshot. It does not establish an eligible canonical receipt, full hosted CI, full release, or native-consumer acceptance. The original first-failure logs remain preserved. A fresh publication/pre-push guard is still required; publication has not happened and no new commit is asserted.
