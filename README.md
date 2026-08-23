# Closed-Loop Agent Reliability

Live application:

https://sjonesjones917.github.io/closed-loop-tracker/

## Purpose

This repository contains one phone-first, domain-general application that takes an arbitrary user job through the exact 31-stage closed-loop research, production, verification, correction, acceptance, and release process.

Every new user-created project begins at Stage 1 with the actual job entered by the user and zero completed stages. The application also retains one completed current-schema project about the application itself. That retained project is loaded as a separate JSON project through the same import path as any other project so it can demonstrate the application without becoming external authority for its own requirements.

## Required forward architecture

The governing direction is:

`USER INTENT → EXTERNAL RESEARCH → EXTERNAL AUTHORITY → REQUIREMENTS → TESTS → PRODUCTION → INDEPENDENT VERIFICATION → CORRECTION → ACCEPTED PRODUCT → RELEASE`

The application stores and displays three distinct information classes:

1. `USER_JOB_INPUT`
2. `EXTERNAL_RESEARCH_SOURCE`
3. `WORKFLOW_GENERATED_ARTIFACT`

External-source records require affirmative evidence that the source was actually accessed outside the application and is independent of the artifact and workflow records being produced. Local files, relative paths, generated blobs, existing work products, candidates, prior agent output, project JSON, tests, and workflow artifacts cannot be silently registered as external authority.

## Human and agent work

Humans, agents, human-agent teams, tools, and organizations are first-class work owners. Every stage and structured record identifies who performed the work and the evidence supporting it. The application does not reduce stage completion to a pasted generic agent response and does not make generated prompts the primary user interface.

Stage 8 is an authoring stage and Stage 9 is a preflight stage, but neither stage is implemented as an automatic prompt-generator overlay. Production instructions are ordinary structured workflow artifacts that can be created, reviewed, edited, verified, and owned by a human, an agent, or a human-agent team like other records.

## Application behavior

- Exactly 31 stages in the required order.
- Complete 20-scope Stage 1 job definition.
- Separate user-input, external-source, and generated-artifact registries.
- Structured findings, requirements, conflicts, tests, instructions, candidates, executions, verification matrices, defects, regressions, corrections, convergence evidence, baselines, products, audits, decisions, hashes, and releases.
- Exactly ten run records for each execution phase.
- Complete mandatory-requirement-by-run verification matrices.
- Downstream stages become stale when upstream material changes.
- Exact SHA-256 calculation over the finished product bytes or exact external-result release package.
- Release gate that permits release only for the exact accepted artifact.
- Local browser persistence plus explicit JSON import and export.
- A separate retained `SELF_VERIFIED_PROJECT.json` that uses the current project schema, contains native structured records, remains visible in Projects, and never becomes external authority for the application.
- New projects remain empty at 0/31 even when the retained completed project is present.

## Repository source of truth

`index.html` is the standalone application artifact produced from `app-payload/` by `build-app.mjs`. The deployment pipeline builds that human-operable application, attaches the retained application project loader, verifies both artifacts, and deploys the exact verified bytes. It no longer applies the obsolete generated-prompt mutation before deployment.

The public application has no arbitrary version label. Historical implementation filenames do not define the application identity or the retained project scope.

## Retained application project

The retained project is about building and releasing the complete Closed-Loop Agent Reliability application, not about a repair stage, a version-number migration, or a narrow implementation defect. Its Stage 1 objective, deliverables, requested actions, scope, constraints, methods, success conditions, and external research questions cover the application as a whole.

`rebuild-self-project.mjs` reconstructs the retained project as a native `closed-loop-project/1` export against the exact application bytes being verified. It preserves independently researched external sources, compiles atomic requirements and tests, executes isolated initial, corrected, and unchanged-confirmation browser batches, creates complete verification matrices, records defects and responsible-layer corrections within the proper defect stages, freezes the accepted baseline, attaches the exact application bytes as the finished product, audits the process and product, verifies SHA-256 identity, and creates the release record.

The retained project remains workflow evidence about what was built and verified. It is never used as external authority for determining what the application is required to be.

## Verification and deployment

`verify-app.mjs` verifies the static architecture, exact stage manifest, 20-scope intake, three information classes, standalone packaging, retained-project loader, human/agent/team ownership, and absence of the obsolete prompt-relay design.

`verify-self-project.mjs` verifies that the retained project has all 31 completed stages, native external sources, findings, requirements, tests, candidates, exactly ten isolated runs per execution phase, complete independent verification matrices, corrected defects and regressions, convergence, unchanged confirmation, exact product bytes, audits, an `ACCEPTED` decision, matching audited/release hashes, and the configured release destination.

`browser-smoke.mjs` executes the rendered phone UI, confirms the retained project is loaded through the normal current-schema path, creates a separate human-owned arbitrary project at 0/31, completes Stage 1, verifies all 31 stages render, opens the external-source guard, checks all three information classes, and tests phone widths.

`.github/workflows/pages.yml` rebuilds the standalone human-operable application, attaches the retained project loader, rebuilds the retained application project against those exact bytes, executes all verification gates, creates the exact static Pages payload, deploys it through GitHub Pages, retrieves the live HTML and JSON, compares both live SHA-256 values with the verified build values, and records the verified live deployment.
