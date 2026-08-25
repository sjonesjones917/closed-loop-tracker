(()=>{
'use strict';

const core=globalThis.closedLoopCore;
const model=globalThis.closedLoopModel;
const workflow=globalThis.closedLoopWorkflow;
if(!core||!model||!workflow)throw new Error('The canonical workbook, ownership model, and workflow engine must load before the prompt engine.');

const VERSION='2026-08-25-r1';
const procedures={
  "1": "Initialize only this current job from this current job’s exact user input. Preserve the verbatim objective, exact deliverable, supplied-material inventory and provenance, inspection state, format requirements, temporal and geographic scope, user-supplied authority, tools, prohibitions, explicit user requirements, assumptions, unresolved unknowns, and controlled INPUT-vN identity. Assign and preserve this job’s unique JOB_ID before downstream artifacts. Do not create, prescribe, or instruct reuse of a master prompt, master job, reusable job definition, reusable target specification, or template for other jobs. Do not infer requirements for unrelated jobs from this job. Do not begin substantive external-source research or downstream production work.",
  "2": "Build the external governing source inventory for this current job only. Stage 01 User Job Input and Supplied Material remain authorized project inputs, but they are not automatically independent external governing sources and must not receive SOURCE_ID merely because they were supplied. Identify genuinely independent external authorities relevant to the not-yet-existing target product. Establish actual identity, issuing organization or author, source type, publication origin, URL/reference, version, date, retrieval date where applicable, authority level and role, relevance, applicable portions, inspection state, currency, supersession, controlling status, and actual SHA-256 only when controlled bytes exist. Establish an explicit authority hierarchy and separate source-conflict records. Never use the target product, this operating application, its repository, source code, UI, stored project state, screenshots, prior versions, previous generated targets, project outputs, generated prompts/instructions, or another implementation of the same target as governing source authority. Do not research requirements yet. Create SOURCE-SET-vN only from legitimate external governing sources actually established in this stage; if none are yet established, leave the source set uncreated and record UNKNOWN/BLOCKED as applicable.",
  "3": "Research only the legitimate Stage 02 external governing source set, source-by-source and pass-by-pass. Examine exact portions and separately capture facts, mandatory obligations, recommendations, optional practices, examples, prohibitions, exceptions, dependencies, applicability facts, restrictions, invalidating material, conflicts, superseded guidance, source evidence, candidate requirement IDs, and unresolved questions. Do not research the target product, this operating application, repository source code, prior implementations, project-generated artifacts, or current UI behavior as requirement authority. Repeat discovery passes until saturation is actually supported by the evidence.",
  "4": "Compile atomic requirements for this current job from authorized User Job Input plus legitimately applicable Stage 03 external-source research, preserving provenance for each obligation. Each REQ_ID must express one independently testable obligation where possible and record type, mandatory/optional status, governing source or user-input relationship, exact source location when applicable, authority, applicability, dependencies, prohibitions, defined terms, observable satisfaction condition, intended verification method, expected evidence, failure condition, severity, status, and notes. Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior.",
  "5": "Resolve the current job’s requirement set. Detect duplicate or conflicting requirements, impossible combinations, undefined terms, circular dependencies, missing prerequisites, unsupported requirements, uncertain applicability, and requirements lacking a verification method. Preserve the defect, governing evidence, resolution or unresolved state, changed requirement, resulting controlled version, affected downstream work, and blockers. Never silently guess away a conflict or manufacture authority.",
  "6": "Build this job’s verification suite before any production instruction is authored. Every active mandatory REQ_ID must have at least one valid TEST_ID. Use the strongest suitable method, including exact computation, programmatic checks, schema or structure checks, source comparison, rule-based verification, and independent human meaning/content review where deterministic checks cannot establish satisfaction. Define inputs, tools, procedure, expected result, failure condition, and evidence to preserve. Calculate mandatory requirement-to-test coverage exactly and block progression below 100 percent.",
  "7": "Build this job’s MUTATION-SUITE-vN to prove validators reject realistic invalid states. Include applicable missing inputs, invalid values, wrong versions, duplicate identifiers, contradictions, omitted required sections, prohibited material, corrupt references, malformed files, conflicting authority, unavailable tools, unsupported claims, injected source instructions, known-invalid artifacts, and other relevant mutations. Preserve fixture, expected rejection, actual result, validator defect where applicable, and evidence.",
  "8": "Author this job’s production instruction only from the resolved current requirement set and verification architecture. Define objective, authorized inputs, authority rules, failure handling, scope, prohibitions, defined terms, ordered procedure, branches, tool requirements, output contract, TRUE/FALSE/UNKNOWN handling, rejection/blocking rules, completion conditions, and requirement traceability. Do not copy or imitate an existing target implementation as authority. Do not turn this job’s production instruction into a reusable instruction for unrelated jobs unless the current user input explicitly requires such a deliverable.",
  "9": "Preflight this job’s production instruction in an independent context where required. Review each material clause for multiple interpretations, undefined objects, unsupplied dependencies, internal conflicts, unavailable capabilities, objective verifiability, responsible operation, ordering, defined failure behavior, and traceability. Preserve findings, defects, corrections, repeated review, final approved instruction version, and evidence. Do not execute target production during preflight.",
  "10": "Freeze the exact candidate for this job and iteration. Assign CANDIDATE_ID and ITERATION_ID; preserve the exact component manifest, versions, hashes where real bytes exist, role distribution, immutable locations, tool configuration, settings, permissions, and limitations. The same candidate package must be used unchanged across the ten-run batch. A material change terminates the candidate and requires a new identity.",
  "11": "Run exactly ten independent executions for this job using the identical frozen candidate in ten fresh contexts. For each RUN_ID preserve context identity, timestamps, frozen candidate identity, contamination check, tool configuration, execution status, complete output, output artifact identities and hashes where applicable, tool failures, and notes. Runs may not see another run’s output, reviewer comments, prior failure explanations, or proposed corrections. Never select a preferred run to discard the others.",
  "12": "Verify each of this job’s ten executions independently. Create one applicable verification record for every required REQ_ID × RUN_ID relation, linked to TEST_ID. Preserve verifier and verifier-context identity, independence status, inputs, procedure, expected result, observed result, exact evidence, SATISFIED/VIOLATED/UNDETERMINED, DEFECT_ID where applicable, and reason for UNDETERMINED. Reconcile counts mathematically and do not let the generator act as its sole validator.",
  "13": "Compare all ten executions for this job requirement-by-requirement. Preserve every run determination, all-ten satisfaction, any violation, any undetermined result, interpretation variance, output variance, authorized versus unauthorized variance, inconclusive tests, repeated and unique failure patterns, correctness-affecting variance, linked defects, and evidence. Never discard a run because another run appears preferable.",
  "14": "Root-cause every material defect in this job by tracing backward through product/output, execution, instruction, requirement, research, source, user input, tool, and audit as applicable. Classify the root cause using the controlled categories, identify the earliest defective layer, preserve evidence, and identify downstream invalidation. Do not patch only the final symptom when an earlier layer is responsible.",
  "15": "Convert every confirmed failure in this job into permanent regression data. Link REG_ID to DEFECT_ID and REQ_ID; preserve failure fixture and identity/hash when available, reproduction procedure, detection method, pre-correction result and evidence, correction, post-correction result and evidence, permanent test location, applicability, active/retired state, and retirement authority where applicable.",
  "16": "Revise only the responsible earliest defective layer for this job. Create a controlled CHANGESET_ID preserving triggering defects, RCA, responsible layer, old artifact version, exact modification, new version, downstream invalidation, required reruns, instruction-change determination, repeated preflight requirement, and justified unchanged artifacts. Never overwrite a controlled version in place.",
  "17": "After a material upstream correction, create a complete new ten-execution iteration for this job with new ITERATION_ID and CANDIDATE_ID. Freeze the corrected versions, use ten new independent contexts, withhold prior outputs, use one identical candidate package across all ten runs, and repeat execution, verification, comparison, RCA, regressions, corrections, and lineage.",
  "18": "Determine convergence for this job from evidence, never from run count alone. Calculate mandatory requirement coverage, mandatory verification coverage, applicable regression success, critical defect count, major defect count, mandatory unresolved unknown count, correctness-affecting contradiction count, correctness-affecting ambiguity count, and unexplained correctness-affecting variance count. Convergence exists only when required coverage and regression success are 100 percent and every blocking count is zero simultaneously.",
  "19": "After convergence, run this job’s unchanged confirmation iteration using the exact converged component versions with zero material changes. Verify versions/hashes, use ten new independent contexts, rerun the complete test and regression suites, compare all runs, and detect new defects, missed requirements, missed failure cases, or new correctness-affecting variance. Any failure routes back to the responsible earlier stage.",
  "20": "Freeze this job’s production baseline only after successful unchanged confirmation. Assign BASELINE_ID and preserve the supporting confirmation, exact approved versions, hashes where available, immutable baseline artifact records, authorized recipient roles, controlled baseline storage, status, and evidence. Any material change removes baseline validity until required workflow is repeated.",
  "21": "Generate this job’s finished target product here, in a fresh production context, using only the approved baseline materials. Before this stage the finished target product is not treated as existing. Assign PRODUCT_ID, PRODUCT_VERSION, BASELINE_ID, EXECUTION_ID, context, timestamps, instruction version, tool configuration, deviations, failures, and generated artifact inventory including filename, type, size, hash, and storage reference. No uncontrolled post-generation editing is permitted.",
  "22": "Run deterministic verification against the actual finished product bytes wherever deterministic testing is possible. Verify applicable arithmetic, counts, schemas, filenames, inventory, hashes, required sections, ordering, identifiers, duplicates, references, links, dates, enumerations, required/prohibited text, package contents, structure, dimensions, and other objective properties. Preserve product identity/hash, tool/version, procedure, expected result, actual result, determination, evidence, and defect.",
  "23": "Perform independent meaning/content verification on this job’s actual finished product where deterministic checks cannot establish substantive satisfaction. For each applicable requirement preserve requirement identity, product location, external-source evidence where applicable, required meaning, observed meaning, evidence-based comparison, SATISFIED/VIOLATED/UNDETERMINED, defect, and reason a determination could not be made. Use human-facing terminology such as Meaning Verification or Content Verification.",
  "24": "Perform adversarial verification on this job’s finished product. Test applicable missing material, prohibited material, contradictions, impossible logic, unsupported facts, external-source misrepresentation, wrong versions, broken references, hidden assumptions, partial completion, nonsensical meaning, terminology inconsistency, unhandled exceptions, stale facts, malformed files, hidden content, export corruption, superficial keyword compliance, and historical regressions. Preserve attack, method, expected behavior, actual result, defect, severity, and evidence.",
  "25": "Inspect this job’s exact final delivered representation and package. Preserve artifact inventory, filename, version, byte size, SHA-256, requirement trace, transformation chain and tool versions, before/after hashes, actual rendering/opening evidence, clipping, missing/blank content, broken layout, graphics, font substitution, overlap, hidden content, ordering, export corruption, package inventory, missing/unexpected/duplicate/corrupt files, defects, and coverage counts.",
  "26": "Reconcile this job’s process evidence and product evidence as two separate propositions. Process audit must compare approved versus actual inputs, instruction, tools, required tests, unauthorized modification, authorized changes, chain of custody, defects, blockers, determination, and evidence. Product audit must reconcile mandatory requirement count, affirmative satisfaction count, mandatory test count, validator results, meaning/content verification results, critical/major defects, mandatory unknowns, blockers, determination, and evidence. Neither proposition proves the other.",
  "27": "Apply this job’s release gate and produce exactly one determination: ACCEPTED, REJECTED, or BLOCKED. Preserve PRODUCT_ID, BASELINE_ID, mandatory requirement and evidence counts, violated and undetermined counts, validator counts, failed/not-run/unknown validators, critical and major defects, blocking requirements, failed tests, unresolved defects, blockers, controlling decision rule, and controlling evidence. ACCEPTED does not itself authorize delivery.",
  "28": "Only after Stage 27 is ACCEPTED, verify exact artifact identity immediately before release. Compare audited artifact identity, filename, version, path/storage, byte size, SHA-256, and the exact artifact selected for delivery with its release filename/version/path/size and immediate pre-delivery SHA-256. Any mismatch or post-audit modification stops release.",
  "29": "Preserve this job’s complete evidence chain for every mandatory requirement: EXTERNAL SOURCE / USER AUTHORITY AS APPLICABLE -> REQUIREMENT -> INSTRUCTION -> EXECUTION -> PRODUCT ELEMENT -> TEST -> TEST RESULT -> EVIDENCE -> RELEASE DECISION and, when released, ARTIFACT HASH IDENTITY. Preserve exact IDs, versions, locations, relationships, and evidence. Missing links remain missing and produce FALSE, UNKNOWN, UNDETERMINED, or BLOCKED as appropriate; never fabricate a chain link.",
  "30": "Preserve this job’s failures permanently in append-only defect and regression history. Every defect record must retain stable identity, date, JOB_ID, ITERATION_ID, RUN_ID and/or PRODUCT_ID, REQ_ID, observed failure, expected condition, evidence, severity, root-cause category and cause, correction, changed artifacts, REG_ID, verification result, status, relationships, and append-only corrections. Every confirmed defect requires permanent regression information, and applicable regressions must be rerun for later baseline candidates; failed or UNDETERMINED applicable regressions block approval."
};

const safe=value=>Array.isArray(value)?value:[];
const text=value=>String(value??'').trim();

function boundedValue(value,limit=6000){
  if(value===null||value===undefined)return value;
  if(typeof value==='string'){
    if(value.length<=limit)return value;
    const half=Math.floor(limit/2);
    return {boundedSummary:true,characterCount:value.length,beginning:value.slice(0,half),ending:value.slice(-half),fullValueLocation:'The complete value remains in the canonical project record and must be supplied as a separate attachment when required.'};
  }
  if(Array.isArray(value))return value.map(item=>boundedValue(item,limit));
  if(typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,boundedValue(item,limit)]));
  return value;
}

