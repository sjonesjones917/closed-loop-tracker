import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const MODULES=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'];

export function loadRuntime(root=ROOT){
  globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
  globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
  if(!globalThis.closedLoopResponseIngestion){
    for(const file of MODULES)vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
  }
  const runtime={
    core:globalThis.closedLoopCore,
    hash:globalThis.closedLoopHash,
    schema:globalThis.closedLoopWorkflowSchema,
    engine:globalThis.closedLoopWorkflowEngine,
    prompts:globalThis.closedLoopPromptEngine,
    ingestion:globalThis.closedLoopResponseIngestion,
    store:globalThis.closedLoopProjectStore
  };
  for(const [name,value] of Object.entries(runtime))if(!value)throw new Error(`Runtime module ${name} did not load.`);
  return runtime;
}

export const runtime=loadRuntime();
export const {core,hash,schema,engine,prompts,ingestion,store}=runtime;
export const assert=(value,message)=>{if(!value)throw new Error(message);};
export const clone=value=>JSON.parse(JSON.stringify(value));

export function createProject(jobId='JOB-FULL-CYCLE'){
  const project=core.createBlankState(jobId);
  Object.assign(project.job,{
    JOB_ID:jobId,
    JOB_TITLE:'Continuous 30-stage acceptance fixture',
    JOB_OWNER:'Test operator',
    EXACT_USER_OBJECTIVE_VERBATIM:'Produce one verified plain-text delivery artifact through the complete closed-loop workflow.',
    SUPPLIED_MATERIALS_INVENTORY:'One controlled plain-text candidate component.',
    REQUIRED_OUTPUT_FORMAT:'Plain-text delivery artifact.',
    DEADLINE_OR_TEMPORAL_SCOPE:'Current acceptance run.',
    KNOWN_AUTHORITATIVE_SOURCES:'WCAG 2.2 for the synthetic accessibility obligation.',
    AVAILABLE_TOOLS:'Node.js, Chromium, Web Crypto, IndexedDB, Blob, CompressionStream.',
    PROHIBITED_ACTIONS:'No invented authority; no direct canonical writes; fail closed.',
    EXPLICIT_USER_REQUIREMENTS:'One mandatory, deterministic, evidence-backed requirement.'
  });
  engine.ensureShape(project);
  engine.recordHumanInputVersion(project,schema.HUMAN_INTAKE_FIELDS,'FULL_CYCLE_OPERATOR');
  engine.recalculate(project);
  return project;
}

export function evidence(temporaryKey='evidence-1',description='Controlled acceptance evidence',content='Synthetic evidence produced by the full-cycle fixture.',extra={}){
  return {temporaryKey,kind:'WORKFLOW_EVIDENCE',description,location:'verify-full-cycle.mjs',content,...extra};
}

export function proposedRecord(tempKey,fields,relationships={},evidenceRefs=['evidence-1'],extra={}){
  return {tempKey,targetId:null,fields,relationships,evidenceRefs,...extra};
}

export function targetRecord(targetId,fields,relationships={},evidenceRefs=['evidence-1'],extra={}){
  return {tempKey:null,targetId,fields,relationships,evidenceRefs,...extra};
}

export function sourceRecord(tempKey='source-1'){
  return proposedRecord(tempKey,{
    TITLE:'Web Content Accessibility Guidelines (WCAG) 2.2',
    ISSUING_ORGANIZATION_OR_AUTHOR:'World Wide Web Consortium',
    SOURCE_TYPE:'OFFICIAL_STANDARD',
    PUBLICATION_ORIGIN:'W3C Recommendation',
    URL_REFERENCE:'https://www.w3.org/TR/WCAG22/',
    PUBLICATION_UPDATE_DATE:'2024-12-12',
    RETRIEVAL_DATE:'2026-08-25',
    AUTHORITY_LEVEL:'PRIMARY TECHNICAL AUTHORITY',
    AUTHORITY_ROLE:'GOVERNING WHERE APPLICABLE',
    RELEVANCE:'Independent authority for the synthetic text-contrast requirement.',
    APPLICABLE_PORTIONS:'Success Criterion 1.4.3 Contrast (Minimum).',
    INSPECTION_STATUS:'INSPECTED',
    CURRENCY_STATUS:'CURRENT',
    SUPERSESSION_STATUS:'NOT SUPERSEDED',
    CONTROLLING_STATE:'CONTROLLING WHERE APPLICABLE',
    NOTES:'Controlled full-cycle source fixture.'
  });
}

