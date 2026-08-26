import fs from 'node:fs';
import vm from 'node:vm';
import {envelope,proposal,targetUpdate,refTemp,refId} from './test-fixtures.mjs';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,hash=globalThis.closedLoopHash;
if(!core||!schema||!engine||!prompts||!ingestion||!hash)throw new Error('Full-cycle runtime failed to load.');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const safe=x=>Array.isArray(x)?x:[];

function typedValue(def,name){
  if(def.enumValues?.length)return def.enumValues[0];
  switch(def.valueType){case 'BOOLEAN':return true;case 'INTEGER':return 1;case 'NUMBER':return 1;case 'STRING_ARRAY':return [`verified-${name.toLowerCase()}`];case 'REFERENCE_ARRAY':return [];case 'OBJECT':return {};default:return `verified-${name.toLowerCase()}`;}
}
function coerceValue(def,value){
  if(value===null||value===undefined)return value;
  switch(def?.valueType){case 'STRING':case 'REFERENCE':return String(value);case 'INTEGER':return Number.parseInt(value,10);case 'NUMBER':return Number(value);case 'BOOLEAN':return Boolean(value);case 'STRING_ARRAY':case 'REFERENCE_ARRAY':return Array.isArray(value)?value.map(String):[String(value)];default:return value;}
}
function requiredAgentFields(collection,overrides={}){
  const def=schema.RECORD_SCHEMAS[collection],fields={};
  for(const name of def.required)if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=typedValue(def.fieldDefinitions[name],name);
  for(const [name,value] of Object.entries(overrides))fields[name]=coerceValue(def.fieldDefinitions[name],value);
  return fields;
}
function stageData(stage,overrides={}){
  const data={};
  for(const name of schema.STAGE_CONTRACTS[stage].allowedStageData){const def=schema.STAGE_FIELDS[stage][name];if(def.producer===schema.PRODUCER.AGENT)data[name]=typedValue(def,name);}
  for(const [name,value] of Object.entries(overrides))data[name]=coerceValue(schema.STAGE_FIELDS[stage][name],value);
  return data;
}
function recordId(collection,index=-1){const r=engine.records(p,collection).at(index);return r?engine.recordId(r,collection):null;}
function savePrompt(stage,options={}){const pr=prompts.buildPromptRecord(stage,p,options);p.projectData.generatedPrompts.push({...pr,generatedAt:new Date().toISOString()});p.stages[stage].currentPromptId=pr.instructionId;return pr;}
function canonicalCount(collection){return safe(p.projectData[collection]).filter(r=>r.active!==false&&!r.invalidatedBy).length;}
function accept(stage,pr,body,label=`STAGE-${stage}`){
  const text=JSON.stringify(envelope(schema,p,stage,pr,body));
  const before=JSON.stringify(p.projectData);
  const prepared=ingestion.prepare(p,{stage,text,promptRecord:pr});
  assert(prepared.validation.valid,`${label} validation failed: ${JSON.stringify(prepared.validation.issues)}`);
  assert(prepared.proposal?.status==='PENDING_OPERATOR_REVIEW',`${label} did not create a pending proposal.`);
  assert(JSON.stringify(p.projectData)===before,`${label} mutated the original project before acceptance.`);
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'FULL_CYCLE_OPERATOR',reviewNote:'Continuous lifecycle acceptance fixture.'});
  p=committed.project;
  assert(p.projectData.rawResponses.at(-1)?.completeRawResponse===text,`${label} raw response was not preserved exactly.`);
  assert(p.projectData.outputReceipts.at(-1),`${label} receipt missing.`);
  assert(p.projectData.extractionManifests.at(-1),`${label} extraction manifest missing.`);
  engine.ensureShape(p);engine.recalculate(p);
  return committed;
}
function assertComplete(stage){const g=engine.gate(stage,p);assert(g.complete,`Stage ${stage} expected COMPLETE: ${g.reasons.join('; ')}`);assert(p.stages[stage].status==='COMPLETE',`Stage ${stage} state is ${p.stages[stage].status}.`);}

let p=core.createBlankState('JOB-FULL-CYCLE');
p.job.JOB_ID='JOB-FULL-CYCLE';p.job.JOB_TITLE='Continuous 30-stage lifecycle proof';p.job.EXACT_USER_OBJECTIVE_VERBATIM='Produce and verify one deterministic closed-loop deliverable through all 30 stages.';p.job.REQUIRED_OUTPUT_FORMAT='JSON artifact';p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);engine.recalculate(p);

// Stage 01: structured clarification -> typed answer -> stale old response -> final proposal -> exact human confirmation.
let pr=savePrompt(1);
let clarification=envelope(schema,p,1,pr,{responseType:'HUMAN_INPUT_REQUIRED',stageData:{},records:{},evidenceRecords:[],humanInputRequests:[{temporaryKey:'question-1',question:'Which output encoding is required?',whyRequired:'The production instruction must bind the exact human-required output encoding.',affectedStageFields:[],affectedRecords:[],answerType:'CHOICE',allowedValues:['TEXT','JSON'],blocking:true}]});
let prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(clarification),promptRecord:pr});assert(prepared.validation.valid,`Stage 1 clarification rejected: ${JSON.stringify(prepared.validation.issues)}`);p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'FULL_CYCLE_OPERATOR'}).project;assert(engine.gate(1,p).blocked,'Stage 1 did not block on accepted human question set.');
const question=p.projectData.humanInputRequests.at(-1),oldInput=p.job.CURRENT_INPUT_VERSION,oldPrompt=pr;
const answered=ingestion.answerHumanInput(p,{[question.requestId]:'JSON'},{operator:'FULL_CYCLE_OPERATOR'});p=answered.project;assert(p.job.CURRENT_INPUT_VERSION!==oldInput,'Clarification answer did not increment the input version.');pr=p.projectData.generatedPrompts.at(-1);assert(pr.prompt.includes('JSON'),'Answered clarification is absent from regenerated prompt.');
const stale=envelope(schema,p,1,oldPrompt,{stageData:stageData(1),records:{}});const stalePrepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(stale),promptRecord:oldPrompt});assert(!stalePrepared.validation.valid,'Old Stage 1 response remained acceptable after clarification.');
const c1=accept(1,pr,{stageData:stageData(1),records:{}});engine.recordStageConfirmation(p,1,true,'The represented objective and deliverable match the human intent.','FULL_CYCLE_OPERATOR',{acceptedChangeId:c1.acceptedChange.changeId,inputVersion:p.job.CURRENT_INPUT_VERSION,instructionId:pr.instructionId,contextSignature:pr.contextSignature});assertComplete(1);

