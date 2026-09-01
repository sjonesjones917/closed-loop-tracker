import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,hash=globalThis.closedLoopHash,schema=globalThis.closedLoopWorkflowSchema;
const scopeBase={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TESTS-v001',instructionVersion:'INSTRUCTION-v001'};
function project(name){const value=core.createBlankState(name);Object.assign(value.job,{CURRENT_INPUT_VERSION:scopeBase.inputVersion,CURRENT_SOURCE_SET_VERSION:scopeBase.sourceSetVersion,CURRENT_REQUIREMENTS_VERSION:scopeBase.requirementsVersion,CURRENT_TEST_SUITE_VERSION:scopeBase.testSuiteVersion,CURRENT_INSTRUCTION_VERSION:scopeBase.instructionVersion,CURRENT_ITERATION:'ITERATION-1'});engine.ensureShape(value);record(value,'iterations','ITERATION-1',10,{ITERATION_ID:'ITERATION-1',CANDIDATE_ID:'CANDIDATE-1',STATUS:'FROZEN'},{...scopeBase,iterationId:'ITERATION-1',candidateId:'CANDIDATE-1'},'APPLICATION_DERIVED');return value;}
function record(value,collection,id,stage,fields,scope,source='APPLICATION_RESERVATION') {const row={id,stage,active:true,scope:{...scope},fields:{...fields},...fields,source};row.contentSha256=hash.contentRecordSha256(row,schema.RECORD_SCHEMAS[collection].idField);row.recordSha256=hash.recordSha256(row);row.sha256=row.recordSha256;value.projectData[collection].push(row);return row;}
function addRun(value,index,{external=`PROVIDER-CONTEXT-${index}`,contextId=`CONTEXT-${index}`}={}){const runId=`RUN-${index}`,scope={...scopeBase,iterationId:'ITERATION-1',candidateId:'CANDIDATE-1',runId,contextId};record(value,'freshContexts',contextId,11,{CONTEXT_ID:contextId,EXTERNAL_CONTEXT_IDENTIFIER:external,ROLE:'Independent production execution agent',ITERATION_ID:'ITERATION-1',RUN_ID:runId,AUTHORIZED_PROJECT_INPUTS:'INPUT-v001',AUTHORIZED_EXTERNAL_SOURCE_MATERIAL:'SOURCE-v001',FROZEN_ARTIFACT_VERSIONS:'CANDIDATE-1',TOOL_AVAILABILITY:'DECLARED',CONTAMINATION_STATUS:'NONE',OUTPUT_IDENTITY:`OUTPUT-${index}`,DEVIATIONS:'NONE',EVIDENCE:'Application reservation.',USABILITY_DETERMINATION:'USABLE'},scope);record(value,'runs',runId,11,{RUN_ID:runId,ITERATION_ID:'ITERATION-1',CANDIDATE_ID:'CANDIDATE-1',CONTEXT_ID:contextId,FRESH_CONTEXT_RECORD:contextId,CONTAMINATION_CHECK:'NONE',TOOL_CONFIGURATION:'CURRENT',EXECUTION_STATUS:'COMPLETED',COMPLETE_OUTPUT:`OUTPUT-${index}`},scope);return{runId,contextId};}
function bindAcceptedWork(value,{stage,operation='COMPLETE',contextId,runId='',suffix=`${stage}-${contextId}`}={}){const promptId=`PROMPT-${suffix}`,rawResponseId=`RAW-${suffix}`,proposalId=`PROPOSAL-${suffix}`,scope={...scopeBase,iterationId:'ITERATION-1',candidateId:'CANDIDATE-1',...(runId?{runId}:{}),contextId},contextManifest={stage,operation,scope,readCollections:{runs:runId?[{id:runId,scope}]:[],freshContexts:[{id:contextId,scope}]},verificationBatchPlan:null,operatorCorrectionRequests:[],acceptedResultRefinements:[],latestValidationFailure:null};value.projectData.generatedPrompts.push({instructionId:promptId,promptId,stage,operation,scope,bodySha256:'a'.repeat(64),contractSha256:'b'.repeat(64),contextSignature:hash.sha256Value(contextManifest),contextManifest});value.projectData.rawResponses.push({rawResponseId,stage,promptId,status:'ACCEPTED_DATA_CHANGE'});value.projectData.responseProposals.push({proposalId,rawResponseId,promptId,stage,status:'ACCEPTED',envelope:{operation,scope}});value.projectData.outputReceipts.push({receiptId:`RECEIPT-${suffix}`,rawResponseId,stage,canonicalStateChanged:true});value.projectData.acceptedChanges.push({changeId:`CHANGE-${suffix}`,rawResponseId,proposalId,promptId,stage,responseType:'DATA_PROPOSAL',status:'COMMITTED',operation,scope,eventSequence:value.projectData.acceptedChanges.length+1});return{promptId,rawResponseId,proposalId,scope};}
function batch(value,{bind=false,duplicateExternal=false}={}){const slots=[];for(let index=1;index<=10;index++){const slot=addRun(value,index,{external:duplicateExternal&&index===10?'PROVIDER-CONTEXT-1':`PROVIDER-CONTEXT-${index}`});slots.push(slot);if(bind)bindAcceptedWork(value,{stage:11,contextId:slot.contextId,runId:slot.runId,suffix:`RUN-${index}`});}return slots;}

// 269, 270 and 274: local identifiers prove only local session distinctness; hidden provider state stays unknown without stronger evidence.
{
  const value=project('INDEPENDENCE-IDS-ONLY');batch(value);const status=engine.evaluateContextIndependence(value,{role:'RUN_BATCH',iterationId:'ITERATION-1'});
  assert.equal(status.dimensionMap.APPLICATION_SESSION_DISTINCTNESS.determination,'APPLICATION_ESTABLISHED');
  assert.equal(status.dimensionMap.APPLICATION_INPUT_ISOLATION.determination,'VIOLATED');
  assert.equal(status.dimensionMap.PROVIDER_CONTEXT_INDEPENDENCE.determination,'UNKNOWN');
  assert.notEqual(status.determination,'APPLICATION_ESTABLISHED','Distinct local/context identifiers falsely established the complete independence contract.');
  assert.equal(engine.operationalMetrics(value).zeroFailure95PercentUpperBound,null,'Distinct identifiers alone enabled rule-of-three reporting.');
}

// 272, 273 and 276: exact application isolation can be established while provider independence remains only externally supported and bounded.
{
  const value=project('INDEPENDENCE-BOUND-BATCH');batch(value,{bind:true});const status=engine.evaluateContextIndependence(value,{role:'RUN_BATCH',iterationId:'ITERATION-1'});
  assert.equal(status.dimensionMap.APPLICATION_INPUT_ISOLATION.determination,'APPLICATION_ESTABLISHED');
  assert.equal(status.dimensionMap.USER_TRANSFER_CONFORMITY.determination,'EXTERNALLY_SUPPORTED');
  assert.equal(status.dimensionMap.PROVIDER_CONTEXT_INDEPENDENCE.determination,'EXTERNALLY_SUPPORTED');
  assert.notEqual(status.dimensionMap.PROVIDER_CONTEXT_INDEPENDENCE.determination,'APPLICATION_ESTABLISHED');
  assert.match(status.dimensionMap.PROVIDER_CONTEXT_INDEPENDENCE.reasons.join(' '),/hidden provider memory.*unobservable/i);
  assert.equal(engine.operationalMetrics(value).zeroFailure95PercentUpperBound,null,'The controlling engine must suppress rule-of-three reporting until every Section 63.6 prerequisite is proven.');
}

// 271: observed external context reuse is an affirmative violation.
{
  const value=project('INDEPENDENCE-REUSE');batch(value,{bind:true,duplicateExternal:true});const status=engine.evaluateContextIndependence(value,{role:'RUN_BATCH',iterationId:'ITERATION-1'});
  assert.equal(status.dimensionMap.EXTERNAL_CONTEXT_IDENTIFIER_DISTINCTNESS.determination,'VIOLATED');
  assert.equal(status.determination,'VIOLATED');
}

// 269-272: one run-bound review establishes application isolation separately; a bare pair of IDs cannot.
{
  const value=project('INDEPENDENCE-REVIEW'),slots=batch(value,{bind:true}),target=slots[0],reviewerContextId='REVIEW-CONTEXT-1',reviewScope={...scopeBase,iterationId:'ITERATION-1',candidateId:'CANDIDATE-1',runId:target.runId,contextId:reviewerContextId};record(value,'freshContexts',reviewerContextId,12,{CONTEXT_ID:reviewerContextId,EXTERNAL_CONTEXT_IDENTIFIER:'PROVIDER-REVIEW-1',ROLE:'Independent run verifier',ITERATION_ID:'ITERATION-1',RUN_ID:target.runId,AUTHORIZED_PROJECT_INPUTS:'INPUT-v001',AUTHORIZED_EXTERNAL_SOURCE_MATERIAL:'SOURCE-v001',FROZEN_ARTIFACT_VERSIONS:'CANDIDATE-1',TOOL_AVAILABILITY:'DECLARED',CONTAMINATION_STATUS:'NONE',OUTPUT_IDENTITY:'REVIEW-OUTPUT-1',DEVIATIONS:'NONE',EVIDENCE:'Application reviewer reservation.',USABILITY_DETERMINATION:'USABLE'},reviewScope,'HUMAN_REVIEWER_CONTEXT');
  let status=engine.evaluateContextIndependence(value,{role:'VERIFICATION',iterationId:'ITERATION-1',runId:target.runId,verifierContextId:reviewerContextId});assert.equal(status.dimensionMap.APPLICATION_SESSION_DISTINCTNESS.determination,'APPLICATION_ESTABLISHED');assert.equal(status.dimensionMap.APPLICATION_INPUT_ISOLATION.determination,'VIOLATED');assert.equal(status.dimensionMap.PROVIDER_CONTEXT_INDEPENDENCE.determination,'UNKNOWN');
  bindAcceptedWork(value,{stage:12,contextId:reviewerContextId,runId:target.runId,suffix:'VERIFY-1'});status=engine.evaluateContextIndependence(value,{role:'VERIFICATION',iterationId:'ITERATION-1',runId:target.runId,verifierContextId:reviewerContextId});assert.equal(status.dimensionMap.APPLICATION_INPUT_ISOLATION.determination,'APPLICATION_ESTABLISHED');assert.equal(status.dimensionMap.EXECUTOR_OR_REVIEWER_ROLE_SEPARATION.determination,'APPLICATION_ESTABLISHED');assert.equal(status.dimensionMap.PROVIDER_CONTEXT_INDEPENDENCE.determination,'EXTERNALLY_SUPPORTED');
  const applicationOnly=engine.evaluateContextIndependence(value,{role:'VERIFICATION',iterationId:'ITERATION-1',runId:target.runId,verifierContextId:reviewerContextId,requiredDimensions:['PROVIDER_CONTEXT_INDEPENDENCE'],allowedDimensionDeterminations:{PROVIDER_CONTEXT_INDEPENDENCE:['APPLICATION_ESTABLISHED']}});assert.equal(applicationOnly.determination,'UNKNOWN','A proof obligation requiring application-established provider separation accepted weaker external support.');
}

// 277-278: equal identifiers or bytes cannot establish a material environment dimension.
{
  const value=project('INDEPENDENCE-ENVIRONMENT');batch(value,{bind:true});const status=engine.evaluateContextIndependence(value,{role:'RUN_BATCH',iterationId:'ITERATION-1',requiredDimensions:['ENVIRONMENT_INDEPENDENCE']});assert.equal(status.dimensionMap.ENVIRONMENT_INDEPENDENCE.determination,'UNKNOWN');assert.equal(status.determination,'UNKNOWN');assert.match(status.dimensionMap.ENVIRONMENT_INDEPENDENCE.reasons.join(' '),/environment manifest|environment-separation/i);
}

const ui=fs.readFileSync('app-core.js','utf8');assert.match(ui,/Application-controlled input isolation is distinct from hidden provider-context independence/);assert.match(ui,/Distinct context identifiers alone never prove/);assert.match(ui,/do not by themselves prove hidden provider independence, stochastic exploration, or general reliability/);
console.log(JSON.stringify({independenceDimensions:true,applicationIsolationSeparate:true,providerStateNotElevated:true,reuseDetected:true,proofPolicyControlsBasis:true,ruleOfThreeSuppressed:true,environmentUnknownFailsClosed:true}));
