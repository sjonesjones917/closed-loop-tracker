# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one static, phone-first vanilla-JavaScript application with one HTML entry point: `index.html`. It implements exactly 30 closed-loop reliability stages and retains `JOB-20260823144121` as the authorized Stage 01-complete, Stage 02-next project.

## Responsibility boundaries

| Responsibility | Owner |
|---|---|
| Workflow stages, names, roles, declared completion conditions | `workbook.js` |
| Field ownership, types, enums, relationships, stage contracts | `workflow-schema.js` |
| Canonical serialization and SHA-256 | `hash.js` |
| Prompt content, context selection, prompt identity | `prompt-engine.js` |
| Parsing, validation, proposal planning, response disposition | `response-ingestion.js` |
| Derived values, current-scope selection, gates, invalidation, release logic | `workflow-engine.js` |
| Projects, revisions, artifact bytes, migration, import/export | `project-store.js` |
| Rendering and operator actions | `app-core.js` |
| Static shell, CSS, ordered module loading | `index.html` |
| Source, lifecycle, browser, deployment, and live verification | `.github/workflows/pages.yml` |

There is no second parser, store, workflow engine, prompt layer, application shell, runtime wrapper guard, MutationObserver patch, framework runtime, or backend.

## Current contracts

- Workflow ID: `mobile-closed-loop/30`.
- Project schema: `closed-loop-project/2`.
- Response schema: `closed-loop-stage-response/2`.
- Workflow: exactly 30 stages; no Stage or Operation 31.
- Supported browser contract: current Chromium desktop and current Android Chrome, minimum viewport 320 CSS px.
- Required browser capabilities: IndexedDB, Web Crypto, Blob, and CompressionStream for complete compressed package export.
- Persistence: one `closedLoopProjectStore` IndexedDB adapter with project revisions, compare-and-swap writes, integrity hashes, raw-response preservation, and persisted artifact Blob bytes.
- The application is browser-local. It has no backend or multi-device synchronization.

## Data and backup responsibility

Browser-local persistence is not protection against device destruction, browser-profile deletion, private-mode eviction, or an operator clearing site data. The operator must create and retain complete project exports. The application requests persistent browser storage where supported, exposes storage health, and fails closed when a response or canonical transaction cannot be durably preserved.

Complete project packages contain canonical project state, preserved response/audit data, artifact metadata, and actual artifact bytes. Import verifies package and artifact integrity before activation.

## Migration policy

The legacy `human-project/30` format migrates deterministically to `closed-loop-project/2`. Migrations preserve unknown extension data, raw outputs, receipts, historical records, current project identity, and all 30 stages. Original imported payloads remain auditable but non-operational. Migration never creates a Stage 31.

## Verification

Run the deterministic checks in this order:

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
node verify-full-cycle.mjs
node verify-prompt-semantics.mjs
```

For local Chromium acceptance, serve the repository and set `PAGE_URL` to the local application URL before running:

```bash
node verify-browser.mjs
node verify-browser-extra.mjs
```

The Pages workflow blocks deployment on source/schema checks, ingestion and gate verification, the continuous 30-stage lifecycle, semantic prompt contradiction checks, and local Chromium acceptance. After deployment it verifies exact deployed source identity and reruns the Chromium acceptance against the deployed application before publishing final status and the machine-readable acceptance artifact.

## Reliability statement

Passing automation establishes conformance to the deterministic invariants that the tests actually exercise. It does not prove that every external source or agent interpretation is factually correct, that browser-local storage can survive device loss or user deletion, or that unknown implementation defects do not exist. Unsupported, stale, incomplete, invalid, or uncertain work is required to fail closed rather than silently become canonical truth.