// Stage 02: legitimate inspected external authority.
pr=savePrompt(2);accept(2,pr,{stageData:stageData(2),records:{sources:[proposal('source-1',requiredAgentFields('sources',{TITLE:'Web Content Accessibility Guidelines (WCAG) 2.2',ISSUING_ORGANIZATION_OR_AUTHOR:'World Wide Web Consortium',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'W3C Recommendation',URL_REFERENCE:'https://www.w3.org/TR/WCAG22/',AUTHORITY_LEVEL:'PRIMARY TECHNICAL AUTHORITY',AUTHORITY_ROLE:'GOVERNING WHERE APPLICABLE',RELEVANCE:'Controls accessibility acceptance criteria.',APPLICABLE_PORTIONS:'Normative success criteria.',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'CONTROLLING WHERE APPLICABLE'}))]}});assertComplete(2);const sourceId=recordId('sources');

// Stage 03: every current source researched.
pr=savePrompt(3);accept(3,pr,{stageData:stageData(3),records:{research:[proposal('research-1',requiredAgentFields('research',{PASS_NUMBER:1,EXACT_PORTION_EXAMINED:'Normative success criteria',FINDING_CLASSIFICATION:'MANDATORY',SOURCE_EVIDENCE:'W3C normative text inspected.'}),{SOURCE_ID:refId(sourceId)})]}});assertComplete(3);

// Stage 04: one atomic mandatory requirement with provenance and observable success/failure.
pr=savePrompt(4);accept(4,pr,{stageData:stageData(4),records:{requirements:[proposal('req-1',requiredAgentFields('requirements',{OBLIGATION:'The delivered artifact must preserve exact deterministic content identity.',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',SOURCE_LOCATION:'WCAG 2.2 normative criteria plus explicit user requirement.',SOURCE_AUTHORITY:'W3C and User Job Input',USER_INPUT_RELATIONSHIP:'Explicit reliability requirement.',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Recorded bytes hash to the authorized SHA-256.',INTENDED_VERIFICATION_METHOD:'Deterministic byte hash comparison.',EXPECTED_EVIDENCE:'Canonical artifact and hash records.',FAILURE_CONDITION:'Any authorized byte identity mismatch.',SEVERITY:'MAJOR'}),{SOURCE_ID:refId(sourceId)})]}});assertComplete(4);const reqId=recordId('requirements');

// Stage 05: requirement defect review found no blocking defect.
pr=savePrompt(5);accept(5,pr,{stageData:stageData(5),records:{}});assertComplete(5);

// Stage 06: exact current mandatory requirement-to-test coverage.
pr=savePrompt(6);accept(6,pr,{stageData:stageData(6),records:{tests:[proposal('test-1',requiredAgentFields('tests',{TEST_TYPE:'DETERMINISTIC',INPUTS:'Canonical artifact bytes and authorized SHA-256.',TOOLS:'Web Crypto SHA-256',PROCEDURE:'Hash exact bytes and compare to the authorized digest.',EXPECTED_RESULT:'Exact digest equality.',FAILURE_CONDITION:'Digest mismatch.',EVIDENCE_TO_PRESERVE:'Computed digest and artifact identity.'}),{REQ_ID:refId(reqId)})]}});assertComplete(6);const testId=recordId('tests');

// Stage 07: actual invalid fixture is rejected.
pr=savePrompt(7);accept(7,pr,{stageData:stageData(7),records:{failureTests:[proposal('mutation-1',requiredAgentFields('failureTests',{VIOLATION_MODE:'BYTE_MUTATION',FIXTURE:'One-byte modified artifact.',EXPECTED_REJECTION:'REJECT',ACTUAL_RESULT:'REJECTED',EVIDENCE:'Mutated byte identity failed exact SHA-256 comparison.'}),{REQ_ID:refId(reqId)})]}});assertComplete(7);

// Stage 08: instruction and trace, including response-local evidence relationship.
pr=savePrompt(8);accept(8,pr,{stageData:stageData(8),records:{instructions:[proposal('instruction-1',requiredAgentFields('instructions',{OBJECTIVE:'Produce only the authorized deterministic artifact.',AUTHORIZED_INPUTS:'Current canonical project scope.',FAILURE_HANDLING:'Fail closed on missing or invalid input.',AUTHORITY_RULES:'Canonical application state controls identity and release.',SCOPE:'Current project only.',PROHIBITIONS:'No invented authority or application state.',DEFINED_TERMS:'Canonical means accepted application-controlled state.',ORDERED_PROCEDURE:'Read authorized inputs; produce artifact; preserve evidence.',TOOL_REQUIREMENTS:'Required deterministic tools only.',OUTPUT_CONTRACT:'Return the versioned response envelope.',FACTUAL_STATE_HANDLING:'Unknown facts remain undetermined.',REJECTION_BLOCKING_RULES:'Invalid or stale output is rejected.',COMPLETION_CONDITIONS:'All required evidence and gates satisfied.',REQUIREMENT_TRACEABILITY:reqId,INSTRUCTION_TEXT:'Produce the authorized artifact and fail closed on uncertainty.'}))],instructionTraces:[proposal('trace-1',requiredAgentFields('instructionTraces',{INSTRUCTION_LOCATION:'Production instruction body.',IMPLEMENTED_BEHAVIOR:'Exact artifact byte identity is generated and verified.'}),{REQ_ID:refId(reqId),INSTRUCTION_ID:refTemp('instruction-1'),EVIDENCE_ID:refTemp('evidence-1')})]}});assertComplete(8);const instructionId=recordId('instructions');

