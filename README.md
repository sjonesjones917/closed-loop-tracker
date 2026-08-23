# Closed-Loop Agent Reliability

Live application:

https://sjonesjones917.github.io/closed-loop-tracker/

## Purpose

This repository contains one phone-first, domain-general application that takes an arbitrary user job through the exact 31-stage closed-loop research, production, verification, correction, acceptance, and release process.

The application does not preload a project whose objective is to rebuild or repair the application. New projects begin with the actual job entered by the user.

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
- No preloaded completed project and no automatic sidecar project loading.

## Verification and deployment

`verify-app.mjs` verifies the static architecture, exact stage manifest, 20-scope intake, three information classes, standalone packaging, and absence of the prior self-build/prompt-relay design.

`browser-smoke.mjs` executes the rendered phone UI, creates a real arbitrary job, completes Stage 1, verifies all 31 stages render, opens the external-source guard, and checks the three information classes at phone widths.

`.github/workflows/pages.yml` runs both verification layers, creates the exact static Pages payload, deploys it through GitHub Pages, and verifies the live root bytes against the verified `index.html` SHA-256.
