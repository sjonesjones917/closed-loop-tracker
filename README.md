# Closed-Loop Agent Reliability v5

This repository publishes the phone-first implementation of the owner's exact 31-operation closed-loop workflow, from `DEFINE JOB` through `RELEASE ONLY THE EXACT ACCEPTED ARTIFACT`.

## Application behavior

- Projects are visible and persistent in browser storage and can be backed up.
- Stage 1 is not auto-completed. It must return the actual job record and satisfy its completion-evidence contract.
- Every one of the 31 operations has a stage-specific evidence contract.
- A bare `PASS`, `COMPLETE`, one-line summary, or synthetic `SELFTEST-EVIDENCE-XX` token is rejected as completion evidence.
- A material upstream correction requires a new frozen version and invalidates affected downstream validation.
- Release is separate from release-hash verification and occurs only at Stage 31.

## Built-in end-to-end proof project

Project: `JOB-SELFTEST-001`

Objective: create `closed-loop-selftest.txt` with the exact bytes `CLOSED-LOOP-SELFTEST\n`.

The proof project does not fake an all-green first iteration. Its first frozen candidate exercises a real failure-and-correction loop:

1. CANDIDATE-v001 executes 10 isolated deterministic runs through `TOOL-CONFIG-v001`.
2. All 10 runs reproduce a CRLF newline-translation defect: 22 bytes, SHA-256 `d37d29bf116c0dd3fa88c5c5840339c09cacdff60427df29dd4660a71d3f05be`.
3. Every run is verified against every atomic requirement; the failing batch records 20/60 SATISFIED and 40/60 VIOLATED determinations.
4. `DEFECT-0001` is root-caused to the text-mode writer configuration, not the already-correct production instruction.
5. A permanent CRLF regression test is added.
6. The responsible layer is corrected to `TOOL-CONFIG-v002`, a binary exact-byte writer with newline translation disabled.
7. CANDIDATE-v002 is frozen; the affected v001 downstream evidence is invalidated.
8. Ten fresh v002 executions produce the exact required artifact.
9. An unchanged ten-execution v002 confirmation also produces the exact artifact.
10. Only then is the baseline frozen and the product generated, deterministically verified, semantically reviewed, adversarially tested, representation-inspected, process-audited, product-audited, release-gated, hash-verified, and released.

The deterministic built-in proof uses isolated execution buffers/directories. It does **not** claim that ten independent external LLM sessions were spawned. General-job prompts require genuinely separate executions when that workflow operation is performed.

## Exact released self-test artifact

- Filename: `closed-loop-selftest.txt`
- Exact UTF-8 bytes: `CLOSED-LOOP-SELFTEST\n`
- Size: 21 bytes
- SHA-256: `5463b810697c6766faa0e1acce45bddb51eff700380de153b1904b68410ac0e3`

## Deployment integrity

GitHub Pages does not deploy arbitrary repository source bytes. `tools/build-pages.py`:

1. verifies every ordered payload part by byte length and SHA-256;
2. concatenates, Base64-decodes, and gzip-decompresses the application;
3. verifies the reconstructed application's exact byte size and SHA-256;
4. checks correction-cycle and release identity markers;
5. verifies the exact release artifact bytes, size, and SHA-256; and
6. writes only the verified application and release artifact into `dist` for Pages deployment.

Expected reconstructed application:

- Size: 126,476 bytes
- SHA-256: `4003b16caecf99e76fa854ed72d55b7ca8f2430aae788d79f57e726cb9217da9`

## Project storage

Project state is browser-local. Use **Backup** before clearing browser data or moving to another device.
