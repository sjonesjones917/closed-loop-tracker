# Exact specification source adoption, 2026-10-14

This is bounded implementation evidence, not normative-coverage acceptance, application conformance, or release acceptance.

## Source and authority

- Task: `exact-source-adoption-20261014`.
- Base: `7df5f46e9a7e54da09622387a978badb39916c09`.
- Governing instruction: Part A M01; Part B §§0, 2.1–2.2, 11–14, 32.4–32.5, 34.1–34.3, 40, 41 cases 233/236/237, 43, 45–46, 48–52.
- The supplied replacement is exactly 309,482 bytes, SHA-256 `8b17763e915b9475898dad5d44e83a1c9552025c699ec28d24a3d12b9b0cf883`, UTF-8 without BOM, LF, including the `The one` header and two final LF bytes.
- The previous 342,110-byte source, SHA-256 `95a6a8b1f8857b35c47cb44874aee2bbada1ccfd2ee7aa9033d92fb39c8bda9d`, remains in Git history at `8283121898e18d7868eef81c5ca8bebf0c9585c0`, an ancestor of the base. The old manifests continue to identify that historical source until genuinely fresh inputs permit regeneration.
- The exact replacement omits historical §§16.1A and 32.4A. This patch does not remove runtime behavior or decide unresolved product-contract semantics.

## Reproduced failure and correction

Using Node v22.23.3 in a disposable `git archive` of the base with only the exact supplied source copied in, `node verify-specification-governance.mjs` exited 1: `Specification must end with exactly one LF.` See `before-verifier.log`.

The verifier now uses the same extracted byte validator as the dedicated regression. It requires the actual supplied start/end boundaries and exactly two final LFs while preserving fatal UTF-8 decoding, BOM/CR/leading-blank rejection, digest, byte length, and source-commit tuple checks. The existing Git reachability/exact-source reconstruction validation, section validation, manifest comparison, independent review, mutation, runtime-leakage, and migration gates remain required. Importing the verifier still executes it, as required by `verify-deployment-manifest.mjs`.

The generator's existing evidence/source digest guard runs before historical amendment ranges are interpreted. The clarification omission mutation runs when clarifications are actually declared; it is not fabricated for a source without such clauses. The source-adoption regression is invoked by the existing governance verifier after its source tuple check.

## Executed results

- `node --check` for the changed executable files: PASS.
- `node test-specification-source-adoption.mjs`: PASS. Exact supplied bytes accepted by the byte-validation helper; 16 intentional invalid cases rejected, each followed by the unchanged exact-source positive control. All 53 top-level sections and 253 total sections mechanically inventoried. No generated manifest or committed input changed. See `source-controls.log`.
- `node verify-specification-governance.mjs`: exit 1 at the legitimate stale manifest/source hash binding. See `verify-specification-governance.log`.
- Importing `verify-specification-governance.mjs`: exit 1 at the same hash binding, rather than silently skipping governance. See `imported-verifier.log`.
- `node generate-specification-governance.mjs`: exit 1 at the historical evidence/source hash binding, with no manifest rewrite. See `generate-specification-governance.log`.
- Historical compatibility only: in a separate disposable base archive with the updated generator/reviewer/core, `node specification-governance-core.mjs` passed all 17 existing mutations for the **old** 342,110-byte source, with zero `CONFORMANT_PROVEN` entries. This proves the clarification/amendment mutation path remains exercised; it is not fresh target evidence. See `historical-core-compatibility.log`.
- `git diff --check` reports the supplied final blank line at EOF. It is intentionally retained because trimming it changes the mandated bytes.

The helper's positive identity object is an isolated unit-test fixture, not a published specification manifest or Git-provenance proof. No physical-device, browser, runtime, deployment, or application-acceptance claim is made by these source controls.

## Remaining pipeline blockers at this checkpoint

1. Genuine target-source extraction/challenge and distinct reconciliation must replace old-source input declarations and line mappings before generation.
2. `requirement-evidence-bindings.json`, `source-clause-review.json`, semantic source review, and semantic reconciliation still identify the historical source at this checkpoint. Old amendment ranges and runtime proof cannot be relabeled current.
3. Fresh source review identified mechanically selected historical/structural lines that need an explicitly reviewed nonnormative classification path; the current generator gives its candidate union precedence. That issue remains separate from this byte-boundary correction.
4. Section 2.2 distinct-requirement atomicity, stable-ID crosswalks, unresolved `UNDEFINED_*` product contracts, implementation proof, and final acceptance remain subject to the separately assigned review/reconciliation work. No blanket completeness claim is made.
5. Generated manifests must bind the actual source-bearing commit through the real pipeline, and full governance must then verify them without rewriting. Source reachability on canonical main and all downstream acceptance proof remain unrun here.

No runtime/UI/workflow files, existing build-state record, existing evidence declarations, or generated manifests were edited in this checkpoint. No push, merge, deployment, or release operation occurred.
