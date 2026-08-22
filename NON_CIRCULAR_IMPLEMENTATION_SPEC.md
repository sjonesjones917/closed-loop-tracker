# Closed-Loop Agent Reliability — controlling non-circular implementation specification

Replace the existing implementation in this repository. Do not create a parallel application. Do not add a user-visible application version number.

## Required authority model

The application must keep three distinct classes:

1. `USER_INPUT`: the user's objective, requested deliverable, explicit requirements, prohibitions, facts, links, and reference material.
2. `EXTERNAL_SOURCE`: independent authority discovered outside the project, including official websites, government material, statutes, regulations, case law, standards, specifications, official platform/API/manufacturer documentation, books, libraries, academic and peer-reviewed literature, professional publications, patent/public databases, policies, and recognized technical references.
3. `WORK_PRODUCT`: anything created or modified by the workflow, including source inventories, findings, requirements, tests, prompts, responses, source code, HTML, JavaScript, project JSON, candidate artifacts, audits, and hashes.

A work product may be inspected later as a verification subject. It must never establish the requirement that caused it to be built.

Forbidden research authority includes application files, repository files, generated files, source code, HTML, JavaScript, tests, fixtures, project JSON, prior workflow outputs, candidate artifacts, current application behavior, and prior agent output lacking independent authority.

Required reasoning direction:

`USER_INPUT + EXTERNAL_SOURCE -> REQUIREMENT -> TEST -> PRODUCTION_INSTRUCTION -> PRODUCED_ARTIFACT -> VERIFICATION -> DECISION`

Never:

`IMPLEMENTATION -> CLAIMED_REQUIREMENT -> IMPLEMENTATION`

## Exact stages

Preserve these numbers, names, and order exactly:

1. DEFINE JOB
2. INVENTORY SOURCES
3. RESEARCH REQUIREMENTS
4. COMPILE ATOMIC REQUIREMENTS
5. RESOLVE CONFLICTS
6. BUILD ACCEPTANCE TESTS
7. BUILD FAILURE/MUTATION TESTS
8. AUTHOR PRODUCTION INSTRUCTION
9. PREFLIGHT INSTRUCTION
10. FREEZE CANDIDATE
11. RUN 10 INDEPENDENT EXECUTIONS
12. VERIFY EVERY RUN AGAINST EVERY REQUIREMENT
13. COMPARE ALL RUNS
14. ROOT-CAUSE EVERY DEFECT
15. ADD REGRESSION TESTS
16. CORRECT RESPONSIBLE LAYER
17. FREEZE NEW VERSION
18. RUN 10 NEW INDEPENDENT EXECUTIONS
19. REPEAT UNTIL CONVERGED
20. RUN UNCHANGED 10-EXECUTION CONFIRMATION
21. FREEZE APPROVED BASELINE
22. GENERATE FINISHED PRODUCT
23. DETERMINISTIC PRODUCT VERIFICATION
24. INDEPENDENT SEMANTIC VERIFICATION
25. ADVERSARIAL PRODUCT VERIFICATION
26. FINAL REPRESENTATION INSPECTION
27. PROCESS AUDIT
28. PRODUCT AUDIT
29. ACCEPTED / REJECTED / BLOCKED
30. VERIFY RELEASE HASH
31. RELEASE ONLY THE EXACT ACCEPTED ARTIFACT

## Stage 1 — DEFINE JOB

Stage 1 defines what must be created. It is not research and must not inspect implementation artifacts.

The generated instruction must require the agent to:

- read the complete user request;
- preserve the exact user objective and exact deliverable;
- extract explicit requirements and prohibitions;
- identify required output form;
- identify applicable domains;
- identify questions that require external authoritative research;
- preserve user-supplied facts separately from assumptions;
- identify unknowns and blockers;
- not research yet;
- not inspect generated implementation artifacts;
- not use an existing implementation as authority.

Required Stage 1 records:

- exactly one `JOB_RECORD`;
- one `INPUT_RECORD` per supplied user input;
- zero or more `BLOCKER_RECORD` objects;
- evidence preserving the complete original request.

