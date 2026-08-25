(()=>{
'use strict';

const DB_NAME='closed-loop-reliability';
const DB_VERSION=1;
const PROJECTS='projects';
const ARTIFACTS='artifacts';
const META='meta';
const LEGACY_KEYS=Object.freeze(['closed-loop-reliability-projects-v4','closed-loop-reliability-projects-v3','closed-loop-reliability-projects-v2','closed-loop-reliability-projects']);
const hash=globalThis.closedLoopHash;
const clone=value=>value===undefined?undefined:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const projectIdentity=project=>String(project?.job?.JOB_ID||project?.jobId||'').trim();
const now=()=>new Date().toISOString();
const fault=phase=>{const configured=globalThis.__closedLoopStorageFault;if(configured===phase||configured?.phase===phase){const error=new Error(`Injected storage failure at ${phase}.`);error.code='INJECTED_STORAGE_FAILURE';throw error;}};
const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB request failed.'));});
const complete=tx=>new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed.'));tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted.'));});
const canonicalProject=project=>{const copy=clone(project);delete copy.projectSha256;return copy;};
const projectSha256=project=>hash.sha256Value(canonicalProject(project));

let databasePromise=null;
function openDatabase(){
  if(!globalThis.indexedDB)return Promise.reject(Object.assign(new Error('IndexedDB is required by the supported browser contract.'),{code:'INDEXEDDB_REQUIRED'}));
  if(databasePromise)return databasePromise;
  databasePromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(PROJECTS))db.createObjectStore(PROJECTS,{keyPath:'jobId'});if(!db.objectStoreNames.contains(ARTIFACTS))db.createObjectStore(ARTIFACTS,{keyPath:'artifactId'});if(!db.objectStoreNames.contains(META))db.createObjectStore(META,{keyPath:'key'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB open failed.'));req.onblocked=()=>reject(Object.assign(new Error('IndexedDB upgrade is blocked by another tab.'),{code:'INDEXEDDB_BLOCKED'}));
  });
  return databasePromise;
}

function parseLegacy(storage=globalThis.localStorage){const out=[],seen=new Set();if(!storage)return out;for(const key of LEGACY_KEYS){let raw=null;try{raw=storage.getItem(key);}catch{}if(!raw)continue;try{const parsed=JSON.parse(raw);for(const item of Array.isArray(parsed)?parsed:[parsed]){if(!item||typeof item!=='object')continue;const id=projectIdentity(item)||hash.sha256Value(item);if(seen.has(id))continue;seen.add(id);out.push(item);}}catch{}}return out;}
function readAllLegacy(storage){return parseLegacy(storage);}
function writeAllLegacy(projects,storage){if(!storage)throw new Error('Legacy test storage is unavailable.');storage.setItem(LEGACY_KEYS[0],JSON.stringify(projects));return {changed:true};}

async function metaPut(key,value,tx=null){const db=tx?null:await openDatabase();const own=tx||db.transaction(META,'readwrite');own.objectStore(META).put({key,value,updatedAt:now()});if(!tx)await complete(own);return value;}
async function metaGet(key){const db=await openDatabase(),tx=db.transaction(META,'readonly');const row=await request(tx.objectStore(META).get(key));await complete(tx);return row?.value;}
async function quarantine(row,reason){const key=`quarantine:${row?.jobId||'UNKNOWN'}:${Date.now()}`;await metaPut(key,{reason,row});}

async function migrateLegacy(){
  const db=await openDatabase();const count=await request(db.transaction(PROJECTS,'readonly').objectStore(PROJECTS).count());if(count)return {migrated:0};
  const legacy=parseLegacy();if(!legacy.length){await metaPut('migrationStatus',{status:'NONE',at:now()});return {migrated:0};}
  const tx=db.transaction([PROJECTS,META],'readwrite');let migrated=0;
  try{fault('before-legacy-migration');for(const source of legacy){const project=clone(source);const id=projectIdentity(project);if(!id)continue;const revision=Number(project.revision||0);tx.objectStore(PROJECTS).put({jobId:id,revision,project,projectSha256:projectSha256(project),updatedAt:now()});migrated++;}tx.objectStore(META).put({key:'migrationStatus',value:{status:'COMPLETE',migrated,at:now()},updatedAt:now()});fault('during-legacy-migration');await complete(tx);for(const key of LEGACY_KEYS)try{localStorage.removeItem(key);}catch{}return {migrated};}catch(error){try{tx.abort();}catch{}await metaPut('migrationStatus',{status:'FAILED',message:String(error.message||error),originalPreserved:true,at:now()});throw error;}
}

