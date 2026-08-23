# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one application with one HTML entry point: `index.html`.

The application is a phone-first human interface for the 30-stage Mobile Closed-Loop Agent Reliability workflow. The workbook is implemented as workflow semantics, project records, evidence, validation, blockers, changes, independent-run controls, convergence, baseline control, product verification, release gating, traceability and permanent regression history—not as a literal wall of workbook checkboxes.

`workbook.js` and the compressed workbook modules retain the existing 30-stage workflow engine. `human-ui.js` presents the same persisted project state through human project views for Overview, Workflow, Work, Runs, Issues, Release and History. Detailed workbook controls are available when a stage is opened instead of dominating the normal project interface.

Appendices A-F remain cross-cutting behavior of the same workflow: fresh independent contexts, blockers, change/invalidation control, final release readiness, clean new-project creation, and generated-output receipts. They are surfaced where relevant rather than as permanent appendix checklist pages.

`TEST_PROJECT.json` is the genuine retained application-repair project inside the application. It uses the same project model and views as every other project. Its controlling requirements come from the user repair instruction; repository files such as `README.md`, `index.html`, `human-ui.js`, and the prior retained project are recorded only as implementation evidence, not as authority for what the product ought to be. The project preserves the original job data, source classification, research, atomic requirements, verification procedures, failure tests, production instruction, generated stage instructions, stage outputs, defect/correction history, blocker state, and project history through the point actually reached.

The retained project currently stops truthfully at Stage 11. Ten genuinely independent execution contexts have not been run, so it records zero runs, an open blocker, and downstream stages as not started. It does not fabricate run outputs, convergence, an approved baseline, a finished product, audits, release acceptance, or artifact identity merely to make the interface look complete.

The runtime invalidates an older cached retained test-project fixture when the bundled test-project specification revision changes, so an existing browser does not continue showing obsolete test-project data after deployment.

Repository verification is `node verify.mjs`. It checks the one-app structure, shared project state, compact human project views, inspectable generated instructions/outputs/history, the truthful blocked test-project state, all 30 stages, Appendix A-F semantics, retained workflow controls, immutable revision behavior, invalidation, and release byte-identity controls. GitHub Pages deployment additionally re-downloads exact deployed files and renders the phone UI and built-in test project before publishing the live verification status.
