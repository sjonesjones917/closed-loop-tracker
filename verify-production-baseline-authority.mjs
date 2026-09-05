import fs from 'node:fs';
import vm from 'node:vm';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,assert=(v,m)=>{if(!v)throw new Error(m)};
const record=(collection,stage,fields={},id)=>{const def=schema.RECORD_SCHEMAS[collection],recordId=id||`${def.prefix}-TEST`;return {id:recordId,stage,active:true,fields:{...fields,[def.idField]:recordId},...fields,[def.idField]:recordId};};
function project(jobId){
  const p=core.createBlankState(jobId);p.job.JOB_ID=jobId;p.job.EXACT_USER_OBJECTIVE_VERBATIM='Authorize and freeze the production baseline from one real human decision.';p.job.CURRENT_INPUT_VERSION='INPUT-v001';p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';p.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';p.job.CURRENT_INSTRUCTION_VERSION='INSTRUCTION-v001';engine.ensureShape(p);
  const sha='cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
  const artifact=record('artifacts',17,{FILENAME:'confirmed.bin',TYPE:'application/octet-stream',BYTE_SIZE:10,SHA256:sha,STORAGE_REFERENCE:'indexeddb:ARTIFACT-CONFIRMED',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'ARTIFACT-CONFIRMED');
  p.projectData.artifacts.push(artifact);
  const candidate=record('candidateFreezes',17,{ITERATION_ID:'ITERATION-CORRECTED',COMPONENT_MANIFEST:[{artifactId:'ARTIFACT-CONFIRMED',filename:'confirmed.bin',byteSize:10,sha256:sha,storageReference:'indexeddb:ARTIFACT-CONFIRMED'}],COMPONENT_HASHES:{'ARTIFACT-CONFIRMED':sha},STATUS:'FROZEN'},'CANDIDATE-CONFIRMED');
  p.projectData.candidateFreezes.push(candidate);
  const iteration=record('iterations',19,{CANDIDATE_ID:'CANDIDATE-CONFIRMED',PURPOSE:'UNCHANGED_CONFIRMATION',STATUS:'FROZEN'},'ITERATION-CONFIRM');
  p.projectData.iterations.push(iteration);p.job.CURRENT_ITERATION='ITERATION-CONFIRM';
  const scope={...engine.currentScope(p),iterationId:'ITERATION-CONFIRM',candidateId:'CANDIDATE-CONFIRMED'};candidate.scope={...scope,iterationId:'ITERATION-CORRECTED'};iteration.scope=scope;artifact.scope=scope;
  const confirmation=record('confirmationRecords',19,{ITERATION_ID:'ITERATION-CONFIRM',CANDIDATE_ID:'CANDIDATE-CONFIRMED',DETERMINATION:'SATISFIED'},'CONFIRM-EXACT-CANDIDATE');confirmation.scope=scope;p.projectData.confirmationRecords.push(confirmation);
  return p;
}
function decision(p,overrides={}){return engine.recordRegisteredHumanDecision(p,{stage:20,purpose:'BASELINE_AUTHORIZATION',targetFamily:'candidateFreezes',targetId:'CANDIDATE-CONFIRMED',value:'AUTHORIZED',operatorLabel:'STAGE23_VERIFIER',...overrides});}

// Permanent regression: a baseline cannot exist without a current real human BASELINE_AUTHORIZATION decision.
{const p=project('JOB-STAGE23-MISSING-DECISION');const bb=p.projectData.baselines.length;let rejected=false;try{engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],operatorLabel:'STAGE23_VERIFIER'});}catch(e){rejected=/BASELINE_AUTHORIZATION human decision is required/i.test(String(e.message));}assert(rejected,'Freeze without a human authorization decision was accepted.');assert(p.projectData.baselines.length===bb,'Rejected freeze partially mutated baseline state.');}

