import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const mutation=process.argv.find(value=>value.startsWith('--fault='))?.slice(8),faults={
 'refuse-removed':{id:'REFUSE-REMOVED-PROJECT-RESTORE',file:'project-store.js',before:'if(!state?.entries.some(entry=>entry.id===checkpointId))',after:'if(!prior||!state?.entries.some(entry=>entry.id===checkpointId))'},
 'skip-file-inventory':{id:'IGNORE-CHANGED-FILE-INVENTORY',file:'project-store.js',before:'||state.entries.find(entry=>entry.id===state.activeId)?.artifactManifestSha256!==historyArtifactsSha256(files)',after:''},
 'skip-receipt-validation':{id:'ACKNOWLEDGE_INVALID_DELETE_RECEIPT',file:'project-store.js',before:"const shape=globalThis.closedLoopWorkflowSchema.validateCommandReceiptShape('DELETE_PROJECT',receipt);",after:"return true;const shape=globalThis.closedLoopWorkflowSchema.validateCommandReceiptShape('DELETE_PROJECT',receipt);"},
 'skip-transaction-receipt-validation':{id:'ACKNOWLEDGE_INVALID_CONCURRENT_DELETE_RECEIPT',file:'project-store.js',before:'if(retry){validateDeleteReceipt(receiptKey,retry.value,jobId);',after:'if(retry){'},
 'skip-restored-receipt-validation':{id:'USE_INVALID_RECOVERY_COMMAND_RECEIPT',file:'project-store.js',before:'validateHistoryCommandReceipts(state.commandReceipts,state.jobId);',after:''}
};if(mutation&&!faults[mutation])throw new Error('Unknown deliberate mutation');
const sourceOverrides=Object.fromEntries([['PROJECT_STORE_SOURCE','project-store.js'],['WORKFLOW_SCHEMA_SOURCE','workflow-schema.js']].filter(([variable])=>process.env[variable]).map(([variable,file])=>[file,fs.readFileSync(process.env[variable],'utf8')]));
const createRuntime=()=>projectStoreRuntime({fault:faults[mutation],sourceOverrides});
const {store,core,engine,copy,rows,runtime}=createRuntime(),cases=[],verificationObservations=[],negativeCasePopulation=[];
const spec='specification/closed-loop-reliability-controlling-implementation-specification.txt';
function observedCase(checkId,caseId,violation,boundary,observed,requirementLines){negativeCasePopulation.push({caseId,checkId,violation,boundary,observed,accepted:false,result:'PASS'});const prior=verificationObservations.find(row=>row.checkId===checkId),actual={caseId,boundary,...observed};if(prior)prior.observed.cases.push(actual);else verificationObservations.push({checkId,requirementRefs:requirementLines.map(line=>spec+':'+line),boundary,expected:'The named violation is rejected and owned state remains unchanged.',observed:{cases:[actual]},passed:true,violation,accepted:false});}
const note=name=>cases.push({name,result:'PASS'});
let p=core.createBlankState('REMOVED-PROJECT-RECOVERY');engine.ensureShape(p);p.job.JOB_TITLE='Recoverable project';engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:0});
const bytes=new Uint8Array([0,255,10,13,195,169]),file=await store.putArtifact({jobId:p.job.JOB_ID,artifactId:'REMOVAL-FILE',filename:'original.bin',blob:new Blob([bytes]),mediaType:'application/octet-stream'});
await store.beginHistorySession('REMOVAL-SESSION');const initial=await store.historyList(p.job.JOB_ID),start=initial.sessions['REMOVAL-SESSION'].checkpointId,original=copy(p);
let other=core.createBlankState('INDEPENDENT-PROJECT');engine.ensureShape(other);engine.recalculate(other);other=await store.writeProject(other,{expectedProjectRevision:0});
const deletion={expectedProjectRevision:p.revision,replacementSelectedProjectId:other.job.JOB_ID,idempotencyKey:'REMOVE-ONCE',historyView:copy({activeStage:1,activeView:'Project',drafts:{'#note':{value:'Unsubmitted removal-time draft'}}})};
for(const phase of ['before-history-checkpoint','during-history-write','during-project-delete']){runtime.__closedLoopStorageFault=phase;await assert.rejects(store.removeProject(p.job.JOB_ID,deletion),error=>error.code==='INJECTED_STORAGE_FAILURE');delete runtime.__closedLoopStorageFault;assert.deepEqual(await store.readProject(p.job.JOB_ID),p);assert.equal((await store.historyList(p.job.JOB_ID)).activeId,initial.activeId);}note('Failed removal checkpoint or commit preserves the active project, files and all recovery points');
assert.equal(await store.removeProject(p.job.JOB_ID,deletion),true);assert.equal(await store.readProject(p.job.JOB_ID),null);assert.equal(await store.getArtifact(file.artifactId),null);const removed=await store.historyList(p.job.JOB_ID);assert.equal(removed.removed,true);assert.ok((await store.listRecoverableProjects()).some(item=>item.jobId===p.job.JOB_ID&&item.removed));assert.deepEqual(await store.readProject(other.job.JOB_ID),other);note('Removal leaves recoverable complete versions available and preserves independent projects');
const receipt=await store.metaGet('deleteReceipt:REMOVE-ONCE');assert.deepEqual(Object.keys(receipt).sort(),['jobId','commandId','idempotencyKey','payloadSha256','result','committedMetadataSequence','retentionExpiry'].sort());assert.ok(Number.isFinite(Date.parse(receipt.retentionExpiry)));const removedBeforeRetry=await store.historyList(p.job.JOB_ID);assert.equal(await store.removeProject(p.job.JOB_ID,deletion),true);assert.deepEqual(await store.historyList(p.job.JOB_ID),removedBeforeRetry,'DELETE_DUPLICATE_EFFECT_ORACLE');assert.deepEqual(await store.readProject(other.job.JOB_ID),other);await assert.rejects(store.removeProject(p.job.JOB_ID,{...deletion,replacementSelectedProjectId:''}),error=>error.code==='IDEMPOTENCY_PAYLOAD_CONFLICT');note('Delete retries return a minimal nonproject receipt; conflicting retry payloads reject');
observedCase('delete.retry-single-effect','delete-exact-retry','duplicateDeleteOrCloneEffects','Actual removeProject exact retry against removed project',{result:true,minimalReceiptFields:Object.keys(receipt).sort(),recoveryUnchanged:true,independentProjectUnchanged:true},[4444,4682,4949,5536]);
// Specification 35.7: a retry is authoritative only through a complete,
// minimal, correctly bound command receipt. Corrupted metadata is not proof
// that the requested deletion completed. Each disposable case changes one
// receipt field and must preserve both recovery state and independent work.
const receiptValidationCases=[],receiptKey='deleteReceipt:REMOVE-ONCE',receiptRow=copy(rows.get('meta').get(receiptKey));
const receiptFaults=[
 ...Object.keys(receipt).map(field=>['missing-'+field,value=>{delete value[field];}]),
 ['wrong-job',value=>{value.jobId=other.job.JOB_ID;}],
 ['wrong-command-type',value=>{value.commandId={claimed:'command'};}],
 ['wrong-idempotency-key',value=>{value.idempotencyKey='OTHER-COMMAND';}],
 ['wrong-result',value=>{value.result=false;}],
 ['wrong-sequence-type',value=>{value.committedMetadataSequence=String(value.committedMetadataSequence);} ],
 ['invalid-expiry',value=>{value.retentionExpiry='not-a-time';}],
 ['non-rfc3339-expiry',value=>{value.retentionExpiry='+010000-01-01T00:00:00.000Z';}],
 ['substantive-project-content',value=>{value.project={job:{JOB_TITLE:'Receipt must not retain substantive project content'}};}]
];
for(const [fault,mutate] of receiptFaults){
 const invalid=copy(receipt);mutate(invalid);rows.get('meta').set(receiptKey,{...copy(receiptRow),value:invalid});let rejection=null;
 try{await store.removeProject(p.job.JOB_ID,deletion);}catch(error){rejection={code:error.code,message:error.message};}
 finally{rows.get('meta').set(receiptKey,copy(receiptRow));}
 assert.equal(await store.readProject(p.job.JOB_ID),null);assert.deepEqual(await store.historyList(p.job.JOB_ID),removed);assert.deepEqual(await store.readProject(other.job.JOB_ID),other);
 observedCase('delete.invalid-receipt-isolation','delete-receipt-'+fault,'mutationFixturesAffectingCanonicalUserState','Malformed receipt in one disposable production-store adapter',{removedProjectStillAbsent:true,recoveryUnchanged:true,independentProjectSha256:other.projectSha256,adapter:'private transaction maps',externalTargetsInvoked:0},[5544]);
 receiptValidationCases.push({fault,expected:'Reject invalid command receipt before acknowledging a retry, without changing recovery or independent work',actual:rejection||'RETRY_ACKNOWLEDGED',result:rejection?.code==='DELETE_BINDING_INVALID'?'PASS':'FAIL'});
}
assert.equal(await store.removeProject(p.job.JOB_ID,deletion),true,'A restored valid receipt must retain exact retry behavior.');
process.stderr.write(JSON.stringify({commandReceiptValidation:receiptValidationCases.every(row=>row.result==='PASS')?'PASS':'FAIL',cases:receiptValidationCases,restoredValidRetry:true})+'\n');
const key='recovery:'+p.job.JOB_ID+':bytes:'+file.sha256,retained=rows.get('meta').get(key);rows.get('meta').delete(key);await assert.rejects(store.restoreCheckpoint(p.job.JOB_ID,start),error=>error.code==='HISTORY_FILE_INTEGRITY_FAILED','MISSING_RETAINED_FILE_ORACLE');assert.equal(await store.readProject(p.job.JOB_ID),null);assert.deepEqual(await store.historyList(p.job.JOB_ID),removed);rows.get('meta').set(key,retained);note('Missing retained file blocks restoration without replacing the removed-state record');
p=(await store.restoreCheckpoint(p.job.JOB_ID,start)).project;assert.deepEqual(p.projectData,original.projectData);assert.deepEqual(new Uint8Array(await (await store.getArtifact(file.artifactId)).blob.arrayBuffer()),bytes);assert.ok(p.revision>original.revision);assert.equal((await store.historyList(p.job.JOB_ID)).removed,false);assert.equal(await store.removeProject(p.job.JOB_ID,deletion),true);assert.deepEqual(await store.readProject(p.job.JOB_ID),p);note('A removed project restores exact bytes and an old delete retry cannot delete the restored activation');
observedCase('delete.restored-activation-single-effect','delete-restored-activation-retry','duplicateDeleteOrCloneEffects','Old delete receipt after actual checkpoint restoration',{result:true,restoredProjectSha256:p.projectSha256,restoredProjectUnchanged:true},[4444,4949,5536]);
const currentRow=rows.get('projects').get(p.job.JOB_ID);currentRow.project.job.JOB_TITLE='CORRUPTED';rows.get('projects').set(p.job.JOB_ID,currentRow);const restored=(await store.restoreCheckpoint(p.job.JOB_ID,start,{expectedProjectRevision:p.revision})).project;assert.equal(restored.job.JOB_TITLE,original.job.JOB_TITLE);assert.ok([...rows.get('meta').keys()].some(key=>key.startsWith('quarantine:'+p.job.JOB_ID+':')));assert.deepEqual(await store.readProject(other.job.JOB_ID),other);note('Verified checkpoint restores through a separate activation while corrupted project bytes remain quarantined');
const backup=await store.exportPackage(p.job.JOB_ID),fresh=createRuntime();await fresh.store.importPackage(backup);const history=await fresh.store.historyList(p.job.JOB_ID);assert.equal(history.sessions['REMOVAL-SESSION'].checkpointId,start);assert.ok((await fresh.store.listRecoverableProjects()).some(item=>item.jobId===p.job.JOB_ID));const importedBefore=await fresh.store.readProject(p.job.JOB_ID);assert.equal(await fresh.store.removeProject(p.job.JOB_ID,deletion),true);assert.deepEqual(await fresh.store.readProject(p.job.JOB_ID),importedBefore);note('Backup import preserves original session-start access and registers the recovered project in History');
observedCase('delete.backup-retry-single-effect','delete-backup-retry','duplicateDeleteOrCloneEffects','Old delete receipt after actual complete backup import',{result:true,importedProjectSha256:importedBefore.projectSha256,importedProjectUnchanged:true},[4444,4949,5536]);
for(const [fault,mutate] of receiptFaults){
 const fixture=createRuntime(),{store:target,rows:targetRows,runtime:targetRuntime,copy:targetCopy}=fixture;
 let active=await target.createProject({commandId:'CONCURRENT-RECEIPT-'+fault});
 const removeOptions={expectedProjectRevision:active.revision,idempotencyKey:'REMOVE-ONCE'},beforeRemoval=new Map([...targetRows].map(([key,map])=>[key,new Map([...map].map(([id,row])=>[id,targetCopy(row)]))]));
 await target.removeProject(active.job.JOB_ID,removeOptions);
 const completedReceipt=await target.metaGet(receiptKey);
 // Use a receipt emitted by the real deletion owner for this exact request.
 // Restore only this disposable adapter snapshot before injecting the race.
 targetRows.clear();for(const [key,map] of beforeRemoval)targetRows.set(key,map);
 const open=targetRuntime.openStorageTransaction,before=targetCopy(active);let concurrentRows;
 targetRuntime.openStorageTransaction=async(names,mode)=>{
  if(mode==='readwrite'&&Array.isArray(names)&&names.includes('projects')&&names.includes('artifacts')&&names.includes('meta')){
   targetRuntime.openStorageTransaction=open;
   const invalid=targetCopy(completedReceipt);mutate(invalid);
   targetRows.get('meta').set(receiptKey,targetCopy({key:receiptKey,value:invalid}));
   concurrentRows=new Map([...targetRows].map(([key,map])=>[key,new Map(map)]));
  }
  return open(names,mode);
 };
 let rejection=null;
 try{await target.removeProject(active.job.JOB_ID,removeOptions);}catch(error){rejection={code:error.code,message:error.message};}
 assert.ok(concurrentRows,'The concurrent receipt must be inserted at the transaction boundary.');
 assert.deepEqual(await target.readProject(active.job.JOB_ID),before);assert.deepEqual(targetRows,concurrentRows);
 receiptValidationCases.push({fault:'transaction-'+fault,actual:rejection||'RETRY_ACKNOWLEDGED',result:rejection?.code==='DELETE_BINDING_INVALID'?'PASS':'FAIL'});
}
const backupPayload=JSON.parse(await new Response(backup.stream().pipeThrough(new DecompressionStream('gzip'))).text());
for(const [fault,mutate] of receiptFaults){
 const fixture=createRuntime(),payload=copy(backupPayload);mutate(payload.recovery.commandReceipts[receiptKey]);delete payload.packageSha256;
 const packageSha256=runtime.closedLoopHash.sha256Value(copy(payload)),invalidBackup=await new Response(new Blob([JSON.stringify({...payload,packageSha256})]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
 let independent=await fixture.store.createProject({commandId:'INDEPENDENT-BACKUP-'+fault});
 const before=new Map([...fixture.rows].map(([key,map])=>[key,new Map(map)]));let rejection=null;
 try{await fixture.store.importPackage(invalidBackup);}catch(error){rejection={code:error.code,message:error.message};}
 const unchanged=isDeepStrictEqual(fixture.rows,before);
 assert.deepEqual(await fixture.store.readProject(independent.job.JOB_ID),independent);
 receiptValidationCases.push({fault:'backup-'+fault,actual:rejection||'INVALID_RECEIPT_IMPORTED',existingStateUnchanged:unchanged,result:rejection?.code==='DELETE_BINDING_INVALID'&&unchanged?'PASS':'FAIL'});
}
for(const operation of ['RESTORE','EXPORT'])for(const [fault,mutate] of receiptFaults){
 const fixture=createRuntime(),loaded=await fixture.store.importPackage(backup),historyKey='recovery:'+loaded.job.JOB_ID,row=fixture.rows.get('meta').get(historyKey);
 const invalid=fixture.copy(row);mutate(invalid.value.commandReceipts[receiptKey]);fixture.rows.get('meta').set(historyKey,invalid);
 const before=new Map([...fixture.rows].map(([key,map])=>[key,new Map(map)]));let rejection=null;
 try{if(operation==='RESTORE')await fixture.store.restoreCheckpoint(loaded.job.JOB_ID,start,{expectedProjectRevision:loaded.revision});else await fixture.store.exportPackage(loaded.job.JOB_ID);}catch(error){rejection={code:error.code,message:error.message};}
 const unchanged=isDeepStrictEqual(fixture.rows,before);
 receiptValidationCases.push({fault:operation.toLowerCase()+'-'+fault,actual:rejection||'INVALID_HISTORY_RECEIPT_USED',existingStateUnchanged:unchanged,result:rejection?.code==='DELETE_BINDING_INVALID'&&unchanged?'PASS':'FAIL'});
}
const commandReceiptClosure=receiptValidationCases.every(row=>row.result==='PASS')?'PASS':'FAIL';
if(commandReceiptClosure==='PASS')note('Every invalid deletion receipt rejects at retry, transaction and backup boundaries; restoring valid receipts preserves exact retry and recovery');
assert.equal(receiptValidationCases.filter(row=>row.result==='FAIL').length,0,'COMMAND_RECEIPT_VALIDATION_ORACLE: every malformed deletion receipt must fail closed in retry, concurrent transaction and backup restore.');
console.log(JSON.stringify({synthetic:true,environment:'Production persistence in Node VM with lifecycle transaction adapter',actualBrowser:false,cases,commandReceiptClosure,receiptValidationCases,verificationObservations,negativeCasePopulation,inMemoryFault:mutation||null,productionFilesModified:false},null,2));
