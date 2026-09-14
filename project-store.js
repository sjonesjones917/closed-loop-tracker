(()=>{
'use strict';

// The same store owns transactions in either execution context. The worker
// imports the existing authorities; it does not implement another data model.
const STORE_SCRIPT_URL=typeof document!=='undefined'?document.currentScript?.src:null;
const STORE_WORKER=typeof document==='undefined'&&typeof importScripts==='function'&&new URLSearchParams(globalThis.location?.search||'').get('storeWorker')==='1';
const STORE_BUILD_ID=(STORE_SCRIPT_URL?new URL(STORE_SCRIPT_URL).searchParams.get('v'):STORE_WORKER?new URLSearchParams(globalThis.location.search).get('v'):null)||'UNMANIFESTED_LOCAL_RUNTIME';
if(STORE_WORKER){const query=globalThis.location.search;importScripts(...['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'].map(file=>file+query));}

const DB_NAME='closed-loop-reliability';
const DB_VERSION=2;
const PROJECTS='projects';
const ARTIFACTS='artifacts';
const META='meta';
const LEGACY_KEYS=Object.freeze(['closed-loop-reliability-projects-v4','closed-loop-reliability-projects-v3','closed-loop-reliability-projects-v2','closed-loop-reliability-projects']);
const STORE_KEY=LEGACY_KEYS[0];
const hash=globalThis.closedLoopHash;
const clone=value=>value===undefined?undefined:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const projectIdentity=project=>String(project?.job?.JOB_ID||project?.jobId||'').trim();
const projectPickerKey=(project,revision=project?.revision,jobId=projectIdentity(project))=>[jobId,JSON.stringify({title:String(project?.job?.JOB_TITLE||''),revision:Number(revision||0),isRetainedTestProject:Boolean(project?.isRetainedTestProject),retainedSpecRevision:project?.retainedSpecRevision||null,activeView:project?.activeView,activeStage:project?.activeStage})];
const projectPickerSummary=key=>{const data=JSON.parse(key[1]);return {_unloaded:true,job:{JOB_ID:key[0],JOB_TITLE:data.title},revision:data.revision,isRetainedTestProject:data.isRetainedTestProject,retainedSpecRevision:data.retainedSpecRevision,activeView:data.activeView,activeStage:data.activeStage};};
const now=()=>new Date().toISOString();
const fault=phase=>{const configured=globalThis.__closedLoopStorageFault;if(configured===phase||configured?.phase===phase){const error=new Error(`Injected storage failure at ${phase}.`);error.code='INJECTED_STORAGE_FAILURE';throw error;}};
const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB request failed.'));});
const complete=tx=>new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed.'));tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted.'));});
const canonicalProject=project=>{const copy={...project};delete copy.projectSha256;return copy;};
const projectSha256=project=>hash.sha256Value(canonicalProject(project));
const storageError=(message,code)=>Object.assign(new Error(message),{code});
let operationWorker=null;
const workerRequests=new Map();
function recordWorkerCommit(tx,operationId,project,digest){if(operationId)tx.objectStore(META).put({key:'storageOperation:'+operationId,value:{operationId,jobId:projectIdentity(project),revision:project.revision,projectSha256:digest},updatedAt:now()});}
async function clearWorkerCommit(operationId){try{const tx=await openTransaction(META,'readwrite');tx.objectStore(META).delete('storageOperation:'+operationId);await complete(tx);}catch{/* An unacknowledged minimal receipt remains recoverable. */}}
async function recoverWorkerOperation(pending,error){
  try{const receipt=await metaGet('storageOperation:'+pending.operationId);if(receipt){const project=await readProject(receipt.jobId);if(!project||Number(project.revision)<Number(receipt.revision))throw Object.assign(storageError('The operation committed, but its project is no longer available at that revision. Reload the current stored state.','COMMITTED_PROJECT_UNAVAILABLE'),{existingProjectsUnchanged:false});await clearWorkerCommit(pending.operationId);pending.resolve(project);return;}pending.reject(Object.assign(error,{existingProjectsUnchanged:true}));}
  catch(recoveryError){pending.reject(Object.assign(storageError(`The storage outcome could not be confirmed. Reload and verify the stored project before retrying: ${recoveryError.message||recoveryError}`,'STORAGE_OUTCOME_UNCONFIRMED'),{existingProjectsUnchanged:false}));}
}
function requestStoreWorker(method,args){
  if(!operationWorker){
    const url=new URL(STORE_SCRIPT_URL);url.searchParams.set('storeWorker','1');const worker=new Worker(url.href);operationWorker=worker;
    const lost=event=>{if(operationWorker!==worker)return;operationWorker=null;worker.terminate();const pending=[...workerRequests.values()];workerRequests.clear();for(const entry of pending)void recoverWorkerOperation(entry,storageError(event?.message||'Storage worker stopped before returning its result.','STORAGE_WORKER_STOPPED'));};
    worker.onerror=lost;worker.onmessageerror=lost;
    worker.onmessage=event=>{const message=event.data||{},pending=workerRequests.get(message.operationId);if(!pending)return;if(message.buildIdentity!==STORE_BUILD_ID){lost({message:'Storage worker build identity mismatch.'});return;}workerRequests.delete(message.operationId);if(message.ok){void clearWorkerCommit(message.operationId);pending.resolve(message.project);}else void recoverWorkerOperation(pending,Object.assign(new Error(message.error?.message||'Storage operation failed.'),message.error));};
  }
  const operationId=crypto.randomUUID();return new Promise((resolve,reject)=>{workerRequests.set(operationId,{operationId,resolve,reject});try{operationWorker.postMessage({operationId,method,args,buildIdentity:STORE_BUILD_ID,fault:globalThis.__closedLoopStorageFault||null});}catch(error){workerRequests.delete(operationId);reject(Object.assign(error,{existingProjectsUnchanged:true}));}});
}
const useStoreWorker=()=>Boolean(STORE_SCRIPT_URL&&typeof Worker==='function');
const runSynchronousMutator=(mutator,next,before)=>{const result=mutator(next,before);if(result&&typeof result.then==='function')throw storageError('Project transaction mutators must be synchronous. Complete asynchronous work before opening the canonical IndexedDB transaction.','ASYNC_TRANSACTION_MUTATOR');return result;};
const PLACEHOLDER_REFERENCES=new Set(['','NONE','NOT APPLICABLE','UNKNOWN','PENDING','UNASSIGNED']);
const equivalent=(left,right)=>left===undefined||right===undefined?left===right:hash.sha256Value(left)===hash.sha256Value(right);
function validateProjectIntegrity(project,{verifyDerived=true,verifyCachedProjection=true}={}){
  const issues=[],schemaApi=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine;
  if(!project||typeof project!=='object')return {valid:false,issues:['Project is not an object.']};
  if(!schemaApi||!engine)return {valid:false,issues:['Workflow schema and engine are required for canonical project integrity validation.']};
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
  else for(const [collection,definition] of Object.entries(schemaApi.RECORD_SCHEMAS))for(const record of Array.isArray(project.projectData?.[collection])?project.projectData[collection]:[]){const id=engine.recordId(record,collection)||'UNKNOWN',nested=record?.fields&&typeof record.fields==='object'&&!Array.isArray(record.fields)?record.fields:null;for(const [fieldName,fieldDefinition] of Object.entries(definition.fieldDefinitions||{})){const nestedPresent=Boolean(nested&&Object.prototype.hasOwnProperty.call(nested,fieldName)),topPresent=Object.prototype.hasOwnProperty.call(record||{},fieldName);if(!nestedPresent&&!topPresent)continue;if(nestedPresent&&topPresent&&!equivalent(nested[fieldName],record[fieldName]))issues.push(`${collection} record ${id} has contradictory mirrored value for ${fieldName}.`);const value=engine.recordValue(record,fieldName),fieldIssues=[];ingestion.validateValue(fieldDefinition,value,`/${collection}/${id}/${fieldName}`,fieldIssues);for(const item of fieldIssues)issues.push(`${collection} record ${id} field ${fieldName}: ${item.message}`);}}
  for(const [collection,definition] of Object.entries(schemaApi.RECORD_SCHEMAS))for(const record of Array.isArray(project.projectData?.[collection])?project.projectData[collection]:[])for(const [fieldName,targetCollection] of Object.entries(definition.relationships||{})){const raw=record?.relationships?.[fieldName]??engine.recordValue(record,fieldName);for(const value of Array.isArray(raw)?raw:[raw]){const ref=String(value??'').trim();if(PLACEHOLDER_REFERENCES.has(ref.toUpperCase()))continue;if(!idsByCollection.get(targetCollection)?.has(ref))issues.push(`${collection}.${fieldName} references missing ${targetCollection} record ${ref}.`);}}
  let previousSequence=0;const eventIds=new Set();for(const event of Array.isArray(project.projectData?.history)?project.projectData.history:[]){const sequence=Number(event?.eventSequence);if(!Number.isInteger(sequence)||sequence<=previousSequence)issues.push('History eventSequence is missing, duplicated, or non-monotonic.');previousSequence=Math.max(previousSequence,Number.isFinite(sequence)?sequence:0);const eventId=String(event?.eventId||'');if(eventId&&eventIds.has(eventId))issues.push(`History contains duplicate event ID ${eventId}.`);if(eventId)eventIds.add(eventId);}if(Number(project.projectData?.eventSequence||0)<previousSequence)issues.push('Project eventSequence is behind committed history.');
  if(verifyDerived){const expected=clone(project);delete expected.projectSha256;engine.ensureShape(expected);engine.recalculate(expected);if(verifyCachedProjection){for(const name of ['CURRENT_STAGE','CURRENT_STATE','CURRENT_BLOCKERS','NEXT_REQUIRED_ACTION','JOB_RECORD_STATUS','STATUS_EVIDENCE'])if(!equivalent(project.job?.[name],expected.job?.[name]))issues.push(`Application-derived job field ${name} does not match deterministic recalculation.`);for(let stage=1;stage<=Number(schemaApi.STAGE_COUNT);stage++){if(String(project.stages?.[stage]?.status||'')!==String(expected.stages?.[stage]?.status||''))issues.push(`Stage ${stage} status does not match deterministic recalculation.`);if(!equivalent(project.stages?.[stage]?.derivedData||{},expected.stages?.[stage]?.derivedData||{}))issues.push(`Stage ${stage} derivedData does not match deterministic recalculation.`);}}const releaseRecords=(project.projectData?.releaseRecords||[]).filter(record=>record?.active!==false&&!record?.invalidatedBy),latestRelease=releaseRecords.at(-1);if(latestRelease){const actual=String(engine.recordValue(latestRelease,'DETERMINATION')||''),calculated=String(engine.releaseMetrics(expected).determination||'');if(actual!==calculated)issues.push(`Current release determination ${actual||'UNKNOWN'} does not match deterministic release calculation ${calculated||'UNKNOWN'}.`);}}
  const artifacts=new Map((project.projectData?.artifacts||[]).map(record=>[engine.recordId(record,'artifacts'),record]));for(const identity of (project.projectData?.artifactIdentities||[]).filter(record=>record?.active!==false&&!record?.invalidatedBy)){const artifact=artifacts.get(String(engine.recordValue(identity,'ARTIFACT_ID')||''));const auditedHash=String(engine.recordValue(identity,'AUDITED_SHA256')||''),deliveryHash=String(engine.recordValue(identity,'PRE_DELIVERY_SHA256')||''),auditedSize=Number(engine.recordValue(identity,'AUDITED_BYTE_SIZE')),deliverySize=Number(engine.recordValue(identity,'RELEASE_BYTE_SIZE')),sameHash=Boolean(auditedHash&&deliveryHash&&auditedHash===deliveryHash),sameSize=Number.isFinite(auditedSize)&&Number.isFinite(deliverySize)&&auditedSize===deliverySize,sameName=String(engine.recordValue(identity,'AUDITED_FILENAME')||'')===String(engine.recordValue(identity,'RELEASE_FILENAME')||''),authorized=sameHash&&sameSize&&sameName;if(Boolean(engine.recordValue(identity,'EXACT_HASH_MATCH'))!==sameHash||Boolean(engine.recordValue(identity,'EXACT_SIZE_MATCH'))!==sameSize||String(engine.recordValue(identity,'AUTHORIZATION')||'')!==(authorized?'AUTHORIZED':'NOT AUTHORIZED'))issues.push(`Artifact identity ${engine.recordId(identity,'artifactIdentities')||'UNKNOWN'} contradicts its deterministic comparison.`);if(artifact){if(String(engine.recordValue(artifact,'SHA256')||'')!==auditedHash||Number(engine.recordValue(artifact,'BYTE_SIZE'))!==auditedSize||String(engine.recordValue(artifact,'FILENAME')||'')!==String(engine.recordValue(identity,'AUDITED_FILENAME')||''))issues.push(`Artifact identity ${engine.recordId(identity,'artifactIdentities')||'UNKNOWN'} does not match its canonical artifact.`);}}
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
  const opening=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);let blocked=false;
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(PROJECTS))db.createObjectStore(PROJECTS,{keyPath:'jobId'});if(!db.objectStoreNames.contains(ARTIFACTS))db.createObjectStore(ARTIFACTS,{keyPath:'artifactId'});if(!db.objectStoreNames.contains(META))db.createObjectStore(META,{keyPath:'key'});const artifacts=req.transaction.objectStore(ARTIFACTS);if(!artifacts.indexNames.contains('jobId'))artifacts.createIndex('jobId','jobId',{unique:false});const projects=req.transaction.objectStore(PROJECTS);if(!projects.indexNames.contains('picker')){projects.createIndex('picker','picker',{unique:true});const scan=projects.openCursor();scan.onsuccess=()=>{const cursor=scan.result;if(!cursor)return;const row=cursor.value;row.picker=projectPickerKey(row.project,row.revision,String(row.jobId));cursor.update(row);cursor.continue();};}};
    req.onsuccess=()=>{const db=req.result;if(blocked){db.close();resetDatabaseConnection();return;}databaseHandle=db;db.onclose=()=>resetDatabaseConnection(db);db.onversionchange=()=>{resetDatabaseConnection(db);try{db.close();}catch{}};resolve(db);};
    req.onerror=()=>{resetDatabaseConnection();reject(req.error||new Error('IndexedDB open failed.'));};
    // Keep the rejected promise until this pending request finishes. Another
    // open would queue behind it and could leave startup waiting indefinitely.
    req.onblocked=()=>{blocked=true;reject(Object.assign(new Error('IndexedDB upgrade is blocked by another tab.'),{code:'INDEXEDDB_BLOCKED'}));};
  });
  databasePromise=opening;
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