export function researchRecord(sourceId,tempKey='research-1'){
  return proposedRecord(tempKey,{
    PASS_NUMBER:'2',
    EXACT_PORTION_EXAMINED:'WCAG 2.2 Success Criterion 1.4.3.',
    MANDATORY_STATEMENTS:'Normal text requires at least 4.5:1 contrast where applicable.',
    RECOMMENDATIONS:'Use deterministic contrast measurement.',
    OPTIONAL_PRACTICES:'None relied upon.',
    EXAMPLES:'Black text on white background.',
    EXPLANATORY_MATERIAL:'Contrast ratio is objectively measurable.',
    PROHIBITIONS:'Do not claim conformance below the threshold.',
    EXCEPTIONS:'Large text exception is not used in this fixture.',
    DEPENDENCIES:'Rendered foreground and background colors.',
    APPLICABILITY_FACTS:'The delivery contains normal-sized text.',
    RESTRICTIONS:'Synthetic scope is one text artifact.',
    INVALIDATING_MATERIAL:'None found.',
    FINDING_CLASSIFICATION:'MANDATORY',
    SOURCE_EVIDENCE:'The controlling criterion states the measurable minimum.',
    CANDIDATE_REQUIREMENT_REFS:'candidate-requirement-1',
    SATURATION_STATUS:'SATURATED'
  },{SOURCE_ID:{recordId:sourceId}});
}

export function requirementRecord(sourceId,tempKey='requirement-1'){
  return proposedRecord(tempKey,{
    OBLIGATION:'The delivered normal-sized text shall have a foreground-to-background contrast ratio of at least 4.5:1.',
    REQUIREMENT_TYPE:'FUNCTIONAL',
    MANDATORY_OPTIONAL_STATUS:'MANDATORY',
    SOURCE_LOCATION:'WCAG 2.2 Success Criterion 1.4.3.',
    SOURCE_AUTHORITY:'W3C Recommendation.',
    USER_INPUT_RELATIONSHIP:'The user requested one verified delivery artifact.',
    APPLICABILITY:'APPLICABLE',
    DEPENDENCIES:'Known foreground and background colors.',
    PROHIBITIONS:'Do not accept a ratio below 4.5:1.',
    DEFINED_TERMS:'Contrast ratio means the WCAG relative-luminance ratio.',
    OBSERVABLE_SATISFACTION_CONDITION:'A deterministic calculation returns a ratio greater than or equal to 4.5:1.',
    INTENDED_VERIFICATION_METHOD:'DETERMINISTIC',
    EXPECTED_EVIDENCE:'Recorded foreground/background colors, calculation, and result.',
    FAILURE_CONDITION:'Calculated contrast ratio is below 4.5:1 or cannot be determined.',
    SEVERITY:'MINOR',
    NOTES:'Single mandatory full-cycle requirement.'
  },{SOURCE_ID:{recordId:sourceId}});
}

export function testRecord(requirementId,tempKey='test-1'){
  return proposedRecord(tempKey,{
    TEST_TYPE:'DETERMINISTIC',
    INPUTS:'Exact delivered foreground and background colors.',
    TOOLS:'Versioned WCAG contrast calculator.',
    PROCEDURE:'Calculate relative luminance for both colors and compute the contrast ratio.',
    EXPECTED_RESULT:'The ratio is at least 4.5:1.',
    FAILURE_CONDITION:'The ratio is below 4.5:1 or the colors are unavailable.',
    EVIDENCE_TO_PRESERVE:'Color values, calculator version, formula inputs, and calculated ratio.'
  },{REQ_ID:{recordId:requirementId}});
}

export function failureTestRecord(requirementId,tempKey='mutation-1'){
  return proposedRecord(tempKey,{
    VIOLATION_MODE:'Insufficient text contrast.',
    FIXTURE:'Foreground #777777 on background #777777.',
    EXPECTED_REJECTION:'REJECT',
    ACTUAL_RESULT:'REJECTED',
    EVIDENCE:'The deterministic validator returned VIOLATED for a 1.0:1 ratio.'
  },{REQ_ID:{recordId:requirementId}});
}

