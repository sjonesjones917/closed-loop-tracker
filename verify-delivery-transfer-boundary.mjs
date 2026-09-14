import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const engine=globalThis.closedLoopWorkflowEngine,h=globalThis.closedLoopHash;
const source=fs.readFileSync('verify-full-cycle.mjs','utf8'),anchor=source.indexOf('engine.recordDeliveryAttempt(p');
assert.ok(anchor>0);
const capture=path.join(os.tmpdir(),`delivery-transfer-${process.pid}.json`),script=path.resolve(`.delivery-transfer-${process.pid}.mjs`);
fs.writeFileSync(script,source.slice(0,anchor)+`fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify(p));process.exit(0);`);
let fixture;
try{execFileSync(process.execPath,[script],{stdio:'pipe',maxBuffer:64*1024*1024});fixture=JSON.parse(fs.readFileSync(capture,'utf8'));}
finally{fs.rmSync(script,{force:true});fs.rmSync(capture,{force:true});}
const value=engine.recordValue,id=(r,c)=>engine.recordId(r,c),fresh=()=>structuredClone(fixture),cases=[];
const deliveryId=p=>id(engine.recordsForCurrentScope(p,'deliveryRecords').at(-1),'deliveryRecords');
const attempt=(p,options={})=>engine.recordDeliveryAttempt(p,{deliveryId:deliveryId(p),commandId:'CONTROLLED-TRANSFER-1',...options});
function check(name,run){try{run();cases.push({name,result:'PASS'});}catch(error){cases.push({name,result:'FAIL',message:error.message});}}

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
  try{
    let persisted=fresh(),exports=0,errors=[],saves=0;
    if(priorAttempt)attempt(persisted);
    const api={
      engine,project:structuredClone(persisted),
      read:async()=>{const p=structuredClone(persisted);if(staleBeforeTransfer)engine.invalidateDownstream(p,28,'Concurrent correction');return p;},
      persist:async p=>{saves++;if(failSave)throw new Error('Injected storage write failure');persisted=structuredClone(p);persisted.revision++;engine.recalculate(persisted);return structuredClone(persisted);},
      transfer:()=>{assert.equal(value(engine.records(persisted,'deliveryAttempts').at(-1),'RESULT'),'PENDING','The transfer began before a pending receipt was committed.');exports++;if(failTransfer)throw new Error('Injected browser transfer failure');},
      error:e=>errors.push(e.message)
    };
    const context=vm.createContext({api,console,URL,Blob,crypto:globalThis.crypto,structuredClone,setTimeout,clearTimeout,document:{currentScript:null,querySelector:()=>({focus(){},setAttribute(){},removeAttribute(){},addEventListener(){}})},requestAnimationFrame:fn=>fn()});
    vm.runInContext(appSource.slice(0,appSource.indexOf('globalThis.closedLoopAppReady=false;'))+`
      engine=api.engine;current=api.project;current.activeStage=30;
      projectStore={readProject:api.read};
      persistReplacement=async p=>{current=await api.persist(p);};
      verifiedCanonicalArtifact=async artifactId=>({blob:new Blob(['synthetic transfer']),filename:artifactId});
      downloadBlob=api.transfer;render=()=>{};announce=()=>{};reportActionFailure=api.error;
      globalThis.runTransfer=exportAuthorizedArtifacts;
    })();`,context);
    await context.runTransfer();
    if(priorAttempt||failSave||staleBeforeTransfer){assert.equal(exports,0);assert.ok(errors.length);}
    else if(failTransfer){assert.equal(exports,1);assert.equal(value(engine.records(persisted,'deliveryAttempts').at(-1),'RESULT'),'UNKNOWN');assert.ok(errors.length);}
    else{assert.ok(exports>0);assert.equal(value(engine.records(persisted,'deliveryAttempts').at(-1),'RESULT'),'SUCCEEDED');assert.deepEqual(errors,[]);assert.equal(engine.deliveryAttemptState(persisted,engine.records(persisted,'deliveryAttempts').at(-1)).status,'ATTEMPTED');}
    cases.push({name,result:'PASS',exports,saves,environment:'Actual app function with disposable storage and transfer boundary'});
  }catch(error){cases.push({name,result:'FAIL',message:error.message});}
}
await uiCase('UI checks the exhausted transfer allowance before exporting',{priorAttempt:true});
await uiCase('UI exports nothing when the pending receipt cannot be saved',{failSave:true});
await uiCase('UI checks a concurrent upstream correction immediately before transfer',{staleBeforeTransfer:true});
await uiCase('UI preserves uncertainty after an interrupted browser transfer',{failTransfer:true});
await uiCase('UI records authorization, transfer, and completion evidence separately');

console.log(JSON.stringify({deliveryTransferBoundary:cases.every(c=>c.result==='PASS')?'PASS':'FAIL',basis:'SYNTHETIC_PRODUCTION_LIFECYCLE',specificationSections:['36.11','36.12','38'],cases},null,2));
if(cases.some(c=>c.result!=='PASS'))process.exitCode=1;