// Stage 09: independent preflight.
pr=savePrompt(9);accept(9,pr,{stageData:stageData(9,{REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR:true,EVERY_SENTENCE_REVIEWED:true}),records:{preflightRecords:[proposal('preflight-1',requiredAgentFields('preflightRecords',{CLAUSE:'Entire production instruction.',DETERMINATION:'SATISFIED',FINDINGS:'No material ambiguity or missing dependency.',EVIDENCE:'Independent controlled preflight completed.'}),{INSTRUCTION_ID:refId(instructionId)})]}});assertComplete(9);

// Stage 10: actual bytes registered, then application freezes iteration/candidate identity.
const candidateBytes=new TextEncoder().encode('{"candidate":true}'),candidateSha=await hash.sha256Bytes(candidateBytes);engine.registerArtifactBytes(p,{stage:10,artifactId:'ARTIFACT-CANDIDATE',filename:'candidate.json',mediaType:'application/json',byteSize:candidateBytes.byteLength,sha256:candidateSha,lineage:{purpose:'full-cycle candidate'}});
pr=savePrompt(10);accept(10,pr,{stageData:stageData(10),records:{}});const frozen=engine.freezeCandidate(p,{artifactIds:['ARTIFACT-CANDIDATE'],operatorLabel:'FULL_CYCLE_OPERATOR'});engine.recalculate(p);assertComplete(10);const iterationId=frozen.iteration.id,candidateId=frozen.candidate.id;

// Stage 11: application reserves exactly ten run/context identities; agent only completes reserved run fields.
const slots=engine.reserveRunBatch(p,{stage:11,iterationId,candidateId,count:10});
for(let i=0;i<slots.length;i++){
  const slot=slots[i];engine.registerFreshContext(p,{stage:11,externalContextIdentifier:`EXTERNAL-CONTEXT-11-${i+1}`,operatorLabel:'FULL_CYCLE_OPERATOR'});pr=savePrompt(11,{scope:{runId:slot.runId,contextId:slot.contextId,iterationId,candidateId}});
  accept(11,pr,{stageData:stageData(11),records:{runs:[targetUpdate(slot.runId,{FRESH_CONTEXT_RECORD:slot.contextId,STARTED_AT:`2026-08-25T20:${String(i).padStart(2,'0')}:00Z`,ENDED_AT:`2026-08-25T20:${String(i).padStart(2,'0')}:30Z`,CONTAMINATION_CHECK:'NONE',TOOL_CONFIGURATION:'CONTROLLED',EXECUTION_STATUS:'COMPLETE',COMPLETE_OUTPUT:`run-${i}-output`,OUTPUT_ARTIFACT_IDENTITIES:'ARTIFACT-CANDIDATE',TOOL_FAILURES:'NONE',NOTES:'Controlled independent run.'})]}} ,`STAGE-11-RUN-${i+1}`);
}
engine.recalculate(p);assertComplete(11);

// Stage 12: exact REQ × RUN × TEST triples, one independent evidenced result per triple.
const currentRuns=engine.recordsForCurrentScope(p,'runs',{iterationId});
for(let i=0;i<currentRuns.length;i++){
  const runId=engine.recordId(currentRuns[i],'runs');pr=savePrompt(12,{scope:{iterationId,candidateId,runId}});
  accept(12,pr,{stageData:stageData(12),records:{verification:[proposal(`verification-${i}`,requiredAgentFields('verification',{VERIFIER:`INDEPENDENT_VERIFIER_${i}`,VERIFIER_CONTEXT_ID:`VERIFY-CONTEXT-${i}`,INDEPENDENCE_STATUS:'INDEPENDENT',INPUTS:`${reqId}|${runId}|${testId}`,PROCEDURE:'Execute the exact deterministic test against the run output.',EXPECTED_RESULT:'SATISFIED',OBSERVED_RESULT:'SATISFIED',EXACT_EVIDENCE:`Evidence for ${runId}`,DETERMINATION:'SATISFIED',UNDETERMINED_REASON:''}),{REQ_ID:refId(reqId),RUN_ID:refId(runId),TEST_ID:refId(testId)})]}} ,`STAGE-12-TRIPLE-${i+1}`);
}
engine.recalculate(p);assertComplete(12);

// Stage 13: one comparison covers all ten current runs with no correctness-affecting variance.
pr=savePrompt(13);accept(13,pr,{stageData:stageData(13),records:{comparisons:[proposal('comparison-1',requiredAgentFields('comparisons',{RUN_DETERMINATIONS:currentRuns.map(r=>`${engine.recordId(r,'runs')}:SATISFIED`).join('|'),INTERPRETATION_VARIANCE:'NONE',OUTPUT_VARIANCE:'NONE',AUTHORIZED_VARIANCE:'NONE',INCONCLUSIVE_TESTS:'NONE',REPEATED_FAILURE_PATTERNS:'NONE',UNIQUE_FAILURES:'NONE',CORRECTNESS_AFFECTING_VARIANCE:'NONE',DEFECT_IDS:'NONE',EVIDENCE:'All ten current runs and their verification records were compared.'}),{REQ_ID:refId(reqId)})]}});assertComplete(13);

// Stage 14: one independently identified material defect and evidence-supported earliest-layer RCA.
pr=savePrompt(14);accept(14,pr,{stageData:stageData(14),records:{defects:[proposal('defect-1',requiredAgentFields('defects',{OBSERVED_FAILURE:'The failure fixture exposes an execution-layer defect requiring a controlled correction.',EXPECTED_CONDITION:'Invalid bytes must be rejected without ambiguity.',EVIDENCE:'Failure-test and verification evidence identify the defect.',SEVERITY:'MAJOR',ROOT_CAUSE_CATEGORY:'EXECUTION',ROOT_CAUSE:'The execution path failed to preserve the required rejection behavior.',CORRECTION:'Correct the responsible execution layer and rerun the complete iteration.',CHANGED_ARTIFACTS:'Candidate execution implementation.',VERIFICATION_RESULT:'CONFIRMED',RELATIONSHIPS:'Requirement and current run evidence.'}),{REQ_ID:refId(reqId),RUN_ID:refId(engine.recordId(currentRuns[0],'runs'))})],rootCauses:[proposal('rca-1',requiredAgentFields('rootCauses',{CATEGORY:'EXECUTION',LAYER_TRACE:'Requirement -> instruction -> candidate -> execution -> observed failure.',EARLIEST_DEFECTIVE_LAYER:'EXECUTION',ROOT_CAUSE:'Execution implementation is the earliest defective layer.',EVIDENCE:'Canonical failure and verification records support the backward trace.',DOWNSTREAM_INVALIDATION:'Invalidate Stages 16-30 and require a corrected iteration.'}),{DEFECT_ID:refTemp('defect-1')})]}});engine.recalculate(p);assertComplete(14);const defectId=recordId('defects');

