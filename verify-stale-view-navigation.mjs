import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const cases=[];
async function fixture({sameRevision=false}={}){
 const sourceOverrides=process.env.PROJECT_STORE_SOURCE?{'project-store.js':fs.readFileSync(process.env.PROJECT_STORE_SOURCE,'utf8')}:{};
 const {runtime,store,core,engine,copy,rows}=projectStoreRuntime({sourceOverrides});
 let original=core.createBlankState('STALE-VIEW-ORIGINAL');engine.ensureShape(original);engine.recalculate(original);
 original=await store.writeProject(original,{expectedProjectRevision:0});await store.beginHistorySession('STALE-VIEW-SESSION');
 const entries=[],nodes=new Map(),errors=[];
 const node={value:'',textContent:'',disabled:false,hidden:true,isConnected:true,focus(){},click(){},scrollIntoView(){},setAttribute(key,value){(this.attrs??={})[key]=String(value);},removeAttribute(key){delete this.attrs?.[key];},getAttribute(key){return this.attrs?.[key]??null;},classList:{add(){},remove(){}}};
 const draft={...node,id:'response-note',type:'textarea',value:'Unsubmitted draft from the original version',dataset:{}};nodes.set('#response-note',draft);
 Object.assign(runtime,{AbortController,URL,CSS:{escape:String},structuredClone:copy,location:{href:'https://disposable.test/'},sessionStorage:{getItem:()=>null,setItem(){}},selected:original,observedErrors:errors,requestAnimationFrame:fn=>queueMicrotask(fn)});
 runtime.history={get state(){return entries.at(-1)?.state||null;},pushState(state,_title,url){entries.push({state:copy(state),url:String(url)});},replaceState(state,_title,url){entries.splice(Math.max(0,entries.length-1),1,{state:copy(state),url:String(url)});}};
 runtime.window={scrollX:0,scrollY:37,scrollTo(){},addEventListener(){}};
 runtime.document={currentScript:null,querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{...node});return nodes.get(selector);},querySelectorAll:selector=>selector==='#screen input,#screen textarea,#screen select'?[draft]:[],addEventListener(){},dispatchEvent(){}};
 const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
 vm.runInContext(source.slice(0,source.indexOf('globalThis.closedLoopAppReady=false;'))+`
 core=closedLoopCore;schema=closedLoopWorkflowSchema;engine=closedLoopWorkflowEngine;ingestion=closedLoopResponseIngestion;projectStore=closedLoopProjectStore;current=selected;projects=[current];
 render=()=>{};loadAcceptanceSession=async()=>{};refreshProjectStorage=async()=>{};unloadInactiveProjects=()=>{};reportActionFailure=error=>observedErrors.push({code:error.code,message:error.message});
 globalThis.staleViewTest={initialize:initializeHistoryNavigation,newProject:()=>runOperatorAction('Creating project',addNew),capture:captureCurrentView,current:()=>current,save:persistReplacement,storeOverride:value=>{projectStore=value;},draftView:captureView};
 })();`,runtime,{filename:'app-core.js'});
 const ui=runtime.staleViewTest;await ui.initialize();
 const next=copy(original);next.newerSavedWork='PRESERVE';const winner=await store.writeProject(next,{expectedProjectRevision:original.revision,incrementRevision:!sameRevision});
 draft.value='Unsubmitted draft after the other writer saved';
 return {runtime,store,copy,rows,original,winner,ui,errors,draft,entries};
}
async function check(name,run){try{await run();cases.push({name,result:'PASS'});}catch(error){cases.push({name,result:'FAIL',error:String(error.stack||error)});}}