async function readAll(storage){if(storage)return readAllLegacy(storage);await migrateLegacy();const db=await openDatabase(),tx=db.transaction(PROJECTS,'readonly'),rows=await request(tx.objectStore(PROJECTS).getAll());await complete(tx);const valid=[];for(const row of rows){const actual=projectSha256(row.project);if(actual!==row.projectSha256){await quarantine(row,'PROJECT_HASH_MISMATCH');continue;}const project=clone(row.project);project.revision=Number(row.revision||project.revision||0);project.projectSha256=row.projectSha256;valid.push(project);}return valid;}

async function writeProject(project,{expectedProjectRevision=null,incrementRevision=true}={}){
  const id=projectIdentity(project);if(!id)throw new Error('A project without a JOB_ID cannot be committed.');const db=await openDatabase();fault('before-project-transaction');const tx=db.transaction([PROJECTS,META],'readwrite');const store=tx.objectStore(PROJECTS);try{const prior=await request(store.get(id));const currentRevision=Number(prior?.revision||0);if(expectedProjectRevision!==null&&Number(expectedProjectRevision)!==currentRevision){const e=new Error(`Project revision conflict for ${id}: expected ${expectedProjectRevision}, found ${currentRevision}.`);e.code='STALE_PROJECT_REVISION';throw e;}const next=clone(project);next.revision=incrementRevision?currentRevision+1:currentRevision;delete next.projectSha256;const digest=projectSha256(next);fault('during-project-write');store.put({jobId:id,revision:next.revision,project:next,projectSha256:digest,updatedAt:now()});tx.objectStore(META).put({key:'selectedProject',value:id,updatedAt:now()});tx.objectStore(META).put({key:'lastCommittedRevision',value:{jobId:id,revision:next.revision,projectSha256:digest},updatedAt:now()});fault('before-transaction-commit');await complete(tx);next.projectSha256=digest;try{new BroadcastChannel('closed-loop-reliability').postMessage({type:'PROJECT_CHANGED',jobId:id,revision:next.revision});}catch{}return next;}catch(error){try{tx.abort();}catch{}throw error;}
}

async function writeAll(projects,storage){if(storage)return writeAllLegacy(projects,storage);if(!Array.isArray(projects))throw new TypeError('Project storage payload must be an array.');const saved=[];for(const project of projects){const id=projectIdentity(project);if(!id)continue;const db=await openDatabase(),tx=db.transaction(PROJECTS,'readonly'),prior=await request(tx.objectStore(PROJECTS).get(id));await complete(tx);const incoming=clone(project);delete incoming.projectSha256;const digest=projectSha256(incoming);if(prior?.projectSha256===digest){incoming.revision=Number(prior.revision||0);incoming.projectSha256=digest;saved.push(incoming);}else saved.push(await writeProject(incoming,{expectedProjectRevision:Number(prior?.revision||0),incrementRevision:Boolean(prior)}));}return saved;}

async function replaceProject(projectsOrProject,projectOrOptions,storage){
  if(Array.isArray(projectsOrProject)){const projects=projectsOrProject,project=projectOrOptions;if(storage){const next=clone(projects);const id=projectIdentity(project),i=next.findIndex(x=>projectIdentity(x)===id);if(i<0)next.unshift(clone(project));else next[i]=clone(project);writeAllLegacy(next,storage);return next;}return writeProject(project,{expectedProjectRevision:Number(project?.revision||0)});}
  return writeProject(projectsOrProject,projectOrOptions||{});
}

