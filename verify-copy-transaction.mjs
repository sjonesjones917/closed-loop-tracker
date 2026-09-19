import fs from 'node:fs';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const sourceOverrides=process.env.PROJECT_STORE_SOURCE?{'project-store.js':fs.readFileSync(process.env.PROJECT_STORE_SOURCE,'utf8')}:{};
const createRuntime=()=>projectStoreRuntime({sourceOverrides});
const r=createRuntime(),{engine,store,copy,rows}=r,cases=[],note=name=>cases.push({name,result:'PASS'});
let source=await store.createProject({commandId:'COPY_SOURCE'}),next=copy(source);
next.job.JOB_TITLE='Input custody';next.job.EXACT_USER_OBJECTIVE_VERBATIM='Retain exact human inputs in a fresh project.';
const bytes=new Blob([Uint8Array.of(0,13,10,255,65)]),artifactId=engine.allocateId(next,'artifacts',{commandId:'SOURCE_INPUT',idempotencyKey:'input'});
const file=await store.putArtifact({artifactId,jobId:source.job.JOB_ID,blob:bytes,filename:'original.bin',mediaType:'application/octet-stream'});
engine.registerArtifactBytes(next,copy({stage:1,artifactId,filename:file.filename,mediaType:file.mediaType,byteSize:file.byteSize,sha256:file.sha256}));
next.projectData.userEntered.suppliedArtifactFiles=copy({[artifactId]:{artifactId,filename:file.filename,mediaType:file.mediaType,byteSize:file.byteSize,sha256:file.sha256}});
source=await store.writeProject(next,{expectedProjectRevision:source.revision});
const sourceHash=source.projectSha256,request={commandId:'COPY_WITH_INPUT',sourceJobId:source.job.JOB_ID,expectedSourceSha256:sourceHash};
const copied=await store.createProject(request),newFiles=await store.listArtifacts(copied.job.JOB_ID),receipt=await store.metaGet('cloneReceipt:'+request.commandId);
assert.equal(newFiles.length,1,'COPY_FILE_CUSTODY_ORACLE: live copied files must commit with the new project');assert.notEqual(newFiles[0].artifactId,artifactId);assert.match(newFiles[0].artifactId,/^ARTIFACT-[0-9a-v]{32}$/);
assert.deepEqual(new Uint8Array(await newFiles[0].blob.arrayBuffer()),new Uint8Array(await bytes.arrayBuffer()));
assert.equal(copied.projectData.userEntered.suppliedArtifactFiles[newFiles[0].artifactId].sha256,file.sha256);
assert.equal((await store.readProject(source.job.JOB_ID)).projectSha256,sourceHash,'COPY_SOURCE_PRESERVATION_ORACLE');
assert.equal(copied.projectData.acceptedChanges.length,0);assert.ok(Object.values(copied.stages).every(stage=>stage.status!=='COMPLETE'));
assert.ok(!Object.hasOwn(copied.job,'DESIRED_SOURCE_COUNT')||copied.job.DESIRED_SOURCE_COUNT!==undefined);
assert.ok(receipt,'COPY_RECEIPT_ORACLE: clone receipt must be outside the project');assert.equal(receipt.sourceProjectSha256,sourceHash);assert.equal(receipt.resultingJobId,copied.job.JOB_ID);
assert.ok(!(copied.projectData.commandReceipts||[]).some(row=>row.commandId===request.commandId));
assert.equal((await store.historyList(source.job.JOB_ID)).commandReceipts['cloneReceipt:'+request.commandId].mappingManifestSha256,receipt.mappingManifestSha256);
assert.equal((await store.historyList(copied.job.JOB_ID)).commandReceipts['cloneReceipt:'+request.commandId].mappingManifestSha256,receipt.mappingManifestSha256);
note('Copy commits fresh canonical project and file identities with exact input bytes and external source-bound receipts; source and accepted work remain unchanged');
assert.equal((await store.createProject(request)).job.JOB_ID,copied.job.JOB_ID);
await assert.rejects(store.createProject({...request,expectedSourceSha256:'f'.repeat(64)}),error=>error.code==='IDEMPOTENCY_PAYLOAD_CONFLICT');
await assert.rejects(store.createProject({...request,commandId:'STALE_SOURCE',expectedSourceSha256:'f'.repeat(64)}),error=>error.code==='STALE_PROJECT_REVISION');
note('Exact retry returns the same clone; changed payload and stale source are rejected');
const before=new Map([...rows].map(([key,map])=>[key,new Map(map)]));
r.runtime.__closedLoopStorageFault='before-transaction-commit';
await assert.rejects(store.createProject({...request,commandId:'INTERRUPTED_COPY'}),error=>error.code==='INJECTED_STORAGE_FAILURE');
delete r.runtime.__closedLoopStorageFault;
assert.deepEqual(rows,before,'COPY_ATOMICITY_ORACLE: interrupted creation cannot leave files, receipts, allocation, source history, or clone history committed');
await store.createProject({...request,commandId:'INTERRUPTED_COPY'});
note('An interrupted transaction changes none of source history, clone, files, allocation, or receipts; retry completes');
const packageBytes=await store.exportPackage(copied.job.JOB_ID),restored=createRuntime(),imported=await restored.store.importPackage(packageBytes);
assert.equal((await restored.store.createProject(request)).job.JOB_ID,imported.job.JOB_ID);
const recoveredFiles=await restored.store.listArtifacts(imported.job.JOB_ID);assert.deepEqual(new Uint8Array(await recoveredFiles[0].blob.arrayBuffer()),new Uint8Array(await bytes.arrayBuffer()));
note('Restoring the copy backup restores exact bytes and completed-clone retry protection without needing the source');
const sourceBackup=await store.exportPackage(source.job.JOB_ID),sourceOnly=createRuntime();await sourceOnly.store.importPackage(sourceBackup);
await assert.rejects(sourceOnly.store.createProject(request),error=>error.code==='CREATED_PROJECT_RETAINED');
assert.equal((await sourceOnly.store.listProjectSummaries()).length,1);
note('Restoring only the source backup preserves the completed clone receipt and cannot recreate the previous clone');
const history=await store.historyList(copied.job.JOB_ID),checkpoint=history.activeId;
next=copy(copied);next.job.JOB_TITLE='Changed copy';const advanced=await store.writeProject(next,{expectedProjectRevision:copied.revision});
const recovered=await store.restoreCheckpoint(copied.job.JOB_ID,checkpoint,{expectedProjectRevision:advanced.revision});
assert.equal(recovered.project.job.JOB_TITLE,copied.job.JOB_TITLE);assert.deepEqual(new Uint8Array(await (await store.getArtifact(newFiles[0].artifactId)).blob.arrayBuffer()),new Uint8Array(await bytes.arrayBuffer()));
note('The first clone checkpoint restores matching input state and byte custody as a whole');
// A competing change is made through the actual store immediately before
// the copy's write transaction. The copy must preserve that newer work.
const openTransaction=r.runtime.openStorageTransaction;
let independentSource;
r.runtime.openStorageTransaction=async(names,mode)=>{
 if(mode==='readwrite'&&Array.isArray(names)&&names.includes('artifacts')){
  r.runtime.openStorageTransaction=openTransaction;
  const newer=copy(await store.readProject(source.job.JOB_ID));newer.job.JOB_TITLE='Independent newer work';
  independentSource=await store.writeProject(newer,{expectedProjectRevision:newer.revision});
 }
 return openTransaction(names,mode);
};
await assert.rejects(store.createProject({...request,commandId:'CONCURRENT_SOURCE'}),error=>error.code==='STALE_PROJECT_REVISION','COPY_CONCURRENT_SOURCE_ORACLE');
assert.equal((await store.readProject(source.job.JOB_ID)).projectSha256,independentSource.projectSha256);
assert.ok((await store.metaGet('cloneReceipt:CONCURRENT_SOURCE'))==null,'The stale command must have no durable receipt.');
note('A concurrent source edit wins; a stale copy commits no clone or receipt and preserves independent work');
for(const violation of ['missing','corrupted','filename','mediaType','artifactId','jobId']){
 const fixture=createRuntime();await fixture.store.importPackage(sourceBackup);
 const original=fixture.rows.get('artifacts').get(artifactId);
 if(violation==='missing')fixture.rows.get('artifacts').delete(artifactId);
 else if(violation==='corrupted')fixture.rows.get('artifacts').set(artifactId,{...original,blob:new Blob(['corrupted bytes'])});
 else fixture.rows.get('artifacts').set(artifactId,{...original,[violation]:'INCONSISTENT_SOURCE_IDENTITY'});
 const beforeFailure=new Map([...fixture.rows].map(([key,map])=>[key,new Map(map)])),loaded=await fixture.store.readProject(source.job.JOB_ID);
 await assert.rejects(fixture.store.createProject({...request,commandId:'COPY_'+violation,expectedSourceSha256:loaded.projectSha256}),error=>error.code==='CLONE_SOURCE_FILE_INVALID','COPY_SOURCE_IDENTITY_ORACLE: '+violation);
 assert.deepEqual(fixture.rows,beforeFailure);
 note('A '+violation+' input file rejects the copy without changing recoverable state');
}
for(const field of ['filename','mediaType','artifactId','jobId']){
 const fixture=createRuntime();await fixture.store.importPackage(sourceBackup);
 const open=fixture.runtime.openStorageTransaction;let beforeCommit;
 fixture.runtime.openStorageTransaction=async(names,mode)=>{
  if(mode==='readwrite'&&Array.isArray(names)&&names.includes('artifacts')){
   fixture.runtime.openStorageTransaction=open;
   const original=fixture.rows.get('artifacts').get(artifactId);
   fixture.rows.get('artifacts').set(artifactId,{...original,[field]:'CHANGED_BEFORE_COPY_COMMIT'});
   beforeCommit=new Map([...fixture.rows].map(([key,map])=>[key,new Map(map)]));
  }
  return open(names,mode);
 };
 const loaded=await fixture.store.readProject(source.job.JOB_ID);
 await assert.rejects(fixture.store.createProject({...request,commandId:'CONCURRENT_FILE_'+field,expectedSourceSha256:loaded.projectSha256}),error=>error.code==='CLONE_FILE_CHANGED','COPY_COMMIT_IDENTITY_ORACLE: '+field);
 assert.deepEqual(fixture.rows,beforeCommit,'A changed source file must not commit clone, files, receipts, allocation or recovery state.');
 note('A source '+field+' change between preparation and commit rejects atomically');
}
{
 const fixture=createRuntime(),{store:textStore,engine:textEngine,copy:textCopy}=fixture;
 let input=await textStore.createProject({commandId:'TEXT_SOURCE'}),pending=textCopy(input);
 const text='Exact supplied text\r\nUnicode: café\n',oldId=textEngine.allocateId(pending,'artifacts',{commandId:'TEXT_INPUT'});
 const original=await textStore.putArtifact({artifactId:oldId,jobId:input.job.JOB_ID,filename:'input.txt',mediaType:'text/plain',blob:new Blob([text])});
 const metadata={artifactId:oldId,filename:original.filename,mediaType:original.mediaType,byteSize:original.byteSize,sha256:original.sha256};
 textEngine.registerArtifactBytes(pending,textCopy({stage:1,...metadata}));
 pending.projectData.userEntered.suppliedArtifactFiles=textCopy({[oldId]:metadata});
 pending.projectData.userEntered.suppliedArtifactText=textCopy({[oldId]:{...metadata,text}});
 input=await textStore.writeProject(pending,{expectedProjectRevision:input.revision});
 const cloned=await textStore.createProject({commandId:'COPY_TEXT',sourceJobId:input.job.JOB_ID,expectedSourceSha256:input.projectSha256});
 const [row]=await textStore.listArtifacts(cloned.job.JOB_ID);
 assert.notEqual(row.artifactId,oldId);assert.equal(await row.blob.text(),text);
 assert.deepEqual(cloned.projectData.userEntered.suppliedArtifactText[row.artifactId],fixture.copy({...metadata,artifactId:row.artifactId,text}),'COPY_TEXT_CUSTODY_ORACLE');
 note('Text input retains exact line endings, Unicode, filename and media type under the new project file identity');
}
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Production creation and recovery transaction owner with shared Node adapter',cases},null,2));
