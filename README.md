# Mobile Closed-Loop Agent Reliability Workbook

Live application:

https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one application: `index.html`.

The application is the phone-first implementation of the controlling 30-stage Mobile Closed-Loop Agent Reliability Workbook. The Human checklist, fill-in Stage record, copy-ready agent block, completion gate, evidence preservation, exact outcome vocabulary, immutable job-artifact versioning, blocker handling, downstream invalidation, ten-run iteration controls, convergence, final-product verification, release identity, evidence-chain preservation, and permanent defect/regression controls belong to that one application.

Appendices A–F are cross-cutting operational controls of the same 30-stage workflow. They are not extra stages, not another application, and not permanent checklist stacks. Appendix A is used when a fresh independent context is required; Appendix B when a mandatory blocker exists; Appendix C when a material change invalidates downstream work; Appendix D at final release; Appendix E when starting a clean new job; and Appendix F when an agent output is received. Their records belong at the workflow event and stage where they apply.

The global workbook control area retains the phone-use instructions, placeholder and outcome rules, mobile naming and folder structure, role-separation map, Master Job Control, 30-stage tracker, mandatory operating rules, and quick execution loop.

## Existing application and test project

- `index.html` is the only application entry point.
- `workbook.js` and `workbook.module.gz.1` through `workbook.module.gz.3` are runtime files for that same application.
- `TEST_PROJECT.json` is the retained completed test project. It can be loaded from the app with **Test project** and is displayed as a normal project in the same workbook. The app exposes its user-entered project data, requested deliverable, inputs and sources, requirements, generated production instruction, verification and failure tests, every execution batch and output, defects and corrections, convergence, baseline, finished product, release evidence, evidence chains, and all 30 stage records.
- `verify.mjs` is the repository verifier. It is not the test project and it is not presented as application content.
- `.github/workflows/pages.yml` runs `node --check workbook.js` and `node verify.mjs` before deploying the exact verified repository to GitHub Pages.

There are no numbered application versions, alternate application entry points, retained legacy apps, or substitute apps.

Repository verification:

```sh
node --check workbook.js
node verify.mjs
```

Requirement outcomes are `SATISFIED`, `VIOLATED`, or `UNDETERMINED`. Release outcomes are `ACCEPTED`, `REJECTED`, or `BLOCKED`.
