import fs from 'node:fs';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const sourceOverrides=Object.fromEntries([['PROJECT_STORE_SOURCE','project-store.js'],['WORKFLOW_SCHEMA_SOURCE','workflow-schema.js']].filter(([variable])=>process.env[variable]).map(([variable,file])=>[file,fs.readFileSync(process.env[variable],'utf8')]));
const mutation=process.argv.find(value=>value.startsWith('--fault='))?.slice(8);
if(mutation&&mutation!=='skip-clone-receipt-validation')throw new Error('Unknown deliberate mutation');
const fault=mutation?{id:'ACKNOWLEDGE_INVALID_CLONE_RECEIPT',file:'project-store.js',before:"const shape=globalThis.closedLoopWorkflowSchema.validateCommandReceiptShape('CLONE',receipt);",after:"return true;const shape=globalThis.closedLoopWorkflowSchema.validateCommandReceiptShape('CLONE',receipt);"}:null;
const createRuntime=()=>projectStoreRuntime({sourceOverrides,fault});
const r=createRuntime(),{engine,store,copy,rows}=r,cases=[],verificationObservations=[],negativeCasePopulation=[],note=name=>cases.push({name,result:'PASS'});
const spec='specification/closed-loop-reliability-controlling-implementation-specification.txt';
function observedCase(checkId,caseId,violation,boundary,observed,requirementLines){const value={caseId,checkId,violation,boundary,observed,accepted:false,result:'PASS'};negativeCasePopulation.push(value);const prior=verificationObservations.find(row=>row.checkId===checkId),actual={caseId,boundary,...observed};if(prior)prior.observed.cases.push(actual);else verificationObservations.push({checkId,requirementRefs:requirementLines.map(line=>spec+':'+line),boundary,expected:'The named violation is rejected and owned state remains unchanged.',observed:{cases:[actual]},passed:true,violation,accepted:false});}
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
const projectsBeforeRetry=rows.get('projects').size,mappingBeforeRetry=copy(receipt.mappingManifest);
assert.equal((await store.createProject(request)).job.JOB_ID,copied.job.JOB_ID);
assert.equal(rows.get('projects').size,projectsBeforeRetry,'COPY_DUPLICATE_EFFECT_ORACLE');assert.deepEqual((await store.metaGet('cloneReceipt:'+request.commandId)).mappingManifest,mappingBeforeRetry,'COPY_RETRY_MAPPING_ORACLE');
observedCase('clone.retry-single-effect','clone-exact-retry','duplicateDeleteOrCloneEffects','Actual createProject exact CLONE retry',{projectCountBefore:projectsBeforeRetry,projectCountAfter:rows.get('projects').size,resultingJobId:copied.job.JOB_ID,mappingManifestUnchanged:true},[4444,4683,4949,5536]);
await assert.rejects(store.createProject({...request,expectedSourceSha256:'f'.repeat(64)}),error=>error.code==='IDEMPOTENCY_PAYLOAD_CONFLICT');
await assert.rejects(store.createProject({...request,commandId:'STALE_SOURCE',expectedSourceSha256:'f'.repeat(64)}),error=>error.code==='STALE_PROJECT_REVISION');
note('Exact retry returns the same clone; changed payload and stale source are rejected');
const receiptValidationCases=[],receiptKey='cloneReceipt:'+request.commandId,receiptRow=copy(rows.get('meta').get(receiptKey));
const receiptFaults=[
 ...Object.keys(receipt).map(field=>['missing-'+field,value=>{delete value[field];}]),
 ...Object.keys(receipt.mappingManifest).map(field=>['missing-mapping-'+field,value=>{delete value.mappingManifest[field];}]),
 ...Object.keys(receipt.mappingManifest.files[0]).map(field=>['missing-file-'+field,value=>{delete value.mappingManifest.files[0][field];}]),
 ['unregistered-receipt-field',value=>{value.project={substantive:'must not be in a receipt'};}],
 ['wrong-file-name-type',value=>{value.mappingManifest.files[0].filename={claimed:'original.bin'};}],
 ['wrong-file-media-type',value=>{value.mappingManifest.files[0].mediaType=['application/octet-stream'];}],
 ['wrong-result-type',value=>{value.result='true';}]
];
for(const [name,mutate] of receiptFaults){
 const invalid=copy(receipt);mutate(invalid);
 // Rebind well-formed preimages so a valid digest cannot substitute for a
 // closed typed receipt. A missing preimage field is itself the violation.
 if(Object.hasOwn(invalid,'mappingManifestSha256')&&invalid.mappingManifest&&['schema','sourceJobId','resultingJobId','files'].every(key=>Object.hasOwn(invalid.mappingManifest,key)))invalid.mappingManifestSha256=r.runtime.closedLoopHash.hashRegistered('CLONE_MAPPING_MANIFEST',copy(invalid.mappingManifest));
 rows.get('meta').set(receiptKey,{...copy(receiptRow),value:copy(invalid)});let rejection=null;
 try{await store.createProject(request);}catch(error){rejection={code:error.code,message:error.message};}
 finally{rows.get('meta').set(receiptKey,copy(receiptRow));}
 assert.equal((await store.readProject(source.job.JOB_ID)).projectSha256,sourceHash);
 assert.deepEqual(await store.readProject(copied.job.JOB_ID),copied);
 observedCase('clone.invalid-receipt-isolation','clone-receipt-'+name,'mutationFixturesAffectingCanonicalUserState','Malformed receipt in one disposable production-store adapter',{sourceProjectSha256:sourceHash,cloneProjectUnchanged:true,adapter:'private transaction maps',externalTargetsInvoked:0},[5544]);
 receiptValidationCases.push({fault:name,actual:rejection||'RETRY_ACKNOWLEDGED',result:rejection?.code==='CLONE_BINDING_INVALID'?'PASS':'FAIL'});
}
assert.equal((await store.createProject(request)).job.JOB_ID,copied.job.JOB_ID,'Restoring the valid receipt must return the original clone.');
const before=new Map([...rows].map(([key,map])=>[key,new Map(map)]));
r.runtime.__closedLoopStorageFault='before-transaction-commit';
await assert.rejects(store.createProject({...request,commandId:'INTERRUPTED_COPY'}),error=>error.code==='INJECTED_STORAGE_FAILURE');
delete r.runtime.__closedLoopStorageFault;
assert.deepEqual(rows,before,'COPY_ATOMICITY_ORACLE: interrupted creation cannot leave files, receipts, allocation, source history, or clone history committed');
await store.createProject({...request,commandId:'INTERRUPTED_COPY'});
note('An interrupted transaction changes none of source history, clone, files, allocation, or receipts; retry completes');
const packageBytes=await store.exportPackage(copied.job.JOB_ID),restored=createRuntime(),imported=await restored.store.importPackage(packageBytes);
const importedCountBefore=restored.rows.get('projects').size;
assert.equal((await restored.store.createProject(request)).job.JOB_ID,imported.job.JOB_ID);
assert.equal(restored.rows.get('projects').size,importedCountBefore,'COPY_RESTORED_DUPLICATE_EFFECT_ORACLE');
observedCase('clone.backup-retry-single-effect','clone-backup-retry','duplicateDeleteOrCloneEffects','Actual imported clone backup then createProject exact retry',{projectCountBefore:importedCountBefore,projectCountAfter:restored.rows.get('projects').size,resultingJobId:imported.job.JOB_ID},[4444,4949,5536]);
const recoveredFiles=await restored.store.listArtifacts(imported.job.JOB_ID);assert.deepEqual(new Uint8Array(await recoveredFiles[0].blob.arrayBuffer()),new Uint8Array(await bytes.arrayBuffer()));
note('Restoring the copy backup restores exact bytes and completed-clone retry protection without needing the source');
const payload=JSON.parse(await new Response(packageBytes.stream().pipeThrough(new DecompressionStream('gzip'))).text());
// The schema proof above covers every receipt field. These classes exercise
// each recovery consumer: missing root identity, missing nested collection,
// wrong nested value type, and an unregistered substantive field.
const recoveryFaults=receiptFaults.filter(([name])=>['missing-schema','missing-mapping-files','wrong-file-name-type','unregistered-receipt-field'].includes(name));
for(const operation of ['IMPORT','RESTORE','EXPORT'])for(const [name,mutate] of recoveryFaults){
 const fixture=createRuntime();let rejection=null,before;
 if(operation==='IMPORT'){
  const invalid=copy(payload);mutate(invalid.recovery.commandReceipts[receiptKey]);delete invalid.packageSha256;
  const packageSha256=r.runtime.closedLoopHash.sha256Value(copy(invalid)),blob=await new Response(new Blob([JSON.stringify({...invalid,packageSha256})]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
  await fixture.store.createProject({commandId:'INDEPENDENT-CLONE-IMPORT-'+name});before=new Map([...fixture.rows].map(([key,map])=>[key,new Map(map)]));
  try{await fixture.store.importPackage(blob);}catch(error){rejection={code:error.code,message:error.message};}
 }else{
  const loaded=await fixture.store.importPackage(packageBytes),key='recovery:'+loaded.job.JOB_ID,row=fixture.rows.get('meta').get(key),invalid=fixture.copy(row);mutate(invalid.value.commandReceipts[receiptKey]);fixture.rows.set('meta',new Map(fixture.rows.get('meta')));fixture.rows.get('meta').set(key,invalid);
  before=new Map([...fixture.rows].map(([key,map])=>[key,new Map(map)]));
  try{if(operation==='RESTORE')await fixture.store.restoreCheckpoint(loaded.job.JOB_ID,invalid.value.activeId,{expectedProjectRevision:loaded.revision});else await fixture.store.exportPackage(loaded.job.JOB_ID);}catch(error){rejection={code:error.code,message:error.message};}
 }
 const unchanged=isDeepStrictEqual(fixture.rows,before);receiptValidationCases.push({fault:operation.toLowerCase()+'-'+name,actual:rejection||'INVALID_CLONE_RECEIPT_USED',existingStateUnchanged:unchanged,result:rejection?.code==='CLONE_BINDING_INVALID'&&unchanged?'PASS':'FAIL'});
}
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
assert.equal(receiptValidationCases.filter(row=>row.result==='FAIL').length,0,'CLONE_RECEIPT_VALIDATION_ORACLE: incomplete or mistyped clone receipts must reject without creating another project or changing source and clone state.');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Production creation and recovery transaction owner with shared Node adapter',cases,receiptValidationCases,verificationObservations,negativeCasePopulation,inMemoryFault:mutation||null,productionFilesModified:false},null,2));
