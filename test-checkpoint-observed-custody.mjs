import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime,storedArtifactBody} from './test-project-store-runtime.mjs';

// A write derives its projection receipt under the application's own custody
// observation of the value: the job's custody is forgotten and only the
// selected (current-scope or retained-evidence) artifacts are reread. A stored
// canonical file outside that selection, such as a Stage 1 file superseded by
// a new input version, is therefore recorded UNKNOWN, although its bytes stay
// in the job and in every retained root. View checkpoints after such a write
// must carry the root's derivation exactly as they do for any other root; a
// write that changes the custody derives again, a reload re-derives the root
// once under the custody its receipt was derived under, and corrupted bytes
// are still refused with the same code and message.
//
// The browser runs the store twice: the page realm and the storage worker
// realm (project-store.js?storeWorker=1). This owner reproduces that split:
// two production store realms over ONE transaction-adapter database, each
// copying values into its own realm on every read and put. The page uses the
// production requestStoreWorker path, so writes and checkpoints execute in
// the worker realm through the production message handler, and the page
// performs its own reply-side custody observation. The same scenario also runs
// in one realm; both must behave identically.
const COUNT_ANCHORS=Object.freeze({
 derived:'function derivedProjectIntegrityIssues(project,{verifyCachedProjection=true,projectionObservedAt=null,verifyProjection=true}={}){',
 compatibility:'function assertRecoveryCompatibility(project){'
});
const OBSERVATION_CHOICE='const observedCustody=recoveryDerivationCustody(root.project,project,rootArtifacts);';
const PAGE_SCRIPT="const STORE_SCRIPT_URL=typeof document!=='undefined'?document.currentScript?.src:null;";
const BUILD='CHECKPOINT-OBSERVED-CUSTODY';
function replaceOnce(source,before,after,label){assert.equal(source.split(before).length,2,'CHECKPOINT_OBSERVED_CUSTODY_ANCHOR_ORACLE '+label);return source.replace(before,after);}
function countedSource(source){
 for(const [name,anchor] of Object.entries(COUNT_ANCHORS))source=replaceOnce(source,anchor,anchor+`globalThis.__custodyCounts.${name}++;`,name);
 return source;
}
// Page realm + storage-worker realm sharing one database. Messages cross as
// copies made in the receiving realm, asynchronously, like structured clone.
// A later pair of realms over the same database models a reload.
function browserRealms(source,database=null){
 const counts=()=>({derived:0,compatibility:0}),listeners=[];let page=null,port=null,started=0;
 const worker=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{__custodyCounts:counts(),location:{search:`?v=${BUILD}&storeWorker=1&storeContext=CHECKPOINT-OBSERVED-CUSTODY-PAGE`},importScripts(){},addEventListener(type,listener){if(type==='message')listeners.push(listener);},postMessage(message){const data=page.copy(message);setTimeout(()=>port?.onmessage?.({data}),0);}}});
 class StoreWorker{
  constructor(url){const target=new URL(String(url));assert.equal(target.searchParams.get('storeWorker'),'1','CHECKPOINT_OBSERVED_CUSTODY_WORKER_ORACLE');assert.equal(target.searchParams.get('archiveParser'),null,'CHECKPOINT_OBSERVED_CUSTODY_WORKER_ORACLE');assert.equal(target.searchParams.get('v'),BUILD,'CHECKPOINT_OBSERVED_CUSTODY_WORKER_ORACLE');port=this;started++;}
  postMessage(message){const data=worker.copy(message);setTimeout(()=>{for(const listener of listeners)listener({data});},0);}
  terminate(){}
 }
 page=projectStoreRuntime({sourceOverrides:{'project-store.js':replaceOnce(source,PAGE_SCRIPT,'const STORE_SCRIPT_URL=globalThis.__storeScriptUrl;','page-script')},environment:{__custodyCounts:counts(),Worker:StoreWorker,__storeScriptUrl:`https://closed-loop.invalid/project-store.js?v=${BUILD}`}});
 // One database: both adapters read and commit the same object stores.
 const rows=database||page.rows;for(const realm of database?[page,worker]:[worker]){realm.rows.get=name=>rows.get(name);realm.rows.set=(name,value)=>rows.set(name,value);}
 return {page,worker,database:rows,workerStarts:()=>started};
}
function singleRealm(source,database=null){
 const r=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{__custodyCounts:{derived:0,compatibility:0}},storageWorker:false}),rows=database||r.rows;
 if(database){r.rows.get=name=>rows.get(name);r.rows.set=(name,value)=>rows.set(name,value);}
 return {page:r,worker:r,database:rows,workerStarts:()=>0};
}

