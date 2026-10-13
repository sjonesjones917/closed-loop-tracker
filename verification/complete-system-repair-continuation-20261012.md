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


## CI6018 successor scope — 2026-10-12 PDT

Parent `bac0075080dc55bbb57fda3ff1c56bf1acf6f191` was published and read back exactly; CI6018/38324226979 passed foundation step8 and failed step9 on the canonical partial-state fixture. See [the CI6018 correction record](requirement-traceability.md#ci6018-canonical-partial-state-correction--2026-10-12-pdt) for the exact pre/postimages, independent review, pre-fix/positive/rejection controls and local capacity limitation. The one-file test correction preserves the default stale-projection guard and verifies the real write restores default full integrity. Focused controls and installed syntax passed; full local migration/foundation, current canonical receipt admission and hosted acceptance remain unclaimed. The Group337 metadata proposal is excluded. The pending successor uses the existing branch and preserves local HEAD/index and private work; fresh head/run reconciliation is required before push. This prepared status does not assert a future commit, merge or deployment.


## CI6019 structural-defaults correction — 2026-10-13

CI6019 (`38326235986`) failed at foundation on merge `5219b8aa817af8bdf8cf35787ce344db36debef9` from published `2da5f66a1b7433ae828154ba8a481eb921c8ea3e`. Review traced the failure to verifier assertion order: the structural-defaults mutant reached a downstream projection dereference before the intended `ensureShape` rejection was checked. A reviewed one-file correction moved the existing exact-oracle and nonmutation assertions ahead of companion project-integrity validation; production guards and strict fault classification were unchanged. Focused malformed/default controls passed, and the complete default `verify-v3-migration` owner exited 0 in 73.308663521 seconds with all 25 intended faults detected.

The owner run's unchanged local fingerprint is `38a764c9eab551da18361691beb23839eb1ae1805ef488546763853c2d6a3a7d`, which includes unpublished Group337 metadata and is not an eligible receipt for the published tree. This corrective batch excludes Group337 metadata and the private Group238 partial proposal. The separate deployment-manifest/full-foundation entry was not run because of local capacity limits. This is not a canonical receipt, whole-clause result, hosted-CI result, or full-foundation pass.


## CI6020 follow-on status — 2026-10-13

Published baseline `e90c00f413837e15b90bec675b32bc6bfd895c2b` exposed a Stage 02 fixture-prerequisite failure in the data-route verifier: the fixture forced an applicability label/gate instead of accepting the bounded source-search and independent-review path required by the Stage 04 guard. Review classified this as test-fixture setup, not a production defect. A root-integrated local four-file candidate is recorded by 262-path manifest SHA-256 `267fa3cdfa9689e5ef26ee0f8ddec8f6f8e5c88ded65713d90ceebb5f3098405`; it is not a new published commit.

The data-route owner passed (104 operation checks, 3.777445 s), the one-time-intent owner passed (1.166 s), and the composed test-runtime parent plus DAG child passed (1.934 s; nested nine cases/six mutations detected). Exact source/result digests and scoped independent-review identities are recorded in the [CI6020 traceability section](requirement-traceability.md#ci6020-source-closure-fixture-correction-and-bounded-owner-results--2026-10-13). These are bounded owner results, not eligible canonical receipts or proof of the whole operator/30-stage journey.

The latest complete default catalogue consumer preflight exited 1 at the test-only `TEST_IR_NATIVE_INPUT_CHECK_REQUIREMENT_ORACLE` assertion in `test-normative-catalog-consumers.mjs:43`. This is the `test-ir.native-canonical-identity` Group337 mapping: expected `NREQ-0005049889063a2551f144189aa7efa1`, while the actual set also contains `NREQ-e9fa75ac680d5b2c3abbcab9d4e8d038` and `NREQ-d5105b1bb6981fb89f2d3bd032f56067`. This test-only population mismatch is separate from the Stage 01 role applicability issue and does not establish a product defect. The retained summary SHA-256 is `95e0df04f09d838d415e19e5b1837d619b98da7a62f43eef3dfcbf5ee0ce18cd`; stderr SHA-256 is `575e01f413e6f2faa9f371c41e30f4657187b9a8daf5549b3cf0d72afaec802b`. The population correction/review and consumer rerun remain pending.

The de33 complete-coverage metadata renewal is identified by reviewed declaration SHA-256 `03efa8480a70fd23690c7b9c292e2ea3288d473480a4b0ce6b8602c94b9878b1`; owner execution and canonical persistence/readback remain pending. The Stage 01 role applicability successor review is SHA-256 `cadf5fcbb6dcab3d898cb84285a78467487c2a8aa528d416669b2dc108f2dcb1`; its owner receipt remains pending. No prior receipt is restamped. Hosted CI acceptance, browser/native evidence, full release, and external operator journey remain separate and unclaimed. Raw result records remain private; hashes and scope are portable pointers only, and underlying records require authorized access.


### CI6020 pre-owner completeness result — 2026-10-13 01:33 UTC

The population correction is integrated: `test-normative-catalog-consumers.mjs` SHA-256 `2f6d50477aeb518660bd8f4a4cdd08b3a4428c79634c9d5d9a16fa3f2655f2b8`. It independently expects the original native-input requirement plus the two reviewed Group337 links, and rejects missing, duplicate or wrong IDs. The original binding/report negatives remain unchanged. Independent review SHA-256 `247df0c799fa41f94245588965945b9f56c10382c3459351f2a4245fa4c563a1`. The retained earlier population failure remains a failed test-metadata prerequisite, not a product defect.

After integration, the complete actual repository-path `verifyNormativeCatalogConsumers()` entry passed under Node.js v22.23.3 in 30.020848479 seconds, with no resource abort and empty stderr. Stdout SHA-256 `ed014297e50159062ea7a4905d1ba3ca091cd5d6cb546ec1a3f4e581496a0f7a`; summary SHA-256 `5892e79d82a19d9fda622c1ceb7d6a897b516c2d345fe569dd5a90b6f59b3ee7`. This is a synthetic consumer/preflight result, not an owning execution receipt or whole-clause admission. The exact 266-path postimage manifest before this documentation append is `f7fa47e721bdef937df92f4071a1d4ccf81c0eeb8acaeb3e3aaafab58e6b3721`.

The next narrow admission requires only the registered `verify-test-runtime-v3.mjs` owner, current complete source fingerprint, reviewed de33 declaration, and canonical partial aggregation/readback. It does not require the separate ingestion trio or global all-suite collector. The Stage 01 applicability renewal does not create its missing owner receipt; unrelated requirements remain UNKNOWN. Source-affecting work and mandatory reviews must be frozen before that run. All final hosted, operator, storage/browser, full-stage/operation, release and deployment obligations remain separate.


### Frozen native-route clause admission — 2026-10-13 01:35:56 UTC

The complete default registered `verify-test-runtime-v3.mjs` owner, canonical partial aggregation, persisted aggregate and `readExecutedEvidence` readback passed. Total guarded elapsed time was 33.019961167 seconds, exit 0, no resource abort; source fingerprint was unchanged throughout execution and readback. Exactly one whole clause is `CONFORMANT_PROVEN`: `NREQ-de33aab7c1103be779617c7fccd8e1a7`, §22.4 sentence “They bypass external response ingestion.” Its exact reviewed scope is the Stage22/24 application-native result route, supported by `test-ir.native-stale-recovery` and `test-ir.native-canonical-identity`. This is not full Stage22/24 completion, a browser/storage-worker journey, or whole-release proof. The three adjacent Group337 clauses remain UNKNOWN for full coverage, with scoped executed links retained. Unrelated missing owners remain UNKNOWN; the prior nine-proof snapshot remains historical.

The local Git identity is still `427b1010707ff4566a54b2acb0392e9e702b14d9` plus the explicitly reviewed dirty candidate; this is not published baseline `e90c00f413837e15b90bec675b32bc6bfd895c2b` or a future commit. Fingerprint SHA-256: `721dcfbb533aba05dd8d8367e850d104741294e0a201a5a7dc075b8fd372a72f`; complete source-input digest: `acf05b5238b63a168acc20694df0eaf7c9b4e752efef219b0dadd50260903c5b`. Receipt identity: `98948d299749de9719edadaefb5cf818e6c54607839c230d7d7f963028160aed`; receipt file SHA-256: `4804f9ccd2851a73479e8b2a88f64c15b2ea8f61f486b7f658625f692cc0be1a` (393,069 bytes). Canonical aggregate identity: `25a3002195b27e86444d69e6846d0081faf37b82f0f98b96ef46df9e5cf67d5b`; aggregate file SHA-256: `95666b26f2ce2f0974cf70131b2c3ab46fb991ef3852fe4f0aef0eefee9af631` (7,810,964 bytes). Result-summary SHA-256: `001143221049454d824a3e59029b71cb03b1912eca5a7a870d9764f89cd8453f`. One validated receipt yielded 14 observations. Underlying receipts/raw logs remain preserved in private engineering custody; these identities do not grant access or substitute for readback.

Reproduction uses the existing canonical APIs under Node22.23.3: freeze `evidenceFingerprint()`, execute `executeEvidenceProducer('verify-test-runtime-v3.mjs', {directory, fingerprint, evidenceDirectory, timeout:1200000})` into a fresh isolated directory; require unchanged fingerprint; call `readExecutionReceipts(directory, fingerprint)` then `aggregateExecutedEvidence(receipts, fingerprint)`; persist the aggregate plus `evidenceSha256: sha(aggregate)` and validate using `readExecutedEvidence(file, fingerprint)`, rechecking the fingerprint. No old receipt is restamped or promoted to another source revision. Current executed evidence for the published successor must follow the repository's separate identity/promotion rules and required hosted checks.

The finite next delivery step is final included-diff/privacy/companion review, fresh external head and required-run reconciliation, and one coherent same-branch publication if those guards pass. Full supported operator and 30-stage/104-operation boundary evidence, remaining requirement closure, real-device/authorized visual observations, final complete PR/A–L review, protected CI, merge, deployment and live verification remain governed separate obligations. Dot arranges the physical-iPhone and authorized visual observations; no observation or observer availability is invented here. Local full clean deployment verification remains capacity-limited and is not reported PASS.


## CI6021 exact isolated owner correction — 2026-10-12 PDT

Published `995f450f073d8069ed7e4cfa92a85ec40ae5b264` (tree `9669d0fae6283702309d77aa2c70a9b45718656f`) is the parent for this narrow successor. CI6021/38333254435 failed on a stale positive Stage02 epoch expectation in `verify-stage01-review-subject.mjs`, not a demonstrated production currentness defect. The exact independently reviewed one-file correction is recorded in [external verification provenance](ci6021-stage02-epoch-external-verification-20261013.json). It preserves Stage01 intentional legacy rejection, Stage04 and independent-context controls, and adds current/stale Stage02 controls with a literal independently pinned source-applicability epoch. No production or catalogue companion is required.

Dot supplied completed isolated Node22.23.3 full DEFAULT executions on the exact published parent and one-file postimage: preimage exited 1 at the intended epoch assertion in 82 seconds; candidate exited 0 in 89 seconds. Execution was 2026-10-12 19:31–19:34 PDT (2026-10-13 02:31–02:34 UTC). Root has not rerun the owner. Raw logs and manifest remain in the authorized separate verifier workspace; the linked record preserves their supplied identities and access prerequisite, without claiming local readback or a canonical receipt. This is scoped full-owner evidence, not whole dirty-candidate equivalence, a real-agent journey or whole release proof.

The successor includes only the owner postimage, linked external provenance record and this append. All other files of the published parent, including its portable handoff, remain inherited. Local HEAD/index, excluded private proposals, original profiles, raw failures and archives remain preserved. The changed executable invalidates the prior global fingerprint `721dcfbb533aba05dd8d8367e850d104741294e0a201a5a7dc075b8fd372a72f`; its one-clause proof and earlier nine-proof snapshot remain historical, with no restamp. Publication requires the final independent record/privacy/diff review and fresh remote-head/required-run guard; this prepared entry does not claim a future commit or hosted result.

After publication, normal protected CI must establish its own source-bound prerequisites before the existing complete operator journey, remaining 30-stage/104-operation whole-boundary proof, merge, deployment and live verification. Static adequacy and scoped assertions remain distinct from whole-clause evidence. Root remains sole integrator and final PR-diff/A–L owner; dot arranges the specified physical-iPhone and authorized visual observations. Included GPT/Claude only; no Copilot, extra spend or additional reset.
