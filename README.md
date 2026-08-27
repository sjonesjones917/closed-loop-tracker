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

- Project schema: `closed-loop-project/2`.
- Response schema: `closed-loop-stage-response/2`.
- Workflow identity: `mobile-closed-loop/30` with exactly 30 stages; no Stage or Operation 31.
- Supported browser contract: current Chromium desktop and current Android Chrome, minimum viewport 320 CSS px.
- Required browser capabilities: IndexedDB, Web Crypto, Blob, CompressionStream, and DecompressionStream for complete compressed package export/import.
- Persistence: one `closedLoopProjectStore` adapter backed by IndexedDB database `closed-loop-reliability`, with project, artifact-Blob, and metadata storage. Artifact bytes are application-hashed on intake and verified on read-back. The application is browser-local and has no multi-device synchronization.
- Stage 21 product artifacts are accepted only after the application reserves the current product execution. Finished-product bytes are then bound to that application-owned `PRODUCT_ID`, hashed, persisted, and included in the product artifact inventory.

## Human conversation before machine ingestion

The generated instruction is run by a human in a normal ChatGPT conversation. The agent may ask concise human-facing questions before producing the machine response. Interim questions and answers stay in ChatGPT; only the final single JSON object is pasted into the application. `HUMAN_INPUT_REQUIRED` remains a fallback for required human information that is genuinely unavailable or deferred. The same path remains available after research or later analysis discovers a new human-only fact or decision.

## Artifact generation and downstream execution

The workflow determines the actual artifact set and suitable file formats that constitute completion; the operator is not expected to know in advance whether the correct deliverable is source code, DXF, OpenSCAD, STEP, STL, IFC, SVG, XML, a controller-specific machine program, documents, or a multi-file package. When the available environment can reliably construct exact artifact bytes from a defined representation and sufficient controlling inputs, it must produce the actual requested artifact even if the downstream application that commonly consumes that format is unavailable. Missing downstream software is not, by itself, a reason to replace a real file with prose.

Artifact creation does not prove downstream behavior. Opening or importing in a named application, compiling, executing, simulating, slicing, post-processing, machining, fabricating, physically testing, filing, or submitting remains a separate operation that requires the actual capability and evidence. An implementation-ready or manufacturing-ready specification is used only when actual requested artifact bytes cannot be generated reliably, or when that specification is itself the human-confirmed deliverable.

## Verification execution and returned files

A canonical 'TEST' is a verification definition, not proof that a script/file exists and not proof that execution occurred. Each test declares an execution mode ('APPLICATION_DETERMINISTIC', 'EXTERNAL_AGENT_TOOL', 'INDEPENDENT_AGENT_REVIEW', 'HUMAN_INSPECTION', 'EXTERNAL_SYSTEM', or 'UNAVAILABLE'), the required capability, any required artifacts, its procedure, expected result, failure condition, and evidence to preserve. 'UNAVAILABLE' remains blocking for a mandatory test until a valid capability or equivalent verification path exists.

The static browser is authoritative only for deterministic operations it actually implements. APPLICATION_DETERMINISTIC is accepted only when the controlling prompt lists an exact registered application-native test capability; the current registry is intentionally empty until a per-test executor is implemented and proven, so the mode cannot be used as a fictional shortcut. Tool-dependent checks run in the capable external environment; independent reviews use an independent context; irreducible inspections remain human/reviewer work; specialized systems/labs provide their own execution evidence. A test definition, executable/input artifact, and execution result are distinct records of reality. When an executable/input test artifact is returned, the existing response evidence path binds TEST → EVIDENCE_ID → ATTACHMENT_ID after the application verifies the actual attachment bytes.

When an external agent returns an actual file, its response declares the attachment and the operator attaches the exact returned bytes in the stage file control before parsing. The application then verifies the actual filename/media type/byte size/SHA-256 and stores the Blob. A filename, hash claim, repository path, or code block alone never counts as possession of a file, and browser-local bytes are not assumed to be accessible to an external agent. Stage 06 also rechecks current canonical TEST → evidence → artifact custody, so later loss or loss of verified-byte status fails closed instead of leaving a stale test definition apparently ready.

## Data and backup responsibility

The application requests persistent browser storage and reports storage usage/quota, but browser-local persistence is not protection against device destruction, browser-profile deletion, private-mode eviction, or an operator clearing site data. The operator must create and retain complete project exports. Complete exports include canonical project state, response/validation/proposal/receipt/manifest history, artifact metadata and bytes, schema identities, and package integrity data. The application fails closed when storage cannot preserve a response or canonical transaction.

## Migration policy

The deterministic legacy migration is `human-project/30` → `closed-loop-project/2`. Migrations preserve unknown extension data, raw outputs, receipts, historical records, project identities, and all 30 stages. Original imported payloads remain auditable in non-operational migration history and do not act as current canonical state. A migration never creates Stage 31.

## Verification

Run the deterministic repository checks in this order:

```bash
node build-test-project.mjs
node --check workbook.js
node --check hash.js
node --check workflow-schema.js
node --check workflow-engine.js
node --check prompt-engine.js
node --check response-ingestion.js
node --check project-store.js
node --check app-core.js
node --check test-fixtures.mjs
node --check verify.mjs
node --check verify-ingestion.mjs
node --check verify-complete.mjs
node --check verify-full-cycle.mjs
node --check verify-prompt-semantics.mjs
node --check verify-live.mjs
node --check verify-browser.mjs
node --check verify-browser-extra.mjs
node verify.mjs
node verify-ingestion.mjs
node verify-complete.mjs
node verify-prompt-semantics.mjs
node verify-full-cycle.mjs
```

The Pages workflow is the single deployment workflow. Pull requests run the source/schema/ingestion/gate/full-cycle/semantic and local Chromium acceptance checks. Only `main` deploys. A successful main run then verifies exact deployed bytes and the deployed Chromium application before publishing the machine-readable acceptance artifact.

Local and deployed Chromium verification run `verify-browser.mjs` and `verify-browser-extra.mjs` with `PAGE_URL` set to the application URL. These browser tests cover the primary operator cycle, responsive layouts, actual Blob persistence, compressed package round-trip, injected storage rollback, and stale multi-tab revision rejection.