export function instructionRecord(tempKey='instruction-1'){
  return proposedRecord(tempKey,{
    OBJECTIVE:'Produce the controlled text artifact and establish every mandatory requirement with evidence.',
    AUTHORIZED_INPUTS:'Current User Job Input, source set, requirements, tests, and controlled candidate bytes.',
    FAILURE_HANDLING:'Return BLOCKED, EXECUTION_FAILED, or HUMAN_INPUT_REQUIRED instead of inventing data.',
    AUTHORITY_RULES:'Use only accepted current authority and canonical records.',
    SCOPE:'One plain-text delivery artifact.',
    PROHIBITIONS:'No unsupported claims, mutable identities, or silent truncation.',
    DEFINED_TERMS:'Current means active and matching the controlling version scope.',
    ORDERED_PROCEDURE:'Read current inputs; create the artifact; run the deterministic test; preserve evidence; report exact results.',
    BRANCHES:'Block on unavailable authority, evidence, capability, or human-only decisions.',
    TOOL_REQUIREMENTS:'Use the authorized deterministic calculator and exact-byte hashing.',
    OUTPUT_CONTRACT:'Return the declared artifact and complete structured evidence.',
    FACTUAL_STATE_HANDLING:'Use SATISFIED, VIOLATED, or UNDETERMINED without semantic substitution.',
    REJECTION_BLOCKING_RULES:'Any mandatory violation, unknown, stale scope, or missing evidence blocks acceptance.',
    COMPLETION_CONDITIONS:'Every current mandatory requirement is affirmatively established with current evidence.',
    REQUIREMENT_TRACEABILITY:'Map each mandatory requirement to its instruction location, test, result, and evidence.',
    INSTRUCTION_TEXT:'Create the exact artifact from current canonical inputs, execute the required test, preserve raw evidence, and fail closed.'
  });
}

export function instructionTraceRecord(requirementId,instructionRef='instruction-1',tempKey='trace-1'){
  const instructionTarget=instructionRef.startsWith('PRODUCTION-INSTRUCTION-')?{recordId:instructionRef}:{tempKey:instructionRef};
  return proposedRecord(tempKey,{
    INSTRUCTION_LOCATION:'Ordered procedure, steps 2 through 4.',
    IMPLEMENTED_BEHAVIOR:'Creates the text artifact, executes the contrast test, and preserves exact evidence.'
  },{REQ_ID:{recordId:requirementId},INSTRUCTION_ID:instructionTarget});
}

export function preflightRecord(instructionId,tempKey='preflight-1'){
  return proposedRecord(tempKey,{
    CLAUSE:'Complete production instruction.',
    MULTIPLE_INTERPRETATIONS:'NONE',
    UNDEFINED_OBJECTS:'NONE',
    UNSUPPLIED_DEPENDENCIES:'NONE',
    INTERNAL_CONFLICTS:'NONE',
    UNAVAILABLE_CAPABILITIES:'NONE',
    OBJECTIVELY_VERIFIABLE:'TRUE',
    RESPONSIBLE_OPERATION_ASSIGNED:'TRUE',
    ORDER_CLEAR:'TRUE',
    FAILURE_BEHAVIOR_DEFINED:'TRUE',
    TRACEABILITY:'COMPLETE',
    DETERMINATION:'SATISFIED',
    FINDINGS:'No material ambiguity, contradiction, missing object, or unavailable capability.',
    CORRECTIONS:'NONE',
    EVIDENCE:'Independent clause review completed against every required instruction section and trace.'
  },{INSTRUCTION_ID:{recordId:instructionId}});
}

export function runCompletion(targetId,{contextId,iterationId,candidateId,output='controlled output',tempEvidence='evidence-1'}={}){
  return targetRecord(targetId,{
    FRESH_CONTEXT_RECORD:`Fresh context ${contextId}.`,
    STARTED_AT:'2026-08-25T12:00:00.000Z',
    ENDED_AT:'2026-08-25T12:01:00.000Z',
    CONTAMINATION_CHECK:'NONE',
    TOOL_CONFIGURATION:'CURRENT AUTHORIZED CONFIGURATION',
    EXECUTION_STATUS:'COMPLETED',
    COMPLETE_OUTPUT:output,
    OUTPUT_ARTIFACT_IDENTITIES:'Candidate artifact identity preserved.',
    TOOL_FAILURES:'NONE',
    NOTES:'Controlled independent run.'
  },{},[tempEvidence]);
}

