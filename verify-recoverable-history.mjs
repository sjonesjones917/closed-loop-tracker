import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {projectStoreRuntime,bindProjectActivationUi,restoreArtifactFixture,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';
const mutation=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8),faults={
 'mixed-versions':{id:'RESTORE-INCOMPATIBLE-VERSIONS',file:'project-store.js',before:'let next=clone(saved.project);',after:'let next={...clone(saved.project),projectData:clone(prior.projectData)};'},
 'import-projection':{id:'IMPORT-PROJECTION-INTEGRITY',file:'project-store.js',before:'withVerifiedRecoveryCustody(verifiedArtifacts,()=>assertProjectIntegrity(project))',after:'withVerifiedRecoveryCustody(verifiedArtifacts,()=>assertProjectIntegrity(project,{verifyCachedProjection:false}))'},
 'history-projection':{id:'HISTORY-PROJECTION-INTEGRITY',file:'project-store.js',before:'try{assertProjectIntegrity(project);}catch(error){',after:'try{assertProjectIntegrity(project,{verifyCachedProjection:false});}catch(error){'},
 'mutate-retained':{id:'MUTATE-RETAINED-CHECKPOINT',file:'project-store.js',before:"meta.put({key:historyKey(state.jobId),value:state,updatedAt:now()});await updateRecoveryCatalog(meta,state);fault('during-history-write');",after:"if(state.entries.length>1){const previous=await request(meta.get(snapshotKey(state.jobId,state.entries[0].id)));previous.value.blob=new Blob(['deliberately mutated retained checkpoint']);meta.put(previous);}meta.put({key:historyKey(state.jobId),value:state,updatedAt:now()});await updateRecoveryCatalog(meta,state);fault('during-history-write');"}
};
if(mutation&&!faults[mutation])throw new Error('Unknown deliberate mutation.');
const r=projectStoreRuntime({fault:faults[mutation]}),{store,engine,core,runtime,rows,copy}=r;
const plain=value=>JSON.parse(JSON.stringify(value));
const id='SYNTHETIC-RECOVERY-REGRESSION',cases=[],verificationObservations=[],negativeCasePopulation=[];
const spec='specification/closed-loop-reliability-controlling-implementation-specification.txt';
function observedProjection(caseId,boundary,observed){const checkId='projection.recovery-canonical-authority',violation='stageProjectionsOverridingCanonicalRecords';negativeCasePopulation.push({caseId,checkId,violation,boundary,observed,accepted:false,result:'PASS'});const prior=verificationObservations.find(row=>row.checkId===checkId),actual={caseId,boundary,...observed};if(prior)prior.observed.cases.push(actual);else verificationObservations.push({checkId,requirementRefs:[spec+':4663',spec+':5530'],boundary:'Production store backup import, retained view read and checkpoint activation',expected:'Contradictory cached projection rejects before usable view or activation; canonical records remain authoritative.',observed:{cases:[actual]},passed:true,violation,accepted:false});}
const record=(name,details={})=>cases.push({name,...details,result:'PASS'});
let p=core.createBlankState(id);engine.ensureShape(p);engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:0,createOnly:true});
await store.beginHistorySession('SESSION-A');let history=await store.historyList(id);const start=history.sessions['SESSION-A'].checkpointId,starting=copy(p);
const bytes=new Blob([Uint8Array.of(0,13,10,255,65)]),file=await store.putArtifact({artifactId:artifactFixtureId(engine,p,'RECOVERY-ARTIFACT'),jobId:id,filename:'exact.bin',mediaType:'application/octet-stream',blob:bytes});
let next=copy(p);next.job.JOB_TITLE='First continuation';engine.registerArtifactBytes(next,{stage:1,artifactId:file.artifactId,filename:file.filename,mediaType:file.mediaType,byteSize:file.byteSize,sha256:file.sha256});p=await store.writeProject(next,{expectedProjectRevision:p.revision});
history=await store.historyList(id);const first=history.activeId,firstProject=copy(p);
next=copy(p);next.job.JOB_TITLE='Second continuation';p=await store.writeProject(next,{expectedProjectRevision:p.revision});history=await store.historyList(id);const second=history.activeId;
const restored=await store.restoreCheckpoint(id,first,{expectedProjectRevision:p.revision,mode:'UNDO'});p=restored.project;
assert.equal(p.job.JOB_TITLE,'First continuation');assert.equal((await store.getArtifact(file.artifactId,{jobId:id})).sha256,file.sha256);
const currentBytes=await store.getArtifact(file.artifactId,{jobId:id});assert.deepEqual(new Uint8Array(await currentBytes.blob.arrayBuffer()),new Uint8Array(await bytes.arrayBuffer()));
assert.deepEqual(p.projectData,firstProject.projectData);assert.deepEqual(p.stages,firstProject.stages);assert.ok(p.revision>firstProject.revision,'Restoration must preserve concurrency monotonicity.');
record('Restore complete project and exact non-text bytes');
await assert.rejects(store.writeProject(firstProject,{expectedProjectRevision:firstProject.revision}),error=>error.code==='STALE_PROJECT_REVISION');
record('Delayed response or stale tab cannot write after restore');
p=(await store.restoreCheckpoint(id,second,{expectedProjectRevision:p.revision,mode:'REDO'})).project;assert.equal(p.job.JOB_TITLE,'Second continuation');record('Redo restores saved continuation without executing commands');
p=(await store.restoreCheckpoint(id,first,{expectedProjectRevision:p.revision})).project;next=copy(p);next.job.JOB_TITLE='Alternative continuation';p=await store.writeProject(next,{expectedProjectRevision:p.revision});history=await store.historyList(id);assert.ok(history.entries.some(entry=>entry.id===second));const alternative=history.activeId;
record('New continuation retains previous alternative');
for(const target of [second,first,alternative,start,second,start]){p=(await store.restoreCheckpoint(id,target,{expectedProjectRevision:p.revision})).project;if(target===start){assert.deepEqual(p.projectData,starting.projectData);assert.equal((await store.listArtifacts(id)).length,0);}assert.ok((await store.historyList(id)).entries.some(entry=>entry.id===alternative));}
record('Repeated arbitrary multi-entry restoration preserves session start and alternatives',{restores:6});
const snapshotKey='recovery:'+id+':snapshot:'+first,original=copy(rows.get('meta').get(snapshotKey));
for(const fault of ['missing-snapshot','corrupt-snapshot','wrong-version','missing-file','corrupt-file','interrupted','write-failure']){
 const before=await store.readProject(id),beforeHistory=await store.historyList(id),fileKey='recovery:'+id+':bytes:'+file.sha256,originalFile=copy(rows.get('meta').get(fileKey));let signal;
 if(fault==='missing-snapshot')rows.get('meta').delete(snapshotKey);
 if(fault==='corrupt-snapshot'){const bad=copy(original);bad.value.blob=new Blob(['bad']);rows.get('meta').set(snapshotKey,bad);}
 if(fault==='wrong-version'){const bad=copy(original);bad.value.projectSha256='0'.repeat(64);rows.get('meta').set(snapshotKey,bad);}
 if(fault==='missing-file')rows.get('meta').delete(fileKey);
 if(fault==='corrupt-file'){const bad=copy(originalFile);bad.value.blob=new Blob(['bad']);rows.get('meta').set(fileKey,bad);}
 if(fault==='interrupted'){const controller=new AbortController();controller.abort();signal=controller.signal;}
 if(fault==='write-failure')runtime.__closedLoopStorageFault='during-history-restore';
 await assert.rejects(store.restoreCheckpoint(id,first,{expectedProjectRevision:before.revision,signal}),error=>['HISTORY_SNAPSHOT_INTEGRITY_FAILED','HISTORY_VERSION_MISMATCH','HISTORY_FILE_INTEGRITY_FAILED','RESTORE_INTERRUPTED','INJECTED_STORAGE_FAILURE'].includes(error.code),fault);
 delete runtime.__closedLoopStorageFault;rows.get('meta').set(snapshotKey,original);rows.get('meta').set(fileKey,originalFile);
 assert.deepEqual(await store.readProject(id),before,fault+' changed current state');assert.deepEqual(await store.historyList(id),beforeHistory,fault+' changed saved History');record('Rejected '+fault+' without partial activation');
}
// Exported bytes, not a copied JS object, must restore the retained alternatives.
p=await store.readProject(id);const exported=await store.exportPackage(id);const other=projectStoreRuntime();const imported=await other.store.importPackage(exported);assert.equal(imported.job.JOB_ID,id);const importedHistory=await other.store.historyList(id);assert.ok(importedHistory.entries.some(entry=>entry.id===alternative));assert.equal(importedHistory.sessions['SESSION-A'].checkpointId,start);
const recovered=(await other.store.restoreCheckpoint(id,first,{expectedProjectRevision:imported.revision})).project;assert.deepEqual(plain(recovered.projectData),plain(firstProject.projectData));const importedFile=await other.store.getArtifact(file.artifactId,{jobId:id});assert.deepEqual(new Uint8Array(await importedFile.blob.arrayBuffer()),new Uint8Array(await bytes.arrayBuffer()));
record('Exported backup bytes restore complete History and artifacts in a fresh store');
for(const phase of ['before-history-checkpoint','during-history-write','before-transaction-commit']){const before=await store.readProject(id),beforeHistory=await store.historyList(id);next=copy(before);next.job.JOB_TITLE='Must not commit';runtime.__closedLoopStorageFault=phase;await assert.rejects(store.writeProject(next,{expectedProjectRevision:before.revision}),error=>error.code==='INJECTED_STORAGE_FAILURE');delete runtime.__closedLoopStorageFault;assert.deepEqual(await store.readProject(id),before);assert.deepEqual(await store.historyList(id),beforeHistory);record('Checkpoint or commit failure preserves recovery: '+phase);}
// Replay the actual browser corruption gate through the shared storage runtime.
// Only its direct IndexedDB fault writes use this event adapter; project writes,
// integrity checks, recoverable removal and restoration use production owners.
const browserSource=fs.readFileSync(process.env.BROWSER_EXTRA_SOURCE||'verify-browser-extra.mjs','utf8'),contextExpression=browserSource.match(/const contextSaveProof=await evalValue\(cdp,`([\s\S]*?)`\);/)?.[1];
assert.equal(typeof contextExpression,'string','Browser context fault gate is unavailable');
for(const interruption of [false,true]){
 const r=projectStoreRuntime({sourceOverrides:process.env.STORE_SOURCE?{'project-store.js':fs.readFileSync(process.env.STORE_SOURCE,'utf8')}:{}}),writes=[];let original,projectBefore,historyBefore;
 const db={transaction(name,mode){
  assert.equal(name,'artifacts');assert.equal(mode,'readwrite');const pending=[],tx={objectStore(storeName){assert.equal(storeName,name);return {put(row){pending.push(r.copy(row));}};}};
  queueMicrotask(()=>{for(const row of pending){if(!original){original=r.copy(r.rows.get(name).get(row.artifactId));projectBefore=r.copy(r.rows.get('projects').get(row.jobId));historyBefore=r.copy(r.rows.get('meta').get('recovery:'+row.jobId));}writes.push(row);r.rows.get(name).set(row.artifactId,row);}tx.oncomplete?.();});return tx;
 }};
 r.runtime.closedLoopProjectStore={...r.store,openDatabase:async()=>db,readProject:async(...args)=>{
  if(interruption&&original&&writes.length===1)throw Object.assign(new Error('CONTROLLED_CONTEXT_OBSERVATION_FAILURE'),{code:'CONTROLLED_CONTEXT_OBSERVATION_FAILURE'});
  return r.store.readProject(...args);
 }};
 let proof,error;try{proof=await vm.runInContext(contextExpression,r.runtime);}catch(cause){error=cause;}
 assert(original&&writes[0].byteSize===original.byteSize+1,'CONTEXT_FAULT_INJECTION_ORACLE: the negative case must contain exactly one byte-size violation');
 if(!interruption)assert(!error,'CONTEXT_FAULT_LIFECYCLE_ORACLE: the valid negative test must finish and preserve recovery: '+String(error?.code||error));
 const finalWrite=writes.at(-1);
 assert(writes.length===2&&JSON.stringify({...finalWrite,blob:null})===JSON.stringify({...original,blob:null})&&await finalWrite.blob.text()===await original.blob.text(),'CONTEXT_FAULT_RESTORATION_ORACLE: restore the exact faulted row, including when an observation throws');
 const jobId=original.jobId;
 if(interruption){
  assert.equal(error?.code,'CONTROLLED_CONTEXT_OBSERVATION_FAILURE','The original observation error must remain visible');
  assert.deepEqual(r.rows.get('projects').get(jobId),projectBefore,'Interrupted verification changed the accepted project');
  assert.deepEqual(r.rows.get('meta').get('recovery:'+jobId),historyBefore,'Interrupted verification changed retained History');
 }else{
  assert(Object.values(proof).every(Boolean),'CONTEXT_NEGATIVE_SAVE_ORACLE: '+JSON.stringify(proof));
  assert.equal(await r.store.readProject(jobId),null,'Successful fixture removal must finish');
  assert.equal((await r.store.listArtifacts(jobId)).length,0);
  const history=await r.store.historyList(jobId),restored=await r.store.restoreCheckpoint(jobId,history.activeId);
  assert.deepEqual(restored.project.projectData.generatedPrompts,projectBefore.project.projectData.generatedPrompts,'Removal recovery changed historical instructions');
  const file=await r.store.getArtifact(original.artifactId);assert.equal(file.byteSize,original.byteSize);assert.equal(file.sha256,original.sha256);assert.deepEqual(new Uint8Array(await file.blob.arrayBuffer()),new Uint8Array(await original.blob.arrayBuffer()));
  // The application must still reject recoverable removal of corrupt content.
  const project=await r.store.readProject(jobId),retained=await r.store.historyList(jobId);
  for(const violation of ['size','digest','bytes']){
   const corrupt=r.copy(file);if(violation==='size')corrupt.byteSize++;if(violation==='digest')corrupt.sha256='0'.repeat(64);if(violation==='bytes')corrupt.blob=new Blob(['damaged context']);
   r.rows.get('artifacts').set(file.artifactId,corrupt);
   try{
    await assert.rejects(r.store.removeProject(jobId,{expectedProjectRevision:project.revision}),cause=>cause.code==='HISTORY_FILE_INTEGRITY_FAILED','CONTEXT_REMOVAL_INTEGRITY_ORACLE: corrupt custody must block recoverable removal');
    assert.deepEqual(await r.store.readProject(jobId),project);assert.deepEqual(await r.store.historyList(jobId),retained);assert.deepEqual(await r.store.getArtifact(file.artifactId),corrupt,'Rejected removal changed current file custody');
   }finally{r.rows.get('artifacts').set(file.artifactId,r.copy(file));}
  }
  await r.store.removeProject(jobId,{expectedProjectRevision:project.revision});assert.equal(await r.store.readProject(jobId),null,'Corrected custody must permit removal');
 }
 record('Browser context fault restores exact custody before recoverable cleanup',{interruption,actualBrowserExpression:true,nativeIndexedDB:false,proof:proof||null,faultWrites:writes.length});
}
// Specification 14.8 and 35.5: a correctly hashed container does not make a
// projection that contradicts canonical records valid. Reject before activation;
// removing that one violation must restore the exact compatible project and History.
{
 const target=projectStoreRuntime({fault:faults[mutation]}),{store,core,engine,copy}=target;
 let source=core.createBlankState('PROJECTION-INTEGRITY-RESTORE');engine.ensureShape(source);
 source.projectData.rawResponses.push(copy({rawResponseId:'RAW-PROJECTION',stage:1,completeRawResponse:'Exact original é🙂 AUDIT-TAIL'}));
 engine.recalculate(source);source=await store.writeProject(source,{expectedProjectRevision:0,createOnly:true});
 const original=copy(source);delete original.projectSha256;
 const packageFor=async project=>{const body={schema:'closed-loop-project-package/1',projectSchema:project.schema,workflow:project.workflow,responseSchema:target.runtime.closedLoopWorkflowSchema.RESPONSE_SCHEMA,project,artifacts:[],packageManifest:{jobId:project.job.JOB_ID,projectSha256:store.projectSha256(project),artifactCount:0,artifacts:[]},exportedAt:'2026-09-13T00:00:00.000Z'},packageSha256=target.runtime.closedLoopHash.sha256Value(copy(body));return new Response(new Blob([JSON.stringify({...body,packageSha256})]).stream().pipeThrough(new CompressionStream('gzip'))).blob();};
 const historyBefore=await store.historyList(source.job.JOB_ID),receiptBefore=await store.metaGet('lastVerifiedImport');
 for(const violation of ['current-stage','completion','derived-data']){
  const project=copy(original);
  if(violation==='current-stage')project.job.CURRENT_STAGE='STAGE 30';
  if(violation==='completion')project.stages[1].status='COMPLETE';
  if(violation==='derived-data')project.stages[1].derivedData.STAGE_DECISION='PASS';
  const blob=await packageFor(project),sourceBytes=new Uint8Array(await blob.arrayBuffer());
  await assert.rejects(store.importPackage(blob),error=>error.code==='PROJECT_INTEGRITY_FAILED'&&error.existingProjectsUnchanged===true&&error.issues.some(issue=>issue.includes(violation==='current-stage'?'CURRENT_STAGE':violation==='completion'?'Stage 1 status':'Stage 1 derivedData')),'IMPORT_PROJECTION_INTEGRITY_ORACLE: '+violation+' must be rejected before activation');
  assert.deepEqual(await store.readProject(source.job.JOB_ID),source,'Rejected projection changed canonical work');
  assert.deepEqual(await store.historyList(source.job.JOB_ID),historyBefore,'Rejected projection changed recovery points');
  assert.deepEqual(await store.metaGet('lastVerifiedImport'),receiptBefore,'Rejected projection recorded successful import');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),sourceBytes,'Rejected source bytes must remain available unchanged');
  observedProjection('import-'+violation,'Actual verified complete backup import',{violation,rejection:'PROJECT_INTEGRITY_FAILED',canonicalProjectUnchanged:true,recoveryUnchanged:true,importReceiptUnchanged:true,sourceBytesUnchanged:true});
  record('Reject contradictory '+violation+' before backup activation',{oracle:'IMPORT_PROJECTION_INTEGRITY_ORACLE'});
 }
 // Reconstruct the retained state an older permissive import could create.
 // All bytes/hashes agree; only the projection contradicts the canonical data.
 // View reads and every activation mode must reject it without changing work.
 for(const violation of ['current-stage','derived-data']){
  const old=projectStoreRuntime({fault:faults[mutation]}),project=old.copy(original),jobId=project.job.JOB_ID;
  const compatible=await old.store.writeProject(project,{expectedProjectRevision:0,createOnly:true}),savedRow=old.copy(old.rows.get('projects').get(jobId)),badRow=old.copy(savedRow);
  if(violation==='current-stage')badRow.project.job.CURRENT_STAGE='STAGE 30';
  else badRow.project.stages[1].derivedData.STAGE_DECISION='PASS';
  badRow.projectSha256=old.store.projectSha256(badRow.project);old.rows.get('projects').set(jobId,badRow);
  const checkpoint=await old.store.saveCheckpoint(jobId,{expectedProjectRevision:compatible.revision,label:'Older incompatible projection'});
  old.rows.get('projects').set(jobId,savedRow);
  const retained=await old.store.historyList(jobId);
  await assert.rejects(old.store.readHistoryView(jobId,checkpoint),error=>error.code==='HISTORY_VERSION_INCOMPATIBLE','HISTORY_PROJECTION_INTEGRITY_ORACLE: contradictory '+violation+' became a usable view');
  observedProjection('view-'+violation,'Actual retained History view read',{violation,rejection:'HISTORY_VERSION_INCOMPATIBLE',usableViewReturned:false});
  for(const mode of ['HISTORY','UNDO','REDO']){await assert.rejects(old.store.restoreCheckpoint(jobId,checkpoint,{expectedProjectRevision:compatible.revision,mode}),error=>error.code==='HISTORY_VERSION_INCOMPATIBLE','HISTORY_PROJECTION_INTEGRITY_ORACLE: '+mode+' activated contradictory '+violation);observedProjection(mode.toLowerCase()+'-'+violation,'Actual '+mode+' checkpoint activation',{violation,rejection:'HISTORY_VERSION_INCOMPATIBLE',activated:false});}
  assert.deepEqual(await old.store.readProject(jobId),compatible,'Rejected History changed the active version');
  assert.deepEqual(await old.store.historyList(jobId),retained,'Rejected History changed retained versions');
  // A valid active version must not hide an incompatible earlier checkpoint
  // inside an otherwise correctly hashed full backup.
  await old.store.saveCheckpoint(jobId,{expectedProjectRevision:compatible.revision,label:'Compatible active version'});
  const backup=await old.store.exportPackage(jobId),destination=projectStoreRuntime();
  await assert.rejects(destination.store.importPackage(backup),error=>error.code==='HISTORY_VERSION_INCOMPATIBLE','HISTORY_PROJECTION_INTEGRITY_ORACLE: backup accepted an incompatible retained checkpoint');
  assert.equal(await destination.store.readProject(jobId),null);
  observedProjection('nested-import-'+violation,'Actual complete backup import with incompatible retained checkpoint',{violation,rejection:'HISTORY_VERSION_INCOMPATIBLE',destinationProjectCreated:false});
  record('Reject retained '+violation+' through view, History, Undo, Redo and nested backup import',{oracle:'HISTORY_PROJECTION_INTEGRITY_ORACLE'});
 }
 const exact=project=>{const value=copy(project);for(const key of ['projectSha256','historyActivationId','restoredCandidates'])delete value[key];value.revision=original.revision;return value;};
 let restored=await store.importPackage(await packageFor(original));
 assert.deepEqual(exact(restored),original,'Compatible legacy import lost saved data');
 assert.ok(await store.readHistoryView(source.job.JOB_ID),'Committed import has no readable History view');
 for(const entry of (await store.historyList(source.job.JOB_ID)).entries){restored=(await store.restoreCheckpoint(source.job.JOB_ID,entry.id,{expectedProjectRevision:restored.revision})).project;assert.deepEqual(exact(restored),original,'Legacy backup recovery changed saved data');}
 const backup=await store.exportPackage(source.job.JOB_ID),fresh=projectStoreRuntime();
 const reimported=await fresh.store.importPackage(backup);
 assert.deepEqual(exact(reimported),original,'Exporting and restoring retained History changed saved data');
 assert.ok(await fresh.store.readHistoryView(source.job.JOB_ID),'Reimported History view is unavailable');
 record('Compatible legacy backup restores exact data, readable views, retained checkpoints and re-exported History',{oracle:'IMPORT_PROJECTION_INTEGRITY_ORACLE',realIndexedDB:false});
}
// Replay the exact bounded browser case through the production import handler,
// saved-view selector and header. DOM/storage adapters prove logic here; native
// file intake and rendered geometry still require the existing Chromium gate.
{
 const ui=projectStoreRuntime(),{runtime,store,core,engine,copy}=ui,nodes=new Map(),node=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',dataset:{},style:{},files:[],value:'',innerHTML:'',classList:{add(){}},setAttribute(){},insertAdjacentHTML(_position,value){this.innerHTML+=value;}});return nodes.get(selector);};
 let prior=core.createBlankState('PRIOR-BACKUP-UI');engine.ensureShape(prior);engine.recalculate(prior);prior=await store.writeProject(prior,{expectedProjectRevision:0,createOnly:true});
 Object.assign(runtime,{projectStore:store,core,engine,schema:runtime.closedLoopWorkflowSchema,current:prior,projects:[prior],clone:copy,views:['Overview','Project','Workflow'],projectIsArchived:()=>false,projectDisplayName:project=>project.job.JOB_TITLE||project.job.JOB_ID,esc:value=>String(value),$:node,document:{querySelector:node},File,DataTransfer:class{constructor(){this.files=[];this.items={add:file=>this.files.push(file)};}},withStorageActivity:async(_label,operation)=>operation(),takeBackupPassphrase:()=>null,requestBackupPassword:()=>false,loadAcceptanceSession:async()=>{},recordMobileBackupRestore:async()=>{},refreshProjectStorage:async()=>{},announce:message=>{node('#app-live-status').textContent=message;},pendingBackupAction:null,replacementReview:null,replacementReviewFromSavedView:()=>null,operationSelection:{},runSelection:{},fileSelectionDrafts:{},applySavedView:()=>{},operatorActionInFlight:null,focusAfterAction:()=>{}});
 const app=fs.readFileSync('app-core.js','utf8'),browser=fs.readFileSync(process.env.BROWSER_EXTRA_SOURCE||'verify-browser-extra.mjs','utf8');
 bindProjectActivationUi(ui,{source:app});
 vm.runInContext(app.slice(app.indexOf('let actionFailureNotice='),app.indexOf('const storageActivities='))+app.slice(app.indexOf('async function importProjectPackageFile('),app.indexOf('let pendingBackupAction='))+app.slice(app.indexOf('function selectSavedView('),app.indexOf('function applySavedView('))+['completion','header'].map(name=>app.split('\n').find(line=>line.startsWith('function '+name+'('))).join('\n'),runtime);
 runtime.render=()=>runtime.header();runtime.recordCommittedBoundary=()=>store.saveCheckpoint(runtime.current.job.JOB_ID,{expectedProjectRevision:runtime.current.revision});
 node('#import-file').onchange=({target})=>runtime.importProjectPackageFile(target.files[0],{recordSelection:false});runtime.header();
 const expression=browser.match(/const projectionRestore=await evalValue\(cdp,`([\s\S]*?)`\);/)?.[1];assert.ok(expression,'The actual browser projection case is required');
 const proof=await vm.runInContext(expression,runtime);
 assert.ok(proof.rejected&&proof.rejectedSourcePreserved&&proof.rejectionVisible,'IMPORT_PROJECTION_INTEGRITY_ORACLE: browser case failed pre-commit rejection '+JSON.stringify(proof));
 assert.ok(proof.restored&&proof.originalPreserved&&proof.currentStage==='STAGE 01'&&!proof.fabricatedCompletion&&proof.historyReadable&&proof.successVisible&&proof.progress==='0/30 complete'&&proof.selected&&proof.tailPreserved,'IMPORT_PROJECTION_RESTORE_ORACLE: browser case failed usable restoration '+JSON.stringify(proof));
 record('Browser backup projection sequence through actual import, saved-view and header owners',{actualBrowserExpression:true,nativeIndexedDB:false,proof});
}
// Expiry changes current readiness; it cannot corrupt an exact historical
// projection that was valid at its preserved application observation time.
// The fixture is a retained synthetic prior-contract author journey, not real
// external capability, human acceptance, physical-device or trusted-time proof.
{
 const carrier=JSON.parse(fs.readFileSync('verification/deferred-definition-compatibility-legacy-fixture-20261005.json','utf8'));
 const decoded=Buffer.from(gunzipSync(Buffer.from(carrier.gzipBase64,'base64'))),cohort=JSON.parse(decoded.toString('utf8')).cohorts.failureTests;
 assert.equal(decoded.byteLength,carrier.decodedByteSize);assert.equal(runtime.closedLoopHash.sha256Bytes?await runtime.closedLoopHash.sha256Bytes(new Uint8Array(decoded)):null,carrier.decodedSha256);
 const report=cohort.project.projectData.environmentManifests.find(row=>row.source==='EXTERNAL_CAPABILITY_REGISTRATION').fields.EXTERNAL_CLAIMS;
 let clock=Date.parse(report.observedAt)+60000,tick=false,clockReads=0;
 class ObservationClock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){clockReads++;const value=clock;if(tick)clock+=2;return value;}}
 const target=projectStoreRuntime({environment:{Date:ObservationClock}}),{store:owner,engine:workflow,copy:copyProject}=target,h=target.runtime.closedLoopHash;
 await restoreArtifactFixture(owner,cohort.artifacts);let current=copyProject(cohort.project);await hydrateRetainedPromptContexts(target,current,cohort.contextFiles);
 current=await owner.writeProject(current,{expectedProjectRevision:0,createOnly:true,incrementRevision:false});assert.equal(current.stages[2].gate.complete,true);
 const jobId=current.job.JOB_ID,checkpoint=(await owner.historyList(jobId)).activeId,snapshotKey='recovery:'+jobId+':snapshot:'+checkpoint,snapshotBytes=new Uint8Array(await target.rows.get('meta').get(snapshotKey).value.blob.arrayBuffer()),originalRaw=Array.from(current.projectData.rawResponses,row=>[row.rawResponseId,row.completeRawResponse,row.sha256]),families=['failureTests','regressions','tests','requirements','sources','defects','humanDecisions','externalCapabilities','environmentManifests'],originalFamilies=Object.fromEntries(families.map(family=>[family,h.stableStringify(current.projectData[family])])),backup=await owner.exportPackage(jobId);
 const originalView=await owner.readHistoryView(jobId,checkpoint);
 clock=Date.parse(report.validUntil)-1;tick=true;clockReads=0;const projected=copyProject(current);workflow.recalculate(projected);assert.equal(clockReads,1,'READINESS_EPOCH_ORACLE: one 30-stage projection must share one readiness observation');assert.equal(projected.stages[2].gate.complete,true);assert.equal(projected.stages[6].gate.complete,true);tick=false;
 clock=Date.parse(report.validUntil)+60000;const saved=await owner.readProject(jobId),savedSha=saved.projectSha256;
 assert.equal(workflow.gate(saved,2).complete,false,'Expired capability must not authorize current work');assert.deepEqual(await owner.readHistoryView(jobId,checkpoint),originalView,'EXPIRED_READINESS_HISTORY_ORACLE: an authentic historical view remains readable');assert.equal((await owner.readProject(jobId)).projectSha256,savedSha);
 const view=copyProject({activeView:'Workflow',activeStage:7,scrollY:17,drafts:{'#response-draft':{value:'Exact é🙂 pending draft'}}}),child=await owner.saveCheckpoint(jobId,{expectedProjectRevision:saved.revision,expectedStateSha256:savedSha,view});assert.deepEqual(await owner.readHistoryView(jobId,child),view,'A later reference must use the original root projection observation');
 let refreshed=await owner.refreshProjectProjection(jobId,{expectedProjectRevision:saved.revision,expectedStateSha256:savedSha});assert.equal(refreshed.revision,saved.revision+1);assert.equal(refreshed.job.CURRENT_STAGE,'STAGE 02');assert.equal(refreshed.stages[2].gate.complete,false);assert.equal(owner.validateProjectIntegrity(refreshed).valid,true);
 for(const family of families)assert.equal(h.stableStringify(refreshed.projectData[family]),originalFamilies[family],family+' exact retained authority');assert.deepEqual(Array.from(refreshed.projectData.rawResponses,row=>[row.rawResponseId,row.completeRawResponse,row.sha256]),originalRaw);
 await assert.rejects(owner.refreshProjectProjection(jobId,{expectedProjectRevision:saved.revision,expectedStateSha256:savedSha}),error=>error.code==='STALE_PROJECT_REVISION');assert.equal((await owner.readProject(jobId)).projectSha256,refreshed.projectSha256);
 refreshed=(await owner.restoreCheckpoint(jobId,checkpoint,{expectedProjectRevision:refreshed.revision})).project;assert.equal(refreshed.job.CURRENT_STAGE,'STAGE 02');assert.equal(refreshed.stages[2].gate.complete,false);assert.deepEqual(Array.from(refreshed.projectData.rawResponses,row=>[row.rawResponseId,row.completeRawResponse,row.sha256]),originalRaw);assert.deepEqual(new Uint8Array(await target.rows.get('meta').get(snapshotKey).value.blob.arrayBuffer()),snapshotBytes);
 const destination=projectStoreRuntime({environment:{Date:ObservationClock}}),imported=await destination.store.importPackage(backup.blob||backup),destinationHash=destination.runtime.closedLoopHash;assert.equal(imported.job.CURRENT_STAGE,'STAGE 02');assert.equal(imported.stages[2].gate.complete,false);assert.equal(destination.store.validateProjectIntegrity(imported).valid,true);assert.deepEqual(Array.from(imported.projectData.rawResponses,row=>[row.rawResponseId,row.completeRawResponse,row.sha256]),originalRaw);for(const family of families)assert.equal(destinationHash.stableStringify(imported.projectData[family]),originalFamilies[family]);
 const observationNegatives=[];
 for(const kind of ['missing-observation','observation-after-root']){
  const invalid=projectStoreRuntime({environment:{Date:ObservationClock}}),invalidOwner=invalid.store,invalidCopy=invalid.copy;
  await restoreArtifactFixture(invalidOwner,cohort.artifacts);let base=invalidCopy(cohort.project);await hydrateRetainedPromptContexts(invalid,base,cohort.contextFiles);
  base=await invalidOwner.writeProject(base,{expectedProjectRevision:0,createOnly:true,incrementRevision:false});const originalRow=invalidCopy(invalid.rows.get('projects').get(jobId)),badRow=invalidCopy(originalRow);
  // Explicit older-permissive-store counterfactual: retain the complete prior
  // cache, but remove or contradict its sole recorded observation timestamp.
  badRow.project=invalidCopy(saved);if(kind==='missing-observation')delete badRow.project.stages[2].gate.checkedAt;else badRow.project.stages[2].gate.checkedAt=new ObservationClock(clock+60000).toISOString();badRow.revision=badRow.project.revision;badRow.projectSha256=invalidOwner.projectSha256(badRow.project);invalid.rows.get('projects').set(jobId,badRow);
  const badCheckpoint=await invalidOwner.saveCheckpoint(jobId,{expectedProjectRevision:badRow.revision,label:'Unproven historical projection timestamp'});invalid.rows.get('projects').set(jobId,originalRow);const beforeRow=invalidCopy(await invalidOwner.readProject(jobId)),beforeHistory=invalidCopy(await invalidOwner.historyList(jobId));
  await assert.rejects(invalidOwner.readHistoryView(jobId,badCheckpoint),error=>error.code==='HISTORY_VERSION_INCOMPATIBLE','Unproven timestamps cannot reproduce a favorable old projection');assert.deepEqual(await invalidOwner.readProject(jobId),beforeRow);assert.deepEqual(await invalidOwner.historyList(jobId),beforeHistory);observationNegatives.push({kind,rejected:true,canonicalUnchanged:true,historyUnchanged:true});
 }
 assert.throws(()=>workflow.withReadinessEvaluationEpoch(()=>{throw new Error('INJECTED_READINESS_PROJECTION_FAILURE');},{observedAt:report.observedAt}),/INJECTED_READINESS_PROJECTION_FAILURE/);assert.throws(()=>workflow.validateExternalCapabilityEvidence(saved,copyProject(report)),/future expiry time/,'Historical observation must not leak into current authorization');
 record('Expired readiness preserves historical views and exact bytes while current activation and revision refresh stay blocked',{syntheticClock:true,actualExpiry:report.validUntil,canonicalFamiliesPreserved:families,rawResponsesPreserved:originalRaw.length,staleRefreshRejected:true,sameEpochReadiness:true});
 verificationObservations.push({checkId:'history.expired-readiness-preserved',requirementRefs:[spec+':1160',spec+':1345',spec+':1569',spec+':2646'],boundary:'Production storage transaction adapter: exact legacy fixture write, historical root/reference views, current expected-revision refresh, History activation and full backup import; explicitly controlled clock',expected:'Expired current capability remains blocked, exact historical projection and raw/bytes remain recoverable, forged caches still reject, and each synchronous projection shares one readiness observation.',observed:{historicalViewReadable:true,referenceViewReadable:true,currentStage:'STAGE 02',expiredCapabilityBlocked:true,rawResponseCount:originalRaw.length,canonicalFamiliesPreserved:families,snapshotBytesUnchanged:true,refreshRevision:saved.revision+1,staleRefreshRejected:true,observationNegatives,projectionReadinessClockReads:1,syntheticClock:true,realIndexedDB:false,physicalDevice:false,trustedTime:false},passed:true});
}
console.log(JSON.stringify({synthetic:true,environment:'Node VM; production store with the existing lifecycle transaction adapter',realIndexedDB:false,physicalDevice:false,expiredReadinessHistoricalProjection:true,cases,verificationObservations,negativeCasePopulation},null,2));