// Stage 15: permanent regression definition plus actual pre-correction failing execution.
pr=savePrompt(15);accept(15,pr,{stageData:stageData(15),records:{regressions:[proposal('regression-1',requiredAgentFields('regressions',{FAILURE_FIXTURE:'The exact pre-correction invalid-byte fixture.',REPRODUCTION_PROCEDURE:'Execute the invalid-byte case against the frozen candidate.',DETECTION_METHOD:'Exact deterministic rejection assertion.',PRE_CORRECTION_RESULT:'VIOLATED',PRE_CORRECTION_EVIDENCE:'The pre-correction execution reproduced the defect.',CORRECTION:'Apply the responsible execution-layer correction.',PERMANENT_TEST_LOCATION:'Permanent regression suite.',APPLICABILITY:'ACTIVE'}),{DEFECT_ID:refId(defectId),REQ_ID:refId(reqId)})],regressionExecutions:[proposal('reg-exec-pre',requiredAgentFields('regressionExecutions',{PHASE:'PRE_CORRECTION',RESULT:'VIOLATED'}),{REG_ID:refTemp('regression-1'),ITERATION_ID:refId(iterationId),CANDIDATE_ID:refId(candidateId),EVIDENCE_ID:refTemp('evidence-1')})]}});engine.recalculate(p);assertComplete(15);const regId=recordId('regressions');

// Stage 16: controlled responsible-layer correction proposal; application remains authority for authorization and invalidation.
pr=savePrompt(16);accept(16,pr,{stageData:stageData(16,{INSTRUCTION_CHANGED:'NO',IF_EXECUTION_ONLY_DEFECT_WAS_INSTRUCTION_PRESERVED:'YES',PREFLIGHT_REPEATED_IF_CHANGED:'NOT_REQUIRED',ARTIFACTS_CHANGED:'EXECUTION_IMPLEMENTATION',NEW_VERSIONS_CREATED:'YES',IN_PLACE_MODIFICATIONS:'NONE',DOWNSTREAM_VERIFICATIONS_INVALIDATED:'YES'}),records:{changes:[proposal('change-1',requiredAgentFields('changes',{TRIGGERING_DEFECT_IDS:defectId,ROOT_CAUSE_ANALYSIS:'Execution is the earliest defective layer.',RESPONSIBLE_LAYER:'EXECUTION',OLD_ARTIFACT_VERSION:'candidate-v1',EXACT_MODIFICATION:'Correct invalid-byte rejection behavior without changing the instruction.',NEW_ARTIFACT_VERSION:'candidate-v2',DOWNSTREAM_INVALIDATION:'Invalidate later verification and release work.',REQUIRED_RERUNS:'Full corrected ten-run iteration and downstream verification.',INSTRUCTION_CHANGE_DETERMINATION:'UNCHANGED',REQUIRED_REPEATED_PREFLIGHT:'NOT_REQUIRED',JUSTIFIED_UNCHANGED_ARTIFACTS:'Instruction remains semantically unchanged.',EVIDENCE:'RCA and regression evidence justify the correction.'}))]}});engine.recalculate(p);assertComplete(16);

