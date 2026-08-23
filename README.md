# Mobile Closed-Loop Agent Reliability Workbook

Live application:

https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one application: `index.html`.

The application is the phone-first implementation of the controlling 30-stage Mobile Closed-Loop Agent Reliability Workbook. The Human checklist, fill-in Stage record, copy-ready agent block, completion gate, evidence preservation, exact outcome vocabulary, immutable job-artifact versioning, blocker handling, downstream invalidation, ten-run iteration controls, convergence, final-product verification, release identity, evidence-chain preservation, and permanent defect/regression controls belong to that one application.

Appendices A–F are cross-cutting operational controls of the same 30-stage workflow. They are not extra stages, not another application, and not generic checklist stacks appended everywhere. Appendix A is invoked when a fresh independent context is required; Appendix B when a mandatory blocker exists; Appendix C when a material change invalidates downstream work; Appendix D at final release; Appendix E when starting a clean new job; and Appendix F when an agent output is actually received. Their records belong at the workflow event and stage where they apply.

The global workbook control area retains the phone-use instructions, placeholder and outcome rules, mobile naming and folder structure, role-separation map, Master Job Control, 30-stage tracker, mandatory operating rules, and quick execution loop.

## Existing application and test project

- `index.html` is the only application entry point.
- `workbook.js` and `workbook.module.gz.1` through `workbook.module.gz.3` are the runtime files for that same application.
- `verify.mjs` is the repository test project. It verifies the one-app architecture, all 30 stages, the 400-plus explicit human/gate/evidence controls, the complete copy blocks, Appendix A–F event-driven behavior, immutable revision and downstream invalidation behavior, release-gate vocabulary, and byte-identity release rules.
- `.github/workflows/pages.yml` runs `node --check workbook.js` and `node verify.mjs` before deploying the exact verified repository to GitHub Pages.

There are no numbered application versions, alternate application entry points, retained legacy apps, or substitute apps. The test project validates the existing application; it is not another application.

Run the test project with:

```sh
node --check workbook.js
node verify.mjs
```

Requirement outcomes are `SATISFIED`, `VIOLATED`, or `UNDETERMINED`. Release outcomes are `ACCEPTED`, `REJECTED`, or `BLOCKED`.