function parseLegacy(storage=globalThis.localStorage){const out=[],seen=new Set();if(!storage)return out;for(const key of LEGACY_KEYS){let raw=null;try{raw=storage.getItem(key);}catch(error){throw storageError(`Legacy project storage could not be read from ${key}: ${error.message||error}`,'LEGACY_MIGRATION_READ_FAILED');}if(!raw)continue;let parsed;try{parsed=JSON.parse(raw);}catch(error){throw storageError(`Legacy project storage ${key} contains malformed JSON: ${error.message||error}`,'LEGACY_MIGRATION_PARSE_FAILED');}const items=Array.isArray(parsed)?parsed:[parsed];for(let index=0;index<items.length;index++){const item=items[index];if(!item||typeof item!=='object'||Array.isArray(item))throw storageError(`Legacy project storage ${key}[${index}] is not a project object.`,'LEGACY_MIGRATION_INVALID_PROJECT');const id=projectIdentity(item);if(!id)throw storageError(`Legacy project storage ${key}[${index}] has no JOB_ID.`,'LEGACY_MIGRATION_INVALID_PROJECT');if(seen.has(id))continue;seen.add(id);out.push(item);}}return out;}
function readAllLegacy(storage){return parseLegacy(storage);}
function writeAllLegacy(projects,storage){if(!storage)throw new Error('Legacy test storage is unavailable.');const payload=JSON.stringify(projects),prior=storage.getItem(STORE_KEY);try{fault('before-final-write');storage.setItem(STORE_KEY,payload);fault('after-final-write');return {changed:prior!==payload};}catch(error){try{if(prior===null)storage.removeItem(STORE_KEY);else storage.setItem(STORE_KEY,prior);}catch{}throw error;}}

