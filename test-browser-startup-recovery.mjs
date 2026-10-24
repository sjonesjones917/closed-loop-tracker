// Browser-only fixture helpers. The readiness observer keeps the original store,
// promise, methods and native IDB results; it labels reads without delaying them.
export function installStartupReadProbe(){
 const observation=globalThis.__startupReadObservation={ready:false,readyError:null,recoveryErrorAtReady:null,readyPromise:null,reads:[],summaryScans:[],sessionReads:[],sessionKey:'recoverySession:'+sessionStorage.getItem('closed-loop-application-session')};
 for(const method of ['get','getAll']){
  const original=IDBObjectStore.prototype[method];
  IDBObjectStore.prototype[method]=function(...args){
   if(this.name==='meta'&&method==='get'&&args[0]===observation.sessionKey)observation.sessionReads.push({phase:observation.ready?'activation':'recovery'});
   if(this.name==='projects')observation.reads.push({method,key:args[0],phase:observation.ready?'activation':'recovery'});
   return original.apply(this,args);
  };
 }
 const originalCursor=IDBIndex.prototype.openKeyCursor;
 IDBIndex.prototype.openKeyCursor=function(...args){
  if(this.objectStore.name==='projects'&&this.name==='picker')observation.summaryScans.push({phase:observation.ready?'activation':'recovery'});
  return originalCursor.apply(this,args);
 };
 // Installed before project-store.js exports its store, hence before app-core's
 // await of that exact ready promise. Promise reactions retain FIFO ordering.
 Object.defineProperty(globalThis,'closedLoopProjectStore',{configurable:true,enumerable:true,set(store){
  Object.defineProperty(globalThis,'closedLoopProjectStore',{value:store,writable:true,configurable:true,enumerable:true});
  observation.readyPromise=store.ready;
  Promise.prototype.then.call(store.ready,()=>{observation.recoveryErrorAtReady=globalThis.closedLoopStagingRecoveryError;observation.ready=true;},error=>{observation.readyError=String(error);});
 }});
}

export async function prepareStartupPickerFixture(){
 const store=closedLoopProjectStore,ui=await store.metaGet('projectUi')||{};
 for(let i=0;i<50;i++){
  const p=closedLoopCore.createBlankState('STARTUP-BROWSER-'+i);p.job.JOB_TITLE=p.job.JOB_ID;
  if(i===49)p.projectData.rawResponses=Array.from({length:100},(_,n)=>({rawResponseId:'RAW-ARCHIVED-'+n,stage:1,status:'PRESERVED',rawText:'H'.repeat(80000)+'é🙂TAIL'}));
  await store.writeProject(p,{expectedProjectRevision:0,createOnly:true});
  if(i)ui[p.job.JOB_ID]={archivedAt:'2026-09-12T00:00:00.000Z'};
 }
 // Startup must inspect and quarantine an already-corrupt owner. Keep this
 // separate from the 50 valid picker rows and the later explicit-read control.
 const damaged=closedLoopCore.createBlankState('STARTUP-RECOVERY-CORRUPT');
 await store.writeProject(damaged,{expectedProjectRevision:0,createOnly:true});
 ui[damaged.job.JOB_ID]={archivedAt:'2026-09-12T00:00:00.000Z'};
 await store.metaPut('projectUi',ui);await store.metaPut('retainedProjectSuppressed',true);await store.metaPut('selectedProject','STARTUP-BROWSER-0');
 const db=await store.openDatabase();let original;
 await new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite'),object=tx.objectStore('projects'),get=object.get(damaged.job.JOB_ID);get.onsuccess=()=>{const row=get.result;row.project.corruptionMarker=true;original=row;object.put(row);};tx.oncomplete=resolve;tx.onerror=reject;});
 await store.metaPut('startupFixtureRecoveryRow',original);
}

