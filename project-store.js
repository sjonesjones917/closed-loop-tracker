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
const DB_VERSION=2;
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
async function observeArtifactCustody(row,observedEpoch=custodyEpoch){
 const key=custodyKey(row.jobId,row.artifactId);artifactCustody.delete(key);
 if(!(row.blob instanceof Blob))return;
 const sha256=await hash.sha256Bytes(row.blob);
 if(row.blob.size!==row.byteSize||sha256!==row.sha256)return;
 artifactReadObservations.set(row,{blob:row.blob,sha256,byteSize:row.blob.size});
 if((custodyInvalidations.get(String(row.jobId))||0)>observedEpoch)return;
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
function storageEvent(kind,subscribe,transaction=null){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else resolve(value);};
    const timer=setTimeout(()=>{
      if(settled)return;
      // Aborting one transaction does not prove that every earlier operation
      // in the operator action was rolled back. Require read-back recovery.
      const error=Object.assign(new Error(`Storage ${kind.toLowerCase()} did not return within ${STORAGE_IO_TIMEOUT_MS} ms. Reload and verify the saved project before retrying.`),{code:`STORAGE_${kind}_TIMEOUT`,existingProjectsUnchanged:false});
      finish(error);try{transaction?.abort();}catch{/* A commit may already have happened; its outcome remains unconfirmed. */}
    },STORAGE_IO_TIMEOUT_MS);
    try{subscribe(value=>finish(null,value),error=>finish(error),()=>!settled);}catch(error){finish(error);}
  });
}
const request=req=>storageEvent('REQUEST',(resolve,reject,active)=>{req.onsuccess=()=>{if(active())resolve(req.result);};req.onerror=()=>{if(active())reject(req.error||new Error('IndexedDB request failed.'));};},req.transaction);
const complete=tx=>storageEvent('TRANSACTION',(resolve,reject,active)=>{tx.oncomplete=()=>{if(active())resolve();};tx.onerror=()=>{if(active())reject(tx.error||new Error('IndexedDB transaction failed.'));};tx.onabort=()=>{if(active())reject(tx.error||new Error('IndexedDB transaction aborted.'));};},tx);
const canonicalProject=project=>{const copy={...project};delete copy.projectSha256;return copy;};
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
function requestStoreWorker(method,args){
  if(!operationWorker){
    const url=new URL(STORE_SCRIPT_URL);url.searchParams.set('storeWorker','1');url.searchParams.set('storeContext',STORE_CONTEXT_ID);const worker=new Worker(url.href);operationWorker=worker;
    const lost=event=>{if(operationWorker!==worker)return;operationWorker=null;worker.terminate();const pending=[...workerRequests.values()];workerRequests.clear();for(const entry of pending){clearTimeout(entry.timer);void recoverWorkerOperation(entry,storageError(event?.message||'Storage worker stopped before returning its result.','STORAGE_WORKER_STOPPED'));}};
    worker.onerror=lost;worker.onmessageerror=lost;
    worker.onmessage=event=>{if(operationWorker!==worker)return;const message=event.data||{},pending=workerRequests.get(message.operationId);if(!pending)return;if(message.buildIdentity!==STORE_BUILD_ID){lost({message:'Storage worker build identity mismatch.'});return;}workerRequests.delete(message.operationId);clearTimeout(pending.timer);if(message.ok){
      if(pending.method==='SAVE_CHECKPOINT'){
        if(typeof message.checkpointId!=='string'||!message.checkpointId){void recoverWorkerOperation(pending,storageError('Storage worker returned an invalid saved-view identity.','INVALID_STORAGE_WORKER_RESULT'));return;}
        void clearWorkerCommit(message.operationId);pending.resolve(message.checkpointId);return;
      }
      void observeProjectArtifactCustody(message.project).then(()=>{void clearWorkerCommit(message.operationId);pending.resolve(message.project);},error=>recoverWorkerOperation(pending,error));}else void recoverWorkerOperation(pending,Object.assign(new Error(message.error?.message||'Storage operation failed.'),message.error));};
  }
  const operationId=crypto.randomUUID(),worker=operationWorker;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{if(workerRequests.has(operationId)&&operationWorker===worker)worker.onerror({message:`Storage worker did not return within ${STORAGE_WORKER_TIMEOUT_MS} ms. Its durable commit receipt is being checked before retry is permitted.`});},STORAGE_WORKER_TIMEOUT_MS);workerRequests.set(operationId,{operationId,method,jobId:method==='SAVE_CHECKPOINT'?String(args[0]):method==='WRITE_PROJECT'?projectIdentity(args[0]):null,resolve,reject,timer});try{worker.postMessage({operationId,method,args,buildIdentity:STORE_BUILD_ID,fault:globalThis.__closedLoopStorageFault||null});}catch(error){clearTimeout(timer);workerRequests.delete(operationId);reject(Object.assign(error,{existingProjectsUnchanged:true}));}});
}
const useStoreWorker=()=>Boolean(STORE_SCRIPT_URL&&typeof Worker==='function');
const runSynchronousMutator=(mutator,next,before)=>{const result=mutator(next,before);if(result&&typeof result.then==='function')throw storageError('Project transaction mutators must be synchronous. Complete asynchronous work before opening the canonical IndexedDB transaction.','ASYNC_TRANSACTION_MUTATOR');return result;};
const PLACEHOLDER_REFERENCES=new Set(['','NONE','NOT APPLICABLE','UNKNOWN','PENDING','UNASSIGNED']);
const equivalent=(left,right)=>Object.is(left,right)||(!(left===undefined||right===undefined)&&hash.sha256Value(left)===hash.sha256Value(right));
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
function validateProjectIntegrity(project,{verifyDerived=true,verifyCachedProjection=true,projectionObservedAt=null,prior=null}={}){
  const issues=[],schemaApi=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine;
  if(!project||typeof project!=='object')return {valid:false,issues:['Project is not an object.']};
  if(!schemaApi||!engine)return {valid:false,issues:['Workflow schema and engine are required for canonical project integrity validation.']};
  const collectionShapeIssues=projectCollectionShapeIssues(project);if(collectionShapeIssues.length)return {valid:false,issues:collectionShapeIssues};
  const fieldValueIssues=canonicalFieldValueIssues(project);if(fieldValueIssues.length)return {valid:false,issues:fieldValueIssues};
  const pointerIssues=engine.jobPointerIntegrityIssues(project,{prior});if(pointerIssues.length)return {valid:false,issues:pointerIssues};
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
  if(verifyDerived){let expected=clone(project);delete expected.projectSha256;engine.ensureShape(expected);if(projectionObservedAt===null)engine.recalculate(expected);else expected=engine.historicalProjection(expected,projectionObservedAt);if(verifyCachedProjection){for(const name of ['CURRENT_STAGE','CURRENT_STATE','CURRENT_BLOCKERS','NEXT_REQUIRED_ACTION','JOB_RECORD_STATUS','STATUS_EVIDENCE'])if(!equivalent(project.job?.[name],expected.job?.[name]))issues.push(`Application-derived job field ${name} does not match deterministic recalculation.`);for(let stage=1;stage<=Number(schemaApi.STAGE_COUNT);stage++){if(String(project.stages?.[stage]?.status||'')!==String(expected.stages?.[stage]?.status||''))issues.push(`Stage ${stage} status does not match deterministic recalculation.`);if(!equivalent(project.stages?.[stage]?.derivedData||{},expected.stages?.[stage]?.derivedData||{}))issues.push(`Stage ${stage} derivedData does not match deterministic recalculation.`);}}const releaseRecords=(project.projectData?.releaseRecords||[]).filter(record=>record?.active!==false&&!record?.invalidatedBy),latestRelease=releaseRecords.at(-1);if(latestRelease){const actual=String(engine.recordValue(latestRelease,'DETERMINATION')||''),calculated=String(engine.releaseMetrics(expected).determination||'');if(actual!==calculated)issues.push(`Current release determination ${actual||'UNKNOWN'} does not match deterministic release calculation ${calculated||'UNKNOWN'}.`);}}
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
    req.onupgradeneeded=()=>{if(expired||!active()){try{req.transaction?.abort();}catch{}return;}const db=req.result;if(!db.objectStoreNames.contains(PROJECTS))db.createObjectStore(PROJECTS,{keyPath:'jobId'});if(!db.objectStoreNames.contains(ARTIFACTS))db.createObjectStore(ARTIFACTS,{keyPath:'artifactId'});if(!db.objectStoreNames.contains(META))db.createObjectStore(META,{keyPath:'key'});const artifacts=req.transaction.objectStore(ARTIFACTS);if(!artifacts.indexNames.contains('jobId'))artifacts.createIndex('jobId','jobId',{unique:false});const projects=req.transaction.objectStore(PROJECTS);if(!projects.indexNames.contains('picker')){projects.createIndex('picker','picker',{unique:true});const scan=projects.openCursor();scan.onsuccess=()=>{if(!active())return;const cursor=scan.result;if(!cursor)return;const row=cursor.value;row.picker=projectPickerKey(row.project,row.revision,String(row.jobId));cursor.update(row);cursor.continue();};}};
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
 const own=tx||await openTransaction(META,'readwrite'),store=own.objectStore(META);
 try{
  let saved=value;if(String(key).startsWith('stage30MobileAcceptance.v1:')){const prior=(await request(store.get(key)))?.value;assertMobileAcceptanceSessionWrite(key,value,prior);saved=mergeMobileAcceptanceSession(prior,value);}
  store.put({key,value:String(key).startsWith('responseStaging:')&&saved?.blob instanceof Blob?await sharedByteRecord(own,saved):saved,updatedAt:now()});if(!tx)await complete(own);return saved;
 }catch(error){try{own.abort();}catch{}throw error;}
}
async function metaGet(key){const tx=await openTransaction(META,'readonly');const row=await request(tx.objectStore(META).get(key)),value=String(key).startsWith('responseStaging:')?await hydrateByteRecord(tx,row?.value):row?.value;await complete(tx);return value;}
// Operational response work is owned by META and bound to one canonical row.
// Its closed patch contains no accepted-work authority. Canonical commits fold
// the resulting audit records into their complete snapshot and retire the patch.
const operationalKey=jobId=>'responseOperations:'+String(jobId);
const OPERATIONAL_COLLECTIONS=new Set(['rawResponses','generatedOutputs','responseValidations','responseProposals','outputReceipts','responseDispositions','rejectedResponses','idCounters','eventSequence','history','allocationReceipts']);
const OPERATIONAL_JOB_FIELDS=new Set(['CURRENT_STAGE','CURRENT_STATE','CURRENT_BLOCKERS','NEXT_REQUIRED_ACTION','JOB_RECORD_STATUS','STATUS_EVIDENCE']);
const OPERATIONAL_STAGE_FIELDS=new Set(['gate','status','derivedData','responseDraft']);
function operationalPatches(before,after,path=[]){
  // Traverse once; canonical validation and commit integrity checks remain authoritative.
  if(Object.is(before,after))return [];
  if(before&&after&&typeof before==='object'&&typeof after==='object'&&Array.isArray(before)===Array.isArray(after)){
    if(Array.isArray(before)&&after.length<before.length)return [{path,value:clone(after)}];
    return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(key=>{
      if(!Object.hasOwn(after,key))return [{path:[...path,key],remove:true}];
      if(!Object.hasOwn(before,key))return [{path:[...path,key],value:clone(after[key])}];
      return operationalPatches(before[key],after[key],[...path,key]);
    });
  }
  return [{path,value:clone(after)}];
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
    if(!equivalent(statusProjection(prior),statusProjection(next)))throw storageError('An operational event changed a reservation binding.','OPERATIONAL_OWNERSHIP_VIOLATION');
    if(from!==to){
      const allowed=new Set(['EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED','REJECTED','CANCELLED']),seen=new Set([from]),queue=[from];
      for(const state of queue)for(const target of engine.RESERVATION_TRANSITIONS?.[state]||[])if(allowed.has(target)&&!seen.has(target)){seen.add(target);queue.push(target);}
      if(!allowed.has(to)||!seen.has(to))throw storageError('An operational event attempted an invalid reservation transition.','OPERATIONAL_TRANSITION_VIOLATION');
    }
  }
  for(const family of ['history','generatedOutputs']){const prior=before.projectData?.[family]||[],next=after.projectData?.[family]||[];if(next.length<prior.length||prior.some((row,index)=>!equivalent(row,next[index])))throw storageError('An operational event changed retained audit history.','OPERATIONAL_OWNERSHIP_VIOLATION');}
  for(const family of ['rawResponses','responseProposals','outputReceipts'])for(const prior of before.projectData?.[family]||[]){
    const key=family==='rawResponses'?'rawResponseId':family==='responseProposals'?'proposalId':'receiptId',accepted=prior.acceptedChangeId||prior.acceptedCanonicalChangeId&&prior.acceptedCanonicalChangeId!=='NONE'||['ACCEPTED','ACCEPTED_DATA_CHANGE','BLOCKER_ACCEPTED','QUESTIONS_CREATED','EXECUTION_FAILURE_ACCEPTED'].includes(prior.status);
    if(accepted&&!equivalent(prior,(after.projectData?.[family]||[]).find(row=>row[key]===prior[key])))throw storageError('An operational event changed an accepted response record.','OPERATIONAL_OWNERSHIP_VIOLATION');
  }
  for(const raw of before.projectData?.rawResponses||[]){const next=(after.projectData?.rawResponses||[]).find(item=>item.rawResponseId===raw.rawResponseId);if(!next||['completeRawResponse','sha256','promptInstructionId','promptScope','transport'].some(key=>!equivalent(raw[key],next[key])))throw storageError('An operational event changed preserved response identity or bytes.','OPERATIONAL_OWNERSHIP_VIOLATION');}
  for(const proposal of after.projectData?.responseProposals||[]){const prior=(before.projectData?.responseProposals||[]).find(item=>item.proposalId===proposal.proposalId);if(['ACCEPTED','QUESTIONS_CREATED','BLOCKER_ACCEPTED','EXECUTION_FAILURE_ACCEPTED'].includes(proposal.status)&&!equivalent(prior,proposal))throw storageError('Acceptance requires a canonical transaction.','OPERATIONAL_OWNERSHIP_VIOLATION');}
  return patches;
}
function applyOperationalJournal(row,journal){
  if(!row||!journal)return row;
  const {sha256,...body}=journal;
  if(sha256!==hash.sha256Value(body)||body.schema!=='closed-loop-response-operations/1'||body.jobId!==String(row.jobId)||body.baseProjectSha256!==row.projectSha256||body.projectRevision!==Number(row.revision)||!Array.isArray(body.patches))throw storageError('Saved response operations do not match their canonical project.','OPERATIONAL_STATE_INTEGRITY_FAILED');
  const next=clone(row.project);
  for(const patch of body.patches){
    if(!Array.isArray(patch.path)||!patch.path.length||patch.path.some(key=>typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)))throw storageError('Saved response operation has an invalid field path.','OPERATIONAL_STATE_INTEGRITY_FAILED');
    let target=next;for(const key of patch.path.slice(0,-1)){if(!target||typeof target!=='object'||!Object.hasOwn(target,key))throw storageError('Saved response operation has an unavailable parent.','OPERATIONAL_STATE_INTEGRITY_FAILED');target=target[key];}
    const key=patch.path.at(-1);if(patch.remove)delete target[key];else target[key]=clone(patch.value);
  }
  assertOperationalChange(row.project,next);
  if(projectSha256(next)!==body.projectSha256)throw storageError('Saved response operation contents are corrupt.','OPERATIONAL_STATE_INTEGRITY_FAILED');
  return {...row,project:next,projectSha256:body.projectSha256};
}
async function projectRowWithOperations(tx,jobId){const row=await request(tx.objectStore(PROJECTS).get(String(jobId))),journal=await request(tx.objectStore(META).get(operationalKey(jobId)));return applyOperationalJournal(row,journal?.value);}
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
  const id=projectIdentity(project),prior=await readProject(id);if(!prior)throw storageError('Project is unavailable.','PROJECT_NOT_FOUND');
  if(Number(options.expectedProjectRevision)!==Number(prior.revision)||!options.expectedStateSha256||options.expectedStateSha256!==prior.projectSha256)throw storageError('Project or pending response changed. Refresh it before retrying.','STALE_PROJECT_REVISION');
  const next=clone(project);delete next.projectSha256;
  assertProjectCollectionShape(next);
  assertCanonicalFieldValues(next);
  assertJobPointerIntegrity(next,prior);
  if(Number(next.revision)!==Number(prior.revision))throw storageError('An operational event cannot advance the canonical revision.','OPERATIONAL_OWNERSHIP_VIOLATION');
  const pendingArtifacts=await preparePendingReturnedArtifacts(next,prior,options.pendingArtifacts);
  if(projectSha256(next)===prior.projectSha256){if(pendingArtifacts.length)throw storageError('Pending returned files require their response mapping transaction.','PENDING_ARTIFACTS_WITHOUT_CHANGE');return prior;}
  globalThis.closedLoopPromptEngine.copyRetainedPromptContextFiles(prior,next);
  globalThis.closedLoopWorkflowEngine.recalculate(next);assertOperationalChange(prior,next);assertProjectIntegrity(next);
  const digest=projectSha256(next);if(digest===prior.projectSha256){if(pendingArtifacts.length)throw storageError('Pending returned files require their response mapping transaction.','PENDING_ARTIFACTS_WITHOUT_CHANGE');return prior;}
  const retainedArtifacts=pendingArtifacts.length?await listArtifacts(id):null,byId=new Map((retainedArtifacts||[]).map(row=>[row.artifactId,row]));
  for(const row of pendingArtifacts){const existing=byId.get(row.artifactId);if(existing&&(existing.sha256!==row.sha256||existing.byteSize!==row.byteSize||existing.filename!==row.filename||existing.mediaType!==row.mediaType||!equivalent(existing.lineage,row.lineage)))throw storageError('A pending returned artifact conflicts with stored bytes.','ARTIFACT_ID_REUSE');if(existing)row.createdAt=existing.createdAt;byId.set(row.artifactId,row);}
  const prepared=await prepareHistoryCommit(next,prior,{label:options.historyLabel||'Response work saved',view:options.historyView,artifactRows:pendingArtifacts.length?[...byId.values()]:null});
  fault('before-project-transaction');const tx=await openTransaction(pendingArtifacts.length?[PROJECTS,ARTIFACTS,META]:[PROJECTS,META],'readwrite');
  try{
    const meta=tx.objectStore(META),base=await request(tx.objectStore(PROJECTS).get(id)),current=await projectRowWithOperations(tx,id);
    if(current?.projectSha256!==prior.projectSha256)throw storageError('Another session changed the pending response.','STALE_PROJECT_REVISION');
    globalThis.closedLoopWorkflowEngine.validateAllocationReceipts(next,current?.project);
    if(pendingArtifacts.length){const artifacts=tx.objectStore(ARTIFACTS);for(const row of pendingArtifacts){const existing=await request(artifacts.get(row.artifactId));if(existing&&(existing.jobId!==id||existing.sha256!==row.sha256||existing.byteSize!==row.byteSize||existing.filename!==row.filename||existing.mediaType!==row.mediaType||existing.createdAt!==row.createdAt||!equivalent(existing.lineage,row.lineage)))throw storageError('Another operation changed the pending returned artifact identity.','ARTIFACT_ID_REUSE');fault('during-pending-artifact-write');await storeArtifactRow(tx,row);}}
    const existing=(await request(meta.get(operationalKey(id))))?.value,body={schema:'closed-loop-response-operations/1',jobId:id,baseProjectSha256:base.projectSha256,projectRevision:Number(base.revision),sequence:Number(existing?.sequence||0)+1,patches:assertOperationalChange(base.project,next),projectSha256:digest};
    await commitHistory(tx,prepared);meta.put({key:operationalKey(id),value:{...body,sha256:hash.sha256Value(body)},updatedAt:now()});fault('during-operational-write');recordWorkerCommit(tx,options.operationId,next,digest);fault('before-transaction-commit');await complete(tx);notifyProjectChange(next,{operational:true});return {...next,projectSha256:digest};
  }catch(error){try{tx.abort();}catch{}throw error;}
}
async function quarantine(row,reason,{operationalSha256}={}){
 const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite'),projects=tx.objectStore(PROJECTS),meta=tx.objectStore(META);
 try{const current=await request(projects.get(String(row?.jobId||''))),journal=await request(meta.get(operationalKey(row?.jobId)));
  if(!current||String(current.projectSha256||'')!==String(row?.projectSha256||'')||operationalSha256!==undefined&&journal?.value?.sha256!==operationalSha256){await complete(tx);return false;}
  const artifacts=await hydrateArtifactRows(tx,await request(tx.objectStore(ARTIFACTS).index('jobId').getAll(String(row.jobId))),{diagnostic:true,preserveDamagedBytes:true}),key=`quarantine:${row?.jobId||'UNKNOWN'}:${crypto.randomUUID()}`,capturedAt=now(),catalog=clone((await request(meta.get('quarantineCatalog')))?.value||{});
  const entry={key,jobId:String(row.jobId),title:String(row.project?.job?.JOB_TITLE||'Project needing recovery'),reason,capturedAt,artifactCount:artifacts.length,completeSnapshot:true};catalog[key]=entry;
  fault('during-quarantine-write');meta.put({key,value:{schema:'closed-loop-quarantine/1',reason,row:clone(current),operationalJournal:clone(journal?.value||null),artifacts:clone(artifacts),capturedAt},updatedAt:capturedAt});meta.put({key:'quarantineCatalog',value:catalog,updatedAt:capturedAt});projects.delete(String(row.jobId));meta.delete(operationalKey(row.jobId));await complete(tx);return true;
 }catch(error){try{tx.abort();}catch{}throw error;}
}

