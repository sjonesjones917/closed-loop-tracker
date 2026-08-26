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
| Projects, migration, import/export, and persistence | `project-store.js` |
| Rendering and operator actions | `app-core.js` |
| Static shell, CSS, and ordered module loading | `index.html` |
| Source, lifecycle, browser, deployment, and live verification | `.github/workflows/pages.yml` |

There is no second parser, store, workflow engine, prompt layer, application shell, runtime wrapper guard, MutationObserver patch, or framework runtime.

## Current contracts

- Project schema: `closed-loop-project/2`. Legacy `human-project/30` payloads migrate deterministically and are preserved as quarantined migration archives.
- Workflow identity: `mobile-closed-loop/30`; stage count: exactly 30.
- Response schema: `closed-loop-stage-response/2`, bound to instruction ID, body SHA-256, contract SHA-256, context signature, operation, current project revision, and stage-relevant scope.
- Workflow: exactly 30 stages; no Stage or Operation 31.
- Supported browser contract: current Chromium desktop and current Android Chrome, minimum viewport 320 CSS px.
- Persistence: one `closedLoopProjectStore` adapter over IndexedDB database `closed-loop-reliability` with `projects`, `artifacts`, and `meta` object stores. Artifact Blob bytes are persisted and rehashed on verification. The application is browser-local and has no backend or multi-device synchronization.
- Required browser capabilities: IndexedDB, Web Crypto, Blob, and CompressionStream for complete compressed package export.

## Data and backup responsibility

Browser-local persistence is not protection against device destruction, browser-profile deletion, private-mode eviction, or an operator clearing site data. The operator must create and retain complete project exports. The application must fail closed when storage cannot preserve a response or canonical transaction.

## Migration policy

Migrations are deterministic, preserve unknown extension data and historical evidence, and never create a Stage 31. Original imported payloads remain auditable but must not act as current canonical state.

## Verification

Run the repository checks in this order:

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
node --check verify.mjs
node --check verify-ingestion.mjs
node --check verify-complete.mjs
node --check test-fixtures.mjs
node --check verify-full-cycle.mjs
node --check verify-live.mjs
node --check verify-browser.mjs
node --check verify-browser-extra.mjs
node verify.mjs
node verify-ingestion.mjs
node verify-complete.mjs
node verify-full-cycle.mjs
```

Local and deployed Chromium verification additionally run `verify-browser.mjs` and `verify-browser-extra.mjs` with `PAGE_URL` set to the application URL.
