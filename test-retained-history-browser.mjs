import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

// Observe retained state only. These checks never delete, replace, activate,
// fabricate or compact any History root, saved view, session, or file.
export async function observeRetainedHistory(browser,project,{verifyBytes=false}={}){
 const jobId=String(project?.job?.JOB_ID||''),revision=Number(project?.revision),projectSha256=String(project?.projectSha256||'');
 assert.ok(jobId&&Number.isInteger(revision)&&/^[a-f0-9]{64}$/.test(projectSha256),'RETAINED_HISTORY_PROJECT_IDENTITY_ORACLE');
 const observed=await browser.evaluate(`(async()=>{
  const jobId=${JSON.stringify(jobId)},store=closedLoopProjectStore,project=await store.readProject(jobId),history=await store.metaGet('recovery:'+jobId);
  if(project?.revision!==${revision}||project?.projectSha256!==${JSON.stringify(projectSha256)})throw new Error('RETAINED_HISTORY_STALE_PROJECT');
  if(!history)throw new Error('RETAINED_HISTORY_MISSING');
  const bytes=[];
  if(${verifyBytes}){
   for(const entry of history.entries){const saved=await store.metaGet('recovery:'+jobId+':snapshot:'+entry.id);if(!(saved?.blob instanceof Blob))throw new Error('RETAINED_HISTORY_SNAPSHOT_MISSING:'+entry.id);bytes.push({kind:'RECOVERY_SNAPSHOT',id:entry.id,byteSize:saved.blob.size,sha256:await closedLoopHash.sha256Bytes(saved.blob)});}
   for(const [sha,info]of Object.entries(history.files)){const saved=await store.metaGet('recovery:'+jobId+':bytes:'+sha);if(!(saved?.blob instanceof Blob))throw new Error('RETAINED_HISTORY_BYTES_MISSING:'+sha);bytes.push({kind:'RECOVERY_BYTES',id:sha,byteSize:saved.blob.size,sha256:await closedLoopHash.sha256Bytes(saved.blob)});}
  }
  return {jobId,revision:project.revision,projectSha256:project.projectSha256,history,bytes};
 })()`);
 assert.equal(observed.jobId,jobId);assert.ok(observed.history.entries.length>1,'RETAINED_HISTORY_ACCUMULATED_ROOTS_ORACLE');
 assert.ok(Object.keys(observed.history.sessions||{}).length>0,'RETAINED_HISTORY_SESSIONS_PRESENT_ORACLE');
 return observed;
}
function assertHistoryPrefix(expected,actual){
 assert.equal(actual.jobId,expected.jobId,'RETAINED_HISTORY_JOB_ORACLE');
 assert.deepEqual(actual.entries.slice(0,expected.entries.length),expected.entries,'RETAINED_HISTORY_IMMUTABLE_PREFIX_ORACLE');
 for(const [session,info]of Object.entries(expected.sessions||{}))assert.deepEqual(actual.sessions?.[session],info,'RETAINED_HISTORY_SESSION_ORACLE:'+session);
 for(const [sha,info]of Object.entries(expected.files||{}))assert.deepEqual(actual.files?.[sha],info,'RETAINED_HISTORY_FILE_DESCRIPTOR_ORACLE:'+sha);
 for(const [key,info]of Object.entries(expected.sourceArchives||{}))assert.deepEqual(actual.sourceArchives?.[key],info,'RETAINED_HISTORY_SOURCE_ARCHIVE_ORACLE:'+key);
}
export function verifyRetainedBackup(before,file,{decoded=null}={}){
 const backup=decoded||JSON.parse(gunzipSync(file.bytes).toString('utf8'));
 assert.equal(backup.schema,'closed-loop-project-package/1');assert.ok(backup.recovery,'RETAINED_HISTORY_PACKAGE_MANIFEST_ORACLE');
 assertHistoryPrefix(before.history,backup.recovery);
 const members=new Map();for(const member of backup.artifacts){assert.ok(!members.has(member.artifactId),'RETAINED_HISTORY_DUPLICATE_MEMBER_ORACLE');members.set(member.artifactId,member);}
 const bytes=[];
 for(const entry of backup.recovery.entries){const member=members.get('RECOVERY-SNAPSHOT-'+entry.id);assert.ok(member,'RETAINED_HISTORY_EXPORTED_SNAPSHOT_ORACLE:'+entry.id);assert.equal(member.archiveKind,'RECOVERY_SNAPSHOT');assert.equal(member.checkpointId,entry.id);const body=Buffer.from(member.base64,'base64'),observedSha256=sha256(body);assert.equal(body.length,entry.byteSize);assert.equal(observedSha256,entry.sha256,'RETAINED_HISTORY_EXPORTED_SNAPSHOT_BYTES_ORACLE:'+entry.id);bytes.push({kind:'RECOVERY_SNAPSHOT',id:entry.id,byteSize:body.length,sha256:observedSha256});}
 for(const [sha,info]of Object.entries(backup.recovery.files)){const member=members.get('RECOVERY-BYTES-'+sha);assert.ok(member,'RETAINED_HISTORY_EXPORTED_FILE_ORACLE:'+sha);assert.equal(member.archiveKind,'RECOVERY_BYTES');const body=Buffer.from(member.base64,'base64');assert.equal(body.length,info.byteSize);assert.equal(sha256(body),sha,'RETAINED_HISTORY_EXPORTED_FILE_BYTES_ORACLE:'+sha);bytes.push({kind:'RECOVERY_BYTES',id:sha,byteSize:body.length,sha256:sha});}
 return {history:backup.recovery,bytes,report:{backupSha256:sha256(file.bytes),backupByteSize:file.bytes.length,beforeEntryCount:before.history.entries.length,exportedEntryCount:backup.recovery.entries.length,sessionCount:Object.keys(backup.recovery.sessions||{}).length,retainedFileCount:Object.keys(backup.recovery.files||{}).length,verifiedByteMembers:bytes.length,retainedPrefix:true,retainedSessions:true,retainedHistoryBytes:true,manualHistoryMutations:false}};
}
export function verifyRetainedRestore(exported,restored){
 assertHistoryPrefix(exported.history,restored.history);
 const observed=new Map(restored.bytes.map(row=>[row.kind+':'+row.id,row]));
 for(const expected of exported.bytes)assert.deepEqual(observed.get(expected.kind+':'+expected.id),expected,'RETAINED_HISTORY_RESTORED_BYTES_ORACLE:'+expected.kind+':'+expected.id);
 return {retainedPrefix:true,retainedSessions:true,retainedHistoryBytes:true,restoredEntryCount:restored.history.entries.length,verifiedRestoredMembers:exported.bytes.length,manualHistoryMutations:false};
}