async function transact(projectsOrJobId,jobIdOrExpected,mutatorOrOptions,storage){
  if(Array.isArray(projectsOrJobId)&&storage){const next=clone(projectsOrJobId),id=String(jobIdOrExpected||''),i=next.findIndex(x=>projectIdentity(x)===id);if(i<0)throw new Error(`Project ${id} is not available for transaction.`);const before=clone(next[i]),result=mutatorOrOptions(next[i],before);writeAllLegacy(next,storage);return {projects:next,project:next[i],result};}
  const jobId=String(projectsOrJobId||''),expected=Number(jobIdOrExpected);const mutator=mutatorOrOptions;if(typeof mutator!=='function')throw new TypeError('Transaction mutator must be a function.');const db=await openDatabase(),tx=db.transaction([PROJECTS,META],'readwrite'),store=tx.objectStore(PROJECTS);const prior=await request(store.get(jobId));if(!prior)throw new Error(`Project ${jobId} is not available for transaction.`);if(Number(prior.revision)!==expected){try{tx.abort();}catch{}const e=new Error(`Project revision conflict for ${jobId}: expected ${expected}, found ${prior.revision}.`);e.code='STALE_PROJECT_REVISION';throw e;}const before=clone(prior.project),next=clone(prior.project),result=await mutator(next,before);const engine=globalThis.closedLoopWorkflowEngine;engine?.ensureShape?.(next);engine?.recalculate?.(next);next.revision=expected+1;const digest=projectSha256(next);store.put({jobId,revision:next.revision,project:next,projectSha256:digest,updatedAt:now()});tx.objectStore(META).put({key:'lastCommittedRevision',value:{jobId,revision:next.revision,projectSha256:digest},updatedAt:now()});await complete(tx);next.projectSha256=digest;return {project:next,result};
}

async function removeProject(projectsOrJobId,jobIdOrStorage,storage){if(Array.isArray(projectsOrJobId)&&storage){const next=clone(projectsOrJobId).filter(p=>projectIdentity(p)!==String(jobIdOrStorage||''));writeAllLegacy(next,storage);return next;}const jobId=String(projectsOrJobId||''),db=await openDatabase(),tx=db.transaction([PROJECTS,ARTIFACTS],'readwrite');tx.objectStore(PROJECTS).delete(jobId);const artifacts=await request(tx.objectStore(ARTIFACTS).getAll());for(const a of artifacts)if(a.jobId===jobId)tx.objectStore(ARTIFACTS).delete(a.artifactId);await complete(tx);return true;}

async function putArtifact({artifactId,jobId,blob,filename,mediaType,lineage={}}){if(!(blob instanceof Blob))throw new TypeError('Artifact bytes must be a Blob.');if(!artifactId||!jobId)throw new Error('artifactId and jobId are required.');fault('during-artifact-blob-write');const byteSize=blob.size,sha256=await hash.sha256Bytes(blob),db=await openDatabase(),tx=db.transaction(ARTIFACTS,'readwrite');tx.objectStore(ARTIFACTS).put({artifactId,jobId,blob,filename:String(filename||artifactId),mediaType:String(mediaType||blob.type||'application/octet-stream'),byteSize,sha256,lineage:clone(lineage),createdAt:now()});await complete(tx);const verified=await getArtifact(artifactId);if(!verified||verified.byteSize!==byteSize||await hash.sha256Bytes(verified.blob)!==sha256)throw new Error('Artifact byte read-back verification failed.');return verified;}
async function getArtifact(artifactId){const db=await openDatabase(),tx=db.transaction(ARTIFACTS,'readonly'),row=await request(tx.objectStore(ARTIFACTS).get(String(artifactId)));await complete(tx);return row||null;}
async function listArtifacts(jobId){const db=await openDatabase(),tx=db.transaction(ARTIFACTS,'readonly'),rows=await request(tx.objectStore(ARTIFACTS).getAll());await complete(tx);return rows.filter(r=>r.jobId===String(jobId));}

