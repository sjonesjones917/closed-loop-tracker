# ACCEPT: frozen source-only pipeline delta

Reviewed `a12c42814adf6a253cbcda825f6b211801f8d7ca` against `ebf6a930d1e5ef2f9afaaf68631a318facee5181` in detached worktree `/workspace/shared/clrt-source-review-pipeline`. The earlier adoption review remains unchanged.

## Decision and boundary

ACCEPT this source-only pipeline delta. No rejection finding was established in the assigned scope. This is not full governance acceptance, atomic-requirement completeness, approval of any proposed specification amendment, runtime conformance, canonical-main provenance, or release acceptance. The six source-contract groups remain unresolved review candidates whose necessity is being separately challenged; this review does not adjudicate them.

## Governing source and findings

Part A M00/M01/M07/M08 and Part B §§2.1–2.2 and 51 require exact source authority, independent extraction/challenge/reconciliation, preservation of mandatory requirements, and no renewal of historical evidence by relabeling. Section 2.2 requires distinct obligations; counting source lines cannot establish that result.

1. The supplied normative source is unchanged from the accepted adoption checkpoint: exactly 309,482 bytes and SHA-256 `8b17763e915b9475898dad5d44e83a1c9552025c699ec28d24a3d12b9b0cf883`. Both generated manifests bind source-bearing commit `ebf6a930d1e5ef2f9afaaf68631a318facee5181`, locally verified as an ancestor containing those exact bytes.
2. Original A and B evidence files are byte-identical to their separately delivered frozen outputs. Declaration, reconciliation, and exclusion digests were independently checked. All 226 normalized observation strings resolve to and equal their original B strings; the normalized section hashes match exact source ranges. Source-contract findings, exceptions, and source-block anchors are preserved verbatim. Normalization is correctly described as projection of the prior independent pass, not a new independent review.
3. Only nine reviewed mechanical candidates are excluded: lines 5565–5570 and 5573–5575, consisting of supplied historical metadata and commit references. Reading all of §51 independently yields the 15 preserved duty/limitation lines: 5578, 5596–5597, 5599–5609, and 5611. Every one remains a normative requirement. In particular, the actual-starting-commit duty at 5578 is retained despite the original A classification mistake. Historical acceptance JSON remains historical, not current proof.
4. Generated state truthfully separates `semanticSourceCoverageEstablished: true` from `semanticCompletenessEstablished: false` and `atomicRequirementCompletenessEstablished: false`. There are 4,198 source-line traces, no proven atomic count, and zero `CONFORMANT_PROVEN` entries. No amendments or clarifications are approved by this batch. All six unresolved findings remain exactly represented in the generated manifest.
5. All 4,066 historical crosswalk rows were independently compared with the old manifest: 4,020 exact source-line relocations, ten exact lines now classified nonnormative, and 36 absent/changed entries. Every row keeps atomic equivalence and proof renewal false. Old source locations, IDs, text, target hashes, and current target trace IDs agree. All 31 clause-supplement entries match the exact source and current trace entries; the 36 unmatched historical clause texts are absent as exact target lines. This proves location continuity, not semantic or atomic equivalence.
6. Repeated actual generation, core verification, and full verification preserve both committed generated manifests byte-for-byte. Source-adoption and source-classification regressions pass. Core and full governance return exit 1 at the explicit Section 2.2 atomic-completeness gate after all 19 structural/source mutation controls execute. This is the expected fail-closed outcome, not a green governance claim.
7. Twelve fresh exclusion challenges use coherently rehashed disposable evidence, going beyond merely corrupting outer digests: duplicate/mandatory substitutions, changed source text/identity, false A/B independence, altered B source block, altered A classification, incorrect block/unit pointers, admitted semantic changes, and missing mandatory controls all reject. Each negative is followed by the untouched positive fixture.
8. A separate disposable fixture synthetically asserted atomic flags solely to reach the next acceptance gate. It still exits 1 on unresolved contract findings. This artificial fixture is deleted and is not evidence of atomic completeness. Resolving or removing those candidates requires the separately assigned substantive review, not this test.
9. No runtime JavaScript, UI, workflow, package, or build-state changes occurred. Six executable files pass Node syntax checks. The detached worktree is clean after generated subprocess logs were moved into the review artifact directory.

## Required next boundary

The current generator/core still have one-row-per-line assumptions. Do not lift the atomic gate merely by changing booleans; implement and independently challenge component-aware source membership, stable IDs, modifiers, and proof relationships first. The follow-on document correctly identifies this limitation. Candidate test/module mappings remain unproven and do not renew historical execution evidence. Remote-main reachability, downstream context applicability, runtime/browser/device tests, and final acceptance are outside this review.

## Reproduction and artifacts

Node: `/workspace/shared/npm-cache/_npx/d18f28baf1132559/node_modules/node/bin/node`, version v22.23.3.

Run:
- `python3 /workspace/shared/clrt-source-adoption-independent-review-pipeline.py`
- `python3 /workspace/shared/clrt-source-adoption-independent-review-pipeline-gates.py`

Evidence:
- `clrt-source-adoption-independent-review-pipeline.py`: 29 independently executed identity, lineage, crosswalk, generation, and gate checks.
- `clrt-source-adoption-independent-review-pipeline-challenges.mjs`: 12 fresh rehashed exclusion negative controls.
- `clrt-source-adoption-independent-review-pipeline.json` and `.log`: check outcomes and complete captured subprocess output/status.
- `clrt-source-adoption-independent-review-pipeline-gates.py`, `-gates.json`, and `-gates.log`: isolated unresolved-contract acceptance-gate challenge.
- `clrt-source-adoption-independent-review-pipeline-generated-evidence/`: preserved child-process verifier logs from the actual pipeline run.

No author files were edited, and no push, merge, deployment, or release was performed.
