# Independent review: ACCEPT, frozen source-adoption delta only

Subject: `ebf6a930d1e5ef2f9afaaf68631a318facee5181` versus `7df5f46e9a7e54da09622387a978badb39916c09`.
Review performed in a separate detached worktree, `/workspace/shared/clrt-source-review`; no author working-tree files were read as checkpoint evidence or edited. This review is not independent normative extraction, full governance acceptance, runtime conformance, integration, remote-main provenance, or release acceptance.

## Governing behavior

Part A M00/M01/M07/M08 and Part B §§0, 0.1, 2.1–2.2, 46–46.3 govern this bounded change. The supplied normative body must be preserved byte-for-byte; the old committed source must remain recoverable. Normalizing the supplied header or final newlines is forbidden even if an old validator expected another format. Source/manifest identities must fail closed on disagreement. Historical review evidence cannot establish new-source coverage. Existing independent review, reconciliation, mutation, runtime-separation, and conformance gates must remain in place. A mechanical source check cannot substitute for semantic coverage.

Assigned-clause read scope: Part A M00/M01/M07/M08; Part B §§0–2 and §§46–46.3 and the exact source boundaries. Full target bytes were compared, hashed, and mechanically inventoried. This is not a claim of full-source semantic review.

## Findings

1. Exact source preserved: 309,482 bytes, SHA-256 `8b17763e915b9475898dad5d44e83a1c9552025c699ec28d24a3d12b9b0cf883`. The frozen Git blob, worktree source, and supplied `/workspace/shared/clrt-controlling-part-b.txt` are byte-identical. The supplied `The one` header and exactly two terminal LF bytes are retained.
2. Historical source preserved: 342,110 bytes, SHA-256 `95a6a8b1f8857b35c47cb44874aee2bbada1ccfd2ee7aa9033d92fb39c8bda9d`. Both base and historical source commit `8283121898e18d7868eef81c5ca8bebf0c9585c0` are ancestors of the checkpoint and contain those exact bytes. Old generated manifests, evidence bindings, and source-clause review are unchanged.
3. Minimal validation changes: the existing byte checks were extracted into an importable function and adjusted to the exact supplied boundaries. Fatal UTF-8, BOM, CR, leading blank, digest, length, and commit-tuple checks remain. The generator now rejects stale evidence before interpreting historical ranges. The mechanical review's historical output is unchanged except for its own script digest.
4. No inappropriate gate weakening found in this delta. The clarification mutation is conditional on a declared clarification, avoiding a nonexistent-fixture assumption while preserving the original mutation when applicable. Independently replayed historical governance still passes all 17 existing negative controls, including clarification and amendment omission, with zero proven-conformance entries. Reachability, independent source review, reconciliation, nonrewriting-manifest comparison, runtime leakage, migration, and conformance gates are not removed by this diff.
5. Meaningful independent challenges pass on Node v22.23.3: malformed boundaries fail even when their local digest/length tuple is recomputed; same-length source alteration fails the original tuple; a rehashed altered source also fails the integrated hard-pinned source regression. Relabeling only the manifest tuple cannot launder historical semantic evidence. Both direct and imported governance verifiers remain active.
6. Historical one-LF failure was independently reproduced from an archived base with only the supplied source inserted. Current exact-source regression passes all 16 author controls. The frozen verifier and generator intentionally fail on stale source bindings without modifying committed manifests. This is the correct bounded outcome while fresh source review/reconciliation integration is pending.
7. No runtime, UI, application workflow, build-state, dependency, or deployment files changed. Changed executable files pass Node syntax checks. Detached worktree remains clean.

## Current limitations and disposition

No rejection finding for this adoption delta. ACCEPT authorizes treating the byte-boundary/source-adoption change as independently reviewed; it does not authorize a green full-governance claim or merge/deployment by itself. Fresh source review/reconciliation and generated manifests remain mandatory follow-on work. Existing local-only provenance behavior and broader normative atomicity or contract conflicts were not certified here.

The exported helper checks byte shape and source/manifest consistency; it is deliberately not itself a proof of exact-target governance or Git reachability. The integrated verifier's dedicated regression pins the requested source. A later explicitly authorized source amendment would require its own reviewed update to that source identity fixture.

## Reproduction and artifacts

Run:

`/workspace/shared/npm-cache/_npx/d18f28baf1132559/node_modules/node/bin/node /workspace/shared/clrt-source-adoption-independent-review.mjs`

Artifacts:
- `clrt-source-adoption-independent-review.mjs`: independently authored challenge harness; creates/removes disposable archive fixtures and never changes author files.
- `clrt-source-adoption-independent-review.json`: individual check results plus full subprocess stdout/stderr and statuses.
- `clrt-source-adoption-independent-review.log`: successful harness output.

One initial harness attempt exceeded the default 64 MiB captured-output limit while obtaining the repository archive; this was a harness transport error, not a product failure. The harness was corrected to pipe Git archive into tar, and the complete final run passed. No product behavior or expected assertion was changed to make the run pass.
