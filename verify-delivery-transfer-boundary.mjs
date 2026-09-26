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
// Capture historical context bytes when their authoritative producer creates
// each instruction. They cannot be regenerated from a later project version.
const captureContext=`
const retainedContextFiles=new Map(),fixturePromptOwner=globalThis.closedLoopPromptEngine;
function retainContext(record,project){for(const file of fixturePromptOwner.materializePromptContextFiles(record,project))retainedContextFiles.set(file.sha256,file);}
globalThis.closedLoopPromptEngine=Object.freeze({...fixturePromptOwner,
  buildPromptRecord(...args){const record=fixturePromptOwner.buildPromptRecord(...args);retainContext(record,args[0]);return record;},
  reserveAndBuildPromptRecord(...args){const result=fixturePromptOwner.reserveAndBuildPromptRecord(...args);retainContext(result.prompt,args[0]);return result;}
});
`;
const fixturePrefix=source.slice(0,anchor).replace('const core=globalThis.closedLoopCore',captureContext+'const core=globalThis.closedLoopCore');
assert.ok(fixturePrefix.includes(captureContext),'The lifecycle fixture must capture context at generation time.');
fs.writeFileSync(script,fixturePrefix+`fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify({project:p,files:[candidateBytes,productBytes].map(bytes=>Array.from(bytes)),contextFiles:[...retainedContextFiles.values()]}));process.exit(0);`);
let fixture,fixtureFiles,fixtureContextFiles;
try{execFileSync(process.execPath,[script],{stdio:'pipe',timeout:480000,maxBuffer:64*1024*1024});const generated=JSON.parse(fs.readFileSync(capture,'utf8'));fixture=generated.project;fixtureFiles=generated.files;fixtureContextFiles=generated.contextFiles;}
finally{fs.rmSync(script,{force:true});fs.rmSync(capture,{force:true});}
const value=engine.recordValue,id=(r,c)=>engine.recordId(r,c),fresh=()=>structuredClone(fixture),cases=[],faults=[];
const deliveryId=p=>id(engine.recordsForCurrentScope(p,'deliveryRecords').at(-1),'deliveryRecords');
const attempt=(p,options={})=>engine.recordDeliveryAttempt(p,{deliveryId:deliveryId(p),commandId:'CONTROLLED-TRANSFER-1',...options});
function check(name,run){process.stderr.write('delivery: '+name+'\n');try{run();cases.push({name,result:'PASS'});}catch(error){cases.push({name,result:'FAIL',message:error.message,underlying:error.actual?.message||null,stack:error.stack});}process.stderr.write('delivery: '+cases.at(-1).result+' '+name+'\n');}

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
    const expectedAction=result==='FAILED'?'EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS':'RECORD_DELIVERY_EVIDENCE';
    assert.equal(p.job.NEXT_REQUIRED_ACTION.actionType,expectedAction,'DELIVERY_NEXT_ACTION_ORACLE: the stored next action must retain the required operation after '+result+'.');
    const authorizedId=runtimeEngine.recordId(runtimeEngine.recordsForCurrentScope(p,'deliveryRecords').at(-1),'deliveryRecords');
    assert.equal(runtimeEngine.deliveryTransferPrecondition(p).deliveryId,authorizedId,'A receipt must not invalidate its own delivery authorization.');
    if(result==='PENDING')for(const outcome of ['SUCCEEDED','FAILED','UNKNOWN']){
      const completed=copy(p),before=JSON.stringify(first),receipt=runtimeEngine.completeDeliveryAttempt(completed,{attemptId:id(first,'deliveryAttempts'),result:outcome});runtimeEngine.recalculate(completed);
      const final=runtimeStore.validateProjectIntegrity(completed);
      assert.equal(final.valid,true,'DELIVERY_RECEIPT_PERSISTENCE_ORACLE: '+outcome+' completion: '+final.issues.join(' | '));
      assert.equal(completed.job.NEXT_REQUIRED_ACTION.actionType,outcome==='FAILED'?'EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS':'RECORD_DELIVERY_EVIDENCE','DELIVERY_NEXT_ACTION_ORACLE: a completed transfer must retain its evidence operation after '+outcome+'.');
      assert.equal(JSON.stringify(completed.projectData.deliveryAttempts[0]),before,'Completion mutated the retained initial receipt.');
      assert.equal(value(receipt,'PREVIOUS_ATTEMPT_ID'),id(first,'deliveryAttempts'),'Completion lost its exact predecessor.');
    }
  }
}
check('authorized transfer receipts remain durably valid through every result',()=>receiptPersistenceOracle(engine,globalThis.closedLoopProjectStore));
check('the continuation oracle detects premature completion after the final stage gate',()=>{
  const source=fs.readFileSync('workflow-engine.js','utf8'),before='project.job.NEXT_REQUIRED_ACTION=nextAction(project,currentStage);';
  assert.equal(source.split(before).length-1,1,'The continuation fault must alter exactly one projection owner.');
  const injected=source.replace(before,"project.job.NEXT_REQUIRED_ACTION=completed===30?actionEnvelope(project,currentStage,{actionType:'COMPLETE',heading:'Workflow complete',explanation:'Preserve the completed workflow and exact release evidence.',primaryButton:null}):nextAction(project,currentStage);");
  const fault=projectStoreRuntime({sourceOverrides:{'workflow-engine.js':injected}});
  assert.throws(()=>receiptPersistenceOracle(fault.engine,fault.store,fault.copy),/DELIVERY_NEXT_ACTION_ORACLE: a completed transfer.*SUCCEEDED/,'DELIVERY_NEXT_ACTION_FAULT_ORACLE: premature completion was not detected.');
  assert.equal(fs.readFileSync('workflow-engine.js','utf8'),source);
  faults.push({faultId:'DELIVERY-PREMATURE-TERMINAL-COMPLETION',file:'workflow-engine.js',originalSha256:h.sha256Text(source),injectedSha256:h.sha256Text(injected),caughtBy:'DELIVERY_NEXT_ACTION_ORACLE',result:'DETECTED',sourceRestored:true});
});
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
function actionView(project,source=appSource){
  const api={project,engine,schema:globalThis.closedLoopWorkflowSchema,core:globalThis.closedLoopCore};
  const context=createVerifierRuntime({api,console,URL,Blob,crypto:globalThis.crypto,structuredClone:value=>structuredClone(value),document:{currentScript:null,querySelector:()=>({value:'',focus(){},setAttribute(){},removeAttribute(){},addEventListener(){}})}});
  vm.runInContext(source.slice(0,source.indexOf('globalThis.closedLoopAppReady=false;'))+`
    engine=api.engine;schema=api.schema;core=api.core;current=api.project;
    globalThis.actionView={action:displayedStageAction(current.activeStage),html:nextActionMarkup(true,current.activeStage)};
  })();`,context);
  return context.actionView;
}
function deliveryViewOracle(project,expected='RECORD_DELIVERY_EVIDENCE',source=appSource){
  const before=structuredClone(project),view=actionView(project,source);
  assert.equal(view.action.actionType,expected,'DELIVERY_RENDERED_ACTION_ORACLE: the selected version must expose its actual remaining operation.');
  for(const control of ['delivery-observed-outcome','delivery-observation','record-delivery-evidence'])assert.equal(view.html.includes('id="'+control+'"'),expected==='RECORD_DELIVERY_EVIDENCE','DELIVERY_RENDERED_ACTION_ORACLE: the required delivery control is missing or incorrectly retained: '+control);
  assert.deepEqual(project,before,'Displaying a retained version must not rewrite its canonical data or saved projection.');
}
check('retained successful transfer exposes its required observation despite an obsolete saved action',()=>{
  const p=fresh();p.activeStage=globalThis.closedLoopWorkflowSchema.STAGE_COUNT;attempt(p,{result:'SUCCEEDED'});engine.recalculate(p);
  // Obsolete completion classification emitted by the pre-repair kernel.
  // Retained versions must remain immutable while current controls derive from
  // that version's actual transfer and evidence records.
  p.job.NEXT_REQUIRED_ACTION={...p.job.NEXT_REQUIRED_ACTION,actionType:'COMPLETE',primaryButton:null};
  deliveryViewOracle(p);
});
check('the rendered-action oracle rejects trusting an obsolete retained projection',()=>{
  const p=fresh();p.activeStage=globalThis.closedLoopWorkflowSchema.STAGE_COUNT;attempt(p,{result:'SUCCEEDED'});engine.recalculate(p);
  p.job.NEXT_REQUIRED_ACTION={...p.job.NEXT_REQUIRED_ACTION,actionType:'COMPLETE',primaryButton:null};
  const before='return engine.operationalNextAction(current,canonicalCurrentStage());';
  assert.equal(appSource.split(before).length-1,1,'The retained-action fault must alter exactly one display owner.');
  const injected=appSource.replace(before,'return current.job.NEXT_REQUIRED_ACTION;');
  assert.throws(()=>deliveryViewOracle(p,'RECORD_DELIVERY_EVIDENCE',injected),/DELIVERY_RENDERED_ACTION_ORACLE/);
  deliveryViewOracle(p);
  assert.equal(fs.readFileSync('app-core.js','utf8'),appSource);
  faults.push({faultId:'DELIVERY-TRUST-OBSOLETE-SAVED-ACTION',file:'app-core.js',originalSha256:h.sha256Text(appSource),injectedSha256:h.sha256Text(injected),caughtBy:'DELIVERY_RENDERED_ACTION_ORACLE',result:'DETECTED',sourceRestored:true});
});
check('receipt outcomes retain the required controls across reload without asserting physical delivery',()=>{
  for(const outcome of ['RECEIVED','NOT_RECEIVED','UNKNOWN']){
    let p=fresh();p.activeStage=globalThis.closedLoopWorkflowSchema.STAGE_COUNT;
    const receipt=attempt(p,{result:'SUCCEEDED'}),retained=JSON.stringify(receipt);
    engine.recalculate(p);deliveryViewOracle(p);
    const completed=Object.values(p.stages).filter(stage=>stage.status==='COMPLETE').length;
    assert.equal(completed,globalThis.closedLoopWorkflowSchema.STAGE_COUNT,'Successful controlled transfer completes the stage gates before attributed delivery is established.');
    const result=engine.recordDeliveryEvidence(p,{attemptId:id(receipt,'deliveryAttempts'),outcome,observation:'Synthetic operator checked the authorized destination.',operatorLabel:'SYNTHETIC-OPERATOR'});
    assert.equal(result.epistemicBasis,'HUMAN_OBSERVATION');
    p=JSON.parse(JSON.stringify(p));engine.recalculate(p);
    const expected=outcome==='RECEIVED'?'COMPLETE':'RECORD_DELIVERY_EVIDENCE';
    assert.equal(p.job.NEXT_REQUIRED_ACTION.actionType,expected);deliveryViewOracle(p,expected);
    assert.equal(JSON.stringify(p.projectData.deliveryAttempts[0]),retained,'An observation or reload rewrote the retained transfer receipt.');
    assert.equal(Object.values(p.stages).filter(stage=>stage.status==='COMPLETE').length,completed,'An observation must not conflate stage completion with attributed delivery.');
  }
});
process.stderr.write('delivery: restore transfer and observation versions without replaying delivery\n');
let restorationPhase='build disposable persistence';
try{
  const r=projectStoreRuntime(),jobId=fixture.job.JOB_ID,versions=[];
  let p=r.copy(fixture);p.activeStage=r.runtime.closedLoopWorkflowSchema.STAGE_COUNT;
  // Supply the producer's saved bytes at the historical custody boundary.
  // The real storage writer still hashes, stores and verifies every file.
  for(const file of fixtureContextFiles)assert.equal(h.sha256Text(file.text),file.sha256,'Captured prompt context bytes must match their original identity.');
  r.runtime.closedLoopPromptEngine=Object.freeze({...r.runtime.closedLoopPromptEngine,materializePromptContextFiles:record=>r.copy((record.contextManifest?.promptContext?.attachments||[]).map(required=>{
    const file=fixtureContextFiles.find(file=>file.sha256===required.sha256&&file.byteSize===required.byteSize);
    assert.ok(file,'The lifecycle producer did not retain an authorized historical context file.');return file;
  }))});
  const files=await Promise.all(fixtureFiles.map(async bytes=>{const blob=new Blob([Uint8Array.from(bytes)]);return {blob,sha256:await h.sha256Bytes(blob)};}));
  for(const artifact of r.engine.records(p,'artifacts')){
    const file=files.find(file=>file.sha256===r.engine.recordValue(artifact,'SHA256'));
    assert.ok(file,'The lifecycle builder must provide every retained artifact’s exact bytes.');
    await r.store.putArtifact({artifactId:r.engine.recordId(artifact,'artifacts'),jobId,filename:r.engine.recordValue(artifact,'FILENAME'),mediaType:r.engine.recordValue(artifact,'MEDIA_TYPE'),blob:file.blob});
  }
  restorationPhase='save the authorized lifecycle fixture';
  p=await r.store.writeProject(p,{expectedProjectRevision:0,createOnly:true});
  await r.store.beginHistorySession('DELIVERY-CONTINUATION');
  async function retain(expected){versions.push({id:(await r.store.historyList(jobId)).activeId,project:JSON.parse(JSON.stringify(p)),expected});}
  await retain('EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS');
  let next=r.copy(p);r.engine.recordDeliveryAttempt(next,{commandId:'HISTORY-CONTROLLED-TRANSFER',result:'SUCCEEDED'});
  restorationPhase='save successful transfer';
  p=await r.store.writeProject(next,{expectedProjectRevision:p.revision});await retain('RECORD_DELIVERY_EVIDENCE');
  next=r.copy(p);const receipt=r.engine.records(next,'deliveryAttempts').at(-1);
  r.engine.recordDeliveryEvidence(next,{attemptId:r.engine.recordId(receipt,'deliveryAttempts'),outcome:'RECEIVED',observation:'Synthetic receipt of the exact controlled transfer.',operatorLabel:'SYNTHETIC-OPERATOR'});
  restorationPhase='save attributed observation';
  p=await r.store.writeProject(next,{expectedProjectRevision:p.revision});await retain('COMPLETE');
  for(const point of [...versions].reverse().concat(versions)){
    restorationPhase='restore '+point.expected;
    p=(await r.store.restoreCheckpoint(jobId,point.id,{expectedProjectRevision:p.revision})).project;
    const reloaded=JSON.parse(JSON.stringify(await r.store.readProject(jobId)));
    assert.deepEqual(reloaded.projectData,point.project.projectData,'Restoration must retain the matching transfer/evidence history without replaying a command.');
    assert.deepEqual(reloaded.stages,point.project.stages,'Restoration mixed stage completion across delivery versions.');
    assert.equal(reloaded.job.NEXT_REQUIRED_ACTION.actionType,point.expected);
    restorationPhase='render '+point.expected;deliveryViewOracle(reloaded,point.expected);
    for(const artifact of r.engine.records(p,'artifacts')){
      const stored=await r.store.getArtifact(r.engine.recordId(artifact,'artifacts'));
      assert.equal(await h.sha256Bytes(stored.blob),r.engine.recordValue(artifact,'SHA256'));
    }
    restorationPhase='reject repeated transfer '+point.expected;
    await assert.rejects(r.store.assertRecoveryTransfer(p),error=>error.code==='RETAINED_TRANSFER_LIMIT_REACHED','Restoration must not authorize a duplicate external transfer.');
  }
  cases.push({name:'restore transfer and observation versions without replaying delivery',result:'PASS',versions:versions.length,restores:versions.length*2,environment:'Production persistence with shared transaction adapter; no physical delivery asserted'});
}catch(error){cases.push({name:'restore transfer and observation versions without replaying delivery',result:'FAIL',message:error.message,phase:restorationPhase,stack:error.stack});}
process.stderr.write('delivery: '+cases.at(-1).result+' restore transfer and observation versions without replaying delivery\n');
async function uiCase(name,{priorAttempt=false,failSave=false,failTransfer=false,staleBeforeTransfer=false}={}){
  process.stderr.write('delivery: '+name+'\n');
  try{
    let persisted=fresh(),exports=0,errors=[],saves=0,rendered='';
    if(priorAttempt)attempt(persisted);
    const api={
      engine,schema:globalThis.closedLoopWorkflowSchema,core:globalThis.closedLoopCore,project:structuredClone(persisted),
      render:html=>{rendered=html;},
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
      engine=api.engine;schema=api.schema;core=api.core;current=api.project;current.activeStage=30;
      projectStore={readProject:api.read,assertRecoveryTransfer:async project=>engine.deliveryTransferPrecondition(project)};
      persistReplacement=async p=>{current=await api.persist(p);};
      verifiedCanonicalArtifact=async artifactId=>({blob:new Blob(['synthetic transfer']),filename:artifactId});
      downloadBlob=api.transfer;render=()=>api.render(nextActionMarkup(true,current.activeStage));announce=()=>{};reportActionFailure=api.error;
      focusAfterAction=()=>{};
      globalThis.runTransfer=exportAuthorizedArtifacts;
    })();`,context);
    await context.runTransfer();
    if(priorAttempt||failSave||staleBeforeTransfer){assert.equal(exports,0);assert.ok(errors.length);}
    else if(failTransfer){assert.equal(exports,1,JSON.stringify(errors));assert.equal(value(engine.records(persisted,'deliveryAttempts').at(-1),'RESULT'),'UNKNOWN');assert.ok(errors.length);assert.ok(rendered.includes('id="delivery-observed-outcome"'),'An uncertain transfer must offer attributable observation.');}
    else{assert.ok(exports>0,JSON.stringify(errors));assert.equal(value(engine.records(persisted,'deliveryAttempts').at(-1),'RESULT'),'SUCCEEDED');assert.deepEqual(errors,[]);assert.equal(engine.deliveryAttemptState(persisted,engine.records(persisted,'deliveryAttempts').at(-1)).status,'ATTEMPTED');assert.ok(rendered.includes('id="delivery-observed-outcome"'),'A successful export must expose the delivery-evidence control.');}
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
