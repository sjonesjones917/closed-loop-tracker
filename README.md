# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one static, phone-first vanilla-JavaScript application with one HTML entry point: `index.html`. It implements exactly 30 closed-loop reliability stages and retains `JOB-20260823144121` only as the authorized historical Stage 01-complete, Stage 02-next migration/live-verification fixture.

## Responsibility boundaries

| Responsibility | Owner |
|---|---|
| Workflow stages, names, roles, declared completion conditions | `workbook.js` |
| Field ownership, types, enums, relationships, and stage contracts | `workflow-schema.js` |
| Canonical serialization and SHA-256 | `hash.js` |
| Prompt content, context selection, and prompt identity | `prompt-engine.js` |
| Parsing, validation, proposal planning, and response disposition | `response-ingestion.js` |
| Derived values, current-scope selection, gates, invalidation, and release logic | `workflow-engine.js` |
| Projects, revisions, artifact bytes, migration, import/export, and storage health | `project-store.js` |
| Rendering and operator actions | `app-core.js` |
| Static shell, CSS, and ordered module loading | `index.html` |
| Source, lifecycle, browser, deployment, and live verification | `.github/workflows/pages.yml` |

There is no second parser, project store, workflow engine, prompt layer, application shell, runtime wrapper guard, MutationObserver patch, framework runtime, service worker, or backend.

## Current contracts

- Workflow identity: `mobile-closed-loop/30`.
- Project schema: `closed-loop-project/2`.
- Response schema: `closed-loop-stage-response/2`.
- Workflow stage count: exactly 30; no Stage or Operation 31.
- Persistence database: IndexedDB database `closed-loop-reliability` with `projects`, `artifacts`, and `meta` object stores.
- Project integrity: canonical project SHA-256 is verified on load; a mismatch is quarantined instead of silently normalized.
- Artifact integrity: actual Blob bytes are stored in IndexedDB, hashed on intake, read back, and rehashed before they are treated as verified bytes.
- Concurrency: project revisions use compare-and-swap; BroadcastChannel is notification only and is not a second state store.
- Backup: complete project packages include canonical project data and actual artifact bytes, are integrity-checked, and use browser-native compression.

## Supported browser contract

The declared support contract is intentionally narrow:

- current Chromium desktop;
- current Android Chrome;
- minimum viewport: 320 CSS pixels;
- IndexedDB required;
- Web Crypto required;
- Blob required;
- CompressionStream and DecompressionStream required for complete compressed package export/import.

Safari, Firefox, offline service-worker operation, and multi-device synchronization are not claimed until they are explicitly implemented and tested.

## Persistence and backup responsibility

At startup the application requests persistent browser storage and reads the browser storage estimate. The UI reports whether persistence was granted, estimated usage/quota, the last committed project revision, and the last verified complete export when available.

Browser-local persistence is not protection against device destruction, browser-profile deletion, private-mode eviction, or an operator clearing site data. The operator remains responsible for retaining verified project-package backups outside the browser. The application fails closed when it cannot durably preserve a raw response, proposal state, canonical transaction, or required artifact bytes.

## Migration policy

The deterministic legacy migration is:

`human-project/30` → `closed-loop-project/2`

Migration preserves historical evidence and unknown extension data, retains exactly 30 stages, and does not create Stage 31. Legacy `stageRecords` and original imported payloads remain auditable historical/quarantined material; they do not act as current canonical state or satisfy current gates.

## Verification

Run the source and deterministic checks in this order:

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

Local Chromium acceptance additionally runs:

```bash
node verify-browser.mjs
node verify-browser-extra.mjs
```

with `PAGE_URL` set to the application under test. The Pages workflow then deploys only from `main`, verifies exact deployed source bytes, reruns the Chromium acceptance against the deployed site, and publishes the acceptance report only after `test`, `deploy`, and `verify-live` all succeed.

## Reliability claim boundary

The automated acceptance suite is intended to establish conformance to the deterministic invariants encoded by the repository. It does not establish that every external agent interpretation or external source is factually correct, that browser-local data can survive device loss, or that unknown implementation defects are impossible.

The appropriate production claim is therefore: **100% conformant to the tested deterministic invariants**, accompanied by separately measured operational reliability for real accepted operations. A real external-agent 30-stage acceptance run remains distinct from the synthetic lifecycle proof and must be recorded before making a measured operational-reliability claim for production use.
