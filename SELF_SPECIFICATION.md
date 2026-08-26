# Closed-Loop Reliability Application — Implementation Specification

## 1. Purpose

Build a single static vanilla-JavaScript application that lets a human operator define a job, obtain stage-specific work from external agents, ingest strict structured responses, review proposed changes, and advance only when deterministic canonical evidence satisfies the current stage gate. The application is a reliability and orchestration system, not an authority that silently converts agent prose into truth.

The human supplies genuine human-owned information, runs or transfers generated prompts to external agents, reviews proposals and irreducible judgments, supplies files when needed, and explicitly authorizes true human decisions. The application performs identity allocation, validation, persistence, derivation, gating, invalidation, artifact hashing, release evaluation, evidence-chain construction, and exact-byte comparison.

When an implementation job is too large for the available environment, the system must direct the agent to produce a complete implementation-ready specification instead of pretending repository implementation occurred. Self-contained outputs such as specifications, analyses, research papers, patent drafts, and similar artifacts may be produced directly.

## 2. Architecture boundary

Keep one owner per responsibility:

- `workbook.js`: 30 workflow stages, names, roles, declared completion conditions, explicit stage ownership partitions.
- `workflow-schema.js`: project and response schemas, field metadata, record schemas, relationships, operation contracts, scope requirements, resource limits, collection commit policies, mutation authorization.
- `hash.js`: canonical serialization and SHA-256 for values and exact bytes; semantic-envelope, content, and full-record hashes.
- `prompt-engine.js`: stage-specific prompt content, bounded context selection, prompt identity, response contract, sufficiency and recovery instructions.
- `response-ingestion.js`: duplicate-member rejection, parsing, schema/identity/scope/ownership/type/relationship/evidence validation, raw capture, proposal planning, clarification, disposition, acceptance, rejection, manifests, and receipts.
- `workflow-engine.js`: canonical records, application commands, derivations, current-scope selectors, stage gates, repeated-iteration evaluation, invalidation, release logic, artifact identity, evidence chains, and operational metrics.
- `project-store.js`: one IndexedDB adapter, compare-and-swap project revisions, project integrity hashes, artifact Blobs, migration, complete compressed package export/import, storage health.
- `app-core.js`: rendering and operator actions only; no direct canonical collection writes.
- `index.html`: one static application shell, CSS, accessibility regions, and ordered deferred module loading.
- `.github/workflows/pages.yml`: source verification, ingestion/gate/lifecycle tests, prompt contradiction tests, organic browser acceptance, deployment, exact deployed-byte verification, deployed browser acceptance, status artifact and accepted-commit tag.

Do not introduce another parser, store, workflow engine, prompt authority, application shell, framework rewrite, backend without a multi-device requirement, MutationObserver, monkey patch, runtime guard layer, or field-level dependency graph.

## 3. Canonical identities and schemas

Workflow identity: `mobile-closed-loop/30`.

Project schema: `closed-loop-project/2`.

Response schema: `closed-loop-stage-response/2`.

A project contains exactly 30 stages. Workflow identity, schema identity, and stage count are distinct properties. Legacy `human-project/30` data may be migrated deterministically, preserving raw source payloads as quarantined non-operational migration archives.

Every canonical record receives an application-assigned ID. External agents may use temporary response-local keys and may echo an application-reserved `targetId`; they never allocate canonical IDs.

## 4. Authority model

Every field has exactly one producer: `HUMAN`, `HUMAN_DECISION`, `AGENT`, or `APPLICATION`. Ownership partitions are explicit and exhaustive; no runtime fallback infers an agent owner.

Application-owned values include canonical IDs, event IDs and sequence, lifecycle state, versions, byte sizes from actual bytes, SHA-256 from actual bytes, current stage/state, next action, blocker summary, counts, coverage, verification-matrix completeness, convergence, baseline validity, release determination, artifact identity, evidence-chain completeness, invalidation, and current-scope selection.

Human-owned values include the verbatim job request, supplied-material description, explicit constraints, known human-supplied authority, desired or suggested source count, allowed/required tools, prohibited actions, and answers to human-only questions.

Human-decision-owned values include intent confirmation and genuine authorization or tradeoff decisions.

