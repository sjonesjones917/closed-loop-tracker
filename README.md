# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one static, phone-first vanilla-JavaScript application with one HTML entry point: `index.html`. It implements exactly 30 closed-loop reliability stages. There is no backend, framework runtime, second parser, second store, second workflow engine, second prompt layer, runtime wrapper guard, MutationObserver patch, or service worker.

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

## Current contracts

- Workflow identity: `mobile-closed-loop/30`.
- Project schema: `closed-loop-project/2`.
- Response schema: `closed-loop-stage-response/2`.
- Stage count: exactly 30; no Stage 31 or Operation 31.
- Supported browser contract: current Chromium desktop and current Android Chrome; minimum viewport 320 CSS pixels.
- Required platform capabilities: IndexedDB, Web Crypto, Blob, and CompressionStream/DecompressionStream for complete compressed package export/import.
- Persistence database: `closed-loop-reliability`, with `projects`, `artifacts`, and `meta` object stores behind the single `closedLoopProjectStore` interface.
- Project writes use revision compare-and-swap. Artifact records retain actual Blob bytes, application-computed byte size and SHA-256, and read-back verification.
- The application is browser-local. It does not claim multi-device synchronization, authenticated operator identity, Safari/Firefox support, or protection against device/profile loss.

## Response and authority model

Every accepted external response is bound to the current job, stage, operation, project revision, prompt instruction ID, instruction-body SHA-256, response-contract SHA-256, context signature, and stage-relevant scope. Agent proposals cannot write human-owned, human-decision-owned, or application-owned fields. Canonical IDs, lifecycle state, versions, counts, hashes, gates, convergence, release decisions, artifact identity, and other deterministic state remain application-controlled.

Raw returned output is preserved before operational acceptance. Parsed proposals remain non-canonical until validation and operator acceptance succeed. Accepted values retain extraction-manifest provenance to the exact response JSON pointer and controlling prompt. Invalid, stale, unsupported, incomplete, or uncertain results fail closed rather than silently becoming canonical truth.

## Persistence, migration, and backup

The deterministic legacy migration is:

`human-project/30` → `closed-loop-project/2`

Migration preserves unknown extension data, raw outputs, receipts, historical records, project identity, and all 30 stages. Legacy payloads may remain available as quarantined audit material but are not active canonical state. Migration never creates Stage 31.

At startup the application requests persistent browser storage and reports storage health. Browser-local persistence is not protection against device destruction, browser-profile deletion, private-mode eviction, or an operator clearing site data. Operators are responsible for retaining verified complete project exports. Complete exports include canonical project data and stored artifact bytes and are integrity-checked on import before activation.

## Verification

Run source and deterministic acceptance checks in this order:

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

For local Chromium acceptance, serve the repository root and run:

```bash
python3 -m http.server 4173
PAGE_URL=http://127.0.0.1:4173/ node verify-browser.mjs
PAGE_URL=http://127.0.0.1:4173/ node verify-browser-extra.mjs
```

The Pages workflow blocks deployment on syntax, schema/source verification, ingestion and negative tests, deterministic gate tests, the continuous 30-stage lifecycle, semantic prompt-contradiction/operation-isolation tests, and local Chromium acceptance. After deployment it verifies exact deployed source identity and reruns browser acceptance against the deployed URL before publishing the final status and acceptance artifact.

## Reliability claim boundary

The application can be described as 100% conformant only to the deterministic invariants actually exercised by the acceptance suite. It does not guarantee the factual truth of an external agent interpretation or source, preservation after device/profile destruction, absence of unknown implementation defects, or availability of external capabilities. Operational reliability must be reported from observed project history rather than asserted as an absolute percentage.
