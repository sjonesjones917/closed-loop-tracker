# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one application with one HTML entry point: `index.html`.

The application is a phone-first human project interface over the 30-stage Mobile Closed-Loop Agent Reliability Workbook. The stages remain Stage 01 through Stage 30. No extra workflow operation is inserted and no supplied stage is removed.

The application keeps the complete human-facing job record, every stage record, generated instructions, generated outputs, user-entered data, files, runs, verification records, defects, changes, blockers, release records, evidence chains, history, and permanent defect/regression records available inside the project as those records are actually created.

Appendices A-F are implemented as cross-cutting project controls at the stages where their records are required. They create and preserve fresh-context records, blockers, change/invalidation records, final-release controls, new-job reset records, and generated-output receipts. They are not separate walls of repeated checklists and they do not add stages to the 30-stage workflow.

`TEST_PROJECT.json` is the retained authorized project `JOB-20260823144121`, titled `Mobile Closed-Loop Agent Reliability Workbook`. It preserves the completed Operation 01 / Stage 01 job definition supplied for that project, shows Stage 01 complete, leaves Stages 02-30 not started, and sets the next required action to Operation 02 — Build the Source Inventory. It does not fabricate requirements, tests, run sets, verification results, release evidence, or other downstream records that have not happened yet. The completed Operation 01 output, generated Stage 01 instruction, output receipt, user-entered job data, supplied-material record, controlled unknowns, and stage record are visible inside the project.

`build-test-project.mjs` validates and preserves that retained authorized project; it does not rewrite it into an unrelated demonstration job.

`workbook.js` contains the single 30-stage workflow core. `app.js` contains the human-facing application controller. Existing browser projects remain under the same project-storage key and are preserved when the repaired application loads.

`node verify.mjs` checks the single-app structure, exact 30 stages, the authorized retained project identity and state, Stage 01 completion, absence of fabricated downstream evidence, human-facing project records, and discarded architecture checks.

The GitHub Pages workflow validates the retained project, deploys the same single application, and renders the live interface at 320 and 393 CSS-pixel widths.