// Permanent regression: a decision with the wrong purpose cannot authorize the baseline.
{const p=project('JOB-STAGE23-WRONG-PURPOSE');const wrongPurpose=engine.recordRegisteredHumanDecision(p,{stage:20,purpose:'DELIVERY_INTENT',targetFamily:'candidateFreezes',targetId:'CANDIDATE-CONFIRMED',value:'AUTHORIZED',operatorLabel:'STAGE23_VERIFIER'});const bb=p.projectData.baselines.length;let rejected=false;try{engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],authorizationDecisionId:engine.recordId(wrongPurpose,'humanDecisions'),operatorLabel:'STAGE23_VERIFIER'});}catch(e){rejected=/does not authorize the production baseline/i.test(String(e.message));}assert(rejected,'Freeze with a wrong-purpose decision was accepted.');assert(p.projectData.baselines.length===bb,'Rejected freeze partially mutated baseline state.');}

// Permanent regression: a decision bound to a different target family or candidate identity cannot authorize the baseline.
{const p=project('JOB-STAGE23-WRONG-TARGET');const wrongTarget=decision(p,{targetId:'CANDIDATE-OTHER'});const bb=p.projectData.baselines.length;let rejected=false;try{engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],authorizationDecisionId:engine.recordId(wrongTarget,'humanDecisions'),operatorLabel:'STAGE23_VERIFIER'});}catch(e){rejected=/not bound to the exact unchanged-confirmed candidate/i.test(String(e.message));}assert(rejected,'Freeze with a wrong-target decision was accepted.');assert(p.projectData.baselines.length===bb,'Rejected freeze partially mutated baseline state.');}

// Permanent regression: a decision whose value is not exactly AUTHORIZED cannot authorize the baseline.
{const p=project('JOB-STAGE23-WRONG-VALUE');const wrongValue=decision(p,{value:'PENDING'});const bb=p.projectData.baselines.length;let rejected=false;try{engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],authorizationDecisionId:engine.recordId(wrongValue,'humanDecisions'),operatorLabel:'STAGE23_VERIFIER'});}catch(e){rejected=/does not equal AUTHORIZED/i.test(String(e.message));}assert(rejected,'Freeze with a non-AUTHORIZED decision value was accepted.');assert(p.projectData.baselines.length===bb,'Rejected freeze partially mutated baseline state.');}

// Permanent regression: an exact valid decision cannot substitute for the exact unchanged-confirmed artifact set.
{const p=project('JOB-STAGE23-WRONG-ARTIFACTS');const d=decision(p);const bb=p.projectData.baselines.length;let rejected=false;try{engine.freezeBaseline(p,{artifactIds:['ARTIFACT-OTHER'],authorizationDecisionId:engine.recordId(d,'humanDecisions'),operatorLabel:'STAGE23_VERIFIER'});}catch(e){rejected=/exact artifact set/i.test(String(e.message));}assert(rejected,'Freeze with the wrong artifact set was accepted.');assert(p.projectData.baselines.length===bb,'Rejected freeze partially mutated baseline state.');}

// Repaired path: a current, correctly-targeted, AUTHORIZED human decision freezes the exact candidate and Stage 20 requires zero accepted external responses.
{const p=project('JOB-STAGE23-REPAIRED');const d=decision(p);const baseline=engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],authorizationDecisionId:engine.recordId(d,'humanDecisions'),operatorLabel:'STAGE23_VERIFIER'});assert(engine.recordValue(baseline,'HUMAN_AUTHORIZATION')===engine.recordId(d,'humanDecisions'),'Baseline lost the exact human authorization decision reference.');assert(engine.recordValue(baseline,'APPROVED_VERSIONS').candidateId==='CANDIDATE-CONFIRMED','Baseline did not preserve the exact unchanged-confirmed candidate identity.');assert(engine.acceptedChanges(p,20).length===0,'Stage 20 required an accepted external response envelope.');assert(engine.records(p,'baselines').some(record=>engine.recordId(record,'baselines')===engine.recordId(baseline,'baselines')&&engine.isActiveRecord(record)),'Repaired baseline authorization did not create the current production baseline through the production freeze mechanism.');}

console.log(JSON.stringify({controllerStage:'23',applicationStage:'20',productionBaselineAuthority:'PASS',intentionalInvalidFixturesRejected:['missing-human-authorization-decision','wrong-decision-purpose','wrong-decision-target','wrong-decision-value','wrong-artifact-set'],noPartialMutationOnRejectedFreeze:true,exactHumanAuthorizationReferenced:true,zeroAcceptedStage20ExternalResponses:true,isolatedDisposableProjects:true}));
