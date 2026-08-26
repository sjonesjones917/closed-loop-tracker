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

<!-- acceptance-trigger -->
