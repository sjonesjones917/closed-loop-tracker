// History root proofs (project-store.js, the one exception to "One-use
// retained computations, never a validation-success cache") are minted and used
// only in the storage worker. This owner runs the production store as the
// browser does: a page realm whose exportPackage/importPackage/writeProject/
// saveCheckpoint go through the production requestStoreWorker path to a
// storage-worker realm (project-store.js?storeWorker=1), both over one
// transaction-adapter database. In ONE proof-holding worker it applies each
// fault in place and requires the export's outcome (code, message, issues, or
// the exact package bytes apart from exportedAt and the packageSha256 over it)
// to equal a fresh runtime's cold export of the same faulted store. It also
// requires that refused roots never mint, that the happy path really skips the
// decode of proven entries, that a same-session import uses Tier 2 proofs while
// a fresh-runtime import is cold and identical, that a lost or reloaded worker
// exports cold and correctly, and pins the measured History watchdog.
// Ledger and decode counts are observed by in-memory source instrumentation
// only; production files and exports are unchanged.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const BUILD='HISTORY-PROOF-REUSE';
const PAGE_SCRIPT="const STORE_SCRIPT_URL=typeof document!=='undefined'?document.currentScript?.src:null;";
const LEDGER="const historyRootProofs=new Map(),historyPairProofs=new Map();";
const COLD_ROOT='({projectSha256:verifiedProjectSha256,workSha256:verifiedWorkSha256}=checkpointPairMatches(measuredPair,project)?measuredPair:historyProjectDigests(project));';
const SNAPSHOT_DECODE='const {payload,fileContents}=await readPackageJson(entry.blob,{spoolArtifacts:false}),{packageSha256,...body}=payload;';
const EXPORT_HIT='    historyProofUsed(operation,proof);\n    return {payload:';
const IMPORT_HIT='historyProofUsed(operation,proof);historyProofUsed(operation,pair);';
// The measured watchdog (project-store.js HISTORY_WATCHDOG_MEASUREMENT),
// re-derived here from its stated arithmetic at the declared History limits.
export const HISTORY_WATCHDOG_PIN=Object.freeze({coldMsPerSnapshotMiB:2400,transportMsPerFileMiB:90,hostedSlowdown:2,maxCompressedProjectMiB:512,maxRetainedFileMiB:1024});
export const HISTORY_WATCHDOG_MS=Math.ceil(HISTORY_WATCHDOG_PIN.hostedSlowdown*(HISTORY_WATCHDOG_PIN.coldMsPerSnapshotMiB*HISTORY_WATCHDOG_PIN.maxCompressedProjectMiB+HISTORY_WATCHDOG_PIN.transportMsPerFileMiB*HISTORY_WATCHDOG_PIN.maxRetainedFileMiB));
const replaceOnce=(source,before,after,label)=>{assert.equal(source.split(before).length,2,'HISTORY_PROOF_ANCHOR_ORACLE '+label);return source.replace(before,after);};
const sha=value=>createHash('sha256').update(value).digest('hex');

// Implementation faults this owner must detect (each is an in-memory mutant).
export const HISTORY_PROOF_FAULTS=Object.freeze({
 'skip-part-rehash':{oracle:'HISTORY_PROOF_EQUIVALENCE_ORACLE',apply:s=>replaceOnce(s,"    const file=await readFile(part.sha256),bytePrimitive=checkpointBytePrimitives(file?.blob);\n    if(!(file?.blob instanceof Blob)||file.blob.size!==part.byteSize||await historyBlobSha256(file.blob,verifiedByteDigests)!==part.sha256||!checkpointBytePrimitivesMatch(bytePrimitive))return false;","    const file=await readFile(part.sha256);if(!file)return false;",'skip-part-rehash')},
 'skip-descriptor-match':{oracle:'HISTORY_PROOF_EQUIVALENCE_ORACLE',apply:s=>replaceOnce(s,"  if(proof.schema!==HISTORY_SCHEMA||proof.id!==entry.id||proof.bodyJobId!==String(jobId)||proof.projectSha256!==entry.projectSha256||proof.parentId!==entry.parentId||proof.label!==entry.label||proof.createdAt!==entry.createdAt||proof.activeStage!==Number(entry.stage)||!proof.artifactsArray)return false;","  if(proof.schema!==HISTORY_SCHEMA||proof.id!==entry.id)return false;",'skip-descriptor-match')},
 'skip-native-check':{oracle:'HISTORY_PROOF_EQUIVALENCE_ORACLE',apply:s=>replaceOnce(s,'function historyProofNativesUnchanged(natives){','function historyProofNativesUnchanged(natives){return Boolean(natives);',"skip-native-check")},
 'skip-validator-check':{oracle:'HISTORY_PROOF_EQUIVALENCE_ORACLE',apply:s=>replaceOnce(replaceOnce(s,'  if(!operation.validators.has(validators))operation.validators.set(validators,rootValidatorsUnchanged(validators));','  if(!operation.validators.has(validators))operation.validators.set(validators,true);','skip-validator-check'),'  for(const [validators,current] of operation.validators)if(current&&!rootValidatorsUnchanged(validators))return false;\n','','skip-validator-gate')},
 'mint-certificate-unchecked':{oracle:'HISTORY_PROOF_PERMISSIVE_WRITER_ORACLE',apply:s=>replaceOnce(s,'if(proofValidators&&digests.projectSha256===verifiedProjectSha256&&digests.workSha256===verifiedWorkSha256){assertProjectIntegrity(project,{verifyDerived:false});proofBasis','if(proofValidators){proofBasis','mint-certificate-unchecked')},
 'ignore-proven-credential':{oracle:'HISTORY_PROOF_CREDENTIAL_ORACLE',apply:s=>replaceOnce(s,'      if(proven)requiresEncryption=requiresEncryption||proven.credential;','      if(proven){}','ignore-proven-credential')},
 'export-in-page':{oracle:'HISTORY_PROOF_HIT_ORACLE',apply:s=>replaceOnce(s,"  if(useStoreWorker())return requestStoreWorker('EXPORT_PACKAGE',[jobId,{passphrase,historyRecovery}]);\n","",'export-in-page')}
});

