import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {stage04AcceptanceFixture,stage04AcceptanceEnvelope} from './test-fixtures.mjs';

// This adapter-level suite uses an isolated IndexedDB simulation. Browser and
// physical-device acceptance are separate required gates, never inferred here.
const {IDBFactory,IDBKeyRange}=await import(process.env.TEST_IDB_MODULE||'fake-indexeddb');
Object.assign(globalThis,{indexedDB:new IDBFactory(),IDBKeyRange,dispatchEvent(){}});
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(process.env.BASELINE_COMMIT?execFileSync('git',['show',process.env.BASELINE_COMMIT+':'+file],{encoding:'utf8',maxBuffer:12*1024*1024}):fs.readFileSync(file,'utf8'),{filename:file});
const store=closedLoopProjectStore,core=closedLoopCore,hash=closedLoopHash;
await store.ready;
assert.equal(typeof store.restoreVersion,'function','The production adapter must expose authoritative version restoration.');
const jobId='DISPOSABLE-RECOVERY-'+crypto.randomUUID(),view={stage:1,view:'Project',scrollX:0,scrollY:81,forms:[{id:'draft',value:'unaccepted draft'}]};
let project=await store.writeProject(core.createBlankState(jobId),{createOnly:true});
const start=await store.beginRecoverySession(jobId,'test-session',view),startId=start.activeId;
const bytes=new Uint8Array([0,255,13,10,0,128,65]),artifactId='RECOVERY-BYTES-'+crypto.randomUUID();
await store.putArtifact({artifactId,jobId,blob:new Blob([bytes]),filename:'exact.bin',mediaType:'application/octet-stream'});
project.stages[1].authorizedFiles.push({artifactId,name:'exact.bin',type:'application/octet-stream',size:bytes.length,sha256:await hash.sha256Bytes(bytes)});project.job.JOB_TITLE='First continuation';project=await store.writeProject(project,{expectedProjectRevision:project.revision});
const first=(await store.readRecoveryHistory(jobId)).activeId,firstCheckpoint=await store.readCheckpoint(first,jobId),firstDigest=hash.sha256Value(firstCheckpoint);
const entry=await store.saveHistoryView({jobId,versionId:first,view});
project.job.JOB_TITLE='Second continuation';project=await store.writeProject(project,{expectedProjectRevision:project.revision});
const second=(await store.readRecoveryHistory(jobId)).activeId;
let restored=await store.restoreVersion({jobId,versionId:first,expectedProjectRevision:project.revision});project=restored.project;
assert.equal(project.recoveryActivationRevision,project.revision);assert.equal(project.job.JOB_TITLE,'First continuation');assert.equal((await store.readRecoveryHistory(jobId)).activeId,first);
assert.deepEqual(new Uint8Array(await (await store.getArtifact(artifactId)).blob.arrayBuffer()),bytes);
await assert.rejects(store.deleteArtifact(artifactId,jobId),{code:'RECOVERY_ARTIFACT_RETAINED'});
await assert.rejects(store.saveHistoryView({...entry,versionId:second}),{code:'RECOVERY_VIEW_ID_REUSE'});
await assert.rejects(store.restoreVersion({jobId,versionId:second,expectedProjectRevision:project.revision-1}),{code:'STALE_PROJECT_REVISION'});
project.job.JOB_TITLE='Alternative continuation';project=await store.writeProject(project,{expectedProjectRevision:project.revision});
const alternative=(await store.readRecoveryHistory(jobId)).activeId;
assert.equal(hash.sha256Value(await store.readCheckpoint(first,jobId)),firstDigest,'A retained version was mutated.');
assert((await store.readRecoveryHistory(jobId)).entries.some(item=>item.versionId===second),'The original continuation was discarded.');
const beforeFault=await store.readProject(jobId),historyBefore=await store.readRecoveryHistory(jobId);
for(const phase of ['during-recovery-checkpoint','during-project-write','before-transaction-commit']){
  globalThis.__closedLoopStorageFault=phase;
  await assert.rejects(store.transact(jobId,project.revision,p=>{p.job.JOB_TITLE='Must roll back';}),{code:'INJECTED_STORAGE_FAILURE'});
  delete globalThis.__closedLoopStorageFault;
  assert.equal((await store.readProject(jobId)).projectSha256,beforeFault.projectSha256,phase);
  assert.deepEqual(await store.readRecoveryHistory(jobId),historyBefore,phase);
}
for(const phase of ['before-restore-transaction','during-restore-write','before-restore-commit']){
  globalThis.__closedLoopStorageFault=phase;
  await assert.rejects(store.restoreVersion({jobId,versionId:first,expectedProjectRevision:project.revision}),{code:'INJECTED_STORAGE_FAILURE'});
  delete globalThis.__closedLoopStorageFault;
  assert.equal((await store.readProject(jobId)).projectSha256,beforeFault.projectSha256,phase);
  assert.deepEqual(await store.readRecoveryHistory(jobId),historyBefore,phase);
}
// Deliberate one-byte corruption and a missing file are injected only into
// this disposable database. Both failures must leave active state untouched.
async function rawRow(storeName,key,value){const db=await store.openDatabase(),tx=db.transaction(storeName,'readwrite'),done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});if(value===null)tx.objectStore(storeName).delete(key);else tx.objectStore(storeName).put(value);await done;}
const originalFile=await store.getArtifact(artifactId),damagedBytes=bytes.slice();damagedBytes[0]^=255;
for(const badFile of [{...originalFile,blob:new Blob([damagedBytes])},null]){
 await rawRow('artifacts',artifactId,badFile);
 await assert.rejects(store.restoreVersion({jobId,versionId:first,expectedProjectRevision:project.revision}),{code:'RECOVERY_ARTIFACT_INTEGRITY'});
 assert.equal((await store.readProject(jobId)).projectSha256,beforeFault.projectSha256);
 await rawRow('artifacts',artifactId,originalFile);
}
await assert.rejects(store.metaPut('projectCheckpoint:'+first,{corrupt:true}),{code:'RECOVERY_METADATA_PROTECTED'});
const checkpointRow={key:'projectCheckpoint:'+first,value:structuredClone(firstCheckpoint),updatedAt:firstCheckpoint.createdAt};checkpointRow.value.project.job.JOB_TITLE='Corrupt checkpoint';
await rawRow('meta',checkpointRow.key,checkpointRow);await assert.rejects(store.restoreVersion({jobId,versionId:first,expectedProjectRevision:project.revision}),{code:'RECOVERY_CHECKPOINT_CORRUPT'});
await rawRow('meta',checkpointRow.key,{...checkpointRow,value:firstCheckpoint});
const backup=await store.exportPackage(jobId),body=JSON.parse(await new Response(backup.stream().pipeThrough(new DecompressionStream('gzip'))).text());
assert(body.recovery?.checkpoints.some(item=>item.versionId===startId),'The backup omitted session-start recovery.');
assert(body.recovery?.checkpoints.some(item=>item.versionId===second),'The backup omitted the abandoned continuation.');
assert(body.recovery?.views.some(item=>item.entryId===entry.entryId),'The backup omitted recorded drafts and view.');
const incompatible=structuredClone(body);incompatible.project.job.JOB_TITLE='Wrong version combination';incompatible.packageManifest.projectSha256=hash.sha256Value(incompatible.project);delete incompatible.packageSha256;incompatible.packageSha256=hash.sha256Value(incompatible);
const incompatibleBackup=await new Response(new Blob([hash.stableStringify(incompatible)]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
await assert.rejects(store.importPackage(incompatibleBackup),{code:'RECOVERY_INCOMPATIBLE_VERSION'});assert.equal((await store.readProject(jobId)).projectSha256,beforeFault.projectSha256);
await store.removeProject(jobId,{expectedProjectRevision:project.revision});
project=await store.importPackage(backup);
assert.deepEqual((await store.readHistoryView(entry.entryId)).view,view);
for(const destination of [second,startId,alternative,first,second,first,alternative,startId]){
  const snapshot=await store.readCheckpoint(destination,jobId);
  ({project}=await store.restoreVersion({jobId,versionId:destination,expectedProjectRevision:project.revision}));
  const actual=structuredClone(project),expected=structuredClone(snapshot.project);
  for(const value of [actual,expected])for(const key of ['revision','projectSha256','recoveryActivationRevision','activeStage','activeView'])delete value[key];
  assert.deepEqual(actual,expected,'Restored project differs from the recorded complete version.');
}
assert.equal((await store.readRecoveryHistory(jobId)).sessionStarts['test-session'],startId);
// Real production acceptance builds the fixture's prerequisite state; only
// the external response content is synthetic. No completion label is forced.
const runtime={core,schema:closedLoopWorkflowSchema,engine:closedLoopWorkflowEngine,prompts:closedLoopPromptEngine,ingestion:closedLoopResponseIngestion};
let accepted=stage04AcceptanceFixture(runtime,'DISPOSABLE-ACCEPTANCE-'+crypto.randomUUID());
let instruction=runtime.prompts.buildPromptRecord(4,accepted);accepted.projectData.generatedPrompts.push(instruction);
let proposal=runtime.ingestion.prepare(accepted,{stage:4,text:JSON.stringify(stage04AcceptanceEnvelope(runtime,accepted,instruction)),promptRecord:instruction});
assert(proposal.validation.valid);accepted=runtime.ingestion.commit(proposal.project,proposal.proposal.proposalId).project;
accepted=await store.writeProject(accepted,{createOnly:true});const acceptedJobId=accepted.job.JOB_ID,acceptedVersion=(await store.readRecoveryHistory(acceptedJobId)).activeId,acceptedCheckpoint=await store.readCheckpoint(acceptedVersion,acceptedJobId);
const operation=runtime.engine.preparePromptContext(accepted,3,{operation:'COMPLETE'});instruction=runtime.prompts.buildPromptRecord(3,accepted,operation.options);accepted.projectData.generatedPrompts.push(instruction);
const envelope=structuredClone(accepted.projectData.responseProposals.find(item=>item.stage===3).envelope);
Object.assign(envelope,{promptIdentity:{instructionId:instruction.instructionId,bodySha256:instruction.bodySha256,contractSha256:instruction.contractSha256,contextSignature:instruction.contextSignature},scope:instruction.scope});envelope.stageData.EXCEPTIONS_AND_EDGE_CONDITIONS='Revised synthetic exception handling.';
proposal=runtime.ingestion.prepare(accepted,{stage:3,text:JSON.stringify(envelope),promptRecord:instruction,expectedProjectRevision:accepted.revision+1});assert(proposal.validation.valid);
accepted=await store.writeProject(proposal.project,{expectedProjectRevision:accepted.revision});
const candidateVersion=(await store.readRecoveryHistory(acceptedJobId)).activeId,proposalId=proposal.proposal.proposalId;
assert.equal(accepted.stages[4].status,'COMPLETE','Staging a replacement changed accepted downstream work.');
const impact=runtime.ingestion.acceptanceImpact(accepted,proposalId),candidateHash=store.projectSha256(accepted);
assert(impact.requiresConfirmation);assert(impact.affectedStages.includes(4));
assert.throws(()=>runtime.ingestion.commit(accepted,proposalId),{code:'REPLACEMENT_CONFIRMATION_REQUIRED'});
assert.equal(store.projectSha256(accepted),candidateHash,'An unanswered confirmation changed accepted work.');
const changed=structuredClone(accepted);changed.stages[4].responseDraft='A newly edited dependent draft';
assert.throws(()=>runtime.ingestion.commit(changed,proposalId,{confirmationHash:impact.confirmationHash}),{code:'STALE_REPLACEMENT_CONFIRMATION'});
const committed=runtime.ingestion.commit(accepted,proposalId,{confirmationHash:impact.confirmationHash});
const duplicate=runtime.ingestion.commit(committed.project,proposalId,{confirmationHash:impact.confirmationHash});assert(duplicate.idempotent);assert.equal(hash.sha256Value(duplicate.project),hash.sha256Value(committed.project));
accepted=await store.writeProject(committed.project,{expectedProjectRevision:accepted.revision});const replacementVersion=(await store.readRecoveryHistory(acceptedJobId)).activeId;
assert.notEqual(accepted.stages[4].status,'COMPLETE');assert(accepted.projectData.requirements.every(record=>record.active===false||record.invalidatedBy),'A dependent accepted requirement survived replacement.');
for(const [version,complete] of [[acceptedVersion,true],[replacementVersion,false],[acceptedVersion,true]]){
 ({project:accepted}=await store.restoreVersion({jobId:acceptedJobId,versionId:version,expectedProjectRevision:accepted.revision}));assert.equal(accepted.stages[4].status==='COMPLETE',complete);
 if(complete)assert.deepEqual(accepted.projectData.requirements,acceptedCheckpoint.project.projectData.requirements);
}
({project:accepted}=await store.restoreVersion({jobId:acceptedJobId,versionId:candidateVersion,expectedProjectRevision:accepted.revision}));
assert.equal(accepted.projectData.responseProposals.find(item=>item.proposalId===proposalId).status,'PENDING_OPERATOR_REVIEW');
assert.throws(()=>runtime.ingestion.commit(accepted,proposalId,{confirmationHash:impact.confirmationHash}),{code:'STALE_PROPOSAL'});
const lateEnvelope={...envelope,warnings:['Delayed output arrived after restoration.']};const delayed=runtime.ingestion.prepare(accepted,{stage:3,text:JSON.stringify(lateEnvelope),promptRecord:instruction});assert(delayed.validation.issues.some(issue=>issue.code==='ABANDONED_OPERATION_RESPONSE'),'A delayed pre-restoration response was accepted.');
console.log(JSON.stringify({environment:'Node '+process.version+'; fake-indexeddb 6.2.5; isolated synthetic adapter cases',checkpoints:(await store.readRecoveryHistory(jobId)).entries.length,completeVersionRestores:13,atomicFailureBoundaries:6,reversibleAcceptance:true,unansweredCandidatePreserved:true,staleConfirmationRejected:true,abandonedResponseRejected:true,immutableBytes:true,retainedAlternatives:true,backupRestoresHistory:true,physicalDeviceAcceptance:false}));
(await store.openDatabase()).close();