function recordIdentity(collection,record){
  const schema=model.RECORD_SCHEMAS[collection];
  return text(record?.id||record?.[schema?.id]||record?.fields?.[schema?.id])||'UNKNOWN';
}

function selectCollectionContext(state,collection,maxRecords){
  const value=state?.projectData?.[collection];
  if(!Array.isArray(value))return boundedValue(value);
  const active=value.filter(record=>!record?.invalidatedAt&&!record?.invalidatedBy);
  const selected=active.slice(-maxRecords);
  const omitted=active.slice(0,Math.max(0,active.length-selected.length));
  return {
    totalActiveRecords:active.length,
    includedRecords:selected.map(record=>boundedValue(record)),
    omittedRecordIdentities:omitted.map(record=>recordIdentity(collection,record)),
    bounded:omitted.length>0,
    attachmentRule:omitted.length?'The omitted full records must be supplied by exact identity if this stage needs their complete contents. Do not guess from the summary.':'No active records were omitted.'
  };
}

function selectedContext(stage,state){
  const contract=model.CONTEXT_CONTRACTS[stage.number]||{collections:[],maxRecords:30};
  const collections={};
  for(const name of contract.collections)collections[name]=selectCollectionContext(state,name,contract.maxRecords);
  const prior=stage.number>1?state?.projectData?.stageRecords?.[stage.number-1]||state?.projectData?.stageRecords?.[String(stage.number-1)]||null:null;
  return {
    priorStage:prior?boundedValue(prior):null,
    openBlockers:workflow.openBlockers(state,stage.number).map(record=>boundedValue(record)),
    unresolvedHumanInputRequests:workflow.openQuestions(state,stage.number).map(record=>boundedValue(record)),
    collections
  };
}

