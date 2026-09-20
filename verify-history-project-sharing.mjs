import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

// Fast mechanism regression for the actual all-stage operator failure. This
// deliberately scales ONLY the disposable VM's compressed-history byte budget.
// It is not a production-capacity or browser-journey acceptance claim.
const source=fs.readFileSync(process.env.HISTORY_SOURCE||'project-store.js','utf8');
const capacity=2*1024*1024,views=12;
const anchor='maxCompressedProjectBytes:512*1024*1024';
assert.equal(source.split(anchor).length-1,1,'The declared production history capacity changed unexpectedly.');
const boundedSource=source.replace(anchor,`maxCompressedProjectBytes:${capacity}`);
const observations=[],faultMode=process.argv.find(value=>value.startsWith('--fault='))?.slice(8);
if(faultMode&&faultMode!=='duplicate-project-body')throw new Error('Unknown implementation fault: '+faultMode);
const sourceSha256=createHash('sha256').update(source).digest('hex');
const emit=(name,result,details={})=>{const row={caseId:name,result,...details};observations.push(row);console.error(JSON.stringify(row));};
const makeRuntime=(additionalFault=null)=>{
 let text=boundedSource;
 if(faultMode==='duplicate-project-body'){
  // The fault duplicates the full canonical body, bypassing both supported
  // encodings that now share its contents across retained checkpoints.
  for(const [before,after] of [["const base=state.entries.find(entry=>entry.projectSha256===digest(project)&&!entry.projectReference);","const base=null;"],['const contents=projectReference?null:await encodeHistoryProject(canonical,retainValue);','const contents={project:canonical};']]){assert.equal(text.split(before).length-1,1);text=text.replace(before,after);}
 }
 if(additionalFault){assert.equal(text.split(additionalFault.before).length-1,1,'Missing or ambiguous implementation-fault anchor: '+additionalFault.id);text=text.replace(additionalFault.before,additionalFault.after);}
 return projectStoreRuntime({sourceOverrides:{'project-store.js':text}});
};
// Reproducible incompressible-enough human text; no seeded accepted records,
// gates, later-stage state, or external-project claims are supplied.
const text=Array.from({length:8192},(_,index)=>createHash('sha256').update('HISTORY-HUMAN-INPUT-'+index).digest('hex')).join('\n');
const r=makeRuntime(),{store,core,engine,copy}=r;
let project=core.createBlankState('HISTORY-PROJECT-SHARING');
project.job.EXACT_USER_OBJECTIVE_VERBATIM=text;
engine.ensureShape(project);engine.recalculate(project);
project=await store.writeProject(project,{expectedProjectRevision:0});
const initial=await store.historyList(project.job.JOB_ID),startId=initial.activeId,expected=copy(project.projectData),saved=[];
emit('HISTORY-SHARING-BASELINE','OBSERVED',{sourceSha256,implementationFault:faultMode||null,basis:'Synthetic Stage 01 human text and saved draft views through production persistence, Node transaction adapter; not a browser or production-byte-capacity claim.',declaredProductionCapacity:512*1024*1024,disposableCapacity:capacity,initialCompressedBytes:initial.compressedProjectBytes,initialCheckpoints:initial.entries.length,humanTextBytes:Buffer.byteLength(text),viewsToPreserve:views});
try{
 for(let index=0;index<views;index++){
  const view=copy({activeView:'Workflow',activeStage:1,scrollX:0,scrollY:index,drafts:{'#job-objective':{value:'Unaccepted draft '+index}}});
  let id;try{id=await store.saveCheckpoint(project.job.JOB_ID,{expectedProjectRevision:project.revision,view});}
  catch(error){emit('HISTORY-SHARING-PROGRESSION','FAIL',{completedViews:saved.length,rejectedView:index,errorCode:error.code,message:error.message,currentCompressedBytes:(await store.historyList(project.job.JOB_ID)).compressedProjectBytes});assert.fail('HISTORY_STORAGE_AMPLIFICATION_ORACLE: unchanged canonical project plus bounded view metadata exhausted the disposable history budget before every promised view could be saved: '+error.code);}
  saved.push({id,view});
 }
 const history=await store.historyList(project.job.JOB_ID);
 assert.equal(history.entries.length,initial.entries.length+views,'Every promised view remains addressable.');
 assert.ok(history.compressedProjectBytes<=capacity);
 assert.deepEqual((await store.readProject(project.job.JOB_ID)).projectData,expected);
 emit('HISTORY-SHARING-PROGRESSION','PASS',{completedViews:saved.length,checkpoints:history.entries.length,compressedProjectBytes:history.compressedProjectBytes});
 for(const point of saved){assert.deepEqual(await store.readHistoryView(project.job.JOB_ID,point.id),point.view);}
 const restored=await store.restoreCheckpoint(project.job.JOB_ID,saved[0].id,{expectedProjectRevision:project.revision});project=restored.project;assert.deepEqual(project.projectData,expected);assert.deepEqual(restored.view,saved[0].view);
 emit('HISTORY-SHARING-EXACT-VIEW-RESTORE','PASS',{viewIds:saved.map(x=>x.id),restoredId:saved[0].id});
 const exported=await store.exportPackage(project.job.JOB_ID),fresh=makeRuntime(),imported=await fresh.store.importPackage(exported);
 assert.deepEqual(copy(imported.projectData),expected);const importedHistory=await fresh.store.historyList(project.job.JOB_ID);assert.equal(importedHistory.entries.length,history.entries.length);
 for(const point of saved)assert.deepEqual(copy(await fresh.store.readHistoryView(project.job.JOB_ID,point.id)),point.view);
 emit('HISTORY-SHARING-EXPORTED-BYTES-ROUNDTRIP','PASS',{backupBytes:exported.size,backupSha256:createHash('sha256').update(Buffer.from(await exported.arrayBuffer())).digest('hex'),preservedCheckpoints:importedHistory.entries.length});
 // Every dependency needed to reconstruct the snapshot must remain present.
 // This case operates on stored bytes, not a source-code string assertion.
 const rootKey='recovery:'+project.job.JOB_ID+':snapshot:'+startId;
 const originalRoot=r.rows.get('meta').get(rootKey);
 r.rows.get('meta').delete(rootKey);
 await assert.rejects(()=>store.readHistoryView(project.job.JOB_ID,saved.at(-1).id),error=>['HISTORY_PROJECT_REFERENCE_UNAVAILABLE','HISTORY_SNAPSHOT_INTEGRITY_FAILED'].includes(error.code),'Missing canonical snapshot data must reject, not assemble a partial version.');
 r.rows.get('meta').set(rootKey,originalRoot);
 assert.deepEqual(await store.readHistoryView(project.job.JOB_ID,saved.at(-1).id),saved.at(-1).view);
 emit('HISTORY-SHARING-MISSING-DEPENDENCY','PASS',{missingId:startId,rejectedWithoutCanonicalMutation:true,restoredDependencyAllowsRead:true});
 // A valid gzip-header change isolates compressed-byte identity while
 // decompressed bytes, all package identities and the byte length stay valid.
 const altered=copy(originalRoot),originalBytes=Buffer.from(await originalRoot.value.blob.arrayBuffer()),changedBytes=Buffer.from(originalBytes);changedBytes[4]^=1;
 assert.deepEqual(gunzipSync(changedBytes),gunzipSync(originalBytes));altered.value.blob=new Blob([changedBytes],{type:'application/gzip'});
 r.rows.get('meta').set(rootKey,altered);
 await assert.rejects(()=>store.readHistoryView(project.job.JOB_ID,saved.at(-1).id),error=>error.code==='HISTORY_SNAPSHOT_INTEGRITY_FAILED','A changed valid snapshot must be rejected for its exact-byte mismatch.');
 r.rows.get('meta').set(rootKey,originalRoot);
 assert.deepEqual(await store.readHistoryView(project.job.JOB_ID,saved.at(-1).id),saved.at(-1).view);
 emit('HISTORY-SHARING-CORRUPT-DEPENDENCY','PASS',{violation:'Changed valid gzip header, identical decompressed bytes and byte length, old SHA-256 retained; corrected bytes then read successfully.'});
 console.log(JSON.stringify({case:'history-project-sharing',sourceSha256,implementationFault:faultMode||null,synthetic:true,actualBrowser:false,productionByteCapacityTested:false,disposableCapacity:capacity,views,observations},null,2));
}catch(error){console.error(error?.stack||error);process.exitCode=1;}
