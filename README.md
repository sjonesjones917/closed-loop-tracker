# Mobile Closed-Loop Agent Reliability Workbook

Live application:

https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one application: `index.html`.

The application implements the controlling 30-stage Mobile Closed-Loop Agent Reliability Workbook as one phone-first workflow. It retains the Human checklist, fill-in Stage record, copy-ready agent block, completion gate, evidence preservation, exact outcome vocabulary, immutable versioning, blocker handling, downstream invalidation, ten-run iteration controls, convergence, final-product verification, release identity, evidence-chain preservation, and permanent defect/regression controls.

Appendices A–F are preserved as cross-cutting controls of that same workflow, not as six extra stages and not as a second checklist surface:

- Appendix A creates a fresh-context launch record for each independent execution or review handoff that requires one. Repeated ten-run work can create repeated records; contaminated or tool-defective contexts are unusable.
- Appendix B can be opened as soon as mandatory evidence, authority, input, capability, or a decision rule is unavailable. Applicable downstream work is stopped and READY is prohibited while the blocker remains open.
- Appendix C can record any material change append-only, assign the change to the current stage, invalidate affected downstream determinations, and keep them invalid until revalidation.
- Appendix D is the exact final release control. Stage 28 first proves SHA-256 and byte-size identity between the audited artifact and the artifact selected for delivery. A successful identity check creates the final release record, which remains NOT RELEASED until the ACCEPTED gate, process/product/representation/evidence-chain determinations, 100% coverage and regression thresholds, zero material-defect/unknown/ambiguity/variance counts, evidence preservation, exact hash identity, and delivery evidence are all affirmatively established.
- Appendix E is executed by the existing New clean job action and prevents old baseline, release, requirement, test, or job-specific state from being silently inherited.
- Appendix F creates an agent-output receipt for every actual copy-block handoff and can create additional receipts as additional agent outputs are received. It preserves response identity, versions, files and hashes, deviations, defects or blockers, and the next independent verification route.

Appendix records appear contextually only when the workflow event requires that record to be completed. There is no standalone Appendix-use page and no permanent generic Appendix checklist appended to every stage. The stage surface exposes compact workflow actions for the cross-cutting controls instead of duplicating the workbook as another checklist system.

The global workbook control area retains the phone-use instructions, placeholder and outcome rules, mobile naming and folder structure, role-separation map, Master Job Control, 30-stage tracker, mandatory operating rules, and quick execution loop.

## Repository contents

- `index.html` — the only application entry point.
- `workbook.js` and `workbook.module.gz.*` — runtime/support code for that same application.
- `verify.mjs` — deterministic verification for the 30-stage architecture, 400+ explicit stage controls, Appendix A–F contextual behavior, immutable change controls, Stage 28 identity verification, and the exact final release control.
- `.github/workflows/pages.yml` — verifies and deploys the exact repository.
- `.nojekyll` — GitHub Pages static-file control.

There are no numbered application versions, alternate application entry points, retained legacy apps, or substitute applications.

## Verification

```sh
node --check workbook.js
node verify.mjs
```

Requirement outcomes are `SATISFIED`, `VIOLATED`, or `UNDETERMINED`. Release outcomes are `ACCEPTED`, `REJECTED`, or `BLOCKED`.