Agent-owned values include substantive findings, researched source facts, requirements, tests, instructions, reviews, comparisons, RCA explanation, regression content, adversarial findings, meaning-review findings, and evidence claims.

One `authorizeMutation` function enforces producer/actor/mutation-type compatibility across ingestion, human input, human decisions, import, correction, and migration.

## 5. Minimal Stage 01 intake

A new project starts organically with a unique application-assigned `JOB_ID`. The normal Stage 01 human intake is limited to what only the human can authoritatively supply: verbatim objective, supplied materials, desired output format, temporal scope, desired/suggested source count, known authority, available tools, prohibitions, and explicit requirements.

The Stage 01 agent normalizes the job and either returns a complete `DATA_PROPOSAL` or structured `HUMAN_INPUT_REQUIRED` questions. Human answers create a new input version, invalidate the old prompt/proposal, and regenerate the same stage prompt. Stage 01 completes only after a current accepted data proposal and an explicit human intent confirmation bound to the exact accepted change and input version.

## 6. Prompt requirements

Each stage has a purpose-built prompt. The prompt combines the exact current human input, current application state, applicable current canonical records, relevant prior-stage data, answered clarifications, open blockers, requested corrections/refinements, operation scope, and response contract.

Context selection is explicit and bounded by each stage/operation contract. Historical or irrelevant collections must not silently enter a prompt. Large artifact bytes are referenced by canonical identity unless actual attachment transfer is required. No silent `last N` truncation is allowed.

Every prompt instructs the external agent to determine whether the available human input, application context, prior output, evidence, and capability are sufficient for the specific job and current stage. The agent must distinguish:

- missing human authority -> `HUMAN_INPUT_REQUIRED`;
- missing application context -> `BLOCKED` with `MISSING_APPLICATION_CONTEXT`;
- unavailable external capability -> `BLOCKED` with `MISSING_CAPABILITY` or `EXECUTION_FAILED` when an attempted execution fails;
- work too large for the available environment -> `BLOCKED` with `WORK_TOO_LARGE_FOR_ENVIRONMENT` and, when useful, an implementation-ready specification as the bounded deliverable;
- inadequate prior agent output -> a corrected/refined data proposal after operator feedback, not a project restart.

Stage 02 treats the human's desired source count as guidance, never a quota. When web access exists, the agent searches broadly enough to discover the source landscape, inspects original authoritative publications, prefers primary/official/controlling sources, verifies identity/currency/applicability, and never invents a source to satisfy a count.

## 7. Strict response envelope

Every agent response is one JSON object using `closed-loop-stage-response/2` and includes job, stage, operation, prompt identity, stage-relevant scope, response type, human-input requests, stage data, record proposals, evidence, unresolved items, warnings, and attachment declarations.

Prompt identity binds `instructionId`, `bodySha256`, `contractSha256`, and `contextSignature`. Scope binds the response to the current project revision and applicable input/source/requirements/test/instruction/iteration/candidate/run/context/baseline/product identities.

Response types are mutually exclusive:

- `DATA_PROPOSAL`: agent-owned data/records/evidence only; no blocking requests or application-owned mutations.
- `HUMAN_INPUT_REQUIRED`: structured questions and explanatory evidence; no stage data or records.
- `BLOCKED`: structured unresolved items and evidence; no stage data, records, or human-input requests.
- `EXECUTION_FAILED`: execution/tool failure information and evidence; no canonical stage data.

Raw response bytes are preserved before parsing. Duplicate JSON member names, malformed/truncated/wrapped JSON, unknown properties, resource-limit violations, type violations, invalid enums, prohibited nulls, placeholders, ownership violations, stale identities, invalid relationships, unresolved evidence, attachment mismatches, duplicate content, and cross-project references fail closed without canonical mutation.

## 8. Transaction and provenance model

Response handling uses three durable phases: raw capture, parse/proposal, and canonical acceptance. A pending proposal stores project revision, prompt identities/hashes, scope hash, and referenced-record hashes. Acceptance reruns all relevant validation against current state.

Canonical changes are all-or-nothing. Collection policies are declared as `REPLACE_CURRENT_STAGE_SET`, `APPEND_SCOPED`, `UPDATE_RESERVED`, `APPEND_ONLY`, or `APPLICATION_DERIVED`.

