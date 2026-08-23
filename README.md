# Closed-Loop Agent Reliability

Live application:

https://sjonesjones917.github.io/closed-loop-tracker/

## Purpose

This repository contains one phone-first, domain-general application that takes an arbitrary user job through the exact 31-stage closed-loop research, production, verification, correction, acceptance, and release process.

The application retains one completed native project named **CLOSED-LOOP AGENT RELIABILITY APPLICATION — COMPLETE BUILD**. That project was created with the same project model and visible application controls used for every other project, is about the complete application itself, and preserves all 31 completed stages as proof that the application works. It is workflow evidence, never external authority for its own requirements. New user-created projects still begin at Stage 1 with 0 of 31 stages complete.

## Required forward architecture

The governing direction is:

`USER INTENT → EXTERNAL RESEARCH → EXTERNAL AUTHORITY → REQUIREMENTS → TESTS → PRODUCTION → INDEPENDENT VERIFICATION → CORRECTION → ACCEPTED PRODUCT → RELEASE`

The application stores and displays three distinct information classes:

1. `USER_JOB_INPUT`
2. `EXTERNAL_RESEARCH_SOURCE`
3. `WORKFLOW_GENERATED_ARTIFACT`

External-source records require affirmative evidence that the source was accessed externally and is independent of the artifact and workflow records being produced. Local files, relative paths, generated blobs, existing work products, candidates, prior agent output, and workflow artifacts cannot be silently registered as external authority.

## Human and agent work

Humans, agents, human-agent teams, tools, and organizations are first-class work owners. The application records who performed each operation and the evidence supporting that work. It does not reduce stage completion to a pasted generic “agent response,” and it does not fill the UI with generated prompts.

## Application behavior

- Exactly 31 stages in the required order.
- Complete 20-scope Stage 1 job definition.
- Separate user-input, external-source, and generated-artifact registries.
- Structured findings, requirements, conflicts, tests, instructions, candidates, executions, verification matrices, defects, regressions, corrections, convergence evidence, baselines, products, audits, decisions, hashes, and releases.
- Exactly ten run records for the execution stages.
- Requirement-by-run verification matrices.
- Downstream stages become stale when upstream material changes.
- Exact SHA-256 calculation over the finished product bytes or exact external-result release package.
- Release gate that permits release only for the exact accepted artifact.
- Local browser persistence plus explicit JSON import and export.
- Automatic same-origin loading of the completed application project as a protected native project while every new user project starts at 0/31.

## Verification and deployment

`migrate-self-project.mjs` keeps the retained project in the current `closed-loop-project/1` schema and removes obsolete repair/version framing from its narrative records without treating the project as external authority.

`verify-app.mjs` verifies the static architecture, exact stage manifest, 20-scope intake, three information classes, standalone packaging, human-first interaction model, and persistent native-project bootstrap.

`verify-self-project.mjs` verifies that the completed project is about the entire application, has exactly 31 completed stages, preserves human work ownership, contains the required independent execution and verification records, has no obsolete version/repair scope drift, and retains an accepted release identity.

`browser-smoke.mjs` executes the rendered phone UI from clean browser storage, proves the completed application project is automatically loaded, visible, protected, and openable as a native project, creates a separate human-owned arbitrary job at 0/31, completes Stage 1, verifies all 31 stages render, opens the external-source guard, and checks the three information classes at phone widths.

`.github/workflows/pages.yml` runs these verification layers, creates the exact static Pages payload, deploys the application and completed project JSON through GitHub Pages, and verifies the live bytes of both artifacts against their verified SHA-256 values.