// Stage 17: corrected candidate, ten new contexts/runs, full matrix, comparison, and post-correction regression execution.
pr=savePrompt(17,{operation:'FREEZE'});accept(17,pr,{stageData:stageData(17,{OLD_CONVERSATIONS_CONTINUED:'NO',PRIOR_OUTPUTS_WITHHELD:'YES'}),records:{}},'STAGE-17-FREEZE');
const correctedBytes=new TextEncoder().encode('{"candidate":true,"correction":1}'),correctedSha=await hash.sha256Bytes(correctedBytes);engine.registerArtifactBytes(p,{stage:17,artifactId:'ARTIFACT-CORRECTED',filename:'candidate-corrected.json',mediaType:'application/json',byteSize:correctedBytes.byteLength,sha256:correctedSha,lineage:{purpose:'corrected iteration'}});
const correctedFreeze=engine.freezeCandidate(p,{stage:17,artifactIds:['ARTIFACT-CORRECTED'],operatorLabel:'FULL_CYCLE_OPERATOR',purpose:'CORRECTED_ITERATION'}),iteration17=correctedFreeze.iteration.id,candidate17=correctedFreeze.candidate.id;assert(p.stages[16].status==='COMPLETE','Creating the Stage 17 candidate retroactively invalidated completed Stage 16.');
const slots17=engine.reserveRunBatch(p,{stage:17,iterationId:iteration17,candidateId:candidate17,count:10});
for(let i=0;i<slots17.length;i++){const slot=slots17[i];engine.registerFreshContext(p,{stage:17,externalContextIdentifier:`EXTERNAL-CONTEXT-17-${i+1}`,operatorLabel:'FULL_CYCLE_OPERATOR'});pr=savePrompt(17,{operation:'EXECUTE_RUN',scope:{runId:slot.runId,contextId:slot.contextId,iterationId:iteration17,candidateId:candidate17}});accept(17,pr,{stageData:stageData(17,{EXECUTE_COMPLETED:'YES',IDENTICAL_PACKAGE_CONFIRMED_FOR_ALL_RUNS:'YES',OLD_CONVERSATIONS_CONTINUED:'NO',PRIOR_OUTPUTS_WITHHELD:'YES'}),records:{runs:[targetUpdate(slot.runId,{FRESH_CONTEXT_RECORD:slot.contextId,STARTED_AT:`2026-08-25T21:${String(i).padStart(2,'0')}:00Z`,ENDED_AT:`2026-08-25T21:${String(i).padStart(2,'0')}:30Z`,CONTAMINATION_CHECK:'NONE',TOOL_CONFIGURATION:'CONTROLLED',EXECUTION_STATUS:'COMPLETE',COMPLETE_OUTPUT:`corrected-run-${i}-output`,OUTPUT_ARTIFACT_IDENTITIES:'ARTIFACT-CORRECTED',TOOL_FAILURES:'NONE',NOTES:'Fresh corrected run.'})]}},`STAGE-17-RUN-${i+1}`);}
const runs17=engine.recordsForCurrentScope(p,'runs',{iterationId:iteration17});
for(let i=0;i<runs17.length;i++){const runId=engine.recordId(runs17[i],'runs');pr=savePrompt(17,{operation:'VERIFY',scope:{iterationId:iteration17,candidateId:candidate17,runId}});accept(17,pr,{stageData:stageData(17,{VERIFY_COMPLETED:'YES'}),records:{verification:[proposal(`verification-17-${i}`,requiredAgentFields('verification',{VERIFIER:`INDEPENDENT_CORRECTED_VERIFIER_${i}`,VERIFIER_CONTEXT_ID:`VERIFY17-CONTEXT-${i}`,INDEPENDENCE_STATUS:'INDEPENDENT',INPUTS:`${reqId}|${runId}|${testId}`,PROCEDURE:'Execute exact deterministic test on corrected run.',EXPECTED_RESULT:'SATISFIED',OBSERVED_RESULT:'SATISFIED',EXACT_EVIDENCE:`Corrected evidence for ${runId}`,DETERMINATION:'SATISFIED',UNDETERMINED_REASON:''}),{REQ_ID:refId(reqId),RUN_ID:refId(runId),TEST_ID:refId(testId)})]}},`STAGE-17-VERIFY-${i+1}`);}
pr=savePrompt(17,{operation:'COMPARE',scope:{iterationId:iteration17,candidateId:candidate17}});accept(17,pr,{stageData:stageData(17,{COMPARE_COMPLETED:'YES'}),records:{comparisons:[proposal('comparison-17',requiredAgentFields('comparisons',{RUN_DETERMINATIONS:runs17.map(r=>`${engine.recordId(r,'runs')}:SATISFIED`).join('|'),INTERPRETATION_VARIANCE:'NONE',OUTPUT_VARIANCE:'NONE',AUTHORIZED_VARIANCE:'NONE',INCONCLUSIVE_TESTS:'NONE',REPEATED_FAILURE_PATTERNS:'NONE',UNIQUE_FAILURES:'NONE',CORRECTNESS_AFFECTING_VARIANCE:'NONE',DEFECT_IDS:'NONE',EVIDENCE:'All ten corrected runs satisfy the current requirement.'}),{REQ_ID:refId(reqId)})]}},'STAGE-17-COMPARE');
pr=savePrompt(17,{operation:'REGRESSION',scope:{iterationId:iteration17,candidateId:candidate17}});accept(17,pr,{stageData:stageData(17,{REGRESSION_TESTS_ADDED:'NO_NEW_DEFINITION_REQUIRED'}),records:{regressionExecutions:[proposal('reg-exec-post',requiredAgentFields('regressionExecutions',{PHASE:'POST_CORRECTION',RESULT:'SATISFIED'}),{REG_ID:refId(regId),ITERATION_ID:refId(iteration17),CANDIDATE_ID:refId(candidate17),EVIDENCE_ID:refTemp('evidence-1')})]}},'STAGE-17-REGRESSION');
engine.recalculate(p);assertComplete(17);const iteration17Evaluation=engine.evaluateIteration(p,iteration17,'CORRECTED');assert(iteration17Evaluation.matrix.coverage===1,'Stage 17 exact verification coverage must equal 1.0.');assert(iteration17Evaluation.regressionExecutionCount>=1,'Stage 17 must include an actual regression execution.');

// Stage 18: application-derived convergence on the corrected Stage 17 iteration.
pr=savePrompt(18);accept(18,pr,{stageData:stageData(18),records:{}});engine.recalculate(p);assertComplete(18);assert(p.stages[18].derivedData.ALL_CONDITIONS_SIMULTANEOUSLY_TRUE===true,`Stage 18 convergence was not application-derived true: ${JSON.stringify({derived:p.stages[18].derivedData,metrics:engine.convergenceMetrics(p),gate:engine.gate(18,p)})}`);

