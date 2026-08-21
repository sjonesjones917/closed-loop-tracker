# Closed-Loop Agent Reliability v4.0.0

This repository publishes the phone-first implementation of the exact 31-stage workflow supplied by the owner. The deployed application creates visible, persistent projects in IndexedDB and includes a verified project named `JOB-SELFTEST-31-STAGE`.

## What the application does

- Preserves the exact 31-stage sequence from `DEFINE JOB` through `RELEASE ONLY THE EXACT ACCEPTED ARTIFACT`.
- Executes Stage 1 from the project intake instead of returning a generic prompt wrapper.
- Produces concrete, stage-specific execution commands and stage-specific output contracts.
- Stores projects persistently in the current browser and exposes project export/import for backup and transfer.
- Computes release status from evidence. Pasted words such as `PASS` or `ACCEPTED` cannot override failed gates.
- Invalidates affected downstream records after a material upstream change.
- Includes one complete proof project with 31 completed stages and 30 independent executions: 10 initial, 10 corrected, and 10 unchanged confirmation executions.
- Generates and releases the exact 18-byte file `HELLO_CLOSED_LOOP.txt` only after deterministic, semantic, adversarial, representation, process, product, and release-hash verification.

## Exact released artifact

- Filename: `HELLO_CLOSED_LOOP.txt`
- Exact bytes as UTF-8 text: `HELLO CLOSED LOOP\n`
- Size: 18 bytes
- SHA-256: `960046275eb0798c9968d7a14d0a6d45c09c97534012185f27936cb4cb39550e`

## Deployment integrity

The repository stores the application as ordered transport parts because connector writes have bounded payload sizes. Those parts are not executed independently. The Pages workflow:

1. verifies every part's length and SHA-256;
2. concatenates, decodes, and decompresses the payload;
3. verifies the reconstructed application's exact size and SHA-256;
4. verifies the released artifact's exact size and SHA-256; and
5. deploys only the reconstructed, verified `dist` directory.

Expected deployed application:

- Size: 150,441 bytes
- SHA-256: `8b2d82c4c12b6e7327971a30e37d371f5b779598239432a23a9a952c877828ca`

## Project storage

Project data is stored in IndexedDB for the exact browser and site origin being used. It is not cloud-synchronized. Use **Backup** to export project JSON before clearing browser data or moving to another device. Import that JSON on the destination browser.
