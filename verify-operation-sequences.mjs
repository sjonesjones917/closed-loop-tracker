import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=class Event{};globalThis.dispatchEvent=()=>{};
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const e=closedLoopWorkflowEngine;
// Independent safety oracle from Section 35.6: operational events retain
// bindings/revision, terminal states cannot be reopened, exact retry is stable.
const terminal=new Set(['ACCEPTED','REJECTED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE']);
const alphabet=['EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED',...terminal,'UNKNOWN_STATE','RETRY','RELOAD'];
const seed=closedLoopCore.createBlankState('DISPOSABLE-BOUNDED-RESERVATION');e.ensureShape(seed);
const input={stage:1,operation:'COMPLETE',expectedRevision:0,scope:{projectRevision:0,inputVersion:seed.job.CURRENT_INPUT_VERSION},owningTabInstance:'TAB-A',payload:{action:'bounded-probe'}};
const initial=e.reserveOperation(seed,input),reservationId=e.recordId(initial,'operationReservations');
const binding=r=>JSON.stringify(Object.fromEntries(['OPERATION_RESERVATION_ID','JOB_ID','STAGE','OPERATION','TARGET_SLOT','PACKAGE_ID','PROMPT_ID','SCOPE','EXPECTED_REVISION','RESERVATION_REVISION','CHALLENGE_NONCE','IDEMPOTENCY_KEY','PAYLOAD_HASH'].map(k=>[k,e.recordValue(r,k)])));
const originalBinding=binding(initial),maxDepth=5,queue=[{project:seed,trace:[]}],seen=new Set(),cases=[];
let acceptedStates=0,rejectedOperations=0;
while(queue.length){
  const {project,trace}=queue.shift();
  if(trace.length>=maxDepth)continue;
  const source=e.records(project,'operationReservations',{active:false}).find(r=>e.recordId(r,'operationReservations')===reservationId),status=e.recordValue(source,'STATUS');
  const stateKey=`${trace.length}:${status}`;if(seen.has(stateKey))continue;seen.add(stateKey);
  for(const operation of alphabet){
    let p=structuredClone(project);const record=e.records(p,'operationReservations',{active:false}).find(r=>e.recordId(r,'operationReservations')===reservationId),before=JSON.stringify(p),path=[...trace,operation];let error=null;
    try{
      if(operation==='RELOAD'){p=JSON.parse(JSON.stringify(p));e.ensureShape(p);}
      else if(operation==='RETRY'){const retry=e.reserveOperation(p,input);assert.equal(e.recordId(retry,'operationReservations'),reservationId,'Exact retry allocated a different reservation.');}
      else e.transitionOperationReservation(record,operation);
    }catch(failure){error=failure;}
    if(terminal.has(status)&&!['RETRY','RELOAD'].includes(operation))assert.ok(error,`Terminal ${status} reopened through ${path.join(' → ')}.`);
    if(operation==='UNKNOWN_STATE')assert.ok(error,'An unregistered reservation state was accepted.');
    if(['RETRY','RELOAD'].includes(operation))assert.equal(error,null,`Recovery failed on ${path.join(' → ')}: ${error?.message}`);
    if(error){assert.equal(JSON.stringify(p),before,`Rejected transition partially mutated state: ${path.join(' → ')}`);rejectedOperations++;}
    else{
      const after=e.records(p,'operationReservations',{active:false}).find(r=>e.recordId(r,'operationReservations')===reservationId);
      assert.equal(binding(after),originalBinding,`Operational event changed reserved identity: ${path.join(' → ')}`);
      assert.equal(p.revision,1,`Operational event changed canonical revision: ${path.join(' → ')}`);
      assert.equal(p.projectData.operationReservations.length,1,'Retry duplicated the effect.');
      if(e.recordValue(after,'STATUS')==='ACCEPTED')acceptedStates++;
      queue.push({project:p,trace:path});
    }
    cases.push({caseId:`RESERVATION-SEQUENCE-${cases.length+1}`,sequence:path,result:error?'REJECTED_WITHOUT_MUTATION':'PRESERVED_BINDING',observedStatus:error?status:e.recordValue(e.records(p,'operationReservations',{active:false})[0],'STATUS')});
  }
}
assert.ok(acceptedStates>0,'Exploration never completed a valid accepted path.');
assert.ok(rejectedOperations>0,'Exploration never exercised invalid work.');
// Stale concurrent writer after the prior slot is cancelled: a new payload
// cannot acquire authority using its old expected revision.
const stale=structuredClone(seed);e.transitionOperationReservation(e.records(stale,'operationReservations',{active:false})[0],'CANCELLED');
const prior=JSON.stringify(stale);
assert.throws(()=>e.reserveOperation(stale,{...input,payload:{action:'concurrent-edit'}}),/stale.*revision|revision.*stale/i,'STALE_RESERVATION_ORACLE: a stale writer reserved a new payload.');
assert.equal(JSON.stringify(stale),prior,'Stale writer changed the project.');
const corrected=e.reserveOperation(stale,{...input,expectedRevision:1,scope:{...input.scope,projectRevision:1},payload:{action:'concurrent-edit'}});
assert.equal(e.recordValue(corrected,'STATUS'),'RESERVED');assert.equal(stale.revision,2);
cases.push({caseId:'STALE-CONCURRENT-RESERVATION-RECOVERY',sequence:['RESERVE','CANCEL','STALE_WRITER','REFRESH','RESERVE'],result:'STALE_REJECTED_CORRECTED_ACCEPTED'});
console.log(JSON.stringify({schema:'closed-loop-executed-cases/1',synthetic:true,environment:'Node; isolated production engine state',bounds:{maxDepth,alphabet,equivalence:'reservation status and sequence depth; fixed project, payload and scope',statesExplored:seen.size,limitations:['No browser, IndexedDB, file-system, physical-device, or external-context evidence.','JSON reload exercises persisted representation; actual database reload is a separate browser gate.']},acceptedStates,rejectedOperations,cases},null,2));
