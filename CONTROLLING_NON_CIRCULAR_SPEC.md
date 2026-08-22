# Controlling non-circular architecture

Modify this existing repository in place. The product is named **Closed-Loop Agent Reliability** with no user-visible version number.

## Authority boundary

Keep three distinct classes:

- `USER_INPUT`: user objective, deliverable, explicit requirements/prohibitions/facts/links/reference material.
- `EXTERNAL_SOURCE`: independent authority outside the project: official/government sites, laws, case law, standards, specifications, official platform/API/manufacturer documentation, books, libraries, academic/peer-reviewed literature, professional publications, patent/public databases, policies, and recognized technical references.
- `WORK_PRODUCT`: anything produced or modified by this workflow: inventories, findings, requirements, tests, prompts, responses, source code, HTML, JavaScript, project JSON, candidates, products, audits, hashes.

A work product can later be a verification subject. It can never be research authority establishing the requirement that caused it to be built.

Required direction: `USER_INPUT + EXTERNAL_SOURCE -> REQUIREMENT -> TEST -> PRODUCTION_INSTRUCTION -> PRODUCED_ARTIFACT -> VERIFICATION -> DECISION`.

## Exact stages

Preserve exactly: 1 DEFINE JOB; 2 INVENTORY SOURCES; 3 RESEARCH REQUIREMENTS; 4 COMPILE ATOMIC REQUIREMENTS; 5 RESOLVE CONFLICTS; 6 BUILD ACCEPTANCE TESTS; 7 BUILD FAILURE/MUTATION TESTS; 8 AUTHOR PRODUCTION INSTRUCTION; 9 PREFLIGHT INSTRUCTION; 10 FREEZE CANDIDATE; 11 RUN 10 INDEPENDENT EXECUTIONS; 12 VERIFY EVERY RUN AGAINST EVERY REQUIREMENT; 13 COMPARE ALL RUNS; 14 ROOT-CAUSE EVERY DEFECT; 15 ADD REGRESSION TESTS; 16 CORRECT RESPONSIBLE LAYER; 17 FREEZE NEW VERSION; 18 RUN 10 NEW INDEPENDENT EXECUTIONS; 19 REPEAT UNTIL CONVERGED; 20 RUN UNCHANGED 10-EXECUTION CONFIRMATION; 21 FREEZE APPROVED BASELINE; 22 GENERATE FINISHED PRODUCT; 23 DETERMINISTIC PRODUCT VERIFICATION; 24 INDEPENDENT SEMANTIC VERIFICATION; 25 ADVERSARIAL PRODUCT VERIFICATION; 26 FINAL REPRESENTATION INSPECTION; 27 PROCESS AUDIT; 28 PRODUCT AUDIT; 29 ACCEPTED / REJECTED / BLOCKED; 30 VERIFY RELEASE HASH; 31 RELEASE ONLY THE EXACT ACCEPTED ARTIFACT.

## Stage 1

Stage 1 defines the real job and does no research. It must not inspect generated code, application files, HTML, JavaScript, tests, project JSON, candidates, or current behavior. Its prompt must require exact user objective and deliverable, explicit requirements and prohibitions, output form, applicable domains, external research questions, known user facts, assumptions, unknowns, blockers, one JOB_RECORD, one INPUT_RECORD per user input, and evidence preserving the original request.

For software jobs, Stage 1 must identify external research domains such as HTML/CSS/JavaScript standards, iPhone/Safari behavior, responsive layout, accessibility, storage, cryptographic hashing, streams/networking, validation, testing, security, deployment, and domain-specific legal or technical requirements. It must not research them yet.

## Stage 2

Stage 2 is external-source discovery only. Its generated prompt must explicitly say:

> Search the internet and other external authoritative information sources now. Find official websites, specifications, standards, technical documentation, books, libraries, professional references, academic literature, databases, laws, regulations, and other external sources governing this job. Do not use artifacts created by this project as research authority. Do not inspect the requested product to determine what requirements it should satisfy. Determine requirements first from external authority, then later judge produced results against those requirements.

Allowed source types only: OFFICIAL_WEBSITE, GOVERNMENT, STATUTE, REGULATION, CASE_LAW, STANDARD, SPECIFICATION, OFFICIAL_DOCUMENTATION, API_DOCUMENTATION, MANUFACTURER_DOCUMENTATION, BOOK, TEXTBOOK, LIBRARY_REFERENCE, ACADEMIC_PAPER, PEER_REVIEWED_LITERATURE, PROFESSIONAL_PUBLICATION, PATENT, PATENT_DATABASE, PUBLIC_DATABASE, POLICY, TECHNICAL_REFERENCE, OTHER_EXTERNAL_SOURCE.

Reject APPLICATION_FILE, GENERATED_FILE, PROJECT_JSON, HTML, JAVASCRIPT, TEST_FILE, repository files, localhost/file URLs, generated artifacts, current behavior, and prior agent output lacking independent authority.

Every EXTERNAL_SOURCE_RECORD requires exact title, source type, author or issuing organization, publisher, external URL or bibliographic location, publication/effective/access dates, version, authority level, primary/secondary classification, research query, relevance, exact relevant portion, research area, conflict/additional-research flags, and evidence the source was actually found and examined. Each Stage 1 research area needs an appropriate external source or an explicit blocker.