function payload(stage,state,instructionId){
  const j=state?.job||{},response=model.responseContract(stage);
  return {
    instructionFormat:'closed-loop-stage-instruction/1',
    instructionId,
    jobControl:{
      jobId:j.JOB_ID||'UNKNOWN',jobTitle:j.JOB_TITLE||'UNKNOWN',stage:stage.number,stageTitle:stage.title,role:stage.role,
      currentIteration:j.CURRENT_ITERATION||'NOT APPLICABLE',currentState:j.CURRENT_STATE||'UNKNOWN',nextRequiredAction:j.NEXT_REQUIRED_ACTION||'UNKNOWN',
      inputVersion:j.CURRENT_INPUT_VERSION||'UNKNOWN',sourceSetVersion:j.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',researchVersion:j.CURRENT_RESEARCH_VERSION||'NOT APPLICABLE',
      requirementsVersion:j.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',testSuiteVersion:j.CURRENT_TEST_SUITE_VERSION||'NOT APPLICABLE',
      mutationSuiteVersion:j.CURRENT_MUTATION_SUITE_VERSION||'NOT APPLICABLE',instructionVersion:j.CURRENT_INSTRUCTION_VERSION||'NOT APPLICABLE',
      baselineId:j.CURRENT_BASELINE_ID||'NONE',productId:j.CURRENT_PRODUCT_ID||'NONE'
    },
    userJobInput:boundedValue(state?.projectData?.userEntered||{}),
    stagePurpose:stage.result,
    stageProcedure:procedures[stage.number],
    stageContext:selectedContext(stage,state),
    ownershipContract:{
      agentWritableStageData:response.stageDataFields,
      permittedRecordCollections:Object.fromEntries(Object.entries(response.collections).map(([name,definition])=>[name,{temporaryKeyRequired:true,canonicalIdField:definition.idField,agentWritableFields:definition.allowedFields,relationships:definition.relationships}])),
      applicationOwnedRule:'Do not include application-owned values, canonical IDs, calculated statuses, calculated counts, versions, timestamps, hashes, current stage/state, release determination, or other deterministic application state.',
      humanOwnedRule:'Do not set human-owned or human-decision fields. Request missing human authority through humanInputRequests.',
      evidenceRule:'Every proposed agent-owned value or record requiring provenance must identify one or more evidenceRefs that resolve to response evidence entries or existing canonical evidence identities.'
    },
    completionConditions:stage.completionGate||[],
    responseSchema:model.RESPONSE_SCHEMA
  };
}

