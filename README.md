# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one application with one HTML entry point: `index.html`.

The application is a phone-first human project interface over the 31-operation closed-loop reliability workflow:

Define Job → Inventory Sources → Research Requirements → Compile Atomic Requirements → Resolve Conflicts → Build Acceptance Tests → Build Failure / Mutation Tests → Author Production Instruction → Preflight Instruction → Freeze Candidate → Run 10 Independent Executions → Verify Every Run → Compare Runs → Root-Cause Defects → Add Regression Tests → Correct Responsible Layer → Freeze New Version → Run 10 New Independent Executions → Repeat Until Converged → Unchanged 10-Execution Confirmation → Freeze Approved Baseline → Generate Finished Product → Deterministic Verification → Independent Meaning Verification → Adversarial Verification → Final Representation Inspection → Process Audit → Product Audit → ACCEPTED / REJECTED / BLOCKED → Verify Release Hash → Release Exact Accepted Artifact.

The detailed workbook remains the underlying workflow specification in `workbook.js` and the compressed workbook modules. `human-ui.js` presents that workflow as a compact project experience rather than reproducing the workbook as a wall of checkboxes.

Project data keeps three classes structurally distinct: **User Job Input**, **External Research Sources**, and **Workflow-Generated Artifacts**. Existing implementation files, generated code, tests, project JSON, previous agent conclusions, and unfinished products are implementation/provenance evidence; they are not promoted into external requirement authority.

Appendices A-F operate as cross-cutting application services: fresh-context isolation, blockers, change/invalidation control, computed release readiness, clean new-project initialization, and generated-output receipts. They surface where the operator needs them rather than as permanent appendix checklist pages.

`TEST_PROJECT.json` is the retained application-focused project. It uses the same project schema, persistence, workflow views, controls, prompts, records, blockers, and history mechanisms as ordinary projects. Its subject is the Closed-Loop Reliability application as an operator-facing product. It evaluates workflow behavior, prompt usability, project-history visibility, independence controls, release controls, persistence, and phone-sized use without embedding development-task instructions or treating implementation files as requirement authority.

The retained project truthfully stops at **Operation 11**. Ten genuinely independent execution contexts have not been performed, so it records zero runs, an open blocker, and Operations 12–31 as not started. It does not fabricate run outputs, convergence, an approved baseline, a finished product, audits, acceptance, or release identity.

`node build-test-project.mjs` validates the retained project instead of generating synthetic completion. `node verify.mjs` checks the one-app structure, 31-operation human workflow, three-class authority separation, contextual Appendix A-F services, clean new-project behavior, mutation rejection, the intact underlying workbook controls, immutable revisions, invalidation, and release byte identity.

GitHub Pages deployment verifies exact deployed file identity, renders the retained project at phone viewport widths, exercises workflow and project history, checks compact controls, confirms zero synthetic runs, and verifies that New Project starts clean.
