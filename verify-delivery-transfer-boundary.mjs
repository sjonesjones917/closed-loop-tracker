import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
const engine=globalThis.closedLoopWorkflowEngine,h=globalThis.closedLoopHash;
const source=fs.readFileSync('verify-full-cycle.mjs','utf8'),anchor=source.indexOf('engine.recordDeliveryAttempt(p');
assert.ok(anchor>0);
const capture=path.join(os.tmpdir(),`delivery-transfer-${process.pid}.json`),script=path.resolve(`.delivery-transfer-${process.pid}.mjs`);
fs.writeFileSync(script,source.slice(0,anchor)+`fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify(p));process.exit(0);`);
let fixture;
try{execFileSync(process.execPath,[script],{stdio:'pipe',timeout:480000,maxBuffer:64*1024*1024});fixture=JSON.parse(fs.readFileSync(capture,'utf8'));}
finally{fs.rmSync(script,{force:true});fs.rmSync(capture,{force:true});}
const value=engine.recordValue,id=(r,c)=>engine.recordId(r,c),fresh=()=>structuredClone(fixture),cases=[],faults=[];
const deliveryId=p=>id(engine.recordsForCurrentScope(p,'deliveryRecords').at(-1),'deliveryRecords');
const attempt=(p,options={})=>engine.recordDeliveryAttempt(p,{deliveryId:deliveryId(p),commandId:'CONTROLLED-TRANSFER-1',...options});
function check(name,run){process.stderr.write('delivery: '+name+'\n');try{run();cases.push({name,result:'PASS'});}catch(error){cases.push({name,result:'FAIL',message:error.message});}process.stderr.write('delivery: '+cases.at(-1).result+' '+name+'\n');}

// A valid authorized project must be able to retain its application-owned
// transfer receipt before the browser side effect. Use the persistence
// validator, not a save stub, for the initial receipt and every outcome.
function receiptPersistenceOracle(runtimeEngine,runtimeStore,copy=structuredClone){
  const control=copy(fixture);runtimeEngine.recalculate(control);
  const controlIntegrity=runtimeStore.validateProjectIntegrity(control);
  assert.equal(controlIntegrity.valid,true,'The otherwise valid delivery fixture must pass canonical integrity before the operation: '+controlIntegrity.issues.join(' | '));
  for(const result of ['PENDING','SUCCEEDED','FAILED','UNKNOWN']){
    const p=copy(control),first=runtimeEngine.recordDeliveryAttempt(p,{commandId:'CONTROLLED-TRANSFER-1',result});runtimeEngine.recalculate(p);
    const integrity=runtimeStore.validateProjectIntegrity(p);
    assert.equal(integrity.valid,true,'DELIVERY_RECEIPT_PERSISTENCE_ORACLE: '+result+': '+integrity.issues.join(' | '));
    assert.equal(runtimeEngine.deliveryTransferPrecondition(p).deliveryId,deliveryId(p),'A receipt must not invalidate its own delivery authorization.');
    if(result==='PENDING')for(const outcome of ['SUCCEEDED','FAILED','UNKNOWN']){
      const completed=copy(p),before=JSON.stringify(first),receipt=runtimeEngine.completeDeliveryAttempt(completed,{attemptId:id(first,'deliveryAttempts'),result:outcome});runtimeEngine.recalculate(completed);
      const final=runtimeStore.validateProjectIntegrity(completed);
      assert.equal(final.valid,true,'DELIVERY_RECEIPT_PERSISTENCE_ORACLE: '+outcome+' completion: '+final.issues.join(' | '));
      assert.equal(JSON.stringify(completed.projectData.deliveryAttempts[0]),before,'Completion mutated the retained initial receipt.');
      assert.equal(value(receipt,'PREVIOUS_ATTEMPT_ID'),id(first,'deliveryAttempts'),'Completion lost its exact predecessor.');
    }
  }
}
check('authorized transfer receipts remain durably valid through every result',()=>receiptPersistenceOracle(engine,globalThis.closedLoopProjectStore));
check('the persistence oracle detects an invalid initial receipt and preserves strict reference validation',()=>{
  const source=fs.readFileSync('workflow-engine.js','utf8'),before='COMMAND_ID:commandId,HUMAN_DELIVERY_AUTHORIZATION_ID:intentId';
  assert.equal(source.split(before).length-1,1,'The receipt fault must alter exactly one constructor.');
  const injected=source.replace(before,"COMMAND_ID:commandId,PREVIOUS_ATTEMPT_ID:'',HUMAN_DELIVERY_AUTHORIZATION_ID:intentId");
  const fault=projectStoreRuntime({sourceOverrides:{'workflow-engine.js':injected}});
  assert.throws(()=>receiptPersistenceOracle(fault.engine,fault.store,fault.copy),/DELIVERY_RECEIPT_PERSISTENCE_ORACLE: PENDING:/,'DELIVERY_RECEIPT_FAULT_ORACLE: malformed initial receipt was not detected.');
  const p=fresh(),pending=attempt(p,{result:'PENDING'}),completed=engine.completeDeliveryAttempt(p,{attemptId:id(pending,'deliveryAttempts'),result:'SUCCEEDED'});
  completed.fields.PREVIOUS_ATTEMPT_ID=completed.PREVIOUS_ATTEMPT_ID='MISSING-DELIVERY-ATTEMPT';engine.refreshRecordHashes(completed,'deliveryAttempts');engine.recalculate(p);
  const rejected=globalThis.closedLoopProjectStore.validateProjectIntegrity(p);
  assert.equal(rejected.valid,false,'DELIVERY_RECEIPT_REFERENCE_ORACLE: a nonexistent predecessor was accepted.');
  assert.ok(rejected.issues.some(issue=>issue.includes('PREVIOUS_ATTEMPT_ID references missing deliveryAttempts record')),'The rejection must identify the deliberately broken receipt link.');
  assert.equal(fs.readFileSync('workflow-engine.js','utf8'),source,'Fault injection modified the retained implementation.');
  faults.push({faultId:'DELIVERY-INVALID-INITIAL-RECEIPT',file:'workflow-engine.js',originalSha256:h.sha256Text(source),injectedSha256:h.sha256Text(injected),caughtBy:'DELIVERY_RECEIPT_PERSISTENCE_ORACLE',result:'DETECTED',sourceRestored:true});
});