Required job fields: `original_request_verbatim`, `operational_objective`, `exact_deliverable_requested`, `explicit_user_requirements`, `explicit_prohibitions`, `required_output_form`, `applicable_domains`, `external_research_questions`, `known_user_supplied_facts`, `assumptions`, `unknowns`, and `mandatory_blockers`.

Reject placeholders such as Job, Test, Sample, Example, Dummy, Fake, TODO, TBD, N/A, None, or bare Unknown.

## Stage 2 — INVENTORY SOURCES

Stage 2 is external-source discovery. Its generated instruction must include this meaning explicitly:

> Search the internet and other external authoritative information sources now. Find the official websites, specifications, standards, technical documentation, books, libraries, professional references, academic literature, databases, laws, regulations, and other external sources that govern this job. Do not use artifacts created by this project as research authority. Do not inspect the requested product to determine what requirements it should satisfy. Determine the requirements first from external authority, then later judge the produced result against those requirements.

The Stage 2 prompt must direct the agent to search outside the project, prefer primary/current/controlling sources, and record every source actually found and examined.

Allowed `source_type` values:

- `OFFICIAL_WEBSITE`
- `GOVERNMENT`
- `STATUTE`
- `REGULATION`
- `CASE_LAW`
- `STANDARD`
- `SPECIFICATION`
- `OFFICIAL_DOCUMENTATION`
- `API_DOCUMENTATION`
- `MANUFACTURER_DOCUMENTATION`
- `BOOK`
- `TEXTBOOK`
- `LIBRARY_REFERENCE`
- `ACADEMIC_PAPER`
- `PEER_REVIEWED_LITERATURE`
- `PROFESSIONAL_PUBLICATION`
- `PATENT`
- `PATENT_DATABASE`
- `PUBLIC_DATABASE`
- `POLICY`
- `TECHNICAL_REFERENCE`
- `OTHER_EXTERNAL_SOURCE`

Do not define or accept `APPLICATION_FILE`, `GENERATED_FILE`, `PROJECT_JSON`, `HTML`, `JAVASCRIPT`, `TEST_FILE`, or any equivalent work-product source type.

Each `EXTERNAL_SOURCE_RECORD` must include: `local_key`, `exact_title`, `source_type`, `author_or_issuing_organization`, `publisher`, `url_or_bibliographic_location`, `publication_date`, `effective_date`, `access_date`, `version`, `authority_level`, `primary_or_secondary`, `research_query`, `why_relevant`, `relevant_portion`, `research_area`, `possible_conflict`, `additional_research_required`, and evidence proving the external source was examined.

Completion requires at least one appropriate external source for every Stage 1 research area, or an explicit mandatory blocker. Externally identifiable provenance is mandatory.

Stage 2 validation must reject:

- internal/repository/file URLs;
- localhost or file URLs;
- source titles or locations identifying application files, code, tests, generated artifacts, project JSON, or current implementation behavior;
- empty source lists where research areas exist;
- generic source claims without title, organization, external location, relevant portion, and evidence;
- a COMPLETE response with uncovered research areas or mandatory blockers.

## Stage 3 — RESEARCH REQUIREMENTS

Stage 3 performs substantive research using the Stage 2 external inventory and additional external sources discovered as necessary.

Its prompt must explicitly forbid deriving requirements from project files, generated code, tests, current behavior, candidate artifacts, project JSON, or prior workflow output without independent authority.

Each `RESEARCH_FINDING` must include: `local_key`, `research_question`, `external_source_refs`, `exact_source_location`, `relevant_portion`, `finding`, `requirement_implications`, `mandatory_recommendation_or_inference`, `applicability`, `exceptions`, `conflicts`, `uncertainty`, and evidence.

Completion requires every Stage 1 external research question to be answered with source-backed findings or explicitly blocked. Every source reference must resolve to an accepted external source record.

## Stages 4–31

