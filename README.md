# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one static, phone-first vanilla-JavaScript application with one HTML entry point: `index.html`. It implements exactly 30 closed-loop reliability stages.

## Responsibility boundaries

| Responsibility | Owner |
|---|---|
| Workflow stages, names, roles, declared completion conditions | `workbook.js` |
| Field ownership, types, relationships, stage/operation/scope contracts | `workflow-schema.js` |
| Canonical serialization and SHA-256 | `hash.js` |
| Test IR registry, validation, capabilities, and worker coordination | `test-runtime.js` |
| Isolated Test IR execution | `test-worker.js` |
| Prompt content, context selection, and prompt identity | `prompt-engine.js` |
| Parsing, validation, proposal planning, and response disposition | `response-ingestion.js` |
| Derived values, current-scope selection, gates, invalidation, and release logic | `workflow-engine.js` |
| Projects, revisions, artifact bytes, migration, import/export, and execution packages | `project-store.js` |
| Rendering and operator actions | `app-core.js` |
| Static shell, CSS, CSP, and ordered module loading | `index.html` |
| Source, lifecycle, browser, deployment, and live verification | `.github/workflows/pages.yml` |

There is no second parser, store, workflow engine, prompt layer, application shell, runtime wrapper guard, MutationObserver patch, framework runtime, or backend.

## Current contracts

- Project schema: `closed-loop-project/3`.
- Response schema: `closed-loop-stage-response/3`.
- Contract profile: `closed-loop-completion-profile/1`.
- Workflow identity: `mobile-closed-loop/30` with exactly 30 stages; no Stage or Operation 31.
- Test IR schema: `closed-loop-test-spec/1`.
- Persistence: one `closedLoopProjectStore` adapter backed by IndexedDB database `closed-loop-reliability`.
- Artifact bytes are application-hashed on intake and verified on read-back. Browser-local storage is not represented as external backup or multi-device synchronization.

## External-agent workflow

The controlling external exchange is file-first. For an external operation, use the application's current `EXPORT_PROMPT_FILE` or `EXPORT_EXECUTION_PACKAGE` action. The authoritative substantive instruction is the exact exported `instruction.txt` bytes. Attach or share the manifest-selected input files to the external actor. Clipboard copy and prompt preview are conveniences only; they are not authoritative transport and are not prerequisites.

If the external actor needs a human-authority answer, continue the conversation. A newly reported human-origin value remains an external claim until the application presents the extracted value for confirmation or correction. When the operation is complete, the external actor returns one authoritative `response.json` file plus any declared returned files. Select `response.json` with the application's response-file action, then select every returned file into its named attachment slot. The application stages and hashes the selected bytes before parsing and applies the operation's proposal-acceptance mode. Pasted response text is only a nonauthoritative fallback that is materialized into the same file-processing path; it is not the normal workflow.

Stage 01 is the first semantic reader. The application stores raw human input and supplied bytes, generates the exact Stage 01 file handoff, and does not claim arbitrary semantic extraction before the external Stage 01 agent inspects the material. Accepted Stage 01 semantic intake is reused downstream; later stages must not ask the operator to retype or reattach already captured information merely to rediscover it.

## Verification execution

A canonical test is a verification definition, not proof of execution. Each test declares its verification timing, execution mode, required capability, required artifacts, expected result, failure condition, and evidence requirements. The application derives whether an obligation is due from its verification phase, earliest executable stage, required-by stage, target availability, current scope, and applicability.

The static browser is authoritative only for deterministic operations it actually implements. The application-native route uses the application-owned declarative Test IR and isolated worker. Arbitrary JavaScript, Python, shell execution, dynamic imports, and unrestricted network or project-state access are not Test IR capabilities. Unsupported mandatory native work fails closed rather than being represented as executed.

External verification uses the same file-first reservation/package/response path as other external operations. Human inspection requires human-owned observation evidence. External-system verification requires evidence attributable to the declared external system. An agent assertion cannot substitute for application-owned byte identity, deterministic results, human observations, or other authority assigned elsewhere.

## Data, backup, and delivery

The application requests persistent browser storage and reports storage status honestly. Browser-local persistence does not prove protection against device loss, profile deletion, site-data clearing, or browser failure. Backup custody distinguishes package generation, export action completion, confirmed external copy, and restore testing from the exported copy.

Release eligibility, artifact identity, evidence-chain closure, terminal delivery authorization, delivery attempt, and externally evidenced delivery are distinct states. Authorization is not represented as completed delivery.

## Migration policy

The deterministic migration path is `human-project/30` → `closed-loop-project/2` → `closed-loop-project/3`. A `/3` project lacking the current contract profile is legacy data and cannot satisfy current gates merely because its schema name is `/3`. Migration must not fabricate semantic review, human authority, execution, evidence, independence, backup custody, mobile acceptance, or delivery.

## Verification

Repository verification is defined by the checked-in verification programs and the single Pages workflow. The proof sequence is intentionally fail-closed: syntax and registry closure precede migration, intake/challenge, Test IR, ingestion, workflow/gate, prompt, mutation, browser, deployment, deployed-byte, deployed-browser, physical-iPhone, final publication, and release-tag proof. A green subset is not represented as complete acceptance.

Only `main` deploys through the one Pages workflow. Deployed verification must bind the canonical origin, base path, build identity, and exact manifested runtime bytes. Final acceptance additionally requires the pinned actual physical-iPhone Safari acceptance record for the exact deployed build.