// These outcomes follow §36.11: authorization and current scope before transfer,
// one receipt per actual action, append-only history, and attributable completion.
check('default transfer uses the authorized destination and channel',()=>{const p=fresh(),r=attempt(p),intent=engine.records(p,'humanDecisions').find(r=>value(r,'PURPOSE')==='DELIVERY_INTENT'),v=value(intent,'VALUE');assert.equal(value(r,'INTENDED_RECIPIENT_OR_DESTINATION'),v.destination);assert.equal(value(r,'CHANNEL'),v.transferChannel);});
check('exact command retry is idempotent and a new transfer consumes a new allowance',()=>{const p=fresh(),r=attempt(p);assert.equal(id(attempt(p),'deliveryAttempts'),id(r,'deliveryAttempts'));assert.throws(()=>attempt(p,{commandId:'CONTROLLED-TRANSFER-2'}),/transfer count.*exhausted/i);});
check('pending transfer consumes its allowance before any export',()=>{const p=fresh(),r=attempt(p,{result:'PENDING'});assert.equal(value(r,'RESULT'),'PENDING');assert.throws(()=>attempt(p,{commandId:'CONTROLLED-TRANSFER-2',result:'PENDING'}),/transfer count.*exhausted/i);});
check('command identity cannot be reused with different input',()=>{const p=fresh();attempt(p,{result:'PENDING'});assert.throws(()=>attempt(p,{result:'SUCCEEDED'}),/command.*different|retry.*payload/i);});
check('completion appends a receipt and preserves the pending receipt',()=>{const p=fresh(),pending=attempt(p,{result:'PENDING'}),before=JSON.stringify(pending),done=engine.completeDeliveryAttempt(p,{attemptId:id(pending,'deliveryAttempts'),result:'SUCCEEDED'});assert.equal(JSON.stringify(pending),before);assert.notEqual(id(done,'deliveryAttempts'),id(pending,'deliveryAttempts'));assert.equal(value(done,'PREVIOUS_ATTEMPT_ID'),id(pending,'deliveryAttempts'));assert.equal(id(engine.completeDeliveryAttempt(p,{attemptId:id(pending,'deliveryAttempts'),result:'SUCCEEDED'}),'deliveryAttempts'),id(done,'deliveryAttempts'));});
check('unrelated human observation cannot establish delivery',()=>{const p=fresh(),r=attempt(p),e={id:'EVIDENCE-UNRELATED',source:'HUMAN_OBSERVATION',active:true,stage:30,scope:engine.currentScope(p),fields:{EVIDENCE_ID:'EVIDENCE-UNRELATED',APPLICATION_EVIDENCE_KIND:'HUMAN_OBSERVATION',APPLICATION_EVIDENCE_CONTENT:'Observed an unrelated verification test.',STATUS:'CURRENT'}};engine.refreshRecordHashes(e,'evidenceRecords');p.projectData.evidenceRecords.push(e);assert.throws(()=>engine.recordDeliveryEvidence(p,{attemptId:id(r,'deliveryAttempts'),evidenceIds:[e.id]}),/bound.*attempt|delivery.*binding/i);});
check('direct human observation binds exact transfer and preserves its actual basis',()=>{const p=fresh(),r=attempt(p),before=JSON.stringify(r),result=engine.recordDeliveryEvidence(p,{attemptId:id(r,'deliveryAttempts'),outcome:'RECEIVED',observation:'I opened the exported file in the authorized destination and verified the content.',evidenceDescription:'Operator selected exported file in Files.',operatorLabel:'SYNTHETIC-OPERATOR'});assert.equal(JSON.stringify(r),before);assert.equal(result.epistemicBasis,'HUMAN_OBSERVATION');assert.equal(engine.deliveryAttemptState(p,r).status,'DELIVERED');assert.equal(engine.operationalNextAction(p,30).actionType,'COMPLETE');});
check('interrupted transfer remains unresolved after reload until an observation is supplied',()=>{let p=fresh();const pending=attempt(p,{result:'PENDING'});p=JSON.parse(JSON.stringify(p));engine.recalculate(p);assert.equal(engine.operationalNextAction(p,30).actionType,'RECORD_DELIVERY_EVIDENCE');assert.notEqual(engine.deliveryAttemptState(p,pending).status,'DELIVERED');assert.throws(()=>engine.recordDeliveryEvidence(p,{attemptId:id(pending,'deliveryAttempts'),outcome:'RECEIVED',observation:''}),/observation|evidence/i);const result=engine.recordDeliveryEvidence(p,{attemptId:id(pending,'deliveryAttempts'),outcome:'RECEIVED',observation:'I found and opened the exported copy after reloading.',operatorLabel:'SYNTHETIC-OPERATOR'});assert.equal(result.epistemicBasis,'HUMAN_OBSERVATION');assert.equal(engine.operationalNextAction(p,30).actionType,'COMPLETE');});
check('completion evidence cannot reuse a withdrawn authorization',()=>{const p=fresh(),r=attempt(p);engine.invalidateDownstream(p,28,'Synthetic upstream correction');assert.throws(()=>engine.recordDeliveryEvidence(p,{attemptId:id(r,'deliveryAttempts'),outcome:'RECEIVED',observation:'An old transfer was seen.',operatorLabel:'SYNTHETIC-OPERATOR'}),/current delivery-attempt|current.*authoriz|stale|withdrawn/i);});
check('failure outcome cannot be changed by retry',()=>{const p=fresh(),r=attempt(p,{result:'PENDING'});engine.completeDeliveryAttempt(p,{attemptId:id(r,'deliveryAttempts'),result:'FAILED'});assert.throws(()=>engine.completeDeliveryAttempt(p,{attemptId:id(r,'deliveryAttempts'),result:'SUCCEEDED'}),/different|already.*outcome/i);});
check('a negative or uncertain human outcome does not establish delivery',()=>{for(const outcome of ['NOT_RECEIVED','UNKNOWN']){const p=fresh(),r=attempt(p);const result=engine.recordDeliveryEvidence(p,{attemptId:id(r,'deliveryAttempts'),outcome,observation:'I checked the destination.',operatorLabel:'SYNTHETIC-OPERATOR'});assert.equal(result.status,'ATTEMPTED');assert.equal(engine.operationalNextAction(p,30).actionType,'RECORD_DELIVERY_EVIDENCE');}});