// Test-only observation (never a production export): the worker ledger and
// counts of cold root validations, snapshot decodes and proof hits.
export function observed(source){
 source=replaceOnce(source,LEDGER,LEDGER+'globalThis.__historyProofLedger={roots:()=>[...historyRootProofs.values()].flatMap(bucket=>[...bucket.values()]).map(proof=>({kind:proof.kind,jobId:proof.jobId,snapshotSha256:proof.snapshotSha256,id:proof.id})),pairs:()=>[...historyPairProofs.values()].reduce((count,bucket)=>count+bucket.size,0)};','ledger');
 source=replaceOnce(source,COLD_ROOT,'if(globalThis.__historyCounts)globalThis.__historyCounts.coldRoots++;'+COLD_ROOT,'cold-root');
 source=replaceOnce(source,SNAPSHOT_DECODE,'if(globalThis.__historyCounts)globalThis.__historyCounts.decodes++;'+SNAPSHOT_DECODE,'decode');
 source=replaceOnce(source,EXPORT_HIT,'    historyProofUsed(operation,proof);if(globalThis.__historyCounts)globalThis.__historyCounts.exportHits++;\n    return {payload:','export-hit');
 source=replaceOnce(source,IMPORT_HIT,IMPORT_HIT+'if(globalThis.__historyCounts)globalThis.__historyCounts.importHits++;','import-hit');
 return source;
}
const counts=()=>({coldRoots:0,decodes:0,exportHits:0,importHits:0});

