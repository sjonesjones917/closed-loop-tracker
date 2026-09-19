import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const mutation=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8),faults={
 'mixed-versions':{id:'RESTORE-INCOMPATIBLE-VERSIONS',file:'project-store.js',before:'const next=clone(saved.project);',after:'const next={...clone(saved.project),projectData:clone(prior.projectData)};'},
 'mutate-retained':{id:'MUTATE-RETAINED-CHECKPOINT',file:'project-store.js',before:"meta.put({key:historyKey(state.jobId),value:state,updatedAt:now()});await updateRecoveryCatalog(meta,state);fault('during-history-write');",after:"if(state.entries.length>1){const previous=await request(meta.get(snapshotKey(state.jobId,state.entries[0].id)));previous.value.blob=new Blob(['deliberately mutated retained checkpoint']);meta.put(previous);}meta.put({key:historyKey(state.jobId),value:state,updatedAt:now()});await updateRecoveryCatalog(meta,state);fault('during-history-write');"}
};
if(mutation&&!faults[mutation])throw new Error('Unknown deliberate mutation.');
const r=projectStoreRuntime({fault:faults[mutation]}),{store,engine,core,runtime,rows,copy}=r;
const plain=value=>JSON.parse(JSON.stringify(value));
const id='SYNTHETIC-RECOVERY-REGRESSION',cases=[];
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
console.log(JSON.stringify({synthetic:true,environment:'Node VM; production store with the existing lifecycle transaction adapter',realIndexedDB:false,physicalDevice:false,cases},null,2));