function responseExample(stage,jobId,promptIdentity){
  const contract=model.responseContract(stage);
  const stageData=Object.fromEntries(contract.stageDataFields.map(name=>[name,'UNKNOWN']));
  const records={};
  for(const [collection,definition] of Object.entries(contract.collections)){
    const fields=Object.fromEntries(definition.allowedFields.map(name=>[name,'UNKNOWN']));
    records[collection]=[{tempKey:`${collection}-1`,evidenceRefs:['evidence-1'],...fields}];
  }
  return {
    schema:model.RESPONSE_SCHEMA,
    jobId,
    stage:stage.number,
    promptIdentity,
    responseType:'DATA_PROPOSAL',
    humanInputRequests:[],
    stageData,
    records,
    evidence:[{temporaryKey:'evidence-1',evidenceType:'WORKFLOW_EVIDENCE',description:'Exact evidence supporting the proposal',sourceRefs:[],artifactRefs:[],exactExcerpt:'UNKNOWN',location:'UNKNOWN'}],
    unresolved:[],warnings:[],attachments:[]
  };
}

function render(stage,state,promptIdentity,payloadSha256){
  const j=state?.job||{},contract=model.responseContract(stage),example=responseExample(stage,j.JOB_ID||'UNKNOWN',promptIdentity);
  const allowed=Object.entries(contract.collections).map(([name,definition])=>`- ${name}: ${definition.allowedFields.join(', ')||'(no agent-writable fields; application derives this collection)'}`).join('\n');
  return `COPY BLOCK — STAGE ${String(stage.number).padStart(2,'0')} — ${stage.title}

ROLE
You are the ${stage.role}. Perform only Stage ${String(stage.number).padStart(2,'0')} for JOB_ID ${j.JOB_ID||'UNKNOWN'}.

PROMPT IDENTITY
INSTRUCTION_ID: ${promptIdentity.instructionId}
SHA-256: ${promptIdentity.sha256}
The SHA-256 identifies the canonical instruction payload whose exact structured form is included below. Echo both identity values exactly in the response envelope.

ABSOLUTE PROJECT BOUNDARY
The target product is treated as not yet existing until Stage 21. The current operating application, repository, source code, UI, screenshots, stored project, prior versions, generated outputs, and prior implementations are implementation-side artifacts only. They never establish what this project’s target ought to do and may never become Stage 02 or Stage 03 authority.

STAGE TASK
${procedures[stage.number]}

CANONICAL INSTRUCTION PAYLOAD
${JSON.stringify(payload(stage,state,promptIdentity.instructionId),null,2)}

STRICT RESPONSE CONTRACT
Return exactly one JSON object and no prose, markdown fence, preface, or trailing text. The top-level schema is ${model.RESPONSE_SCHEMA}. Use exactly one responseType: ${model.RESPONSE_TYPES.join(', ')}.

DATA_PROPOSAL
Use DATA_PROPOSAL only when the stage can propose canonical data. Populate only the listed agent-writable stageData fields and permitted record fields. Every proposed record requires a response-local tempKey. Never assign a canonical SOURCE_ID, REQ_ID, TEST_ID, RUN_ID, DEFECT_ID, REG_ID, CHANGESET_ID, BASELINE_ID, PRODUCT_ID, RELEASE_ID, or any other canonical ID. Use temporary keys and response-local references; the application resolves them atomically.

HUMAN_INPUT_REQUIRED
When a missing human-only fact, decision, or authority prevents the stage, return HUMAN_INPUT_REQUIRED with empty stageData and records and one or more humanInputRequests. Each request requires temporaryKey, exact question, whyRequired, affectedStageFields, affectedRecords, answerType, allowedValues, and blocking. Do not convert an unavailable human decision into an assumption.

BLOCKED
Use BLOCKED when authority, evidence, capability, input, or a controlling decision rule is unavailable. Provide unresolved entries and, when applicable, a proposed blocker record. Do not claim completion.

EXECUTION_FAILED
Use EXECUTION_FAILED for an actual execution or tool failure. Preserve the failure in warnings/evidence and do not invent stage data.

AGENT-WRITABLE STAGE DATA
${contract.stageDataFields.length?contract.stageDataFields.map(name=>`- ${name}`).join('\n'):'- NONE. The application derives the stage-level values.'}

PERMITTED RECORD COLLECTIONS
${allowed||'- NONE'}

EVIDENCE AND OWNERSHIP RULES
- Preserve complete factual evidence and exact references.
- Do not set application-owned or human-owned fields.
- Do not set calculated IDs, versions, hashes, timestamps, counts, coverage, statuses, stage progression, convergence, baseline validity, artifact identity matches, or release determination.
- Use UNKNOWN when a fact is not established, NONE only when evidence establishes absence, and NOT APPLICABLE only when an objective applicability rule excludes it.
- Do not silently resolve authoritative conflicts.
- Project artifacts cannot become independent authority merely because they exist.
- Stage 02 sources must be genuinely independent external governing sources.
- Stage 03 research must resolve to accepted Stage 02 source identities.
- Return complete content; do not summarize away required records or evidence.

EXACT RESPONSE SHAPE EXAMPLE
${JSON.stringify(example,null,2)}

PAYLOAD SHA-256 INPUT
${payloadSha256}

END COPY BLOCK — STAGE ${String(stage.number).padStart(2,'0')}`;
}

