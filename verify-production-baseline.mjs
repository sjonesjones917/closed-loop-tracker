import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine;
const assert=(value,message)=>{if(!value)throw new Error(message);};
const record=(collection,stage,fields={},id)=>{const def=schema.RECORD_SCHEMAS[collection],recordId=id||`${def.prefix}-TEST`;return {id:recordId,stage,active:true,fields:{...fields,[def.idField]:recordId},...fields,[def.idField]:recordId};};
function fixture(jobId){
  const p=core.createBlankState(jobId);p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);engine.recalculate(p);
  const sha='a'.repeat(64),artifact=record('artifacts',17,{FILENAME:'confirmed.bin',TYPE:'application/octet-stream',BYTE_SIZE:10,SHA256:sha,STORAGE_REFERENCE:'indexeddb:ARTIFACT-CONFIRMED',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'ARTIFACT-CONFIRMED');p.projectData.artifacts.push(artifact);
  const candidate=record('candidateFreezes',17,{ITERATION_ID:'ITERATION-CORRECTED',COMPONENT_MANIFEST:[{artifactId:'ARTIFACT-CONFIRMED',filename:'confirmed.bin',byteSize:10,sha256:sha,storageReference:'indexeddb:ARTIFACT-CONFIRMED'}],COMPONENT_HASHES:{'ARTIFACT-CONFIRMED':sha},STATUS:'FROZEN'},'CANDIDATE-CONFIRMED');p.projectData.candidateFreezes.push(candidate);
  const iteration=record('iterations',19,{CANDIDATE_ID:'CANDIDATE-CONFIRMED',PURPOSE:'UNCHANGED_CONFIRMATION',STATUS:'FROZEN'},'ITERATION-CONFIRM');p.projectData.iterations.push(iteration);p.job.CURRENT_ITERATION='ITERATION-CONFIRM';
  const scope={...engine.currentScope(p),iterationId:'ITERATION-CONFIRM',candidateId:'CANDIDATE-CONFIRMED'};candidate.scope={...scope,iterationId:'ITERATION-CORRECTED'};iteration.scope=scope;artifact.scope=scope;
  const confirmation=record('confirmationRecords',19,{SOURCE_ITERATION_ID:'ITERATION-CORRECTED',CONFIRMATION_ITERATION_ID:'ITERATION-CONFIRM',ZERO_MATERIAL_CHANGES:'TRUE',VERSION_HASH_COMPARISON:'MATCH',TEN_NEW_CONTEXTS:'TRUE',COMPLETE_TEST_RESULTS:'TRUE',REGRESSION_RESULTS:'TRUE',COMPARISON_RESULTS:'TRUE',NEW_DEFECTS:'NONE',NEW_REQUIREMENTS:'NONE',NEW_FAILURE_CASES:'NONE',NEW_VARIANCE:'NONE',DETERMINATION:'SATISFIED',EVIDENCE:'Fixture evidence'},'CONFIRM-BASELINE');confirmation.scope=scope;p.projectData.confirmationRecords.push(confirmation);
  return p;
}

assert(schema.RECORD_SCHEMAS.baselines.fieldDefinitions.BASELINE_AUTHORIZATION_DECISION_ID?.producer==='APPLICATION','Baseline authorization provenance must be application-owned.');
assert(schema.RECORD_SCHEMAS.baselines.relationships.BASELINE_AUTHORIZATION_DECISION_ID==='humanDecisions','Baseline authorization must resolve to humanDecisions.');
assert(schema.RECORD_SCHEMAS.baselines.fieldDefinitions.HUMAN_AUTHORIZATION?.producer==='APPLICATION','Baseline authorization summary must be application-derived, not directly human-written in the baseline record.');

{
  const p=fixture('JOB-BASELINE-MISSING-AUTH');let rejected=false;
  try{engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],operatorLabel:'BASELINE-VERIFY'});}catch(error){rejected=/BASELINE_AUTHORIZATION human decision/i.test(String(error.message));}
  assert(rejected,'FREEZE_BASELINE accepted without the required registered BASELINE_AUTHORIZATION human decision.');
  assert(engine.records(p,'baselines').length===0,'Rejected baseline freeze partially mutated the canonical baseline collection.');
}
{
  const p=fixture('JOB-BASELINE-WRONG-TARGET');const decision=engine.recordRegisteredHumanDecision(p,{stage:20,purpose:'BASELINE_AUTHORIZATION',targetFamily:'candidateFreezes',targetId:'CANDIDATE-WRONG',value:'AUTHORIZED',operatorLabel:'BASELINE-VERIFY'});let rejected=false;
  try{engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],authorizationDecisionId:engine.recordId(decision,'humanDecisions'),operatorLabel:'BASELINE-VERIFY'});}catch(error){rejected=/exact unchanged-confirmed frozen candidate/i.test(String(error.message));}
  assert(rejected,'FREEZE_BASELINE accepted authorization for a different candidate.');
  assert(engine.records(p,'baselines').length===0,'Wrong-target baseline authorization partially mutated canonical baseline state.');
}
{
  const p=fixture('JOB-BASELINE-VALID');const decision=engine.recordRegisteredHumanDecision(p,{stage:20,purpose:'BASELINE_AUTHORIZATION',targetFamily:'candidateFreezes',targetId:'CANDIDATE-CONFIRMED',value:'AUTHORIZED',operatorLabel:'BASELINE-VERIFY'}),decisionId=engine.recordId(decision,'humanDecisions');
  const baseline=engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],authorizationDecisionId:decisionId,operatorLabel:'BASELINE-VERIFY'});
  assert(engine.recordValue(baseline,'BASELINE_AUTHORIZATION_DECISION_ID')===decisionId,'Frozen baseline lost its exact human-decision provenance.');
  assert(engine.recordValue(baseline,'HUMAN_AUTHORIZATION')==='AUTHORIZED','Application did not derive the baseline authorization summary from the accepted decision.');
  assert(engine.recordValue(baseline,'APPROVED_VERSIONS').candidateId==='CANDIDATE-CONFIRMED','Frozen baseline lost exact candidate identity.');
  assert(JSON.stringify(engine.recordValue(baseline,'IMMUTABLE_ARTIFACT_RECORDS'))===JSON.stringify(['ARTIFACT-CONFIRMED']),'Frozen baseline changed the exact candidate artifact set.');
  decision.active=false;let staleRejected=false;try{engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],authorizationDecisionId:decisionId,operatorLabel:'BASELINE-VERIFY'});}catch(error){staleRejected=/does not exist in the current Stage 20 authority set/i.test(String(error.message));}
  assert(staleRejected,'An inactive baseline authorization decision remained usable for another baseline freeze.');
}

const app=fs.readFileSync('app-core.js','utf8');
assert(app.includes("purpose:'BASELINE_AUTHORIZATION'")&&app.includes('authorizationDecisionId:engine.recordId(decision'), 'Visible baseline action does not create and consume the registered human authorization decision.');
console.log(JSON.stringify({controllerStage:'23',applicationStage:20,productionBaseline:'PASS',missingAuthorizationRejected:true,wrongTargetRejected:true,exactCandidateBound:true,exactArtifactSetBound:true,humanDecisionProvenanceBound:true,inactiveAuthorizationReopens:true,noPartialBaselineMutation:true,visibleOperatorPathWired:true}));