async function metaPut(key,value,tx=null){const own=tx||await openTransaction(META,'readwrite');own.objectStore(META).put({key,value,updatedAt:now()});if(!tx)await complete(own);return value;}
async function metaGet(key){const tx=await openTransaction(META,'readonly');const row=await request(tx.objectStore(META).get(key));await complete(tx);return row?.value;}
// Operational response work is owned by META and bound to one canonical row.
// Its closed patch contains no accepted-work authority. Canonical commits fold
// the resulting audit records into their complete snapshot and retire the patch.
const operationalKey=jobId=>'responseOperations:'+String(jobId);
const OPERATIONAL_COLLECTIONS=new Set(['rawResponses','generatedOutputs','responseValidations','responseProposals','outputReceipts','responseDispositions','rejectedResponses','idCounters','eventSequence','history','allocationReceipts']);
const OPERATIONAL_JOB_FIELDS=new Set(['CURRENT_STAGE','CURRENT_STATE','CURRENT_BLOCKERS','NEXT_REQUIRED_ACTION','JOB_RECORD_STATUS','STATUS_EVIDENCE']);
const OPERATIONAL_STAGE_FIELDS=new Set(['gate','status','derivedData','responseDraft']);
function operationalPatches(before,after,path=[]){
  if(equivalent(before,after))return [];
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
async function writeOperationalProject(project,options={}){
  const id=projectIdentity(project),prior=await readProject(id);if(!prior)throw storageError('Project is unavailable.','PROJECT_NOT_FOUND');
  if(Number(options.expectedProjectRevision)!==Number(prior.revision)||!options.expectedStateSha256||options.expectedStateSha256!==prior.projectSha256)throw storageError('Project or pending response changed. Refresh it before retrying.','STALE_PROJECT_REVISION');
  const next=clone(project);delete next.projectSha256;
  if(Number(next.revision)!==Number(prior.revision))throw storageError('An operational event cannot advance the canonical revision.','OPERATIONAL_OWNERSHIP_VIOLATION');
  if(projectSha256(next)===prior.projectSha256)return prior;
  globalThis.closedLoopWorkflowEngine.recalculate(next);assertOperationalChange(prior,next);assertProjectIntegrity(next);
  const digest=projectSha256(next);if(digest===prior.projectSha256)return prior;
  const prepared=await prepareHistoryCommit(next,prior,{label:options.historyLabel||'Response work saved',view:options.historyView});
  fault('before-project-transaction');const tx=await openTransaction([PROJECTS,META],'readwrite');
  try{
    const meta=tx.objectStore(META),base=await request(tx.objectStore(PROJECTS).get(id)),current=await projectRowWithOperations(tx,id);
    if(current?.projectSha256!==prior.projectSha256)throw storageError('Another session changed the pending response.','STALE_PROJECT_REVISION');
    globalThis.closedLoopWorkflowEngine.validateAllocationReceipts(next,current?.project);
    const existing=(await request(meta.get(operationalKey(id))))?.value,body={schema:'closed-loop-response-operations/1',jobId:id,baseProjectSha256:base.projectSha256,projectRevision:Number(base.revision),sequence:Number(existing?.sequence||0)+1,patches:assertOperationalChange(base.project,next),projectSha256:digest};
    await commitHistory(tx,prepared);meta.put({key:operationalKey(id),value:{...body,sha256:hash.sha256Value(body)},updatedAt:now()});fault('during-operational-write');recordWorkerCommit(tx,options.operationId,next,digest);fault('before-transaction-commit');await complete(tx);notifyProjectChange(next,{operational:true});return {...next,projectSha256:digest};
  }catch(error){try{tx.abort();}catch{}throw error;}
}
async function quarantine(row,reason,{operationalSha256}={}){
 const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite'),projects=tx.objectStore(PROJECTS),meta=tx.objectStore(META);
 try{const current=await request(projects.get(String(row?.jobId||''))),journal=await request(meta.get(operationalKey(row?.jobId)));
  if(!current||String(current.projectSha256||'')!==String(row?.projectSha256||'')||operationalSha256!==undefined&&journal?.value?.sha256!==operationalSha256){await complete(tx);return false;}
  const artifacts=await request(tx.objectStore(ARTIFACTS).index('jobId').getAll(String(row.jobId))),key=`quarantine:${row?.jobId||'UNKNOWN'}:${crypto.randomUUID()}`,capturedAt=now(),catalog=clone((await request(meta.get('quarantineCatalog')))?.value||{});
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
async function exportQuarantinedProject(key,{passphrase=null}={}){
  if(!String(key).startsWith('quarantine:'))throw storageError('Select preserved recovery evidence.','QUARANTINE_NOT_FOUND');const saved=await metaGet(key);if(!saved)throw storageError('The preserved recovery evidence is unavailable.','QUARANTINE_NOT_FOUND');
  if(!passphrase)throw storageError('Enter a backup password to protect the preserved recovery evidence.','BACKUP_PASSPHRASE_REQUIRED');
  const {graph,files}=await quarantineEvidenceGraph(saved),raw=new Blob([JSON.stringify(graph)],{type:'application/json'});files.unshift({path:'raw-project.json',blob:raw,byteSize:raw.size,sha256:await hash.sha256Bytes(raw)});
  const packageManifest={schema:'closed-loop-quarantine-manifest/1',quarantineKey:key,completeSnapshot:Array.isArray(saved.artifacts),activationPermitted:false,members:files.map(({blob,...identity})=>identity)},fileContents=new WeakMap(),members=files.map(file=>{const entry={path:file.path,base64:''};fileContents.set(entry,{property:'base64',encoding:'base64',blob:file.blob});return entry;}),packed=await compressPackage({schema:'closed-loop-quarantine-package/1',packageManifest,artifacts:members},fileContents);
  return encryptedPackage(packed.blob,hash.sha256Value(packageManifest),passphrase);
}
async function removeQuarantinedProject(key,{idempotencyKey=key}={}){
  if(!String(key).startsWith('quarantine:'))throw storageError('Select preserved recovery evidence.','QUARANTINE_NOT_FOUND');const receiptKey='quarantineDelete:'+hash.sha256Value({idempotencyKey:String(idempotencyKey)}),payloadSha256=hash.sha256Value({key}),tx=await openTransaction(META,'readwrite'),meta=tx.objectStore(META);
  try{const receipt=(await request(meta.get(receiptKey)))?.value;if(receipt){if(receipt.payloadSha256!==payloadSha256)throw storageError('This deletion was already used for different recovery evidence.','COMMAND_RETRY_CONFLICT');await complete(tx);return receipt;}
    const existing=await request(meta.get(key)),catalog=clone((await request(meta.get('quarantineCatalog')))?.value||{});if(!existing)throw storageError('The preserved recovery evidence is unavailable.','QUARANTINE_NOT_FOUND');delete catalog[key];const result={quarantineKey:key,payloadSha256,removed:true,at:now()};fault('during-quarantine-delete');meta.delete(key);meta.put({key:'quarantineCatalog',value:catalog,updatedAt:now()});meta.put({key:receiptKey,value:result,updatedAt:now()});await complete(tx);return result;
  }catch(error){try{tx.abort();}catch{}throw error;}
}

async function migrateLegacy(){
  const countTx=await openTransaction(PROJECTS,'readonly'),count=await request(countTx.objectStore(PROJECTS).count());await complete(countTx);if(count)return {migrated:0};
  const legacy=parseLegacy();if(!legacy.length){await metaPut('migrationStatus',{status:'NONE',at:now()});return {migrated:0};}
  const tx=await openTransaction([PROJECTS,META],'readwrite');let migrated=0;
  try{fault('before-legacy-migration');const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine;if(!core?.migrateState||!engine)throw storageError('Canonical workflow migration logic is unavailable.','LEGACY_MIGRATION_UNAVAILABLE');for(const source of legacy){const project=core.migrateState(clone(source));engine.ensureShape(project);engine.recalculate(project);assertProjectIntegrity(project,{verifyDerived:true});const id=projectIdentity(project);if(!id)throw storageError('Migrated legacy project has no JOB_ID.','LEGACY_MIGRATION_INVALID_PROJECT');const revision=Number(project.revision||0);tx.objectStore(PROJECTS).put({jobId:id,revision,picker:projectPickerKey(project,revision),project,projectSha256:projectSha256(project),updatedAt:now()});migrated++;}tx.objectStore(META).put({key:'migrationStatus',value:{status:'COMPLETE',migrated,at:now()},updatedAt:now()});fault('during-legacy-migration');await complete(tx);for(const key of LEGACY_KEYS)try{localStorage.removeItem(key);}catch{}return {migrated};}catch(error){try{tx.abort();}catch{}await metaPut('migrationStatus',{status:'FAILED',message:String(error.message||error),originalPreserved:true,at:now()});throw error;}
}

async function readAllIndexed(){
  try{await migrateLegacy();globalThis.closedLoopLegacyMigrationError=null;}catch(error){globalThis.closedLoopLegacyMigrationError=String(error?.stack||error);console.error('Legacy migration failed without deleting its original payload.',error);}
  const summaries=await listProjectSummaries(),valid=[];for(const summary of summaries){try{const project=await readProject(projectIdentity(summary));if(project)valid.push(project);}catch(error){if(!['PROJECT_HASH_MISMATCH','PROJECT_REVISION_MISMATCH','PROJECT_INTEGRITY_FAILED','OPERATIONAL_STATE_INTEGRITY_FAILED'].includes(error.code))throw error;}}return valid;
}
async function listProjectSummaries(){
  const tx=await openTransaction(PROJECTS,'readonly'),finished=complete(tx),summaries=[];
  await new Promise((resolve,reject)=>{const req=tx.objectStore(PROJECTS).index('picker').openKeyCursor();req.onerror=()=>reject(req.error||new Error('Project picker could not be read.'));req.onsuccess=()=>{const cursor=req.result;if(!cursor){resolve();return;}summaries.push(projectPickerSummary(cursor.key));cursor.continue();};});
  await finished;return summaries;
}
async function readProject(jobId){
  const tx=await openTransaction([PROJECTS,META],'readonly'),row=await request(tx.objectStore(PROJECTS).get(String(jobId))),journal=await request(tx.objectStore(META).get(operationalKey(jobId)));await complete(tx);
  if(!row)return null;
  let computed;try{computed=await hash.sha256Chunks(hash.canonicalChunks(canonicalProject(row.project)));}catch(error){await quarantine(row,'PROJECT_ENCODING_INVALID: '+error.message);throw storageError('The stored project contains invalid canonical data. Its original state was preserved in quarantine.','PROJECT_INTEGRITY_FAILED');}
  if(computed!==row.projectSha256){await quarantine(row,'PROJECT_HASH_MISMATCH');throw storageError('Project hash mismatch. The original row was preserved in quarantine.','PROJECT_HASH_MISMATCH');}
  if(Number(row.revision)!==Number(row.project?.revision)){await quarantine(row,'PROJECT_REVISION_MISMATCH');throw storageError('Stored revision does not match the canonical project. The original row was preserved in quarantine.','PROJECT_REVISION_MISMATCH');}
  try{assertProjectIntegrity(row.project,{verifyDerived:false});}catch(error){await quarantine(row,'PROJECT_CANONICAL_INTEGRITY_FAILED: '+error.message);throw storageError('The stored project failed canonical integrity validation. Its original state was preserved in quarantine.','PROJECT_INTEGRITY_FAILED');}
  let active;try{active=applyOperationalJournal(row,journal?.value);assertProjectIntegrity(active.project,{verifyDerived:false});}catch(error){if(!journal?.value)throw error;await quarantine(row,'OPERATIONAL_STATE_INTEGRITY_FAILED: '+error.message,{operationalSha256:journal.value.sha256});throw storageError('Saved response operations failed integrity verification. Their exact state was preserved in quarantine.','OPERATIONAL_STATE_INTEGRITY_FAILED');}active.project.revision=Number(active.revision||0);active.project.projectSha256=active.projectSha256;return active.project;
}
function readAll(storage){return storage?readAllLegacy(storage):readAllIndexed();}

// Full immutable checkpoints share the existing IndexedDB transaction owner.
// Files are content-addressed here only for recovery; agent exports never read
// these keys. Reaching a bound fails before the dependent canonical commit.
const HISTORY_SCHEMA='closed-loop-recovery/1';
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
async function assertRecoveryTransfer(project){
  const state=await metaGet(historyKey(projectIdentity(project))),engine=globalThis.closedLoopWorkflowEngine,checked=engine.deliveryTransferPrecondition(project),intentId=engine.recordId(checked.intentRecord,'humanDecisions');
  const consumed=Object.values(state?.transfers||{}).filter(transfer=>(transfer.intentId===intentId||transfer.deliveryId===checked.deliveryId)&&transfer.result!=='FAILED');
  if(checked.scope.permittedTransferCount>0&&consumed.length>=checked.scope.permittedTransferCount)throw storageError('This authorization already has a completed or uncertain transfer in retained History. Restore that version to inspect its outcome. Restoration does not undo an external transfer.','RETAINED_TRANSFER_LIMIT_REACHED');
  return checked;
}
function validateRecoveryManifest(state){
  if(!Array.isArray(state.entries)||!state.files||typeof state.files!=='object')throw storageError('Recovery manifest is incomplete.','HISTORY_VERSION_MISMATCH');
  const byId=new Map(state.entries.map(entry=>[entry.id,entry]));if(byId.size!==state.entries.length||!byId.has(state.activeId))throw storageError('Recovery version identities are inconsistent.','HISTORY_VERSION_MISMATCH');
  for(const entry of state.entries){const seen=new Set();let current=entry;while(current){if(seen.has(current.id))throw storageError('Recovery history contains a cycle.','HISTORY_VERSION_MISMATCH');seen.add(current.id);if(current.parentId&&!byId.has(current.parentId))throw storageError('Recovery history is missing a parent.','HISTORY_VERSION_MISMATCH');current=byId.get(current.parentId);}}
  const snapshotBytes=state.entries.reduce((n,entry)=>n+Number(entry.byteSize),0),fileBytes=Object.values(state.files).reduce((n,file)=>n+Number(file.byteSize),0);
  if(!Number.isSafeInteger(snapshotBytes)||!Number.isSafeInteger(fileBytes)||snapshotBytes<0||fileBytes<0||snapshotBytes!==state.compressedProjectBytes||fileBytes!==state.retainedFileBytes)throw storageError('Recovery storage accounting does not match its retained contents.','HISTORY_VERSION_MISMATCH');
}
function assertHistoryLimits(state){
  if(state.entries.length>HISTORY_LIMITS.maxCheckpoints||state.compressedProjectBytes>HISTORY_LIMITS.maxCompressedProjectBytes||state.retainedFileBytes>HISTORY_LIMITS.maxRetainedFileBytes)throw storageError('History storage limit reached. The current project and every retained version are preserved. Export a complete backup before continuing in a new project.','HISTORY_LIMIT_REACHED');
}
function historyArtifactsSha256(rows){return hash.sha256Value(rows.map(historyDescriptor).sort((a,b)=>hash.compareUnicodeScalarSequence(a.artifactId,b.artifactId)));}
function historyWorkSha256(project){const work={...project};for(const key of ['projectSha256','projectHash','revision','historyActivationId','restoredCandidates','activeView','activeStage'])delete work[key];return hash.sha256Value(work);}
function historyUndoId(state){const byId=new Map(state.entries.map(entry=>[entry.id,entry])),active=byId.get(state.activeId);if(!active)return null;const same=active.workSha256||active.projectSha256;let prior=byId.get(active.parentId);while(prior&&(prior.workSha256||prior.projectSha256)===same)prior=byId.get(prior.parentId);return prior?.id||null;}
function assertRecoveryViewFiles(jobId,view,artifacts){
 const byId=new Map(artifacts.map(row=>[row.artifactId,row]));
 for(const selection of Object.values(view?.fileSelections||{})){
  if(selection.jobId!==String(jobId)||!globalThis.closedLoopWorkflowSchema.STAGE_CONTRACTS[selection.stage]||!Array.isArray(selection.files))throw storageError('Saved file selections belong to an incompatible project view.','HISTORY_VERSION_MISMATCH');
  for(const file of selection.files){const row=byId.get(file.artifactId);if(!row||row.lineage?.role!=='FILE_SELECTION_RECOVERY'||row.lineage?.selectionKind!==selection.kind||Number(row.lineage?.stage)!==Number(selection.stage)||row.filename!==file.filename||row.mediaType!==file.mediaType||row.byteSize!==file.byteSize||row.sha256!==file.sha256)throw storageError('A saved file selection is missing or incompatible.','HISTORY_FILE_INTEGRITY_FAILED');}
 }
}
async function readHistoryView(jobId,checkpointId=null){const state=await historyList(jobId),id=checkpointId||state.activeId;if(!id)return null;const saved=await decodeCheckpoint(jobId,await metaGet(snapshotKey(jobId,id)));return clone(id===state.activeId&&state.activeViewOverride?state.activeViewOverride:saved.view);}
async function encodeCheckpoint(project,artifactRows,{id=crypto.randomUUID(),parentId=null,label='Saved project',view=historyView(project),workSha256=historyWorkSha256(project),projectDigest=projectSha256(project),artifactManifestSha256=historyArtifactsSha256(artifactRows)}={}){
  const jobId=projectIdentity(project),canonical=canonicalProject(project),artifacts=artifactRows.map(historyDescriptor);
  assertProjectIntegrity(canonical,{verifyDerived:false});assertPackageArtifactCustody(canonical,artifactRows);assertRecoveryViewFiles(jobId,view,artifactRows);if(view?.pendingMutation&&view.pendingMutation.baseProjectSha256!==projectDigest)throw storageError('The draft correction belongs to another project version.','HISTORY_VERSION_MISMATCH');
  const body={schema:HISTORY_SCHEMA,id,jobId,parentId,label,workSha256,artifactManifestSha256,createdAt:now(),project:canonical,projectSha256:projectDigest,artifacts,view:clone(view)};
  fault('before-history-checkpoint');const encoded=await compressPackage(body);
  const sha256=await hash.sha256Bytes(encoded.blob);
  return {id,parentId,label,workSha256,viewSha256:hash.sha256Value(body.view),artifactManifestSha256:body.artifactManifestSha256,createdAt:body.createdAt,stage:Number(view.activeStage||project.activeStage||1),projectSha256:body.projectSha256,sha256,byteSize:encoded.blob.size,blob:encoded.blob};
}
async function prepareHistoryCommit(next,prior,{label=null,view=null,sessionId=null,baseState=null,artifactRows=null}={}){
  // These private objects remain unchanged throughout this preparation. Reuse
  // only digests computed here, never a project-supplied stored hash.
  const digests=new WeakMap(),digest=project=>{if(!digests.has(project))digests.set(project,projectSha256(project));return digests.get(project);};
  const jobId=projectIdentity(next),existing=baseState||await metaGet(historyKey(jobId));
  const state=clone(existing||{schema:HISTORY_SCHEMA,jobId,generation:0,activeId:null,activeProjectSha256:null,entries:[],sessions:{},files:{},compressedProjectBytes:0,retainedFileBytes:0,redo:[]});
  const retainedRedo=clone(state.redo||[]),viewOnly=prior&&digest(next)===digest(prior);
  const expectedGeneration=Number(state.generation||0),files=artifactRows||await listArtifacts(jobId),newFiles=[],snapshots=[];
  for(const row of files){
    if(!(row.blob instanceof Blob)||row.blob.size!==Number(row.byteSize)||await hash.sha256Bytes(row.blob)!==row.sha256)throw storageError(`Cannot preserve history: stored file ${row.filename} is missing or corrupt.`,'HISTORY_FILE_INTEGRITY_FAILED');
    if(!state.files[row.sha256]){newFiles.push({sha256:row.sha256,blob:row.blob});state.files[row.sha256]={byteSize:row.blob.size};state.retainedFileBytes+=row.blob.size;}
  }
  async function append(project,entryLabel,entryView){
    const priorWork=state.activeProjectSha256===digest(project)?state.entries.find(entry=>entry.id===state.activeId)?.workSha256:null;
    const snapshot=await encodeCheckpoint(project,files,{parentId:state.activeId,label:entryLabel,view:entryView||historyView(project),projectDigest:digest(project),workSha256:priorWork||historyWorkSha256(project)});
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
async function saveCheckpoint(jobId,{expectedProjectRevision,view=null,label='Saved view',sessionId=null}={}){
  const project=await readProject(jobId);if(!project)throw storageError('The project is unavailable.','HISTORY_PROJECT_MISSING');
  if(expectedProjectRevision!==undefined&&Number(project.revision)!==Number(expectedProjectRevision))throw storageError('Project changed before its view could be saved.','STALE_PROJECT_REVISION');
  const prepared=await prepareHistoryCommit(project,project,{label,view,sessionId}),tx=await openTransaction([PROJECTS,META],'readwrite');
  try{const row=await projectRowWithOperations(tx,jobId);if(row?.projectSha256!==project.projectSha256)throw storageError('Project changed before its checkpoint could be saved.','STALE_PROJECT_REVISION');await commitHistory(tx,prepared);await complete(tx);return prepared.state.activeId;}catch(error){try{tx.abort();}catch{}throw error;}
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
function assertRecoveryCompatibility(project){
  const engine=globalThis.closedLoopWorkflowEngine,checked=clone(project);
  for(const stage of Object.values(checked.stages||{}))if(stage.status==='COMPLETE'&&!engine.gate(Number(stage.number),checked).complete)throw storageError('The saved completion records do not belong to one compatible project version. The current version is preserved.','HISTORY_VERSION_INCOMPATIBLE');
}
async function decodeCheckpoint(jobId,entry,readFile=sha=>metaGet(historyFileKey(jobId,sha))){
  if(!entry?.blob||entry.blob.size!==Number(entry.byteSize)||await hash.sha256Bytes(entry.blob)!==entry.sha256)throw storageError('This saved version is missing or corrupt. The current project is preserved.','HISTORY_SNAPSHOT_INTEGRITY_FAILED');
  const {payload,fileContents}=await readPackageJson(entry.blob),{packageSha256,...body}=payload;
  if(await hash.sha256Chunks(packageJsonChunks(body,fileContents))!==packageSha256||body.schema!==HISTORY_SCHEMA||body.id!==entry.id||body.jobId!==String(jobId)||projectIdentity(body.project)!==String(jobId)||body.projectSha256!==projectSha256(body.project)||body.projectSha256!==entry.projectSha256||body.parentId!==entry.parentId||body.label!==entry.label||body.createdAt!==entry.createdAt||Number(body.view?.activeStage)!==Number(entry.stage))throw storageError('Saved project identity or contents do not match the checkpoint.','HISTORY_VERSION_MISMATCH');
  if(entry.viewSha256&&entry.viewSha256!==hash.sha256Value(body.view))throw storageError('Saved view identity does not match its checkpoint.','HISTORY_VERSION_MISMATCH');
  if(body.workSha256!==entry.workSha256||(body.workSha256&&body.workSha256!==historyWorkSha256(body.project)))throw storageError('Saved work identity does not match its complete project.','HISTORY_VERSION_MISMATCH');
  if(body.artifactManifestSha256!==entry.artifactManifestSha256||(body.artifactManifestSha256&&body.artifactManifestSha256!==historyArtifactsSha256(body.artifacts)))throw storageError('Saved file inventory does not match its checkpoint.','HISTORY_VERSION_MISMATCH');
  assertProjectIntegrity(body.project,{verifyDerived:false});assertRecoveryCompatibility(body.project);
  const artifacts=[],ids=new Set();
  for(const descriptor of body.artifacts){
    if(ids.has(descriptor.artifactId)||descriptor.jobId!==String(jobId))throw storageError('Saved file relationships do not belong to one complete project.','HISTORY_VERSION_MISMATCH');ids.add(descriptor.artifactId);
    const file=await readFile(descriptor.sha256);
    if(!(file?.blob instanceof Blob)||file.blob.size!==descriptor.byteSize||await hash.sha256Bytes(file.blob)!==descriptor.sha256)throw storageError(`Cannot restore ${descriptor.filename}: its saved bytes are missing or corrupt.`,'HISTORY_FILE_INTEGRITY_FAILED');
    artifacts.push({...descriptor,blob:file.blob});
  }
  assertPackageArtifactCustody(body.project,artifacts);assertRecoveryViewFiles(jobId,body.view,artifacts);if(body.view?.pendingMutation&&body.view.pendingMutation.baseProjectSha256!==body.projectSha256)throw storageError('Saved draft correction belongs to another version.','HISTORY_VERSION_MISMATCH');
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
  const entry=await metaGet(snapshotKey(jobId,checkpointId)),saved=await decodeCheckpoint(jobId,entry);
  if(signal?.aborted)throw storageError('A newer navigation replaced this restore.','RESTORE_INTERRUPTED');
  fault('before-history-restore');
  const next=clone(saved.project);next.revision=Math.max(priorRevision,Number(saved.project.revision))+1;next.historyActivationId=crypto.randomUUID();delete next.projectSha256;bindRestoredCandidates(next,saved.project,checkpointId,saved.view);
  // The projection belongs to the complete saved version. A current deployment
  // may reject it, but cannot silently rewrite it into a different version.
  assertProjectIntegrity(next,{verifyDerived:false});const digest=projectSha256(next),updated=clone(state);
  updated.activeId=checkpointId;updated.activeProjectSha256=digest;updated.activeRevision=next.revision;updated.activeViewOverride=rebaseHistoryView(next,saved.view);updated.title=String(next.job?.JOB_TITLE||'');updated.removed=false;updated.generation=Number(state.generation)+1;
  if(mode==='UNDO')updated.redo=[state.activeId,...state.redo.filter(id=>id!==state.activeId)];else if(mode==='REDO')updated.redo=state.redo.filter(id=>id!==checkpointId);else updated.redo=[];
  const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite');
  try{
    const projects=tx.objectStore(PROJECTS),files=tx.objectStore(ARTIFACTS),meta=tx.objectStore(META),current=await projectRowWithOperations(tx,jobId),currentHistory=await request(meta.get(historyKey(jobId)));
    if(current?.projectSha256!==prior?.projectSha256||Number(currentHistory?.value?.generation)!==Number(state.generation))throw storageError('Another tab changed this project during restoration. The newer work is preserved.','STALE_PROJECT_REVISION');
    const present=await request(files.index('jobId').getAll(String(jobId)));
    for(const row of saved.artifacts){const existing=await request(files.get(row.artifactId));if(existing&&existing.jobId!==String(jobId))throw storageError('A restored file identity belongs to another project.','CROSS_PROJECT_ARTIFACT_ID_COLLISION');}
    if(signal?.aborted)throw storageError('A newer navigation replaced this restore.','RESTORE_INTERRUPTED');
    for(const row of present)files.delete(row.artifactId);for(const row of saved.artifacts){files.put(row);const staged=row.lineage?.stagedResponse;if(staged)meta.put({key:`responseStaging:${jobId}:${staged.stagingId}`,value:{...staged,blob:row.blob},updatedAt:now()});}
    fault('during-history-restore');meta.delete(operationalKey(jobId));projects.put({jobId:String(jobId),revision:next.revision,picker:projectPickerKey(next),project:next,projectSha256:digest,updatedAt:now()});
    meta.put({key:historyKey(jobId),value:updated,updatedAt:now()});await updateRecoveryCatalog(meta,updated);meta.put({key:'selectedProject',value:String(jobId),updatedAt:now()});meta.put({key:'lastCommittedRevision',value:{jobId:String(jobId),revision:next.revision,projectSha256:digest},updatedAt:now()});recordWorkerCommit(tx,operationId,next,digest);fault('before-history-restore-commit');await complete(tx);
    next.projectSha256=digest;notifyProjectChange(next,{restored:true});return {project:next,view:updated.activeViewOverride,checkpointId};
  }catch(error){try{tx.abort();}catch{}throw error;}
}

async function persistProjectPromptFiles(project){await persistPromptContextRecords((project.projectData?.generatedPrompts||[]).filter(record=>!record.invalidatedBy&&record.promptEngineVersion===globalThis.closedLoopPromptEngine?.version),project);}
async function writeProjectRow(project,tx,{expectedProjectRevision=null,incrementRevision=true,createOnly=false,skipUnchanged=false,selectProject=true,operationId=null,preparedHistory=null,expectedStateSha256=null,projectAllocation=null}={}){
  const id=projectIdentity(project);if(!id)throw new Error('A project without a JOB_ID cannot be committed.');
  const store=tx.objectStore(PROJECTS),prior=await projectRowWithOperations(tx,id),currentRevision=Number(prior?.revision||0);
  if(createOnly&&prior)throw storageError(`Project ${id} already exists and was not replaced.`,'PROJECT_ALREADY_EXISTS');
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
  assertProjectIntegrity(next);globalThis.closedLoopWorkflowEngine.validateAllocationReceipts(next,prior?.project);
  const digest=projectSha256(next);if(!preparedHistory||preparedHistory.state.activeProjectSha256!==digest)throw storageError('The required checkpoint was not prepared for this exact change.','HISTORY_CHECKPOINT_REQUIRED');await commitHistory(tx,preparedHistory);fault('during-project-write');tx.objectStore(META).delete(operationalKey(id));store.put({jobId:id,revision:next.revision,picker:projectPickerKey(next),project:next,projectSha256:digest,updatedAt:now()});
  if(selectProject)tx.objectStore(META).put({key:'selectedProject',value:id,updatedAt:now()});tx.objectStore(META).put({key:'lastCommittedRevision',value:{jobId:id,revision:next.revision,projectSha256:digest},updatedAt:now()});
  recordWorkerCommit(tx,operationId,next,digest);
  return {...next,projectSha256:digest};
}
function notifyProjectChange(project,details={}){try{const channel=new BroadcastChannel('closed-loop-reliability');channel.postMessage({type:'PROJECT_CHANGED',jobId:projectIdentity(project),revision:project.revision,...details});channel.close();}catch{}}
function mutationImpact(prior,next,derivedNext=null){
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
    for(const [number,before] of Object.entries(prior.stages||{})){
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
  const id=projectIdentity(project),prior=await readProject(id),revision=Number(prior?.revision||0),next=clone(project);delete next.projectSha256;
  if(options.expectedProjectRevision!==undefined&&options.expectedProjectRevision!==null&&Number(options.expectedProjectRevision)!==revision)throw storageError('Project changed before its checkpoint could be prepared.','STALE_PROJECT_REVISION');
  if(options.createOnly&&prior)throw storageError('This project already exists.','PROJECT_ALREADY_EXISTS');
  if(options.expectedStateSha256&&options.expectedStateSha256!==prior?.projectSha256)throw storageError('Project or pending response changed before preparation.','STALE_PROJECT_REVISION');
  if(options.skipUnchanged&&prior?.projectSha256===projectSha256(next)){await persistProjectPromptFiles(next);const preparedHistory=await prepareHistoryCommit(next,prior,{label:options.historyLabel,view:options.historyView});return {project:next,options:{...options,expectedProjectRevision:revision,expectedStateSha256:prior.projectSha256,preparedHistory}};}
  next.revision=(options.incrementRevision??true)?revision+1:revision;
  const engine=globalThis.closedLoopWorkflowEngine;engine.ensureShape(next);
  engine.reconcileReservationRevisions(next);
  engine.recalculate(next);assertMutationConfirmation(prior,project,options.mutationConfirmation,next);assertProjectIntegrity(next);
  await persistProjectPromptFiles(next);
  const preparedHistory=await prepareHistoryCommit(next,prior,{label:options.historyLabel,view:options.historyView});
  return {project:next,options:{...options,expectedProjectRevision:revision,expectedStateSha256:prior?.projectSha256||null,preparedHistory}};
}
async function writeProject(project,options={}){
  options={skipUnchanged:true,...options};
  if(useStoreWorker())return requestStoreWorker('WRITE_PROJECT',[project,options]);
  if(options.operational)return writeOperationalProject(project,options);
  if(!projectIdentity(project))throw new Error('A project without a JOB_ID cannot be committed.');
  const prepared=await prepareProjectWrite(project,options);fault('before-project-transaction');const tx=await openTransaction([PROJECTS,META],'readwrite');
  try{const next=await writeProjectRow(prepared.project,tx,prepared.options);fault('before-transaction-commit');await complete(tx);notifyProjectChange(next);return next;}catch(error){try{tx.abort();}catch{}throw error;}
}

async function createProject({commandId=crypto.randomUUID()}={}){
  const command=String(commandId||'');if(!command)throw storageError('A project creation command identity is required.','PROJECT_COMMAND_REQUIRED');
  const engine=globalThis.closedLoopWorkflowEngine,family=engine.INFRA_ID_FAMILIES['projects:JOB'];
  for(let attempt=0;attempt<8;attempt++){
    const prior=await metaGet('canonicalProjectAllocation')||{generation:0,sequence:0,receipts:[]};
    const existing=prior.receipts.find(row=>row.commandId===command);
    if(existing){const project=await readProject(existing.resultingId);if(project)return project;throw storageError('This creation already completed. Its project is available in History.','CREATED_PROJECT_RETAINED');}
    const allocationSequence=Number(prior.sequence)+1;
    if(!Number.isSafeInteger(allocationSequence))throw storageError('The project allocation sequence is exhausted.','ALLOCATION_SEQUENCE_INVALID');
    const retainedIds=new Set([...(await listProjectSummaries()).map(projectIdentity),...(await listRecoverableProjects()).map(row=>row.jobId)]);
    const known=new Map(prior.receipts.map(row=>[row.resultingId,row.inputTuple]));
    const allocation=hash.allocateCanonicalIdWithCollisionCheck({familyPrefix:family.prefix,familyNamespace:family.familyNamespace,jobNamespace:'closed-loop-global/project-metadata',commandId:command,targetSlot:'',parentId:'',allocationSequence},{exists:id=>known.get(id)||(retainedIds.has(id)?true:null)});
    const receipt={schema:'closed-loop-allocation-receipt/1',algorithmVersion:hash.idVersion,familyPrefix:family.prefix,familyNamespace:family.familyNamespace,jobNamespace:allocation.payload.jobNamespace,collection:'projects',commandId:command,targetSlot:'',parentId:'',inputTuple:allocation.payload,allocationSequence,collisionCounter:allocation.collisionCounter,collisionCheck:'CHECKED_AGAINST_ACTIVE_AND_RETAINED_PROJECT_IDENTITIES',resultingId:allocation.id,projectRevision:0,revisionMeaning:'ALLOCATION_INPUT',retryIdentity:hash.sha256Value({commandId:command,operation:'CREATE_PROJECT'}),payloadSha256:hash.sha256Value({operation:'CREATE_PROJECT'})};
    const project=globalThis.closedLoopCore.createBlankState(allocation.id);engine.ensureShape(project);project.projectData.allocationReceipts.push(receipt);project.job.DATE_OPENED=now();project.activeView='Project';engine.createNewJobReset(project);
    const state={generation:prior.generation+1,sequence:allocationSequence,receipts:[...prior.receipts,receipt]};
    try{return await writeProject(project,{expectedProjectRevision:0,incrementRevision:false,createOnly:true,projectAllocation:{expectedGeneration:prior.generation,state}});}
    catch(error){if(!['PROJECT_ALLOCATION_CONFLICT','PROJECT_ALREADY_EXISTS'].includes(error?.code))throw error;}
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
  const receipt=await metaGet(receiptKey);if(receipt){if(receipt.payloadSha256!==payloadSha256)throw storageError('The deletion retry has different consequences.','IDEMPOTENCY_PAYLOAD_CONFLICT');return receipt.result;}
  const observed=await readProject(jobId);if(!observed)return false;
  if(expected!==undefined&&Number(observed.revision)!==Number(expected))throw storageError('Project changed before deletion.','STALE_PROJECT_REVISION');
  const prepared=await prepareHistoryCommit(observed,observed,{label:'Before removal',view:options.historyView||null});prepared.state.removed=true;
  const deletionReceipt={jobId,commandId:String(options.commandId||'DELETE-'+idempotencyKey),idempotencyKey,payloadSha256,result:true,committedMetadataSequence:prepared.state.generation,retentionExpiry:new Date(Date.now()+30*24*60*60*1000).toISOString()};prepared.state.commandReceipts={...(prepared.state.commandReceipts||{}),[receiptKey]:deletionReceipt};
  const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite'),projects=tx.objectStore(PROJECTS),artifacts=tx.objectStore(ARTIFACTS),meta=tx.objectStore(META);
  try{
    const retry=await request(meta.get(receiptKey));if(retry){if(retry.value.payloadSha256!==payloadSha256)throw storageError('The deletion retry has different consequences.','IDEMPOTENCY_PAYLOAD_CONFLICT');await complete(tx);return retry.value.result;}
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
    fault('during-project-delete');await complete(tx);notifyProjectChange({job:{JOB_ID:jobId}},{type:'PROJECT_DELETED',replacementSelectedProjectId:replacementSelectedProjectId||null});return true;
  }catch(error){try{tx.abort();}catch{}throw error;}
}
function removeProject(projectsOrJobId,jobIdOrStorage,storage){if(Array.isArray(projectsOrJobId)&&storage){const next=clone(projectsOrJobId).filter(project=>projectIdentity(project)!==String(jobIdOrStorage||''));writeAllLegacy(next,storage);return next;}return removeProjectIndexed(projectsOrJobId,jobIdOrStorage||{});}

async function putArtifact({artifactId,jobId,blob,filename,mediaType,lineage={}}){
  if(!(blob instanceof Blob))throw new TypeError('Artifact bytes must be a Blob.');if(!artifactId||!jobId)throw new Error('artifactId and jobId are required.');
  fault('during-artifact-blob-write');const id=String(artifactId),owner=String(jobId),byteSize=blob.size,sha256=await hash.sha256Bytes(blob),tx=await openTransaction(ARTIFACTS,'readwrite'),store=tx.objectStore(ARTIFACTS);let prior=null;
  try{prior=await request(store.get(id));if(prior&&String(prior.jobId)!==owner)throw storageError(`Artifact identity ${id} already belongs to another project.`,'CROSS_PROJECT_ARTIFACT_ID_COLLISION');if(prior){if(String(prior.sha256)!==sha256||Number(prior.byteSize)!==byteSize)throw storageError(`Artifact identity ${id} cannot be reused for different bytes.`,'ARTIFACT_ID_REUSE');await complete(tx);}else{store.put({artifactId:id,jobId:owner,blob,filename:String(filename||id),mediaType:String(mediaType||blob.type||'application/octet-stream'),byteSize,sha256,lineage:clone(lineage),createdAt:now()});await complete(tx);}}catch(error){try{tx.abort();}catch{}throw error;}
  if(prior){const priorDigest=await hash.sha256Bytes(prior.blob);if(priorDigest!==String(prior.sha256)||priorDigest!==sha256||Number(prior.byteSize)!==byteSize)throw storageError(`Artifact identity ${id} cannot be reused because its stored bytes failed integrity verification.`,'ARTIFACT_ID_REUSE');return prior;}
  const verified=await getArtifact(id);if(!verified||String(verified.jobId)!==owner||verified.byteSize!==byteSize||await hash.sha256Bytes(verified.blob)!==sha256){const cleanupTx=await openTransaction(ARTIFACTS,'readwrite');const row=await request(cleanupTx.objectStore(ARTIFACTS).get(id));if(row&&String(row.jobId)===owner)cleanupTx.objectStore(ARTIFACTS).delete(id);await complete(cleanupTx);throw new Error('Artifact byte read-back verification failed; the unverified artifact was removed.');}return verified;
}
async function getArtifact(artifactId){const tx=await openTransaction(ARTIFACTS,'readonly'),row=await request(tx.objectStore(ARTIFACTS).get(String(artifactId)));await complete(tx);return row||null;}
async function deleteArtifact(artifactId,jobId){const id=String(artifactId),owner=String(jobId||''),tx=await openTransaction(ARTIFACTS,'readwrite'),store=tx.objectStore(ARTIFACTS);try{const row=await request(store.get(id));if(!row){await complete(tx);return false;}if(owner&&String(row.jobId)!==owner)throw storageError(`Artifact ${id} belongs to another project and was not deleted.`,'CROSS_PROJECT_ARTIFACT_DELETE');store.delete(id);await complete(tx);return true;}catch(error){try{tx.abort();}catch{}throw error;}}
async function listArtifacts(jobId){const tx=await openTransaction(ARTIFACTS,'readonly'),rows=await request(tx.objectStore(ARTIFACTS).index('jobId').getAll(String(jobId)));await complete(tx);return rows;}
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
async function compressBytes(bytes){if(typeof CompressionStream!=='function')throw Object.assign(new Error('CompressionStream is required for complete package export.'),{code:'COMPRESSION_STREAM_REQUIRED'});const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));return new Uint8Array(await new Response(stream).arrayBuffer());}
async function decompressBytes(bytes){if(typeof DecompressionStream!=='function')throw Object.assign(new Error('DecompressionStream is required for complete package import.'),{code:'DECOMPRESSION_STREAM_REQUIRED'});const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return new Uint8Array(await new Response(stream).arrayBuffer());}
// Package schemas have string-valued file members. Keep those members as Blob
// references during assembly and emit their exact JSON strings on demand. The
// canonical serializer remains the authority for every ordinary key and value.
async function* packageJsonChunks(value,fileContents){
  async function* fileString(source){
    yield '"';
    if(source.encoding==='base64'){
      // A multiple of three prevents padding between successive base64 chunks.
      for(let offset=0;offset<source.blob.size;offset+=49152)yield bytesToBase64(new Uint8Array(await source.blob.slice(offset,offset+49152).arrayBuffer()));
    }else{
      const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
      for(let offset=0;offset<source.blob.size;offset+=49152){const text=decoder.decode(await source.blob.slice(offset,offset+49152).arrayBuffer(),{stream:true});yield hash.stableStringify(text).slice(1,-1);}
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
      if(previous)await writer.write(previous);
      yield bytes;previous=bytes;
    }
    if(!previous||previous[previous.length-1]!==125)throw storageError('Package body did not end with its object boundary.','PACKAGE_BODY_INVALID');
    if(previous.length>1)await writer.write(previous.subarray(0,-1));
  }
  try{
    // Hash the unchanged canonical body, including its closing brace, while
    // compressing those same UTF-8 buffers under stream backpressure. Append
    // the digest as the last JSON member; it remains outside its own preimage.
    // Retain only one bounded body chunk to replace the final closing brace.
    const packageSha256=await hash.sha256Chunks(hashAndCompress());
    await writer.write(encoder.encode(`${Object.keys(body).length?',':''}"packageSha256":"${packageSha256}"}`));
    await writer.close();return {blob:await compressed,packageSha256};
  }catch(error){await writer.abort(error).catch(()=>{});await compressed.catch(()=>{});throw error;}
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
  return expected;
}
function assertPackageArtifactCustody(project,artifacts){
  const id=projectIdentity(project),byId=new Map(artifacts.map(row=>[String(row.artifactId),row]));
  for(const {artifactId,filename,byteSize,sha256} of requiredProjectArtifactBytes(project)){
    const row=byId.get(artifactId);
    if(!row||String(row.jobId)!==id||String(filename)!==String(row.filename)||Number(byteSize)!==Number(row.byteSize)||String(sha256)!==String(row.sha256))throw storageError(`Canonical artifact ${artifactId||'UNKNOWN'} does not reconcile with verified package bytes.`,'PACKAGE_ARTIFACT_CUSTODY_MISMATCH');
  }
}
async function readExportSnapshot(jobId){
  const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readonly'),finished=complete(tx);
  const [row,artifacts,recoveryRow]=await Promise.all([projectRowWithOperations(tx,jobId),request(tx.objectStore(ARTIFACTS).index('jobId').getAll(String(jobId))),request(tx.objectStore(META).get(historyKey(jobId)))]);await finished;
  if(!row)throw storageError('The project is unavailable for export.','PROJECT_NOT_FOUND');
  const digest=await hash.sha256Chunks(hash.canonicalChunks(canonicalProject(row.project)));
  if(digest!==row.projectSha256||Number(row.revision)!==Number(row.project.revision))throw storageError('Project identity failed export verification.','PROJECT_HASH_MISMATCH');
  assertProjectIntegrity(row.project,{verifyDerived:false});return {project:{...row.project,projectSha256:digest},artifacts,recovery:recoveryRow?.value||null};
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
  try{const material=await api.subtle.importKey('raw',encoded,'PBKDF2',false,['deriveKey']);return await api.subtle.deriveKey({name:'PBKDF2',salt,iterations:ENCRYPTED_EXPORT_PROFILE.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,[usage]);}finally{encoded.fill(0);}
}
async function encryptedPackage(blob,manifestSha256,passphrase){
  const api=encryptionCrypto(),salt=api.getRandomValues(new Uint8Array(16)),iv=api.getRandomValues(new Uint8Array(12)),key=await backupKey(passphrase,salt,'encrypt'),aad=encryptionBytes(manifestSha256,32);
  // Reserve the salt/IV pair before encryption. The ledger contains no key or
  // passphrase; repeated CSPRNG output fails before any ciphertext is returned.
  const tx=await openTransaction(META,'readwrite'),nonceKey='encryptedExportNonce:'+encryptionHex(salt)+':'+encryptionHex(iv);
  try{if(await request(tx.objectStore(META).get(nonceKey)))throw storageError('Secure backup randomness was repeated. Retry with a working cryptography provider.','BACKUP_NONCE_REUSE');fault('during-backup-protection');tx.objectStore(META).put({key:nonceKey,value:{profile:ENCRYPTED_EXPORT_PROFILE.schema,createdAt:now()}});await complete(tx);}catch(error){try{tx.abort();}catch{}throw error;}
  const bytes=new Uint8Array(await blob.arrayBuffer());let result;
  try{result=new Uint8Array(await api.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},key,bytes));}finally{bytes.fill(0);}
  const ciphertext=result.subarray(0,result.length-16),tag=result.subarray(result.length-16),container={...ENCRYPTED_EXPORT_PROFILE,salt:encryptionHex(salt),iv:encryptionHex(iv),manifestSha256,ciphertextLength:ciphertext.length,authenticationTag:encryptionHex(tag),ciphertext:bytesToBase64(ciphertext)};
  return new Blob([JSON.stringify(container)],{type:'application/vnd.closed-loop.encrypted+json'});
}
async function isEncryptedPackage(blob){return /^\s*\{\s*"schema"\s*:\s*"closed-loop-encrypted-export\/1"/.test(await blob.slice(0,160).text());}
async function decryptPackage(blob,passphrase){
  let container;try{container=JSON.parse(await blob.text());}catch{throw storageError('The encrypted backup is incomplete or invalid.','ENCRYPTED_PACKAGE_INVALID');}
  const expected=[...Object.keys(ENCRYPTED_EXPORT_PROFILE),'salt','iv','manifestSha256','ciphertextLength','authenticationTag','ciphertext'];
  if(Object.keys(container).length!==expected.length||Object.keys(container).some(key=>!expected.includes(key))||Object.entries(ENCRYPTED_EXPORT_PROFILE).some(([key,value])=>container[key]!==value))throw storageError('The encrypted backup uses unsupported or modified protection settings.','ENCRYPTED_PACKAGE_INVALID');
  if(typeof container.ciphertext!=='string'||container.ciphertext.length%4!==0||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(container.ciphertext))throw storageError('Encrypted backup ciphertext is invalid.','ENCRYPTED_PACKAGE_INVALID');
  const salt=encryptionBytes(container.salt,16),iv=encryptionBytes(container.iv,12),tag=encryptionBytes(container.authenticationTag,16),aad=encryptionBytes(container.manifestSha256,32),ciphertext=base64ToBytes(container.ciphertext);
  if(!Number.isSafeInteger(container.ciphertextLength)||ciphertext.length!==container.ciphertextLength)throw storageError('The encrypted backup has missing or modified bytes.','ENCRYPTED_PACKAGE_INVALID');
  const key=await backupKey(passphrase,salt,'decrypt'),combined=new Uint8Array(ciphertext.length+tag.length);combined.set(ciphertext);combined.set(tag,ciphertext.length);let plaintext;
  try{plaintext=await encryptionCrypto().subtle.decrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},key,combined);}catch{throw storageError('The backup password is incorrect or the encrypted file has changed. The existing project is unchanged.','BACKUP_AUTHENTICATION_FAILED');}
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
  if(recovery){
    for(const entry of recovery.entries){const saved=await metaGet(snapshotKey(jobId,entry.id));if(!saved?.blob||saved.sha256!==entry.sha256)throw storageError('A promised checkpoint is missing. Backup export did not complete.','HISTORY_VERSION_UNAVAILABLE');await member({artifactId:'RECOVERY-SNAPSHOT-'+entry.id,jobId,filename:entry.id+'.checkpoint.gz',mediaType:'application/gzip',archiveKind:'RECOVERY_SNAPSHOT',checkpointId:entry.id,byteSize:entry.byteSize,sha256:entry.sha256,blob:saved.blob});const {payload:checkpoint}=await readPackageJson(saved.blob);if(checkpoint.schema!==HISTORY_SCHEMA||checkpoint.id!==entry.id||checkpoint.jobId!==String(jobId)||checkpoint.projectSha256!==entry.projectSha256)throw storageError('A saved checkpoint does not match its recorded identity.','HISTORY_VERSION_MISMATCH');requiresEncryption=requiresEncryption||containsCredentialSecret(checkpoint);}
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
async function readPackageJson(blob){
  const fileContents=new WeakMap(),stack=[];let root,hasRoot=false,kind=null,atom='',raw='',pieces=[],spooled=false,escape=false,unicode=0,lastYield=Date.now();
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
    let start=kind==='string'?0:-1;
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
        if(!expectsValue())fail();const type=char==='{'?'object':'array',item=type==='object'?{}:[],artifact=type==='object'&&Boolean(parent?.artifactArray),artifactArray=type==='array'&&stack.length===1&&parent.type==='object'&&parent.key==='artifacts';
        value(item);stack.push({type,value:item,state:type==='object'?'keyOrEnd':'valueOrEnd',artifact,artifactArray});continue;
      }
      if(char==='}'||char===']'){
        if(!parent||parent.type!==(char==='}'?'object':'array')||!['keyOrEnd','valueOrEnd','commaOrEnd'].includes(parent.state))fail();stack.pop();continue;
      }
      if(char===','){if(parent?.state!=='commaOrEnd')fail();parent.state=parent.type==='object'?'key':'value';continue;}
      if(char===':'){if(parent?.type!=='object'||parent.state!=='colon')fail();parent.state='value';continue;}
      if(!expectsValue()||!/[\-0-9tfn]/.test(char))fail();kind='atom';atom=char;
    }
    if(kind==='string')raw+=text.slice(start);
  }
  const reader=blob.stream().pipeThrough(new DecompressionStream('gzip')).getReader(),decoder=new TextDecoder();let expandedBytes=0;
  try{
    while(true){const {value:bytes,done}=await reader.read();if(done)break;expandedBytes+=bytes.byteLength;for(let offset=0;offset<bytes.length;offset+=65536){parseChunk(decoder.decode(bytes.subarray(offset,offset+65536),{stream:true}));if(Date.now()-lastYield>=8){await new Promise(resolve=>setTimeout(resolve,0));lastYield=Date.now();}}}
    parseChunk(decoder.decode());if(kind==='atom'){value(JSON.parse(atom));kind=null;}if(kind||stack.length||!hasRoot)fail();return {payload:root,fileContents,expandedBytes};
  }catch(error){try{await reader.cancel(error);}catch{}throw error;}finally{reader.releaseLock();}
}
async function base64BlobToBlob(blob,mediaType){
  const parts=[];let pending='';
  for(let offset=0;offset<blob.size;offset+=65536){pending+=(await blob.slice(offset,offset+65536).text()).replace(/[\t\n\f\r ]/g,'');const end=Math.max(0,Math.floor(pending.length/4)*4-4);if(end){const part=pending.slice(0,end);if(part.includes('='))throw new TypeError('Invalid base64 padding before the end of an artifact.');parts.push(base64ToBytes(part));pending=pending.slice(end);}}
  parts.push(base64ToBytes(pending));return new Blob(parts,{type:mediaType||'application/octet-stream'});
}
async function importPackage(blob,{operationId=null,passphrase=null}={}){
  hash.assertPinnedUnicodeHost();
  if(await isEncryptedPackage(blob))blob=await decryptPackage(blob,passphrase);
  if(useStoreWorker())return requestStoreWorker('IMPORT_PACKAGE',[blob]);
  if(typeof DecompressionStream!=='function')throw storageError('DecompressionStream is required for complete package import.','DECOMPRESSION_STREAM_REQUIRED');
  const observedHeads=new Map((await listProjectSummaries()).map(p=>[projectIdentity(p),Number(p.revision||0)]));
  const {payload,fileContents}=await readPackageJson(blob),{packageSha256,...body}=payload;
  if(await hash.sha256Chunks(packageJsonChunks(body,fileContents))!==packageSha256)throw Object.assign(new Error('Project package hash mismatch.'),{existingProjectsUnchanged:true});
  if(body.schema!=='closed-loop-project-package/1')throw Object.assign(new Error('Unsupported project package schema.'),{existingProjectsUnchanged:true});
  const schemaApi=globalThis.closedLoopWorkflowSchema,project=body.project,id=projectIdentity(project);
  if(project?.schema!=='closed-loop-project/3'||project?.workflow!=='mobile-closed-loop/30'||Number(project?.stageCount)!==30||Object.keys(project?.stages||{}).length!==30)throw Object.assign(new Error('Imported project identity or stage count is invalid.'),{existingProjectsUnchanged:true});
  if(body.projectSchema!==project.schema||body.workflow!==project.workflow||body.responseSchema!==schemaApi?.RESPONSE_SCHEMA)throw Object.assign(new Error('Package schema manifest does not match the embedded project.'),{existingProjectsUnchanged:true});
  if(!id)throw Object.assign(new Error('Imported project has no JOB_ID.'),{existingProjectsUnchanged:true});
  // A backup retains the exact saved projection as audit data. Opening it uses
  // the same application recalculation as opening an existing project. Cached
  // stage labels cannot confer authority; canonical records, current release
  // determination and artifact custody still undergo their full checks here.
  try{assertProjectIntegrity(project,{verifyCachedProjection:false});}catch(error){throw Object.assign(error,{existingProjectsUnchanged:true});}
  const packageArtifacts=Array.isArray(body.artifacts)?body.artifacts:[],artifactIds=packageArtifacts.map(a=>String(a?.artifactId||''));if(artifactIds.some(x=>!x)||new Set(artifactIds).size!==artifactIds.length)throw Object.assign(new Error('Package artifacts contain a missing or duplicate artifact identity.'),{existingProjectsUnchanged:true});
  const verifiedArtifacts=[];
  for(const a of packageArtifacts){if(a.jobId!==undefined&&String(a.jobId)!==id)throw Object.assign(new Error(`Artifact ${a.artifactId} belongs to a different JOB_ID than the package project.`),{existingProjectsUnchanged:true});const source=fileContents.get(a),artifactBlob=source?await base64BlobToBlob(source.blob,a.mediaType):base64ToBlob(a.base64,a.mediaType);fileContents.delete(a);if(artifactBlob.size!==Number(a.byteSize))throw Object.assign(new Error(`Artifact ${a.artifactId} byte size mismatch.`),{existingProjectsUnchanged:true});const digest=await hash.sha256Bytes(artifactBlob);if(digest!==a.sha256)throw Object.assign(new Error(`Artifact ${a.artifactId} hash mismatch.`),{existingProjectsUnchanged:true});const {base64,...metadata}=a;verifiedArtifacts.push({...clone(metadata),jobId:id,blob:artifactBlob});}
  const manifest=body.packageManifest||{},manifestArtifacts=Array.isArray(manifest.artifacts)?manifest.artifacts:[],manifestIds=manifestArtifacts.map(a=>String(a?.artifactId||''));if(manifestIds.some(x=>!x)||new Set(manifestIds).size!==manifestIds.length)throw Object.assign(new Error('Package manifest contains a missing or duplicate artifact identity.'),{existingProjectsUnchanged:true});if(manifest.jobId!==id||Number(manifest.artifactCount)!==verifiedArtifacts.length||manifestArtifacts.length!==verifiedArtifacts.length||manifest.projectSha256!==projectSha256(project))throw Object.assign(new Error('Package manifest does not reconcile with the embedded project and artifacts.'),{existingProjectsUnchanged:true});
  const manifestById=new Map(manifestArtifacts.map(a=>[String(a.artifactId),a]));for(const a of verifiedArtifacts){const m=manifestById.get(String(a.artifactId));if(!m||m.sha256!==a.sha256||Number(m.byteSize)!==Number(a.byteSize)||m.filename!==a.filename||String(m.mediaType||'')!==String(a.mediaType||''))throw Object.assign(new Error(`Package manifest mismatch for artifact ${a.artifactId}.`),{existingProjectsUnchanged:true});}
  try{assertPackageArtifactCustody(project,verifiedArtifacts);}catch(error){throw Object.assign(error,{existingProjectsUnchanged:true});}
  if(verifiedArtifacts.some(a=>a.archiveKind&&!['RECOVERY_BYTES','RECOVERY_SNAPSHOT'].includes(a.archiveKind)))throw storageError('Unknown recovery archive member.','HISTORY_VERSION_MISMATCH');
  const activeArtifacts=verifiedArtifacts.filter(a=>!a.archiveKind),priorProject=await readProject(id);
  if(Number(priorProject?.revision||0)!==Number(observedHeads.get(id)||0))throw storageError('This project changed while the backup was being verified. Its newer work is preserved.','STALE_PROJECT_REVISION');
  let preparedPrior=null;
  if(priorProject){try{preparedPrior=await prepareHistoryCommit(priorProject,priorProject);}catch(error){
    if(!['PACKAGE_ARTIFACT_CUSTODY_MISMATCH','HISTORY_FILE_INTEGRITY_FAILED'].includes(error.code))throw error;
    // Restoring verified bytes must remain possible when the active file copy
    // is damaged. Use the already-retained matching complete version; never
    // fabricate missing files or combine another version's project records.
    const retained=await metaGet(historyKey(id)),saved=retained?.activeId?await decodeCheckpoint(id,await metaGet(snapshotKey(id,retained.activeId))):null;
    if(!saved||historyWorkSha256(saved.project)!==historyWorkSha256(priorProject))throw error;
    preparedPrior=await prepareHistoryCommit(priorProject,priorProject,{baseState:retained,artifactRows:saved.artifacts});
  }}
  const localState=preparedPrior?.state||await metaGet(historyKey(id)),merged=clone(localState||{schema:HISTORY_SCHEMA,jobId:id,generation:0,activeId:null,activeProjectSha256:null,entries:[],sessions:{},files:{},compressedProjectBytes:0,retainedFileBytes:0,redo:[]}),importSnapshots=[],importFiles=[];let importedView=null,importedActive=null;
  if(body.recovery){
    const incoming=body.recovery;
    if(incoming.schema!==HISTORY_SCHEMA||incoming.jobId!==id||!Array.isArray(incoming.entries)||!incoming.entries.some(e=>e.id===incoming.activeId)||new Set(incoming.entries.map(e=>e.id)).size!==incoming.entries.length)throw storageError('Backup History identity is invalid.','HISTORY_VERSION_MISMATCH');
    validateRecoveryManifest(incoming);assertHistoryLimits(incoming);
    const archiveFiles=new Map(verifiedArtifacts.filter(a=>a.archiveKind==='RECOVERY_BYTES').map(a=>[a.sha256,a]));
    for(const entry of incoming.entries){
      const archived=verifiedArtifacts.find(a=>a.archiveKind==='RECOVERY_SNAPSHOT'&&a.checkpointId===entry.id);
      if(!archived||archived.sha256!==entry.sha256||archived.byteSize!==entry.byteSize)throw storageError('A promised checkpoint is missing from the backup.','HISTORY_VERSION_UNAVAILABLE');
      const snapshot={...entry,blob:archived.blob},decoded=await decodeCheckpoint(id,snapshot,sha=>archiveFiles.get(sha));if(entry.id===incoming.activeId){importedActive=decoded;importedView=incoming.activeViewOverride||decoded.view;}
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
    for(const [key,receipt] of Object.entries(incoming.commandReceipts||{})){if(key!=='deleteReceipt:'+receipt.idempotencyKey||receipt.jobId!==id||receipt.result!==true||!Number.isFinite(Date.parse(receipt.retentionExpiry))||Object.keys(receipt).some(key=>!['jobId','commandId','idempotencyKey','payloadSha256','result','committedMetadataSequence','retentionExpiry'].includes(key)))throw storageError('Backup command receipt is incompatible.','HISTORY_VERSION_MISMATCH');const existing=merged.commandReceipts?.[key];if(existing&&hash.sha256Value(existing)!==hash.sha256Value(receipt))throw storageError('Backup command receipt conflicts with retained execution history.','IDEMPOTENCY_PAYLOAD_CONFLICT');merged.commandReceipts={...(merged.commandReceipts||{}),[key]:clone(receipt)};}
    merged.activeId=incoming.activeId;
  }else if(verifiedArtifacts.some(a=>a.archiveKind))throw storageError('Backup archive members have no governing History manifest.','HISTORY_VERSION_MISMATCH');
  const next=clone(project);next.revision=Math.max(Number(priorProject?.revision||0),Number(project.revision||0))+1;next.historyActivationId=crypto.randomUUID();delete next.projectSha256;
  if(body.recovery&&body.recovery.activeProjectSha256!==projectSha256(project))throw storageError('Backup active project does not match its recovery version.','HISTORY_VERSION_MISMATCH');
  assertRecoveryViewFiles(id,importedView,activeArtifacts);
  importedView=rebaseHistoryView(project,importedView);
  bindRestoredCandidates(next,project,body.recovery?.activeId||null,importedView);
  importedView=rebaseHistoryView(next,importedView);
  let prepared;
  if(importedActive&&historyWorkSha256(importedActive.project)===historyWorkSha256(project)&&historyArtifactsSha256(importedActive.artifacts)===historyArtifactsSha256(activeArtifacts)){
    // Activating an existing complete version needs no additional retention
    // slot, exactly as Undo and native history restoration do.
    merged.activeProjectSha256=projectSha256(next);merged.activeRevision=next.revision;merged.activeViewOverride=importedView;merged.title=String(next.job?.JOB_TITLE||'');merged.removed=false;merged.redo=[];merged.generation=Number(localState?.generation||0)+1;reconcileRecoveryTransfers(merged,next);
    prepared={state:merged,expectedGeneration:Number(localState?.generation||0),snapshots:[],newFiles:[]};
  }else prepared=await prepareHistoryCommit(next,null,{label:'Restored backup',view:importedView,baseState:merged,artifactRows:activeArtifacts});
  prepared.expectedGeneration=preparedPrior?preparedPrior.expectedGeneration:Number(localState?.generation||0);
  prepared.snapshots=[...(preparedPrior?.snapshots||[]),...importSnapshots,...prepared.snapshots];prepared.newFiles=[...(preparedPrior?.newFiles||[]),...importFiles,...prepared.newFiles];assertHistoryLimits(prepared.state);
  fault('before-import-transaction');const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite'),projects=tx.objectStore(PROJECTS),artifacts=tx.objectStore(ARTIFACTS),meta=tx.objectStore(META);
  try{
    const prior=await projectRowWithOperations(tx,id);if(Number(prior?.revision||0)!==Number(observedHeads.get(id)||0)||prior?.projectSha256!==priorProject?.projectSha256)throw storageError('Another tab changed this project during import.','STALE_PROJECT_REVISION');
    const digest=projectSha256(next),existingArtifacts=await request(artifacts.index('jobId').getAll(id));
    await restoreProjectAllocation(tx,next);
    for(const row of activeArtifacts){const existing=await request(artifacts.get(row.artifactId));if(existing&&String(existing.jobId)!==id)throw storageError('An imported artifact identity belongs to another project.','CROSS_PROJECT_ARTIFACT_ID_COLLISION');}
    for(const [key,receipt] of Object.entries(prepared.state.commandReceipts||{})){const current=await request(meta.get(key));if(current&&hash.sha256Value(current.value)!==hash.sha256Value(receipt))throw storageError('An imported command receipt conflicts with current execution history.','IDEMPOTENCY_PAYLOAD_CONFLICT');meta.put({key,value:receipt,updatedAt:now()});}
    await commitHistory(tx,prepared);
    for(const existing of existingArtifacts)artifacts.delete(existing.artifactId);
    fault('during-import-project-write');meta.delete(operationalKey(id));projects.put({jobId:id,revision:next.revision,picker:projectPickerKey(next),project:next,projectSha256:digest,updatedAt:now()});
    for(const a of activeArtifacts){fault('during-import-artifact-write');artifacts.put({...a,jobId:id});const staged=a.lineage?.stagedResponse;if(staged)meta.put({key:`responseStaging:${id}:${staged.stagingId}`,value:{...clone(staged),blob:a.blob},updatedAt:now()});}
    meta.put({key:'selectedProject',value:id,updatedAt:now()});meta.put({key:'lastCommittedRevision',value:{jobId:id,revision:next.revision,projectSha256:digest},updatedAt:now()});meta.put({key:'lastVerifiedImport',value:{jobId:id,packageSha256,artifactCount:activeArtifacts.length,historyCheckpointCount:prepared.state.entries.length,at:now()},updatedAt:now()});recordWorkerCommit(tx,operationId,next,digest);fault('before-import-commit');await complete(tx);next.projectSha256=digest;notifyProjectChange(next);return next;
  }catch(error){try{tx.abort();}catch{}throw Object.assign(error,{existingProjectsUnchanged:true});}
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
  const stored=await getArtifact(promptContextArtifactId(jobId,file));
  if(!stored||String(stored.jobId)!==String(jobId)||stored.blob.size!==file.byteSize||stored.sha256!==file.sha256||await hash.sha256Bytes(stored.blob)!==file.sha256)throw storageError('Exact saved context bytes failed read-back verification.','PROMPT_CONTEXT_INTEGRITY_FAILED');
  return {...file,blob:stored.blob};
}

// closed-loop-archive-profile/1: exact, uncompressed members with a fixed ZIP
// representation. Blob parts retain bounded reads even for large source files.
async function handoffArchive(members){
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
  const table=new Uint32Array(256);for(let i=0;i<256;i++){let crc=i;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);table[i]=crc;}
  const parts=[],central=[];let offset=0,centralSize=0;
  for(const entry of entries){
    let crc=0xffffffff;for(let pos=0;pos<entry.blob.size;pos+=65536){const bytes=new Uint8Array(await entry.blob.slice(pos,pos+65536).arrayBuffer());for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);}crc=(crc^0xffffffff)>>>0;
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

async function createExecutionPackage({project=null,jobId=null,stage,operation=null,testIds=[],productId=null,runId=null,reviewerAliasContext=null,instructionId=null}={}){
  if(!project&&jobId)project=await readProject(jobId);
  if(!project||typeof project!=='object')throw new Error('A canonical project is required for an execution package.');
  const engine=globalThis.closedLoopWorkflowEngine,promptEngine=globalThis.closedLoopPromptEngine,canonicalJobId=projectIdentity(project);if(jobId&&String(jobId)!==canonicalJobId)throw storageError(`Execution-package job ${jobId} does not match canonical project ${canonicalJobId}.`,'EXECUTION_PACKAGE_JOB_MISMATCH');
  const activeProject=await readProject(canonicalJobId);
  if(!activeProject||Number(activeProject.revision||0)!==Number(project.revision||0)||(activeProject.historyActivationId||null)!==(project.historyActivationId||null)||project.projectSha256&&activeProject.projectSha256!==project.projectSha256)throw storageError('The project changed before its handoff could be prepared. Open the current version and export again.','EXECUTION_PACKAGE_VERSION_STALE');
  project=activeProject;
  const normalizedStage=Number(stage),normalizedOperation=String(operation||globalThis.closedLoopWorkflowSchema?.STAGE_CONTRACTS?.[normalizedStage]?.operations?.[0]||'COMPLETE'),normalizedRunId=runId?String(runId):null,ids=[...new Set(testIds.map(String).filter(Boolean))];
  project=engine.stageContext(project,normalizedStage);
  if(!promptEngine?.responseContractDescriptor)throw storageError('The prompt authority is unavailable for execution-package construction.','EXECUTION_PACKAGE_PROMPT_AUTHORITY_UNAVAILABLE');
  const prompts=(project.projectData?.generatedPrompts||[]).filter(record=>Number(record?.stage)===normalizedStage&&!record?.invalidatedBy&&String(record?.operation||'COMPLETE')===normalizedOperation&&String(record?.promptEngineVersion||'')===String(promptEngine.version||''));
  const lanePrompts=prompts.filter(record=>!normalizedRunId||String(record?.scope?.runId||'')===normalizedRunId),selectedPrompt=instructionId?lanePrompts.find(record=>String(record?.instructionId||record?.promptId||'')===String(instructionId)):lanePrompts.at(-1);
  if(selectedPrompt&&(selectedPrompt.historyActivationId||null)!==(project.historyActivationId||null))throw storageError('This handoff belongs to an earlier project activation. Export a fresh instruction.','EXECUTION_PACKAGE_VERSION_STALE');
  if(!selectedPrompt)throw storageError('Save the current controlling instruction before preparing this execution package. No current saved instruction exists for this exact stage, operation, and run lane.','EXECUTION_PACKAGE_CURRENT_PROMPT_REQUIRED');
  if(selectedPrompt.transportBindingRequired&&Number(selectedPrompt.scope?.projectRevision)!==Number(project.revision))throw storageError('The saved handoff belongs to another project revision. Export a new instruction.','EXECUTION_PACKAGE_REVISION_STALE');
  const exactPrompt=String(selectedPrompt.prompt||'');if(!exactPrompt)throw storageError('The saved controlling instruction has no exact prompt text.','EXECUTION_PACKAGE_PROMPT_TEXT_MISSING');
  const fullTextSha256=hash.sha256Text(exactPrompt);if(String(selectedPrompt.bodySha256||'')!==fullTextSha256||String(selectedPrompt.fullTextSha256||'')!==fullTextSha256)throw storageError('The saved controlling instruction text no longer matches its recorded identity.','EXECUTION_PACKAGE_PROMPT_IDENTITY_MISMATCH');
  const responseContract=promptEngine.responseContractDescriptor(normalizedStage,normalizedOperation),contractSha256=hash.sha256Value(responseContract);if(String(selectedPrompt.contractSha256||'')!==contractSha256)throw storageError('The saved controlling instruction response contract is stale. Save the current instruction again before preparing the package.','EXECUTION_PACKAGE_CONTRACT_STALE');
  if(normalizedRunId&&String(selectedPrompt.scope?.runId||'')!==normalizedRunId)throw storageError('The saved controlling instruction is bound to a different run lane.','EXECUTION_PACKAGE_RUN_MISMATCH');
  const plan=engine.executionHandoff(project,{stage:normalizedStage,operation:normalizedOperation,testIds:ids,runIds:normalizedRunId?[normalizedRunId]:null}),artifactIds=[...new Set(plan.send.map(x=>String(x.artifactId||'')).filter(Boolean))],artifactEntries=[],fileContents=new WeakMap();
  for(const artifactId of artifactIds){const canonical=engine.records(project,'artifacts').find(r=>engine.recordId(r,'artifacts')===artifactId&&engine.isActiveRecord(r));if(!canonical)throw storageError(`Execution-package artifact ${artifactId} is not current canonical state.`,'EXECUTION_PACKAGE_ARTIFACT_STALE');const row=await getArtifact(artifactId);if(!row||String(row.jobId)!==canonicalJobId)throw storageError(`Execution-package artifact ${artifactId} has no stored bytes for ${canonicalJobId}.`,'EXECUTION_PACKAGE_BYTES_MISSING');const sha256=await hash.sha256Bytes(row.blob),byteSize=row.blob.size,expectedSha=String(engine.recordValue(canonical,'SHA256')||''),expectedSize=Number(engine.recordValue(canonical,'BYTE_SIZE'));if(sha256!==expectedSha||byteSize!==expectedSize)throw storageError(`Execution-package artifact ${artifactId} failed byte identity verification.`,'EXECUTION_PACKAGE_ARTIFACT_MISMATCH');artifactEntries.push({artifactId,filename:String(engine.recordValue(canonical,'FILENAME')||row.filename||artifactId),mediaType:String(row.mediaType||'application/octet-stream'),byteSize,sha256,role:String(engine.recordValue(canonical,'ROLE')||'AUTHORIZED_INPUT'),disclosureClassification:String(engine.recordValue(canonical,'DISCLOSURE_CLASSIFICATION')||'UNKNOWN'),base64:''});fileContents.set(artifactEntries.at(-1),{property:'base64',encoding:'base64',blob:row.blob});}
  const tests=engine.records(project,'tests').filter(t=>ids.includes(engine.recordId(t,'tests'))).map(t=>({testId:engine.recordId(t,'tests'),requirementId:String(engine.recordValue(t,'REQ_ID')||t.relationships?.REQ_ID||''),fields:clone(t.fields||{}),relationships:clone(t.relationships||{})}));
  const promptAliases=Array.isArray(selectedPrompt.contextManifest?.blindAliasMap)?selectedPrompt.contextManifest.blindAliasMap:[],providedAlias=reviewerAliasContext&&typeof reviewerAliasContext==='object'?reviewerAliasContext:null,aliasEntries=providedAlias?[providedAlias]:promptAliases,reviewerAlias=String(aliasEntries[0]?.alias||aliasEntries[0]?.reviewerAlias||'').trim()||null,publicIdentity=value=>{const text=String(value??'');const match=aliasEntries.find(entry=>String(entry.canonicalId||'')===text);return match?String(match.alias):value;},publicScope=Object.fromEntries(Object.entries(selectedPrompt.scope||{}).map(([key,value])=>[key,publicIdentity(value)]));
  const instruction={instructionId:String(selectedPrompt.instructionId||selectedPrompt.promptId||''),promptEngineVersion:String(selectedPrompt.promptEngineVersion||''),bodySha256:String(selectedPrompt.bodySha256||selectedPrompt.sha256||''),contractSha256:String(selectedPrompt.contractSha256||''),contextSignature:String(selectedPrompt.contextSignature||''),scope:clone(publicScope),fullTextSha256,text:exactPrompt};
  const promptFileManifest=promptEngine.promptFileManifest(selectedPrompt),manifest={scope:clone(promptFileManifest.scope),historyActivationId:selectedPrompt.historyActivationId||null,contractProfileId:promptFileManifest.contractProfileId,promptIdentity:promptFileManifest.promptIdentity,packageId:promptFileManifest.packageId||null,operationReservationId:promptFileManifest.operationReservationId||null,challengeNonce:promptFileManifest.challengeNonce||null,targetSlot:promptFileManifest.targetSlot||null,reservationRevision:promptFileManifest.reservationRevision??null,schema:'closed-loop-handoff-container/1',verificationPackageSchema:'closed-loop-verification-package/1',archiveProfile:'closed-loop-archive-profile/1',workflow:project.workflow,projectSchema:project.schema,responseSchema:globalThis.closedLoopWorkflowSchema?.RESPONSE_SCHEMA,jobId:canonicalJobId,stage:normalizedStage,operation:normalizedOperation,runId:publicIdentity(normalizedRunId),reviewerAlias,productId:publicIdentity(selectedPrompt.scope?.productId||null),testIds:ids,instructionId:instruction.instructionId,instructionFullTextSha256:fullTextSha256,responseContractSha256:contractSha256,artifacts:artifactEntries.map(({base64,...x})=>x),handoff:clone(plan)};
  const contextFiles=[];for(const identity of promptFileManifest.contextFiles){const file=await readPromptContextFile(selectedPrompt,canonicalJobId,identity.path);contextFiles.push({...identity,text:''});fileContents.set(contextFiles.at(-1),{property:'text',encoding:'utf8',blob:file.blob});}manifest.contextFiles=promptFileManifest.contextFiles;
  const members=[],addMember=(canonicalPath,blob,identity)=>{members.push({canonicalPath,blob,...identity,byteSize:blob.size,hashAlgorithm:'SHA-256',required:true});};
  addMember('instruction.txt',new Blob([exactPrompt],{type:'text/plain;charset=utf-8'}),{role:'AUTHORITATIVE_INSTRUCTION',sha256:fullTextSha256,mediaType:'text/plain',disclosureClassification:'UNKNOWN'});
  for(const identity of contextFiles)addMember(identity.path,fileContents.get(identity).blob,{role:'PROMPT_CONTEXT',sha256:identity.sha256,mediaType:identity.mediaType,disclosureClassification:identity.disclosureClassification||'UNKNOWN'});
  for(const entry of artifactEntries){const identity=hash.normalizeFilename(entry.filename,{allowPath:true});addMember(hash.normalizeFilename(`artifacts/${entry.artifactId}/${identity.canonicalPath}`,{allowPath:true}).canonicalPath,fileContents.get(entry).blob,{artifactId:entry.artifactId,rawFilename:entry.filename,displayFilename:identity.displayFilename,filenameVersion:identity.filenameVersion,unicodeVersion:identity.unicodeVersion,role:entry.role,sha256:entry.sha256,mediaType:entry.mediaType,disclosureClassification:entry.disclosureClassification});}
  const {text:instructionText,...instructionIdentity}=instruction;
  manifest.instruction=instructionIdentity;manifest.responseContract=responseContract;manifest.tests=tests;
  manifest.members=members.map(({blob,...identity})=>identity).sort((a,b)=>a.canonicalPath<b.canonicalPath?-1:a.canonicalPath>b.canonicalPath?1:0);
  manifest.packageManifestSha256=hash.sha256Value(manifest);
  const manifestBlob=new Blob([hash.stableStringify(manifest)+'\n'],{type:'application/json'});
  const blob=await handoffArchive([...members,{canonicalPath:'manifest.json',blob:manifestBlob}]),packageSha256=await hash.sha256Bytes(blob);
  const currentProject=await readProject(canonicalJobId);if(!currentProject||currentProject.projectSha256!==activeProject.projectSha256||Number(currentProject.revision||0)!==Number(activeProject.revision||0)||(currentProject.historyActivationId||null)!==(activeProject.historyActivationId||null))throw storageError('The project changed while its handoff was being assembled. Export the current version again.','EXECUTION_PACKAGE_VERSION_STALE');
  return {blob,filename:`STAGE-${String(normalizedStage).padStart(2,'0')}-files.zip`,manifest,packageSha256};
}
async function stageResponseFile({jobId,stage,blob,rawFilename='response.json',mediaType='application/json',promptIdentity=null,packageId=null,operationReservationId=null,challengeNonce=null}={}){
  const owner=String(jobId||'').trim(),stageNumber=Number(stage);if(!owner)throw storageError('JOB_ID is required to stage a response file.','RESPONSE_STAGE_JOB_ID_REQUIRED');if(!Number.isInteger(stageNumber)||stageNumber<1||stageNumber>30)throw storageError('A valid stage is required to stage a response file.','RESPONSE_STAGE_INVALID_STAGE');if(!(blob instanceof Blob))throw new TypeError('Response-file bytes must be a Blob.');
  const originalName=String(rawFilename||'response.json'),claimedType=String(mediaType||blob.type||'application/octet-stream'),byteSize=blob.size,sha256=await hash.sha256Bytes(blob),stagingId=`RESPONSE-STAGING-${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`,key=`responseStaging:${owner}:${stagingId}`,record={schema:'closed-loop-response-staging/1',stagingId,jobId:owner,stage:stageNumber,rawFilename:originalName,mediaType:claimedType,byteSize,sha256,blob:new Blob([blob],{type:claimedType}),promptIdentity:clone(promptIdentity),packageId:packageId||null,operationReservationId:operationReservationId||null,challengeNonce:challengeNonce||null,status:'HASHED_AND_REVERIFIED',createdAt:now()};
  const {blob:responseBlob,...stagingIdentity}=record;
  await putArtifact({artifactId:'RAW-'+stagingId,jobId:owner,blob:record.blob,filename:originalName,mediaType:claimedType,lineage:{stage:stageNumber,role:'RAW_RESPONSE_RECOVERY',stagedResponse:stagingIdentity}});fault('during-response-staging-write');await metaPut(key,record);const stored=await metaGet(key);if(!stored?.blob)throw storageError('Staged response bytes were not persisted.','RESPONSE_STAGE_BYTES_MISSING');const verifyDigest=await hash.sha256Bytes(stored.blob);if(stored.blob.size!==byteSize||verifyDigest!==sha256){const tx=await openTransaction(META,'readwrite');tx.objectStore(META).delete(key);await complete(tx);throw storageError('Staged response bytes failed read-back verification.','RESPONSE_STAGE_REHASH_MISMATCH');}return {...stored,blob:undefined,storageKey:key};
}
async function readStagedResponseFile({jobId,stagingId}={}){const owner=String(jobId||'').trim(),id=String(stagingId||'').trim();if(!owner||!id)throw storageError('JOB_ID and stagingId are required.','RESPONSE_STAGE_ID_REQUIRED');const key=`responseStaging:${owner}:${id}`,stored=await metaGet(key);if(!stored?.blob)throw storageError('Staged response file is unavailable.','RESPONSE_STAGE_NOT_FOUND');if(String(stored.jobId)!==owner)throw storageError('Staged response belongs to another project.','CROSS_PROJECT_RESPONSE_STAGE');const limit=globalThis.closedLoopWorkflowSchema?.DEFAULT_RESOURCE_LIMITS?.maxRawResponseBytes;if(Number.isFinite(limit)&&stored.blob.size>limit){const digest=await hash.sha256Bytes(stored.blob);if(stored.blob.size!==Number(stored.byteSize)||digest!==String(stored.sha256))throw storageError('Staged response bytes no longer match their captured identity.','RESPONSE_STAGE_REHASH_MISMATCH');await metaPut(key,{...stored,rejection:{code:'OVERSIZED_RESPONSE',byteSize:stored.blob.size,maxRawResponseBytes:limit,at:now()}});throw storageError(`Response file exceeds the ${limit}-byte stage limit. The exact original bytes and rejection receipt remain staged for ${owner}.`,'OVERSIZED_RESPONSE');}const bytes=new Uint8Array(await stored.blob.arrayBuffer()),sha256=await hash.sha256Bytes(bytes);if(bytes.byteLength!==Number(stored.byteSize)||sha256!==String(stored.sha256))throw storageError('Staged response bytes no longer match their captured identity.','RESPONSE_STAGE_REHASH_MISMATCH');return {...stored,bytes,blob:stored.blob,storageKey:key};}
async function removeStagedResponseFile({jobId,stagingId}={}){const owner=String(jobId||'').trim(),id=String(stagingId||'').trim();if(!owner||!id)return false;const key=`responseStaging:${owner}:${id}`,tx=await openTransaction(META,'readwrite'),store=tx.objectStore(META);const row=await request(store.get(key));if(row?.value&&String(row.value.jobId)!==owner){try{tx.abort();}catch{}throw storageError('Staged response belongs to another project.','CROSS_PROJECT_RESPONSE_STAGE');}store.delete(key);await complete(tx);return Boolean(row);}
async function storageHealth(){let persistent=false,estimate={usage:null,quota:null};try{persistent=await navigator.storage.persist();estimate=await navigator.storage.estimate();}catch{}return {database:DB_NAME,persistent:Boolean(persistent),usage:estimate.usage??null,quota:estimate.quota??null,lastCommittedRevision:await metaGet('lastCommittedRevision'),lastVerifiedExport:await metaGet('lastVerifiedExport'),migrationStatus:await metaGet('migrationStatus')};}
function archiveMigrationPayload(project,archive){if(!project||typeof project!=='object')throw new TypeError('A project is required.');project.projectData=project.projectData&&typeof project.projectData==='object'?project.projectData:{};project.projectData.migrationArchives=Array.isArray(project.projectData.migrationArchives)?project.projectData.migrationArchives:[];const record={...clone(archive),operational:false};project.projectData.migrationArchives.push(record);return record;}
function clearLegacy(storage=globalThis.localStorage){if(!storage)return;for(const key of LEGACY_KEYS)try{storage.removeItem(key);}catch{}}

const ready=(async()=>{hash.assertPinnedUnicodeHost();if(globalThis.indexedDB)try{await migrateLegacy();globalThis.closedLoopLegacyMigrationError=null;}catch(error){globalThis.closedLoopLegacyMigrationError=String(error?.stack||error);console.error('Legacy migration failed without deleting the preserved legacy payload; application startup will continue.',error);}return true;})();
if(STORE_WORKER){let queue=Promise.resolve();globalThis.addEventListener('message',event=>{const message=event.data||{};queue=queue.then(async()=>{try{if(message.buildIdentity!==STORE_BUILD_ID||!message.operationId||!['WRITE_PROJECT','IMPORT_PACKAGE'].includes(message.method)||!Array.isArray(message.args))throw storageError('Invalid storage worker command or build identity.','INVALID_STORAGE_WORKER_REQUEST');await ready;globalThis.__closedLoopStorageFault=message.fault;const project=message.method==='WRITE_PROJECT'?await writeProject(message.args[0],{...message.args[1],operationId:message.operationId}):await importPackage(message.args[0],{operationId:message.operationId});globalThis.postMessage({operationId:message.operationId,buildIdentity:STORE_BUILD_ID,ok:true,project});}catch(error){globalThis.postMessage({operationId:message.operationId,buildIdentity:STORE_BUILD_ID,ok:false,error:{code:error?.code||'STORAGE_OPERATION_FAILED',message:String(error?.message||error)}});}finally{delete globalThis.__closedLoopStorageFault;}}).catch(error=>{setTimeout(()=>{throw error;},0);});});}
globalThis.closedLoopProjectStore=Object.freeze({listQuarantinedProjects,exportQuarantinedProject,removeQuarantinedProject,ENCRYPTED_EXPORT_PROFILE,isEncryptedPackage,HISTORY_LIMITS,mutationImpact,rebaseHistoryView,assertRecoveryTransfer,historyList,listRecoverableProjects,readHistoryView,saveCheckpoint,beginHistorySession,restoreCheckpoint,persistPromptContextFiles,readPromptContextFile,archiveMigrationPayload,version:'closed-loop-project-store/2',DB_NAME,DB_VERSION,stores:Object.freeze({projects:PROJECTS,artifacts:ARTIFACTS,meta:META}),STORE_KEY,LEGACY_KEYS,clone,projectIdentity,projectSha256,validateProjectIntegrity,openDatabase,ready,readAll,readProject,listProjectSummaries,writeAll,writeProject,replaceProject,transact,removeProject,putArtifact,getArtifact,deleteArtifact,listArtifacts,verifyProjectArtifacts,createExecutionPackage,exportPackage,importPackage,stageResponseFile,readStagedResponseFile,removeStagedResponseFile,storageHealth,metaGet,metaPut,clearLegacy,createProject});
})();
;(()=>{
'use strict';
const CLOSED_LOOP_V3_STORE_MIGRATION_EXPORT=true;
const store=globalThis.closedLoopProjectStore;
const schema=globalThis.closedLoopWorkflowSchema;
if(store&&schema&&typeof schema.migrateProjectToCurrent==='function'&&typeof store.migrateProjectToCurrent!=='function')globalThis.closedLoopProjectStore=Object.freeze({...store,migrateProjectToCurrent:project=>schema.migrateProjectToCurrent(project)});
})();
