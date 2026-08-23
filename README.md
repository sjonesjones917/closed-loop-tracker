# Closed-Loop Agent Reliability

Live application:

https://sjonesjones917.github.io/closed-loop-tracker/

## Purpose

This repository contains one phone-first, domain-general application that takes an arbitrary user job through the exact 31-stage closed-loop research, production, verification, correction, acceptance, and release process.

The governing direction is:

`USER INTENT → EXTERNAL RESEARCH → EXTERNAL AUTHORITY → REQUIREMENTS → TESTS → PRODUCTION → INDEPENDENT VERIFICATION → CORRECTION → ACCEPTED PRODUCT → RELEASE`

The application does not use an unfinished product, generated implementation, generated test, project record, or prior workflow conclusion as authority for determining that product's requirements.

## Retained application project

The Projects view retains one completed project about the complete Closed-Loop Agent Reliability application. It was created through the application's project workflow and remains a normal application project: it is imported into the same project store, appears in the same project list, opens in the same workflow UI, contains the same 31 ordered stages, and can be exported through the same visible project control.

The retained project demonstrates that the application works. It is not a repair task, a filename test, a fictional application version, or a special replacement product. It covers the entire application build and records human, agent, and human-agent-team work. New user-created projects still begin at Stage 1 with 0 of 31 stages complete.

The retained project is workflow evidence. It never becomes independent external authority for its own requirements.

## Three information classes

The application stores and displays three distinct information classes:

1. `USER_JOB_INPUT`
2. `EXTERNAL_RESEARCH_SOURCE`
3. `WORKFLOW_GENERATED_ARTIFACT`

External-source records require affirmative evidence that the source was accessed externally and is independent of the artifact and workflow records being produced. Local files, relative paths, generated blobs, existing work products, candidates, prior agent output, and workflow artifacts cannot be silently registered as external authority.

## Human and agent work

Humans, agents, human-agent teams, tools, and organizations are first-class work owners. Every stage records the responsible actor, completed work, evidence, blockers, and structured workflow records. The application does not reduce completion to a pasted generic agent response and does not use the interface as a container for relaying prompts.

## Application behavior

- Exactly 31 stages in the required order.
- Complete 20-scope Stage 1 job definition.
- Separate user-input, external-source, and generated-artifact registries.
- Human, agent, and human-agent-team ownership.
- Structured findings, requirements, conflicts, tests, instructions, candidates, executions, verification matrices, defects, regressions, corrections, convergence evidence, baselines, products, audits, decisions, hashes, and releases.
- Exactly ten run records for the execution stages.
- Requirement-by-run verification matrices.
- Downstream stages become stale when upstream material changes.
- Exact SHA-256 calculation over the finished product bytes or exact external-result release package.
- Release gate that permits release only for the exact accepted artifact.
- Local browser persistence plus explicit JSON import and export.
- One retained completed application project plus unlimited new projects that start at 0/31.

## Verification and deployment

`build-app.mjs` reconstructs the standalone human-first application from the retained application payload.

`migrate-self-project.mjs` keeps the retained project's identity and completed evidence while enforcing the complete application-build scope and removing implementation-history framing.

`attach-self-project.mjs` loads the retained project through the application's native JSON import path without embedding completed project state in the application HTML.

`verify-app.mjs`, `verify-self-project.mjs`, and `browser-smoke.mjs` verify the architecture, exact stage manifest, twenty-scope intake, information-class boundaries, human ownership, retained project behavior, mobile rendering, and absence of the former prompt-relay interface.

`.github/workflows/pages.yml` builds and verifies the application, deploys the exact verified files through GitHub Pages, compares the live bytes with the verified SHA-256 values, and then materializes those same live-verified application and project files back into the repository. Therefore the committed root application, the deployed application, and the retained project are kept in one verified state.
