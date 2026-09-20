import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

// Scaled reproduction of the retained-version capacity failure from the real
// all-stage browser journey. This is not a production-capacity browser claim.
const source=fs.readFileSync(process.env.HISTORY_SOURCE||'project-store.js','utf8');
const faultMode=process.argv.find(value=>value.startsWith('--fault='))?.slice(8);
if(faultMode&&faultMode!=='duplicate-canonical-content')throw new Error('Unknown implementation fault: '+faultMode);
const capacity=2*1024*1024,changes=12;
const anchor='maxCompressedProjectBytes:512*1024*1024';
assert.equal(source.split(anchor).length-1,1);
const packingAnchor='const contents=projectReference?null:await encodeHistoryProject(canonical,retainValue);';
const make=()=>{let implementation=source.replace(anchor,`maxCompressedProjectBytes:${capacity}`);if(faultMode){assert.equal(implementation.split(packingAnchor).length-1,1);implementation=implementation.replace(packingAnchor,'const contents={project:canonical};');}return projectStoreRuntime({sourceOverrides:{'project-store.js':implementation}});};
const r=make(),{store,core,engine,copy}=r;
const content=Array.from({length:1024},(_,i)=>createHash('sha256').update('CANONICAL-HISTORY-'+i).digest('hex')).join('\n');
let p=core.createBlankState('HISTORY-CANONICAL-SHARING');
p.job.EXACT_USER_OBJECTIVE_VERBATIM=content;engine.ensureShape(p);engine.recalculate(p);
p=await store.writeProject(p,{expectedProjectRevision:0});
await store.beginHistorySession('CANONICAL-SHARING-SESSION');
const start=(await store.historyList(p.job.JOB_ID)).activeId,versions=[{id:start,project:copy(p)}],cases=[];
for(let i=0;i<changes;i++){
 const next=copy(p);next.job.JOB_TITLE='Retained human correction '+i;
 engine.recordHumanInputVersion(next,['JOB_TITLE'],'SYNTHETIC_VERIFIER');engine.recalculate(next);
 try{p=await store.writeProject(next,{expectedProjectRevision:p.revision});}
 catch(error){console.error(JSON.stringify({caseId:'HISTORY-CANONICAL-PROGRESSION',result:'FAIL',sourceSha256:createHash('sha256').update(source).digest('hex'),completedChanges:i,expectedChanges:changes,errorCode:error.code,history:await store.historyList(p.job.JOB_ID)}));assert.fail('HISTORY_CANONICAL_CAPACITY_ORACLE: retained complete versions exhausted the bounded history budget before valid progression finished: '+error.code);}
 versions.push({id:(await store.historyList(p.job.JOB_ID)).activeId,project:copy(p)});
}
const history=await store.historyList(p.job.JOB_ID);
assert.ok(history.retainedFileBytes<=history.limits.maxRetainedFileBytes,'The distinct retained-content limit remains binding.');
cases.push({caseId:'HISTORY-CANONICAL-PROGRESSION',result:'PASS',changes,checkpoints:history.entries.length,compressedProjectBytes:history.compressedProjectBytes,retainedFileBytes:history.retainedFileBytes});
for(const point of versions){const restored=await store.restoreCheckpoint(p.job.JOB_ID,point.id,{expectedProjectRevision:p.revision});p=restored.project;assert.deepEqual(p.job,point.project.job);assert.deepEqual(p.projectData,point.project.projectData);}
cases.push({caseId:'HISTORY-CANONICAL-EXACT-RESTORATION',result:'PASS',versions:versions.length});
const backup=await store.exportPackage(p.job.JOB_ID),fresh=make();let imported=await fresh.store.importPackage(backup);
for(const point of versions){const restored=await fresh.store.restoreCheckpoint(p.job.JOB_ID,point.id,{expectedProjectRevision:imported.revision});imported=restored.project;assert.deepEqual(copy(imported.job),point.project.job);assert.deepEqual(copy(imported.projectData),point.project.projectData);}
cases.push({caseId:'HISTORY-CANONICAL-EXPORTED-BYTES',result:'PASS',versions:versions.length,backupBytes:backup.size});
const state=await store.metaGet('recovery:'+p.job.JOB_ID),part=state.entries.flatMap(entry=>entry.projectParts?.entries||[]).find(part=>JSON.stringify(part.path)===JSON.stringify(['job','EXACT_USER_OBJECTIVE_VERBATIM']));
assert.ok(part,'The retained input must have exact-byte custody.');
const key='recovery:'+p.job.JOB_ID+':bytes:'+part.sha256,original=r.rows.get('meta').get(key),before=copy(await store.readProject(p.job.JOB_ID)),beforeHistory=copy(await store.historyList(p.job.JOB_ID));
for(const failure of ['missing','corrupt']){
 if(failure==='missing')r.rows.get('meta').delete(key);else {const altered=copy(original);const bytes=new Uint8Array(await original.value.blob.arrayBuffer());bytes[0]^=1;altered.value.blob=new Blob([bytes]);r.rows.get('meta').set(key,altered);}
 await assert.rejects(()=>store.restoreCheckpoint(p.job.JOB_ID,start,{expectedProjectRevision:p.revision}),error=>error.code==='HISTORY_FILE_INTEGRITY_FAILED');
 await assert.rejects(()=>store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,view:copy({activeStage:1,activeView:'Workflow',drafts:{note:{value:'Unsaved view'}}})}),error=>error.code==='HISTORY_FILE_INTEGRITY_FAILED');
 assert.deepEqual(await store.readProject(p.job.JOB_ID),before);assert.deepEqual(await store.historyList(p.job.JOB_ID),beforeHistory);
 r.rows.get('meta').set(key,original);
 assert.equal((await store.readHistoryView(p.job.JOB_ID,start)).activeStage,1);
 cases.push({caseId:'HISTORY-CANONICAL-'+failure.toUpperCase()+'-CONTENT',result:'PASS',failedRestorationAndSavePreserveState:true,correctedBytesAllowRead:true});
}
r.runtime.__closedLoopStorageFault='during-history-write';
const next=copy(p);next.job.JOB_TITLE='Interrupted correction';engine.recordHumanInputVersion(next,['JOB_TITLE'],'SYNTHETIC_VERIFIER');engine.recalculate(next);
await assert.rejects(()=>store.writeProject(next,{expectedProjectRevision:p.revision}),error=>error.code==='INJECTED_STORAGE_FAILURE');
r.runtime.__closedLoopStorageFault=null;assert.deepEqual(await store.readProject(p.job.JOB_ID),before);assert.deepEqual(await store.historyList(p.job.JOB_ID),beforeHistory);
cases.push({caseId:'HISTORY-CANONICAL-ATOMIC-FAILURE',result:'PASS'});
console.log(JSON.stringify({synthetic:true,actualBrowser:false,productionByteCapacityTested:false,implementationFault:faultMode||null,sourceSha256:createHash('sha256').update(source).digest('hex'),disposableCapacity:capacity,cases},null,2));