export function verificationRecord({requirementId,runId,testId,index=1,tempKey=`verification-${index}`}={}){
  return proposedRecord(tempKey,{
    VERIFIER:`Independent verifier ${index}`,
    VERIFIER_CONTEXT_ID:`VERIFIER-CONTEXT-${String(index).padStart(3,'0')}`,
    INDEPENDENCE_STATUS:'INDEPENDENT',
    INPUTS:'Exact run output and current deterministic test.',
    PROCEDURE:'Apply the current test to the exact run output without generator context.',
    EXPECTED_RESULT:'Contrast ratio is at least 4.5:1.',
    OBSERVED_RESULT:'Contrast ratio is 21:1.',
    EXACT_EVIDENCE:`Verification ${index}: #000000 on #FFFFFF = 21:1.`,
    DETERMINATION:'SATISFIED',
    UNDETERMINED_REASON:'NONE'
  },{REQ_ID:{recordId:requirementId},RUN_ID:{recordId:runId},TEST_ID:{recordId:testId}});
}

export function comparisonRecord(requirementId,tempKey='comparison-1'){
  return proposedRecord(tempKey,{
    RUN_DETERMINATIONS:'All ten current runs are SATISFIED.',
    INTERPRETATION_VARIANCE:'NONE',
    OUTPUT_VARIANCE:'NONE',
    AUTHORIZED_VARIANCE:'FALSE',
    INCONCLUSIVE_TESTS:'NONE',
    REPEATED_FAILURE_PATTERNS:'NONE',
    UNIQUE_FAILURES:'NONE',
    CORRECTNESS_AFFECTING_VARIANCE:'FALSE',
    DEFECT_IDS:'NONE',
    EVIDENCE:'The ten current verification determinations and outputs were compared one-to-one.'
  },{REQ_ID:{recordId:requirementId}});
}

export function defectRecord(requirementId,runId,tempKey='defect-1'){
  return proposedRecord(tempKey,{
    OBSERVED_FAILURE:'The first candidate omitted the explicit calculator version from one evidence note.',
    EXPECTED_CONDITION:'Every deterministic result identifies the calculator version.',
    EVIDENCE:'The controlled evidence note lacked the version token.',
    SEVERITY:'MINOR',
    ROOT_CAUSE_CATEGORY:'INSTRUCTION',
    ROOT_CAUSE:'The production instruction did not explicitly require the tool version in every evidence note.',
    CORRECTION:'Require the tool version in each evidence note.',
    CHANGED_ARTIFACTS:'Production instruction.',
    VERIFICATION_RESULT:'PENDING CORRECTION',
    RELATIONSHIPS:'Requirement and run linked canonically.'
  },{REQ_ID:{recordId:requirementId},RUN_ID:{recordId:runId}});
}

export function rootCauseRecord(defectRef='defect-1',tempKey='rca-1'){
  const reference=defectRef.startsWith('DEFECT-')?{recordId:defectRef}:{tempKey:defectRef};
  return proposedRecord(tempKey,{
    CATEGORY:'INSTRUCTION',
    LAYER_TRACE:'Source → requirement → test → instruction → execution evidence.',
    EARLIEST_DEFECTIVE_LAYER:'INSTRUCTION',
    ROOT_CAUSE:'The instruction failed to state the per-result tool-version evidence requirement.',
    EVIDENCE:'The requirement and test required evidence, while the instruction omitted the exact evidence detail.',
    DOWNSTREAM_INVALIDATION:'Invalidate the candidate, runs, verification, comparisons, and convergence after correction.'
  },{DEFECT_ID:reference});
}

