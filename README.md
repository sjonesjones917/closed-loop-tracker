# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

One static, phone-first vanilla-JavaScript application implements exactly 30 closed-loop reliability stages. There is no Stage 31.

## Responsibility boundaries

| Responsibility | Final owner |
|---|---|
| Workflow stages, names, roles, declared completion conditions | `workbook.js` |
| Field ownership, types, enums, relationships, stage/operation contracts | `workflow-schema.js` |
| Canonical serialization and SHA-256 | `hash.js` |
| Prompt content, bounded context selection, prompt identity | `prompt-engine.js` |
| Parsing, validation, proposal planning, response disposition | `response-ingestion.js` |
| Derived values, current-scope selection, gates, invalidation, release logic | `workflow-engine.js` |
| Projects, revisions, artifact bytes, migration, integrity, import/export | `project-store.js` |
| Rendering and operator actions | `app-core.js` |
| Static shell, CSS, accessibility, ordered module loading | `index.html` |
| Source, lifecycle, browser, deployment, live verification | `.github/workflows/pages.yml` |

No second parser, store, workflow engine, prompt layer, application shell, runtime wrapper guard, MutationObserver, framework runtime, service worker, or backend is part of the supported architecture.

## Current contracts

- Project schema: `closed-loop-project/2`
- Workflow identity: `mobile-closed-loop/30`
- Stage count: `30`
- Response schema: `closed-loop-stage-response/2`
- Project package schema: `closed-loop-project-package/1`

Every accepted response is bound to the current project, stage, operation, project revision, instruction ID, instruction-body SHA-256, response-contract SHA-256, context signature, and operation-relevant scope.

## Persistence and backup

The application uses one IndexedDB database named `closed-loop-reliability` with `projects`, `artifacts`, and `meta` stores. Project writes use revision compare-and-swap. Actual artifact Blob bytes are stored and rehashed. Raw output is durably captured before parsing; proposal persistence and canonical acceptance are separate operations. Integrity failures fail closed or quarantine rather than silently becoming canonical state.

Browser-local persistence is not protection against device destruction, browser-profile deletion, private-mode eviction, or clearing site data. Retain verified complete exports outside the browser. There is no backend, cloud synchronization, authentication, or multi-device coordination.

## Migration policy

The deterministic legacy migration is `human-project/30 -> closed-loop-project/2`. It preserves identity, all 30 stages, raw outputs, receipts, history, unknown extension data, and the original payload in a non-operational migration archive.

## Supported browser contract

Current Chromium desktop and current Android Chrome, minimum 320 CSS px, with IndexedDB, Web Crypto, Blob, `CompressionStream`, and `DecompressionStream`. Safari, Firefox, service-worker offline operation, and multi-device synchronization are not claimed.

## Verification

```bash
node build-test-project.mjs
node verify.mjs
node verify-ingestion.mjs
node verify-complete.mjs
node verify-full-cycle.mjs
node verify-prompt-semantics.mjs
PAGE_URL=http://127.0.0.1:4173/ node verify-browser.mjs
PAGE_URL=http://127.0.0.1:4173/ node verify-browser-extra.mjs
```

The single Pages workflow runs source/schema/ownership, ingestion, gates, continuous lifecycle, semantic prompt contradiction, local Chromium, deployment, exact deployed-byte, and deployed Chromium verification before publishing acceptance status.

A green acceptance report supports only: `100% conformant to the tested deterministic invariants`. Operational reliability must be measured from real accepted operations; with zero observed silent failures across N materially independent accepted operations, the approximate 95% upper failure-rate bound is `3 / N`.