// Execute the real UI transfer function. The disposable store is the fault
// boundary here; this evidence does not claim actual browser file transport.
const appSource=fs.readFileSync('app-core.js','utf8');
async function uiCase(name,{priorAttempt=false,failSave=false,failTransfer=false,staleBeforeTransfer=false}={}){
  process.stderr.write('delivery: '+name+'\n');
  try{
    let persisted=fresh(),exports=0,errors=[],saves=0;
    if(priorAttempt)attempt(persisted);
    const api={
      engine,project:structuredClone(persisted),
      read:async()=>{const p=structuredClone(persisted);if(staleBeforeTransfer)engine.invalidateDownstream(p,28,'Concurrent correction');return p;},
      persist:async p=>{saves++;if(failSave)throw new Error('Injected storage write failure');const next=structuredClone(p);next.revision++;engine.recalculate(next);const integrity=globalThis.closedLoopProjectStore.validateProjectIntegrity(next);assert.equal(integrity.valid,true,'DELIVERY_UI_RECEIPT_PERSISTENCE_ORACLE: '+integrity.issues.join(' | '));persisted=next;return structuredClone(persisted);},
      transfer:()=>{assert.equal(value(engine.records(persisted,'deliveryAttempts').at(-1),'RESULT'),'PENDING','The transfer began before a pending receipt was committed.');exports++;if(failTransfer)throw new Error('Injected browser transfer failure');},
      error:e=>errors.push(e.message)
    };
    // The controller runs in a VM while these deliberately injected engine
    // and storage boundaries run in the host realm. Keep their project values
    // in that same realm; the shared runtime supports this explicit override.
    const context=createVerifierRuntime({api,console,URL,Blob,crypto:globalThis.crypto,structuredClone:value=>structuredClone(value),setTimeout,clearTimeout,document:{currentScript:null,querySelector:()=>({focus(){},setAttribute(){},removeAttribute(){},addEventListener(){}})},requestAnimationFrame:fn=>fn()});
    vm.runInContext(appSource.slice(0,appSource.indexOf('globalThis.closedLoopAppReady=false;'))+`
      engine=api.engine;current=api.project;current.activeStage=30;
      projectStore={readProject:api.read,assertRecoveryTransfer:async project=>engine.deliveryTransferPrecondition(project)};
      persistReplacement=async p=>{current=await api.persist(p);};
      verifiedCanonicalArtifact=async artifactId=>({blob:new Blob(['synthetic transfer']),filename:artifactId});
      downloadBlob=api.transfer;render=()=>{};announce=()=>{};reportActionFailure=api.error;
      focusAfterAction=()=>{};
      globalThis.runTransfer=exportAuthorizedArtifacts;
    })();`,context);
    await context.runTransfer();
    if(priorAttempt||failSave||staleBeforeTransfer){assert.equal(exports,0);assert.ok(errors.length);}
    else if(failTransfer){assert.equal(exports,1,JSON.stringify(errors));assert.equal(value(engine.records(persisted,'deliveryAttempts').at(-1),'RESULT'),'UNKNOWN');assert.ok(errors.length);}
    else{assert.ok(exports>0,JSON.stringify(errors));assert.equal(value(engine.records(persisted,'deliveryAttempts').at(-1),'RESULT'),'SUCCEEDED');assert.deepEqual(errors,[]);assert.equal(engine.deliveryAttemptState(persisted,engine.records(persisted,'deliveryAttempts').at(-1)).status,'ATTEMPTED');}
    cases.push({name,result:'PASS',exports,saves,environment:'Actual app function with disposable storage and transfer boundary'});
  }catch(error){cases.push({name,result:'FAIL',message:error.message});}
  process.stderr.write('delivery: '+cases.at(-1).result+' '+name+'\n');
}
await uiCase('UI checks the exhausted transfer allowance before exporting',{priorAttempt:true});
await uiCase('UI exports nothing when the pending receipt cannot be saved',{failSave:true});
await uiCase('UI checks a concurrent upstream correction immediately before transfer',{staleBeforeTransfer:true});
await uiCase('UI preserves uncertainty after an interrupted browser transfer',{failTransfer:true});
await uiCase('UI records authorization, transfer, and completion evidence separately');

console.log(JSON.stringify({deliveryTransferBoundary:cases.every(c=>c.result==='PASS')?'PASS':'FAIL',basis:'SYNTHETIC_PRODUCTION_LIFECYCLE',specificationSections:['36.11','36.12','38','50.1'],sourceIdentity:{engineSha256:h.sha256Text(fs.readFileSync('workflow-engine.js','utf8')),verifierSha256:h.sha256Text(fs.readFileSync('verify-delivery-transfer-boundary.mjs','utf8'))},faults,cases},null,2));
if(cases.some(c=>c.result!=='PASS'))process.exitCode=1;
