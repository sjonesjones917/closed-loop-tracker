# Closed-Loop Agent Reliability — phone-first web app

Use the deployed project URL:

https://sjonesjones917.github.io/closed-loop-tracker/

The account-root URL (`https://sjonesjones917.github.io/`) is a different GitHub Pages address and will show a 404 unless a separate user-site repository exists.

## What this build does

- Implements the exact 31-operation workflow beginning with `DEFINE JOB` and ending with `RELEASE ONLY THE EXACT ACCEPTED ARTIFACT`.
- Stores projects locally in the browser.
- Creates the real E2E test project with **0/31 operations complete and zero fabricated agent responses**. It must be worked through like any other project.
- Requires a pasted agent response before a stage can complete.
- Rejects blank, short, structurally inadequate, and out-of-order stage completions.
- Requires all ten distinct run IDs for the ten-run execution operations.
- Invalidates downstream state when a completed upstream stage is materially edited.
- Computes SHA-256 over the exact final artifact and blocks release unless the accepted audited/release hashes match those bytes.
- Uses no application-level streaming or perpetual network loading state. After the page loads, project/workflow operation is browser-local.

## Stage 1 behavior

Stage 1 is an executable instruction, not a generic schema description. Its prompt orders the agent to read the actual request and supplied inputs, create the authoritative job record, preserve the exact objective and requested deliverable, inventory inputs/constraints/unknowns, separate assumptions from requirements, use the app-supplied JOB_ID, assign `INPUT-v001`, and return the completed record.

## Tests

`e2e-test.mjs` is intentionally labeled a **state-machine regression test**, not a fake completed E2E workflow. It proves that the real E2E project starts empty, the workflow contains exactly 31 operations, Stage 1 contains concrete work, blank/short responses are rejected, and stage skipping is rejected.

A real workflow test is performed through the app by selecting **Create real E2E test project** and pasting actual agent responses for every operation.

## Deployment

`.github/workflows/pages.yml` syntax-checks the app core, runs the state-machine regression test, builds `dist/`, and deploys the tested files with GitHub Pages.
