import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyRetainedHistoryOracles(){
 const source=process.env.RETAINED_HISTORY_SOURCE||new URL('./test-retained-history-browser.mjs',import.meta.url),text=fs.readFileSync(source,'utf8');
 const {verifyRetainedBackup,verifyRetainedRestore}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
 const content=[Buffer.from('first retained body'),Buffer.from('next retained body!')],fileBytes=Buffer.from('retained exact file bytes é\n');
 const entries=content.map((bytes,index)=>({id:'checkpoint-'+index,parentId:index?'checkpoint-0':null,sha256:sha(bytes),byteSize:bytes.length,projectSha256:String(index).repeat(64)}));
 const fileSha=sha(fileBytes),history={schema:'closed-loop-recovery/1',jobId:'SYNTHETIC-HISTORY',entries,sessions:{FIRST:{checkpointId:'checkpoint-0',startedAt:'2000-01-01T00:00:00.000Z'}},files:{[fileSha]:{byteSize:fileBytes.length}}};
 const artifacts=[...entries.map((entry,index)=>({artifactId:'RECOVERY-SNAPSHOT-'+entry.id,checkpointId:entry.id,archiveKind:'RECOVERY_SNAPSHOT',base64:content[index].toString('base64')})),{artifactId:'RECOVERY-BYTES-'+fileSha,archiveKind:'RECOVERY_BYTES',base64:fileBytes.toString('base64')}];
 const body={schema:'closed-loop-project-package/1',recovery:structuredClone(history),artifacts},before={history:structuredClone(history)},download=body=>({bytes:gzipSync(Buffer.from(JSON.stringify(body)))}),rows=[];
 const exported=verifyRetainedBackup(before,download(body));assert.equal(exported.report.verifiedByteMembers,3);assert.equal(exported.report.retainedPrefix,true);
 const restored={history:structuredClone(history),bytes:[...entries.map(entry=>({kind:'RECOVERY_SNAPSHOT',id:entry.id,byteSize:entry.byteSize,sha256:entry.sha256})),{kind:'RECOVERY_BYTES',id:fileSha,byteSize:fileBytes.length,sha256:fileSha}]};
 assert.equal(verifyRetainedRestore(exported,restored).verifiedRestoredMembers,3);rows.push({caseId:'RETAINED_HISTORY_LITERAL_CONTROL',result:'PASS'});
 function reject(caseId,action,oracle){assert.throws(action,error=>String(error.message).includes(oracle),caseId+': required history-loss counterexample was not detected by its owning assertion.');rows.push({caseId,result:'PASS',intendedOracle:oracle});}
 const omitted=structuredClone(body);omitted.recovery.entries.shift();reject('RETAINED_HISTORY_PREFIX_GUARD_ORACLE',()=>verifyRetainedBackup(before,download(omitted)),'RETAINED_HISTORY_IMMUTABLE_PREFIX_ORACLE');
 const session=structuredClone(body);delete session.recovery.sessions.FIRST;reject('RETAINED_HISTORY_SESSION_GUARD_ORACLE',()=>verifyRetainedBackup(before,download(session)),'RETAINED_HISTORY_SESSION_ORACLE');
 const bytes=structuredClone(body);const changed=Buffer.from(bytes.artifacts[0].base64,'base64');changed[0]^=1;bytes.artifacts[0].base64=changed.toString('base64');reject('RETAINED_HISTORY_EXPORT_BYTES_GUARD_ORACLE',()=>verifyRetainedBackup(before,download(bytes)),'RETAINED_HISTORY_EXPORTED_SNAPSHOT_BYTES_ORACLE');
 const missing=structuredClone(body);missing.artifacts=missing.artifacts.filter(row=>row.archiveKind!=='RECOVERY_BYTES');reject('RETAINED_HISTORY_EXPORT_FILE_GUARD_ORACLE',()=>verifyRetainedBackup(before,download(missing)),'RETAINED_HISTORY_EXPORTED_FILE_ORACLE');
 const lost=structuredClone(restored);lost.bytes[0].sha256='f'.repeat(64);reject('RETAINED_HISTORY_RESTORE_BYTES_GUARD_ORACLE',()=>verifyRetainedRestore(exported,lost),'RETAINED_HISTORY_RESTORED_BYTES_ORACLE');
 const extra=structuredClone(restored);extra.history.entries.push({id:'after-import-observation'});extra.history.sessions.LATER={checkpointId:'after-import-observation',startedAt:'2000-01-01T00:01:00.000Z'};assert.equal(verifyRetainedRestore(exported,extra).verifiedRestoredMembers,3);rows.push({caseId:'RETAINED_HISTORY_APPEND_CONTROL',result:'PASS'});
 const sourceBody=structuredClone(body),sourceSha=sha(Buffer.from('literal original project bytes')),sourceInfo={sha256:sourceSha,byteSize:Buffer.byteLength('literal original project bytes')};
 sourceBody.recovery.sourceArchives={SOURCE:sourceInfo};sourceBody.recovery.sourceArchiveReferences={[sourceSha]:{schema:'closed-loop-recovery-source-reference/1',checkpointId:entries[0].id,snapshotSha256:entries[0].sha256,activation:{revision:1}}};
 const sourceBefore={history:structuredClone(sourceBody.recovery)},sourceExported=verifyRetainedBackup(sourceBefore,download(sourceBody)),sourceRestored={history:structuredClone(sourceBody.recovery),bytes:[...restored.bytes,{kind:'ORIGINAL_SOURCE',id:sourceSha,byteSize:sourceInfo.byteSize,sha256:sourceSha}]};
 assert.equal(verifyRetainedRestore(sourceExported,sourceRestored).verifiedRestoredMembers,3);assert.equal(verifyRetainedRestore(sourceExported,sourceRestored).verifiedRestoredSourceArchives,1);rows.push({caseId:'RETAINED_HISTORY_SOURCE_LITERAL_CONTROL',result:'PASS'});
 const lostReference=structuredClone(sourceBody);delete lostReference.recovery.sourceArchiveReferences[sourceSha];reject('RETAINED_HISTORY_SOURCE_REFERENCE_GUARD_ORACLE',()=>verifyRetainedBackup(sourceBefore,download(lostReference)),'RETAINED_HISTORY_SOURCE_REFERENCE_ORACLE');
 const changedSource=structuredClone(sourceRestored);changedSource.bytes.at(-1).sha256='0'.repeat(64);reject('RETAINED_HISTORY_SOURCE_BYTES_GUARD_ORACLE',()=>verifyRetainedRestore(sourceExported,changedSource),'RETAINED_HISTORY_RESTORED_BYTES_ORACLE');
 return {schema:'closed-loop-retained-history-verifier-oracles/1',cases:rows,passed:true,synthetic:true,boundary:'Independent literal exported package bytes and retained descriptors test the verifier assertions. No application/browser storage behavior is asserted.',helperSha256:sha(text)};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)console.log(JSON.stringify(await verifyRetainedHistoryOracles(),null,2));