Each accepted agent value or relationship produces extraction-manifest entries with origin type, raw response, prompt identity, context signature, exact JSON pointer, raw-value hash, normalizer, normalized value, temporary key, canonical collection/record/field or relationship, target identity, evidence IDs, validation rules/results, project revision, event sequence, and device timestamp.

The system stores both raw-response SHA-256 and canonical-envelope SHA-256. Semantic duplicates return the existing receipt/disposition. Repeat acceptance is idempotent.

## 9. Persistence and integrity

Use one IndexedDB database named `closed-loop-reliability` with `projects`, `artifacts`, and `meta` object stores. Project writes use expected revision compare-and-swap inside one transaction. A second tab cannot overwrite a newer revision. BroadcastChannel may notify other tabs but is never a second store.

Artifact intake stores actual Blob bytes, computes SHA-256 and byte size from actual bytes, reads the Blob back, rehashes it, and creates canonical artifact identity only after verification.

Every persisted project stores `projectSha256`. Loading recomputes the canonical hash and quarantines a mismatch rather than silently normalizing corruption.

The application requests persistent browser storage and displays whether persistence was granted, estimated usage/quota, current committed revision, and last verified complete export. Browser-local persistence is never described as protection from device loss or user deletion.

Complete export uses a compressed JSON package containing canonical project state, raw responses, validations, proposals, receipts, manifests, artifact metadata, actual artifact bytes, package manifest/hash, and schema versions. Import verifies project/package/artifact integrity before activation and leaves existing projects unchanged on failure.

## 10. Deterministic workflow semantics

Stage storage separates immutable accepted `agentData`, versioned `humanData`, and recalculated `derivedData`. Every canonical record is stamped by the application with applicable current scope. Gates and derivations use only current active records; historical records cannot satisfy current gates.

A derivation registry maps every application-derived field to deterministic code and preserved input references/calculation version.

Stages 11, 17, and 19 use one repeated-iteration evaluator. Verification coverage is based on exact `REQ_ID × RUN_ID × TEST_ID` triples. Stages 17 and 19 use explicit operation subcontracts and run scope only for operations that actually act on one run.

A material upstream change conservatively invalidates every later stage, later prompts, pending proposals, confirmations, release records, artifact identity batches, evidence chains, convergence evaluations, and delivery authorization.

## 11. Thirty-stage completion contract

1. Define the exact job, resolve human-only questions, accept the current normalized proposal, and bind human intent confirmation.
2. Establish legitimate external governing sources or an evidence-supported no-applicable-source determination; resolve controlling conflicts.
3. Research every current source and complete conflict/exception passes.
4. Compile atomic testable requirements with provenance and observable success/failure.
5. Resolve requirement-set defects or block; new requirement versions invalidate downstream work.
6. Give every active mandatory requirement at least one current applicable ready test; coverage = 1.0.
7. Exercise failure/mutation tests and reject invalid fixtures; validator defects block.
8. Produce one current instruction version and complete requirement-to-instruction traces.
9. Independently preflight every required instruction section/trace; corrections create a new instruction version and repeat review.
10. Human selects candidate components; application freezes exact artifact identities/bytes/hashes and assigns iteration/candidate IDs.
11. Reserve exactly ten runs/contexts and accept ten independent outputs using one exact candidate.
12. Complete the exact current requirement × run × test verification matrix with independent evidence.
13. Compare all ten runs for every mandatory requirement and create defects for correctness-affecting variance.
14. Root-cause every material defect at the earliest defective layer or block when unknown.
15. Create a permanent regression definition and demonstrated pre-correction failure for every confirmed defect.
16. Correct the responsible layer with controlled versioning/authorization and invalidate downstream evidence.
17. Create a corrected iteration/candidate and repeat ten runs, verification, comparison, RCA/regression/correction behavior.
18. Derive convergence only when coverage/regression success are 1.0 and every blocking defect/unknown/contradiction/ambiguity/unexplained variance count is zero simultaneously.
19. Reuse the exact converged candidate identity/hashes, create ten new contexts, rerun full verification/regression, and confirm no new material defect/requirement/failure/variance.
20. Human authorizes the baseline; application freezes exact versions and artifact bytes/hashes under a new baseline identity.
21. Reserve product/execution identities, use a fresh production context and approved baseline only, and retain actual produced artifact bytes and lineage.
22. Execute all applicable deterministic tests against actual product bytes and require every mandatory result SATISFIED.
23. Independently verify substantive meaning for every applicable requirement; no mandatory VIOLATED/UNDETERMINED result.
24. Execute applicable attack categories and active historical regression patterns; unresolved mandatory findings create defects/blockers.
25. Inspect every product/delivery artifact and required representation; objective facts are application-derived and irreducible judgments explicitly owned.
26. Reconcile process and product audits independently and require both SATISFIED with all discrepancies reconciled or blocked.
27. Application computes exactly one idempotent release result from complete current evidence: ACCEPTED, REJECTED, or BLOCKED.
28. After ACCEPTED only, compare audited canonical artifacts with selected delivery bytes one-to-one by canonical identity, authorized filename, byte size, and SHA-256, independent of selection order.
29. Application constructs complete evidence graphs for every mandatory requirement from authority through released artifact identity; agent investigation only locates missing links.
30. Preserve defect/regression history append-only and require latest applicable regression success before baseline approval.

