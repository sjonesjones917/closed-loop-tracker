import assert from 'node:assert/strict';
import {storeRuntime} from './test-store-runtime.mjs';

const r=storeRuntime(),{store,core,engine,hash,rows,runtime,copy}=r,cases=[];
const jobId='DISPOSABLE-SAVED-HISTORY';
let project=core.createBlankState(jobId);engine.ensureShape(project);engine.recalculate(project);
project=await store.writeProject(project,{expectedProjectRevision:0});
const start=await store.ensureHistoryCheckpoint(jobId,{expectedProjectRevision:project.revision,sessionId:'SESSION-TEST'});
const original=await store.readSavedVersion(jobId,start.versionId),originalBytes=hash.stableStringify(original.project);
const file=await store.putArtifact({jobId,artifactId:'RESPONSE-DRAFT-HISTORY',filename:'response.json',blob:new Blob(['{"draft":"é🙂"}\n']),mediaType:'application/json'});
const view={jobId,versionId:start.versionId,view:'Workflow',stage:1,scrollY:143,drafts:{'[data-human-answer="QUESTION-1"]':{value:'Retained answer',checked:false,selectionStart:null,selectionEnd:null,selectedValues:['one','two']}},openDetails:['Review'],selectedResponse:{jobId,stage:1,artifactId:file.artifactId,filename:file.filename,byteSize:file.byteSize,sha256:file.sha256}};
await store.saveHistoryView(jobId,'VIEW-START',copy(view));
assert.deepEqual(JSON.parse(JSON.stringify(await store.readHistoryView(jobId,'VIEW-START'))),{...view,entryId:'VIEW-START'});
await assert.rejects(store.deleteArtifact(file.artifactId,jobId),error=>error.code==='HISTORY_ARTIFACT_RETAINED');
cases.push({caseId:'durable-view-draft-and-exact-response-file',result:'PASS'});

project.job.JOB_TITLE='Later continuation';project.stages[1].responseDraft='Draft before leaving the stage';
project=await store.replaceProject(project,{expectedProjectRevision:project.revision,historyView:copy({...view,entryId:'VIEW-LATER'})});
const laterId=(await store.listSavedVersions(jobId)).activeVersionId,later=await store.readSavedVersion(jobId,laterId);
project=await store.activateSavedVersion(jobId,start.versionId,{expectedProjectRevision:project.revision});
assert.equal(project.job.JOB_TITLE,original.project.job.JOB_TITLE);assert.equal(project.stages[1].responseDraft,original.project.stages[1].responseDraft);
project=await store.activateSavedVersion(jobId,laterId,{expectedProjectRevision:project.revision});
assert.equal(project.job.JOB_TITLE,later.project.job.JOB_TITLE);assert.equal(project.stages[1].responseDraft,later.project.stages[1].responseDraft);
assert.equal(hash.stableStringify((await store.readSavedVersion(jobId,start.versionId)).project),originalBytes);
cases.push({caseId:'back-forward-data-restoration-and-immutable-start',result:'PASS'});

for(const phase of ['before-history-checkpoint','during-history-checkpoint','during-history-view-save','during-project-write']){
  const before=(await store.readProject(jobId)).projectSha256,index=hash.stableStringify(await store.listSavedVersions(jobId));
  const next=copy(project);next.job.JOB_TITLE='Must not commit '+phase;runtime.__closedLoopStorageFault=phase;
  await assert.rejects(store.replaceProject(next,{expectedProjectRevision:project.revision,historyView:copy({...view,entryId:'FAIL-'+phase})}),error=>error.code==='INJECTED_STORAGE_FAILURE');
  runtime.__closedLoopStorageFault=null;assert.equal((await store.readProject(jobId)).projectSha256,before);assert.equal(hash.stableStringify(await store.listSavedVersions(jobId)),index);
  cases.push({caseId:'atomic-save-'+phase,result:'PASS'});
}
for(const phase of ['during-history-restore','before-history-restore-commit']){
  const before=(await store.readProject(jobId)).projectSha256;runtime.__closedLoopStorageFault=phase;
  await assert.rejects(store.activateSavedVersion(jobId,start.versionId,{expectedProjectRevision:project.revision}),error=>error.code==='INJECTED_STORAGE_FAILURE');
  runtime.__closedLoopStorageFault=null;assert.equal((await store.readProject(jobId)).projectSha256,before);
  cases.push({caseId:'atomic-restore-'+phase,result:'PASS'});
}
await assert.rejects(store.activateSavedVersion(jobId,start.versionId,{expectedProjectRevision:project.revision-1}),error=>error.code==='STALE_PROJECT_REVISION');
const abort=new AbortController();abort.abort();await assert.rejects(store.activateSavedVersion(jobId,start.versionId,{expectedProjectRevision:project.revision,signal:abort.signal}),error=>error.code==='HISTORY_RESTORE_SUPERSEDED');
cases.push({caseId:'stale-tab-and-abandoned-restoration-preserve-current-data',result:'PASS'});