// Page realm + storage-worker realm(s) over ONE database. Every message is a
// copy made in the receiving realm, delivered asynchronously. A lost worker is
// replaced by a new worker realm (empty ledger); a reload is a new pair.
export function browser(source,database=null,{environment={}}={}){
 const workers=[];let page=null;
 class StoreWorker{
  constructor(url){
   const target=new URL(String(url));assert.equal(target.searchParams.get('storeWorker'),'1','HISTORY_PROOF_WORKER_ORACLE');assert.equal(target.searchParams.get('v'),BUILD,'HISTORY_PROOF_WORKER_ORACLE');
   const listeners=[],port=this;
   this.realm=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{...environment,__historyCounts:counts(),location:{search:`?v=${BUILD}&storeWorker=1&storeContext=${BUILD}-PAGE`},URLSearchParams,importScripts(){},addEventListener(type,listener){if(type==='message')listeners.push(listener);},postMessage(message){const data=page.copy(message);setTimeout(()=>port.onmessage?.({data}),0);}}});
   this.listeners=listeners;shareRows(this.realm,rows);workers.push(this);
  }
  postMessage(message){const data=this.realm.copy(message);setTimeout(()=>{for(const listener of this.listeners)listener({data});},0);}
  terminate(){this.terminated=true;}
 }
 page=projectStoreRuntime({sourceOverrides:{'project-store.js':replaceOnce(source,PAGE_SCRIPT,'const STORE_SCRIPT_URL=globalThis.__storeScriptUrl;','page-script')},environment:{...environment,__historyCounts:counts(),Worker:StoreWorker,__storeScriptUrl:`https://closed-loop.invalid/project-store.js?v=${BUILD}`}});
 const rows=database||page.rows;if(database)shareRows(page,rows);
 const worker=()=>workers.at(-1);
 return {page,store:page.store,rows,workers,worker,ledger:()=>worker()?.realm.runtime.__historyProofLedger.roots()||[],counts:()=>worker().realm.runtime.__historyCounts,
  resetCounts(){for(const entry of workers)entry.realm.runtime.__historyCounts=counts();page.runtime.__historyCounts=counts();},
  // The production lost-worker path: the page drops and terminates this
  // worker; the next command starts a new one.
  loseWorker(){worker().onerror({message:'Synthetic storage worker loss.'});}};
}
function shareRows(realm,rows){realm.rows.get=name=>rows.get(name);realm.rows.set=(name,value)=>rows.set(name,value);}
// A fresh runtime (no worker, no proofs) over a copy of the same rows.
function coldCopy(rows,source){const cold=projectStoreRuntime(source?{sourceOverrides:{'project-store.js':source}}:{});for(const [name,data]of rows)cold.rows.set(name,new Map([...data].map(([key,value])=>[key,cold.copy(value)])));return cold;}
async function packageDigest(blob){
 if(!(blob instanceof Blob))return {blob:false};
 if(blob.type!=='application/gzip')return {type:blob.type,byteSize:blob.size};
 const body=JSON.parse(gunzipSync(Buffer.from(await blob.arrayBuffer())).toString('utf8'));assert.equal(typeof body.exportedAt,'string');assert.match(body.packageSha256,/^[a-f0-9]{64}$/);
 delete body.exportedAt;delete body.packageSha256;return {type:blob.type,bodySha256:sha(JSON.stringify(body)),checkpoints:body.recovery?.entries?.length||0};
}
async function exportOutcome(store,jobId,options={}){
 try{return {ok:true,...await packageDigest(await store.exportPackage(jobId,options))};}
 catch(error){return {ok:false,code:error?.code??null,message:String(error?.message||error),issues:Array.isArray(error?.issues)?[...error.issues]:null};}
}
async function storeFile(r,next,{stage,filename,text,commandId}){
 const blob=new Blob([text],{type:'text/plain'}),sha256=await r.runtime.closedLoopHash.sha256Bytes(blob),jobId=next.job.JOB_ID;
 const artifactId=r.engine.allocateId(next,'artifacts',r.copy({commandId,targetSlot:'',parentId:'',idempotencyKey:'FILE_INTAKE',payload:{stage,filename,mediaType:'text/plain',byteSize:blob.size,sha256,lineage:{}}}));
 const row=r.copy({artifactId,jobId,filename,mediaType:'text/plain',byteSize:blob.size,sha256,lineage:{stage,role:'STAGE_FILE',logicalPath:filename},createdAt:new Date().toISOString()});row.blob=blob;
 const stored=await r.store.putArtifact({...row,expectedSha256:sha256});
 r.engine.registerArtifactBytesBatch(next,r.copy([{stage,artifactId:stored.artifactId,filename:stored.filename,mediaType:stored.mediaType,byteSize:stored.byteSize,sha256:stored.sha256,lineage:stored.lineage}]));
 return stored;
}
const retainedText=n=>'Exact retained History title '+n+' '+'independent retained content '.repeat(300);
// Roots with retained parts, view references, a root superseded without a
// checkpoint (lazy first use) and 'Previous project' references (new files).
export async function fixture(b){
 const {store,page}=b,engine=page.engine;
 let p=await store.createProject({commandId:'HISTORY-PROOF-REUSE'});const jobId=p.job.JOB_ID;
 const view=(n,name='Workflow')=>page.copy({activeStage:1,activeView:name,drafts:{'#exact':{value:'Exact draft '+n}},scrollX:0,scrollY:n});
 const write=async(n,file=null)=>{const next=store.clone(p);next.job.JOB_TITLE=retainedText(n);if(file)await storeFile(page,next,{stage:1,filename:file+'.txt',text:'Exact Stage 1 file '+file+'.\n',commandId:'HISTORY-PROOF-REUSE-'+file});p=await store.writeProject(next,{expectedProjectRevision:p.revision});};
 const save=async n=>store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:view(n),label:'Saved view'});
 await write(1,'first');await save(1);await save(2);
 await write(2);                       // superseded without a checkpoint
 await write(3,'second');await save(3);
 // A file stored outside a write: the next checkpoint pairs the active root
 // with the changed inventory ('Previous project').
 {const next=store.clone(p);await storeFile(page,next,{stage:1,filename:'third.txt',text:'Exact Stage 1 file third.\n',commandId:'HISTORY-PROOF-REUSE-third'});}
 await save(4);
 await write(4);await save(5);
 const state=await store.metaGet('recovery:'+jobId);
 assert.ok(state.entries.some(entry=>entry.projectReference)&&state.entries.filter(entry=>!entry.projectReference).length>=4,'HISTORY_PROOF_FIXTURE_ORACLE: roots and view references');
 assert.ok(state.entries.some(entry=>Object.hasOwn(entry,'projectPartsSha256')),'HISTORY_PROOF_FIXTURE_ORACLE: state-form roots with retained parts');
 assert.ok(state.entries.some(entry=>entry.label==='Previous project'),'HISTORY_PROOF_FIXTURE_ORACLE: a Previous project version');
 return {jobId,project:p,state};
}
const historyOf=(rows,jobId)=>rows.get('meta').get('recovery:'+jobId).value;
const snapshotRow=(rows,jobId,id)=>rows.get('meta').get('recovery:'+jobId+':snapshot:'+id);
const fileRow=(rows,jobId,sha256)=>rows.get('meta').get('recovery:'+jobId+':bytes:'+sha256);
function corrupt(blob){return new Blob([new Uint8Array(blob.size).fill(0x58)],{type:blob.type});}