export function regressionRecord({defectId,requirementId,tempKey='regression-1'}={}){
  return proposedRecord(tempKey,{
    FAILURE_FIXTURE:'A result evidence note without a calculator version.',
    REPRODUCTION_PROCEDURE:'Run the evidence validator against the unversioned note.',
    DETECTION_METHOD:'Require a non-empty tool-and-version token.',
    PRE_CORRECTION_RESULT:'FAILED',
    PRE_CORRECTION_EVIDENCE:'The original note is rejected for missing version identity.',
    CORRECTION:'Add the exact calculator version to every result note.',
    POST_CORRECTION_RESULT:'PENDING LATER EXECUTION',
    POST_CORRECTION_EVIDENCE:'Must be established by a later regression execution.',
    PERMANENT_TEST_LOCATION:'tests/evidence-version-regression',
    APPLICABILITY:'APPLICABLE',
    RETIREMENT_AUTHORITY:'Controlled workflow only.'
  },{DEFECT_ID:{recordId:defectId},REQ_ID:{recordId:requirementId}});
}

export function regressionExecutionRecord({regressionRef='regression-1',iterationId,candidateId,productId=null,phase='PRE_CORRECTION',result='FAILED',evidenceRef='evidence-1',tempKey='reg-exec-1'}={}){
  const rel={
    REG_ID:regressionRef.startsWith('REG-')?{recordId:regressionRef}:{tempKey:regressionRef},
    ITERATION_ID:{recordId:iterationId},
    CANDIDATE_ID:{recordId:candidateId}
  };
  if(productId)rel.PRODUCT_ID={recordId:productId};
  return proposedRecord(tempKey,{PHASE:phase,RESULT:result},rel,[evidenceRef]);
}

export function changeRecord(defectId,tempKey='change-1'){
  return proposedRecord(tempKey,{
    TRIGGERING_DEFECT_IDS:defectId,
    ROOT_CAUSE_ANALYSIS:'The earliest defective layer was the production instruction.',
    RESPONSIBLE_LAYER:'INSTRUCTION',
    OLD_ARTIFACT_VERSION:'INSTRUCTION-v001',
    EXACT_MODIFICATION:'Require the exact tool version in every deterministic evidence note.',
    NEW_ARTIFACT_VERSION:'INSTRUCTION-v002',
    DOWNSTREAM_INVALIDATION:'Invalidate candidate, runs, verification, comparison, convergence, baseline, release, identity, and evidence chains.',
    REQUIRED_RERUNS:'Ten corrected runs plus full independent verification and regression execution.',
    INSTRUCTION_CHANGE_DETERMINATION:'CHANGED',
    REQUIRED_REPEATED_PREFLIGHT:'TRUE',
    JUSTIFIED_UNCHANGED_ARTIFACTS:'The source, requirement, and test definitions are unchanged.',
    EVIDENCE:'Controlled change is directly traceable to the confirmed defect and RCA.'
  });
}

export function deterministicResultRecord({productId,testId,requirementId,tempKey='deterministic-result-1'}={}){
  return proposedRecord(tempKey,{
    TOOL_AND_VERSION:'Controlled contrast calculator 1.0.0',
    PROCEDURE:'Calculate WCAG relative luminance and contrast ratio from exact colors.',
    EXPECTED_RESULT:'At least 4.5:1.',
    ACTUAL_RESULT:'21:1.',
    DETERMINATION:'SATISFIED',
    EVIDENCE:'Exact colors #000000 and #FFFFFF produce 21:1.'
  },{PRODUCT_ID:{recordId:productId},TEST_ID:{recordId:testId}});
}

export function meaningResultRecord({productId,requirementId,tempKey='meaning-result-1'}={}){
  return proposedRecord(tempKey,{
    PRODUCT_LOCATION:'Entire plain-text artifact.',
    EXTERNAL_SOURCE_EVIDENCE:'WCAG 2.2 Success Criterion 1.4.3.',
    REQUIRED_MEANING:'Normal text has at least 4.5:1 contrast.',
    OBSERVED_MEANING:'The exact representation uses black text on white background.',
    EVIDENCE_BASED_COMPARISON:'21:1 exceeds the controlling minimum.',
    DETERMINATION:'SATISFIED',
    UNDETERMINED_REASON:'NONE'
  },{REQ_ID:{recordId:requirementId},PRODUCT_ID:{recordId:productId}});
}

export function adversarialResultRecord(productId,tempKey='attack-1'){
  return proposedRecord(tempKey,{
    ATTACK:'Replace the foreground with the background color.',
    METHOD:'Run the permanent low-contrast fixture.',
    EXPECTED_BEHAVIOR:'The validator rejects the modified representation.',
    ACTUAL_RESULT:'The validator returned VIOLATED and blocked acceptance.',
    DETERMINATION:'SATISFIED',
    SEVERITY:'MAJOR',
    EVIDENCE:'The 1.0:1 fixture was rejected.'
  },{PRODUCT_ID:{recordId:productId}});
}

