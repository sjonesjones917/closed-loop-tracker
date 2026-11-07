# Source-only pipeline checkpoint

The first source-byte checkpoint is commit `ebf6a930d1e5ef2f9afaaf68631a318facee5181`. The additional changes in this checkpoint integrate genuinely frozen independent extraction/reconciliation inputs, never new product semantics or old proof renewed by hashing.

## Actual result

The real generator now produces the one existing normative manifest from the exact supplied 309,482-byte source, SHA-256 `8b17763e915b9475898dad5d44e83a1c9552025c699ec28d24a3d12b9b0cf883`. It binds the actual source-bearing commit above. Generator identity is `closed-loop-governance-generator/10`; product schemas and runtime identities are unchanged.

There are 53 top-level sections, 253 total sections and 4,198 **source-line traces**, not 4,198 proven atomic obligations. Counts are 3,847 `IMPLEMENTED_UNPROVEN`, 351 `UNKNOWN`, and zero `CONFORMANT_PROVEN`. The generated source review explicitly records `semanticSourceCoverageEstablished: true`, `semanticCompletenessEstablished: false`, and `atomicRequirementCompletenessEstablished: false`. All five remaining source-contract groups remain recorded in the same manifest.

Only nine exactly reviewed historical metadata/commit-reference lines in §51 are removed from the mechanical candidate set. The independent frozen A/B records, exact source blocks, JSON pointers, source hashes, complete exclusion inventory, and mandatory preservation list are checked. In particular line 5578 and the restrictions on historical evidence remain normative. Missing, overbroad and mandatory-line exclusions are rejected.

## Executed final checks

Node v22.23.3 was used.

- Syntax checks on all six changed/new executable files: PASS.
- `node test-specification-source-adoption.mjs`: PASS, 16 negative controls plus exact-source restoration after each. See `final-source-controls.log`.
- `node test-specification-source-classifications.mjs`: PASS, seven negative controls plus unchanged reviewed-set restoration after each. See `source-classifications.log`.
- `SOURCE_COMMIT=ebf6a930d1e5ef2f9afaaf68631a318facee5181 node generate-specification-governance.mjs`: exit 0, actual new-source generation. See `final-generation.log`.
- Repeated generation plus core/full verification left both generated manifest files byte-identical; SHA-256 comparison passed before and after.
- `node specification-governance-core.mjs`: all 19 structural/source/mutation controls ran, then exit 1 at the explicit §2.2 atomic-completeness gate. See `final-core.log`.
- `node verify-specification-governance.mjs`: exit 1 at the same genuine atomic-completeness blocker, with no committed manifest rewrite. See `final-verifier.log`.
- Local `git show` confirms the source-bearing commit contains exactly the supplied bytes. Canonical-main reachability has not been claimed or tested by a remote fetch.

The core additionally requires unresolved `UNDEFINED_*` findings to be resolved before its governance acceptance gate can pass. Missing runtime/browser/device/maturity proof is not supplied by any source-only result.

## Frozen source evidence

- Independent B normalized review: `verification/independent-source-review-20261014.json`, SHA-256 `e5821fbce9dc82ebf31cfde0767bb869c26c6ecd30c86fbd55d543eb8a94f429`.
- Distinct source-only reconciliation: `verification/independent-source-reconciliation-20261014.json`, SHA-256 `b3addac3e66cf726d842a675de83ad640f872e8da6ccc22510c6aac6b5352264`.
- Exact exclusion evidence: `verification/source-exclusion-evidence-20261014.json`, SHA-256 `b5650548b4adf00e940510c3f8ff61eb169a0810baff1d1a7a251537128980c0`.
- Fresh target clause supplement: `specification/source-clause-review.json`, SHA-256 `3d1cf70901cfa3882756b5e9c47083c0c271d54c040b2b012d1cd639ee148473`, 31 re-read retained clauses. The 36 absent historical amendment clauses remain explicitly unmatched.
- Original frozen A and B outputs are preserved unchanged beside the normalized evidence. Their original independence claims describe those completed passes, not a newly invented review.
- `verification/historical-source-relocation-crosswalk-20261014.json`, SHA-256 `922915515fdfee3a97642d943320daa68b3d5ba568cddebc7b13cc087572be1a`, records 4,020 exact source relocations, ten target nonnormative lines and 36 absent/changed amendment rows from 4,066 old rows. Every mapping keeps `atomicEquivalenceEstablished: false` and `proofRenewed: false`. It is history-only evidence, not a second normative manifest or proof authorization.

The unapproved proposed contract supplement referenced in the reconciler's evidence has not been copied into the normative source, runtime, or active contracts.

## Remaining blockers and next owners

1. Atomic source-to-requirement mapping within the same existing manifest: source extraction author, distinct challenger and reconciler must identify every component of compound lines. Current one-row-per-line generator/core assumptions are explicit; `atomic-entry-follow-on.md` identifies the minimum representational change and concrete clauses. No atomic-entry format is implemented here.
2. Five source-contract groups remain unresolved after the distinct necessity challenge: raw-unitization; minimum input-binding evidence basis; Test IR/parser/selector/regex/numeric details; affected nested field and target-availability contracts; expected variance. Target-condition new-grammar necessity first requires checking reuse of existing accepted proof contracts. Mobile-challenge expiry is resolved as an implementation choice constrained by the existing source, not a required normative amendment. Their exact ranges and dispositions are in the independent reconciliation. No working runtime behavior was deleted.
3. Context-applicability and 164 historical full-coverage declarations need actual new-source review after atomic IDs stabilize. The old context consumer/test constants and source-bound proof fingerprints must be handled by their existing owners, never renewed by rehashing. The old declarations remain in Git history and their old files remain untouched.
4. After genuine review inputs are frozen, run the existing context-applicability controls, `verify-final-acceptance.mjs`, relevant producer suites with current receipts, `verify-executed-evidence.mjs`, and `collect-verification-evidence.mjs`, followed by the complete existing CI/proof order. No blanket suite rerun or downstream result is claimed by this batch.
5. Preserve source commit ancestry during integration or regenerate the source-commit tuple against the actual integrated source. Independently review these changes before integration. No push, merge, deployment or release occurred here.

No runtime/UI/workflow files or `verification/closed-loop-build-state.json` changed. The exact source's final blank line is the sole authorized `git diff --check` whitespace exception; it must not be trimmed.

## Distinct necessity correction

The corrected reconciler record incorporates `verification/clrt-contract-amendment-necessity-review.txt` (SHA-256 `ced7c525bfd3e6a10b6579f25e373ee8ced422737e307ccc30f09401525370ad`). R10 was resolved as an implementation choice under existing constraints; the five other findings were narrowed. This replaces the provisional six-blocker interpretation in earlier checkpoint evidence. Source coverage, all 4,198 IDs, source-line mappings, exclusions, and implementation-proof status are unchanged. The original proposed supplement remains superseded, provisional, and unapproved. No runtime semantics were changed.
