# Closed-Loop Reliability

A single static, phone-first vanilla-JavaScript application for operating exactly 30 closed-loop reliability stages. The existing application is repaired in place; there is one application shell, one canonical project model, one response-ingestion path, and one deterministic workflow engine.

## Responsibility boundary

| Responsibility | Final owner |
| --- | --- |
| Workflow stages, names, roles, and declared completion conditions | `workbook.js` |
| Field ownership, types, enums, relationships, and stage contracts | `workflow-schema.js` |
| Canonical serialization and SHA-256 | `hash.js` |
| Prompt content, context selection, and prompt identity | `prompt-engine.js` |
| Parsing, validation, proposal planning, and response disposition | `response-ingestion.js` |
| Derived values, current-scope selection, gates, invalidation, and release logic | `workflow-engine.js` |
| Projects, revisions, artifact bytes, migration, import/export, and storage health | `project-store.js` |
| Rendering and operator actions | `app-core.js` |
| Static shell, CSS, and ordered module loading | `index.html` |
| Source, lifecycle, browser, deployment, and live verification | `.github/workflows/pages.yml` |

## Current contracts

- Workflow identity: `mobile-closed-loop/30`
- Project schema: `closed-loop-project/2`
- Response schema: `closed-loop-stage-response/2`
- Stage count: exactly `30`
- Supported runtime: current Chromium desktop and current Android Chrome at a minimum viewport of 320 CSS pixels
- Required browser capabilities: IndexedDB, Web Crypto, Blob, and CompressionStream for complete compressed-package export

## Persistence and backup

The canonical adapter is `closedLoopProjectStore`. Projects and actual artifact bytes are stored in one IndexedDB database. Browser-local persistence is not a substitute for backup: operators must create and verify complete project-package exports. Imported legacy projects are migrated deterministically, while the untouched original payload remains available as a quarantined migration archive.

## Migration policy

- `human-project/30` migrates to `closed-loop-project/2` with workflow `mobile-closed-loop/30` and `stageCount: 30`.
- Unknown extension fields, raw responses, receipts, historical records, and project identities are preserved.
- Legacy payloads are non-operational after migration and cannot satisfy current prompts or gates.
- Failed migration leaves the pre-existing project collection unchanged and preserves the original payload for recovery.

## Verification

Run the repository checks from the repository root:

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

The Pages workflow additionally runs local browser verification, deploys only `main`, compares deployed bytes with the source revision, and reruns browser acceptance against the deployment.

## Operational limits

This release has no backend, authentication service, cloud synchronization, service worker, or multi-device replication. An operator label is self-asserted. External source truth and external-agent factual correctness are not automatically guaranteed; uncertain or unsupported output must fail closed as `REJECTED`, `BLOCKED`, `UNDETERMINED`, `EXECUTION_FAILED`, or `HUMAN_INPUT_REQUIRED`.
