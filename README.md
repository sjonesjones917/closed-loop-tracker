# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one application with one HTML entry point: `index.html`.

The application is a phone-first human interface for the 30-stage Mobile Closed-Loop Agent Reliability workflow. The workbook is implemented as workflow semantics, project records, evidence, validation, blockers, changes, independent-run controls, convergence, baseline control, product verification, release gating, traceability and permanent regression history—not as a literal wall of workbook checkboxes.

`workbook.js` and the compressed workbook modules retain the existing 30-stage workflow engine. `human-ui.js` presents the same persisted project state through human project views for Overview, Workflow, Work, Runs, Issues, Release and History. Detailed workbook controls are available when a stage is opened instead of dominating the normal project interface.

Appendices A-F remain cross-cutting behavior of the same workflow: fresh independent contexts, blockers, change/invalidation control, final release readiness, clean new-project creation, and generated-output receipts. They are surfaced where relevant rather than as permanent appendix checklist pages.

`TEST_PROJECT.json` is a genuine portable-generator service-handoff project inside the application, not another application and not a self-test of the app. Its actual repository inputs are `test-project/inputs/REQUEST.md`, `SITE_POLICY.md`, and `WORKFLOW_RULES.md`. The project preserves the user-entered data, inspected sources, research, requirements, tests, production instruction, generated stage instructions, stage records, blockers, evidence-chain state and complete history through the point actually reached.

The test project currently stops truthfully at Stage 11. Ten genuinely independent execution contexts have not been run, so it records zero runs, an open blocker, and downstream stages as not started. It does not fabricate run outputs, convergence, an approved baseline, a finished product, audits, release acceptance, or artifact identity merely to make the interface look complete.

Repository verification is `node verify.mjs`. It checks the one-app structure, shared project state, compact human project views, inspectable generated instructions/outputs/history, the truthful blocked test-project state, all 30 stages, Appendix A-F semantics, 400+ retained workflow controls, immutable revision behavior, invalidation, and release byte-identity controls. GitHub Pages deployment additionally re-downloads exact deployed files and renders the phone UI and built-in test project before publishing the live verification status.
