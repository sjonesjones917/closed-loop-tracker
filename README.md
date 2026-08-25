# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one static, phone-first vanilla-JavaScript application and one HTML entry point: `index.html`. The workflow contains exactly 30 stages and no Stage 31.

## Responsibility boundaries

| Responsibility | Owner |
| --- | --- |
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

`index.html` loads each responsible module directly, once, in dependency order, with one shared cache-build token. There is no dynamic script loader, runtime wrapper guard, MutationObserver repair, monkey patch, alternate store, alternate parser, alternate workflow engine, or second application shell.

## Current contracts

- Project schema: `human-project/30` pending the deterministic `closed-loop-project/2` migration.
- Workflow identity: represented by the exact 30-stage workbook pending separation into `mobile-closed-loop/30`.
- Response schema: `closed-loop-stage-response/1` pending the version-2 scope and prompt-contract binding.
- Persistence: one browser-local project-store adapter using Web Storage at this revision; IndexedDB and actual artifact-Blob persistence are the next responsible-layer migration.
- Backend: none. This is a single-device browser-local application and does not claim multi-device synchronization.

## Retained project

`TEST_PROJECT.json` is the retained project `JOB-20260823144121`, titled `Mobile Closed-Loop Agent Reliability Workbook`. Stage 01 is preserved as completed history, Stage 02 is current/next, and Stages 02–30 contain no fabricated downstream project data.

## Verification

Run `node build-test-project.mjs`, all `node --check` commands listed by `.github/workflows/pages.yml`, then `node verify.mjs`, `node verify-ingestion.mjs`, and `node verify-complete.mjs`. Browser verification uses `verify-browser.mjs` and `verify-browser-extra.mjs` against the served application at 320, 393, and desktop widths.

The Pages workflow runs source checks before deployment, deploys only `main`, verifies exact deployed source identity, and executes the deployed browser tests.

## Migration and backup policy

Schema migrations must preserve unknown extension fields, raw responses, receipts, historical records, project identity, and all 30 stages. A failed migration must leave the prior project available and preserve the original payload for audit/recovery. Browser-local persistence is not a substitute for an exported backup; device loss or user-deleted browser data cannot be prevented by this static application.