// Each fault: apply in place (returning its undo), plus an optional realm
// change applied identically to the proof-holding worker and the cold runtime.
function faultCases(jobId){
 const roots=rows=>historyOf(rows,jobId).entries.filter(entry=>!entry.projectReference),refs=rows=>historyOf(rows,jobId).entries.filter(entry=>entry.projectReference);
 const stateRoot=rows=>roots(rows).find(entry=>Object.hasOwn(entry,'projectPartsSha256'));
 const firstPart=rows=>snapshotRow(rows,jobId,stateRoot(rows).id).value.projectParts.entries[0];
 const edit=(select,field,value)=>rows=>{const entry=select(rows),before=Object.hasOwn(entry,field),prior=entry[field];entry[field]=typeof value==='function'?value(entry,rows):value;return ()=>{if(before)entry[field]=prior;else delete entry[field];};};
 const replaceBlob=(row)=>{const prior=row.value.blob;row.value.blob=corrupt(prior);return ()=>{row.value.blob=prior;};};
 const realmSwap=(apply)=>({realm:apply});
 return [
  ['snapshot-root-bytes',rows=>replaceBlob(snapshotRow(rows,jobId,stateRoot(rows).id))],
  ['snapshot-reference-bytes',rows=>replaceBlob(snapshotRow(rows,jobId,refs(rows)[0].id))],
  ['part-bytes',rows=>replaceBlob(fileRow(rows,jobId,firstPart(rows).sha256))],
  ['part-removed',rows=>{const key='recovery:'+jobId+':bytes:'+firstPart(rows).sha256,row=rows.get('meta').get(key);rows.get('meta').delete(key);return ()=>rows.get('meta').set(key,row);}],
  ['N1-state-form-digest',edit(stateRoot,'projectPartsSha256','f'.repeat(64))],
  ['N2-record-part-size',rows=>{const part=firstPart(rows),prior=part.byteSize;part.byteSize=prior+1;return ()=>{part.byteSize=prior;};}],
  ['N3-both-fields',rows=>{const entry=stateRoot(rows);entry.projectParts=structuredClone(snapshotRow(rows,jobId,entry.id).value.projectParts);return ()=>{delete entry.projectParts;};}],
  ['N3-reference-digest',edit(rows=>refs(rows)[0],'projectPartsSha256',(entry,rows)=>stateRoot(rows).projectPartsSha256)],
  ['N3-uppercase-digest',edit(stateRoot,'projectPartsSha256',entry=>entry.projectPartsSha256.toUpperCase())],
  ['N3-short-digest',edit(stateRoot,'projectPartsSha256',entry=>entry.projectPartsSha256.slice(1))],
  ['N4-unretained-part',rows=>{const state=historyOf(rows,jobId),part=firstPart(rows),files=state.files;state.files=Object.fromEntries(Object.entries(files).filter(([sha256])=>sha256!==part.sha256));state.retainedFileBytes-=files[part.sha256].byteSize;return ()=>{state.files=files;state.retainedFileBytes+=files[part.sha256].byteSize;};}],
  ['entry-parent',edit(rows=>roots(rows).at(-1),'parentId',(entry,rows)=>roots(rows)[0].id)],
  ['entry-label',edit(stateRoot,'label','Edited label')],
  ['entry-created-at',edit(stateRoot,'createdAt','2026-01-01T00:00:00.000Z')],
  ['entry-view-stage',edit(stateRoot,'stage',2)],
  ['entry-view-digest',edit(rows=>refs(rows)[0],'viewSha256','e'.repeat(64))],
  ['entry-project-reference',edit(rows=>refs(rows)[0],'projectReference',entry=>({...entry.projectReference,snapshotSha256:'d'.repeat(64)}))],
  ['entry-work-digest',edit(rows=>refs(rows)[0],'workSha256','c'.repeat(64))],
  ['record-label',rows=>{const row=snapshotRow(rows,jobId,stateRoot(rows).id).value,prior=row.label;row.label='Edited record label';return ()=>{row.label=prior;};}],
  ['record-parent',rows=>{const row=snapshotRow(rows,jobId,stateRoot(rows).id).value,prior=row.parentId;row.parentId=roots(rows).at(-1).id;return ()=>{row.parentId=prior;};}],
  ['stale-manifest-active',edit(rows=>historyOf(rows,jobId),'activeProjectSha256','b'.repeat(64))],
  ['stale-manifest-snapshot',edit(stateRoot,'sha256',(entry,rows)=>roots(rows).find(other=>other.id!==entry.id).sha256)],
  // Malicious swaps change only what an earlier version decodes to, so a cold
  // export refuses while the current project still verifies.
  ['swap-text-encoder',null,realmSwap(t=>{const original=t.TextEncoder.prototype.encode;t.TextEncoder.prototype.encode=function(text){return original.call(this,typeof text==='string'?text.replace('History title 1 ','History title 9 '):text);};return ()=>{t.TextEncoder.prototype.encode=original;};})],
  ['swap-hash-sha256-bytes',null,realmSwap(t=>{const original=t.closedLoopHash;t.closedLoopHash=Object.freeze({...original,sha256Bytes:async bytes=>original.sha256Bytes(bytes)});return ()=>{t.closedLoopHash=original;};})],
  ['swap-json-parse',null,realmSwap(t=>{const original=t.JSON.parse;t.JSON.parse=function(text,reviver){const value=original.call(this,text,reviver);if(value==='Starting project')return 'Swapped label';if(value&&typeof value==='object'&&value.schema==='closed-loop-recovery/1'&&value.label==='Starting project')value.label='Swapped label';return value;};return ()=>{t.JSON.parse=original;};})],
  ['swap-json-parse-benign',null,realmSwap(t=>{const original=t.JSON.parse;t.JSON.parse=function(text,reviver){return original.call(this,text,reviver);};return ()=>{t.JSON.parse=original;};})],
  ['swap-decompression-stream',null,realmSwap(t=>{const original=t.DecompressionStream;t.DecompressionStream=class{constructor(format){const inner=new original(format);this.writable=inner.writable;this.readable=inner.readable.pipeThrough(new TransformStream({transform(chunk,controller){const bytes=Buffer.from(chunk),at=bytes.indexOf('"label":"Starting project"');if(at>=0)bytes.write('"label":"Starting projecT"',at);controller.enqueue(new Uint8Array(bytes));}}));}};return ()=>{t.DecompressionStream=original;};})],
  ['swap-decompression-stream-benign',null,realmSwap(t=>{const original=t.DecompressionStream;t.DecompressionStream=class extends original{};return ()=>{t.DecompressionStream=original;};})],
  ['swap-blob-array-buffer',null,realmSwap(t=>{const original=t.Blob.prototype.arrayBuffer;t.Blob.prototype.arrayBuffer=function(){return original.call(this);};return ()=>{t.Blob.prototype.arrayBuffer=original;};})],
  ['validator-engine-property',null,realmSwap(t=>{const original=t.closedLoopWorkflowEngine;t.closedLoopWorkflowEngine=Object.freeze({...original,projectionVersionNote:'changed validator graph'});return ()=>{t.closedLoopWorkflowEngine=original;};})],
  ['validator-schema-definition',null,realmSwap(t=>{const original=t.closedLoopWorkflowSchema,shape=original.projectShapeIssues;t.closedLoopWorkflowSchema=Object.freeze({...original,projectShapeIssues:(project,collections)=>Number(project?.revision)<4?['Injected schema definition refuses an earlier version.',...shape(project,collections)]:shape(project,collections)});return ()=>{t.closedLoopWorkflowSchema=original;};})],
  ['concurrent-generation-bump',null,{transaction:(rows)=>(names,mode)=>{if(mode==='readwrite'&&Array.isArray(names)&&names.length===2&&names.includes('projects')&&names.includes('meta')){const state=historyOf(rows,jobId);state.generation=Number(state.generation||0)+1;}}}]
 ];
}
// Applies one fault, exports in the proof-holding worker and in a fresh cold
// runtime over the same faulted rows, and returns both outcomes and counts.
async function compareFault(b,jobId,[id,apply,realm],source){
 const undo=apply?apply(b.rows):null,generation=historyOf(b.rows,jobId).generation;
 // Realm changes may touch natives shared by every realm of this process, so
 // each runtime's change is applied, used and undone in turn.
 const wrap=(runtime,rows)=>{if(!realm?.transaction)return null;const original=runtime.openStorageTransaction,hook=realm.transaction(rows);runtime.openStorageTransaction=async(names,mode)=>{hook(names,mode);return original(names,mode);};return ()=>{runtime.openStorageTransaction=original;};};
 const run=async(runtime,rows,store)=>{const undoRealm=realm?.realm?realm.realm(runtime):null,unwrap=wrap(runtime,rows);try{return await exportOutcome(store,jobId);}finally{unwrap?.();undoRealm?.();historyOf(rows,jobId).generation=generation;}};
 try{
  b.resetCounts();const proof=await run(b.worker().realm.runtime,b.rows,b.store),proofCounts={...b.counts()};
  const cold=coldCopy(b.rows,source),reference=await run(cold.runtime,cold.rows,cold.store);
  return {id,proof,reference,proofCounts};
 }finally{undo?.();}
}

