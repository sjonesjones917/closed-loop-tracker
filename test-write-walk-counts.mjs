// Pins the whole-project graph passes of the store's write path: every
// verifiedGraphNodes walk of a project-sized graph and every private copy of
// a project, per canonical write, per operational write and per
// root-continuation checkpoint, plus the digest scopes those writes create.
// A pass removed on purpose lowers its pin here; a pass added back fails the
// pin. Sources are instrumented in memory only; production files are unchanged.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

// Totals per command (walks include the walk inside each copy; a copy is a
// private whole-project copy). Captured
// private receipts and source copies compare by walking the current side only;
// the operational write receipt, whose snapshot is copied again, walks both.
export const WRITE_WALK_PINS=Object.freeze({
 canonicalWrite:Object.freeze({walks:26,copies:8,digestScopes:0}),
 firstOperationalWrite:Object.freeze({walks:59,copies:12,digestScopes:0}),
 operationalWrite:Object.freeze({walks:57,copies:12,digestScopes:0})
});
// The same commands in a storage-worker realm. Each measured write follows a
// write whose root no checkpoint consumed, so the lazy first use of that
// root's write certificate (firstUsePendingWriteRoot, which mints its History
// root proof) runs inside it: one writeRootBytesVerified call (its
// rootBytesWalksPerCall walks, plus the private copy of the restored root,
// one copy and its walk) moves from the next checkpoint into the next write:
// +4 walks and +1 copy per such write, checkpoints unchanged.
export const WRITE_WALK_WORKER_PINS=Object.freeze({
 canonicalWrite:Object.freeze({walks:30,copies:9,digestScopes:0,rootBytesCalls:1}),
 firstOperationalWrite:Object.freeze({walks:63,copies:13,digestScopes:0,rootBytesCalls:1}),
 operationalWrite:Object.freeze({walks:61,copies:13,digestScopes:0,rootBytesCalls:1}),
 'viewCheckpoint:Project':Object.freeze({walks:28,copies:2,digestScopes:0,rootBytesCalls:1}),
 'viewCheckpoint:Workflow':Object.freeze({walks:24,copies:1,digestScopes:0,rootBytesCalls:0})
});
// Walks at the sites whose double walks were removed. The operational History
// candidate is its own bound pair snapshot: each of the four pair checks walks
// it once. A write-certified root's snapshot is walked once per use for both
// of its comparisons. Only an unbound History candidate gets its own receipt.
export const WRITE_SITE_PINS=Object.freeze({
 digestPairWalksPerOperationalWrite:4,
 operationalReceiptCopies:3,
 rootContinuationWalksPerCall:3,
 rootBytesWalksPerCall:3
});
const replaceOnce=(source,before,after)=>{assert.equal(source.split(before).length,2,'WRITE_WALK_COUNT_ANCHOR_ORACLE: '+before.slice(0,80));return source.replace(before,after);};
// Function names of the nearest frames above the instrumented call.
const FRAMES="String(new Error().stack).split('\\n').slice(2,8).map(line=>{const match=/at (?:async )?(?:Object\\.)?([A-Za-z0-9_$]+)/.exec(line.trim());return match?match[1]:'';})";
export function instrumentWriteWalks(source,hashSource){
 source=replaceOnce(source,'function verifiedGraphNodes(value){',`function verifiedGraphNodes(value){const counted=verifiedGraphNodesUncounted(value,arguments[1]);if(counted&&counted.size>=globalThis.__walkThreshold)globalThis.__recordPass('walk',${FRAMES});return counted;}\nfunction verifiedGraphNodesUncounted(value){`);
 // Count each ordinary whole-project copy where the target is populated.
 // This includes direct copies from a previously inspected graph.
 const copier='function copyVerifiedGraph(value,sourceNodes,capturedNodes=null,arrayLengths=null){';
 source=replaceOnce(source,copier,`${copier}if(value&&typeof value==='object'&&Object.hasOwn(value,'projectData'))globalThis.__recordPass('copy',${FRAMES});`);
 source=replaceOnce(source,'function usableRootContinuation(proof,read,descriptor){','function usableRootContinuation(proof,read,descriptor){globalThis.__recordPass(\'call:usableRootContinuation\',[]);');
 source=replaceOnce(source,'async function writeRootBytesVerified(proof,body,readFile,verifiedParts,verifiedByteDigests){','async function writeRootBytesVerified(proof,body,readFile,verifiedParts,verifiedByteDigests){if(unverifiedWriteRoots.has(proof)&&rootCertificates.has(proof))globalThis.__recordPass(\'call:writeRootBytesVerified\',[]);');
 source=replaceOnce(source,'globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS','globalThis.__projectNodes=value=>verifiedGraphNodesUncounted(value)?.size||0;globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS');
 hashSource=replaceOnce(hashSource,'function createCanonicalDigestScope(root){',`function createCanonicalDigestScope(root){if(root!==null)globalThis.__recordPass?.('scope',${FRAMES});`);
 return {source,hashSource};
}
const near=(row,name,depth=3)=>row.frames.slice(0,depth).includes(name);
function summarize(passes){
 const walks=passes.filter(row=>row.kind==='walk'),copies=passes.filter(row=>row.kind==='copy');
 return {walks:walks.length,copies:copies.length,digestScopes:passes.filter(row=>row.kind==='scope').length,
  digestPairWalks:walks.filter(row=>near(row,'assertDigestPair',4)).length,
  operationalReceiptCopies:copies.filter(row=>{const at=row.frames.indexOf('verifiedProjectIntegrity');return at>=0&&at<3&&row.frames[at+1]==='writeOperationalProject';}).length,
  rootContinuationWalks:walks.filter(row=>near(row,'usableRootContinuation')&&!row.frames.includes('copyVerifiedTree')).length,
  rootContinuationCalls:passes.filter(row=>row.kind==='call:usableRootContinuation').length,
  rootBytesWalks:walks.filter(row=>near(row,'writeRootBytesVerified')&&!near(row,'copyVerifiedTree')&&!row.frames.includes('restoreHistoryProject')).length,
  rootBytesCalls:passes.filter(row=>row.kind==='call:writeRootBytesVerified').length};
}
// Runs the commands and returns the observed passes per command.
// workerRealm runs the same commands in a storage-worker realm
// (project-store.js?storeWorker=1), where History root proofs are minted.
export async function measureWriteWalks({source=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8'),hashSource=fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8'),workerRealm=false}={}){
 const instrumented=instrumentWriteWalks(source,hashSource);let passes=[];
 const worker=workerRealm?{location:{search:'?storeWorker=1&v=WRITE-WALK-COUNTS'},URLSearchParams,importScripts(){},addEventListener(){},postMessage(){}}:{};
 const r=projectStoreRuntime({storageWorker:false,sourceOverrides:{'project-store.js':instrumented.source,'hash.js':instrumented.hashSource},environment:{...worker,__walkThreshold:Infinity,__recordPass:(kind,frames)=>passes.push({kind,frames:[...frames]})}});
 r.runtime.Error.stackTraceLimit=Math.max(Number(r.runtime.Error.stackTraceLimit)||0,16);
 const measure=async command=>{passes=[];const result=await command();return {result,observed:summarize(passes)};};
 let p=await r.store.createProject({commandId:'WRITE-WALK-COUNTS'});p.job.JOB_TITLE='Exact walk count title '+'independent retained content '.repeat(300);r.engine.recalculate(p);
 p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});p=await r.store.readProject(p.job.JOB_ID);
 const projectNodes=r.runtime.__projectNodes(p);assert.ok(projectNodes>200,'WRITE_WALK_COUNT_FIXTURE_ORACLE: project graph too small to separate whole-project passes');
 // Graphs of at least 80% of the project's nodes are whole-project passes; the
 // views, journals and History states compared on this path are far smaller.
 r.runtime.__walkThreshold=Math.floor(projectNodes*0.8);
 const cases=[];
 const canonical=await measure(()=>{const next=r.copy(p);next.job.JOB_TITLE='Exact second walk count title '+'independent retained content '.repeat(300);r.engine.recalculate(next);return r.store.writeProject(next,{expectedProjectRevision:p.revision});});
 p=canonical.result;cases.push({command:'canonicalWrite',...canonical.observed});
 const views=['Records','Workflow'];
 for(const command of ['firstOperationalWrite','operationalWrite']){
  const operational=await measure(()=>{const next=r.copy(p);next.activeView=views[cases.length%2];return r.store.writeProject(next,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});});
  p=operational.result;cases.push({command,...operational.observed});
 }
 // Consecutive changed views: each uses the certified root of the save before.
 const view=name=>r.copy({activeStage:1,activeView:name,drafts:{'#exact':{value:name+' exact draft'}},scrollX:0,scrollY:17});
 for(const name of ['Project','Workflow']){const saved=await measure(()=>r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:view(name)}));cases.push({command:'viewCheckpoint:'+name,...saved.observed});}
 // An operational caller can pass a descriptor trap. Initial qualification
 // observes the old title; the copy must observe the subsequently changed
 // canonical work and reject the whole write, including the view edit.
 const incoming=r.copy(p),durable=()=>r.copy([...r.rows].map(([name,rows])=>[name,[...rows]])),before=durable();
 incoming.activeView=incoming.activeView==='Workflow'?'Records':'Workflow';
 let titleReads=0;
 incoming.job=new Proxy(incoming.job,{getOwnPropertyDescriptor(target,key){
  const descriptor=Reflect.getOwnPropertyDescriptor(target,key);
  if(key!=='JOB_TITLE'||!descriptor)return descriptor;
  titleReads++;
  return {...descriptor,value:titleReads<=2?descriptor.value:'Canonical title injected after initial discovery'};
 }});
 await assert.rejects(()=>r.store.writeProject(incoming,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256}),
  error=>error.code==='OPERATIONAL_OWNERSHIP_VIOLATION'&&error.message==='An operational response event attempted to change canonical work: /job/JOB_TITLE','OPERATIONAL_CALLER_COPY_OWNERSHIP');
 assert.ok(titleReads>=3,'OPERATIONAL_CALLER_COPY_REINSPECTED');
 assert.deepEqual(durable(),before,'OPERATIONAL_CALLER_COPY_REFUSAL_ATOMIC');
 return {projectNodes,walkThreshold:r.runtime.__walkThreshold,cases};
}
// No-op comparisons change the cost of the initial digest, never its
// admissibility, error text, required confirmation identity or CAS order.
export async function verifyWriteDigestPreflights(){
 const source=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8');
 class LocalEncoder extends TextEncoder{}
 Object.defineProperty(LocalEncoder.prototype,'encode',Object.getOwnPropertyDescriptor(TextEncoder.prototype,'encode'));
 const r=projectStoreRuntime({storageWorker:false,sourceOverrides:{'project-store.js':source},environment:{TextEncoder:LocalEncoder}});
 let p=await r.store.createProject({commandId:'WRITE-DIGEST-PREFLIGHT'});
 p.job.JOB_TITLE='Guarded preflight';r.engine.recalculate(p);p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});
 const options=()=>({expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 const oldRevision=p.revision;
 const canonical=r.copy(p);canonical.job.JOB_TITLE='Updated preflight';r.engine.recalculate(canonical);
 p=await r.store.writeProject(canonical,options());
 assert.equal(p.revision,oldRevision+1);assert.equal(p.projectSha256,r.store.projectSha256(p));
 const unchanged=await r.store.writeProject(r.copy(p),{...options(),operational:true});
 assert.equal(unchanged.projectSha256,p.projectSha256);assert.equal(unchanged.revision,p.revision);
 const extra=r.copy(p);extra.activeView='Records';p=await r.store.writeProject(extra,{...options(),operational:true});
 assert.equal(p.projectSha256,r.store.projectSha256(p));
 const ordinary=r.store.mutationImpact(p,p,p);
 assert.equal(ordinary.candidateSha256,p.projectSha256);
 const prior=r.copy(p);
 prior.projectData.acceptedChanges.push({changeId:'REVIEW-WRITE',stage:1,active:true});
 const required=r.store.mutationImpact(prior,p,p);
 assert.equal(required.requiresConfirmation,true);assert.equal(required.candidateSha256,p.projectSha256,'REQUIRED_REVIEW_DIGEST');
 // The cold digest consumes the first root observation and every descriptor
 // in encoder order, including an input that temporarily replaces TextEncoder.
 {
  const transient=r.copy(p);let reads=0;
  Object.defineProperty(transient,'extraRoot',{enumerable:true,get(){return ++reads===1?undefined:'later';}});
  assert.throws(()=>r.store.mutationImpact(p,transient,transient),error=>error.message==='Cannot canonically hash undefined at $.extraRoot.');
  assert.equal(reads,1,'PREFLIGHT_SINGLE_ROOT_OBSERVATION');
 }
 {
  const transient=r.copy(p);let reads=0;
  transient.nested=new Proxy(r.copy({leaf:true}),{getOwnPropertyDescriptor(target,key){
    const d=Reflect.getOwnPropertyDescriptor(target,key);
    return key==='leaf'?{...d,value:++reads===1?'valid':undefined}:d;
  }});
  assert.throws(()=>r.store.mutationImpact(p,transient,transient),error=>error.message==='Cannot canonically hash undefined at $.nested.leaf.');
  assert.equal(reads,2,'PREFLIGHT_ENCODER_DESCRIPTOR_ORDER');
 }
 const swapResult=vm.runInContext(`(()=>{
  const original=TextEncoder.prototype.encode;
  const extension=new Proxy({a:'x'.repeat(70000),z:1},{getOwnPropertyDescriptor(target,key){
    if(key==='a')TextEncoder.prototype.encode=()=>{throw new Error('TRANSIENT_PREFLIGHT_ENCODER');};
    if(key==='z')TextEncoder.prototype.encode=original;
    return Reflect.getOwnPropertyDescriptor(target,key);
  }});
  const project={job:{JOB_ID:'ENCODER-SWAP'},projectData:{extension},activeStage:1};
  try{return closedLoopProjectStore.mutationImpact(null,project,project,{candidateWhenRequired:true}).requiresConfirmation;}
  catch(error){return error.message;}finally{TextEncoder.prototype.encode=original;}
 })()`,r.runtime);
 assert.equal(swapResult,'TRANSIENT_PREFLIGHT_ENCODER','PREFLIGHT_TRANSIENT_ENCODER_REFUSAL');
 // Each write path must still reject
 // malformed extension values at the canonical encoder, before recalculation.
 for(const leaf of ['\uD800',-0,undefined]){
  const invalid=r.copy(p);invalid.extra=r.copy({leaf});
  let expected;try{r.store.projectSha256(invalid);}catch(error){expected=error;}
  assert.ok(expected,'INVALID_EXTENSION_DIGEST_ORACLE');
  const same=error=>error.name===expected.name&&error.message===expected.message;
  assert.throws(()=>r.store.mutationImpact(p,invalid,invalid),same);
  await assert.rejects(r.store.writeProject(invalid,{...options(),skipUnchanged:false}),same);
  await assert.rejects(r.store.writeProject(invalid,{...options(),operational:true}),same);
  await assert.rejects(r.store.writeProject(invalid,{...options(),expectedProjectRevision:p.revision+5}),error=>error.code==='STALE_PROJECT_REVISION');
 }
 // A changed encoding native must actually be called, even on an unchanged
 // write, and an unnecessary page confirmation must not hide its failure.
 const warm=r.copy(p);warm.activeView='Workflow';p=await r.store.writeProject(warm,{...options(),operational:true});
 const original=r.runtime.JSON.stringify,marker='refuse swapped encoding native';
 r.runtime.JSON.stringify=function(value,...args){if(value==='Updated preflight')throw new Error(marker);return Reflect.apply(original,this,[value,...args]);};
 try{
  assert.throws(()=>r.store.mutationImpact(p,p,p),error=>error.message===marker);
  await assert.rejects(r.store.writeProject(r.copy(p),{...options(),operational:true}),error=>error.message===marker);
 }finally{r.runtime.JSON.stringify=original;}
 assert.equal((await r.store.readProject(p.job.JOB_ID)).projectSha256,p.projectSha256,'FAILED_PREFLIGHT_PRESERVES_ROW');
 // A replaced hook can supply a Proxy to a private candidate even if that
 // very hook certified the preceding write. Its encoder refusal stays cold.
 const prompts=r.runtime.closedLoopPromptEngine;let armed,reads=0,hooks=0;
 r.runtime.closedLoopPromptEngine=Object.freeze({...prompts,copyRetainedPromptContextFiles(from,to,...args){
  const result=prompts.copyRetainedPromptContextFiles(from,to,...args);
  if(armed&&from===armed){hooks++;to.extra=new Proxy(to.extra,{getOwnPropertyDescriptor(target,key){
    const d=Reflect.getOwnPropertyDescriptor(target,key);return key==='leaf'?{...d,value:++reads===1?'ok':undefined}:d;
  }});}
  return result;
 }});
 try{
  const withHook=r.copy(p);withHook.extra=r.copy({leaf:'ok'});withHook.job.JOB_TITLE='Certify with replaced hook';r.engine.recalculate(withHook);
  p=await r.store.writeProject(withHook,options());armed=r.copy(p);
  await assert.rejects(r.store.writeProject(armed,{...options(),operational:true}),error=>error.message==='Cannot canonically hash undefined at $.extra.leaf.');
  assert.equal(hooks,1,'WRITE_PRECHECK_REPLACED_HOOK_REACHED');assert.equal(reads,2,'WRITE_PRECHECK_REPLACED_HOOK_ENCODER_ORDER');
 }finally{r.runtime.closedLoopPromptEngine=prompts;}
}
// Both sources cross replaceable owners. An operational pair must inspect
// its copy again. A warm read must describe the source actually replayed.
export async function verifyOperationalWriteWitnesses(){
 const source=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8');
 const pairBoundary='  const primitive=rootDigestPrimitivesUnchanged(initialRootDigestPrimitives)?initialRootDigestPrimitives:null,snapshot=';
 const tapped=replaceOnce(source,pairBoundary,'  globalThis.__beginPairWitness?.();\n'+pairBoundary);
 let pairActive=false,armedInput,installed=0,reads=0;
 const r=projectStoreRuntime({storageWorker:false,sourceOverrides:{'project-store.js':tapped},environment:{__beginPairWitness(){pairActive=true;}}});
 const prompts=r.runtime.closedLoopPromptEngine;
 r.runtime.closedLoopPromptEngine=Object.freeze({...prompts,copyRetainedPromptContextFiles(from,to,...args){
  const result=prompts.copyRetainedPromptContextFiles(from,to,...args);
  if(armedInput&&from===armedInput){installed++;to.extra=new Proxy(to.extra,{
   getOwnPropertyDescriptor(target,key){
    const d=Reflect.getOwnPropertyDescriptor(target,key);
    return pairActive&&key==='leaf'&&++reads===2?{configurable:true,enumerable:true,get(){return 1;}}:d;
   },
   get(target,key,receiver){
    if(pairActive&&key==='leaf'&&reads===3)throw new Error('PAIR_REINSPECTION_REFUSAL');
    return Reflect.get(target,key,receiver);
   }
  });}
  return result;
 }});
 let transactionArmed=false,detachedRow,targetView,mutations=0;
 const open=r.runtime.openStorageTransaction,engine=r.runtime.closedLoopWorkflowEngine;
 r.runtime.openStorageTransaction=async(names,mode)=>{
  const tx=await open(names,mode);
  if(transactionArmed&&mode==='readwrite'){
   const objectStore=tx.objectStore;
   tx.objectStore=name=>{
    const store=objectStore(name);
    if(name==='projects'){const get=store.get;store.get=key=>{
     const request=get(key);if(request.result?.project)detachedRow=request.result;return request;
    };}
    return store;
   };
  }
  return tx;
 };
 r.runtime.closedLoopWorkflowEngine=Object.freeze({...engine,validateAllocationReceipts(...args){
  // This owner runs after the row comparison, before diff and replay. Only
  // the detached read is changed; the actual stored row retains its view.
  if(transactionArmed&&detachedRow){detachedRow.project.activeView=targetView;mutations++;transactionArmed=false;}
  return engine.validateAllocationReceipts(...args);
 }});
 let p=await r.store.createProject({commandId:'OPERATIONAL-SOURCE-WITNESSES'});
 p.extra=r.copy({leaf:1});p.job.JOB_TITLE='Write sources';r.engine.recalculate(p);p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});
 const originalView=p.activeView,views=['Project','Workflow','Records'].filter(view=>view!==originalView);
 const options=()=>({operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 const op=view=>{const candidate=r.copy(p);candidate.activeView=view;return r.store.writeProject(candidate,options());};
 armedInput=r.copy(p);armedInput.activeView=views[0];pairActive=false;
 await assert.rejects(r.store.writeProject(armedInput,options()),error=>error.message==='PAIR_REINSPECTION_REFUSAL','PAIR_REINSPECTION_ORACLE');
 assert.equal(installed,1);assert.equal(reads,3);assert.equal(r.rows.get('meta').has('responseOperations:'+p.job.JOB_ID),false,'REFUSED_PAIR_PRESERVES_STORAGE');
 armedInput=null;p=await op(views[0]);targetView=views[1];transactionArmed=true;p=await op(targetView);
 assert.equal(mutations,1,'DETACHED_SOURCE_MUTATION_REACHED');
 assert.equal(r.rows.get('projects').get(p.job.JOB_ID).project.activeView,originalView,'DETACHED_SOURCE_LEAVES_NATIVE_ROW');
 const journal=r.rows.get('meta').get('responseOperations:'+p.job.JOB_ID);
 assert.equal(journal.value.patches.some(patch=>patch.path[0]==='activeView'),false,'DETACHED_SOURCE_JOURNAL_FIXTURE');
 await assert.rejects(op(targetView),error=>error.code==='OPERATIONAL_STATE_INTEGRITY_FAILED'&&error.message==='Saved response operations failed integrity verification. Their exact state was preserved in quarantine.','REPLAY_SOURCE_QUARANTINE_ORACLE');
}
export async function verifyWriteWalkCounts(options={}){
 const {projectNodes,walkThreshold,cases}=await measureWriteWalks(options);
 for(const row of cases.filter(row=>Object.hasOwn(WRITE_WALK_PINS,row.command))){
  const pin=WRITE_WALK_PINS[row.command];
  assert.deepEqual({walks:row.walks,copies:row.copies,digestScopes:row.digestScopes},{...pin},'WRITE_WALK_COUNT_PIN_ORACLE: '+row.command);
 }
 for(const row of cases.filter(row=>row.command.endsWith('perationalWrite'))){
  assert.equal(row.digestPairWalks,WRITE_SITE_PINS.digestPairWalksPerOperationalWrite,'WRITE_WALK_DIGEST_PAIR_ORACLE: '+row.command);
  assert.equal(row.operationalReceiptCopies,WRITE_SITE_PINS.operationalReceiptCopies,'WRITE_WALK_OPERATIONAL_RECEIPT_ORACLE: '+row.command);
 }
 const checkpoints=cases.filter(row=>row.command.startsWith('viewCheckpoint:')),continuationCalls=checkpoints.reduce((sum,row)=>sum+row.rootContinuationCalls,0),bytesCalls=checkpoints.reduce((sum,row)=>sum+row.rootBytesCalls,0);
 assert.ok(continuationCalls>0&&bytesCalls>0,'WRITE_WALK_ROOT_FIXTURE_ORACLE: the view checkpoints must use a write-certified root');
 for(const row of checkpoints){
  assert.equal(row.rootContinuationWalks,row.rootContinuationCalls*WRITE_SITE_PINS.rootContinuationWalksPerCall,'WRITE_WALK_ROOT_CONTINUATION_ORACLE: '+row.command);
  assert.equal(row.rootBytesWalks,row.rootBytesCalls*WRITE_SITE_PINS.rootBytesWalksPerCall,'WRITE_WALK_ROOT_BYTES_ORACLE: '+row.command);
 }
 const worker=await measureWriteWalks({...options,workerRealm:true});
 assert.deepEqual(worker.cases.map(row=>row.command),Object.keys(WRITE_WALK_WORKER_PINS),'WRITE_WALK_WORKER_FIXTURE_ORACLE');
 for(const row of worker.cases){
  const pin=WRITE_WALK_WORKER_PINS[row.command];
  assert.deepEqual({walks:row.walks,copies:row.copies,digestScopes:row.digestScopes,rootBytesCalls:row.rootBytesCalls},{...pin},'WRITE_WALK_WORKER_PIN_ORACLE: '+row.command);
  assert.equal(row.rootBytesWalks,row.rootBytesCalls*WRITE_SITE_PINS.rootBytesWalksPerCall,'WRITE_WALK_ROOT_BYTES_ORACLE worker: '+row.command);
 }
 await verifyWriteDigestPreflights();await verifyOperationalWriteWitnesses();
 return {passed:true,projectNodes,walkThreshold,pins:WRITE_WALK_PINS,workerPins:WRITE_WALK_WORKER_PINS,sitePins:WRITE_SITE_PINS,cases,workerCases:worker.cases,boundary:'In-memory instrumented production store and hash sources over the transaction adapter; counts whole-project graph walks and copies per command, not time.'};
}
// Intended faults: each restores one removed pass and must fail its pin.
export const WRITE_WALK_FAULTS=Object.freeze({
 'write-digest-scope':['  globalThis.closedLoopWorkflowEngine.recalculate(next);const operationalChangePatches=','  hash.disposeCanonicalDigestScope(hash.createCanonicalDigestScope({rawResponses:next.projectData.rawResponses}));globalThis.closedLoopWorkflowEngine.recalculate(next);const operationalChangePatches=','WRITE_WALK_COUNT_PIN_ORACLE'],
 'digest-pair-self-compare':['project===pair.snapshot?checkpointPairSnapshotMatches(pair):checkpointPairMatches(pair,project)','checkpointPairMatches(pair,project)','WRITE_WALK_COUNT_PIN_ORACLE'],
 'bound-history-receipt':['historyIntegrity=pair?null:verifiedProjectIntegrity(historyCandidate,digest);','historyIntegrity=verifiedProjectIntegrity(historyCandidate,digest);','WRITE_WALK_COUNT_PIN_ORACLE'],
 'root-continuation-double-walk':['verifiedValueMatchesNodes(proof.snapshot,snapshotNodes,canonicalProject(read.project))','verifiedValuesEqual(proof.snapshot,canonicalProject(read.project))','WRITE_WALK_ROOT_CONTINUATION_ORACLE'],
 'uncaptured-private-receipts':['if(capture!==CAPTURED_PROJECT_INTEGRITY)return {kind:VERIFIED_PROJECT_INTEGRITY,','if(true)return {kind:VERIFIED_PROJECT_INTEGRITY,','WRITE_WALK_COUNT_PIN_ORACLE'],
 'uncaptured-source-copies':['function capturedPrivateCopy(value){','function capturedPrivateCopy(value){return copyVerifiedTree(value);','WRITE_WALK_COUNT_PIN_ORACLE'],
 'root-bytes-double-walk':['verifiedValueMatchesNodes(proof.snapshot,snapshotNodes,proof.project)){unverifiedWriteRoots.delete(proof);','verifiedValuesEqual(proof.snapshot,proof.project)){unverifiedWriteRoots.delete(proof);','WRITE_WALK_ROOT_BYTES_ORACLE'],
 'skip-lazy-first-use':['async function firstUsePendingWriteRoot(){\n','async function firstUsePendingWriteRoot(){return;\n','WRITE_WALK_WORKER_PIN_ORACLE']
});
export async function verifyWriteWalkCountFaults({source=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8')}={}){
 const faults=[];
 for(const [fault,[before,after,oracle]]of Object.entries(WRITE_WALK_FAULTS)){
  await assert.rejects(()=>verifyWriteWalkCounts({source:replaceOnce(source,before,after)}),error=>error.code==='ERR_ASSERTION'&&error.message.includes(oracle),'WRITE_WALK_INTENDED_FAULT_ORACLE '+fault);
  faults.push({fault,oracle,detected:true});
 }
 return {passed:true,faults};
}
// The one-walk pair check against the original two-walk expression,
// checkpointPairMatches(proof,proof.snapshot), on fresh fixtures per
// implementation: same result or same thrown error, and the same root getter
// calls. Proxies here answer every inspection consistently.
const functionText=(source,start)=>{const first=source.indexOf(start);assert.ok(first>=0&&source.indexOf(start,first+1)<0,'WRITE_WALK_PAIR_OWNER_ORACLE: '+start);const last=source.indexOf('\n}\n',first);return source.slice(first,last+3);};
export function verifyDigestPairSelfMatch({source=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8')}={}){
 const section=source.slice(source.indexOf('function verifiedGraphNodes('),source.indexOf('const VERIFIED_PROJECT_INTEGRITY='));
 const owners=[functionText(source,'function checkpointPairMatches(proof,project){'),functionText(source,'function checkpointPairSnapshotMatches(proof){')].join('');
 const load=()=>new Function('clone',`const canonicalProject=project=>{const copy={...project};delete copy.projectSha256;return copy;};const checkpointDigestPairs=new WeakSet(),primitiveState={current:true};const rootDigestPrimitivesUnchanged=primitive=>primitive===primitiveState&&primitiveState.current;${section}${owners};return {checkpointDigestPairs,primitiveState,original:proof=>checkpointPairMatches(proof,proof.snapshot),candidate:checkpointPairSnapshotMatches};`)(value=>structuredClone(value));
 const fixtures={
  'shared-aliases':()=>{const shared=[1,{deep:'x'}];return {snapshot:{job:{JOB_ID:'J'},projectData:{a:shared,b:shared},n:Number.NaN,z:-0}};},
  'own-project-digest':()=>({snapshot:{job:{},projectSha256:'0'.repeat(64)}}),
  'unregistered-pair':()=>({snapshot:{job:{}},register:false}),
  'changed-primitives':()=>({snapshot:{job:{}},primitives:false}),
  'root-accessor':state=>({snapshot:Object.defineProperty({job:{}},'stages',{get(){state.getters++;return {};},enumerable:true,configurable:true})}),
  'root-throwing-accessor':state=>({snapshot:Object.defineProperty({job:{}},'stages',{get(){state.getters++;throw new RangeError('ROOT_GETTER');},enumerable:true,configurable:true})}),
  'root-self-replacing-accessor':state=>{const snapshot={job:{}};Object.defineProperty(snapshot,'stages',{get(){state.getters++;Object.defineProperty(snapshot,'stages',{value:{replaced:true},enumerable:true,writable:true,configurable:true});return {replaced:false};},enumerable:true,configurable:true});return {snapshot};},
  'root-self-replacing-equal-accessor':state=>{const snapshot={job:{}};Object.defineProperty(snapshot,'stages',{get(){state.getters++;Object.defineProperty(snapshot,'stages',{value:{same:[1]},enumerable:true,writable:true,configurable:true});return {same:[1]};},enumerable:true,configurable:true});return {snapshot};},
  'root-hidden':()=>({snapshot:Object.defineProperty({job:{}},'hidden',{value:1,enumerable:false})}),
  'root-symbol':()=>({snapshot:{job:{},[Symbol('extra')]:1}}),
  'root-null-prototype':()=>({snapshot:Object.assign(Object.create(null),{job:{a:1}})}),
  'nested-accessor':state=>({snapshot:{job:Object.defineProperty({},'x',{get(){state.getters++;return 1;},enumerable:true})}}),
  'nested-symbol':()=>({snapshot:{job:{[Symbol('extra')]:1}}}),
  'nested-cycle':()=>{const job={};job.self=job;return {snapshot:{job}};},
  'nested-root-cycle':()=>{const snapshot={job:{}};snapshot.job.root=snapshot;return {snapshot};},
  'nested-function':()=>({snapshot:{job:{run(){}}}}),
  'nested-array-extra-key':()=>({snapshot:{job:Object.assign([1,2],{extra:true})}}),
  'nested-consistent-proxy':()=>({snapshot:{job:new Proxy({a:1},{})}}),
  'nested-throwing-proxy':()=>({snapshot:{job:new Proxy({a:1},{ownKeys(){throw new TypeError('NESTED_TRAP');}})}})
 };
 const cases=[];
 for(const [name,make]of Object.entries(fixtures)){
  const observations=[];
  for(const implementation of ['original','candidate']){
   const api=load(),state={getters:0},fixture=make(state),proof={primitive:fixture.primitives===false?{}:api.primitiveState,snapshot:fixture.snapshot};if(fixture.register!==false)api.checkpointDigestPairs.add(proof);
   let result,error;try{result=api[implementation](proof);}catch(caught){error={name:caught.name,message:caught.message};}
   observations.push({result,error,getters:state.getters});
  }
  assert.deepEqual(observations[1],observations[0],'WRITE_WALK_PAIR_SELF_MATCH_ORACLE: '+name);
  cases.push({name,...observations[1]});
 }
 for(const name of ['shared-aliases','root-self-replacing-equal-accessor'])assert.equal(cases.find(row=>row.name===name).result,true,'WRITE_WALK_PAIR_SELF_MATCH_FIXTURE_ORACLE: '+name);
 return {passed:true,caseCount:cases.length,cases};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const report={writeWalkCounts:await verifyWriteWalkCounts(),digestPairSelfMatch:verifyDigestPairSelfMatch()};
 if(process.argv.includes('--faults'))report.writeWalkCountFaults=await verifyWriteWalkCountFaults();
 console.log(JSON.stringify(report));
}
