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
