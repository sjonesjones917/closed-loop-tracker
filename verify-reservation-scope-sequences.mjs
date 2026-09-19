import {createVerifierRuntime} from './verifier-runtime.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

// Section 35.6 supplies these oracles. The registry supplies only the domain
// of operations and binding dimensions, never the expected test outcome.
globalThis.dispatchEvent=()=>{};
const faultId=process.argv.find(value=>value.startsWith('--fault='))?.slice(8);
const faults={
  transition:{before:'if(!allowed.includes(target))throw new Error(`Invalid operation-reservation transition',after:'if(false)throw new Error(`Invalid operation-reservation transition',oracle:'RESERVATION_TERMINAL_ORACLE'},
  binding:{before:"set(r,'operationReservations','STATUS',target);return r;",after:"set(r,'operationReservations','STATUS',target);set(r,'operationReservations','PACKAGE_ID','CHANGED-PACKAGE');return r;",oracle:'RESERVATION_BINDING_ORACLE'},
  slot:{before:"if(matching.some(r=>RESERVATION_PRESERVING_STATES.has(up(fv(r,'STATUS')))))throw new Error",after:'if(false)throw new Error',oracle:'RESERVATION_SLOT_ORACLE'}
};
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js']){
  let source=fs.readFileSync(file,'utf8');
  if(file==='workflow-engine.js'&&faultId){const fault=faults[faultId];assert.ok(fault&&source.includes(fault.before),'Fault anchor missing');source=source.replace(fault.before,fault.after);}
  createVerifierRuntime.loadScript(globalThis,source,{filename:file});
}
const engine=closedLoopWorkflowEngine,schema=closedLoopWorkflowSchema;
const contracts=Object.values(schema.STAGE_OPERATION_REGISTRY).filter(contract=>contract.reservationRequired);
const terminal=['ACCEPTED','REJECTED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE'];
const alphabet=['EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED',...terminal,'UNKNOWN_STATE','RETRY','RELOAD'];
const bindingFields=['OPERATION_RESERVATION_ID','JOB_ID','STAGE','OPERATION','TARGET_SLOT','PACKAGE_ID','PROMPT_ID','SCOPE','EXPECTED_REVISION','RESERVATION_REVISION','CHALLENGE_NONCE','IDEMPOTENCY_KEY','PAYLOAD_HASH'];
const binding=record=>JSON.stringify(Object.fromEntries(bindingFields.map(key=>[key,engine.recordValue(record,key)])));
const value=(record,key)=>engine.recordValue(record,key);
const maxDepth=5,results=[];
for(const contract of contracts){
  const seed=closedLoopCore.createBlankState(`DISPOSABLE-RESERVATION-${contract.stage}-${contract.operation}`);engine.ensureShape(seed);
  // These are isolated scope fixtures, not completed operator work. Allocate
  // real identities and reserve output versions through the production owner;
  // never bypass scope validation to reach the state machine under test.
  for(const key of Object.keys(seed.job))if(key.startsWith('CURRENT_')&&key!=='CURRENT_INPUT_VERSION')seed.job[key]=`SYNTHETIC-${key}`;
  const references={};
  for(const key of contract.scopeRequirements){
    const family=schema.SCOPE_REFERENCE_FAMILIES[key];if(!family)continue;
    const definition=schema.RECORD_SCHEMAS[family],id=engine.allocateId(seed,family),fields={[definition.idField]:id};
    if(key==='confirmationIterationId'){fields.PURPOSE='UNCHANGED_CONFIRMATION';fields.PREVIOUS_ITERATION_ID=references.sourceConvergedIterationId||references.iterationId||id;}
    const row={id,stage:Math.min(contract.stage,definition.stage),active:true,fields,...fields,source:'SYNTHETIC_SCOPE_FIXTURE'};
    if(family==='products'&&contract.scope.dimensions[key]==='INPUT_CURRENT')row.completionState='COMPLETED';
    engine.refreshRecordHashes(row,family);seed.projectData[family].push(row);references[key]=id;
  }
  const scope=engine.operationScope(seed,contract.stage,contract.operation,references,{reserveTargets:true});
  const input={stage:contract.stage,operation:contract.operation,scope:{...scope,projectRevision:0},expectedRevision:0,packageId:'SYNTHETIC-PACKAGE',promptId:'SYNTHETIC-PROMPT',owningTabInstance:'TAB-A',payload:{request:'original'}};
  const initial=engine.reserveOperation(seed,input),id=engine.recordId(initial,'operationReservations'),originalBinding=binding(initial);
  const reservation=p=>p.projectData.operationReservations.find(record=>engine.recordId(record,'operationReservations')===id);
  assert.equal(value(initial,'RESERVATION_REVISION'),1);
  assert.equal(value(initial,'SCOPE').projectRevision,1);
  const normal=structuredClone(seed),normalRecord=reservation(normal);
  for(const state of ['EXPORTED','RESPONSE_STAGED','ACCEPTED']){engine.transitionOperationReservation(normalRecord,state);assert.equal(binding(normalRecord),originalBinding,'RESERVATION_BINDING_ORACLE: progressing a valid state changed its binding');}
  assert.equal(value(normalRecord,'STATUS'),'ACCEPTED','The required normal metadata path must progress');
  // A second payload cannot own a live slot even with the current revision.
  const live=structuredClone(seed),beforeLive=JSON.stringify(live);
  assert.throws(()=>engine.reserveOperation(live,{...input,expectedRevision:1,scope:{...scope,projectRevision:1},payload:{request:'different'}}),/authoritative reservation.*slot/i,'RESERVATION_SLOT_ORACLE: a second payload acquired a live slot');
  assert.equal(JSON.stringify(live),beforeLive,'Live-slot rejection changed the project');
  const queue=[{project:seed,trace:[]}],seen=new Set(),observations=[];
  let acceptedPaths=0,rejected=0;
  while(queue.length){
    const {project,trace}=queue.shift(),status=value(reservation(project),'STATUS');
    if(trace.length>=maxDepth)continue;
    const key=`${trace.length}:${status}`;if(seen.has(key))continue;seen.add(key);
    for(const operation of alphabet){
      let p=structuredClone(project),error=null;const before=JSON.stringify(p),path=[...trace,operation];
      try{
        if(operation==='RELOAD'){p=JSON.parse(JSON.stringify(p));engine.ensureShape(p);}
        else if(operation==='RETRY')assert.equal(engine.recordId(engine.reserveOperation(p,input),'operationReservations'),id,'Exact retry changed identity');
        else engine.transitionOperationReservation(reservation(p),operation);
      }catch(failure){error=failure;}
      if(terminal.includes(status)&&!['RETRY','RELOAD'].includes(operation))assert.ok(error,'RESERVATION_TERMINAL_ORACLE: a terminal reservation reopened');
      if(operation==='UNKNOWN_STATE')assert.ok(error,'RESERVATION_TERMINAL_ORACLE: an unregistered state was accepted');
      if(['RETRY','RELOAD'].includes(operation))assert.equal(error,null,`Valid retry/reload failed: ${error?.message}`);
      if(error){assert.match(error.message,/Invalid operation-reservation transition/,'A transition failed for an unrelated reason');assert.equal(JSON.stringify(p),before,'Rejected transition mutated state');rejected++;}
      else{
        assert.equal(binding(reservation(p)),originalBinding,'RESERVATION_BINDING_ORACLE: an operational event changed the binding');
        assert.equal(p.revision,1,'An operational event changed canonical revision');assert.equal(p.projectData.operationReservations.length,1,'Retry duplicated a reservation');
        if(value(reservation(p),'STATUS')==='ACCEPTED')acceptedPaths++;
        queue.push({project:p,trace:path});
      }
      observations.push({sequence:path,result:error?'REJECTED_WITHOUT_MUTATION':'PRESERVED_BINDING',status:value(reservation(p),'STATUS')});
    }
  }
  assert.ok(acceptedPaths&&rejected,'Exploration must exercise successful and rejected paths');
  const cancelled=structuredClone(seed);engine.transitionOperationReservation(reservation(cancelled),'CANCELLED');const beforeStale=JSON.stringify(cancelled);
  assert.throws(()=>engine.reserveOperation(cancelled,{...input,payload:{request:'replacement'}}),/stale.*revision|revision.*stale/i,'Stale writer reserved a replacement');assert.equal(JSON.stringify(cancelled),beforeStale);
  const replacement=engine.reserveOperation(cancelled,{...input,expectedRevision:1,scope:{...scope,projectRevision:1},payload:{request:'replacement'}});
  assert.notEqual(engine.recordId(replacement,'operationReservations'),id);assert.equal(value(replacement,'STATUS'),'RESERVED');assert.equal(cancelled.revision,2);
  results.push({stage:contract.stage,operation:contract.operation,scopeDimensions:contract.scopeRequirements,statesExplored:seen.size,acceptedPaths,rejected,liveSlotConflict:'REJECTED_WITHOUT_MUTATION',staleReplacement:'REJECTED_WITHOUT_MUTATION',currentReplacement:'RESERVED_ONCE',observations});
}
assert.equal(results.length,contracts.length);assert.ok(results.length>0);
const faultResults=[];
if(!faultId)for(const [id,fault]of Object.entries(faults)){
  const run=spawnSync(process.execPath,[import.meta.filename,'--fault='+id],{encoding:'utf8',maxBuffer:1024*1024});
  assert.notEqual(run.status,0,`Fault survived: ${id}`);assert.match(run.stderr,new RegExp(fault.oracle),`Unrelated failure under ${id}`);faultResults.push({fault:id,oracle:fault.oracle,result:'DETECTED'});
}
console.log(JSON.stringify({schema:'closed-loop-reservation-scope-sequences/1',synthetic:true,actualBrowser:false,environment:'Node production reservation engine; isolated metadata-state fixtures',bounds:{maxDepth,alphabet,operationCount:results.length,stages:[...new Set(results.map(row=>row.stage))],equivalence:'Fixed binding per registered operation; reservation status and trace depth',assumptions:['Synthetic scope tokens exercise reservation identity; they do not establish workflow prerequisites.','ACCEPTED here is a reservation metadata state, not a committed response or completed stage.','Atomic persistence, response acceptance, restoration, external execution and browser behavior require their separate gates.']},implementationFaults:faultResults,results},null,2));