Stage 2 must not return a completed source inventory inside the generated instruction. It instructs the external research agent to perform the discovery now and defines the exact response contract. The app validates the returned real research response.

## Stage 3

Stage 3 performs substantive external research. It must forbid deriving requirements from project files, generated code/tests, current behavior, candidates, project JSON, or prior workflow outputs. Every RESEARCH_FINDING requires research question, accepted EXTERNAL_SOURCE references, exact source location/portion, finding, requirement implications, mandatory/recommendation/inference classification, applicability, exceptions, conflicts, uncertainty, and evidence. Every Stage 1 research question must be answered or explicitly blocked.

The Stage 3 instruction must explicitly direct the agent to read the external sources and determine requirements before implementation exists.

## Later traceability

Stage 4 origins are USER, EXTERNAL_AUTHORITY, or DERIVED_ENGINEERING_REQUIREMENT. Derived requirements must trace through requirements to user input or external sources, never only to work products. Stages 5–10 use the externally grounded registry. Candidate files become inspectable only after production as verification subjects.

Every requirement must trace backward to USER_INPUT or EXTERNAL_SOURCE. A generated application file, generated test, project JSON, existing product behavior, or unsupported prior agent output is never an authority source.

Verification moves forward: USER_INPUT/EXTERNAL_SOURCE -> REQUIREMENT -> TEST -> PRODUCTION_INSTRUCTION -> PRODUCED_ARTIFACT -> VERIFICATION_EVIDENCE -> DECISION.

Stages 11, 18, and 20 each require ten separate real producer executions. Corresponding verification requires ten separate verifier executions. Each verifier receives only its matching producer output/hash. Minimum accepted evidence is 30 unique producers and 30 unique verifiers; duplicate raw-response hashes do not count.

## Canonical state and response envelope

New projects begin 0/31. Imported completion/status/decision/release/count/hash/defect-closure/independence claims are untrusted. Recompute by replaying raw responses, prompt hashes, records, evidence, artifacts, and bytes in order. Only a valid Stage 31 release yields 31/31. Preserve invalidated history but exclude it from current completion.

Every normal stage response is one JSON object with schema closed_loop_stage_response; matching project_id, stage_number, stage_name, prompt_hash; status COMPLETE/BLOCKED/FAILED; substantive summary; records; artifacts; evidence; checks; blockers; next_stage_handoff. Compute raw-response and parsed-data hashes. Validate structure, references, evidence, stage-specific meaning, and semantic sufficiency.

## App behavior

Implement phone-first projects/list/search/create/open/import/export/verified backup/restore/delete, overview, exact stage workspace, raw prompts/responses, parsed preview, field errors, attachments, hashes, retries, evidence/audit/event history, explicit IDLE/LOADING/STREAMING/VALIDATING/SUCCESS/FAILED/CANCELLED/TIMED_OUT states, terminal errors, retry/cancel, no infinite loading, and every visible control wired. Support 320 px and 390 px portrait/landscape with no horizontal overflow/clipping.

The application must support recording external research query, date, source, URL or bibliographic reference, authority, relevant portion, finding, requirement implications, evidence, and unresolved questions. If the app cannot browse, it generates a prompt for a real external agent with internet access and validates the returned response; it never substitutes inspection of its own files.

## Self-verification

Preserve job identity history `JOB-MT3M46X0-M0LIB9` but discard its old completion claim. Recreate through the visible UI from 0/31 with title exactly `Closed-Loop Application Self-Verification`.

Its Stage 2 must discover real independent sources for HTML, CSS, ECMAScript/JavaScript, browser/Safari/iOS behavior, responsive design, accessibility, IndexedDB/storage, Web Crypto, Fetch/Streams/HTTP, data validation, software testing, security, and deployment. Its Stage 3 must contain real findings from those external sources. Application files can appear only later as producer artifacts and verification subjects.

Use real external Copilot CLI processes in Actions and the visible application UI; never inject completed state. Require at least 30 real producers and 30 matching real verifiers. Export through the app as exactly `verified-self-project.json`; bundle and serve it; prove clean-session load and provenance/hash.

The old project named `REAL SELF-BUILD — CLOSED-LOOP RELIABILITY V13` and its old 31/31 claim are not accepted evidence because its Stage 2/3 logic was circular. The corrected project must retain the job-ID history but use the exact required title and be rebuilt from 0/31.

## Required release files

index.html, source files, package.json, dependency lockfile, build/test config, automated tests, verified-self-project.json, verification-evidence.json, release-manifest.json, candidate-identity.json, complete-test-report.json, final hashes, and inspection instructions.

## Engineering task

Inspect current code and replace defective code in place. Implement the non-circular Stage 1–3 prompts and validators first. Add deterministic tests that internal work products are rejected and external sources are required. Then implement complete replay, gating, invalidation, project/evidence/execution/product/audit/release behavior. Create a visible-browser end-to-end runner that drives the actual UI and separate real Copilot CLI processes. Do not claim acceptance during implementation; only the subsequent real self-verification may earn it.

Execution trigger: replace the live circular application and regenerate the self-verification project only after the corrected implementation and tests pass.