async function storeFile(r,next,{stage,filename,text,commandId}){
 const blob=new Blob([text],{type:'text/plain'}),sha256=await r.runtime.closedLoopHash.sha256Bytes(blob),jobId=next.job.JOB_ID;
 const artifactId=r.engine.allocateId(next,'artifacts',r.copy({commandId,targetSlot:'',parentId:'',idempotencyKey:'FILE_INTAKE',payload:{stage,filename,mediaType:'text/plain',byteSize:blob.size,sha256,lineage:{}}}));
 const row=r.copy({artifactId,jobId,filename,mediaType:'text/plain',byteSize:blob.size,sha256,lineage:{stage,role:'STAGE_FILE',logicalPath:filename},createdAt:new Date().toISOString()});row.blob=blob;
 const stored=await r.store.putArtifact({...row,expectedSha256:sha256});
 r.engine.registerArtifactBytesBatch(next,r.copy([{stage,artifactId:stored.artifactId,filename:stored.filename,mediaType:stored.mediaType,byteSize:stored.byteSize,sha256:stored.sha256,lineage:stored.lineage}]));
 return stored;
}
const counted=async(counts,action)=>{const before={...counts};const result=await action();return {result,counts:Object.fromEntries(Object.entries(counts).map(([key,value])=>[key,value-before[key]]))};};
const availability=(project,artifactId)=>project.projectData.applicationProjection.inputObservations.artifactCustody.find(row=>row.artifactId===artifactId)?.availability;
const databaseKeys=database=>JSON.stringify([...database].map(([name,rows])=>[name,[...rows.keys()]]));

async function scenario(create,source){
 let realms=create(source),{page,worker}=realms,store=page.store,engine=page.engine;const database=realms.database;
 let p=await store.createProject({commandId:'CHECKPOINT-OBSERVED-CUSTODY'});const jobId=p.job.JOB_ID;
 // A Stage 1 file registered as canonical bytes, then superseded by a new
 // Stage 1 input version: its record and bytes remain, outside current scope.
 let next=store.clone(p);const superseded=await storeFile(page,next,{stage:1,filename:'superseded.txt',text:'Exact Stage 1 file superseded by the next input version.\n',commandId:'CHECKPOINT-OBSERVED-CUSTODY-SUPERSEDED'});
 p=await store.writeProject(next,{expectedProjectRevision:p.revision});
 assert.equal(availability(p,superseded.artifactId),'TRUE','CHECKPOINT_OBSERVED_CUSTODY_FIXTURE_ORACLE: the current file is observed');
 next=store.clone(p);next.job.EXACT_USER_OBJECTIVE_VERBATIM='Exact objective of the next Stage 1 input version.';engine.recordHumanInputVersion(next,page.copy(['EXACT_USER_OBJECTIVE_VERBATIM']),'HUMAN_OPERATOR');
 p=await store.writeProject(next,{expectedProjectRevision:p.revision});
 assert.equal(engine.recordsForCurrentScope(p,'artifacts').some(row=>engine.recordId(row,'artifacts')===superseded.artifactId),false,'CHECKPOINT_OBSERVED_CUSTODY_FIXTURE_ORACLE: the file is outside current scope');
 assert.equal(availability(p,superseded.artifactId),'UNKNOWN','CHECKPOINT_OBSERVED_CUSTODY_FIXTURE_ORACLE: the receipt records the unobserved stored file as UNKNOWN');
 assert.ok((await store.listArtifacts(jobId)).some(row=>row.artifactId===superseded.artifactId&&row.sha256===superseded.sha256),'CHECKPOINT_OBSERVED_CUSTODY_FIXTURE_ORACLE: the superseded bytes remain stored');
 const view=(name,scrollY)=>page.copy({activeStage:1,activeView:name,drafts:{'#exact':{value:name+' exact draft'}},scrollX:0,scrollY});
 const save=(name,scrollY)=>counted(worker.runtime.__custodyCounts,()=>store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:view(name,scrollY),label:'Saved view',sessionId:'CHECKPOINT-OBSERVED-CUSTODY-SESSION'}));
 const saves={};
 saves.first=await save('Project',11);saves.second=await save('Workflow',23);saves.third=await save('Records',37);
 // The page's own reads publish custody in the page realm only (and, in one
 // realm, only until the next observation); no checkpoint depends on them.
 await store.listArtifacts(jobId);await store.getArtifact(superseded.artifactId);
 saves.afterPageReads=await save('Files',41);
 assert.equal((await store.readHistoryView(jobId,saves.afterPageReads.result)).drafts['#exact'].value,'Files exact draft','CHECKPOINT_OBSERVED_CUSTODY_VIEW_ORACLE');
 // A real custody change: a newly stored current file. Its write derives the
 // new receipt (TRUE for it, still UNKNOWN for the superseded file) under the
 // changed custody, and the next saves carry that derivation of the new root.
 next=store.clone(p);const current=await storeFile(page,next,{stage:1,filename:'current.txt',text:'Exact current Stage 1 file.\n',commandId:'CHECKPOINT-OBSERVED-CUSTODY-CURRENT'});
 const custodyWrite=await counted(worker.runtime.__custodyCounts,()=>store.writeProject(next,{expectedProjectRevision:p.revision}));p=custodyWrite.result;
 assert.ok(custodyWrite.counts.derived>=1,'CHECKPOINT_OBSERVED_CUSTODY_CHANGE_ORACLE: the custody-changing write derives its projection');
 assert.equal(availability(p,current.artifactId),'TRUE','CHECKPOINT_OBSERVED_CUSTODY_CHANGE_ORACLE: the new current file is observed');assert.equal(availability(p,superseded.artifactId),'UNKNOWN','CHECKPOINT_OBSERVED_CUSTODY_CHANGE_ORACLE');
 saves.afterCustodyWrite=await save('Overview',53);saves.afterCustodyWriteWarm=await save('Release',59);
 // A reload: fresh page and worker realms over the same database hold no
 // carried validation, so the first save derives the root again, strictly
 // under the observation its receipt was derived under; later saves carry it.
 realms=create(source,database);({page,worker}=realms);store=page.store;
 p=await store.readProject(jobId);assert.equal(availability(p,superseded.artifactId),'UNKNOWN','CHECKPOINT_OBSERVED_CUSTODY_RELOAD_ORACLE');
 saves.reloadFirst=await save('Project',61);saves.reloadSecond=await save('Workflow',67);saves.reloadThird=await save('Records',71);
 // Corrupted stored bytes of the unobserved file are refused, state unchanged.
 const body=storedArtifactBody({rows:database},superseded.artifactId),original=body.blob;body.blob=new Blob(['X'.repeat(original.size)]);
 const snapshot=databaseKeys(database);let refusal=null;
 try{await save('Project',73);}catch(error){refusal={code:error.code,message:error.message};}finally{body.blob=original;}
 assert.ok(refusal,'CHECKPOINT_OBSERVED_CUSTODY_CORRUPTION_ORACLE: corrupted stored bytes are refused');
 assert.equal(databaseKeys(database),snapshot,'CHECKPOINT_OBSERVED_CUSTODY_CORRUPTION_ORACLE: the refused save writes nothing');
 await save('Workflow',79);
 assert.equal((await store.readProject(jobId)).projectSha256,p.projectSha256,'CHECKPOINT_OBSERVED_CUSTODY_PROJECT_ORACLE');
 return {workerStarts:realms.workerStarts(),saves:Object.fromEntries(Object.entries(saves).map(([key,value])=>[key,value.counts])),custodyWriteDerived:custodyWrite.counts.derived>=1,refusal};
}

