import {createRetainedStage11Prerequisite} from './test-accepted-run-correction-journey.mjs';

// Restore the real operator-produced prerequisite and verify all current
// Stage1–10 gates. Each control receives its own clone of this reached state.
const {r,p:prerequisite}=await createRetainedStage11Prerequisite();
const engine=r.engine,prompts=r.prompts;
const assert=(value,message)=>{if(!value)throw new Error(message);};

function makeProject(){
  const p=engine.clone(prerequisite),scope=engine.currentScope(p);
  assert(engine.records(p,'runs').length===0,'The authentic prerequisite already contains runs.');
  return {p,iterationId:scope.iterationId,candidateId:scope.candidateId};
}

function setField(record,key,value){
  record.fields=record.fields&&typeof record.fields==='object'?record.fields:{};
  record.fields[key]=value;
  record[key]=value;
}

function buildCompletedBatch(){
  const {p,iterationId,candidateId}=makeProject();
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
    const options=engine.preparePromptContext(p,11,{operation:'EXECUTE_RUN',scope:{runId:slot.runId,contextId:slot.contextId}}).options;
    const {prompt}=prompts.reserveAndBuildPromptRecord(p,11,options);
    assert(prompts.runPromptContextIsolation(p,prompt).determination==='CURRENT','The retained execution instruction is not isolated.');
    const carriers=[prompt.prompt,...prompts.materializePromptContextFiles(prompt,p).map(file=>file.text)];
    for(let prior=0;prior<index;prior++)assert(carriers.every(text=>!text.includes(`STAGE15-RUN-${prior+1}-OUTPUT-SENTINEL`)),'A later run instruction exposed an earlier run output.');
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
    p.projectData.rawResponses.push({rawResponseId,promptInstructionId:prompt.instructionId,stage:11,scope:{iterationId,candidateId,runId:slot.runId,contextId:slot.contextId}});
    p.projectData.acceptedChanges.push({changeId,stage:11,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'EXECUTE_RUN',rawResponseId,scope:{iterationId,candidateId,runId:slot.runId,contextId:slot.contextId},canonicalRecordIds:[slot.runId]});
    p.projectData.outputReceipts.push({receiptId:`RECEIPT-STAGE15-${index+1}`,rawResponseId,stage:11,iteration:iterationId,runId:slot.runId,contextId:slot.contextId});
  }
  return {p,iterationId,candidateId,slots};
}

const complete=buildCompletedBatch();
const independence=engine.evaluateContextIndependence(complete.p,{role:'RUN_BATCH',iterationId:complete.iterationId});
assert(independence.determination==='APPLICATION_ESTABLISHED',`Ten distinct current contexts were not established: ${JSON.stringify(independence)}`);
assert(new Set(complete.slots.map(slot=>slot.runId)).size===10,'RUN_ID identities are not distinct.');
assert(new Set(complete.slots.map(slot=>slot.contextId)).size===10,'CONTEXT_ID identities are not distinct.');
assert(complete.p.projectData.acceptedChanges.filter(change=>change.stage===11&&change.status==='COMMITTED').length===10,'Exactly ten accepted Stage 11 run changes were not preserved.');
assert(new Set(complete.p.projectData.outputReceipts.filter(receipt=>receipt.stage===11).map(receipt=>receipt.receiptId)).size===10,'Run output receipts are not separate.');

{
  const p=engine.clone(complete.p),raw=p.projectData.rawResponses.find(row=>row.rawResponseId==='RAW-STAGE15-1'),instructionId=raw.promptInstructionId;
  delete raw.promptInstructionId;
  assert(engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId:complete.iterationId}).determination==='UNKNOWN','A missing raw-response instruction link established independence.');
  raw.promptInstructionId=instructionId;
  assert(engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId:complete.iterationId}).determination==='APPLICATION_ESTABLISHED','Restoring the exact raw-response instruction link did not restore independence.');
  const index=p.projectData.generatedPrompts.findIndex(row=>row.instructionId===instructionId);
  assert(index>=0,'The retained instruction negative control has no source instruction.');
  const [prompt]=p.projectData.generatedPrompts.splice(index,1);
  assert(engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId:complete.iterationId}).determination==='UNKNOWN','A missing retained instruction established independence.');
  p.projectData.generatedPrompts.splice(index,0,prompt);
  assert(engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId:complete.iterationId}).determination==='APPLICATION_ESTABLISHED','Restoring the exact retained instruction did not restore independence.');
}

{
  const {p,iterationId}=buildCompletedBatch();
  const contexts=engine.records(p,'freshContexts',{stage:11});
  setField(contexts[1],'EXTERNAL_CONTEXT_IDENTIFIER',engine.recordValue(contexts[0],'EXTERNAL_CONTEXT_IDENTIFIER'));
  const result=engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId});
  assert(result.determination==='VIOLATED','Duplicate external context identity was not rejected.');
}

{
  const {p,iterationId}=buildCompletedBatch();
  const contexts=engine.records(p,'freshContexts',{stage:11});
  setField(contexts[4],'CONTAMINATION_STATUS','CONTAMINATED');
  setField(contexts[4],'AUTHORIZED_PROJECT_INPUTS',['candidate','prior-run output','reviewer feedback']);
  const result=engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId});
  assert(result.determination==='VIOLATED','Known run-context contamination was not rejected.');
}

{
  const {p,iterationId}=buildCompletedBatch();
  const runs=engine.records(p,'runs',{stage:11});
  setField(runs[7],'CANDIDATE_ID','CANDIDATE-WRONG');
  const result=engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId});
  assert(result.determination!=='APPLICATION_ESTABLISHED','A wrong-candidate run was represented as an established independent batch.');
}

{
  const {p,iterationId,candidateId}=buildCompletedBatch();
  const run=engine.records(p,'runs',{stage:11})[9];
  run.active=false;
  assert(engine.records(p,'runs',{stage:11}).filter(record=>record.active!==false).length===9,'Nine-run invalid fixture did not contain nine current runs.');
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
  exactTenGateEvidence:'verify-complete.mjs',
  promptIsolationEvidence:'retained application-generated per-run instructions and exact context bytes; prior-run output exclusion',
  intentionalInvalidFixturesRejected:[
    'duplicate-external-context-identity',
    'known-context-contamination-and-prohibited-inputs',
    'wrong-candidate-run',
    'fewer-than-ten-current-runs',
    'partial-batch-top-up',
    'missing-raw-instruction-link',
    'missing-retained-instruction'
  ],
  repairedPathProgressed:true,
  isolatedDisposableProjects:true
}));
