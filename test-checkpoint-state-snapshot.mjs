import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
export function verifyCheckpointStateSnapshot(){
 const source=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8');
 assert.ok(source.includes('stateCapture=copyCheckpointValueSnapshot(prepared.state);'),'CHECKPOINT_STATE_CAPTURE_REQUIRED');
 assert.ok(source.includes('unchangedCheckpointValueSnapshot(stateCapture,prepared.state)'),'CHECKPOINT_STATE_GATE_REQUIRED');
 assert.ok(source.includes('if(stateCapture)releaseCheckpointValueSnapshot(stateCapture);'),'CHECKPOINT_STATE_RELEASE_REQUIRED');
 const section=source.slice(source.indexOf('function verifiedGraphNodes('),source.indexOf('const VERIFIED_PROJECT_INTEGRITY='));
 const context=vm.createContext({Blob,TextEncoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,structuredClone});vm.runInContext(fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8'),context);
 vm.runInContext(`const hash=closedLoopHash,clone=structuredClone;let walks=0;${section.replace('function verifiedGraphNodes(value){','function verifiedGraphNodes(value){walks++;')}const shared={sha:'x',byteSize:4};const candidate={entries:[{parts:[shared,shared],view:{draft:'kept'}}],files:{x:{byteSize:4}},generation:7};const proof=copyCheckpointValueSnapshot(candidate);`,context);
 const run=s=>vm.runInContext(s,context);
 assert.equal(run('proof.nodes!==null'),true,'CHECKPOINT_STATE_NATIVE_PROOF');const initial=run('walks');
 for(let i=0;i<3;i++)assert.equal(run('unchangedCheckpointValueSnapshot(proof,candidate)'),true);
 assert.equal(run('walks')-initial,3,'CHECKPOINT_STATE_CURRENT_ALWAYS_WALKED');
 assert.equal(run('proof.snapshot.entries[0].parts[0]===proof.snapshot.entries[0].parts[1]'),true);
 run("candidate.entries[0].view.draft='changed'");assert.equal(run('unchangedCheckpointValueSnapshot(proof,candidate)'),false,'CHECKPOINT_STATE_MUTATION_REJECTED');run("candidate.entries[0].view.draft='kept'");
 run('const originalNames=Object.getOwnPropertyNames;Object.getOwnPropertyNames=function(value){return originalNames(value);};');
 assert.equal(run('unchangedCheckpointValueSnapshot(proof,candidate)'),true);assert.equal(run('proof.nodes===null&&proof.scope===null'),true,'CHECKPOINT_STATE_NATIVE_CHANGE_RELEASES');
 run('Object.getOwnPropertyNames=originalNames;');const before=run('walks');assert.equal(run('unchangedCheckpointValueSnapshot(proof,candidate)'),true);assert.equal(run('walks')-before,2,'CHECKPOINT_STATE_INVALIDATED_PROOF_CANNOT_REVIVE');
 run('releaseCheckpointValueSnapshot(proof);');assert.equal(run('proof.nodes===null&&proof.scope===null'),true);
 // Current candidates are not trusted by identity: Proxy descriptor traps,
 // accessors, cycles and unsupported shapes must retain the cold rejection.
 run('const second=copyCheckpointValueSnapshot(candidate);');
 for(const [label,expression] of [['symbol','({...candidate,[Symbol("x")]:1})'],['getter','Object.defineProperty({...candidate},"generation",{enumerable:true,get(){return 7;}})'],['cycle','(()=>{const c={...candidate};c.self=c;return c;})()'],['proxy-change','new Proxy(candidate,{getOwnPropertyDescriptor(target,key){const d=Reflect.getOwnPropertyDescriptor(target,key);return key==="generation"?{...d,value:8}:d;}})']])assert.equal(run(`unchangedCheckpointValueSnapshot(second,${expression})`),false,'CHECKPOINT_STATE_UNUSUAL_INPUT:'+label);
 assert.throws(()=>run('unchangedCheckpointValueSnapshot(second,new Proxy(candidate,{getOwnPropertyDescriptor(){throw new Error("PROXY_TRAP");}}))'),/PROXY_TRAP/);
 run('releaseCheckpointValueSnapshot(second);');
 return {checkpointStateSnapshot:'PASS',currentWalksPerComparison:1,privateSnapshotAliasPreserved:true,currentMutationRejected:true,nativeReplacementInvalidates:true,restoredNativeDoesNotRevive:true,unusualInputCases:5,released:true};
}

export async function verifyCheckpointStateCommitMutation(){
 const {projectStoreRuntime}=await import('./test-project-store-runtime.mjs');
 const original=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8');
 const anchor="const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite'),owner=checkpointTransactionOwner(tx,jobId),meta=tx.objectStore(META);";
 assert.equal(original.split(anchor).length,2,'CHECKPOINT_STATE_OWNER_ANCHOR');
 async function control(source){
  const r=projectStoreRuntime({sourceOverrides:{'project-store.js':source.replace(anchor,anchor+'globalThis.__changeCheckpointState?.(prepared.state);')},storageWorker:false});
  let p=await r.store.createProject({commandId:'CHECKPOINT-STATE-SNAPSHOT-CONTROL'});p.job.JOB_TITLE='Checkpoint state integrity';r.engine.recalculate(p);p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});await r.store.readProject(p.job.JOB_ID);
  const save=view=>r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:r.copy({activeStage:1,activeView:view,drafts:{},scrollX:0,scrollY:0})});
  await save('Project');const before=r.copy([...r.rows].map(([name,rows])=>[name,[...rows]]));let attempted=0;
  r.runtime.__changeCheckpointState=state=>{attempted++;state.title='Unexpected mutation after preparation';};
  await assert.rejects(()=>save('Workflow'),error=>error.code==='HISTORY_VERSION_MISMATCH','CHECKPOINT_STATE_MUTATION_ABORT');
  assert.equal(attempted,1,'CHECKPOINT_STATE_ACTUAL_OWNER');assert.deepEqual(r.copy([...r.rows].map(([name,rows])=>[name,[...rows]])),before,'CHECKPOINT_STATE_ATOMIC_ABORT');
 }
 await control(original);
 const gate='unchangedCheckpointValueSnapshot(stateCapture,prepared.state)';assert.equal(original.split(gate).length,2);
 await assert.rejects(()=>control(original.replace(gate,'true')),error=>error.code==='ERR_ASSERTION'&&error.message.includes('CHECKPOINT_STATE_MUTATION_ABORT'),'CHECKPOINT_STATE_OMITTED_GATE_FAULT');
 return {checkpointStateCommitMutation:'PASS',actualTransactionOwner:true,preparedStateMutationRejected:true,atomicAbort:true,omittedGateFaultDetected:true};
}
