# Mobile Closed-Loop Agent Reliability Workbook

Live application:

https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one application: `index.html`.

The application implements the controlling 30-stage Mobile Closed-Loop Agent Reliability Workbook. New jobs start clean at Stage 01. It provides the 30-stage tracker, phone-first stage records, copy-ready agent blocks, explicit stage gates, JSON import/export, append-only control records, automatic invalidation, blocker handling, fresh-context records, output receipts, release hashing, and permanent defect/regression controls.

Appendices A–F are retained as cross-cutting operational controls used by the stages, not converted into six additional manual workflows:

- Appendix A governs fresh independent agent/context launches, frozen inputs, contamination, tool availability, and run usability.
- Appendix B creates and maintains blockers when mandatory evidence, authority, input, capability, or a decision rule is unavailable; affected downstream work stops.
- Appendix C records material changes append-only, creates new artifact versions, invalidates affected downstream determinations, and identifies required reruns.
- Appendix D is the exact final-release control assembled from the release evidence; delivery is authorized only for the accepted, fully verified, hash-matched artifacts.
- Appendix E is the clean-new-job reset behavior: a new job begins at Stage 01 without inheriting an old baseline, release decision, requirement, test, or job-specific state unless reuse is expressly authorized and re-established.
- Appendix F creates an agent-output receipt for every agent response/artifact, preserving context, versions, files/hashes, deviations, defects/blockers, and the next independent verification stage.

Those Appendix A–F records and actions appear inside the applicable 30-stage workbook screens and use the same controlling workbook state. There is no separate appendix workflow, control application, or duplicate checklist surface.

## Repository contents

- `index.html` — the only application entry point.
- `workbook.js` and `workbook.module.gz.*` — runtime/support code for that same application.
- `verify.mjs` — release verification for the 30-stage architecture and required controls.
- `.github/workflows/pages.yml` — verifies and deploys the exact application.
- `.nojekyll` — GitHub Pages static-file control.

There are no numbered app versions, legacy app entry points, retained completed projects, substitute applications, or alternate deployment artifacts.

## Local verification

Run `node verify.mjs`.

Requirement outcomes are `SATISFIED`, `VIOLATED`, or `UNDETERMINED`. Release outcomes are `ACCEPTED`, `REJECTED`, or `BLOCKED`.
