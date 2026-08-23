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

Stage 1 performs lossless intake across the complete 20-scope user-job definition. It preserves the objective, deliverables, requested actions, targets, complete question set, scope boundaries, supplied inputs and provenance classes, prior-conversation dependencies, user terminology, constraints, prohibitions, required methods, output properties, time and jurisdiction, acceptance conditions, priorities, unresolved intake issues, and the external research questions handed to Stage 2.

## Stage 2 behavior

Stage 2 receives the complete Stage 1 job definition as research scope, searches independent external authorities, and is prohibited from promoting supplied implementation files or workflow-generated artifacts into the external-source registry.

## Tests

`e2e-test.mjs` is intentionally labeled a **state-machine regression test**, not a fake completed E2E workflow. It proves that the real E2E project starts empty, the workflow contains exactly 31 operations, Stage 1 contains concrete work, blank/short responses are rejected, and stage skipping is rejected.

A real workflow test is performed through the app by selecting **Create real E2E test project** and pasting actual agent responses for every operation.

## Deployment

`.github/workflows/pages.yml` regenerates the existing v13 application, runs the state-machine and real browser self-build workflow, independently verifies the exact UI export and released bytes, publishes the verified files to `main`, and serves the repository through GitHub Pages.

Deployment regeneration requested after the lossless Stage 1 and external-authority Stage 2 correction on 2026-08-22.
