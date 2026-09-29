import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const r=projectStoreRuntime(),{store,core,engine,copy,runtime,rows}=r;
const actions=['CHANGE','SAVE_DRAFT','RESTORE','UNDO_REDO','STALE_WRITE','FAILED_SAVE','INTERRUPTED_RESTORE'];
const depth=3,jobId='GENERATED-RECOVERY-STATES',cases=[],failures=[];
let p=core.createBlankState(jobId);engine.ensureShape(p);engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:0});await store.beginHistorySession('GENERATED-START');
const start=(await store.historyList(jobId)).activeId,known=new Map([[start,copy(p)]]),immutable=new Map();let sequenceNumber=0;
const content=project=>({jobTitle:project.job.JOB_TITLE,projectData:project.projectData,stages:project.stages});
function sequences(prefix=[]){if(prefix.length===depth)return [prefix];return actions.flatMap(action=>sequences([...prefix,action]));}
async function invariants(){
 const current=await store.readProject(jobId),history=await store.historyList(jobId);assert.ok(history.entries.some(entry=>entry.id===start),'Session start was lost');assert.ok(history.entries.some(entry=>entry.id===history.activeId),'Active version is not retained');assert.ok(store.validateProjectIntegrity(current).valid,'Incoherent active project');
 for(const entry of history.entries){const saved=rows.get('meta').get('recovery:'+jobId+':snapshot:'+entry.id).value;if(immutable.has(entry.id))assert.equal(saved.sha256,immutable.get(entry.id),'Retained checkpoint mutated');else immutable.set(entry.id,saved.sha256);}
 p=current;
}
for(const sequence of sequences()){
 sequenceNumber++;let executed=[];
 try{
  p=(await store.restoreCheckpoint(jobId,start,{expectedProjectRevision:p.revision})).project;
  for(const [index,operation] of sequence.entries()){
   const before=copy(p),history=await store.historyList(jobId),selected=Object.keys(runtime.closedLoopWorkflowSchema.STAGE_CONTRACTS).map(Number)[(sequenceNumber+index)%core.STAGES.length];
   if(operation==='CHANGE'){const next=copy(p);next.job.JOB_TITLE='Continuation '+sequenceNumber+'/'+index;p=await store.writeProject(next,{expectedProjectRevision:p.revision});known.set((await store.historyList(jobId)).activeId,copy(p));}
   if(operation==='SAVE_DRAFT'){const id=await store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,view:copy({activeStage:selected,activeView:'Workflow',scrollX:0,scrollY:sequenceNumber,drafts:{'#stage-output':{value:'Unaccepted draft '+sequenceNumber}}})});known.set(id,copy(p));assert.deepEqual(await store.readProject(jobId),p,'Draft capture changed accepted project data');}
   if(operation==='RESTORE'){const ids=[...known.keys()],target=ids[(sequenceNumber*7+index)%ids.length];p=(await store.restoreCheckpoint(jobId,target,{expectedProjectRevision:p.revision})).project;assert.deepEqual(content(p),content(known.get(target)),'Destination version did not restore as a complete whole');}
   if(operation==='UNDO_REDO'&&history.entries.find(entry=>entry.id===history.activeId)?.parentId){const previous=history.entries.find(entry=>entry.id===history.activeId).parentId;p=(await store.restoreCheckpoint(jobId,previous,{expectedProjectRevision:p.revision,mode:'UNDO'})).project;const redo=(await store.historyList(jobId)).redo[0];assert.equal(redo,history.activeId);p=(await store.restoreCheckpoint(jobId,redo,{expectedProjectRevision:p.revision,mode:'REDO'})).project;assert.deepEqual(content(p),content(before));}
   if(operation==='STALE_WRITE'){const next=copy(p);next.job.JOB_TITLE='Rejected stale writer';await assert.rejects(store.writeProject(next,{expectedProjectRevision:p.revision-1}),error=>error.code==='STALE_PROJECT_REVISION');assert.deepEqual(await store.readProject(jobId),before);}
   if(operation==='FAILED_SAVE'){const next=copy(p);next.job.JOB_TITLE='Rejected failed save';runtime.__closedLoopStorageFault='before-transaction-commit';try{await assert.rejects(store.writeProject(next,{expectedProjectRevision:p.revision}),error=>error.code==='INJECTED_STORAGE_FAILURE');}finally{delete runtime.__closedLoopStorageFault;}assert.deepEqual(await store.readProject(jobId),before);}
   if(operation==='INTERRUPTED_RESTORE'){const controller=new AbortController();controller.abort();await assert.rejects(store.restoreCheckpoint(jobId,start,{expectedProjectRevision:p.revision,signal:controller.signal}),error=>error.code==='RESTORE_INTERRUPTED');assert.deepEqual(await store.readProject(jobId),before);}
   executed.push(operation);await invariants();
  }
  cases.push({sequence:sequence.join(' → '),result:'PASS'});
 }catch(error){failures.push({sequence:executed.concat(sequence[executed.length]),message:error.message});break;}
}
assert.deepEqual(failures,[],'A generated failure must be retained as its shortest executed prefix.');
console.log(JSON.stringify({synthetic:true,environment:'Node VM; real store, hash, compression and restoration logic; lifecycle transaction adapter',bounds:{depth,operationChoices:actions,generatedSequences:actions.length**depth,executedSequences:cases.length,checksPerSequence:depth,maxRetainedCheckpoints:store.HISTORY_LIMITS.maxCheckpoints},assumptions:['Single project; no real browser or external delivery','Native history and all-stage execution are separate browser journeys','Depth-three recovery/concurrency compositions supplement the existing reservation and acceptance suites'],failures,cases},null,2));