export async function observeStartupPickerFixture(){
 const observation=globalThis.__startupReadObservation,reads=observation.reads.slice(),summaryScans=observation.summaryScans.slice(),store=closedLoopProjectStore;
 const recovery=reads.filter(row=>row.phase==='recovery'),activation=reads.filter(row=>row.phase==='activation'),summaries=await store.listProjectSummaries();
 const recoveryEntry=(await store.listQuarantinedProjects()).find(row=>row.jobId==='STARTUP-RECOVERY-CORRUPT'),recoveryEvidence=recoveryEntry&&await store.metaGet(recoveryEntry.key),original=await store.metaGet('startupFixtureRecoveryRow');
 const proof={
  recoveryReady:observation.ready&&observation.readyError===null&&observation.recoveryErrorAtReady===null&&globalThis.closedLoopStagingRecoveryError===null,
  originalReadyPromise:store.ready===observation.readyPromise,
  activationStartsAfterReady:observation.sessionKey!=='recoverySession:null'&&observation.sessionReads.length>0&&observation.sessionReads[0].phase==='activation',
  recoverySummaryScan:summaryScans.some(row=>row.phase==='recovery'),
  recoveryAllOwners:Array.from({length:50},(_,i)=>'STARTUP-BROWSER-'+i).every(id=>recovery.some(row=>row.method==='get'&&row.key===id)),
  recoveryCorruptRead:recovery.some(row=>row.method==='get'&&row.key==='STARTUP-RECOVERY-CORRUPT'),
  recoveryCorruptQuarantined:original?.project?.corruptionMarker===true&&recoveryEvidence?.reason==='PROJECT_HASH_MISMATCH'&&JSON.stringify(recoveryEvidence.row)===JSON.stringify(original),
  recoveryCorruptRemoved:!summaries.some(row=>row.job.JOB_ID==='STARTUP-RECOVERY-CORRUPT')&&await store.readProject('STARTUP-RECOVERY-CORRUPT')===null,
  selected:document.querySelector('#current-project-summary')?.dataset?.projectId==='STARTUP-BROWSER-0',
  noWholeProjectScan:reads.every(row=>row.method!=='getAll'),
  selectedOnly:activation.length>0&&activation.every(row=>row.key==='STARTUP-BROWSER-0'),
  allPickerRows:summaries.filter(row=>row.job.JOB_ID.startsWith('STARTUP-BROWSER-')).length===50,
  archivedCorruptionNotPremature:(await store.listQuarantinedProjects()).every(row=>row.jobId!=='STARTUP-BROWSER-49')
 };
 // Corrupt the large archived row only after recovery and activation finish.
 // Its first explicit public read must reject and preserve the exact bad row.
 const db=await store.openDatabase();let corrupted;
 await new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite'),object=tx.objectStore('projects'),get=object.get('STARTUP-BROWSER-49');get.onsuccess=()=>{const row=get.result;row.project.corruptionMarker=true;corrupted=JSON.stringify(row);object.put(row);};tx.oncomplete=resolve;tx.onerror=reject;});
 let code='';try{await store.readProject('STARTUP-BROWSER-49');}catch(error){code=error.code;}
 const corruptEntry=(await store.listQuarantinedProjects()).find(row=>row.jobId==='STARTUP-BROWSER-49'),corruptEvidence=corruptEntry&&await store.metaGet(corruptEntry.key);
 proof.corruptBlocked=code==='PROJECT_HASH_MISMATCH';
 proof.corruptQuarantined=corruptEvidence?.reason==='PROJECT_HASH_MISMATCH'&&JSON.stringify(corruptEvidence.row)===corrupted;
 return {proof,readCounts:{recovery:recovery.length,activation:activation.length},readEvidence:{reads,summaryScans,sessionReads:observation.sessionReads.slice(),sessionKey:observation.sessionKey,ready:observation.ready,readyError:observation.readyError,recoveryErrorAtReady:observation.recoveryErrorAtReady}};
}