// Stage 19: freeze the exact same component bytes, then run ten entirely new contexts and the full verification/regression cycle.
pr=savePrompt(19,{operation:'CONFIRM_FREEZE'});accept(19,pr,{stageData:stageData(19),records:{}},'STAGE-19-CONFIRM-FREEZE');
const unchangedFreeze=engine.freezeCandidate(p,{stage:19,artifactIds:['ARTIFACT-CORRECTED'],operatorLabel:'FULL_CYCLE_OPERATOR',purpose:'UNCHANGED_CONFIRMATION'}),iteration19=unchangedFreeze.iteration.id,candidate19=unchangedFreeze.candidate.id;
const slots19=engine.reserveRunBatch(p,{stage:19,iterationId:iteration19,candidateId:candidate19,count:10});
for(let i=0;i<slots19.length;i++){const slot=slots19[i];engine.registerFreshContext(p,{stage:19,externalContextIdentifier:`EXTERNAL-CONTEXT-19-${i+1}`,operatorLabel:'FULL_CYCLE_OPERATOR'});pr=savePrompt(19,{operation:'EXECUTE_RUN',scope:{runId:slot.runId,contextId:slot.contextId,iterationId:iteration19,candidateId:candidate19}});accept(19,pr,{stageData:stageData(19),records:{runs:[targetUpdate(slot.runId,{FRESH_CONTEXT_RECORD:slot.contextId,STARTED_AT:`2026-08-25T22:${String(i).padStart(2,'0')}:00Z`,ENDED_AT:`2026-08-25T22:${String(i).padStart(2,'0')}:30Z`,CONTAMINATION_CHECK:'NONE',TOOL_CONFIGURATION:'CONTROLLED',EXECUTION_STATUS:'COMPLETE',COMPLETE_OUTPUT:`unchanged-run-${i}-output`,OUTPUT_ARTIFACT_IDENTITIES:'ARTIFACT-CORRECTED',TOOL_FAILURES:'NONE',NOTES:'Fresh unchanged-confirmation run.'})]}},`STAGE-19-RUN-${i+1}`);}
const runs19=engine.recordsForCurrentScope(p,'runs',{iterationId:iteration19,candidateId:candidate19});
for(let i=0;i<runs19.length;i++){const runId=engine.recordId(runs19[i],'runs');pr=savePrompt(19,{operation:'VERIFY',scope:{iterationId:iteration19,candidateId:candidate19,runId}});accept(19,pr,{stageData:stageData(19),records:{verification:[proposal(`verification-19-${i}`,requiredAgentFields('verification',{VERIFIER:`INDEPENDENT_UNCHANGED_VERIFIER_${i}`,VERIFIER_CONTEXT_ID:`VERIFY19-CONTEXT-${i}`,INDEPENDENCE_STATUS:'INDEPENDENT',INPUTS:`${reqId}|${runId}|${testId}`,PROCEDURE:'Execute exact deterministic test on unchanged candidate run.',EXPECTED_RESULT:'SATISFIED',OBSERVED_RESULT:'SATISFIED',EXACT_EVIDENCE:`Unchanged evidence for ${runId}`,DETERMINATION:'SATISFIED',UNDETERMINED_REASON:''}),{REQ_ID:refId(reqId),RUN_ID:refId(runId),TEST_ID:refId(testId)})]}},`STAGE-19-VERIFY-${i+1}`);}
pr=savePrompt(19,{operation:'COMPARE',scope:{iterationId:iteration19,candidateId:candidate19}});accept(19,pr,{stageData:stageData(19),records:{comparisons:[proposal('comparison-19',requiredAgentFields('comparisons',{RUN_DETERMINATIONS:runs19.map(r=>`${engine.recordId(r,'runs')}:SATISFIED`).join('|'),INTERPRETATION_VARIANCE:'NONE',OUTPUT_VARIANCE:'NONE',AUTHORIZED_VARIANCE:'NONE',INCONCLUSIVE_TESTS:'NONE',REPEATED_FAILURE_PATTERNS:'NONE',UNIQUE_FAILURES:'NONE',CORRECTNESS_AFFECTING_VARIANCE:'NONE',DEFECT_IDS:'NONE',EVIDENCE:'All ten unchanged confirmation runs satisfy the current requirement.'}),{REQ_ID:refId(reqId)})]}},'STAGE-19-COMPARE');
pr=savePrompt(19,{operation:'REGRESSION_VERIFY',scope:{iterationId:iteration19,candidateId:candidate19}});accept(19,pr,{stageData:stageData(19),records:{regressionExecutions:[proposal('reg-exec-confirm',requiredAgentFields('regressionExecutions',{PHASE:'UNCHANGED_CONFIRMATION',RESULT:'SATISFIED'}),{REG_ID:refId(regId),ITERATION_ID:refId(iteration19),CANDIDATE_ID:refId(candidate19),EVIDENCE_ID:refTemp('evidence-1')})]}},'STAGE-19-REGRESSION');
pr=savePrompt(19,{operation:'CONFIRM',scope:{iterationId:iteration19,candidateId:candidate19}});accept(19,pr,{stageData:stageData(19),records:{confirmationRecords:[proposal('confirmation-19',requiredAgentFields('confirmationRecords',{DETERMINATION:'SATISFIED'}))]}},'STAGE-19-CONFIRM');
engine.recalculate(p);assertComplete(19);const iteration19Evaluation=engine.evaluateIteration(p,iteration19,'UNCHANGED_CONFIRMATION');assert(iteration19Evaluation.matrix.coverage===1,'Stage 19 exact verification coverage must equal 1.0.');assert(iteration19Evaluation.regressionExecutionCount>=1,'Stage 19 must execute the permanent regression suite.');

// Stage 20: accept current unchanged-confirmation evidence, then human-authorize and application-freeze exact baseline bytes.
pr=savePrompt(20);assert(!schema.operationContract(20,'COMPLETE').scopeRequirements.includes('baselineId'),'Stage 20 response cannot require a baseline ID before application allocation.');accept(20,pr,{stageData:stageData(20),records:{}},'STAGE-20-PROPOSAL');
const baseline=engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CORRECTED'],operatorLabel:'FULL_CYCLE_OPERATOR',authorization:'AUTHORIZED'});engine.recalculate(p);assertComplete(19);assertComplete(20);assert(engine.recordId(baseline,'baselines')===p.job.CURRENT_BASELINE_ID,'Stage 20 did not assign the canonical baseline ID.');

// Stage 21: fresh production context, application-reserved product identity, and exact output bytes.
const productionContext=engine.registerFreshContext(p,{stage:21,externalContextIdentifier:'EXTERNAL-PRODUCTION-CONTEXT-21',operatorLabel:'FULL_CYCLE_OPERATOR'});
const product=engine.reserveProductExecution(p,{operatorLabel:'FULL_CYCLE_OPERATOR'}),productId=engine.recordId(product,'products');
const productBytesA=new TextEncoder().encode('{"delivery":"A","verified":true}'),productShaA=await hash.sha256Bytes(productBytesA);
const productBytesB=new TextEncoder().encode('{"delivery":"B","verified":true}'),productShaB=await hash.sha256Bytes(productBytesB);
engine.registerArtifactBytes(p,{stage:21,artifactId:'ARTIFACT-PRODUCT-A',filename:'result-a.json',mediaType:'application/json',byteSize:productBytesA.byteLength,sha256:productShaA,lineage:{productId,baselineId:p.job.CURRENT_BASELINE_ID}});
engine.registerArtifactBytes(p,{stage:21,artifactId:'ARTIFACT-PRODUCT-B',filename:'result-b.json',mediaType:'application/json',byteSize:productBytesB.byteLength,sha256:productShaB,lineage:{productId,baselineId:p.job.CURRENT_BASELINE_ID}});
pr=savePrompt(21);accept(21,pr,{stageData:stageData(21),records:{products:[targetUpdate(productId,requiredAgentFields('products',{BASELINE_MATERIALS:['ARTIFACT-CORRECTED'],EXECUTION_TIMESTAMPS:{completedAt:'2026-08-25T23:00:00Z'},TOOL_CONFIGURATION:'CONTROLLED PRODUCTION CONFIGURATION',DEVIATIONS:'NONE',FAILURES:'NONE',GENERATED_ARTIFACT_INVENTORY:['ARTIFACT-PRODUCT-A','ARTIFACT-PRODUCT-B']}))]}},'STAGE-21-PRODUCT');engine.recalculate(p);assertComplete(21);assert(engine.recordValue(engine.records(p,'products',{stage:21}).at(-1),'PRODUCTION_CONTEXT_ID')===engine.recordId(productionContext,'freshContexts'),'Stage 21 product is not bound to the registered fresh context.');

