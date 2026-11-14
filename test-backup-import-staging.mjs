import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
const sha=async blob=>createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
const named=(blob,name)=>{const file=blob.slice(0,blob.size,blob.type);Object.defineProperty(file,'name',{value:name});return file;};
const node=()=>({value:'',textContent:'',hidden:true,open:false,disabled:false,isConnected:true,attrs:{},classList:{add(){},remove(){}},setAttribute(key,value){this.attrs[key]=String(value);},removeAttribute(key){delete this.attrs[key];},getAttribute(key){return this.attrs[key]??null;},closest(){return null;},focus(){},click(){},scrollIntoView(){}});

// Real application import/selection/resume functions and real store transaction
// owner. DOM painting, departing view capture and postcommit presentation are
// isolated stubs; this helper makes no browser/layout or physical-device claim.
async function appRuntime(r,project,source,{beforeImport=null,mobileWitness=null}={}){
 const nodes=new Map(['#resume-backup-import','#backup-passphrase','#backup-protection','#backup-password-continue','#backup-password-help'].map(key=>[key,node()]));
 let importCalls=0;const messages=[],mobile=[],observedMobile=[];
 const facade={...r.store,importPackage:async(blob,options)=>{importCalls++;if(beforeImport)await beforeImport(blob,options);return r.store.importPackage(blob,options);}};
 const controlledMobile=mobileWitness?async file=>{const observed={filename:file.name,sha256:await sha(file),byteSize:file.size,synthetic:true};observedMobile.push(observed);return observed.sha256===mobileWitness.sha256&&observed.filename===mobileWitness.filename?observed:null;}:null;
 Object.assign(r.runtime,{__backupProject:project,__backupStore:facade,__backupMessages:messages,__backupMobile:mobile,__backupMobileWitness:controlledMobile,history:{state:null},document:{currentScript:null,querySelector:key=>{if(!nodes.has(key))nodes.set(key,node());return nodes.get(key);},querySelectorAll:()=>[]},window:{scrollX:0,scrollY:0,addEventListener(){}},requestAnimationFrame:fn=>queueMicrotask(fn)});
 const end=source.indexOf('globalThis.closedLoopAppReady=false;');assert(end>0,'BACKUP_UI_SOURCE_BOUNDARY_ORACLE');
 vm.runInContext(source.slice(0,end)+`
 core=closedLoopCore;schema=closedLoopWorkflowSchema;engine=closedLoopWorkflowEngine;ingestion=closedLoopResponseIngestion;projectStore=__backupStore;current=__backupProject;projects=[current];
 captureCurrentView=async()=>{};captureView=()=>({activeStage:current.activeStage,activeView:'Workflow',fileSelections:clone(fileSelectionDrafts)});
 writeBrowserEntry=()=>{};paintHistory=()=>{};render=()=>{};applySavedView=()=>{};focusAfterAction=()=>{};
 withStorageActivity=async(_label,work)=>work();announce=message=>__backupMessages.push(String(message));reportActionFailure=error=>__backupMessages.push(String(error?.message||error));
 prepareProjectActivation=async project=>({project});installProjectActivation=()=>{};finishProjectActivation=async()=>{await refreshHistory();};recordMobileBackupRestore=async selected=>__backupMobile.push(selected);
 if(__backupMobileWitness)mobileBackupSelection=__backupMobileWitness;
 globalThis.backupImportTest={run:importProjectPackageFile,resume:typeof resumePendingBackupImport==='function'?resumePendingBackupImport:null,refresh:refreshHistory,current:()=>current,saveLegacy:file=>saveFileSelection('backup-import',[file]),readLegacy:()=>readFileSelection('backup-import'),pending:()=>typeof pendingBackupImports==='undefined'?null:pendingBackupImports[current.job.JOB_ID]||null};
 })();`,r.runtime,{filename:'app-core.js:backup-staging-boundary'});
 const ui=r.runtime.backupImportTest;await ui.refresh();
 return {ui,nodes,messages,mobile,observedMobile,calls:()=>importCalls,password:value=>{nodes.get('#backup-passphrase').value=value;}};
}

