# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one application with one HTML entry point: `index.html`.

The application is a phone-first human project interface over the 30-stage Mobile Closed-Loop Agent Reliability Workbook. The stages remain Stage 01 through Stage 30. No extra workflow operation is inserted and no supplied stage is removed.

The application keeps user-entered job data, actual stage records, generated instructions, generated outputs, output receipts, files, runs, verification records, defects, changes, blockers, release records, evidence chains, history, and permanent defect/regression records available inside the project when those records actually exist.

Appendices A-F are implemented as cross-cutting controls. Fresh-context, blocker, change/invalidation, release, new-job initialization, and output-receipt records are created where the corresponding workflow event occurs. Appendix E is tied to new-project creation rather than repeated inside an active stage.

`TEST_PROJECT.json` is the retained authorized project `JOB-20260823144121`, titled `Mobile Closed-Loop Agent Reliability Workbook`. It preserves the completed Operation 01 / Stage 01 job definition, shows 1/30 complete, sets Stage 02 as the current next stage, and leaves Stages 02-30 not started without fabricated downstream project records. The completed Operation 01 output, generated Stage 01 instruction, output receipt, user-entered job data, supplied-material record, controlled unknowns, decision evidence, and next action remain visible from the application.

`workbook.js` contains the single 30-stage workflow definition, stage fields, prompt construction, gates, state definitions, hashing, invalidation, and release-file identity comparison. `app.js` contains the single human-facing controller, project persistence, structured stage-field editor, project record views, generated-content retention, contextual supporting records, and release controls.

`build-test-project.mjs` is a non-mutating retained-project and source-integrity check. `verify.mjs` verifies the committed repository state. `verify-live.mjs` verifies the deployed state. The Pages workflow deploys the exact committed application and also renders the live interface at 320 and 393 CSS-pixel widths.
