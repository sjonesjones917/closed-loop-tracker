# Closed-Loop Agent Reliability

Live application:

https://sjonesjones917.github.io/closed-loop-tracker/

## Purpose

This repository contains one phone-first, domain-general application that takes an arbitrary user job through the exact 31-stage closed-loop research, production, verification, correction, acceptance, and release process.

Every new user-created project begins at Stage 1 with the actual job entered by the user and zero completed stages. The application also retains one completed current-schema project about the complete application itself. That project is loaded as a separate JSON project through the same project path as any other project so it demonstrates the application without becoming external authority for its own requirements.

## Required forward architecture

The governing direction is:

`USER INTENT → EXTERNAL RESEARCH → EXTERNAL AUTHORITY → REQUIREMENTS → TESTS → PRODUCTION → INDEPENDENT VERIFICATION → CORRECTION → ACCEPTED PRODUCT → RELEASE`

The application stores and displays three distinct information classes:

1. `USER_JOB_INPUT`
2. `EXTERNAL_RESEARCH_SOURCE`
3. `WORKFLOW_GENERATED_ARTIFACT`

External-source records require affirmative evidence that the source was actually accessed outside the application and is independent of the artifact and workflow records being produced. Local files, relative paths, generated blobs, existing work products, candidates, prior agent output, project JSON, tests, and workflow artifacts cannot be silently registered as external authority.

## Human work, agent work, and stage prompts

Humans, agents, human-agent teams, tools, and organizations remain first-class work owners. The structured stage records, native project data, evidence fields, gates, and independent reviews are the application—not a pasted response box.

Every one of the 31 stages also has its own stage-specific, copy-ready execution prompt. The prompt is generated from that stage's exact role, authorized input collections, native output record schema, current project data, information-class boundary, and stage-specific completion work. It performs only that stage. Stage 2 explicitly performs outward external-source discovery; Stage 8's execution prompt instructs the production-instruction engineer to author the production instruction, rather than substituting a whole-project prompt in the wrong stage.

A human-owned stage can be completed manually without using a prompt. An `AGENT` or `HUMAN_AGENT_TEAM` stage must have its stage prompt generated before completion. Changing the work owner or material upstream evidence invalidates the affected prompt and downstream evidence.

Stages 11, 12, 18, and 20 provide one reusable prompt template with `RUN_ID` and, where required, `MODE` placeholders. The user runs that same prompt in the required fresh contexts. The application does not generate ten different prompts.

## Application behavior

- Exactly 31 stages in the required order.
- One correct stage-specific execution prompt for every stage.
- One reusable prompt—not ten different prompts—for ten-run execution and verification work.
- Complete 20-scope Stage 1 job definition.
- Separate user-input, external-source, and generated-artifact registries.
- Structured findings, requirements, conflicts, tests, instructions, candidates, executions, verification matrices, defects, regressions, corrections, convergence evidence, baselines, products, audits, decisions, hashes, and releases.
- Exactly ten run records for each execution phase.
- Complete mandatory-requirement-by-run verification matrices.
- Downstream stages and generated stage prompts become stale when upstream material changes.
- Exact SHA-256 calculation over the finished product bytes or exact external-result release package.
- Release only for the exact accepted artifact.
- Local browser persistence plus explicit JSON import and export.
- A separate retained `SELF_VERIFIED_PROJECT.json` that uses the current project schema, contains native structured records, remains visible in Projects, and never becomes external authority for the application.
- New projects remain empty at 0/31 even when the retained completed project is present.

## Repository source of truth

`build-app.mjs` reconstructs the standalone structured application from `app-payload/`. `apply-stage-prompts.mjs` then adds the verified 31-stage prompt layer from the ordered `stage-prompt-runtime/part-*.js` files without replacing the native human-operable records. The deployment pipeline attaches the retained application project loader, rebuilds the retained project against the exact resulting application bytes, verifies both artifacts, and deploys those exact bytes.

The public application is named **Closed-Loop Agent Reliability** and has no arbitrary implementation version label. Historical repository history does not define the application identity or the retained project scope.

## Retained application project

The retained project is about building, verifying, accepting, and releasing the complete Closed-Loop Agent Reliability application. It is not defined as a repair stage, a version-number migration, or a narrow implementation defect. Its Stage 1 objective, deliverables, requested actions, scope, constraints, methods, success conditions, and external research questions cover the application as a whole.

`rebuild-self-project.mjs` reconstructs the retained project as a native `closed-loop-project/1` export against the exact application bytes being verified. It preserves one generated copy-ready execution prompt and exact prompt-source hash for every stage, separately preserves the Stage 8 production-instruction output and Stage 9 preflighted instruction output, preserves independently researched external sources, compiles atomic requirements and tests, executes isolated initial, corrected, and unchanged-confirmation browser batches, creates complete verification matrices, records defects and responsible-layer corrections only in the proper defect stages, freezes the accepted baseline, attaches the exact application bytes as the finished product, audits the process and product, verifies SHA-256 identity, and creates the release record.

The retained project remains workflow evidence about what was built and verified. It is never used as external authority for determining what the application is required to be.

## Verification and deployment

`verify-app.mjs` verifies the exact stage manifest, all 31 stage-prompt specifications, the Stage 2 external-research prompt boundary, the one-template ten-run controls, the 20-scope intake, the three information classes, standalone packaging, retained-project loader, human/agent/team ownership, and absence of a generic response-relay design.

`verify-self-project.mjs` verifies that the retained project has all 31 completed stages, all 31 stage-specific prompts and source hashes, separate Stage 8 and Stage 9 instruction outputs, native external sources, findings, requirements, tests, candidates, exactly ten isolated runs per execution phase, complete independent verification matrices, corrected defects and regressions, convergence, unchanged confirmation, exact product bytes, audits, an `ACCEPTED` decision, matching audited/release hashes, and the configured release destination.

`browser-smoke.mjs` executes the real rendered phone UI, confirms the retained project is loaded through the normal current-schema path, creates a separate human-owned arbitrary project at 0/31, verifies all 31 stage prompt panels, generates and inspects the Stage 2 external-research prompt, proves Stage 11 uses one reusable RUN_ID template, proves Stage 20 uses one producer/verifier template, checks the source guard and all three information classes, and tests 393-pixel and 320-pixel phone widths.

`.github/workflows/pages.yml` builds the structured application, applies the stage-prompt layer, attaches and rebuilds the retained application project against the exact application bytes, executes all static and rendered verification gates, creates the exact Pages payload, deploys it, retrieves the live HTML and project JSON, compares both live SHA-256 values with the verified build values, and records the verified live deployment.
