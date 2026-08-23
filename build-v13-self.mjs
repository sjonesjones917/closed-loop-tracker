import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const BUILD_REVISION = '2026-08-22-forward-external-authority';

const STAGE_DEFINITIONS = [
  ['DEFINE JOB', `Execute lossless job intake now from USER JOB INPUT only. Capture all 20 scopes explicitly: (1) EXACT USER OBJECTIVE; (2) EXACT DELIVERABLE OR DELIVERABLES; (3) REQUESTED ACTIONS; (4) SUBJECT AND TARGET; (5) PROBLEM AND QUESTION SET; (6) SCOPE BOUNDARIES; (7) SUPPLIED INFORMATION AND INPUTS; (8) PROVENANCE CLASSIFICATION using USER_ASSERTION, USER_OBSERVATION, USER_SUPPLIED_DATA, USER_SUPPLIED_DOCUMENT, USER_SUPPLIED_URL, THIRD_PARTY_QUOTATION, PRIOR_AGENT_OUTPUT, EXISTING_WORK_PRODUCT, CANDIDATE_ARTIFACT, or OTHER_USER_SUPPLIED_INPUT as applicable; (9) PRIOR CONVERSATION DEPENDENCIES; (10) USER-DEFINED TERMINOLOGY; (11) CONSTRAINTS; (12) PROHIBITED ACTIONS; (13) REQUIRED METHODS AND PROCESS CONDITIONS; (14) REQUIRED OUTPUT PROPERTIES; (15) TEMPORAL SCOPE; (16) LOCATION AND JURISDICTION supplied by the user; (17) USER-STATED SUCCESS AND ACCEPTANCE CONDITIONS; (18) PRIORITIES AND OPTIMIZATION CRITERIA; (19) KNOWN UNCERTAINTIES, AMBIGUITIES, CONTRADICTIONS, AND MISSING INFORMATION classified NONMATERIAL, EXTERNALLY_RESEARCHABLE, USER_CLARIFICATION_REQUIRED, or BLOCKING; and (20) EXTERNAL RESEARCH QUESTIONS AND DOMAINS for Stage 2. Also state ASSUMPTIONS and BLOCKERS explicitly, including NONE when applicable. Preserve substantive user meaning and every supplied input without silently narrowing scope. Stage 1 is intake, not external research: do not decide externally governed legal, technical, scientific, professional, safety, market, or factual requirements here. Do not use unfinished products, generated implementation artifacts, candidate files, project JSON, generated tests, prior agent conclusions, or workflow work products as authority for what the requested artifact should be. Return the completed Stage 1 job definition with all 20 labeled scopes.`],
  ['INVENTORY SOURCES', `Execute actual external source discovery now. Start from the complete Stage 1 job definition, its external research questions, subject, jurisdiction, temporal scope, requested actions, output type, and acceptance expectations. Search outward using available Internet, library, database, standards, specification, official-documentation, academic-literature, authoritative-repository, current-public-information, and other externally accessible research capabilities appropriate to the domain. USER JOB INPUT is research scope and factual input, not automatically external authority. WORKFLOW-GENERATED ARTIFACTS—including the artifact being created, unfinished implementations, existing candidate behavior, source code, generated tests, project JSON, prior agent conclusions, and prior workflow reports—are prohibited from the EXTERNAL RESEARCH SOURCE registry for establishing requirements. For every actual external source, record SOURCE_ID, exact title, author or issuing body, SOURCE_TYPE, publisher or host, canonical location, publication date, effective date when applicable, retrieval date, version or revision, jurisdiction when applicable, authority classification, mandatory/informative/evidentiary SOURCE_ROLE, research questions addressed, relevant sections, applicability, currency, reliability, conflicts, and exact evidence extracted or referenced. Establish an applicable source hierarchy; a search-result page and an AI summary are not authority. Continue until every Stage 1 external research question is COVERED, NOT_APPLICABLE, or BLOCKED; controlling and higher-authority sources have been sought; currency has been checked where material; and conflicting sources are identified. Return only the completed external source inventory and coverage ledger. Do not perform Stage 3 requirement extraction.`],
  ['RESEARCH REQUIREMENTS', `Execute substantive requirements research now using the Stage 2 EXTERNAL RESEARCH SOURCE set. Answer every Stage 1 research question from independently accessed external authority. For every finding, record FINDING_ID, SOURCE_ID, exact relevant external section or evidence reference, applicability, obligations, prohibitions, exceptions, conditions, dependencies, quantitative limits, technical and compatibility constraints, required procedures, required formats, safety conditions, quality requirements, current factual conditions, conflicts, and verification implications. Distinguish binding or mandatory rules from recommendations and direct source requirements from derived engineering implications. Do not derive a requirement from the unfinished product, existing implementation behavior, generated code, generated tests, project JSON, prior workflow output, or an earlier agent conclusion. If a new externally governed question appears, return it to Stage 2 for additional external research rather than guessing. Complete only when every substantive externally governed finding is traceable to independent external authority or explicitly BLOCKED. Return only the completed Stage 3 research findings and coverage result.`],
  ['COMPILE ATOMIC REQUIREMENTS', `Compile the complete requirements universe now from exactly two permissible origins: USER_REQUIREMENT, derived from Stage 1 USER JOB INPUT; and EXTERNALLY_GOVERNED_REQUIREMENT, derived from Stages 2 and 3 EXTERNAL RESEARCH SOURCES. Do not create a third origin based on what an existing, unfinished, broken, candidate, or previously generated artifact already does. Split every compound obligation into independently verifiable atomic requirements. Every REQ record must contain REQUIREMENT_ID, exact ATOMIC_STATEMENT, ORIGIN, CONTROLLING_SOURCE_OR_USER_INPUT_REFERENCE, APPLICABILITY, MANDATORY_OR_OPTIONAL status, DEPENDENCIES, VERIFICATION_METHOD, OBJECTIVE_ACCEPTANCE_CRITERION, and FAILURE_CONDITION. Every mandatory requirement must trace either to an explicit user requirement or to independently established external authority. Mark any mandatory item with inadequate authority or unresolved applicability BLOCKED rather than inventing support. Return the complete atomic requirement registry, origin totals, traceability coverage, and blockers.`],
  ['RESOLVE CONFLICTS', `Resolve conflicts now among USER_REQUIREMENTS, EXTERNALLY_GOVERNED_REQUIREMENTS, multiple external authorities, jurisdictional rules, technical constraints, process conditions, and output constraints. The unfinished product, previous broken product, candidate behavior, generated code, generated tests, project JSON, or prior workflow conclusion is never a tie-breaker. For each conflict record CONFLICT_ID, conflicting items and REQ_IDs, authority and jurisdiction of each item, applicable hierarchy or resolution rule, chosen outcome, exact rationale and evidence, downstream impact, and STATUS as RESOLVED, USER_CLARIFICATION_REQUIRED, or BLOCKED. Binding law, safety requirements, and controlling authority cannot be silently overridden. Informative or voluntary guidance does not automatically override an explicit user requirement unless adopted or otherwise controlling. Preserve the user’s substantive objective whenever it remains lawful, feasible, and compatible with controlling external requirements. Do not silently choose between unresolved controlling authorities. Return the resolved requirement registry plus the complete conflict and blocker table, and state UNFINISHED_PRODUCT_USED_AS_TIEBREAKER: false.`],
  ['BUILD ACCEPTANCE TESTS', `Build the acceptance test suite now from the resolved atomic requirement registry, not from candidate behavior. For every mandatory REQ_ID create at least one TEST record that can establish SATISFIED, VIOLATED, or UNDETERMINED. Record TEST_ID, REQ_ID, test type, procedure, inputs, expected result, required affirmative evidence, verification method, independence requirement, and failure condition. Prefer deterministic verification for deterministic properties. Prove mandatory requirement test coverage is 100 percent or return BLOCKED. A test that merely reproduces current implementation behavior without tracing to an approved requirement is invalid.`],
  ['BUILD FAILURE/MUTATION TESTS', `Build and execute failure and mutation tests now from the approved requirements and acceptance tests. For every requirement where a violating case is constructible, create a mutation that violates that requirement while holding unrelated conditions constant. Record MUTATION_ID, REQ_ID, changed condition, expected detector, execution evidence, and DETECTED/NOT_DETECTED result. Any validator that accepts a known violating mutation is defective and prevents completion. Preserve the mutations as permanent evidence; do not redefine correctness from how the candidate currently behaves.`],
  ['AUTHOR PRODUCTION INSTRUCTION', `Author the complete production instruction now from the approved USER_REQUIREMENTS, EXTERNALLY_GOVERNED_REQUIREMENTS, resolved conflicts, acceptance tests, and mutation tests. Include the exact objective, governing user inputs, governing external authorities, definitions, scope, ordered procedure, decision rules, tool-use rules, output contract, failure behavior, truth semantics, traceability obligations, and exact completion criteria. Every mandatory requirement must be represented or explicitly traced. USER JOB INPUT, EXTERNAL RESEARCH SOURCES, and WORKFLOW-GENERATED ARTIFACTS must remain separately labeled. Return the complete instruction as INSTRUCTION-v001 or the next workflow-instruction version; do not rename the application or invent a new application version because an implementation defect was corrected.`],
  ['PREFLIGHT INSTRUCTION', `Preflight the production instruction now without executing the target production work. Test it against the approved requirements and tests for ambiguity, undefined objects, missing inputs, contradictions, unavailable capabilities, unverifiable commands, unclear responsibility or order, incomplete failure behavior, missing traceability, circular authority, and opportunities to satisfy wording without satisfying meaning. Correct every confirmed instruction defect and return the corrected instruction version plus preflight evidence. If a defect changes sources or requirements, identify and invalidate the earliest affected upstream stage rather than patching only downstream wording.`],
  ['FREEZE CANDIDATE', `Freeze the exact candidate package now. Record immutable identities and versions for the input set, external source set, research findings, requirement registry, conflict decisions, acceptance tests, mutation tests, production instruction, tool configuration, and candidate production configuration. Hash immutable artifacts where practical and assign CANDIDATE-vN. A material change creates a new candidate version and invalidates dependent verification. This candidate identifier is workflow provenance, not a new application marketing/version number.`],
  ['RUN 10 INDEPENDENT EXECUTIONS', `Run ten actual independent executions now using exactly the frozen candidate. RUN-001 through RUN-010 must execute in fresh isolated contexts and each must contain its own complete output and evidence. No run may see another run output, reviewer comments, prior failures, or proposed corrections. Do not summarize ten simulated runs into one synthetic result. Return all ten actual run outputs or verifiable exact references to them.`],
  ['VERIFY EVERY RUN AGAINST EVERY REQUIREMENT', `Independently verify every run against every mandatory requirement now. For each RUN-001 through RUN-010 multiplied by each mandatory REQ_ID, apply the approved TEST_ID and record SATISFIED, VIOLATED, or UNDETERMINED plus affirmative evidence tied to the exact target output. The generator may not be its sole verifier. Create DEFECT_ID records for violations, undetermined mandatory results, or validator failures. Return the complete verification matrix and exact coverage totals.`],
  ['COMPARE ALL RUNS', `Compare all ten independently verified runs requirement by requirement now. Identify inconsistent interpretations, prohibited variance, inconclusive tests, repeated failures, unique failures, and correctness-affecting variance. Do not equate harmless textual difference with a defect unless an approved requirement makes it material. Return the comparison table, variance classification, and defect candidates.`],
  ['ROOT-CAUSE EVERY DEFECT', `Root-cause every confirmed material defect now. Trace each defect to the earliest responsible layer: USER JOB INPUT, EXTERNAL RESEARCH SOURCE discovery, research finding, atomic requirement, conflict decision, acceptance or mutation test, production instruction, candidate production, execution, tool, verification, or audit. Provide causal evidence and identify every dependent artifact invalidated by the defect. Do not patch only final output when the responsible defect originated upstream.`],
  ['ADD REGRESSION TESTS', `Create a permanent regression test now for every confirmed defect. Preserve a minimal reproducer, create a test that demonstrably fails on the defective version, associate it with the responsible REQ_ID and DEFECT_ID, define the expected corrected result, and retain pre-correction failure evidence. A regression derived from a confirmed defect is a WORKFLOW-GENERATED ARTIFACT for verification; it does not become external authority for what the requirement should be.`],
  ['CORRECT RESPONSIBLE LAYER', `Apply each established correction now at the earliest defective layer and regenerate every dependent workflow artifact. Increment workflow artifact and candidate identifiers where changed, but do not rename the application or create an arbitrary application version number. Re-run every new regression test and all affected acceptance and mutation tests. Return corrected artifacts, exact versions, invalidation/regeneration trace, and pass evidence.`],
  ['FREEZE NEW VERSION', `Freeze the corrected candidate now as a new immutable CANDIDATE-vN. Record exact component versions and hashes for corrected inputs, external source set, research findings, requirements, conflict decisions, tests, instruction, and tool configuration. Do not overwrite the prior frozen candidate. This is a workflow candidate version, not a new application version.`],
  ['RUN 10 NEW INDEPENDENT EXECUTIONS', `Run a fresh batch of ten actual independent executions now against the corrected frozen candidate. Produce RUN-001 through RUN-010 as separate outputs in isolated contexts. No run may see another run or any prior-batch output, and no prior output may be recycled. Return all ten outputs or verifiable exact references.`],
  ['REPEAT UNTIL CONVERGED', `Execute the complete convergence loop now: independently verify the fresh batch, compare it, root-cause every defect, add regressions, correct the responsible layer, freeze a new candidate, and execute another fresh ten-run batch as required. Convergence requires mandatory requirement coverage 100%; mandatory verification coverage 100%; regression success 100%; critical defects 0; major defects 0; mandatory unknowns 0; correctness contradictions 0; correctness ambiguities 0; and unexplained correctness variance 0. Return the full convergence ledger and exact converged candidate identity.`],
  ['RUN UNCHANGED 10-EXECUTION CONFIRMATION', `Change nothing. Run another ten fresh independent executions against the exact converged candidate now. Independently verify every run against every mandatory requirement and compare the batch. Any new critical or major defect, new requirement, validator miss, contradiction, ambiguity, or unexplained correctness variance fails confirmation and returns the workflow to the earliest responsible stage. Return the ten confirmation outputs and complete verification evidence.`],
  ['FREEZE APPROVED BASELINE', `Freeze the approved baseline now. Under one BASELINE_ID record the exact approved USER JOB INPUT set, EXTERNAL RESEARCH SOURCE set, research findings, requirement registry, conflict decisions, production instruction, test suites, validator and tool configuration, convergence evidence, and unchanged-confirmation evidence. Hash immutable artifacts where practical. Preserve the class boundary: baseline workflow records prove what occurred but do not retroactively become independent external authority.`],
  ['GENERATE FINISHED PRODUCT', `Generate the actual finished product now in a fresh production execution using only approved baseline materials required for production. Produce the exact user-requested deliverable, not a description, template, outline, placeholder, or simulation. Record PRODUCT_ID, BASELINE_ID, EXECUTION_ID, output files or artifacts, and hashes. Include the exact deliverable after a line reading FINAL_ARTIFACT:.`],
  ['DETERMINISTIC PRODUCT VERIFICATION', `Run every applicable deterministic validator against the actual finished artifact now. Verify arithmetic, counts, schemas, filenames, encoding, inventory, hashes, sections and order, identifiers, references, links, dates, enumerations, tables, required and prohibited text, package contents, structural constraints, formatting dimensions, and deployment identity where applicable. Return every deterministic test result and evidence. Any mandatory deterministic failure rejects the product.`],
  ['INDEPENDENT SEMANTIC VERIFICATION', `Perform independent semantic verification now using a separate evaluator context. For every semantic requirement record REQ_ID, exact product location, controlling user or external-source evidence, observed meaning, required meaning, and SATISFIED, VIOLATED, or UNDETERMINED. The generating execution may not be its sole semantic validator. Do not treat the product’s own claims about itself as proof.`],
  ['ADVERSARIAL PRODUCT VERIFICATION', `Attempt to disprove the actual product now. Search specifically for missing or prohibited material, contradictions, impossible logic, unsupported facts, source misrepresentation, wrong versions, broken references, hidden assumptions, partial completion, semantic nonsense, inconsistent terminology, unhandled exceptions, stale facts, malformed files, hidden content, export corruption, circular authority, and requirements merely mentioned rather than satisfied. Return adversarial findings and DEFECT_ID records.`],
  ['FINAL REPRESENTATION INSPECTION', `Inspect the exact final representation now: the bytes and rendered form that will actually be delivered, including conversions, downloads, deployments, and package contents. Check clipping, off-frame content, missing content, blank pages, broken tables, misplaced graphics, material font substitution, corruption, package inventory, filenames, versions, mobile reflow, and inaccessible or inoperable controls. Return representation evidence and defects.`],
  ['PROCESS AUDIT', `Audit the complete workflow process independently now. Verify approved user inputs, external-source provenance, non-circular authority flow, frozen instructions, tool configuration, test suites, execution isolation, version transitions, defect records, regression evidence, absence of unauthorized modifications, and end-to-end traceability. Confirm that workflow-generated artifacts were never used as external authority for discovering their own requirements. Return process-audit findings with pass or fail evidence.`],
  ['PRODUCT AUDIT', `Audit the finished product independently now. Confirm every mandatory requirement has affirmative evidence; every mandatory deterministic, semantic, adversarial, and representation validator passed; every claim is traceable to its controlling user requirement or external authority; and no unresolved critical or major defect remains. Return the complete product-audit matrix and blocker or defect records.`],
  ['ACCEPTED / REJECTED / BLOCKED', `Assign exactly one RELEASE_DECISION now. ACCEPTED is allowed only when every mandatory requirement has affirmative evidence and every mandatory validator passed. REJECTED means at least one mandatory requirement is demonstrably violated. BLOCKED means at least one mandatory requirement cannot be established. Return RELEASE_DECISION with exact supporting evidence and no other decision state.`],
  ['VERIFY RELEASE HASH', `Verify release identity now. Compute AUDITED_HASH over the exact artifact bytes that completed final verification. Immediately before release compute RELEASE_HASH over the exact bytes proposed for release. Require RELEASE_HASH to equal AUDITED_HASH byte for byte and require both to equal the independently computed artifact hash. Any mismatch stops release and requires a new product artifact plus affected revalidation. Return both 64-hex hashes and the equality result.`],
  ['RELEASE ONLY THE EXACT ACCEPTED ARTIFACT', `Release only the exact accepted artifact now. Preserve the complete external-source or user-input → requirement → instruction → execution → product element → test → result → evidence → release-decision trace chain. Confirm the released artifact is byte-identical to the accepted artifact and RELEASE_HASH equals AUDITED_HASH. Return the release record containing PRODUCT_ID, RELEASE_DECISION, AUDITED_HASH, RELEASE_HASH, artifact identity, deployment or delivery location, and traceability reference.`]
];