export async function verifyCheckpointObservedCustody({fault=null}={}){
 let source=countedSource(fs.readFileSync('project-store.js','utf8'));
 // The superseded overlay-only choice: every root artifact always available.
 if(fault==='overlay-only')source=replaceOnce(source,OBSERVATION_CHOICE,'const observedCustody=null;','fault '+fault);
 const cases=[];
 for(const [mode,create] of [['page-and-worker-realms',browserRealms],['single-realm',singleRealm]]){
  const observed=await scenario(create,source),{saves}=observed,warm={derived:0,compatibility:0};
  if(mode==='page-and-worker-realms')assert.equal(observed.workerStarts,1,'CHECKPOINT_OBSERVED_CUSTODY_WORKER_ORACLE: the reloaded page started its own storage worker for writes and checkpoints');
  for(const key of ['second','third','afterPageReads','afterCustodyWriteWarm','reloadSecond','reloadThird'])assert.deepEqual(saves[key],warm,'CHECKPOINT_OBSERVED_CUSTODY_WARM_ORACLE '+mode+' '+key+': a later view save carries the root derivation');
  for(const key of ['first','afterCustodyWrite'])assert.ok(saves[key].derived<=1,'CHECKPOINT_OBSERVED_CUSTODY_FIRST_SAVE_ORACLE '+mode+' '+key+': the first save after a write derives at most once');
  assert.ok(saves.reloadFirst.compatibility>=1&&saves.reloadFirst.derived>=1,'CHECKPOINT_OBSERVED_CUSTODY_RELOAD_ORACLE '+mode+': the first save after a reload derives the root again');
  cases.push({mode,result:'PASS',...observed});
 }
 // Both realm layouts behave identically: same counts and the same refusal.
 assert.deepEqual(cases[0].saves,cases[1].saves,'CHECKPOINT_OBSERVED_CUSTODY_REALM_PARITY_ORACLE');
 assert.deepEqual(cases[0].refusal,cases[1].refusal,'CHECKPOINT_OBSERVED_CUSTODY_REALM_PARITY_ORACLE');
 return {result:'PASS',caseCount:cases.length,cases,synthetic:true,actualBrowser:false,transactionAdapter:true};
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 const result=await verifyCheckpointObservedCustody();
 await assert.rejects(()=>verifyCheckpointObservedCustody({fault:'overlay-only'}),error=>error.code==='ERR_ASSERTION'&&error.message.includes('CHECKPOINT_OBSERVED_CUSTODY_WARM_ORACLE'),'CHECKPOINT_OBSERVED_CUSTODY_INTENDED_FAULT_ORACLE overlay-only');
 console.log(JSON.stringify({checkpointObservedCustody:{...result,faults:[{fault:'overlay-only',detected:true,oracle:'CHECKPOINT_OBSERVED_CUSTODY_WARM_ORACLE'}]}}));
}