project=await store.activateSavedVersion(jobId,start.versionId,{expectedProjectRevision:project.revision});
project.job.JOB_TITLE='Alternative after returning';project=await store.replaceProject(project,{expectedProjectRevision:project.revision});
const branchId=(await store.listSavedVersions(jobId)).activeVersionId;
assert((await store.listSavedVersions(jobId)).versionIds.includes(laterId));
project=await store.activateSavedVersion(jobId,laterId,{expectedProjectRevision:project.revision});
assert.equal(project.job.JOB_TITLE,'Later continuation');
assert.equal((await store.readSavedVersion(jobId,branchId)).project.job.JOB_TITLE,'Alternative after returning');
cases.push({caseId:'alternate-continuation-keeps-original-later-progress',result:'PASS'});

const backup=await store.exportPackage(jobId),contents=JSON.parse(await new Response(backup.stream().pipeThrough(new DecompressionStream('gzip'))).text());
assert(contents.savedHistory.index.versionIds.includes(start.versionId)&&contents.savedHistory.index.versionIds.includes(laterId)&&contents.savedHistory.index.versionIds.includes(branchId));
const exportedResponse=Uint8Array.from(atob(contents.artifacts.find(row=>row.artifactId===file.artifactId).base64),character=>character.charCodeAt(0));
assert.equal(await hash.sha256Bytes(exportedResponse),file.sha256);
const imported=storeRuntime();const restored=await imported.store.importPackage(backup);
assert.equal(restored.job.JOB_TITLE,project.job.JOB_TITLE);
assert.equal(imported.hash.stableStringify((await imported.store.readSavedVersion(jobId,start.versionId)).project),originalBytes);
const draft=await imported.store.getArtifact(file.artifactId);assert.equal(await draft.blob.text(),'{"draft":"é🙂"}\n');
assert.equal((await imported.store.readHistoryView(jobId,'VIEW-START')).drafts['[data-human-answer="QUESTION-1"]'].value,'Retained answer');
cases.push({caseId:'backup-bytes-restore-complete-history-and-drafts',result:'PASS'});

const meta=rows.get('meta'),chunkKey='projectHistory:'+jobId+':chunk:'+Object.values(original.version.stages)[0],chunk=meta.get(chunkKey);
for(const mutation of ['missing','corrupt']){
  if(mutation==='missing')meta.delete(chunkKey);else meta.set(chunkKey,{...chunk,value:{...chunk.value,value:'Wrong checkpoint'}});
  const before=(await store.readProject(jobId)).projectSha256;
  await assert.rejects(store.activateSavedVersion(jobId,start.versionId,{expectedProjectRevision:project.revision}),error=>error.code==='HISTORY_INTEGRITY_FAILED');
  assert.equal((await store.readProject(jobId)).projectSha256,before);meta.set(chunkKey,chunk);
  assert.equal(hash.stableStringify((await store.readSavedVersion(jobId,start.versionId)).project),originalBytes);
  cases.push({caseId:mutation+'-checkpoint-rejection-and-recovery',result:'PASS'});
}
// Reusing a saved checkpoint is subject to the same integrity guarantee as
// restoring it. A corrupted shared chunk must stop a dependent new commit.
const currentVersion=store.encodeSavedVersion(project);
const currentChunkKey='projectHistory:'+jobId+':chunk:'+Object.values(currentVersion.version.stages)[0],currentChunk=meta.get(currentChunkKey);
assert(currentChunk,'The current recovery chunk must already have been stored');
meta.set(currentChunkKey,{...currentChunk,value:{...currentChunk.value,value:'Damaged saved progress'}});
const damagedBefore=(await store.readProject(jobId)).projectSha256,nextAfterDamage=copy(project);nextAfterDamage.job.JOB_TITLE='Must retain recoverable predecessor';
await assert.rejects(store.replaceProject(nextAfterDamage,{expectedProjectRevision:project.revision}),error=>error.code==='HISTORY_INTEGRITY_FAILED','Damaged saved history allowed a dependent new commit');
assert.equal((await store.readProject(jobId)).projectSha256,damagedBefore);meta.set(currentChunkKey,currentChunk);
project=await store.replaceProject(nextAfterDamage,{expectedProjectRevision:project.revision});
assert.equal(project.job.JOB_TITLE,'Must retain recoverable predecessor');
cases.push({caseId:'damaged-predecessor-prevents-dependent-save-and-recovers',result:'PASS'});
// A missing retained descriptor must reject backup and release the read
// transaction, so repairing it and restoring can still proceed.
const versionKey='projectHistory:'+jobId+':version:'+start.versionId,retainedMeta=rows.get('meta'),retainedDescriptor=retainedMeta.get(versionKey);
assert(retainedDescriptor,'The retained version must exist before removing it');retainedMeta.delete(versionKey);
await assert.rejects(store.readHistoryBundle(jobId),error=>error.code==='HISTORY_INTEGRITY_FAILED');
rows.get('meta').set(versionKey,retainedDescriptor);
assert.equal((await store.readSavedVersion(jobId,start.versionId)).version.versionId,start.versionId);
cases.push({caseId:'missing-version-backup-rejection-and-repair',result:'PASS'});

console.log(JSON.stringify({savedProjectHistory:'PASS',cases,synthetic:true,environment:'Node transaction I/O double; production history and byte codecs',browserHistory:false,physicalDevice:false,limits:store.HISTORY_LIMITS}));