const bytesToBase64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);};
const base64ToBytes=text=>{const s=atob(text),out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;};
async function compressBytes(bytes){if(typeof CompressionStream!=='function')throw Object.assign(new Error('CompressionStream is required for complete package export.'),{code:'COMPRESSION_STREAM_REQUIRED'});const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));return new Uint8Array(await new Response(stream).arrayBuffer());}
async function decompressBytes(bytes){if(typeof DecompressionStream!=='function')throw Object.assign(new Error('DecompressionStream is required for complete package import.'),{code:'DECOMPRESSION_STREAM_REQUIRED'});const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return new Uint8Array(await new Response(stream).arrayBuffer());}
async function exportPackage(jobId){const projects=await readAll(),project=projects.find(p=>projectIdentity(p)===String(jobId));if(!project)throw new Error(`Project ${jobId} is not stored.`);const artifacts=await listArtifacts(jobId),artifactEntries=[];for(const a of artifacts){const bytes=new Uint8Array(await a.blob.arrayBuffer());artifactEntries.push({artifactId:a.artifactId,jobId:a.jobId,filename:a.filename,mediaType:a.mediaType,byteSize:a.byteSize,sha256:a.sha256,lineage:a.lineage,createdAt:a.createdAt,base64:bytesToBase64(bytes)});}const body={schema:'closed-loop-project-package/1',projectSchema:project.schema,workflow:project.workflow,responseSchema:globalThis.closedLoopWorkflowSchema?.RESPONSE_SCHEMA,project:canonicalProject(project),artifacts:artifactEntries,exportedAt:now()};const packageSha256=hash.sha256Value(body),payload={...body,packageSha256};const compressed=await compressBytes(new TextEncoder().encode(JSON.stringify(payload)));await metaPut('lastVerifiedExport',{jobId,packageSha256,artifactCount:artifactEntries.length,at:now()});return new Blob([compressed],{type:'application/gzip'});}
async function importPackage(blob){const before=await readAll();try{const compressed=new Uint8Array(await blob.arrayBuffer()),json=new TextDecoder().decode(await decompressBytes(compressed)),payload=JSON.parse(json),{packageSha256,...body}=payload;if(hash.sha256Value(body)!==packageSha256)throw new Error('Project package hash mismatch.');if(body.schema!=='closed-loop-project-package/1')throw new Error('Unsupported project package schema.');for(const a of body.artifacts||[]){const bytes=base64ToBytes(a.base64);if(bytes.byteLength!==a.byteSize)throw new Error(`Artifact ${a.artifactId} byte size mismatch.`);if(await hash.sha256Bytes(bytes)!==a.sha256)throw new Error(`Artifact ${a.artifactId} hash mismatch.`);}const project=body.project,id=projectIdentity(project);if(!id)throw new Error('Imported project has no JOB_ID.');const current=before.find(p=>projectIdentity(p)===id);const saved=await writeProject(project,{expectedProjectRevision:Number(current?.revision||0),incrementRevision:Boolean(current)});for(const a of body.artifacts||[])await putArtifact({artifactId:a.artifactId,jobId:id,blob:new Blob([base64ToBytes(a.base64)],{type:a.mediaType}),filename:a.filename,mediaType:a.mediaType,lineage:a.lineage});return saved;}catch(error){throw Object.assign(error,{existingProjectsUnchanged:true});}}

async function storageHealth(){let persistent=false,estimate={usage:null,quota:null};try{persistent=await navigator.storage.persist();estimate=await navigator.storage.estimate();}catch{}return {database:DB_NAME,persistent:Boolean(persistent),usage:estimate.usage??null,quota:estimate.quota??null,lastCommittedRevision:await metaGet('lastCommittedRevision'),lastVerifiedExport:await metaGet('lastVerifiedExport'),migrationStatus:await metaGet('migrationStatus')};}
function clearLegacy(storage=globalThis.localStorage){if(!storage)return;for(const key of LEGACY_KEYS)try{storage.removeItem(key);}catch{}}

const ready=(async()=>{if(globalThis.indexedDB)await migrateLegacy();return true;})();
globalThis.closedLoopProjectStore=Object.freeze({version:'closed-loop-project-store/2',DB_NAME,DB_VERSION,stores:Object.freeze({projects:PROJECTS,artifacts:ARTIFACTS,meta:META}),LEGACY_KEYS,clone,projectIdentity,projectSha256,openDatabase,ready,readAll,writeAll,writeProject,replaceProject,transact,removeProject,putArtifact,getArtifact,listArtifacts,exportPackage,importPackage,storageHealth,metaGet,metaPut,clearLegacy});
})();