export async function verifyBackupImportStaging({appSource=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),storeSource=fs.readFileSync('project-store.js','utf8')}={}){
 const markup=fs.readFileSync('index.html','utf8'),helperSource=fs.readFileSync(import.meta.filename,'utf8'),header=markup.match(/<header\b[\s\S]*?<\/header>/)?.[0];assert(header,'BACKUP_RESUME_DISCOVERY_ORACLE');
 const details=[];let resumeAncestors=null;
 for(const match of header.matchAll(/<\/?(?:details|button)\b[^>]*>/g)){
  const tag=match[0];if(tag.startsWith('</details'))details.pop();else if(tag.startsWith('<details'))details.push(tag);else if(tag.startsWith('<button')&&/\bid="resume-backup-import"/.test(tag)){assert.equal(resumeAncestors,null,'BACKUP_RESUME_DISCOVERY_ORACLE: exactly one resume control');resumeAncestors=[...details];}
 }
 assert(resumeAncestors?.some(tag=>/\bclass="project-action-menu"/.test(tag))&&!resumeAncestors.some(tag=>/\bid="backup-protection"/.test(tag)),'BACKUP_RESUME_DISCOVERY_ORACLE: ordinary pending recovery must be inside Project actions and outside the password disclosure');
 const cases=[],make=(retainedBytes=4*1024*1024,compressedBytes=512*1024*1024,maxCheckpoints=2048)=>{
  for(const text of ['maxRetainedFileBytes:1024*1024*1024','maxCompressedProjectBytes:512*1024*1024','maxCheckpoints:2048'])assert.equal(storeSource.split(text).length,2,'BACKUP_CAPACITY_SOURCE_ANCHOR_ORACLE');
  return projectStoreRuntime({sourceOverrides:{'project-store.js':storeSource.replace('maxRetainedFileBytes:1024*1024*1024','maxRetainedFileBytes:'+retainedBytes).replace('maxCompressedProjectBytes:512*1024*1024','maxCompressedProjectBytes:'+compressedBytes).replace('maxCheckpoints:2048','maxCheckpoints:'+maxCheckpoints)}});
 };
 const seed=make(),original=seed.core.createBlankState('SYNTHETIC-PENDING-BACKUP');seed.engine.ensureShape(original);original.opaqueExtension=seed.copy({payload:'Exact unknown source material. '.repeat(2000)});seed.engine.recalculate(original);const saved=await seed.store.writeProject(original,{expectedProjectRevision:0});await seed.store.beginHistorySession('PENDING-BACKUP-SESSION');
 const baseline=await seed.store.historyList(saved.job.JOB_ID),backup=named(await seed.store.exportPackage(saved.job.JOB_ID),'complete-backup.json.gz'),backupSha=await sha(backup),secret='Synthetic backup test passphrase',encrypted=named(await seed.store.exportPackage(saved.job.JOB_ID,{passphrase:secret}),'protected-backup.json');
 const fresh=async()=>{const r=make(),p=await r.store.importPackage(backup);return {r,p};};
 const unchanged=async(r,p,history)=>{assert.deepEqual(plain(await r.store.readProject(p.job.JOB_ID)),plain(p),'BACKUP_STAGING_PRIOR_PROJECT_ORACLE');assert.deepEqual(plain(await r.store.historyList(p.job.JOB_ID)),history,'BACKUP_STAGING_PRIOR_HISTORY_ORACLE');};
 const pendingBytes=async(r,expected)=>{const identity=await r.store.pendingBackupImportIdentity(saved.job.JOB_ID),read=await r.store.readPendingBackupImport(saved.job.JOB_ID);assert(identity&&read,'BACKUP_STAGING_PENDING_RECOVERY_ORACLE');assert.equal(read.stagingId,identity.stagingId);assert.equal(read.sha256,await sha(expected));assert.deepEqual(Buffer.from(await read.blob.arrayBuffer()),Buffer.from(await expected.arrayBuffer()),'BACKUP_STAGING_EXACT_BYTES_ORACLE');return read;};
 const stage=async(r,p,file,expectedStagingId=null)=>r.store.stageBackupImport({jobId:p.job.JOB_ID,blob:file,rawFilename:file.name,mediaType:file.type||'application/octet-stream',expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,expectedStagingId});
 {
  const r=make(baseline.retainedFileBytes,baseline.compressedProjectBytes,baseline.entries.length),p=await r.store.importPackage(backup),before=plain(await r.store.historyList(p.job.JOB_ID)),app=await appRuntime(r,p,appSource);let failure=null;
  try{await app.ui.run(backup);}catch(error){failure=error;}
  assert.equal(failure?.code||null,null,'BACKUP_UI_CAPACITY_ORACLE: a valid already-retained backup must not require another enclosing-archive History checkpoint');
  assert.equal(app.calls(),1,'BACKUP_UI_CAPACITY_ORACLE: import must reach the transaction owner');const after=await r.store.readProject(p.job.JOB_ID),history=await r.store.historyList(p.job.JOB_ID);
  assert(after.revision>p.revision,'BACKUP_UI_CAPACITY_ORACLE: import must activate a committed revision');assert.deepEqual(plain(history.entries),before.entries);assert.equal(history.retainedFileBytes,before.retainedFileBytes);assert.equal(history.compressedProjectBytes,before.compressedProjectBytes);assert.deepEqual(plain(history.sessions),before.sessions);assert.equal(await r.store.pendingBackupImportIdentity(p.job.JOB_ID),null);assert.equal(app.ui.pending(),null);assert.equal(app.nodes.get('#resume-backup-import').hidden,true);assert(app.messages.includes('project package imported and reloaded'));
  cases.push({caseId:'UI-BACKUP-EXACT-CAPACITY',result:'PASS',retainedFileBytes:history.retainedFileBytes,compressedProjectBytes:history.compressedProjectBytes,checkpointCount:history.entries.length,selectedBackupBytes:backup.size,unchangedPromisedHistory:true,committedNewRevision:true,consumedPending:true});
 }
 {
  const {r,p}=await fresh(),history=plain(await r.store.historyList(p.job.JOB_ID)),invalid=named(new Blob(['This is not a valid project package.']),'bad-backup.json'),app=await appRuntime(r,p,appSource);await app.ui.run(invalid);await unchanged(r,p,history);const pending=await pendingBytes(r,invalid);assert.equal(app.nodes.get('#resume-backup-import').hidden,false);assert(!app.messages.includes('project package imported and reloaded'));
  const reloaded=await appRuntime(r,await r.store.readProject(p.job.JOB_ID),appSource);assert.equal(reloaded.nodes.get('#resume-backup-import').hidden,false);assert.equal(reloaded.ui.pending().stagingId,pending.stagingId);await reloaded.ui.resume();await pendingBytes(r,invalid);await unchanged(r,p,history);await reloaded.ui.run(backup);assert((await r.store.readProject(p.job.JOB_ID)).revision>p.revision);assert.equal(await r.store.pendingBackupImportIdentity(p.job.JOB_ID),null);
  cases.push({caseId:'UI-BACKUP-FAILED-RELOAD-RECOVERY',result:'PASS',exactPendingBytes:true,priorProjectAndHistoryUnchanged:true,failedResumeRetained:true,correctedSelectionConsumed:true,resumeOutsidePasswordDisclosure:true});
 }
 {
  const {r,p}=await fresh(),history=plain(await r.store.historyList(p.job.JOB_ID)),app=await appRuntime(r,p,appSource);await app.ui.run(encrypted);const pending=await pendingBytes(r,encrypted);await unchanged(r,p,history);assert.equal(app.nodes.get('#backup-protection').open,true,'BACKUP_PASSWORD_RECOVERY_ORACLE');
  const expected={filename:encrypted.name,sha256:await sha(encrypted),byteSize:encrypted.size,synthetic:true},reloaded=await appRuntime(r,await r.store.readProject(p.job.JOB_ID),appSource,{mobileWitness:expected});await reloaded.ui.resume();assert.equal((await pendingBytes(r,encrypted)).stagingId,pending.stagingId);await unchanged(r,p,history);reloaded.password(secret);await reloaded.ui.resume();assert((await r.store.readProject(p.job.JOB_ID)).revision>p.revision);assert.equal(await r.store.pendingBackupImportIdentity(p.job.JOB_ID),null);assert.equal(reloaded.nodes.get('#backup-passphrase').value,'');assert(!JSON.stringify([...r.rows].map(([store,rows])=>[store,[...rows]])).includes(secret),'BACKUP_PASSWORD_NOT_PERSISTED_ORACLE');assert.deepEqual(reloaded.observedMobile,[expected,expected]);assert.deepEqual(reloaded.mobile,[expected],'BACKUP_MOBILE_SELECTED_BYTES_FORWARDING_ORACLE');
  cases.push({caseId:'UI-BACKUP-PASSWORD-RELOAD-RECOVERY',result:'PASS',passwordNotPersisted:true,exactEncryptedBytesRetained:true,reloadedResumeConsumed:true,syntheticMobileSelectedByteWitnessForwarded:true});
 }
 {
  const {r,p}=await fresh(),history=plain(await r.store.historyList(p.job.JOB_ID)),app=await appRuntime(r,p,appSource);r.runtime.__closedLoopStorageFault='before-import-commit';await app.ui.run(backup);const pending=await pendingBytes(r,backup);await unchanged(r,p,history);delete r.runtime.__closedLoopStorageFault;
  const reloaded=await appRuntime(r,await r.store.readProject(p.job.JOB_ID),appSource);await reloaded.ui.resume();assert((await r.store.readProject(p.job.JOB_ID)).revision>p.revision);assert.equal(await r.store.pendingBackupImportIdentity(p.job.JOB_ID),null);const committed=plain(await r.store.readProject(p.job.JOB_ID));
  await assert.rejects(r.store.importPackage(backup,{pendingBackupImport:{jobId:p.job.JOB_ID,stagingId:pending.stagingId}}),error=>error.code==='STALE_BACKUP_IMPORT_SELECTION','BACKUP_STAGING_CONSUMED_REPLAY_ORACLE');assert.deepEqual(plain(await r.store.readProject(p.job.JOB_ID)),committed);
  cases.push({caseId:'UI-BACKUP-INTERRUPTED-COMMIT-RETRY',result:'PASS',lastValidStatePreserved:true,pendingSurvivesAbort:true,retryCommitsOnce:true,consumedReplayRejected:true});
 }
 {
  const {r,p}=await fresh(),history=plain(await r.store.historyList(p.job.JOB_ID));let replacement;
  const app=await appRuntime(r,p,appSource,{beforeImport:async()=>{const first=await r.store.pendingBackupImportIdentity(p.job.JOB_ID);replacement=await stage(r,p,encrypted,first.stagingId);}});await app.ui.run(backup);await unchanged(r,p,history);assert.equal((await pendingBytes(r,encrypted)).stagingId,replacement.stagingId);assert(!app.messages.includes('project package imported and reloaded'));
  const reloaded=await appRuntime(r,await r.store.readProject(p.job.JOB_ID),appSource);reloaded.password(secret);await reloaded.ui.resume();assert((await r.store.readProject(p.job.JOB_ID)).revision>p.revision);assert.equal(await r.store.pendingBackupImportIdentity(p.job.JOB_ID),null);
  cases.push({caseId:'UI-BACKUP-CONCURRENT-SELECTION',result:'PASS',abandonedImportCannotCommit:true,newSelectionExactBytesPreserved:true,replacementResumeWorks:true});
 }
 {
  const {r,p}=await fresh(),history=plain(await r.store.historyList(p.job.JOB_ID)),pending=await stage(r,p,backup);
  await assert.rejects(r.store.importPackage(encrypted,{passphrase:secret,pendingBackupImport:{jobId:p.job.JOB_ID,stagingId:pending.stagingId}}),error=>error.code==='BACKUP_IMPORT_STAGE_REHASH_MISMATCH','BACKUP_STAGING_SELECTED_BYTES_ORACLE');await unchanged(r,p,history);await pendingBytes(r,backup);
  await assert.rejects(r.store.importPackage(backup,{pendingBackupImport:{jobId:'OTHER-JOB',stagingId:pending.stagingId}}),error=>error.code==='STALE_BACKUP_IMPORT_SELECTION','BACKUP_STAGING_SELECTED_OWNER_ORACLE');await unchanged(r,p,history);await pendingBytes(r,backup);
  cases.push({caseId:'STORE-BACKUP-EXACT-INPUT-BINDING',result:'PASS',selectedAImportedBRejected:true,wrongOwnerRejected:true,lastValidStateAndPendingPreserved:true});
 }
 {
  const {r,p}=await fresh(),expected={filename:backup.name,sha256:backupSha,byteSize:backup.size,synthetic:true},app=await appRuntime(r,p,appSource,{mobileWitness:expected});await app.ui.saveLegacy(backup);const before=plain(await r.store.historyList(p.job.JOB_ID)),legacyView=plain(await r.store.readHistoryView(p.job.JOB_ID)),legacyFiles=await app.ui.readLegacy();assert.equal(legacyFiles.length,1);assert.equal(await sha(legacyFiles[0]),backupSha);assert.equal(await r.store.pendingBackupImportIdentity(p.job.JOB_ID),null);await app.ui.resume();
  const after=await r.store.historyList(p.job.JOB_ID);for(const old of before.entries)assert.deepEqual(plain(after.entries.find(entry=>entry.id===old.id)),old,'BACKUP_LEGACY_PROMISED_HISTORY_ORACLE');assert.deepEqual(plain(await r.store.readHistoryView(p.job.JOB_ID,before.activeId)),legacyView);const committed=await r.store.readProject(p.job.JOB_ID);assert(committed.revision>p.revision);assert.deepEqual(app.mobile,[expected]);await r.store.restoreCheckpoint(p.job.JOB_ID,before.activeId,{expectedProjectRevision:committed.revision});const descriptor=Object.values(legacyView.fileSelections).find(selection=>selection.kind==='backup-import').files[0];assert.equal(await sha((await r.store.getArtifact(descriptor.artifactId)).blob),backupSha);
  cases.push({caseId:'UI-BACKUP-LEGACY-HISTORY-SELECTION',result:'PASS',oldPromisedCheckpointAndExactBytesUnchanged:true,legacyResumeWorks:true,syntheticMobileSelectedByteWitnessForwarded:true});
 }
 {
  const {r,p}=await fresh(),pending=await stage(r,p,backup),updated=r.copy(p);updated.job.JOB_TITLE='Independent newer project edit';const newer=await r.store.writeProject(updated,{expectedProjectRevision:p.revision}),history=plain(await r.store.historyList(p.job.JOB_ID));
  const stale=await appRuntime(r,p,appSource);await assert.rejects(stale.ui.run(encrypted),error=>error.code==='STALE_PROJECT_REVISION','BACKUP_STAGING_STALE_TAB_ORACLE');await unchanged(r,newer,history);assert.equal((await pendingBytes(r,backup)).stagingId,pending.stagingId);
  cases.push({caseId:'UI-BACKUP-STALE-TAB-PRESERVES-PENDING',result:'PASS',newerProjectUnchanged:true,originalPendingExactBytesUnchanged:true});
 }
 {
  const {r,p}=await fresh(),pending=await stage(r,p,backup),key='backupImportStaging:'+p.job.JOB_ID,record=await r.store.metaGet(key);record.stagingId='';await r.store.metaPut(key,record);
  const observed=await r.store.pendingBackupImportIdentity(p.job.JOB_ID);assert.equal(observed.invalid,true);assert.equal(observed.stagingId,'');const app=await appRuntime(r,p,appSource);assert.equal(app.nodes.get('#resume-backup-import').hidden,false);let failure=null;try{await app.ui.run(backup);}catch(error){failure=error;}assert.equal(failure?.code||null,null,'BACKUP_EMPTY_STAGING_ID_RECOVERY_ORACLE');assert((await r.store.readProject(p.job.JOB_ID)).revision>p.revision,'BACKUP_EMPTY_STAGING_ID_RECOVERY_ORACLE');assert.equal(await r.store.pendingBackupImportIdentity(p.job.JOB_ID),null);assert(app.messages.includes('project package imported and reloaded'));
  cases.push({caseId:'UI-BACKUP-DAMAGED-EMPTY-IDENTITY-RESELECTION',result:'PASS',damagedSelectionVisible:true,explicitReplacementCommits:true,consumedPending:true});
 }
 {
  const {r,p}=await fresh(),first=await stage(r,p,backup),app=await appRuntime(r,p,appSource),replacement=await stage(r,p,encrypted,first.stagingId),history=plain(await r.store.historyList(p.job.JOB_ID));
  await assert.rejects(app.ui.run(backup),error=>error.code==='STALE_BACKUP_IMPORT_SELECTION','BACKUP_SELECTION_CONFLICT_REFUSAL_ORACLE');await unchanged(r,p,history);assert.equal((await pendingBytes(r,encrypted)).stagingId,replacement.stagingId);
  assert.equal(app.ui.pending()?.stagingId,replacement.stagingId,'BACKUP_SELECTION_CONFLICT_REFRESH_ORACLE: after refusing the stale attempt the next explicit selection must use current metadata');
  await app.ui.run(backup);assert((await r.store.readProject(p.job.JOB_ID)).revision>p.revision);assert.equal(await r.store.pendingBackupImportIdentity(p.job.JOB_ID),null);
  cases.push({caseId:'UI-BACKUP-SELECTION-CONFLICT-EXPLICIT-RETRY',result:'PASS',firstStaleSelectionRejected:true,concurrentPendingPreserved:true,metadataRefreshed:true,secondExplicitSelectionCommits:true});
 }
 {
  const r=make(),owner=await r.store.createProject({commandId:'SYNTHETIC-FRESH-APP-OWNER'}),ownerHistory=plain(await r.store.historyList(owner.job.JOB_ID));assert.notEqual(owner.job.JOB_ID,saved.job.JOB_ID);const app=await appRuntime(r,owner,appSource);await app.ui.run(backup);
  const imported=await r.store.readProject(saved.job.JOB_ID);assert(imported,'BACKUP_FRESH_APP_CROSS_PROJECT_ORACLE');assert.deepEqual(plain(imported.projectData),plain(saved.projectData));assert.deepEqual(plain(imported.opaqueExtension),plain(saved.opaqueExtension));assert.equal(app.ui.current().job.JOB_ID,saved.job.JOB_ID);await unchanged(r,owner,ownerHistory);assert.equal(await r.store.pendingBackupImportIdentity(owner.job.JOB_ID),null);assert.equal(await r.store.pendingBackupImportIdentity(saved.job.JOB_ID),null);assert(app.messages.includes('project package imported and reloaded'));
  cases.push({caseId:'UI-BACKUP-FRESH-PROJECT-OWNER-TO-IMPORTED-TARGET',result:'PASS',distinctOwnerAndImportedJob:true,owningProjectAndHistoryUnchanged:true,exactImportedProjectMaterial:true,pendingOwnerConsumed:true});
 }
 return {schema:'closed-loop-backup-import-staging-check/1',passed:true,synthetic:true,actualBrowser:false,sourceSha256:{'app-core.js':createHash('sha256').update(appSource).digest('hex'),'project-store.js':createHash('sha256').update(storeSource).digest('hex'),'index.html':createHash('sha256').update(markup).digest('hex'),'test-backup-import-staging.mjs':createHash('sha256').update(helperSource).digest('hex')},boundary:'Extracted production application functions with actual store transaction adapter; scaled exact limits. View/render/activity are stubs, not a browser or physical device.',cases};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const appPath=process.argv.find(arg=>arg.startsWith('--app-source='))?.slice('--app-source='.length);let appSource=fs.readFileSync(appPath||process.env.APP_SOURCE||'app-core.js','utf8');
 const fault=process.argv.find(arg=>arg.startsWith('--fault='))?.slice('--fault='.length),mutations={
  'permanent-backup-history':["const owner=current,jobId=owner.job.JOB_ID;await captureCurrentView();","const owner=current,jobId=owner.job.JOB_ID;await captureCurrentView();await saveFileSelection('backup-import',[f]);"],
  'empty-staging-identity':["expectedStagingId:pendingBackupImports[jobId]?.stagingId??null","expectedStagingId:pendingBackupImports[jobId]?.stagingId||null"]
 };
 if(fault){const [before,after]=mutations[fault]||[];assert(before&&appSource.split(before).length===2,'BACKUP_UI_FAULT_ANCHOR_ORACLE');appSource=appSource.replace(before,after);}
 console.log(JSON.stringify(await verifyBackupImportStaging({appSource}),null,2));
}
