(()=>{
'use strict';

// The same store owns transactions in either execution context. The worker
// imports the existing authorities; it does not implement another data model.
const STORE_SCRIPT_URL=typeof document!=='undefined'?document.currentScript?.src:null;
const STORE_WORKER=typeof document==='undefined'&&typeof importScripts==='function'&&new URLSearchParams(globalThis.location?.search||'').get('storeWorker')==='1';
const ARCHIVE_PARSER_WORKER=STORE_WORKER&&new URLSearchParams(globalThis.location.search).get('archiveParser')==='1';
const STORE_BUILD_ID=(STORE_SCRIPT_URL?new URL(STORE_SCRIPT_URL).searchParams.get('v'):STORE_WORKER?new URLSearchParams(globalThis.location.search).get('v'):null)||'UNMANIFESTED_LOCAL_RUNTIME';
// The window and its storage worker are one writer. A delayed notification of
// that writer's own verified commit must not revoke its receiving-side proof.
const STORE_CONTEXT_ID=(STORE_WORKER?new URLSearchParams(globalThis.location.search).get('storeContext'):null)||crypto.randomUUID();
if(STORE_WORKER){const query=globalThis.location.search;importScripts(...['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'].map(file=>file+query));}

const DB_NAME='closed-loop-reliability';
const DB_VERSION=3;
const PROJECTS='projects';
const ARTIFACTS='artifacts';
const META='meta';
const LEGACY_KEYS=Object.freeze(['closed-loop-reliability-projects-v4','closed-loop-reliability-projects-v3','closed-loop-reliability-projects-v2','closed-loop-reliability-projects']);
const STORE_KEY=LEGACY_KEYS[0];
const hash=globalThis.closedLoopHash;
const clone=value=>{const copy=value===undefined?undefined:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));globalThis.closedLoopPromptEngine?.copyRetainedPromptContextFiles?.(value,copy);return copy;};
// Readiness uses verified bytes from this storage context, never a persisted
// success flag. Entries expire on observed byte changes and across tab changes.
let artifactCustody=new Map();
// Private observations belong to the exact returned row and immutable Blob.
// They are never persisted or accepted from caller-supplied metadata.
const artifactReadObservations=new WeakMap();
let custodyEpoch=0;
const custodyInvalidations=new Map();
const custodyKey=(jobId,artifactId)=>JSON.stringify([String(jobId),String(artifactId)]);
function forgetArtifactCustody(jobId,artifactId=null){custodyInvalidations.set(String(jobId),++custodyEpoch);for(const [key,value] of artifactCustody)if(value.jobId===String(jobId)&&(artifactId===null||value.artifactId===String(artifactId)))artifactCustody.delete(key);}
async function observeArtifactCustody(row,observedEpoch=custodyEpoch,publishCustody=true){
 const key=custodyKey(row.jobId,row.artifactId);if(publishCustody)artifactCustody.delete(key);
 if(!(row.blob instanceof Blob))return;
 const sha256=await hash.sha256Bytes(row.blob);
 if(row.blob.size!==row.byteSize||sha256!==row.sha256)return;
 artifactReadObservations.set(row,{blob:row.blob,sha256,byteSize:row.blob.size});
 if(!publishCustody||(custodyInvalidations.get(String(row.jobId))||0)>observedEpoch)return;
 artifactCustody.set(key,{jobId:String(row.jobId),artifactId:String(row.artifactId),filename:row.filename,byteSize:row.blob.size,sha256});
}
async function observedArtifactDigest(row){
 const observed=artifactReadObservations.get(row);
 if(observed&&observed.blob===row.blob&&observed.byteSize===row.blob.size&&observed.byteSize===row.byteSize&&observed.sha256===row.sha256)return observed.sha256;
 return hash.sha256Bytes(row.blob);
}
async function hydrateLegacyRunPromptContexts(project,recoveryArtifacts=null){
 const prompts=globalThis.closedLoopPromptEngine,jobId=projectIdentity(project),texts=new Map(),observedEpoch=custodyEpoch,recoveryFiles=recoveryArtifacts&&new Map(recoveryArtifacts.map(row=>[row.artifactId,row]));
 // Historical independence is assessed from the generation-time bytes. Read
 // only the legacy run carriers that need those bytes, once per exact digest
 // and length in this observation; never reconstruct them from today's state.
 for(const record of project.projectData?.generatedPrompts||[]){
  if(!prompts.requiresRetainedRunContext(record))continue;
  const files=[];let unavailable=false;
  for(const identity of record.contextManifest.promptContext.attachments){
   const key=JSON.stringify([identity.sha256,identity.byteSize]);
   if(!texts.has(key)){
    try{
     const file=recoveryFiles?await verifyPromptContextFile(identity,jobId,recoveryFiles.get(promptContextArtifactId(jobId,identity))):await readPromptContextFile(record,jobId,identity.path),bytes=await hash.readWithDeadline(file.blob.arrayBuffer(),'Reading saved instruction context');
     let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw storageError('Exact saved context bytes are not valid UTF-8.','PROMPT_CONTEXT_INTEGRITY_FAILED');}
     texts.set(key,text);
    }catch(error){if(!['PROMPT_CONTEXT_INTEGRITY_FAILED','PROMPT_CONTEXT_NOT_AUTHORIZED'].includes(error.code))throw error;texts.set(key,null);}
   }
   const text=texts.get(key);if(text===null){unavailable=true;break;}files.push({...identity,text});
  }
  if(!unavailable&&(custodyInvalidations.get(String(jobId))||0)<=observedEpoch){try{prompts.retainPromptContextFiles(record,files);}catch(error){if(error.code!=='PROMPT_CONTEXT_INTEGRITY_FAILED')throw error;}}
 }
}
async function observeProjectArtifactCustody(project){
 const engine=globalThis.closedLoopWorkflowEngine,jobId=projectIdentity(project);
 forgetArtifactCustody(jobId);
 // Reobserve current files and the exact retained attachments still used by
 // active canonical evidence. Historical failing executions keep their own
 // compatible scope; refreshing current custody must not erase that evidence.
 // Legacy run contexts use their exact saved reader below. Unrelated history
 // files remain verified only when their owning operation requests them.
 const artifactIds=new Set(engine.recordsForCurrentScope(project,'artifacts').map(record=>engine.recordId(record,'artifacts')));
 // Explicitly retained supplied input is still a current authorized input after
 // an objective correction. Reuse the intake owner rather than requiring its
 // immutable original input scope to change or a manual file read to restore it.
 for(const artifact of engine.currentAuthorizedInputArtifacts(project))artifactIds.add(engine.recordId(artifact,'artifacts'));
 // A withdrawn supplied original is retained privately by its exact typed
 // correction and owning history event. Reverify those bytes on both sides of
 // the save; observing the prior revision must not change next-state custody.
 for(const change of project.projectData?.userEntered?.suppliedInputChanges||[]){
  if(change?.schema!=='closed-loop-supplied-input-change/1'||change.action!=='WITHDRAW'||typeof change.artifactId!=='string'||!/^[a-f0-9]{64}$/.test(change.sha256||''))continue;
  const originals=(project.projectData.artifacts||[]).filter(row=>engine.recordId(row,'artifacts')===change.artifactId&&Number(row.stage)===1&&engine.recordValue(row,'FILENAME')===change.filename&&engine.recordValue(row,'SHA256')===change.sha256),events=(project.projectData.history||[]).filter(event=>event.eventId===change.historyEventId&&event.type==='STAGE_ONE_SUPPLIED_INPUT_WITHDRAWN'&&Number(event.stage)===1&&event.artifactId===change.artifactId&&event.replacementArtifactId===change.replacementArtifactId&&event.reason===change.reason&&event.operatorLabel===change.operatorLabel);
  if(originals.length===1&&events.length===1&&typeof change.reason==='string'&&change.reason.trim()&&typeof change.operatorLabel==='string'&&change.operatorLabel.trim())artifactIds.add(change.artifactId);
 }
 for(const evidence of engine.records(project,'evidenceRecords')){
   const scope=evidence.scope,evidenceId=engine.recordId(evidence,'evidenceRecords');
   if(!scope||!Object.keys(scope).length||engine.timingCurrentRecord(project,'evidenceRecords',evidenceId,scope).truth!=='TRUE')continue;
   const artifactId=String(engine.recordValue(evidence,'ATTACHMENT_ID')||evidence.relationships?.ATTACHMENT_ID||'');
   if(artifactId&&engine.timingCurrentRecord(project,'artifacts',artifactId,scope).truth==='TRUE')artifactIds.add(artifactId);
 }
 // A deferred receipt can remain authoritative for unchanged material work
 // after an unrelated candidate freeze. Resolve only its exact preserved
 // application-issued report attachment, then rehash the actual stored bytes.
 for(const receipt of engine.records(project,'regressionExecutions')){
  const reference=engine.deferredReceiptAttachmentState(project,receipt,{requireBytes:false});
  if(reference.allowed)artifactIds.add(reference.attachmentId);
 }
 // A confirmed exact definition correction can retain its original negative
 // fixture under the owner-published immutable input binding. Rehydrate only
 // those exact typed members; cached metadata never establishes byte custody.
 for(const family of ['failureTests','regressions'])for(const subject of engine.records(project,family)){
  const raw=(project.projectData.rawResponses||[]).find(row=>row.rawResponseId===subject.rawResponseId),prompt=raw&&(project.projectData.generatedPrompts||[]).find(row=>(row.instructionId||row.promptId)===raw.promptInstructionId);
  for(const entry of prompt?.contextManifest?.deferredDefinitionCorrectionInputs?.records||[])if(entry.family==='artifacts'&&engine.deferredDefinitionCorrectionInputState(project,prompt,'artifacts',entry.recordId,{subject,requireBytes:false}).allowed)artifactIds.add(entry.recordId);
 }
 for(const artifactId of artifactIds){try{await getArtifact(artifactId);}catch(error){if(!['ARTIFACT_BYTE_REFERENCE_INVALID','ARTIFACT_BYTES_UNAVAILABLE','ARTIFACT_LEGACY_BYTES_INVALID'].includes(error.code))throw error;/* Canonical metadata remains usable; missing/corrupt bytes confer no custody. Explicit reads and recovery diagnostics retain the precise failure. */}}
 await hydrateLegacyRunPromptContexts(project);
}
function artifactCustodyState(identity){
 const verified=artifactCustody.get(custodyKey(identity.jobId,identity.artifactId));
 return verified&&['jobId','artifactId','filename','byteSize','sha256'].every(key=>verified[key]===identity[key])?'TRUE':'UNKNOWN';
}
function withVerifiedRecoveryCustody(artifacts,action){
 // Call only after every supplied immutable Blob has passed its size/hash check.
 const previous=artifactCustody;artifactCustody=new Map(previous);
 for(const row of artifacts)artifactCustody.set(custodyKey(row.jobId,row.artifactId),{jobId:String(row.jobId),artifactId:String(row.artifactId),filename:row.filename,byteSize:row.byteSize,sha256:row.sha256});
 try{return action();}finally{artifactCustody=previous;}
}
try{const changes=new BroadcastChannel('closed-loop-reliability');changes.addEventListener('message',event=>{if(event.data?.jobId&&event.data.contextId!==STORE_CONTEXT_ID)forgetArtifactCustody(event.data.jobId);});changes.unref?.();}catch{}

const projectIdentity=project=>String(project?.job?.JOB_ID||project?.jobId||'').trim();
const projectPickerKey=(project,revision=project?.revision,jobId=projectIdentity(project))=>[jobId,JSON.stringify({title:String(project?.job?.JOB_TITLE||''),revision:Number(revision||0),isRetainedTestProject:Boolean(project?.isRetainedTestProject),retainedSpecRevision:project?.retainedSpecRevision||null,activeView:project?.activeView,activeStage:project?.activeStage})];
const projectPickerSummary=key=>{const data=JSON.parse(key[1]);return {_unloaded:true,job:{JOB_ID:key[0],JOB_TITLE:data.title},revision:data.revision,isRetainedTestProject:data.isRetainedTestProject,retainedSpecRevision:data.retainedSpecRevision,activeView:data.activeView,activeStage:data.activeStage};};
const now=()=>new Date().toISOString();
const fault=phase=>{const configured=globalThis.__closedLoopStorageFault;if(configured===phase||configured?.phase===phase){const error=new Error(`Injected storage failure at ${phase}.`);error.code='INJECTED_STORAGE_FAILURE';throw error;}};
// These are native I/O deadlines, not the delayed UI indicator threshold.
const STORAGE_IO_TIMEOUT_MS=30000;
const STORAGE_WORKER_TIMEOUT_MS=600000;
// Deadline provenance is private and transaction-specific. Error code strings are public diagnostics,
// so they cannot prove that this exact transaction was already aborted by storageEvent.
const storageDeadlineTransactions=new WeakMap();
function storageEvent(kind,subscribe,transaction=null){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else resolve(value);};
    const timer=setTimeout(()=>{
      if(settled)return;
      // Aborting one transaction does not prove that every earlier operation
      // in the operator action was rolled back. Require read-back recovery.
      const error=Object.assign(new Error(`Storage ${kind.toLowerCase()} did not return within ${STORAGE_IO_TIMEOUT_MS} ms. Reload and verify the saved project before retrying.`),{code:`STORAGE_${kind}_TIMEOUT`,existingProjectsUnchanged:false});
      if(transaction)storageDeadlineTransactions.set(error,transaction);
      finish(error);try{transaction?.abort();}catch{/* A commit may already have happened; its outcome remains unconfirmed. */}
    },STORAGE_IO_TIMEOUT_MS);
    try{subscribe(value=>finish(null,value),error=>finish(error),()=>!settled);}catch(error){finish(error);}
  });
}
const request=req=>storageEvent('REQUEST',(resolve,reject,active)=>{req.onsuccess=()=>{if(active())resolve(req.result);};req.onerror=()=>{if(active())reject(req.error||new Error('IndexedDB request failed.'));};},req.transaction);
const complete=tx=>storageEvent('TRANSACTION',(resolve,reject,active)=>{tx.oncomplete=()=>{if(active())resolve();};tx.onerror=()=>{if(active())reject(tx.error||new Error('IndexedDB transaction failed.'));};tx.onabort=()=>{if(active())reject(tx.error||new Error('IndexedDB transaction aborted.'));};},tx);
const canonicalProject=project=>{const copy={...project};delete copy.projectSha256;return copy;};
// Only parser-owned import or single-checkpoint reconstructions receive a private computation scope.
const importDigestHolders=new WeakMap(),importProjectDigestScopes=new WeakMap(),importDigestPairs=new WeakMap();
function withImportDigestScope(project,callback){const scope=importProjectDigestScopes.get(project);return scope?hash.withCanonicalDigestScope(scope,callback):callback();}
function bindImportDigestScope(project,parts){const holder=importDigestHolders.get(parts);if(!holder)return project;if(holder.privateRead&&(!project||typeof project!=='object'))return project;if(!holder.attempted){holder.attempted=true;holder.scope=hash.createCanonicalDigestScope(canonicalProject(project));}if(holder.scope)importProjectDigestScopes.set(project,holder.scope);return project;}

const projectSha256=project=>hash.sha256Value(canonicalProject(project));
const storageError=(message,code)=>Object.assign(new Error(message),{code});
let operationWorker=null;
const workerRequests=new Map();
function recordWorkerCommit(tx,operationId,project,digest,checkpointId=null){if(operationId)tx.objectStore(META).put({key:'storageOperation:'+operationId,value:{operationId,jobId:projectIdentity(project),revision:project.revision,projectSha256:digest,...(checkpointId?{checkpointId}:{})},updatedAt:now()});}
async function clearWorkerCommit(operationId){try{const tx=await openTransaction(META,'readwrite');tx.objectStore(META).delete('storageOperation:'+operationId);await complete(tx);}catch{/* An unacknowledged minimal receipt remains recoverable. */}}
async function recoverWorkerOperation(pending,error){
  try{const receipt=await metaGet('storageOperation:'+pending.operationId);if(receipt!==undefined){
    if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||receipt.operationId!==pending.operationId||typeof receipt.jobId!=='string'||!receipt.jobId.trim()||!Number.isSafeInteger(receipt.revision)||receipt.revision<0||typeof receipt.projectSha256!=='string'||!/^[a-f0-9]{64}$/.test(receipt.projectSha256)||pending.jobId!==null&&receipt.jobId!==pending.jobId)throw storageError('The durable storage receipt does not match this operation.','INVALID_STORAGE_OPERATION_RECEIPT');
    if(pending.method==='SAVE_CHECKPOINT'){
      if(typeof receipt.checkpointId!=='string'||!receipt.checkpointId)throw storageError('The saved-view receipt does not match this operation.','HISTORY_VERSION_MISMATCH');
      const saved=await readRetainedCheckpoint(receipt.jobId,receipt.checkpointId);
      if(saved.projectSha256!==receipt.projectSha256||Number(saved.project.revision)!==Number(receipt.revision))throw storageError('The saved view does not match its committed project.','HISTORY_VERSION_MISMATCH');
      await clearWorkerCommit(pending.operationId);pending.resolve(receipt.checkpointId);return;
    }
    const project=await readProject(receipt.jobId);if(!project||projectIdentity(project)!==receipt.jobId||!Number.isSafeInteger(project.revision)||project.revision<receipt.revision||project.revision===receipt.revision&&project.projectSha256!==receipt.projectSha256)throw Object.assign(storageError('The operation committed, but its project is no longer available with the recorded revision and identity. Reload the current stored state.','COMMITTED_PROJECT_UNAVAILABLE'),{existingProjectsUnchanged:false});await clearWorkerCommit(pending.operationId);pending.resolve(project);return;}pending.reject(Object.assign(error,{existingProjectsUnchanged:true}));}
  catch(recoveryError){pending.reject(Object.assign(storageError(`The storage outcome could not be confirmed. Reload and verify the stored project before retrying: ${recoveryError.message||recoveryError}`,'STORAGE_OUTCOME_UNCONFIRMED'),{existingProjectsUnchanged:false}));}
}
// Structured serialization repeats primitive strings even when equal values
// occur throughout one project. Keep this transport-only sharing separate from
// canonical data: the receiver restores every exact value before using it.
const STORAGE_STRING_TABLE_SCHEMA='closed-loop-storage-string-table/1';
const STORAGE_SHARED_STRING_MIN=65536;
function storageWireObject(value){return value!==null&&typeof value==='object'&&(Array.isArray(value)||Object.prototype.toString.call(value)==='[object Object]');}
function packStorageWorkerValue(value){
 if(!storageWireObject(value))return {value};
 const copies=new WeakMap(),strings=new Map(),root=Array.isArray(value)?new Array(value.length):{},queue=[{source:value,target:root,path:[]}];copies.set(value,root);
 for(let offset=0;offset<queue.length;offset++){
  const {source,target,path}=queue[offset];
  for(const key of Object.keys(source)){
   const descriptor=Object.getOwnPropertyDescriptor(source,key);
   // Preserve native getter execution and opaque-container cross references.
   // Canonical project graphs use data properties; unusual caller graphs keep
   // the existing native serialization path without changing their meaning.
   if(!descriptor||!Object.hasOwn(descriptor,'value'))return {value};
   const child=descriptor.value,childPath=[...path,key];let copied=child;
   if(child!==null&&typeof child==='object'&&!storageWireObject(child)&&!(child instanceof Blob)&&!(child instanceof ArrayBuffer)&&!ArrayBuffer.isView(child)&&!(child instanceof Date))return {value};
   if(storageWireObject(child)){copied=copies.get(child);if(!copied){copied=Array.isArray(child)?new Array(child.length):{};copies.set(child,copied);queue.push({source:child,target:copied,path:childPath});}}
   Object.defineProperty(target,key,{value:copied,writable:true,enumerable:true,configurable:true});
   if(typeof child==='string'&&child.length>=STORAGE_SHARED_STRING_MIN){let row=strings.get(child);if(!row){row={value:child,slots:[]};strings.set(child,row);}row.slots.push({target,key,path:childPath});}
  }
 }
 const values=[],slots=[];
 for(const row of strings.values())if(row.slots.length>1){const index=values.length;values.push(row.value);for(const slot of row.slots){slot.target[slot.key]=null;slots.push([slot.path,index]);}}
 return values.length?{value:root,stringTable:{schema:STORAGE_STRING_TABLE_SCHEMA,values,slots}}:{value:root};
}
function unpackStorageWorkerValue(value,stringTable){
 if(stringTable===undefined)return value;
 const invalid=()=>{throw storageError('The storage worker string frame is invalid. Its outcome must be checked before retry.','INVALID_STORAGE_WORKER_FRAME');};
 if(!stringTable||typeof stringTable!=='object'||Array.isArray(stringTable)||Object.keys(stringTable).sort().join(',')!=='schema,slots,values'||stringTable.schema!==STORAGE_STRING_TABLE_SCHEMA||!Array.isArray(stringTable.values)||!stringTable.values.length||!Array.isArray(stringTable.slots))invalid();
 const {values,slots}=stringTable,counts=new Array(values.length).fill(0),seenStrings=new Set(),targets=new WeakMap(),assignments=[];
 for(const text of values){if(typeof text!=='string'||text.length<STORAGE_SHARED_STRING_MIN||seenStrings.has(text))invalid();seenStrings.add(text);}
 for(const slot of slots){
  if(!Array.isArray(slot)||slot.length!==2||!Array.isArray(slot[0])||!slot[0].length||!Array.from(slot[0]).every(key=>typeof key==='string')||!Number.isSafeInteger(slot[1])||slot[1]<0||slot[1]>=values.length)invalid();
  const [path,index]=slot;let target=value;
  for(const key of path.slice(0,-1)){if(!storageWireObject(target)||!Object.hasOwn(target,key))invalid();target=target[key];}
  const key=path.at(-1);if(!storageWireObject(target)||!Object.hasOwn(target,key)||target[key]!==null)invalid();
  let keys=targets.get(target);if(!keys){keys=new Set();targets.set(target,keys);}if(keys.has(key))invalid();keys.add(key);counts[index]++;assignments.push({target,key,index});
 }
 if(counts.some(count=>count<2))invalid();
 for(const {target,key,index} of assignments)Object.defineProperty(target,key,{value:values[index],writable:true,enumerable:true,configurable:true});
 return value;
}
async function requestStoreWorker(method,args){
  // The document owns the startup recovery sweep. Commands wait for that
  // boundary; their worker still reads and validates each actual transaction.
  await ready;
  if(!operationWorker){
    const url=new URL(STORE_SCRIPT_URL);url.searchParams.set('storeWorker','1');url.searchParams.set('storeContext',STORE_CONTEXT_ID);const worker=new Worker(url.href);operationWorker=worker;
    const lost=event=>{if(operationWorker!==worker)return;operationWorker=null;worker.terminate();const pending=[...workerRequests.values()];workerRequests.clear();for(const entry of pending){clearTimeout(entry.timer);void recoverWorkerOperation(entry,storageError(event?.message||'Storage worker stopped before returning its result.','STORAGE_WORKER_STOPPED'));}};
    worker.onerror=lost;worker.onmessageerror=lost;
    worker.onmessage=event=>{if(operationWorker!==worker)return;const message=event.data||{},pending=workerRequests.get(message.operationId);if(!pending)return;if(message.buildIdentity!==STORE_BUILD_ID){lost({message:'Storage worker build identity mismatch.'});return;}if(message.ok&&pending.method!=='SAVE_CHECKPOINT')try{message.project=unpackStorageWorkerValue(message.project,message.projectStrings);}catch(error){lost({message:error.message});return;}workerRequests.delete(message.operationId);clearTimeout(pending.timer);if(message.ok){
      if(pending.method==='SAVE_CHECKPOINT'){
        if(typeof message.checkpointId!=='string'||!message.checkpointId){void recoverWorkerOperation(pending,storageError('Storage worker returned an invalid saved-view identity.','INVALID_STORAGE_WORKER_RESULT'));return;}
        void clearWorkerCommit(message.operationId);pending.resolve(message.checkpointId);return;
      }
      void observeProjectArtifactCustody(message.project).then(()=>{void clearWorkerCommit(message.operationId);pending.resolve(message.project);},error=>recoverWorkerOperation(pending,error));}else void recoverWorkerOperation(pending,Object.assign(new Error(message.error?.message||'Storage operation failed.'),message.error));};
  }
  const operationId=crypto.randomUUID(),worker=operationWorker;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{if(workerRequests.has(operationId)&&operationWorker===worker)worker.onerror({message:`Storage worker did not return within ${STORAGE_WORKER_TIMEOUT_MS} ms. Its durable commit receipt is being checked before retry is permitted.`});},STORAGE_WORKER_TIMEOUT_MS);workerRequests.set(operationId,{operationId,method,jobId:method==='SAVE_CHECKPOINT'?String(args[0]):method==='WRITE_PROJECT'?projectIdentity(args[0]):method==='COMMIT_NATIVE_PRODUCT_RESULTS'?String(args[0]?.jobId||''):null,resolve,reject,timer});try{const packed=packStorageWorkerValue(args);worker.postMessage({operationId,method,args:packed.value,...(packed.stringTable?{argumentStrings:packed.stringTable}:{}),buildIdentity:STORE_BUILD_ID,fault:globalThis.__closedLoopStorageFault||null});}catch(error){clearTimeout(timer);workerRequests.delete(operationId);reject(Object.assign(error,{existingProjectsUnchanged:true}));}});
}
const useStoreWorker=()=>Boolean(STORE_SCRIPT_URL&&typeof Worker==='function');
const runSynchronousMutator=(mutator,next,before)=>{const result=mutator(next,before);if(result&&typeof result.then==='function')throw storageError('Project transaction mutators must be synchronous. Complete asynchronous work before opening the canonical IndexedDB transaction.','ASYNC_TRANSACTION_MUTATOR');return result;};
const PLACEHOLDER_REFERENCES=new Set(globalThis.closedLoopWorkflowSchema.CANONICAL_REFERENCE_PLACEHOLDERS);
const equivalent=(left,right)=>Object.is(left,right)||(!(left===undefined||right===undefined)&&hash.withCanonicalDigestScope(null,()=>hash.sha256Value(left)===hash.sha256Value(right)));
function projectCollectionShapeIssues(project){return globalThis.closedLoopWorkflowSchema.projectShapeIssues(project,globalThis.closedLoopWorkflowEngine.ALL_COLLECTIONS);}
function assertProjectCollectionShape(project){const issues=projectCollectionShapeIssues(project);if(issues.length){const error=storageError(`Canonical project integrity validation failed: ${issues.join(' | ')}`,'PROJECT_INTEGRITY_FAILED');error.issues=issues;throw error;}}
// Preserve incomplete work, but never reinterpret a present canonical value as
// a different type. Required-at-stage and actor authority remain separate rules.
function canonicalFieldValueIssues(project){
  const schema=globalThis.closedLoopWorkflowSchema,ingestion=globalThis.closedLoopResponseIngestion,issues=[];
  if(!schema||!ingestion?.validateValue)return ['Schema and response-ingestion value validator are required for canonical field validation.'];
  const check=(values,definitions,path)=>{for(const [name,definition]of Object.entries(definitions||{})){if(!Object.prototype.hasOwnProperty.call(values||{},name))continue;const found=[];ingestion.validateValue(definition,values[name],path+'/'+name,found,{maxTextFieldLength:Infinity,rejectPlaceholder:!['HUMAN','HUMAN_DECISION'].includes(definition.producer)});for(const issue of found)issues.push(path+'/'+name+': '+issue.message);}};
  check(project?.job,schema.JOB_FIELDS,'/job');
  for(const [stage,definitions]of Object.entries(schema.STAGE_FIELDS||{}))for(const carrier of ['agentData','humanData','acceptedData','derivedData'])check(project?.stages?.[stage]?.[carrier],definitions,'/stages/'+stage+'/'+carrier);
  return issues;
}
function assertCanonicalFieldValues(project){const issues=canonicalFieldValueIssues(project);if(issues.length)throw Object.assign(storageError('Canonical project field validation failed: '+issues.join(' | '),'PROJECT_INTEGRITY_FAILED'),{issues});}
function assertJobPointerIntegrity(project,prior=null){const issues=globalThis.closedLoopWorkflowEngine.jobPointerIntegrityIssues(project,{prior});if(issues.length)throw Object.assign(storageError('Canonical Job pointer validation failed: '+issues.join(' | '),'PROJECT_INTEGRITY_FAILED'),{issues});}
function derivedProjectIntegrityIssues(project,{verifyCachedProjection=true,projectionObservedAt=null,verifyProjection=true}={}){
  const issues=[],engine=globalThis.closedLoopWorkflowEngine,schemaApi=globalThis.closedLoopWorkflowSchema;
  const comparison=engine.compareApplicationProjection(project,{observedAt:projectionObservedAt}),expected=comparison.output;if(verifyCachedProjection){if(!equivalent(engine.applicationProjectionCanonicalOutput(project),expected.canonicalRecords))issues.push('Application-derived canonical proof fields do not match deterministic recalculation.');for(const name of schemaApi.PROJECT_PROJECTION_DERIVATION_CONTRACT.jobOutputFields)if(!equivalent(project.job?.[name],expected.job?.[name]))issues.push(`Application-derived job field ${name} does not match deterministic recalculation.`);for(let stage=1;stage<=Number(schemaApi.STAGE_COUNT);stage++){if(String(project.stages?.[stage]?.status||'')!==String(expected.stages?.[stage]?.status||''))issues.push(`Stage ${stage} status does not match deterministic recalculation.`);if(!equivalent(project.stages?.[stage]?.derivedData||{},expected.stages?.[stage]?.derivedData||{}))issues.push(`Stage ${stage} derivedData does not match deterministic recalculation.`);for(const field of ['decision','decisionEvidence'])if(!equivalent(project.stages?.[stage]?.[field],expected.stages?.[stage]?.[field]))issues.push(`Stage ${stage} ${field} does not match deterministic recalculation.`);const gateWithoutClock=value=>Object.fromEntries(Object.entries(value||{}).filter(([key])=>key!=='checkedAt'));if(!equivalent(gateWithoutClock(project.stages?.[stage]?.gate),gateWithoutClock(expected.stages?.[stage]?.gate)))issues.push(`Stage ${stage} gate does not match deterministic recalculation.`);}if(verifyProjection&&project.projectData.applicationProjection&&!equivalent(project.projectData.applicationProjection.inputObservations,comparison.inputObservations))issues.push('Application projection observations require a current refresh.');}const releaseRecords=(project.projectData?.releaseRecords||[]).filter(record=>record?.active!==false&&!record?.invalidatedBy),latestRelease=releaseRecords.at(-1);if(latestRelease){const actual=String(engine.recordValue(latestRelease,'DETERMINATION')||''),calculated=comparison.releaseDetermination;if(actual!==calculated)issues.push(`Current release determination ${actual||'UNKNOWN'} does not match deterministic release calculation ${calculated||'UNKNOWN'}.`);}
  return issues;
}
function validateProjectIntegrity(project,options){return withImportDigestScope(project,()=>validateProjectIntegrityCurrent(project,options));}
function validateProjectIntegrityCurrent(project,{verifyDerived=true,verifyCachedProjection=true,verifyProjection=true,projectionObservedAt=null,prior=null}={}){
  const issues=[],schemaApi=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine;
  if(!project||typeof project!=='object')return {valid:false,issues:['Project is not an object.']};
  if(!schemaApi||!engine)return {valid:false,issues:['Workflow schema and engine are required for canonical project integrity validation.']};
  const collectionShapeIssues=projectCollectionShapeIssues(project);if(collectionShapeIssues.length)return {valid:false,issues:collectionShapeIssues};
  const fieldValueIssues=canonicalFieldValueIssues(project);if(fieldValueIssues.length)return {valid:false,issues:fieldValueIssues};
  const pointerIssues=engine.jobPointerIntegrityIssues(project,{prior});if(pointerIssues.length)return {valid:false,issues:pointerIssues};
  if(verifyProjection){
    const present=Object.hasOwn(project.projectData,'applicationProjection');
    if(present){
      const legacy=engine.validateLegacyApplicationProjection(project),checked=legacy||engine.validateApplicationProjection(project,project,{useRetainedObservations:true});
      if(legacy&&verifyDerived)issues.push('Application projection algorithm requires explicit current activation.');
      for(const item of checked.issues)issues.push('Application projection receipt is invalid: '+item.code+' '+item.message);
      const observedAt=project.projectData.applicationProjection?.observedAt;
      for(const [number,state] of Object.entries(project.stages))if(Object.hasOwn(state.gate||{},'checkedAt')&&state.gate.checkedAt!==observedAt)issues.push('Stage '+number+' gate observation does not match its projection receipt.');
    }else if(verifyDerived)issues.push('Application projection receipt is missing; explicit legacy projection activation is required.');
  }

  if(project.schema!==schemaApi.PROJECT_SCHEMA)issues.push(`Project schema ${project.schema||'UNKNOWN'} does not match ${schemaApi.PROJECT_SCHEMA}.`);
  if(project.workflow!==schemaApi.WORKFLOW_ID)issues.push(`Workflow ${project.workflow||'UNKNOWN'} does not match ${schemaApi.WORKFLOW_ID}.`);
  if(Number(project.stageCount)!==Number(schemaApi.STAGE_COUNT))issues.push(`Stage count ${project.stageCount} does not match ${schemaApi.STAGE_COUNT}.`);
  if(Object.keys(project.stages||{}).length!==Number(schemaApi.STAGE_COUNT))issues.push('Canonical project does not contain exactly the declared workflow stages.');
  if(!projectIdentity(project))issues.push('Canonical project has no JOB_ID.');
  const idsByCollection=new Map();
  for(const [collection,definition] of Object.entries(schemaApi.RECORD_SCHEMAS)){
    const list=project.projectData?.[collection];if(list!==undefined&&!Array.isArray(list)){issues.push(`${collection} is not an array.`);continue;}
    const seen=new Set();for(const record of Array.isArray(list)?list:[]){const id=engine.recordId(record,collection),fieldId=String(engine.recordValue(record,definition.idField)||'').trim();if(!id){issues.push(`${collection} contains a record without ${definition.idField}.`);continue;}if(seen.has(id))issues.push(`${collection} contains duplicate canonical ID ${id}.`);seen.add(id);if(record?.id&&fieldId&&String(record.id)!==fieldId)issues.push(`${collection} record ${id} contradicts its ${definition.idField}.`);if(record?.contentSha256&&String(record.contentSha256)!==String(hash.contentRecordSha256(record,definition.idField)))issues.push(`${collection} record ${id} contentSha256 does not match canonical content.`);if(record?.recordSha256&&String(record.recordSha256)!==String(hash.recordSha256(record)))issues.push(`${collection} record ${id} recordSha256 does not match the persisted canonical record.`);if(record?.recordSha256&&record?.sha256&&String(record.sha256)!==String(record.recordSha256))issues.push(`${collection} record ${id} sha256 does not mirror recordSha256.`);}
    idsByCollection.set(collection,seen);
  }
  const ingestion=globalThis.closedLoopResponseIngestion;
  if(!ingestion?.validateValue)issues.push('Response-ingestion value validator is required for canonical project integrity validation.');
  else for(const [collection,definition] of Object.entries(schemaApi.RECORD_SCHEMAS))for(const record of Array.isArray(project.projectData?.[collection])?project.projectData[collection]:[]){const id=engine.recordId(record,collection)||'UNKNOWN',nested=record?.fields&&typeof record.fields==='object'&&!Array.isArray(record.fields)?record.fields:null;for(const [fieldName,fieldDefinition] of Object.entries(definition.fieldDefinitions||{})){const nestedPresent=Boolean(nested&&Object.prototype.hasOwnProperty.call(nested,fieldName)),topPresent=Object.prototype.hasOwnProperty.call(record||{},fieldName);if(!nestedPresent&&!topPresent)continue;if(nestedPresent&&topPresent&&!equivalent(nested[fieldName],record[fieldName]))issues.push(`${collection} record ${id} has contradictory mirrored value for ${fieldName}.`);const value=engine.recordValue(record,fieldName),fieldIssues=[];if(fieldName==='EXECUTION_COMPATIBILITY'&&['failureTests','regressions'].includes(collection)&&engine.deferredDefinitionCompatibilityRecordPolicy(project,record,collection).retainedUnproven)continue;ingestion.validateValue(fieldDefinition,value,`/${collection}/${id}/${fieldName}`,fieldIssues);for(const item of fieldIssues)issues.push(`${collection} record ${id} field ${fieldName}: ${item.message}`);}}
  // The new contract does not reinterpret retained old extension data. Current
  // author contracts are strict; old or unproven definitions remain recoverable
  // and the shared planner reports UNKNOWN until a supported correction.
  for(const family of ['failureTests','regressions'])for(const record of engine.records(project,family,{active:false})){
    if(!engine.deferredDefinitionCompatibilityRecordPolicy(project,record,family).strict)continue;
    const value=engine.recordValue(record,'EXECUTION_COMPATIBILITY');if(value===undefined&&!schemaApi.deferredDefinitionCompatibilityRequired(record,family))continue;
    for(const detail of schemaApi.validateDeferredDefinitionCompatibility(value,family).issues)issues.push(`${family} record ${engine.recordId(record,family)} compatibility: ${detail.message}`);
  }
  for(const [collection,definition] of Object.entries(schemaApi.RECORD_SCHEMAS))for(const record of Array.isArray(project.projectData?.[collection])?project.projectData[collection]:[])for(const [fieldName,targetCollection] of Object.entries(definition.relationships||{})){const raw=record?.relationships?.[fieldName]??engine.recordValue(record,fieldName);for(const value of Array.isArray(raw)?raw:[raw]){const ref=String(value??'').trim();if(PLACEHOLDER_REFERENCES.has(ref.toUpperCase()))continue;if(!idsByCollection.get(targetCollection)?.has(ref))issues.push(`${collection}.${fieldName} references missing ${targetCollection} record ${ref}.`);}}
  const currentDecisionIds=new Set(engine.recordsForCurrentScope(project,'humanDecisions').map(row=>engine.recordId(row,'humanDecisions'))),scope=engine.currentScope(project);
  for(const [family,definition] of Object.entries(schemaApi.RECORD_SCHEMAS)){
    const references=Object.entries(definition.relationships||{}).filter(([,target])=>target==='humanDecisions');if(!references.length)continue;
    const owners=new Set(engine.recordsForCurrentScope(project,family));for(const [dimension,targetFamily] of Object.entries(schemaApi.SCOPE_REFERENCE_FAMILIES))if(targetFamily===family&&scope[dimension]){const selected=engine.records(project,family).find(row=>engine.recordId(row,family)===scope[dimension]);if(selected)owners.add(selected);}
    for(const owner of owners)for(const [field] of references)for(const id of [owner.relationships?.[field]??engine.recordValue(owner,field)].flat())if(id)currentDecisionIds.add(String(id));
  }
  for(const decision of engine.records(project,'humanDecisions')){
    const id=engine.recordId(decision,'humanDecisions');if(!currentDecisionIds.has(id)||!decision.fields?.HUMAN_DECISION_ID)continue;
    if(engine.recordValue(decision,'JOB_ID')!==projectIdentity(project))issues.push(`Human decision ${id} belongs to a different project.`);
    const target=engine.humanDecisionTargetState(project,{purpose:engine.recordValue(decision,'PURPOSE'),targetFamily:engine.recordValue(decision,'TARGET_FAMILY'),targetId:engine.recordValue(decision,'TARGET_ID'),value:engine.recordValue(decision,'VALUE')});if(!target.valid)issues.push(`Human decision ${id} target is invalid: ${target.reason}.`);
  }
  for(const receipt of project.projectData?.regressionExecutions||[]){const checked=schemaApi.validateDeferredReceiptShape(receipt);for(const reason of checked.reasons)issues.push('Deferred execution receipt '+engine.recordId(receipt,'regressionExecutions')+': '+reason);}
  let previousSequence=0;const eventIds=new Set();for(const event of Array.isArray(project.projectData?.history)?project.projectData.history:[]){const sequence=Number(event?.eventSequence);if(!Number.isInteger(sequence)||sequence<=previousSequence)issues.push('History eventSequence is missing, duplicated, or non-monotonic.');previousSequence=Math.max(previousSequence,Number.isFinite(sequence)?sequence:0);const eventId=String(event?.eventId||'');if(eventId&&eventIds.has(eventId))issues.push(`History contains duplicate event ID ${eventId}.`);if(eventId)eventIds.add(eventId);}if(Number(project.projectData?.eventSequence||0)<previousSequence)issues.push('Project eventSequence is behind committed history.');
  if(verifyDerived)issues.push(...derivedProjectIntegrityIssues(project,{verifyCachedProjection,projectionObservedAt,verifyProjection}));
  const artifacts=new Map((project.projectData?.artifacts||[]).map(record=>[engine.recordId(record,'artifacts'),record]));for(const identity of (project.projectData?.artifactIdentities||[]).filter(record=>record?.active!==false&&!record?.invalidatedBy)){const artifact=artifacts.get(String(engine.recordValue(identity,'ARTIFACT_ID')||''));const auditedHash=String(engine.recordValue(identity,'AUDITED_SHA256')||''),deliveryHash=String(engine.recordValue(identity,'PRE_DELIVERY_SHA256')||''),auditedSize=Number(engine.recordValue(identity,'AUDITED_BYTE_SIZE')),deliverySize=Number(engine.recordValue(identity,'RELEASE_BYTE_SIZE')),sameHash=Boolean(auditedHash&&deliveryHash&&auditedHash===deliveryHash),sameSize=Number.isFinite(auditedSize)&&Number.isFinite(deliverySize)&&auditedSize===deliverySize,sameName=String(engine.recordValue(identity,'AUDITED_FILENAME')||'')===String(engine.recordValue(identity,'RELEASE_FILENAME')||''),authorized=sameHash&&sameSize&&sameName;if(Boolean(engine.recordValue(identity,'EXACT_HASH_MATCH'))!==sameHash||Boolean(engine.recordValue(identity,'EXACT_SIZE_MATCH'))!==sameSize||String(engine.recordValue(identity,'AUTHORIZATION')||'')!==(authorized?'AUTHORIZED':'NOT AUTHORIZED'))issues.push(`Artifact identity ${engine.recordId(identity,'artifactIdentities')||'UNKNOWN'} contradicts its deterministic comparison.`);if(artifact){if(String(engine.recordValue(artifact,'SHA256')||'')!==auditedHash||Number(engine.recordValue(artifact,'BYTE_SIZE'))!==auditedSize||String(engine.recordValue(artifact,'FILENAME')||'')!==String(engine.recordValue(identity,'AUDITED_FILENAME')||''))issues.push(`Artifact identity ${engine.recordId(identity,'artifactIdentities')||'UNKNOWN'} does not match its canonical artifact.`);}}
  try{requiredProjectArtifactBytes(project);}catch(error){issues.push(String(error.message||error));}
  return {valid:issues.length===0,issues};
}
function assertProjectIntegrity(project,options){const result=validateProjectIntegrity(project,options);if(!result.valid){const error=storageError(`Canonical project integrity validation failed: ${result.issues.join(' | ')}`,'PROJECT_INTEGRITY_FAILED');error.issues=result.issues;throw error;}return result;}

let databasePromise=null;
let databaseHandle=null;
function resetDatabaseConnection(db=null){
  if(db&&databaseHandle&&db!==databaseHandle)return;
  databaseHandle=null;
  databasePromise=null;
}
function openDatabase(){
  if(!globalThis.indexedDB)return Promise.reject(Object.assign(new Error('IndexedDB is required by the supported browser contract.'),{code:'INDEXEDDB_REQUIRED'}));
  if(databasePromise)return databasePromise;
  let requestHandle=null,expired=false;
  const opening=storageEvent('OPEN',(resolve,reject,active)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);requestHandle=req;
    req.onupgradeneeded=event=>{if(expired||!active()){try{req.transaction?.abort();}catch{}return;}const db=req.result;if(!db.objectStoreNames.contains(PROJECTS))db.createObjectStore(PROJECTS,{keyPath:'jobId'});if(!db.objectStoreNames.contains(ARTIFACTS))db.createObjectStore(ARTIFACTS,{keyPath:'artifactId'});if(!db.objectStoreNames.contains(META))db.createObjectStore(META,{keyPath:'key'});const artifacts=req.transaction.objectStore(ARTIFACTS);if(!artifacts.indexNames.contains('jobId'))artifacts.createIndex('jobId','jobId',{unique:false});const projects=req.transaction.objectStore(PROJECTS);if(!projects.indexNames.contains('picker')){if(event.oldVersion>=2){req.transaction.abort();return;}projects.createIndex('picker','picker',{unique:true});const scan=projects.openCursor();scan.onsuccess=()=>{if(!active())return;const cursor=scan.result;if(!cursor)return;const row=cursor.value;if(Object.hasOwn(row,'storageEncoding')){req.transaction.abort();return;}row.picker=projectPickerKey(row.project,row.revision,String(row.jobId));cursor.update(row);cursor.continue();};}};
    req.onsuccess=()=>{const db=req.result;if(expired||!active()){try{db.close();}finally{if(databasePromise===opening)resetDatabaseConnection();}return;}databaseHandle=db;db.onclose=()=>resetDatabaseConnection(db);db.onversionchange=()=>{resetDatabaseConnection(db);try{db.close();}catch{}};resolve(db);};
    req.onerror=()=>{if(databasePromise===opening)resetDatabaseConnection();reject(req.error||new Error('IndexedDB open failed.'));};
    req.onblocked=()=>{expired=true;reject(Object.assign(new Error('IndexedDB upgrade is blocked by another tab. Close other application tabs, then reload.'),{code:'INDEXEDDB_BLOCKED'}));};
  },{abort(){expired=true;try{requestHandle?.transaction?.abort();}catch{}}});
  // Retain a rejected open until its native request terminates. Retrying an
  // unresolved open must not queue another request behind the same blocker.
  databasePromise=opening;
  void opening.catch(()=>{if(!requestHandle&&databasePromise===opening)resetDatabaseConnection();});
  return opening;
}
async function openTransaction(stores,mode='readonly'){
  for(let attempt=0;attempt<2;attempt++){
    const db=await openDatabase();
    try{return db.transaction(stores,mode);}
    catch(error){if(attempt===0&&error?.name==='InvalidStateError'){resetDatabaseConnection(db);continue;}throw error;}
  }
  throw storageError('IndexedDB connection could not be reopened for a transaction.','INDEXEDDB_CONNECTION_UNAVAILABLE');
}

// Exact project spans never include a sibling project in the same legacy value.
// Validation remains JSON.parse's responsibility; this scanner only records
// already-valid object boundaries without reserializing their contents.
const legacySourceSpans=new WeakMap();
function projectJsonSpans(text,array){
  const spans=[];let depth=0,quoted=false,escaped=false,start=null;
  for(let index=0;index<text.length;index++){
    const char=text[index];if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
    if(char==='"'){quoted=true;continue;}
    if(char==='{'||char==='['){if(char==='{'&&depth===(array?1:0))start=index;depth++;}
    else if(char==='}'||char===']'){depth--;if(char==='}'&&depth===(array?1:0)&&start!==null){spans.push({start,end:index+1});start=null;}}
  }
  return spans;
}
function sourceStringBlob(text){
  // Web Storage provides UTF-16 code units, not original transport bytes.
  // Retain those units losslessly, including unpaired surrogate code units.
  const parts=[];for(let offset=0;offset<text.length;offset+=32768){const count=Math.min(32768,text.length-offset),bytes=new Uint8Array(count*2);for(let i=0;i<count;i++){const unit=text.charCodeAt(offset+i);bytes[i*2]=unit&255;bytes[i*2+1]=unit>>>8;}parts.push(bytes);}return new Blob(parts,{type:'application/octet-stream'});
}
function parseLegacy(storage=globalThis.localStorage){
  const out=[],seen=new Map();if(!storage)return out;
  for(const key of LEGACY_KEYS){
    let raw=null;try{raw=storage.getItem(key);}catch(error){throw storageError(`Legacy project storage could not be read from ${key}: ${error.message||error}`,'LEGACY_MIGRATION_READ_FAILED');}if(!raw)continue;
    let parsed;try{parsed=JSON.parse(raw);}catch(error){throw storageError(`Legacy project storage ${key} contains malformed JSON: ${error.message||error}`,'LEGACY_MIGRATION_PARSE_FAILED');}
    const items=Array.isArray(parsed)?parsed:[parsed],spans=projectJsonSpans(raw,Array.isArray(parsed)),container={blob:sourceStringBlob(raw),sourceEncoding:'UTF-16LE_CODE_UNITS',storageKey:key,value:raw};
    for(let index=0;index<items.length;index++){
      const item=items[index];if(!item||typeof item!=='object'||Array.isArray(item))throw storageError(`Legacy project storage ${key}[${index}] is not a project object.`,'LEGACY_MIGRATION_INVALID_PROJECT');
      const id=projectIdentity(item);if(!id)throw storageError(`Legacy project storage ${key}[${index}] has no JOB_ID.`,'LEGACY_MIGRATION_INVALID_PROJECT');
      const span=spans[index];if(!span)throw storageError('The original project source location is unavailable.','LEGACY_MIGRATION_INVALID_PROJECT');
      const owner=seen.get(id)||item;if(!seen.has(id)){seen.set(id,item);out.push(item);legacySourceSpans.set(item,[]);}
      legacySourceSpans.get(owner).push({container,blob:container.blob.slice(span.start*2,span.end*2),payload:item,sourceLocation:{storageKey:key,jsonPointer:Array.isArray(parsed)?'/'+index:'',codeUnitStart:span.start,codeUnitEnd:span.end}});
    }
  }
  return out;
}
const ORIGINAL_SOURCE_KIND='ORIGINAL_PROJECT_SOURCE',ORIGINAL_SOURCE_SCHEMA='closed-loop-original-project-source/1';
async function retainProjectSource(project,source,rows,{recordProject=true}={}){
  const jobId=projectIdentity(project),sha256=await hash.sha256Bytes(source.blob),artifactId='PROJECT-SOURCE-'+hash.sha256Value({jobId,sha256}),encoding=source.sourceEncoding||source.container?.sourceEncoding||'UTF-8';
  const filename=artifactId+(encoding==='UTF-8'?'.json':'.json.utf16le'),mediaType=encoding==='UTF-8'?'application/json':'application/octet-stream',existing=rows.find(row=>row.artifactId===artifactId);
  if(existing&&(existing.jobId!==jobId||existing.byteSize!==source.blob.size||existing.sha256!==sha256||await hash.sha256Bytes(existing.blob)!==sha256))throw storageError('Original project source bytes conflict with a retained identity.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
  const container=source.container;if(container&&!container.sha256)container.sha256=await hash.sha256Bytes(container.blob);
  const descriptor={kind:ORIGINAL_SOURCE_KIND,schema:ORIGINAL_SOURCE_SCHEMA,operational:false,artifactId,filename,mediaType,byteSize:source.blob.size,sha256,sourceEncoding:encoding,sourceSha256:source.sourceSha256||container.sha256,sourceLocation:clone(source.sourceLocation),parser:{identity:source.parserIdentity||'closed-loop-legacy-json-reader',version:source.parserVersion||'1'},parsedPayloadSha256:hash.sha256Value(source.payload),disclosureClassification:containsCredentialSecret(source.payload)?'CREDENTIAL_SECRET':'UNKNOWN'};
  if(recordProject){const data=project.projectData;if(!Object.hasOwn(data,'migrationArchives'))data.migrationArchives=[];if(!Array.isArray(data.migrationArchives))throw storageError('Original source archives require an array.','PROJECT_INTEGRITY_FAILED');
    if(!data.migrationArchives.some(row=>row?.kind===ORIGINAL_SOURCE_KIND&&hash.sha256Value(row)===hash.sha256Value(descriptor)))data.migrationArchives.push(descriptor);}
  if(!existing)rows.push({artifactId,jobId,filename,mediaType,byteSize:source.blob.size,sha256,blob:source.blob,lineage:{originalProjectSource:{schema:ORIGINAL_SOURCE_SCHEMA,operational:false,sourceEncoding:encoding,parsedPayloadSha256:descriptor.parsedPayloadSha256},...(containsCredentialSecret(source.payload)?{disclosureClassification:'CREDENTIAL_SECRET'}:{})},createdAt:now()});
  return descriptor;
}

function readAllLegacy(storage){return parseLegacy(storage);}
function writeAllLegacy(projects,storage){if(!storage)throw new Error('Legacy test storage is unavailable.');const payload=JSON.stringify(projects),prior=storage.getItem(STORE_KEY);try{fault('before-final-write');storage.setItem(STORE_KEY,payload);fault('after-final-write');return {changed:prior!==payload};}catch(error){try{if(prior===null)storage.removeItem(STORE_KEY);else storage.setItem(STORE_KEY,prior);}catch{}throw error;}}

function assertMobileAcceptanceSessionWrite(key,value,prior){
 const owner=String(key).slice('stage30MobileAcceptance.v1:'.length);
 if(!value||typeof value!=='object'||Array.isArray(value))throw storageError('The mobile acceptance session has invalid project or preparation identity.','MOBILE_ACCEPTANCE_SESSION_INVALID');
 const immutable=globalThis.closedLoopWorkflowSchema.MOBILE_ACCEPTANCE_SESSION_ANCHOR_CONTRACT.protectedFields;
 if(prior!==undefined){
  if(!prior||typeof prior!=='object'||Array.isArray(prior))throw storageError('The existing mobile acceptance session is damaged and was preserved. Start a new pinned test project.','MOBILE_ACCEPTANCE_SESSION_CONFLICT');
  for(const field of immutable)if(Object.hasOwn(prior,field)&&(!Object.hasOwn(value,field)||!equivalent(prior[field],value[field])))throw storageError('The mobile acceptance target, initial package, or preparation changed in another operation. Reload the saved session; its original evidence was preserved.','MOBILE_ACCEPTANCE_SESSION_CONFLICT');
 }
 const checked=globalThis.closedLoopWorkflowSchema.validateMobileAcceptanceSessionAnchors(value);if(!owner||!checked.valid||value.jobId!==owner)throw storageError('The mobile acceptance session has invalid project or preparation identity.','MOBILE_ACCEPTANCE_SESSION_INVALID');
 if(value.initialProjectPackage&&(!prior||!Object.hasOwn(prior,'initialProjectPackage'))){
  const initial=value.initialProjectPackage;let bytes;
  try{const binary=atob(initial.base64);if(btoa(binary)!==initial.base64)throw new Error('Noncanonical base64');bytes=Uint8Array.from(binary,character=>character.charCodeAt(0));}catch{throw storageError('Initial mobile project package encoding is invalid.','MOBILE_ACCEPTANCE_INITIAL_PACKAGE_INVALID');}
  const digest=hash.createSha256();digest.update(bytes);
  if(bytes.byteLength!==initial.byteSize||digest.digest()!==initial.sha256)throw storageError('Initial mobile project package bytes differ from their captured identity.','MOBILE_ACCEPTANCE_INITIAL_PACKAGE_INVALID');
 }
}
function mergeMobileAcceptanceSession(prior,value){
 const schema=globalThis.closedLoopWorkflowSchema,policy=schema.MOBILE_ACCEPTANCE_SESSION_MERGE_CONTRACT;
 for(const session of [prior,value])if(session!==undefined&&!schema.validateMobileAcceptanceSessionMutable(session).valid)throw storageError('Mobile acceptance observations or runtime counters have invalid types.','MOBILE_ACCEPTANCE_SESSION_INVALID');
 const merged={...(prior||{}),...value};
 for(const field of policy.identityCollections){
  if(prior?.[field]===undefined&&value[field]===undefined)continue;
  const rows=[],byId=new Map();for(const row of [...(prior?.[field]||[]),...(value[field]||[])]){const saved=byId.get(row.receiptId);if(saved&&!equivalent(saved,row))throw storageError('A recorded mobile observation identity was reused for different content. Its original evidence was preserved.','MOBILE_ACCEPTANCE_OBSERVATION_CONFLICT');if(!saved){byId.set(row.receiptId,row);rows.push(clone(row));}}merged[field]=rows;
 }
 for(const field of policy.exactSetCollections){
  if(prior?.[field]===undefined&&value[field]===undefined)continue;
  const rows=[],seen=new Set();for(const row of [...(prior?.[field]||[]),...(value[field]||[])]){const digest=hash.sha256Value(row);if(!seen.has(digest)){seen.add(digest);rows.push(clone(row));}}merged[field]=rows;
 }
 for(const field of policy.keyedMapCollections){
  if(prior?.[field]===undefined&&value[field]===undefined)continue;
  merged[field]=Object.fromEntries([...Object.entries(prior?.[field]||{}),...Object.entries(value[field]||{})].map(([key,row])=>[key,clone(row)]));
 }
 const counterField=policy.counterMap;if(prior?.[counterField]!==undefined||value[counterField]!==undefined){const counters={};for(const tabId of new Set([...Object.keys(prior?.[counterField]||{}),...Object.keys(value[counterField]||{})])){const previous=Object.hasOwn(prior?.[counterField]||{},tabId)?prior[counterField][tabId]:null,incoming=Object.hasOwn(value[counterField]||{},tabId)?value[counterField][tabId]:null;Object.defineProperty(counters,tabId,{enumerable:true,writable:true,configurable:true,value:Object.fromEntries(policy.counterFields.map(field=>[field,Math.max(previous?.[field]??0,incoming?.[field]??0)]))});}merged[counterField]=counters;}
 // A successful explicit save clears its earlier transient write error. The
 // observation records and monotonic counters above remain retained.
 if(!Object.hasOwn(value,'receiptPersistenceError'))delete merged.receiptPersistenceError;
 return merged;
}
async function metaPut(key,value,tx=null){
 if(String(key).startsWith('responseStaging:')&&value?.blob instanceof Blob&&(value.blob.size!==value.byteSize||await hash.sha256Bytes(value.blob)!==value.sha256))throw storageError('Response staging bytes failed identity verification.','RESPONSE_STAGE_REHASH_MISMATCH');
 const physicalKey=String(key).startsWith('responseOperations:')||String(key).startsWith('quarantine:'),own=tx||await openTransaction(physicalKey?[PROJECTS,META]:META,'readwrite'),store=own.objectStore(META);
 try{
  let saved=value;if(String(key).startsWith('stage30MobileAcceptance.v1:')){const prior=(await request(store.get(key)))?.value;assertMobileAcceptanceSessionWrite(key,value,prior);saved=mergeMobileAcceptanceSession(prior,value);}
  const logicalRow={key,value:String(key).startsWith('responseStaging:')&&saved?.blob instanceof Blob?await sharedByteRecord(own,saved):saved,updatedAt:now()};if(physicalKey){const prepared=await preparePhysicalRowPut(own,logicalRow,META,'value');commitPhysicalRowPut(own,prepared,logicalRow);}else store.put(logicalRow);if(!tx)await complete(own);return saved;
 }catch(error){if(storageDeadlineTransactions.get(error)!==own){try{own.abort();}catch{}}throw error;}
}
async function metaGet(key){const tx=await openTransaction(META,'readonly');const source=await readPhysicalStoredSource(tx,META,key,'value'),row=source.logical,value=String(key).startsWith('responseStaging:')?await hydrateByteRecord(tx,row?.value):hydrateQuarantineValue(source);await complete(tx);return value;}
// Operational response work is owned by META and bound to one canonical row.
// Its closed patch contains no accepted-work authority. Canonical commits fold
// the resulting audit records into their complete snapshot and retire the patch.
const operationalKey=jobId=>'responseOperations:'+String(jobId);
// Private patch copies may retain immutable strings when the native clone
// entry point is unchanged; replacement/accessor hosts keep the old path.
const operationalCloneDescriptor=Object.getOwnPropertyDescriptor,operationalClonePrototype=Object.getPrototypeOf;
function captureOperationalCloneBinding(){
  try{
    const chain=[];
    for(let owner=globalThis;owner;){
      const descriptor=operationalCloneDescriptor(owner,'structuredClone'),parent=operationalClonePrototype(owner);
      chain.push({owner,parent,descriptor});
      if(descriptor)return typeof descriptor.value==='function'?{chain,value:descriptor.value}:null;
      owner=parent;
    }
  }catch{}
  return null;
}
const initialOperationalCloneBinding=captureOperationalCloneBinding();
function operationalCloneBindingCurrent(){
  if(!initialOperationalCloneBinding)return false;
  try{
    for(const entry of initialOperationalCloneBinding.chain){
      if(operationalClonePrototype(entry.owner)!==entry.parent)return false;
      const before=entry.descriptor,after=operationalCloneDescriptor(entry.owner,'structuredClone');
      if(!before){if(after)return false;continue;}
      if(!after||before.value!==after.value||before.get!==after.get||before.set!==after.set||before.writable!==after.writable||before.enumerable!==after.enumerable||before.configurable!==after.configurable)return false;
    }
    return true;
  }catch{return false;}
}
const OPERATIONAL_COLLECTIONS=new Set(['applicationProjection','rawResponses','generatedOutputs','responseValidations','responseProposals','outputReceipts','responseDispositions','rejectedResponses','idCounters','eventSequence','history','allocationReceipts']);
const OPERATIONAL_JOB_FIELDS=new Set(['CURRENT_STAGE','CURRENT_STATE','CURRENT_BLOCKERS','NEXT_REQUIRED_ACTION','JOB_RECORD_STATUS','STATUS_EVIDENCE']);
const OPERATIONAL_STAGE_FIELDS=new Set(['gate','status','derivedData','decision','decisionEvidence','responseDraft']);
function operationalPatches(before,after,path=[]){
  // Traverse once; canonical validation and commit integrity checks remain authoritative.
  if(Object.is(before,after))return [];
  if(before&&after&&typeof before==='object'&&typeof after==='object'&&Array.isArray(before)===Array.isArray(after)){
    if(Array.isArray(before)&&after.length<before.length)return [{path,value:cloneOperationalPatchValue(after)}];
    return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(key=>{
      if(!Object.hasOwn(after,key))return [{path:[...path,key],remove:true}];
      if(!Object.hasOwn(before,key))return [{path:[...path,key],value:cloneOperationalPatchValue(after[key])}];
      return operationalPatches(before[key],after[key],[...path,key]);
    });
  }
  return [{path,value:cloneOperationalPatchValue(after)}];
}
function operationalValuesEqual(before,after){
  if(Object.is(before,after))return true;
  // Preserve the existing hashing behavior for unusual graphs/accessors. The
  // fast path compares the exact ordinary canonical trees used by this owner.
  if(!operationalPatchTree(before)||!operationalPatchTree(after))return equivalent(before,after);
  const pending=[[before,after]];
  while(pending.length){
    const [left,right]=pending.pop();if(Object.is(left,right))continue;
    if(!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)!==Array.isArray(right))return false;
    if(Array.isArray(left)&&left.length!==right.length)return false;
    const keys=Object.keys(left);if(keys.length!==Object.keys(right).length)return false;
    for(const key of keys){if(!Object.hasOwn(right,key))return false;pending.push([left[key],right[key]]);}
  }
  return true;
}
function assertOperationalChange(before,after){
  const engine=globalThis.closedLoopWorkflowEngine,patches=operationalPatches(canonicalProject(before),canonicalProject(after));
  for(const {path} of patches){
    const [root,key,field]=path;
    const allowed=root==='projectData'&&(OPERATIONAL_COLLECTIONS.has(key)||key==='operationReservations')||root==='job'&&OPERATIONAL_JOB_FIELDS.has(key)||root==='stages'&&OPERATIONAL_STAGE_FIELDS.has(field)||['activeView','activeStage'].includes(root);
    if(!allowed)throw storageError('An operational response event attempted to change canonical work: /'+path.join('/'),'OPERATIONAL_OWNERSHIP_VIOLATION');
  }
  const reservations=before.projectData?.operationReservations||[],nextReservations=after.projectData?.operationReservations||[];
  if(reservations.length!==nextReservations.length)throw storageError('An operational event cannot create or remove a reservation.','OPERATIONAL_OWNERSHIP_VIOLATION');
  const statusProjection=record=>{const copy=clone(record);for(const key of ['STATUS','status','updatedAt','recordSha256','contentSha256','sha256'])delete copy[key];if(copy.fields)delete copy.fields.STATUS;return copy;};
  for(let index=0;index<reservations.length;index++){
    const prior=reservations[index],next=nextReservations[index],from=String(engine.recordValue(prior,'STATUS')),to=String(engine.recordValue(next,'STATUS'));
    if(!operationalValuesEqual(statusProjection(prior),statusProjection(next)))throw storageError('An operational event changed a reservation binding.','OPERATIONAL_OWNERSHIP_VIOLATION');
    if(from!==to){
      const allowed=new Set(['EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED','REJECTED','CANCELLED']),seen=new Set([from]),queue=[from];
      for(const state of queue)for(const target of engine.RESERVATION_TRANSITIONS?.[state]||[])if(allowed.has(target)&&!seen.has(target)){seen.add(target);queue.push(target);}
      if(!allowed.has(to)||!seen.has(to))throw storageError('An operational event attempted an invalid reservation transition.','OPERATIONAL_TRANSITION_VIOLATION');
    }
  }
  for(const family of ['history','generatedOutputs']){const prior=before.projectData?.[family]||[],next=after.projectData?.[family]||[];if(next.length<prior.length||prior.some((row,index)=>!operationalValuesEqual(row,next[index])))throw storageError('An operational event changed retained audit history.','OPERATIONAL_OWNERSHIP_VIOLATION');}
  for(const family of ['rawResponses','responseProposals','outputReceipts'])for(const prior of before.projectData?.[family]||[]){
    const key=family==='rawResponses'?'rawResponseId':family==='responseProposals'?'proposalId':'receiptId',accepted=prior.acceptedChangeId||prior.acceptedCanonicalChangeId&&prior.acceptedCanonicalChangeId!=='NONE'||['ACCEPTED','ACCEPTED_DATA_CHANGE','BLOCKER_ACCEPTED','QUESTIONS_CREATED','EXECUTION_FAILURE_ACCEPTED'].includes(prior.status);
    if(accepted&&!operationalValuesEqual(prior,(after.projectData?.[family]||[]).find(row=>row[key]===prior[key])))throw storageError('An operational event changed an accepted response record.','OPERATIONAL_OWNERSHIP_VIOLATION');
  }
  for(const raw of before.projectData?.rawResponses||[]){const next=(after.projectData?.rawResponses||[]).find(item=>item.rawResponseId===raw.rawResponseId);if(!next||['completeRawResponse','sha256','promptInstructionId','promptScope','transport'].some(key=>!operationalValuesEqual(raw[key],next[key])))throw storageError('An operational event changed preserved response identity or bytes.','OPERATIONAL_OWNERSHIP_VIOLATION');}
  for(const proposal of after.projectData?.responseProposals||[]){const prior=(before.projectData?.responseProposals||[]).find(item=>item.proposalId===proposal.proposalId);if(['ACCEPTED','QUESTIONS_CREATED','BLOCKER_ACCEPTED','EXECUTION_FAILURE_ACCEPTED'].includes(proposal.status)&&!operationalValuesEqual(prior,proposal))throw storageError('Acceptance requires a canonical transaction.','OPERATIONAL_OWNERSHIP_VIOLATION');}
  return patches;
}
// Path-copy replay is limited to unshared trees. Canonical field mirrors can
// share arrays, so retain structured-clone behavior for shared graphs/accessors
// instead of changing their alias semantics while replaying a path patch.
function operationalPatchTree(value){
  const seen=new WeakSet(),pending=[value];
  while(pending.length){
    const item=pending.pop();if(!item||typeof item!=='object')continue;
    if(seen.has(item))return false;seen.add(item);
    if(!Array.isArray(item)&&Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)return false;
    if(Object.getOwnPropertySymbols(item).length)return false;
    for(const key of Object.getOwnPropertyNames(item)){
      if(Array.isArray(item)&&key==='length')continue;
      const descriptor=Object.getOwnPropertyDescriptor(item,key);
      if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))return false;
      pending.push(descriptor.value);
    }
  }
  return true;
}
function copyOperationalAncestor(value){
  const copy=Array.isArray(value)?new Array(value.length):{};
  for(const key of Object.keys(value))Object.defineProperty(copy,key,{value:value[key],enumerable:true,writable:true,configurable:true});
  return copy;
}
// Private verification snapshots accept ordinary acyclic graphs: canonical
// field mirrors can share arrays. Compare values independently of alias topology,
// without copying immutable response strings or hashing them a second time.
function verifiedGraphNodes(value){
  const nodes=new Map(),active=new WeakSet(),pending=[value,false];
  while(pending.length){
    const finish=pending.pop(),item=pending.pop();if(!item||typeof item!=='object'){if(typeof item==='function'||typeof item==='symbol')return null;continue;}
    if(finish){active.delete(item);continue;}
    if(active.has(item))return null;if(nodes.has(item))continue;
    if(!Array.isArray(item)&&Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)return null;
    if(Object.getOwnPropertySymbols(item).length)return null;
    const entries=[];
    for(const key of Object.getOwnPropertyNames(item)){
      if(Array.isArray(item)&&key==='length')continue;
      const descriptor=Object.getOwnPropertyDescriptor(item,key);
      if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))return null;
      entries.push(key,descriptor.value);
    }
    nodes.set(item,entries);active.add(item);pending.push(item,true);
    for(let index=1;index<entries.length;index+=2)pending.push(entries[index],false);
  }
  return nodes;
}
function copyVerifiedTree(value){
  const nodes=verifiedGraphNodes(value);if(!nodes)return clone(value);
  if(!value||typeof value!=='object')return value;
  const copies=new Map([...nodes.keys()].map(item=>[item,Array.isArray(item)?new Array(item.length):{}]));
  for(const [source,entries]of nodes){const target=copies.get(source);for(let index=0;index<entries.length;index+=2){const item=entries[index+1];Object.defineProperty(target,entries[index],{value:item&&typeof item==='object'?copies.get(item):item,enumerable:true,writable:true,configurable:true});}}
  return copies.get(value);
}
// Copy only private ordinary operational values, retaining string primitives
// without recopying their bytes. Preserve shared aliases and mutable-container
// isolation; accessors, symbols, cycles and exotic values use the native clone.
function cloneOperationalPatchValue(value){
  if(!operationalCloneBindingCurrent()||!verifiedGraphNodes(value))return clone(value);
  const copy=copyVerifiedTree(value);
  globalThis.closedLoopPromptEngine?.copyRetainedPromptContextFiles?.(value,copy);
  return copy;
}
function verifiedValuesEqual(before,after){
  const leftNodes=verifiedGraphNodes(before),rightNodes=verifiedGraphNodes(after);
  return verifiedNodeValuesEqual(before,after,leftNodes,rightNodes);
}
function verifiedNodeValuesEqual(before,after,leftNodes,rightNodes){
  if(!leftNodes||!rightNodes)return false;
  const pending=[before,after],compared=new WeakMap();
  while(pending.length){
    const right=pending.pop(),left=pending.pop();if(Object.is(left,right))continue;
    if(!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)!==Array.isArray(right))return false;
    if(Array.isArray(left)&&left.length!==right.length)return false;
    let partners=compared.get(left);if(partners?.has(right))continue;if(!partners){partners=new WeakSet();compared.set(left,partners);}partners.add(right);
    const entries=leftNodes.get(left),otherEntries=rightNodes.get(right);if(entries.length!==otherEntries.length)return false;
    // Complete graph validation above retains its original left-to-right
    // inspection order. Snapshots usually preserve insertion order, so equal
    // keys can use their captured descriptors without another lookup map.
    let sameOrder=true;for(let index=0;index<entries.length;index+=2)if(entries[index]!==otherEntries[index]){sameOrder=false;break;}
    if(sameOrder){for(let index=1;index<entries.length;index+=2){const item=entries[index],other=otherEntries[index];pending.push(item,other);}}
    else{const other=new Map();for(let index=0;index<otherEntries.length;index+=2)other.set(otherEntries[index],otherEntries[index+1]);for(let index=0;index<entries.length;index+=2){const key=entries[index],item=entries[index+1];if(!other.has(key))return false;const value=other.get(key);pending.push(item,value);}}
  }
  return true;
}


// A single checkpoint owner may retain the graph description of its own
// detached ordinary snapshot. Current candidates are always rediscovered.
// The existing null-root hash scope supplies only its full primitive guard;
// no digest or validation result is cached or carried across a save.
function releaseCheckpointValueSnapshot(proof){
  const scope=proof.scope;proof.nodes=null;proof.scope=null;
  // Private cleanup must not replace a transaction or comparison error when
  // a diagnostic realm has replaced a primitive used by scope disposal.
  if(scope)try{hash.disposeCanonicalDigestScope(scope);}catch{}
}
function checkpointSnapshotPrimitivesCurrent(proof){
  if(!proof.scope)return false;
  try{return hash.canonicalDigestScopeMatches(proof.scope,null);}catch{return false;}
}
function copyCheckpointValueSnapshot(value){
  const proof={snapshot:undefined,nodes:null,scope:null};
  try{proof.scope=hash.createCanonicalDigestScope(null);}catch{}
  if(!proof.scope){proof.snapshot=copyVerifiedTree(value);return proof;}
  let completed=false;
  try{
    const sourceNodes=verifiedGraphNodes(value);
    if(!sourceNodes){proof.snapshot=clone(value);releaseCheckpointValueSnapshot(proof);completed=true;return proof;}
    const copies=new Map([...sourceNodes.keys()].map(item=>[item,Array.isArray(item)?new Array(item.length):{}])),nodes=new Map();
    for(const [source,entries]of sourceNodes){
      const target=copies.get(source),captured=[];
      for(let index=0;index<entries.length;index+=2){
        const item=entries[index+1],copy=item&&typeof item==='object'?copies.get(item):item;
        Object.defineProperty(target,entries[index],{value:copy,enumerable:true,writable:true,configurable:true});
        captured.push(entries[index],copy);
      }
      nodes.set(target,captured);
    }
    proof.snapshot=value&&typeof value==='object'?copies.get(value):value;proof.nodes=nodes;
    if(!checkpointSnapshotPrimitivesCurrent(proof))releaseCheckpointValueSnapshot(proof);
    completed=true;return proof;
  }finally{if(!completed)releaseCheckpointValueSnapshot(proof);}
}
function unchangedCheckpointValueSnapshot(proof,current){
  if(proof.nodes&&checkpointSnapshotPrimitivesCurrent(proof))return verifiedNodeValuesEqual(proof.snapshot,current,proof.nodes,verifiedGraphNodes(current));
  // Invalidate before the original path can expose the private snapshot to a
  // replaced reflection primitive. Restoring that primitive cannot revive it.
  releaseCheckpointValueSnapshot(proof);
  return verifiedValuesEqual(proof.snapshot,current);
}

const VERIFIED_PROJECT_INTEGRITY=Symbol('private verified project integrity');
function verifiedProjectIntegrity(project,digest){return {kind:VERIFIED_PROJECT_INTEGRITY,project,digest,snapshot:copyVerifiedTree(project)};}
function unchangedVerifiedProject(receipt,project,digest){return receipt?.kind===VERIFIED_PROJECT_INTEGRITY&&receipt.project===project&&receipt.digest===digest&&verifiedValuesEqual(receipt.snapshot,project);}
// Private physical storage only. Canonical values and their hash schemas do not change.
const PHYSICAL_RECORD_SCHEMA='closed-loop-record-parts/1',PHYSICAL_PART_SCHEMA='closed-loop-record-part/1';
const QUARANTINE_RECORD_SCHEMA='closed-loop-quarantine-record-parts/1',QUARANTINE_OPAQUE_SCHEMA='closed-loop-quarantine-physical-json/1';
const PHYSICAL_INLINE_BYTES=16*1024*1024,PHYSICAL_PART_UNITS=262144,PHYSICAL_PART_COMMANDS=1024,PHYSICAL_STRING_FRAGMENT=65536,PHYSICAL_INLINE_STRING=4096;
const physicalPartPrefix=generation=>'recordPart:v1:'+generation+':';
const physicalPartKey=(generation,index)=>physicalPartPrefix(generation)+String(index);
const physicalInvalid=message=>storageError('Stored physical record is invalid: '+message,'PHYSICAL_RECORD_INVALID');
const physicalUnsupported=Symbol('unsupported physical graph');
function physicalOwnArray(value,length=null){
 if(!Array.isArray(value)||length!==null&&value.length!==length||Object.getOwnPropertyNames(value).length!==value.length+1||Object.keys(value).length!==value.length||Object.getOwnPropertySymbols(value).length)return false;
 for(let index=0;index<value.length;index++){const d=Object.getOwnPropertyDescriptor(value,String(index));if(!d||!d.enumerable||!Object.hasOwn(d,'value'))return false;}return true;
}
function physicalExactKeys(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getOwnPropertySymbols(value).length)return false;
 const actual=Object.getOwnPropertyNames(value);return actual.length===keys.length&&actual.every(key=>keys.includes(key))&&keys.every(key=>{const d=Object.getOwnPropertyDescriptor(value,key);return d&&d.enumerable&&Object.hasOwn(d,'value');});
}
function physicalGraphFields(value){
 const prototype=Object.getPrototypeOf(value);
 if(!Array.isArray(value)&&prototype!==Object.prototype&&prototype!==null||Array.isArray(value)&&prototype!==Array.prototype||Object.getOwnPropertySymbols(value).length)throw physicalUnsupported;
 const keys=Object.keys(value),entries=[];
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value'))throw physicalUnsupported;entries.push([key,d.value]);}
 return entries;
}
function physicalBlobMetadataUnits(value){return value.type.length+(typeof File==='function'&&value instanceof File?value.name.length:0);}
function physicalGraphEstimate(value){
 const pending=[value],seen=new Set();let bytes=0;
 while(pending.length){const item=pending.pop(),type=typeof item;
  if(type==='string'){bytes+=item.length*2+64;}
  else if(item===null||type==='undefined'||type==='boolean'||type==='number')bytes+=64;
  else if(type!=='object')throw physicalUnsupported;
  else if(!seen.has(item)){seen.add(item);bytes+=128;if(item instanceof Blob)bytes+=physicalBlobMetadataUnits(item)*2;else{for(const [key,child]of physicalGraphFields(item)){bytes+=key.length*2+128;pending.push(child);}}}
  // Saturate the estimate, but finish eligibility discovery; unsupported values
  // retain the prior native path rather than being silently normalized.
  if(bytes>PHYSICAL_INLINE_BYTES)bytes=PHYSICAL_INLINE_BYTES+1;
 }return bytes;
}
function physicalStringUnits(value){
 const pending=[value],seen=new Set();let units=0;
 while(pending.length){const item=pending.pop();if(typeof item==='string')units+=item.length;
  else if(item instanceof Blob)units+=physicalBlobMetadataUnits(item);
  else if(item&&typeof item==='object'){if(seen.has(item))throw physicalInvalid('cyclic physical command');seen.add(item);if(!physicalOwnArray(item))throw physicalInvalid('non-array physical command');for(const child of item)pending.push(child);}
  if(!Number.isSafeInteger(units))throw physicalInvalid('physical string count overflow');
 }return units;
}
function physicalPartHeaderUnits(part){return part.key.length+part.value.schema.length+part.value.ownerStore.length+part.value.ownerKey.length+part.value.generation.length+String(part.updatedAt).length;}
function encodePhysicalRow(row,ownerStore,payloadField,{force=false,quarantineEncoding=false}={}){
 const ownerKey=ownerStore===PROJECTS?row.jobId:row.key;
 if(quarantineEncoding&&(ownerStore!==META||typeof ownerKey!=='string'||!ownerKey.startsWith('quarantine:')||payloadField!=='value'||!quarantineOwnMarker(row)||row.value?.schema!==QUARANTINE_OPAQUE_SCHEMA))throw physicalInvalid('quarantine write boundary');
 if(typeof ownerKey!=='string'||![PROJECTS,META].includes(ownerStore)||payloadField!==(ownerStore===PROJECTS?'project':'value')||!Object.hasOwn(row,payloadField)||Object.hasOwn(row,'storageEncoding'))throw physicalInvalid('write boundary');
 try{if(!force&&physicalGraphEstimate(row[payloadField])<=PHYSICAL_INLINE_BYTES)return {logical:row,root:row,parts:[],packed:false};}
 catch(error){if(error===physicalUnsupported)return {logical:row,root:row,parts:[],packed:false};throw error;}
 const generation=crypto.randomUUID();if(typeof generation!=='string'||!/^[-a-zA-Z0-9]{1,128}$/.test(generation))throw physicalInvalid('new generation');
 const parts=[],stamp=now();let part=null,partUnits=0,commandCount=0,stringCodeUnits=0,nextString=0;const nodes=new Map(),queue=[],blobs=new Map();
 const newPart=()=>{part={key:physicalPartKey(generation,parts.length),value:{schema:PHYSICAL_PART_SCHEMA,ownerStore,ownerKey,generation,index:parts.length,last:false,commands:[]},updatedAt:stamp};partUnits=physicalPartHeaderUnits(part);if(partUnits>PHYSICAL_PART_UNITS/2)throw physicalUnsupported;parts.push(part);};
 const emit=command=>{const units=physicalStringUnits(command);if(units>PHYSICAL_PART_UNITS/2)throw physicalInvalid('physical command is too large');if(!part||part.value.commands.length>=PHYSICAL_PART_COMMANDS||partUnits+units>PHYSICAL_PART_UNITS)newPart();part.value.commands.push(command);partUnits+=units;commandCount++;};
 const textToken=text=>{stringCodeUnits+=text.length;if(!Number.isSafeInteger(stringCodeUnits))throw physicalInvalid('logical string count overflow');if(text.length<=PHYSICAL_INLINE_STRING)return ['string',text];
  const id=nextString++;emit(['stringStart',id]);let index=0;for(let offset=0;offset<text.length;offset+=PHYSICAL_STRING_FRAGMENT)emit(['stringPart',id,index++,text.slice(offset,offset+PHYSICAL_STRING_FRAGMENT)]);emit(['stringEnd',id,text.length]);return ['stringRef',id];};
 const token=item=>{if(item===null)return ['null'];switch(typeof item){case 'undefined':return ['undefined'];case 'boolean':return ['boolean',item];case 'string':return textToken(item);case 'number':return ['number',Object.is(item,-0)?'-0':Number.isNaN(item)?'NaN':item===Infinity?'Infinity':item===-Infinity?'-Infinity':item];case 'object':break;default:throw physicalUnsupported;}
  if(item instanceof Blob){if(physicalBlobMetadataUnits(item)>PHYSICAL_PART_UNITS/4)throw physicalUnsupported;let id=blobs.get(item);if(id===undefined){id=blobs.size;blobs.set(item,id);emit(['blob',id,item]);}return ['blobRef',id];}
  let entry=nodes.get(item);if(!entry){entry={id:nodes.size,kind:Array.isArray(item)?'array':'object',value:item,entries:physicalGraphFields(item)};nodes.set(item,entry);queue.push(entry);}return ['objectRef',entry.id,entry.kind];};
 try{
  emit(['root',token(row[payloadField])]);
  for(let at=0;at<queue.length;at++){const entry=queue[at];emit(['node',entry.id,entry.kind]);for(const [key,value]of entry.entries){const keyToken=textToken(key),valueToken=token(value);emit(['property',entry.id,keyToken,valueToken]);}emit(['endNode',entry.id,entry.entries.length,entry.kind==='array'?entry.value.length:null]);}
 }catch(error){if(error===physicalUnsupported)return {logical:row,root:row,parts:[],packed:false};throw error;}
 parts.at(-1).value.last=true;
 const storageEncoding={schema:quarantineEncoding?QUARANTINE_RECORD_SCHEMA:PHYSICAL_RECORD_SCHEMA,payloadField,ownerStore,ownerKey,generation,partCount:parts.length,commandCount,stringCodeUnits},root={...row,storageEncoding};delete root[payloadField];
 return {logical:row,root,parts,packed:true};
}
function physicalEnvelope(row,ownerStore,payloadField){
 if(!row||!Object.hasOwn(row,'storageEncoding'))return null;
 const e=row.storageEncoding,ownerKey=ownerStore===PROJECTS?row.jobId:row.key;
 if(!physicalExactKeys(e,['schema','payloadField','ownerStore','ownerKey','generation','partCount','commandCount','stringCodeUnits'])||!(e.schema===PHYSICAL_RECORD_SCHEMA||e.schema===QUARANTINE_RECORD_SCHEMA&&ownerStore===META&&typeof ownerKey==='string'&&ownerKey.startsWith('quarantine:')&&payloadField==='value'&&quarantineOwnMarker(row))||e.payloadField!==payloadField||e.ownerStore!==ownerStore||e.ownerKey!==ownerKey||typeof ownerKey!=='string'||typeof e.generation!=='string'||!/^[-a-zA-Z0-9]{1,128}$/.test(e.generation)||Object.hasOwn(row,payloadField)||!Number.isSafeInteger(e.partCount)||e.partCount<1||!Number.isSafeInteger(e.commandCount)||e.commandCount<1||!Number.isSafeInteger(e.stringCodeUnits)||e.stringCodeUnits<0)throw physicalInvalid('root envelope');
 return e;
}
function decodePhysicalRow(row,ownerStore,payloadField,parts){
 const e=physicalEnvelope(row,ownerStore,payloadField);if(!e)return row;
 if(!Array.isArray(parts)||parts.length!==e.partCount)throw physicalInvalid('part inventory count');
 const nodes=new Map(),strings=new Map(),blobs=new Map(),usedBlobs=new Set();const canonicalPayload=ownerStore===PROJECTS||ownerStore===META&&e.ownerKey.startsWith('responseOperations:');let rootSeen=false,rootValue,commands=0,stringCodeUnits=0,activeNode=null,activeString=null;
 const integer=(value,label)=>{if(!Number.isSafeInteger(value)||value<0)throw physicalInvalid(label);return value;};
 const text=tok=>{if(!physicalOwnArray(tok,2))throw physicalInvalid('string token shape');let value;if(tok[0]==='string'){if(typeof tok[1]!=='string'||tok[1].length>PHYSICAL_INLINE_STRING)throw physicalInvalid('inline string');value=tok[1];}
  else if(tok[0]==='stringRef'){const s=strings.get(integer(tok[1],'string reference'));if(!s?.finished||s.used)throw physicalInvalid('unresolved or repeated string reference');s.used=true;value=s.value;}
  else throw physicalInvalid('expected string token');stringCodeUnits+=value.length;if(!Number.isSafeInteger(stringCodeUnits))throw physicalInvalid('logical string overflow');return value;};
 const token=tok=>{if(!physicalOwnArray(tok)||typeof tok[0]!=='string')throw physicalInvalid('token shape');switch(tok[0]){
  case 'null':if(tok.length!==1)throw physicalInvalid('null token');return null;
  case 'undefined':if(tok.length!==1)throw physicalInvalid('undefined token');return undefined;
  case 'boolean':if(tok.length!==2||typeof tok[1]!=='boolean')throw physicalInvalid('boolean token');return tok[1];
  case 'number':if(tok.length!==2)throw physicalInvalid('number token');if(typeof tok[1]==='number'&&Number.isFinite(tok[1])&&!Object.is(tok[1],-0))return tok[1];if(tok[1]==='-0')return -0;if(tok[1]==='NaN')return NaN;if(tok[1]==='Infinity')return Infinity;if(tok[1]==='-Infinity')return -Infinity;throw physicalInvalid('number value');
  case 'string':case 'stringRef':return text(tok);
  case 'blobRef':if(tok.length!==2||!blobs.has(integer(tok[1],'blob reference')))throw physicalInvalid('unresolved blob');usedBlobs.add(tok[1]);return blobs.get(tok[1]);
  case 'objectRef':{if(tok.length!==3||!['object','array'].includes(tok[2]))throw physicalInvalid('object reference');const id=integer(tok[1],'object id');let n=nodes.get(id);if(!n){if(id!==nodes.size)throw physicalInvalid('nonconsecutive object id');n={kind:tok[2],value:tok[2]==='array'?[]:{},keys:new Set(),started:false,finished:false};nodes.set(id,n);}if(n.kind!==tok[2])throw physicalInvalid('object kind mismatch');return n.value;}
  default:throw physicalInvalid('unknown token');
 }};
 for(let index=0;index<parts.length;index++){
  const p=parts[index],v=p?.value;
  if(!physicalExactKeys(p,['key','value','updatedAt'])||!physicalExactKeys(v,['schema','ownerStore','ownerKey','generation','index','last','commands'])||p.key!==physicalPartKey(e.generation,index)||v.schema!==PHYSICAL_PART_SCHEMA||v.ownerStore!==ownerStore||v.ownerKey!==e.ownerKey||v.generation!==e.generation||v.index!==index||v.last!==(index===parts.length-1)||typeof p.updatedAt!=='string'||!physicalOwnArray(v.commands)||v.commands.length<1||v.commands.length>PHYSICAL_PART_COMMANDS||physicalPartHeaderUnits(p)+physicalStringUnits(v.commands)>PHYSICAL_PART_UNITS)throw physicalInvalid('part identity or size');
  for(const c of v.commands){commands++;if(!physicalOwnArray(c)||typeof c[0]!=='string')throw physicalInvalid('command shape');
   switch(c[0]){
    case 'stringStart':{if(c.length!==2||activeString!==null||integer(c[1],'string id')!==strings.size)throw physicalInvalid('string start');strings.set(c[1],{pieces:[],units:0,next:0,finished:false,used:false});activeString=c[1];break;}
    case 'stringPart':{const s=strings.get(c[1]);if(c.length!==4||activeString!==c[1]||!s||c[2]!==s.next||typeof c[3]!=='string'||!c[3].length||c[3].length>PHYSICAL_STRING_FRAGMENT)throw physicalInvalid('string part');s.next++;s.units+=c[3].length;if(!Number.isSafeInteger(s.units))throw physicalInvalid('string length overflow');s.pieces.push(c[3]);break;}
    case 'stringEnd':{const s=strings.get(c[1]);if(c.length!==3||activeString!==c[1]||!s||c[2]!==s.units||s.units<=PHYSICAL_INLINE_STRING)throw physicalInvalid('string end');s.value=s.pieces.join('');s.pieces=null;s.finished=true;activeString=null;break;}
    case 'blob':if(c.length!==3||activeString!==null||integer(c[1],'blob id')!==blobs.size||!(c[2] instanceof Blob))throw physicalInvalid('blob command');blobs.set(c[1],c[2]);break;
    case 'root':if(c.length!==2||rootSeen||activeString!==null||activeNode!==null)throw physicalInvalid('root command');rootValue=token(c[1]);rootSeen=true;break;
    case 'node':{const n=nodes.get(c[1]);if(c.length!==3||!rootSeen||activeString!==null||activeNode!==null||!n||n.kind!==c[2]||n.started)throw physicalInvalid('node command');n.started=true;activeNode=c[1];break;}
    case 'property':{const n=nodes.get(c[1]);if(c.length!==4||activeString!==null||activeNode!==c[1]||!n||n.finished)throw physicalInvalid('property command');const key=text(c[2]);if(n.keys.has(key)||n.kind==='array'&&key==='length')throw physicalInvalid('duplicate property');const value=token(c[3]);Object.defineProperty(n.value,key,{value,enumerable:true,writable:true,configurable:true});n.keys.add(key);break;}
    case 'endNode':{const n=nodes.get(c[1]);if(c.length!==4||activeString!==null||activeNode!==c[1]||!n||c[2]!==n.keys.size)throw physicalInvalid('node end');if(n.kind==='array'){if(!Number.isInteger(c[3])||c[3]<0||c[3]>4294967295||n.value.length>c[3])throw physicalInvalid('array length');if(canonicalPayload&&(n.keys.size!==c[3]||[...n.keys].some(key=>!/^(?:0|[1-9]\d*)$/.test(key)||Number(key)>=c[3])))throw physicalInvalid('sparse canonical array');n.value.length=c[3];}else if(c[3]!==null)throw physicalInvalid('object length');n.finished=true;activeNode=null;break;}
    default:throw physicalInvalid('unknown command');
   }
  }
 }
 if(!rootSeen||activeNode!==null||activeString!==null||commands!==e.commandCount||stringCodeUnits!==e.stringCodeUnits||[...nodes.values()].some(n=>!n.finished)||[...strings.values()].some(s=>!s.finished||!s.used)||usedBlobs.size!==blobs.size)throw physicalInvalid('incomplete graph');
 const logical={...row,[payloadField]:rootValue};delete logical.storageEncoding;return logical;
}

// Captures only the codec's own ordinary graph domain. Blob/File leaves are
// immutable native carriers: retain identity, never infer byte equality from
// size/type. A separately read Blob is not an equal private snapshot leaf.
function copyPhysicalGraph(value){
 const copies=new Map(),queue=[];
 const take=item=>{if(item===null||typeof item!=='object'){if(!['undefined','boolean','number','string'].includes(typeof item)&&item!==null)throw physicalUnsupported;return item;}if(item instanceof Blob)return item;if(copies.has(item))return copies.get(item);const fields=physicalGraphFields(item),copy=Array.isArray(item)?new Array(item.length):{};copies.set(item,copy);queue.push([copy,fields]);return copy;};
 // Completed descriptors are no longer needed. Keep breadth-first discovery
 // and the alias map unchanged, without retaining every processed field pair.
 const result=take(value);for(let i=0;i<queue.length;i++){const [copy,fields]=queue[i];for(const [key,child]of fields)Object.defineProperty(copy,key,{value:take(child),enumerable:true,writable:true,configurable:true});queue[i]=null;}return result;
}
function physicalValuesEqual(before,after){
 const leftToRight=new Map(),rightToLeft=new Map(),pending=[[before,after]];
 try{while(pending.length){const [left,right]=pending.pop();if(Object.is(left,right))continue;if(!left||!right||typeof left!=='object'||typeof right!=='object'||left instanceof Blob||right instanceof Blob||Array.isArray(left)!==Array.isArray(right))return false;if(leftToRight.has(left)){if(leftToRight.get(left)!==right)return false;continue;}if(rightToLeft.has(right))return false;leftToRight.set(left,right);rightToLeft.set(right,left);if(Array.isArray(left)&&left.length!==right.length)return false;const a=physicalGraphFields(left),b=physicalGraphFields(right);if(a.length!==b.length)return false;const fields=new Map(b);for(const [key,value]of a){if(!fields.has(key))return false;pending.push([value,fields.get(key)]);}}return true;}catch(error){if(error===physicalUnsupported)return false;throw error;}
}
// Transaction adapters for the private physical format. No Blob/crypto await.
function physicalGeneration(value){return typeof value==='string'&&/^[-a-zA-Z0-9]{1,128}$/.test(value)?value:null;}
async function physicalGenerationRecords(tx,generation){
 if(!physicalGeneration(generation))return {keys:[],records:[],unavailable:true};
 const meta=tx.objectStore(META),prefix=physicalPartPrefix(generation),all=await request(meta.getAllKeys()),keys=all.filter(key=>typeof key==='string'&&key.startsWith(prefix)),records=[];
 // Count comes from actual storage, never the untrusted envelope. Preserve
 // actual keys separately from row.key so damaged identities remain evidence.
 for(let offset=0;offset<keys.length;offset+=32){const slice=keys.slice(offset,offset+32),values=await Promise.all(slice.map(key=>request(meta.get(key))));for(let i=0;i<slice.length;i++)records.push({key:slice[i],row:values[i]});}
 return {keys,records,unavailable:false};
}
function orderedPhysicalParts(root,ownerStore,payloadField,inventory){
 const e=physicalEnvelope(root,ownerStore,payloadField);
 if(!e)return [];
 if(inventory.unavailable||inventory.records.length!==e.partCount)throw physicalInvalid('actual generation inventory');
 const byKey=new Map();for(const entry of inventory.records){if(typeof entry.key!=='string'||byKey.has(entry.key)||entry.row?.key!==entry.key)throw physicalInvalid('physical key identity');byKey.set(entry.key,entry.row);}
 const parts=[];for(let index=0;index<inventory.records.length;index++){const row=byKey.get(physicalPartKey(e.generation,index));if(!row)throw physicalInvalid('missing, noncanonical or trailing part index');parts.push(row);}return parts;
}
async function readPhysicalStoredSource(tx,ownerStore,key,payloadField,providedRoot){
 const root=arguments.length>=5?providedRoot:await request(tx.objectStore(ownerStore).get(key));
 if(ownerStore===META&&typeof key==='string'&&key.startsWith('quarantine:')&&root&&Object.hasOwn(root,'quarantineEncoding')&&root.storageEncoding?.schema!==QUARANTINE_RECORD_SCHEMA)throw physicalInvalid('quarantine reserved marker without its version');
 if(!root||!Object.hasOwn(root,'storageEncoding'))return {logical:root,root,records:[],identity:null,packed:false};
 let inventory={keys:[],records:[],unavailable:true};
 try{
  // Capture available physical rows even when the envelope grammar is bad.
  inventory=await physicalGenerationRecords(tx,root.storageEncoding?.generation);
  if((ownerStore===PROJECTS?root.jobId:root.key)!==key)throw physicalInvalid('requested root identity');
  const parts=orderedPhysicalParts(root,ownerStore,payloadField,inventory),logical=decodePhysicalRow(root,ownerStore,payloadField,parts),records=parts.map(part=>({key:part.key,row:part}));
  // Native get detached these private part rows from storage. Decoding only
  // shares immutable leaves; keep a separate identity inventory, not a second
  // command graph. Outer root metadata is shared by the logical spread, so copy it.
  const identity={root:copyPhysicalGraph(root),records:records.map(({key,row})=>({key,row}))};
  return {logical,root,records,identity,packed:true};
 }catch(error){
  if(error?.code==='PHYSICAL_RECORD_INVALID')error.physicalCapture={ownerStore,key,payloadField,root,records:inventory.records,inventoryUnavailable:inventory.unavailable,claimed:root.storageEncoding||null};
  throw error;
 }
}
async function readPhysicalProjectSources(tx,jobId){
 const id=String(jobId),rowSource=await readPhysicalStoredSource(tx,PROJECTS,id,'project'),journalSource=await readPhysicalStoredSource(tx,META,operationalKey(id),'value');
 return {row:rowSource.logical,journal:journalSource.logical,rowSource,journalSource,storage:{row:rowSource.identity,journal:journalSource.identity}};
}
function physicalSourcesUnchanged(expected,actual){return physicalValuesEqual(expected||{row:null,journal:null},actual||{row:null,journal:null});}
async function readPhysicalProjectRows(tx){
 const roots=await request(tx.objectStore(PROJECTS).getAll()),rows=[];
 for(const root of roots)rows.push((await readPhysicalStoredSource(tx,PROJECTS,root.jobId,'project',root)).logical);return rows;
}
async function physicalGenerationReferencedElsewhere(tx,source){
 if(!source?.packed)return false;
 const e=source.root.storageEncoding,generation=e?.generation;
 // No shared generations are created by this writer. This additional scan
 // preserves a generation copied/referenced by another corrupt root instead of
 // turning source-format corruption into destructive cleanup authority.
 const roots=await request(tx.objectStore(PROJECTS).getAll());
 for(const row of roots)if(!(e.ownerStore===PROJECTS&&row.jobId===e.ownerKey)&&row?.storageEncoding?.generation===generation)return true;
 const meta=tx.objectStore(META),keys=await request(meta.getAllKeys());
 for(const key of keys){if(typeof key!=='string'||key.startsWith('recordPart:v1:')||e.ownerStore===META&&key===e.ownerKey)continue;
  // Only these root domains are written with the physical codec. Unknown
  // metadata remains untouched; a matching explicit outer marker is retention.
  const row=await request(meta.get(key));if(row?.storageEncoding?.generation===generation)return true;
 }
 return false;
}
async function preparePhysicalRowPut(tx,row,ownerStore,payloadField,oldSource=null,quarantineEncoding=false){
 let snapshot;try{snapshot=copyPhysicalGraph(row);}catch(error){if(error!==physicalUnsupported)throw error;snapshot=null;}const encoded=encodePhysicalRow(row,ownerStore,payloadField,{quarantineEncoding});
 const physicalSnapshot=encoded.packed?{root:copyPhysicalGraph(encoded.root),parts:copyPhysicalGraph(encoded.parts)}:null;
 const source=oldSource||await readPhysicalStoredSource(tx,ownerStore,ownerStore===PROJECTS?row.jobId:row.key,payloadField);
 if(encoded.packed){const present=await physicalGenerationRecords(tx,encoded.root.storageEncoding.generation);if(present.records.length)throw physicalInvalid('new generation already exists');
  if(!physicalValuesEqual(row,decodePhysicalRow(encoded.root,ownerStore,payloadField,encoded.parts)))throw physicalInvalid('encoded values differ from prepared logical row');
 }
 let removeKeys=[],retained=false;
 if(source.packed){
  // A malformed part can never become deletion authority. Read/decoding has
  // already authenticated this exact source inventory in the transaction.
  orderedPhysicalParts(source.root,ownerStore,payloadField,{records:source.records,unavailable:false});
  retained=await physicalGenerationReferencedElsewhere(tx,source);
  if(!retained)removeKeys=source.records.map(entry=>entry.key);
 }
 const prepared={...encoded,ownerStore,payloadField,snapshot,physicalSnapshot,removeKeys,retainedOldParts:retained};assertPreparedPhysicalRow(prepared,row);return prepared;
}
function assertPreparedPhysicalRow(prepared,row){
 if(prepared.snapshot&&!physicalValuesEqual(prepared.snapshot,row)||prepared.physicalSnapshot&&(!physicalValuesEqual(prepared.physicalSnapshot.root,prepared.root)||!physicalValuesEqual(prepared.physicalSnapshot.parts,prepared.parts)))throw storageError('Prepared storage values changed before commit. Refresh and retry.','STALE_PROJECT_REVISION');
}
function commitPhysicalRowPut(tx,prepared,row){
 assertPreparedPhysicalRow(prepared,row);
 const meta=tx.objectStore(META);
 for(let index=0;index<prepared.parts.length;index++){meta.put(prepared.parts[index]);fault('during-physical-part-write');}
 tx.objectStore(prepared.ownerStore).put(prepared.root);fault('during-physical-root-write');
 for(const key of prepared.removeKeys){meta.delete(key);fault('during-physical-old-part-delete');}
 assertPreparedPhysicalRow(prepared,row);
 // Transfer the detached private snapshot, never the mutable values passed to
 // native put. Its only retained consumers are private exact-source proofs.
 return prepared.packed?{root:prepared.physicalSnapshot.root,records:prepared.physicalSnapshot.parts.map(part=>({key:part.key,row:part}))}:null;
}
async function preparePhysicalRowRemoval(tx,ownerStore,key,payloadField,source=null){
 source=source||await readPhysicalStoredSource(tx,ownerStore,key,payloadField);
 if(!source?.root)return {ownerStore,key,removeKeys:[],retainedOldParts:false};
 if(!source.packed)return {ownerStore,key,removeKeys:[],retainedOldParts:false};
 const retained=await physicalGenerationReferencedElsewhere(tx,source);
 return {ownerStore,key,removeKeys:retained?[]:source.records.map(entry=>entry.key),retainedOldParts:retained};
}
function commitPhysicalRowRemoval(tx,prepared){
 tx.objectStore(prepared.ownerStore).delete(prepared.key);
 for(const key of prepared.removeKeys){tx.objectStore(META).delete(key);fault('during-physical-old-part-delete');}
}
function compactPhysicalMissingFacts(root,ownerStore,payloadField,inventory){
 const claim=root?.storageEncoding,declared=claim?.partCount,usableCount=Number.isSafeInteger(declared)&&declared>=0,indices=[];let valid=false,issue=null;
 try{const parts=orderedPhysicalParts(root,ownerStore,payloadField,inventory);decodePhysicalRow(root,ownerStore,payloadField,parts);valid=true;}catch(error){issue=String(error?.code||'PHYSICAL_RECORD_INVALID');}
 const prefix=physicalGeneration(claim?.generation)?physicalPartPrefix(claim.generation):null;
 if(prefix)for(const entry of inventory.records){const suffix=entry.key.startsWith(prefix)?entry.key.slice(prefix.length):'';if(/^(?:0|[1-9]\d*)$/.test(suffix)){const n=Number(suffix);if(Number.isSafeInteger(n)&&n>=0)indices.push(n);}}
 indices.sort((a,b)=>a-b);const unique=[...new Set(indices)],missingRanges=[];let next=0;
 if(usableCount){for(const index of unique){if(index>=declared)break;if(index>next)missingRanges.push([next,index]);next=index+1;}if(next<declared)missingRanges.push([next,declared]);}
 return {complete:valid&&!inventory.unavailable,declaredPartCount:declared??null,actualPartRecordCount:inventory.records.length,presentIndices:unique,missingRanges:usableCount?missingRanges:null,inventoryUnavailable:inventory.unavailable,issue};
}
async function capturePhysicalStoredEvidence(tx,ownerStore,key,payloadField){
 const root=await request(tx.objectStore(ownerStore).get(key));
 if(!root||!Object.hasOwn(root,'storageEncoding'))return {ownerStore,key,payloadField,root,records:[],facts:{complete:true,legacyInline:true},packed:false};
 const inventory=await physicalGenerationRecords(tx,root.storageEncoding?.generation),facts=compactPhysicalMissingFacts(root,ownerStore,payloadField,inventory);
 if((ownerStore===PROJECTS?root.jobId:root.key)!==key){facts.complete=false;facts.issue='PHYSICAL_ROOT_IDENTITY_MISMATCH';}
 return {ownerStore,key,payloadField,root,records:inventory.records,facts,packed:true};
}
async function preparePreservedPhysicalRemoval(tx,capture){
 const result={ownerStore:capture.ownerStore,key:capture.key,removeKeys:[],retainedOldParts:false};
 if(!capture.packed||!capture.root)return result;
 const e=capture.root.storageEncoding;
 // Corrupt ownership cannot designate data for removal. The preserved copy
 // records it, but the source parts stay in place rather than risk other work.
 if(!e||e.ownerStore!==capture.ownerStore||e.ownerKey!==capture.key||!physicalGeneration(e.generation)){result.retainedOldParts=true;return result;}
 const shared=await physicalGenerationReferencedElsewhere(tx,{packed:true,root:capture.root});
 if(shared){result.retainedOldParts=true;return result;}
 for(const entry of capture.records){const v=entry.row?.value,index=v?.index;
  if(Number.isSafeInteger(index)&&index>=0&&entry.key===physicalPartKey(e.generation,index)&&entry.row?.key===entry.key&&v?.schema===PHYSICAL_PART_SCHEMA&&v.ownerStore===capture.ownerStore&&v.ownerKey===capture.key&&v.generation===e.generation)result.removeKeys.push(entry.key);
  else result.retainedOldParts=true;
 }
 return result;
}

function replayOperationalPatches(project,patches){
  const copyPaths=operationalPatchTree(project)&&patches.every(patch=>patch.remove||operationalPatchTree(patch.value));
  const next=copyPaths?copyOperationalAncestor(project):cloneOperationalPatchValue(project);
  for(const patch of patches){
    if(!Array.isArray(patch.path)||!patch.path.length||patch.path.some(key=>typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)))throw storageError('Saved response operation has an invalid field path.','OPERATIONAL_STATE_INTEGRITY_FAILED');
    let target=next;for(const key of patch.path.slice(0,-1)){if(!target||typeof target!=='object'||!Object.hasOwn(target,key))throw storageError('Saved response operation has an unavailable parent.','OPERATIONAL_STATE_INTEGRITY_FAILED');if(copyPaths&&target[key]&&typeof target[key]==='object')target[key]=copyOperationalAncestor(target[key]);target=target[key];}
    const key=patch.path.at(-1);if(patch.remove)delete target[key];else target[key]=cloneOperationalPatchValue(patch.value);
  }
  assertOperationalChange(project,next);
  return next;
}
function applyOperationalJournal(row,journal,checkpointRead=null){
  if(!row||!journal)return row;
  const {sha256,...body}=journal;
  if(sha256!==hash.sha256Value(body)||body.schema!=='closed-loop-response-operations/1'||body.jobId!==String(row.jobId)||body.baseProjectSha256!==row.projectSha256||body.projectRevision!==Number(row.revision)||!Array.isArray(body.patches))throw storageError('Saved response operations do not match their canonical project.','OPERATIONAL_STATE_INTEGRITY_FAILED');
  const next=replayOperationalPatches(row.project,body.patches);
  const primitive=checkpointRead&&rootDigestPrimitivesUnchanged(initialRootDigestPrimitives)?initialRootDigestPrimitives:null;
  const snapshot=primitive&&verifiedGraphNodes(next)?copyVerifiedTree(canonicalProject(next)):null;
  const pair=snapshot?historyProjectDigestsCold(next):null;
  if((pair?pair.projectSha256:projectSha256(next))!==body.projectSha256)throw storageError('Saved response operation contents are corrupt.','OPERATIONAL_STATE_INTEGRITY_FAILED');
  if(pair&&rootDigestPrimitivesUnchanged(primitive)&&verifiedValuesEqual(snapshot,canonicalProject(next))){
    const proof={primitive,snapshot,...pair};checkpointDigestPairs.add(proof);checkpointRead.checkpointDigestPair=proof;
  }
  return {...row,project:next,projectSha256:body.projectSha256};
}
// A successful canonical, operational or current-view checkpoint commit can supply the
// next transaction's private read proof. It is consumed once and only after complete source-value equality;
// ordinary reads/reloads still execute the full cold integrity path.
const STARTUP_REFRESH_READ=Symbol('private startup refresh read'),STARTUP_RECOVERY_CAPTURE=Symbol('private recovery capture'),CHECKPOINT_PAIR_READ=Symbol('private checkpoint pair read');
let recentOperationalCommitRead=null;
function takeOperationalCommitRead(row,journal,readPurpose=null,storage=null){
  const proof=recentOperationalCommitRead;recentOperationalCommitRead=null;
  if(!proof||proof.requiredReadPurpose&&proof.requiredReadPurpose!==readPurpose||!row||String(row.jobId)!==projectIdentity(proof.project)||!unchangedVerifiedProject(proof,proof.project,proof.digest)||!verifiedValuesEqual(proof.row,row)||!verifiedValuesEqual(proof.journal,journal)||!physicalSourcesUnchanged(proof.storage,storage))return null;
  return proof;
}
async function projectRowWithOperations(tx,jobId,verifiedRead=null,physicalCapture=null,sourceOutput=null){
 const sources=await readPhysicalProjectSources(tx,jobId),{row,journal}=sources;
 // Private same-transaction output only; every original source/CAS guard below
 // still runs before the caller can consume these freshly read physical rows.
 if(sourceOutput)Object.assign(sourceOutput,sources);
 if(physicalCapture&&!physicalSourcesUnchanged(physicalCapture.storage,sources.storage))throw storageError('Stored project parts changed after preparation. The current generation is preserved.','STALE_PROJECT_REVISION');
 if(verifiedRead){
  // Compare the complete freshly reread source, including all payload values.
  // Matching stored digest labels alone cannot establish unchanged bytes.
  if(!unchangedVerifiedProject(verifiedRead,verifiedRead.project,verifiedRead.digest)||!verifiedValuesEqual(verifiedRead.row,row)||!verifiedValuesEqual(verifiedRead.journal,journal)||!physicalSourcesUnchanged(verifiedRead.storage,sources.storage))throw storageError('Project or response data changed after verification. The newer state is preserved.','STALE_PROJECT_REVISION');
  return {...row,project:verifiedRead.project,projectSha256:verifiedRead.digest};
 }
 return applyOperationalJournal(row,journal?.value);
}
async function preparePendingReturnedArtifacts(project,prior,input){
 if(input===undefined)return [];if(!Array.isArray(input))throw storageError('Pending returned artifacts must be an array.','PENDING_ARTIFACTS_INVALID');
 const engine=globalThis.closedLoopWorkflowEngine,ingestion=globalThis.closedLoopResponseIngestion,owner=projectIdentity(project),seen=new Set(),checkedResponses=new Set(),rows=[];
 engine.validateAllocationReceipts(project,prior);
 for(const supplied of input){
  if(!supplied||typeof supplied!=='object'||!(supplied.blob instanceof Blob)||typeof supplied.artifactId!=='string'||!supplied.artifactId||supplied.jobId!==owner||seen.has(supplied.artifactId)||typeof supplied.filename!=='string'||typeof supplied.mediaType!=='string'||!Number.isSafeInteger(supplied.byteSize)||supplied.byteSize<0||supplied.blob.size!==supplied.byteSize||typeof supplied.sha256!=='string'||!/^[a-f0-9]{64}$/.test(supplied.sha256))throw storageError('Pending returned bytes have an invalid owner or identity.','PENDING_ARTIFACTS_INVALID');
  seen.add(supplied.artifactId);const receipt=engine.assertArtifactAllocation(project,supplied.artifactId),raw=(project.projectData.rawResponses||[]).find(row=>row.rawResponseId===supplied.lineage?.rawResponseId),file=Array.isArray(raw?.files)?raw.files.find(row=>row.artifactId===supplied.artifactId):null,original=(prior.projectData.rawResponses||[]).find(row=>row.rawResponseId===raw?.rawResponseId);
  if(!raw||!original||raw.jobId!==owner||!['PRESERVED','VALIDATION_FAILED'].includes(raw.status)||raw.sha256!==original.sha256||receipt.parentId!==raw.rawResponseId||receipt.targetSlot!==supplied.lineage?.attachmentSlotId||supplied.lineage.stage!==raw.stage||supplied.lineage.logicalPath!==supplied.filename||supplied.lineage.role!==globalThis.closedLoopCore.STAGES[raw.stage-1]?.role||!file||file.attachmentSlotId!==supplied.lineage.attachmentSlotId||file.name!==supplied.filename||file.type!==supplied.mediaType||file.size!==supplied.byteSize||file.sha256!==supplied.sha256||supplied.lineage.productId!==undefined&&supplied.lineage.productId!==raw.promptScope?.productId)throw storageError('Pending returned bytes are not bound to their exact allocated response slot.','PENDING_ARTIFACT_BINDING_INVALID');
  // Reuse admission's slot/response/allocation rules; this disposable binder
  // result grants no proposal acceptance and is never persisted as a new event.
  if(!checkedResponses.has(raw.rawResponseId)){ingestion.bindAttachmentSlots(project,{rawResponseId:raw.rawResponseId,files:raw.files});checkedResponses.add(raw.rawResponseId);}
  if(await hash.sha256Bytes(supplied.blob)!==supplied.sha256)throw storageError('Pending returned bytes differ from their captured digest.','PENDING_ARTIFACT_REHASH_MISMATCH');
  rows.push({artifactId:supplied.artifactId,jobId:owner,blob:supplied.blob,filename:supplied.filename,mediaType:supplied.mediaType,byteSize:supplied.byteSize,sha256:supplied.sha256,lineage:clone(supplied.lineage),createdAt:now()});
 }
 return rows;
}
async function writeOperationalProject(project,options={}){
  const id=projectIdentity(project),verifiedRead=await readProjectForTransaction(id),prior=verifiedRead?.project;if(!prior)throw storageError('Project is unavailable.','PROJECT_NOT_FOUND');
  if(Number(options.expectedProjectRevision)!==Number(prior.revision)||!options.expectedStateSha256||options.expectedStateSha256!==prior.projectSha256)throw storageError('Project or pending response changed. Refresh it before retrying.','STALE_PROJECT_REVISION');
  const next=cloneOperationalPatchValue(project);delete next.projectSha256;
  assertProjectCollectionShape(next);
  assertCanonicalFieldValues(next);
  assertJobPointerIntegrity(next,prior);
  if(Number(next.revision)!==Number(prior.revision))throw storageError('An operational event cannot advance the canonical revision.','OPERATIONAL_OWNERSHIP_VIOLATION');
  const pendingArtifacts=await preparePendingReturnedArtifacts(next,prior,options.pendingArtifacts);
  if(projectSha256(next)===prior.projectSha256){if(pendingArtifacts.length)throw storageError('Pending returned files require their response mapping transaction.','PENDING_ARTIFACTS_WITHOUT_CHANGE');return prior;}
  globalThis.closedLoopPromptEngine.copyRetainedPromptContextFiles(prior,next);
  // Reuse only guarded digests of the unchanged large response carriers
  // during this synchronous derivation/validation. Every owner still runs;
  // scope limits or changed values/primitives retain the ordinary cold path.
  const responseDigestScope=hash.createCanonicalDigestScope({rawResponses:next.projectData.rawResponses,responseProposals:next.projectData.responseProposals,generatedOutputs:next.projectData.generatedOutputs})||hash.createCanonicalDigestScope({rawResponses:next.projectData.rawResponses,generatedOutputs:next.projectData.generatedOutputs});
  try{
    hash.withCanonicalDigestScope(responseDigestScope,()=>{
      globalThis.closedLoopWorkflowEngine.recalculate(next);assertOperationalChange(prior,next);assertProjectIntegrity(next);
    });
  }finally{hash.disposeCanonicalDigestScope(responseDigestScope);}
  // Bind both measured labels to a private value snapshot before any await.
  // The ordinary context-copy hook may retain next, never this capture.
  const primitive=rootDigestPrimitivesUnchanged(initialRootDigestPrimitives)?initialRootDigestPrimitives:null,snapshot=primitive&&verifiedGraphNodes(next)?copyVerifiedTree(canonicalProject(next)):null,measured=snapshot?historyProjectDigests(next):null;
  const pair=measured&&rootDigestPrimitivesUnchanged(primitive)&&verifiedValuesEqual(snapshot,canonicalProject(next))?Object.freeze({primitive,snapshot,...measured}):null;if(pair)checkpointDigestPairs.add(pair);
  const digest=pair?pair.projectSha256:projectSha256(next),integrity=verifiedProjectIntegrity(next,digest);
  const retentionState=globalThis.closedLoopPromptEngine.promptContextRetentionState,retainedStates=(next.projectData.generatedPrompts||[]).map(record=>retentionState(record));
  const assertRetainedContexts=project=>{const records=project.projectData.generatedPrompts||[];for(let index=0;index<retainedStates.length;index++){const expected=retainedStates[index];if(expected.availability==='AVAILABLE'&&!verifiedValuesEqual(expected,retentionState(records[index])))throw storageError('Previously retained prompt context bytes are unavailable on the committed response.','PROMPT_CONTEXT_INTEGRITY_FAILED');}};
  // Context bytes need their own carrier: never expose the digest snapshot to
  // the replaceable hook, and never depend on next after an asynchronous wait.
  const contextCarrier=copyVerifiedTree(integrity.snapshot);
  globalThis.closedLoopPromptEngine.copyRetainedPromptContextFiles(next,contextCarrier);
  const assertOperationalCandidate=()=>{if(!unchangedVerifiedProject(integrity,next,digest)||!verifiedValuesEqual(integrity.snapshot,contextCarrier)||pair&&!checkpointPairMatches(pair,next))throw storageError('The prepared response candidate changed before commit. Prepare the current candidate again.','STALE_PROJECT_REVISION');};
  assertRetainedContexts(contextCarrier);assertOperationalCandidate();if(digest===prior.projectSha256){if(pendingArtifacts.length)throw storageError('Pending returned files require their response mapping transaction.','PENDING_ARTIFACTS_WITHOUT_CHANGE');return prior;}
  const retainedArtifacts=pendingArtifacts.length?await listArtifacts(id):null,byId=new Map((retainedArtifacts||[]).map(row=>[row.artifactId,row]));
  for(const row of pendingArtifacts){const existing=byId.get(row.artifactId);if(existing&&(existing.sha256!==row.sha256||existing.byteSize!==row.byteSize||existing.filename!==row.filename||existing.mediaType!==row.mediaType||!equivalent(existing.lineage,row.lineage)))throw storageError('A pending returned artifact conflicts with stored bytes.','ARTIFACT_ID_REUSE');if(existing)row.createdAt=existing.createdAt;byId.set(row.artifactId,row);}
  assertOperationalCandidate();
  // Every asynchronous History check, including original-source binding,
  // consumes the unexposed capture rather than hook-retained mutable values.
  const historyCandidate=pair?pair.snapshot:integrity.snapshot,historyIntegrity=verifiedProjectIntegrity(historyCandidate,digest);
  const prepared=await prepareHistoryCommit(historyCandidate,prior,{label:options.historyLabel||'Response work saved',view:options.historyView,artifactRows:pendingArtifacts.length?[...byId.values()]:null,verifiedDigests:[[prior,prior.projectSha256],[historyCandidate,digest,pair?.workSha256]],verifiedIntegrity:[verifiedRead,historyIntegrity],verifiedDigestPair:pair});
  assertOperationalCandidate();fault('before-project-transaction');const tx=await openTransaction(pendingArtifacts.length?[PROJECTS,ARTIFACTS,META]:[PROJECTS,META],'readwrite');
  try{
    const meta=tx.objectStore(META),sources={},current=await projectRowWithOperations(tx,id,verifiedRead,null,sources),baseSource=sources.rowSource,base=baseSource.logical;
    if(current?.projectSha256!==prior.projectSha256)throw storageError('Another session changed the pending response.','STALE_PROJECT_REVISION');
    globalThis.closedLoopWorkflowEngine.validateAllocationReceipts(next,current?.project);
    if(pendingArtifacts.length){const artifacts=tx.objectStore(ARTIFACTS);for(const row of pendingArtifacts){const existing=await request(artifacts.get(row.artifactId));if(existing&&(existing.jobId!==id||existing.sha256!==row.sha256||existing.byteSize!==row.byteSize||existing.filename!==row.filename||existing.mediaType!==row.mediaType||existing.createdAt!==row.createdAt||!equivalent(existing.lineage,row.lineage)))throw storageError('Another operation changed the pending returned artifact identity.','ARTIFACT_ID_REUSE');fault('during-pending-artifact-write');await storeArtifactRow(tx,row);}}
    const existingSource=pendingArtifacts.length?await readPhysicalStoredSource(tx,META,operationalKey(id),'value'):sources.journalSource,existing=existingSource.logical?.value,body={schema:'closed-loop-response-operations/1',jobId:id,baseProjectSha256:base.projectSha256,projectRevision:Number(base.revision),sequence:Number(existing?.sequence||0)+1,patches:assertOperationalChange(base.project,next),projectSha256:digest};
    // Prove the generated journal itself reconstructs the validated candidate.
    // This exact comparison reuses the known candidate digest; a faulty patch
    // generator cannot mint an integrity receipt for different stored values.
    if(!verifiedValuesEqual(replayOperationalPatches(base.project,body.patches),next))throw storageError('Generated response operations do not reconstruct the validated project.','OPERATIONAL_STATE_INTEGRITY_FAILED');
    const savedJournal={key:operationalKey(id),value:{...body,sha256:hash.sha256Value(body)},updatedAt:now()},journalSnapshot=copyVerifiedTree(savedJournal);
    const journalWrite=await preparePhysicalRowPut(tx,savedJournal,META,'value',existingSource);
    const assertOperationalCommit=()=>{assertPreparedPhysicalRow(journalWrite,savedJournal);assertOperationalCandidate();if(!verifiedValuesEqual(journalSnapshot,savedJournal))throw storageError('The prepared response journal changed before commit. Prepare the current candidate again.','STALE_PROJECT_REVISION');};
    // History may await native requests. Abort the same transaction if either
    // the actual candidate or the journal changed before their durable put.
    await commitHistory(tx,prepared);assertOperationalCommit();const committedJournalStorage=commitPhysicalRowPut(tx,journalWrite,savedJournal);fault('during-operational-write');recordWorkerCommit(tx,options.operationId,next,digest);fault('before-transaction-commit');assertOperationalCommit();await complete(tx);
    // Native completion already committed the checked journal. A late hook
    // mutation of next cannot change the success result or its warm proof.
    try{
      const committed={...copyVerifiedTree(integrity.snapshot),projectSha256:digest},returnedIntegrity=verifiedProjectIntegrity(committed,digest);
      // Preserve exact prompt-context bytes on the trusted return carrier,
      // while binding its canonical values before the replaceable transfer.
      if(!verifiedValuesEqual(integrity.snapshot,contextCarrier))throw storageError('Captured prompt context values changed during transaction completion.','STALE_PROJECT_REVISION');
      globalThis.closedLoopPromptEngine.copyRetainedPromptContextFiles(contextCarrier,committed);
      if(!unchangedVerifiedProject(returnedIntegrity,committed,digest))throw storageError('Returned response values changed during context restoration.','STALE_PROJECT_REVISION');
      assertRetainedContexts(committed);
      const privateCommitted=copyVerifiedTree(committed),committedIntegrity=verifiedProjectIntegrity(privateCommitted,digest);
      // Capture first so the existing consumption guard rejects hook mutations.
      globalThis.closedLoopPromptEngine.copyRetainedPromptContextFiles(committed,privateCommitted);
      if(!unchangedVerifiedProject(returnedIntegrity,committed,digest))throw storageError('Returned response values changed during context restoration.','STALE_PROJECT_REVISION');
      assertRetainedContexts(committed);if(unchangedVerifiedProject(committedIntegrity,privateCommitted,digest))assertRetainedContexts(privateCommitted);
      recentOperationalCommitRead={row:copyVerifiedTree(base),journal:copyVerifiedTree(journalSnapshot),storage:{row:baseSource.identity,journal:committedJournalStorage},...committedIntegrity,checkpointDigestPair:checkpointPairMatches(pair,privateCommitted)?pair:null};
      notifyProjectChange(committed,{operational:true});return committed;
    }catch(error){
      recentOperationalCommitRead=null;
      throw Object.assign(storageError('The response was committed, but its returned context could not be restored. Reload and verify the saved response before continuing.','COMMITTED_PROJECT_UNAVAILABLE'),{committed:true,existingProjectsUnchanged:false,cause:error});
    }
  }catch(error){try{tx.abort();}catch{}throw error;}
}
// null means a genuine native structured leaf has no synchronous cross-read
// equality operation here. It is NOT equal. Any known difference wins, even if
// another leaf is uncomparable, so generation replacement remains stale.
function forensicGraphRelation(before,after){
 const pairs=new Map(),reverse=new Map(),pending=[[before,after]];let unknown=false;
 while(pending.length){const [left,right]=pending.pop();if(Object.is(left,right))continue;if(!left||!right||typeof left!=='object'||typeof right!=='object')return false;
  if(Array.isArray(left)!==Array.isArray(right))return false;
  let a,b;try{a=physicalGraphFields(left);b=physicalGraphFields(right);}catch(error){if(error!==physicalUnsupported)throw error;const tag=Object.prototype.toString;if(tag.call(left)!==tag.call(right))return false;unknown=true;continue;}
  if(pairs.has(left)){if(pairs.get(left)!==right)return false;continue;}if(reverse.has(right))return false;pairs.set(left,right);reverse.set(right,left);
  if(Array.isArray(left)&&left.length!==right.length||a.length!==b.length)return false;
  const fields=new Map(b);for(const [key,value]of a){if(!fields.has(key))return false;pending.push([value,fields.get(key)]);}
 }return unknown?null:true;
}
function physicalEvidenceRelation(expected,actual){
 if(!expected||expected.records.length!==actual.records.length)return false;
 let result=forensicGraphRelation(expected.root,actual.root);if(result===false)return false;
 const rows=new Map(actual.records.map(entry=>[entry.key,entry.row]));
 for(const entry of expected.records){if(!rows.has(entry.key))return false;const same=forensicGraphRelation(entry.row,rows.get(entry.key));if(same===false)return false;if(same===null)result=null;}return result;
}
function forensicHasNonPlainLeaf(value){
 const seen=new Set(),pending=[value];while(pending.length){const item=pending.pop();if(!item||typeof item!=='object'||seen.has(item))continue;seen.add(item);if(!Array.isArray(item)&&Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)return true;for(const key of Object.keys(item)){const d=Object.getOwnPropertyDescriptor(item,key);if(d&&Object.hasOwn(d,'value'))pending.push(d.value);}}return false;
}
function forensicHasOwnUndefined(value){
 const seen=new Set(),pending=[value];while(pending.length){const item=pending.pop();if(!item||typeof item!=='object'||seen.has(item))continue;seen.add(item);if(!Array.isArray(item)&&Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)continue;for(const key of Object.keys(item)){const d=Object.getOwnPropertyDescriptor(item,key);if(!d||!Object.hasOwn(d,'value'))continue;if(d.value===undefined)return true;pending.push(d.value);}}return false;
}
function isNativeDomainCanonicalRefusal(error,value,omittedDigest){
 if(!(error instanceof TypeError)||typeof error.message!=='string'||!/^Cannot canonically hash (?:non-plain object|undefined) at \$.*\.$/s.test(error.message))return false;
 // Match the actual hash preimage, not an excluded digest label or a value
 // hidden inside a native leaf. Re-derive the exact refusal with the pinned
 // canonical encoder; an unrelated/infrastructure TypeError is not evidence.
 if(value&&typeof value==='object'){value={...value};delete value[omittedDigest];}
 if(!forensicHasNonPlainLeaf(value)||error.message.startsWith('Cannot canonically hash undefined at ')&&!forensicHasOwnUndefined(value))return false;
 try{for(const chunk of hash.canonicalChunks(value))void chunk;}catch(current){return current instanceof TypeError&&current.message===error.message;}return false;
}
function currentPhysicalCorruptionReason(rowCapture,journalCapture){
 const logical=capture=>capture.packed?decodePhysicalRow(capture.root,capture.ownerStore,capture.payloadField,orderedPhysicalParts(capture.root,capture.ownerStore,capture.payloadField,{records:capture.records,unavailable:capture.facts.inventoryUnavailable})):capture.root===undefined?undefined:structuredClone(capture.root);
 let row,journal;try{row=logical(rowCapture);journal=logical(journalCapture);}catch(error){if(error?.code==='PHYSICAL_RECORD_INVALID')return 'PHYSICAL_RECORD_INVALID: '+error.message;throw error;}
 if(!row)return null;
 let computed;try{computed=projectSha256(row.project);}catch(error){if(isNativeDomainCanonicalRefusal(error,row.project,'projectSha256'))return 'PROJECT_ENCODING_INVALID: '+error.message;throw error;}
 if(computed!==row.projectSha256)return 'PROJECT_HASH_MISMATCH';
 if(Number(row.revision)!==Number(row.project?.revision))return 'PROJECT_REVISION_MISMATCH';
 const staticIssue=project=>{try{assertProjectIntegrity(project,{verifyDerived:false});return null;}catch(error){if(error?.code!=='PROJECT_INTEGRITY_FAILED'||!Array.isArray(error.issues))throw error;if(legacyJobPointerProjection(project,{verifyDerived:false}))return null;return error.message;}};
 const issue=staticIssue(row.project);if(issue)return 'PROJECT_CANONICAL_INTEGRITY_FAILED: '+issue;
 try{const active=applyOperationalJournal(row,journal?.value);if(active!==row){const activeIssue=staticIssue(active.project);if(activeIssue)return 'OPERATIONAL_STATE_INTEGRITY_FAILED: '+activeIssue;}}
 catch(error){if(error?.code==='OPERATIONAL_STATE_INTEGRITY_FAILED'||isNativeDomainCanonicalRefusal(error,journal?.value,'sha256'))return 'OPERATIONAL_STATE_INTEGRITY_FAILED: '+error.message;throw error;}
 return null;
}
// This is a storage-only carrier for already encoded physical part rows, not
// a canonical project or an activation format. Unsupported forensic graphs
// retain the original physical/native path in their entirety.
const QUARANTINE_OPAQUE_TEXT_UNITS=PHYSICAL_PART_UNITS*8;
const quarantineJSONOwner=JSON,quarantineJSONParse=JSON.parse;
const quarantineDescriptor=Object.getOwnPropertyDescriptor;
function quarantineOwnMarker(row){const descriptor=quarantineDescriptor(row,'quarantineEncoding');return descriptor&&descriptor.enumerable&&Object.hasOwn(descriptor,'value')&&descriptor.value===QUARANTINE_OPAQUE_SCHEMA;}
function quarantineJSONCurrent(){
 const owner=quarantineDescriptor(globalThis,'JSON'),parse=quarantineDescriptor(quarantineJSONOwner,'parse');
 return owner?.value===quarantineJSONOwner&&parse?.value===quarantineJSONParse&&!quarantineDescriptor(Object.prototype,'toJSON')&&!quarantineDescriptor(Array.prototype,'toJSON');
}
function quarantineOpaqueFields(value,strict){
 const prototype=Object.getPrototypeOf(value),array=Array.isArray(value);
 if(prototype!==(array?Array.prototype:Object.prototype)&&!(prototype===null&&!strict&&!array)||Object.getOwnPropertySymbols(value).length)return null;
 const names=Object.getOwnPropertyNames(value),keys=Object.keys(value);
 if(names.length!==keys.length+(array?1:0)||array&&!names.includes('length'))return null;
 if(strict&&array&&(keys.length!==value.length||keys.some((key,index)=>key!==String(index))))return null;
 const fields=[];for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value')||strict&&key==='toJSON')return null;fields.push([key,descriptor.value]);}return fields;
}
function quarantineOpaqueScalar(value){return value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&value===value&&value!==Infinity&&value!==-Infinity&&(value!==0||1/value===Infinity);}
function quarantineOpaqueTreeEqual(left,right,separate=true){
 const seenLeft=new Set(),seenRight=new Set(),pending=[[left,right]];
 while(pending.length){const [a,b]=pending.pop();if(a===null||typeof a!=='object'){if(!quarantineOpaqueScalar(a)||!Object.is(a,b))return false;continue;}
  if(!b||typeof b!=='object'||separate&&(a===b||seenRight.has(a)||seenLeft.has(b))||a instanceof Blob||b instanceof Blob||Array.isArray(a)!==Array.isArray(b)||seenLeft.has(a)||seenRight.has(b))return false;seenLeft.add(a);seenRight.add(b);
  const af=quarantineOpaqueFields(a,true),bf=quarantineOpaqueFields(b,true);if(!af||!bf||af.length!==bf.length||Array.isArray(a)&&a.length!==b.length)return false;
  for(let index=0;index<af.length;index++){if(af[index][0]!==bf[index][0])return false;pending.push([af[index][1],bf[index][1]]);}
 }return true;
}
const quarantineOpaqueUnsupported=Symbol('unsupported opaque physical row');
const quarantineOpaqueEscapes={__proto__:null,"\u0000":"\\u0000", "\u0001":"\\u0001", "\u0002":"\\u0002", "\u0003":"\\u0003", "\u0004":"\\u0004", "\u0005":"\\u0005", "\u0006":"\\u0006", "\u0007":"\\u0007", "\b":"\\b", "\t":"\\t", "\n":"\\n", "\u000b":"\\u000b", "\f":"\\f", "\r":"\\r", "\u000e":"\\u000e", "\u000f":"\\u000f", "\u0010":"\\u0010", "\u0011":"\\u0011", "\u0012":"\\u0012", "\u0013":"\\u0013", "\u0014":"\\u0014", "\u0015":"\\u0015", "\u0016":"\\u0016", "\u0017":"\\u0017", "\u0018":"\\u0018", "\u0019":"\\u0019", "\u001a":"\\u001a", "\u001b":"\\u001b", "\u001c":"\\u001c", "\u001d":"\\u001d", "\u001e":"\\u001e", "\u001f":"\\u001f", "\"":"\\\"", "\\":"\\\\"};
function quarantineOpaqueText(value){
 const bounded=text=>{if(text.length>QUARANTINE_OPAQUE_TEXT_UNITS)throw quarantineOpaqueUnsupported;return text;};
 const quoted=text=>{if(text.length>QUARANTINE_OPAQUE_TEXT_UNITS)throw quarantineOpaqueUnsupported;let output='"';for(let index=0;index<text.length;index++){const character=text[index];
   if(character>='\ud800'&&character<='\udbff'){const next=text[index+1];if(!(next>='\udc00'&&next<='\udfff'))throw quarantineOpaqueUnsupported;output+=character+next;index++;}
   else if(character>='\udc00'&&character<='\udfff')throw quarantineOpaqueUnsupported;
   else output+=quarantineOpaqueEscapes[character]??character;bounded(output);
  }return bounded(output+'"');};
 const encode=(item,depth)=>{if(depth>16)throw quarantineOpaqueUnsupported;if(item===null)return 'null';if(typeof item==='string')return quoted(item);if(typeof item==='boolean')return item?'true':'false';if(typeof item==='number'&&quarantineOpaqueScalar(item))return ''+item;
  if(!item||typeof item!=='object'||item instanceof Blob)throw quarantineOpaqueUnsupported;const fields=quarantineOpaqueFields(item,true);if(!fields)throw quarantineOpaqueUnsupported;
  const array=Array.isArray(item);let output=array?'[':'{';for(let index=0;index<fields.length;index++){if(index)output+=',';if(!array)output+=quoted(fields[index][0])+':';output+=encode(fields[index][1],depth+1);bounded(output);}return bounded(output+(array?']':'}'));
 };return encode(value,0);
}
function quarantineOpaqueDisjoint(saved,roots,shells){
 const owners=new Map(),pending=[[saved,-1]];
 while(pending.length){let [value,owner]=pending.pop();if(value===null||typeof value!=='object'){if(owner>=0&&!quarantineOpaqueScalar(value))return false;continue;}
  if(roots.has(value)){if(owner>=0)return false;owner=roots.get(value);}
  if(owners.has(value)){if(owner>=0||owners.get(value)>=0||shells.has(value))return false;continue;}owners.set(value,owner);
  if(value instanceof Blob){if(owner>=0)return false;continue;}
  const fields=quarantineOpaqueFields(value,owner>=0);if(!fields)return false;for(const [,child]of fields)pending.push([child,owner]);
 }return true;
}
function quarantineMappedFields(target,original,exceptA=null,exceptB=null){
 const left=quarantineOpaqueFields(target,false),right=quarantineOpaqueFields(original,false);if(!left||!right||left.length!==right.length)return false;
 for(let index=0;index<left.length;index++){const [key,value]=left[index];if(key!==right[index][0]||key!==exceptA&&key!==exceptB&&!Object.is(value,right[index][1]))return false;}return true;
}
function quarantineBindingInvalid(){return storageError('Prepared quarantine evidence changed before commit. Refresh and retry.','STALE_PROJECT_REVISION');}
function compactQuarantineRow(saved){
 if(!quarantineJSONCurrent())return null;
 const value=saved.value,evidence=value?.physicalEvidence;
 if(!physicalExactKeys(value,['schema','reason','row','operationalJournal','artifacts','capturedAt','physicalEvidence','completeSnapshot'])||value.schema!=='closed-loop-quarantine/1'||!physicalExactKeys(evidence,['schema','project','journal'])||evidence.schema!=='closed-loop-physical-evidence/1')return null;
 const roots=new Map(),shells=new Set([saved,value,evidence]);
 for(let index=0;index<2;index++){const capture=index===0?evidence.project:evidence.journal;if(!physicalExactKeys(capture,['ownerStore','key','payloadField','root','records','facts','packed'])||capture.ownerStore!==(index===0?PROJECTS:META)||capture.payloadField!==(index===0?'project':'value')||typeof capture.key!=='string'||typeof capture.packed!=='boolean'||!physicalOwnArray(capture.records))return null;shells.add(capture);shells.add(capture.records);for(const entry of capture.records){shells.add(entry);if(!physicalExactKeys(entry,['key','row'])||typeof entry.key!=='string'||!entry.row||typeof entry.row!=='object'||Array.isArray(entry.row)||roots.has(entry.row))return null;roots.set(entry.row,roots.size);}}
 if(!roots.size||value.row!==evidence.project.root||value.operationalJournal!==(evidence.journal.packed?evidence.journal.root:evidence.journal.root?.value||null)||!quarantineOpaqueDisjoint(saved,roots,shells))return null;
 // Neither this indexed container nor its comparators is passed to observers.
 // Expected primitive text/key/digest bindings live only in lexical closures.
 const bindings={__proto__:null},captures={__proto__:null};let bindingCount=0;
 for(let group=0;group<2;group++){const capture=group===0?evidence.project:evidence.journal,sourceRecords=capture.records,records=[],count=sourceRecords.length;
  for(let index=0;index<count;index++){const entry=sourceRecords[index],sourceRow=entry.row,key=entry.key;if(!quarantineJSONCurrent())return null;let text;try{text=quarantineOpaqueText(sourceRow);}catch(error){if(error===quarantineOpaqueUnsupported)return null;throw error;}
   const decoded=quarantineJSONParse(text);let reencoded;try{reencoded=quarantineOpaqueText(decoded);}catch(error){if(error===quarantineOpaqueUnsupported)return null;throw error;}
   if(reencoded!==text||!quarantineOpaqueTreeEqual(sourceRow,decoded)||!quarantineJSONCurrent())return null;
   const codeUnits=text.length,sha256=hash.sha256Text(text);if(typeof sha256!=='string'||!/^[0-9a-f]{64}$/.test(sha256))return null;const record={key,text,codeUnits,sha256};
   bindings[bindingCount++]=recheck=>{if(sourceRecords[index]!==entry||entry.row!==sourceRow||entry.key!==key||records[index]!==record||!physicalExactKeys(record,['key','text','codeUnits','sha256'])||record.key!==key||record.text!==text||record.codeUnits!==codeUnits||record.sha256!==sha256)throw quarantineBindingInvalid();if(recheck){let current;try{current=quarantineOpaqueText(sourceRow);}catch(error){if(error!==quarantineOpaqueUnsupported)throw error;throw quarantineBindingInvalid();}if(current!==text)throw quarantineBindingInvalid();}};
   records.push(record);
  }
  const compact={...capture,records};captures[group]=compact;
  bindings[bindingCount++]=()=>{if(capture.records!==sourceRecords||compact.records!==records||!physicalOwnArray(records,count)||!quarantineMappedFields(compact,capture,'records'))throw quarantineBindingInvalid();};
 }
 const mappedEvidence={...evidence,project:captures[0],journal:captures[1]},body={...value,physicalEvidence:mappedEvidence},wrapper={schema:QUARANTINE_OPAQUE_SCHEMA,evidence:body},stored={...saved,quarantineEncoding:QUARANTINE_OPAQUE_SCHEMA,value:wrapper};
 const assertCurrent=(recheck=false)=>{if(!physicalExactKeys(stored,['key','value','updatedAt','quarantineEncoding'])||stored.key!==saved.key||stored.updatedAt!==saved.updatedAt||stored.quarantineEncoding!==QUARANTINE_OPAQUE_SCHEMA||stored.value!==wrapper||!physicalExactKeys(wrapper,['schema','evidence'])||wrapper.schema!==QUARANTINE_OPAQUE_SCHEMA||wrapper.evidence!==body||body.physicalEvidence!==mappedEvidence||!quarantineMappedFields(body,value,'physicalEvidence')||!quarantineMappedFields(mappedEvidence,evidence,'project','journal')||mappedEvidence.project!==captures[0]||mappedEvidence.journal!==captures[1])throw quarantineBindingInvalid();for(let index=0;index<bindingCount;index++)bindings[index](recheck);};
 // No forced mode: naturally small or unsupported carriers stay on old storage.
 try{if(physicalGraphEstimate(stored.value)<=PHYSICAL_INLINE_BYTES)return null;}catch(error){if(error===physicalUnsupported)return null;throw error;}
 if(!quarantineJSONCurrent())return null;assertCurrent(true);return {row:stored,assertCurrent};
}
function hydrateQuarantineValue(source){
 const opaque=source.root?.storageEncoding?.schema===QUARANTINE_RECORD_SCHEMA;
 if(!opaque){if(typeof source.root?.key==='string'&&source.root.key.startsWith('quarantine:')&&Object.hasOwn(source.root,'quarantineEncoding'))throw physicalInvalid('quarantine reserved marker without its version');return source.logical?.value;}
 let row;try{row=copyPhysicalGraph(source.logical);}catch(error){if(error!==physicalUnsupported)throw error;throw physicalInvalid('quarantine compact domain');}
 const wrapper=row?.value,value=wrapper?.evidence,evidence=value?.physicalEvidence;
 if(!quarantineOwnMarker(row)||!quarantineJSONCurrent()||!physicalExactKeys(wrapper,['schema','evidence'])||wrapper.schema!==QUARANTINE_OPAQUE_SCHEMA||!physicalExactKeys(value,['schema','reason','row','operationalJournal','artifacts','capturedAt','physicalEvidence','completeSnapshot'])||value.schema!=='closed-loop-quarantine/1'||!physicalExactKeys(evidence,['schema','project','journal'])||evidence.schema!=='closed-loop-physical-evidence/1')throw physicalInvalid('quarantine opaque envelope');
 const captures=[],shells=new Set([row,wrapper,value,evidence]),decodedRoots=new Map(),bindings={__proto__:null};let bindingCount=0;
 for(let index=0;index<2;index++){const capture=index===0?evidence.project:evidence.journal;
  if(!physicalExactKeys(capture,['ownerStore','key','payloadField','root','records','facts','packed'])||capture.ownerStore!==(index===0?PROJECTS:META)||capture.payloadField!==(index===0?'project':'value')||typeof capture.key!=='string'||typeof capture.packed!=='boolean'||!physicalOwnArray(capture.records))throw physicalInvalid('quarantine capture envelope');shells.add(capture);shells.add(capture.records);
  const records=[];for(const entry of capture.records){shells.add(entry);
   if(!physicalExactKeys(entry,['key','text','codeUnits','sha256'])||typeof entry.key!=='string'||typeof entry.text!=='string'||entry.text.length>QUARANTINE_OPAQUE_TEXT_UNITS||entry.codeUnits!==entry.text.length||typeof entry.sha256!=='string'||!/^[0-9a-f]{64}$/.test(entry.sha256)||hash.sha256Text(entry.text)!==entry.sha256||!quarantineJSONCurrent())throw physicalInvalid('quarantine opaque row identity');
   const text=entry.text,key=entry.key,parsed=quarantineJSONParse(text);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!quarantineOpaqueTreeEqual(parsed,parsed,false))throw physicalInvalid('quarantine opaque row domain');
   // A parse observer may retain its result or queue a mutation. Detach each
   // bounded result before retaining it, using the existing physical copier.
   const decoded=copyPhysicalGraph(parsed);let reencoded;try{reencoded=quarantineOpaqueText(decoded);}catch(error){if(error!==quarantineOpaqueUnsupported)throw error;throw physicalInvalid('quarantine opaque row domain');}
   if(reencoded!==text||!quarantineOpaqueTreeEqual(parsed,decoded)||!quarantineJSONCurrent())throw physicalInvalid('quarantine opaque row domain');
   const record={key,row:decoded},position=records.length;bindings[bindingCount++]=()=>{let current;try{current=quarantineOpaqueText(decoded);}catch(error){if(error!==quarantineOpaqueUnsupported)throw error;throw physicalInvalid('quarantine decoded row changed');}if(records[position]!==record||!physicalExactKeys(record,['key','row'])||record.key!==key||record.row!==decoded||current!==text)throw physicalInvalid('quarantine decoded row changed');};
   decodedRoots.set(decoded,decodedRoots.size);records.push(record);
  }const outputCapture={...capture,records},count=records.length;bindings[bindingCount++]=()=>{if(captures[index]!==outputCapture||outputCapture.records!==records||!physicalOwnArray(records,count)||!quarantineMappedFields(outputCapture,capture,'records'))throw physicalInvalid('quarantine decoded capture changed');};captures.push(outputCapture);
 }
 if(!quarantineOpaqueDisjoint(row,new Map(),shells)||value.row!==evidence.project.root||value.operationalJournal!==(evidence.journal.packed?evidence.journal.root:evidence.journal.root?.value||null))throw physicalInvalid('quarantine alias boundary');
 const mappedEvidence={...evidence,project:captures[0],journal:captures[1]},hydrated={...value,physicalEvidence:mappedEvidence};if(!decodedRoots.size||!quarantineMappedFields(hydrated,value,'physicalEvidence')||!quarantineMappedFields(mappedEvidence,evidence,'project','journal')||!quarantineOpaqueDisjoint(hydrated,decodedRoots,new Set())||!quarantineJSONCurrent())throw physicalInvalid('quarantine decoded row alias');
 for(let index=0;index<bindingCount;index++)bindings[index]();if(!physicalValuesEqual(source.logical,row))throw physicalInvalid('quarantine compact evidence changed');return hydrated;
}
function assertOriginalQuarantineRow(snapshot,row){if(snapshot&&!physicalValuesEqual(snapshot,row))throw storageError('Prepared quarantine evidence changed before commit. Refresh and retry.','STALE_PROJECT_REVISION');}
async function prepareQuarantineRowPut(tx,row){
 if(!row.value?.physicalEvidence)return {prepared:await preparePhysicalRowPut(tx,row,META,'value'),row,snapshot:null};
 let snapshot;try{snapshot=copyPhysicalGraph(row);}catch(error){if(error!==physicalUnsupported)throw error;return {prepared:await preparePhysicalRowPut(tx,row,META,'value'),row,snapshot:null};}
 let plan=compactQuarantineRow(row);assertOriginalQuarantineRow(snapshot,row);
 if(!plan){snapshot=null;return {prepared:await preparePhysicalRowPut(tx,row,META,'value'),row,snapshot:null};}
 let prepared=await preparePhysicalRowPut(tx,plan.row,META,'value',null,true);plan.assertCurrent();assertOriginalQuarantineRow(snapshot,row);
 if(!prepared.packed){prepared=null;plan=null;snapshot=null;return {prepared:await preparePhysicalRowPut(tx,row,META,'value'),row,snapshot:null};}
 return {prepared,row:plan.row,snapshot,assertCompact:plan.assertCurrent};
}
function commitQuarantineRowPut(tx,write,original){write.assertCompact?.();assertOriginalQuarantineRow(write.snapshot,original);commitPhysicalRowPut(tx,write.prepared,write.row);write.assertCompact?.();assertOriginalQuarantineRow(write.snapshot,original);}

async function preservePhysicalQuarantine(tx,rowCapture,journalCapture,reason,title){
 const meta=tx.objectStore(META),id=String(rowCapture.key),artifacts=await hydrateArtifactRows(tx,await request(tx.objectStore(ARTIFACTS).index('jobId').getAll(id)),{diagnostic:true,preserveDamagedBytes:true}),key=`quarantine:${id||'UNKNOWN'}:${crypto.randomUUID()}`,capturedAt=now(),catalog=clone((await request(meta.get('quarantineCatalog')))?.value||{});
 const packed=rowCapture.packed||journalCapture.packed,completeSnapshot=Boolean(rowCapture.facts.complete&&journalCapture.facts.complete);
 // Never reconstruct corrupt canonical values for preservation. The new owned
 // graph contains original physical roots/rows and compact inventory facts.
 const value={schema:'closed-loop-quarantine/1',reason,row:rowCapture.root,operationalJournal:journalCapture.packed?journalCapture.root:journalCapture.root?.value||null,artifacts,capturedAt,...(packed?{physicalEvidence:{schema:'closed-loop-physical-evidence/1',project:rowCapture,journal:journalCapture},completeSnapshot}:{})};
 const saved={key,value,updatedAt:capturedAt},write=await prepareQuarantineRowPut(tx,saved),projectRemoval=await preparePreservedPhysicalRemoval(tx,rowCapture),journalRemoval=await preparePreservedPhysicalRemoval(tx,journalCapture);
 const entry={key,jobId:id,title:String(title||'Project needing recovery'),reason,capturedAt,artifactCount:artifacts.length,completeSnapshot,...(projectRemoval.retainedOldParts||journalRemoval.retainedOldParts?{retainedPhysicalParts:true}:{})};catalog[key]=entry;
 fault('during-quarantine-write');commitQuarantineRowPut(tx,write,saved);meta.put({key:'quarantineCatalog',value:catalog,updatedAt:capturedAt});commitPhysicalRowRemoval(tx,projectRemoval);commitPhysicalRowRemoval(tx,journalRemoval);
}
async function quarantine(row,reason,{operationalSha256,physicalSources}={}){
 const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite');
 try{const id=String(row?.jobId||''),current=await capturePhysicalStoredEvidence(tx,PROJECTS,id,'project'),journal=await capturePhysicalStoredEvidence(tx,META,operationalKey(id),'value');
  if(!current.root||String(current.root.projectSha256||'')!==String(row?.projectSha256||''))throw storageError('Project evidence changed before preservation. Retry the current state.','STALE_PROJECT_REVISION');
  if(physicalSources){const rowRelation=physicalEvidenceRelation(physicalSources.rowSource,current),journalRelation=physicalEvidenceRelation(physicalSources.journalSource,journal);if(rowRelation===false||journalRelation===false)throw storageError('Project evidence changed before preservation. Retry the current state.','STALE_PROJECT_REVISION');if(rowRelation===null||journalRelation===null){const currentReason=currentPhysicalCorruptionReason(current,journal);if(!currentReason)throw storageError('The current project is no longer invalid. It was not quarantined.','STALE_PROJECT_REVISION');reason=currentReason;}}
  else if(operationalSha256!==undefined){const logical=(await readPhysicalStoredSource(tx,META,operationalKey(id),'value',journal.root)).logical;if(logical?.value?.sha256!==operationalSha256)throw storageError('Response evidence changed before preservation. Retry the current state.','STALE_PROJECT_REVISION');}
  await preservePhysicalQuarantine(tx,current,journal,reason,row?.project?.job?.JOB_TITLE);await complete(tx);return true;
 }catch(error){try{tx.abort();}catch{}throw error;}
}
async function quarantinePhysicalProject(jobId,reason,observed){
 const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite');
 try{const id=String(jobId),current=await capturePhysicalStoredEvidence(tx,PROJECTS,id,'project'),journal=await capturePhysicalStoredEvidence(tx,META,operationalKey(id),'value'),selected=observed?.ownerStore===PROJECTS?current:journal;
  if(!current.root||!observed)throw storageError('Stored physical data changed before it could be preserved. Retry from the current state.','STALE_PROJECT_REVISION');
  const relation=physicalEvidenceRelation(observed,selected);if(relation===false)throw storageError('Stored physical data changed before it could be preserved. Retry from the current state.','STALE_PROJECT_REVISION');if(relation===null){const currentReason=currentPhysicalCorruptionReason(current,journal);if(!currentReason)throw storageError('The current project is no longer invalid. It was not quarantined.','STALE_PROJECT_REVISION');reason=currentReason;}
  await preservePhysicalQuarantine(tx,current,journal,reason,current.root?.project?.job?.JOB_TITLE);await complete(tx);return true;
 }catch(error){try{tx.abort();}catch{}throw error;}
}

async function listQuarantinedProjects(){
  const catalog=await metaGet('quarantineCatalog');if(catalog)return Object.values(catalog);
  // Discover older preserved rows once. Normal startup reads the small catalog.
  const tx=await openTransaction(META,'readwrite'),store=tx.objectStore(META),current=await request(store.get('quarantineCatalog'));if(current){await complete(tx);return Object.values(current.value);}const keys=store.getAllKeys?await request(store.getAllKeys()):(await request(store.getAll())).map(row=>row.key),result={};
  for(const key of keys.filter(key=>String(key).startsWith('quarantine:'))){const source=await readPhysicalStoredSource(tx,META,key,'value'),saved=source.logical,value=hydrateQuarantineValue(source);result[key]={key,jobId:String(value.row?.jobId||''),title:String(value.row?.project?.job?.JOB_TITLE||'Project needing recovery'),reason:String(value.reason||'Integrity validation failed'),capturedAt:value.capturedAt||saved.updatedAt,artifactCount:value.artifacts?.length??null,completeSnapshot:value.completeSnapshot===false?false:Array.isArray(value.artifacts)};}
  store.put({key:'quarantineCatalog',value:result,updatedAt:now()});await complete(tx);return Object.values(result);
}

// Structured-clone encoding is confined to recovery evidence. It is
// never a project import format or agent-facing context. Even values prohibited
// by canonical JSON, including cycles and lone surrogates, remain inspectable.
async function quarantineEvidenceGraph(value){
  const seen=new Map(),nodes=[],files=[];
  async function encode(item){
    if(item===null)return {kind:'null'};
    const type=typeof item;if(type==='string'||type==='boolean')return {kind:type,value:item};
    if(type==='number')return {kind:type,value:Object.is(item,-0)?'-0':String(item)};
    if(type==='undefined')return {kind:type};if(type==='bigint')return {kind:type,value:String(item)};
    if(type!=='object')throw storageError('The preserved row contains a value that cannot be exported losslessly.','QUARANTINE_VALUE_UNSUPPORTED');
    if(seen.has(item))return {ref:seen.get(item)};const id=nodes.length,node={};seen.set(item,id);nodes.push(node);
    const tag=Object.prototype.toString.call(item);
    if(ArrayBuffer.isView(item))Object.assign(node,{kind:tag.slice(8,-1),buffer:await encode(item.buffer),byteOffset:item.byteOffset,byteLength:item.byteLength});
    else if(item instanceof Blob||tag==='[object ArrayBuffer]'){
      const blob=item instanceof Blob?item:new Blob([new Uint8Array(item)]),path=`blobs/${files.length}.bin`,sha256=await hash.sha256Bytes(blob);Object.assign(node,{kind:tag==='[object File]'?'File':item instanceof Blob?'Blob':'ArrayBuffer',path,mediaType:item instanceof Blob?item.type:'application/octet-stream',byteSize:blob.size,sha256});if(node.kind==='File')Object.assign(node,{name:item.name,lastModified:item.lastModified});files.push({path,blob,byteSize:blob.size,sha256});
    }else if(tag==='[object Date]')Object.assign(node,{kind:'Date',value:String(item.getTime())});
    else if(tag==='[object RegExp]')Object.assign(node,{kind:'RegExp',source:item.source,flags:item.flags,lastIndex:item.lastIndex});
    else if(tag==='[object Map]'){node.kind='Map';node.entries=[];for(const [key,value] of item)node.entries.push([await encode(key),await encode(value)]);}
    else if(tag==='[object Set]'){node.kind='Set';node.values=[];for(const value of item)node.values.push(await encode(value));}
    else if(Array.isArray(item)||tag==='[object Object]'){node.kind=Array.isArray(item)?'Array':'Object';if(node.kind==='Array')node.length=item.length;node.entries=[];for(const key of Object.keys(item))node.entries.push([key,await encode(item[key])]);}
    else throw storageError('The preserved row contains an unsupported structured value.','QUARANTINE_VALUE_UNSUPPORTED');
    return {ref:id};
  }
  return {graph:{schema:'closed-loop-quarantine-values/1',root:await encode(value),nodes},files};
}
async function exportProtectedRecoveryEvidence(saved,identity,passphrase){
  if(!passphrase)throw storageError('Enter a backup password to protect the preserved recovery evidence.','BACKUP_PASSPHRASE_REQUIRED');
  const {graph,files}=await quarantineEvidenceGraph(saved),raw=new Blob([JSON.stringify(graph)],{type:'application/json'});files.unshift({path:'raw-project.json',blob:raw,byteSize:raw.size,sha256:await hash.sha256Bytes(raw)});
  const packageManifest={schema:'closed-loop-quarantine-manifest/1',...identity,activationPermitted:false,members:files.map(({blob,...member})=>member)},fileContents=new WeakMap(),members=files.map(file=>{const entry={path:file.path,base64:''};fileContents.set(entry,{property:'base64',encoding:'base64',blob:file.blob});return entry;}),packed=await compressPackage({schema:'closed-loop-quarantine-package/1',packageManifest,artifacts:members},fileContents);
  return encryptedPackage(packed.blob,hash.sha256Value(packageManifest),passphrase);
}
async function exportQuarantinedProject(key,{passphrase=null}={}){
  if(!String(key).startsWith('quarantine:'))throw storageError('Select preserved recovery evidence.','QUARANTINE_NOT_FOUND');const saved=await metaGet(key);if(!saved)throw storageError('The preserved recovery evidence is unavailable.','QUARANTINE_NOT_FOUND');
  return exportProtectedRecoveryEvidence(saved,{quarantineKey:key,completeSnapshot:saved.completeSnapshot===false?false:Array.isArray(saved.artifacts)},passphrase);
}
async function exportHistoryRecoveryEvidence(jobId,{passphrase=null}={}){
  if(!passphrase)throw storageError('Enter a backup password to protect the preserved recovery evidence.','BACKUP_PASSPHRASE_REQUIRED');
  const owner=String(jobId||'');if(!owner)throw storageError('Select a project with retained recovery evidence.','HISTORY_PROJECT_MISSING');
  // Capture original rows and available byte carriers in one read-only
  // transaction. Invalid declared identities remain original claims; only the
  // diagnostic container's member digests describe the actual captured bytes.
  // No project loader, normalization, migration or checkpoint repair runs here.
  const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readonly'),finished=complete(tx);
  let saved;
  try{
    const meta=tx.objectStore(META),prefix=historyKey(owner),[row,operationalJournal,artifacts,keys]=await Promise.all([
      capturePhysicalStoredEvidence(tx,PROJECTS,owner,'project'),capturePhysicalStoredEvidence(tx,META,operationalKey(owner),'value'),
      request(tx.objectStore(ARTIFACTS).index('jobId').getAll(owner)),request(meta.getAllKeys())
    ]);
    const selected=keys.filter(key=>typeof key==='string'&&(key===prefix||key.startsWith(prefix+':'))),metadata=[];
    for(let offset=0;offset<selected.length;offset+=64)metadata.push(...await Promise.all(selected.slice(offset,offset+64).map(key=>request(meta.get(key)))));
    await finished;
    if(!row.root&&!metadata.length)throw storageError('The retained project evidence is unavailable.','HISTORY_PROJECT_MISSING');
    saved={capturedAt:now(),row:row.root||null,operationalJournal:operationalJournal.root||null,artifacts,metadata,...(row.packed||operationalJournal.packed?{physicalEvidence:{schema:'closed-loop-physical-evidence/1',project:row,journal:operationalJournal},completeSnapshot:Boolean(row.facts.complete&&operationalJournal.facts.complete)}:{})};
  }catch(error){try{tx.abort();}catch{}await finished.catch(()=>{});throw error;}
  return exportProtectedRecoveryEvidence(saved,{recoveryKind:'RETAINED_HISTORY',jobId:owner,...(saved.completeSnapshot===false?{completeSnapshot:false}:{})},passphrase);
}
async function exportLegacyMigrationData({passphrase=null}={}){
  if(!passphrase)throw storageError('Enter a backup password to protect the preserved recovery evidence.','BACKUP_PASSPHRASE_REQUIRED');
  if(!globalThis.localStorage)throw storageError('Original legacy migration data is available only in its browser document.','LEGACY_MIGRATION_UNAVAILABLE');
  const entries=[];for(const key of LEGACY_KEYS){let value;try{value=globalThis.localStorage.getItem(key);}catch(error){throw storageError(`Legacy project storage could not be read from ${key}: ${error.message||error}`,'LEGACY_MIGRATION_READ_FAILED');}if(value!==null)entries.push({key,value});}
  if(!entries.length)throw storageError('No original legacy migration data is retained in this browser.','NO_LEGACY_MIGRATION_DATA');
  return exportProtectedRecoveryEvidence({kind:'LEGACY_LOCAL_STORAGE',entries,migrationStatus:await metaGet('migrationStatus')},{recoveryKind:'LEGACY_LOCAL_STORAGE',completeSnapshot:false},passphrase);
}
async function removeQuarantinedProject(key,{idempotencyKey=key}={}){
  if(!String(key).startsWith('quarantine:'))throw storageError('Select preserved recovery evidence.','QUARANTINE_NOT_FOUND');const receiptKey='quarantineDelete:'+hash.sha256Value({idempotencyKey:String(idempotencyKey)}),payloadSha256=hash.sha256Value({key}),tx=await openTransaction([PROJECTS,META],'readwrite'),meta=tx.objectStore(META);
  try{const receipt=(await request(meta.get(receiptKey)))?.value;if(receipt){if(receipt.payloadSha256!==payloadSha256)throw storageError('This deletion was already used for different recovery evidence.','COMMAND_RETRY_CONFLICT');await complete(tx);return receipt;}
    const existing=await request(meta.get(key)),catalog=clone((await request(meta.get('quarantineCatalog')))?.value||{});if(!existing)throw storageError('The preserved recovery evidence is unavailable.','QUARANTINE_NOT_FOUND');delete catalog[key];const result={quarantineKey:key,payloadSha256,removed:true,at:now()};const removal=await preparePreservedPhysicalRemoval(tx,await capturePhysicalStoredEvidence(tx,META,key,'value'));if(removal.retainedOldParts)result.retainedPhysicalParts=true;fault('during-quarantine-delete');commitPhysicalRowRemoval(tx,removal);meta.put({key:'quarantineCatalog',value:catalog,updatedAt:now()});meta.put({key:receiptKey,value:result,updatedAt:now()});await complete(tx);return result;
  }catch(error){try{tx.abort();}catch{}throw error;}
}

async function migrateLegacy(){
  // Legacy localStorage belongs to the document. A storage worker must not
  // overwrite its migration receipt merely because it cannot access that input.
  if(!globalThis.localStorage)return {migrated:0};
  const countTx=await openTransaction(PROJECTS,'readonly'),count=await request(countTx.objectStore(PROJECTS).count());await complete(countTx);if(count)return {migrated:0};
  let legacy;try{legacy=parseLegacy();}catch(error){await metaPut('migrationStatus',{status:'FAILED',message:String(error.message||error),originalPreserved:true,at:now()});throw error;}if(!legacy.length){await metaPut('migrationStatus',{status:'NONE',at:now()});return {migrated:0};}
  const prepared=[];let tx,migrated=0;
  try{
    fault('before-legacy-migration');const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine;if(!core?.migrateState||!engine)throw storageError('Canonical workflow migration logic is unavailable.','LEGACY_MIGRATION_UNAVAILABLE');
    for(const source of legacy){
      if(source.schema===globalThis.closedLoopWorkflowSchema?.PROJECT_SCHEMA)assertProjectCollectionShape(source);
      if(source?.schema===globalThis.closedLoopWorkflowSchema.PROJECT_SCHEMA)try{assertJobPointerIntegrity(source);}catch(error){if(!legacyJobPointerProjection(source,{verifyDerived:false}))throw error;}
      const project=core.migrateState(clone(source));assertProjectCollectionShape(project);engine.ensureShape(project);
      const artifacts=[];for(const original of legacySourceSpans.get(source)||[])await retainProjectSource(project,original,artifacts);
      if(artifacts.reduce((size,row)=>size+row.byteSize,0)>HISTORY_LIMITS.maxRetainedFileBytes)throw storageError('Original project sources exceed the supported recovery capacity. Original browser data is preserved.','HISTORY_LIMIT_REACHED');
      archiveUnacceptedAgentJobDefaults(project);engine.recalculate(project);assertProjectIntegrity(project,{verifyDerived:true});assertPackageArtifactCustody(project,artifacts);
      const id=projectIdentity(project);if(!id)throw storageError('Migrated legacy project has no JOB_ID.','LEGACY_MIGRATION_INVALID_PROJECT');
      prepared.push({project,artifacts,id});
    }
    const inputs=new Map();for(const source of legacy)for(const span of legacySourceSpans.get(source)||[])inputs.set(span.container.storageKey,span.container.value);
    for(const [key,value]of inputs)if(localStorage.getItem(key)!==value)throw storageError('Legacy browser data changed during migration. The original input was not removed.','STALE_PROJECT_REVISION');
    tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite');
    if(await request(tx.objectStore(PROJECTS).count()))throw storageError('A project was created while legacy migration was prepared. Original browser data is preserved.','STALE_PROJECT_REVISION');
    for(const {project,artifacts,id}of prepared){const revision=Number(project.revision||0);for(const artifact of artifacts)await storeArtifactRow(tx,artifact);const logicalRow={jobId:id,revision,picker:projectPickerKey(project,revision),project,projectSha256:projectSha256(project),updatedAt:now()},physicalWrite=await preparePhysicalRowPut(tx,logicalRow,PROJECTS,'project');commitPhysicalRowPut(tx,physicalWrite,logicalRow);migrated++;}
    tx.objectStore(META).put({key:'migrationStatus',value:{status:'COMPLETE',migrated,at:now()},updatedAt:now()});fault('during-legacy-migration');await complete(tx);
    for(const [key,value]of inputs)try{if(localStorage.getItem(key)===value)localStorage.removeItem(key);}catch{}return {migrated};
  }catch(error){try{tx?.abort();}catch{}await metaPut('migrationStatus',{status:'FAILED',message:String(error.message||error),originalPreserved:true,at:now()});throw error;}

}

async function readAllIndexed(){
  try{await migrateLegacy();globalThis.closedLoopLegacyMigrationError=null;}catch(error){globalThis.closedLoopLegacyMigrationError=String(error?.stack||error);console.error('Legacy migration failed without deleting its original payload.',error);}
  const summaries=await listProjectSummaries(),valid=[];for(const summary of summaries){try{const project=await readProject(projectIdentity(summary));if(project)valid.push(project);}catch(error){if(!['PROJECT_HASH_MISMATCH','PROJECT_REVISION_MISMATCH','PROJECT_INTEGRITY_FAILED','OPERATIONAL_STATE_INTEGRITY_FAILED'].includes(error.code))throw error;}}return valid;
}
async function listProjectSummaries(){
  const tx=await openTransaction(PROJECTS,'readonly'),finished=complete(tx),summaries=[];
  const cursorRead=storageEvent('CURSOR',(resolve,reject,active)=>{const req=tx.objectStore(PROJECTS).index('picker').openKeyCursor();req.onerror=()=>{if(active())reject(req.error||new Error('Project picker could not be read.'));};req.onsuccess=()=>{if(!active())return;const cursor=req.result;if(!cursor){resolve();return;}summaries.push(projectPickerSummary(cursor.key));cursor.continue();};},tx);
  await Promise.all([cursorRead,finished]);return summaries;
}
async function readProjectMetadata(jobId,sourceProof=null,physicalCapture=null){
  // A public/cold reader cannot consume this proof. Release it before loading
  // another full physical graph; the later clear still covers interleaving writes.
  if(!sourceProof||sourceProof.readPurpose===STARTUP_RECOVERY_CAPTURE)recentOperationalCommitRead=null;
  const tx=await openTransaction([PROJECTS,META],'readonly');let sources;
  try{sources=await readPhysicalProjectSources(tx,jobId);await complete(tx);}catch(error){try{tx.abort();}catch{}if(error?.code!=='PHYSICAL_RECORD_INVALID')throw error;await quarantinePhysicalProject(jobId,'PHYSICAL_RECORD_INVALID: '+error.message,error.physicalCapture);throw storageError('Stored physical project data failed integrity verification. Available original evidence was preserved in quarantine.','PROJECT_INTEGRITY_FAILED');}
  const {row,journal,storage}=sources;if(physicalCapture)physicalCapture.storage=storage;
  const committedRead=sourceProof&&sourceProof.readPurpose!==STARTUP_RECOVERY_CAPTURE?takeOperationalCommitRead(row,journal,sourceProof.readPurpose,storage):null;if(!sourceProof||sourceProof.readPurpose===STARTUP_RECOVERY_CAPTURE)recentOperationalCommitRead=null;
  if(!row)return null;
  if(sourceProof&&committedRead){
    Object.assign(sourceProof,{row:committedRead.row,journal:committedRead.journal,current:true,storage:committedRead.storage,retainedRoot:committedRead.retainedRoot});
    // Carry computation, never validation success, across this one consumed
    // exact-source proof. Public/cold reads and all checkpoint owners remain.
    if(sourceProof.readPurpose===CHECKPOINT_PAIR_READ&&checkpointPairMatches(committedRead.checkpointDigestPair,committedRead.project))sourceProof.checkpointDigestPair=committedRead.checkpointDigestPair;
    recoveryProjectionBounds.set(committedRead.project,journal?.updatedAt||row.updatedAt);return committedRead.project;
  }
  if(sourceProof){sourceProof.row=copyVerifiedTree(row);sourceProof.journal=copyVerifiedTree(journal);sourceProof.storage=storage;sourceProof.current=true;}
  let computed;try{computed=await hash.sha256Chunks(hash.canonicalChunks(canonicalProject(row.project)));}catch(error){await quarantine(row,'PROJECT_ENCODING_INVALID: '+error.message,{physicalSources:sources});throw storageError('The stored project contains invalid canonical data. Its original state was preserved in quarantine.','PROJECT_INTEGRITY_FAILED');}
  if(computed!==row.projectSha256){await quarantine(row,'PROJECT_HASH_MISMATCH',{physicalSources:sources});throw storageError('Project hash mismatch. The original row was preserved in quarantine.','PROJECT_HASH_MISMATCH');}
  if(Number(row.revision)!==Number(row.project?.revision)){await quarantine(row,'PROJECT_REVISION_MISMATCH',{physicalSources:sources});throw storageError('Stored revision does not match the canonical project. The original row was preserved in quarantine.','PROJECT_REVISION_MISMATCH');}
  try{assertProjectIntegrity(row.project,{verifyDerived:false});}catch(error){if(!legacyJobPointerProjection(row.project,{verifyDerived:false})){await quarantine(row,'PROJECT_CANONICAL_INTEGRITY_FAILED: '+error.message,{physicalSources:sources});throw storageError('The stored project failed canonical integrity validation. Its original state was preserved in quarantine.','PROJECT_INTEGRITY_FAILED');}}
  let active;try{active=applyOperationalJournal(row,journal?.value,sourceProof?.readPurpose===CHECKPOINT_PAIR_READ?sourceProof:null);if(active!==row){try{assertProjectIntegrity(active.project,{verifyDerived:false});}catch(error){if(!legacyJobPointerProjection(active.project,{verifyDerived:false}))throw error;}}}catch(error){if(!journal?.value)throw error;await quarantine(row,'OPERATIONAL_STATE_INTEGRITY_FAILED: '+error.message,{operationalSha256:journal.value.sha256,physicalSources:sources});throw storageError('Saved response operations failed integrity verification. Their exact state was preserved in quarantine.','OPERATIONAL_STATE_INTEGRITY_FAILED');}const verifiedSourceRow=sourceProof?.row||copyVerifiedTree(row);active.project.revision=Number(active.revision||0);active.project.projectSha256=active.projectSha256;recoveryProjectionBounds.set(active.project,active===row?row.updatedAt:journal.updatedAt);
  const repaired=legacyJobPointerProjection(active.project,{verifyDerived:false});
  const projectionActivation=projectionActivationRequired(active.project),varianceActivation=legacyExpectedVarianceSources(active.project).length>0;
  if(repaired||unacceptedAgentJobDefaults(active.project).length||projectionActivation||varianceActivation){
    // Bind the migration to this complete cold-verified source. Its candidate
    // and History reuse only private unchanged-value proofs; the transaction
    // still rereads both canonical row and operational journal before commit.
    const verifiedRead={row:verifiedSourceRow,storage,journal:sourceProof?.journal||copyVerifiedTree(journal),...verifiedProjectIntegrity(active.project,active.projectSha256)};
    if(sourceProof){sourceProof.current=false;delete sourceProof.checkpointDigestPair;}
    const migrated=await migrateJobPointerProjection(active.project,{...(repaired||{project:clone(active.project),repairs:[]}),projectionActivation,varianceActivation},verifiedRead);return physicalCapture?readProjectMetadata(jobId,null,physicalCapture):migrated;
  }if(sourceProof?.checkpointDigestPair&&!checkpointPairMatches(sourceProof.checkpointDigestPair,active.project))delete sourceProof.checkpointDigestPair;return active.project;
}
function unacceptedAgentJobDefaults(project){
  const schema=globalThis.closedLoopWorkflowSchema,stage=project?.stages?.[1],data=project?.projectData;
  if(project?.schema!==schema.PROJECT_SCHEMA||project?.job?.CONTRACT_PROFILE_ID!==schema.CONTRACT_PROFILE_ID||!stage||!data)return [];
  const fields=Object.entries(schema.JOB_FIELDS).filter(([,definition])=>definition.producer===schema.PRODUCER.AGENT&&definition.requiredAtStage===1).map(([name])=>name);
  // Recognize the previous constructor's complete signature only. An accepted
  // empty string, a nonempty value or ambiguous retained authority is not a
  // fabricated default and must never be erased by a compatibility repair.
  if(!fields.length||!fields.every(name=>Object.hasOwn(project.job,name)&&project.job[name]===''&&!Object.hasOwn(stage.agentData||{},name)&&!Object.hasOwn(stage.acceptedData||{},name)))return [];
  if(stage.status==='COMPLETE'||['acceptedDataChangeIds','acceptedResponseIds'].some(key=>(stage[key]||[]).length))return [];
  if((data.acceptedChanges||[]).some(change=>Number(change.stage)===1)||(data.stageConfirmations||[]).some(row=>Number(row.stage)===1)||(data.responseProposals||[]).some(row=>Number(row.stage)===1&&row.status==='ACCEPTED')||(data.history||[]).some(row=>Number(row.stage)===1&&row.type==='CANONICAL_RESPONSE_COMMITTED'))return [];
  return fields;
}
function archiveUnacceptedAgentJobDefaults(project,{sourceProjectSha256=projectSha256(project)}={}){
  const fields=unacceptedAgentJobDefaults(project);if(!fields.length)return false;
  const payload={job:Object.fromEntries(fields.map(name=>[name,project.job[name]]))};
  archiveMigrationPayload(project,{kind:'LEGACY_UNACCEPTED_AGENT_JOB_DEFAULTS',schema:project.schema,sourceProjectSha256,payload});
  for(const name of fields)delete project.job[name];
  globalThis.closedLoopWorkflowEngine.addHistory(project,'UNACCEPTED_AGENT_JOB_DEFAULTS_ARCHIVED',{sourceProjectSha256,fields});
  return true;
}
function legacyJobPointerProjection(project,{verifyDerived=true,verifyProjection=true}={}){
  const engine=globalThis.closedLoopWorkflowEngine,changed=new Map(engine.jobPointerProjectionRepairs(project).map(repair=>[repair.field,repair]));
  // Earlier human-project/30 seed mapping wrote placeholder prose into nullable
  // identity fields. Recognize only that retained original source and its exact
  // mapped values; arbitrary non-null current-schema identities still reject.
  const legacySource=project.isRetainedTestProject===true?(project.projectData?.migrationArchives||[]).find(row=>row.kind==='ORIGINAL_IMPORT_PAYLOAD'&&row.operational===false&&row.payload?.schema==='human-project/30'&&!row.payload.stages&&row.payload.jobId===projectIdentity(project))?.payload:null;
  if(legacySource){const oldValues={CURRENT_SOURCE_SET_VERSION:legacySource.currentVersions?.sources||'NOT APPLICABLE',CURRENT_REQUIREMENTS_VERSION:legacySource.currentVersions?.requirements||'NOT APPLICABLE',CURRENT_TEST_SUITE_VERSION:legacySource.currentVersions?.tests||'NOT APPLICABLE',CURRENT_INSTRUCTION_VERSION:legacySource.currentVersions?.instruction||'NOT APPLICABLE',CURRENT_BASELINE_ID:legacySource.baseline?.baselineId||'NONE',CURRENT_PRODUCT_ID:legacySource.product?.productId||'NONE'};for(const [field,value]of Object.entries(oldValues))if(['NONE','NOT APPLICABLE'].includes(value)&&project.job?.[field]===value)changed.set(field,{field,from:value,to:null});}
  if(!changed.size)return null;
  const corrected=clone(project);for(const {field,to}of changed.values())corrected.job[field]=to;
  for(const {field,to}of engine.jobPointerProjectionRepairs(corrected)){changed.set(field,{field,from:project.job[field]??null,to});corrected.job[field]=to;}
  const repairs=[...changed.values()];
  const bound=recoveryProjectionBounds.get(project);if(bound)recoveryProjectionBounds.set(corrected,bound);
  let checked;try{checked=validateProjectIntegrity(corrected,{verifyDerived,verifyProjection});}catch{return null;}
  let requiresProjectionActivation=false;
  if(!checked.valid&&(!verifyDerived||!historicalProjectionConsistent(corrected,{code:'PROJECT_INTEGRITY_FAILED',issues:checked.issues}))){
    // Authenticate the registered historical output BEFORE pointer repair.
    // The existing atomic activation, never a receipt restamp, owns new output.
    // Reject malformed canonical data before walking its historical proof.
    let canonical,legacyProjection;
    try{
      canonical=validateProjectIntegrity(corrected,{verifyDerived,verifyProjection:false});
      if(!canonical.valid)return null;
      legacyProjection=verifyProjection&&projectionActivationRequired(project)?engine.validateLegacyApplicationProjection(project):null;
    }catch{return null;}
    const observationsMatch=legacyProjection?.valid&&Object.values(project.stages||{}).every(state=>!Object.hasOwn(state?.gate||{},'checkedAt')||state.gate.checkedAt===project.projectData.applicationProjection.observedAt);
    // Only projection proof is deferred: raw legacy proof was authenticated and
    // all corrected canonical structure/pointer checks passed above.
    if(!observationsMatch)return null;
    requiresProjectionActivation=true;
  }
  return {project:corrected,repairs,requiresProjectionActivation};
}
async function migrateJobPointerProjection(prior,{project:next,repairs,projectionActivation=false,requiresProjectionActivation=false,varianceActivation=false,historyLabel=null},verifiedRead){
  if(requiresProjectionActivation&&!projectionActivation)throw storageError('Authenticated historical pointer repair requires explicit current projection activation.','PROJECT_INTEGRITY_FAILED');
  const engine=globalThis.closedLoopWorkflowEngine,archivedDefaults=archiveUnacceptedAgentJobDefaults(next,{sourceProjectSha256:prior.projectSha256});delete next.projectSha256;next.revision=Number(prior.revision)+1;
  await observeProjectArtifactCustody(next);engine.reconcileReservationRevisions(next);if(repairs.length)engine.addHistory(next,'JOB_POINTER_PROJECTION_REPAIRED',{sourceProjectSha256:prior.projectSha256,repairs});if(projectionActivation)recordProjectionActivation(next,prior.projectSha256);if(varianceActivation)activateLegacyExpectedVarianceContracts(next,prior.projectSha256);engine.recalculate(next);assertProjectIntegrity(next,{prior});
  const {projectSha256:digest,workSha256}=historyProjectDigests(next),integrity=verifiedProjectIntegrity(next,digest),preparedProof={read:verifiedRead,integrity,digest};
  const preparedHistory=await prepareHistoryCommit(next,prior,{label:historyLabel||(repairs.length?'Application identities repaired':varianceActivation?'Expected variance contracts established':projectionActivation?'Current projection provenance established':'Unaccepted Job defaults archived'),preserveActiveView:true,verifiedRead,verifiedDigests:[[next,digest,workSha256]],verifiedIntegrity:[verifiedRead,integrity]});
  fault('before-project-transaction');const tx=await openTransaction([PROJECTS,META],'readwrite');
  try{const saved=await writeProjectRow(next,tx,{expectedProjectRevision:prior.revision,expectedStateSha256:prior.projectSha256,preparedHistory,incrementRevision:true,[VERIFIED_CANONICAL_WRITE]:preparedProof});fault('before-transaction-commit');await complete(tx);notifyProjectChange(saved);return saved;}catch(error){try{tx.abort();}catch{}throw error;}
}
const PHYSICAL_SOURCE_CAPTURE=Symbol('private physical source capture');
async function readProject(jobId,{refreshProjection=false,[PHYSICAL_SOURCE_CAPTURE]:physicalCapture=null}={}){if(refreshProjection){const verifiedRead=await readProjectForTransaction(jobId,STARTUP_REFRESH_READ);return verifiedRead?refreshStoredProjectProjection(verifiedRead.project,verifiedRead.canonicalReadIntegrity):null;}const project=await readProjectMetadata(jobId,null,physicalCapture);if(project)await observeProjectArtifactCustody(project);return project;}
async function readProjectForTransaction(jobId,readPurpose=null){
 const sourceProof={readPurpose};let project=await readProjectMetadata(jobId,sourceProof);if(!project)return null;
 // A named migration has committed a different source. Verify its new read;
 // never reuse the pre-migration row or invent an unchanged-source receipt.
 if(!sourceProof.current)project=await readProjectMetadata(jobId,sourceProof);
 if(!project)return null;
 const canonicalReadIntegrity=readPurpose===STARTUP_REFRESH_READ&&sourceProof.current?verifiedProjectIntegrity(project,project.projectSha256):null;
 // Custody/context observers may retain this project. Bind the verified source
 // before invoking them; side-channel hydration cannot change canonical data.
 const integrity=verifiedProjectIntegrity(project,project.projectSha256);
 await observeProjectArtifactCustody(project);
 if(sourceProof.checkpointDigestPair&&!checkpointPairMatches(sourceProof.checkpointDigestPair,project))delete sourceProof.checkpointDigestPair;
 if(readPurpose!==STARTUP_REFRESH_READ&&!unchangedVerifiedProject(integrity,project,integrity.digest))throw storageError('Project or response data changed after verification. The newer state is preserved.','STALE_PROJECT_REVISION');
 return {...sourceProof,...integrity,canonicalReadIntegrity};
}
function cachedReadinessProjection(project){
 const job=Object.fromEntries(['CURRENT_STAGE','CURRENT_STATE','CURRENT_BLOCKERS','NEXT_REQUIRED_ACTION','JOB_RECORD_STATUS','STATUS_EVIDENCE',...Object.keys(globalThis.closedLoopWorkflowSchema.JOB_POINTER_TARGETS)].map(key=>[key,project.job?.[key]]));
 return {job,canonicalRecords:globalThis.closedLoopWorkflowEngine.applicationProjectionCanonicalOutput(project),stages:Object.fromEntries(Object.entries(project.stages||{}).map(([number,stage])=>[number,{status:stage.status,derivedData:stage.derivedData||{},decision:stage.decision,decisionEvidence:stage.decisionEvidence,gate:Object.fromEntries(Object.entries(stage.gate||{}).filter(([key])=>key!=='checkedAt'))}])),projection:project.projectData.applicationProjection?{derivationId:project.projectData.applicationProjection.receipt?.derivationId,registryEntrySha256:project.projectData.applicationProjection.receipt?.registryEntrySha256,inputObservations:project.projectData.applicationProjection.inputObservations}:null};
}
function projectionActivationRequired(project){
 const schema=globalThis.closedLoopWorkflowSchema,id=project.projectData.applicationProjection?.receipt?.derivationId;
 return !Object.hasOwn(project.projectData||{},'applicationProjection')||[schema.LEGACY_PROJECT_PROJECTION_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION2_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION3_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION4_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION5_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION6_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION7_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION8_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION9_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION10_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION11_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION12_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION13_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION14_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION15_DERIVATION_CONTRACT.id,schema.LEGACY_PROJECT_PROJECTION16_DERIVATION_CONTRACT.id].includes(id);
}
function archiveLegacySourceApplicability(project,sourceProjectSha256){
 const field='SOURCE_APPLICABILITY_DETERMINATION',stage=project.stages?.[2],values=[];
 for(const carrier of ['agentData','acceptedData'])if(Object.hasOwn(stage?.[carrier]||{},field))values.push({sourcePointer:'/stages/2/'+carrier+'/'+field,value:clone(stage[carrier][field])});
 if(!values.length)return false;
 archiveMigrationPayload(project,{kind:'LEGACY_SOURCE_APPLICABILITY_AGENT_SUMMARY',schema:'closed-loop-source-applicability-activation/1',sourceProjectSha256,previousDerivationId:project.projectData.applicationProjection?.receipt?.derivationId||null,derivationId:globalThis.closedLoopWorkflowSchema.PROJECT_PROJECTION_DERIVATION_CONTRACT.id,values});
 for(const carrier of ['agentData','acceptedData'])if(stage?.[carrier])delete stage[carrier][field];
 return true;
}
function recordProjectionActivation(project,sourceProjectSha256){
 archiveLegacySourceApplicability(project,sourceProjectSha256);
 globalThis.closedLoopWorkflowEngine.addHistory(project,'APPLICATION_PROJECTION_DERIVATION_ACTIVATED',{sourceProjectSha256,previousDerivationId:project.projectData.applicationProjection?.receipt?.derivationId||null,derivationId:globalThis.closedLoopWorkflowSchema.PROJECT_PROJECTION_DERIVATION_CONTRACT.id,historicalProvenanceClaimed:false});
}
function legacyExpectedVarianceSources(project){return globalThis.closedLoopWorkflowEngine.legacyExpectedVarianceSources(project);}
function activateLegacyExpectedVarianceContracts(project,sourceProjectSha256){
 const engine=globalThis.closedLoopWorkflowEngine,sources=legacyExpectedVarianceSources(project);if(!sources.length)return false;
 const prepared=sources.map(source=>({source,id:engine.allocateId(project,'expectedVarianceContracts',{commandId:'ACTIVATE_EXPECTED_VARIANCE_CONTRACTS:'+sourceProjectSha256,targetSlot:engine.recordId(source.test,'tests'),parentId:source.rawResponseId,payload:{sourceProjectSha256,testId:engine.recordId(source.test,'tests'),sourceValue:source.sourceValue,sourceAcceptedChangeId:source.sourceAcceptedChangeId}})}));
 const event=engine.addHistory(project,'EXPECTED_VARIANCE_CONTRACTS_ACTIVATED',{sourceProjectSha256,records:prepared.map(({source,id})=>({testId:engine.recordId(source.test,'tests'),contractId:id,sourceAcceptedChangeId:source.sourceAcceptedChangeId})),historicalFreezeClaimed:false});
 for(const {source,id}of prepared){
  const testId=engine.recordId(source.test,'tests'),fields={VARIANCE_CONTRACT_ID:id},record={id,stage:6,createdAt:event.deviceTimestamp,active:true,scope:clone(source.test.scope),fields,...fields,relationships:{TEST_ID:testId},evidenceRefs:clone(source.test.evidenceRefs||[]),source:'APPLICATION_VARIANCE_MATERIALIZATION',sourceProposalId:source.sourceProposalId,rawResponseId:source.rawResponseId,temporaryKey:null,targetId:null,updateTargetId:null};
  engine.finalizeExpectedVarianceContract(record,source.test,{form:'EMBEDDED',sourceValue:source.sourceValue,sourcePointer:source.sourcePointer,validationId:source.validationId,frozenAt:event.deviceTimestamp,activation:{schema:'closed-loop-expected-variance-activation/1',eventId:event.eventId,sourceProjectSha256,sourceAcceptedChangeId:source.sourceAcceptedChangeId,historicalFreezeClaimed:false}});
  engine.refreshRecordHashes(record,'expectedVarianceContracts');project.projectData.expectedVarianceContracts.push(record);
 }
 return true;
}
function recalculateChangedProjection(project,{sourceProjectSha256=projectSha256(project)}={}){
 const projectionActivation=projectionActivationRequired(project);
 const next=legacyJobPointerProjection(project,{verifyDerived:false,verifyProjection:!projectionActivation})?.project||clone(project),archivedDefaults=archiveUnacceptedAgentJobDefaults(next,{sourceProjectSha256});if(projectionActivation)recordProjectionActivation(next,sourceProjectSha256);const varianceActivation=activateLegacyExpectedVarianceContracts(next,sourceProjectSha256);globalThis.closedLoopWorkflowEngine.recalculate(next);
 // Preserve the exact saved audit timestamps when authority is unchanged.
 // A changed current determination receives the fully recalculated projection.
 return !projectionActivation&&!varianceActivation&&!archivedDefaults&&equivalent(cachedReadinessProjection(project),cachedReadinessProjection(next))?project:next;
}
async function refreshProjectProjection(jobId,{expectedProjectRevision,expectedStateSha256}={}){
 const project=await readProject(jobId);if(!project)throw storageError('The project is unavailable.','PROJECT_NOT_FOUND');
 if(Number(project.revision)!==Number(expectedProjectRevision)||project.projectSha256!==expectedStateSha256)throw storageError('The project changed before its readiness could be refreshed. Reload the current project.','STALE_PROJECT_REVISION');
 return refreshStoredProjectProjection(project);
}
async function refreshStoredProjectProjection(project,canonicalReadIntegrity=null){
 // Initial activation can inspect current readiness on the same freshly
 // verified cold read. A changed projection still commits against that exact
 // revision and digest; ordinary reads and explicit refresh checks are intact.
 const expectedProjectRevision=Number(project.revision),expectedStateSha256=project.projectSha256;
 // This private receipt covers the static checks on the exact metadata read.
 // Custody can change across the await; readiness always recalculates now.
 const currentDefinition=project.projectData?.applicationProjection?.receipt?.derivationId===globalThis.closedLoopWorkflowSchema.PROJECT_PROJECTION_DERIVATION_CONTRACT.id;
 const issues=currentDefinition&&unchangedVerifiedProject(canonicalReadIntegrity,project,expectedStateSha256)?derivedProjectIntegrityIssues(project):null;
 const checked=issues?{valid:issues.length===0,issues}:validateProjectIntegrity(project);
 // Preserve startup's full-validation/error owner while binding every value,
 // including draft fields that structural/projection checks do not consume.
 const assertCanonicalRead=()=>{if(canonicalReadIntegrity&&!unchangedVerifiedProject(canonicalReadIntegrity,project,expectedStateSha256))throw Object.assign(storageError('Saved readiness does not agree with its canonical records.','PROJECT_INTEGRITY_FAILED'),{issues:['Project changed during custody observation.']});};
 if(checked.valid){assertCanonicalRead();return project;}
 const error=Object.assign(storageError('Saved readiness does not agree with its canonical records.','PROJECT_INTEGRITY_FAILED'),{issues:checked.issues});
 if(!historicalProjectionConsistent(project,error))throw error;
 assertCanonicalRead();
 // Keep the exact prior checkpoint. Only a new normal revision receives the
 // current-clock projection; expired readiness remains blocked.
 const next=clone(project);globalThis.closedLoopWorkflowEngine.recalculate(next);
 // Automatic readiness changes share the migration transaction owner. Its
 // private view preservation cannot be transported as a public worker option.
 const verifiedRead=await readProjectForTransaction(projectIdentity(project));
 if(!verifiedRead||Number(verifiedRead.project.revision)!==expectedProjectRevision||verifiedRead.digest!==expectedStateSha256)throw storageError('Project changed before its readiness could be refreshed. Reload the current project.','STALE_PROJECT_REVISION');
 return migrateJobPointerProjection(verifiedRead.project,{project:next,repairs:[],historyLabel:'Readiness refreshed'},verifiedRead);
}
function readAll(storage){return storage?readAllLegacy(storage):readAllIndexed();}

// Full immutable checkpoints share the existing IndexedDB transaction owner.
// Artifact occurrences and History share these content-addressed bodies. Agent
// exports still resolve only their authorized canonical artifact identities. Reaching a bound fails before the dependent canonical commit.
const HISTORY_SCHEMA='closed-loop-recovery/1';
const HISTORY_PROJECT_REFERENCE='closed-loop-recovery-project-reference/1';
const HISTORY_PROJECT_PARTS='closed-loop-recovery-project-parts/1';
const HISTORY_SOURCE_REFERENCE=globalThis.closedLoopWorkflowSchema.RECOVERY_SOURCE_REFERENCE_CONTRACT.schema;
const HISTORY_ACTIVATION_FIELDS=globalThis.closedLoopWorkflowSchema.RECOVERY_SOURCE_REFERENCE_CONTRACT.activationFields;
const HISTORY_LIMITS=Object.freeze({maxCheckpoints:2048,maxCompressedProjectBytes:512*1024*1024,maxRetainedFileBytes:1024*1024*1024});
const historyKey=jobId=>'recovery:'+String(jobId);
const snapshotKey=(jobId,id)=>historyKey(jobId)+':snapshot:'+id;
const historyFileKey=(jobId,sha256)=>historyKey(jobId)+':bytes:'+sha256;
const historyView=project=>({activeView:project.activeView||'Workflow',activeStage:Number(project.activeStage||1),scrollX:0,scrollY:0,drafts:{}});
const historyDescriptor=row=>{const lineage=clone(row.lineage||{});if(lineage.stagedResponse&&lineage.stagedResponse.blob===undefined)delete lineage.stagedResponse.blob;return {artifactId:String(row.artifactId),jobId:String(row.jobId),filename:String(row.filename),mediaType:String(row.mediaType||'application/octet-stream'),byteSize:Number(row.byteSize),sha256:String(row.sha256),lineage,createdAt:row.createdAt||null};};
function historyLabel(project,prior){
  if(!prior)return 'Starting project';
  const latest=project.projectData?.history?.at(-1),changed=latest?.eventId!==prior.projectData?.history?.at(-1)?.eventId;
  if(changed&&latest?.type==='CANONICAL_RESPONSE_COMMITTED')return `Accepted stage ${Number(latest.stage||project.activeStage)}`;
  if(changed&&String(latest?.type||'').includes('INVALIDAT'))return 'Corrected project';
  if(project.job?.CURRENT_INPUT_VERSION!==prior.job?.CURRENT_INPUT_VERSION)return 'Saved project information';
  return `Saved stage ${Number(project.activeStage||1)}`;
}
function reconcileRecoveryTransfers(state,project){
  const engine=globalThis.closedLoopWorkflowEngine,latest=new Map();state.transfers=state.transfers||{};
  for(const row of project.projectData?.deliveryAttempts||[]){const command=String(engine.recordValue(row,'COMMAND_ID')||'');if(command)latest.set(command,row);}
  for(const [command,row] of latest){
    const transfer={commandId:command,deliveryId:engine.recordValue(row,'DELIVERY_ID'),intentId:engine.recordValue(row,'HUMAN_DELIVERY_AUTHORIZATION_ID'),intentSha256:engine.recordValue(row,'DELIVERY_INTENT_SHA256'),artifactIds:engine.recordValue(row,'ARTIFACT_IDS'),byteHashes:engine.recordValue(row,'BYTE_HASHES'),destination:engine.recordValue(row,'INTENDED_RECIPIENT_OR_DESTINATION'),channel:engine.recordValue(row,'CHANNEL'),result:engine.recordValue(row,'RESULT')},prior=state.transfers[command];
    if(prior){const identity=({result,...value})=>value;if(hash.sha256Value(identity(prior))!==hash.sha256Value(identity(transfer)))throw storageError('An external operation identity conflicts with retained History.','EXTERNAL_OPERATION_CONFLICT');if(['SUCCEEDED','FAILED'].includes(prior.result))continue;}
    state.transfers[command]=transfer;
  }
}
function sourceReferenceProject(project,reference){
  const result={...project};for(const key of HISTORY_ACTIVATION_FIELDS)delete result[key];
  for(const [key,value]of Object.entries(reference.activation))Object.defineProperty(result,key,{value:clone(value),enumerable:true,writable:true,configurable:true});
  return result;
}
async function readHistorySourceFile(state,source,readFile=sha=>metaGet(historyFileKey(state.jobId,sha)),readSnapshot=id=>metaGet(snapshotKey(state.jobId,id)),verifiedByteDigests=null,decodedSources=null){
  const reference=state.sourceArchiveReferences?.[source.sha256];let file;
  // Exact retained raw bytes control when present. Their indexed metadata and
  // actual byte identity must verify; a failed raw read never falls through to
  // a reference. The original reference remains preserved as historical data.
  if(Object.hasOwn(state.files||{},source.sha256)){
    if(state.files[source.sha256]?.byteSize!==source.byteSize)throw storageError('Original source recovery bytes are missing or corrupt.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    file=await readFile(source.sha256);
  }else if(reference){
    if(source.kind===PACKAGE_EXTENSION_KIND)throw storageError('Package extension bytes cannot be reconstructed from a project snapshot.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    const checkedSnapshot=async id=>{const expected=state.entries.find(entry=>entry.id===id),stored=await readSnapshot(id);if(!expected||!stored?.blob)throw storageError('Original source depends on a missing saved project.','SOURCE_ARCHIVE_INTEGRITY_FAILED');return {...expected,blob:stored.blob};};
    const entry=await checkedSnapshot(reference.checkpointId);
    if(entry.sha256!==reference.snapshotSha256)throw storageError('Original source identifies a different saved project.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    const cached=decodedSources?.get(reference.checkpointId);let body=cached?.blob===entry.blob?cached.body:null;
    if(!body){body=await readCheckpointBody(state.jobId,entry,checkedSnapshot,new Map(),false,readFile,new Map(),verifiedByteDigests);if(decodedSources){decodedSources.clear();decodedSources.set(reference.checkpointId,{blob:entry.blob,body});}}
    const project=sourceReferenceProject(body.project,reference),blob=new Blob([...hash.canonicalChunks(project)],{type:source.mediaType});
    file={sha256:source.sha256,blob};
  }else file=await readFile(source.sha256);
  if(!(file?.blob instanceof Blob)||file.blob.size!==source.byteSize||await historyBlobSha256(file.blob,verifiedByteDigests)!==source.sha256)throw storageError('Original source recovery bytes are missing or corrupt.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
  return file;
}

const PACKAGE_EXTENSION_KIND='ORIGINAL_PACKAGE_EXTENSION_SOURCE';
function packageExtensionIdentity(jobId,source){
 const keys=['kind','schema','retentionRole','sha256','sourceSha256','containerPayloadSha256','bindingAnchorSha256','sourceLocation','parser','parsedPayloadSha256','disclosureClassification'];
 return 'PACKAGE-EXTENSION-SOURCE-'+hash.sha256Value({jobId:String(jobId),...Object.fromEntries(keys.map(key=>[key,source[key]]))});
}
function validatePackageExtensionGroups(state){
 const groups=new Map(),contract=globalThis.closedLoopWorkflowSchema.ORIGINAL_PACKAGE_EXTENSION_SOURCE_CONTRACT;
 const fail=()=>{throw storageError('Package extension source identities or occurrence bindings are invalid.','SOURCE_ARCHIVE_INTEGRITY_FAILED');};
 for(const source of Object.values(state.sourceArchives||{}))if(source?.kind===PACKAGE_EXTENSION_KIND){
  const validationInput=clone(source),validationIdentity=hash.sha256Value(validationInput);
  const validation=globalThis.closedLoopWorkflowSchema.validatePackageExtensionSourceDescriptor(validationInput);
  if(!validation.valid||hash.sha256Value(validationInput)!==validationIdentity||source.artifactId!==packageExtensionIdentity(state.jobId,source)||source.filename!==source.artifactId+'.json-member.utf8'||state.files[source.sha256]?.byteSize!==source.byteSize)fail();
  const groupId=source.sourceSha256+':'+source.containerPayloadSha256;
  if(!groups.has(groupId))groups.set(groupId,[]);groups.get(groupId).push(source);
 }
 for(const sources of groups.values()){
  const anchors=sources.filter(source=>source.retentionRole==='PACKAGE_BINDING_ANCHOR');if(anchors.length!==1)fail();const anchor=anchors[0],a=anchor.sourceLocation;
  if(a.jsonPointer!=='/packageManifest'||a.rootMemberOccurrence!==a.rootMemberOccurrenceCount-1||anchor.bindingAnchorSha256!==anchor.sha256)fail();
  const locations=new Map();
  for(const source of sources){
   const loc=source.sourceLocation,key=loc.jsonPointer.slice(1).replace(/~1/g,'/').replace(/~0/g,'~');
   if('/'+key.replace(/~/g,'~0').replace(/\//g,'~1')!==loc.jsonPointer||source.bindingAnchorSha256!==anchor.sha256)fail();
   if(source.retentionRole==='ROOT_EXTENSION'){if(contract.rootKeys.includes(key))fail();}
   else if(key!=='packageManifest'||loc.rootMemberOccurrenceCount!==a.rootMemberOccurrenceCount||(source.retentionRole==='SUPERSEDED_EXTENSION'&&loc.rootMemberOccurrence>=a.rootMemberOccurrence))fail();
   if(!locations.has(key))locations.set(key,[]);locations.get(key).push(source);
  }
  for(const [key,rows]of locations){
   const count=rows[0].sourceLocation.rootMemberOccurrenceCount,ordinals=rows.map(row=>row.sourceLocation.rootMemberOccurrence);
   if(rows.some(row=>row.sourceLocation.rootMemberOccurrenceCount!==count)||new Set(ordinals).size!==rows.length)fail();
   if(key!=='packageManifest'&&(rows.length!==count||ordinals.some(ordinal=>ordinal>=count)))fail();
  }
 }
 return groups;
}
async function verifyPackageExtensionArchives(state,readFile,verifiedByteDigests=null,selectedGroup=null){
 for(const [groupId,sources]of validatePackageExtensionGroups(state)){
  if(selectedGroup&&groupId!==selectedGroup)continue;
  for(const source of sources){
   const file=await readHistorySourceFile(state,source,readFile,undefined,verifiedByteDigests);
   let parsed;
   try{parsed=await readPackageJson(new Blob(['{',file.blob,'}']),{compressed:false,spoolArtifacts:false,capturePackageExtensions:true});}
   catch(error){if(error?.code==='IO_READ_TIMEOUT')throw error;throw storageError('Package extension bytes are not one original UTF-8 JSON member.','SOURCE_ARCHIVE_INTEGRITY_FAILED');}
   const keys=Object.keys(parsed.payload),key=keys[0],pointer='/'+String(key).replace(/~/g,'~0').replace(/\//g,'~1');
   if(keys.length!==1||parsed.rootMemberCounts.get(key)!==1||pointer!==source.sourceLocation.jsonPointer||hash.sha256Value(parsed.payload)!==source.parsedPayloadSha256)throw storageError('Package extension bytes differ from the retained member binding.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
   const value=parsed.payload[key];
   // The effective manifest was reconciled at import. Historical reads bind
   // its original job, not the destination's later revision/artifact inventory.
   if(source.retentionRole==='PACKAGE_BINDING_ANCHOR'&&(!value||typeof value!=='object'||Array.isArray(value)||value.jobId!==state.jobId)||source.retentionRole==='SUPERSEDED_EXTENSION'&&parsed.packageMembers[0]?.hasUnknown!==true)throw storageError('Package extension source role does not match its original member.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
   if(sources.length===1&&source.retentionRole==='PACKAGE_BINDING_ANCHOR'&&parsed.packageMembers[0]?.hasUnknown!==true)throw storageError('Package extension anchor has no retained extension.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
   const expectedDisclosure=containsCredentialSecret(parsed.payload)?'CREDENTIAL_SECRET':'UNKNOWN';
   if(source.disclosureClassification!==expectedDisclosure)throw storageError('Package extension disclosure metadata differs from its retained source data.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
  }
 }
}
async function preparePackageExtensionSources(jobId,packageMembers,rootMemberCounts,sourceSha256,containerPayloadSha256){
 const manifests=packageMembers.filter(member=>member.key==='packageManifest'),anchor=manifests.at(-1);
 const selected=packageMembers.filter(member=>member.key!=='packageManifest'||member.hasUnknown);
 if(!selected.length)return [];
 if(!anchor)throw storageError('Package extension source has no effective manifest binding.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
 if(!selected.includes(anchor))selected.push(anchor);
 const bindingAnchorSha256=await hash.sha256Bytes(anchor.blob),result=[];
 for(const member of selected){
  const sha256=member===anchor?bindingAnchorSha256:await hash.sha256Bytes(member.blob),payload=Object.fromEntries([[member.key,member.payload]]),sourceLocation={jsonPointer:'/'+member.key.replace(/~/g,'~0').replace(/\//g,'~1'),containerEncoding:'gzip',rootMemberOccurrence:member.occurrence,rootMemberOccurrenceCount:rootMemberCounts.get(member.key)};
  const source={kind:PACKAGE_EXTENSION_KIND,schema:globalThis.closedLoopWorkflowSchema.ORIGINAL_PACKAGE_EXTENSION_SOURCE_CONTRACT.schema,operational:false,retentionRole:member===anchor?'PACKAGE_BINDING_ANCHOR':member.key==='packageManifest'?'SUPERSEDED_EXTENSION':'ROOT_EXTENSION',artifactId:'',filename:'',mediaType:'application/octet-stream',byteSize:member.blob.size,sha256,sourceEncoding:'UTF-8',rawSourceFormat:'UTF8_JSON_OBJECT_MEMBER',sourceSha256,containerPayloadSha256,bindingAnchorSha256,sourceLocation,parser:{identity:'closed-loop-project-package-extension-reader',version:'1'},parsedPayloadSha256:hash.sha256Value(payload),disclosureClassification:containsCredentialSecret(payload)?'CREDENTIAL_SECRET':'UNKNOWN'};
  source.artifactId=packageExtensionIdentity(jobId,source);source.filename=source.artifactId+'.json-member.utf8';result.push({source,blob:member.blob});
 }
 return result;
}

async function readOriginalSourceArchive(jobId,sha256){
  const state=await metaGet(historyKey(jobId));if(!state)throw storageError('Original source recovery history is unavailable.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
  validateRecoveryManifest(state);const source=Object.values(state.sourceArchives||{}).find(row=>row.sha256===sha256);
  if(!source)throw storageError('Original source recovery identity is unavailable.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
  const file=await readHistorySourceFile(state,source),row={...source,jobId:String(jobId),blob:file.blob};
  if(source.kind===PACKAGE_EXTENSION_KIND)await verifyPackageExtensionArchives(state,sha=>metaGet(historyFileKey(state.jobId,sha)),null,source.sourceSha256+':'+source.containerPayloadSha256);
  else await verifyOriginalSourceBindings({job:{JOB_ID:String(jobId)},projectData:{migrationArchives:[source]}},[row]);return row;
}
async function verifyHistorySourceArchives(state,readFile=sha=>metaGet(historyFileKey(state.jobId,sha)),verifiedSources=null,verifiedByteDigests=null,readSnapshot=id=>metaGet(snapshotKey(state.jobId,id))){
  if(!state?.sourceArchives)return;
  // Retain one decoded root and one reconstructed source at a time. Several
  // provenance descriptors may identify the same original bytes; verify that
  // blob once without materializing every retained project in memory together.
  const groups=new Map(),decodedSources=new Map();
  for(const source of Object.values(state.sourceArchives)){if(source.kind===PACKAGE_EXTENSION_KIND)continue;if(!groups.has(source.sha256))groups.set(source.sha256,[]);groups.get(source.sha256).push(source);}
  for(const sources of groups.values()){
    const file=await readHistorySourceFile(state,sources[0],readFile,readSnapshot,verifiedByteDigests,decodedSources),files=sources.map(source=>({...source,jobId:String(state.jobId),blob:file.blob}));
    for(const source of sources)if(source.byteSize!==file.blob.size)throw storageError('Original source recovery descriptors disagree about their exact bytes.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    await verifyOriginalSourceBindings({job:{JOB_ID:state.jobId},projectData:{migrationArchives:sources}},files,verifiedSources);
  }
  await verifyPackageExtensionArchives(state,readFile,verifiedByteDigests);
}
async function assertRecoveryTransfer(project){
  const state=await metaGet(historyKey(projectIdentity(project))),engine=globalThis.closedLoopWorkflowEngine,checked=engine.deliveryTransferPrecondition(project),intentId=engine.recordId(checked.intentRecord,'humanDecisions');
  const consumed=Object.values(state?.transfers||{}).filter(transfer=>(transfer.intentId===intentId||transfer.deliveryId===checked.deliveryId)&&transfer.result!=='FAILED');
  if(checked.scope.permittedTransferCount>0&&consumed.length>=checked.scope.permittedTransferCount)throw storageError('This authorization already has a completed or uncertain transfer in retained History. Restore that version to inspect its outcome. Restoration does not undo an external transfer.','RETAINED_TRANSFER_LIMIT_REACHED');
  return checked;
}
function validateRecoveryManifest(state){
  if(!Array.isArray(state.entries)||!state.files||typeof state.files!=='object')throw storageError('Recovery manifest is incomplete.','HISTORY_VERSION_MISMATCH');
  validateHistoryCommandReceipts(state.commandReceipts,state.jobId);
  const byId=new Map(state.entries.map(entry=>[entry.id,entry]));if(byId.size!==state.entries.length||!byId.has(state.activeId))throw storageError('Recovery version identities are inconsistent.','HISTORY_VERSION_MISMATCH');
  // This synchronous pass owns no cross-read validation result. A completed
  // path has already reached a root without a missing parent or cycle; later
  // entries can stop there while retaining first-failure traversal order.
  const completedParents=new Set();
  for(const entry of state.entries){
    const seen=new Set();let current=entry;
    while(current){
      if(seen.has(current.id))throw storageError('Recovery history contains a cycle.','HISTORY_VERSION_MISMATCH');
      if(completedParents.has(current.id))break;
      seen.add(current.id);
      if(current.parentId&&!byId.has(current.parentId))throw storageError('Recovery history is missing a parent.','HISTORY_VERSION_MISMATCH');
      current=byId.get(current.parentId);
    }
    for(const id of seen)completedParents.add(id);
  }
  for(const entry of state.entries)if(entry.projectReference){
    const reference=entry.projectReference,base=byId.get(reference.checkpointId);
    if(reference.schema!==HISTORY_PROJECT_REFERENCE||Object.keys(reference).some(key=>!['schema','checkpointId','snapshotSha256'].includes(key))||!base||base.id===entry.id||base.projectReference||base.sha256!==reference.snapshotSha256||base.projectSha256!==entry.projectSha256)throw storageError('Recovery project references do not identify a retained complete version.','HISTORY_VERSION_MISMATCH');
  }
  for(const entry of state.entries)if(entry.projectParts){
    assertHistoryProjectParts(entry.projectParts);
    if(entry.projectReference||entry.projectParts.entries.some(part=>state.files[part.sha256]?.byteSize!==part.byteSize))throw storageError('Recovery project contents are not retained in this complete history.','HISTORY_VERSION_MISMATCH');
  }
  if(state.sourceArchives!==undefined){
    if(!state.sourceArchives||typeof state.sourceArchives!=='object'||Array.isArray(state.sourceArchives))throw storageError('Original-source recovery metadata is invalid.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    for(const [key,source]of Object.entries(state.sourceArchives)){
      if(source?.kind===PACKAGE_EXTENSION_KIND){if(key!==hash.sha256Value(source))throw storageError('Package extension descriptor identity is invalid.','SOURCE_ARCHIVE_INTEGRITY_FAILED');continue;}
      if(source?.schema!==ORIGINAL_SOURCE_SCHEMA||source.kind!==ORIGINAL_SOURCE_KIND||key!==hash.sha256Value(source)||(!state.sourceArchiveReferences?.[source.sha256]&&state.files[source.sha256]?.byteSize!==source.byteSize))throw storageError('Original-source recovery bytes do not match their descriptor.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
      requiredProjectArtifactBytes({job:{JOB_ID:state.jobId},projectData:{migrationArchives:[source]}});
    }
    validatePackageExtensionGroups(state);
  }
  if(state.sourceArchiveReferences!==undefined){
    if(!state.sourceArchiveReferences||typeof state.sourceArchiveReferences!=='object'||Array.isArray(state.sourceArchiveReferences))throw storageError('Original-source recovery references are invalid.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    for(const [sha256,reference]of Object.entries(state.sourceArchiveReferences)){
      const sources=Object.values(state.sourceArchives||{}).filter(source=>source.sha256===sha256),entry=byId.get(reference?.checkpointId);
      if(!globalThis.closedLoopWorkflowSchema.validateRecoverySourceReference(reference).valid||!sources.length||sources.some(source=>source.kind!==ORIGINAL_SOURCE_KIND||source.sourceEncoding!=='UTF-8'||source.parsedPayloadSha256!==sha256)||!entry||entry.sha256!==reference.snapshotSha256)throw storageError('Original-source recovery reference is not an exact canonical source binding.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    }
  }
  validateHistoryCompatibility(state);
  const snapshotBytes=state.entries.reduce((n,entry)=>n+Number(entry.byteSize),0),fileBytes=Object.values(state.files).reduce((n,file)=>n+Number(file.byteSize),0);
  if(!Number.isSafeInteger(snapshotBytes)||!Number.isSafeInteger(fileBytes)||snapshotBytes<0||fileBytes<0||snapshotBytes!==state.compressedProjectBytes||fileBytes!==state.retainedFileBytes)throw storageError('Recovery storage accounting does not match its retained contents.','HISTORY_VERSION_MISMATCH');
}
function checkpointCompatibilityObservation(facts){
 return {checkpointId:facts.checkpointId,snapshotSha256:facts.snapshotSha256,descriptorSha256:facts.descriptorSha256,issues:facts.issues.map(({checkpointId,declaredWorkSha256,measuredWorkSha256})=>({checkpointId,declaredWorkSha256,measuredWorkSha256}))};
}
function validateHistoryCompatibility(state){
 if(state.compatibility===undefined)return;
 if(!globalThis.closedLoopWorkflowSchema.validateRecoveryCompatibility(state.compatibility).valid)throw storageError('Recovery compatibility observations are invalid.','HISTORY_VERSION_MISMATCH');
 for(const row of state.compatibility.observations){
  const entry=state.entries.find(item=>item.id===row.checkpointId);
  if(!entry||entry.sha256!==row.snapshotSha256||hash.sha256Value(entry)!==row.descriptorSha256)throw storageError('Recovery observation does not identify its original checkpoint.','HISTORY_VERSION_MISMATCH');
  for(const issue of row.issues){const source=state.entries.find(item=>item.id===issue.checkpointId);if(!source||source.workSha256!==issue.declaredWorkSha256||(source.id!==entry.id&&source.id!==entry.projectReference?.checkpointId))throw storageError('Recovery observation does not identify its original work dependency.','HISTORY_VERSION_MISMATCH');}
 }
}
function nonactivatableHistoryEntry(state,id){return state.compatibility?.observations.some(row=>row.checkpointId===id)===true;}
function assertHistoryLimits(state){
  if(state.entries.length>HISTORY_LIMITS.maxCheckpoints||state.compressedProjectBytes>HISTORY_LIMITS.maxCompressedProjectBytes||state.retainedFileBytes>HISTORY_LIMITS.maxRetainedFileBytes)throw storageError('History storage limit reached. The current project and every retained version are preserved. Export a complete backup before continuing in a new project.','HISTORY_LIMIT_REACHED');
}
function historyArtifactsSha256(rows){return hash.sha256Value(rows.map(historyDescriptor).sort((a,b)=>hash.compareUnicodeScalarSequence(a.artifactId,b.artifactId)));}
function historyWorkSha256(project){const work={...project};for(const key of HISTORY_ACTIVATION_FIELDS)delete work[key];return hash.sha256Value(work);}
// Both identities retain their existing canonical preimages. Encode each
// shared root value once; feed identical UTF-8 bytes to independent SHA states.
function historyProjectDigests(project){
 const scope=importProjectDigestScopes.get(project);
 if(!scope)return historyProjectDigestsCold(project);
 const canonical=canonicalProject(project);
 // Establish the bootstrap-safe hash/graph guard before invoking older store
 // helpers. A changed primitive or full preimage takes the ordinary cold route.
 if(!hash.canonicalDigestScopeMatches(scope,canonical))return historyProjectDigestsCold(project);
 const prior=importDigestPairs.get(scope);
 if(prior&&rootDigestPrimitivesUnchanged(prior.primitive)&&verifiedValuesEqual(prior.activationFields,HISTORY_ACTIVATION_FIELDS))return {...prior.digests};
 const primitive=captureRootDigestPrimitives(),digests=hash.withCanonicalDigestScope(scope,()=>historyProjectDigestsCold(project));
 if(primitive&&rootDigestPrimitivesUnchanged(primitive)&&hash.canonicalDigestScopeMatches(scope,canonical))importDigestPairs.set(scope,{digests:{...digests},primitive,activationFields:copyVerifiedTree(HISTORY_ACTIVATION_FIELDS)});
 return digests;
}
function historyProjectDigestsCold(project){
  const canonical=canonicalProject(project),projectDigest=hash.createSha256(),workDigest=hash.createSha256();
  const omitted=new Set(HISTORY_ACTIVATION_FIELDS);
  if(Object.getOwnPropertySymbols(canonical).length)throw new TypeError('Cannot canonically hash symbol-keyed project properties.');
  const encoder=new TextEncoder(),keys=Object.keys(canonical).sort(hash.compareUnicodeScalarSequence);
  const write=(text,includeWork=true)=>{const bytes=encoder.encode(text);projectDigest.update(bytes);if(includeWork)workDigest.update(bytes);};
  write('{');let projectCount=0,workCount=0;
  for(const key of keys){
    const includeWork=!omitted.has(key);
    if(projectCount++)projectDigest.updateText(',');
    if(includeWork&&workCount++)workDigest.updateText(',');
    for(const chunk of hash.canonicalChunks(key))write(chunk,includeWork);
    write(':',includeWork);
    for(const chunk of hash.canonicalChunks(canonical[key]))write(chunk,includeWork);
  }
  write('}');
  return {projectSha256:projectDigest.digest(),workSha256:workDigest.digest()};
}
// One-use retained computations, never a validation-success cache.
const rootCertificates=new WeakSet(),checkpointDigestPairs=new WeakSet();
// Private computation only: this never certifies static/current compatibility.
function checkpointPairMatches(proof,project){
  return checkpointDigestPairs.has(proof)&&rootDigestPrimitivesUnchanged(proof.primitive)&&verifiedValuesEqual(proof.snapshot,canonicalProject(project));
}
function captureRootDigestPrimitives(){
  if(globalThis.closedLoopHash!==hash||!verifiedGraphNodes(HISTORY_ACTIVATION_FIELDS))return null;
  const encoderDescriptor=Object.getOwnPropertyDescriptor(globalThis,'TextEncoder'),encoder=encoderDescriptor?.value,encoderPrototype=encoder?.prototype,encodeDescriptor=encoderPrototype&&Object.getOwnPropertyDescriptor(encoderPrototype,'encode');
  if(typeof encoder!=='function'||typeof encodeDescriptor?.value!=='function')return null;
  const functions=[hash.canonicalChunks,hash.createSha256,hash.compareUnicodeScalarSequence,encoder,encodeDescriptor.value];
  if(functions.some(value=>typeof value!=='function'))return null;
  const targets=[...functions,HISTORY_ACTIVATION_FIELDS,encoderPrototype];
  // canonicalChunks dispatches through its generator's prototype chain.
  let prototype=Object.getPrototypeOf(hash.canonicalChunks(null));
  while(prototype&&prototype!==Object.prototype){targets.push(prototype);prototype=Object.getPrototypeOf(prototype);}
  const records=[];
  for(const target of new Set(targets)){
    const descriptors=Reflect.ownKeys(target).map(key=>[key,Object.getOwnPropertyDescriptor(target,key)]);
    // Exported primitive metadata with accessors or additional object graphs is
    // unsupported. Native generator metadata and TextEncoder.encoding accessors
    // are descriptor-bound but never consumed by canonical digest encoding.
    if(descriptors.some(([key,entry])=>!Object.hasOwn(entry,'value')&&(functions.includes(target)||target===HISTORY_ACTIVATION_FIELDS||(target===encoderPrototype?key!=='encoding':key!=='constructor'&&key!==Symbol.toStringTag))))return null;
    records.push({target,prototype:Object.getPrototypeOf(target),descriptors});
  }
  return {hash,functions,records,encoderDescriptor,activation:[...HISTORY_ACTIVATION_FIELDS]};
}
const initialRootDigestPrimitives=captureRootDigestPrimitives();
function rootDigestPrimitivesUnchanged(proof){
  const encoderDescriptor=Object.getOwnPropertyDescriptor(globalThis,'TextEncoder');
  if(!proof||!encoderDescriptor||Reflect.ownKeys(proof.encoderDescriptor).length!==Reflect.ownKeys(encoderDescriptor).length||Reflect.ownKeys(proof.encoderDescriptor).some(field=>!Object.is(proof.encoderDescriptor[field],encoderDescriptor[field]))||proof.hash!==hash||globalThis.closedLoopHash!==hash||proof.functions.some((fn,index)=>fn!==[hash.canonicalChunks,hash.createSha256,hash.compareUnicodeScalarSequence,encoderDescriptor.value,Object.getOwnPropertyDescriptor(encoderDescriptor.value?.prototype||{},'encode')?.value][index])||!verifiedValuesEqual(proof.activation,HISTORY_ACTIVATION_FIELDS))return false;
  for(const {target,prototype,descriptors} of proof.records){
    const keys=Reflect.ownKeys(target);if(Object.getPrototypeOf(target)!==prototype||keys.length!==descriptors.length)return false;
    for(let index=0;index<keys.length;index++){
      const [key,before]=descriptors[index],after=Object.getOwnPropertyDescriptor(target,key);
      if(keys[index]!==key||!after||Reflect.ownKeys(before).some(field=>!Object.is(before[field],after[field]))||Reflect.ownKeys(before).length!==Reflect.ownKeys(after).length)return false;
    }
  }
  return true;
}
function usableRootContinuation(proof,read,descriptor){
  return rootCertificates.has(proof)&&rootDigestPrimitivesUnchanged(proof.primitive)&&verifiedValuesEqual(proof.descriptor,descriptor)&&proof.projectSha256===read.digest&&proof.workSha256===descriptor.workSha256&&unchangedVerifiedProject(read,read.project,read.digest)&&verifiedValuesEqual(proof.snapshot,proof.project)&&verifiedValuesEqual(proof.snapshot,canonicalProject(read.project));
}
// External Blob work resumes in a live IndexedDB request event. A request-only
// pump does not make an arbitrary promise continuation transaction-active.
function checkpointTransactionOwner(tx,jobId){
  const meta=tx.objectStore(META),gates=new Set(),ready=[];
  let running=true,terminal=false,failure=null,timer;
  const stopGates=error=>{for(const gate of gates)gate.reject(error);gates.clear();ready.length=0;};
  const completion=storageEvent('TRANSACTION',(resolve,reject,active)=>{
    tx.oncomplete=()=>{terminal=true;running=false;clearTimeout(timer);if(gates.size)stopGates(storageError('Checkpoint transaction completed before verification.','HISTORY_TRANSACTION_INACTIVE'));if(active())resolve();};
    tx.onerror=()=>{};
    tx.onabort=()=>{terminal=true;running=false;clearTimeout(timer);const error=failure||tx.error||storageError('Checkpoint transaction aborted.','HISTORY_TRANSACTION_ABORTED');stopGates(error);if(active())reject(error);};
  },tx);
  completion.catch(()=>{});
  const abort=error=>{failure=failure||error;running=false;clearTimeout(timer);stopGates(failure);if(!terminal)try{tx.abort();}catch{}return failure;};
  const external=promise=>new Promise((resolve,reject)=>{
    if(!running||terminal){reject(failure||storageError('Checkpoint transaction is closed.','HISTORY_TRANSACTION_INACTIVE'));return;}
    const gate={resolve,reject};gates.add(gate);
    Promise.resolve(promise).then(value=>{if(gates.has(gate))ready.push(()=>{gates.delete(gate);resolve(value);});},error=>{if(gates.has(gate))ready.push(()=>{gates.delete(gate);reject(error);});});
  });
  const pump=()=>{
    if(!running||terminal)return;
    let pending;try{pending=meta.count(historyKey(jobId));}catch(error){abort(error);return;}
    pending.onsuccess=()=>{const callbacks=ready.splice(0);for(const callback of callbacks)callback();if(running)pump();};
    pending.onerror=event=>{event.preventDefault();abort(pending.error||storageError('Checkpoint verification request failed.','HISTORY_TRANSACTION_FAILED'));};
  };
  timer=setTimeout(()=>abort(storageError('Checkpoint dependency verification timed out.','HISTORY_TRANSACTION_TIMEOUT')),STORAGE_IO_TIMEOUT_MS);
  pump();
  return {external,completion,abort,finish(){running=false;clearTimeout(timer);}};
}
async function commitRootCheckpoint(jobId,project,verifiedRead,prepared,operationId,checkpointId){
  const root=prepared.retainedRoot,primitive=root.primitive,rootValueCapture=copyCheckpointValueSnapshot(root.snapshot);
  try{
  const rootDescriptorSnapshot=copyVerifiedTree(root.descriptor),rootDigests={projectSha256:root.projectSha256,workSha256:root.workSha256},rootBodySnapshot=copyVerifiedTree({...root.body,project:undefined,artifacts:root.body.artifacts.map(historyDescriptor)});
  const stateSnapshot=copyVerifiedTree(prepared.state),snapshotSources=prepared.snapshots.map(snapshot=>({blob:snapshot.blob,descriptor:copyVerifiedTree((({blob,...descriptor})=>descriptor)(snapshot))}));
  const newFileSources=prepared.newFiles.map(file=>({sha256:file.sha256,blob:file.blob,byteSize:file.blob?.size}));
  const gateUnchanged=()=>root.primitive===primitive&&rootDigestPrimitivesUnchanged(primitive)&&verifiedValuesEqual(rootDigests,{projectSha256:root.projectSha256,workSha256:root.workSha256})&&verifiedValuesEqual(rootDescriptorSnapshot,root.descriptor)&&unchangedCheckpointValueSnapshot(rootValueCapture,root.snapshot)&&unchangedCheckpointValueSnapshot(rootValueCapture,root.project)&&unchangedCheckpointValueSnapshot(rootValueCapture,canonicalProject(project))&&unchangedVerifiedProject(verifiedRead,project,project.projectSha256)&&verifiedValuesEqual(prepared.state,stateSnapshot)&&verifiedValuesEqual(rootBodySnapshot,{...root.body,project:undefined,artifacts:root.body.artifacts.map(historyDescriptor)})&&snapshotSources.length===prepared.snapshots.length&&!snapshotSources.some((source,index)=>source.blob!==prepared.snapshots[index]?.blob||!verifiedValuesEqual(source.descriptor,(({blob,...descriptor})=>descriptor)(prepared.snapshots[index])))&&newFileSources.length===prepared.newFiles.length&&!newFileSources.some((source,index)=>source.blob!==prepared.newFiles[index]?.blob||source.sha256!==prepared.newFiles[index]?.sha256||source.byteSize!==prepared.newFiles[index]?.blob?.size);
  const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite'),owner=checkpointTransactionOwner(tx,jobId),meta=tx.objectStore(META);
  try{
    const row=await projectRowWithOperations(tx,jobId,verifiedRead),current=(await request(meta.get(historyKey(jobId))))?.value;
    if(row?.projectSha256!==project.projectSha256)throw storageError('Project changed after checkpoint preparation.','STALE_PROJECT_REVISION');
    if(Number(current?.generation||0)!==prepared.expectedGeneration||!verifiedValuesEqual(current,root.baseState))throw storageError('Project History changed in another tab.','STALE_HISTORY_REVISION');
    validateRecoveryManifest(current);
    const storedRoot=(await request(meta.get(snapshotKey(jobId,root.descriptor.id))))?.value;
    if(nonactivatableHistoryEntry(current,root.descriptor.id)||!verifiedValuesEqual((({blob,...descriptor})=>descriptor)(storedRoot||{}),root.descriptor)||!(storedRoot?.blob instanceof Blob)||storedRoot.blob.size!==root.descriptor.byteSize||await owner.external(hash.sha256Bytes(storedRoot.blob))!==root.descriptor.sha256)throw storageError('The retained root changed before checkpoint commit.','HISTORY_SNAPSHOT_INTEGRITY_FAILED');
    const bytes=new Map();
    const byteObservations=new WeakMap();
    async function retainedBytes(sha256,byteSize){
      const found=bytes.get(sha256);if(found){if(found.blob.size!==byteSize)throw storageError('Retained content sizes conflict.','HISTORY_VERSION_MISMATCH');return found;}
      const body=(await request(meta.get(historyFileKey(jobId,sha256))))?.value;
      const bytePrimitive=checkpointBytePrimitives(body?.blob);
      if(body?.sha256!==sha256||!(body.blob instanceof Blob)||body.blob.size!==byteSize||await owner.external(hash.sha256Bytes(body.blob))!==sha256)throw storageError('Retained bytes changed before checkpoint commit.','HISTORY_FILE_INTEGRITY_FAILED');
      if(checkpointBytePrimitivesMatch(bytePrimitive)){const observation={blob:body.blob,byteSize,sha256,primitive:bytePrimitive};checkpointByteObservations.add(observation);byteObservations.set(body.blob,observation);}
      bytes.set(sha256,body);return body;
    }
    if(root.descriptor.projectParts){assertHistoryProjectParts(root.descriptor.projectParts);for(const part of root.descriptor.projectParts.entries){if(current.files[part.sha256]?.byteSize!==part.byteSize)throw storageError('A retained project part is unavailable.','HISTORY_VERSION_MISMATCH');await retainedBytes(part.sha256,part.byteSize);}}
    const rootArtifacts=[];
    for(const descriptor of root.body.artifacts){const body=await retainedBytes(descriptor.sha256,descriptor.byteSize);rootArtifacts.push({...historyDescriptor(descriptor),blob:body.blob});}
    const currentRows=await request(tx.objectStore(ARTIFACTS).index('jobId').getAll(String(jobId))),files=await hydrateArtifactRows(tx,currentRows,{backingBodies:{jobId:String(jobId),rows:bytes}});
    if(!verifiedValuesEqual(files.map(historyDescriptor),root.files))throw storageError('Artifact relationships changed before checkpoint commit.','HISTORY_FILE_INTEGRITY_FAILED');
    for(const file of files)if(!(file.blob instanceof Blob)||file.blob.size!==file.byteSize||(consumeCheckpointByteObservation(file,byteObservations.get(file.blob))||await owner.external(hash.sha256Bytes(file.blob)))!==file.sha256)throw storageError('Artifact bytes changed before checkpoint commit.','HISTORY_FILE_INTEGRITY_FAILED');
    await owner.external(hydrateLegacyRunPromptContexts(root.project,rootArtifacts));
    await owner.external(verifyOriginalSourceBindings(root.project,rootArtifacts));
    await owner.external(verifyOriginalSourceBindings(project,files));
    for(const snapshot of prepared.snapshots)if(await request(meta.get(snapshotKey(jobId,snapshot.id))))throw storageError('A retained version cannot be overwritten.','IMMUTABLE_HISTORY_CONFLICT');
    for(const file of newFileSources)if(!(file.blob instanceof Blob)||prepared.state.files[file.sha256]?.byteSize!==file.byteSize||await owner.external(hash.sha256Bytes(file.blob))!==file.sha256)throw storageError('New retained bytes changed before checkpoint commit.','HISTORY_FILE_INTEGRITY_FAILED');
    const checkpointViews=[];
    for(const snapshot of prepared.snapshots){const {payload}=await owner.external(readPackageJson(snapshot.blob,{spoolArtifacts:false}));checkpointViews.push(payload.view);}
    const catalog=clone((await request(meta.get('recoveryCatalog')))?.value||{});
    // Final synchronous gate: no await can intervene between these decisions
    // and every dependent write. Validation success is never carried forward.
    if(!gateUnchanged())throw storageError('Checkpoint values or digest primitives changed during verification.','HISTORY_VERSION_MISMATCH');
    validateRecoveryManifest(prepared.state);
    recoveryBodyStaticIntegrity.delete(root.project);
    // Recreate the ordinary body's one-consumption static receipt NOW. No
    // await or cross-save static outcome intervenes before compatibility.
    try{assertProjectIntegrity(root.project,{verifyDerived:false});recoveryBodyStaticIntegrity.set(root.project,verifiedProjectIntegrity(root.project,root.projectSha256));}catch(error){if(!legacyJobPointerProjection(root.project,{verifyDerived:false}))throw error;}
    withVerifiedRecoveryCustody(rootArtifacts,()=>assertRecoveryCompatibility(root.project));
    assertPackageArtifactCustody(root.project,rootArtifacts);assertPackageArtifactCustody(project,files);
    assertRecoveryViewFiles(jobId,root.body.view,rootArtifacts);
    for(const view of checkpointViews){assertRecoveryViewFiles(jobId,view,files);if(view?.pendingMutation&&view.pendingMutation.baseProjectSha256!==root.projectSha256)throw storageError('Saved draft correction belongs to another version.','HISTORY_VERSION_MISMATCH');}
    for(const snapshot of prepared.snapshots){if(snapshot.projectSha256!==root.projectSha256||snapshot.workSha256!==root.workSha256||snapshot.projectReference?.checkpointId!==root.descriptor.id||snapshot.projectReference?.snapshotSha256!==root.descriptor.sha256)throw storageError('The checkpoint does not reference its exact verified root.','HISTORY_VERSION_MISMATCH');}
    // Validators can be replaced in a diagnostic realm; do not publish their
    // synchronous mutation of an owned candidate or primitive interface.
    if(!gateUnchanged())throw storageError('Checkpoint validation changed its source or write inputs.','HISTORY_VERSION_MISMATCH');
    for(const file of prepared.newFiles)meta.put({key:historyFileKey(jobId,file.sha256),value:{sha256:file.sha256,blob:file.blob},updatedAt:now()});
    for(const snapshot of prepared.snapshots)meta.put({key:snapshotKey(jobId,snapshot.id),value:snapshot,updatedAt:now()});
    meta.put({key:historyKey(jobId),value:prepared.state,updatedAt:now()});
    catalog[jobId]={jobId,title:prepared.state.title||'Saved project',activeId:prepared.state.activeId,activeRevision:prepared.state.activeRevision||0,removed:Boolean(prepared.state.removed)};
    meta.put({key:'recoveryCatalog',value:catalog,updatedAt:now()});fault('during-history-write');recordWorkerCommit(tx,operationId,project,project.projectSha256,checkpointId);
    owner.finish();await owner.completion;
    rootCertificates.add(root);recentOperationalCommitRead={...verifiedRead,retainedRoot:root};return checkpointId;
  }catch(error){const failure=owner.abort(error);await owner.completion.catch(()=>{});throw failure;}
  }finally{releaseCheckpointValueSnapshot(rootValueCapture);}
}

function historyUndoId(state){const byId=new Map(state.entries.map(entry=>[entry.id,entry])),active=byId.get(state.activeId);if(!active)return null;const same=active.workSha256||active.projectSha256;let prior=byId.get(active.parentId);while(prior&&(nonactivatableHistoryEntry(state,prior.id)||(prior.workSha256||prior.projectSha256)===same))prior=byId.get(prior.parentId);return prior?.id||null;}
function assertRecoveryViewFiles(jobId,view,artifacts){
 const byId=new Map(artifacts.map(row=>[row.artifactId,row]));
 for(const selection of Object.values(view?.fileSelections||{})){
  if(selection.jobId!==String(jobId)||!globalThis.closedLoopWorkflowSchema.STAGE_CONTRACTS[selection.stage]||!Array.isArray(selection.files))throw storageError('Saved file selections belong to an incompatible project view.','HISTORY_VERSION_MISMATCH');
  for(const file of selection.files){const row=byId.get(file.artifactId);if(!row||row.lineage?.role!=='FILE_SELECTION_RECOVERY'||row.lineage?.selectionKind!==selection.kind||Number(row.lineage?.stage)!==Number(selection.stage)||row.filename!==file.filename||row.mediaType!==file.mediaType||row.byteSize!==file.byteSize||row.sha256!==file.sha256)throw storageError('A saved file selection is missing or incompatible.','HISTORY_FILE_INTEGRITY_FAILED');}
 }
}
async function readHistoryView(jobId,checkpointId=null){const state=await metaGet(historyKey(jobId)),id=checkpointId||state?.activeId;if(!id)return null;const saved=await readRetainedCheckpoint(jobId,id,state);return clone(id===state.activeId&&state.activeViewOverride?state.activeViewOverride:saved.view);}
function assertHistoryProjectParts(parts){
  const seen=new Set();
  if(parts?.schema!==HISTORY_PROJECT_PARTS||Object.keys(parts).some(key=>!['schema','entries'].includes(key))||!Array.isArray(parts.entries)||!parts.entries.length)throw storageError('Saved project content references are unsupported.','HISTORY_VERSION_MISMATCH');
  for(const part of parts.entries){
    if(!part||Object.keys(part).some(key=>!['path','sha256','byteSize'].includes(key))||!Array.isArray(part.path)||!part.path.length||part.path.some(key=>typeof key!=='string'&&(!Number.isSafeInteger(key)||key<0))||!/^[a-f0-9]{64}$/.test(part.sha256||'')||!Number.isSafeInteger(part.byteSize)||part.byteSize<=0)throw storageError('Saved project content identity is invalid.','HISTORY_VERSION_MISMATCH');
    const path=JSON.stringify(part.path);if(seen.has(path))throw storageError('Saved project content has duplicate destinations.','HISTORY_VERSION_MISMATCH');seen.add(path);
  }
}
async function encodeHistoryProject(project,retainValue){
  const entries=[],retainedStrings=new Map();
  async function visit(value,path=[],arrayItem=false){
    // Stable records and large text are shared across complete versions. The
    // references are disjoint values, never patches against another version.
    // Use the existing recovery byte store and canonical JSON codec only.
    async function retain(){
      // Strings are immutable values. Within this one encoding pass an exact
      // repeated value shares its already encoded and retained byte identity.
      const prior=typeof value==='string'?retainedStrings.get(value):null;
      if(prior){entries.push({path,...prior});return true;}
      const blob=new Blob([...hash.canonicalChunks(value)],{type:'application/json'});if(blob.size<4096)return false;
      const sha256=hash.sha256Value(value);await retainValue(sha256,blob);const identity={sha256,byteSize:blob.size};entries.push({path,...identity});
      if(typeof value==='string')retainedStrings.set(value,identity);return true;
    }
    if(typeof value==='string'&&value.length>=4096&&await retain())return null;
    if(!value||typeof value!=='object')return value;
    const start=entries.length;
    const result=Array.isArray(value)?[]:{};
    for(const key of Object.keys(value)){const segment=Array.isArray(value)?Number(key):key;Object.defineProperty(result,key,{value:await visit(value[key],[...path,segment],Array.isArray(value)),enumerable:true,writable:true,configurable:true});}
    // Preserve sharing inside changing records first. Never place references
    // inside another stored part or copy their large contents into its parent.
    if(entries.length===start&&!Array.isArray(value)&&(arrayItem||path.length===2)&&await retain())return null;
    return result;
  }
  const packed=await visit(project);
  return {project:packed,...(entries.length?{projectParts:{schema:HISTORY_PROJECT_PARTS,entries}}:{})};
}
// Receipt keys are actual immutable Blob objects, not caller-declared hashes.
// Only importPackage creates this map; ordinary saved-version reads verify anew.
// A private one-use observation of the same immutable root bytes in this decode.
// It never covers parts, artifacts, parser validation, or a later transaction.
const checkpointByteObservations=new WeakSet();
function checkpointBytePrimitives(blob){
 try{
  if(!blob||Object.getPrototypeOf(blob)!==Blob.prototype||['slice','arrayBuffer','size'].some(key=>Object.hasOwn(blob,key)))return null;
  const globals=[Blob,Uint8Array,Uint32Array,ArrayBuffer,DataView,TextEncoder],functions=[hash.sha256Bytes];
  const targets=[blob,...globals,...globals.map(value=>value.prototype),Object.getPrototypeOf(Uint8Array.prototype)];
  const records=targets.map(target=>({target,prototype:Object.getPrototypeOf(target),descriptors:Reflect.ownKeys(target).map(key=>[key,Object.getOwnPropertyDescriptor(target,key)])}));
  return {globals,functions,records};
 }catch{return null;}
}
function checkpointBytePrimitivesMatch(proof){
 try{
  if(!proof||proof.globals.some((value,index)=>value!==[Blob,Uint8Array,Uint32Array,ArrayBuffer,DataView,TextEncoder][index])||proof.functions[0]!==hash.sha256Bytes)return false;
  return proof.records.every(({target,prototype,descriptors})=>{
    const keys=Reflect.ownKeys(target);if(Object.getPrototypeOf(target)!==prototype||keys.length!==descriptors.length)return false;
    return descriptors.every(([key,before],index)=>{const after=Object.getOwnPropertyDescriptor(target,key);return keys[index]===key&&after&&Reflect.ownKeys(before).length===Reflect.ownKeys(after).length&&Reflect.ownKeys(before).every(field=>Object.is(before[field],after[field]));});
  });
 }catch{return false;}
}
function consumeCheckpointByteObservation(entry,proof){
  if(!proof||!checkpointByteObservations.delete(proof))return null;
  return proof.blob===entry.blob&&proof.byteSize===entry.byteSize&&proof.sha256===entry.sha256&&checkpointBytePrimitivesMatch(proof.primitive)?proof.sha256:null;
}
async function historyBlobSha256(blob,verifiedByteDigests=null){
  if(!verifiedByteDigests)return hash.sha256Bytes(blob);
  let digest=verifiedByteDigests.get(blob);
  if(!digest){digest=hash.sha256Bytes(blob);verifiedByteDigests.set(blob,digest);}
  return digest;
}
// Import-only decoded-data proof. Never a root/validator/activation receipt:
// every use reads the current archived row and binds its actual immutable Blob.
// The private snapshot also detects mutation of the operation's parsed-part map.
const importedPartProofs=new WeakMap();
async function restoreHistoryProject(body,readFile,verifiedParts=new Map(),verifiedByteDigests=null){
  if(!body.projectParts)return bindImportDigestScope(body.project,verifiedParts);
  assertHistoryProjectParts(body.projectParts);
  // Reuse only content verified against this operation's immutable input.
  // Each destination still receives its own clone; retained versions cannot alias.
  const project=body.project; // verifiedParts belongs to this read/import only.
  for(const part of body.projectParts.entries){
    let value=verifiedParts.get(part.sha256);
    if(verifiedByteDigests){
      const file=await readFile(part.sha256);
      if(!(file?.blob instanceof Blob)||file.blob.size!==part.byteSize||await historyBlobSha256(file.blob,verifiedByteDigests)!==part.sha256)throw storageError('Saved project contents are missing or corrupt. The current version is preserved.','HISTORY_FILE_INTEGRITY_FAILED');
      if(file.jobId!==undefined&&String(file.jobId)!==String(body.jobId))throw storageError('Saved project contents belong to another job.','HISTORY_VERSION_MISMATCH');
      const contents=value&&Object.getOwnPropertyDescriptor(value,'contents'),size=value&&Object.getOwnPropertyDescriptor(value,'byteSize'),proof=value&&importedPartProofs.get(value);
      if(!proof||proof.blob!==file.blob||proof.sha256!==part.sha256||proof.byteSize!==part.byteSize||!contents||!Object.hasOwn(contents,'value')||!size||!Object.hasOwn(size,'value')||size.value!==part.byteSize||!verifiedValuesEqual(proof.snapshot,contents.value)){
        const decoded=await readPackageJson(file.blob,{compressed:false,spoolArtifacts:false});
        // Parsed JSON has only data properties; do not expose its retained source
        // to the mutable prompt-context copying hook used by ordinary clone().
        if(!verifiedGraphNodes(decoded.payload))throw storageError('Saved project contents are not ordinary JSON data.','HISTORY_FILE_INTEGRITY_FAILED');
        value={contents:decoded.payload,byteSize:file.blob.size};
        importedPartProofs.set(value,{blob:file.blob,sha256:part.sha256,byteSize:file.blob.size,snapshot:copyVerifiedTree(decoded.payload)});
        verifiedParts.set(part.sha256,value);
      }
    }else if(!value){
      const file=await readFile(part.sha256);
      if(!(file?.blob instanceof Blob)||file.blob.size!==part.byteSize||await historyBlobSha256(file.blob,verifiedByteDigests)!==part.sha256)throw storageError('Saved project contents are missing or corrupt. The current version is preserved.','HISTORY_FILE_INTEGRITY_FAILED');
      const decoded=await readPackageJson(file.blob,{compressed:false,spoolArtifacts:false});value={contents:decoded.payload,byteSize:file.blob.size};verifiedParts.set(part.sha256,value);
    }
    if(value.byteSize!==part.byteSize)throw storageError('Saved project content sizes conflict.','HISTORY_VERSION_MISMATCH');
    let parent=project;
    for(const key of part.path.slice(0,-1)){if(!parent||typeof parent!=='object'||!Object.hasOwn(parent,key)||Array.isArray(parent)!==(typeof key==='number'))throw storageError('Saved project content destination is unavailable.','HISTORY_VERSION_MISMATCH');parent=parent[key];}
    const key=part.path.at(-1);
    if(!parent||typeof parent!=='object'||!Object.hasOwn(parent,key)||parent[key]!==null||Array.isArray(parent)!==(typeof key==='number'))throw storageError('Saved project contents overlap or replace authored data.','HISTORY_VERSION_MISMATCH');
    const privateRead=importDigestHolders.get(verifiedParts)?.privateRead;
    // Newly decoded JSON has no retained prompt-context side channel. Keep it
    // private rather than exposing it to the mutable ordinary clone hook.
    if(privateRead&&!verifiedGraphNodes(value.contents))throw storageError('Saved project contents are not ordinary JSON data.','HISTORY_FILE_INTEGRITY_FAILED');
    Object.defineProperty(parent,key,{value:verifiedByteDigests||privateRead?copyVerifiedTree(value.contents):clone(value.contents),enumerable:true,writable:true,configurable:true});
  }
  return bindImportDigestScope(project,verifiedParts);
}
async function encodeCheckpoint(project,artifactRows,{id=crypto.randomUUID(),parentId=null,label='Saved project',view=historyView(project),workSha256=historyWorkSha256(project),projectDigest=projectSha256(project),artifactManifestSha256=historyArtifactsSha256(artifactRows),projectReference=null,retainValue=null,verifiedIntegrity=null}={}){
  const jobId=projectIdentity(project),canonical=canonicalProject(project),artifacts=artifactRows.map(historyDescriptor);
  if(!unchangedVerifiedProject(verifiedIntegrity,project,projectDigest))assertProjectIntegrity(canonical,{verifyDerived:false});assertPackageArtifactCustody(canonical,artifactRows);assertRecoveryViewFiles(jobId,view,artifactRows);if(view?.pendingMutation&&view.pendingMutation.baseProjectSha256!==projectDigest)throw storageError('The draft correction belongs to another project version.','HISTORY_VERSION_MISMATCH');
  // A saved view changes its own immutable checkpoint, not its canonical
  // project bytes. Bind repeated project data to a retained inline checkpoint;
  // all views, drafts, artifact inventories, parents, and identities stay local
  // to their own checkpoint. This is a versioned internal storage encoding.
  const contents=projectReference?null:await encodeHistoryProject(canonical,retainValue);
  const body={schema:HISTORY_SCHEMA,id,jobId,parentId,label,workSha256,artifactManifestSha256,createdAt:now(),...(projectReference?{projectReference:clone(projectReference)}:contents),projectSha256:projectDigest,artifacts,view:clone(view)};
  fault('before-history-checkpoint');const encoded=await compressPackage(body);
  const sha256=await hash.sha256Bytes(encoded.blob);
  return {id,parentId,label,workSha256,viewSha256:hash.sha256Value(body.view),artifactManifestSha256:body.artifactManifestSha256,createdAt:body.createdAt,stage:Number(view.activeStage||project.activeStage||1),projectSha256:body.projectSha256,...(projectReference?{projectReference:clone(projectReference)}:{}),...(body.projectParts?{projectParts:clone(body.projectParts)}:{}),sha256,byteSize:encoded.blob.size,blob:encoded.blob};
}
async function prepareHistoryCommit(next,prior,{label=null,view=null,preserveActiveView=false,sessionId=null,baseState=null,artifactRows=null,retainedFiles=[],verifiedRead=null,verifiedDigests=null,verifiedIntegrity=[],checkpointRootRead=false,verifiedDigestPair=null}={}){
  const rootPreparation=checkpointRootRead&&next===prior&&unchangedVerifiedProject(verifiedRead,next,verifiedRead?.digest)?{read:verifiedRead,primitive:rootDigestPrimitivesUnchanged(initialRootDigestPrimitives)?initialRootDigestPrimitives:null,candidate:null}:null;
  // These private objects remain unchanged throughout this preparation. Reuse
  // only digests computed here or verified by the private read below.
  const digests=new WeakMap(),workDigests=new WeakMap(),digest=project=>{if(!digests.has(project))digests.set(project,projectSha256(project));return digests.get(project);};
  // Only saveCheckpoint supplies this private, freshly verified read. It has
  // not exposed or mutated the object; public write options cannot supply it.
  if(verifiedRead)digests.set(verifiedRead.project,verifiedRead.digest);
  // Only internal transaction preparation supplies these already measured,
  // unchanged objects. Public write options cannot provide this proof.
  for(const [project,digestValue,workDigestValue] of verifiedDigests||[]){digests.set(project,digestValue);if(workDigestValue)workDigests.set(project,workDigestValue);}
  // Only the private operational owner supplies this capture-bound pair.
  // Reject changed values, primitives or either transported digest label;
  // static integrity fallback cannot authorize stale precomputed identities.
  const assertDigestPair=project=>{if(project!==next||!verifiedDigestPair)return null;const pair=verifiedDigestPair;if(!checkpointPairMatches(pair,project)||digests.get(project)!==pair.projectSha256||workDigests.get(project)!==pair.workSha256)throw storageError('Checkpoint digest input changed during preparation.','HISTORY_VERSION_MISMATCH');return pair;};
  assertDigestPair(next);
  const jobId=projectIdentity(next),existing=baseState||await metaGet(historyKey(jobId));
  const state=clone(existing||{schema:HISTORY_SCHEMA,jobId,generation:0,activeId:null,activeProjectSha256:null,entries:[],sessions:{},files:{},compressedProjectBytes:0,retainedFileBytes:0,redo:[]});
  let preservedPriorView=null;
  if(preserveActiveView&&state.activeId){
    if(!prior||state.activeProjectSha256!==digest(prior))throw storageError('Project History changed before its view could be preserved.','STALE_HISTORY_REVISION');
    const saved=await readRetainedCheckpoint(jobId,state.activeId,state);
    view=clone(state.activeViewOverride||saved.view);
    if(view?.pendingMutation){
      const source=view.pendingMutation.baseProjectSha256;
      if(source!==digest(prior)&&source!==prior.restoredCandidates?.sourceProjectSha256)throw storageError('The saved correction belongs to another project version.','HISTORY_VERSION_MISMATCH');
      // Rebind the saved unaccepted view to this verified automatic revision.
      // No response recovery authority is created and no command is replayed.
      preservedPriorView=rebaseHistoryView(prior,view);
      view=clone(preservedPriorView);view.pendingMutation.baseProjectSha256=digest(next);
      view=rebaseHistoryView(next,view);
    }else preservedPriorView=clone(view);
  }
  const retainedRedo=clone(state.redo||[]),viewOnly=prior&&digest(next)===digest(prior);
  let files=artifactRows;try{files=files||await readJobArtifactRows(jobId,false);}catch(error){if(!['ARTIFACT_BYTE_REFERENCE_INVALID','ARTIFACT_BYTES_UNAVAILABLE','ARTIFACT_LEGACY_BYTES_INVALID'].includes(error.code))throw error;throw storageError('Cannot preserve History: a stored file is missing or corrupt.','HISTORY_FILE_INTEGRITY_FAILED');}const expectedGeneration=Number(state.generation||0),newFiles=[],snapshots=[];
  for(const row of files){
    if(!(row.blob instanceof Blob)||row.blob.size!==Number(row.byteSize)||await hash.sha256Bytes(row.blob)!==row.sha256)throw storageError(`Cannot preserve history: stored file ${row.filename} is missing or corrupt.`,'HISTORY_FILE_INTEGRITY_FAILED');
    if(!state.files[row.sha256]){newFiles.push({sha256:row.sha256,blob:row.blob});state.files[row.sha256]={byteSize:row.blob.size};state.retainedFileBytes+=row.blob.size;}
  }
  await verifyOriginalSourceBindings(next,files);
  const verifiedValues=new Set();
  async function retainValue(sha256,blob){
    if(verifiedValues.has(sha256))return;
    if(state.files[sha256]){
      const retained=newFiles.find(file=>file.sha256===sha256)||retainedFiles.find(file=>file.sha256===sha256)||await metaGet(historyFileKey(jobId,sha256));
      if(!(retained?.blob instanceof Blob)||retained.blob.size!==state.files[sha256].byteSize||await hash.sha256Bytes(retained.blob)!==sha256)throw storageError('Retained project contents are missing or corrupt. The new version was not committed.','HISTORY_FILE_INTEGRITY_FAILED');
    }else{newFiles.push({sha256,blob});state.files[sha256]={byteSize:blob.size};state.retainedFileBytes+=blob.size;}
    verifiedValues.add(sha256);
  }
  const unusableRoots=new Set();
  async function append(project,entryLabel,entryView){
    // Restoration's active project is a new revision, while activeId still
    // identifies its immutable source. Reuse only the exact stored body.
    const base=state.entries.find(entry=>entry.projectSha256===digest(project)&&!entry.projectReference);
    const reusable=entry=>!nonactivatableHistoryEntry(state,entry.id)&&!unusableRoots.has(entry.id);
    const usableBase=base&&reusable(base)?base:base?state.entries.find(entry=>entry.projectSha256===digest(project)&&!entry.projectReference&&reusable(entry)):null;
    let projectReference=null,reusableWork=null;
    if(usableBase){
      const retained=snapshots.find(entry=>entry.id===usableBase.id)||await metaGet(snapshotKey(jobId,usableBase.id));
      if(!retained?.blob)throw storageError('A retained project body is unavailable. The new checkpoint was not committed.','HISTORY_PROJECT_REFERENCE_UNAVAILABLE');
      const {blob,...descriptor}=retained;
      const bytePrimitive=checkpointBytePrimitives(blob);
      if(hash.sha256Value(descriptor)!==hash.sha256Value(usableBase)||blob.size!==usableBase.byteSize||await hash.sha256Bytes(blob)!==usableBase.sha256)throw storageError('A retained project body failed exact-byte verification. The new checkpoint was not committed.','HISTORY_SNAPSHOT_INTEGRITY_FAILED');
      const rootBytes=checkpointBytePrimitivesMatch(bytePrimitive)?{blob,byteSize:usableBase.byteSize,sha256:usableBase.sha256,primitive:bytePrimitive}:null;if(rootBytes)checkpointByteObservations.add(rootBytes);
      const reuse=rootPreparation&&usableRootContinuation(rootPreparation.read.retainedRoot,rootPreparation.read,usableBase)?rootPreparation.read.retainedRoot:null;
      // A fresh checkpoint decode verifies these same retained bytes below.
      // Continuations can reuse a private project without decoding its parts,
      // so retain their explicit byte check, and every non-root preparation.
      if(usableBase.projectParts){assertHistoryProjectParts(usableBase.projectParts);for(const part of usableBase.projectParts.entries){if(state.files[part.sha256]?.byteSize!==part.byteSize)throw storageError('A retained project content dependency is unavailable.','HISTORY_VERSION_MISMATCH');if(!rootPreparation||reuse)await retainValue(part.sha256,null);}}
      const measuredPair=rootPreparation&&checkpointPairMatches(verifiedRead.checkpointDigestPair,project)?verifiedRead.checkpointDigestPair:null;
      const decoded=await decodeCheckpoint(jobId,{...usableBase,blob},sha=>newFiles.find(file=>file.sha256===sha)||retainedFiles.find(file=>file.sha256===sha)||metaGet(historyFileKey(jobId,sha)),async id=>snapshots.find(entry=>entry.id===id)||metaGet(snapshotKey(jobId,id)),new Map(),new Map(),null,null,null,reuse,measuredPair,rootBytes);
      if(measuredPair&&(!checkpointPairMatches(measuredPair,project)||!checkpointPairMatches(measuredPair,decoded.project)))throw storageError('Checkpoint digest input changed during verification.','HISTORY_VERSION_MISMATCH');
      const rootQualified=rootPreparation&&rootPreparation.primitive&&unchangedVerifiedProject(rootPreparation.read,project,rootPreparation.read.digest)&&verifiedValuesEqual(canonicalProject(project),decoded.project)&&rootDigestPrimitivesUnchanged(rootPreparation.primitive)&&(!reuse||decoded.project!==reuse.project||verifiedValuesEqual(reuse.snapshot,reuse.project));
      if(reuse&&decoded.project===reuse.project&&!rootQualified)throw storageError('Deferred checkpoint validation lost its exact private source.','HISTORY_VERSION_MISMATCH');
      if(rootQualified){
        rootPreparation.candidate={descriptor:copyVerifiedTree(usableBase),project:decoded.project,snapshot:copyVerifiedTree(decoded.project),body:decoded,primitive:rootPreparation.primitive,projectSha256:decoded.projectSha256,workSha256:decoded.workSha256,files:files.map(row=>({...historyDescriptor(row)})),baseState:copyVerifiedTree(existing)};
      }
      reusableWork=decoded.workSha256||historyWorkSha256(decoded.project);
      projectReference={schema:HISTORY_PROJECT_REFERENCE,checkpointId:usableBase.id,snapshotSha256:usableBase.sha256};
    }
    const boundPair=assertDigestPair(project),checkpointProject=boundPair?boundPair.snapshot:project;
    // Encoding can await retained-byte reads. Serialize the unexposed capture,
    // not a candidate retained by the ordinary prompt-context copy hook.
    const snapshot=await encodeCheckpoint(checkpointProject,files,{parentId:state.activeId,label:entryLabel,view:entryView||historyView(project),projectDigest:digest(project),workSha256:workDigests.get(project)||reusableWork||historyWorkSha256(project),projectReference,retainValue,verifiedIntegrity:boundPair?verifiedProjectIntegrity(checkpointProject,boundPair.projectSha256):verifiedIntegrity.find(receipt=>receipt.project===project)});
    if(boundPair&&(assertDigestPair(project)!==boundPair||snapshot.projectSha256!==boundPair.projectSha256||snapshot.workSha256!==boundPair.workSha256))throw storageError('Checkpoint digest identity changed during encoding.','HISTORY_VERSION_MISMATCH');
    const {blob,...descriptor}=snapshot;state.entries.push(descriptor);snapshots.push(snapshot);state.compressedProjectBytes+=blob.size;state.activeId=snapshot.id;state.activeProjectSha256=digest(project);state.activeViewOverride=null;state.redo=[];
  }
  if(prior&&(state.activeProjectSha256!==digest(prior)||state.entries.find(entry=>entry.id===state.activeId)?.artifactManifestSha256!==historyArtifactsSha256(files)))await append(prior,'Previous project',preservedPriorView||view||historyView(prior));
  // A no-op preparation still promises a restorable view/session checkpoint.
  // Matching project labels cannot certify its independently stored work.
  const currentEntry=state.entries.find(entry=>entry.id===state.activeId),unchangedView=!view||hash.sha256Value(view)===(state.activeViewOverride?hash.sha256Value(state.activeViewOverride):currentEntry?.viewSha256);
  if(state.activeId&&!snapshots.length&&((sessionId&&!state.sessions[sessionId])||(viewOnly&&unchangedView))){
    try{await readRetainedCheckpoint(jobId,state.activeId,state,rootPreparation?.read);}catch(error){
      if(error.code!=='HISTORY_VERSION_MISMATCH'||error.message!=='Saved work identity does not match its complete project.')throw error;
      // Only the coherent stale-work defect is recoverable here. The full
      // inspection still checks all other bytes, identities, views and derived
      // obligations. Its original is preserved and never gains root authority.
      const facts=await inspectRetainedCheckpoint(jobId,state.activeId,state);
      if(facts.integrityValid||facts.measuredWorkSha256!==(workDigests.get(next)||historyWorkSha256(next))||facts.artifactManifestSha256!==historyArtifactsSha256(files))throw error;
      for(const issue of facts.issues)unusableRoots.add(issue.checkpointId);
      let recoveredView=view||state.activeViewOverride;
      if(!recoveredView){
        const original=await metaGet(snapshotKey(jobId,state.activeId));
        if(!(original?.blob instanceof Blob)||original.blob.size!==facts.byteSize||await hash.sha256Bytes(original.blob)!==facts.snapshotSha256||hash.sha256Value((({blob,...descriptor})=>descriptor)(original))!==facts.descriptorSha256)throw storageError('The inspected saved view changed before recovery.','HISTORY_SNAPSHOT_INTEGRITY_FAILED');
        const {payload}=await readPackageJson(original.blob,{spoolArtifacts:false});recoveredView=payload.view;
      }
      recoveredView=rebaseHistoryView(next,recoveredView);
      await append(next,label||'Recovered current work',recoveredView);
    }
  }
  if(sessionId&&!state.sessions[sessionId]){
    if(!state.activeId)await append(prior||next,'Session start',view);
    state.sessions[sessionId]={checkpointId:state.activeId,startedAt:now()};
  }
  const active=state.entries.find(entry=>entry.id===state.activeId),viewChanged=view&&hash.sha256Value(view)!==(state.activeViewOverride?hash.sha256Value(state.activeViewOverride):active?.viewSha256);
  if(!prior||digest(next)!==digest(prior)||viewChanged)await append(next,label||historyLabel(next,prior),view);
  if(!state.activeId)await append(next,label||'Session start',view);
  state.title=String(next.job?.JOB_TITLE||'');state.activeRevision=Number(next.revision||0);state.removed=false;
  if(viewOnly)state.redo=retainedRedo;reconcileRecoveryTransfers(state,next);state.generation=expectedGeneration+1;assertHistoryLimits(state);
  assertDigestPair(next);
  return {state,expectedGeneration,snapshots,newFiles,...(rootPreparation?.candidate?{retainedRoot:rootPreparation.candidate}:{})};
}
async function commitHistory(tx,prepared){
  const meta=tx.objectStore(META),state=prepared.state,current=await request(meta.get(historyKey(state.jobId)));
  if(Number(current?.value?.generation||0)!==prepared.expectedGeneration)throw storageError('Project History changed in another tab. Reload the current version before continuing.','STALE_HISTORY_REVISION');
  for(const file of prepared.newFiles)meta.put({key:historyFileKey(state.jobId,file.sha256),value:{sha256:file.sha256,blob:file.blob},updatedAt:now()});
  for(const snapshot of prepared.snapshots){const key=snapshotKey(state.jobId,snapshot.id);if(await request(meta.get(key)))throw storageError('A retained version cannot be overwritten.','IMMUTABLE_HISTORY_CONFLICT');meta.put({key,value:snapshot,updatedAt:now()});}
  meta.put({key:historyKey(state.jobId),value:state,updatedAt:now()});await updateRecoveryCatalog(meta,state);fault('during-history-write');
}
async function updateRecoveryCatalog(meta,state){
  const catalog=clone((await request(meta.get('recoveryCatalog')))?.value||{});
  catalog[state.jobId]={jobId:state.jobId,title:state.title||'Saved project',activeId:state.activeId,activeRevision:state.activeRevision||0,removed:Boolean(state.removed)};
  meta.put({key:'recoveryCatalog',value:catalog,updatedAt:now()});
}
async function listRecoverableProjects(){return Object.values(await metaGet('recoveryCatalog')||{});}
async function historyList(jobId){
  const state=await metaGet(historyKey(jobId));
  return state?{...state,undoId:historyUndoId(state),redo:(state.redo||[]).filter(id=>!nonactivatableHistoryEntry(state,id)),files:undefined,limits:HISTORY_LIMITS}:{schema:HISTORY_SCHEMA,jobId:String(jobId),entries:[],sessions:{},activeId:null,generation:0,redo:[],limits:HISTORY_LIMITS};
}
async function saveCheckpoint(jobId,{expectedProjectRevision,expectedStateSha256=null,view=null,label='Saved view',sessionId=null,operationId=null}={}){
  // Scroll/draft checkpoints use the existing transaction owner off the UI
  // thread; only the small view and resulting checkpoint identity cross it.
  if(useStoreWorker())return requestStoreWorker('SAVE_CHECKPOINT',[jobId,{expectedProjectRevision,expectedStateSha256,view,label,sessionId}]);
  const verifiedRead=await readProjectForTransaction(jobId,CHECKPOINT_PAIR_READ),project=verifiedRead?.project;if(!project)throw storageError('The project is unavailable.','HISTORY_PROJECT_MISSING');
  let checkpointProject=project,checkpointDigest=project.projectSha256,prepared,checkpointId;
  if((expectedProjectRevision!==undefined&&Number(project.revision)!==Number(expectedProjectRevision))||(expectedStateSha256&&project.projectSha256!==expectedStateSha256)){
    // A stale tab may preserve its unsubmitted view against its exact retained
    // source. This does not activate that source or overwrite newer project data.
    const state=await metaGet(historyKey(jobId)),source=expectedStateSha256&&state?.entries.findLast(entry=>entry.projectSha256===expectedStateSha256);
    if(!view||!source)throw storageError('Project changed before its view could be saved.','STALE_PROJECT_REVISION');
    const saved=await readRetainedCheckpoint(jobId,source.id,state);
    if(Number(saved.project.revision)!==Number(expectedProjectRevision))throw storageError('The draft does not identify its original project revision.','HISTORY_VERSION_MISMATCH');
    const files=[...saved.artifacts],byId=new Map(files.map(row=>[row.artifactId,row]));
    for(const selection of Object.values(view.fileSelections||{}))for(const file of selection.files||[]){
      if(byId.has(file.artifactId))continue;
      const row=await getArtifact(file.artifactId);
      if(!row||row.jobId!==String(jobId))throw storageError('A departing draft file is unavailable.','HISTORY_FILE_INTEGRITY_FAILED');
      files.push(row);byId.set(row.artifactId,row);
    }
    checkpointProject=saved.project;checkpointDigest=saved.projectSha256;
    prepared=await prepareHistoryCommit(saved.project,saved.project,{label,view,artifactRows:files,baseState:{...state,activeId:source.id,activeProjectSha256:saved.projectSha256,activeViewOverride:null},verifiedRead:{project:saved.project,digest:saved.projectSha256}});
    checkpointId=prepared.state.activeId;
    // Only append recovery contents. Selection, revision, Undo/Redo, sessions,
    // transfer receipts and the active view remain owned by the newer version.
    const appended=prepared.state;
    prepared.state={...state,entries:appended.entries,files:appended.files,compressedProjectBytes:appended.compressedProjectBytes,retainedFileBytes:appended.retainedFileBytes,generation:appended.generation};
  }else{
    prepared=await prepareHistoryCommit(project,project,{label,view,sessionId,verifiedRead,verifiedIntegrity:[verifiedRead],checkpointRootRead:true});
    checkpointId=prepared.state.activeId;
  }
  if(prepared.retainedRoot&&checkpointProject===project)return commitRootCheckpoint(jobId,project,verifiedRead,prepared,operationId,checkpointId);
  const tx=await openTransaction([PROJECTS,META],'readwrite');
  try{const row=await projectRowWithOperations(tx,jobId,verifiedRead);if(row?.projectSha256!==project.projectSha256)throw storageError('Project changed before its checkpoint could be saved.','STALE_PROJECT_REVISION');await commitHistory(tx,prepared);recordWorkerCommit(tx,operationId,checkpointProject,checkpointDigest,checkpointId);await complete(tx);if(checkpointProject===project&&unchangedVerifiedProject(verifiedRead,project,project.projectSha256))recentOperationalCommitRead={...verifiedRead,retainedRoot:undefined};return checkpointId;}catch(error){try{tx.abort();}catch{}throw error;}
}
async function beginHistorySession(sessionId){
  if(!sessionId)throw new Error('Application session identity is required.');
  const existing=await metaGet('recoverySession:'+sessionId);if(existing)return existing.checkpoints;
  const summaries=await listProjectSummaries(),checkpoints={},quarantinedProjects=[],selectedProject=await metaGet('selectedProject');
  for(const summary of summaries){const id=projectIdentity(summary);try{await saveCheckpoint(id,{sessionId,label:'Session start'});const state=await metaGet(historyKey(id));checkpoints[id]=state.sessions[sessionId].checkpointId;}catch(error){if(!['PROJECT_HASH_MISMATCH','PROJECT_REVISION_MISMATCH','PROJECT_INTEGRITY_FAILED','OPERATIONAL_STATE_INTEGRITY_FAILED'].includes(error.code))throw error;const preserved=(await listQuarantinedProjects()).filter(row=>row.jobId===id&&row.completeSnapshot);if(!preserved.length)throw error;quarantinedProjects.push({jobId:id,quarantineKey:preserved.at(-1).key,reason:error.code});}}
  // The empty initial view is durable too; new projects retain their own start.
  await metaPut('recoverySession:'+sessionId,{sessionId,startedAt:now(),selectedProject,checkpoints,quarantinedProjects});
  return checkpoints;
}
// Observation metadata belongs to an exact verified immutable root. A later
// view checkpoint may reference that root without changing its saved projection.
const recoveryProjectionBounds=new WeakMap();
// This receipt covers one decoded body's successful static validation only.
// File hydration/custody still precede current derived validation. A changed
// body or a tolerated legacy static failure uses the complete ordinary path.
const recoveryBodyStaticIntegrity=new WeakMap();
function recordedProjectionObservation(project){
 const bound=recoveryProjectionBounds.get(project),observedAt=project.stages?.[2]?.gate?.checkedAt;
 const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)?Date.parse(value):NaN;
 const observed=instant(observedAt),created=instant(bound);
 return Number.isFinite(observed)&&Number.isFinite(created)&&observed<=created&&created<=Date.now()?observedAt:null;
}
function historicalProjectionConsistent(project,error){
 const observationIssue='Application projection observations require a current refresh.';
 if(error?.code!=='PROJECT_INTEGRITY_FAILED'||!error.issues?.length||error.issues.some(issue=>issue!==observationIssue&&!/^Application-derived job field .* does not match deterministic recalculation\.$|^Stage \d+ (?:status|derivedData|decision|decisionEvidence|gate) does not match deterministic recalculation\.$/.test(issue)))return false;
 if(error.issues.includes(observationIssue)&&Object.hasOwn(project.projectData,'applicationProjection')&&globalThis.closedLoopWorkflowEngine.validateApplicationProjection(project,project,{useRetainedObservations:true}).valid)return true;
 const observedAt=recordedProjectionObservation(project);
 if(observedAt!==null&&validateProjectIntegrity(project,{projectionObservedAt:observedAt}).valid)return true;
 // Earlier versions stored repeated occurrences in the Stage 13 group field.
 // Recognize only that exact former calculation after byte identity and all
 // other canonical/projection checks; never modify the retained source here.
 if(!error.issues.includes('Stage 13 derivedData does not match deterministic recalculation.'))return false;
 const saved=project.stages?.[13]?.derivedData?.REPEATED_FAILURE_GROUPS;
 if(typeof saved!=='number')return false;
 const engine=globalThis.closedLoopWorkflowEngine,iterationId=engine.evaluateCrossRunComparison(project).iterationId,stability=engine.executionStability(project,iterationId);
 if(saved!==stability.repeatedDefectCount||saved===stability.repeatedFailureGroupCount)return false;
 const retained=project.projectData?.applicationProjection;
 if(retained?.receipt?.derivationId!==globalThis.closedLoopWorkflowSchema.PROJECT_PROJECTION_DERIVATION_CONTRACT.id||!validateProjectIntegrity(project,{verifyDerived:false}).valid)return false;
 const corrected=clone(project);corrected.stages[13].derivedData.REPEATED_FAILURE_GROUPS=stability.repeatedFailureGroupCount;
 // Bind only this counterfactual clone's one corrected output to its retained
 // observation epoch. The original receipt and stored project remain unchanged.
 const canonicalInput=engine.applicationProjectionInput(corrected,retained.observedAt,{observations:retained.inputObservations});
 corrected.projectData.applicationProjection.receipt=globalThis.closedLoopWorkflowSchema.createApplicationDerivationReceipt({derivationKey:'project.currentProjection',canonicalInput,sourceRecordHashes:canonicalInput.sourceBinding.records,output:engine.applicationProjectionOutput(corrected)});
 return validateProjectIntegrity(corrected).valid||(observedAt!==null&&validateProjectIntegrity(corrected,{projectionObservedAt:observedAt}).valid);
}
function assertRecoveryCompatibility(project){return withImportDigestScope(project,()=>assertRecoveryCompatibilityCurrent(project));}
function assertRecoveryCompatibilityCurrent(project){
  // The complete saved projection must agree with its canonical version, not
  // only stages labelled COMPLETE. Otherwise an older permissive import can
  // re-enter through History, Undo/Redo or a nested backup checkpoint.
  const staticIntegrity=recoveryBodyStaticIntegrity.get(project);recoveryBodyStaticIntegrity.delete(project);
  const currentDefinition=project.projectData?.applicationProjection?.receipt?.derivationId===globalThis.closedLoopWorkflowSchema.PROJECT_PROJECTION_DERIVATION_CONTRACT.id;
  try{
    if(currentDefinition&&unchangedVerifiedProject(staticIntegrity,project,staticIntegrity?.digest)){
      const issues=derivedProjectIntegrityIssues(project);
      if(issues.length)throw Object.assign(storageError(`Canonical project integrity validation failed: ${issues.join(' | ')}`,'PROJECT_INTEGRITY_FAILED'),{issues});
    }else assertProjectIntegrity(project);
  }catch(error){
    if(projectionActivationRequired(project)||legacyExpectedVarianceSources(project).length){
      const verifyProjection=Object.hasOwn(project.projectData||{},'applicationProjection');
      try{assertProjectIntegrity(project,{verifyDerived:false,verifyProjection});}catch(canonicalError){if(!legacyJobPointerProjection(project,{verifyDerived:false,verifyProjection}))throw canonicalError;}return;
    }
    if(historicalProjectionConsistent(project,error)||legacyJobPointerProjection(project))return;
    if(error.code!=='PROJECT_INTEGRITY_FAILED')throw error;
    throw Object.assign(storageError('The saved project projection does not match its canonical records. The current version and saved history are preserved. Restore a compatible backup.','HISTORY_VERSION_INCOMPATIBLE'),{issues:error.issues});
  }
}
async function retainedCheckpointReaders(jobId,checkpointId,state=null){
  const manifest=state||await metaGet(historyKey(jobId));
  if(!manifest)throw storageError('That retained project history is unavailable.','HISTORY_VERSION_UNAVAILABLE');
  validateRecoveryManifest(manifest);
  const byId=new Map(manifest.entries.map(entry=>[entry.id,entry]));
  const readSnapshot=async id=>{
    const expected=byId.get(id);
    if(!expected)throw storageError('A saved version depends on an unretained project body.','HISTORY_VERSION_MISMATCH');
    const entry=await metaGet(snapshotKey(jobId,id));if(!entry)return null;
    const {blob,...descriptor}=entry;
    if(entry.id!==id||hash.sha256Value(descriptor)!==hash.sha256Value(expected))throw storageError('Stored snapshot identity does not match the selected retained version.','HISTORY_VERSION_MISMATCH');
    return entry;
  };
  return {manifest,readSnapshot};
}
async function readRetainedCheckpoint(jobId,checkpointId,state=null,rootRead=null){
  const {manifest,readSnapshot}=await retainedCheckpointReaders(jobId,checkpointId,state);
  const entry=await readSnapshot(checkpointId),descriptor=entry?.projectReference?manifest.entries.find(row=>row.id===entry.projectReference.checkpointId):manifest.entries.find(row=>row.id===checkpointId);
  const proof=rootRead?.retainedRoot,reuse=descriptor&&rootRead&&usableRootContinuation(proof,rootRead,descriptor);
  if(!reuse){
    // A cold retained root can still equal the private pair measured by this
    // checkpoint's fresh operational read. A missing root certificate never
    // creates a pair, and a different historical version stays wholly cold.
    let measuredPair=null;
    try{
      const pair=rootRead?.checkpointDigestPair;
      if(rootRead?.readPurpose===CHECKPOINT_PAIR_READ&&rootRead.current===true&&pair&&
        entry?.projectSha256===pair.projectSha256&&entry?.workSha256===pair.workSha256&&
        descriptor?.projectSha256===pair.projectSha256&&descriptor?.workSha256===pair.workSha256&&
        rootRead.digest===pair.projectSha256&&unchangedVerifiedProject(rootRead,rootRead.project,rootRead.digest)&&checkpointPairMatches(pair,rootRead.project))measuredPair=pair;
    }catch{} // Ineligible computation keeps the original decoder/error order.
    if(!measuredPair)return decodeCheckpoint(jobId,entry,undefined,readSnapshot);
    // The decoder still reads/authenticates every byte and compares this pair
    // with the actual parsed root before using either digest. All static,
    // current compatibility, artifact, view and source checks remain in place.
    const saved=await decodeCheckpoint(jobId,entry,undefined,readSnapshot,new Map(),new Map(),null,null,null,null,measuredPair);
    // Match append's existing post-await boundary: no exposed current value or
    // changed primitive can retain a borrowed digest after full validation.
    if(!checkpointPairMatches(measuredPair,rootRead.project)||!checkpointPairMatches(measuredPair,saved.project))throw storageError('Checkpoint digest input changed during verification.','HISTORY_VERSION_MISMATCH');
    return saved;
  }
  // The existing one-use private root supplies computation, never byte custody
  // or current compatibility. Reread and hash each referenced part in this read.
  if(descriptor.projectParts){
    assertHistoryProjectParts(descriptor.projectParts);const checked=new Map();
    for(const part of descriptor.projectParts.entries){
      if(checked.has(part.sha256)){if(checked.get(part.sha256)!==part.byteSize)throw storageError('Saved project content sizes conflict.','HISTORY_VERSION_MISMATCH');continue;}
      const file=await metaGet(historyFileKey(jobId,part.sha256));
      if(!(file?.blob instanceof Blob)||file.blob.size!==part.byteSize||await hash.sha256Bytes(file.blob)!==part.sha256)throw storageError('Saved project contents are missing or corrupt. The current version is preserved.','HISTORY_FILE_INTEGRITY_FAILED');
      checked.set(part.sha256,part.byteSize);
    }
  }
  const body=await readCheckpointBody(jobId,entry,readSnapshot,new Map(),false,undefined,new Map(),null,null,proof);
  const saved=await validateCheckpointArtifacts(jobId,body,sha=>metaGet(historyFileKey(jobId,sha)),null,null,null,false);
  if(!usableRootContinuation(proof,rootRead,descriptor))throw storageError('Retained checkpoint computation changed during verification.','HISTORY_VERSION_MISMATCH');
  return saved;
}
// A private diagnostic observation, never a saved-version activation receipt.
// Every existing check still runs; only one coherent stale work preimage may
// be retained as an issue while the remaining full validation completes.
async function inspectRetainedCheckpoint(jobId,checkpointId,state=null,readFile=sha=>metaGet(historyFileKey(jobId,sha)),snapshotReader=null,verifiedParts=new Map(),verifiedByteDigests=null){
  const readers=await retainedCheckpointReaders(jobId,checkpointId,state),readSnapshot=snapshotReader||readers.readSnapshot,entry=await readSnapshot(checkpointId);
  const inspection={issues:[],workFacts:new Map(),bodies:new Map()};
  const body=await readCheckpointBody(jobId,entry,readSnapshot,new Map(),false,readFile,verifiedParts,verifiedByteDigests,inspection);
  let checked;
  for(const [id,materialized] of inspection.bodies){
    const full=await validateCheckpointArtifacts(jobId,materialized,readFile,verifiedByteDigests,null,null);
    if(id===entry.id)checked=full;
  }
  const fact=inspection.workFacts.get(entry.id);
  // Do not expose a decoded project, view or eligible-root cache. Facts retain
  // original declarations separately from actual measured source identities.
  return {checkpointId:entry.id,activationPermitted:false,integrityValid:inspection.issues.length===0,
    issues:inspection.issues.map(issue=>({...issue})),snapshotSha256:entry.sha256,
    byteSize:entry.byteSize,descriptorSha256:hash.sha256Value((({blob,...descriptor})=>descriptor)(entry)),
    projectSha256:body.projectSha256,declaredWorkSha256:body.workSha256,
    measuredWorkSha256:fact.measuredWorkSha256,artifactManifestSha256:historyArtifactsSha256(checked.artifacts),
    viewSha256:hash.sha256Value(body.view),artifactCount:checked.artifacts.length};
}
async function readCheckpointBody(jobId,entry,readSnapshot,validatedRoots=new Map(),inlineOnly=false,readFile=sha=>metaGet(historyFileKey(jobId,sha)),verifiedParts=new Map(),verifiedByteDigests=null,inspection=null,rootContinuation=null,measuredPair=null,rootBytes=null){
  if(!entry?.blob||entry.blob.size!==Number(entry.byteSize)||(consumeCheckpointByteObservation(entry,rootBytes)||await historyBlobSha256(entry.blob,verifiedByteDigests))!==entry.sha256)throw storageError('This saved version is missing or corrupt. The current project is preserved.','HISTORY_SNAPSHOT_INTEGRITY_FAILED');
  const {payload,fileContents}=await readPackageJson(entry.blob,{spoolArtifacts:false}),{packageSha256,...body}=payload;
  if(await hash.sha256Chunks(packageJsonChunks(body,fileContents))!==packageSha256||body.schema!==HISTORY_SCHEMA||body.id!==entry.id||body.jobId!==String(jobId)||body.projectSha256!==entry.projectSha256||body.parentId!==entry.parentId||body.label!==entry.label||body.createdAt!==entry.createdAt||Number(body.view?.activeStage)!==Number(entry.stage)||!Array.isArray(body.artifacts))throw storageError('Saved project identity or contents do not match the checkpoint.','HISTORY_VERSION_MISMATCH');
  if(hash.sha256Value(body.projectReference||null)!==hash.sha256Value(entry.projectReference||null))throw storageError('Saved project reference does not match its checkpoint.','HISTORY_VERSION_MISMATCH');
  if(hash.sha256Value(body.projectParts||null)!==hash.sha256Value(entry.projectParts||null))throw storageError('Saved project contents do not match their checkpoint.','HISTORY_VERSION_MISMATCH');
  let project=body.project,verifiedProjectSha256,verifiedWorkSha256;
  if(body.projectReference){
    const reference=body.projectReference;
    if(inlineOnly||Object.hasOwn(body,'project')||body.projectParts||reference.schema!==HISTORY_PROJECT_REFERENCE||Object.keys(reference).some(key=>!['schema','checkpointId','snapshotSha256'].includes(key))||typeof reference.checkpointId!=='string'||!reference.checkpointId||reference.checkpointId===entry.id||!/^[a-f0-9]{64}$/.test(reference.snapshotSha256||''))throw storageError('Saved project reference is not a supported inline-body reference.','HISTORY_VERSION_MISMATCH');
    let base=validatedRoots.get(reference.checkpointId);
    if(!base?.project){
      const retained=await readSnapshot(reference.checkpointId);
      if(!retained)throw storageError('The retained project body required by this checkpoint is unavailable.','HISTORY_PROJECT_REFERENCE_UNAVAILABLE');
      if(retained.projectReference||retained.id!==reference.checkpointId||retained.sha256!==reference.snapshotSha256||retained.projectSha256!==body.projectSha256)throw storageError('Saved project reference identifies incompatible retained contents.','HISTORY_VERSION_MISMATCH');
      const decoded=await readCheckpointBody(jobId,retained,readSnapshot,validatedRoots,true,readFile,verifiedParts,verifiedByteDigests,inspection,rootContinuation,measuredPair);
      base={snapshotSha256:retained.sha256,project:decoded.project,projectSha256:decoded.projectSha256,workSha256:inspection?.workFacts.get(retained.id)?.measuredWorkSha256||decoded.workSha256||historyWorkSha256(decoded.project)};if(!inspection?.issues.length)validatedRoots.set(reference.checkpointId,base);
    }
    if(base.snapshotSha256!==reference.snapshotSha256||base.projectSha256!==body.projectSha256)throw storageError('Saved project reference does not match its verified project body.','HISTORY_VERSION_MISMATCH');
    project=base.project;verifiedProjectSha256=base.projectSha256;verifiedWorkSha256=base.workSha256;
  }else{
    const verifiedRoot=validatedRoots.get(entry.id);
    if(verifiedRoot){
      if(verifiedRoot.snapshotSha256!==entry.sha256||verifiedRoot.projectSha256!==body.projectSha256)throw storageError('Saved project root does not match its verified bytes.','HISTORY_VERSION_MISMATCH');
      // A previous materialization may have been released. Reconstruct it
      // from this same verified snapshot and immutable decoded parts, without
      // redoing the canonical-root validation or borrowing another version.
      project=verifiedRoot.project||await restoreHistoryProject(body,readFile,verifiedParts,verifiedByteDigests);
      if(projectIdentity(project)!==String(jobId))throw storageError('Saved project belongs to another job.','HISTORY_VERSION_MISMATCH');
      verifiedProjectSha256=verifiedRoot.projectSha256;verifiedWorkSha256=verifiedRoot.workSha256;
    }else if(!inspection&&rootContinuation&&rootCertificates.has(rootContinuation)&&verifiedValuesEqual(rootContinuation.descriptor,(({blob,...descriptor})=>descriptor)(entry))&&verifiedValuesEqual(rootContinuation.snapshot,rootContinuation.project)&&rootDigestPrimitivesUnchanged(rootContinuation.primitive)){
      project=rootContinuation.project;verifiedProjectSha256=rootContinuation.projectSha256;verifiedWorkSha256=rootContinuation.workSha256;
      recoveryBodyStaticIntegrity.delete(rootContinuation.project);
    }else{
      project=await restoreHistoryProject(body,readFile,verifiedParts,verifiedByteDigests);
      if(projectIdentity(project)!==String(jobId))throw storageError('Saved project belongs to another job.','HISTORY_VERSION_MISMATCH');
      ({projectSha256:verifiedProjectSha256,workSha256:verifiedWorkSha256}=checkpointPairMatches(measuredPair,project)?measuredPair:historyProjectDigests(project));
      if(inspection){
        try{assertProjectIntegrity(project,{verifyDerived:false});}catch(error){if(!legacyJobPointerProjection(project,{verifyDerived:false}))throw error;}
      }else{
        try{assertProjectIntegrity(project,{verifyDerived:false});recoveryBodyStaticIntegrity.set(project,verifiedProjectIntegrity(project,verifiedProjectSha256));}catch(error){if(!legacyJobPointerProjection(project,{verifyDerived:false}))throw error;}
      }
    }
  }
  if(body.projectSha256!==verifiedProjectSha256)throw storageError('Saved canonical project bytes do not match their checkpoint identity.','HISTORY_VERSION_MISMATCH');
  if(entry.viewSha256&&entry.viewSha256!==hash.sha256Value(body.view))throw storageError('Saved view identity does not match its checkpoint.','HISTORY_VERSION_MISMATCH');
  if(inspection){
    if(typeof body.workSha256!=='string'||!/^[a-f0-9]{64}$/.test(body.workSha256)||body.workSha256!==entry.workSha256)throw storageError('Saved work identity does not match its complete project.','HISTORY_VERSION_MISMATCH');
    inspection.workFacts.set(entry.id,{measuredWorkSha256:verifiedWorkSha256});
  }
  if(!inspection){
  if(body.workSha256!==entry.workSha256||(body.workSha256&&body.workSha256!==verifiedWorkSha256))throw storageError('Saved work identity does not match its complete project.','HISTORY_VERSION_MISMATCH');
  }else if(body.workSha256!==entry.workSha256||(body.workSha256&&body.workSha256!==verifiedWorkSha256)){
    const error=storageError('Saved work identity does not match its complete project.','HISTORY_VERSION_MISMATCH');
    // Descriptor disagreement or malformed/empty identity is not the one
    // supported diagnostic continuation. Normal reads keep the exact refusal.
    if(body.workSha256!==entry.workSha256||!/^[a-f0-9]{64}$/.test(body.workSha256||''))throw error;
    inspection.issues.push({checkpointId:entry.id,code:error.code,message:error.message,
      declaredWorkSha256:body.workSha256,measuredWorkSha256:verifiedWorkSha256});
  }
  if(body.artifactManifestSha256!==entry.artifactManifestSha256||(body.artifactManifestSha256&&body.artifactManifestSha256!==historyArtifactsSha256(body.artifacts)))throw storageError('Saved file inventory does not match its checkpoint.','HISTORY_VERSION_MISMATCH');
  // Keep only roots that this immutable import actually references. Both
  // root-first and reference-first archive orders share the same validation.
  // Snapshot, descriptor, view and file checks still run for every checkpoint.
  if(!body.projectReference&&validatedRoots.has(entry.id)&&!inspection?.issues.length)validatedRoots.set(entry.id,{snapshotSha256:entry.sha256,project,projectSha256:verifiedProjectSha256,workSha256:verifiedWorkSha256});
  if(!body.projectReference)recoveryProjectionBounds.set(project,body.createdAt);
  const materialized={...body,project};if(inspection)inspection.bodies.set(entry.id,materialized);
  return materialized;
}
async function decodeCheckpoint(jobId,entry,readFile=sha=>metaGet(historyFileKey(jobId,sha)),readSnapshot=id=>metaGet(snapshotKey(jobId,id)),validatedRoots=new Map(),verifiedParts=new Map(),verifiedByteDigests=null,validatedProjections=null,verifiedSources=null,rootContinuation=null,measuredPair=null,rootBytes=null){
  // Reuse pure digest computation only during this fresh parser-owned decode.
  // Existing import scopes and retained-root continuations keep their owners;
  // no validation, byte-custody, or activation result is borrowed or retained.
  const holder=!rootContinuation&&!verifiedByteDigests&&!validatedRoots.size&&!verifiedParts.size&&!importDigestHolders.has(verifiedParts)?{scope:null,attempted:false,privateRead:true}:null;
  if(holder)importDigestHolders.set(verifiedParts,holder);
  try{
    const body=await readCheckpointBody(jobId,entry,readSnapshot,validatedRoots,false,readFile,verifiedParts,verifiedByteDigests,null,rootContinuation,measuredPair,rootBytes);
    return await validateCheckpointArtifacts(jobId,body,readFile,verifiedByteDigests,validatedProjections,verifiedSources,rootContinuation&&body.project===rootContinuation.project);
  }finally{
    if(holder){if(holder.scope)hash.disposeCanonicalDigestScope(holder.scope);importDigestHolders.delete(verifiedParts);}
  }
}
async function validateCheckpointArtifacts(jobId,body,readFile,verifiedByteDigests=null,validatedProjections=null,verifiedSources=null,deferCompatibility=false){
  const artifacts=[],ids=new Set();
  for(const descriptor of body.artifacts){
    if(ids.has(descriptor.artifactId)||descriptor.jobId!==String(jobId))throw storageError('Saved file relationships do not belong to one complete project.','HISTORY_VERSION_MISMATCH');ids.add(descriptor.artifactId);
    const file=await readFile(descriptor.sha256);
    if(!(file?.blob instanceof Blob)||file.blob.size!==descriptor.byteSize||await historyBlobSha256(file.blob,verifiedByteDigests)!==descriptor.sha256)throw storageError(`Cannot restore ${descriptor.filename}: its saved bytes are missing or corrupt.`,'HISTORY_FILE_INTEGRITY_FAILED');
    artifacts.push({...descriptor,blob:file.blob});
  }
  // A view reference does not change its verified canonical project or file
  // inventory. Reuse completed deterministic projection validation only within
  // this immutable import, after the current checkpoint and bytes are checked.
  // Ordinary History reads validate anew; no receipt survives an import.
  const projectionKey=validatedProjections?JSON.stringify([body.projectSha256,historyArtifactsSha256(artifacts)]):null;
  if(!deferCompatibility&&!validatedProjections?.has(projectionKey)){
    await hydrateLegacyRunPromptContexts(body.project,artifacts);
    withVerifiedRecoveryCustody(artifacts,()=>assertRecoveryCompatibility(body.project));
    validatedProjections?.add(projectionKey);
  }
  assertPackageArtifactCustody(body.project,artifacts);await verifyOriginalSourceBindings(body.project,artifacts,verifiedSources);assertRecoveryViewFiles(jobId,body.view,artifacts);if(body.view?.pendingMutation&&body.view.pendingMutation.baseProjectSha256!==body.projectSha256)throw storageError('Saved draft correction belongs to another version.','HISTORY_VERSION_MISMATCH');
  return {...body,artifacts};
}
function bindRestoredCandidates(next,saved,checkpointId,view=null){
  // Only response bytes already present in this complete checkpoint may be
  // revalidated locally. A newly arriving response never acquires this binding.
  const proposals=saved.projectData?.responseProposals||[],raws=saved.projectData?.rawResponses||[];
  next.restoredCandidates={activationId:next.historyActivationId,activationRevision:next.revision,checkpointId,sourceProjectSha256:projectSha256(saved),proposals:{},rawResponses:{},selectedFiles:{}};
  for(const raw of raws){if(!['PRESERVED','VALIDATION_FAILED','VALIDATED_PENDING_REVIEW'].includes(raw.status)||hash.sha256Text(raw.completeRawResponse)!==raw.sha256)continue;next.restoredCandidates.rawResponses[raw.rawResponseId]={rawResponseId:raw.rawResponseId,rawSha256:raw.sha256,promptId:raw.promptInstructionId,sourceRevision:Number(raw.promptScope?.projectRevision)};}
  for(const selection of Object.values(view?.fileSelections||{})){if(selection.kind!=='response'||selection.jobId!==projectIdentity(saved)||!selection.promptId)continue;for(const file of selection.files)next.restoredCandidates.selectedFiles[file.artifactId]={rawSha256:file.sha256,promptId:selection.promptId,stage:selection.stage,sourceRevision:Number((saved.projectData?.generatedPrompts||[]).find(prompt=>(prompt.instructionId||prompt.promptId)===selection.promptId)?.scope?.projectRevision)};}
  for(const proposal of proposals){
    if(proposal.status!=='PENDING_OPERATOR_REVIEW'||proposal.invalidatedBy)continue;
    const raw=raws.find(row=>row.rawResponseId===proposal.rawResponseId);
    if(raw&&hash.sha256Text(raw.completeRawResponse)===raw.sha256)next.restoredCandidates.proposals[proposal.proposalId]={proposalSha256:hash.sha256Value(proposal),rawResponseId:raw.rawResponseId,rawSha256:raw.sha256,promptId:proposal.promptId,sourceRevision:Number(proposal.preconditions?.projectRevision)};
  }
}
function rebaseHistoryView(project,view){
  if(!view?.pendingMutation)return view;
  const restored=clone(view),pending=restored.pendingMutation,digest=projectSha256(project);
  if(pending.baseProjectSha256!==digest&&pending.baseProjectSha256!==project.restoredCandidates?.sourceProjectSha256)throw storageError('The saved correction belongs to another project version.','HISTORY_VERSION_MISMATCH');
  const candidate=pending.next;candidate.revision=project.revision;candidate.historyActivationId=project.historyActivationId||null;delete candidate.projectSha256;
  if(project.restoredCandidates)candidate.restoredCandidates=clone(project.restoredCandidates);else delete candidate.restoredCandidates;
  restored.pendingMutation={baseProjectSha256:digest,next:candidate,impact:mutationImpact(project,candidate),expectedProjectRevision:project.revision,...(pending.acceptance?{acceptance:pending.acceptance}:{})};
  return restored;
}
async function restoreCheckpoint(jobId,checkpointId,{expectedProjectRevision,signal=null,mode='HISTORY',operationId=null}={}){
  hash.assertPinnedUnicodeHost();
  // No command is replayed. The saved project and its exact files are verified
  // before the sole activation transaction is opened.
  let priorPhysical={};let prior;try{prior=await readProject(jobId,{[PHYSICAL_SOURCE_CAPTURE]:priorPhysical});}catch(error){if(!['PROJECT_HASH_MISMATCH','PROJECT_REVISION_MISMATCH','PROJECT_INTEGRITY_FAILED','OPERATIONAL_STATE_INTEGRITY_FAILED'].includes(error.code))throw error;prior=null;}
  const state=await metaGet(historyKey(jobId));
  if(!state?.entries.some(entry=>entry.id===checkpointId))throw storageError('That saved version is unavailable in this project.','HISTORY_VERSION_UNAVAILABLE');
  const priorRevision=Number(prior?.revision??state.activeRevision??0);
  if(expectedProjectRevision!==undefined&&priorRevision!==Number(expectedProjectRevision))throw storageError('Project changed before restoration. Reload the current version.','STALE_PROJECT_REVISION');
  let saved=await readRetainedCheckpoint(jobId,checkpointId,state);await verifyHistorySourceArchives(state);
  if(signal?.aborted)throw storageError('A newer navigation replaced this restore.','RESTORE_INTERRUPTED');
  fault('before-history-restore');
  let next=clone(saved.project);next.revision=Math.max(priorRevision,Number(saved.project.revision))+1;next.historyActivationId=crypto.randomUUID();delete next.projectSha256;bindRestoredCandidates(next,saved.project,checkpointId,saved.view);
  // The immutable saved version stays unchanged. Activation is a new revision
  // and observes current readiness, never an expired favorable cache.
  withVerifiedRecoveryCustody(saved.artifacts,()=>{
    // The checkpoint was validated before activation. Preserve its release
    // evidence, but do not carry stale release authority into the new branch.
    const engine=globalThis.closedLoopWorkflowEngine,binding=engine.releaseBinding(next);
    for(const record of engine.records(next,'releaseRecords'))if(!engine.releaseRecordMatchesBinding(record,binding)){
      record.active=false;record.validity='SUPERSEDED';record.invalidatedBy='HISTORY_ACTIVATION_CHANGED';
      engine.refreshRecordHashes(record,'releaseRecords');
    }
    next=recalculateChangedProjection(next,{sourceProjectSha256:saved.projectSha256});assertProjectIntegrity(next);
  });const digest=projectSha256(next),updated=clone(state);
  updated.activeId=checkpointId;updated.activeProjectSha256=digest;updated.activeRevision=next.revision;updated.activeViewOverride=rebaseHistoryView(next,saved.view);updated.title=String(next.job?.JOB_TITLE||'');updated.removed=false;updated.generation=Number(state.generation)+1;
  if(mode==='UNDO')updated.redo=[state.activeId,...state.redo.filter(id=>id!==state.activeId)];else if(mode==='REDO')updated.redo=state.redo.filter(id=>id!==checkpointId);else updated.redo=[];
  const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite');
  try{
    const projects=tx.objectStore(PROJECTS),files=tx.objectStore(ARTIFACTS),meta=tx.objectStore(META);let current=await projectRowWithOperations(tx,jobId,null,prior?priorPhysical:null),currentHistory=await request(meta.get(historyKey(jobId)));
    if(current?.projectSha256!==prior?.projectSha256||Number(currentHistory?.value?.generation)!==Number(state.generation))throw storageError('Another tab changed this project during restoration. The newer work is preserved.','STALE_PROJECT_REVISION');
    // The fresh source and History CAS above have consumed these private reads.
    // Release local ownership only; no stored/caller/checkpoint values change.
    prior=null;priorPhysical=null;current=null;currentHistory=null;
    const present=await request(files.index('jobId').getAll(String(jobId)));
    const restoredArtifacts=saved.artifacts;saved=null;
    for(const row of restoredArtifacts){const existing=await request(files.get(row.artifactId));if(existing&&existing.jobId!==String(jobId))throw storageError('A restored file identity belongs to another project.','CROSS_PROJECT_ARTIFACT_ID_COLLISION');}
    if(signal?.aborted)throw storageError('A newer navigation replaced this restore.','RESTORE_INTERRUPTED');
    for(const row of present)files.delete(row.artifactId);for(const row of restoredArtifacts){await storeArtifactRow(tx,row);const staged=row.lineage?.stagedResponse;if(staged)meta.put({key:`responseStaging:${jobId}:${staged.stagingId}`,value:await sharedByteRecord(tx,{...staged,blob:row.blob}),updatedAt:now()});}
    const restoredRow={jobId:String(jobId),revision:next.revision,picker:projectPickerKey(next),project:next,projectSha256:digest,updatedAt:now()},physicalWrite=await preparePhysicalRowPut(tx,restoredRow,PROJECTS,'project'),journalRemoval=await preparePhysicalRowRemoval(tx,META,operationalKey(jobId),'value');
    if(signal?.aborted)throw storageError('A newer navigation replaced this restore.','RESTORE_INTERRUPTED');
    fault('during-history-restore');commitPhysicalRowPut(tx,physicalWrite,restoredRow);commitPhysicalRowRemoval(tx,journalRemoval);
    meta.put({key:historyKey(jobId),value:updated,updatedAt:now()});await updateRecoveryCatalog(meta,updated);meta.put({key:'selectedProject',value:String(jobId),updatedAt:now()});meta.put({key:'lastCommittedRevision',value:{jobId:String(jobId),revision:next.revision,projectSha256:digest},updatedAt:now()});recordWorkerCommit(tx,operationId,next,digest);fault('before-history-restore-commit');await complete(tx);
    next.projectSha256=digest;await listArtifacts(jobId);notifyProjectChange(next,{restored:true});return {project:next,view:updated.activeViewOverride,checkpointId};
  }catch(error){try{tx.abort();}catch{}throw error;}
}

async function persistProjectPromptFiles(project){const prompts=globalThis.closedLoopPromptEngine;await persistPromptContextRecords((project.projectData?.generatedPrompts||[]).filter(record=>!record.invalidatedBy&&record.promptEngineVersion===(prompts?.versionFor?.(record.stage,record.operation)||prompts?.version)),project);}
// Section 34/38: correcting an append-only definition creates a new record.
// Application lifecycle/status consequences remain with their declared owner;
// the original authored content and original identity cannot be overwritten.
const APPEND_ONLY_CANONICAL_WRITE=Symbol('ordinary append-only definition write');
function assertAppendOnlyDefinitionPreservation(prior,next){
 if(!prior)return;
 const schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine;
 for(const [family,definition] of Object.entries(schema.RECORD_SCHEMAS)){
  if(definition.commitPolicy!==schema.COLLECTION_POLICIES.APPEND_ONLY)continue;
  const names=schema.recordAgentFields(family);if(!names.length)continue;
  const byId=new Map((next.projectData?.[family]||[]).map(row=>[engine.recordId(row,family),row]));
  const authored=record=>names.map(name=>({name,
   ...(Object.hasOwn(record.fields||{},name)?{field:record.fields[name]}:{}),
   ...(Object.hasOwn(record,name)?{mirror:record[name]}:{})
  }));
  for(const record of prior.projectData?.[family]||[]){
   const id=engine.recordId(record,family),retained=byId.get(id);
   if(!retained||!equivalent(authored(record),authored(retained)))throw storageError(`Append-only ${family} definition ${id} must be retained; correct it through a new superseding record.`,'APPEND_ONLY_RECORD_MUTATED');
  }
 }
}

async function writeProjectRow(project,tx,{expectedProjectRevision=null,incrementRevision=true,createOnly=false,skipUnchanged=false,selectProject=true,operationId=null,preparedHistory=null,expectedStateSha256=null,projectAllocation=null,creation=null,initialMobileAcceptanceSession=null,[APPEND_ONLY_CANONICAL_WRITE]:appendOnlyWrite=false,[VERIFIED_CANONICAL_WRITE]:preparedProof=null}={}){
  const id=projectIdentity(project);if(!id)throw new Error('A project without a JOB_ID cannot be committed.');
  const store=tx.objectStore(PROJECTS),prior=await projectRowWithOperations(tx,id,preparedProof?.read),currentRevision=Number(prior?.revision||0);
  if(createOnly&&prior)throw storageError(`Project ${id} already exists and was not replaced.`,'PROJECT_ALREADY_EXISTS');
  if(preparedProof&&!preparedProof.read&&prior)throw storageError('A project appeared after this new project was prepared. The newer state is preserved.','STALE_PROJECT_REVISION');
  if(creation){
    if(!createOnly||!projectAllocation||creation.receipt.resultingJobId!==id)throw storageError('The copy is not bound to this project creation.','CLONE_BINDING_INVALID');
    const source=await projectRowWithOperations(tx,creation.receipt.sourceJobId),meta=tx.objectStore(META),files=tx.objectStore(ARTIFACTS);
    if(!source||source.projectSha256!==creation.receipt.sourceProjectSha256)throw storageError('The source project changed before the copy could be saved. Select the current source and retry.','STALE_PROJECT_REVISION');
    const previous=await request(meta.get(creation.receiptKey));
    if(previous)throw storageError('This copy command already completed. Retry the same command to retrieve its result.','CLONE_ALREADY_COMMITTED');
    validateCloneReceipt(creation.receiptKey,creation.receipt,id);
    for(const mapping of creation.receipt.mappingManifest.files){
      const sourceFile=await request(files.get(mapping.sourceArtifactId)),copied=creation.artifacts.find(row=>row.artifactId===mapping.artifactId);
      if(!sameCopiedFileIdentity(sourceFile,{...mapping,artifactId:mapping.sourceArtifactId})||sourceFile.jobId!==source.jobId||!sameCopiedFileIdentity(copied,mapping)||copied.jobId!==id||await request(files.get(mapping.artifactId)))throw storageError('A source file changed before the copy could be saved. Restore or reselect the source file and retry.','CLONE_FILE_CHANGED');
      await storeArtifactRow(tx,copied);
    }
    await commitHistory(tx,creation.sourceHistory);
    meta.put({key:creation.receiptKey,value:creation.receipt,updatedAt:now()});
  }
  if(projectAllocation){
    const allocationStore=tx.objectStore(META),stored=(await request(allocationStore.get('canonicalProjectAllocation')))?.value;
    if(Number(stored?.generation||0)!==projectAllocation.expectedGeneration)throw storageError('Another project was created while this one was being prepared.','PROJECT_ALLOCATION_CONFLICT');
    const receipt=projectAllocation.state.receipts.at(-1);
    const previous=stored||{generation:0,sequence:0,receipts:[]},proposed=projectAllocation.state;
    if(proposed.generation!==previous.generation+1||proposed.sequence!==previous.sequence+1||receipt?.allocationSequence!==proposed.sequence||proposed.receipts.length!==previous.receipts.length+1||previous.receipts.some((row,index)=>hash.sha256Value(row)!==hash.sha256Value(proposed.receipts[index]))||previous.receipts.some(row=>row.commandId===receipt?.commandId))throw storageError('The project creation cannot rewrite retained allocation receipts.','PROJECT_ALLOCATION_INVALID');
    if(!createOnly||prior||receipt?.resultingId!==id||!project.projectData.allocationReceipts.some(row=>hash.sha256Value(row)===hash.sha256Value(receipt)))throw storageError('The project allocation is not bound to this creation.','PROJECT_ALLOCATION_INVALID');
    allocationStore.put({key:'canonicalProjectAllocation',value:clone(projectAllocation.state),updatedAt:now()});
  }
  if(expectedStateSha256&&expectedStateSha256!==prior?.projectSha256)throw storageError('Project or pending response changed before commit.','STALE_PROJECT_REVISION');
  if(expectedProjectRevision!==null&&Number(expectedProjectRevision)!==currentRevision)throw storageError(`Project revision conflict for ${id}: expected ${expectedProjectRevision}, found ${currentRevision}.`,'STALE_PROJECT_REVISION');
  if(preparedProof&&!unchangedVerifiedProject(preparedProof.integrity,project,preparedProof.digest))throw storageError('The prepared project changed before commit. Prepare the current candidate again.','STALE_PROJECT_REVISION');
  const next=clone(project);delete next.projectSha256;
  if(appendOnlyWrite)assertAppendOnlyDefinitionPreservation(prior?.project,next);
  const preparedDigest=preparedProof?.digest;
  // clone() preserves retained prompt contexts through a replaceable hook.
  // The source receipt alone cannot certify that hook's actual output, or
  // mutations of a captured output during later validation/History awaits.
  const assertPreparedClone=()=>{if(preparedProof&&!verifiedValuesEqual(preparedProof.integrity.snapshot,next))throw storageError('The prepared project clone changed before commit. Prepare the current candidate again.','STALE_PROJECT_REVISION');};
  if(skipUnchanged&&prior?.projectSha256===(preparedDigest||projectSha256(next))){if(preparedHistory)await commitHistory(tx,preparedHistory);assertPreparedClone();next.projectSha256=prior.projectSha256;recordWorkerCommit(tx,operationId,next,next.projectSha256);return next;}
  next.revision=(incrementRevision??Boolean(prior))?currentRevision+1:currentRevision;
  // The private candidate was derived before checkpoint encoding. Recheck its
  // authority here without changing time-bearing cached projections.
  if(preparedProof&&Number(project.revision)===Number(next.revision)){
    // Type/reference/receipt validation is bound to the private unchanged value.
    // Current time, custody and capability observations still recalculate here.
    const issues=derivedProjectIntegrityIssues(next);
    if(issues.length)throw Object.assign(storageError('Canonical project integrity validation failed: '+issues.join(' | '),'PROJECT_INTEGRITY_FAILED'),{issues});
  }else assertProjectIntegrity(next,{prior:prior?.project});
  globalThis.closedLoopWorkflowEngine.validateAllocationReceipts(next,prior?.project);
  // The private proof covers this exact prepared revision; other callers still
  // compute their own digest after assigning the committed revision.
  const reusePreparedDigest=Boolean(preparedDigest&&Number(project.revision)===Number(next.revision)),digest=reusePreparedDigest?preparedDigest:projectSha256(next);
  if(initialMobileAcceptanceSession){
    if(!createOnly||prior||Object.hasOwn(initialMobileAcceptanceSession,'initialProjectPackage')||Object.hasOwn(initialMobileAcceptanceSession,'preparation'))throw storageError('A mobile acceptance session must be created atomically with its new project, before capturing its initial package.','MOBILE_ACCEPTANCE_CREATION_INVALID');
    const initialProjectState={revision:next.revision,projectSha256:digest};if(Object.hasOwn(initialMobileAcceptanceSession,'initialProjectState')&&!equivalent(initialMobileAcceptanceSession.initialProjectState,initialProjectState))throw storageError('The initial mobile project identity does not match the newly committed project.','MOBILE_ACCEPTANCE_CREATION_INVALID');
    await metaPut('stage30MobileAcceptance.v1:'+id,{...clone(initialMobileAcceptanceSession),initialProjectState},tx);fault('during-mobile-acceptance-session-write');
  }
  if(!preparedHistory||preparedHistory.state.activeProjectSha256!==digest)throw storageError('The required checkpoint was not prepared for this exact change.','HISTORY_CHECKPOINT_REQUIRED');
  const committedRow={jobId:id,revision:next.revision,picker:projectPickerKey(next),project:next,projectSha256:digest,updatedAt:now()},physicalWrite=await preparePhysicalRowPut(tx,committedRow,PROJECTS,'project'),journalRemoval=await preparePhysicalRowRemoval(tx,META,operationalKey(id),'value');
  await commitHistory(tx,preparedHistory);fault('during-project-write');
  // Keep this after existing checks and the last await, directly before the
  // native put clones the canonical row. Earlier writes share this transaction
  // and are aborted by the caller if the private preimage no longer matches.
  if(reusePreparedDigest)assertPreparedClone();const committedStorage=commitPhysicalRowPut(tx,physicalWrite,committedRow);commitPhysicalRowRemoval(tx,journalRemoval);
  if(preparedProof){preparedProof.committedRow=copyVerifiedTree(committedRow);preparedProof.committedStorage={row:committedStorage,journal:null};}
  if(selectProject)tx.objectStore(META).put({key:'selectedProject',value:id,updatedAt:now()});tx.objectStore(META).put({key:'lastCommittedRevision',value:{jobId:id,revision:next.revision,projectSha256:digest},updatedAt:now()});
  recordWorkerCommit(tx,operationId,next,digest);
  return {...next,projectSha256:digest};
}
function notifyProjectChange(project,details={}){try{const channel=new BroadcastChannel('closed-loop-reliability');channel.postMessage({type:'PROJECT_CHANGED',jobId:projectIdentity(project),revision:project.revision,contextId:STORE_CONTEXT_ID,...details});channel.close();}catch{}}
// A replacement of obsolete unsubmitted instruction transport is not a
// replacement of accepted work. Require the complete retained old issuance and
// exact newly reserved same-slot issuance; all other loss still needs review.
function unansweredInstructionTransportReplacement(prior,next,row,replacement){
 const engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
 if(!prior||!replacement||!prompts?.promptTransportBinding||!['RESERVED','EXPORTED'].includes(String(engine.recordValue(row,'STATUS')))||String(engine.recordValue(replacement,'STATUS'))!=='SUPERSEDED')return false;
 const old=(prior.projectData?.generatedPrompts||[]).find(prompt=>!prompt.invalidatedBy&&prompt.operationReservationId===engine.recordId(row,'operationReservations'));
 const retained=old&&(next.projectData?.generatedPrompts||[]).find(prompt=>prompt.instructionId===old.instructionId),fresh=retained&&(next.projectData?.generatedPrompts||[]).find(prompt=>!prompt.invalidatedBy&&retained.invalidatedBy===`PROMPT-SUPERSEDED-${prompt.instructionId}`&&!prior.projectData.generatedPrompts.some(saved=>saved.instructionId===prompt.instructionId));
 if(!old||!retained||!fresh||fresh.promptEngineVersion!==(prompts.versionFor?.(fresh.stage,fresh.operation)||prompts.version)||old.promptEngineVersion===fresh.promptEngineVersion&&old.contractSha256===fresh.contractSha256)return false;
 const retainedBytes={...retained};delete retainedBytes.invalidatedBy;
 if(hash.sha256Value(retainedBytes)!==hash.sha256Value(old)||old.jobId!==fresh.jobId||old.jobId!==prior.job.JOB_ID||next.job.JOB_ID!==prior.job.JOB_ID||(old.historyActivationId||null)!==(fresh.historyActivationId||null)||(old.historyActivationId||null)!==(prior.historyActivationId||null)||(next.historyActivationId||null)!==(prior.historyActivationId||null)||old.stage!==fresh.stage||old.operation!==fresh.operation)return false;
 if([prior,next].some(project=>(project.projectData?.rawResponses||[]).some(raw=>raw.promptInstructionId===old.instructionId)||(project.projectData?.responseProposals||[]).some(proposal=>Number(proposal.stage)===Number(old.stage)&&!proposal.invalidatedBy&&['PENDING','PENDING_OPERATOR_REVIEW'].includes(String(proposal.status||proposal.state)))||(project.projectData?.acceptedChanges||[]).some(change=>!change.invalidatedBy&&change.promptId===old.instructionId&&change.status==='COMMITTED')))return false;
 const oldBinding=prompts.promptTransportBinding(prior,old.stage,old.operation,old.instructionId,old.scope),freshBinding=prompts.promptTransportBinding(next,fresh.stage,fresh.operation,fresh.instructionId,fresh.scope),withoutRevision=scope=>Object.fromEntries(Object.entries(scope||{}).filter(([key])=>key!=='projectRevision'));
 if(!oldBinding||!freshBinding||oldBinding.operationReservationId!==old.operationReservationId||oldBinding.packageId!==old.packageId||oldBinding.challengeNonce!==old.challengeNonce||freshBinding.operationReservationId!==fresh.operationReservationId||freshBinding.packageId!==fresh.packageId||freshBinding.challengeNonce!==fresh.challengeNonce||oldBinding.targetSlot!==freshBinding.targetSlot||oldBinding.targetSlot!==engine.reservationTargetSlot(prior,old)||freshBinding.targetSlot!==engine.reservationTargetSlot(next,fresh)||Number(engine.recordValue(row,'EXPECTED_REVISION'))!==Number(prior.revision)||hash.sha256Value(withoutRevision(old.scope))!==hash.sha256Value(withoutRevision(fresh.scope)))return false;
 const freshReservation=(next.projectData?.operationReservations||[]).find(reservation=>engine.recordId(reservation,'operationReservations')===fresh.operationReservationId),former=clone(row);engine.transitionOperationReservation(former,'SUPERSEDED');
 const retainedMetadata=record=>Object.fromEntries(Object.entries(record||{}).filter(([key])=>!['sha256','recordSha256','contentSha256','updatedAt'].includes(key)));
 return String(engine.recordValue(freshReservation,'STATUS'))==='RESERVED'&&!prior.projectData.operationReservations.some(reservation=>engine.recordId(reservation,'operationReservations')===fresh.operationReservationId)&&hash.sha256Value(retainedMetadata(former))===hash.sha256Value(retainedMetadata(replacement));
}
const mutationImpactComparisonEngine=globalThis.closedLoopWorkflowEngine;
function mutationImpactComparisonEligible(project){
  const nodes=verifiedGraphNodes(project);
  if(!nodes)return false;
  // The comparison copier and original operational copier agree on this
  // ordinary domain. Custom array prototypes retain the original cold path.
  for(const value of nodes.keys())if(Array.isArray(value)&&Object.getPrototypeOf(value)!==Array.prototype)return false;
  return true;
}
function mutationImpact(prior,next,derivedNext=null){return globalThis.closedLoopWorkflowEngine.withReadinessEvaluationEpoch(()=>mutationImpactAtObservation(prior,next,derivedNext));}
function mutationImpactAtObservation(prior,next,derivedNext=null,verifiedCandidate=null){
  const engine=globalThis.closedLoopWorkflowEngine,affected=new Map(),replaces=[];
  // Normal analysis uses the full fresh derived graph, not a partial stage
  // overlay. Replaced authorities or unusual clone domains keep the old path;
  // canonical writers supplying derivedNext are deliberately unchanged.
  if(!derivedNext&&engine===mutationImpactComparisonEngine&&typeof engine.selectFreshProjectionComparison==='function'&&operationalCloneBindingCurrent()&&mutationImpactComparisonEligible(next))return engine.selectFreshProjectionComparison(next,comparison=>mutationImpactAtObservation(prior,next,comparison,verifiedCandidate));
  const candidate=next;next=derivedNext||cloneOperationalPatchValue(candidate);
  if(!derivedNext){engine.ensureShape(next);engine.recalculate(next);}
  const active=row=>row&&!row.invalidatedBy&&row.active!==false;
  const add=(stage,kind,id)=>{stage=Number(stage);if(!Number.isInteger(stage)||!globalThis.closedLoopWorkflowSchema.STAGE_CONTRACTS[stage])return;if(!affected.has(stage))affected.set(stage,{stage,work:[]});affected.get(stage).work.push({kind,id});};
  if(prior){
    for(const family of ['acceptedChanges','stageConfirmations'])for(const row of prior.projectData?.[family]||[]){
      if(!active(row))continue;
      if(family==='stageConfirmations'&&(!row.confirmed||row.inputVersion!==engine.inputVersionForStage(prior,row.stage)||!engine.acceptedChanges(prior,row.stage).some(change=>change.changeId===row.acceptedChangeId)))continue;
      const id=row.changeId||row.confirmationId||engine.recordId(row,family),replacement=(next.projectData?.[family]||[]).find(item=>(item.changeId||item.confirmationId||engine.recordId(item,family))===id);
      if(!active(replacement)){add(row.stage,family,id);replaces.push({kind:family,id});}
    }
    let priorAuthority=prior;
    if(Object.entries(prior.stages||{}).some(([number,before])=>before.status==='COMPLETE'&&next.stages?.[number]?.status!=='COMPLETE')){
      // Expired readiness may already have removed current stage authority;
      // refreshing that cache does not discard the accepted historical work.
      // Real loss is compared against canonical prior authority at this epoch.
      priorAuthority=clone(prior);engine.recalculate(priorAuthority);
    }
    for(const [number,before] of Object.entries(priorAuthority.stages||{})){
      const after=next.stages?.[number];if(!after)continue;
      if(before.status==='COMPLETE'&&after.status!=='COMPLETE')add(number,'completed stage',number);
    }
    const infrastructure={generatedPrompts:'instructionId',responseProposals:'proposalId',responseValidations:'validationId',humanInputRequests:'requestId',humanInputAnswers:'answerId',executionFailures:'executionFailureId'};
    for(const family of new Set([...Object.keys(globalThis.closedLoopWorkflowSchema.RECORD_SCHEMAS),...Object.keys(infrastructure)])){
      if(globalThis.closedLoopWorkflowSchema.RECORD_SCHEMAS[family]?.recomputedProjection)continue;
      const identity=row=>engine.recordId(row,family)||String(row?.[infrastructure[family]]||''),after=new Map((next.projectData?.[family]||[]).map(row=>[identity(row),row]));
      for(const row of prior.projectData?.[family]||[]){
        if(!active(row)||!engine.isActiveRecord(row))continue;const id=identity(row);if(!id)continue;const replacement=after.get(id);
        // Regenerating an instruction supersedes its old transport, while its
        // accepted result remains governed by the owning acceptance operation.
        if(family==='generatedPrompts'&&String(replacement?.invalidatedBy||'').startsWith('PROMPT-SUPERSEDED-'))continue;
        if(family==='operationReservations'&&unansweredInstructionTransportReplacement(prior,next,row,replacement))continue;
        if(!active(replacement)||!engine.isActiveRecord(replacement))add(row.stage??engine.recordValue(row,'STAGE')??globalThis.closedLoopWorkflowSchema.RECORD_SCHEMAS[family]?.stage,family,id);
      }
    }
  }
  const effect={jobId:projectIdentity(next),projectRevision:Number(prior?.revision||0),priorProjectSha256:prior?(prior.projectSha256||projectSha256(prior)):null,historyActivationId:prior?.historyActivationId||null,candidateSha256:unchangedVerifiedProject(verifiedCandidate,candidate,verifiedCandidate?.digest)?verifiedCandidate.digest:projectSha256(candidate),replaces,affected:[...affected.values()].sort((a,b)=>a.stage-b.stage)};
  return {...effect,stage:effect.affected[0]?.stage||Number(next.activeStage||1),requiresConfirmation:Boolean(affected.size),confirmationKey:hash.sha256Value(effect)};
}
function assertMutationConfirmation(prior,next,confirmation,derivedNext=null,verifiedCandidate=null){
  const impact=globalThis.closedLoopWorkflowEngine.withReadinessEvaluationEpoch(()=>mutationImpactAtObservation(prior,next,derivedNext,verifiedCandidate));
  if(impact.requiresConfirmation&&impact.confirmationKey!==confirmation?.confirmationKey){const error=storageError(confirmation?'The project or proposed correction changed. Review its updated effect.':'Review the correction and affected work before saving.','MUTATION_CONFIRMATION_REQUIRED');error.impact=impact;throw error;}
  return impact;
}
// Only this bounded application command can authorize its own deterministic
// stale-result retirement. The private symbol never crosses the RPC boundary;
// ordinary project replacement retains its operator confirmation requirement.
const NATIVE_PRODUCT_COMMAND_AUTHORITY=Symbol('native-product-command');
const VERIFIED_CANONICAL_WRITE=Symbol('private prepared canonical write');
function assertNativeProductCommand(command){
 const keys=['jobId','stage','results','expectedProjectRevision','expectedStateSha256','historyView'];
 if(!command||typeof command!=='object'||Array.isArray(command)||Object.keys(command).some(key=>!keys.includes(key))||typeof command.jobId!=='string'||!command.jobId.trim()||!Number.isInteger(command.stage)||!globalThis.closedLoopWorkflowSchema.NATIVE_PRODUCT_RESULT_CONTRACTS[command.stage]||!Number.isSafeInteger(command.expectedProjectRevision)||command.expectedProjectRevision<0||typeof command.expectedStateSha256!=='string'||!/^[a-f0-9]{64}$/.test(command.expectedStateSha256)||!Array.isArray(command.results)||!command.results.length)throw storageError('Native execution command has an invalid identity or result batch.','INVALID_NATIVE_PRODUCT_COMMAND');
 const seen=new Set();for(const item of command.results){if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['testId','runtimeResult','inputArtifacts'].includes(key))||typeof item.testId!=='string'||!item.testId||seen.has(item.testId)||!item.runtimeResult||typeof item.runtimeResult!=='object'||Array.isArray(item.runtimeResult)||!Array.isArray(item.inputArtifacts))throw storageError('Native execution results must contain unique test identities and their exact observations.','INVALID_NATIVE_PRODUCT_COMMAND');seen.add(item.testId);}
}
async function commitNativeProductResultsLocal(command,operationId=null){
 assertNativeProductCommand(command);command=clone(command);
 const prior=await readProject(command.jobId);
 if(!prior||Number(prior.revision)!==command.expectedProjectRevision||prior.projectSha256!==command.expectedStateSha256)throw storageError('The project changed while native tests were executing. Retained observations cannot replace a different revision.','STALE_PROJECT_REVISION');
 const next=clone(prior),engine=globalThis.closedLoopWorkflowEngine,productId=String(prior.job.CURRENT_PRODUCT_ID||'');
 // The engine is the single native-result owner. No caller-supplied candidate,
 // arbitrary mutation, human authority receipt or confirmation key is accepted.
 try{
  for(const item of command.results)engine.recordApplicationNativeProductResult(next,{stage:command.stage,testId:item.testId,productId,runtimeResult:item.runtimeResult,inputArtifacts:item.inputArtifacts});
  return await writeProject(next,{expectedProjectRevision:command.expectedProjectRevision,expectedStateSha256:command.expectedStateSha256,historyView:command.historyView,historyLabel:'Application-native test observations',operationId,[NATIVE_PRODUCT_COMMAND_AUTHORITY]:true});
 }catch(error){
  // A local rejection is not itself proof that the transaction did not commit.
  // Permit an exact retained-observation retry only after a successful read of
  // the unchanged source. A changed or unreadable state remains uncertain;
  // worker callers additionally use their durable operation receipt recovery.
  error.existingProjectsUnchanged=false;
  try{const retained=await readProject(command.jobId);error.existingProjectsUnchanged=Boolean(retained&&Number(retained.revision)===command.expectedProjectRevision&&retained.projectSha256===command.expectedStateSha256);}catch{}
  throw error;
 }
}
async function commitNativeProductResults(command){
 assertNativeProductCommand(command);
 if(useStoreWorker())return requestStoreWorker('COMMIT_NATIVE_PRODUCT_RESULTS',[command]);
 return commitNativeProductResultsLocal(command);
}
async function prepareProjectWrite(project,options={}){
  if(options.initialMobileAcceptanceSession!==undefined&&(!options.createOnly||!options.initialMobileAcceptanceSession||typeof options.initialMobileAcceptanceSession!=='object'||Array.isArray(options.initialMobileAcceptanceSession)))throw storageError('Initial mobile sessions require a create-only project transaction.','MOBILE_ACCEPTANCE_CREATION_INVALID');
  const candidate=clone(project),id=projectIdentity(candidate),verifiedRead=await readProjectForTransaction(id),prior=verifiedRead?.project,revision=Number(prior?.revision||0),next=copyVerifiedTree(candidate);globalThis.closedLoopPromptEngine?.copyRetainedPromptContextFiles?.(candidate,next);delete next.projectSha256;
  if(options.expectedProjectRevision!==undefined&&options.expectedProjectRevision!==null&&Number(options.expectedProjectRevision)!==revision)throw storageError('Project changed before its checkpoint could be prepared.','STALE_PROJECT_REVISION');
  if(options.createOnly&&prior)throw storageError('This project already exists.','PROJECT_ALREADY_EXISTS');
  if(options.expectedStateSha256&&options.expectedStateSha256!==prior?.projectSha256)throw storageError('Project or pending response changed before preparation.','STALE_PROJECT_REVISION');
  assertProjectCollectionShape(next);
  assertCanonicalFieldValues(next);
  assertJobPointerIntegrity(next,prior);
  if(options[APPEND_ONLY_CANONICAL_WRITE])assertAppendOnlyDefinitionPreservation(prior,next);
  const candidateDigest=projectSha256(candidate),candidateProof=verifiedProjectIntegrity(candidate,candidateDigest);
  if(options.skipUnchanged&&prior?.projectSha256===candidateDigest){
    // The context-copy target must still match the measured candidate. Capture
    // before persistence can yield to a retained target's queued mutation.
    if(!verifiedValuesEqual(canonicalProject(candidateProof.snapshot),canonicalProject(next)))throw storageError('The prepared project changed before commit. Prepare the current candidate again.','STALE_PROJECT_REVISION');
    const integrity=verifiedProjectIntegrity(next,candidateDigest);await persistProjectPromptFiles(next);
    if(!unchangedVerifiedProject(integrity,next,candidateDigest))throw storageError('The prepared project changed before commit. Prepare the current candidate again.','STALE_PROJECT_REVISION');
    const preparedHistory=await prepareHistoryCommit(next,prior,{label:options.historyLabel,view:options.historyView,verifiedRead,verifiedDigests:[[next,candidateDigest]],verifiedIntegrity:[verifiedRead,integrity]});
    return {project:next,options:{...options,expectedProjectRevision:revision,expectedStateSha256:prior.projectSha256,preparedHistory,[VERIFIED_CANONICAL_WRITE]:{read:verifiedRead,integrity,digest:candidateDigest}}};
  }
  for(const source of prior?.projectData?.migrationArchives||[])if(source?.kind===ORIGINAL_SOURCE_KIND&&source.schema===ORIGINAL_SOURCE_SCHEMA&&!next.projectData?.migrationArchives?.some(row=>equivalent(row,source)))throw storageError('An existing original-source archive cannot be changed or removed by a canonical save.','SOURCE_ARCHIVE_MUTATED');
  next.revision=(options.incrementRevision??true)?revision+1:revision;
  const engine=globalThis.closedLoopWorkflowEngine;engine.ensureShape(next);
  engine.reconcileReservationRevisions(next);
  // A canonical change can introduce a newly accepted target file. The prior
  // read verifies only the old version; derive this version from its own bytes
  // before both checkpoint preparation and the commit-time integrity check.
  await observeProjectArtifactCustody(next);
  // Keep all canonical owners and fresh-byte observation in their original
  // order. Reuse only full-value/primitive-guarded carrier digests inside this
  // synchronous block; no validation or permission result crosses an await.
  const canonicalWriteDigestScope=hash.createCanonicalDigestScope({generatedPrompts:next.projectData.generatedPrompts,rawResponses:next.projectData.rawResponses,responseProposals:next.projectData.responseProposals,generatedOutputs:next.projectData.generatedOutputs});
  try{
    hash.withCanonicalDigestScope(canonicalWriteDigestScope,()=>{
      engine.recalculate(next);if(options[NATIVE_PRODUCT_COMMAND_AUTHORITY]!==true)assertMutationConfirmation(prior,candidate,options.mutationConfirmation,next,candidateProof);assertProjectIntegrity(next,{prior});
    });
  }finally{hash.disposeCanonicalDigestScope(canonicalWriteDigestScope);}
  await persistProjectPromptFiles(next);
  const primitive=rootDigestPrimitivesUnchanged(initialRootDigestPrimitives)?initialRootDigestPrimitives:null,measured=primitive?historyProjectDigests(next):null,pair=measured&&rootDigestPrimitivesUnchanged(primitive)?measured:null;
  const digest=pair?pair.projectSha256:projectSha256(next),integrity=verifiedProjectIntegrity(next,digest);
  const preparedHistory=await prepareHistoryCommit(next,prior,{label:options.historyLabel,view:options.historyView,artifactRows:options.creation?.artifacts||null,verifiedRead,verifiedDigests:[[next,digest,pair?.workSha256]],verifiedIntegrity:[...(verifiedRead?[verifiedRead]:[]),integrity]});
  if(options.creation)preparedHistory.state.commandReceipts={...(preparedHistory.state.commandReceipts||{}),[options.creation.receiptKey]:clone(options.creation.receipt)};
  return {project:next,options:{...options,expectedProjectRevision:revision,expectedStateSha256:prior?.projectSha256||null,preparedHistory,[VERIFIED_CANONICAL_WRITE]:{read:verifiedRead,integrity,digest}}};
}
async function writeProject(project,options={}){
  options={skipUnchanged:true,...options};
  if(options.initialMobileAcceptanceSession!==undefined&&(!options.createOnly||options.operational))throw storageError('Initial mobile sessions require a create-only project transaction.','MOBILE_ACCEPTANCE_CREATION_INVALID');
  if(options.pendingArtifacts!==undefined&&!options.operational)throw storageError('Pending returned bytes require an operational response transaction.','PENDING_ARTIFACTS_UNSUPPORTED');
  if(useStoreWorker())return requestStoreWorker('WRITE_PROJECT',[project,options]);
  if(!options.operational)options={...options,[APPEND_ONLY_CANONICAL_WRITE]:true};
  assertCanonicalFieldValues(project);
  if(options.operational)return writeOperationalProject(project,options);
  if(!projectIdentity(project))throw new Error('A project without a JOB_ID cannot be committed.');
  const prepared=await prepareProjectWrite(project,options);fault('before-project-transaction');const tx=await openTransaction(options.creation?[PROJECTS,ARTIFACTS,META]:[PROJECTS,META],'readwrite');
  try{const next=await writeProjectRow(prepared.project,tx,prepared.options);fault('before-transaction-commit');await complete(tx);
    const proof=prepared.options[VERIFIED_CANONICAL_WRITE],committedRow=proof?.committedRow,committedProject=committedRow?.project||proof?.integrity?.snapshot,committedDigest=committedRow?.projectSha256||proof?.digest;
    // Completion is durable. A hook-retained writer result is not a new source
    // of truth; compare it with the private actual row (or checked no-op input).
    try{
      const assertCommittedReturn=()=>{if(!committedProject||next.projectSha256!==committedDigest||!verifiedValuesEqual(canonicalProject(committedProject),canonicalProject(next)))throw storageError('The committed project return changed during completion or context restoration.','STALE_PROJECT_REVISION');};
      assertCommittedReturn();
      if(committedRow){const privateCommitted=copyVerifiedTree(next),committedIntegrity=verifiedProjectIntegrity(privateCommitted,next.projectSha256);globalThis.closedLoopPromptEngine?.copyRetainedPromptContextFiles?.(next,privateCommitted);assertCommittedReturn();recentOperationalCommitRead={row:committedRow,journal:undefined,storage:proof.committedStorage,...committedIntegrity};}
      notifyProjectChange(next);return next;
    }catch(error){
      recentOperationalCommitRead=null;
      throw Object.assign(storageError('The project was committed, but its returned values or context are unavailable. Reload and verify the saved project before continuing.','COMMITTED_PROJECT_UNAVAILABLE'),{committed:true,existingProjectsUnchanged:false,jobId:projectIdentity(committedProject),revision:Number(committedProject?.revision),projectSha256:committedDigest,cause:error});
    }
  }catch(error){try{tx.abort();}catch{}throw error;}
}

function validateDeleteReceipt(key,receipt,jobId){
  const shape=globalThis.closedLoopWorkflowSchema.validateCommandReceiptShape('DELETE_PROJECT',receipt);
  if(!shape.valid||key!=='deleteReceipt:'+receipt.idempotencyKey||receipt.jobId!==jobId)throw storageError('The saved removal receipt is incomplete or has an invalid binding. Restore a verified backup before retrying.','DELETE_BINDING_INVALID');
  return true;
}
function validateHistoryCommandReceipts(receipts,jobId){
  if(receipts===undefined)return;
  if(!receipts||typeof receipts!=='object'||Array.isArray(receipts))throw storageError('Saved command receipts are incomplete. Restore a verified backup.','COMMAND_RECEIPTS_INVALID');
  for(const [key,receipt] of Object.entries(receipts)){
    if(key.startsWith('cloneReceipt:'))validateCloneReceipt(key,receipt,jobId);
    else if(key.startsWith('deleteReceipt:'))validateDeleteReceipt(key,receipt,jobId);
    else throw storageError('Saved history contains an unrecognized command receipt.','COMMAND_RECEIPTS_INVALID');
  }
}
function validateCloneReceipt(key,receipt,jobId){
  const shape=globalThis.closedLoopWorkflowSchema.validateCommandReceiptShape('CLONE',receipt);
  if(!shape.valid)throw Object.assign(storageError('The saved copy receipt is incomplete or inconsistent. Restore a verified backup before retrying.','CLONE_BINDING_INVALID'),{receiptIssue:shape});
  const payload={operation:'CLONE',sourceJobId:receipt?.sourceJobId,sourceProjectSha256:receipt?.sourceProjectSha256};
  if(key!=='cloneReceipt:'+receipt.commandId||receipt.sourceJobId===receipt.resultingJobId||![receipt.sourceJobId,receipt.resultingJobId].includes(jobId)||receipt.payloadSha256!==hash.hashRegistered('CLONE_COMMAND',payload)||receipt.mappingManifestSha256!==hash.hashRegistered('CLONE_MAPPING_MANIFEST',receipt.mappingManifest))throw storageError('The saved copy receipt has an invalid binding.','CLONE_BINDING_INVALID');
  const manifest=receipt.mappingManifest;
  if(manifest.sourceJobId!==receipt.sourceJobId||manifest.resultingJobId!==receipt.resultingJobId)throw storageError('The saved copy mapping is invalid.','CLONE_BINDING_INVALID');
  const old=new Set(),fresh=new Set();
  for(const row of manifest.files){if(!/^ARTIFACT-[0-9a-v]{32}$/.test(row.artifactId)||row.sourceArtifactId===row.artifactId||old.has(row.sourceArtifactId)||fresh.has(row.artifactId))throw storageError('The saved copy file mapping is invalid.','CLONE_BINDING_INVALID');old.add(row.sourceArtifactId);fresh.add(row.artifactId);}
  return true;
}
function sameCopiedFileIdentity(actual,expected){return Boolean(actual&&expected&&['artifactId','filename','mediaType','byteSize','sha256'].every(field=>actual[field]===expected[field]));}
async function prepareCopiedInputs(project,source,commandId,payloadSha256){
  const engine=globalThis.closedLoopWorkflowEngine,schema=globalThis.closedLoopWorkflowSchema,artifacts=[],mapping=[];
  for(const field of schema.HUMAN_INTAKE_FIELDS)if(Object.hasOwn(source.job,field)&&source.job[field]!==undefined)project.job[field]=clone(source.job[field]);
  project.job.JOB_TITLE=source.job.JOB_TITLE?`${source.job.JOB_TITLE} — copy`:'Project copy';
  const inputs={objective:'EXACT_USER_OBJECTIVE_VERBATIM',suppliedMaterials:'SUPPLIED_MATERIALS_INVENTORY',requiredOutputFormat:'REQUIRED_OUTPUT_FORMAT',deadlineOrTemporalScope:'DEADLINE_OR_TEMPORAL_SCOPE',desiredSourceCount:'DESIRED_SOURCE_COUNT',knownAuthorities:'KNOWN_AUTHORITATIVE_SOURCES',availableTools:'AVAILABLE_TOOLS',prohibitedActions:'PROHIBITED_ACTIONS'};
  project.projectData.userEntered={suppliedArtifactFiles:{},suppliedArtifactText:{},explicitRequirements:String(project.job.EXPLICIT_USER_REQUIREMENTS||'').split(/\r?\n/).filter(Boolean)};
  for(const [key,field] of Object.entries(inputs))if(project.job[field]!==undefined)project.projectData.userEntered[key]=clone(project.job[field]);
  for(const [oldId,metadata] of Object.entries(source.projectData.userEntered?.suppliedArtifactFiles||{}).sort(([a],[b])=>a<b?-1:a>b?1:0)){
    let original;try{original=await getArtifact(oldId);}catch(error){if(!['ARTIFACT_BYTE_REFERENCE_INVALID','ARTIFACT_BYTES_UNAVAILABLE','ARTIFACT_LEGACY_BYTES_INVALID'].includes(error.code))throw error;throw storageError('A supplied input file is missing or corrupt. Restore the source from History or a verified backup before copying.','CLONE_SOURCE_FILE_INVALID');}const canonical=engine.records(source,'artifacts',{active:false}).find(row=>engine.recordId(row,'artifacts')===oldId);
    const identity=canonical?{artifactId:oldId,filename:engine.recordValue(canonical,'FILENAME'),mediaType:engine.recordValue(canonical,'TYPE'),byteSize:Number(engine.recordValue(canonical,'BYTE_SIZE')),sha256:engine.recordValue(canonical,'SHA256')}:null;
    if(!identity||!sameCopiedFileIdentity(original,identity)||!sameCopiedFileIdentity(metadata,identity)||original.jobId!==source.job.JOB_ID||!(original.blob instanceof Blob)||original.byteSize!==original.blob.size||await hash.sha256Bytes(original.blob)!==original.sha256)throw storageError('A supplied input file is missing or corrupt. Restore the source from History or a verified backup before copying.','CLONE_SOURCE_FILE_INVALID');
    const artifactId=engine.allocateId(project,'artifacts',{commandId,targetSlot:oldId,idempotencyKey:'CLONE_INPUT',payload:{payloadSha256,sha256:original.sha256,byteSize:original.byteSize,filename:original.filename}}),lineage={stage:1,role:'STAGE_ARTIFACT',logicalPath:original.filename,origin:'COPIED_HUMAN_INPUT'},row={artifactId,jobId:project.job.JOB_ID,blob:original.blob,filename:original.filename,mediaType:original.mediaType,byteSize:original.byteSize,sha256:original.sha256,lineage,createdAt:now()};
    artifacts.push(row);mapping.push({sourceArtifactId:oldId,artifactId,sha256:row.sha256,byteSize:row.byteSize,filename:row.filename,mediaType:row.mediaType});
    engine.registerArtifactBytes(project,{stage:1,artifactId,filename:row.filename,mediaType:row.mediaType,byteSize:row.byteSize,sha256:row.sha256,lineage});
    const file={artifactId,filename:row.filename,sha256:row.sha256,byteSize:row.byteSize,mediaType:row.mediaType};
    project.projectData.userEntered.suppliedArtifactFiles[artifactId]=file;
    const text=source.projectData.userEntered?.suppliedArtifactText?.[oldId];
    if(text){if(!sameCopiedFileIdentity(text,identity)||typeof text.text!=='string'||await row.blob.text()!==text.text)throw storageError('A supplied input text no longer matches its file. Restore the source input before copying.','CLONE_SOURCE_FILE_INVALID');project.projectData.userEntered.suppliedArtifactText[artifactId]={...file,text:text.text};}
    project.stages[1].authorizedFiles.push({artifactId,name:row.filename,type:row.mediaType,size:row.byteSize,sha256:row.sha256,stage:'STAGE 01',role:globalThis.closedLoopCore.STAGES[0].role,retainedBytes:true,availability:'Copied bytes verified and retained with this project.',addedAt:now()});
  }
  engine.recordHumanInputVersion(project,schema.HUMAN_INTAKE_FIELDS,'HUMAN_OPERATOR');
  return {artifacts,mapping};
}
async function createProject({commandId=crypto.randomUUID(),sourceJobId=null,expectedSourceSha256=null}={}){
  const command=String(commandId||'');if(!command)throw storageError('A project creation command identity is required.','PROJECT_COMMAND_REQUIRED');
  const sourceId=sourceJobId===null?null:String(sourceJobId),payload=sourceId?{operation:'CLONE',sourceJobId:sourceId,sourceProjectSha256:expectedSourceSha256}:{operation:'CREATE_PROJECT'},payloadSha256=sourceId?hash.hashRegistered('CLONE_COMMAND',payload):hash.sha256Value(payload),receiptKey='cloneReceipt:'+command;
  if(sourceId&&!/^[a-f0-9]{64}$/.test(String(expectedSourceSha256||'')))throw storageError('Select the exact saved source version before copying.','CLONE_SOURCE_REQUIRED');
  const engine=globalThis.closedLoopWorkflowEngine,family=engine.INFRA_ID_FAMILIES['projects:JOB'];
  for(let attempt=0;attempt<8;attempt++){
    const completedCopy=await metaGet(receiptKey);
    if(completedCopy){validateCloneReceipt(receiptKey,completedCopy,sourceId);if(completedCopy.payloadSha256!==payloadSha256)throw storageError('This copy command was already used for a different source version.','IDEMPOTENCY_PAYLOAD_CONFLICT');const retained=await readProject(completedCopy.resultingJobId);if(retained)return retained;throw storageError('This copy already completed. Restore that copy from History or its backup.','CREATED_PROJECT_RETAINED');}
    const prior=await metaGet('canonicalProjectAllocation')||{generation:0,sequence:0,receipts:[]};
    const existing=prior.receipts.find(row=>row.commandId===command);
    if(existing){if(existing.payloadSha256!==payloadSha256)throw storageError('This creation command was already used with different content.','IDEMPOTENCY_PAYLOAD_CONFLICT');const project=await readProject(existing.resultingId);if(project)return project;throw storageError('This creation already completed. Its project is available in History.','CREATED_PROJECT_RETAINED');}
    const source=sourceId?await readProject(sourceId):null;
    if(sourceId&&(!source||source.projectSha256!==expectedSourceSha256))throw storageError('The source project changed. Select its current saved version before copying.','STALE_PROJECT_REVISION');
    const allocationSequence=Number(prior.sequence)+1;
    if(!Number.isSafeInteger(allocationSequence))throw storageError('The project allocation sequence is exhausted.','ALLOCATION_SEQUENCE_INVALID');
    const retainedIds=new Set([...(await listProjectSummaries()).map(projectIdentity),...(await listRecoverableProjects()).map(row=>row.jobId)]);
    const known=new Map(prior.receipts.map(row=>[row.resultingId,row.inputTuple]));
    const allocation=hash.allocateCanonicalIdWithCollisionCheck({familyPrefix:family.prefix,familyNamespace:family.familyNamespace,jobNamespace:'closed-loop-global/project-metadata',commandId:command,targetSlot:'',parentId:'',allocationSequence},{exists:id=>known.get(id)||(retainedIds.has(id)?true:null)});
    const receipt={schema:'closed-loop-allocation-receipt/1',algorithmVersion:hash.idVersion,familyPrefix:family.prefix,familyNamespace:family.familyNamespace,jobNamespace:allocation.payload.jobNamespace,collection:'projects',commandId:command,targetSlot:'',parentId:'',inputTuple:allocation.payload,allocationSequence,collisionCounter:allocation.collisionCounter,collisionCheck:'CHECKED_AGAINST_ACTIVE_AND_RETAINED_PROJECT_IDENTITIES',resultingId:allocation.id,projectRevision:0,revisionMeaning:'ALLOCATION_INPUT',retryIdentity:hash.sha256Value({commandId:command,operation:'CREATE_PROJECT'}),payloadSha256:hash.sha256Value({operation:'CREATE_PROJECT'})};
    receipt.payloadSha256=payloadSha256;
    const project=globalThis.closedLoopCore.createBlankState(allocation.id);engine.ensureShape(project);project.projectData.allocationReceipts.push(receipt);project.job.DATE_OPENED=now();project.activeView='Project';
    let creation=null;
    if(source){
      const {artifacts,mapping}=await prepareCopiedInputs(project,source,command,payloadSha256),mappingManifest={schema:'closed-loop-clone-mapping/1',sourceJobId:sourceId,resultingJobId:allocation.id,files:mapping};
      const cloneReceipt={schema:'closed-loop-clone-command-receipt/1',commandId:command,sourceJobId:sourceId,sourceProjectSha256:expectedSourceSha256,payloadSha256,resultingJobId:allocation.id,mappingManifest,mappingManifestSha256:hash.hashRegistered('CLONE_MAPPING_MANIFEST',mappingManifest),result:true};
      const sourceState=await metaGet(historyKey(sourceId));if(!sourceState)throw storageError('Save a recovery checkpoint for the source before copying.','HISTORY_CHECKPOINT_REQUIRED');
      const sourceHistory={state:{...clone(sourceState),generation:Number(sourceState.generation)+1,commandReceipts:{...(sourceState.commandReceipts||{}),[receiptKey]:cloneReceipt}},expectedGeneration:Number(sourceState.generation),snapshots:[],newFiles:[]};
      creation={receiptKey,receipt:cloneReceipt,artifacts,sourceHistory};
    }
    engine.createNewJobReset(project,{humanInputReused:Boolean(source),reusedArtifactIds:creation?.artifacts.map(row=>row.artifactId)||[]});
    const state={generation:prior.generation+1,sequence:allocationSequence,receipts:[...prior.receipts,receipt]};
    try{return await writeProject(project,{expectedProjectRevision:0,incrementRevision:false,createOnly:true,creation,projectAllocation:{expectedGeneration:prior.generation,state}});}
    catch(error){if(!['PROJECT_ALLOCATION_CONFLICT','PROJECT_ALREADY_EXISTS','CLONE_ALREADY_COMMITTED'].includes(error?.code))throw error;}
  }
  throw storageError('Project creation could not obtain a current allocation. Retry after the other creation finishes.','PROJECT_ALLOCATION_CONFLICT');
}

async function restoreProjectAllocation(tx,project){
  const receipts=(project.projectData?.allocationReceipts||[]).filter(row=>row.collection==='projects');
  if(!receipts.length)return;
  if(receipts.length!==1||receipts[0].resultingId!==projectIdentity(project))throw storageError('The saved project contains an incompatible creation identity.','PROJECT_ALLOCATION_INVALID');
  globalThis.closedLoopWorkflowEngine.validateAllocationReceipts(project);
  const receipt=receipts[0],meta=tx.objectStore(META),prior=(await request(meta.get('canonicalProjectAllocation')))?.value||{generation:0,sequence:0,receipts:[]};
  const existing=prior.receipts.find(row=>row.commandId===receipt.commandId||row.resultingId===receipt.resultingId);
  if(existing){if(hash.sha256Value(existing)!==hash.sha256Value(receipt))throw storageError('The saved creation conflicts with a completed project command.','IDEMPOTENCY_PAYLOAD_CONFLICT');return;}
  meta.put({key:'canonicalProjectAllocation',value:{generation:prior.generation+1,sequence:Math.max(prior.sequence,receipt.allocationSequence),receipts:[...prior.receipts,clone(receipt)]},updatedAt:now()});
}

async function writeAllIndexed(projects){
  if(!Array.isArray(projects))throw new TypeError('Project storage payload must be an array.');
  const candidates=projects.filter(project=>projectIdentity(project));
  if(new Set(candidates.map(projectIdentity)).size!==candidates.length)throw storageError('Bulk project storage contains duplicate JOB_ID values.','DUPLICATE_PROJECT_ID');
  const prepared=[];for(const project of candidates)prepared.push(await prepareProjectWrite(project,{expectedProjectRevision:Number(project.revision||0),skipUnchanged:true,[APPEND_ONLY_CANONICAL_WRITE]:true}));
  fault('before-project-transaction');const tx=await openTransaction([PROJECTS,META],'readwrite'),saved=[];
  try{for(const item of prepared)saved.push(await writeProjectRow(item.project,tx,item.options));fault('before-transaction-commit');await complete(tx);for(const project of saved)notifyProjectChange(project);return saved;}catch(error){try{tx.abort();}catch{}throw error;}
}

function writeAll(projects,storage){return storage?writeAllLegacy(projects,storage):writeAllIndexed(projects);}

async function replaceProjectIndexed(projectsOrProject,projectOrOptions){
  if(Array.isArray(projectsOrProject)){const project=projectOrOptions;return writeProject(project,{expectedProjectRevision:Number(project?.revision||0)});}
  return writeProject(projectsOrProject,projectOrOptions||{});
}
function replaceProject(projectsOrProject,projectOrOptions,storage){if(Array.isArray(projectsOrProject)&&storage){const next=clone(projectsOrProject),project=projectOrOptions,id=projectIdentity(project),i=next.findIndex(x=>projectIdentity(x)===id);if(i<0)next.unshift(clone(project));else next[i]=clone(project);writeAllLegacy(next,storage);return next;}return replaceProjectIndexed(projectsOrProject,projectOrOptions);}

async function transactIndexed(projectsOrJobId,jobIdOrExpected,mutatorOrOptions){
  const jobId=String(projectsOrJobId||''),expected=Number(jobIdOrExpected),mutator=mutatorOrOptions;
  if(typeof mutator!=='function')throw new TypeError('Transaction mutator must be a function.');
  const before=await readProject(jobId);if(!before)throw new Error('Project is unavailable.');
  if(Number(before.revision)!==expected)throw storageError('Project revision changed.','STALE_PROJECT_REVISION');
  const next=clone(before),result=runSynchronousMutator(mutator,next,clone(before));
  return {project:await writeProject(next,{expectedProjectRevision:expected}),result};
}

function transact(projectsOrJobId,jobIdOrExpected,mutatorOrOptions,storage){if(Array.isArray(projectsOrJobId)&&storage){const next=clone(projectsOrJobId),id=String(jobIdOrExpected||''),i=next.findIndex(x=>projectIdentity(x)===id);if(i<0)throw new Error(`Project ${id} is not available for transaction.`);const before=clone(next[i]),result=runSynchronousMutator(mutatorOrOptions,next[i],before);writeAllLegacy(next,storage);return {projects:next,project:next[i],result};}return transactIndexed(projectsOrJobId,jobIdOrExpected,mutatorOrOptions);}

async function removeProjectIndexed(projectsOrJobId,options={}){
  const jobId=String(projectsOrJobId||'').trim(),expected=options?.expectedProjectRevision,replacementSelectedProjectId=String(options?.replacementSelectedProjectId||'').trim(),suppressRetainedProject=Boolean(options?.suppressRetainedProject);
  if(!jobId)throw storageError('JOB_ID is required for project deletion.','PROJECT_DELETE_JOB_ID_REQUIRED');
  if(replacementSelectedProjectId===jobId)throw storageError('The deleted project cannot also be the replacement selected project.','INVALID_PROJECT_DELETE_REPLACEMENT');
  const payload={jobId,expectedProjectRevision:expected??null,replacementSelectedProjectId,suppressRetainedProject},payloadSha256=hash.sha256Value(payload),idempotencyKey=String(options.idempotencyKey||hash.sha256Value({jobId,expected:expected??null})),receiptKey='deleteReceipt:'+idempotencyKey;
  const receipt=await metaGet(receiptKey);if(receipt){validateDeleteReceipt(receiptKey,receipt,jobId);if(receipt.payloadSha256!==payloadSha256)throw storageError('The deletion retry has different consequences.','IDEMPOTENCY_PAYLOAD_CONFLICT');return receipt.result;}
  const observedPhysical={},observed=await readProject(jobId,{[PHYSICAL_SOURCE_CAPTURE]:observedPhysical});if(!observed)return false;
  if(expected!==undefined&&Number(observed.revision)!==Number(expected))throw storageError('Project changed before deletion.','STALE_PROJECT_REVISION');
  const prepared=await prepareHistoryCommit(observed,observed,{label:'Before removal',view:options.historyView||null});prepared.state.removed=true;
  const deletionReceipt={jobId,commandId:String(options.commandId||'DELETE-'+idempotencyKey),idempotencyKey,payloadSha256,result:true,committedMetadataSequence:prepared.state.generation,retentionExpiry:new Date(Date.now()+30*24*60*60*1000).toISOString()};prepared.state.commandReceipts={...(prepared.state.commandReceipts||{}),[receiptKey]:deletionReceipt};
  validateDeleteReceipt(receiptKey,deletionReceipt,jobId);
  const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite'),projects=tx.objectStore(PROJECTS),artifacts=tx.objectStore(ARTIFACTS),meta=tx.objectStore(META);
  try{
    const retry=await request(meta.get(receiptKey));if(retry){validateDeleteReceipt(receiptKey,retry.value,jobId);if(retry.value.payloadSha256!==payloadSha256)throw storageError('The deletion retry has different consequences.','IDEMPOTENCY_PAYLOAD_CONFLICT');await complete(tx);return retry.value.result;}
    const prior=await projectRowWithOperations(tx,jobId,null,observedPhysical);if(!prior||prior.projectSha256!==observed.projectSha256)throw storageError('Another tab changed this project before deletion.','STALE_PROJECT_REVISION');
    await commitHistory(tx,prepared);
    if(expected!==undefined&&expected!==null&&Number(prior.revision)!==Number(expected)){const error=storageError(`Project revision conflict for ${jobId}: expected ${expected}, found ${prior.revision}.`,'STALE_PROJECT_REVISION');throw error;}
    if(replacementSelectedProjectId){const replacement=await request(projects.get(replacementSelectedProjectId));if(!replacement)throw storageError(`Replacement project ${replacementSelectedProjectId} is not stored.`,'PROJECT_DELETE_REPLACEMENT_MISSING');}
    const artifactRows=await request(artifacts.index('jobId').getAll(jobId)),projectRemoval=await preparePhysicalRowRemoval(tx,PROJECTS,jobId,'project'),journalRemoval=await preparePhysicalRowRemoval(tx,META,operationalKey(jobId),'value');commitPhysicalRowRemoval(tx,projectRemoval);commitPhysicalRowRemoval(tx,journalRemoval);for(const artifact of artifactRows)if(String(artifact.jobId)===jobId)artifacts.delete(artifact.artifactId);
    const selected=await request(meta.get('selectedProject'));if(String(selected?.value||'')===jobId){if(replacementSelectedProjectId)meta.put({key:'selectedProject',value:replacementSelectedProjectId,updatedAt:now()});else meta.delete('selectedProject');}
    const projectUiRow=await request(meta.get('projectUi'));if(projectUiRow?.value&&typeof projectUiRow.value==='object'&&!Array.isArray(projectUiRow.value)&&Object.prototype.hasOwnProperty.call(projectUiRow.value,jobId)){const nextProjectUi=clone(projectUiRow.value);delete nextProjectUi[jobId];meta.put({key:'projectUi',value:nextProjectUi,updatedAt:now()});}
    if(suppressRetainedProject)meta.put({key:'retainedProjectSuppressed',value:{jobId,at:now()},updatedAt:now()});
    const lastCommitted=await request(meta.get('lastCommittedRevision'));if(String(lastCommitted?.value?.jobId||'')===jobId)meta.delete('lastCommittedRevision');for(const key of ['lastVerifiedExport:'+jobId,'lastArtifactVerification:'+jobId])meta.delete(key);
    // The idempotency receipt contains no project data. Recovery snapshots are
    // retained separately under the user's recoverable-history requirements.
    meta.put({key:receiptKey,value:deletionReceipt,updatedAt:now()});
    fault('during-project-delete');await complete(tx);forgetArtifactCustody(jobId);notifyProjectChange({job:{JOB_ID:jobId}},{type:'PROJECT_DELETED',replacementSelectedProjectId:replacementSelectedProjectId||null});return true;
  }catch(error){try{tx.abort();}catch{}throw error;}
}
function removeProject(projectsOrJobId,jobIdOrStorage,storage){if(Array.isArray(projectsOrJobId)&&storage){const next=clone(projectsOrJobId).filter(project=>projectIdentity(project)!==String(jobIdOrStorage||''));writeAllLegacy(next,storage);return next;}return removeProjectIndexed(projectsOrJobId,jobIdOrStorage||{});}

// Canonical occurrences retain independent identities; immutable payload bytes
// share the existing per-project History body address. This private carrier is
// removed at the public row boundary, so export and callers still receive Blob.
function artifactByteReference(row){
 const schema=globalThis.closedLoopWorkflowSchema,reference={schema:schema.ARTIFACT_BYTE_REFERENCE_CONTRACT.schema,jobId:String(row.jobId),sha256:row.sha256,byteSize:row.byteSize};
 if(!schema.validateArtifactByteReference(reference).valid)throw storageError('Stored artifact byte identity is invalid.','ARTIFACT_BYTE_REFERENCE_INVALID');
 return reference;
}
async function sharedByteRecord(tx,row){
 if(!(row.blob instanceof Blob)||row.blob.size!==row.byteSize)throw storageError('Artifact bytes do not match their stored size.','ARTIFACT_BYTE_REFERENCE_INVALID');
 const reference=artifactByteReference(row),key=historyFileKey(reference.jobId,reference.sha256),meta=tx.objectStore(META),existing=await request(meta.get(key));
 // All writers hash their supplied Blob before entering the transaction. The
 // same content address is replaced only with those exact verified bytes.
 meta.put({...existing,key,value:{...existing?.value,sha256:reference.sha256,blob:row.blob},updatedAt:now()});
 const {blob,byteReference,...metadata}=row;return {...metadata,byteReference:reference};
}
async function storeArtifactRow(tx,row){tx.objectStore(ARTIFACTS).put(await sharedByteRecord(tx,row));}
async function hydrateByteRecord(tx,row,{diagnostic=false,preserveDamagedBytes=false,allowOccurrenceSizeMismatch=false,backingBodies=null}={}){
 if(!row||!Object.hasOwn(row,'byteReference'))return row;
 const reference=row.byteReference,schema=globalThis.closedLoopWorkflowSchema;
 if(!schema.validateArtifactByteReference(reference).valid||reference.jobId!==String(row.jobId)||reference.sha256!==row.sha256||(!allowOccurrenceSizeMismatch&&reference.byteSize!==row.byteSize)||Object.hasOwn(row,'blob')){if(diagnostic)return {...row,blob:preserveDamagedBytes?row.blob:undefined};throw storageError('Stored artifact byte reference does not match its owner.','ARTIFACT_BYTE_REFERENCE_INVALID');}
 // Only the checkpoint transaction supplies bodies it just read and verified.
 // Occurrence checks above and below still apply; MIME-created Blobs stay cold.
 const body=backingBodies?.jobId===reference.jobId&&backingBodies.rows.has(reference.sha256)?backingBodies.rows.get(reference.sha256):(await request(tx.objectStore(META).get(historyFileKey(reference.jobId,reference.sha256))))?.value;
 if(!(body?.blob instanceof Blob)||body.sha256!==reference.sha256||(allowOccurrenceSizeMismatch&&body.blob.size!==reference.byteSize)){if(diagnostic)return {...row,blob:preserveDamagedBytes?body?.blob:undefined};throw storageError('Stored artifact bytes are missing or do not match their reference.','ARTIFACT_BYTES_UNAVAILABLE');}
 const {byteReference,...metadata}=row;return {...metadata,...(diagnostic?{byteReference}:{}),blob:!row.mediaType||row.mediaType===body.blob.type?body.blob:body.blob.slice(0,body.blob.size,row.mediaType)};
}
async function hydrateArtifactRows(tx,rows,options){
 const result=[];for(let offset=0;offset<rows.length;offset+=64)result.push(...await Promise.all(rows.slice(offset,offset+64).map(row=>hydrateByteRecord(tx,row,options))));return result;
}
async function migrateInlineArtifacts(rows){
 const legacy=rows.filter(row=>row?.blob instanceof Blob&&!Object.hasOwn(row,'byteReference'));
 if(!legacy.length)return;
 const staged=new Map();
 // Hash before opening the atomic conversion. Corrupt legacy bytes and all
 // unknown metadata remain untouched for the existing recovery owner.
 for(const row of legacy){
  if(row.blob.size!==row.byteSize||await hash.sha256Bytes(row.blob)!==row.sha256)throw storageError('Legacy artifact bytes failed integrity verification; original storage was preserved.','ARTIFACT_LEGACY_BYTES_INVALID');
  const id=row.lineage?.stagedResponse?.stagingId;if(!id)continue;
  const key=responseStagingKey(row.jobId,id),read=await openTransaction(META,'readonly'),saved=await request(read.objectStore(META).get(key));await complete(read);
  if(!saved?.value?.blob)continue;
  const value=saved.value;
  if(value.jobId!==row.jobId||value.sha256!==row.sha256||value.byteSize!==row.byteSize||!(value.blob instanceof Blob)||value.blob.size!==value.byteSize||await hash.sha256Bytes(value.blob)!==value.sha256)throw storageError('Legacy staged response bytes failed integrity verification; original storage was preserved.','ARTIFACT_LEGACY_BYTES_INVALID');
  staged.set(row.artifactId,saved);
 }
 const tx=await openTransaction([ARTIFACTS,META],'readwrite');
 try{
  for(const row of legacy){
   const current=await request(tx.objectStore(ARTIFACTS).get(row.artifactId));
   if(!current||!equivalent(metadataWithoutBlob(current),metadataWithoutBlob(row))||(!Object.hasOwn(current,'byteReference')&&(!(current.blob instanceof Blob)||current.blob.size!==row.blob.size)))throw storageError('Stored artifact changed before byte-sharing migration. Retry the read.','STALE_ARTIFACT_STORAGE');
   if(Object.hasOwn(current,'byteReference'))await hydrateByteRecord(tx,current);else await storeArtifactRow(tx,row);
   const saved=staged.get(row.artifactId);
   if(saved){
    const present=await request(tx.objectStore(META).get(saved.key));
    if(!present||!equivalent(metadataWithoutBlob(present.value),metadataWithoutBlob(saved.value))||(!Object.hasOwn(present.value,'byteReference')&&(!(present.value.blob instanceof Blob)||present.value.blob.size!==saved.value.blob.size)))throw storageError('Staged response changed before byte-sharing migration. Retry the read.','STALE_ARTIFACT_STORAGE');
    if(Object.hasOwn(present.value,'byteReference'))await hydrateByteRecord(tx,present.value);else tx.objectStore(META).put({...present,value:await sharedByteRecord(tx,saved.value)});
   }
   fault('during-artifact-sharing-migration');
  }
  await complete(tx);
 }catch(error){try{tx.abort();}catch{}throw error;}
}
async function discardUnretainedArtifactBody(tx,row){
 if(!row?.jobId||!row.sha256)return false;
 const meta=tx.objectStore(META),history=(await request(meta.get(historyKey(row.jobId))))?.value;
 if(history?.files?.[row.sha256])return false;
 const others=await request(tx.objectStore(ARTIFACTS).index('jobId').getAll(String(row.jobId)));
 if(others.some(other=>other.sha256===row.sha256))return false;
 const keys=meta.getAllKeys?await request(meta.getAllKeys()):(await request(meta.getAll())).map(item=>item.key);
 for(const key of keys.filter(key=>String(key).startsWith('responseStaging:'+row.jobId+':'))){const staged=(await request(meta.get(key)))?.value;if(staged?.sha256===row.sha256)return false;}
 const key=historyFileKey(row.jobId,row.sha256),existing=await request(meta.get(key));meta.delete(key);return existing?.value?.blob instanceof Blob;
}
async function putArtifact({artifactId,jobId,blob,filename,mediaType,lineage={}}){
  forgetArtifactCustody(jobId,artifactId);
  if(!(blob instanceof Blob))throw new TypeError('Artifact bytes must be a Blob.');if(!artifactId||!jobId)throw new Error('artifactId and jobId are required.');
  const id=String(artifactId),owner=String(jobId),byteSize=blob.size,sha256=await hash.sha256Bytes(blob);
  fault('during-artifact-blob-write');const tx=await openTransaction([ARTIFACTS,META],'readwrite'),store=tx.objectStore(ARTIFACTS);let prior=null;
  try{prior=await request(store.get(id));if(prior&&String(prior.jobId)!==owner)throw storageError(`Artifact identity ${id} already belongs to another project.`,'CROSS_PROJECT_ARTIFACT_ID_COLLISION');if(prior){if(String(prior.sha256)!==sha256||Number(prior.byteSize)!==byteSize)throw storageError(`Artifact identity ${id} cannot be reused for different bytes.`,'ARTIFACT_ID_REUSE');}else await storeArtifactRow(tx,{artifactId:id,jobId:owner,blob,filename:String(filename||id),mediaType:String(mediaType||blob.type||'application/octet-stream'),byteSize,sha256,lineage:clone(lineage),createdAt:now()});fault('during-artifact-sharing-write');await complete(tx);}catch(error){try{tx.abort();}catch{}throw error;}
  const verified=await getArtifact(id);if(!verified||String(verified.jobId)!==owner||verified.byteSize!==byteSize||await observedArtifactDigest(verified)!==sha256){if(!prior)await deleteArtifact(id,owner);throw storageError('Artifact byte read-back verification failed; original bytes were preserved where previously stored.','ARTIFACT_ID_REUSE');}return verified;
}
async function readArtifactRow(artifactId,{allowOccurrenceSizeMismatch=false}={}){
 for(const [key,value] of artifactCustody)if(value.artifactId===String(artifactId))artifactCustody.delete(key);
 const observedEpoch=custodyEpoch,tx=await openTransaction([ARTIFACTS,META],'readonly'),stored=await request(tx.objectStore(ARTIFACTS).get(String(artifactId))),row=await hydrateByteRecord(tx,stored,{allowOccurrenceSizeMismatch});await complete(tx);
 if(row){if(stored.blob instanceof Blob)await migrateInlineArtifacts([stored]);await observeArtifactCustody(row,observedEpoch);}return row||null;
}
async function getArtifact(artifactId){return readArtifactRow(artifactId);}
async function deleteArtifact(artifactId,jobId){
 for(const [key,value] of artifactCustody)if(value.artifactId===String(artifactId))artifactCustody.delete(key);
 const id=String(artifactId),owner=String(jobId||''),tx=await openTransaction([ARTIFACTS,META],'readwrite'),store=tx.objectStore(ARTIFACTS);
 try{const row=await request(store.get(id));if(!row){await complete(tx);return false;}if(owner&&String(row.jobId)!==owner)throw storageError(`Artifact ${id} belongs to another project and was not deleted.`,'CROSS_PROJECT_ARTIFACT_DELETE');store.delete(id);await discardUnretainedArtifactBody(tx,row);await complete(tx);forgetArtifactCustody(row.jobId,id);notifyProjectChange({job:{JOB_ID:row.jobId}},{artifactId:id});return true;}catch(error){try{tx.abort();}catch{}throw error;}
}
// History verifies every retained byte without publishing unrelated files as
// current project custody after the canonical projection has been prepared.
// This selector is private; ordinary list/read callers retain their refresh.
async function readJobArtifactRows(jobId,publishCustody){
 if(publishCustody)forgetArtifactCustody(jobId);const observedEpoch=custodyEpoch,tx=await openTransaction([ARTIFACTS,META],'readonly'),stored=await request(tx.objectStore(ARTIFACTS).index('jobId').getAll(String(jobId))),rows=await hydrateArtifactRows(tx,stored);await complete(tx);
 await migrateInlineArtifacts(stored);if(publishCustody)for(const row of rows)await observeArtifactCustody(row,observedEpoch,publishCustody);return rows;
}
async function listArtifacts(jobId){return readJobArtifactRows(jobId,true);}
async function verifyProjectArtifacts(jobId){
  const id=String(jobId||'').trim();if(!id)throw storageError('JOB_ID is required for artifact verification.','ARTIFACT_VERIFY_JOB_ID_REQUIRED');const project=await readProject(id);if(!project)throw storageError(`Project ${id} is not stored.`,'ARTIFACT_VERIFY_PROJECT_MISSING');const rows=await listArtifacts(id),rowById=new Map(rows.map(row=>[String(row.artifactId),row])),expected=requiredProjectArtifactBytes(project),expectedById=new Map(expected.map(record=>[record.artifactId,record])),results=[];let byteSize=0;
  for(const record of expected){const {artifactId}=record,row=rowById.get(artifactId),canonicalFilename=String(record.filename||''),canonicalSize=Number(record.byteSize),canonicalSha256=String(record.sha256||'');if(!row){results.push({artifactId,filename:canonicalFilename,storedByteSize:null,actualByteSize:null,storedSha256:null,actualSha256:null,verified:false,issue:'MISSING_STORED_BLOB'});continue;}const actualSize=row.blob.size,actualSha256=await hash.sha256Bytes(row.blob);byteSize+=actualSize;const verified=String(row.jobId)===id&&String(row.filename)===canonicalFilename&&Number(row.byteSize)===canonicalSize&&String(row.sha256)===canonicalSha256&&actualSize===canonicalSize&&actualSha256===canonicalSha256;results.push({artifactId,filename:canonicalFilename,storedByteSize:Number(row.byteSize),actualByteSize:actualSize,storedSha256:String(row.sha256||''),actualSha256,verified,issue:verified?null:'CANONICAL_BLOB_IDENTITY_MISMATCH'});}
  for(const row of rows)if(!expectedById.has(String(row.artifactId))){const actualSize=row.blob.size,actualSha256=await hash.sha256Bytes(row.blob);byteSize+=actualSize;const verified=actualSize===Number(row.byteSize)&&actualSha256===String(row.sha256);results.push({artifactId:String(row.artifactId),filename:String(row.filename||row.artifactId),storedByteSize:Number(row.byteSize),actualByteSize:actualSize,storedSha256:String(row.sha256||''),actualSha256,verified,issue:verified?null:'UNREFERENCED_STORED_BLOB_MISMATCH',canonicalExpectation:false});}
  const mismatches=results.filter(item=>!item.verified),report={jobId:id,artifactCount:rows.length,expectedCanonicalArtifactCount:expected.filter(record=>record.kind==='ARTIFACT').length,byteSize,verifiedCount:results.length-mismatches.length,mismatchCount:mismatches.length,verified:mismatches.length===0,artifacts:results,at:now()};await metaPut('lastArtifactVerification:'+id,{jobId:id,artifactCount:report.artifactCount,expectedCanonicalArtifactCount:report.expectedCanonicalArtifactCount,byteSize:report.byteSize,mismatchCount:report.mismatchCount,verified:report.verified,at:report.at});return report;
}

const bytesToBase64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);};
const base64ToBytes=text=>{const s=atob(text),out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;};
function base64ToBlob(text,mediaType){
  if(typeof text!=='string')throw new TypeError('Artifact base64 must be a JSON string.');
  const parts=[];let pending='';
  for(let offset=0;offset<text.length;offset+=65536){
    pending+=text.slice(offset,offset+65536).replace(/[\t\n\f\r ]/g,'');
    const end=Math.max(0,Math.floor((pending.length-4)/4)*4);
    if(end){const part=pending.slice(0,end);if(part.includes('='))throw new TypeError('Invalid base64 padding before the end of an artifact.');parts.push(base64ToBytes(part));pending=pending.slice(end);}
  }
  parts.push(base64ToBytes(pending));return new Blob(parts,{type:mediaType||'application/octet-stream'});
}
async function compressBytes(bytes){if(typeof CompressionStream!=='function')throw Object.assign(new Error('CompressionStream is required for complete package export.'),{code:'COMPRESSION_STREAM_REQUIRED'});const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));return new Uint8Array(await hash.readWithDeadline(new Response(stream).arrayBuffer(),'Processing recovery bytes'));}
async function decompressBytes(bytes){if(typeof DecompressionStream!=='function')throw Object.assign(new Error('DecompressionStream is required for complete package import.'),{code:'DECOMPRESSION_STREAM_REQUIRED'});const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return new Uint8Array(await hash.readWithDeadline(new Response(stream).arrayBuffer(),'Processing recovery bytes'));}
// Package schemas have string-valued file members. Keep those members as Blob
// references during assembly and emit their exact JSON strings on demand. The
// canonical serializer remains the authority for every ordinary key and value.
async function* packageJsonChunks(value,fileContents){
  async function* fileString(source){
    yield '"';
    if(source.encoding==='base64'){
      // A multiple of three prevents padding between successive base64 chunks.
      for(let offset=0;offset<source.blob.size;offset+=49152)yield bytesToBase64(new Uint8Array(await hash.readWithDeadline(source.blob.slice(offset,offset+49152).arrayBuffer(),'Reading export bytes')));
    }else{
      const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
      for(let offset=0;offset<source.blob.size;offset+=49152){const text=decoder.decode(await hash.readWithDeadline(source.blob.slice(offset,offset+49152).arrayBuffer(),'Reading export bytes'),{stream:true});yield hash.stableStringify(text).slice(1,-1);}
      yield hash.stableStringify(decoder.decode()).slice(1,-1);
    }
    yield '"';
  }
  async function* member(row){
    const source=fileContents.get(row);if(!source){yield* hash.canonicalChunks(row);return;}
    yield '{';let first=true;
    for(const key of Object.keys(row).sort(hash.compareUnicodeScalarSequence)){if(!first)yield ',';first=false;yield* hash.canonicalChunks(key);yield ':';if(key===source.property)yield* fileString(source);else yield* hash.canonicalChunks(row[key]);}
    yield '}';
  }
  yield '{';let first=true;
  for(const key of Object.keys(value).sort(hash.compareUnicodeScalarSequence)){
    if(!first)yield ',';first=false;yield* hash.canonicalChunks(key);yield ':';
    if((key==='artifacts'||key==='contextFiles')&&Array.isArray(value[key])){yield '[';let firstMember=true;for(const row of value[key]){if(!firstMember)yield ',';firstMember=false;yield* member(row);}yield ']';}
    else yield* hash.canonicalChunks(value[key]);
  }
  yield '}';
}
async function compressPackage(body,fileContents=new WeakMap()){
  if(typeof CompressionStream!=='function')throw storageError('CompressionStream is required for complete export.','COMPRESSION_STREAM_REQUIRED');
  if(Object.hasOwn(body,'packageSha256'))throw storageError('A package digest cannot include itself.','PACKAGE_DIGEST_PREIMAGE_INVALID');
  const encoder=new TextEncoder(),compression=new CompressionStream('gzip'),writer=compression.writable.getWriter(),compressed=new Response(compression.readable).blob();
  // Observe reader failure immediately, while preserving its rejection for
  // the caller. A failed stream must never advance the verified-export marker.
  void compressed.catch(()=>{});
  async function* encodedBody(){
    let text='';for await(const part of packageJsonChunks(body,fileContents)){text+=part;if(text.length>=32768){yield encoder.encode(text);text='';}}
    if(text)yield encoder.encode(text);
  }
  async function* hashAndCompress(){
    let previous=null;
    for await(const bytes of encodedBody()){
      if(previous)await hash.readWithDeadline(writer.write(previous),'Compressing recovery bytes',error=>writer.abort(error));
      yield bytes;previous=bytes;
    }
    if(!previous||previous[previous.length-1]!==125)throw storageError('Package body did not end with its object boundary.','PACKAGE_BODY_INVALID');
    if(previous.length>1)await hash.readWithDeadline(writer.write(previous.subarray(0,-1)),'Compressing recovery boundary',error=>writer.abort(error));
  }
  try{
    // Hash the unchanged canonical body, including its closing brace, while
    // compressing those same UTF-8 buffers under stream backpressure. Append
    // the digest as the last JSON member; it remains outside its own preimage.
    // Retain only one bounded body chunk to replace the final closing brace.
    const packageSha256=await hash.sha256Chunks(hashAndCompress());
    await hash.readWithDeadline(writer.write(encoder.encode(`${Object.keys(body).length?',':''}"packageSha256":"${packageSha256}"}`)),'Completing recovery bytes',error=>writer.abort(error));
    await hash.readWithDeadline(writer.close(),'Closing recovery output',error=>writer.abort(error));return {blob:await hash.readWithDeadline(compressed,'Reading compressed recovery output'),packageSha256};
  }catch(error){void writer.abort(error).catch(()=>{});void compressed.catch(()=>{});throw error;}
}
function requiredProjectArtifactBytes(project){
  const id=projectIdentity(project),engine=globalThis.closedLoopWorkflowEngine,expected=[];
  for(const artifact of (project.projectData?.artifacts||[]).filter(record=>record?.active!==false&&!record?.invalidatedBy)){
    if(String(engine.recordValue(artifact,'AVAILABILITY')||'').toUpperCase()!=='BYTES_PERSISTED_AND_VERIFIED')continue;
    expected.push({kind:'ARTIFACT',artifactId:String(engine.recordId(artifact,'artifacts')||''),filename:engine.recordValue(artifact,'FILENAME')||'',byteSize:engine.recordValue(artifact,'BYTE_SIZE'),sha256:engine.recordValue(artifact,'SHA256')||''});
  }
  // Context files hold exact data moved out of saved instructions. Their
  // identities remain required when those instructions become history.
  const contextIds=new Set();
  for(const prompt of project.projectData?.generatedPrompts||[])for(const file of prompt.contextManifest?.promptContext?.attachments||[]){const artifactId=promptContextArtifactId(id,file),identity=JSON.stringify([artifactId,file.filename,file.byteSize,file.sha256]);if(contextIds.has(identity))continue;contextIds.add(identity);expected.push({kind:'PROMPT_CONTEXT',artifactId,filename:file.filename,byteSize:file.byteSize,sha256:file.sha256});}
  for(const source of project.projectData?.migrationArchives||[])if(source?.kind===ORIGINAL_SOURCE_KIND&&source.schema===ORIGINAL_SOURCE_SCHEMA){
    const descriptor=globalThis.closedLoopWorkflowSchema?.validateOriginalProjectSourceDescriptor?.(source);if(!descriptor?.valid)throw storageError('Original project source descriptor violates its schema-owned contract.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    if(source.operational!==false||typeof source.artifactId!=='string'||source.artifactId!=='PROJECT-SOURCE-'+hash.sha256Value({jobId:id,sha256:source.sha256})||!Number.isSafeInteger(source.byteSize)||source.byteSize<0||typeof source.sha256!=='string'||!/^([a-f0-9]{64})$/.test(source.sha256)||typeof source.sourceSha256!=='string'||!/^([a-f0-9]{64})$/.test(source.sourceSha256)||typeof source.parsedPayloadSha256!=='string'||!/^([a-f0-9]{64})$/.test(source.parsedPayloadSha256)||!['UTF-8','UTF-16LE_CODE_UNITS'].includes(source.sourceEncoding)||!source.sourceLocation||typeof source.sourceLocation!=='object'||!source.parser?.identity||!source.parser?.version)throw storageError('Original project source metadata is invalid.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    const utf16=source.sourceEncoding==='UTF-16LE_CODE_UNITS',location=source.sourceLocation;
    if(!['UNKNOWN','CREDENTIAL_SECRET'].includes(source.disclosureClassification)||source.filename!==source.artifactId+(utf16?'.json.utf16le':'.json')||source.mediaType!==(utf16?'application/octet-stream':'application/json')||Array.isArray(location)||typeof location.jsonPointer!=='string'||source.parser.version!=='1'||source.parser.identity!==(utf16?'closed-loop-legacy-json-reader':'closed-loop-project-package-json-reader')||(utf16?(!LEGACY_KEYS.includes(location.storageKey)||!/^($|\/[0-9]+)$/.test(location.jsonPointer)||!Number.isSafeInteger(location.codeUnitStart)||location.codeUnitStart<0||!Number.isSafeInteger(location.codeUnitEnd)||location.codeUnitEnd<=location.codeUnitStart||(location.codeUnitEnd-location.codeUnitStart)*2!==source.byteSize):(location.jsonPointer!=='/project'||location.containerEncoding!=='gzip')))throw storageError('Original project source provenance is invalid.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    expected.push({kind:ORIGINAL_SOURCE_KIND,artifactId:source.artifactId,filename:source.filename,byteSize:source.byteSize,sha256:source.sha256});
  }
  return expected;
}
async function verifyOriginalSourceBindings(project,artifacts,verifiedSources=null){
  const byId=new Map(artifacts.map(row=>[row.artifactId,row])),seen=new Map();
  for(const source of project.projectData?.migrationArchives||[])if(source?.kind===ORIGINAL_SOURCE_KIND&&source.schema===ORIGINAL_SOURCE_SCHEMA){
    const row=byId.get(source.artifactId);if(!row)throw storageError('Original project source bytes are missing.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    const contract=JSON.stringify([source.sourceEncoding,source.parser.identity,source.parser.version]),localKey=source.artifactId+':'+contract;let binding=seen.get(localKey)||verifiedSources?.get(row.blob)?.get(contract);
    if(!binding){
      let text;if(source.sourceEncoding==='UTF-16LE_CODE_UNITS'){
        if(row.blob.size%2)throw storageError('Original source code units are incomplete.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
        const parts=[];for(let offset=0;offset<row.blob.size;offset+=65536){const bytes=new Uint8Array(await hash.readWithDeadline(row.blob.slice(offset,offset+65536).arrayBuffer(),'Reading original project source')),units=new Uint16Array(bytes.length/2);for(let i=0;i<units.length;i++)units[i]=bytes[i*2]|bytes[i*2+1]<<8;parts.push(String.fromCharCode(...units));}text=parts.join('');
      }else{try{text=new TextDecoder('utf-8',{fatal:true}).decode(await hash.readWithDeadline(row.blob.arrayBuffer(),'Reading original project source'));}catch(error){if(error?.code==='IO_READ_TIMEOUT')throw error;throw storageError('Original project source bytes are not valid UTF-8.','SOURCE_ARCHIVE_INTEGRITY_FAILED');}}
      let payload;try{payload=JSON.parse(text);}catch{throw storageError('Original source bytes are not the recorded JSON payload.','SOURCE_ARCHIVE_INTEGRITY_FAILED');}binding={jobId:projectIdentity(payload),parsedPayloadSha256:hash.sha256Value(payload)};seen.set(localKey,binding);
      if(verifiedSources){let contracts=verifiedSources.get(row.blob);if(!contracts){contracts=new Map();verifiedSources.set(row.blob,contracts);}contracts.set(contract,binding);}
    }
    if(binding.jobId!==projectIdentity(project)||binding.parsedPayloadSha256!==source.parsedPayloadSha256)throw storageError('Original source bytes do not match their project and parsed-payload binding.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
  }
}
function assertPackageArtifactCustody(project,artifacts){
  const id=projectIdentity(project),byId=new Map(artifacts.map(row=>[String(row.artifactId),row]));
  for(const {artifactId,filename,byteSize,sha256} of requiredProjectArtifactBytes(project)){
    const row=byId.get(artifactId);
    if(!row||String(row.jobId)!==id||String(filename)!==String(row.filename)||Number(byteSize)!==Number(row.byteSize)||String(sha256)!==String(row.sha256))throw storageError(`Canonical artifact ${artifactId||'UNKNOWN'} does not reconcile with verified package bytes.`,'PACKAGE_ARTIFACT_CUSTODY_MISMATCH');
  }
  const sources=(project.projectData?.migrationArchives||[]).filter(source=>source?.kind===ORIGINAL_SOURCE_KIND&&source.schema===ORIGINAL_SOURCE_SCHEMA);
  for(const source of sources){const row=byId.get(source.artifactId),lineage=row?.lineage?.originalProjectSource;if(row?.mediaType!==source.mediaType||lineage?.schema!==ORIGINAL_SOURCE_SCHEMA||lineage.operational!==false||lineage.sourceEncoding!==source.sourceEncoding||lineage.parsedPayloadSha256!==source.parsedPayloadSha256)throw storageError('Original-source artifact lineage does not match its descriptor.','SOURCE_ARCHIVE_INTEGRITY_FAILED');}
  for(const row of artifacts)if(row.lineage?.originalProjectSource?.schema===ORIGINAL_SOURCE_SCHEMA&&!sources.some(source=>source.artifactId===row.artifactId))throw storageError('An owned original-source artifact has no matching descriptor.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
}
async function readExportSnapshot(jobId){
  const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readonly'),finished=complete(tx);
  const [row,storedArtifacts,recoveryRow]=await Promise.all([projectRowWithOperations(tx,jobId),request(tx.objectStore(ARTIFACTS).index('jobId').getAll(String(jobId))),request(tx.objectStore(META).get(historyKey(jobId)))]);const artifacts=await hydrateArtifactRows(tx,storedArtifacts);await finished;
  if(!row)throw storageError('The project is unavailable for export.','PROJECT_NOT_FOUND');
  const digest=await hash.sha256Chunks(hash.canonicalChunks(canonicalProject(row.project)));
  if(digest!==row.projectSha256||Number(row.revision)!==Number(row.project.revision))throw storageError('Project identity failed export verification.','PROJECT_HASH_MISMATCH');
  try{assertProjectIntegrity(row.project,{verifyDerived:false});}catch(error){if(!legacyJobPointerProjection(row.project,{verifyDerived:false}))throw error;await readProjectMetadata(jobId);return readExportSnapshot(jobId);}
  return {project:{...row.project,projectSha256:digest},artifacts,recovery:recoveryRow?.value||null};
}
const ENCRYPTED_EXPORT_PROFILE=Object.freeze({schema:'closed-loop-encrypted-export/1',algorithm:'AES-256-GCM',kdf:'PBKDF2-HMAC-SHA-256',iterations:600000,keyBits:256,saltBytes:16,ivBytes:12,tagBytes:16,plaintextMediaType:'application/gzip'});
function containsCredentialSecret(value){
  if(!value||typeof value!=='object')return false;
  return Object.entries(value).some(([key,item])=>(['DISCLOSURE_CLASSIFICATION','disclosureClassification'].includes(key)&&item==='CREDENTIAL_SECRET')||containsCredentialSecret(item));
}
function encryptionCrypto(){if(!globalThis.crypto?.subtle||typeof globalThis.crypto?.getRandomValues!=='function')throw storageError('Password-protected backups require this browser’s secure cryptography support.','BACKUP_CRYPTO_UNAVAILABLE');return globalThis.crypto;}
const encryptionHex=bytes=>Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
function encryptionBytes(value,length){if(typeof value!=='string'||!new RegExp(`^[a-f0-9]{${length*2}}$`).test(value))throw storageError('Encrypted backup metadata is invalid.','ENCRYPTED_PACKAGE_INVALID');return Uint8Array.from(value.match(/../g),part=>parseInt(part,16));}
async function backupKey(passphrase,salt,usage){
  if(typeof passphrase!=='string'||!passphrase.length)throw storageError('Enter the backup password to continue.','BACKUP_PASSPHRASE_REQUIRED');
  const api=encryptionCrypto(),encoded=new TextEncoder().encode(passphrase);
  try{const material=await hash.readWithDeadline(api.subtle.importKey('raw',encoded,'PBKDF2',false,['deriveKey']),'Preparing backup protection');return await hash.readWithDeadline(api.subtle.deriveKey({name:'PBKDF2',salt,iterations:ENCRYPTED_EXPORT_PROFILE.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,[usage]),'Deriving backup protection key');}finally{encoded.fill(0);}
}
async function encryptedPackage(blob,manifestSha256,passphrase){
  const api=encryptionCrypto(),salt=api.getRandomValues(new Uint8Array(16)),iv=api.getRandomValues(new Uint8Array(12)),key=await backupKey(passphrase,salt,'encrypt'),aad=encryptionBytes(manifestSha256,32);
  // Reserve the salt/IV pair before encryption. The ledger contains no key or
  // passphrase; repeated CSPRNG output fails before any ciphertext is returned.
  const tx=await openTransaction(META,'readwrite'),nonceKey='encryptedExportNonce:'+encryptionHex(salt)+':'+encryptionHex(iv);
  try{if(await request(tx.objectStore(META).get(nonceKey)))throw storageError('Secure backup randomness was repeated. Retry with a working cryptography provider.','BACKUP_NONCE_REUSE');fault('during-backup-protection');tx.objectStore(META).put({key:nonceKey,value:{profile:ENCRYPTED_EXPORT_PROFILE.schema,createdAt:now()}});await complete(tx);}catch(error){try{tx.abort();}catch{}throw error;}
  const bytes=new Uint8Array(await hash.readWithDeadline(blob.arrayBuffer(),'Reading backup bytes'));let result;
  try{result=new Uint8Array(await hash.readWithDeadline(api.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},key,bytes),'Protecting backup bytes'));}finally{bytes.fill(0);}
  const ciphertext=result.subarray(0,result.length-16),tag=result.subarray(result.length-16),container={...ENCRYPTED_EXPORT_PROFILE,salt:encryptionHex(salt),iv:encryptionHex(iv),manifestSha256,ciphertextLength:ciphertext.length,authenticationTag:encryptionHex(tag),ciphertext:bytesToBase64(ciphertext)};
  return new Blob([JSON.stringify(container)],{type:'application/vnd.closed-loop.encrypted+json'});
}
async function isEncryptedPackage(blob){return /^\s*\{\s*"schema"\s*:\s*"closed-loop-encrypted-export\/1"/.test(await hash.readWithDeadline(blob.slice(0,160).text(),'Reading backup header'));}
function validEncryptedBase64(value){
  if(typeof value!=='string'||value.length%4!==0)return false;
  const padding=value.endsWith('==')?2:value.endsWith('=')?1:0,end=value.length-padding;
  for(let i=0;i<end;i++){const code=value.charCodeAt(i);if(!(code>=65&&code<=90||code>=97&&code<=122||code>=48&&code<=57||code===43||code===47))return false;}
  return true;
}
async function decryptPackage(blob,passphrase){
  let container;try{container=JSON.parse(await hash.readWithDeadline(blob.text(),'Reading protected backup'));}catch(error){if(error?.code==='IO_READ_TIMEOUT')throw error;throw storageError('The encrypted backup is incomplete or invalid.','ENCRYPTED_PACKAGE_INVALID');}
  const expected=[...Object.keys(ENCRYPTED_EXPORT_PROFILE),'salt','iv','manifestSha256','ciphertextLength','authenticationTag','ciphertext'];
  if(Object.keys(container).length!==expected.length||Object.keys(container).some(key=>!expected.includes(key))||Object.entries(ENCRYPTED_EXPORT_PROFILE).some(([key,value])=>container[key]!==value))throw storageError('The encrypted backup uses unsupported or modified protection settings.','ENCRYPTED_PACKAGE_INVALID');
  if(!validEncryptedBase64(container.ciphertext))throw storageError('Encrypted backup ciphertext is invalid.','ENCRYPTED_PACKAGE_INVALID');
  const salt=encryptionBytes(container.salt,16),iv=encryptionBytes(container.iv,12),tag=encryptionBytes(container.authenticationTag,16),aad=encryptionBytes(container.manifestSha256,32),ciphertext=base64ToBytes(container.ciphertext);
  if(!Number.isSafeInteger(container.ciphertextLength)||ciphertext.length!==container.ciphertextLength)throw storageError('The encrypted backup has missing or modified bytes.','ENCRYPTED_PACKAGE_INVALID');
  const key=await backupKey(passphrase,salt,'decrypt'),combined=new Uint8Array(ciphertext.length+tag.length);combined.set(ciphertext);combined.set(tag,ciphertext.length);let plaintext;
  try{plaintext=await hash.readWithDeadline(encryptionCrypto().subtle.decrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},key,combined),'Verifying protected backup');}catch(error){if(error?.code==='IO_READ_TIMEOUT')throw error;throw storageError('The backup password is incorrect or the encrypted file has changed. The existing project is unchanged.','BACKUP_AUTHENTICATION_FAILED');}
  const result=new Blob([plaintext],{type:'application/gzip'}),parsed=await readPackageJson(result);
  if(hash.sha256Value(parsed.payload.packageManifest)!==container.manifestSha256)throw storageError('The decrypted backup does not match its protected manifest.','BACKUP_AUTHENTICATION_FAILED');
  new Uint8Array(plaintext).fill(0);return result;
}
async function exportPackage(jobId,{passphrase=null,historyRecovery=false}={}){
  const captured=await readExportSnapshot(jobId),{project,artifacts}=captured,recovery=captured.recovery?clone(captured.recovery):null,artifactEntries=[],fileContents=new WeakMap();assertPackageArtifactCustody(project,artifacts);
  let requiresEncryption=historyRecovery||containsCredentialSecret(project)||artifacts.some(containsCredentialSecret);
  const compatibilityObservations=[];
  const classifiedProjectParts=new Map(),verifiedHistoryRoots=new Map(),verifiedHistoryParts=new Map();let previousHistoryRootId=null;
  if(recovery&&recovery.activeProjectSha256!==project.projectSha256)throw storageError('Project changed while assembling its backup. Retry from the current version.','STALE_PROJECT_REVISION');
  async function member(a){
    const actualSize=a.blob.size,actualSha256=await hash.sha256Bytes(a.blob);
    if(actualSize!==Number(a.byteSize)||actualSha256!==String(a.sha256))throw storageError(`Stored file ${a.filename} failed export-time byte verification.`,'ARTIFACT_INTEGRITY_MISMATCH');
    const {blob,...metadata}=a,entry={...metadata,base64:''};artifactEntries.push(entry);fileContents.set(entry,{property:'base64',encoding:'base64',blob});
  }
  for(const a of artifacts)await member(a);
  await verifyOriginalSourceBindings(project,artifacts);
  if(recovery){
    validateRecoveryManifest(recovery);await verifyHistorySourceArchives(recovery);requiresEncryption=requiresEncryption||containsCredentialSecret(recovery.sourceArchives);
    for(const entry of recovery.entries){const saved=await metaGet(snapshotKey(jobId,entry.id));if(!saved?.blob||saved.sha256!==entry.sha256)throw storageError('A promised checkpoint is missing. Backup export did not complete.','HISTORY_VERSION_UNAVAILABLE');await member({artifactId:'RECOVERY-SNAPSHOT-'+entry.id,jobId,filename:entry.id+'.checkpoint.gz',mediaType:'application/gzip',archiveKind:'RECOVERY_SNAPSHOT',checkpointId:entry.id,byteSize:entry.byteSize,sha256:entry.sha256,blob:saved.blob});const {payload:checkpoint}=await readPackageJson(saved.blob,{spoolArtifacts:false});if(checkpoint.schema!==HISTORY_SCHEMA||checkpoint.id!==entry.id||checkpoint.jobId!==String(jobId)||checkpoint.projectSha256!==entry.projectSha256)throw storageError('A saved checkpoint does not match its recorded identity.','HISTORY_VERSION_MISMATCH');// A matching snapshot transport hash does not prove its declared work
      // preimage. Verify the complete immutable body before calling this a
      // successful backup; retain at most one expanded root between groups.
      const rootId=entry.projectReference?.checkpointId||entry.id;
      if(previousHistoryRootId&&previousHistoryRootId!==rootId){const previous=verifiedHistoryRoots.get(previousHistoryRootId);if(previous)delete previous.project;}
      previousHistoryRootId=rootId;
      if(historyRecovery){const facts=await inspectRetainedCheckpoint(jobId,entry.id,recovery);if(!facts.integrityValid)compatibilityObservations.push(checkpointCompatibilityObservation(facts));}
      else{
      await readCheckpointBody(jobId,{...entry,blob:saved.blob},async id=>{const expected=recovery.entries.find(item=>item.id===id),stored=await metaGet(snapshotKey(jobId,id));return expected&&stored?.blob?{...expected,blob:stored.blob}:null;},verifiedHistoryRoots,false,sha=>metaGet(historyFileKey(jobId,sha)),verifiedHistoryParts);
      }
      requiresEncryption=requiresEncryption||containsCredentialSecret(checkpoint);
      if(!equivalent(checkpoint.projectParts||null,entry.projectParts||null))throw storageError('Saved project content references differ from their retained manifest.','HISTORY_VERSION_MISMATCH');
      for(const part of checkpoint.projectParts?.entries||[]){const prior=classifiedProjectParts.get(part.sha256);if(prior!==undefined&&prior!==part.byteSize)throw storageError('Saved project content sizes conflict.','HISTORY_VERSION_MISMATCH');classifiedProjectParts.set(part.sha256,part.byteSize);}
    }
    for(const [sha256,info] of Object.entries(recovery.files)){const file=await metaGet(historyFileKey(jobId,sha256));if(!file?.blob)throw storageError('A retained file is missing. Backup export did not complete.','HISTORY_FILE_INTEGRITY_FAILED');await member({artifactId:'RECOVERY-BYTES-'+sha256,jobId,filename:sha256+'.bin',mediaType:'application/octet-stream',archiveKind:'RECOVERY_BYTES',byteSize:info.byteSize,sha256,blob:file.blob});
      if(classifiedProjectParts.has(sha256)){
        if(classifiedProjectParts.get(sha256)!==file.blob.size)throw storageError('Saved project content size differs from its retained reference.','HISTORY_VERSION_MISMATCH');
        // The encoder creates disjoint canonical JSON values without nested
        // references. Inspect their verified typed values as well as the inline
        // checkpoint; JSON-looking authored strings remain opaque strings.
        const {payload:value}=await readPackageJson(file.blob,{compressed:false,spoolArtifacts:false});requiresEncryption=requiresEncryption||containsCredentialSecret(value);classifiedProjectParts.delete(sha256);
      }
    }
    if(classifiedProjectParts.size)throw storageError('Referenced saved project contents are missing. Backup export did not complete.','HISTORY_FILE_INTEGRITY_FAILED');
  }
  if(historyRecovery&&recovery){recovery.compatibility={schema:globalThis.closedLoopWorkflowSchema.RECOVERY_COMPATIBILITY_CONTRACT.schema,observations:compatibilityObservations};validateHistoryCompatibility(recovery);}
  const exportedProject=canonicalProject(project),packageManifest={jobId,projectSha256:project.projectSha256,artifactCount:artifactEntries.length,artifacts:artifactEntries.map(a=>({artifactId:a.artifactId,filename:a.filename,mediaType:a.mediaType,byteSize:a.byteSize,sha256:a.sha256}))};
  if(requiresEncryption&&!passphrase)throw storageError(historyRecovery?'Enter a backup password to preserve the original History in a recovery backup.':'This backup includes credential material in the project or its saved History. Enter a backup password to protect it.','BACKUP_PASSPHRASE_REQUIRED');
  const body={schema:'closed-loop-project-package/1',projectSchema:project.schema,workflow:project.workflow,responseSchema:globalThis.closedLoopWorkflowSchema?.RESPONSE_SCHEMA,project:exportedProject,artifacts:artifactEntries,packageManifest,...(recovery?{recovery}:{}),exportedAt:now()};
  const {blob:compressed,packageSha256}=await compressPackage(body,fileContents),exportRecord={jobId,packageSha256,projectRevision:project.revision,projectSha256:project.projectSha256,artifactManifestSha256:hash.sha256Value(packageManifest.artifacts),artifactCount:artifactEntries.length,historyCheckpointCount:recovery?.entries.length||0,at:now()};
  const result=passphrase?await encryptedPackage(compressed,hash.sha256Value(packageManifest),passphrase):new Blob([compressed],{type:'application/gzip'});exportRecord.protectionProfile=passphrase?ENCRYPTED_EXPORT_PROFILE.schema:'UNENCRYPTED';
  const tx=await openTransaction([PROJECTS,META],'readwrite'),finished=complete(tx);
  try{const current=await projectRowWithOperations(tx,jobId),history=(await request(tx.objectStore(META).get(historyKey(jobId))))?.value||null;
   if(current?.projectSha256!==project.projectSha256||Number(current?.revision)!==Number(project.revision)||Number(history?.generation||0)!==Number(captured.recovery?.generation||0))throw storageError('Project or History changed before its backup completed. Retry from the current version.','STALE_PROJECT_REVISION');
   tx.objectStore(META).put({key:'lastVerifiedExport',value:exportRecord,updatedAt:now()});tx.objectStore(META).put({key:'lastVerifiedExport:'+jobId,value:exportRecord,updatedAt:now()});await finished;return result;
  }catch(error){try{tx.abort();}catch{}await finished.catch(()=>{});throw error;}

}
// Decode the unchanged JSON package without retaining its complete expanded
// text. The project remains a finite-memory object; artifact strings are
// temporary Blobs whose exact decoded spelling is used by the canonical hash.
async function readPackageJson(blob,{compressed=true,spoolArtifacts=true,capturePackageExtensions=false}={}){
  const fileContents=new WeakMap(),stack=[],projectSourceParts=[];let root,hasRoot=false,kind=null,atom='',raw='',pieces=[],spooled=false,escape=false,unicode=0,lastYield=Date.now(),projectSourceDepth=null,projectSourceStart=null,projectSourceBlob=null;
  const packageMembers=[],rootMemberCounts=new Map();let packageCapture=null;
  const packageKeys=globalThis.closedLoopWorkflowSchema.ORIGINAL_PACKAGE_EXTENSION_SOURCE_CONTRACT.rootKeys;
  function finishPackageMember(text,end){
    if(!packageCapture||stack.length!==1||stack[0].state!=='commaOrEnd')return;
    packageCapture.parts.push(new Blob([text.slice(packageCapture.start,end)]));
    packageMembers.push({key:packageCapture.key,occurrence:packageCapture.occurrence,hasUnknown:packageCapture.hasUnknown===true,payload:stack[0].value[packageCapture.key],blob:new Blob(packageCapture.parts,{type:'application/octet-stream'})});packageCapture=null;
  }
  const fail=()=>{throw new SyntaxError('Malformed project package JSON.');};
  const frame=()=>stack.at(-1);
  const expectsValue=()=>{const parent=frame();return parent?parent.state==='value'||parent.state==='valueOrEnd':!hasRoot;};
  function value(item,source=null){
    const parent=frame();if(!parent){if(hasRoot)fail();root=item;hasRoot=true;return;}
    if(parent.type==='object'&&(parent.state==='key'||parent.state==='keyOrEnd')){if(typeof item!=='string')fail();parent.key=item;parent.state='colon';if(capturePackageExtensions&&stack.length===1){const occurrence=rootMemberCounts.get(item)||0;rootMemberCounts.set(item,occurrence+1);if(item==='packageManifest'||!packageKeys.includes(item)){packageCapture.key=item;packageCapture.occurrence=occurrence;}else packageCapture=null;}if(capturePackageExtensions&&packageCapture?.key==='packageManifest'){const contract=globalThis.closedLoopWorkflowSchema.ORIGINAL_PACKAGE_EXTENSION_SOURCE_CONTRACT;if(parent.packageManifest&&!contract.manifestKeys.includes(item)||parent.manifestArtifact&&!contract.manifestArtifactKeys.includes(item))packageCapture.hasUnknown=true;}return;}
    if(!expectsValue())fail();
    if(parent.type==='array')parent.value.push(item);
    else{Object.defineProperty(parent.value,parent.key,{value:item,enumerable:true,writable:true,configurable:true});if(parent.artifact&&parent.key==='base64'){if(source)fileContents.set(parent.value,source);else fileContents.delete(parent.value);}}
    parent.state='commaOrEnd';
  }
  function flushString(){if(!raw)return;const text=JSON.parse('"'+raw+'"');raw='';if(spooled){if(/[^\x00-\x7f]/.test(text))throw new TypeError('Artifact base64 must contain ASCII characters.');pieces.push(new Blob([text]));}else pieces.push(text);}
  function parseChunk(text){
    let start=kind==='string'?0:-1;if(projectSourceDepth!==null)projectSourceStart=0;if(packageCapture)packageCapture.start=0;
    const stringBoundary=/["\\\u0000-\u001f]/g;
    for(let i=0;i<text.length;i++){
      const char=text[i];
      if(kind==='string'){
        // Retained responses can contain megabytes of ordinary string data.
        // Keep the same bounded pieces and escape validation, but let the
        // native scanner skip spans which contain no JSON control character.
        if(!unicode&&!escape){
          stringBoundary.lastIndex=i;
          const boundary=stringBoundary.exec(text),end=Math.min(boundary?.index??text.length,start+Math.max(0,16384-raw.length));
          if(end>i){
            if(raw.length+end-start>=16384){raw+=text.slice(start,end);flushString();start=end;}
            i=end-1;continue;
          }
        }
        if(unicode){if(!/[0-9a-fA-F]/.test(char))fail();unicode--;}
        else if(escape){if(!'"\\/bfnrtu'.includes(char))fail();if(char==='u')unicode=4;escape=false;}
        else if(char==='\\')escape=true;
        else if(char==='"'){
          raw+=text.slice(start,i);flushString();const item=spooled?'':pieces.join(''),source=spooled?{property:'base64',encoding:'utf8',blob:new Blob(pieces)}:null;
          kind=null;pieces=[];spooled=false;start=-1;value(item,source);finishPackageMember(text,i+1);continue;
        }else if(char<' ')fail();
        if(!escape&&!unicode&&raw.length+i-start+1>=16384){raw+=text.slice(start,i+1);flushString();start=i+1;}
        continue;
      }
      if(kind==='atom'){
        if(!/[\s,\]}:]/.test(char)){atom+=char;continue;}
        value(JSON.parse(atom));atom='';kind=null;finishPackageMember(text,i);i--;continue;
      }
      if(char===' '||char==='\t'||char==='\r'||char==='\n')continue;
      const parent=frame();
      if(char==='"'){
        if(!expectsValue()&&!(parent?.type==='object'&&['key','keyOrEnd'].includes(parent.state)))fail();
        if(capturePackageExtensions&&stack.length===1&&parent?.type==='object'&&['key','keyOrEnd'].includes(parent.state))packageCapture={parts:[],start:i};
        kind='string';raw='';pieces=[];escape=false;unicode=0;spooled=Boolean(parent?.artifact&&parent.key==='base64'&&parent.state==='value');start=i+1;continue;
      }
      if(char==='{'||char==='['){
        if(!expectsValue())fail();const type=char==='{'?'object':'array',item=type==='object'?{}:[],artifact=type==='object'&&Boolean(parent?.artifactArray),artifactArray=spoolArtifacts&&type==='array'&&stack.length===1&&parent.type==='object'&&parent.key==='artifacts';
        if(spoolArtifacts&&type==='object'&&stack.length===1&&parent.type==='object'&&parent.key==='project'){projectSourceParts.length=0;projectSourceDepth=stack.length+1;projectSourceStart=i;}
        value(item);stack.push({type,value:item,state:type==='object'?'keyOrEnd':'valueOrEnd',artifact,artifactArray,packageManifest:capturePackageExtensions&&type==='object'&&stack.length===1&&parent?.key==='packageManifest',manifestArtifactArray:capturePackageExtensions&&type==='array'&&parent?.packageManifest&&parent.key==='artifacts',manifestArtifact:capturePackageExtensions&&type==='object'&&parent?.manifestArtifactArray});continue;
      }
      if(char==='}'||char===']'){
        if(!parent||parent.type!==(char==='}'?'object':'array')||!['keyOrEnd','valueOrEnd','commaOrEnd'].includes(parent.state))fail();if(projectSourceDepth===stack.length){projectSourceParts.push(new Blob([text.slice(projectSourceStart,i+1)]));projectSourceBlob=new Blob(projectSourceParts,{type:'application/json'});projectSourceDepth=null;projectSourceStart=null;}stack.pop();finishPackageMember(text,i+1);continue;
      }
      if(char===','){if(parent?.state!=='commaOrEnd')fail();parent.state=parent.type==='object'?'key':'value';continue;}
      if(char===':'){if(parent?.type!=='object'||parent.state!=='colon')fail();parent.state='value';continue;}
      if(!expectsValue()||!/[\-0-9tfn]/.test(char))fail();kind='atom';atom=char;
    }
    if(kind==='string')raw+=text.slice(start);if(projectSourceDepth!==null)projectSourceParts.push(new Blob([text.slice(projectSourceStart)]));if(packageCapture)packageCapture.parts.push(new Blob([text.slice(packageCapture.start)]));
  }
  const stream=blob.stream(),reader=(compressed?stream.pipeThrough(new DecompressionStream('gzip')):stream).getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let expandedBytes=0;
  // Internal checkpoint metadata has no streamed artifact payload. Native JSON
  // decoding avoids revisiting every short field in JavaScript for every saved
  // version. Keep this temporary text strictly bounded in UTF-8 bytes; a large
  // or legacy checkpoint resumes the existing streaming parser at the exact
  // buffered prefix. Full backup packages always keep artifact strings spooled.
  const METADATA_PARSE_BYTE_LIMIT=8*1024*1024;
  let metadataText=spoolArtifacts||capturePackageExtensions?null:[];
  async function consume(text){parseChunk(text);if(Date.now()-lastYield>=8){await new Promise(resolve=>setTimeout(resolve,0));lastYield=Date.now();}}
  try{
    while(true){
      const {value:bytes,done}=await hash.readWithDeadline(reader.read(),'Reading recovery stream',error=>reader.cancel(error));if(done)break;
      expandedBytes+=bytes.byteLength;
      if(metadataText&&expandedBytes>METADATA_PARSE_BYTE_LIMIT){for(const text of metadataText)await consume(text);metadataText=null;}
      for(let offset=0;offset<bytes.length;offset+=65536){
        const text=decoder.decode(bytes.subarray(offset,offset+65536),{stream:true});
        if(metadataText)metadataText.push(text);else await consume(text);
      }
    }
    const tail=decoder.decode();
    if(metadataText)return {payload:JSON.parse(metadataText.join('')+tail),fileContents,expandedBytes};
    parseChunk(tail);if(kind==='atom'){value(JSON.parse(atom));kind=null;}if(kind||stack.length||!hasRoot)fail();return {payload:root,fileContents,expandedBytes,projectSourceBlob,packageMembers,rootMemberCounts};
  }catch(error){try{void reader.cancel(error).catch(()=>{});}catch{}throw error;}finally{reader.releaseLock();}
}
async function base64BlobToBlob(blob,mediaType){
  const parts=[];let pending='';
  for(let offset=0;offset<blob.size;offset+=65536){pending+=(await hash.readWithDeadline(blob.slice(offset,offset+65536).text(),'Reading recovered artifact')).replace(/[\t\n\f\r ]/g,'');const end=Math.max(0,Math.floor(pending.length/4)*4-4);if(end){const part=pending.slice(0,end);if(part.includes('='))throw new TypeError('Invalid base64 padding before the end of an artifact.');parts.push(base64ToBytes(part));pending=pending.slice(end);}}
  parts.push(base64ToBytes(pending));return new Blob(parts,{type:mediaType||'application/octet-stream'});
}
async function importPackage(blob,{operationId=null,passphrase=null,pendingBackupImport=null}={}){
  hash.assertPinnedUnicodeHost();
  // A pending intake is the original transport, including encryption. The
  // worker must verify that same slot before decrypting; passwords exist only
  // in the ephemeral command and are never written to the staging descriptor.
  if(pendingBackupImport&&useStoreWorker())return requestStoreWorker('IMPORT_PACKAGE',[blob,{passphrase,pendingBackupImport}]);
  let stagedBackup=null;
  if(pendingBackupImport){
    const {jobId,stagingId}=pendingBackupImport;
    stagedBackup=await readPendingBackupImport(jobId);
    if(!stagedBackup||stagedBackup.stagingId!==stagingId)throw staleBackupImportSelection();
    if(!(blob instanceof Blob)||blob.size!==stagedBackup.byteSize||await hash.sha256Bytes(blob)!==stagedBackup.sha256)throw storageError('The import input differs from the saved backup selection. Choose the original file again.','BACKUP_IMPORT_STAGE_REHASH_MISMATCH');
    blob=stagedBackup.blob;
  }
  if(useStoreWorker())return requestStoreWorker('IMPORT_PACKAGE',[blob,{passphrase}]);
  const protectedTransport=await isEncryptedPackage(blob);if(protectedTransport)blob=await decryptPackage(blob,passphrase);
  if(typeof DecompressionStream!=='function')throw storageError('DecompressionStream is required for complete package import.','DECOMPRESSION_STREAM_REQUIRED');
  const observedHeads=new Map((await listProjectSummaries()).map(p=>[projectIdentity(p),Number(p.revision||0)]));
  const {payload,fileContents,projectSourceBlob,packageMembers,rootMemberCounts}=await readPackageJson(blob,{capturePackageExtensions:true}),{packageSha256,...body}=payload;
  if(await hash.sha256Chunks(packageJsonChunks(body,fileContents))!==packageSha256)throw Object.assign(new Error('Project package hash mismatch.'),{existingProjectsUnchanged:true});
  if(body.schema!=='closed-loop-project-package/1')throw Object.assign(new Error('Unsupported project package schema.'),{existingProjectsUnchanged:true});
  const schemaApi=globalThis.closedLoopWorkflowSchema,project=body.project,id=projectIdentity(project);
  if(project?.schema!=='closed-loop-project/3'||project?.workflow!=='mobile-closed-loop/30'||Number(project?.stageCount)!==30||Object.keys(project?.stages||{}).length!==30)throw Object.assign(new Error('Imported project identity or stage count is invalid.'),{existingProjectsUnchanged:true});
  if(body.projectSchema!==project.schema||body.workflow!==project.workflow||body.responseSchema!==schemaApi?.RESPONSE_SCHEMA)throw Object.assign(new Error('Package schema manifest does not match the embedded project.'),{existingProjectsUnchanged:true});
  if(!id)throw Object.assign(new Error('Imported project has no JOB_ID.'),{existingProjectsUnchanged:true});
  // A package hash proves byte identity, not agreement with canonical records.
  // Validate saved projections before activation; do not commit contradictory
  // state and defer its rejection to the subsequent History/view refresh.
  // Validation recalculates a disposable copy and preserves the source bytes.
  const packageArtifacts=Array.isArray(body.artifacts)?body.artifacts:[],artifactIds=packageArtifacts.map(a=>String(a?.artifactId||''));if(artifactIds.some(x=>!x)||new Set(artifactIds).size!==artifactIds.length)throw Object.assign(new Error('Package artifacts contain a missing or duplicate artifact identity.'),{existingProjectsUnchanged:true});
  const verifiedArtifacts=[],verifiedByteDigests=new WeakMap(),verifiedSources=new WeakMap();
  for(const a of packageArtifacts){if(a.jobId!==undefined&&String(a.jobId)!==id)throw Object.assign(new Error(`Artifact ${a.artifactId} belongs to a different JOB_ID than the package project.`),{existingProjectsUnchanged:true});const source=fileContents.get(a),artifactBlob=source?await base64BlobToBlob(source.blob,a.mediaType):base64ToBlob(a.base64,a.mediaType);fileContents.delete(a);if(artifactBlob.size!==Number(a.byteSize))throw Object.assign(new Error(`Artifact ${a.artifactId} byte size mismatch.`),{existingProjectsUnchanged:true});const digest=await historyBlobSha256(artifactBlob,verifiedByteDigests);if(digest!==a.sha256)throw Object.assign(new Error(`Artifact ${a.artifactId} hash mismatch.`),{existingProjectsUnchanged:true});const {base64,...metadata}=a;verifiedArtifacts.push({...clone(metadata),jobId:id,blob:artifactBlob});}
  const manifest=body.packageManifest||{},manifestArtifacts=Array.isArray(manifest.artifacts)?manifest.artifacts:[],manifestIds=manifestArtifacts.map(a=>String(a?.artifactId||''));if(manifestIds.some(x=>!x)||new Set(manifestIds).size!==manifestIds.length)throw Object.assign(new Error('Package manifest contains a missing or duplicate artifact identity.'),{existingProjectsUnchanged:true});if(manifest.jobId!==id||Number(manifest.artifactCount)!==verifiedArtifacts.length||manifestArtifacts.length!==verifiedArtifacts.length||manifest.projectSha256!==projectSha256(project))throw Object.assign(new Error('Package manifest does not reconcile with the embedded project and artifacts.'),{existingProjectsUnchanged:true});
  const manifestById=new Map(manifestArtifacts.map(a=>[String(a.artifactId),a]));for(const a of verifiedArtifacts){const m=manifestById.get(String(a.artifactId));if(!m||m.sha256!==a.sha256||Number(m.byteSize)!==Number(a.byteSize)||m.filename!==a.filename||String(m.mediaType||'')!==String(a.mediaType||''))throw Object.assign(new Error(`Package manifest mismatch for artifact ${a.artifactId}.`),{existingProjectsUnchanged:true});}
  recoveryProjectionBounds.set(project,body.exportedAt);
  await hydrateLegacyRunPromptContexts(project,verifiedArtifacts.filter(a=>!a.archiveKind));
  try{withVerifiedRecoveryCustody(verifiedArtifacts,()=>assertRecoveryCompatibility(project));assertPackageArtifactCustody(project,verifiedArtifacts);}catch(error){throw Object.assign(error,{existingProjectsUnchanged:true});}
  if(verifiedArtifacts.some(a=>a.archiveKind&&!['RECOVERY_BYTES','RECOVERY_SNAPSHOT'].includes(a.archiveKind)))throw storageError('Unknown recovery archive member.','HISTORY_VERSION_MISMATCH');
  const activeArtifacts=verifiedArtifacts.filter(a=>!a.archiveKind);await verifyOriginalSourceBindings(project,activeArtifacts,verifiedSources);const priorPhysical={},priorProject=await readProject(id,{[PHYSICAL_SOURCE_CAPTURE]:priorPhysical});
  if(Number(priorProject?.revision||0)!==Number(observedHeads.get(id)||0))throw storageError('This project changed while the backup was being verified. Its newer work is preserved.','STALE_PROJECT_REVISION');
  let preparedPrior=null;
  if(priorProject){try{preparedPrior=await prepareHistoryCommit(priorProject,priorProject);}catch(error){
    if(!['PACKAGE_ARTIFACT_CUSTODY_MISMATCH','HISTORY_FILE_INTEGRITY_FAILED'].includes(error.code))throw error;
    // Restoring verified bytes must remain possible when the active file copy
    // is damaged. Use the already-retained matching complete version; never
    // fabricate missing files or combine another version's project records.
    const retained=await metaGet(historyKey(id)),saved=retained?.activeId?await readRetainedCheckpoint(id,retained.activeId,retained):null;
    if(!saved||historyWorkSha256(saved.project)!==historyWorkSha256(priorProject))throw error;
    preparedPrior=await prepareHistoryCommit(priorProject,priorProject,{baseState:retained,artifactRows:saved.artifacts});
  }}
  const localState=preparedPrior?.state||await metaGet(historyKey(id)),merged=clone(localState||{schema:HISTORY_SCHEMA,jobId:id,generation:0,activeId:null,activeProjectSha256:null,entries:[],sessions:{},files:{},compressedProjectBytes:0,retainedFileBytes:0,redo:[]}),importSnapshots=[],importFiles=[];let importedView=null,importedActive=null;
  if(body.recovery){
    const incoming=body.recovery;
    if(incoming.schema!==HISTORY_SCHEMA||incoming.jobId!==id||!Array.isArray(incoming.entries)||!incoming.entries.some(e=>e.id===incoming.activeId)||new Set(incoming.entries.map(e=>e.id)).size!==incoming.entries.length)throw storageError('Backup History identity is invalid.','HISTORY_VERSION_MISMATCH');
    validateRecoveryManifest(incoming);assertHistoryLimits(incoming);
    if(incoming.compatibility&&!protectedTransport)throw storageError('History recovery backups require password protection.','BACKUP_PROTECTION_REQUIRED');
    const incomingObservations=[];
    const archiveFiles=new Map(verifiedArtifacts.filter(a=>a.archiveKind==='RECOVERY_BYTES').map(a=>[a.sha256,a])),archiveSnapshots=new Map(),validatedRoots=new Map(incoming.entries.filter(entry=>entry.projectReference).map(entry=>[entry.projectReference.checkpointId,null])),verifiedParts=new Map(),validatedProjections=new Set();
    for(const entry of incoming.entries){const archived=verifiedArtifacts.find(a=>a.archiveKind==='RECOVERY_SNAPSHOT'&&a.checkpointId===entry.id);if(archived)archiveSnapshots.set(entry.id,{...entry,blob:archived.blob});}
    await verifyHistorySourceArchives(incoming,sha=>archiveFiles.get(sha),verifiedSources,verifiedByteDigests,checkpointId=>archiveSnapshots.get(checkpointId));
    for(const [key,source]of Object.entries(incoming.sourceArchives||{})){const prior=merged.sourceArchives?.[key];if(prior&&hash.sha256Value(prior)!==hash.sha256Value(source))throw storageError('Original-source recovery metadata conflicts with retained evidence.','SOURCE_ARCHIVE_INTEGRITY_FAILED');merged.sourceArchives={...(merged.sourceArchives||{}),[key]:clone(source)};}
    // Both representations were verified against the same exact source digest.
    // An existing local reference remains valid; all its snapshots are retained.
    for(const [sha256,reference]of Object.entries(incoming.sourceArchiveReferences||{}))if(!merged.sourceArchiveReferences?.[sha256])merged.sourceArchiveReferences={...(merged.sourceArchiveReferences||{}),[sha256]:clone(reference)};
    let previousRootId=null;const digestHolder={scope:null,attempted:false};importDigestHolders.set(verifiedParts,digestHolder);
    try{for(const entry of incoming.entries){
      const rootId=entry.projectReference?.checkpointId||entry.id;
      // Keep the small validation receipts, not every expanded project graph.
      // Archived bytes and all retained checkpoints remain untouched. A later
      // reference reconstructs its exact root from verified immutable parts.
      if(previousRootId&&previousRootId!==rootId){const priorRoot=validatedRoots.get(previousRootId);if(priorRoot)delete priorRoot.project;}
      if(previousRootId&&previousRootId!==rootId){if(digestHolder.scope)hash.disposeCanonicalDigestScope(digestHolder.scope);digestHolder.scope=null;digestHolder.attempted=false;}
      previousRootId=rootId;
      const archived=verifiedArtifacts.find(a=>a.archiveKind==='RECOVERY_SNAPSHOT'&&a.checkpointId===entry.id);
      if(!archived||archived.sha256!==entry.sha256||archived.byteSize!==entry.byteSize)throw storageError('A promised checkpoint is missing from the backup.','HISTORY_VERSION_UNAVAILABLE');
      const snapshot={...entry,blob:archived.blob};let decoded=null;
      if(incoming.compatibility){
       const facts=await inspectRetainedCheckpoint(id,entry.id,incoming,sha=>archiveFiles.get(sha),checkpointId=>archiveSnapshots.get(checkpointId),verifiedParts,verifiedByteDigests);
       if(!facts.integrityValid){incomingObservations.push(checkpointCompatibilityObservation(facts));
        if(entry.id===incoming.activeId){
         // The old receipt remains invalid. Its view is copied only as data,
         // bound independently to the separately verified current state/files.
         const {payload:original}=await readPackageJson(archived.blob,{spoolArtifacts:false});
         if(facts.measuredWorkSha256!==historyWorkSha256(project)||facts.artifactManifestSha256!==historyArtifactsSha256(activeArtifacts))throw storageError('The invalid original cannot supply the verified current project view.','HISTORY_VERSION_MISMATCH');
         importedView=incoming.activeViewOverride||original.view;
         assertRecoveryViewFiles(id,importedView,activeArtifacts);
        }
       }else decoded=await decodeCheckpoint(id,snapshot,sha=>archiveFiles.get(sha),checkpointId=>archiveSnapshots.get(checkpointId),validatedRoots,verifiedParts,verifiedByteDigests,validatedProjections,verifiedSources);
      }else decoded=await decodeCheckpoint(id,snapshot,sha=>archiveFiles.get(sha),checkpointId=>archiveSnapshots.get(checkpointId),validatedRoots,verifiedParts,verifiedByteDigests,validatedProjections,verifiedSources);
      if(decoded&&entry.id===incoming.activeId){importedActive=decoded;importedView=incoming.activeViewOverride||decoded.view;}

      const existing=merged.entries.find(item=>item.id===entry.id);
      if(existing&&hash.sha256Value(existing)!==hash.sha256Value(entry))throw storageError('Backup History conflicts with a retained version.','IMMUTABLE_HISTORY_CONFLICT');
      if(!existing){merged.entries.push(clone(entry));merged.compressedProjectBytes+=entry.byteSize;importSnapshots.push(snapshot);}
    }
    }finally{if(digestHolder.scope)hash.disposeCanonicalDigestScope(digestHolder.scope);importDigestHolders.delete(verifiedParts);}
    if(incoming.compatibility){
     if(hash.sha256Value(incomingObservations)!==hash.sha256Value(incoming.compatibility.observations))throw storageError('Recovery observations differ from independently verified original History.','HISTORY_VERSION_MISMATCH');
     const combined=new Map((merged.compatibility?.observations||[]).map(row=>[row.checkpointId,row]));for(const row of incomingObservations)combined.set(row.checkpointId,clone(row));
     merged.compatibility={schema:globalThis.closedLoopWorkflowSchema.RECOVERY_COMPATIBILITY_CONTRACT.schema,observations:[...combined.values()]};
    }
    for(const entry of incoming.entries)if(entry.parentId&&!incoming.entries.some(parent=>parent.id===entry.parentId))throw storageError('Backup History has a missing parent checkpoint.','HISTORY_VERSION_MISMATCH');
    for(const [sha,info] of Object.entries(incoming.files)){
      const file=archiveFiles.get(sha);if(!file||file.byteSize!==info.byteSize)throw storageError('A retained file is missing from the backup.','HISTORY_FILE_INTEGRITY_FAILED');
      if(!merged.files[sha]){merged.files[sha]=clone(info);merged.retainedFileBytes+=info.byteSize;importFiles.push({sha256:sha,blob:file.blob});}
    }
    for(const [session,info] of Object.entries(incoming.sessions||{})){if(!incoming.entries.some(e=>e.id===info.checkpointId))throw storageError('Backup session start is unavailable.','HISTORY_VERSION_MISMATCH');if(merged.sessions[session]&&merged.sessions[session].checkpointId!==info.checkpointId)throw storageError('Backup session start conflicts with retained History.','IMMUTABLE_HISTORY_CONFLICT');merged.sessions[session]=clone(info);}
    for(const [command,transfer] of Object.entries(incoming.transfers||{})){const prior=merged.transfers?.[command];if(prior&&prior.intentSha256!==transfer.intentSha256)throw storageError('Backup external-operation history conflicts with retained evidence.','EXTERNAL_OPERATION_CONFLICT');merged.transfers=merged.transfers||{};if(!prior||!['SUCCEEDED','FAILED'].includes(prior.result))merged.transfers[command]=clone(transfer);}
    for(const [key,receipt] of Object.entries(incoming.commandReceipts||{})){const existing=merged.commandReceipts?.[key];if(existing&&hash.sha256Value(existing)!==hash.sha256Value(receipt))throw storageError('Backup command receipt conflicts with retained execution history.','IDEMPOTENCY_PAYLOAD_CONFLICT');merged.commandReceipts={...(merged.commandReceipts||{}),[key]:clone(receipt)};}
    merged.activeId=incoming.activeId;
  }else if(verifiedArtifacts.some(a=>a.archiveKind))throw storageError('Backup archive members have no governing History manifest.','HISTORY_VERSION_MISMATCH');
  let next=clone(project);next.revision=Math.max(Number(priorProject?.revision||0),Number(project.revision||0))+1;next.historyActivationId=crypto.randomUUID();delete next.projectSha256;
  if(!(projectSourceBlob instanceof Blob))throw storageError('The imported project source bytes are unavailable.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
  const packageSourceSha256=await hash.sha256Bytes(blob),extensionSources=await preparePackageExtensionSources(id,packageMembers,rootMemberCounts,packageSourceSha256,packageSha256);
  const importSourceRows=[],importSource=await retainProjectSource(next,{blob:projectSourceBlob,payload:project,sourceSha256:packageSourceSha256,sourceEncoding:'UTF-8',sourceLocation:{jsonPointer:'/project',containerEncoding:'gzip'},parserIdentity:'closed-loop-project-package-json-reader',parserVersion:'1'},importSourceRows,{recordProject:false});
  if(body.recovery&&body.recovery.activeProjectSha256!==projectSha256(project))throw storageError('Backup active project does not match its recovery version.','HISTORY_VERSION_MISMATCH');
  assertRecoveryViewFiles(id,importedView,activeArtifacts);
  importedView=rebaseHistoryView(project,importedView);
  bindRestoredCandidates(next,project,importedActive?body.recovery?.activeId||null:null,importedView);
  withVerifiedRecoveryCustody(activeArtifacts,()=>{next=recalculateChangedProjection(next,{sourceProjectSha256:manifest.projectSha256});assertProjectIntegrity(next);});
  importedView=rebaseHistoryView(next,importedView);
  let prepared;
  if(importedActive&&historyWorkSha256(importedActive.project)===historyWorkSha256(project)&&historyArtifactsSha256(importedActive.artifacts)===historyArtifactsSha256(activeArtifacts)){
    // Activating an existing complete version needs no additional retention
    // slot, exactly as Undo and native history restoration do.
    merged.activeProjectSha256=projectSha256(next);merged.activeRevision=next.revision;merged.activeViewOverride=importedView;merged.title=String(next.job?.JOB_TITLE||'');merged.removed=false;merged.redo=[];merged.generation=Number(localState?.generation||0)+1;reconcileRecoveryTransfers(merged,next);
    prepared={state:merged,expectedGeneration:Number(localState?.generation||0),snapshots:[],newFiles:[]};
  }else prepared=await prepareHistoryCommit(next,null,{label:'Restored backup',view:importedView,baseState:merged,artifactRows:activeArtifacts,retainedFiles:[...(preparedPrior?.newFiles||[]),...importFiles]});
  prepared.expectedGeneration=preparedPrior?preparedPrior.expectedGeneration:Number(localState?.generation||0);
  prepared.snapshots=[...(preparedPrior?.snapshots||[]),...importSnapshots,...prepared.snapshots];prepared.newFiles=[...(preparedPrior?.newFiles||[]),...importFiles,...prepared.newFiles];
  // Transport custody is append-only recovery metadata, not a new work version.
  // Preserve a full-capacity backup without consuming a checkpoint merely to
  // record the exact bytes from which this activation was read.
  const sourceRow=importSourceRows[0],sourceKey=hash.sha256Value(importSource);
  let sourceReference=null;
  if(importedActive&&historyWorkSha256(importedActive.project)===historyWorkSha256(project)){
    const checkpoint=prepared.state.entries.find(entry=>entry.id===body.recovery.activeId),activation=Object.fromEntries(HISTORY_ACTIVATION_FIELDS.filter(key=>Object.hasOwn(project,key)).map(key=>[key,clone(project[key])])),reference={schema:HISTORY_SOURCE_REFERENCE,checkpointId:checkpoint.id,snapshotSha256:checkpoint.sha256,activation};
    // Equality is proved against the actual received bytes before sharing.
    // Different whitespace, escapes, number spelling, and unknown extension
    // bytes keep the original raw-archive path; parsing alone is insufficient.
    const reconstructed=new Blob([...hash.canonicalChunks(sourceReferenceProject(importedActive.project,reference))]);
    if(reconstructed.size===sourceRow.byteSize&&await hash.sha256Bytes(reconstructed)===sourceRow.sha256)sourceReference=reference;
  }
  if(!prepared.state.files[sourceRow.sha256]&&!prepared.state.sourceArchiveReferences?.[sourceRow.sha256]){
    if(sourceReference)prepared.state.sourceArchiveReferences={...(prepared.state.sourceArchiveReferences||{}),[sourceRow.sha256]:sourceReference};
    else{prepared.state.files[sourceRow.sha256]={byteSize:sourceRow.byteSize};prepared.state.retainedFileBytes+=sourceRow.byteSize;prepared.newFiles.push({sha256:sourceRow.sha256,blob:sourceRow.blob});}
  }else await readHistorySourceFile(prepared.state,importSource,async sha=>prepared.newFiles.find(file=>file.sha256===sha)||await metaGet(historyFileKey(id,sha)),async checkpointId=>prepared.snapshots.find(entry=>entry.id===checkpointId)||await metaGet(snapshotKey(id,checkpointId)));
  prepared.state.sourceArchives={...(prepared.state.sourceArchives||{}),[sourceKey]:importSource};
  for(const {source,blob:sourceBlob}of extensionSources){
    if(!prepared.state.files[source.sha256]){prepared.state.files[source.sha256]={byteSize:source.byteSize};prepared.state.retainedFileBytes+=source.byteSize;prepared.newFiles.push({sha256:source.sha256,blob:sourceBlob});}
    prepared.state.sourceArchives[hash.sha256Value(source)]=source;
  }
  validateRecoveryManifest(prepared.state);assertHistoryLimits(prepared.state);
  if(extensionSources.length)await verifyPackageExtensionArchives(prepared.state,async sha=>prepared.newFiles.find(file=>file.sha256===sha)||await metaGet(historyFileKey(id,sha)),verifiedByteDigests,packageSourceSha256+':'+packageSha256);
  fault('before-import-transaction');const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite'),projects=tx.objectStore(PROJECTS),artifacts=tx.objectStore(ARTIFACTS),meta=tx.objectStore(META);
  try{
    const prior=await projectRowWithOperations(tx,id,null,priorPhysical);if(Number(prior?.revision||0)!==Number(observedHeads.get(id)||0)||prior?.projectSha256!==priorProject?.projectSha256)throw storageError('Another tab changed this project during import.','STALE_PROJECT_REVISION');
    if(stagedBackup){const pending=await request(meta.get(backupImportStagingKey(stagedBackup.jobId)));if(!pending?.value||!sameBackupImportIdentity(pending.value,stagedBackup)||!(pending.value.blob instanceof Blob)||pending.value.blob.size!==stagedBackup.byteSize)throw staleBackupImportSelection();meta.delete(backupImportStagingKey(stagedBackup.jobId));}
    const digest=projectSha256(next),existingArtifacts=await request(artifacts.index('jobId').getAll(id));
    await restoreProjectAllocation(tx,next);
    for(const row of activeArtifacts){const existing=await request(artifacts.get(row.artifactId));if(existing&&String(existing.jobId)!==id)throw storageError('An imported artifact identity belongs to another project.','CROSS_PROJECT_ARTIFACT_ID_COLLISION');}
    for(const [key,receipt] of Object.entries(prepared.state.commandReceipts||{})){const current=await request(meta.get(key));if(current&&hash.sha256Value(current.value)!==hash.sha256Value(receipt))throw storageError('An imported command receipt conflicts with current execution history.','IDEMPOTENCY_PAYLOAD_CONFLICT');meta.put({key,value:receipt,updatedAt:now()});}
    await commitHistory(tx,prepared);
    for(const existing of existingArtifacts)artifacts.delete(existing.artifactId);
    const importedRow={jobId:id,revision:next.revision,picker:projectPickerKey(next),project:next,projectSha256:digest,updatedAt:now()},physicalWrite=await preparePhysicalRowPut(tx,importedRow,PROJECTS,'project'),journalRemoval=await preparePhysicalRowRemoval(tx,META,operationalKey(id),'value');
    fault('during-import-project-write');commitPhysicalRowPut(tx,physicalWrite,importedRow);commitPhysicalRowRemoval(tx,journalRemoval);
    for(const a of activeArtifacts){fault('during-import-artifact-write');await storeArtifactRow(tx,{...a,jobId:id});const staged=a.lineage?.stagedResponse;if(staged)meta.put({key:`responseStaging:${id}:${staged.stagingId}`,value:await sharedByteRecord(tx,{...clone(staged),blob:a.blob}),updatedAt:now()});}
    meta.put({key:'selectedProject',value:id,updatedAt:now()});meta.put({key:'lastCommittedRevision',value:{jobId:id,revision:next.revision,projectSha256:digest},updatedAt:now()});meta.put({key:'lastVerifiedImport',value:{jobId:id,packageSha256,artifactCount:activeArtifacts.length,historyCheckpointCount:prepared.state.entries.length,...(stagedBackup?{selectedBackupImport:backupImportDescriptor(stagedBackup)}:{}),at:now()},updatedAt:now()});recordWorkerCommit(tx,operationId,next,digest);fault('before-import-commit');await complete(tx);next.projectSha256=digest;notifyProjectChange(next);try{await observeProjectArtifactCustody(next);}catch(error){throw Object.assign(error,{existingProjectsUnchanged:false});}return next;
  }catch(error){let aborted=false;try{tx.abort();aborted=true;}catch{}throw Object.assign(error,{existingProjectsUnchanged:error.existingProjectsUnchanged!==false&&aborted});}
}

function promptContextArtifactId(jobId,file){return 'PROMPT-CONTEXT-'+hash.sha256Value({jobId:String(jobId),sha256:file.sha256});}
async function persistPromptContextRecords(records,project){
  const jobId=projectIdentity(project),byDigest=new Map(),groups=[];
  for(const record of records){
    const identities=[];
    for(const file of record.contextManifest?.promptContext?.attachments||[]){
      let identity=byDigest.get(file.sha256);
      if(!identity){identity={artifactId:promptContextArtifactId(jobId,file),sha256:file.sha256,byteSize:file.byteSize};byDigest.set(file.sha256,identity);}
      else if(identity.byteSize!==file.byteSize)throw storageError('Saved prompt context identity mismatch.','PROMPT_CONTEXT_INTEGRITY_FAILED');
      identities.push(identity);
    }
    if(identities.length)groups.push({record,identities});
  }
  if(!byDigest.size)return;
  const tx=await openTransaction(ARTIFACTS,'readonly'),finished=complete(tx),missing=new Set(),identities=[...byDigest.values()];
  // Handle transaction errors even if a request rejects first. Only IndexedDB
  // requests are awaited inside this snapshot; materialization/hashing happens
  // after it completes. Each window releases its rows/Blob handles promptly.
  finished.catch(()=>{});
  try{
    for(let offset=0;offset<identities.length;offset+=64)await Promise.all(identities.slice(offset,offset+64).map(async file=>{
      const row=await request(tx.objectStore(ARTIFACTS).get(file.artifactId));
      if(!row)missing.add(file.artifactId);
      else if(row.jobId!==jobId||row.sha256!==file.sha256||row.byteSize!==file.byteSize)throw storageError('Saved prompt context identity mismatch.','PROMPT_CONTEXT_INTEGRITY_FAILED');
    }));
    await finished;
  }catch(error){try{tx.abort();}catch{}await finished.catch(()=>{});throw error;}
  // This set belongs only to this preparation. New saves re-read the store.
  // The existing writer still hashes, stores, reads back and rehashes new bytes.
  for(const {record,identities:required} of groups){
    if(!required.some(file=>missing.has(file.artifactId)))continue;
    const files=globalThis.closedLoopPromptEngine.materializePromptContextFiles(record,project);
    for(const file of files){const artifactId=promptContextArtifactId(jobId,file);if(!missing.has(artifactId))continue;await putArtifact({artifactId,jobId,blob:new Blob([file.text],{type:file.mediaType}),filename:file.filename,mediaType:file.mediaType,lineage:{kind:'PROMPT_CONTEXT',sha256:file.sha256}});missing.delete(artifactId);}
  }
  if(missing.size)throw storageError('Exact saved prompt context bytes are unavailable.','PROMPT_CONTEXT_INTEGRITY_FAILED');
}
async function persistPromptContextFiles(record,project){await persistPromptContextRecords([record],project);}
async function readPromptContextFile(record,jobId,path='context.json'){
  const file=(record.contextManifest?.promptContext?.attachments||[]).find(file=>file.path===path);
  if(!file)throw storageError('The instruction does not authorize this context file.','PROMPT_CONTEXT_NOT_AUTHORIZED');
  let stored;try{stored=await readArtifactRow(promptContextArtifactId(jobId,file),{allowOccurrenceSizeMismatch:true});}catch(error){if(!['ARTIFACT_BYTE_REFERENCE_INVALID','ARTIFACT_BYTES_UNAVAILABLE','ARTIFACT_LEGACY_BYTES_INVALID'].includes(error.code))throw error;throw storageError('Exact saved context bytes failed read-back verification.','PROMPT_CONTEXT_INTEGRITY_FAILED');}
  return verifyPromptContextFile(file,jobId,stored);
}
async function verifyPromptContextFile(file,jobId,stored){
  if(!stored||String(stored.jobId)!==String(jobId)||!(stored.blob instanceof Blob)||stored.blob.size!==file.byteSize||stored.sha256!==file.sha256||await observedArtifactDigest(stored)!==file.sha256)throw storageError('Exact saved context bytes failed read-back verification.','PROMPT_CONTEXT_INTEGRITY_FAILED');
  return {...file,blob:stored.blob};
}

// closed-loop-archive-profile/1: exact, uncompressed members with a fixed ZIP
// representation. Blob parts retain bounded reads even for large source files.
const handoffCrcTable=(()=>{const table=new Uint32Array(256);for(let i=0;i<256;i++){let crc=i;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);table[i]=crc;}return table;})();
// Inbound ZIP is a convenience transport, not the deterministic outbound
// profile. Only verified member bytes leave this isolated, read-only parser.
const inboundZipCp437="\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00a2\u00a3\u00a5\u20a7\u0192\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u2310\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255d\u255c\u255b\u2510\u2514\u2534\u252c\u251c\u2500\u253c\u255e\u255f\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256b\u256a\u2518\u250c\u2588\u2584\u258c\u2590\u2580\u03b1\u00df\u0393\u03c0\u03a3\u03c3\u00b5\u03c4\u03a6\u0398\u03a9\u03b4\u221e\u03c6\u03b5\u2229\u2261\u00b1\u2265\u2264\u2320\u2321\u00f7\u2248\u00b0\u2219\u00b7\u221a\u207f\u00b2\u25a0\u00a0";
function inboundArchiveError(message,code='INBOUND_ARCHIVE_INVALID'){return storageError(message,code);}
function inboundCrc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=handoffCrcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function inboundZipExtras(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),fields=new Map();
 for(let at=0;at<bytes.length;){if(at+4>bytes.length)throw inboundArchiveError('ZIP extra-field header is truncated.');const id=view.getUint16(at,true),size=view.getUint16(at+2,true);at+=4;if(at+size>bytes.length||fields.has(id))throw inboundArchiveError('ZIP extra fields are truncated or repeated.');const data=bytes.subarray(at,at+size);at+=size;
  if(!globalThis.closedLoopWorkflowSchema.INBOUND_RESPONSE_ARCHIVE_CONTRACT.supportedZipExtraFieldIds.includes(id))throw inboundArchiveError('The ZIP uses an unsupported extra-field interpretation. Use ordinary STORE or DEFLATE files, or select the original files separately.','INBOUND_ARCHIVE_UNSUPPORTED');
  if(id===0x000d&&size!==12)throw inboundArchiveError('UNIX link or device entries are prohibited.');
  if(id===0x756e){const v=new DataView(data.buffer,data.byteOffset,data.byteLength);if(size!==14||inboundCrc32(data.subarray(4))!==v.getUint32(0,true)||![0,0x8000].includes(v.getUint16(4,true)&0xf000)||v.getUint32(6,true)!==0)throw inboundArchiveError('ASi UNIX link or device entries are prohibited.');}
  fields.set(id,data);
 }
 return fields;
}
function inboundZipName(bytes,flags,extras){
 let name;try{name=flags&0x800?new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes):Array.from(bytes,byte=>byte<128?String.fromCharCode(byte):inboundZipCp437[byte-128]).join('');}catch{throw inboundArchiveError('ZIP filename encoding is invalid.');}
 const unicode=extras.get(0x7075);if(unicode){if(unicode.length<5||unicode[0]!==1||new DataView(unicode.buffer,unicode.byteOffset,unicode.byteLength).getUint32(1,true)!==inboundCrc32(bytes))throw inboundArchiveError('ZIP Unicode filename metadata is inconsistent.');let alternate;try{alternate=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(unicode.subarray(5));}catch{throw inboundArchiveError('ZIP Unicode filename metadata is invalid.');}if(hash.pinnedNFC(name)!==hash.pinnedNFC(alternate))throw inboundArchiveError('ZIP filename interpretations are ambiguous.');}
 return name;
}
function inboundZip64(extra,requested){
 let at=0;const values={};for(const [key,needed,width]of requested){if(!needed)continue;if(!extra||at+width>extra.length)throw inboundArchiveError('Required ZIP64 size or offset is missing.');const v=new DataView(extra.buffer,extra.byteOffset,extra.byteLength),number=width===8?v.getBigUint64(at,true):BigInt(v.getUint32(at,true));if(number>BigInt(Number.MAX_SAFE_INTEGER))throw inboundArchiveError('ZIP64 value exceeds the supported safe size.','INBOUND_ARCHIVE_LIMIT');values[key]=Number(number);at+=width;}if(extra&&at!==extra.length)throw inboundArchiveError('ZIP64 metadata contains unexpected or conflicting size fields.');return values;
}
function validateInboundDeflate(bytes,expectedSize){
 // DecompressionStream does not expose consumed compressed length. Verify the
 // RFC1951 frame independently, including final-block consumption; native
 // decompression remains responsible for producing the actual returned bytes.
 let bit=0,produced=0;
 const read=count=>{if(bit+count>bytes.length*8)throw inboundArchiveError('DEFLATE bitstream is truncated.');let value=0;for(let n=0;n<count;n++,bit++)value|=((bytes[bit>>>3]>>>(bit&7))&1)<<n;return value;};
 const tree=lengths=>{const counts=new Uint16Array(16),tables=Array.from({length:16},()=>new Map());for(const length of lengths){if(!Number.isInteger(length)||length<0||length>15)throw inboundArchiveError('DEFLATE code length is invalid.');counts[length]++;}let code=0,left=1;const next=new Uint16Array(16);for(let width=1;width<=15;width++){left=(left<<1)-counts[width];if(left<0)throw inboundArchiveError('DEFLATE Huffman tree is oversubscribed.');code=(code+(width===1?0:counts[width-1]))<<1;next[width]=code;}lengths.forEach((length,symbol)=>{if(length)tables[length].set(next[length]++,symbol);});return tables;};
 const symbol=tables=>{let code=0;for(let width=1;width<=15;width++){code=(code<<1)|read(1);if(tables[width].has(code))return tables[width].get(code);}throw inboundArchiveError('DEFLATE symbol has no code.');};
 const lengthBase=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258],lengthBits=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0],distanceBase=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],distanceBits=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
 const fixedLiteral=tree(Array.from({length:288},(_,i)=>i<144?8:i<256?9:i<280?7:8)),fixedDistance=tree(Array(32).fill(5));
 let last=false;
 while(!last){last=Boolean(read(1));const kind=read(2);if(kind===0){bit=(bit+7)&~7;const size=read(16),inverse=read(16);if((size^inverse)!==65535||bit+size*8>bytes.length*8)throw inboundArchiveError('DEFLATE stored block is malformed.');bit+=size*8;produced+=size;}
  else if(kind===1||kind===2){let literal,distance;if(kind===1){literal=fixedLiteral;distance=fixedDistance;}
   else{const literalCount=read(5)+257,distanceCount=read(5)+1,codeCount=read(4)+4,order=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],lengths=Array(19).fill(0);if(literalCount>286)throw inboundArchiveError('DEFLATE literal table is invalid.');for(let i=0;i<codeCount;i++)lengths[order[i]]=read(3);const codes=tree(lengths),all=[];while(all.length<literalCount+distanceCount){const value=symbol(codes);if(value<16)all.push(value);else{if(value===16&&!all.length)throw inboundArchiveError('DEFLATE repeat has no preceding length.');const count=value===16?read(2)+3:value===17?read(3)+3:read(7)+11,repeat=value===16?all.at(-1):0;if(all.length+count>literalCount+distanceCount)throw inboundArchiveError('DEFLATE repeat exceeds its table.');for(let i=0;i<count;i++)all.push(repeat);}}if(!all[256])throw inboundArchiveError('DEFLATE end-of-block code is absent.');literal=tree(all.slice(0,literalCount));distance=tree(all.slice(literalCount));}
   for(;;){const value=symbol(literal);if(value<256)produced++;else if(value===256)break;else{if(value>285)throw inboundArchiveError('DEFLATE reserved length code is prohibited.');const index=value-257,length=lengthBase[index]+read(lengthBits[index]),distanceCode=symbol(distance);if(distanceCode>29)throw inboundArchiveError('DEFLATE reserved distance code is prohibited.');const back=distanceBase[distanceCode]+read(distanceBits[distanceCode]);if(back>produced)throw inboundArchiveError('DEFLATE distance precedes available output.');produced+=length;}if(produced>expectedSize)throw inboundArchiveError('DEFLATE expands beyond its declared member size.','INBOUND_ARCHIVE_LIMIT');}
  }else throw inboundArchiveError('DEFLATE reserved block type is prohibited.');
  if(produced>expectedSize)throw inboundArchiveError('DEFLATE expands beyond its declared member size.','INBOUND_ARCHIVE_LIMIT');
 }
 if(produced!==expectedSize||Math.ceil(bit/8)!==bytes.length)throw inboundArchiveError('DEFLATE size or final compressed-stream boundary is inconsistent.');
}
async function responseResourceLimitsForBinding({jobId,promptIdentity,stage}={}){
 const schema=globalThis.closedLoopWorkflowSchema;
 if(!promptIdentity)return schema.DEFAULT_RESOURCE_LIMITS;
 const project=await readProjectMetadata(jobId),prompt=project?.projectData?.generatedPrompts?.find(item=>String(item.instructionId||item.promptId||'')===String(promptIdentity.instructionId||''));
 if(!prompt||Number(prompt.stage)!==Number(stage))throw storageError('The response selection has no matching saved instruction. Its original bytes remain preserved; select the response for its original operation or issue a current instruction.','RESPONSE_STAGE_PROMPT_UNAVAILABLE');
 const identity={instructionId:prompt.instructionId||prompt.promptId,bodySha256:prompt.bodySha256||prompt.sha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature};
 if(hash.sha256Value(identity)!==hash.sha256Value(promptIdentity))throw storageError('The response selection no longer matches its saved instruction identity. Its original bytes remain preserved.','RESPONSE_STAGE_PROMPT_MISMATCH');
 return schema.responseResourceLimitsForPrompt(prompt);
}
async function parseInboundArchive(blob,resourceLimits=globalThis.closedLoopWorkflowSchema.DEFAULT_RESOURCE_LIMITS){
 const contract=globalThis.closedLoopWorkflowSchema.inboundResponseArchiveContractForLimits(resourceLimits),limits=contract?.limits;
 if(!limits||!contract.parserVersion)throw inboundArchiveError('Inbound archive contract is unavailable.','INBOUND_ARCHIVE_CONTRACT_UNAVAILABLE');
 if(!(blob instanceof Blob))throw new TypeError('Inbound archive bytes must be a Blob.');
 if(blob.size<22||blob.size>limits.maxArchiveBytes)throw inboundArchiveError('Archive size exceeds the published inbound transport bounds. Select the response and returned files separately.','INBOUND_ARCHIVE_LIMIT');
 const read=async(offset,size)=>{if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(size)||offset<0||size<0||offset+size>blob.size)throw inboundArchiveError('ZIP structure is truncated or outside the selected bytes.');return new Uint8Array(await hash.readWithDeadline(blob.slice(offset,offset+size).arrayBuffer(),'Reading inbound archive'));};
 const view=bytes=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),tailOffset=Math.max(0,blob.size-65557),tail=await read(tailOffset,blob.size-tailOffset),tv=view(tail);let end=-1;
 for(let at=tail.length-22;at>=0;at--)if(tv.getUint32(at,true)===0x06054b50&&at+22+tv.getUint16(at+20,true)===tail.length){end=at;break;}
 if(end<0)throw inboundArchiveError('ZIP end directory is missing or has trailing data.');
 let count=tv.getUint16(end+10,true),centralSize=tv.getUint32(end+12,true),centralOffset=tv.getUint32(end+16,true),centralEnd=tailOffset+end;
 if(tv.getUint16(end+4,true)!==0||tv.getUint16(end+6,true)!==0||tv.getUint16(end+8,true)!==count)throw inboundArchiveError('Split-volume ZIP archives are unsupported.','INBOUND_ARCHIVE_UNSUPPORTED');
 const locator=centralEnd>=20?await read(centralEnd-20,20):null,lv=locator?view(locator):null;
 if(count===65535||centralSize===0xffffffff||centralOffset===0xffffffff||lv?.getUint32(0,true)===0x07064b50){if(!lv)throw inboundArchiveError('ZIP64 locator is missing.');if(lv.getUint32(0,true)!==0x07064b50||lv.getUint32(4,true)!==0||lv.getUint32(16,true)!==1)throw inboundArchiveError('ZIP64 locator is invalid.');const position=lv.getBigUint64(8,true);if(position>BigInt(Number.MAX_SAFE_INTEGER))throw inboundArchiveError('ZIP64 directory offset is excessive.','INBOUND_ARCHIVE_LIMIT');const bytes=await read(Number(position),56),v=view(bytes);if(v.getUint32(0,true)!==0x06064b50||v.getBigUint64(4,true)!==44n||v.getUint16(14,true)>45||v.getUint32(16,true)!==0||v.getUint32(20,true)!==0||v.getBigUint64(24,true)!==v.getBigUint64(32,true)||Number(position)+56!==centralEnd-20)throw inboundArchiveError('ZIP64 end directory is inconsistent.');const values=[v.getBigUint64(32,true),v.getBigUint64(40,true),v.getBigUint64(48,true)];if(values.some(value=>value>BigInt(Number.MAX_SAFE_INTEGER)))throw inboundArchiveError('ZIP64 directory values are excessive.','INBOUND_ARCHIVE_LIMIT');const expanded=values.map(Number);if(count!==65535&&count!==expanded[0]||centralSize!==0xffffffff&&centralSize!==expanded[1]||centralOffset!==0xffffffff&&centralOffset!==expanded[2])throw inboundArchiveError('ZIP64 and ordinary end-directory values disagree.');[count,centralSize,centralOffset]=expanded;centralEnd=Number(position);}
 if(count<1||count>limits.maxEntries||centralOffset+centralSize!==centralEnd)throw inboundArchiveError('ZIP member count or central-directory bounds are invalid.','INBOUND_ARCHIVE_LIMIT');
 const entries=[];let at=centralOffset,totalExpanded=0;
 for(let i=0;i<count;i++){const header=await read(at,46),v=view(header);if(v.getUint32(0,true)!==0x02014b50)throw inboundArchiveError('ZIP central-directory entry is invalid.');const needed=v.getUint16(6,true),flags=v.getUint16(8,true),method=v.getUint16(10,true),nameLength=v.getUint16(28,true),extraLength=v.getUint16(30,true),commentLength=v.getUint16(32,true),disk=v.getUint16(34,true),attributes=v.getUint32(38,true),madeBy=v.getUint16(4,true)>>>8;
  if(needed<10||needed>45||!contract.supportedCompressionMethods.includes(method)||(flags&~0x080e)!==0||method===0&&(flags&6)!==0)throw inboundArchiveError('ZIP encryption, flags, or compression method are unsupported.','INBOUND_ARCHIVE_UNSUPPORTED');
  const mode=attributes>>>16,type=mode&0xf000;if((attributes&0x18)!==0||[3,19].includes(madeBy)&&type!==0&&type!==0x8000||![3,19].includes(madeBy)&&(attributes&0x440)!==0)throw inboundArchiveError('Directory, link, device, or special ZIP entries are prohibited.');
  if(!nameLength||nameLength>limits.maxFilenameBytes||at+46+nameLength+extraLength+commentLength>centralEnd)throw inboundArchiveError('ZIP filename or metadata exceeds its bounds.','INBOUND_ARCHIVE_LIMIT');
  const metadata=await read(at+46,nameLength+extraLength+commentLength),nameBytes=metadata.subarray(0,nameLength),extras=inboundZipExtras(metadata.subarray(nameLength,nameLength+extraLength)),rawFilename=inboundZipName(nameBytes,flags,extras);let normalized;try{normalized=hash.normalizeFilename(rawFilename,{allowPath:true});}catch(error){throw inboundArchiveError(error.message,'INBOUND_ARCHIVE_UNSAFE_PATH');}if(normalized.canonicalPath.split('/').length>limits.maxPathDepth)throw inboundArchiveError('Archive path depth exceeds the published bound.','INBOUND_ARCHIVE_LIMIT');
  const originalCompressed=v.getUint32(20,true),originalSize=v.getUint32(24,true),originalOffset=v.getUint32(42,true),zip64=inboundZip64(extras.get(1),[['byteSize',originalSize===0xffffffff,8],['compressedSize',originalCompressed===0xffffffff,8],['offset',originalOffset===0xffffffff,8],['disk',disk===65535,4]]),byteSize=zip64.byteSize??originalSize,compressedSize=zip64.compressedSize??originalCompressed,offset=zip64.offset??originalOffset;
  if((zip64.disk??disk)!==0)throw inboundArchiveError('Split-volume member is unsupported.','INBOUND_ARCHIVE_UNSUPPORTED');
  const max=globalThis.closedLoopWorkflowSchema.inboundResponseMemberByteLimit(contract,normalized.canonicalPath);
  if(byteSize>max||compressedSize>limits.maxArchiveBytes||byteSize>Math.max(1,compressedSize)*limits.maxCompressionRatio||method===0&&compressedSize!==byteSize||(totalExpanded+=byteSize)>limits.maxExpandedBytes)throw inboundArchiveError('ZIP member size, expansion, or compression ratio exceeds the published bound.','INBOUND_ARCHIVE_LIMIT');
  entries.push({rawFilename,canonicalPath:normalized.canonicalPath,nameBytes,flags,method,needed,modTime:v.getUint16(12,true),modDate:v.getUint16(14,true),crc32:v.getUint32(16,true),byteSize,compressedSize,offset});at+=46+nameLength+extraLength+commentLength;
 }
 if(at!==centralEnd)throw inboundArchiveError('ZIP contains unlisted central-directory data.');
 try{hash.normalizeFilenameSet(entries.map(entry=>entry.rawFilename));}catch(error){throw inboundArchiveError(error.message,'INBOUND_ARCHIVE_PATH_COLLISION');}
 const sorted=[...entries].sort((a,b)=>a.offset-b.offset);if(sorted[0].offset!==0)throw inboundArchiveError('ZIP prefix or self-extracting content is unsupported.','INBOUND_ARCHIVE_UNSUPPORTED');
 for(let i=0;i<sorted.length;i++){const entry=sorted[i],boundary=sorted[i+1]?.offset??centralOffset,header=await read(entry.offset,30),v=view(header);if(v.getUint32(0,true)!==0x04034b50||v.getUint16(4,true)!==entry.needed||v.getUint16(6,true)!==entry.flags||v.getUint16(8,true)!==entry.method||v.getUint16(10,true)!==entry.modTime||v.getUint16(12,true)!==entry.modDate)throw inboundArchiveError('ZIP local and central headers disagree.');const nameLength=v.getUint16(26,true),extraLength=v.getUint16(28,true),metadata=await read(entry.offset+30,nameLength+extraLength),name=metadata.subarray(0,nameLength),extras=inboundZipExtras(metadata.subarray(nameLength));if(name.length!==entry.nameBytes.length||name.some((byte,index)=>byte!==entry.nameBytes[index])||inboundZipName(name,entry.flags,extras)!==entry.rawFilename)throw inboundArchiveError('ZIP local and central filenames disagree.');
  const originalCompressed=v.getUint32(18,true),originalSize=v.getUint32(22,true),zip64=inboundZip64(extras.get(1),[['byteSize',originalSize===0xffffffff,8],['compressedSize',originalCompressed===0xffffffff,8]]),size=zip64.byteSize??originalSize,compressedSize=zip64.compressedSize??originalCompressed,crc=v.getUint32(14,true),descriptor=Boolean(entry.flags&8);if(descriptor?(![0,entry.byteSize].includes(size)||![0,entry.compressedSize].includes(compressedSize)||![0,entry.crc32].includes(crc)):(size!==entry.byteSize||compressedSize!==entry.compressedSize||crc!==entry.crc32))throw inboundArchiveError('ZIP local member identity disagrees with the directory.');
  entry.dataOffset=entry.offset+30+nameLength+extraLength;const dataEnd=entry.dataOffset+entry.compressedSize;if(dataEnd>boundary)throw inboundArchiveError('ZIP member data overlaps another entry.');
  if(descriptor){const remaining=boundary-dataEnd;if(![12,16,20,24].includes(remaining))throw inboundArchiveError('ZIP data descriptor length is invalid.');const data=await read(dataEnd,remaining),dv=view(data),hasSignature=remaining===16||remaining===24,base=hasSignature?4:0,wide=remaining>=20;if(hasSignature&&dv.getUint32(0,true)!==0x08074b50||dv.getUint32(base,true)!==entry.crc32||(wide?dv.getBigUint64(base+4,true)!==BigInt(entry.compressedSize)||dv.getBigUint64(base+12,true)!==BigInt(entry.byteSize):dv.getUint32(base+4,true)!==entry.compressedSize||dv.getUint32(base+8,true)!==entry.byteSize))throw inboundArchiveError('ZIP data descriptor disagrees with the directory.');}
  else if(dataEnd!==boundary)throw inboundArchiveError('ZIP has unlisted bytes between its members.');
 }
 const members=[];
 for(const entry of entries){const compressed=blob.slice(entry.dataOffset,entry.dataOffset+entry.compressedSize);let output=compressed;
  if(entry.method===8){const compressedBytes=new Uint8Array(await hash.readWithDeadline(compressed.arrayBuffer(),'Reading compressed archive member'));validateInboundDeflate(compressedBytes,entry.byteSize);let stream;try{stream=compressed.stream().pipeThrough(new DecompressionStream('deflate-raw'));}catch{throw inboundArchiveError('This browser cannot decode DEFLATE ZIP members in its isolated parser. Select the response and returned files separately.','INBOUND_ARCHIVE_DECOMPRESSION_UNAVAILABLE');}const reader=stream.getReader(),parts=[];let size=0;try{for(;;){const {done,value}=await hash.readWithDeadline(reader.read(),'Expanding archive member');if(done)break;if((size+=value.byteLength)>entry.byteSize)throw inboundArchiveError('ZIP member expansion exceeded its declared size.','INBOUND_ARCHIVE_LIMIT');parts.push(value);}}catch(error){void reader.cancel().catch(()=>{});if(error?.code)throw error;throw inboundArchiveError('ZIP compressed member could not be decoded.');}finally{reader.releaseLock();}if(size!==entry.byteSize)throw inboundArchiveError('ZIP expanded member length is inconsistent.');output=new Blob(parts);}
  let crc=0xffffffff;const digest=hash.createSha256();for(let offset=0;offset<output.size;offset+=65536){const bytes=new Uint8Array(await hash.readWithDeadline(output.slice(offset,offset+65536).arrayBuffer(),'Verifying archive member'));digest.update(bytes);for(const byte of bytes)crc=handoffCrcTable[(crc^byte)&255]^(crc>>>8);}if(((crc^0xffffffff)>>>0)!==entry.crc32)throw inboundArchiveError('ZIP member CRC does not match its actual bytes.','INBOUND_ARCHIVE_CRC_MISMATCH');members.push({rawFilename:entry.rawFilename,canonicalPath:entry.canonicalPath,byteSize:output.size,sha256:digest.digest(),crc32:entry.crc32,compressionMethod:entry.method,blob:output});
 }
 return {archive:{parserVersion:contract.parserVersion,sha256:await hash.sha256Bytes(blob),byteSize:blob.size,mediaType:'application/zip'},members};
}
async function extractInboundArchive(blob,binding={}){
 const resourceLimits=await responseResourceLimitsForBinding(binding);
 if(STORE_WORKER||typeof document==='undefined'&&typeof globalThis.openStorageTransaction==='function')return parseInboundArchive(blob,resourceLimits);
 if(!useStoreWorker())throw inboundArchiveError('Isolated archive parsing is unavailable in this browser. Select response.json and the returned files separately.','INBOUND_ARCHIVE_WORKER_UNAVAILABLE');
 const contract=globalThis.closedLoopWorkflowSchema.inboundResponseArchiveContractForLimits(resourceLimits);
 if(!(blob instanceof Blob)||blob.size>contract.limits.maxArchiveBytes)throw inboundArchiveError('Archive bytes exceed the published input bound.','INBOUND_ARCHIVE_LIMIT');
 return new Promise((resolve,reject)=>{const url=new URL(STORE_SCRIPT_URL);url.searchParams.set('storeWorker','1');url.searchParams.set('archiveParser','1');url.searchParams.set('storeContext',STORE_CONTEXT_ID);const operationId=crypto.randomUUID();let worker,timer,settled=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);worker?.terminate();error?reject(Object.assign(error,{existingProjectsUnchanged:true})):resolve(value);};try{worker=new Worker(url.href);timer=setTimeout(()=>finish(inboundArchiveError('Isolated archive parsing timed out. The selected original and project are unchanged. Select the files separately or retry with a supported archive.','INBOUND_ARCHIVE_WORKER_TIMEOUT')),contract.limits.workerTimeoutMs);worker.onerror=event=>finish(inboundArchiveError(event?.message||'Isolated archive parser stopped.','INBOUND_ARCHIVE_WORKER_FAILED'));worker.onmessageerror=()=>finish(inboundArchiveError('Isolated archive parser returned unreadable data.','INBOUND_ARCHIVE_WORKER_FAILED'));worker.onmessage=event=>{const message=event.data||{};if(message.operationId!==operationId||message.buildIdentity!==STORE_BUILD_ID)return finish(inboundArchiveError('Isolated archive parser identity did not match the request.','INBOUND_ARCHIVE_WORKER_FAILED'));if(!message.ok)return finish(Object.assign(new Error(message.error?.message||'Archive parsing failed.'),{code:message.error?.code||'INBOUND_ARCHIVE_INVALID'}));const result=message.archiveResult;if(result?.archive?.parserVersion!==contract.parserVersion||result.archive.byteSize!==blob.size||result.archive.mediaType!=='application/zip'||!/^[a-f0-9]{64}$/.test(String(result.archive.sha256))||!Array.isArray(result.members)||!result.members.length||result.members.length>contract.limits.maxEntries||result.members.some(member=>!member||typeof member.rawFilename!=='string'||typeof member.canonicalPath!=='string'||!(member.blob instanceof Blob)||!Number.isSafeInteger(member.byteSize)||member.byteSize!==member.blob.size||member.byteSize>globalThis.closedLoopWorkflowSchema.inboundResponseMemberByteLimit(contract,member.canonicalPath)||!/^[a-f0-9]{64}$/.test(String(member.sha256))||!Number.isInteger(member.crc32)||member.crc32<0||member.crc32>0xffffffff||!contract.supportedCompressionMethods.includes(member.compressionMethod)))return finish(inboundArchiveError('Isolated archive parser returned an invalid result.','INBOUND_ARCHIVE_WORKER_FAILED'));finish(null,result);};worker.postMessage({operationId,method:'EXTRACT_INBOUND_ARCHIVE',args:[blob,resourceLimits],buildIdentity:STORE_BUILD_ID});}catch(error){finish(error);}});
}

async function handoffArchive(members,crc32ByBlob){
  const encoder=new TextEncoder(),seen=[new Set(),new Set(),new Set()],entries=[];
  for(const member of members){
    const normalized=hash.normalizeFilename(member.canonicalPath,{allowPath:true});
    if(normalized.canonicalPath!==member.canonicalPath)throw storageError('A handoff member path is not canonical.','HANDOFF_PATH_NOT_CANONICAL');
    hash.filenameCollisionKeys(member.canonicalPath).forEach((key,index)=>{if(seen[index].has(key))throw storageError('Handoff member paths collide.','HANDOFF_PATH_COLLISION');seen[index].add(key);});
    const name=encoder.encode(member.canonicalPath);
    if(name.length>65535||member.blob.size>=0xffffffff)throw storageError('This handoff exceeds the supported ZIP transport size. Export a smaller authorized package.','HANDOFF_ARCHIVE_LIMIT');
    entries.push({...member,name});
  }
  if(entries.length>=65535)throw storageError('This handoff has too many members.','HANDOFF_ARCHIVE_LIMIT');
  entries.sort((left,right)=>{const a=left.name,b=right.name;for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])return a[i]-b[i];return a.length-b.length;});
  const table=handoffCrcTable;
  const parts=[],central=[];let offset=0,centralSize=0;
  for(const entry of entries){
    let crc=crc32ByBlob?.get(entry.blob);
    if(crc===undefined){crc=0xffffffff;for(let pos=0;pos<entry.blob.size;pos+=65536){const bytes=new Uint8Array(await hash.readWithDeadline(entry.blob.slice(pos,pos+65536).arrayBuffer(),'Reading handoff file'));for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);}crc=(crc^0xffffffff)>>>0;}
    const local=new Uint8Array(30+entry.name.length),lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint16(12,33,true);lv.setUint32(14,crc,true);lv.setUint32(18,entry.blob.size,true);lv.setUint32(22,entry.blob.size,true);lv.setUint16(26,entry.name.length,true);local.set(entry.name,30);
    const directory=new Uint8Array(46+entry.name.length),dv=new DataView(directory.buffer);
    dv.setUint32(0,0x02014b50,true);dv.setUint16(4,20,true);dv.setUint16(6,20,true);dv.setUint16(8,0x800,true);dv.setUint16(14,33,true);dv.setUint32(16,crc,true);dv.setUint32(20,entry.blob.size,true);dv.setUint32(24,entry.blob.size,true);dv.setUint16(28,entry.name.length,true);dv.setUint32(42,offset,true);directory.set(entry.name,46);
    parts.push(local,entry.blob);central.push(directory);offset+=local.length+entry.blob.size;centralSize+=directory.length;
    if(offset+centralSize+22>=0xffffffff)throw storageError('This handoff exceeds the supported ZIP transport size.','HANDOFF_ARCHIVE_LIMIT');
  }
  const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
  return new Blob([...parts,...central,end],{type:'application/zip'});
}

// Byte observations are separate from disclosure authority. A marker is a
// potential credential indicator; only the human/schema owner can resolve a
// harmless example, and an actual CREDENTIAL_SECRET classification never can.
async function scanHandoffMembers(members,{crc32ByBlob=null}={}){
  const contract=globalThis.closedLoopWorkflowSchema?.HANDOFF_SECRET_SCAN_CONTRACT;
  if(!contract?.version||!Array.isArray(contract.patterns)||!contract.patterns.length)throw storageError('The handoff byte-scan contract is unavailable.','HANDOFF_SCAN_CONTRACT_UNAVAILABLE');
  const signatures=[];
  for(const rule of contract.patterns){
    if(typeof rule.ruleId!=='string'||!rule.ruleId||typeof rule.asciiPattern!=='string'||!rule.asciiPattern||/[^\x00-\x7f]/.test(rule.asciiPattern))throw storageError('The handoff byte-scan contract is invalid.','HANDOFF_SCAN_CONTRACT_UNAVAILABLE');
    const ascii=new TextEncoder().encode(rule.asciiPattern),little=new Uint8Array(ascii.length*2),big=new Uint8Array(ascii.length*2);for(let i=0;i<ascii.length;i++){little[i*2]=ascii[i];big[i*2+1]=ascii[i];}
    for(const bytes of [ascii,little,big])signatures.push({ruleId:rule.ruleId,bytes});
  }
  const overlap=Math.max(...signatures.map(rule=>rule.bytes.length))-1,findings=[];
  for(const member of members){
    const found=new Map();let carry=new Uint8Array(),crc=0xffffffff;
    for(let offset=0;offset<member.blob.size;offset+=65536){
      const next=new Uint8Array(await hash.readWithDeadline(member.blob.slice(offset,offset+65536).arrayBuffer(),'Inspecting outbound file bytes')),bytes=new Uint8Array(carry.length+next.length);bytes.set(carry);bytes.set(next,carry.length);const start=offset-carry.length;
      if(crc32ByBlob)for(const byte of next)crc=handoffCrcTable[(crc^byte)&255]^(crc>>>8);
      for(const rule of signatures){
        if(found.has(rule.ruleId)&&found.get(rule.ruleId)<start)continue;
        let at=bytes.indexOf(rule.bytes[0]);
        while(at>=0&&at+rule.bytes.length<=bytes.length){let match=true;for(let index=1;index<rule.bytes.length;index++)if(bytes[at+index]!==rule.bytes[index]){match=false;break;}if(match){const absolute=start+at;if(!found.has(rule.ruleId)||absolute<found.get(rule.ruleId))found.set(rule.ruleId,absolute);break;}at=bytes.indexOf(rule.bytes[0],at+1);}
      }
      carry=bytes.slice(Math.max(0,bytes.length-overlap));
    }
    if(crc32ByBlob)crc32ByBlob.set(member.blob,(crc^0xffffffff)>>>0);
    for(const [ruleId,offset]of found)findings.push({ruleId,canonicalPath:member.canonicalPath,offset});
  }
  return {credentialSecretDetected:findings.length>0,findings};
}
async function buildExecutionPackage({project=null,jobId=null,stage,operation=null,testIds=[],productId=null,runId=null,reviewerAliasContext=null,instructionId=null}={}, {reviewOnly=false,memberPath=null}={}){
  if(!project&&jobId)project=await readProject(jobId);
  if(!project||typeof project!=='object')throw new Error('A canonical project is required for an execution package.');
  const engine=globalThis.closedLoopWorkflowEngine,promptEngine=globalThis.closedLoopPromptEngine,canonicalJobId=projectIdentity(project);if(jobId&&String(jobId)!==canonicalJobId)throw storageError(`Execution-package job ${jobId} does not match canonical project ${canonicalJobId}.`,'EXECUTION_PACKAGE_JOB_MISMATCH');
  const activeProject=await readProject(canonicalJobId);
  if(!activeProject||Number(activeProject.revision||0)!==Number(project.revision||0)||(activeProject.historyActivationId||null)!==(project.historyActivationId||null)||project.projectSha256&&activeProject.projectSha256!==project.projectSha256)throw storageError('The project changed before its handoff could be prepared. Open the current version and export again.','EXECUTION_PACKAGE_VERSION_STALE');
  project=activeProject;
  const normalizedStage=Number(stage),normalizedOperation=String(operation||globalThis.closedLoopWorkflowSchema?.STAGE_CONTRACTS?.[normalizedStage]?.operations?.[0]||'COMPLETE'),normalizedRunId=runId?String(runId):null,ids=[...new Set(testIds.map(String).filter(Boolean))];
  project=engine.stageContext(project,normalizedStage);
  if(!promptEngine?.responseContractDescriptor)throw storageError('The prompt authority is unavailable for execution-package construction.','EXECUTION_PACKAGE_PROMPT_AUTHORITY_UNAVAILABLE');
  const prompts=(project.projectData?.generatedPrompts||[]).filter(record=>Number(record?.stage)===normalizedStage&&!record?.invalidatedBy&&String(record?.operation||'COMPLETE')===normalizedOperation&&String(record?.promptEngineVersion||'')===String(promptEngine.versionFor?.(normalizedStage,normalizedOperation)||promptEngine.version||''));
  const lanePrompts=prompts.filter(record=>!normalizedRunId||String(record?.scope?.runId||'')===normalizedRunId),selectedPrompt=instructionId?lanePrompts.find(record=>String(record?.instructionId||record?.promptId||'')===String(instructionId)):lanePrompts.at(-1);
  if(selectedPrompt&&(selectedPrompt.historyActivationId||null)!==(project.historyActivationId||null))throw storageError('This handoff belongs to an earlier project activation. Export a fresh instruction.','EXECUTION_PACKAGE_VERSION_STALE');
  if(!selectedPrompt)throw storageError('Save the current controlling instruction before preparing this execution package. No current saved instruction exists for this exact stage, operation, and run lane.','EXECUTION_PACKAGE_CURRENT_PROMPT_REQUIRED');
  // Caller selections cannot add information outside the saved handoff contract.
  const permittedTestIds=new Set((selectedPrompt.contextManifest?.readCollections?.tests||[]).map(row=>String(row.id)));
  if(ids.some(id=>!permittedTestIds.has(id)))throw storageError('A selected test is outside this instruction. Export the current stage again.','EXECUTION_PACKAGE_CONTEXT_MISMATCH');
  const promptAliases=Array.isArray(selectedPrompt.contextManifest?.blindAliasMap)?selectedPrompt.contextManifest.blindAliasMap:[],providedAlias=reviewerAliasContext&&typeof reviewerAliasContext==='object'?reviewerAliasContext:null;
  if(providedAlias&&!promptAliases.some(entry=>hash.sha256Value(entry)===hash.sha256Value(providedAlias)))throw storageError('The review identity is outside this instruction. Export the current stage again.','EXECUTION_PACKAGE_CONTEXT_MISMATCH');
  if(selectedPrompt.transportBindingRequired&&Number(selectedPrompt.scope?.projectRevision)!==Number(project.revision))throw storageError('The saved handoff belongs to another project revision. Export a new instruction.','EXECUTION_PACKAGE_REVISION_STALE');
  const exactPrompt=String(selectedPrompt.prompt||'');if(!exactPrompt)throw storageError('The saved controlling instruction has no exact prompt text.','EXECUTION_PACKAGE_PROMPT_TEXT_MISSING');
  const fullTextSha256=hash.sha256Text(exactPrompt);if(String(selectedPrompt.bodySha256||'')!==fullTextSha256||String(selectedPrompt.fullTextSha256||'')!==fullTextSha256)throw storageError('The saved controlling instruction text no longer matches its recorded identity.','EXECUTION_PACKAGE_PROMPT_IDENTITY_MISMATCH');
  const responseContract=promptEngine.responseContractDescriptor(normalizedStage,normalizedOperation,{comparisonMaterialityBinding:selectedPrompt.contextManifest?.comparisonMaterialityBinding||null}),contractSha256=hash.sha256Value(responseContract);if(String(selectedPrompt.contractSha256||'')!==contractSha256)throw storageError('The saved controlling instruction response contract is stale. Save the current instruction again before preparing the package.','EXECUTION_PACKAGE_CONTRACT_STALE');
  if(normalizedRunId&&String(selectedPrompt.scope?.runId||'')!==normalizedRunId)throw storageError('The saved controlling instruction is bound to a different run lane.','EXECUTION_PACKAGE_RUN_MISMATCH');
  const plan=engine.executionHandoff(project,{stage:normalizedStage,operation:normalizedOperation,testIds:ids,runIds:normalizedRunId?[normalizedRunId]:null,scope:selectedPrompt.scope,comparisonMaterialityBinding:selectedPrompt.contextManifest?.comparisonMaterialityBinding||null,deferredDefinitionCorrectionTarget:selectedPrompt.contextManifest?.deferredDefinitionCorrectionTarget||null}),artifactIds=[...new Set(plan.send.map(x=>String(x.artifactId||'')).filter(Boolean))],artifactEntries=[],fileContents=new WeakMap();
  for(const artifactId of artifactIds){const canonical=engine.records(project,'artifacts').find(r=>engine.recordId(r,'artifacts')===artifactId&&engine.isActiveRecord(r));if(!canonical)throw storageError(`Execution-package artifact ${artifactId} is not current canonical state.`,'EXECUTION_PACKAGE_ARTIFACT_STALE');const row=await getArtifact(artifactId);if(!row||String(row.jobId)!==canonicalJobId)throw storageError(`Execution-package artifact ${artifactId} has no stored bytes for ${canonicalJobId}.`,'EXECUTION_PACKAGE_BYTES_MISSING');const sha256=await observedArtifactDigest(row),byteSize=row.blob.size,expectedSha=String(engine.recordValue(canonical,'SHA256')||''),expectedSize=Number(engine.recordValue(canonical,'BYTE_SIZE'));if(sha256!==expectedSha||byteSize!==expectedSize)throw storageError(`Execution-package artifact ${artifactId} failed byte identity verification.`,'EXECUTION_PACKAGE_ARTIFACT_MISMATCH');artifactEntries.push({artifactId,filename:String(engine.recordValue(canonical,'FILENAME')||row.filename||artifactId),mediaType:String(row.mediaType||'application/octet-stream'),byteSize,sha256,role:String(engine.recordValue(canonical,'ROLE')||'AUTHORIZED_INPUT'),disclosureClassification:String(engine.recordValue(canonical,'DISCLOSURE_CLASSIFICATION')||'UNKNOWN'),base64:''});fileContents.set(artifactEntries.at(-1),{property:'base64',encoding:'base64',blob:row.blob});}
  const tests=engine.records(project,'tests').filter(t=>ids.includes(engine.recordId(t,'tests'))).map(t=>({testId:engine.recordId(t,'tests'),requirementId:String(engine.recordValue(t,'REQ_ID')||t.relationships?.REQ_ID||''),fields:clone(t.fields||{}),relationships:clone(t.relationships||{})}));
  const aliasEntries=promptAliases,reviewerAlias=String(providedAlias?.alias||providedAlias?.reviewerAlias||aliasEntries[0]?.alias||aliasEntries[0]?.reviewerAlias||'').trim()||null,publicIdentity=value=>{const text=String(value??'');const match=aliasEntries.find(entry=>String(entry.canonicalId||'')===text);return match?String(match.alias):value;},publicScope=Object.fromEntries(Object.entries(selectedPrompt.scope||{}).map(([key,value])=>[key,publicIdentity(value)]));
  const instruction={instructionId:String(selectedPrompt.instructionId||selectedPrompt.promptId||''),promptEngineVersion:String(selectedPrompt.promptEngineVersion||''),bodySha256:String(selectedPrompt.bodySha256||selectedPrompt.sha256||''),contractSha256:String(selectedPrompt.contractSha256||''),contextSignature:String(selectedPrompt.contextSignature||''),scope:clone(publicScope),fullTextSha256,text:exactPrompt};
  const promptFileManifest=promptEngine.promptFileManifest(selectedPrompt),manifest={externalChatLauncher:clone(promptFileManifest.externalChatLauncher),userTransferConformity:clone(promptFileManifest.userTransferConformity),...(promptFileManifest.comparisonMaterialityBinding?{comparisonMaterialityBinding:clone(promptFileManifest.comparisonMaterialityBinding)}:{}),...(promptFileManifest.deferredExecutionBinding?{deferredExecutionBinding:clone(promptFileManifest.deferredExecutionBinding)}:{}),...(promptFileManifest.deferredDefinitionCompatibilityContractVersion?{deferredDefinitionCompatibilityContractVersion:promptFileManifest.deferredDefinitionCompatibilityContractVersion,contextManifest:clone(promptFileManifest.contextManifest||{}),...(promptFileManifest.deferredDefinitionCorrectionTarget?{deferredDefinitionCorrectionTarget:clone(promptFileManifest.deferredDefinitionCorrectionTarget)}:{})}:{}),scope:clone(promptFileManifest.scope),historyActivationId:selectedPrompt.historyActivationId||null,contractProfileId:promptFileManifest.contractProfileId,promptIdentity:promptFileManifest.promptIdentity,packageId:promptFileManifest.packageId||null,operationReservationId:promptFileManifest.operationReservationId||null,challengeNonce:promptFileManifest.challengeNonce||null,targetSlot:promptFileManifest.targetSlot||null,reservationRevision:promptFileManifest.reservationRevision??null,schema:'closed-loop-handoff-container/1',verificationPackageSchema:'closed-loop-verification-package/1',archiveProfile:'closed-loop-archive-profile/1',workflow:project.workflow,projectSchema:project.schema,responseSchema:globalThis.closedLoopWorkflowSchema?.RESPONSE_SCHEMA,jobId:canonicalJobId,stage:normalizedStage,operation:normalizedOperation,runId:publicIdentity(normalizedRunId),reviewerAlias,productId:publicIdentity(selectedPrompt.scope?.productId||null),testIds:ids,instructionId:instruction.instructionId,instructionFullTextSha256:fullTextSha256,responseContractSha256:contractSha256,artifacts:artifactEntries.map(({base64,...x})=>x),attachmentSlots:clone(promptFileManifest.attachmentSlots),handoff:clone(promptEngine.fileHandoff(selectedPrompt,plan))};
  const contextFiles=[];for(const identity of promptFileManifest.contextFiles){const file=await readPromptContextFile(selectedPrompt,canonicalJobId,identity.path);contextFiles.push({...identity,text:''});fileContents.set(contextFiles.at(-1),{property:'text',encoding:'utf8',blob:file.blob});}manifest.contextFiles=promptFileManifest.contextFiles;
  if(typeof engine.handoffDisclosureClassification!=='function')throw storageError('The current disclosure classification authority is unavailable.','HANDOFF_AUTHORITY_UNAVAILABLE');
  const classification=authority=>engine.handoffDisclosureClassification(activeProject,selectedPrompt,{authority});
  const members=[],addMember=(canonicalPath,blob,identity)=>{members.push({canonicalPath,blob,...identity,byteSize:blob.size,hashAlgorithm:'SHA-256',required:true});};
  addMember('instruction.txt',new Blob([exactPrompt],{type:'text/plain;charset=utf-8'}),{artifactId:instruction.instructionId,filename:'instruction.txt',role:'AUTHORITATIVE_INSTRUCTION',authority:'APPLICATION_INSTRUCTION',availability:'BYTES_PERSISTED_AND_VERIFIED',sha256:fullTextSha256,mediaType:'text/plain',disclosureClassification:classification('APPLICATION_INSTRUCTION')});
  for(const identity of contextFiles)addMember(identity.path,fileContents.get(identity).blob,{artifactId:promptContextArtifactId(canonicalJobId,identity),filename:identity.filename||identity.path,role:'PROMPT_CONTEXT',authority:'APPLICATION_CONTEXT',availability:'BYTES_PERSISTED_AND_VERIFIED',sha256:identity.sha256,mediaType:identity.mediaType,disclosureClassification:classification('APPLICATION_CONTEXT')});
  for(const entry of artifactEntries){const identity=hash.normalizeFilename(entry.filename,{allowPath:true});addMember(hash.normalizeFilename(`artifacts/${entry.artifactId}/${identity.canonicalPath}`,{allowPath:true}).canonicalPath,fileContents.get(entry).blob,{artifactId:entry.artifactId,filename:entry.filename,authority:'CANONICAL_ARTIFACT',availability:'BYTES_PERSISTED_AND_VERIFIED',rawFilename:entry.filename,displayFilename:identity.displayFilename,filenameVersion:identity.filenameVersion,unicodeVersion:identity.unicodeVersion,role:entry.role,sha256:entry.sha256,mediaType:entry.mediaType,disclosureClassification:entry.disclosureClassification});}
  // Rejected work is a separate, explicitly noncanonical input lane. It can
  // never bypass the canonical artifact guard or issue current output slots.
  const retryContext=promptEngine.retryContextFor(project,normalizedStage,normalizedOperation,selectedPrompt.scope,{comparisonMaterialityBinding:selectedPrompt.contextManifest?.comparisonMaterialityBinding||null}),retryInputs=promptEngine.retryInputIdentities(retryContext);
  if(hash.sha256Value(retryInputs)!==hash.sha256Value(selectedPrompt.contextManifest?.retryAttemptInputs||[]))throw storageError('Authorized prior-attempt inputs changed after this instruction was saved. Export a fresh instruction.','EXECUTION_PACKAGE_RETRY_CONTEXT_STALE');
  manifest.retryInputs=retryInputs;manifest.retryFiles=[];
  for(const attempt of retryContext.attempts)for(const file of attempt.returnedFiles){
    const artifactId=String(file.artifactId||file.id||'');engine.assertArtifactAllocation(activeProject,artifactId);
    const row=await getArtifact(artifactId),expectedSha=String(file.sha256||'').toLowerCase(),expectedSize=Number(file.size??file.byteSize);
    if(!row||String(row.jobId)!==canonicalJobId)throw storageError('Authorized prior-attempt file bytes are unavailable.','EXECUTION_PACKAGE_RETRY_BYTES_MISSING');
    const sha256=await observedArtifactDigest(row);if(sha256!==expectedSha||row.blob.size!==expectedSize)throw storageError('Prior-attempt file bytes no longer match their retained identity.','EXECUTION_PACKAGE_RETRY_BYTES_MISMATCH');
    const filename=String(file.name??file.filename??''),mediaType=String(file.type??file.mediaType??''),path=hash.normalizeFilename(`retry/${attempt.rawResponseId}/${artifactId}/${hash.normalizeFilename(filename,{allowPath:true}).canonicalPath}`,{allowPath:true}).canonicalPath;
    const identity={rawResponseId:attempt.rawResponseId,artifactId,canonicalPath:path,filename,mediaType,byteSize:expectedSize,sha256,originalAttachmentSlotId:file.attachmentSlotId,role:'NONCANONICAL_RETRY_INPUT',authority:'UNTRUSTED_NONCANONICAL_PRIOR_WORK'};
    manifest.retryFiles.push(identity);
    addMember(path,row.blob,{...identity,availability:'BYTES_PERSISTED_AND_VERIFIED',disclosureClassification:'UNKNOWN'});
  }
  const {text:instructionText,...instructionIdentity}=instruction;
  manifest.instruction=instructionIdentity;manifest.responseContract=responseContract;manifest.tests=tests;
  manifest.members=members.map(({blob,...identity})=>identity).sort((a,b)=>a.canonicalPath<b.canonicalPath?-1:a.canonicalPath>b.canonicalPath?1:0);
  if(typeof engine.evaluateHandoffAuthorization!=='function'||typeof engine.finalizeExecutionHandoff!=='function')throw storageError('The current handoff authorization authority is unavailable.','HANDOFF_AUTHORITY_UNAVAILABLE');
  const manifestMember=()=>{const text=hash.stableStringify(manifest)+'\n',blob=new Blob([text],{type:'application/json'});return {canonicalPath:'manifest.json',filename:'manifest.json',blob,byteSize:blob.size,sha256:hash.sha256Text(text),hashAlgorithm:'SHA-256',mediaType:'application/json',role:'HANDOFF_MANIFEST',authority:'APPLICATION_MANIFEST',availability:'APPLICATION_GENERATED_BYTES',disclosureClassification:classification('APPLICATION_MANIFEST'),required:true};};
  const crc32ByBlob=new WeakMap(),descriptors=rows=>rows.map(({blob,...identity})=>identity),firstManifest=manifestMember(),firstMembers=[...members,firstManifest],firstScan=await scanHandoffMembers(firstMembers,{crc32ByBlob});
  const firstAuthorization=engine.evaluateHandoffAuthorization(activeProject,{promptRecord:selectedPrompt,members:descriptors(firstMembers),scan:firstScan});
  // Authorization bookkeeping is outside its own material subject. All final
  // carrier bytes are nevertheless scanned and the subject is rederived.
  manifest.handoff=engine.finalizeExecutionHandoff(project,selectedPrompt,{base:plan,members:descriptors(firstMembers),authorization:firstAuthorization,retryFiles:manifest.retryFiles,publicValue:value=>promptEngine.publicHandoffValue(selectedPrompt,value)});
  manifest.packageManifestSha256=hash.sha256Value(manifest);
  const finalManifest=manifestMember(),finalMembers=[...members,finalManifest],manifestScan=await scanHandoffMembers([finalManifest],{crc32ByBlob});
  const scan={credentialSecretDetected:firstScan.findings.some(item=>item.canonicalPath!=='manifest.json')||manifestScan.credentialSecretDetected,findings:[...firstScan.findings.filter(item=>item.canonicalPath!=='manifest.json'),...manifestScan.findings]},authorization=engine.evaluateHandoffAuthorization(activeProject,{promptRecord:selectedPrompt,members:descriptors(finalMembers),scan});
  if(authorization.subjectSha256!==firstAuthorization.subjectSha256)throw storageError('The final handoff changed its disclosure subject. Prepare its review again.','HANDOFF_SUBJECT_CHANGED');
  const currentProject=await readProject(canonicalJobId);if(!currentProject||currentProject.projectSha256!==activeProject.projectSha256||Number(currentProject.revision||0)!==Number(activeProject.revision||0)||(currentProject.historyActivationId||null)!==(activeProject.historyActivationId||null))throw storageError('The project changed while its handoff was being assembled. Export the current version again.','EXECUTION_PACKAGE_VERSION_STALE');
  const review={handoff:clone(manifest.handoff),members:descriptors(finalMembers),authorization:clone(authorization),scan:clone(scan)};
  if(reviewOnly)return review;
  if(!authorization.allowed){const secret=finalMembers.some(member=>member.disclosureClassification==='CREDENTIAL_SECRET');throw Object.assign(storageError(secret?'A credential-secret member cannot be transferred. Remove it from this handoff or supply a separately redacted artifact.':'Review and authorize this exact handoff before exporting its files.',secret?'HANDOFF_CREDENTIAL_SECRET_BLOCKED':'HANDOFF_AUTHORIZATION_REQUIRED'),{review});}
  if(memberPath!==null){const selected=finalMembers.find(member=>member.canonicalPath===memberPath);if(!selected)throw storageError('This file is outside the authorized handoff.','HANDOFF_MEMBER_NOT_AUTHORIZED');const {blob,...identity}=selected;return {...identity,blob,authorization:clone(authorization)};}
  const blob=await handoffArchive(finalMembers,crc32ByBlob),packageSha256=await hash.sha256Bytes(blob);
  const afterArchive=await readProject(canonicalJobId);if(!afterArchive||afterArchive.projectSha256!==activeProject.projectSha256||Number(afterArchive.revision||0)!==Number(activeProject.revision||0)||(afterArchive.historyActivationId||null)!==(activeProject.historyActivationId||null))throw storageError('The project changed while its handoff was being assembled. Export the current version again.','EXECUTION_PACKAGE_VERSION_STALE');
  return {blob,filename:`STAGE-${String(normalizedStage).padStart(2,'0')}-files.zip`,manifest,packageSha256};
}
async function createExecutionPackage(options){return buildExecutionPackage(options);}
async function prepareExecutionPackageReview(options){return buildExecutionPackage(options,{reviewOnly:true});}
async function readAuthorizedHandoffMember({canonicalPath,...options}={}){if(typeof canonicalPath!=='string'||!canonicalPath)throw storageError('Select an exact authorized handoff path.','HANDOFF_MEMBER_NOT_AUTHORIZED');return buildExecutionPackage(options,{memberPath:canonicalPath});}
async function buildCapabilityRequest({project=null,jobId=null,targetId}={},reviewOnly=false){
  if(!project&&jobId)project=await readProject(jobId);
  if(!project||typeof project!=='object')throw storageError('A current project is required for a capability request.','CAPABILITY_REQUEST_PROJECT_REQUIRED');
  const id=projectIdentity(project),engine=globalThis.closedLoopWorkflowEngine,active=await readProject(id);
  const current=state=>state&&Number(state.revision||0)===Number(project.revision||0)&&state.projectSha256===project.projectSha256&&(state.historyActivationId||null)===(project.historyActivationId||null);
  if(jobId&&String(jobId)!==id||!current(active))throw storageError('The project changed before its capability request could be prepared.','EXECUTION_PACKAGE_VERSION_STALE');
  if(typeof engine.capabilityReadinessHandoff!=='function'||typeof engine.evaluateHandoffAuthorization!=='function')throw storageError('The current capability handoff authority is unavailable.','HANDOFF_AUTHORITY_UNAVAILABLE');
  const request=engine.capabilityReadinessHandoff(active,targetId),{text,...identity}=request;
  if(typeof text!=='string')throw storageError('The capability request has no exact bytes.','CAPABILITY_REQUEST_BYTES_INVALID');
  const blob=new Blob([text],{type:identity.mediaType});if(blob.size!==identity.byteSize||hash.sha256Text(text)!==identity.sha256)throw storageError('The capability request byte identity is invalid.','CAPABILITY_REQUEST_BYTES_INVALID');
  const members=[identity],scan=await scanHandoffMembers([{...identity,blob}]),capabilityRequest={targetId:request.targetId},authorization=engine.evaluateHandoffAuthorization(active,{capabilityRequest,members,scan});
  if(!current(await readProject(id)))throw storageError('The project changed while its capability request was being inspected. Prepare the current request again.','EXECUTION_PACKAGE_VERSION_STALE');
  const review={capabilityRequest,members:clone(members),authorization:clone(authorization),scan:clone(scan)};if(reviewOnly)return review;
  if(!authorization.allowed)throw Object.assign(storageError(authorization.credentialProhibited?'A credential-secret capability request cannot be transferred.':'Review and authorize this exact capability request before exporting it.',authorization.credentialProhibited?'HANDOFF_CREDENTIAL_SECRET_BLOCKED':'HANDOFF_AUTHORIZATION_REQUIRED'),{review});
  return {...identity,blob,authorization:clone(authorization)};
}
async function prepareCapabilityRequestReview(options){return buildCapabilityRequest(options,true);}
async function readAuthorizedCapabilityRequest(options){return buildCapabilityRequest(options,false);}
// Backup intake is one replaceable pending operation per owning project, not
// a project artifact or version. Keeping the transport inside its own backup
// would recursively retain backups and consume History capacity before restore.
// Existing file selections already promised by History remain untouched.
const backupImportStagingKey=jobId=>'backupImportStaging:'+String(jobId);
const staleBackupImportSelection=()=>storageError('The pending backup selection changed. Resume the current selection or choose the original file again.','STALE_BACKUP_IMPORT_SELECTION');
function backupImportDescriptor(record){const {blob,...descriptor}=record;return descriptor;}
function validBackupImportRecord(record,jobId){
  return Boolean(record&&globalThis.closedLoopWorkflowSchema.validateBackupImportStaging(backupImportDescriptor(record)).valid&&record.jobId===String(jobId)&&record.blob instanceof Blob&&record.blob.size===record.byteSize);
}
function sameBackupImportIdentity(left,right){
  return validBackupImportRecord(left,right.jobId)&&hash.sha256Value(backupImportDescriptor(left))===hash.sha256Value(backupImportDescriptor(right));
}
async function pendingBackupImportIdentity(jobId){
  const owner=String(jobId||'').trim(),record=await metaGet(backupImportStagingKey(owner));if(record===undefined)return null;
  // Startup reads metadata only. It neither proves custody nor hashes a large
  // backup merely to show the resume control. Corruption must not hide a valid
  // project; an explicit replacement can recover even a malformed descriptor.
  if(!validBackupImportRecord(record,owner))return {jobId:owner,stagingId:typeof record?.stagingId==='string'?record.stagingId:null,invalid:true,error:'The saved backup selection is damaged. Choose the backup file again.'};
  return backupImportDescriptor(record);
}
async function readPendingBackupImport(jobId){
  const owner=String(jobId||'').trim(),record=await metaGet(backupImportStagingKey(owner));if(record===undefined)return null;
  if(!validBackupImportRecord(record,owner))throw storageError('The saved backup selection is damaged. Choose the backup file again.','BACKUP_IMPORT_STAGE_INVALID');
  if(await hash.sha256Bytes(record.blob)!==record.sha256)throw storageError('The saved backup bytes no longer match their original identity. Choose the backup file again.','BACKUP_IMPORT_STAGE_REHASH_MISMATCH');
  return record;
}
async function stageBackupImport({jobId,blob,rawFilename='backup.closed-loop',mediaType='application/octet-stream',expectedProjectRevision,expectedStateSha256,expectedStagingId=null}={}){
  const owner=String(jobId||'').trim();if(!owner)throw storageError('JOB_ID is required for pending backup selection.','BACKUP_IMPORT_STAGE_JOB_ID_REQUIRED');
  if(!(blob instanceof Blob))throw new TypeError('Backup-file bytes must be a Blob.');
  const record={schema:globalThis.closedLoopWorkflowSchema.BACKUP_IMPORT_STAGING_CONTRACT.schema,stagingId:'BACKUP-IMPORT-'+crypto.randomUUID(),jobId:owner,rawFilename:String(rawFilename),mediaType:String(mediaType),byteSize:blob.size,sha256:await hash.sha256Bytes(blob),createdAt:now(),blob:new Blob([blob],{type:String(mediaType)})};
  if(!validBackupImportRecord(record,owner))throw storageError('The pending backup descriptor is invalid.','BACKUP_IMPORT_STAGE_INVALID');
  const tx=await openTransaction([PROJECTS,META],'readwrite'),meta=tx.objectStore(META);
  try{
    const project=await projectRowWithOperations(tx,owner),prior=await request(meta.get(backupImportStagingKey(owner)));
    if(!project||Number(project.revision)!==Number(expectedProjectRevision)||!expectedStateSha256||project.projectSha256!==expectedStateSha256)throw storageError('The project changed before its backup selection was saved. Reload the current project.','STALE_PROJECT_REVISION');
    if((typeof prior?.value?.stagingId==='string'?prior.value.stagingId:null)!==expectedStagingId)throw staleBackupImportSelection();
    meta.put({key:backupImportStagingKey(owner),value:record,updatedAt:now()});fault('before-backup-staging-commit');await complete(tx);
  }catch(error){try{tx.abort();}catch{}throw error;}
  const stored=await readPendingBackupImport(owner);if(!stored||stored.stagingId!==record.stagingId)throw staleBackupImportSelection();return backupImportDescriptor(stored);
}

const responseStagingKey=(jobId,stagingId)=>`responseStaging:${jobId}:${stagingId}`;
const responseStagingRetiredKey=(jobId,stagingId)=>`responseStagingRetired:${jobId}:${stagingId}`;
const responseStagingRecoveryKey=(jobId,artifactId)=>`responseStagingRecovery:${jobId}:${artifactId}`;
const recoveredResponseStages=new Map();
function metadataWithoutBlob(record){if(!record||typeof record!=='object')return record;const {blob,byteReference,...metadata}=record;return metadata;}
function responseStagingDescriptor(record){const {blob,bytes,storageKey,byteReference,...descriptor}=record;return descriptor;}
function responseStagingIdentity(record){const descriptor=responseStagingDescriptor(record);delete descriptor.rejection;return descriptor;}
function sameResponseStageInput(left,right){return ['jobId','stage','rawFilename','mediaType','byteSize','sha256','packageId','operationReservationId','challengeNonce'].every(key=>left[key]===right[key])&&equivalent(left.promptIdentity,right.promptIdentity);}
function referencesStagedIdentity(value,identities){
 const pending=[value],seen=new WeakSet();
 while(pending.length){const item=pending.pop();if(typeof item==='string'){if(identities.has(item))return true;continue;}if(!item||typeof item!=='object'||item instanceof Blob||item instanceof ArrayBuffer||ArrayBuffer.isView(item)||seen.has(item))continue;seen.add(item);
  if(item instanceof Map){for(const [key,value]of item)pending.push(key,value);continue;}if(item instanceof Set){for(const value of item)pending.push(value);continue;}
  for(const [key,value]of Object.entries(item)){if(identities.has(key))return true;pending.push(value);}
 }
 return false;
}
async function removeUnreferencedResponseStage(tx,{project,artifact,descriptor,receipt,expectedHistoryGeneration}){
 const ingestion=globalThis.closedLoopResponseIngestion;
 if(!project||!ingestion.stagedResponseCleanupStatus(project,descriptor).eligible)return false;
 const owner=String(artifact.jobId),meta=tx.objectStore(META),files=tx.objectStore(ARTIFACTS),current=await projectRowWithOperations(tx,owner),history=await request(meta.get(historyKey(owner)));
 if(current?.projectSha256!==project.projectSha256||Number(history?.value?.generation||0)!==expectedHistoryGeneration)return false;
 const identities=new Set([artifact.artifactId,artifact.sha256,descriptor.stagingId]),receiptKey=responseStagingRecoveryKey(owner,artifact.artifactId),retiredKey=responseStagingRetiredKey(owner,descriptor.stagingId);
 // Absence is checked inside the deleting transaction. A current raw record,
 // returned binding, pending selection, canonical/extension relationship or
 // promised History custody always wins over cleanup. Diagnostic/retirement
 // metadata describes this decision; it does not promise retention of bytes.
 const projectRows=await readPhysicalProjectRows(tx);
 if(projectRows.some(row=>referencesStagedIdentity(row.project,identities)))return false;
 const keys=meta.getAllKeys?await request(meta.getAllKeys()):(await request(meta.getAll())).map(row=>row.key);
 for(const key of keys){if(key===receiptKey||key===retiredKey||key===historyFileKey(owner,artifact.sha256))continue;const source=String(key).startsWith('recordPart:v1:')?{logical:await request(meta.get(key))}:await readPhysicalStoredSource(tx,META,key,'value'),value=hydrateQuarantineValue(source),schema=globalThis.closedLoopWorkflowSchema;
  if(String(key).startsWith('responseStagingRecovery:')&&schema.validateResponseStagingRecovery(value).valid)continue;
  if(String(key).startsWith('responseStagingRetired:')&&schema.validateResponseStagingRetirement(value).valid)continue;
  if(identities.has(String(key))||referencesStagedIdentity(value,identities))return false;
 }
 files.delete(artifact.artifactId);receipt.bytesRemoved=await discardUnretainedArtifactBody(tx,artifact);receipt.stagingOccurrenceRemoved=true;receipt.outcome='UNREFERENCED_STAGING_REMOVED';
 meta.put({key:retiredKey,value:{schema:globalThis.closedLoopWorkflowSchema.RESPONSE_STAGING_RETIREMENT_CONTRACT.schema,jobId:owner,stagingId:descriptor.stagingId,retiredAt:now()},updatedAt:now()});
 fault('during-unreferenced-staging-cleanup');return true;
}
async function listResponseStagingRecovery(jobId){
 const owner=String(jobId),tx=await openTransaction(META,'readonly'),store=tx.objectStore(META),keys=store.getAllKeys?await request(store.getAllKeys()):(await request(store.getAll())).map(row=>row.key),rows=[];
 for(const key of keys)if(String(key).startsWith('responseStagingRecovery:'+owner+':')){const row=await request(store.get(key));if(row?.value?.jobId===owner){if(!globalThis.closedLoopWorkflowSchema.validateResponseStagingRecovery(row.value).valid)throw storageError('Response staging recovery diagnostics are damaged. Original files remain preserved.','RESPONSE_STAGE_RECOVERY_INVALID');const retirement=row.value.stagingId?(await request(store.get(responseStagingRetiredKey(owner,row.value.stagingId))))?.value:null;if(retirement&&globalThis.closedLoopWorkflowSchema.validateResponseStagingRetirement(retirement).valid&&retirement.jobId===owner&&retirement.stagingId===row.value.stagingId&&row.value.outcome!=='UNREFERENCED_STAGING_REMOVED')continue;rows.push(row.value);}}
 await complete(tx);return rows;
}
async function recoverResponseStaging(){
 // Retain only the selected project's first cold read, privately and for one
 // subsequent activation. Every consumer still rereads the complete row and
 // journal; ordinary reads, transactions and migrations cannot use this proof.
 const selectedProject=String(await metaGet('selectedProject')||'');let selectedRecoveryRead=null;
 const readRecoveryProject=async owner=>{
  const sourceProof=String(owner)===selectedProject?{readPurpose:STARTUP_RECOVERY_CAPTURE}:null;
  const project=await readProjectMetadata(owner,sourceProof);
  if(project&&sourceProof?.current){const privateProject=copyVerifiedTree(project),integrity=verifiedProjectIntegrity(privateProject,privateProject.projectSha256),recoveryProject=copyVerifiedTree(project);globalThis.closedLoopPromptEngine?.copyRetainedPromptContextFiles?.(project,privateProject);selectedRecoveryRead={...sourceProof,...integrity,requiredReadPurpose:STARTUP_REFRESH_READ};return recoveryProject;}
  return project;
 };
 // Old releases persisted RAW bytes before their staging metadata. Scan Blob
 // handles and hash only incomplete RAW staging, never all retained History.
 // This rebuilds byte custody only. Ingestion still owns prompt/scope admission
 // and the operator still owns proposal acceptance and canonical promotion.
 const read=await openTransaction([ARTIFACTS,META],'readonly'),artifacts=await hydrateArtifactRows(read,await request(read.objectStore(ARTIFACTS).getAll()),{diagnostic:true});await complete(read);const recovered=[],projects=new Map(),candidates=artifacts.filter(artifact=>artifact.lineage?.role==='RAW_RESPONSE_RECOVERY');
 // One readonly metadata snapshot replaces three transactions per saved RAW.
 // Request only the known staging/retirement/receipt keys, never every History
 // Blob in META. Each repair still performs its own fresh write-transaction CAS.
 const metadata=await openTransaction(META,'readonly'),meta=metadata.objectStore(META),metadataKeys=meta.getAllKeys?await request(meta.getAllKeys()):(await request(meta.getAll())).map(row=>row.key),stagedRows=await Promise.all(metadataKeys.filter(key=>String(key).startsWith('responseStaging:')).map(async key=>{const row=await request(meta.get(key));return {...row,value:await hydrateByteRecord(metadata,row?.value,{diagnostic:true})};})),stagedByKey=new Map(stagedRows.map(row=>[row.key,row])),recoveryReceipts=new Map((await Promise.all(metadataKeys.filter(key=>String(key).startsWith('responseStagingRecovery:')).map(key=>request(meta.get(key))))).map(row=>[row.key,row.value])),retirements=new Map(await Promise.all(stagedRows.map(async row=>{const key=responseStagingRetiredKey(row.value?.jobId,row.value?.stagingId);return [key,(await request(meta.get(key)))?.value];})));
 const missingArchives=new Set(),artifactIds=new Set(artifacts.map(row=>row.artifactId));
 for(const row of stagedRows){const saved=row?.value;if(!saved||!globalThis.closedLoopWorkflowSchema.validateResponseStagingDescriptor(responseStagingDescriptor(saved)).valid||row.key!==responseStagingKey(saved.jobId,saved.stagingId)||!(saved.blob instanceof Blob)||saved.blob.size!==saved.byteSize)continue;const artifactId='RAW-'+saved.stagingId;if(artifactIds.has(artifactId))continue;missingArchives.add(artifactId);candidates.push({artifactId,jobId:saved.jobId,filename:saved.rawFilename,mediaType:saved.mediaType,byteSize:saved.byteSize,sha256:saved.sha256,blob:saved.blob,lineage:{stage:saved.stage,role:'RAW_RESPONSE_RECOVERY',stagedResponse:responseStagingIdentity(saved)},createdAt:saved.createdAt});}
 const snapshots=await Promise.all(candidates.map(async artifact=>{
  const owner=String(artifact.jobId),descriptor=artifact.lineage.stagedResponse,stagingId=typeof descriptor?.stagingId==='string'&&descriptor.stagingId?descriptor.stagingId:null,key=stagingId?responseStagingKey(owner,stagingId):null,receiptKey=responseStagingRecoveryKey(owner,artifact.artifactId);
  const [prior,retirement,previousReceipt]=await Promise.all([stagedByKey.get(key)||null,stagingId?retirements.has(responseStagingRetiredKey(owner,stagingId))?{value:retirements.get(responseStagingRetiredKey(owner,stagingId))}:request(meta.get(responseStagingRetiredKey(owner,stagingId))):null,{value:recoveryReceipts.get(receiptKey)}]);
  return {artifact,missingArchive:missingArchives.has(artifact.artifactId),owner,descriptor,stagingId,key,receiptKey,prior:prior?.value,retirement:retirement?.value,previousReceipt:previousReceipt?.value};
 }));await complete(metadata);
 for(const {artifact,missingArchive,owner,descriptor,stagingId,key,receiptKey,prior,retirement,previousReceipt}of snapshots){
  if(retirement){if(globalThis.closedLoopWorkflowSchema.validateResponseStagingRetirement(retirement).valid&&retirement.jobId===owner&&retirement.stagingId===stagingId)continue;}
  const existingValid=Boolean(prior&&globalThis.closedLoopWorkflowSchema.validateResponseStagingDescriptor(responseStagingDescriptor(prior)).valid&&prior.jobId===owner&&prior.stagingId===stagingId&&prior.blob instanceof Blob&&prior.blob.size===prior.byteSize);
  if(existingValid&&!retirement&&!missingArchive){if(previousReceipt?.outcome==='METADATA_RECOVERED')recoveredResponseStages.set(key,responseStagingIdentity(prior));continue;}
  let code=missingArchive?'RESPONSE_STAGE_ARCHIVE_RECOVERED':'RESPONSE_STAGE_METADATA_MISSING',outcome='METADATA_RECOVERED',project=null;
  const valid=globalThis.closedLoopWorkflowSchema.validateResponseStagingDescriptor(descriptor).valid&&descriptor.jobId===owner&&artifact.artifactId==='RAW-'+stagingId&&descriptor.stage===artifact.lineage.stage&&descriptor.rawFilename===artifact.filename&&descriptor.mediaType===artifact.mediaType&&descriptor.byteSize===artifact.byteSize&&descriptor.sha256===artifact.sha256&&artifact.blob instanceof Blob&&artifact.blob.size===descriptor.byteSize;
  if(!valid||retirement||key&&prior!==undefined&&!missingArchive){outcome='BLOCKED';code='RESPONSE_STAGE_IDENTITY_MISMATCH';}
  else if(await hash.sha256Bytes(artifact.blob)!==descriptor.sha256){outcome='BLOCKED';code='RESPONSE_STAGE_REHASH_MISMATCH';}
  else{
    try{if(!projects.has(owner))projects.set(owner,await readRecoveryProject(owner));project=projects.get(owner);}catch{project=null;}
    if(!project){outcome='BLOCKED';code=(await metaGet(historyKey(owner)))?.removed?'RESPONSE_STAGE_PROJECT_REMOVED':'RESPONSE_STAGE_PROJECT_UNAVAILABLE';}
    else{const freshness=globalThis.closedLoopResponseIngestion.stagedResponseRecoveryStatus(project,descriptor);if(freshness.code==='RESPONSE_STAGE_ALREADY_RECORDED'){outcome='ALREADY_RECORDED';code=freshness.code;}else if(freshness.current===false){outcome='BLOCKED';code=freshness.code;}}
  }
  const receipt={schema:globalThis.closedLoopWorkflowSchema.RESPONSE_STAGING_RECOVERY_CONTRACT.schema,kind:'RAW_RESPONSE',jobId:owner,stagingId,artifactId:String(artifact.artifactId),stage:Number.isInteger(descriptor?.stage)&&descriptor.stage>=1&&descriptor.stage<=globalThis.closedLoopWorkflowSchema.STAGE_COUNT?descriptor.stage:null,rawFilename:typeof descriptor?.rawFilename==='string'&&descriptor.rawFilename?descriptor.rawFilename:null,sha256:typeof descriptor?.sha256==='string'&&/^[a-f0-9]{64}$/.test(descriptor.sha256)?descriptor.sha256:null,byteSize:Number.isSafeInteger(descriptor?.byteSize)&&descriptor.byteSize>=0?descriptor.byteSize:null,outcome,code,checkedAt:now()};
  if(!globalThis.closedLoopWorkflowSchema.validateResponseStagingRecovery(receipt).valid)throw storageError('Staging recovery receipt is invalid.','RESPONSE_STAGE_RECOVERY_INVALID');
  const cleanupCandidate=outcome==='BLOCKED'&&valid&&!missingArchive&&!prior&&!retirement&&project&&globalThis.closedLoopResponseIngestion.stagedResponseCleanupStatus(project,descriptor).eligible,expectedHistoryGeneration=cleanupCandidate?Number((await metaGet(historyKey(owner)))?.generation||0):null;
  const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite'),meta=tx.objectStore(META);
  try{
    const current=await hydrateByteRecord(tx,await request(tx.objectStore(ARTIFACTS).get(artifact.artifactId)),{diagnostic:true}),presentRow=key?await request(meta.get(key)):null,present=presentRow?{...presentRow,value:await hydrateByteRecord(tx,presentRow.value,{diagnostic:true})}:null,retired=stagingId?await request(meta.get(responseStagingRetiredKey(owner,stagingId))):null;
    // New selection/retirement wins; never overwrite concurrent recoverable
    // work or claim that a changed descriptor still identifies verified bytes.
    if(Boolean(current)===missingArchive||Boolean(present)!==Boolean(key&&prior!==undefined)||present&&!equivalent(metadataWithoutBlob(present.value),metadataWithoutBlob(prior))||Boolean(retired)!==Boolean(retirement)||retired&&!equivalent(retired.value,retirement)||current&&(!equivalent(metadataWithoutBlob(current),metadataWithoutBlob(artifact))||Boolean(current.blob instanceof Blob)!==Boolean(artifact.blob instanceof Blob)||current.blob?.size!==artifact.blob?.size)){await complete(tx);continue;}
    if(project&&(await projectRowWithOperations(tx,owner))?.projectSha256!==project.projectSha256){await complete(tx);continue;}
    if(outcome==='METADATA_RECOVERED'||missingArchive&&outcome==='ALREADY_RECORDED'){await storeArtifactRow(tx,{...artifact,...current,blob:artifact.blob});meta.put({key,value:await sharedByteRecord(tx,{...clone(prior?responseStagingDescriptor(prior):descriptor),blob:artifact.blob}),updatedAt:now()});}
    if(cleanupCandidate)await removeUnreferencedResponseStage(tx,{project,artifact,descriptor,receipt,expectedHistoryGeneration});
    if(!globalThis.closedLoopWorkflowSchema.validateResponseStagingRecovery(receipt).valid)throw storageError('Staging cleanup receipt is invalid.','RESPONSE_STAGE_RECOVERY_INVALID');
    meta.put({key:receiptKey,value:receipt,updatedAt:now()});fault('during-response-staging-recovery');await complete(tx);
    if(outcome==='METADATA_RECOVERED')recoveredResponseStages.set(key,clone(descriptor));recovered.push(receipt);
  }catch(error){try{tx.abort();}catch{}throw error;}
 }
 await recoverStorageBoundaries(artifacts,stagedRows,retirements,recoveryReceipts,projects,recovered,readRecoveryProject);
 if(selectedRecoveryRead)recentOperationalCommitRead=selectedRecoveryRead;
 return recovered;
}

// Startup diagnosis does not confer custody or promotion authority. Read only
// the project metadata needed for relationship checks; payloads are rehashed
// by readStagedResponseFile, artifact custody and actual repair boundaries.
async function recoverStorageBoundaries(artifacts,stagedRows,retirements,recoveryReceipts,projects,results,readRecoveryProject=readProjectMetadata){
 const byId=new Map(artifacts.map(row=>[row.artifactId,row])),owners=new Set(artifacts.map(row=>String(row.jobId)));
 for(const row of stagedRows)if(typeof row?.value?.jobId==='string'&&row.value.jobId)owners.add(row.value.jobId);
 for(const summary of await listProjectSummaries())owners.add(projectIdentity(summary));
 const histories=new Map();
 for(const owner of owners){
  if(!projects.has(owner)){try{projects.set(owner,await readRecoveryProject(owner));}catch{projects.set(owner,null);}}
  histories.set(owner,await metaGet(historyKey(owner)));
 }
 async function record({owner,artifactId,artifact=null,staged=null,stageKey=null,kind,code,stage=null,rawFilename=null,sha256=null,byteSize=null,outcome='BLOCKED',project=projects.get(owner)}){
  const receipt={schema:globalThis.closedLoopWorkflowSchema.RESPONSE_STAGING_RECOVERY_CONTRACT.schema,kind,jobId:owner,stagingId:typeof staged?.stagingId==='string'&&staged.stagingId?staged.stagingId:null,artifactId,stage:Number.isInteger(stage)&&stage>=1&&stage<=30?stage:null,rawFilename:typeof rawFilename==='string'&&rawFilename?rawFilename:null,sha256:typeof sha256==='string'&&/^[a-f0-9]{64}$/.test(sha256)?sha256:null,byteSize:Number.isSafeInteger(byteSize)&&byteSize>=0?byteSize:null,outcome,code,checkedAt:now()};
  if(!globalThis.closedLoopWorkflowSchema.validateResponseStagingRecovery(receipt).valid)throw storageError('Storage recovery receipt is invalid.','RESPONSE_STAGE_RECOVERY_INVALID');
  const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite'),meta=tx.objectStore(META);
  try{
   const current=await hydrateByteRecord(tx,await request(tx.objectStore(ARTIFACTS).get(artifactId)),{diagnostic:true}),stageRow=stageKey?await request(meta.get(stageKey)):null,currentStage=stageRow?{...stageRow,value:await hydrateByteRecord(tx,stageRow.value,{diagnostic:true})}:null,currentProject=await projectRowWithOperations(tx,owner),currentHistory=await request(meta.get(historyKey(owner)));
   if(Boolean(current)!==Boolean(artifact)||current&&(!equivalent(metadataWithoutBlob(current),metadataWithoutBlob(artifact))||current.blob?.size!==artifact.blob?.size)||stageKey&&(!currentStage||!equivalent(metadataWithoutBlob(currentStage.value),metadataWithoutBlob(staged))||currentStage.value.blob?.size!==staged.blob?.size)||currentProject?.projectSha256!==project?.projectSha256||Number(currentHistory?.value?.generation||0)!==Number(histories.get(owner)?.generation||0)){await complete(tx);return;}
   if(staged?.stagingId&&await request(meta.get(responseStagingRetiredKey(owner,staged.stagingId)))){await complete(tx);return;}
   meta.put({key:responseStagingRecoveryKey(owner,artifactId),value:receipt,updatedAt:now()});fault('during-storage-boundary-recovery');await complete(tx);results.push(receipt);
  }catch(error){try{tx.abort();}catch{}throw error;}
 }
 for(const row of stagedRows){
  const staged=row?.value,owner=typeof staged?.jobId==='string'?staged.jobId:null,id=typeof staged?.stagingId==='string'?staged.stagingId:null;
  // A damaged owner cannot be attributed to another project. Preserve its
  // original row and surface the global startup failure for manual recovery.
  if(!owner||!id||row.key!==responseStagingKey(owner,id))throw storageError('Response staging metadata has no valid project/selection identity. Original metadata and bytes were preserved.','RESPONSE_STAGE_IDENTITY_MISMATCH');
  const artifactId='RAW-'+id,artifact=byId.get(artifactId),project=projects.get(owner),descriptor=responseStagingDescriptor(staged);
  if(results.some(receipt=>receipt.jobId===owner&&receipt.artifactId===artifactId))continue;
  if(retirements.get(responseStagingRetiredKey(owner,id)))continue;
  let code=null;
  if(!globalThis.closedLoopWorkflowSchema.validateResponseStagingDescriptor(descriptor).valid)code='RESPONSE_STAGE_IDENTITY_MISMATCH';
  else if(!(staged.blob instanceof Blob)||staged.blob.size!==staged.byteSize)code='RESPONSE_STAGE_BYTES_MISSING';
  else if(!project)code=histories.get(owner)?.removed?'RESPONSE_STAGE_PROJECT_REMOVED':'RESPONSE_STAGE_PROJECT_UNAVAILABLE';
  else if(!artifact)code='RESPONSE_STAGE_ARCHIVE_MISSING';
  else if(artifact.jobId!==owner||artifact.lineage?.role!=='RAW_RESPONSE_RECOVERY'||!equivalent(artifact.lineage.stagedResponse,responseStagingIdentity(staged))||artifact.filename!==staged.rawFilename||artifact.mediaType!==staged.mediaType||artifact.byteSize!==staged.byteSize||artifact.sha256!==staged.sha256||!(artifact.blob instanceof Blob)||artifact.blob.size!==staged.byteSize)code='RESPONSE_STAGE_ARCHIVE_IDENTITY_MISMATCH';
  else{
   const status=globalThis.closedLoopResponseIngestion.stagedResponseRecoveryStatus(project,descriptor);
   if(status.current===false)code=status.code;
  }
  const previous=recoveryReceipts.get(responseStagingRecoveryKey(owner,artifactId));if(code||previous?.outcome==='BLOCKED'){if(code)recoveredResponseStages.delete(row.key);await record({owner,artifactId,artifact,staged,stageKey:row.key,kind:'RAW_RESPONSE',code:code||'RESPONSE_STAGE_METADATA_AVAILABLE',outcome:code?'BLOCKED':'ALREADY_RECORDED',stage:staged.stage,rawFilename:staged.rawFilename,sha256:staged.sha256,byteSize:staged.byteSize,project});}
 }
 for(const owner of owners){
  const project=projects.get(owner),history=histories.get(owner),expected=project?requiredProjectArtifactBytes(project):[],canonicalById=new Map(expected.map(row=>[row.artifactId,row])),historicalArtifactIds=new Set((project?.projectData?.artifacts||[]).map(row=>globalThis.closedLoopWorkflowEngine.recordId(row,'artifacts'))),returned=new Map();
  for(const raw of project?.projectData?.rawResponses||[])for(const file of Array.isArray(raw.files)?raw.files:[])if(file.artifactId)returned.set(file.artifactId,{raw,file});
  for(const expectedRow of expected){const row=byId.get(expectedRow.artifactId),invalid=!row||row.jobId!==owner||!(row.blob instanceof Blob)||row.blob.size!==expectedRow.byteSize||row.sha256!==expectedRow.sha256||row.filename!==expectedRow.filename,previous=recoveryReceipts.get(responseStagingRecoveryKey(owner,expectedRow.artifactId));if(invalid||previous?.outcome==='BLOCKED')await record({owner,artifactId:expectedRow.artifactId,artifact:row,kind:'ARTIFACT',code:invalid?'CANONICAL_ARTIFACT_BYTES_MISSING_OR_MISMATCHED':'ARTIFACT_RELATIONSHIP_RECORDED',outcome:invalid?'BLOCKED':'ALREADY_RECORDED',rawFilename:expectedRow.filename,sha256:expectedRow.sha256,byteSize:expectedRow.byteSize,project});}
  for(const [artifactId,{raw,file}]of returned){const row=byId.get(artifactId);if(!row||row.jobId!==owner)await record({owner,artifactId,artifact:row,kind:'RETURNED_FILE',code:row?'RETURNED_FILE_BINDING_MISMATCH':'RETURNED_FILE_BYTES_MISSING',stage:Number(raw.stage),rawFilename:file.name??file.filename,sha256:file.sha256,byteSize:file.size??file.byteSize,project});}
  for(const artifact of artifacts.filter(row=>String(row.jobId)===owner&&row.lineage?.role!=='RAW_RESPONSE_RECOVERY')){
   if(canonicalById.has(artifact.artifactId)||historicalArtifactIds.has(artifact.artifactId))continue;
   const binding=returned.get(artifact.artifactId),isReturned=Boolean(artifact.lineage?.rawResponseId||artifact.lineage?.attachmentSlotId),kind=isReturned?'RETURNED_FILE':'ARTIFACT';
   let code=null;
   if(!(artifact.blob instanceof Blob)||artifact.blob.size!==artifact.byteSize)code='STORED_ARTIFACT_BYTES_MISSING';
   else if(binding){if(binding.raw.rawResponseId!==artifact.lineage?.rawResponseId||binding.file.attachmentSlotId!==artifact.lineage?.attachmentSlotId||binding.file.sha256!==artifact.sha256||(binding.file.size??binding.file.byteSize)!==artifact.byteSize||(binding.file.name??binding.file.filename)!==artifact.filename||(binding.file.type??binding.file.mediaType)!==artifact.mediaType)code='RETURNED_FILE_BINDING_MISMATCH';}
   else if(history?.files?.[artifact.sha256]?.byteSize!==artifact.byteSize)code=isReturned?'RETURNED_FILE_BINDING_NOT_COMMITTED':'ARTIFACT_RELATIONSHIP_NOT_COMMITTED';
   const priorReceipt=recoveryReceipts.get(responseStagingRecoveryKey(owner,artifact.artifactId));
   if(code||priorReceipt?.outcome==='BLOCKED')await record({owner,artifactId:artifact.artifactId,artifact,kind,code:code||'ARTIFACT_RELATIONSHIP_RECORDED',outcome:code?'BLOCKED':'ALREADY_RECORDED',stage:artifact.lineage?.stage,rawFilename:artifact.filename,sha256:artifact.sha256,byteSize:artifact.byteSize,project});
  }
 }
}

async function stageResponseFile({jobId,stage,blob,rawFilename='response.json',mediaType='application/json',promptIdentity=null,packageId=null,operationReservationId=null,challengeNonce=null}={}){
  const owner=String(jobId||'').trim(),stageNumber=Number(stage);if(!owner)throw storageError('JOB_ID is required to stage a response file.','RESPONSE_STAGE_JOB_ID_REQUIRED');if(!Number.isInteger(stageNumber)||stageNumber<1||stageNumber>30)throw storageError('A valid stage is required to stage a response file.','RESPONSE_STAGE_INVALID_STAGE');if(!(blob instanceof Blob))throw new TypeError('Response-file bytes must be a Blob.');
  const originalName=String(rawFilename||'response.json'),claimedType=String(mediaType||blob.type||'application/octet-stream'),byteSize=blob.size,sha256=await hash.sha256Bytes(blob),stagingId=`RESPONSE-STAGING-${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`,key=`responseStaging:${owner}:${stagingId}`,record={schema:'closed-loop-response-staging/1',stagingId,jobId:owner,stage:stageNumber,rawFilename:originalName,mediaType:claimedType,byteSize,sha256,blob:new Blob([blob],{type:claimedType}),promptIdentity:clone(promptIdentity),packageId:packageId||null,operationReservationId:operationReservationId||null,challengeNonce:challengeNonce||null,status:'HASHED_AND_REVERIFIED',createdAt:now()};
  const {blob:responseBlob,...stagingIdentity}=record;
  if(!globalThis.closedLoopWorkflowSchema.validateResponseStagingDescriptor(stagingIdentity).valid)throw storageError('Response staging identity is invalid.','RESPONSE_STAGE_IDENTITY_MISMATCH');
  for(const [recoveredKey,candidate]of recoveredResponseStages)if(sameResponseStageInput(candidate,stagingIdentity)){
    const retired=await metaGet(responseStagingRetiredKey(owner,candidate.stagingId));if(retired){recoveredResponseStages.delete(recoveredKey);continue;}
    const saved=await readStagedResponseFile({jobId:owner,stagingId:candidate.stagingId});if(!sameResponseStageInput(saved,stagingIdentity))throw storageError('Recovered response selection changed. Select the original file again.','RESPONSE_STAGE_IDENTITY_MISMATCH');return {...responseStagingDescriptor(saved),storageKey:recoveredKey};
  }
  fault('during-artifact-blob-write');const tx=await openTransaction([ARTIFACTS,META],'readwrite'),artifacts=tx.objectStore(ARTIFACTS),meta=tx.objectStore(META),artifactId='RAW-'+stagingId;
  try{
    if(await request(artifacts.get(artifactId))||await request(meta.get(key)))throw storageError('Response staging identity is already in use.','RESPONSE_STAGE_IDENTITY_MISMATCH');
    await storeArtifactRow(tx,{artifactId,jobId:owner,blob:record.blob,filename:originalName,mediaType:claimedType,byteSize,sha256,lineage:{stage:stageNumber,role:'RAW_RESPONSE_RECOVERY',stagedResponse:stagingIdentity},createdAt:record.createdAt});fault('during-response-staging-write');meta.put({key,value:await sharedByteRecord(tx,record),updatedAt:now()});await complete(tx);
  }catch(error){try{tx.abort();}catch{}throw error;}
  const persistedArtifact=await getArtifact(artifactId);if(!persistedArtifact||persistedArtifact.jobId!==owner||persistedArtifact.byteSize!==byteSize||persistedArtifact.sha256!==sha256||persistedArtifact.blob?.size!==byteSize||await observedArtifactDigest(persistedArtifact)!==sha256)throw storageError('Staged response archive bytes failed read-back verification.','RESPONSE_STAGE_REHASH_MISMATCH');
  const stored=await metaGet(key);if(!stored?.blob)throw storageError('Staged response bytes were not persisted.','RESPONSE_STAGE_BYTES_MISSING');const verifyDigest=await hash.sha256Bytes(stored.blob);if(stored.blob.size!==byteSize||verifyDigest!==sha256){const tx=await openTransaction(META,'readwrite');tx.objectStore(META).delete(key);await complete(tx);throw storageError('Staged response bytes failed read-back verification.','RESPONSE_STAGE_REHASH_MISMATCH');}return {...stored,blob:undefined,storageKey:key};
}
async function readStagedResponseFile({jobId,stagingId}={}){const owner=String(jobId||'').trim(),id=String(stagingId||'').trim();if(!owner||!id)throw storageError('JOB_ID and stagingId are required.','RESPONSE_STAGE_ID_REQUIRED');const key=`responseStaging:${owner}:${id}`,stored=await metaGet(key);if(!stored?.blob)throw storageError('Staged response file is unavailable.','RESPONSE_STAGE_NOT_FOUND');if(String(stored.jobId)!==owner)throw storageError('Staged response belongs to another project.','CROSS_PROJECT_RESPONSE_STAGE');if(stored.stagingId!==id||!globalThis.closedLoopWorkflowSchema.validateResponseStagingDescriptor(responseStagingDescriptor(stored)).valid)throw storageError('Staged response identity is invalid.','RESPONSE_STAGE_IDENTITY_MISMATCH');const limit=(await responseResourceLimitsForBinding(stored)).maxRawResponseBytes;if(Number.isFinite(limit)&&stored.blob.size>limit){const digest=await hash.sha256Bytes(stored.blob);if(stored.blob.size!==Number(stored.byteSize)||digest!==String(stored.sha256))throw storageError('Staged response bytes no longer match their captured identity.','RESPONSE_STAGE_REHASH_MISMATCH');await metaPut(key,{...stored,rejection:{code:'OVERSIZED_RESPONSE',byteSize:stored.blob.size,maxRawResponseBytes:limit,at:now()}});throw storageError(`Response file exceeds the ${limit}-byte stage limit. The exact original bytes and rejection receipt remain staged for ${owner}.`,'OVERSIZED_RESPONSE');}const bytes=new Uint8Array(await hash.readWithDeadline(stored.blob.arrayBuffer(),'Reading staged response')),sha256=await hash.sha256Bytes(bytes);if(bytes.byteLength!==Number(stored.byteSize)||sha256!==String(stored.sha256))throw storageError('Staged response bytes no longer match their captured identity.','RESPONSE_STAGE_REHASH_MISMATCH');return {...stored,bytes,blob:stored.blob,storageKey:key};}
async function removeStagedResponseFile({jobId,stagingId}={}){const owner=String(jobId||'').trim(),id=String(stagingId||'').trim();if(!owner||!id)return false;const key=`responseStaging:${owner}:${id}`,tx=await openTransaction(META,'readwrite'),store=tx.objectStore(META);const row=await request(store.get(key));if(row?.value&&String(row.value.jobId)!==owner){try{tx.abort();}catch{}throw storageError('Staged response belongs to another project.','CROSS_PROJECT_RESPONSE_STAGE');}store.delete(key);store.put({key:responseStagingRetiredKey(owner,id),value:{schema:globalThis.closedLoopWorkflowSchema.RESPONSE_STAGING_RETIREMENT_CONTRACT.schema,jobId:owner,stagingId:id,retiredAt:now()},updatedAt:now()});await complete(tx);recoveredResponseStages.delete(key);return Boolean(row);}
async function storageHealth(){
 let persistent,estimate={};
 try{const result=await hash.readWithDeadline(navigator.storage.persist(),'Requesting persistent storage');if(typeof result==='boolean')persistent=result;}catch{}
 // A failed persistence probe says nothing about quota, and does not mean
 // persistence was refused. Keep each unavailable observation unknown.
 try{estimate=await hash.readWithDeadline(navigator.storage.estimate(),'Measuring available storage')||{};}catch{}
 const measured=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
 return {database:DB_NAME,persistent,usage:measured(estimate.usage),quota:measured(estimate.quota),lastCommittedRevision:await metaGet('lastCommittedRevision'),lastVerifiedExport:await metaGet('lastVerifiedExport'),migrationStatus:await metaGet('migrationStatus')};
}
function archiveMigrationPayload(project,archive){if(!project||typeof project!=='object')throw new TypeError('A project is required.');project.projectData=project.projectData&&typeof project.projectData==='object'?project.projectData:{};project.projectData.migrationArchives=Array.isArray(project.projectData.migrationArchives)?project.projectData.migrationArchives:[];const record={...clone(archive),operational:false};project.projectData.migrationArchives.push(record);return record;}
function clearLegacy(storage=globalThis.localStorage){if(!storage)return;for(const key of LEGACY_KEYS)try{storage.removeItem(key);}catch{}}

const ready=(async()=>{hash.assertPinnedUnicodeHost();if(globalThis.indexedDB&&!STORE_WORKER){
 try{await migrateLegacy();globalThis.closedLoopLegacyMigrationError=null;}catch(error){globalThis.closedLoopLegacyMigrationError=String(error?.stack||error);console.error('Legacy migration failed without deleting the preserved legacy payload; application startup will continue.',error);}
 try{await recoverResponseStaging();globalThis.closedLoopStagingRecoveryError=null;}catch(error){globalThis.closedLoopStagingRecoveryError=String(error?.message||error);console.error('Response staging recovery could not finish. Preserved project and file data remain available.',error);}
 }return true;})();
if(STORE_WORKER){let queue=Promise.resolve();globalThis.addEventListener('message',event=>{const message=event.data||{};queue=queue.then(async()=>{try{if(message.buildIdentity!==STORE_BUILD_ID||!message.operationId||!['WRITE_PROJECT','IMPORT_PACKAGE','SAVE_CHECKPOINT','EXTRACT_INBOUND_ARCHIVE','COMMIT_NATIVE_PRODUCT_RESULTS'].includes(message.method)||ARCHIVE_PARSER_WORKER&&message.method!=='EXTRACT_INBOUND_ARCHIVE'||!Array.isArray(message.args))throw storageError('Invalid storage worker command or build identity.','INVALID_STORAGE_WORKER_REQUEST');message.args=unpackStorageWorkerValue(message.args,message.argumentStrings);await ready;globalThis.__closedLoopStorageFault=message.fault;
  const result=message.method==='EXTRACT_INBOUND_ARCHIVE'?{archiveResult:await parseInboundArchive(message.args[0],message.args[1])}:message.method==='SAVE_CHECKPOINT'?{checkpointId:await saveCheckpoint(message.args[0],{...message.args[1],operationId:message.operationId})}:{project:message.method==='COMMIT_NATIVE_PRODUCT_RESULTS'?await commitNativeProductResultsLocal(message.args[0],message.operationId):message.method==='WRITE_PROJECT'?await writeProject(message.args[0],{...message.args[1],operationId:message.operationId}):await importPackage(message.args[0],{...message.args[1],operationId:message.operationId})};
  const packed=result.project?packStorageWorkerValue(result.project):null;globalThis.postMessage({operationId:message.operationId,buildIdentity:STORE_BUILD_ID,ok:true,...result,...(packed?{project:packed.value,...(packed.stringTable?{projectStrings:packed.stringTable}:{})}:{})});}catch(error){globalThis.postMessage({operationId:message.operationId,buildIdentity:STORE_BUILD_ID,ok:false,error:{code:error?.code||'STORAGE_OPERATION_FAILED',message:String(error?.message||error),...(error?.code==='MUTATION_CONFIRMATION_REQUIRED'&&error.impact?{impact:error.impact}:{})}});}finally{delete globalThis.__closedLoopStorageFault;}}).catch(error=>{setTimeout(()=>{throw error;},0);});});}
globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS,STORAGE_WORKER_TIMEOUT_MS,listQuarantinedProjects,exportQuarantinedProject,exportHistoryRecoveryEvidence,exportLegacyMigrationData,removeQuarantinedProject,ENCRYPTED_EXPORT_PROFILE,isEncryptedPackage,HISTORY_LIMITS,mutationImpact,rebaseHistoryView,assertRecoveryTransfer,historyList,listRecoverableProjects,readOriginalSourceArchive,readHistoryView,saveCheckpoint,beginHistorySession,restoreCheckpoint,persistPromptContextFiles,readPromptContextFile,archiveMigrationPayload,version:'closed-loop-project-store/2',DB_NAME,DB_VERSION,stores:Object.freeze({projects:PROJECTS,artifacts:ARTIFACTS,meta:META}),STORE_KEY,LEGACY_KEYS,clone,projectIdentity,projectSha256,validateProjectIntegrity,openDatabase,ready,readAll,readProject,refreshProjectProjection,listProjectSummaries,writeAll,writeProject,commitNativeProductResults,replaceProject,transact,removeProject,putArtifact,getArtifact,deleteArtifact,listArtifacts,artifactCustodyState,verifyProjectArtifacts,createExecutionPackage,prepareExecutionPackageReview,readAuthorizedHandoffMember,prepareCapabilityRequestReview,readAuthorizedCapabilityRequest,extractInboundArchive,exportPackage,importPackage,stageBackupImport,pendingBackupImportIdentity,readPendingBackupImport,recoverResponseStaging,listResponseStagingRecovery,stageResponseFile,readStagedResponseFile,removeStagedResponseFile,storageHealth,metaGet,metaPut,clearLegacy,createProject});
})();
;(()=>{
'use strict';
const CLOSED_LOOP_V3_STORE_MIGRATION_EXPORT=true;
const store=globalThis.closedLoopProjectStore;
const schema=globalThis.closedLoopWorkflowSchema;
if(store&&schema&&typeof schema.migrateProjectToCurrent==='function'&&typeof store.migrateProjectToCurrent!=='function')globalThis.closedLoopProjectStore=Object.freeze({...store,migrateProjectToCurrent:project=>schema.migrateProjectToCurrent(project)});
})();