export async function verifyHistoryProofReuse({fault=null}={}){
 let production=fs.readFileSync('project-store.js','utf8');
 if(fault){assert.ok(HISTORY_PROOF_FAULTS[fault],'Unknown history proof fault: '+fault);production=HISTORY_PROOF_FAULTS[fault].apply(production);}
 const source=observed(production),cases=[],emit=(caseId,details={})=>cases.push({caseId,result:'PASS',...details});
 // 1. Normal write -> checkpoint flow mints proofs; an export then mints the
 // view references' proofs. Both proof-holding states run the fault matrix.
 for(const origin of ['write-checkpoint-flow','after-export']){
  const b=browser(source),{jobId}=await fixture(b);
  if(origin==='after-export'){const first=await exportOutcome(b.store,jobId);assert.equal(first.ok,true,'HISTORY_PROOF_FIXTURE_ORACLE: the first export succeeds');}
  const entries=historyOf(b.rows,jobId).entries,ledger=b.ledger();
  assert.ok(ledger.filter(proof=>proof.kind==='root').length===entries.filter(entry=>!entry.projectReference).length,'HISTORY_PROOF_MINT_ORACLE '+origin+': every root is proven, including the root superseded without a checkpoint');
  if(origin==='after-export')assert.equal(ledger.length,entries.length,'HISTORY_PROOF_MINT_ORACLE after-export: every version is proven');
  // Happy path: every proven entry skips its decode; bytes equal cold.
  b.resetCounts();const proven=await exportOutcome(b.store,jobId),hits={...b.counts()},cold=await exportOutcome(coldCopy(b.rows,production).store,jobId);
  assert.equal(proven.ok,true);assert.deepEqual(proven,cold,'HISTORY_PROOF_BYTES_ORACLE '+origin+': the proven export equals the cold export byte for byte apart from exportedAt');
  assert.equal(hits.coldRoots,0,'HISTORY_PROOF_HIT_ORACLE '+origin+': no proven root is validated again');
  assert.equal(hits.exportHits,origin==='after-export'?entries.length:ledger.length,'HISTORY_PROOF_HIT_ORACLE '+origin+': every proven entry is a hit');
  if(origin==='after-export')assert.equal(hits.decodes,0,'HISTORY_PROOF_HIT_ORACLE after-export: no snapshot is decoded');
  emit('HISTORY-PROOF-HAPPY-'+origin,{entries:entries.length,proofs:ledger.length,exportHits:hits.exportHits,coldRoots:hits.coldRoots,decodes:hits.decodes,bytesEqualCold:true});
  for(const row of faultCases(jobId)){
   const result=await compareFault(b,jobId,row,production);
   assert.deepEqual(result.proof,result.reference,'HISTORY_PROOF_EQUIVALENCE_ORACLE '+origin+' '+row[0]+': a proof-holding worker must export exactly as a fresh cold runtime');
   emit('HISTORY-PROOF-FAULT-'+origin+'-'+row[0],{refused:!result.proof.ok,code:result.proof.code??null,coldFallback:result.proofCounts.decodes>0||result.proofCounts.coldRoots>0||!result.proof.ok});
  }
  // Refused bytes never minted: the ledger holds only the original snapshots.
  const shas=new Set(historyOf(b.rows,jobId).entries.map(entry=>entry.sha256));
  assert.ok(b.ledger().every(proof=>shas.has(proof.snapshotSha256)),'HISTORY_PROOF_REFUSED_NEVER_MINTS_ORACLE '+origin);
  // The faults are undone: the same worker exports from its proofs again.
  b.resetCounts();const again=await exportOutcome(b.store,jobId);assert.deepEqual(again,proven,'HISTORY_PROOF_RESTORED_ORACLE '+origin);assert.equal(b.counts().coldRoots,0,'HISTORY_PROOF_RESTORED_ORACLE '+origin);
  if(origin==='after-export'){
   // Tier 2: a same-session import of the just-exported backup carries proven
   // versions; a fresh worker over a copy of the same store imports cold. The
   // two results are identical.
   const backup=await b.store.exportPackage(jobId),before=new Map([...b.rows].map(([name,data])=>[name,new Map([...data].map(([key,value])=>[key,b.page.copy(value)]))]));
   b.resetCounts();const same=await b.store.importPackage(backup),sameCounts={...b.counts()};
   const fresh=browser(source,before);fresh.resetCounts();const other=await fresh.store.importPackage(backup),freshCounts=fresh.counts();
   assert.equal(fresh.workers.length,1,'HISTORY_PROOF_TIER2_ORACLE: the fresh import ran in its own new worker');
   const activation=new Set(b.page.runtime.closedLoopWorkflowSchema.RECOVERY_SOURCE_REFERENCE_CONTRACT.activationFields),work=project=>JSON.stringify(Object.fromEntries(Object.entries(project).filter(([key])=>!activation.has(key)&&key!=='projectSha256')));
   assert.equal(work(same),work(other),'HISTORY_PROOF_IMPORT_ORACLE: the same-session import equals the cold import');
   // Realm-neutral strings: each database's rows belong to its own realm.
   const imported=(rows,id)=>Array.from(historyOf(rows,id).entries,entry=>JSON.stringify(entry)).filter(text=>entries.some(row=>text.startsWith('{"id":'+JSON.stringify(row.id)+',')));
   assert.deepEqual(imported(b.rows,jobId),imported(before,jobId),'HISTORY_PROOF_IMPORT_ORACLE: identical retained versions');
   assert.equal(historyOf(b.rows,jobId).entries.length,historyOf(before,jobId).entries.length,'HISTORY_PROOF_IMPORT_ORACLE: the same number of retained versions');
   assert.ok(sameCounts.importHits>0,'HISTORY_PROOF_TIER2_ORACLE: the same-session import uses Tier 2 proofs');
   // A fresh worker starts with no proofs; only versions it decodes cold in
   // this same import (the local active version, before the History loop) can
   // be carried within it.
   assert.ok(freshCounts.importHits<sameCounts.importHits,'HISTORY_PROOF_TIER2_ORACLE: a fresh worker imports cold');
   assert.ok(sameCounts.coldRoots<freshCounts.coldRoots,'HISTORY_PROOF_TIER2_ORACLE: proven versions are not decoded again');
   emit('HISTORY-PROOF-IMPORT-TIER2',{importHits:sameCounts.importHits,coldRoots:sameCounts.coldRoots,freshColdRoots:freshCounts.coldRoots,identical:true});
   // Worker loss: proofs die with the worker; the next export is cold and correct.
   const starts=b.workers.length;b.loseWorker();b.resetCounts();
   const lost=await exportOutcome(b.store,jobId),lostCounts=b.counts(),reference=await exportOutcome(coldCopy(b.rows,production).store,jobId);
   assert.equal(b.workers.length,starts+1,'HISTORY_PROOF_WORKER_LOSS_ORACLE: a new storage worker realm');
   assert.deepEqual(lost,reference,'HISTORY_PROOF_WORKER_LOSS_ORACLE: the export after worker loss is correct');// A new worker realm holds a new, empty ledger: its export verifies cold
   // (proofs it mints from its own cold reads may serve later entries).
   assert.ok(lostCounts.coldRoots>0,'HISTORY_PROOF_WORKER_LOSS_ORACLE: the export after worker loss is cold');
   // Reload: a new page and worker over the same database.
   const reloaded=browser(source,b.rows);reloaded.resetCounts?.();const afterReload=await exportOutcome(reloaded.store,jobId);
   assert.deepEqual(afterReload,reference,'HISTORY_PROOF_RELOAD_ORACLE');assert.ok(reloaded.counts().coldRoots>0,'HISTORY_PROOF_RELOAD_ORACLE: the first export after a reload is cold');
   emit('HISTORY-PROOF-WORKER-LOSS-AND-RELOAD',{lostColdRoots:lostCounts.coldRoots,reloadColdRoots:reloaded.counts().coldRoots,correct:true});
  }
  // Export ran in the storage worker: the page realm never decoded History.
  assert.equal(b.page.runtime.__historyCounts.decodes,0,'HISTORY_PROOF_WORKER_ROUTING_ORACLE: export runs in the storage worker');
  assert.equal(b.page.runtime.__historyProofLedger.roots().length,0,'HISTORY_PROOF_WORKER_ROUTING_ORACLE: the page realm holds no proofs');
 }
 // 2. verify-recoverable-history 191-199 in ONE proof-holding worker: a valid
 // active version must not hide an incompatible earlier checkpoint.
 {
  const anchor='try{assertProjectIntegrity(row.project,{verifyDerived:false});}catch(error){if(!legacyJobPointerProjection(row.project,{verifyDerived:false})){await quarantine';
  const permissiveReader=replaceOnce(source,anchor,'try{assertProjectIntegrity(row.project,{verifyDerived:false,verifyProjection:false});}catch(error){if(!legacyJobPointerProjection(row.project,{verifyDerived:false})){await quarantine','legacy-reader');
  const b=browser(permissiveReader),{jobId,project}=await fixture(b);
  assert.equal((await exportOutcome(b.store,jobId)).ok,true,'HISTORY_PROOF_NESTED_FIXTURE_ORACLE');
  const saved=b.page.copy(b.rows.get('projects').get(jobId)),bad=b.page.copy(saved);bad.project.job.CURRENT_STAGE='STAGE 30';bad.projectSha256=b.store.projectSha256(bad.project);b.rows.get('projects').set(jobId,bad);
  const incompatible=await b.store.saveCheckpoint(jobId,{expectedProjectRevision:project.revision,label:'Older incompatible projection'});
  b.rows.get('projects').set(jobId,saved);
  await b.store.saveCheckpoint(jobId,{expectedProjectRevision:project.revision,label:'Compatible active version'});
  const refused=await exportOutcome(b.store,jobId),cold=await exportOutcome(coldCopy(b.rows,permissiveReader.replace(LEDGER,LEDGER)).store,jobId);
  assert.equal(refused.ok,false,'HISTORY_PROOF_NESTED_ORACLE: the proof-holding export refuses the incompatible retained checkpoint');
  assert.equal(refused.code,'PROJECT_INTEGRITY_FAILED','HISTORY_PROOF_NESTED_ORACLE');assert.ok(refused.issues.some(issue=>/Application projection receipt is invalid|CURRENT_STAGE/.test(issue)),'HISTORY_PROOF_NESTED_ORACLE: issues carried from the worker');
  assert.deepEqual(refused,cold,'HISTORY_PROOF_NESTED_ORACLE: identical to the cold export');
  const entry=historyOf(b.rows,jobId).entries.find(row=>row.id===incompatible);
  assert.ok(entry&&!b.ledger().some(proof=>proof.snapshotSha256===entry.sha256),'HISTORY_PROOF_REFUSED_NEVER_MINTS_ORACLE: the incompatible root has no proof');
  emit('HISTORY-PROOF-NESTED-INCOMPATIBLE',{code:refused.code,issueCount:refused.issues.length,minted:false});
 }
 // 3. A permissive writer (in-memory mutant) certifies a root that the cold
 // check refuses: its certificate is byte-verified, but it never mints.
 {
  const validation='try{assertProjectIntegrity(next,{prior,verifyDerived:!commitDerives,requireCurrentProjection:true});}catch(error){if(commitDerives&&error?.code===\'PROJECT_INTEGRITY_FAILED\')assertProjectIntegrity(next,{prior});throw error;}';
  const derived="    const issues=derivedProjectIntegrityIssues(next);\n    if(issues.length)throw";
  let permissive=replaceOnce(replaceOnce(source,validation,'if(globalThis.__permissiveWriter){next.job.CURRENT_STAGE=\'STAGE 30\';}else{'+validation+'}','permissive-writer'),derived,"    const issues=derivedProjectIntegrityIssues(next);\n    if(issues.length&&!globalThis.__permissiveWriter)throw",'permissive-writer-derivation');
  const b=browser(permissive),{jobId}=await fixture(b);let p=await b.store.readProject(jobId);
  b.worker().realm.runtime.__permissiveWriter=true;
  const next=b.store.clone(p);next.job.JOB_TITLE=retainedText('permissive');p=await b.store.writeProject(next,{expectedProjectRevision:p.revision});
  b.worker().realm.runtime.__permissiveWriter=false;
  const root=historyOf(b.rows,jobId).entries.find(entry=>entry.id===historyOf(b.rows,jobId).activeId);
  let checkpoint=null;try{await b.store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,view:b.page.copy({activeStage:1,activeView:'Records',drafts:{},scrollX:0,scrollY:7})});checkpoint='SAVED';}catch(error){checkpoint=error.code;}
  const refused=await exportOutcome(b.store,jobId),cold=await exportOutcome(coldCopy(b.rows,production).store,jobId);
  assert.equal(b.ledger().some(proof=>proof.snapshotSha256===root.sha256),false,'HISTORY_PROOF_PERMISSIVE_WRITER_ORACLE: a certificate the cold check refuses never mints');
  assert.equal(refused.ok,false,'HISTORY_PROOF_PERMISSIVE_WRITER_ORACLE: the export refuses the permissively written root');
  assert.deepEqual(refused,cold,'HISTORY_PROOF_PERMISSIVE_WRITER_ORACLE: identical to the cold export');
  emit('HISTORY-PROOF-PERMISSIVE-WRITER',{checkpoint,code:refused.code,minted:false});
 }
 // 4. Credential material only a retained version carries still requires a
 // backup password when that version is proven: its classification is the
 // proof's, computed from the same bytes.
 {
  const b=browser(source),{jobId}=await fixture(b);let p=await b.store.readProject(jobId);
  await b.store.putArtifact({artifactId:'HISTORY-PROOF-SECRET',jobId,blob:new Blob(['Exact retained secret bytes.']),filename:'retained-secret.bin',lineage:b.page.copy({stage:1,DISCLOSURE_CLASSIFICATION:'CREDENTIAL_SECRET'})});
  await b.store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,label:'Saved view'});
  await b.store.deleteArtifact('HISTORY-PROOF-SECRET',jobId);
  const passphrase='history proof reuse passphrase',protectedExport=await b.store.exportPackage(jobId,{passphrase});
  assert.equal(protectedExport.type,'application/vnd.closed-loop.encrypted+json','HISTORY_PROOF_CREDENTIAL_FIXTURE_ORACLE: the retained secret requires protection');
  b.resetCounts();const refused=await exportOutcome(b.store,jobId),hits=b.counts().exportHits,cold=await exportOutcome(coldCopy(b.rows,production).store,jobId);
  assert.ok(hits>0,'HISTORY_PROOF_CREDENTIAL_ORACLE: the proven versions are hits');
  assert.equal(refused.code,'BACKUP_PASSPHRASE_REQUIRED','HISTORY_PROOF_CREDENTIAL_ORACLE: a proven retained secret still requires a backup password');
  assert.deepEqual(refused,cold,'HISTORY_PROOF_CREDENTIAL_ORACLE: identical to the cold export');
  emit('HISTORY-PROOF-RETAINED-CREDENTIAL',{code:refused.code,exportHits:hits});
 }
 // 5. The measured, finite History watchdog: EXPORT_PACKAGE and IMPORT_PACKAGE
 // use it; every other command keeps the 600000 ms storage watchdog. A fired
 // watchdog rejects the export with the worker-loss code; no receipt exists.
 {
  const delays=[],timers=[];
  class SilentWorker{postMessage(){}terminate(){this.terminated=true;}}
  const r=projectStoreRuntime({sourceOverrides:{'project-store.js':replaceOnce(production,PAGE_SCRIPT,'const STORE_SCRIPT_URL=globalThis.__storeScriptUrl;','watchdog-page')},environment:{Worker:SilentWorker,__storeScriptUrl:`https://closed-loop.invalid/project-store.js?v=${BUILD}`,setTimeout:(callback,delay)=>{if(delay>=600000){delays.push(delay);timers.push(callback);return timers.length;}return setTimeout(callback,delay);}}});
  assert.equal(r.store.STORAGE_WORKER_HISTORY_TIMEOUT_MS,HISTORY_WATCHDOG_MS,'HISTORY_PROOF_WATCHDOG_PIN_ORACLE: the exported bound equals its stated arithmetic');
  assert.ok(Number.isFinite(HISTORY_WATCHDOG_MS)&&HISTORY_WATCHDOG_MS>r.store.STORAGE_WORKER_TIMEOUT_MS,'HISTORY_PROOF_WATCHDOG_PIN_ORACLE: finite and above the command watchdog');
  const exported=r.store.exportPackage('JOB-WATCHDOG',{});await new Promise(resolve=>setTimeout(resolve,10));
  const written=r.store.writeProject({job:{JOB_ID:'JOB-WATCHDOG'}});await new Promise(resolve=>setTimeout(resolve,10));
  const imported=r.store.importPackage(new Blob(['{}']));await new Promise(resolve=>setTimeout(resolve,10));
  assert.deepEqual(delays,[HISTORY_WATCHDOG_MS,r.store.STORAGE_WORKER_TIMEOUT_MS,HISTORY_WATCHDOG_MS],'HISTORY_PROOF_WATCHDOG_ORACLE: per-command bounds');
  written.catch(()=>{});imported.catch(()=>{});timers[0]();
  await assert.rejects(exported,error=>error.code==='STORAGE_WORKER_STOPPED'&&error.message===`Storage worker did not return within ${HISTORY_WATCHDOG_MS} ms. Its durable commit receipt is being checked before retry is permitted.`&&error.existingProjectsUnchanged===true,'HISTORY_PROOF_WATCHDOG_ORACLE: a fired export watchdog rejects without a receipt read');
  emit('HISTORY-PROOF-WATCHDOG',{historyTimeoutMs:HISTORY_WATCHDOG_MS,commandTimeoutMs:r.store.STORAGE_WORKER_TIMEOUT_MS});
 }
 return {result:'PASS',synthetic:true,actualBrowser:false,transactionAdapter:true,storageWorkerRealm:true,productionSourceSha256:sha(fs.readFileSync('project-store.js','utf8')),watchdogMs:HISTORY_WATCHDOG_MS,caseCount:cases.length,cases};
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 const requested=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8)||null;
 if(requested){await verifyHistoryProofReuse({fault:requested});console.log(JSON.stringify({fault:requested,detected:false}));process.exitCode=1;}
 else{
  const result=await verifyHistoryProofReuse(),faults=[];
  for(const [name,{oracle}]of Object.entries(HISTORY_PROOF_FAULTS)){
   await assert.rejects(()=>verifyHistoryProofReuse({fault:name}),error=>error?.code==='ERR_ASSERTION'&&String(error.message).includes(oracle),'HISTORY_PROOF_INTENDED_FAULT_ORACLE '+name);
   faults.push({fault:name,detected:true,oracle});
  }
  console.log(JSON.stringify({historyProofReuse:{...result,faults}},null,1));
 }
}