// Stage 22: exactly one current deterministic product result for the current mandatory deterministic test.
pr=savePrompt(22);accept(22,pr,{stageData:stageData(22),records:{deterministicResults:[proposal('deterministic-1',requiredAgentFields('deterministicResults',{TOOL_AND_VERSION:'Web Crypto SHA-256',PROCEDURE:'Hash exact delivered bytes and compare against canonical product artifact digests.',EXPECTED_RESULT:'SATISFIED',ACTUAL_RESULT:'SATISFIED',DETERMINATION:'SATISFIED',EVIDENCE:'Both stored product artifacts match their application-computed SHA-256 identities.'}),{PRODUCT_ID:refId(productId),TEST_ID:refId(testId)})]}});engine.recalculate(p);assertComplete(22);

// Stage 23: independent current meaning review for the mandatory requirement.
pr=savePrompt(23);accept(23,pr,{stageData:stageData(23),records:{meaningResults:[proposal('meaning-1',requiredAgentFields('meaningResults',{PRODUCT_LOCATION:'result-a.json and result-b.json',EXTERNAL_SOURCE_EVIDENCE:'Current accepted authority and requirement trace.',REQUIRED_MEANING:'Delivered artifacts preserve the exact authorized deterministic content identity.',OBSERVED_MEANING:'Delivered artifacts preserve the required exact identities.',EVIDENCE_BASED_COMPARISON:'Required and observed meanings are aligned without an unresolved variance.',DETERMINATION:'SATISFIED',UNDETERMINED_REASON:''}),{REQ_ID:refId(reqId),PRODUCT_ID:refId(productId)})]}});engine.recalculate(p);assertComplete(23);

// Stage 24: adversarial verification of the current product and active historical regression pattern.
pr=savePrompt(24);accept(24,pr,{stageData:stageData(24),records:{adversarialResults:[proposal('attack-1',requiredAgentFields('adversarialResults',{ATTACK:`BYTE_MUTATION and active regression ${regId}`,METHOD:'Attempt one-byte modification and stale identity substitution.',EXPECTED_BEHAVIOR:'Modified or stale bytes are rejected.',ACTUAL_RESULT:'All adversarial modifications were rejected.',DETERMINATION:'SATISFIED',SEVERITY:'MAJOR',EVIDENCE:`Current product evidence plus permanent regression ${regId}.`}),{PRODUCT_ID:refId(productId)})]}});engine.recalculate(p);assertComplete(24);

// Stage 25: every actual product artifact receives an evidenced representation inspection.
pr=savePrompt(25);accept(25,pr,{stageData:stageData(25),records:{representationInspections:[
 proposal('inspection-a',requiredAgentFields('representationInspections',{REQUIRED_BY_TRACE:reqId,TRANSFORMATION_CHAIN:'Canonical bytes -> stored product artifact -> inspected representation.',TRANSFORMATION_TOOLS_VERSIONS:'Current Chromium-compatible inspection path.',RENDERING_OPENING_EVIDENCE:'result-a.json opened and inspected.',OBSERVATIONS:'No mandatory representation unknown remains.',DETERMINATION:'SATISFIED',EVIDENCE:'Exact artifact A identity and inspection evidence.'}),{ARTIFACT_ID:refId('ARTIFACT-PRODUCT-A')}),
 proposal('inspection-b',requiredAgentFields('representationInspections',{REQUIRED_BY_TRACE:reqId,TRANSFORMATION_CHAIN:'Canonical bytes -> stored product artifact -> inspected representation.',TRANSFORMATION_TOOLS_VERSIONS:'Current Chromium-compatible inspection path.',RENDERING_OPENING_EVIDENCE:'result-b.json opened and inspected.',OBSERVATIONS:'No mandatory representation unknown remains.',DETERMINATION:'SATISFIED',EVIDENCE:'Exact artifact B identity and inspection evidence.'}),{ARTIFACT_ID:refId('ARTIFACT-PRODUCT-B')})
]}});engine.recalculate(p);assertComplete(25);

// Stage 26: current process and product audits both affirmatively satisfied.
pr=savePrompt(26);accept(26,pr,{stageData:stageData(26),records:{processAudits:[proposal('process-audit',requiredAgentFields('processAudits',{APPROVED_INPUTS_VS_ACTUAL:'MATCH',APPROVED_INSTRUCTION_VS_ACTUAL:'MATCH',APPROVED_TOOLS_VS_ACTUAL:'MATCH',REQUIRED_TESTS_VS_EXECUTED:'COMPLETE',UNAUTHORIZED_MODIFICATION:'NONE',AUTHORIZED_CHANGES:'RECORDED',CHAIN_OF_CUSTODY:'COMPLETE',PROCESS_DEFECTS:'NONE',BLOCKERS:'NONE',PROCESS_DETERMINATION:'SATISFIED',PROCESS_EVIDENCE:'Canonical prompts, receipts, manifests, runs, tests and product lineage reconcile.'}))],productAudits:[proposal('product-audit',requiredAgentFields('productAudits',{VALIDATOR_RESULTS:'ALL SATISFIED',MEANING_VERIFICATION_RESULTS:'ALL SATISFIED',PRODUCT_DEFECTS:'NONE',BLOCKERS:'NONE',PRODUCT_DETERMINATION:'SATISFIED',PRODUCT_EVIDENCE:'Current deterministic, meaning, adversarial and representation records reconcile to the product.'}))]}});engine.recalculate(p);assertComplete(26);

