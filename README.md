# Mobile Closed-Loop Agent Reliability Workbook

Live application:

https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one application: `index.html`.

The application implements the controlling 30-stage Mobile Closed-Loop Agent Reliability Workbook. New jobs start clean at Stage 01. It provides the 30-stage tracker, phone-first stage records, copy-ready agent blocks, explicit stage gates, JSON import/export, append-only control records, automatic invalidation, blocker handling, fresh-context records, output receipts, release hashing, and permanent defect/regression controls.

Appendices A–F are implemented as cross-cutting application controls and records. They are not a separate checklist screen and they are not additional stages.

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