async function listQuarantinedProjects(){
  const catalog=await metaGet('quarantineCatalog');if(catalog)return Object.values(catalog);
  // Discover older preserved rows once. Normal startup reads the small catalog.
  const tx=await openTransaction(META,'readwrite'),store=tx.objectStore(META),current=await request(store.get('quarantineCatalog'));if(current){await complete(tx);return Object.values(current.value);}const keys=store.getAllKeys?await request(store.getAllKeys()):(await request(store.getAll())).map(row=>row.key),result={};
  for(const key of keys.filter(key=>String(key).startsWith('quarantine:'))){const saved=await request(store.get(key)),value=saved.value;result[key]={key,jobId:String(value.row?.jobId||''),title:String(value.row?.project?.job?.JOB_TITLE||'Project needing recovery'),reason:String(value.reason||'Integrity validation failed'),capturedAt:value.capturedAt||saved.updatedAt,artifactCount:value.artifacts?.length??null,completeSnapshot:Array.isArray(value.artifacts)};}
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
  return exportProtectedRecoveryEvidence(saved,{quarantineKey:key,completeSnapshot:Array.isArray(saved.artifacts)},passphrase);
}
async function exportLegacyMigrationData({passphrase=null}={}){
  if(!passphrase)throw storageError('Enter a backup password to protect the preserved recovery evidence.','BACKUP_PASSPHRASE_REQUIRED');
  if(!globalThis.localStorage)throw storageError('Original legacy migration data is available only in its browser document.','LEGACY_MIGRATION_UNAVAILABLE');
  const entries=[];for(const key of LEGACY_KEYS){let value;try{value=globalThis.localStorage.getItem(key);}catch(error){throw storageError(`Legacy project storage could not be read from ${key}: ${error.message||error}`,'LEGACY_MIGRATION_READ_FAILED');}if(value!==null)entries.push({key,value});}
  if(!entries.length)throw storageError('No original legacy migration data is retained in this browser.','NO_LEGACY_MIGRATION_DATA');
  return exportProtectedRecoveryEvidence({kind:'LEGACY_LOCAL_STORAGE',entries,migrationStatus:await metaGet('migrationStatus')},{recoveryKind:'LEGACY_LOCAL_STORAGE',completeSnapshot:false},passphrase);
}
async function removeQuarantinedProject(key,{idempotencyKey=key}={}){
  if(!String(key).startsWith('quarantine:'))throw storageError('Select preserved recovery evidence.','QUARANTINE_NOT_FOUND');const receiptKey='quarantineDelete:'+hash.sha256Value({idempotencyKey:String(idempotencyKey)}),payloadSha256=hash.sha256Value({key}),tx=await openTransaction(META,'readwrite'),meta=tx.objectStore(META);
  try{const receipt=(await request(meta.get(receiptKey)))?.value;if(receipt){if(receipt.payloadSha256!==payloadSha256)throw storageError('This deletion was already used for different recovery evidence.','COMMAND_RETRY_CONFLICT');await complete(tx);return receipt;}
    const existing=await request(meta.get(key)),catalog=clone((await request(meta.get('quarantineCatalog')))?.value||{});if(!existing)throw storageError('The preserved recovery evidence is unavailable.','QUARANTINE_NOT_FOUND');delete catalog[key];const result={quarantineKey:key,payloadSha256,removed:true,at:now()};fault('during-quarantine-delete');meta.delete(key);meta.put({key:'quarantineCatalog',value:catalog,updatedAt:now()});meta.put({key:receiptKey,value:result,updatedAt:now()});await complete(tx);return result;
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
      engine.recalculate(project);assertProjectIntegrity(project,{verifyDerived:true});assertPackageArtifactCustody(project,artifacts);
      const id=projectIdentity(project);if(!id)throw storageError('Migrated legacy project has no JOB_ID.','LEGACY_MIGRATION_INVALID_PROJECT');
      prepared.push({project,artifacts,id});
    }
    const inputs=new Map();for(const source of legacy)for(const span of legacySourceSpans.get(source)||[])inputs.set(span.container.storageKey,span.container.value);
    for(const [key,value]of inputs)if(localStorage.getItem(key)!==value)throw storageError('Legacy browser data changed during migration. The original input was not removed.','STALE_PROJECT_REVISION');
    tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite');
    if(await request(tx.objectStore(PROJECTS).count()))throw storageError('A project was created while legacy migration was prepared. Original browser data is preserved.','STALE_PROJECT_REVISION');
    for(const {project,artifacts,id}of prepared){const revision=Number(project.revision||0);for(const artifact of artifacts)await storeArtifactRow(tx,artifact);tx.objectStore(PROJECTS).put({jobId:id,revision,picker:projectPickerKey(project,revision),project,projectSha256:projectSha256(project),updatedAt:now()});migrated++;}
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
async function readProjectMetadata(jobId){
  const tx=await openTransaction([PROJECTS,META],'readonly'),row=await request(tx.objectStore(PROJECTS).get(String(jobId))),journal=await request(tx.objectStore(META).get(operationalKey(jobId)));await complete(tx);
  if(!row)return null;
  let computed;try{computed=await hash.sha256Chunks(hash.canonicalChunks(canonicalProject(row.project)));}catch(error){await quarantine(row,'PROJECT_ENCODING_INVALID: '+error.message);throw storageError('The stored project contains invalid canonical data. Its original state was preserved in quarantine.','PROJECT_INTEGRITY_FAILED');}
  if(computed!==row.projectSha256){await quarantine(row,'PROJECT_HASH_MISMATCH');throw storageError('Project hash mismatch. The original row was preserved in quarantine.','PROJECT_HASH_MISMATCH');}
  if(Number(row.revision)!==Number(row.project?.revision)){await quarantine(row,'PROJECT_REVISION_MISMATCH');throw storageError('Stored revision does not match the canonical project. The original row was preserved in quarantine.','PROJECT_REVISION_MISMATCH');}
  try{assertProjectIntegrity(row.project,{verifyDerived:false});}catch(error){if(!legacyJobPointerProjection(row.project,{verifyDerived:false})){await quarantine(row,'PROJECT_CANONICAL_INTEGRITY_FAILED: '+error.message);throw storageError('The stored project failed canonical integrity validation. Its original state was preserved in quarantine.','PROJECT_INTEGRITY_FAILED');}}
  let active;try{active=applyOperationalJournal(row,journal?.value);if(active!==row){try{assertProjectIntegrity(active.project,{verifyDerived:false});}catch(error){if(!legacyJobPointerProjection(active.project,{verifyDerived:false}))throw error;}}}catch(error){if(!journal?.value)throw error;await quarantine(row,'OPERATIONAL_STATE_INTEGRITY_FAILED: '+error.message,{operationalSha256:journal.value.sha256});throw storageError('Saved response operations failed integrity verification. Their exact state was preserved in quarantine.','OPERATIONAL_STATE_INTEGRITY_FAILED');}active.project.revision=Number(active.revision||0);active.project.projectSha256=active.projectSha256;recoveryProjectionBounds.set(active.project,active===row?row.updatedAt:journal.updatedAt);
  const repaired=legacyJobPointerProjection(active.project,{verifyDerived:false});
  return repaired?migrateJobPointerProjection(active.project,repaired):active.project;
}
function legacyJobPointerProjection(project,{verifyDerived=true}={}){
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
  const checked=validateProjectIntegrity(corrected,{verifyDerived});
  if(!checked.valid&&(!verifyDerived||!historicalProjectionConsistent(corrected,{code:'PROJECT_INTEGRITY_FAILED',issues:checked.issues})))return null;
  return {project:corrected,repairs};
}
async function migrateJobPointerProjection(prior,{project:next,repairs}){
  const engine=globalThis.closedLoopWorkflowEngine;delete next.projectSha256;next.revision=Number(prior.revision)+1;
  await observeProjectArtifactCustody(next);engine.reconcileReservationRevisions(next);engine.addHistory(next,'JOB_POINTER_PROJECTION_REPAIRED',{sourceProjectSha256:prior.projectSha256,repairs});engine.recalculate(next);assertProjectIntegrity(next,{prior});
  const preparedHistory=await prepareHistoryCommit(next,prior,{label:'Application identities repaired'});
  fault('before-project-transaction');const tx=await openTransaction([PROJECTS,META],'readwrite');
  try{const saved=await writeProjectRow(next,tx,{expectedProjectRevision:prior.revision,expectedStateSha256:prior.projectSha256,preparedHistory,incrementRevision:true});fault('before-transaction-commit');await complete(tx);notifyProjectChange(saved);return saved;}catch(error){try{tx.abort();}catch{}throw error;}
}
async function readProject(jobId){const project=await readProjectMetadata(jobId);if(project)await observeProjectArtifactCustody(project);return project;}
function cachedReadinessProjection(project){
 const job=Object.fromEntries(['CURRENT_STAGE','CURRENT_STATE','CURRENT_BLOCKERS','NEXT_REQUIRED_ACTION','JOB_RECORD_STATUS','STATUS_EVIDENCE',...Object.keys(globalThis.closedLoopWorkflowSchema.JOB_POINTER_TARGETS)].map(key=>[key,project.job?.[key]]));
 return {job,stages:Object.fromEntries(Object.entries(project.stages||{}).map(([number,stage])=>[number,{status:stage.status,derivedData:stage.derivedData||{}}]))};
}
function recalculateChangedProjection(project){
 const next=legacyJobPointerProjection(project,{verifyDerived:false})?.project||clone(project);globalThis.closedLoopWorkflowEngine.recalculate(next);
 // Preserve the exact saved audit timestamps when authority is unchanged.
 // A changed current determination receives the fully recalculated projection.
 return equivalent(cachedReadinessProjection(project),cachedReadinessProjection(next))?project:next;
}
async function refreshProjectProjection(jobId,{expectedProjectRevision,expectedStateSha256}={}){
 const project=await readProject(jobId);if(!project)throw storageError('The project is unavailable.','PROJECT_NOT_FOUND');
 if(Number(project.revision)!==Number(expectedProjectRevision)||project.projectSha256!==expectedStateSha256)throw storageError('The project changed before its readiness could be refreshed. Reload the current project.','STALE_PROJECT_REVISION');
 const checked=validateProjectIntegrity(project);if(checked.valid)return project;
 const error=Object.assign(storageError('Saved readiness does not agree with its canonical records.','PROJECT_INTEGRITY_FAILED'),{issues:checked.issues});
 if(!historicalProjectionConsistent(project,error))throw error;
 // Keep the exact prior checkpoint. Only a new normal revision receives the
 // current-clock projection; expired readiness remains blocked.
 const next=clone(project);globalThis.closedLoopWorkflowEngine.recalculate(next);
 return writeProject(next,{expectedProjectRevision,expectedStateSha256,historyLabel:'Readiness refreshed'});
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
  if(reference){
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
async function readOriginalSourceArchive(jobId,sha256){
  const state=await metaGet(historyKey(jobId));if(!state)throw storageError('Original source recovery history is unavailable.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
  validateRecoveryManifest(state);const source=Object.values(state.sourceArchives||{}).find(row=>row.sha256===sha256);
  if(!source)throw storageError('Original source recovery identity is unavailable.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
  const file=await readHistorySourceFile(state,source),row={...source,jobId:String(jobId),blob:file.blob};
  await verifyOriginalSourceBindings({job:{JOB_ID:String(jobId)},projectData:{migrationArchives:[source]}},[row]);return row;
}
async function verifyHistorySourceArchives(state,readFile=sha=>metaGet(historyFileKey(state.jobId,sha)),verifiedSources=null,verifiedByteDigests=null,readSnapshot=id=>metaGet(snapshotKey(state.jobId,id))){
  if(!state?.sourceArchives)return;
  // Retain one decoded root and one reconstructed source at a time. Several
  // provenance descriptors may identify the same original bytes; verify that
  // blob once without materializing every retained project in memory together.
  const groups=new Map(),decodedSources=new Map();
  for(const source of Object.values(state.sourceArchives)){if(!groups.has(source.sha256))groups.set(source.sha256,[]);groups.get(source.sha256).push(source);}
  for(const sources of groups.values()){
    const file=await readHistorySourceFile(state,sources[0],readFile,readSnapshot,verifiedByteDigests,decodedSources),files=sources.map(source=>({...source,jobId:String(state.jobId),blob:file.blob}));
    for(const source of sources)if(source.byteSize!==file.blob.size)throw storageError('Original source recovery descriptors disagree about their exact bytes.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    await verifyOriginalSourceBindings({job:{JOB_ID:state.jobId},projectData:{migrationArchives:sources}},files,verifiedSources);
  }
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
  for(const entry of state.entries){const seen=new Set();let current=entry;while(current){if(seen.has(current.id))throw storageError('Recovery history contains a cycle.','HISTORY_VERSION_MISMATCH');seen.add(current.id);if(current.parentId&&!byId.has(current.parentId))throw storageError('Recovery history is missing a parent.','HISTORY_VERSION_MISMATCH');current=byId.get(current.parentId);}}
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
      if(source?.schema!==ORIGINAL_SOURCE_SCHEMA||source.kind!==ORIGINAL_SOURCE_KIND||key!==hash.sha256Value(source)||(!state.sourceArchiveReferences?.[source.sha256]&&state.files[source.sha256]?.byteSize!==source.byteSize))throw storageError('Original-source recovery bytes do not match their descriptor.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
      requiredProjectArtifactBytes({job:{JOB_ID:state.jobId},projectData:{migrationArchives:[source]}});
    }
  }
  if(state.sourceArchiveReferences!==undefined){
    if(!state.sourceArchiveReferences||typeof state.sourceArchiveReferences!=='object'||Array.isArray(state.sourceArchiveReferences))throw storageError('Original-source recovery references are invalid.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    for(const [sha256,reference]of Object.entries(state.sourceArchiveReferences)){
      const sources=Object.values(state.sourceArchives||{}).filter(source=>source.sha256===sha256),entry=byId.get(reference?.checkpointId);
      if(!globalThis.closedLoopWorkflowSchema.validateRecoverySourceReference(reference).valid||!sources.length||sources.some(source=>source.sourceEncoding!=='UTF-8'||source.parsedPayloadSha256!==sha256)||!entry||entry.sha256!==reference.snapshotSha256)throw storageError('Original-source recovery reference is not an exact canonical source binding.','SOURCE_ARCHIVE_INTEGRITY_FAILED');
    }
  }
  const snapshotBytes=state.entries.reduce((n,entry)=>n+Number(entry.byteSize),0),fileBytes=Object.values(state.files).reduce((n,file)=>n+Number(file.byteSize),0);
  if(!Number.isSafeInteger(snapshotBytes)||!Number.isSafeInteger(fileBytes)||snapshotBytes<0||fileBytes<0||snapshotBytes!==state.compressedProjectBytes||fileBytes!==state.retainedFileBytes)throw storageError('Recovery storage accounting does not match its retained contents.','HISTORY_VERSION_MISMATCH');
}
function assertHistoryLimits(state){
  if(state.entries.length>HISTORY_LIMITS.maxCheckpoints||state.compressedProjectBytes>HISTORY_LIMITS.maxCompressedProjectBytes||state.retainedFileBytes>HISTORY_LIMITS.maxRetainedFileBytes)throw storageError('History storage limit reached. The current project and every retained version are preserved. Export a complete backup before continuing in a new project.','HISTORY_LIMIT_REACHED');
}
function historyArtifactsSha256(rows){return hash.sha256Value(rows.map(historyDescriptor).sort((a,b)=>hash.compareUnicodeScalarSequence(a.artifactId,b.artifactId)));}
function historyWorkSha256(project){const work={...project};for(const key of HISTORY_ACTIVATION_FIELDS)delete work[key];return hash.sha256Value(work);}
// Both identities retain their existing canonical preimages. Encode each
// shared root value once; feed identical UTF-8 bytes to independent SHA states.
function historyProjectDigests(project){
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
function historyUndoId(state){const byId=new Map(state.entries.map(entry=>[entry.id,entry])),active=byId.get(state.activeId);if(!active)return null;const same=active.workSha256||active.projectSha256;let prior=byId.get(active.parentId);while(prior&&(prior.workSha256||prior.projectSha256)===same)prior=byId.get(prior.parentId);return prior?.id||null;}
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
  const entries=[];
  async function visit(value,path=[],arrayItem=false){
    // Stable records and large text are shared across complete versions. The
    // references are disjoint values, never patches against another version.
    // Use the existing recovery byte store and canonical JSON codec only.
    async function retain(){const blob=new Blob([...hash.canonicalChunks(value)],{type:'application/json'});if(blob.size<4096)return false;const sha256=hash.sha256Value(value);await retainValue(sha256,blob);entries.push({path,sha256,byteSize:blob.size});return true;}
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
async function historyBlobSha256(blob,verifiedByteDigests=null){
  if(!verifiedByteDigests)return hash.sha256Bytes(blob);
  let digest=verifiedByteDigests.get(blob);
  if(!digest){digest=hash.sha256Bytes(blob);verifiedByteDigests.set(blob,digest);}
  return digest;
}
async function restoreHistoryProject(body,readFile,verifiedParts=new Map(),verifiedByteDigests=null){
  if(!body.projectParts)return body.project;
  assertHistoryProjectParts(body.projectParts);
  // Reuse only content verified against this operation's immutable input.
  // Each destination still receives its own clone; retained versions cannot alias.
  const project=body.project; // verifiedParts belongs to this read/import only.
  for(const part of body.projectParts.entries){
    let value=verifiedParts.get(part.sha256);
    if(!value){
      const file=await readFile(part.sha256);
      if(!(file?.blob instanceof Blob)||file.blob.size!==part.byteSize||await historyBlobSha256(file.blob,verifiedByteDigests)!==part.sha256)throw storageError('Saved project contents are missing or corrupt. The current version is preserved.','HISTORY_FILE_INTEGRITY_FAILED');
      const decoded=await readPackageJson(file.blob,{compressed:false,spoolArtifacts:false});value={contents:decoded.payload,byteSize:file.blob.size};verifiedParts.set(part.sha256,value);
    }
    if(value.byteSize!==part.byteSize)throw storageError('Saved project content sizes conflict.','HISTORY_VERSION_MISMATCH');
    let parent=project;
    for(const key of part.path.slice(0,-1)){if(!parent||typeof parent!=='object'||!Object.hasOwn(parent,key)||Array.isArray(parent)!==(typeof key==='number'))throw storageError('Saved project content destination is unavailable.','HISTORY_VERSION_MISMATCH');parent=parent[key];}
    const key=part.path.at(-1);
    if(!parent||typeof parent!=='object'||!Object.hasOwn(parent,key)||parent[key]!==null||Array.isArray(parent)!==(typeof key==='number'))throw storageError('Saved project contents overlap or replace authored data.','HISTORY_VERSION_MISMATCH');
    Object.defineProperty(parent,key,{value:clone(value.contents),enumerable:true,writable:true,configurable:true});
  }
  return project;
}
async function encodeCheckpoint(project,artifactRows,{id=crypto.randomUUID(),parentId=null,label='Saved project',view=historyView(project),workSha256=historyWorkSha256(project),projectDigest=projectSha256(project),artifactManifestSha256=historyArtifactsSha256(artifactRows),projectReference=null,retainValue=null}={}){
  const jobId=projectIdentity(project),canonical=canonicalProject(project),artifacts=artifactRows.map(historyDescriptor);
  assertProjectIntegrity(canonical,{verifyDerived:false});assertPackageArtifactCustody(canonical,artifactRows);assertRecoveryViewFiles(jobId,view,artifactRows);if(view?.pendingMutation&&view.pendingMutation.baseProjectSha256!==projectDigest)throw storageError('The draft correction belongs to another project version.','HISTORY_VERSION_MISMATCH');
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
async function prepareHistoryCommit(next,prior,{label=null,view=null,sessionId=null,baseState=null,artifactRows=null,retainedFiles=[],verifiedRead=null}={}){
  // These private objects remain unchanged throughout this preparation. Reuse
  // only digests computed here or verified by the private read below.
  const digests=new WeakMap(),digest=project=>{if(!digests.has(project))digests.set(project,projectSha256(project));return digests.get(project);};
  // Only saveCheckpoint supplies this private, freshly verified read. It has
  // not exposed or mutated the object; public write options cannot supply it.
  if(verifiedRead)digests.set(verifiedRead.project,verifiedRead.digest);
  const jobId=projectIdentity(next),existing=baseState||await metaGet(historyKey(jobId));
  const state=clone(existing||{schema:HISTORY_SCHEMA,jobId,generation:0,activeId:null,activeProjectSha256:null,entries:[],sessions:{},files:{},compressedProjectBytes:0,retainedFileBytes:0,redo:[]});
  const retainedRedo=clone(state.redo||[]),viewOnly=prior&&digest(next)===digest(prior);
  let files=artifactRows;try{files=files||await listArtifacts(jobId);}catch(error){if(!['ARTIFACT_BYTE_REFERENCE_INVALID','ARTIFACT_BYTES_UNAVAILABLE','ARTIFACT_LEGACY_BYTES_INVALID'].includes(error.code))throw error;throw storageError('Cannot preserve History: a stored file is missing or corrupt.','HISTORY_FILE_INTEGRITY_FAILED');}const expectedGeneration=Number(state.generation||0),newFiles=[],snapshots=[];
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
  async function append(project,entryLabel,entryView){
    const priorWork=state.activeProjectSha256===digest(project)?state.entries.find(entry=>entry.id===state.activeId)?.workSha256:null;
    const base=state.entries.find(entry=>entry.projectSha256===digest(project)&&!entry.projectReference);
    let projectReference=null;
    if(base){
      const retained=snapshots.find(entry=>entry.id===base.id)||await metaGet(snapshotKey(jobId,base.id));
      if(!retained?.blob)throw storageError('A retained project body is unavailable. The new checkpoint was not committed.','HISTORY_PROJECT_REFERENCE_UNAVAILABLE');
      const {blob,...descriptor}=retained;
      if(hash.sha256Value(descriptor)!==hash.sha256Value(base)||blob.size!==base.byteSize||await hash.sha256Bytes(blob)!==base.sha256)throw storageError('A retained project body failed exact-byte verification. The new checkpoint was not committed.','HISTORY_SNAPSHOT_INTEGRITY_FAILED');
      if(base.projectParts){assertHistoryProjectParts(base.projectParts);for(const part of base.projectParts.entries){if(state.files[part.sha256]?.byteSize!==part.byteSize)throw storageError('A retained project content dependency is unavailable.','HISTORY_VERSION_MISMATCH');await retainValue(part.sha256,null);}}
      projectReference={schema:HISTORY_PROJECT_REFERENCE,checkpointId:base.id,snapshotSha256:base.sha256};
    }
    const snapshot=await encodeCheckpoint(project,files,{parentId:state.activeId,label:entryLabel,view:entryView||historyView(project),projectDigest:digest(project),workSha256:priorWork||historyWorkSha256(project),projectReference,retainValue});
    const {blob,...descriptor}=snapshot;state.entries.push(descriptor);snapshots.push(snapshot);state.compressedProjectBytes+=blob.size;state.activeId=snapshot.id;state.activeProjectSha256=digest(project);state.activeViewOverride=null;state.redo=[];
  }
  if(prior&&(state.activeProjectSha256!==digest(prior)||state.entries.find(entry=>entry.id===state.activeId)?.artifactManifestSha256!==historyArtifactsSha256(files)))await append(prior,'Previous project',view||historyView(prior));
  if(sessionId&&!state.sessions[sessionId]){
    if(!state.activeId)await append(prior||next,'Session start',view);
    state.sessions[sessionId]={checkpointId:state.activeId,startedAt:now()};
  }
  const active=state.entries.find(entry=>entry.id===state.activeId),viewChanged=view&&hash.sha256Value(view)!==(state.activeViewOverride?hash.sha256Value(state.activeViewOverride):active?.viewSha256);
  if(!prior||digest(next)!==digest(prior)||viewChanged)await append(next,label||historyLabel(next,prior),view);
  if(!state.activeId)await append(next,label||'Session start',view);
  state.title=String(next.job?.JOB_TITLE||'');state.activeRevision=Number(next.revision||0);state.removed=false;
  if(viewOnly)state.redo=retainedRedo;reconcileRecoveryTransfers(state,next);state.generation=expectedGeneration+1;assertHistoryLimits(state);
  return {state,expectedGeneration,snapshots,newFiles};
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
  return state?{...state,undoId:historyUndoId(state),files:undefined,limits:HISTORY_LIMITS}:{schema:HISTORY_SCHEMA,jobId:String(jobId),entries:[],sessions:{},activeId:null,generation:0,redo:[],limits:HISTORY_LIMITS};
}
async function saveCheckpoint(jobId,{expectedProjectRevision,expectedStateSha256=null,view=null,label='Saved view',sessionId=null,operationId=null}={}){
  // Scroll/draft checkpoints use the existing transaction owner off the UI
  // thread; only the small view and resulting checkpoint identity cross it.
  if(useStoreWorker())return requestStoreWorker('SAVE_CHECKPOINT',[jobId,{expectedProjectRevision,expectedStateSha256,view,label,sessionId}]);
  const project=await readProject(jobId);if(!project)throw storageError('The project is unavailable.','HISTORY_PROJECT_MISSING');
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
    prepared=await prepareHistoryCommit(project,project,{label,view,sessionId,verifiedRead:{project,digest:project.projectSha256}});
    checkpointId=prepared.state.activeId;
  }
  const tx=await openTransaction([PROJECTS,META],'readwrite');
  try{const row=await projectRowWithOperations(tx,jobId);if(row?.projectSha256!==project.projectSha256)throw storageError('Project changed before its checkpoint could be saved.','STALE_PROJECT_REVISION');await commitHistory(tx,prepared);recordWorkerCommit(tx,operationId,checkpointProject,checkpointDigest,checkpointId);await complete(tx);return checkpointId;}catch(error){try{tx.abort();}catch{}throw error;}
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
function recordedProjectionObservation(project){
 const bound=recoveryProjectionBounds.get(project),observedAt=project.stages?.[2]?.gate?.checkedAt;
 const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)?Date.parse(value):NaN;
 const observed=instant(observedAt),created=instant(bound);
 return Number.isFinite(observed)&&Number.isFinite(created)&&observed<=created&&created<=Date.now()?observedAt:null;
}
function historicalProjectionConsistent(project,error){
 if(error?.code!=='PROJECT_INTEGRITY_FAILED'||!error.issues?.length||error.issues.some(issue=>!/^Application-derived job field .* does not match deterministic recalculation\.$|^Stage \d+ (?:status|derivedData) does not match deterministic recalculation\.$/.test(issue)))return false;
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
 const corrected=clone(project);corrected.stages[13].derivedData.REPEATED_FAILURE_GROUPS=stability.repeatedFailureGroupCount;
 return validateProjectIntegrity(corrected).valid||(observedAt!==null&&validateProjectIntegrity(corrected,{projectionObservedAt:observedAt}).valid);
}
function assertRecoveryCompatibility(project){
  // The complete saved projection must agree with its canonical version, not
  // only stages labelled COMPLETE. Otherwise an older permissive import can
  // re-enter through History, Undo/Redo or a nested backup checkpoint.
  try{assertProjectIntegrity(project);}catch(error){
    if(historicalProjectionConsistent(project,error)||legacyJobPointerProjection(project))return;
    if(error.code!=='PROJECT_INTEGRITY_FAILED')throw error;
    throw Object.assign(storageError('The saved project projection does not match its canonical records. The current version and saved history are preserved. Restore a compatible backup.','HISTORY_VERSION_INCOMPATIBLE'),{issues:error.issues});
  }
}
async function readRetainedCheckpoint(jobId,checkpointId,state=null){
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
  return decodeCheckpoint(jobId,await readSnapshot(checkpointId),undefined,readSnapshot);
}
async function readCheckpointBody(jobId,entry,readSnapshot,validatedRoots=new Map(),inlineOnly=false,readFile=sha=>metaGet(historyFileKey(jobId,sha)),verifiedParts=new Map(),verifiedByteDigests=null){
  if(!entry?.blob||entry.blob.size!==Number(entry.byteSize)||await historyBlobSha256(entry.blob,verifiedByteDigests)!==entry.sha256)throw storageError('This saved version is missing or corrupt. The current project is preserved.','HISTORY_SNAPSHOT_INTEGRITY_FAILED');
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
      const decoded=await readCheckpointBody(jobId,retained,readSnapshot,validatedRoots,true,readFile,verifiedParts,verifiedByteDigests);
      base={snapshotSha256:retained.sha256,project:decoded.project,projectSha256:decoded.projectSha256,workSha256:decoded.workSha256||historyWorkSha256(decoded.project)};validatedRoots.set(reference.checkpointId,base);
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
    }else{
      project=await restoreHistoryProject(body,readFile,verifiedParts,verifiedByteDigests);
      if(projectIdentity(project)!==String(jobId))throw storageError('Saved project belongs to another job.','HISTORY_VERSION_MISMATCH');
      ({projectSha256:verifiedProjectSha256,workSha256:verifiedWorkSha256}=historyProjectDigests(project));
      try{assertProjectIntegrity(project,{verifyDerived:false});}catch(error){if(!legacyJobPointerProjection(project,{verifyDerived:false}))throw error;}
    }
  }
  if(body.projectSha256!==verifiedProjectSha256)throw storageError('Saved canonical project bytes do not match their checkpoint identity.','HISTORY_VERSION_MISMATCH');
  if(entry.viewSha256&&entry.viewSha256!==hash.sha256Value(body.view))throw storageError('Saved view identity does not match its checkpoint.','HISTORY_VERSION_MISMATCH');
  if(body.workSha256!==entry.workSha256||(body.workSha256&&body.workSha256!==verifiedWorkSha256))throw storageError('Saved work identity does not match its complete project.','HISTORY_VERSION_MISMATCH');
  if(body.artifactManifestSha256!==entry.artifactManifestSha256||(body.artifactManifestSha256&&body.artifactManifestSha256!==historyArtifactsSha256(body.artifacts)))throw storageError('Saved file inventory does not match its checkpoint.','HISTORY_VERSION_MISMATCH');
  // Keep only roots that this immutable import actually references. Both
  // root-first and reference-first archive orders share the same validation.
  // Snapshot, descriptor, view and file checks still run for every checkpoint.
  if(!body.projectReference&&validatedRoots.has(entry.id))validatedRoots.set(entry.id,{snapshotSha256:entry.sha256,project,projectSha256:verifiedProjectSha256,workSha256:verifiedWorkSha256});
  if(!body.projectReference)recoveryProjectionBounds.set(project,body.createdAt);
  return {...body,project};
}
async function decodeCheckpoint(jobId,entry,readFile=sha=>metaGet(historyFileKey(jobId,sha)),readSnapshot=id=>metaGet(snapshotKey(jobId,id)),validatedRoots=new Map(),verifiedParts=new Map(),verifiedByteDigests=null,validatedProjections=null,verifiedSources=null){
  const body=await readCheckpointBody(jobId,entry,readSnapshot,validatedRoots,false,readFile,verifiedParts,verifiedByteDigests),artifacts=[],ids=new Set();
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
  if(!validatedProjections?.has(projectionKey)){
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
  let prior;try{prior=await readProject(jobId);}catch(error){if(!['PROJECT_HASH_MISMATCH','PROJECT_REVISION_MISMATCH','PROJECT_INTEGRITY_FAILED','OPERATIONAL_STATE_INTEGRITY_FAILED'].includes(error.code))throw error;prior=null;}
  const state=await metaGet(historyKey(jobId));
  if(!state?.entries.some(entry=>entry.id===checkpointId))throw storageError('That saved version is unavailable in this project.','HISTORY_VERSION_UNAVAILABLE');
  const priorRevision=Number(prior?.revision??state.activeRevision??0);
  if(expectedProjectRevision!==undefined&&priorRevision!==Number(expectedProjectRevision))throw storageError('Project changed before restoration. Reload the current version.','STALE_PROJECT_REVISION');
  const saved=await readRetainedCheckpoint(jobId,checkpointId,state);await verifyHistorySourceArchives(state);
  if(signal?.aborted)throw storageError('A newer navigation replaced this restore.','RESTORE_INTERRUPTED');
  fault('before-history-restore');
  let next=clone(saved.project);next.revision=Math.max(priorRevision,Number(saved.project.revision))+1;next.historyActivationId=crypto.randomUUID();delete next.projectSha256;bindRestoredCandidates(next,saved.project,checkpointId,saved.view);
  // The immutable saved version stays unchanged. Activation is a new revision
  // and observes current readiness, never an expired favorable cache.
  withVerifiedRecoveryCustody(saved.artifacts,()=>{next=recalculateChangedProjection(next);assertProjectIntegrity(next);});const digest=projectSha256(next),updated=clone(state);
  updated.activeId=checkpointId;updated.activeProjectSha256=digest;updated.activeRevision=next.revision;updated.activeViewOverride=rebaseHistoryView(next,saved.view);updated.title=String(next.job?.JOB_TITLE||'');updated.removed=false;updated.generation=Number(state.generation)+1;
  if(mode==='UNDO')updated.redo=[state.activeId,...state.redo.filter(id=>id!==state.activeId)];else if(mode==='REDO')updated.redo=state.redo.filter(id=>id!==checkpointId);else updated.redo=[];
  const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite');
  try{
    const projects=tx.objectStore(PROJECTS),files=tx.objectStore(ARTIFACTS),meta=tx.objectStore(META),current=await projectRowWithOperations(tx,jobId),currentHistory=await request(meta.get(historyKey(jobId)));
    if(current?.projectSha256!==prior?.projectSha256||Number(currentHistory?.value?.generation)!==Number(state.generation))throw storageError('Another tab changed this project during restoration. The newer work is preserved.','STALE_PROJECT_REVISION');
    const present=await request(files.index('jobId').getAll(String(jobId)));
    for(const row of saved.artifacts){const existing=await request(files.get(row.artifactId));if(existing&&existing.jobId!==String(jobId))throw storageError('A restored file identity belongs to another project.','CROSS_PROJECT_ARTIFACT_ID_COLLISION');}
    if(signal?.aborted)throw storageError('A newer navigation replaced this restore.','RESTORE_INTERRUPTED');
    for(const row of present)files.delete(row.artifactId);for(const row of saved.artifacts){await storeArtifactRow(tx,row);const staged=row.lineage?.stagedResponse;if(staged)meta.put({key:`responseStaging:${jobId}:${staged.stagingId}`,value:await sharedByteRecord(tx,{...staged,blob:row.blob}),updatedAt:now()});}
    fault('during-history-restore');meta.delete(operationalKey(jobId));projects.put({jobId:String(jobId),revision:next.revision,picker:projectPickerKey(next),project:next,projectSha256:digest,updatedAt:now()});
    meta.put({key:historyKey(jobId),value:updated,updatedAt:now()});await updateRecoveryCatalog(meta,updated);meta.put({key:'selectedProject',value:String(jobId),updatedAt:now()});meta.put({key:'lastCommittedRevision',value:{jobId:String(jobId),revision:next.revision,projectSha256:digest},updatedAt:now()});recordWorkerCommit(tx,operationId,next,digest);fault('before-history-restore-commit');await complete(tx);
    next.projectSha256=digest;await listArtifacts(jobId);notifyProjectChange(next,{restored:true});return {project:next,view:updated.activeViewOverride,checkpointId};
  }catch(error){try{tx.abort();}catch{}throw error;}
}

async function persistProjectPromptFiles(project){const prompts=globalThis.closedLoopPromptEngine;await persistPromptContextRecords((project.projectData?.generatedPrompts||[]).filter(record=>!record.invalidatedBy&&record.promptEngineVersion===(prompts?.versionFor?.(record.stage,record.operation)||prompts?.version)),project);}
async function writeProjectRow(project,tx,{expectedProjectRevision=null,incrementRevision=true,createOnly=false,skipUnchanged=false,selectProject=true,operationId=null,preparedHistory=null,expectedStateSha256=null,projectAllocation=null,creation=null,initialMobileAcceptanceSession=null}={}){
  const id=projectIdentity(project);if(!id)throw new Error('A project without a JOB_ID cannot be committed.');
  const store=tx.objectStore(PROJECTS),prior=await projectRowWithOperations(tx,id),currentRevision=Number(prior?.revision||0);
  if(createOnly&&prior)throw storageError(`Project ${id} already exists and was not replaced.`,'PROJECT_ALREADY_EXISTS');
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
  const next=clone(project);delete next.projectSha256;
  if(skipUnchanged&&prior?.projectSha256===projectSha256(next)){if(preparedHistory)await commitHistory(tx,preparedHistory);next.projectSha256=prior.projectSha256;recordWorkerCommit(tx,operationId,next,next.projectSha256);return next;}
  next.revision=(incrementRevision??Boolean(prior))?currentRevision+1:currentRevision;
  // The private candidate was derived before checkpoint encoding. Recheck its
  // authority here without changing time-bearing cached projections.
  assertProjectIntegrity(next,{prior:prior?.project});globalThis.closedLoopWorkflowEngine.validateAllocationReceipts(next,prior?.project);
  const digest=projectSha256(next);
  if(initialMobileAcceptanceSession){
    if(!createOnly||prior||Object.hasOwn(initialMobileAcceptanceSession,'initialProjectPackage')||Object.hasOwn(initialMobileAcceptanceSession,'preparation'))throw storageError('A mobile acceptance session must be created atomically with its new project, before capturing its initial package.','MOBILE_ACCEPTANCE_CREATION_INVALID');
    const initialProjectState={revision:next.revision,projectSha256:digest};if(Object.hasOwn(initialMobileAcceptanceSession,'initialProjectState')&&!equivalent(initialMobileAcceptanceSession.initialProjectState,initialProjectState))throw storageError('The initial mobile project identity does not match the newly committed project.','MOBILE_ACCEPTANCE_CREATION_INVALID');
    await metaPut('stage30MobileAcceptance.v1:'+id,{...clone(initialMobileAcceptanceSession),initialProjectState},tx);fault('during-mobile-acceptance-session-write');
  }
  if(!preparedHistory||preparedHistory.state.activeProjectSha256!==digest)throw storageError('The required checkpoint was not prepared for this exact change.','HISTORY_CHECKPOINT_REQUIRED');await commitHistory(tx,preparedHistory);fault('during-project-write');tx.objectStore(META).delete(operationalKey(id));store.put({jobId:id,revision:next.revision,picker:projectPickerKey(next),project:next,projectSha256:digest,updatedAt:now()});
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
function mutationImpact(prior,next,derivedNext=null){return globalThis.closedLoopWorkflowEngine.withReadinessEvaluationEpoch(()=>mutationImpactAtObservation(prior,next,derivedNext));}
function mutationImpactAtObservation(prior,next,derivedNext=null){
  const engine=globalThis.closedLoopWorkflowEngine,affected=new Map(),replaces=[];
  const candidate=next;next=derivedNext||clone(candidate);
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
  const effect={jobId:projectIdentity(next),projectRevision:Number(prior?.revision||0),priorProjectSha256:prior?(prior.projectSha256||projectSha256(prior)):null,historyActivationId:prior?.historyActivationId||null,candidateSha256:projectSha256(candidate),replaces,affected:[...affected.values()].sort((a,b)=>a.stage-b.stage)};
  return {...effect,stage:effect.affected[0]?.stage||Number(next.activeStage||1),requiresConfirmation:Boolean(affected.size),confirmationKey:hash.sha256Value(effect)};
}
function assertMutationConfirmation(prior,next,confirmation,derivedNext=null){
  const impact=mutationImpact(prior,next,derivedNext);
  if(impact.requiresConfirmation&&impact.confirmationKey!==confirmation?.confirmationKey){const error=storageError(confirmation?'The project or proposed correction changed. Review its updated effect.':'Review the correction and affected work before saving.','MUTATION_CONFIRMATION_REQUIRED');error.impact=impact;throw error;}
  return impact;
}
async function prepareProjectWrite(project,options={}){
  if(options.initialMobileAcceptanceSession!==undefined&&(!options.createOnly||!options.initialMobileAcceptanceSession||typeof options.initialMobileAcceptanceSession!=='object'||Array.isArray(options.initialMobileAcceptanceSession)))throw storageError('Initial mobile sessions require a create-only project transaction.','MOBILE_ACCEPTANCE_CREATION_INVALID');
  const id=projectIdentity(project),prior=await readProject(id),revision=Number(prior?.revision||0),next=clone(project);delete next.projectSha256;
  if(options.expectedProjectRevision!==undefined&&options.expectedProjectRevision!==null&&Number(options.expectedProjectRevision)!==revision)throw storageError('Project changed before its checkpoint could be prepared.','STALE_PROJECT_REVISION');
  if(options.createOnly&&prior)throw storageError('This project already exists.','PROJECT_ALREADY_EXISTS');
  if(options.expectedStateSha256&&options.expectedStateSha256!==prior?.projectSha256)throw storageError('Project or pending response changed before preparation.','STALE_PROJECT_REVISION');
  assertProjectCollectionShape(next);
  assertCanonicalFieldValues(next);
  assertJobPointerIntegrity(next,prior);
  if(options.skipUnchanged&&prior?.projectSha256===projectSha256(next)){await persistProjectPromptFiles(next);const preparedHistory=await prepareHistoryCommit(next,prior,{label:options.historyLabel,view:options.historyView});return {project:next,options:{...options,expectedProjectRevision:revision,expectedStateSha256:prior.projectSha256,preparedHistory}};}
  for(const source of prior?.projectData?.migrationArchives||[])if(source?.kind===ORIGINAL_SOURCE_KIND&&source.schema===ORIGINAL_SOURCE_SCHEMA&&!next.projectData?.migrationArchives?.some(row=>equivalent(row,source)))throw storageError('An existing original-source archive cannot be changed or removed by a canonical save.','SOURCE_ARCHIVE_MUTATED');
  next.revision=(options.incrementRevision??true)?revision+1:revision;
  const engine=globalThis.closedLoopWorkflowEngine;engine.ensureShape(next);
  engine.reconcileReservationRevisions(next);
  // A canonical change can introduce a newly accepted target file. The prior
  // read verifies only the old version; derive this version from its own bytes
  // before both checkpoint preparation and the commit-time integrity check.
  await observeProjectArtifactCustody(next);
  engine.recalculate(next);assertMutationConfirmation(prior,project,options.mutationConfirmation,next);assertProjectIntegrity(next);
  await persistProjectPromptFiles(next);
  const preparedHistory=await prepareHistoryCommit(next,prior,{label:options.historyLabel,view:options.historyView,artifactRows:options.creation?.artifacts||null});
  if(options.creation)preparedHistory.state.commandReceipts={...(preparedHistory.state.commandReceipts||{}),[options.creation.receiptKey]:clone(options.creation.receipt)};
  return {project:next,options:{...options,expectedProjectRevision:revision,expectedStateSha256:prior?.projectSha256||null,preparedHistory}};
}
async function writeProject(project,options={}){
  options={skipUnchanged:true,...options};
  if(options.initialMobileAcceptanceSession!==undefined&&(!options.createOnly||options.operational))throw storageError('Initial mobile sessions require a create-only project transaction.','MOBILE_ACCEPTANCE_CREATION_INVALID');
  if(options.pendingArtifacts!==undefined&&!options.operational)throw storageError('Pending returned bytes require an operational response transaction.','PENDING_ARTIFACTS_UNSUPPORTED');
  if(useStoreWorker())return requestStoreWorker('WRITE_PROJECT',[project,options]);
  assertCanonicalFieldValues(project);
  if(options.operational)return writeOperationalProject(project,options);
  if(!projectIdentity(project))throw new Error('A project without a JOB_ID cannot be committed.');
  const prepared=await prepareProjectWrite(project,options);fault('before-project-transaction');const tx=await openTransaction(options.creation?[PROJECTS,ARTIFACTS,META]:[PROJECTS,META],'readwrite');
  try{const next=await writeProjectRow(prepared.project,tx,prepared.options);fault('before-transaction-commit');await complete(tx);notifyProjectChange(next);return next;}catch(error){try{tx.abort();}catch{}throw error;}
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
  const prepared=[];for(const project of candidates)prepared.push(await prepareProjectWrite(project,{expectedProjectRevision:Number(project.revision||0),skipUnchanged:true}));
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
  const observed=await readProject(jobId);if(!observed)return false;
  if(expected!==undefined&&Number(observed.revision)!==Number(expected))throw storageError('Project changed before deletion.','STALE_PROJECT_REVISION');
  const prepared=await prepareHistoryCommit(observed,observed,{label:'Before removal',view:options.historyView||null});prepared.state.removed=true;
  const deletionReceipt={jobId,commandId:String(options.commandId||'DELETE-'+idempotencyKey),idempotencyKey,payloadSha256,result:true,committedMetadataSequence:prepared.state.generation,retentionExpiry:new Date(Date.now()+30*24*60*60*1000).toISOString()};prepared.state.commandReceipts={...(prepared.state.commandReceipts||{}),[receiptKey]:deletionReceipt};
  validateDeleteReceipt(receiptKey,deletionReceipt,jobId);
  const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite'),projects=tx.objectStore(PROJECTS),artifacts=tx.objectStore(ARTIFACTS),meta=tx.objectStore(META);
  try{
    const retry=await request(meta.get(receiptKey));if(retry){validateDeleteReceipt(receiptKey,retry.value,jobId);if(retry.value.payloadSha256!==payloadSha256)throw storageError('The deletion retry has different consequences.','IDEMPOTENCY_PAYLOAD_CONFLICT');await complete(tx);return retry.value.result;}
    const prior=await projectRowWithOperations(tx,jobId);if(!prior||prior.projectSha256!==observed.projectSha256)throw storageError('Another tab changed this project before deletion.','STALE_PROJECT_REVISION');
    await commitHistory(tx,prepared);
    if(expected!==undefined&&expected!==null&&Number(prior.revision)!==Number(expected)){const error=storageError(`Project revision conflict for ${jobId}: expected ${expected}, found ${prior.revision}.`,'STALE_PROJECT_REVISION');throw error;}
    if(replacementSelectedProjectId){const replacement=await request(projects.get(replacementSelectedProjectId));if(!replacement)throw storageError(`Replacement project ${replacementSelectedProjectId} is not stored.`,'PROJECT_DELETE_REPLACEMENT_MISSING');}
    const artifactRows=await request(artifacts.index('jobId').getAll(jobId));projects.delete(jobId);meta.delete(operationalKey(jobId));for(const artifact of artifactRows)if(String(artifact.jobId)===jobId)artifacts.delete(artifact.artifactId);
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
async function hydrateByteRecord(tx,row,{diagnostic=false,preserveDamagedBytes=false,allowOccurrenceSizeMismatch=false}={}){
 if(!row||!Object.hasOwn(row,'byteReference'))return row;
 const reference=row.byteReference,schema=globalThis.closedLoopWorkflowSchema;
 if(!schema.validateArtifactByteReference(reference).valid||reference.jobId!==String(row.jobId)||reference.sha256!==row.sha256||(!allowOccurrenceSizeMismatch&&reference.byteSize!==row.byteSize)||Object.hasOwn(row,'blob')){if(diagnostic)return {...row,blob:preserveDamagedBytes?row.blob:undefined};throw storageError('Stored artifact byte reference does not match its owner.','ARTIFACT_BYTE_REFERENCE_INVALID');}
 const body=(await request(tx.objectStore(META).get(historyFileKey(reference.jobId,reference.sha256))))?.value;
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
async function listArtifacts(jobId){
 forgetArtifactCustody(jobId);const observedEpoch=custodyEpoch,tx=await openTransaction([ARTIFACTS,META],'readonly'),stored=await request(tx.objectStore(ARTIFACTS).index('jobId').getAll(String(jobId))),rows=await hydrateArtifactRows(tx,stored);await complete(tx);
 await migrateInlineArtifacts(stored);for(const row of rows)await observeArtifactCustody(row,observedEpoch);return rows;
}
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
async function exportPackage(jobId,{passphrase=null}={}){
  const {project,artifacts,recovery}=await readExportSnapshot(jobId),artifactEntries=[],fileContents=new WeakMap();assertPackageArtifactCustody(project,artifacts);
  let requiresEncryption=containsCredentialSecret(project)||artifacts.some(containsCredentialSecret);
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
    for(const entry of recovery.entries){const saved=await metaGet(snapshotKey(jobId,entry.id));if(!saved?.blob||saved.sha256!==entry.sha256)throw storageError('A promised checkpoint is missing. Backup export did not complete.','HISTORY_VERSION_UNAVAILABLE');await member({artifactId:'RECOVERY-SNAPSHOT-'+entry.id,jobId,filename:entry.id+'.checkpoint.gz',mediaType:'application/gzip',archiveKind:'RECOVERY_SNAPSHOT',checkpointId:entry.id,byteSize:entry.byteSize,sha256:entry.sha256,blob:saved.blob});const {payload:checkpoint}=await readPackageJson(saved.blob,{spoolArtifacts:false});if(checkpoint.schema!==HISTORY_SCHEMA||checkpoint.id!==entry.id||checkpoint.jobId!==String(jobId)||checkpoint.projectSha256!==entry.projectSha256)throw storageError('A saved checkpoint does not match its recorded identity.','HISTORY_VERSION_MISMATCH');requiresEncryption=requiresEncryption||containsCredentialSecret(checkpoint);}
    for(const [sha256,info] of Object.entries(recovery.files)){const file=await metaGet(historyFileKey(jobId,sha256));if(!file?.blob)throw storageError('A retained file is missing. Backup export did not complete.','HISTORY_FILE_INTEGRITY_FAILED');await member({artifactId:'RECOVERY-BYTES-'+sha256,jobId,filename:sha256+'.bin',mediaType:'application/octet-stream',archiveKind:'RECOVERY_BYTES',byteSize:info.byteSize,sha256,blob:file.blob});}
  }
  const exportedProject=canonicalProject(project),packageManifest={jobId,projectSha256:project.projectSha256,artifactCount:artifactEntries.length,artifacts:artifactEntries.map(a=>({artifactId:a.artifactId,filename:a.filename,mediaType:a.mediaType,byteSize:a.byteSize,sha256:a.sha256}))};
  if(requiresEncryption&&!passphrase)throw storageError('This backup includes credential material in the project or its saved History. Enter a backup password to protect it.','BACKUP_PASSPHRASE_REQUIRED');
  const body={schema:'closed-loop-project-package/1',projectSchema:project.schema,workflow:project.workflow,responseSchema:globalThis.closedLoopWorkflowSchema?.RESPONSE_SCHEMA,project:exportedProject,artifacts:artifactEntries,packageManifest,...(recovery?{recovery}:{}),exportedAt:now()};
  const {blob:compressed,packageSha256}=await compressPackage(body,fileContents),exportRecord={jobId,packageSha256,projectRevision:project.revision,projectSha256:project.projectSha256,artifactManifestSha256:hash.sha256Value(packageManifest.artifacts),artifactCount:artifactEntries.length,historyCheckpointCount:recovery?.entries.length||0,at:now()};
  const result=passphrase?await encryptedPackage(compressed,hash.sha256Value(packageManifest),passphrase):new Blob([compressed],{type:'application/gzip'});exportRecord.protectionProfile=passphrase?ENCRYPTED_EXPORT_PROFILE.schema:'UNENCRYPTED';
  await metaPut('lastVerifiedExport',exportRecord);await metaPut('lastVerifiedExport:'+jobId,exportRecord);return result;
}
// Decode the unchanged JSON package without retaining its complete expanded
// text. The project remains a finite-memory object; artifact strings are
// temporary Blobs whose exact decoded spelling is used by the canonical hash.
async function readPackageJson(blob,{compressed=true,spoolArtifacts=true}={}){
  const fileContents=new WeakMap(),stack=[],projectSourceParts=[];let root,hasRoot=false,kind=null,atom='',raw='',pieces=[],spooled=false,escape=false,unicode=0,lastYield=Date.now(),projectSourceDepth=null,projectSourceStart=null,projectSourceBlob=null;
  const fail=()=>{throw new SyntaxError('Malformed project package JSON.');};
  const frame=()=>stack.at(-1);
  const expectsValue=()=>{const parent=frame();return parent?parent.state==='value'||parent.state==='valueOrEnd':!hasRoot;};
  function value(item,source=null){
    const parent=frame();if(!parent){if(hasRoot)fail();root=item;hasRoot=true;return;}
    if(parent.type==='object'&&(parent.state==='key'||parent.state==='keyOrEnd')){if(typeof item!=='string')fail();parent.key=item;parent.state='colon';return;}
    if(!expectsValue())fail();
    if(parent.type==='array')parent.value.push(item);
    else{Object.defineProperty(parent.value,parent.key,{value:item,enumerable:true,writable:true,configurable:true});if(parent.artifact&&parent.key==='base64'){if(source)fileContents.set(parent.value,source);else fileContents.delete(parent.value);}}
    parent.state='commaOrEnd';
  }
  function flushString(){if(!raw)return;const text=JSON.parse('"'+raw+'"');raw='';if(spooled){if(/[^\x00-\x7f]/.test(text))throw new TypeError('Artifact base64 must contain ASCII characters.');pieces.push(new Blob([text]));}else pieces.push(text);}
  function parseChunk(text){
    let start=kind==='string'?0:-1;if(projectSourceDepth!==null)projectSourceStart=0;
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
          kind=null;pieces=[];spooled=false;start=-1;value(item,source);continue;
        }else if(char<' ')fail();
        if(!escape&&!unicode&&raw.length+i-start+1>=16384){raw+=text.slice(start,i+1);flushString();start=i+1;}
        continue;
      }
      if(kind==='atom'){
        if(!/[\s,\]}:]/.test(char)){atom+=char;continue;}
        value(JSON.parse(atom));atom='';kind=null;i--;continue;
      }
      if(char===' '||char==='\t'||char==='\r'||char==='\n')continue;
      const parent=frame();
      if(char==='"'){
        if(!expectsValue()&&!(parent?.type==='object'&&['key','keyOrEnd'].includes(parent.state)))fail();
        kind='string';raw='';pieces=[];escape=false;unicode=0;spooled=Boolean(parent?.artifact&&parent.key==='base64'&&parent.state==='value');start=i+1;continue;
      }
      if(char==='{'||char==='['){
        if(!expectsValue())fail();const type=char==='{'?'object':'array',item=type==='object'?{}:[],artifact=type==='object'&&Boolean(parent?.artifactArray),artifactArray=spoolArtifacts&&type==='array'&&stack.length===1&&parent.type==='object'&&parent.key==='artifacts';
        if(spoolArtifacts&&type==='object'&&stack.length===1&&parent.type==='object'&&parent.key==='project'){projectSourceParts.length=0;projectSourceDepth=stack.length+1;projectSourceStart=i;}
        value(item);stack.push({type,value:item,state:type==='object'?'keyOrEnd':'valueOrEnd',artifact,artifactArray});continue;
      }
      if(char==='}'||char===']'){
        if(!parent||parent.type!==(char==='}'?'object':'array')||!['keyOrEnd','valueOrEnd','commaOrEnd'].includes(parent.state))fail();if(projectSourceDepth===stack.length){projectSourceParts.push(new Blob([text.slice(projectSourceStart,i+1)]));projectSourceBlob=new Blob(projectSourceParts,{type:'application/json'});projectSourceDepth=null;projectSourceStart=null;}stack.pop();continue;
      }
      if(char===','){if(parent?.state!=='commaOrEnd')fail();parent.state=parent.type==='object'?'key':'value';continue;}
      if(char===':'){if(parent?.type!=='object'||parent.state!=='colon')fail();parent.state='value';continue;}
      if(!expectsValue()||!/[\-0-9tfn]/.test(char))fail();kind='atom';atom=char;
    }
    if(kind==='string')raw+=text.slice(start);if(projectSourceDepth!==null)projectSourceParts.push(new Blob([text.slice(projectSourceStart)]));
  }
  const stream=blob.stream(),reader=(compressed?stream.pipeThrough(new DecompressionStream('gzip')):stream).getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let expandedBytes=0;
  // Internal checkpoint metadata has no streamed artifact payload. Native JSON
  // decoding avoids revisiting every short field in JavaScript for every saved
  // version. Keep this temporary text strictly bounded in UTF-8 bytes; a large
  // or legacy checkpoint resumes the existing streaming parser at the exact
  // buffered prefix. Full backup packages always keep artifact strings spooled.
  const METADATA_PARSE_BYTE_LIMIT=8*1024*1024;
  let metadataText=spoolArtifacts?null:[];
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
    parseChunk(tail);if(kind==='atom'){value(JSON.parse(atom));kind=null;}if(kind||stack.length||!hasRoot)fail();return {payload:root,fileContents,expandedBytes,projectSourceBlob};
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
  if(await isEncryptedPackage(blob))blob=await decryptPackage(blob,passphrase);
  if(useStoreWorker())return requestStoreWorker('IMPORT_PACKAGE',[blob]);
  if(typeof DecompressionStream!=='function')throw storageError('DecompressionStream is required for complete package import.','DECOMPRESSION_STREAM_REQUIRED');
  const observedHeads=new Map((await listProjectSummaries()).map(p=>[projectIdentity(p),Number(p.revision||0)]));
  const {payload,fileContents,projectSourceBlob}=await readPackageJson(blob),{packageSha256,...body}=payload;
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
  try{withVerifiedRecoveryCustody(verifiedArtifacts,()=>assertProjectIntegrity(project));assertPackageArtifactCustody(project,verifiedArtifacts);}catch(error){if(!withVerifiedRecoveryCustody(verifiedArtifacts,()=>historicalProjectionConsistent(project,error)||legacyJobPointerProjection(project)))throw Object.assign(error,{existingProjectsUnchanged:true});assertPackageArtifactCustody(project,verifiedArtifacts);}
  if(verifiedArtifacts.some(a=>a.archiveKind&&!['RECOVERY_BYTES','RECOVERY_SNAPSHOT'].includes(a.archiveKind)))throw storageError('Unknown recovery archive member.','HISTORY_VERSION_MISMATCH');
  const activeArtifacts=verifiedArtifacts.filter(a=>!a.archiveKind);await verifyOriginalSourceBindings(project,activeArtifacts,verifiedSources);const priorProject=await readProject(id);
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
    const archiveFiles=new Map(verifiedArtifacts.filter(a=>a.archiveKind==='RECOVERY_BYTES').map(a=>[a.sha256,a])),archiveSnapshots=new Map(),validatedRoots=new Map(incoming.entries.filter(entry=>entry.projectReference).map(entry=>[entry.projectReference.checkpointId,null])),verifiedParts=new Map(),validatedProjections=new Set();
    for(const entry of incoming.entries){const archived=verifiedArtifacts.find(a=>a.archiveKind==='RECOVERY_SNAPSHOT'&&a.checkpointId===entry.id);if(archived)archiveSnapshots.set(entry.id,{...entry,blob:archived.blob});}
    await verifyHistorySourceArchives(incoming,sha=>archiveFiles.get(sha),verifiedSources,verifiedByteDigests,checkpointId=>archiveSnapshots.get(checkpointId));
    for(const [key,source]of Object.entries(incoming.sourceArchives||{})){const prior=merged.sourceArchives?.[key];if(prior&&hash.sha256Value(prior)!==hash.sha256Value(source))throw storageError('Original-source recovery metadata conflicts with retained evidence.','SOURCE_ARCHIVE_INTEGRITY_FAILED');merged.sourceArchives={...(merged.sourceArchives||{}),[key]:clone(source)};}
    // Both representations were verified against the same exact source digest.
    // An existing local reference remains valid; all its snapshots are retained.
    for(const [sha256,reference]of Object.entries(incoming.sourceArchiveReferences||{}))if(!merged.sourceArchiveReferences?.[sha256])merged.sourceArchiveReferences={...(merged.sourceArchiveReferences||{}),[sha256]:clone(reference)};
    let previousRootId=null;
    for(const entry of incoming.entries){
      const rootId=entry.projectReference?.checkpointId||entry.id;
      // Keep the small validation receipts, not every expanded project graph.
      // Archived bytes and all retained checkpoints remain untouched. A later
      // reference reconstructs its exact root from verified immutable parts.
      if(previousRootId&&previousRootId!==rootId){const priorRoot=validatedRoots.get(previousRootId);if(priorRoot)delete priorRoot.project;}
      previousRootId=rootId;
      const archived=verifiedArtifacts.find(a=>a.archiveKind==='RECOVERY_SNAPSHOT'&&a.checkpointId===entry.id);
      if(!archived||archived.sha256!==entry.sha256||archived.byteSize!==entry.byteSize)throw storageError('A promised checkpoint is missing from the backup.','HISTORY_VERSION_UNAVAILABLE');
      const snapshot={...entry,blob:archived.blob},decoded=await decodeCheckpoint(id,snapshot,sha=>archiveFiles.get(sha),checkpointId=>archiveSnapshots.get(checkpointId),validatedRoots,verifiedParts,verifiedByteDigests,validatedProjections,verifiedSources);if(entry.id===incoming.activeId){importedActive=decoded;importedView=incoming.activeViewOverride||decoded.view;}
      const existing=merged.entries.find(item=>item.id===entry.id);
      if(existing&&hash.sha256Value(existing)!==hash.sha256Value(entry))throw storageError('Backup History conflicts with a retained version.','IMMUTABLE_HISTORY_CONFLICT');
      if(!existing){merged.entries.push(clone(entry));merged.compressedProjectBytes+=entry.byteSize;importSnapshots.push(snapshot);}
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
  const importSourceRows=[],importSource=await retainProjectSource(next,{blob:projectSourceBlob,payload:project,sourceSha256:await hash.sha256Bytes(blob),sourceEncoding:'UTF-8',sourceLocation:{jsonPointer:'/project',containerEncoding:'gzip'},parserIdentity:'closed-loop-project-package-json-reader',parserVersion:'1'},importSourceRows,{recordProject:false});
  if(body.recovery&&body.recovery.activeProjectSha256!==projectSha256(project))throw storageError('Backup active project does not match its recovery version.','HISTORY_VERSION_MISMATCH');
  assertRecoveryViewFiles(id,importedView,activeArtifacts);
  importedView=rebaseHistoryView(project,importedView);
  bindRestoredCandidates(next,project,body.recovery?.activeId||null,importedView);
  importedView=rebaseHistoryView(next,importedView);
  withVerifiedRecoveryCustody(activeArtifacts,()=>{next=recalculateChangedProjection(next);assertProjectIntegrity(next);});
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
  prepared.state.sourceArchives={...(prepared.state.sourceArchives||{}),[sourceKey]:importSource};validateRecoveryManifest(prepared.state);assertHistoryLimits(prepared.state);
  fault('before-import-transaction');const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite'),projects=tx.objectStore(PROJECTS),artifacts=tx.objectStore(ARTIFACTS),meta=tx.objectStore(META);
  try{
    const prior=await projectRowWithOperations(tx,id);if(Number(prior?.revision||0)!==Number(observedHeads.get(id)||0)||prior?.projectSha256!==priorProject?.projectSha256)throw storageError('Another tab changed this project during import.','STALE_PROJECT_REVISION');
    if(stagedBackup){const pending=await request(meta.get(backupImportStagingKey(stagedBackup.jobId)));if(!pending?.value||!sameBackupImportIdentity(pending.value,stagedBackup)||!(pending.value.blob instanceof Blob)||pending.value.blob.size!==stagedBackup.byteSize)throw staleBackupImportSelection();meta.delete(backupImportStagingKey(stagedBackup.jobId));}
    const digest=projectSha256(next),existingArtifacts=await request(artifacts.index('jobId').getAll(id));
    await restoreProjectAllocation(tx,next);
    for(const row of activeArtifacts){const existing=await request(artifacts.get(row.artifactId));if(existing&&String(existing.jobId)!==id)throw storageError('An imported artifact identity belongs to another project.','CROSS_PROJECT_ARTIFACT_ID_COLLISION');}
    for(const [key,receipt] of Object.entries(prepared.state.commandReceipts||{})){const current=await request(meta.get(key));if(current&&hash.sha256Value(current.value)!==hash.sha256Value(receipt))throw storageError('An imported command receipt conflicts with current execution history.','IDEMPOTENCY_PAYLOAD_CONFLICT');meta.put({key,value:receipt,updatedAt:now()});}
    await commitHistory(tx,prepared);
    for(const existing of existingArtifacts)artifacts.delete(existing.artifactId);
    fault('during-import-project-write');meta.delete(operationalKey(id));projects.put({jobId:id,revision:next.revision,picker:projectPickerKey(next),project:next,projectSha256:digest,updatedAt:now()});
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
async function parseInboundArchive(blob){
 const contract=globalThis.closedLoopWorkflowSchema.INBOUND_RESPONSE_ARCHIVE_CONTRACT,limits=contract?.limits;
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
  const max=normalized.canonicalPath==='manifest.json'?limits.maxManifestBytes:normalized.canonicalPath==='response.json'?limits.maxResponseBytes:limits.maxEntryBytes;
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
async function extractInboundArchive(blob){
 if(STORE_WORKER||typeof document==='undefined'&&typeof globalThis.openStorageTransaction==='function')return parseInboundArchive(blob);
 if(!useStoreWorker())throw inboundArchiveError('Isolated archive parsing is unavailable in this browser. Select response.json and the returned files separately.','INBOUND_ARCHIVE_WORKER_UNAVAILABLE');
 const contract=globalThis.closedLoopWorkflowSchema.INBOUND_RESPONSE_ARCHIVE_CONTRACT;
 if(!(blob instanceof Blob)||blob.size>contract.limits.maxArchiveBytes)throw inboundArchiveError('Archive bytes exceed the published input bound.','INBOUND_ARCHIVE_LIMIT');
 return new Promise((resolve,reject)=>{const url=new URL(STORE_SCRIPT_URL);url.searchParams.set('storeWorker','1');url.searchParams.set('archiveParser','1');url.searchParams.set('storeContext',STORE_CONTEXT_ID);const operationId=crypto.randomUUID();let worker,timer,settled=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);worker?.terminate();error?reject(Object.assign(error,{existingProjectsUnchanged:true})):resolve(value);};try{worker=new Worker(url.href);timer=setTimeout(()=>finish(inboundArchiveError('Isolated archive parsing timed out. The selected original and project are unchanged. Select the files separately or retry with a supported archive.','INBOUND_ARCHIVE_WORKER_TIMEOUT')),contract.limits.workerTimeoutMs);worker.onerror=event=>finish(inboundArchiveError(event?.message||'Isolated archive parser stopped.','INBOUND_ARCHIVE_WORKER_FAILED'));worker.onmessageerror=()=>finish(inboundArchiveError('Isolated archive parser returned unreadable data.','INBOUND_ARCHIVE_WORKER_FAILED'));worker.onmessage=event=>{const message=event.data||{};if(message.operationId!==operationId||message.buildIdentity!==STORE_BUILD_ID)return finish(inboundArchiveError('Isolated archive parser identity did not match the request.','INBOUND_ARCHIVE_WORKER_FAILED'));if(!message.ok)return finish(Object.assign(new Error(message.error?.message||'Archive parsing failed.'),{code:message.error?.code||'INBOUND_ARCHIVE_INVALID'}));const result=message.archiveResult;if(result?.archive?.parserVersion!==contract.parserVersion||result.archive.byteSize!==blob.size||result.archive.mediaType!=='application/zip'||!/^[a-f0-9]{64}$/.test(String(result.archive.sha256))||!Array.isArray(result.members)||!result.members.length||result.members.length>contract.limits.maxEntries||result.members.some(member=>!member||typeof member.rawFilename!=='string'||typeof member.canonicalPath!=='string'||!(member.blob instanceof Blob)||!Number.isSafeInteger(member.byteSize)||member.byteSize!==member.blob.size||member.byteSize>contract.limits.maxEntryBytes||!/^[a-f0-9]{64}$/.test(String(member.sha256))||!Number.isInteger(member.crc32)||member.crc32<0||member.crc32>0xffffffff||!contract.supportedCompressionMethods.includes(member.compressionMethod)))return finish(inboundArchiveError('Isolated archive parser returned an invalid result.','INBOUND_ARCHIVE_WORKER_FAILED'));finish(null,result);};worker.postMessage({operationId,method:'EXTRACT_INBOUND_ARCHIVE',args:[blob],buildIdentity:STORE_BUILD_ID});}catch(error){finish(error);}});
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
  const responseContract=promptEngine.responseContractDescriptor(normalizedStage,normalizedOperation),contractSha256=hash.sha256Value(responseContract);if(String(selectedPrompt.contractSha256||'')!==contractSha256)throw storageError('The saved controlling instruction response contract is stale. Save the current instruction again before preparing the package.','EXECUTION_PACKAGE_CONTRACT_STALE');
  if(normalizedRunId&&String(selectedPrompt.scope?.runId||'')!==normalizedRunId)throw storageError('The saved controlling instruction is bound to a different run lane.','EXECUTION_PACKAGE_RUN_MISMATCH');
  const plan=engine.executionHandoff(project,{stage:normalizedStage,operation:normalizedOperation,testIds:ids,runIds:normalizedRunId?[normalizedRunId]:null,deferredDefinitionCorrectionTarget:selectedPrompt.contextManifest?.deferredDefinitionCorrectionTarget||null}),artifactIds=[...new Set(plan.send.map(x=>String(x.artifactId||'')).filter(Boolean))],artifactEntries=[],fileContents=new WeakMap();
  for(const artifactId of artifactIds){const canonical=engine.records(project,'artifacts').find(r=>engine.recordId(r,'artifacts')===artifactId&&engine.isActiveRecord(r));if(!canonical)throw storageError(`Execution-package artifact ${artifactId} is not current canonical state.`,'EXECUTION_PACKAGE_ARTIFACT_STALE');const row=await getArtifact(artifactId);if(!row||String(row.jobId)!==canonicalJobId)throw storageError(`Execution-package artifact ${artifactId} has no stored bytes for ${canonicalJobId}.`,'EXECUTION_PACKAGE_BYTES_MISSING');const sha256=await observedArtifactDigest(row),byteSize=row.blob.size,expectedSha=String(engine.recordValue(canonical,'SHA256')||''),expectedSize=Number(engine.recordValue(canonical,'BYTE_SIZE'));if(sha256!==expectedSha||byteSize!==expectedSize)throw storageError(`Execution-package artifact ${artifactId} failed byte identity verification.`,'EXECUTION_PACKAGE_ARTIFACT_MISMATCH');artifactEntries.push({artifactId,filename:String(engine.recordValue(canonical,'FILENAME')||row.filename||artifactId),mediaType:String(row.mediaType||'application/octet-stream'),byteSize,sha256,role:String(engine.recordValue(canonical,'ROLE')||'AUTHORIZED_INPUT'),disclosureClassification:String(engine.recordValue(canonical,'DISCLOSURE_CLASSIFICATION')||'UNKNOWN'),base64:''});fileContents.set(artifactEntries.at(-1),{property:'base64',encoding:'base64',blob:row.blob});}
  const tests=engine.records(project,'tests').filter(t=>ids.includes(engine.recordId(t,'tests'))).map(t=>({testId:engine.recordId(t,'tests'),requirementId:String(engine.recordValue(t,'REQ_ID')||t.relationships?.REQ_ID||''),fields:clone(t.fields||{}),relationships:clone(t.relationships||{})}));
  const aliasEntries=promptAliases,reviewerAlias=String(providedAlias?.alias||providedAlias?.reviewerAlias||aliasEntries[0]?.alias||aliasEntries[0]?.reviewerAlias||'').trim()||null,publicIdentity=value=>{const text=String(value??'');const match=aliasEntries.find(entry=>String(entry.canonicalId||'')===text);return match?String(match.alias):value;},publicScope=Object.fromEntries(Object.entries(selectedPrompt.scope||{}).map(([key,value])=>[key,publicIdentity(value)]));
  const instruction={instructionId:String(selectedPrompt.instructionId||selectedPrompt.promptId||''),promptEngineVersion:String(selectedPrompt.promptEngineVersion||''),bodySha256:String(selectedPrompt.bodySha256||selectedPrompt.sha256||''),contractSha256:String(selectedPrompt.contractSha256||''),contextSignature:String(selectedPrompt.contextSignature||''),scope:clone(publicScope),fullTextSha256,text:exactPrompt};
  const promptFileManifest=promptEngine.promptFileManifest(selectedPrompt),manifest={...(promptFileManifest.deferredExecutionBinding?{deferredExecutionBinding:clone(promptFileManifest.deferredExecutionBinding)}:{}),...(promptFileManifest.deferredDefinitionCompatibilityContractVersion?{deferredDefinitionCompatibilityContractVersion:promptFileManifest.deferredDefinitionCompatibilityContractVersion,contextManifest:clone(promptFileManifest.contextManifest||{}),...(promptFileManifest.deferredDefinitionCorrectionTarget?{deferredDefinitionCorrectionTarget:clone(promptFileManifest.deferredDefinitionCorrectionTarget)}:{})}:{}),scope:clone(promptFileManifest.scope),historyActivationId:selectedPrompt.historyActivationId||null,contractProfileId:promptFileManifest.contractProfileId,promptIdentity:promptFileManifest.promptIdentity,packageId:promptFileManifest.packageId||null,operationReservationId:promptFileManifest.operationReservationId||null,challengeNonce:promptFileManifest.challengeNonce||null,targetSlot:promptFileManifest.targetSlot||null,reservationRevision:promptFileManifest.reservationRevision??null,schema:'closed-loop-handoff-container/1',verificationPackageSchema:'closed-loop-verification-package/1',archiveProfile:'closed-loop-archive-profile/1',workflow:project.workflow,projectSchema:project.schema,responseSchema:globalThis.closedLoopWorkflowSchema?.RESPONSE_SCHEMA,jobId:canonicalJobId,stage:normalizedStage,operation:normalizedOperation,runId:publicIdentity(normalizedRunId),reviewerAlias,productId:publicIdentity(selectedPrompt.scope?.productId||null),testIds:ids,instructionId:instruction.instructionId,instructionFullTextSha256:fullTextSha256,responseContractSha256:contractSha256,artifacts:artifactEntries.map(({base64,...x})=>x),attachmentSlots:clone(promptFileManifest.attachmentSlots),handoff:clone(promptEngine.fileHandoff(selectedPrompt,plan))};
  const contextFiles=[];for(const identity of promptFileManifest.contextFiles){const file=await readPromptContextFile(selectedPrompt,canonicalJobId,identity.path);contextFiles.push({...identity,text:''});fileContents.set(contextFiles.at(-1),{property:'text',encoding:'utf8',blob:file.blob});}manifest.contextFiles=promptFileManifest.contextFiles;
  if(typeof engine.handoffDisclosureClassification!=='function')throw storageError('The current disclosure classification authority is unavailable.','HANDOFF_AUTHORITY_UNAVAILABLE');
  const classification=authority=>engine.handoffDisclosureClassification(activeProject,selectedPrompt,{authority});
  const members=[],addMember=(canonicalPath,blob,identity)=>{members.push({canonicalPath,blob,...identity,byteSize:blob.size,hashAlgorithm:'SHA-256',required:true});};
  addMember('instruction.txt',new Blob([exactPrompt],{type:'text/plain;charset=utf-8'}),{artifactId:instruction.instructionId,filename:'instruction.txt',role:'AUTHORITATIVE_INSTRUCTION',authority:'APPLICATION_INSTRUCTION',availability:'BYTES_PERSISTED_AND_VERIFIED',sha256:fullTextSha256,mediaType:'text/plain',disclosureClassification:classification('APPLICATION_INSTRUCTION')});
  for(const identity of contextFiles)addMember(identity.path,fileContents.get(identity).blob,{artifactId:promptContextArtifactId(canonicalJobId,identity),filename:identity.filename||identity.path,role:'PROMPT_CONTEXT',authority:'APPLICATION_CONTEXT',availability:'BYTES_PERSISTED_AND_VERIFIED',sha256:identity.sha256,mediaType:identity.mediaType,disclosureClassification:classification('APPLICATION_CONTEXT')});
  for(const entry of artifactEntries){const identity=hash.normalizeFilename(entry.filename,{allowPath:true});addMember(hash.normalizeFilename(`artifacts/${entry.artifactId}/${identity.canonicalPath}`,{allowPath:true}).canonicalPath,fileContents.get(entry).blob,{artifactId:entry.artifactId,filename:entry.filename,authority:'CANONICAL_ARTIFACT',availability:'BYTES_PERSISTED_AND_VERIFIED',rawFilename:entry.filename,displayFilename:identity.displayFilename,filenameVersion:identity.filenameVersion,unicodeVersion:identity.unicodeVersion,role:entry.role,sha256:entry.sha256,mediaType:entry.mediaType,disclosureClassification:entry.disclosureClassification});}
  // Rejected work is a separate, explicitly noncanonical input lane. It can
  // never bypass the canonical artifact guard or issue current output slots.
  const retryContext=promptEngine.retryContextFor(project,normalizedStage,normalizedOperation,selectedPrompt.scope),retryInputs=promptEngine.retryInputIdentities(retryContext);
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
 const projectRows=await request(tx.objectStore(PROJECTS).getAll());
 if(projectRows.some(row=>referencesStagedIdentity(row.project,identities)))return false;
 const keys=meta.getAllKeys?await request(meta.getAllKeys()):(await request(meta.getAll())).map(row=>row.key);
 for(const key of keys){if(key===receiptKey||key===retiredKey||key===historyFileKey(owner,artifact.sha256))continue;const row=await request(meta.get(key)),value=row?.value,schema=globalThis.closedLoopWorkflowSchema;
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
    try{if(!projects.has(owner))projects.set(owner,await readProjectMetadata(owner));project=projects.get(owner);}catch{project=null;}
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
 await recoverStorageBoundaries(artifacts,stagedRows,retirements,recoveryReceipts,projects,recovered);
 return recovered;
}

// Startup diagnosis does not confer custody or promotion authority. Read only
// the project metadata needed for relationship checks; payloads are rehashed
// by readStagedResponseFile, artifact custody and actual repair boundaries.
async function recoverStorageBoundaries(artifacts,stagedRows,retirements,recoveryReceipts,projects,results){
 const byId=new Map(artifacts.map(row=>[row.artifactId,row])),owners=new Set(artifacts.map(row=>String(row.jobId)));
 for(const row of stagedRows)if(typeof row?.value?.jobId==='string'&&row.value.jobId)owners.add(row.value.jobId);
 for(const summary of await listProjectSummaries())owners.add(projectIdentity(summary));
 const histories=new Map();
 for(const owner of owners){
  if(!projects.has(owner)){try{projects.set(owner,await readProjectMetadata(owner));}catch{projects.set(owner,null);}}
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
async function readStagedResponseFile({jobId,stagingId}={}){const owner=String(jobId||'').trim(),id=String(stagingId||'').trim();if(!owner||!id)throw storageError('JOB_ID and stagingId are required.','RESPONSE_STAGE_ID_REQUIRED');const key=`responseStaging:${owner}:${id}`,stored=await metaGet(key);if(!stored?.blob)throw storageError('Staged response file is unavailable.','RESPONSE_STAGE_NOT_FOUND');if(String(stored.jobId)!==owner)throw storageError('Staged response belongs to another project.','CROSS_PROJECT_RESPONSE_STAGE');if(stored.stagingId!==id||!globalThis.closedLoopWorkflowSchema.validateResponseStagingDescriptor(responseStagingDescriptor(stored)).valid)throw storageError('Staged response identity is invalid.','RESPONSE_STAGE_IDENTITY_MISMATCH');const limit=globalThis.closedLoopWorkflowSchema?.DEFAULT_RESOURCE_LIMITS?.maxRawResponseBytes;if(Number.isFinite(limit)&&stored.blob.size>limit){const digest=await hash.sha256Bytes(stored.blob);if(stored.blob.size!==Number(stored.byteSize)||digest!==String(stored.sha256))throw storageError('Staged response bytes no longer match their captured identity.','RESPONSE_STAGE_REHASH_MISMATCH');await metaPut(key,{...stored,rejection:{code:'OVERSIZED_RESPONSE',byteSize:stored.blob.size,maxRawResponseBytes:limit,at:now()}});throw storageError(`Response file exceeds the ${limit}-byte stage limit. The exact original bytes and rejection receipt remain staged for ${owner}.`,'OVERSIZED_RESPONSE');}const bytes=new Uint8Array(await hash.readWithDeadline(stored.blob.arrayBuffer(),'Reading staged response')),sha256=await hash.sha256Bytes(bytes);if(bytes.byteLength!==Number(stored.byteSize)||sha256!==String(stored.sha256))throw storageError('Staged response bytes no longer match their captured identity.','RESPONSE_STAGE_REHASH_MISMATCH');return {...stored,bytes,blob:stored.blob,storageKey:key};}
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

const ready=(async()=>{hash.assertPinnedUnicodeHost();if(globalThis.indexedDB&&!ARCHIVE_PARSER_WORKER){
 try{await migrateLegacy();globalThis.closedLoopLegacyMigrationError=null;}catch(error){globalThis.closedLoopLegacyMigrationError=String(error?.stack||error);console.error('Legacy migration failed without deleting the preserved legacy payload; application startup will continue.',error);}
 try{await recoverResponseStaging();globalThis.closedLoopStagingRecoveryError=null;}catch(error){globalThis.closedLoopStagingRecoveryError=String(error?.message||error);console.error('Response staging recovery could not finish. Preserved project and file data remain available.',error);}
 }return true;})();
if(STORE_WORKER){let queue=Promise.resolve();globalThis.addEventListener('message',event=>{const message=event.data||{};queue=queue.then(async()=>{try{if(message.buildIdentity!==STORE_BUILD_ID||!message.operationId||!['WRITE_PROJECT','IMPORT_PACKAGE','SAVE_CHECKPOINT','EXTRACT_INBOUND_ARCHIVE'].includes(message.method)||ARCHIVE_PARSER_WORKER&&message.method!=='EXTRACT_INBOUND_ARCHIVE'||!Array.isArray(message.args))throw storageError('Invalid storage worker command or build identity.','INVALID_STORAGE_WORKER_REQUEST');await ready;globalThis.__closedLoopStorageFault=message.fault;
  const result=message.method==='EXTRACT_INBOUND_ARCHIVE'?{archiveResult:await parseInboundArchive(message.args[0])}:message.method==='SAVE_CHECKPOINT'?{checkpointId:await saveCheckpoint(message.args[0],{...message.args[1],operationId:message.operationId})}:{project:message.method==='WRITE_PROJECT'?await writeProject(message.args[0],{...message.args[1],operationId:message.operationId}):await importPackage(message.args[0],{...message.args[1],operationId:message.operationId})};
  globalThis.postMessage({operationId:message.operationId,buildIdentity:STORE_BUILD_ID,ok:true,...result});}catch(error){globalThis.postMessage({operationId:message.operationId,buildIdentity:STORE_BUILD_ID,ok:false,error:{code:error?.code||'STORAGE_OPERATION_FAILED',message:String(error?.message||error)}});}finally{delete globalThis.__closedLoopStorageFault;}}).catch(error=>{setTimeout(()=>{throw error;},0);});});}
globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS,STORAGE_WORKER_TIMEOUT_MS,listQuarantinedProjects,exportQuarantinedProject,exportLegacyMigrationData,removeQuarantinedProject,ENCRYPTED_EXPORT_PROFILE,isEncryptedPackage,HISTORY_LIMITS,mutationImpact,rebaseHistoryView,assertRecoveryTransfer,historyList,listRecoverableProjects,readOriginalSourceArchive,readHistoryView,saveCheckpoint,beginHistorySession,restoreCheckpoint,persistPromptContextFiles,readPromptContextFile,archiveMigrationPayload,version:'closed-loop-project-store/2',DB_NAME,DB_VERSION,stores:Object.freeze({projects:PROJECTS,artifacts:ARTIFACTS,meta:META}),STORE_KEY,LEGACY_KEYS,clone,projectIdentity,projectSha256,validateProjectIntegrity,openDatabase,ready,readAll,readProject,refreshProjectProjection,listProjectSummaries,writeAll,writeProject,replaceProject,transact,removeProject,putArtifact,getArtifact,deleteArtifact,listArtifacts,artifactCustodyState,verifyProjectArtifacts,createExecutionPackage,prepareExecutionPackageReview,readAuthorizedHandoffMember,prepareCapabilityRequestReview,readAuthorizedCapabilityRequest,extractInboundArchive,exportPackage,importPackage,stageBackupImport,pendingBackupImportIdentity,readPendingBackupImport,recoverResponseStaging,listResponseStagingRecovery,stageResponseFile,readStagedResponseFile,removeStagedResponseFile,storageHealth,metaGet,metaPut,clearLegacy,createProject});
})();
;(()=>{
'use strict';
const CLOSED_LOOP_V3_STORE_MIGRATION_EXPORT=true;
const store=globalThis.closedLoopProjectStore;
const schema=globalThis.closedLoopWorkflowSchema;
if(store&&schema&&typeof schema.migrateProjectToCurrent==='function'&&typeof store.migrateProjectToCurrent!=='function')globalThis.closedLoopProjectStore=Object.freeze({...store,migrateProjectToCurrent:project=>schema.migrateProjectToCurrent(project)});
})();
