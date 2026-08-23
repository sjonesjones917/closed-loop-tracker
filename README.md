# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one application with one HTML entry point: `index.html`.

The application is a phone-first human project interface over the exact 30-stage Mobile Closed-Loop Agent Reliability Workbook. The stages remain Stage 01 through Stage 30. No extra workflow operation is inserted and no supplied stage is removed.

The application keeps the complete human-facing job record, every stage record, all generated instructions, all generated outputs, all user-entered data, files, runs, verification records, defects, changes, blockers, release records, evidence chains, history, and the permanent defect/regression registry available inside the project.

Appendices A-F are implemented as cross-cutting project controls at the stages where their records are actually required. They create and preserve fresh-context records, blockers, change/invalidation records, final-release controls, new-job reset records, and generated-output receipts. They are not separate walls of repeated checklists and they do not add stages to the 30-stage workflow.

`TEST_PROJECT.json` is a retained completed test job for generator `GEN-042`: it uses supplied telemetry and an output contract to produce a concise field status report. `build-test-project.mjs` materializes the retained source data into the completed 30-stage project used for deployment. The project preserves the exact user-entered job data, all 30 generated stage instructions, all 30 generated stage outputs, both ten-run sets, requirement-by-run verification, root-cause and permanent regression evidence, convergence, unchanged confirmation, baseline, finished product, deterministic and independent meaning verification, adversarial review, representation inspection, Stage 26 reconciliation, release decision, exact artifact identity, evidence chains, and Stage 30 permanent records.

`workbook.js` contains the single 30-stage workflow core. `app.js` contains the human-facing application controller. Existing browser projects remain under the same project-storage key and are preserved when the repaired application loads.

`node verify.mjs` checks the single-app structure, exact 30 stages, complete retained test project, generated instructions and outputs, two ten-run sets, verification matrix, evidence chains, permanent regressions, release controls, and prohibited discarded architecture.

The GitHub Pages workflow rebuilds the retained test project, verifies the source, deploys the same application, and renders the live interface at 320 and 393 CSS-pixel widths.