async function generate(stage,state,{instructionId}={}){
  instructionId=instructionId||workflow.allocateInstructionId(state,stage.number);
  const canonicalPayload=payload(stage,state,instructionId);
  const payloadText=JSON.stringify(canonicalPayload);
  const sha256=await core.sha256Text(payloadText);
  const promptIdentity={instructionId,sha256};
  const prompt=render(stage,state,promptIdentity,sha256);
  const fullPromptSha256=await core.sha256Text(prompt);
  const contextSha256=await core.sha256Text(JSON.stringify(canonicalPayload.stageContext));
  return {instructionId,stage:stage.number,promptIdentity,payload:canonicalPayload,payloadSha256:sha256,fullPromptSha256,contextSha256,prompt,generatedAt:new Date().toISOString(),status:'CURRENT'};
}

function latestSaved(stage,state){return safe(state?.projectData?.generatedPrompts).filter(record=>Number(record.stage)===Number(stage.number)&&record.status!=='STALE').at(-1)||null;}
function buildStagePrompt(stage,state){const saved=latestSaved(stage,state);return saved?.prompt||`Generate the Stage ${String(stage.number).padStart(2,'0')} instruction to create the exact versioned response contract for this project.`;}

core.buildStagePrompt=buildStagePrompt;
globalThis.closedLoopPromptEngine=Object.freeze({version:VERSION,procedures,selectedContext,payload,responseExample,render,generate,latestSaved,buildStagePrompt});
dispatchEvent(new Event('closed-loop-prompt-engine-ready'));
})();