export function representationRecord(artifactId,tempKey='inspection-1'){
  return proposedRecord(tempKey,{
    REQUIRED_BY_TRACE:'Mandatory contrast requirement and release inventory.',
    TRANSFORMATION_CHAIN:'Canonical text bytes → rendered black text on white background.',
    TRANSFORMATION_TOOLS_VERSIONS:'Chromium current stable.',
    RENDERING_OPENING_EVIDENCE:'The stored artifact bytes opened successfully.',
    OBSERVATIONS:'Filename, bytes, hash, content, and rendering are consistent.',
    DETERMINATION:'SATISFIED',
    EVIDENCE:'Exact stored bytes and rendered representation were inspected.'
  },{ARTIFACT_ID:{recordId:artifactId}});
}

export function processAuditRecord(tempKey='process-audit-1'){
  return proposedRecord(tempKey,{
    APPROVED_INPUTS_VS_ACTUAL:'MATCH',
    APPROVED_INSTRUCTION_VS_ACTUAL:'MATCH',
    APPROVED_TOOLS_VS_ACTUAL:'MATCH',
    REQUIRED_TESTS_VS_EXECUTED:'MATCH',
    UNAUTHORIZED_MODIFICATION:'NONE',
    AUTHORIZED_CHANGES:'One controlled instruction correction.',
    CHAIN_OF_CUSTODY:'Complete canonical IDs, receipts, hashes, and manifests.',
    PROCESS_DEFECTS:'NONE OPEN',
    BLOCKERS:'NONE',
    PROCESS_DETERMINATION:'SATISFIED',
    PROCESS_EVIDENCE:'Full-cycle history and extraction manifests.'
  });
}

export function productAuditRecord(tempKey='product-audit-1'){
  return proposedRecord(tempKey,{
    VALIDATOR_RESULTS:'All current mandatory deterministic results are SATISFIED.',
    MEANING_VERIFICATION_RESULTS:'Current independent meaning review is SATISFIED.',
    PRODUCT_DEFECTS:'NONE OPEN',
    BLOCKERS:'NONE',
    PRODUCT_DETERMINATION:'SATISFIED',
    PRODUCT_EVIDENCE:'Exact product bytes, current tests, meaning review, adversarial result, and representation inspection.'
  });
}

export function releaseGateReviewRecord({productId,baselineId,tempKey='release-review-1'}={}){
  return proposedRecord(tempKey,{
    OBSERVED_BLOCKERS:'NONE',
    OBSERVED_VIOLATIONS:'NONE',
    OBSERVED_MISSING_EVIDENCE:'NONE',
    CONTROLLING_RULE_ANALYSIS:'All current deterministic release conditions are satisfied.',
    EVIDENCE:'Current canonical requirements, results, audits, regression executions, baseline, and product identity.'
  },{PRODUCT_ID:{recordId:productId},BASELINE_ID:{recordId:baselineId}});
}

export function confirmationRecord({sourceIterationId,confirmationIterationId,tempKey='confirmation-1'}={}){
  return proposedRecord(tempKey,{
    ZERO_MATERIAL_CHANGES:'TRUE',
    VERSION_HASH_COMPARISON:'EXACT MATCH',
    TEN_NEW_CONTEXTS:'COMPLETE',
    COMPLETE_TEST_RESULTS:'ALL SATISFIED',
    REGRESSION_RESULTS:'ALL SATISFIED',
    COMPARISON_RESULTS:'NO MATERIAL VARIANCE',
    NEW_DEFECTS:'NONE',
    NEW_REQUIREMENTS:'NONE',
    NEW_FAILURE_CASES:'NONE',
    NEW_VARIANCE:'NONE',
    DETERMINATION:'SATISFIED',
    EVIDENCE:'Ten new contexts reproduced the same candidate bytes and all current checks passed.'
  },{SOURCE_ITERATION_ID:{recordId:sourceIterationId},CONFIRMATION_ITERATION_ID:{recordId:confirmationIterationId}});
}