await check('New project completes from a stale tab without replacing newer work or losing its draft',async()=>{
 const {store,original,winner,ui,errors,draft}=await fixture(),before=await store.historyList(original.job.JOB_ID);
 await ui.newProject();
 assert.notEqual(ui.current().job.JOB_ID,original.job.JOB_ID,JSON.stringify(errors));
 assert.deepEqual(await store.readProject(original.job.JOB_ID),winner);
 assert.ok(await store.readProject(ui.current().job.JOB_ID));assert.deepEqual(errors,[]);
 const after=await store.historyList(original.job.JOB_ID);assert.equal(after.activeId,before.activeId);assert.equal(after.activeRevision,before.activeRevision);assert.deepEqual(after.redo,before.redo);
 const retained=[];for(const entry of after.entries)retained.push({entry,view:await store.readHistoryView(original.job.JOB_ID,entry.id)});
 const saved=retained.find(row=>row.view?.drafts?.['#response-note']?.value===draft.value);assert.ok(saved,'The departing draft must remain recoverable.');assert.equal(saved.entry.projectSha256,original.projectSha256,'The draft must bind to its original canonical version.');
 const backup=await store.exportPackage(original.job.JOB_ID),fresh=projectStoreRuntime();await fresh.store.importPackage(backup);assert.deepEqual(structuredClone(await fresh.store.readHistoryView(original.job.JOB_ID,saved.entry.id)),structuredClone(saved.view));
});

await check('A stale canonical write still rejects and preserves the winning revision',async()=>{
 const {store,original,winner,ui,copy}=await fixture(),candidate=copy(original);candidate.job.JOB_TITLE='Stale change must not commit';
 await assert.rejects(ui.save(candidate),error=>error.code==='STALE_PROJECT_REVISION');assert.deepEqual(await store.readProject(original.job.JOB_ID),winner);
});

await check('An unbound checkpoint cannot silently attach a stale draft to newer work',async()=>{
 const {store,original,winner}=await fixture(),before=await store.historyList(original.job.JOB_ID);
 await assert.rejects(store.saveCheckpoint(original.job.JOB_ID,{expectedProjectRevision:original.revision,view:{activeStage:1,drafts:{'#note':{value:'stale'}}}}),error=>error.code==='STALE_PROJECT_REVISION');
 assert.deepEqual(await store.historyList(original.job.JOB_ID),before);assert.deepEqual(await store.readProject(original.job.JOB_ID),winner);
});

await check('Missing or incompatible source identities reject without changing history',async()=>{
 const {store,original,winner,ui}=await fixture(),before=await store.historyList(original.job.JOB_ID);
 for(const digest of ['a'.repeat(64),winner.projectSha256]){
  await assert.rejects(store.saveCheckpoint(original.job.JOB_ID,{expectedProjectRevision:original.revision,expectedStateSha256:digest,view:ui.draftView()}),error=>['STALE_PROJECT_REVISION','HISTORY_VERSION_MISMATCH'].includes(error.code));
  assert.deepEqual(await store.historyList(original.job.JOB_ID),before);assert.deepEqual(await store.readProject(original.job.JOB_ID),winner);
 }
});

await check('A failed history write prevents navigation and preserves the on-screen draft',async()=>{
 const {runtime,store,original,winner,ui,draft,errors}=await fixture(),before=await store.historyList(original.job.JOB_ID),value=draft.value;
 runtime.__closedLoopStorageFault='during-history-write';await ui.newProject();delete runtime.__closedLoopStorageFault;
 assert.equal(ui.current().job.JOB_ID,original.job.JOB_ID);assert.equal(draft.value,value);assert.ok(errors.length);assert.deepEqual(await store.readProject(original.job.JOB_ID),winner);assert.deepEqual(await store.historyList(original.job.JOB_ID),before);
});

await check('Same-revision changes are distinguished by their exact project digest',async()=>{
 const {store,original,winner,ui}=await fixture({sameRevision:true});assert.equal(original.revision,winner.revision);assert.notEqual(original.projectSha256,winner.projectSha256);
 await ui.newProject();assert.notEqual(ui.current().job.JOB_ID,original.job.JOB_ID);assert.deepEqual(await store.readProject(original.job.JOB_ID),winner);
});

await check('A worker recovery receipt identifies the retained source, not the newer active project',async()=>{
 const {store,original,winner,ui}=await fixture(),operationId='STALE-VIEW-WORKER-RECEIPT';
 const id=await store.saveCheckpoint(original.job.JOB_ID,{expectedProjectRevision:original.revision,expectedStateSha256:original.projectSha256,view:ui.draftView(),operationId});
 const receipt=await store.metaGet('storageOperation:'+operationId);assert.equal(receipt.checkpointId,id);assert.equal(receipt.projectSha256,original.projectSha256);assert.equal(receipt.revision,original.revision);assert.equal(receipt.jobId,original.job.JOB_ID);assert.deepEqual(await store.readProject(original.job.JOB_ID),winner);
});

