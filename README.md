# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one static, phone-first vanilla-JavaScript application with one HTML entry point: `index.html`. It implements exactly 30 closed-loop reliability stages and retains `JOB-20260823144121` as the authorized Stage 01-complete, Stage 02-next project.

## Responsibility boundaries

| Responsibility | Owner |
|---|---|
| Workflow stages, names, roles, declared completion conditions | `workbook.js` |
| Field ownership, types, relationships, and stage contracts | `workflow-schema.js` |
| Canonical serialization and SHA-256 | `hash.js` |
| Prompt content, context selection, and prompt identity | `prompt-engine.js` |
| Parsing, validation, proposal planning, and response disposition | `response-ingestion.js` |
| Derived values, current-scope selection, gates, invalidation, and release logic | `workflow-engine.js` |
| Projects, revisions, artifact bytes, migration, import/export | `project-store.js` |
| Rendering and operator actions | `app-core.js` |
| Static shell, CSS, and ordered module loading | `index.html` |
| Source, lifecycle, browser, deployment, and live verification | `.github/workflows/pages.yml` |

There is no second parser, store, workflow engine, prompt layer, application shell, runtime wrapper guard, MutationObserver patch, framework runtime, or backend.

## Current contracts

- Project schema: `closed-loop-project/3`.
- Response schema: `closed-loop-stage-response/3`.
- Contract profile: `closed-loop-completion-profile/1`.
- Workflow identity: `mobile-closed-loop/30` with exactly 30 stages; no Stage or Operation 31.
- Required viewport acceptance: 320 × 568 CSS px, 393 × 852 CSS px, and 1280 × 800 CSS px desktop. Final acceptance additionally requires the pinned actual-iPhone Safari target; desktop responsive emulation is supplementary only.
- Required browser capabilities are evaluated by the applicable current operation contract. A missing mandatory capability fails closed rather than being silently substituted.
- Persistence: one `closedLoopProjectStore` adapter backed by IndexedDB database `closed-loop-reliability`, with project, artifact-Blob, and metadata storage. Artifact bytes are application-hashed on intake and verified on read-back. The application is browser-local and has no multi-device synchronization.
- Stage 21 product artifacts are accepted only after the application reserves the current product execution. Finished-product bytes are then bound to that application-owned `PRODUCT_ID`, hashed, persisted, and included in the product artifact inventory.

## Human + external-agent stage workflow

The machine response contract is the final app-ingestion format, not the human conversation. The controlling external exchange is file-first. The application exports the exact authoritative `instruction.txt` bytes and the manifest-selected files or execution package. The operator attaches or shares those exact files to the external actor and continues the external conversation when required. Clipboard copy is optional and nonauthoritative; it is never a required prerequisite.

Before sharing, the application presents the proposed files and any required disclosure or external-action decision. Approval binds the material, recipient, and provider; changed material requires a new review. Known credential-secret content cannot be approved for external sharing. Stage 01 provides a **Withdraw or replace a supplied input** control to remove an original from current input while preserving its bytes and history. Attach a separately reviewed nonsecret replacement through the ordinary file control before selecting it as the replacement.

A capability-readiness request asks an external performer to report available capabilities. Sharing that request does not authorize execution. A returned-file correction keeps the same issued instruction and response while the operator supplies or corrects the named file slots; it does not require repeating completed agent work.

If the external actor needs a human-only fact, preference, observation, authorization, or decision, it asks concise plain-language questions first and waits for the answer. It must not ask the human for facts already present in supplied materials or canonical context, or for facts it can reliably determine from authorized research, tools, or ordinary domain knowledge. A human-origin answer first supplied in the external conversation remains an external claim until the application presents the extracted value for direct confirmation or correction under the registered human-authority path.

Stage 01 proactively gathers human-specific information already foreseeable as necessary to achieve the requested outcome. Later source, research, requirements, verification, production, or audit work may reveal a new human-only decision; the external actor asks for it at that later stage rather than guessing. Once the current stage has enough information, the external actor returns one authoritative `response.json` file plus any declared returned files. The operator selects the response file and maps returned files through their application-owned attachment slots. Pasted response text is not the authoritative transport. The app's collapsed `? How to use this stage` guide gives the same short operator walkthrough without occupying permanent screen space.

## Artifact generation and downstream execution

The workflow determines the actual artifact set and suitable file formats that constitute completion; the operator is not expected to know in advance whether the correct deliverable is source code, DXF, OpenSCAD, STEP, STL, IFC, SVG, XML, a controller-specific machine program, documents, or a multi-file package. When the available environment can reliably construct exact artifact bytes from a defined representation and sufficient controlling inputs, it must produce the actual requested artifact even if the downstream application that commonly consumes that format is unavailable. Missing downstream software is not, by itself, a reason to replace a real file with prose.