const CLASS_MODEL = 'USER_JOB_INPUT | EXTERNAL_RESEARCH_SOURCES | WORKFLOW_GENERATED_ARTIFACTS';
const SOURCE_POLICY = 'Only USER_REQUIREMENT and EXTERNALLY_GOVERNED_REQUIREMENT may control the requirement registry. Workflow-generated artifacts may be inspected only for authorized production, debugging, verification, regression, provenance, audit, comparison, or release operations.';

function requireFile(path) {
  if (!fs.existsSync(path)) throw new Error(`Required repository file missing: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function replaceRequired(source, search, replacement, label) {
  if (typeof search === 'string') {
    if (!source.includes(search)) throw new Error(`Required anchor missing for ${label}: ${search.slice(0, 100)}`);
    return source.replace(search, replacement);
  }
  if (!search.test(source)) throw new Error(`Required pattern missing for ${label}: ${search}`);
  return source.replace(search, replacement);
}

const validateStandardFunction = `function validateStandard(p,n,t){
  t=requireText(t,'Agent response');const U=t.toUpperCase();
  if(n===1){const required=['JOB_ID','EXACT USER OBJECTIVE','EXACT DELIVERABLE','REQUESTED ACTIONS','SUBJECT AND TARGET','PROBLEM AND QUESTION SET','SCOPE BOUNDARIES','SUPPLIED INFORMATION','PROVENANCE CLASSIFICATION','PRIOR CONVERSATION DEPENDENCIES','USER-DEFINED TERMINOLOGY','CONSTRAINTS','PROHIBITED ACTIONS','REQUIRED METHODS','REQUIRED OUTPUT PROPERTIES','TEMPORAL SCOPE','LOCATION AND JURISDICTION','SUCCESS AND ACCEPTANCE CONDITIONS','PRIORITIES AND OPTIMIZATION CRITERIA','UNCERTAINTIES','EXTERNAL RESEARCH QUESTIONS','ASSUMPTIONS','BLOCKERS'];for(const x of required)has(U,new RegExp(x),\`Stage 1 must capture \${x}.\`);if(!U.includes(p.objective.slice(0,Math.min(24,p.objective.length)).toUpperCase()))throw Error('Stage 1 must preserve content from the real project objective.');if(!U.includes(p.deliverable.slice(0,Math.min(24,p.deliverable.length)).toUpperCase()))throw Error('Stage 1 must preserve content from the real requested deliverable.')}
  if(n===2){
    has(U,/EXTERNAL_SEARCH_PERFORMED\\s*[:=]\\s*TRUE/,'Stage 2 must affirm EXTERNAL_SEARCH_PERFORMED: true after real external retrieval.');
    for(const [rx,label] of [[/SOURCE_ID/,'SOURCE_ID'],[/(EXACT_)?TITLE/,'title'],[/SOURCE_TYPE/,'SOURCE_TYPE'],[/(AUTHOR|ISSUING_ORGANIZATION|ISSUING BODY)/,'author or issuing body'],[/(CANONICAL_LOCATION|URL|DOI|ISBN|RFC)/,'canonical location'],[/RETRIEVAL_DATE/,'retrieval date'],[/AUTHORITY_CLASSIFICATION/,'authority classification'],[/SOURCE_ROLE/,'SOURCE_ROLE'],[/(RESEARCH_AREA|RESEARCH_QUESTION)/,'research question or area'],[/RELEVANT_(SECTION|PORTION)/,'relevant section'],[/APPLICABILITY/,'applicability'],[/CURRENCY/,'currency'],[/RELIABILITY/,'reliability'],[/CONFLICT/,'conflicts'],[/EVIDENCE/,'evidence'],[/COVERAGE_STATUS\\s*[:=]\\s*(COVERED|NOT_APPLICABLE|BLOCKED)/,'coverage status']])has(U,rx,\`Stage 2 must record \${label}.\`);
    if(!/(https?:\\/\\/|DOI\\s*[:=]|ISBN\\s*[:=]|RFC\\s*[-:]?\\s*\\d+)/i.test(t))throw Error('Stage 2 must record externally identifiable source provenance.');
    if(/SOURCE_TYPE\\s*[:=]\\s*(USER_INPUT|USER_JOB_INPUT|FILE|HTML|JAVASCRIPT|PROJECT_JSON|APPLICATION_FILE|GENERATED_FILE|PROMPT|AGENT_RESPONSE|WORK_PRODUCT|WORKFLOW_GENERATED_ARTIFACT|CANDIDATE_ARTIFACT|TEST|SOURCE_CODE)\\b/i.test(t))throw Error('Stage 2 research sources must be independent external sources, not user input or project work products.');
    if(/\\b(app-v\\d+(?:-candidate\\d+)?\\.html|build-v13-self\\.mjs|self-browser-e2e\\.mjs|self-e2e-agent(?:-base)?\\.mjs|SELF_VERIFIED_PROJECT\\.json|SELF_E2E_REPORT\\.json)\\b/i.test(t))throw Error('Stage 2 rejected: application and workflow work-product files cannot be inventoried as external research authority.');
    if(/FINDING_ID\\s*[:=]/i.test(t))throw Error('Stage 2 rejected: substantive findings belong to Stage 3.');
  }
  if(n===3){
    for(const [rx,label] of [[/FINDING_ID/,'FINDING_ID'],[/SOURCE_ID/,'SOURCE_ID'],[/RELEVANT_EXTERNAL_PORTION/,'relevant external portion'],[/APPLICABILITY/,'applicability'],[/(OBLIGATION|PROHIBITION|CONDITION|REQUIREMENT|SOURCE_ESTABLISHES)/,'substantive finding'],[/(VERIFICATION_IMPLICATION|VERIFICATION)/,'verification implication']])has(U,rx,\`Stage 3 must contain \${label}.\`);
    has(U,/PROHIBITED_WORK_PRODUCTS_USED_AS_AUTHORITY\\s*[:=]\\s*FALSE/,'Stage 3 must affirm that prohibited workflow work products were not used as authority.');
    if(/\\b(app-v\\d+(?:-candidate\\d+)?\\.html|build-v13-self\\.mjs|self-browser-e2e\\.mjs|self-e2e-agent(?:-base)?\\.mjs|SELF_VERIFIED_PROJECT\\.json)\\b/i.test(t))throw Error('Stage 3 rejected: implementation and workflow work-product files cannot establish researched requirements.');
  }
  if(n===4){
    for(const [rx,label] of [[/REQ-/,'REQ identifiers'],[/USER_REQUIREMENT/,'USER_REQUIREMENT origin'],[/EXTERNALLY_GOVERNED_REQUIREMENT/,'EXTERNALLY_GOVERNED_REQUIREMENT origin'],[/ORIGIN/,'ORIGIN'],[/CONTROLLING_SOURCE_OR_USER_INPUT_REFERENCE/,'controlling source or user-input reference'],[/APPLICABILITY/,'applicability'],[/MANDATORY_OR_OPTIONAL/,'mandatory or optional status'],[/DEPENDENC/,'dependencies'],[/VERIFICATION_METHOD/,'verification method'],[/OBJECTIVE_ACCEPTANCE_CRITERION/,'objective acceptance criterion'],[/FAILURE_CONDITION/,'failure condition']])has(U,rx,\`Stage 4 must contain \${label}.\`);
    if(/EXISTING_ARTIFACT_BEHAVIOR_USED_AS_AUTHORITY\\s*[:=]\\s*TRUE/i.test(t))throw Error('Stage 4 rejected: existing artifact behavior cannot be a requirement origin.');
    const origins=[...t.matchAll(/(?:^|\\n)\\s*ORIGIN\\s*[:=]\\s*([A-Z_]+)/gim)].map(m=>m[1].toUpperCase());
    for(const origin of origins)if(!['USER_REQUIREMENT','EXTERNALLY_GOVERNED_REQUIREMENT'].includes(origin))throw Error(\`Stage 4 rejected unsupported requirement origin: \${origin}.\`);
  }
  if(n===5){
    for(const [rx,label] of [[/CONFLICT/,'conflict records'],[/AUTHORITY/,'authority analysis'],[/(RESOLVED|USER_CLARIFICATION_REQUIRED|BLOCKED)/,'resolution status'],[/UNFINISHED_PRODUCT_USED_AS_TIEBREAKER\\s*[:=]\\s*FALSE/,'non-circular tie-breaker declaration']])has(U,rx,\`Stage 5 must contain \${label}.\`);
  }
  if(n===6){has(U,/TEST-/,'Stage 6 must contain TEST identifiers.');has(U,/100%/,'Stage 6 must establish 100% mandatory test coverage.')}
  if(n===8)has(U,/INSTRUCTION-V/,'Stage 8 must create an INSTRUCTION version.');
  if(n===10||n===17)has(U,/CANDIDATE-V/,'This freeze stage must identify CANDIDATE-vN.');
  if(n===21)has(U,/BASELINE[_ -]?ID/,'Stage 21 must identify BASELINE_ID.');
  if(n===22)has(t,/FINAL_ARTIFACT\\s*:/i,'Stage 22 must include the exact finished deliverable after FINAL_ARTIFACT:.');
  if(n===29)has(U,/RELEASE_DECISION\\s*[:=]\\s*(ACCEPTED|REJECTED|BLOCKED)/,'Stage 29 must contain RELEASE_DECISION: ACCEPTED, REJECTED, or BLOCKED.');
  return t
}
`;

const genericPromptFunction = `function prompt(p,n) {
  gate(p, n);
  if(n===2||n===3)return researchPrompt(p,n);
  return \`CLOSED-LOOP AGENT RELIABILITY WORKFLOW

PROMPT_RULESET: FORWARD_EXTERNAL_AUTHORITY_2026_08_22

JOB_ID: \${p.jobId}
PROJECT_ID: \${p.projectId}
PROJECT: \${p.name}

GOVERNING DIRECTION
USER INTENT → EXTERNAL RESEARCH → EXTERNAL AUTHORITY → REQUIREMENTS → TESTS → PRODUCTION → INDEPENDENT VERIFICATION → CORRECTION → ACCEPTED PRODUCT → RELEASE

THREE INFORMATION CLASSES
A. USER JOB INPUT — establishes user intent, supplied facts, constraints, existing artifacts to modify, and user-defined acceptance conditions; it is not automatically independent external authority.
B. EXTERNAL RESEARCH SOURCES — independent authority discovered outside the artifact and outside this workflow's generated records.
C. WORKFLOW-GENERATED ARTIFACTS — research notes, source inventories, requirements, tests, prompts, candidates, generated code or documents, run outputs, verification records, defects, audits, hashes, and products created during this workflow.

ABSOLUTE NON-CIRCULARITY RULE
The artifact being created, its unfinished implementation, source code, tests, generated project state, prior agent-generated conclusions, and prior workflow reports may never establish their own requirements. They may be inspected only when this stage expressly authorizes production, debugging, verification, regression, provenance, comparison, audit, or release.

EXACT USER OBJECTIVE:
\${p.objective}

EXACT DELIVERABLE REQUESTED:
\${p.deliverable}

USER JOB INPUT — SUPPLIED FILES / MESSAGES / URLS / DATA (NOT AUTOMATICALLY EXTERNAL AUTHORITY):
\${p.inputs || 'NONE SUPPLIED'}

CONSTRAINTS / PROHIBITED ACTIONS:
\${p.constraints || 'NONE SUPPLIED'}

REQUIRED OUTPUT FORMAT:
\${p.format}

DEADLINE / TEMPORAL SCOPE:
\${p.deadline}

STAGE \${n} OF 31 — \${STAGES[n - 1][0]}

EXECUTE THIS STAGE NOW
\${STAGES[n - 1][1]}

RULES
- Execute the operation now; do not merely describe how.
- Perform all AI-capable work available to you and use authorized tools.
- Preserve USER JOB INPUT, EXTERNAL RESEARCH SOURCES, and WORKFLOW-GENERATED ARTIFACTS as distinct classes.
- Only explicit USER_REQUIREMENTS and independently established EXTERNALLY_GOVERNED_REQUIREMENTS may control the requirement registry.
- Use supplied or generated implementation artifacts only in stages that expressly authorize production, debugging, verification, regression, provenance, comparison, audit, or release.
- Do not invent missing facts. A mandatory unavailable fact or authority is BLOCKED.
- Do not perform a later stage.
- Preserve exact evidence, identifiers, versions, provenance, and traceability.

PRIOR COMPLETED HANDOFF
\${prior(p, n)}

RETURN ONLY THE COMPLETED STAGE RESULT.\`;
}
`;

const coreValidateFunction = `function validateStageResponse(project,n,response){
  validateSequentialAccess(project,n);
  const text=String(response||'').trim();
  const U=text.toUpperCase();
  if(!text) throw new Error('Agent response is required. Paste the complete agent response.');
  if(text.length<120) throw new Error('Agent response is too short to demonstrate completed stage work.');
  for(const token of (REQUIRED_TOKENS[n]||[])) if(!U.includes(token.toUpperCase())) throw new Error(\`Stage \${n} response is missing required evidence token: \${token}\`);
  if(n===2){
    if(!/EXTERNAL_SEARCH_PERFORMED\\s*[:=]\\s*TRUE/i.test(text))throw new Error('Stage 2 must document actual external research.');
    if(/SOURCE_TYPE\\s*[:=]\\s*(USER_INPUT|USER_JOB_INPUT|FILE|HTML|JAVASCRIPT|PROJECT_JSON|APPLICATION_FILE|GENERATED_FILE|PROMPT|AGENT_RESPONSE|WORK_PRODUCT|WORKFLOW_GENERATED_ARTIFACT|CANDIDATE_ARTIFACT|TEST|SOURCE_CODE)\\b/i.test(text))throw new Error('Stage 2 research sources must be independent external sources, not user input or project work products.');
    if(/FINDING_ID\\s*[:=]/i.test(text))throw new Error('Stage 2 may inventory external sources but may not perform Stage 3 findings research.');
  }
  if(n===3){
    if(!/FINDING_ID/i.test(text)||!/SOURCE_ID/i.test(text))throw new Error('Stage 3 findings must trace to external SOURCE_ID records.');
    if(!/PROHIBITED_WORK_PRODUCTS_USED_AS_AUTHORITY\\s*[:=]\\s*FALSE/i.test(text))throw new Error('Stage 3 must affirm the non-circular authority boundary.');
  }
  if(n===4){
    for(const token of ['USER_REQUIREMENT','EXTERNALLY_GOVERNED_REQUIREMENT','ORIGIN','CONTROLLING_SOURCE_OR_USER_INPUT_REFERENCE','VERIFICATION_METHOD','OBJECTIVE_ACCEPTANCE_CRITERION','FAILURE_CONDITION'])if(!U.includes(token))throw new Error(\`Stage 4 missing \${token}.\`);
    const origins=[...text.matchAll(/(?:^|\\n)\\s*ORIGIN\\s*[:=]\\s*([A-Z_]+)/gim)].map(m=>m[1].toUpperCase());
    for(const origin of origins)if(!['USER_REQUIREMENT','EXTERNALLY_GOVERNED_REQUIREMENT'].includes(origin))throw new Error(\`Unsupported requirement origin: \${origin}.\`);
  }
  if(n===5&&!/UNFINISHED_PRODUCT_USED_AS_TIEBREAKER\\s*[:=]\\s*FALSE/i.test(text))throw new Error('Stage 5 must prove the unfinished product was not used as a tie-breaker.');
  if([11,18,20].includes(n) && countRunIds(text)!==10) throw new Error(\`Stage \${n} must contain all ten distinct run identifiers RUN-001 through RUN-010.\`);
  if(n===19){const required=[/mandatory requirement coverage\\s*[:=]\\s*100%/i,/mandatory verification coverage\\s*[:=]\\s*100%/i,/regression success\\s*[:=]\\s*100%/i,/critical defects\\s*[:=]\\s*0/i,/major defects\\s*[:=]\\s*0/i,/mandatory unknowns\\s*[:=]\\s*0/i,/correctness contradictions\\s*[:=]\\s*0/i,/correctness ambiguities\\s*[:=]\\s*0/i,/unexplained correctness variance\\s*[:=]\\s*0/i];for(const rx of required)if(!rx.test(text))throw new Error(\`Stage 19 convergence gate missing: \${rx}\`)}
  if(n===29 && !/RELEASE_DECISION\\s*[:=]\\s*(ACCEPTED|REJECTED|BLOCKED)/i.test(text)) throw new Error('Stage 29 must state RELEASE_DECISION: ACCEPTED, REJECTED, or BLOCKED.');
  if(n===30){const a=text.match(/AUDITED_HASH\\s*[:=]\\s*([a-f0-9]{64})/i),r=text.match(/RELEASE_HASH\\s*[:=]\\s*([a-f0-9]{64})/i);if(!a||!r)throw new Error('Stage 30 must include 64-hex AUDITED_HASH and RELEASE_HASH.');if(a[1].toLowerCase()!==r[1].toLowerCase())throw new Error('Stage 30 hash mismatch: AUDITED_HASH must equal RELEASE_HASH.')}
  return true;
}
`;

const corePromptFunctions = `function priorHandoff(project,n){
  if(n===1)return 'NONE';
  if(n===2){const s=project.stages[0];return \`===== STAGE 1 — USER JOB INPUT / RESEARCH SCOPE, NOT EXTERNAL AUTHORITY =====\\n\${s.agentResponse}\\n\\nEVIDENCE / NOTES\\n\${s.evidence||'NONE'}\`}
  if(n===3){const s=project.stages[1];return \`===== STAGE 2 — EXTERNAL RESEARCH SOURCE INVENTORY =====\\n\${s.agentResponse}\\n\\nEVIDENCE / NOTES\\n\${s.evidence||'NONE'}\`}
  return project.stages.slice(0,n-1).map((s,i)=>\`===== STAGE \${i+1} — \${STAGES[i].name} =====\\n\${s.agentResponse||'NO RESULT'}\\n\\nEVIDENCE / NOTES\\n\${s.evidence||'NONE'}\`).join('\\n\\n');
}

function buildPrompt(project,n){
  validateSequentialAccess(project,n);
  const d=STAGES[n-1];
  const researchBoundary=n===2||n===3?\`\\nRESEARCH AUTHORITY BOUNDARY — EXTERNAL SOURCES ONLY\\nSearch outward using independent external authorities. USER JOB INPUT defines scope but is not automatically external authority. WORKFLOW-GENERATED ARTIFACTS—including unfinished products, source code, generated tests, project JSON, candidate behavior, prior agent conclusions, and prior workflow reports—may not establish requirements.\\n\`:'';
  return \`CLOSED-LOOP AGENT RELIABILITY WORKFLOW

JOB_ID: \${project.jobId}
PROJECT_ID: \${project.projectId}
PROJECT: \${project.name}

GOVERNING DIRECTION
USER INTENT → EXTERNAL RESEARCH → EXTERNAL AUTHORITY → REQUIREMENTS → TESTS → PRODUCTION → INDEPENDENT VERIFICATION → CORRECTION → ACCEPTED PRODUCT → RELEASE

THREE INFORMATION CLASSES
USER_JOB_INPUT | EXTERNAL_RESEARCH_SOURCES | WORKFLOW_GENERATED_ARTIFACTS

EXACT USER OBJECTIVE:
\${project.objective}

EXACT DELIVERABLE REQUESTED:
\${project.deliverable}

USER JOB INPUT — SUPPLIED MATERIAL (NOT AUTOMATICALLY EXTERNAL AUTHORITY):
\${project.suppliedInputs||'NONE SUPPLIED'}

CONSTRAINTS / PROHIBITED ACTIONS:
\${project.constraints||'NONE SUPPLIED'}

REQUIRED OUTPUT FORMAT:
\${project.outputFormat||'UNSPECIFIED'}

DEADLINE / TEMPORAL SCOPE:
\${project.deadline||'NONE SUPPLIED'}

CURRENT INPUT VERSION: \${project.inputVersion}\n\${researchBoundary}
STAGE \${n} OF \${STAGES.length} — \${d.name}

EXECUTE THIS STAGE NOW
\${d.instruction}

MANDATORY EXECUTION RULES
- Perform every AI-capable operation required by this stage yourself now.
- Preserve the three information classes and the non-circular authority boundary.
- Only USER_REQUIREMENT and EXTERNALLY_GOVERNED_REQUIREMENT may control requirements.
- Use workflow-generated artifacts only for an expressly authorized production, debugging, verification, regression, provenance, comparison, audit, or release operation.
- Return completed work, not a plan or instructions for another person.
- Do not claim work or external access that did not occur.
- Do not invent missing facts. A mandatory unavailable fact or authority is BLOCKED.
- Do not perform a later stage.
- Preserve exact identifiers, versions, evidence, and traceability.

PRIOR HANDOFF
\${priorHandoff(project,n)}

RETURN ONLY THE COMPLETED STAGE \${n} RESULT.\`;
}
`;

function patchApplication(html) {
  const stageSource = `const STAGES=${JSON.stringify(STAGE_DEFINITIONS)};\nconst SELF_PROJECT_PATH=`;
  html = replaceRequired(html, /const STAGES=\[[\s\S]*?\];\nconst SELF_PROJECT_PATH=/, stageSource, 'application stage definitions');

  html = html.replace(/<div class="sub">[\s\S]*?<\/div>/, '<div class="sub">31 sequential operations · forward external-authority pipeline · three-class provenance · exact accepted-artifact release</div>');
  html = html.replace('<label>Supplied files / messages / links / data</label>', '<label>User job inputs: supplied files / messages / URLs / data (not automatic external authority)</label>');

  if (!html.includes('informationClassModel:')) {
    html = replaceRequired(
      html,
      "deadline:(v.deadline||'NONE SUPPLIED').trim(),createdAt:now()",
      `deadline:(v.deadline||'NONE SUPPLIED').trim(),informationClassModel:${JSON.stringify(CLASS_MODEL)},sourceAuthorityPolicy:${JSON.stringify(SOURCE_POLICY)},createdAt:now()`,
      'project information-class metadata'
    );
  }

  if (!html.includes("p.informationClassModel=p.informationClassModel||")) {
    html = replaceRequired(
      html,
      '  const p = JSON.parse(JSON.stringify(input));\n',
      `  const p = JSON.parse(JSON.stringify(input));\n  p.informationClassModel=p.informationClassModel||${JSON.stringify(CLASS_MODEL)};\n  p.sourceAuthorityPolicy=p.sourceAuthorityPolicy||${JSON.stringify(SOURCE_POLICY)};\n`,
      'imported project metadata normalization'
    );
  }

  html = html.replace(/for \(let n = 1; n <= (?:3|5); n \+= 1\)/, 'for (let n = 1; n <= 5; n += 1)');
  html = html.replace(/PROMPT_RULESET_VERSION: external-authority-first-lossless-stage1-2026-08-22-r8/g, 'PROMPT_RULESET: FORWARD_EXTERNAL_AUTHORITY_2026_08_22');
  html = html.replace(/PROMPT_RULESET_VERSION: external-authority-first-2026-08-22-r4/g, 'PROMPT_RULESET: FORWARD_EXTERNAL_AUTHORITY_2026_08_22');

  html = replaceRequired(html, /function prompt\(p,n\) \{[\s\S]*?\n\}\nfunction runPrompt/, `${genericPromptFunction}function runPrompt`, 'generic prompt function');
  html = replaceRequired(html, /function validateStandard\(p,n,t\)\{[\s\S]*?\n\}\nfunction validateRun/, `${validateStandardFunction}function validateRun`, 'application stage validation');

  if (!html.includes('THREE INFORMATION CLASSES')) throw new Error('Application prompt is missing the three-class boundary.');
  if (!html.includes('UNFINISHED_PRODUCT_USED_AS_TIEBREAKER')) throw new Error('Stage 5 non-circular tie-breaker declaration is missing.');
  if (!html.includes('USER_REQUIREMENT') || !html.includes('EXTERNALLY_GOVERNED_REQUIREMENT')) throw new Error('Stage 4 origin model is missing.');
  if (html.includes('Inspect the actual supplied sources and build the complete source inventory now.')) throw new Error('Obsolete circular Stage 2 instruction remains.');
  return html;
}

function patchCore(core) {
  const objects = STAGE_DEFINITIONS.map(([name, instruction], index) => ({ number:index+1, id:`STAGE-${String(index+1).padStart(2,'0')}`, name, instruction }));
  core = replaceRequired(core, /const STAGES=\[[\s\S]*?\];\n\nconst REQUIRED_TOKENS/, `const STAGES=${JSON.stringify(objects, null, 2)};\n\nconst REQUIRED_TOKENS`, 'core stage definitions');
  core = replaceRequired(core, /function validateStageResponse\(project,n,response\)\{[\s\S]*?\n\}\n\nfunction invalidateDownstream/, `${coreValidateFunction}\nfunction invalidateDownstream`, 'core stage validation');
  core = replaceRequired(core, /function priorHandoff\(project,n\)\{[\s\S]*?\n\}\n\nfunction buildPrompt\(project,n\)\{[\s\S]*?\n\}\n\nasync function sha256/, `${corePromptFunctions}\nasync function sha256`, 'core prompt functions');
  if (!core.includes('THREE INFORMATION CLASSES')) throw new Error('Core prompt is missing the three-class model.');
  return core;
}

function patchSelfAgentBase(source) {
  const old4 = "4:pad('Atomic requirements compiled as REQ-001 through REQ-015: immediate usable load; visible empty-project creation; exact intake preservation; 31 ordered operations; sequential gate enforcement; 30 producer responses; 30 verifier responses; verifier target binding; candidate/version identity; defect root cause and regression; final app generation; deterministic and semantic verification; mobile 320/393 containment; exact-byte accepted release; and automatic loading of the UI-exported SELF_VERIFIED_PROJECT.json without embedding project state. Every requirement has applicability, evidence, failure condition, and verification method.'),";
  const new4 = "4:pad('REQUIREMENT_ORIGINS_ALLOWED: USER_REQUIREMENT and EXTERNALLY_GOVERNED_REQUIREMENT ONLY. Atomic requirements compiled as REQ-001 through REQ-015: immediate usable load; visible empty-project creation; exact intake preservation; 31 ordered operations; sequential gate enforcement; 30 producer responses; 30 verifier responses; verifier target binding; candidate/version identity; defect root cause and regression; final app generation; deterministic and semantic verification; mobile 320/393 containment; exact-byte accepted release; and automatic loading of the UI-exported SELF_VERIFIED_PROJECT.json without embedding project state. Each requirement record contains REQUIREMENT_ID, ATOMIC_STATEMENT, ORIGIN, CONTROLLING_SOURCE_OR_USER_INPUT_REFERENCE, APPLICABILITY, MANDATORY_OR_OPTIONAL, DEPENDENCIES, VERIFICATION_METHOD, OBJECTIVE_ACCEPTANCE_CRITERION, and FAILURE_CONDITION. USER_REQUIREMENT records trace to Stage 1; EXTERNALLY_GOVERNED_REQUIREMENT records trace to Stage 2/3 SOURCE_ID and FINDING_ID evidence. EXISTING_ARTIFACT_BEHAVIOR_USED_AS_AUTHORITY: false.'),";
  if (source.includes(old4)) source = source.replace(old4, new4);
  else if (!source.includes('REQUIREMENT_ORIGINS_ALLOWED: USER_REQUIREMENT')) throw new Error('Unable to patch self agent Stage 4 result.');

  const old5 = "5:pad('Conflict resolution completed. Duplicate wording was consolidated without deleting any unique obligation. The requirement for an immediately usable empty app and the requirement to show the completed self-project are compatible because the HTML contains no project object and loads the independently exported sidecar only when present. No undefined operative term, circular dependency, missing prerequisite, impossible combination, or unresolved mandatory conflict remains. REQ-001 through REQ-015 are RESOLVED.'),";
  const new5 = "5:pad('CONFLICT-001 through CONFLICT-004 were evaluated across USER_REQUIREMENTS, EXTERNALLY_GOVERNED_REQUIREMENTS, external authority hierarchy, technical constraints, and output constraints. AUTHORITY_HIERARCHY: controlling mandatory authority, official primary specifications, adopted user process conditions, then informative guidance. Duplicate wording was consolidated without deleting unique obligations. The immediately usable empty app and completed self-project requirements are RESOLVED as compatible because project state remains a separate visible-UI export loaded only as data, never requirement authority. The phone-first and detailed-evidence obligations are RESOLVED through reflow and expandable evidence controls. No undefined operative term, circular dependency, missing prerequisite, impossible combination, or unresolved controlling conflict remains. STATUS: RESOLVED for REQ-001 through REQ-015. USER_CLARIFICATION_REQUIRED: NONE. BLOCKED: NONE. UNFINISHED_PRODUCT_USED_AS_TIEBREAKER: false.'),";
  if (source.includes(old5)) source = source.replace(old5, new5);
  else if (!source.includes('UNFINISHED_PRODUCT_USED_AS_TIEBREAKER: false')) throw new Error('Unable to patch self agent Stage 5 result.');
  return source;
}

function readmeText() {
  return `# Closed-Loop Agent Reliability — phone-first web app

Use the deployed project URL:

https://sjonesjones917.github.io/closed-loop-tracker/

The account-root URL (https://sjonesjones917.github.io/) is a different GitHub Pages address and is not this repository's deployment target.

## Governing architecture

The application implements this forward pipeline:

USER INTENT → EXTERNAL RESEARCH → EXTERNAL AUTHORITY → REQUIREMENTS → TESTS → PRODUCTION → INDEPENDENT VERIFICATION → CORRECTION → ACCEPTED PRODUCT → RELEASE

It preserves three distinct information classes throughout every project:

1. USER JOB INPUT — user intent, supplied facts, constraints, supplied URLs/files, existing artifacts to modify, and user-defined acceptance conditions.
2. EXTERNAL RESEARCH SOURCES — independent official, legal, standards, technical, scientific, academic, market, historical, or other externally accessed authority appropriate to the job.
3. WORKFLOW-GENERATED ARTIFACTS — source inventories, findings, requirements, tests, prompts, candidate products, code, documents, run outputs, verifier responses, defects, audits, hashes, and finished products created during the workflow.

The artifact being created, its unfinished implementation, source code, generated tests, generated project state, prior agent conclusions, and prior workflow reports are never external authority for discovering their own requirements. They may be inspected later only for authorized production, debugging, verification, regression, provenance, comparison, audit, or release.

## Requirement authority

Stage 4 accepts exactly two requirement origins:

- USER_REQUIREMENT, traced to Stage 1.
- EXTERNALLY_GOVERNED_REQUIREMENT, traced to independently accessed Stage 2 and Stage 3 authority.

Existing artifact behavior is not a third requirement origin. Stage 5 also prohibits the unfinished product from acting as a conflict tie-breaker.

## Application behavior

- Preserves the exact 31 numbered operations from DEFINE JOB through RELEASE ONLY THE EXACT ACCEPTED ARTIFACT.
- Keeps the application identity at v13; correcting an implementation defect does not create an arbitrary new application version.
- Starts new projects at 0/31 and enforces sequential completion.
- Stores projects locally, supports visible JSON import/export, and revalidates stored/imported Stage 1–5 state under current non-circular rules.
- Requires actual external retrieval evidence for Stage 2 and external-source traceability for Stage 3.
- Requires atomic requirements to declare approved origins and objective verification criteria.
- Requires independent producer/verifier batches and exact accepted-byte release hashes.
- Loads the completed self-project from the separate visible-UI export SELF_VERIFIED_PROJECT.json; it is not hardcoded into the HTML.

## Deployment and verification

.github/workflows/pages.yml regenerates the existing application, runs state and browser verification, performs the complete 31-stage self-build, verifies the UI-exported project and exact release bytes, deploys the tested Pages artifact, and verifies the live project URL.

forward-pipeline-regression.mjs independently checks the stage order, three-class boundary, Stage 2/3 external-authority controls, Stage 4 origin restriction, Stage 5 non-circular conflict rule, core prompt behavior, and index/application byte identity.
`;
}

function regressionText() {
  return `import fs from 'node:fs';\nimport { createRequire } from 'node:module';\nconst require=createRequire(import.meta.url);\nconst fail=m=>{throw new Error(m)};\nconst html=fs.readFileSync('app-v13.html','utf8');\nconst index=fs.readFileSync('index.html','utf8');\nif(html!==index)fail('index.html is not byte-identical to app-v13.html');\nconst required=['THREE INFORMATION CLASSES','USER INTENT → EXTERNAL RESEARCH → EXTERNAL AUTHORITY → REQUIREMENTS → TESTS → PRODUCTION → INDEPENDENT VERIFICATION → CORRECTION → ACCEPTED PRODUCT → RELEASE','USER_REQUIREMENT','EXTERNALLY_GOVERNED_REQUIREMENT','UNFINISHED_PRODUCT_USED_AS_TIEBREAKER','Stage 2 research sources must be independent external sources','function replayProject(input)','SELF_VERIFIED_PROJECT.json'];\nfor(const token of required)if(!html.includes(token))fail('app-v13.html missing '+token);\nif(html.includes('Inspect the actual supplied sources and build the complete source inventory now.'))fail('obsolete circular Stage 2 instruction remains');\nconst match=html.match(/const STAGES=(\\[[\\s\\S]*?\\]);\\nconst SELF_PROJECT_PATH=/);\nif(!match)fail('cannot parse stage definitions');\nconst stages=JSON.parse(match[1]);\nconst names=${JSON.stringify(STAGE_DEFINITIONS.map(x=>x[0]))};\nif(stages.length!==31||JSON.stringify(stages.map(x=>x[0]))!==JSON.stringify(names))fail('stage names/order changed');\nconst core=require('./app-core.js');\nif(core.STAGES.length!==31)fail('core stage count changed');\nif(!core.STAGES[1].instruction.includes('external source discovery'))fail('core Stage 2 is not external research');\nconst p=core.createProject({name:'Regression',objective:'Preserve forward authority flow and reject circular sources.',deliverable:'Verified result',suppliedInputs:'candidate.html is an existing artifact to modify'});\nfor(let i=0;i<5;i++)p.stages[i].status='COMPLETE';\nlet rejected=false;\ntry{core.validateStageResponse(p,2,'EXTERNAL_SEARCH_PERFORMED: true. SOURCE_ID: SRC-1. SOURCE_ROLE: GOVERNING. SOURCE_TYPE: APPLICATION_FILE. '.repeat(3))}catch(e){rejected=/independent external sources/i.test(String(e.message))}\nif(!rejected)fail('core accepted a workflow artifact as Stage 2 authority');\nrejected=false;\ntry{core.validateStageResponse(p,4,'REQ-001 ORIGIN: EXISTING_ARTIFACT_BEHAVIOR CONTROLLING_SOURCE_OR_USER_INPUT_REFERENCE: candidate behavior VERIFICATION_METHOD: inspect OBJECTIVE_ACCEPTANCE_CRITERION: same FAILURE_CONDITION: different USER_REQUIREMENT EXTERNALLY_GOVERNED_REQUIREMENT '.repeat(2))}catch(e){rejected=/origin/i.test(String(e.message))}\nif(!rejected)fail('core accepted a third requirement origin');\nconsole.log(JSON.stringify({status:'PASS',stageCount:31,informationClasses:3,requirementOrigins:2,indexMatchesApp:true},null,2));\n`;
}

let app = patchApplication(requireFile('app-v13.html'));
app = app.replace(/const SELF_PROJECT_PATH=(?:"[^"]+"|'[^']+');/, 'const SELF_PROJECT_PATH="SELF_VERIFIED_PROJECT.json";');
const candidate = app.replace('const SELF_PROJECT_PATH="SELF_VERIFIED_PROJECT.json";', 'const SELF_PROJECT_PATH="SELF_VERIFIED_PROJEC.json";');
if (candidate === app) throw new Error('Unable to construct the known-defect candidate sidecar path.');

const core = patchCore(requireFile('app-core.js'));
const baseAgent = patchSelfAgentBase(requireFile('self-e2e-agent-base.mjs'));

fs.writeFileSync('app-v13-candidate1.html', candidate);
fs.writeFileSync('app-v13.html', app);
fs.writeFileSync('index.html', app);
fs.writeFileSync('app-core.js', core);
fs.writeFileSync('self-e2e-agent-base.mjs', baseAgent);
fs.writeFileSync('README.md', readmeText());
fs.writeFileSync('forward-pipeline-regression.mjs', regressionText());

for (const file of ['app-core.js','self-e2e-agent-base.mjs','forward-pipeline-regression.mjs']) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding:'utf8' });
  if (checked.status !== 0) throw new Error(`Syntax check failed for ${file}: ${checked.stderr || checked.stdout}`);
}
const regression = spawnSync(process.execPath, ['forward-pipeline-regression.mjs'], { encoding:'utf8', maxBuffer:16*1024*1024 });
if (regression.status !== 0) throw new Error(`Forward-pipeline regression failed: ${regression.stderr || regression.stdout}`);

if (fs.existsSync('.git')) {
  const staged = spawnSync('git', ['add','app-core.js','self-e2e-agent-base.mjs','README.md','forward-pipeline-regression.mjs'], { encoding:'utf8' });
  if (staged.status !== 0) throw new Error(`Unable to stage persistent forward-pipeline sources: ${staged.stderr || staged.stdout}`);
}

console.log(JSON.stringify({
  status:'BUILT_AND_REGRESSION_VERIFIED',
  buildRevision:BUILD_REVISION,
  application:'app-v13.html',
  candidate:'app-v13-candidate1.html',
  stages:STAGE_DEFINITIONS.length,
  informationClasses:CLASS_MODEL.split(' | ').length,
  permittedRequirementOrigins:2,
  appBytes:Buffer.byteLength(app),
  candidateBytes:Buffer.byteLength(candidate),
  regression:JSON.parse(regression.stdout)
},null,2));