- Stage 4 requirements must declare origin `USER`, `EXTERNAL_AUTHORITY`, or `DERIVED_ENGINEERING_REQUIREMENT`. Derived requirements must trace through requirements to user input or external sources, never only to work products.
- Stages 5–10 must use the externally grounded registry, not implementation behavior, to determine correctness.
- Stages 11, 18, and 20 require ten genuinely separate producer executions each.
- Stages 12, 18, and 20 require ten genuinely separate corresponding verifier executions. Each verifier prompt must include only its corresponding producer output and hash, never sibling outputs or prior conclusions.
- Minimum current evidence: 30 producers and 30 verifiers. Duplicate raw-response hashes do not count.
- Candidate files become inspectable only after production, as verification subjects in Stages 12 and 23–28.
- Stage 29 decision is derived, never manually set.
- Stage 30 compares exact accepted and release bytes with SHA-256.
- Stage 31 releases only identical accepted bytes.

## Canonical state

Imported completion flags, project status, decision, release state, counts, hashes, defect closure, and independence claims are untrusted. Recompute all derived state by replaying accepted raw responses, prompt hashes, evidence, records, artifacts, and exact bytes in stage order.

A newly created project starts at `0/31`. Only a valid Stage 31 release record produces `31/31`.

Any material upstream change must preserve history but invalidate affected downstream results.

## UI and persistence

The phone-first app must provide project list/search/create/open/import/export/backup/restore/delete, project overview, exact stage workspace, evidence/audit/event history, explicit async states, terminal errors and retry/cancel controls, and no infinite spinner. It must work at 320 px and 390 px, portrait and landscape, without horizontal overflow or clipped controls.

Every visible control must have a real handler. No stage may complete from a button press without validated evidence.

## Response envelope

Every standard stage response must be one JSON object:

```json
{
  "schema": "closed_loop_stage_response",
  "project_id": "APPLICATION-SUPPLIED PROJECT ID",
  "stage_number": 1,
  "stage_name": "DEFINE JOB",
  "status": "COMPLETE",
  "prompt_hash": "SHA-256 OF EXACT PROMPT USED",
  "summary": "SUBSTANTIVE SUMMARY",
  "records": [],
  "artifacts": [],
  "evidence": [],
  "checks": [],
  "blockers": [],
  "next_stage_handoff": {}
}
```

Allowed status values: `COMPLETE`, `BLOCKED`, `FAILED`.

The app computes raw-response and accepted-parsed-data hashes. Validation must be structural, referential, evidentiary, requirement-specific, and semantic where deterministic validation cannot establish meaning.

## Real self-verification project

Retain project/job identity history for `JOB-MT3M46X0-M0LIB9`, but do not retain its old completion claim. Recreate the project through the visible UI from `0/31` with title exactly `Closed-Loop Application Self-Verification`.

For this software job:

- Stage 1 defines the desired application and external research areas.
- Stage 2 uses real external sources concerning HTML, CSS, JavaScript, browser/Safari/iOS behavior, responsive design, accessibility, IndexedDB, Web Crypto, Fetch/Streams/HTTP, validation, testing, security, and deployment.
- Stage 3 records actual source-backed findings.
- Stages 4–10 create the engineering package.
- Stages 11 onward build and verify candidate implementations.

The project must contain at least 30 real producer responses and 30 real corresponding independent verifier responses, actual candidate artifacts, defects and regression tests, a generated final application, deterministic/semantic/adversarial/representation verification, process and product audits, a derived decision, matching release hashes, and a valid Stage 31 release.

Export through the visible app control as exactly `verified-self-project.json`. Do not manually construct the completed export. The released app must load or import it in a clean browser session and display its provenance and hash.

## Required release files

- `index.html`
- application source files
- `package.json`
- dependency lockfile
- build and test configuration
- automated tests
- `verified-self-project.json`
- `verification-evidence.json`
- `release-manifest.json`
- `candidate-identity.json`
- `complete-test-report.json`
- final hashes and inspection instructions

## Required implementation work

1. Inspect the current repository.
2. Replace defective implementation code in place.
3. Implement the non-circular prompts and deterministic validators first.
4. Add tests proving internal work products are rejected as Stage 2/3 authority and real external sources are required.
5. Implement complete canonical replay, gating, invalidation, project operations, evidence, execution-cycle, product, audit, and release behavior.
6. Build and run all deterministic tests.
7. Build a visible-browser end-to-end runner that uses the actual UI and real Copilot CLI processes, not state injection.
8. Do not mark the application complete or accepted from this implementation task. Acceptance is permitted only after the real self-verification workflow later passes.