Artifact creation does not prove downstream behavior. Opening or importing in a named application, compiling, executing, simulating, slicing, post-processing, machining, fabricating, physically testing, filing, or submitting remains a separate operation that requires the actual capability and evidence. An implementation-ready or manufacturing-ready specification is used only when actual requested artifact bytes cannot be generated reliably, or when that specification is itself the human-confirmed deliverable.

## Verification execution and returned files

A canonical `TEST` is a verification definition, not proof that a script/file exists and not proof that execution occurred. Each test declares an execution mode (`APPLICATION_DETERMINISTIC`, `EXTERNAL_AGENT_TOOL`, `INDEPENDENT_AGENT_REVIEW`, `HUMAN_INSPECTION`, `EXTERNAL_SYSTEM`, or `UNAVAILABLE`), the required capability, required artifacts, procedure, expected result, failure condition, evidence requirements, and verification timing. `UNAVAILABLE` remains blocking for a mandatory test until a valid capability or equivalent verification path exists.

The static browser is authoritative only for deterministic operations it actually implements. The registered application-native route is the subject-neutral Test IR using `closed-loop-test-spec/1` with the current language and operation-registry identities. The agent may compile a mechanically decidable requirement into the application-owned declarative Test IR; the schema validates the explicit DAG and the isolated worker executes only registered generic primitives. Arbitrary JavaScript, Python, shell execution, implicit operand stacks, hidden accumulators, and unrestricted network access are not supported. `APPLICATION_DETERMINISTIC` fails closed unless its exact test has valid executable IR and verified current input bytes. When a Stage 22 deterministic test is application-native, the application records the determination and execution evidence directly; an external response is not required merely to restate a result the application itself proved.

When an external actor returns an actual file, its response declares the application-owned attachment slot and the operator selects the exact returned bytes into that named slot. The application stages the selected bytes, calculates their actual byte size and SHA-256, reads them back and rehashes them before parsing or proposal creation, and verifies the slot, package, reservation, filename/media contract, and expected digest where applicable. A filename, hash claim, repository path, or code block alone never counts as possession of a file, and browser-local bytes are not assumed to be accessible to an external actor. External verification packages contain only the exact authorized prompt, manifest, records, and verified files required by the derived execution handoff.

## Data and backup responsibility

The application requests persistent browser storage and reports storage usage/quota, but browser-local persistence is not protection against device destruction, browser-profile deletion, private-mode eviction, or an operator clearing site data. The operator must create and retain complete project exports. A generated package or duplicate inside the same browser origin is not external backup evidence. Complete exports preserve canonical project state, response/validation/proposal/receipt/manifest history, artifact metadata and bytes, schema and registry identities, and package integrity data. The application fails closed when storage cannot preserve a response or canonical transaction.

## Migration policy

The deterministic migration path is `human-project/30` → `closed-loop-project/2` → `closed-loop-project/3`; a direct legacy-to-/3 migration is valid only when it produces the same canonical result and auditability. A `/3` project lacking `closed-loop-completion-profile/1` is legacy data and cannot satisfy current gates until a complete profile migration succeeds. Migrations preserve unknown extension data, raw outputs, receipts, historical records, project identities, and all 30 stages. Missing semantic review, human authority, execution, evidence, freshness, independence, backup custody, mobile acceptance, or delivery facts remain unknown or incomplete; migration does not fabricate them. A migration never creates Stage 31.

## Verification

Run the deterministic repository checks in the order required by the repository verification entry points and CI. The Pages workflow is the single deployment workflow. Pull requests run source/schema/ingestion/gate/full-cycle/semantic and local Chromium acceptance checks. Only `main` deploys. A successful main run then verifies exact deployed bytes and the deployed Chromium application before the later physical-iPhone and final-publication gates can complete.

`build-static-site.mjs` is the single deterministic deployment builder. It derives one SHA-256 build identity from the complete source runtime bundle, binds that identity to every direct script and the Test IR worker, and emits `closed-loop-deployment-manifest.json` with every deployed resource's size and digest. `verify-deployment-manifest.mjs` performs two clean builds, verifies manifest self-digest and resource closure, rejects mixed identities, and confirms that no controlling service worker exists. Live verification rebuilds the same expected site for the exact commit and workflow run, fetches every manifest path with cache bypass, and compares exact bytes.

Local and deployed Chromium verification are required browser proofs, but they do not substitute for the pinned actual physical-iPhone Safari acceptance required before final acceptance publication and release tagging.

## Repository visual acceptance submission

The workflow-dispatch input `visual_baseline_evidence_json` carries repository evidence; it is never application project state. Its existing outer fields are `status: "PROVEN"`, `sourceCommit`, `comparedCommit`, `comparisonResult: "PASS"`, `authority` (`APPROVED_PREDECESSOR` or `VISUAL_BASELINE_AUTHORIZATION`), `authorityRecordId`, and a nonempty string array `evidenceReferences`. Both commits are complete lowercase Git SHAs; the compared commit must be the exact deployed main commit.

