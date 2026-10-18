import {runVerifier} from './verify-conformance-regressions.mjs';
import {VerifierInfrastructureError,isComponentInfrastructureFailure,fileFirstComponentFailure} from './test-file-first-components.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {storedArtifactBody,projectStoreRuntime,bindProjectActivationUi,restoreArtifactFixture,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';
const mutation=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8),faults={
 'mixed-versions':{id:'RESTORE-INCOMPATIBLE-VERSIONS',file:'project-store.js',before:'let next=clone(saved.project);',after:'let next={...clone(saved.project),projectData:clone(prior.projectData)};'},
 'import-projection':{id:'IMPORT-PROJECTION-INTEGRITY',file:'project-store.js',before:'withVerifiedRecoveryCustody(verifiedArtifacts,()=>assertRecoveryCompatibility(project))',after:'withVerifiedRecoveryCustody(verifiedArtifacts,()=>{})'},
 'history-projection':{id:'HISTORY-PROJECTION-INTEGRITY',file:'project-store.js',before:'unused-dual-anchor-mutant',after:'unused-dual-anchor-mutant'},
 'mutate-retained':{id:'MUTATE-RETAINED-CHECKPOINT',file:'project-store.js',before:"meta.put({key:historyKey(state.jobId),value:state,updatedAt:now()});await updateRecoveryCatalog(meta,state);fault('during-history-write');",after:"if(state.entries.length>1){const previous=await request(meta.get(snapshotKey(state.jobId,state.entries[0].id)));previous.value.blob=new Blob(['deliberately mutated retained checkpoint']);meta.put(previous);}meta.put({key:historyKey(state.jobId),value:state,updatedAt:now()});await updateRecoveryCatalog(meta,state);fault('during-history-write');"}
};
if(mutation&&!faults[mutation])throw new Error('Unknown deliberate mutation.');
const projectStoreSource=fs.readFileSync('project-store.js','utf8'),legacyProjectionWriterAnchor='try{assertProjectIntegrity(row.project,{verifyDerived:false});}catch(error){if(!legacyJobPointerProjection(row.project,{verifyDerived:false})){await quarantine',legacyProjectionExportAnchor='else{\n      await readCheckpointBody(jobId,';
assert.equal(projectStoreSource.split(legacyProjectionWriterAnchor).length-1,1,'LEGACY_PROJECTION_WRITER_ANCHOR_ORACLE');
assert.equal(projectStoreSource.split(legacyProjectionExportAnchor).length-1,1,'LEGACY_PROJECTION_EXPORT_FIXTURE_ANCHOR_ORACLE');
const legacyProjectionWriterSource=projectStoreSource.replace(legacyProjectionWriterAnchor,'try{assertProjectIntegrity(row.project,{verifyDerived:false,verifyProjection:false});}catch(error){if(!legacyJobPointerProjection(row.project,{verifyDerived:false})){await quarantine'),legacyProjectionExporterSource=legacyProjectionWriterSource.replace(legacyProjectionExportAnchor,'else if(false){\n      await readCheckpointBody(jobId,');
const historyProjectionMutant=source=>{const early='try{assertProjectIntegrity(project,{verifyDerived:false});recoveryBodyStaticIntegrity.set(project,verifiedProjectIntegrity(project,verifiedProjectSha256));}',current='}else assertProjectIntegrity(project);';assert.equal(source.split(early).length-1,1,'HISTORY_PROJECTION_EARLIEST_GUARD_ANCHOR_ORACLE');assert.equal(source.split(current).length-1,1,'HISTORY_PROJECTION_CURRENT_GUARD_ANCHOR_ORACLE');return source.replace(early,'try{assertProjectIntegrity(project,{verifyDerived:false,verifyProjection:false});recoveryBodyStaticIntegrity.set(project,verifiedProjectIntegrity(project,verifiedProjectSha256));}').replace(current,'}else assertProjectIntegrity(project,{verifyCachedProjection:false,verifyProjection:false});');};
const runtimeOptions=(source=projectStoreSource,boundary='general')=>mutation==='history-projection'?(boundary==='history'?{sourceOverrides:{'project-store.js':historyProjectionMutant(source)}}:source===projectStoreSource?{}:{sourceOverrides:{'project-store.js':source}}):{fault:faults[mutation],...(source===projectStoreSource?{}:{sourceOverrides:{'project-store.js':source}})};
const r=projectStoreRuntime(runtimeOptions()),{store,engine,core,runtime,rows,copy}=r;
const plain=value=>JSON.parse(JSON.stringify(value));
const independentCanonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(independentCanonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+independentCanonical(value[key])).join(',')+'}',independentSha256=value=>createHash('sha256').update(value).digest('hex');
const id='SYNTHETIC-RECOVERY-REGRESSION',cases=[],verificationObservations=[],negativeCasePopulation=[];
const spec='specification/closed-loop-reliability-controlling-implementation-specification.txt';
function observedProjection(caseId,boundary,observed){const checkId='projection.recovery-canonical-authority',violation='stageProjectionsOverridingCanonicalRecords';negativeCasePopulation.push({caseId,checkId,violation,boundary,observed,accepted:false,result:'PASS'});const prior=verificationObservations.find(row=>row.checkId===checkId),actual={caseId,boundary,...observed};if(prior)prior.observed.cases.push(actual);else verificationObservations.push({checkId,requirementRefs:[spec+':4663',spec+':5530'],boundary:'Production store backup import, retained view read, checkpoint activation, current export and historical-carrier import',expected:'Contradictory cached projection rejects before usable view, activation, export or import; canonical records remain authoritative.',observed:{cases:[actual]},passed:true,violation,accepted:false});}
const projectionReceiptIssue=error=>Array.isArray(error?.issues)&&error.issues.find(issue=>/Application projection receipt is invalid: (?:STALE_DERIVATION_RECEIPT|INVALID_DERIVATION_OUTPUT) /.test(issue));
const directImportProjectionRejection=(error,expectedIssue)=>error?.code==='HISTORY_VERSION_INCOMPATIBLE'&&error.existingProjectsUnchanged===true&&Array.isArray(error.issues)&&error.issues.some(value=>value.includes(expectedIssue))&&Boolean(projectionReceiptIssue(error));
const retainedProjectionRejection=error=>error?.code==='PROJECT_INTEGRITY_FAILED'&&Boolean(projectionReceiptIssue(error));
const nestedImportProjectionRejection=error=>error?.code==='PROJECT_INTEGRITY_FAILED'&&Boolean(projectionReceiptIssue(error));
const record=(name,details={})=>cases.push({name,...details,result:'PASS'});
// The expiry fixture owns a separate store and clock; run its unchanged
// controls in an owned process while this process checks the other histories.
const expiryController=new AbortController(),cancelExpiry=()=>expiryController.abort();
process.on('SIGTERM',cancelExpiry);process.on('SIGINT',cancelExpiry);
const expiryRun=runVerifier(process.execPath,['test-recoverable-history-expiry.mjs',...process.argv.slice(2)],{timeout:30000,maxBuffer:16*1024*1024,signal:expiryController.signal});
const outcomes=await Promise.allSettled([(async()=>{
let p=core.createBlankState(id);engine.ensureShape(p);engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:0,createOnly:true});
await store.beginHistorySession('SESSION-A');let history=await store.historyList(id);const start=history.sessions['SESSION-A'].checkpointId,starting=copy(p);
const bytes=new Blob([Uint8Array.of(0,13,10,255,65)]),file=await store.putArtifact({artifactId:artifactFixtureId(engine,p,'RECOVERY-ARTIFACT'),jobId:id,filename:'exact.bin',mediaType:'application/octet-stream',blob:bytes});
let next=copy(p);next.job.JOB_TITLE='First continuation';engine.registerArtifactBytes(next,{stage:1,artifactId:file.artifactId,filename:file.filename,mediaType:file.mediaType,byteSize:file.byteSize,sha256:file.sha256});p=await store.writeProject(next,{expectedProjectRevision:p.revision});
history=await store.historyList(id);const first=history.activeId,firstProject=copy(p);
next=copy(p);next.job.JOB_TITLE='Second continuation';p=await store.writeProject(next,{expectedProjectRevision:p.revision});history=await store.historyList(id);const second=history.activeId;
// The mixed-version fault now reaches the canonical projection guard before
// activation. Require that exact rejection and unchanged retained/current work;
// an arbitrary child exception is not evidence that the fault was detected.
const mixedVersionBefore=mutation==='mixed-versions'?{project:copy(p),history:await store.historyList(id)}:null;
if(mixedVersionBefore)assert.notDeepEqual(p.projectData,firstProject.projectData,'MIXED_VERSION_DISTINCT_INPUTS_ORACLE');
let restored;
try{restored=await store.restoreCheckpoint(id,first,{expectedProjectRevision:p.revision,mode:'UNDO'});}
catch(error){
 if(!mixedVersionBefore)throw error;
 assert.equal(error.code,'PROJECT_INTEGRITY_FAILED','MIXED_VERSION_REJECTION_CODE_ORACLE');
 assert.ok(Array.isArray(error.issues),'MIXED_VERSION_REJECTION_ISSUES_ORACLE');
 for(const field of ['canonicalInputSha256','outputSha256'])assert.ok(error.issues.includes('Application projection receipt is invalid: STALE_DERIVATION_RECEIPT The retained derivation '+field+' does not match the current registered calculation and its actual inputs/output.'),'MIXED_VERSION_REJECTION_RECEIPT_ORACLE: '+field);
 assert.deepEqual(await store.readProject(id),mixedVersionBefore.project,'MIXED_VERSION_CURRENT_STATE_PRESERVATION_ORACLE');
 assert.deepEqual(await store.historyList(id),mixedVersionBefore.history,'MIXED_VERSION_RETAINED_STATE_PRESERVATION_ORACLE');
 throw new Error('MIXED_VERSION_RESTORE_INTEGRITY_ORACLE: rejected mixed current projectData and saved checkpoint before activation; code='+error.code+'; issues='+JSON.stringify(error.issues));
}
if(mixedVersionBefore)assert.fail('MIXED_VERSION_RESTORE_REJECTION_REQUIRED_ORACLE');
p=restored.project;
assert.equal(p.job.JOB_TITLE,'First continuation');assert.equal((await store.getArtifact(file.artifactId,{jobId:id})).sha256,file.sha256);
const currentBytes=await store.getArtifact(file.artifactId,{jobId:id});assert.deepEqual(new Uint8Array(await currentBytes.blob.arrayBuffer()),new Uint8Array(await bytes.arrayBuffer()));
assert.deepEqual(p.projectData,firstProject.projectData);assert.deepEqual(p.stages,firstProject.stages);assert.ok(p.revision>firstProject.revision,'Restoration must preserve concurrency monotonicity.');
record('Restore complete project and exact non-text bytes');
const beforeStaleWrite=copy(p),beforeStaleHistory=await store.historyList(id);
await assert.rejects(store.writeProject(firstProject,{expectedProjectRevision:firstProject.revision}),error=>error.code==='STALE_PROJECT_REVISION');
assert.deepEqual(await store.readProject(id),beforeStaleWrite,'STALE_WRITE_CANONICAL_ISOLATION_ORACLE');assert.deepEqual(await store.historyList(id),beforeStaleHistory,'STALE_WRITE_HISTORY_ISOLATION_ORACLE');
record('Delayed response or stale tab cannot write after restore');
verificationObservations.push({checkId:'store.cas-stale-write-isolation',requirementRefs:[spec+':3082'],boundary:'Production store compare-and-swap via isolated lifecycle transaction adapter',expected:{staleRevisionRejected:true,canonicalStateUnchanged:true,historyUnchanged:true,newerRevisionRestored:true},observed:{staleRevisionRejected:true,canonicalStateUnchanged:true,historyUnchanged:true,newerRevisionRestored:p.revision>firstProject.revision},passed:true});
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
 const r=projectStoreRuntime({sourceOverrides:process.env.STORE_SOURCE?{'project-store.js':fs.readFileSync(process.env.STORE_SOURCE,'utf8')}:{}}),writes=[];let original,originalBlob,projectBefore,historyBefore;
 const db={transaction(name,mode){
  assert.equal(name,'artifacts');assert(['readonly','readwrite'].includes(mode));if(mode==='readonly')return {objectStore:()=>({get:id=>{const req={};queueMicrotask(()=>{req.result=r.copy(r.rows.get(name).get(id));req.onsuccess?.();});return req;}})};const pending=[],tx={objectStore(storeName){assert.equal(storeName,name);return {put(row){pending.push(r.copy(row));}};}};
  queueMicrotask(()=>{for(const row of pending){if(!original){original=r.copy(r.rows.get(name).get(row.artifactId));originalBlob=storedArtifactBody(r,row.artifactId).blob;projectBefore=r.copy(r.rows.get('projects').get(row.jobId));historyBefore=r.copy(r.rows.get('meta').get('recovery:'+row.jobId));}writes.push(row);r.rows.get(name).set(row.artifactId,row);}tx.oncomplete?.();});return tx;
 }};
 r.runtime.closedLoopProjectStore={...r.store,openDatabase:async()=>db,readProject:async(...args)=>{
  if(interruption&&original&&writes.length===1)throw Object.assign(new Error('CONTROLLED_CONTEXT_OBSERVATION_FAILURE'),{code:'CONTROLLED_CONTEXT_OBSERVATION_FAILURE'});
  return r.store.readProject(...args);
 }};
 let proof,error;try{proof=await vm.runInContext(contextExpression,r.runtime);}catch(cause){error=cause;}
 assert(original&&writes[0].byteSize===original.byteSize+1,'CONTEXT_FAULT_INJECTION_ORACLE: the negative case must contain exactly one byte-size violation');
 if(!interruption)assert(!error,'CONTEXT_FAULT_LIFECYCLE_ORACLE: the valid negative test must finish and preserve recovery: '+String(error?.code||error));
 const finalWrite=writes.at(-1);
 assert(writes.length===2&&JSON.stringify({...finalWrite,blob:null})===JSON.stringify({...original,blob:null})&&await storedArtifactBody(r,original.artifactId,{row:original}).blob.text()===await originalBlob.text(),'CONTEXT_FAULT_RESTORATION_ORACLE: restore the exact faulted row, including when an observation throws');
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
  const file=await r.store.getArtifact(original.artifactId);assert.equal(file.byteSize,original.byteSize);assert.equal(file.sha256,original.sha256);assert.deepEqual(new Uint8Array(await file.blob.arrayBuffer()),new Uint8Array(await originalBlob.arrayBuffer()));
  // The application must still reject recoverable removal of corrupt content.
  const project=await r.store.readProject(jobId),retained=await r.store.historyList(jobId);
  for(const violation of ['size','digest','bytes']){
   const corrupt=r.copy(file);if(violation==='size')corrupt.byteSize++;if(violation==='digest')corrupt.sha256='0'.repeat(64);if(violation==='bytes')corrupt.blob=new Blob(['damaged context']);
   r.rows.get('artifacts').set(file.artifactId,corrupt);
   try{
    await assert.rejects(r.store.removeProject(jobId,{expectedProjectRevision:project.revision}),cause=>cause.code==='HISTORY_FILE_INTEGRITY_FAILED','CONTEXT_REMOVAL_INTEGRITY_ORACLE: corrupt custody must block recoverable removal');
    assert.deepEqual(await r.store.readProject(jobId),project);assert.deepEqual(await r.store.historyList(jobId),retained);// Corrupt inline custody is a legacy row; the reader now refuses it, so inspect the stored row itself.
   assert.deepEqual(r.rows.get('artifacts').get(file.artifactId),corrupt,'Rejected removal changed current file custody');
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
 const target=projectStoreRuntime(runtimeOptions()),{store,core,engine,copy}=target;
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
  let rejection;
  await assert.rejects(store.importPackage(blob),error=>{rejection=error;const issue=violation==='current-stage'?'CURRENT_STAGE':violation==='completion'?'Stage 1 status':'Stage 1 derivedData';return directImportProjectionRejection(error,issue);},'IMPORT_PROJECTION_INTEGRITY_ORACLE: '+violation+' must be rejected before activation');
  assert.deepEqual(await store.readProject(source.job.JOB_ID),source,'Rejected projection changed canonical work');
  assert.deepEqual(await store.historyList(source.job.JOB_ID),historyBefore,'Rejected projection changed recovery points');
  assert.deepEqual(await store.metaGet('lastVerifiedImport'),receiptBefore,'Rejected projection recorded successful import');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),sourceBytes,'Rejected source bytes must remain available unchanged');
  observedProjection('import-'+violation,'Actual verified complete backup import',{violation,rejection:rejection.code,projectionReceiptRejection:projectionReceiptIssue(rejection),canonicalProjectUnchanged:true,recoveryUnchanged:true,importReceiptUnchanged:true,sourceBytesUnchanged:true});
  record('Reject contradictory '+violation+' before backup activation',{oracle:'IMPORT_PROJECTION_INTEGRITY_ORACLE'});
 }
 // Reconstruct the retained state an older permissive import could create.
 // All bytes/hashes agree; only the projection contradicts the canonical data.
 // View reads and every activation mode must reject it without changing work.
 for(const violation of ['current-stage','derived-data']){
  // Apply a requested projection detector mutant after the controlled old
  // writer transformation; otherwise fixture construction would mask it.
  const old=projectStoreRuntime(runtimeOptions(legacyProjectionWriterSource,'history')),project=old.copy(original),jobId=project.job.JOB_ID;
  const compatible=await old.store.writeProject(project,{expectedProjectRevision:0,createOnly:true}),savedRow=old.copy(old.rows.get('projects').get(jobId)),badRow=old.copy(savedRow);
  if(violation==='current-stage')badRow.project.job.CURRENT_STAGE='STAGE 30';
  else badRow.project.stages[1].derivedData.STAGE_DECISION='PASS';
  const expectedIssue=violation==='current-stage'?'CURRENT_STAGE':'Stage 1 derivedData',fixtureIntegrity=old.store.validateProjectIntegrity(badRow.project);
  assert.equal(fixtureIntegrity.valid,false,'HISTORY_PROJECTION_FIXTURE_ORACLE: contradictory '+violation+' fixture became valid');assert(fixtureIntegrity.issues.some(issue=>issue.includes(expectedIssue)),'HISTORY_PROJECTION_FIXTURE_ORACLE: contradictory '+violation+' fixture lost its exact projection mismatch');
  badRow.projectSha256=old.store.projectSha256(badRow.project);old.rows.get('projects').set(jobId,badRow);
  const checkpoint=await old.store.saveCheckpoint(jobId,{expectedProjectRevision:compatible.revision,label:'Older incompatible projection'});
  old.rows.get('projects').set(jobId,savedRow);
  const retained=await old.store.historyList(jobId);
  let viewRejection;await assert.rejects(old.store.readHistoryView(jobId,checkpoint),error=>(viewRejection=error,retainedProjectionRejection(error)),'HISTORY_PROJECTION_INTEGRITY_ORACLE: contradictory '+violation+' became a usable view');
  observedProjection('view-'+violation,'Actual retained History view read',{violation,rejection:viewRejection.code,projectionReceiptRejection:projectionReceiptIssue(viewRejection),usableViewReturned:false});
  for(const mode of ['HISTORY','UNDO','REDO']){let modeRejection;await assert.rejects(old.store.restoreCheckpoint(jobId,checkpoint,{expectedProjectRevision:compatible.revision,mode}),error=>(modeRejection=error,retainedProjectionRejection(error)),'HISTORY_PROJECTION_INTEGRITY_ORACLE: '+mode+' activated contradictory '+violation);observedProjection(mode.toLowerCase()+'-'+violation,'Actual '+mode+' checkpoint activation',{violation,rejection:modeRejection.code,projectionReceiptRejection:projectionReceiptIssue(modeRejection),activated:false});}
  assert.deepEqual(await old.store.readProject(jobId),compatible,'Rejected History changed the active version');
  assert.deepEqual(await old.store.historyList(jobId),retained,'Rejected History changed retained versions');
  // A valid active version must not hide an incompatible earlier checkpoint
  // inside an otherwise correctly hashed full backup.
  await old.store.saveCheckpoint(jobId,{expectedProjectRevision:compatible.revision,label:'Compatible active version'});
  const nestedHistory=await old.store.historyList(jobId);
  let exportRejection;await assert.rejects(old.store.exportPackage(jobId),error=>(exportRejection=error,retainedProjectionRejection(error)),'HISTORY_PROJECTION_INTEGRITY_ORACLE: current export accepted an incompatible retained checkpoint');
  assert.deepEqual(await old.store.readProject(jobId),compatible,'Rejected export changed the active version');assert.deepEqual(await old.store.historyList(jobId),nestedHistory,'Rejected export changed retained versions');
  observedProjection('nested-export-'+violation,'Actual current complete-backup export with incompatible retained checkpoint',{violation,rejection:exportRejection.code,projectionReceiptRejection:projectionReceiptIssue(exportRejection),backupProduced:false,canonicalProjectUnchanged:true});
  // Independently construct only the carrier an older permissive exporter
  // could have emitted. Exact retained bytes and hashes are unchanged; the
  // current importer remains the owner of the rejection under test.
  const carrier=projectStoreRuntime({sourceOverrides:{'project-store.js':legacyProjectionExporterSource}});for(const[name,data]of old.rows)carrier.rows.set(name,new Map([...data].map(([key,value])=>[key,carrier.copy(value)])));
  const carrierProject=await carrier.store.readProject(jobId),carrierHistory=await carrier.store.historyList(jobId),backup=await carrier.store.exportPackage(jobId),backupBytes=new Uint8Array(await backup.arrayBuffer()),backupSha256=await target.runtime.closedLoopHash.sha256Bytes(backup),destination=projectStoreRuntime(runtimeOptions(projectStoreSource,'history')),destinationReceipt=await destination.store.metaGet('lastVerifiedImport'),destinationBefore=destination.copy([...destination.rows].map(([name,data])=>[name,[...data]]));
  const carrierPackage=JSON.parse(gunzipSync(backupBytes)),{packageSha256,...carrierPackageBody}=carrierPackage;assert.equal(independentSha256(independentCanonical(carrierPackageBody)),packageSha256,'HISTORICAL_CARRIER_PACKAGE_SHA_ORACLE');assert.equal(carrierPackage.packageManifest.jobId,jobId);assert.equal(carrierPackage.packageManifest.projectSha256,carrierProject.projectSha256);assert.equal(carrierPackage.packageManifest.artifactCount,carrierPackage.artifacts.length);
  for(const descriptor of carrierHistory.entries){const packaged=carrierPackage.recovery.entries.find(entry=>entry.id===descriptor.id),archive=carrierPackage.artifacts.find(row=>row.archiveKind==='RECOVERY_SNAPSHOT'&&row.checkpointId===descriptor.id),raw=Buffer.from(archive?.base64||'','base64');assert.equal(independentCanonical(packaged),independentCanonical(descriptor),'HISTORICAL_CARRIER_CHECKPOINT_DESCRIPTOR_ORACLE');assert.equal(raw.length,descriptor.byteSize,'HISTORICAL_CARRIER_CHECKPOINT_SIZE_ORACLE');assert.equal(independentSha256(raw),descriptor.sha256,'HISTORICAL_CARRIER_CHECKPOINT_SHA_ORACLE');}
  assert.deepEqual(await carrier.store.readProject(jobId),carrierProject,'Historical carrier export changed canonical work');assert.deepEqual(await carrier.store.historyList(jobId),carrierHistory,'Historical carrier export changed retained History');
  let nestedRejection;await assert.rejects(destination.store.importPackage(backup),error=>(nestedRejection=error,nestedImportProjectionRejection(error)),'HISTORY_PROJECTION_INTEGRITY_ORACLE: backup accepted an incompatible retained checkpoint');
  assert.equal(await destination.store.readProject(jobId),null);assert.deepEqual(destination.copy([...destination.rows].map(([name,data])=>[name,[...data]])),destinationBefore,'Rejected nested import changed destination storage');assert.deepEqual(await destination.store.metaGet('lastVerifiedImport'),destinationReceipt);assert.equal(await target.runtime.closedLoopHash.sha256Bytes(backup),backupSha256);assert.deepEqual(new Uint8Array(await backup.arrayBuffer()),backupBytes);
  observedProjection('nested-import-'+violation,'Actual current complete-backup import of exact-byte historical permissive carrier',{violation,rejection:nestedRejection.code,projectionReceiptRejection:projectionReceiptIssue(nestedRejection),destinationProjectCreated:false,destinationHistoryCreated:false,importReceiptUnchanged:true,carrierBytesUnchanged:true,carrierSha256:backupSha256,carrierFixture:'controlled historical permissive exporter; not a current valid export'});
  record('Reject retained '+violation+' through view, History, Undo, Redo, current export and historical nested backup import',{oracle:'HISTORY_PROJECTION_INTEGRITY_ORACLE'});
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
})(),expiryRun]);
process.removeListener('SIGTERM',cancelExpiry);process.removeListener('SIGINT',cancelExpiry);
if(expiryController.signal.aborted)throw new VerifierInfrastructureError('RECOVERABLE_HISTORY_CANCELLED');
const [mainResult,expiryResult]=outcomes;
if(expiryResult.status==='rejected')throw new VerifierInfrastructureError('RECOVERABLE_HISTORY_SUPERVISOR_REJECTED');
const child=expiryResult.value;
if(isComponentInfrastructureFailure(child))throw fileFirstComponentFailure(child);
if(mainResult.status==='rejected')throw mainResult.reason;
if(child.status!==0)throw fileFirstComponentFailure(child);
if(child.stderr)process.stderr.write(child.stderr);
const extra=JSON.parse(child.stdout);
assert.deepEqual(Object.keys(extra).sort(),['cases','negativeCasePopulation','verificationObservations'],'RECOVERABLE_HISTORY_COMPONENT_OUTPUT_ORACLE');
for(const [target,key] of [[cases,'cases'],[verificationObservations,'verificationObservations'],[negativeCasePopulation,'negativeCasePopulation']]){assert.ok(Array.isArray(extra[key]),'RECOVERABLE_HISTORY_COMPONENT_ARRAY_ORACLE');target.push(...extra[key]);}
console.log(JSON.stringify({verifyRecoverableHistory:'PASS',synthetic:true,environment:'Node VM; production store with the existing lifecycle transaction adapter',realIndexedDB:false,physicalDevice:false,expiredReadinessHistoricalProjection:true,cases,verificationObservations,negativeCasePopulation},null,2));
