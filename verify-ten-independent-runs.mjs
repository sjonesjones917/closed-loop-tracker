import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const hash=globalThis.closedLoopHash;
const engine=globalThis.closedLoopWorkflowEngine;
const assert=(value,message)=>{if(!value)throw new Error(message);};
const sha='a'.repeat(64);

function makeProject(jobId){
  const p=core.createBlankState(jobId);
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='Execute exactly ten independent runs from one frozen candidate.';
  p.job.CURRENT_INPUT_VERSION='INPUT-v001';
  p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';
  p.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';
  p.job.CURRENT_INSTRUCTION_VERSION='INSTRUCTION-v001';
  engine.ensureShape(p);
  engine.registerArtifactBytes(p,{stage:10,artifactId:'ARTIFACT-STAGE15-CANDIDATE',filename:'candidate.bin',mediaType:'application/octet-stream',byteSize:1,sha256:sha});
  const decision=engine.recordRegisteredHumanDecision(p,{stage:10,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value(['ARTIFACT-STAGE15-CANDIDATE']),value:['ARTIFACT-STAGE15-CANDIDATE'],operatorLabel:'STAGE15_VERIFIER'});
  const frozen=engine.freezeCandidate(p,{stage:10,artifactIds:['ARTIFACT-STAGE15-CANDIDATE'],selectionDecisionId:engine.recordId(decision,'humanDecisions'),operatorLabel:'STAGE15_VERIFIER'});
  return {p,iterationId:engine.recordId(frozen.iteration,'iterations'),candidateId:engine.recordId(frozen.candidate,'candidateFreezes')};
}

function setField(record,key,value){
  record.fields=record.fields&&typeof record.fields==='object'?record.fields:{};
  record.fields[key]=value;
  record[key]=value;
}

function buildObservedBatch(jobId='JOB-STAGE15-TEN-RUNS'){
  const {p,iterationId,candidateId}=makeProject(jobId);
  const slots=engine.reserveRunBatch(p,{stage:11,iterationId,candidateId,count:10});
  assert(slots.length===10,'The application did not reserve exactly ten run targets.');
  assert(engine.records(p,'runs',{stage:11}).length===10,'Run reservation did not create exactly ten canonical run records.');
  assert(engine.records(p,'freshContexts',{stage:11}).length===10,'Run reservation did not create exactly ten canonical fresh-context records.');

  const firstReservationEventCount=p.projectData.history.filter(item=>item?.type==='RUN_BATCH_RESERVED').length;
  const retry=engine.reserveRunBatch(p,{stage:11,iterationId,candidateId,count:10});
  assert(JSON.stringify(retry)===JSON.stringify(slots),'Exact run-batch retry did not return the same reserved targets.');
  assert(engine.records(p,'runs',{stage:11}).length===10&&engine.records(p,'freshContexts',{stage:11}).length===10,'Exact run-batch retry allocated duplicate records.');
  assert(p.projectData.history.filter(item=>item?.type==='RUN_BATCH_RESERVED').length===firstReservationEventCount,'Exact run-batch retry created a duplicate reservation event.');

  for(let index=0;index<slots.length;index++){
    const slot=slots[index];
    const run=engine.records(p,'runs').find(record=>engine.recordId(record,'runs')===slot.runId);
    const context=engine.records(p,'freshContexts').find(record=>engine.recordId(record,'freshContexts')===slot.contextId);
    assert(run&&context,`Reserved run/context ${index+1} is missing.`);
    assert(engine.recordValue(run,'CANDIDATE_ID')===candidateId,'A reserved run is not bound to the exact frozen candidate.');
    setField(context,'EXTERNAL_CONTEXT_IDENTIFIER',`external-stage15-${index+1}`);
    setField(context,'CONTAMINATION_STATUS','NONE');
    setField(context,'AUTHORIZED_PROJECT_INPUTS',['candidate']);
    setField(run,'CONTAMINATION_CHECK','NONE');
    setField(run,'TOOL_CONFIGURATION','IDENTICAL_CONTROLLED_CONFIGURATION');

  }
  return {p,iterationId,candidateId,slots};
}