Supply `baseline` with the frozen `VISUAL_BASELINE_ID`, matching `sourceCommit`, the complete `deploymentManifest`, `viewports`, `allowedChangeRegions`, and `dynamicRegions`. The manifest uses the existing `closed-loop-deployment-manifest/1` representation, including unique resource paths, actual byte lengths, SHA-256 digests, and its canonical self-digest. Each viewport has a unique `id`, integer `width` and `height`, `promptBox` with positive safe-integer or decimal-string `width`/`height`, nonempty `widthBehavior`/`heightBehavior`, and a nonempty string-valued `computedStyles` object, plus `referenceScreenshot: {reference, sha256}`. Record the supported 320×568, 393×852, and 1280×800 CSS-pixel viewports. Region inventories are explicit arrays, including when empty; each region has a unique `id`, current `viewportId`, and nonempty `selector`. An allowed change region also names its `normativeRequirementReference`.

All supplied proof, including unknown extensions, must satisfy `hash.js`'s canonical JSON contract: finite safe-integer JSON numbers and valid Unicode scalar strings. Preserve fractional measured prompt-box dimensions as positive plain decimal strings under the existing `test-runtime.js` exact-decimal parser, for example `"397.59375"`; do not round them. Decimal strings have no exponent, sign prefix, leading zeroes, units, or whitespace; zero and negative values are invalid dimensions. The baseline resource inventory is resolved from `verified-site.mjs` at that exact immutable repository commit; a supplied graph cannot override it. Its complete historical inventory may differ from the current inventory. The workflow fetches only a missing exact source object from this repository before validation. An unavailable source object or an unrecognized historical graph remains unestablished, retains its evidence, and gives the existing human-authorization route for a current baseline rather than an impossible unchanged retry.

Supply `comparison` with the same `VISUAL_BASELINE_ID`, `baselineSha256` calculated by `hash.js` from the complete frozen `baseline`, the exact `comparedCommit`, that deployment's complete `deploymentManifest`, `viewportIds`, per-viewport `screenshots: [{viewportId, reference, sha256}]`, `changedRegionIds`, and `ignoredDynamicRegionIds`. Every supported viewport must be compared. Changes must belong to explicitly allowed regions; ignored regions must belong to the frozen dynamic inventory. The current comparison manifest must match the deployed manifest digest already bound by the final acceptance report. References and reported screenshot digests remain evidence metadata; validation does not establish that screenshots exist or that a visual judgment is correct. The authorized controller must review the referenced artifacts and comparison before release.

For `VISUAL_BASELINE_AUTHORIZATION`, include the actual `authorityRecord` returned by the existing `RECORD_HUMAN_DECISION` command and its `authorityReceipt` history event. The decision must have purpose `VISUAL_BASELINE_AUTHORIZATION`, source `HUMAN_DECISION_COMMAND`, current status, its actual existing Job target (`TARGET_FAMILY: "job"`, `TARGET_ID: JOB_ID`), and `VALUE: {authorized: true, VISUAL_BASELINE_ID, baselineSha256}`. The receipt must be `REGISTERED_HUMAN_DECISION_RECORDED`, match the decision's `RECEIPT_ID`, record ID, purpose and target, and carry the recorded operator label. The existing `SELF_ASSERTED` identity-assurance basis is sufficient; no stronger authentication is inferred or required. An intentional changed region requires this human-authorized route and a new frozen tuple whose `sourceCommit` is the exact compared commit; an old baseline approval cannot authorize later differences.

For `APPROVED_PREDECESSOR`, include `predecessorRecord: {recordId, VISUAL_BASELINE_ID, baselineSha256, candidates}` with exactly one qualifying candidate. That candidate names the frozen `sourceCommit`, its `approvalRecordId`, actual `approvalRecord` and `approvalReceipt` using the existing decision-and-receipt mechanism, and nonempty string arrays `approvalEvidenceReferences` and `historyEvidenceReferences`. A historical decision may use `TRADEOFF_OR_SCOPE_DECISION`, `HUMAN_AUTHORITY_CORRECTION`, or `VISUAL_BASELINE_AUTHORIZATION`; it need not retrospectively acquire a new visual-decision purpose. Its explicit authorization value must bind this frozen visual tuple; unrelated risk, disclosure, backup, or retirement decisions do not authorize visual approval. Its predecessor record identity must match `authorityRecordId`. History references locate the predecessor; actual approval evidence is required independently. This transport establishes the attributable recorded-decision form of historical approval. Other historical references remain retained evidence, but do not establish approval through this transport; use the existing human-authorization route if their approval is unknown or ambiguous.

Submission attributes come from authenticated workflow context. The decision's assurance must use the schema registry's currently available basis (`SELF_ASSERTED`); a supplied higher label does not establish an unavailable authentication capability. Supplied proof and unknown extension fields are retained without filling missing evidence, inferring approval, or rewriting the frozen tuple. The default repository baseline remains `OPEN` until actual required evidence exists.
