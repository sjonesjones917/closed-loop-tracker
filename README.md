# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one application with one HTML entry point: `index.html`.

The application is a phone-first human interface for the 30-stage Mobile Closed-Loop Agent Reliability workflow. The workbook is implemented as workflow semantics, project records, evidence, validation, blockers, changes, independent runs, convergence, baseline control, product verification, release gating, traceability and permanent regression history—not as a literal wall of workbook checkboxes.

`workbook.js` and the compressed workbook modules retain the existing 30-stage workflow engine. `human-ui.js` presents that state as a human project with Overview, Work, Runs, Issues, Release and History views. Both use the same persisted project state.

Appendices A-F remain cross-cutting behavior of the same workflow: fresh independent contexts, blockers, change/invalidation control, final release readiness, clean new-project creation, and generated-output receipts. They are surfaced where relevant rather than as permanent appendix checklist pages.

`TEST_PROJECT.json` is one populated project inside the application, not another application. Its sources include actual application files, and its finished product is the real repository artifact `test-project/TEST-JOB-001__UX-AUDIT.md`. The project preserves an initial failed ten-run iteration, independent verification, root cause, regression, correction, a second ten-run iteration, an unchanged ten-run confirmation, baseline, finished product, release evidence and evidence chains. Generated prompts and captured outputs are part of the project data and are visible in the project interface.

Repository verification is `node verify.mjs`. It checks the one-app structure, shared project state, human project views, inspectable prompts/outputs/history, actual test-project artifact identity, ten-run iteration records, 30 stages, Appendix A-F semantics, immutable revision behavior, invalidation and release byte-identity controls.