const complete=buildObservedBatch();
const independence=engine.evaluateContextIndependence(complete.p,{role:'RUN_BATCH',iterationId:complete.iterationId});
assert(independence.determination==='APPLICATION_ESTABLISHED',`Ten distinct current contexts were not established: ${JSON.stringify(independence)}`);
assert(new Set(complete.slots.map(slot=>slot.runId)).size===10,'RUN_ID identities are not distinct.');
assert(new Set(complete.slots.map(slot=>slot.contextId)).size===10,'CONTEXT_ID identities are not distinct.');

{
  const {p,iterationId}=buildObservedBatch('JOB-STAGE15-DUPLICATE-CONTEXT');
  const contexts=engine.records(p,'freshContexts',{stage:11});
  setField(contexts[1],'EXTERNAL_CONTEXT_IDENTIFIER',engine.recordValue(contexts[0],'EXTERNAL_CONTEXT_IDENTIFIER'));
  const result=engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId});
  assert(result.determination==='VIOLATED'&&result.reasons.some(reason=>/identifiers are reused/.test(reason)),'Duplicate external context identity was not rejected.');
  setField(contexts[1],'EXTERNAL_CONTEXT_IDENTIFIER','external-stage15-2');
  assert(engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId}).determination==='APPLICATION_ESTABLISHED','Distinct identifier repair failed');
}

for(const [field,invalid,reason] of [['CONTAMINATION_STATUS','CONTAMINATED',/contamination is affirmative/],['AUTHORIZED_PROJECT_INPUTS',['candidate','prior-run output'],/prohibited prior output/]]){
  const {p,iterationId}=buildObservedBatch('JOB-STAGE15-'+field),context=engine.records(p,'freshContexts',{stage:11})[4],original=engine.recordValue(context,field);
  setField(context,field,invalid);const result=engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId});
  assert(result.determination==='VIOLATED'&&result.reasons.some(value=>reason.test(value)),field+' was not rejected for the intended reason.');
  setField(context,field,original);assert(engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId}).determination==='APPLICATION_ESTABLISHED',field+' repair failed.');
}

{
  const {p,iterationId}=buildObservedBatch('JOB-STAGE15-CANDIDATE-MISMATCH');
  const runs=engine.records(p,'runs',{stage:11});
  const original=engine.recordValue(runs[7],'CANDIDATE_ID');setField(runs[7],'CANDIDATE_ID','CANDIDATE-WRONG');
  const result=engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId});
  assert(result.determination==='VIOLATED'&&result.reasons.some(reason=>/candidate identity/.test(reason)),'A wrong-candidate run was represented as an established independent batch.');
  setField(runs[7],'CANDIDATE_ID',original);assert(engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId}).determination==='APPLICATION_ESTABLISHED','Candidate repair failed.');
}

{
  const {p,iterationId,candidateId}=buildObservedBatch('JOB-STAGE15-NINE-RUNS');
  const run=engine.records(p,'runs',{stage:11})[9];
  run.active=false;
  assert(engine.records(p,'runs',{stage:11}).filter(record=>record.active!==false).length===9,'Nine-run invalid fixture did not contain nine current runs.');
  let rejected=false;
  try{engine.reserveRunBatch(p,{stage:11,iterationId,candidateId,count:10});}catch(error){rejected=/9 active run slots; expected exactly 10/.test(error.message);}
  assert(rejected,'A partial active batch was not rejected for its missing active slot.');
  run.active=true;assert(engine.reserveRunBatch(p,{stage:11,iterationId,candidateId,count:10}).length===10,'Restored original batch did not progress.');
}

console.log(JSON.stringify({
  controllerStage:'15',
  applicationStage:'11',
  tenIndependentRuns:'PASS',
  evidenceClass:'SYNTHETIC_RESERVATION_AND_CONTEXT_COMPONENTS',
  actualAcceptedExternalRunCount:0,
  applicationObservableIdentityChecksOnly:true,
  providerIndependenceEstablished:false,
  exactDistinctContextCount:10,
  exactCandidateBinding:true,
  idempotentBatchReservation:true,
  exactTenGateEvidence:'verify-complete.mjs',
  promptIsolationEvidence:'verify-all-stage-prompts.mjs + verify-stage-prompts-complete.mjs',
  intentionalInvalidFixturesRejected:[
    'duplicate-external-context-identity',
    'known-context-contamination',
    'prohibited-context-inputs',
    'wrong-candidate-run',
    'partial-batch-top-up'
  ],
  repairedPathProgressed:true,
  isolatedDisposableProjects:true
}));