// Stage 27: independent release-gate review followed by one idempotent application determination.
pr=savePrompt(27);accept(27,pr,{stageData:stageData(27),records:{releaseGateReviews:[proposal('release-review',requiredAgentFields('releaseGateReviews',{OBSERVED_BLOCKERS:'NONE',OBSERVED_VIOLATIONS:'NONE',OBSERVED_MISSING_EVIDENCE:'NONE',CONTROLLING_RULE_ANALYSIS:'All current mandatory release evidence is affirmatively satisfied.',EVIDENCE:'Current canonical release evidence set.'}),{PRODUCT_ID:refId(productId),BASELINE_ID:refId(p.job.CURRENT_BASELINE_ID)})]}});const release1=engine.recordReleaseDetermination(p),release2=engine.recordReleaseDetermination(p);assert(engine.recordId(release1,'releaseRecords')===engine.recordId(release2,'releaseRecords'),'Stage 27 release evaluation is not idempotent for unchanged evidence.');engine.recalculate(p);assertComplete(27);assert(engine.recordValue(release1,'DETERMINATION')==='ACCEPTED','Stage 27 did not application-derive ACCEPTED from satisfied current evidence.');

// Stage 28: exact audited/delivery bytes join by canonical identity, not array position.
const audited=[{artifactId:'ARTIFACT-PRODUCT-A',name:'result-a.json',version:'PRODUCT-v001',storageReference:'indexeddb:ARTIFACT-PRODUCT-A',size:productBytesA.byteLength,sha256:productShaA},{artifactId:'ARTIFACT-PRODUCT-B',name:'result-b.json',version:'PRODUCT-v001',storageReference:'indexeddb:ARTIFACT-PRODUCT-B',size:productBytesB.byteLength,sha256:productShaB}];
const delivery=[{artifactId:'ARTIFACT-PRODUCT-B',name:'result-b.json',version:'PRODUCT-v001',storageReference:'delivery:result-b.json',size:productBytesB.byteLength,sha256:productShaB},{artifactId:'ARTIFACT-PRODUCT-A',name:'result-a.json',version:'PRODUCT-v001',storageReference:'delivery:result-a.json',size:productBytesA.byteLength,sha256:productShaA}];
const identities=engine.verifyArtifactIdentity(p,audited,delivery);engine.recalculate(p);assertComplete(28);assert(identities.length===2&&identities.every(x=>engine.recordValue(x,'AUTHORIZATION')==='AUTHORIZED'),'Stage 28 failed exact order-independent artifact identity.');

// Stage 29: application constructs complete evidence graphs; no agent-authored routine relationship is needed.
const chains=engine.constructEvidenceChains(p);engine.recalculate(p);assertComplete(29);assert(chains.length===1&&chains.every(x=>engine.recordValue(x,'STATUS')==='COMPLETE'),'Stage 29 did not construct a complete evidence chain for every mandatory requirement.');

// Stage 30: append-only defect/regression history remains unchanged while final permanence is reverified.
const defectHistoryBefore=JSON.stringify(p.projectData.defects),regressionHistoryBefore=JSON.stringify(p.projectData.regressions);pr=savePrompt(30);accept(30,pr,{stageData:stageData(30),records:{}},'STAGE-30-PERMANENCE');engine.recalculate(p);assertComplete(30);assert(JSON.stringify(p.projectData.defects)===defectHistoryBefore,'Stage 30 rewrote append-only defect history.');assert(JSON.stringify(p.projectData.regressions)===regressionHistoryBefore,'Stage 30 rewrote append-only regression history.');

// Reload/recalculation must preserve the entire completed canonical lifecycle.
const reloaded=JSON.parse(JSON.stringify(p));engine.ensureShape(reloaded);engine.recalculate(reloaded);for(let stage=1;stage<=30;stage++)assert(engine.gate(stage,reloaded).complete,`Reloaded project lost Stage ${stage}: ${engine.gate(stage,reloaded).reasons.join('; ')}`);assert(reloaded.stages[30].status==='COMPLETE','Reloaded full-cycle project is not COMPLETE.');

// Late-stage false-positive regression checks.
{const q=engine.clone(p);q.projectData.products[0].fields.GENERATED_ARTIFACT_INVENTORY=['MISSING-ARTIFACT'];q.projectData.products[0].GENERATED_ARTIFACT_INVENTORY=['MISSING-ARTIFACT'];assert(!engine.gate(21,q).complete,'Stage 21 accepted an unresolved product artifact inventory.');}
{const q=engine.clone(p),r=engine.clone(q.projectData.deterministicResults.at(-1));r.id='RESULT-DUPLICATE';r.RESULT_ID='RESULT-DUPLICATE';r.fields.RESULT_ID='RESULT-DUPLICATE';q.projectData.deterministicResults.push(r);assert(!engine.gate(22,q).complete,'Stage 22 accepted duplicate deterministic results.');}
{const q=engine.clone(p);q.projectData.meaningResults=[];assert(!engine.gate(23,q).complete,'Stage 23 accepted incomplete meaning coverage.');}
{const q=engine.clone(p);q.projectData.regressionExecutions.at(-1).fields.RESULT='VIOLATED';q.projectData.regressionExecutions.at(-1).RESULT='VIOLATED';assert(!engine.gate(24,q).complete,'Stage 24 ignored a failed active historical regression.');}
{const q=engine.clone(p);q.projectData.representationInspections.pop();assert(!engine.gate(25,q).complete,'Stage 25 accepted an uninspected product artifact.');}
{const q=engine.clone(p);q.projectData.processAudits.push(engine.clone(q.projectData.processAudits[0]));assert(!engine.gate(26,q).complete,'Stage 26 accepted duplicate current process audits.');}

const result={continuousLifecycle:'STAGES_01_TO_30',stagesCompleted:30,artifactRoundTripReady:true,releaseByteIdentity:true,reloadIntegrity:true,currentStage:p.job.CURRENT_STAGE,revision:p.revision||0,acceptedDataChanges:p.projectData.acceptedChanges.length,rawResponses:p.projectData.rawResponses.length,stage8EvidenceRelationship:true,stage11InitialBoundary:true,verificationTriples:engine.verificationMatrix(p,iterationId).expected.length,correctedVerificationTriples:iteration17Evaluation.matrix.expected.length,confirmedDefect:defectId,permanentRegression:regId,correctedIteration:iteration17,correctedCandidate:candidate17};
console.log(JSON.stringify(result,null,2));