## 12. Operator workflow

Normal operation is: enter human-owned input -> generate/save exact stage instruction -> run it in an external agent context -> paste complete JSON response -> parse/validate -> review concise proposal diff -> accept, reject, or request correction -> application commits atomically -> application derives state/gate -> continue.

The operator never manually coordinates canonical IDs, manually asserts deterministic statuses/counts/hashes, or transcribes agent output into record forms. Structured clarification answers use schema-driven typed controls. Accepted responses may be invalidated for explicit refinement without restarting the job; the refinement reason is included in the next prompt.

Run-batch controls allocate slots automatically. Artifact controls hash actual files. Application-only calculations such as release determination and evidence-chain construction run automatically when their prerequisite accepted stage data is committed; the UI may expose idempotent recalculate/inspect controls but must not require the human to invent application state.

Operator names are labeled `Operator label` and stored with `identityAssurance = SELF_ASSERTED` until actual authentication exists.

## 13. Release and evidence

Release evaluation includes the current mandatory requirement set, deterministic results, meaning reviews, adversarial findings, representation inspections, regression executions, process/product audits, critical/major defects, mandatory unknowns, blockers, baseline/product identity, and evidence freshness. The evidence set is hashed; unchanged evidence returns the same release record, changed evidence supersedes the prior record and revokes delivery authorization.

Artifact identity joins by canonical artifact ID and authorized filename, never array position. Missing, extra, duplicated, renamed without authorization, size-mismatched, hash-mismatched, or stale artifacts cannot be authorized.

Evidence chains must contain authority or human authority -> requirement -> instruction trace -> execution/product -> every applicable test -> every required test result -> canonical evidence -> current release decision -> every applicable released artifact identity.

## 14. Support contract

Supported production contract: current Chromium desktop, current Android Chrome, minimum viewport 320 CSS pixels, IndexedDB, Web Crypto, Blob, and CompressionStream for complete compressed package export. Do not claim Safari, Firefox, offline service-worker behavior, or multi-device synchronization until separately implemented and tested.

## 15. Acceptance and reliability claims

Production acceptance must cover architecture/source checks, schema/ownership/derivation/relationship completeness, strict ingestion and negative cases, one continuous 30-stage lifecycle, prompt contradiction and operation-leakage tests, an organic browser-created self-specification project using only public operator controls for mutation, local Chromium, responsive widths, persistence, multi-tab CAS, storage-failure rollback, package round trip, deployment, exact deployed-source identity, and deployed Chromium.

The organic acceptance project must start from a normal blank project, enter the self-specification request as ordinary human input, use generated prompts and returned-response controls stage by stage, exercise at least one clarification, one rejected/corrected response, one confirmed defect/regression/correction cycle, three ten-run batches, actual candidate/baseline/product file bytes, release identity, evidence chains, reload, and export/import. The resulting product artifact is this implementation specification.

Acceptance reporting must derive measured counts from the tests that actually ran rather than hard-code stale numbers. A successful deterministic suite supports the claim `100% conformant to tested deterministic invariants`; it does not prove unknown bugs, external factual truth, device survival, or a statistical operational failure rate without real-operation measurements.
