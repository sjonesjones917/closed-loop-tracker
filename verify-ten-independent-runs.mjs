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
  p.stages[10].status='COMPLETE';
  p.stages[10].gate={complete:true,blocked:false,reasons:[]};
  return {p,iterationId:engine.recordId(frozen.iteration,'iterations'),candidateId:engine.recordId(frozen.candidate,'candidateFreezes')};
}

function setField(record,key,value){
  record.fields=record.fields&&typeof record.fields==='object'?record.fields:{};
  record.fields[key]=value;
  record[key]=value;
}

function buildCompletedBatch(jobId='JOB-STAGE15-TEN-RUNS'){
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
    setField(run,'EXECUTION_STATUS','COMPLETED');
    setField(run,'COMPLETE_OUTPUT',`STAGE15-RUN-${index+1}-OUTPUT-SENTINEL`);
    run.status='COMPLETED';
    const rawResponseId=`RAW-STAGE15-${index+1}`;
    const changeId=`CHANGE-STAGE15-${index+1}`;
    p.projectData.rawResponses.push({rawResponseId,stage:11,scope:{iterationId,candidateId,runId:slot.runId,contextId:slot.contextId}});
    p.projectData.acceptedChanges.push({changeId,stage:11,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'EXECUTE_RUN',rawResponseId,scope:{iterationId,candidateId,runId:slot.runId,contextId:slot.contextId},canonicalRecordIds:[slot.runId]});
    p.projectData.outputReceipts.push({receiptId:`RECEIPT-STAGE15-${index+1}`,rawResponseId,stage:11,iteration:iterationId,runId:slot.runId,contextId:slot.contextId});
  }
  return {p,iterationId,candidateId,slots};
}

const complete=buildCompletedBatch();
const independence=engine.evaluateContextIndependence(complete.p,{role:'RUN_BATCH',iterationId:complete.iterationId});
assert(independence.determination==='APPLICATION_ESTABLISHED',`Ten distinct current contexts were not established: ${JSON.stringify(independence)}`);
const gate=engine.gate(11,complete.p);
assert(gate.complete,`A valid exact ten-run batch did not complete Stage 11: ${gate.reasons.join('; ')}`);
assert(new Set(complete.slots.map(slot=>slot.runId)).size===10,'RUN_ID identities are not distinct.');
assert(new Set(complete.slots.map(slot=>slot.contextId)).size===10,'CONTEXT_ID identities are not distinct.');
assert(new Set(complete.p.projectData.outputReceipts.filter(receipt=>receipt.stage===11).map(receipt=>receipt.receiptId)).size===10,'Run output receipts are not separate.');

{
  const {p,iterationId}=buildCompletedBatch('JOB-STAGE15-DUPLICATE-CONTEXT');
  const contexts=engine.records(p,'freshContexts',{stage:11});
  setField(contexts[1],'EXTERNAL_CONTEXT_IDENTIFIER',engine.recordValue(contexts[0],'EXTERNAL_CONTEXT_IDENTIFIER'));
  const result=engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId});
  assert(result.determination==='VIOLATED','Duplicate external context identity was not rejected.');
  assert(!engine.gate(11,p).complete,'Stage 11 completed with duplicate external context identity.');
}

{
  const {p,iterationId}=buildCompletedBatch('JOB-STAGE15-CONTAMINATION');
  const contexts=engine.records(p,'freshContexts',{stage:11});
  setField(contexts[4],'CONTAMINATION_STATUS','CONTAMINATED');
  setField(contexts[4],'AUTHORIZED_PROJECT_INPUTS',['candidate','prior-run output','reviewer feedback']);
  const result=engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId});
  assert(result.determination==='VIOLATED','Known run-context contamination was not rejected.');
  assert(!engine.gate(11,p).complete,'Stage 11 completed with a contaminated run context.');
}

{
  const {p}=buildCompletedBatch('JOB-STAGE15-CANDIDATE-MISMATCH');
  const runs=engine.records(p,'runs',{stage:11});
  setField(runs[7],'CANDIDATE_ID','CANDIDATE-WRONG');
  assert(!engine.gate(11,p).complete,'Stage 11 completed when one run used the wrong candidate.');
}

{
  const {p,iterationId,candidateId}=buildCompletedBatch('JOB-STAGE15-NINE-RUNS');
  const run=engine.records(p,'runs',{stage:11})[9];
  run.active=false;
  assert(!engine.gate(11,p).complete,'Stage 11 completed with fewer than ten current runs.');
  let rejected=false;
  try{engine.reserveRunBatch(p,{stage:11,iterationId,candidateId,count:10});}catch{rejected=true;}
  assert(rejected,'A partial active batch was silently topped up instead of failing closed.');
}

console.log(JSON.stringify({
  controllerStage:'15',
  applicationStage:'11',
  tenIndependentRuns:'PASS',
  exactAcceptedRunCount:10,
  exactDistinctContextCount:10,
  exactCandidateBinding:true,
  separateOutputReceipts:true,
  idempotentBatchReservation:true,
  intentionalInvalidFixturesRejected:[
    'duplicate-external-context-identity',
    'known-context-contamination-and-prohibited-inputs',
    'wrong-candidate-run',
    'fewer-than-ten-current-runs',
    'partial-batch-top-up'
  ],
  repairedPathProgressed:true,
  isolatedDisposableProjects:true
}));
