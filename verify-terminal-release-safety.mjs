import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,hash=globalThis.closedLoopHash,schema=globalThis.closedLoopWorkflowSchema;
function record(project,collection,id,stage,fields,scope=engine.currentScope(project),extra={}){
  const definition=schema.RECORD_SCHEMAS[collection],all={...fields,[definition.idField]:id},item={id,stage,active:true,createdAt:extra.createdAt||'2026-01-01T00:00:00.000Z',updatedAt:extra.createdAt||'2026-01-01T00:00:00.000Z',scope:{...scope},fields:all,...all,...extra};
  engine.refreshRecordHashes(item,collection);project.projectData[collection].push(item);return item;
}

const identityProject=core.createBlankState('TERMINAL-IDENTITY');engine.ensureShape(identityProject);
const productScope={...engine.currentScope(identityProject),productId:'PRODUCT-1'};
record(identityProject,'products','PRODUCT-1',21,{PRODUCT_VERSION:'PRODUCT-v001',BASELINE_ID:'BASELINE-1',EXECUTION_ID:'EXECUTION-1',PRODUCTION_CONTEXT_ID:'CONTEXT-1',INSTRUCTION_VERSION:identityProject.job.CURRENT_INSTRUCTION_VERSION,GENERATED_ARTIFACT_INVENTORY:['ARTIFACT-A','ARTIFACT-B'],STATUS:'COMPLETED'},productScope,{completionState:'COMPLETED',source:'APPLICATION_RESERVED'});
const artifactA=record(identityProject,'artifacts','ARTIFACT-A',21,{FILENAME:'a.bin',TYPE:'application/octet-stream',VERSION:'1',BYTE_SIZE:1,SHA256:'a'.repeat(64),ROLE:'PRODUCT_OUTPUT',STORAGE_REFERENCE:'indexeddb:ARTIFACT-A',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED',NOTES:''},productScope,{source:'APPLICATION_BYTES_VERIFIED'});
const artifactB=record(identityProject,'artifacts','ARTIFACT-B',21,{FILENAME:'b.bin',TYPE:'application/octet-stream',VERSION:'1',BYTE_SIZE:2,SHA256:'b'.repeat(64),ROLE:'PRODUCT_OUTPUT',STORAGE_REFERENCE:'indexeddb:ARTIFACT-B',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED',NOTES:''},productScope,{source:'APPLICATION_BYTES_VERIFIED'});
function identity(id,artifact){return record(identityProject,'artifactIdentities',id,28,{ARTIFACT_ID:engine.recordId(artifact,'artifacts'),AUDITED_FILENAME:engine.recordValue(artifact,'FILENAME'),AUDITED_VERSION:'1',AUDITED_STORAGE_REFERENCE:'indexeddb',AUDITED_BYTE_SIZE:engine.recordValue(artifact,'BYTE_SIZE'),AUDITED_SHA256:engine.recordValue(artifact,'SHA256'),RELEASE_FILENAME:engine.recordValue(artifact,'FILENAME'),RELEASE_VERSION:'1',RELEASE_STORAGE_REFERENCE:'delivery',RELEASE_BYTE_SIZE:engine.recordValue(artifact,'BYTE_SIZE'),PRE_DELIVERY_SHA256:engine.recordValue(artifact,'SHA256'),EXACT_HASH_MATCH:true,EXACT_SIZE_MATCH:true,POST_AUDIT_MODIFICATION_EVIDENCE:'NONE',AUTHORIZATION:'AUTHORIZED'},productScope,{source:'APPLICATION_DERIVATION'});}
identity('IDENTITY-A',artifactA);
assert.equal(engine.artifactIdentityComplete(identityProject),false,'A partial identity batch satisfied Stage 28 while one required product artifact was omitted.');
const identityB=identity('IDENTITY-B',artifactB);
assert.equal(engine.artifactIdentityComplete(identityProject),true,'The exact current product artifact set with matching canonical filenames was rejected.');
identityB.fields.RELEASE_FILENAME=identityB.RELEASE_FILENAME='renamed.bin';engine.refreshRecordHashes(identityB,'artifactIdentities');
assert.equal(engine.artifactIdentityComplete(identityProject),false,'A delivery filename not established by the canonical artifact identity satisfied Stage 28.');
identityB.fields.RELEASE_FILENAME=identityB.RELEASE_FILENAME='b.bin';engine.refreshRecordHashes(identityB,'artifactIdentities');
assert.equal(engine.artifactIdentityComplete(identityProject),true,'Repairing the exact delivery filename did not restore Stage 28 identity closure.');

const registryProject=core.createBlankState('TERMINAL-REGISTRY');engine.ensureShape(registryProject);const registryScope=engine.currentScope(registryProject);
record(registryProject,'defects','DEFECT-1',14,{OBSERVED_FAILURE:'Original failure',EXPECTED_CONDITION:'Expected success',SEVERITY:'CRITICAL',STATUS:'CONFIRMED'},registryScope);
const regression=record(registryProject,'regressions','REG-1',15,{DEFECT_ID:'DEFECT-1',REQ_ID:'REQ-1',FAILURE_FIXTURE:'fixture',REPRODUCTION_PROCEDURE:'reproduce',DETECTION_METHOD:'detector',FIXTURE_IDENTITY_HASH:'c'.repeat(64),PRE_CORRECTION_RESULT:'VIOLATED',PRE_CORRECTION_EVIDENCE:'EVIDENCE-PRE',CORRECTION:'corrected',POST_CORRECTION_RESULT:'SATISFIED',POST_CORRECTION_EVIDENCE:'EVIDENCE-POST',PERMANENT_TEST_LOCATION:'verify-terminal-release-safety.mjs',APPLICABILITY:'APPLICABLE',ACTIVE_RETIRED_STATE:'ACTIVE',RETIREMENT_AUTHORITY:''},registryScope);
record(registryProject,'baselines','BASELINE-1',20,{STATUS:'FROZEN'},registryScope,{createdAt:'2026-01-03T00:00:00.000Z'});
assert.equal(engine.registryIntegrity(registryProject).complete,false,'An active regression with no executions satisfied Stage 30 registry integrity.');
for(const [id,kind] of [['EVIDENCE-PRE','pre'],['EVIDENCE-POST','post']])record(registryProject,'evidenceRecords',id,15,{KIND:'REGRESSION_EXECUTION',DESCRIPTION:`${kind} correction execution`,AUTHORITY_TYPE:'APPLICATION',SOURCE_ID:'',LOCATION:'native regression runner',CONTENT:`${kind} result`,ATTACHMENT_ID:'',SHA256:'d'.repeat(64),STATUS:'CURRENT'},registryScope);
const preExecution=record(registryProject,'regressionExecutions','REG-EXEC-PRE',15,{REG_ID:'REG-1',ITERATION_ID:'ITERATION-1',CANDIDATE_ID:'CANDIDATE-1',PRODUCT_ID:'',PHASE:'PRE_CORRECTION',RESULT:'VIOLATED',EVIDENCE_ID:'EVIDENCE-PRE',EXECUTED_AT:'2026-01-01T00:00:00.000Z'},registryScope,{createdAt:'2026-01-01T00:00:00.000Z',evidenceRefs:['EVIDENCE-PRE']});
const postExecution=record(registryProject,'regressionExecutions','REG-EXEC-POST',15,{REG_ID:'REG-1',ITERATION_ID:'ITERATION-2',CANDIDATE_ID:'CANDIDATE-2',PRODUCT_ID:'',PHASE:'POST_CORRECTION',RESULT:'SATISFIED',EVIDENCE_ID:'EVIDENCE-POST',EXECUTED_AT:'2026-01-02T00:00:00.000Z'},registryScope,{createdAt:'2026-01-02T00:00:00.000Z',evidenceRefs:['EVIDENCE-POST']});
assert.equal(engine.registryIntegrity(registryProject).complete,true,'Distinct evidenced pre-correction failure and later success did not close registry integrity.');
postExecution.fields.PHASE=postExecution.PHASE='UNDECLARED_SUCCESS_PHASE';engine.refreshRecordHashes(postExecution,'regressionExecutions');
assert.equal(engine.registryIntegrity(registryProject).complete,false,'A success outside the explicit POST_CORRECTION phase satisfied regression closure.');
postExecution.fields.PHASE=postExecution.PHASE='POST_CORRECTION';postExecution.createdAt='2025-12-31T00:00:00.000Z';engine.refreshRecordHashes(postExecution,'regressionExecutions');
assert.equal(engine.registryIntegrity(registryProject).complete,false,'A post-correction success that occurred before the reproduced failure satisfied regression closure.');
postExecution.createdAt='2026-01-02T00:00:00.000Z';engine.refreshRecordHashes(postExecution,'regressionExecutions');
assert.equal(engine.registryIntegrity(registryProject).complete,true,'Repairing the distinct later post-correction execution did not restore registry integrity.');
record(registryProject,'evidenceRecords','EVIDENCE-CONFIRM-LATEST',15,{KIND:'REGRESSION_EXECUTION',DESCRIPTION:'later unchanged-confirmation regression execution',AUTHORITY_TYPE:'APPLICATION',SOURCE_ID:'',LOCATION:'native regression runner',CONTENT:'latest applicable regression failed',ATTACHMENT_ID:'',SHA256:'e'.repeat(64),STATUS:'CURRENT'},registryScope);
const confirmationExecution=record(registryProject,'regressionExecutions','REG-EXEC-CONFIRM',19,{REG_ID:'REG-1',ITERATION_ID:'ITERATION-3',CANDIDATE_ID:'CANDIDATE-2',PRODUCT_ID:'',PHASE:'UNCHANGED_CONFIRMATION',RESULT:'VIOLATED',EVIDENCE_ID:'EVIDENCE-CONFIRM-LATEST',EXECUTED_AT:'2026-01-02T12:00:00.000Z'},registryScope,{createdAt:'2026-01-02T12:00:00.000Z',evidenceRefs:['EVIDENCE-CONFIRM-LATEST']});
const laterFailure=engine.registryIntegrity(registryProject);assert.equal(laterFailure.complete,false,'A later applicable regression failure was ignored because an earlier post-correction execution passed.');assert(laterFailure.missingExecution.some(item=>item.regressionId==='REG-1'&&item.reason==='LATEST_APPLICABLE_REGRESSION_EXECUTION_NOT_SATISFIED_BEFORE_BASELINE'));
confirmationExecution.fields.RESULT=confirmationExecution.RESULT='SATISFIED';engine.refreshRecordHashes(confirmationExecution,'regressionExecutions');
assert.equal(engine.registryIntegrity(registryProject).complete,true,'Repairing the latest applicable regression execution did not restore registry integrity.');
preExecution.scope={...preExecution.scope,iterationId:'ITERATION-1'};postExecution.scope={...postExecution.scope,iterationId:'ITERATION-2'};confirmationExecution.scope={...confirmationExecution.scope,iterationId:'ITERATION-3'};registryProject.job.CURRENT_ITERATION='ITERATION-3';for(const execution of[preExecution,postExecution,confirmationExecution])engine.refreshRecordHashes(execution,'regressionExecutions');
assert.equal(engine.registryIntegrity(registryProject).complete,true,'Advancing current scope to unchanged confirmation erased the distinct active Stage 17 post-correction success from permanent registry closure.');
postExecution.active=false;postExecution.invalidatedBy='INVALIDATED-POST-CORRECTION';engine.refreshRecordHashes(postExecution,'regressionExecutions');const invalidatedPost=engine.registryIntegrity(registryProject);assert.equal(invalidatedPost.complete,false,'An invalidated historical post-correction execution satisfied permanent registry closure.');assert(invalidatedPost.missingExecution.some(item=>item.regressionId==='REG-1'&&item.reason==='DISTINCT_LATER_POST_CORRECTION_EXECUTION_NOT_PROVEN'));
postExecution.active=true;delete postExecution.invalidatedBy;engine.refreshRecordHashes(postExecution,'regressionExecutions');assert.equal(engine.registryIntegrity(registryProject).complete,true,'Restoring the active distinct historical post-correction execution did not restore permanent registry closure.');
regression.fields.ACTIVE_RETIRED_STATE=regression.ACTIVE_RETIRED_STATE='RETIRED';regression.fields.APPLICABILITY=regression.APPLICABILITY='NOT APPLICABLE';regression.fields.RETIREMENT_AUTHORITY=regression.RETIREMENT_AUTHORITY='SELF_ASSERTED';engine.refreshRecordHashes(regression,'regressions');
const retired=engine.registryIntegrity(registryProject);assert.equal(retired.complete,false,'An unsupported retirement removed a permanent regression from the Stage 30 gate.');assert(retired.invalidLifecycle.some(item=>item.regressionId==='REG-1'&&/RETIREMENT_NOT_ESTABLISHED/.test(item.reason)));

console.log(JSON.stringify({completeProductArtifactSetRequired:true,authorizedFilenameIdentityRequired:true,activeRegressionExecutionsRequired:true,explicitPostCorrectionPhaseRequired:true,distinctLaterExecutionRequired:true,historicalPostCorrectionSurvivesCurrentScopeAdvance:true,invalidatedPostCorrectionRejected:true,latestApplicableRegressionExecutionRequired:true,unsupportedRetirementRejected:true,registryRepairProven:true}));