export class LifecycleHarness{
  constructor(project=createProject()){
    this.project=project;
    this.prompts=[];
    this.acceptances=[];
    this.operator='FULL_CYCLE_OPERATOR';
  }
  reload(){this.project=clone(this.project);engine.ensureShape(this.project);engine.recalculate(this.project);return this.project;}
  savePrompt(stage,{operation,scope={}}={}){
    const built=prompts.buildPromptRecord(stage,this.project,{operation,scope});
    const existing=this.project.projectData.generatedPrompts.find(item=>!item.invalidatedBy&&item.instructionId===built.instructionId&&item.contextSignature===built.contextSignature&&item.operation===built.operation);
    if(existing)return existing;
    const prompt={...built,generatedAt:engine.now()};
    for(const prior of this.project.projectData.generatedPrompts.filter(item=>Number(item.stage)===Number(stage)&&!item.invalidatedBy))prior.invalidatedBy=`SUPERSEDED-BY-${prompt.instructionId}`;
    this.project.projectData.generatedPrompts.push(prompt);
    this.project.stages[stage].currentPromptId=prompt.instructionId;
    this.prompts.push(prompt);
    return prompt;
  }
  envelope(stage,prompt,{responseType='DATA_PROPOSAL',stageData={},records={},evidenceRecords=[evidence()],humanInputRequests=[],unresolved=[],warnings=[],attachments=[]}={}){
    return {
      schema:schema.RESPONSE_SCHEMA,
      jobId:this.project.job.JOB_ID,
      stage:Number(stage),
      operation:prompt.operation,
      promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},
      scope:clone(prompt.scope),
      responseType,
      humanInputRequests,
      stageData,
      records,
      evidence:evidenceRecords,
      unresolved,
      warnings,
      attachments
    };
  }
  prepare(stage,payload={},options={}){
    const prompt=options.prompt||this.savePrompt(stage,{operation:options.operation,scope:options.scope||{}});
    const envelope=this.envelope(stage,prompt,payload);
    const prepared=ingestion.prepare(this.project,{stage,text:JSON.stringify(envelope),promptRecord:prompt,expectedProjectRevision:Number(this.project.revision||0)});
    this.project=prepared.project;
    return {...prepared,prompt,envelope};
  }
  accept(stage,payload={},options={}){
    const prepared=this.prepare(stage,payload,options);
    assert(prepared.validation?.valid,`Stage ${stage} ${prepared.prompt.operation} validation failed: ${JSON.stringify(prepared.validation?.issues||[])}`);
    assert(prepared.proposal?.proposalId,`Stage ${stage} ${prepared.prompt.operation} did not create a proposal.`);
    const beforeEventSequence=Number(this.project.eventSequence||0);
    const committed=ingestion.commit(this.project,prepared.proposal.proposalId,{operator:this.operator,reviewNote:options.reviewNote||'Accepted by continuous full-cycle verifier.'});
    this.project=committed.project;
    this.acceptances.push(committed);
    assert(Number(this.project.eventSequence||0)>=beforeEventSequence,`Stage ${stage} acceptance regressed event sequence.`);
    return {...committed,prompt:prepared.prompt,envelope:prepared.envelope,validation:prepared.validation,proposal:prepared.proposal};
  }
  acceptControl(stage,payload={},options={}){return this.accept(stage,payload,options);}
  reject(stage,payload={},options={}){
    const prepared=this.prepare(stage,payload,options);
    assert(prepared.validation?.valid,`Rejected fixture must first be a valid proposal: ${JSON.stringify(prepared.validation?.issues||[])}`);
    const result=ingestion.reject(this.project,prepared.proposal.proposalId,{operator:this.operator,reason:options.reason||'Controlled rejected-response acceptance scenario.',requestCorrection:options.requestCorrection??true});
    this.project=result.project;
    return {...result,prompt:prepared.prompt,envelope:prepared.envelope,validation:prepared.validation,proposal:prepared.proposal};
  }
  stageComplete(stage){engine.recalculate(this.project);assert(this.project.stages[stage].status==='COMPLETE',`Stage ${stage} is ${this.project.stages[stage].status}: ${this.project.stages[stage].gate.reasons.join('; ')}`);return true;}
  recordId(collection,index=-1){const records=engine.records(this.project,collection);const record=index<0?records.at(index):records[index];return engine.recordId(record,collection);}
}
