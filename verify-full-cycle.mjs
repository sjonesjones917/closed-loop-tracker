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
function requiredAgentFields(collection,overrides={}){
  const def=schema.RECORD_SCHEMAS[collection],fields={};
  for(const name of def.required)if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=typedValue(def.fieldDefinitions[name],name);
  return {...fields,...overrides};
}
function stageData(stage,overrides={}){
  const data={};
  for(const name of schema.STAGE_CONTRACTS[stage].allowedStageData){const def=schema.STAGE_FIELDS[stage][name];if(def.producer===schema.PRODUCER.AGENT)data[name]=typedValue(def,name);}
  return {...data,...overrides};
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
  const slot=slots[i];pr=savePrompt(11,{scope:{runId:slot.runId,contextId:slot.contextId,iterationId,candidateId}});
  accept(11,pr,{stageData:stageData(11),records:{runs:[targetUpdate(slot.runId,{FRESH_CONTEXT_RECORD:slot.contextId,STARTED_AT:`2026-08-25T20:${String(i).padStart(2,'0')}:00Z`,ENDED_AT:`2026-08-25T20:${String(i).padStart(2,'0')}:30Z`,CONTAMINATION_CHECK:'NONE',TOOL_CONFIGURATION:'CONTROLLED',EXECUTION_STATUS:'COMPLETE',COMPLETE_OUTPUT:`run-${i}-output`,OUTPUT_ARTIFACT_IDENTITIES:['ARTIFACT-CANDIDATE'],TOOL_FAILURES:'NONE',NOTES:'Controlled independent run.'})]}} ,`STAGE-11-RUN-${i+1}`);
}
engine.recalculate(p);assertComplete(11);

// Stage 12: exact REQ × RUN × TEST triples, one independent evidenced result per triple.
const currentRuns=engine.recordsForCurrentScope(p,'runs',{iterationId});
for(let i=0;i<currentRuns.length;i++){
  const runId=engine.recordId(currentRuns[i],'runs');pr=savePrompt(12,{scope:{iterationId,candidateId,runId}});
  accept(12,pr,{stageData:stageData(12),records:{verification:[proposal(`verification-${i}`,requiredAgentFields('verification',{VERIFIER:`INDEPENDENT_VERIFIER_${i}`,VERIFIER_CONTEXT_ID:`VERIFY-CONTEXT-${i}`,INDEPENDENCE_STATUS:'INDEPENDENT',INPUTS:`${reqId}|${runId}|${testId}`,PROCEDURE:'Execute the exact deterministic test against the run output.',EXPECTED_RESULT:'SATISFIED',OBSERVED_RESULT:'SATISFIED',EXACT_EVIDENCE:`Evidence for ${runId}`,DETERMINATION:'SATISFIED',UNDETERMINED_REASON:''}),{REQ_ID:refId(reqId),RUN_ID:refId(runId),TEST_ID:refId(testId)})]}} ,`STAGE-12-TRIPLE-${i+1}`);
}
engine.recalculate(p);assertComplete(12);

const result={continuousLifecycle:'STAGES_01_TO_12',stagesCompleted:12,currentStage:p.job.CURRENT_STAGE,revision:p.revision||0,acceptedDataChanges:p.projectData.acceptedChanges.length,rawResponses:p.projectData.rawResponses.length,stage8EvidenceRelationship:true,stage11InitialBoundary:true,verificationTriples:engine.verificationMatrix(p,iterationId).expected.length};
console.log(JSON.stringify(result,null,2));