await check('A corrupt retained source cannot be used to preserve or activate a stale draft',async()=>{
 const {store,rows,original,winner,ui,errors}=await fixture(),before=await store.historyList(original.job.JOB_ID),source=before.entries.findLast(entry=>entry.projectSha256===original.projectSha256);
 const row=[...rows.get('meta').values()].find(row=>row.value?.id===source.id&&row.value?.blob);assert.ok(row);row.value.blob=new Blob(['CORRUPT']);
 await ui.newProject();assert.equal(ui.current().job.JOB_ID,original.job.JOB_ID);assert.ok(errors.some(error=>error.code==='HISTORY_SNAPSHOT_INTEGRITY_FAILED'));assert.deepEqual(await store.readProject(original.job.JOB_ID),winner);assert.deepEqual(await store.historyList(original.job.JOB_ID),before);
});

await check('A further concurrent commit rejects an obsolete prepared view atomically, then permits retry',async()=>{
 const {runtime,store,original,winner,ui,copy}=await fixture(),open=runtime.openStorageTransaction;let newest,latestHistory;
 runtime.openStorageTransaction=async(names,mode)=>{
  if(mode==='readwrite'&&Array.isArray(names)&&names.includes('projects')&&names.includes('meta')){
   runtime.openStorageTransaction=open;const next=copy(winner);next.evenNewerSavedWork='PRESERVE TOO';newest=await store.writeProject(next,{expectedProjectRevision:winner.revision});latestHistory=await store.historyList(original.job.JOB_ID);
  }
  return open(names,mode);
 };
 await assert.rejects(ui.capture(),error=>error.code==='STALE_PROJECT_REVISION');assert.ok(newest);assert.deepEqual(await store.readProject(original.job.JOB_ID),newest);assert.deepEqual(await store.historyList(original.job.JOB_ID),latestHistory);
 await ui.newProject();assert.notEqual(ui.current().job.JOB_ID,original.job.JOB_ID);assert.deepEqual(await store.readProject(original.job.JOB_ID),newest);
});

await check('Draft-only file bytes survive stale departure and backup round-trip',async()=>{
 const {copy,store,original,winner,ui}=await fixture(),blob=new Blob(['Exact unsaved attachment bytes']);
 const file=await store.putArtifact({jobId:original.job.JOB_ID,artifactId:'STALE-DRAFT-FILE',filename:'draft.txt',blob,mediaType:'text/plain',lineage:{role:'FILE_SELECTION_RECOVERY',selectionKind:'response',stage:1}});
 const view=ui.draftView();view.fileSelections={response:{jobId:original.job.JOB_ID,kind:'response',stage:1,files:[{artifactId:file.artifactId,filename:file.filename,byteSize:file.byteSize,mediaType:file.mediaType,sha256:file.sha256}]}};
 const id=await store.saveCheckpoint(original.job.JOB_ID,{expectedProjectRevision:original.revision,expectedStateSha256:original.projectSha256,view:copy(view)});assert.deepEqual(await store.readProject(original.job.JOB_ID),winner);
 const fresh=projectStoreRuntime();await fresh.store.importPackage(await store.exportPackage(original.job.JOB_ID));assert.deepEqual(structuredClone(await fresh.store.readHistoryView(original.job.JOB_ID,id)),structuredClone(view));
 const restored=await fresh.store.restoreCheckpoint(original.job.JOB_ID,id),retained=await fresh.store.getArtifact(file.artifactId);assert.equal(await retained.blob.text(),await blob.text());assert.equal(restored.project.newerSavedWork,undefined);
});

console.log(JSON.stringify({basis:'Production UI controller and project store with the existing lifecycle transaction adapter; not browser evidence',cases},null,2));
if(cases.some(row=>row.result==='FAIL'))process.exitCode=1;
