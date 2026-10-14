# Independent bounded review: ACCEPT

Candidate: `342b89b013477abe68dfae5967845358438a3e47`  
Base: `fc6a8055a4ce01ea2ac1640a5d99fb87614cc9d3`

## Source requirement and hashes

The controlling specification SHA-256 is `8b17763e915b9475898dad5d44e83a1c9552025c699ec28d24a3d12b9b0cf883`. Section 14.6, line 1113 explicitly requires each operation's target-slot derivation, required input families, writable fields, and independence requirement.

Candidate `verify-contract-closure.mjs` SHA-256: `6e36f7d5e7716a9fc68927d2d789434e1751aa6bfb8f7b2aa1169ef5c28b7f34`.

Unchanged `workflow-schema.js` SHA-256: `12c397f735f7e7154581131a79e19be2ef1f6bf374985dba4af5e445370812e6`.

## Executed verification

- `node verify-contract-closure.mjs --operation-registry-properties-only`: PASS across 104 operations. All 21 property controls report their intended oracle: targetSlotRule 5, requiredInputFamilies 7, writableFieldsRule 5, independenceRequired 4. Exact stdout is retained in `focused-output.json`.
- Independent harness: PASS. Eight coherent deletion/null mutations passed the base verifier and were rejected by the candidate. Four individual omissions from the final registry entry also rejected. Five basic-shape-valid variants passed: empty input-family array; two string family names; false independence; true independence; alternative nonempty rule strings. The latter deliberately demonstrates the boundary of shape checking, not semantic validity of an arbitrary rule identity. Exact result is retained in `independent-results.json`.
- Existing registry population includes empty requiredInputFamilies arrays, both boolean values, and both writableFieldsRule values. Current conforming declarations remain accepted.
- The actual `observationsFromReports` and `createExecutionReceipt` consumers rejected focused output. Both successful `assert.throws` checks matched `expected exactly one report marker contractClosure; received 0`. Focused JSON lacks the full-owner contractClosure marker and proof populations. Its successful exit cannot satisfy the normal owner evidence route. Exact harness assertions and retained success booleans are provided; raw exception strings were not separately printed.
- `node --check verify-contract-closure.mjs`: PASS.
- `git diff HEAD^ HEAD --check`: PASS.
- Changed-file enumeration: only `verify-contract-closure.mjs`.

## Independence and retained harness

Review used detached worktree `/workspace/shared/clrt-operation-properties-review`. Root integration and the author's worktree were not changed. The review worktree was clean after removal of temporary harness files.

`.review-base.mjs` and `.review-candidate.mjs` retain the respective verifier source prefixes before the top-level `const source=fs.readFileSync('workflow-schema.js','utf8');`, with an export of verify/loadSchema appended. This isolates the existing synchronous contract verifier without invoking expensive full-owner helper work. `.review-test.mjs` contains every independent mutation and evidence-consumer assertion. They were run in the review worktree; the copies here are archival and require the repository-relative imports and source working directory to rerun. The harness originally reads `/tmp/operation-review-focused.json`; its exact retained bytes are now `focused-output.json`.

## Limits

ACCEPT covers required presence and basic value shapes only. It does not establish per-operation semantic correctness, actual family membership correctness, runtime enforcement, or full specification closure. No runtime, catalog, binding, or source-registration changes were made. No full owner or expensive full closure was run. The reported preexisting CARRIER_DERIVATION_SOURCE_ORACLE on this older base was not repaired or independently re-executed; separate current registration work remains outside this review. There is no fullCoverage or whole-application certification.

No further tests were run during archival. Exact original outputs were copied without alteration.
