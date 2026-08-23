# Mobile Closed-Loop Agent Reliability Workbook

Live application:

https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one application: `index.html`.

The application implements the controlling 30-stage Mobile Closed-Loop Agent Reliability Workbook as one phone-first workflow. It retains the Human checklist, fill-in Stage record, copy-ready agent block, completion gate, evidence preservation, exact outcome vocabulary, immutable versioning, blocker handling, downstream invalidation, ten-run iteration controls, convergence, final-product verification, release identity, evidence-chain preservation, and permanent defect/regression controls.

Appendices A–F are preserved as cross-cutting controls of that same workflow, not as six extra stages and not as a second checklist surface:

- Appendix A creates and completes a fresh-context launch record when an independent execution or review handoff requires one; contaminated or tool-defective contexts are unusable.
- Appendix B is created when mandatory evidence, authority, input, capability, or a decision rule is unavailable; applicable downstream work is stopped and READY is prohibited while the blocker remains open.
- Appendix C records material change and invalidation append-only from the responsible-layer revision flow and keeps downstream determinations invalid until revalidation.
- Appendix D is the Stage 28 exact artifact-identity control. Delivery requires an ACCEPTED Stage 27 gate plus exact SHA-256 and byte-size identity between the audited artifact and the artifact selected for delivery.
- Appendix E is executed by the existing New clean job action and prevents old baseline, release, requirement, test, or job-specific state from being silently inherited.
- Appendix F is created by the actual agent handoff/copy-block action and preserves response identity, versions, files and hashes, deviations, defects or blockers, and the next independent verification route.

Appendix records appear contextually only when the workflow event requires that record to be completed. There is no standalone Appendix-use page and no permanent generic Appendix checklist appended to every stage.

The global workbook control area retains the phone-use instructions, placeholder and outcome rules, mobile naming and folder structure, role-separation map, Master Job Control, 30-stage tracker, mandatory operating rules, and quick execution loop.

## Repository contents

- `index.html` — the only application entry point.
- `workbook.js` and `workbook.module.gz.*` — runtime/support code for that same application.
- `verify.mjs` — deterministic verification for the 30-stage architecture, 400+ explicit stage controls, Appendix A–F contextual behavior, immutable change controls, and release identity rules.
- `.github/workflows/pages.yml` — verifies and deploys the exact repository.
- `.nojekyll` — GitHub Pages static-file control.

There are no numbered application versions, alternate application entry points, retained legacy apps, or substitute applications.

## Verification

```sh
node --check workbook.js
node verify.mjs
```

Requirement outcomes are `SATISFIED`, `VIOLATED`, or `UNDETERMINED`. Release outcomes are `ACCEPTED`, `REJECTED`, or `BLOCKED`.
