import {verifyDownloadedBackupDecoder} from './test-downloaded-backup-decoder.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyRetainedHistoryOracles(){
 const source=process.env.RETAINED_HISTORY_SOURCE||new URL('./test-retained-history-browser.mjs',import.meta.url),text=fs.readFileSync(source,'utf8');
 const {verifyRetainedBackup,verifyRetainedRestore,observeRetainedHistory}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
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
 // History state form. A state entry may name its complete parts list by the
 // canonical digest of that list; the snapshot record and the backup keep the
 // list. The observer compares retained versions in the recorded form. These
 // rows are reported separately; the frozen recovery-scope case list is unchanged.
 const stateFormRows=[],canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 const parts={schema:'closed-loop-history-project-parts/1',entries:[{path:['stages','1'],sha256:fileSha,byteSize:fileBytes.length}]},records=entries.map((entry,index)=>index?entry:{...entry,projectParts:parts});
 const stateHistory={...structuredClone(history),entries:entries.map((entry,index)=>index?entry:{...entry,projectPartsSha256:sha(Buffer.from(canonical(parts)))})};
 const project={job:{JOB_ID:history.jobId},revision:3,projectSha256:'a'.repeat(64)};
 // A controlled page: the expression runs against literal stored rows, and its
 // result crosses a JSON boundary as a returned browser value does.
 const page=(state,recordRows)=>{const meta=new Map([['recovery:'+history.jobId,state],['recovery:'+history.jobId+':bytes:'+fileSha,{blob:new Blob([fileBytes])}]]);recordRows.forEach((row,index)=>{if(row)meta.set('recovery:'+history.jobId+':snapshot:'+row.id,{...row,blob:new Blob([content[index]])});});
  const closedLoopProjectStore={readProject:async id=>id===history.jobId?{revision:project.revision,projectSha256:project.projectSha256}:null,metaGet:async key=>structuredClone(meta.get(key))},closedLoopHash={sha256Bytes:async blob=>sha(Buffer.from(await blob.arrayBuffer()))};
  return {evaluate:async expression=>JSON.parse(JSON.stringify(await Function('closedLoopProjectStore','closedLoopHash','return '+expression)(closedLoopProjectStore,closedLoopHash)))};};
 const recordedBody={...structuredClone(body),recovery:{...structuredClone(history),entries:structuredClone(records)}};
 const observed=await observeRetainedHistory(page(stateHistory,records),project);
 assert.deepEqual(observed.history.entries,records,'RETAINED_HISTORY_STATE_FORM_OBSERVATION_CONTROL: state-form entries are observed as their records');
 const stateExported=verifyRetainedBackup(observed,download(recordedBody));assert.equal(stateExported.report.verifiedByteMembers,3);
 const stateRestored=await observeRetainedHistory(page(stateHistory,records),project,{verifyBytes:true});
 assert.equal(verifyRetainedRestore(stateExported,stateRestored).verifiedRestoredMembers,3);stateFormRows.push({caseId:'RETAINED_HISTORY_STATE_FORM_CONTROL',result:'PASS'});
 async function rejectObservation(caseId,state,recordRows,oracle){await assert.rejects(()=>observeRetainedHistory(page(state,recordRows),project),error=>String(error.message).includes(oracle),caseId+': a state-form entry that its record does not prove was accepted.');stateFormRows.push({caseId,result:'PASS',intendedOracle:oracle});}
 const wrongDigest=structuredClone(stateHistory);wrongDigest.entries[0].projectPartsSha256='f'.repeat(64);await rejectObservation('RETAINED_HISTORY_STATE_FORM_DIGEST_GUARD_ORACLE',wrongDigest,records,'RETAINED_HISTORY_STATE_FORM_DIGEST_ORACLE');
 const changedField=structuredClone(records);changedField[0].label='another version';await rejectObservation('RETAINED_HISTORY_STATE_FORM_FIELD_GUARD_ORACLE',stateHistory,changedField,'RETAINED_HISTORY_STATE_FORM_RECORD_ORACLE');
 const {projectParts:inlineParts,...forged}=records[0];await rejectObservation('RETAINED_HISTORY_STATE_FORM_RECORD_FORM_GUARD_ORACLE',stateHistory,[{...forged,projectPartsSha256:stateHistory.entries[0].projectPartsSha256},records[1]],'RETAINED_HISTORY_STATE_FORM_RECORD_ORACLE');
 await rejectObservation('RETAINED_HISTORY_STATE_FORM_MISSING_RECORD_GUARD_ORACLE',stateHistory,[null,records[1]],'RETAINED_HISTORY_RECORD_MISSING');
 const changedParts=structuredClone(recordedBody);changedParts.recovery.entries[0].projectParts.entries[0].byteSize++;
 assert.throws(()=>verifyRetainedBackup(observed,download(changedParts)),error=>String(error.message).includes('RETAINED_HISTORY_IMMUTABLE_PREFIX_ORACLE'),'RETAINED_HISTORY_STATE_FORM_PREFIX_GUARD_ORACLE: a backup whose recorded parts differ was accepted.');stateFormRows.push({caseId:'RETAINED_HISTORY_STATE_FORM_PREFIX_GUARD_ORACLE',result:'PASS',intendedOracle:'RETAINED_HISTORY_IMMUTABLE_PREFIX_ORACLE'});
 return {schema:'closed-loop-retained-history-verifier-oracles/1',cases:rows,stateFormCases:stateFormRows,downloadedBackupDecoder:await verifyDownloadedBackupDecoder(),passed:true,synthetic:true,boundary:'Independent literal exported package bytes and retained descriptors test the verifier assertions; a controlled page over literal rows tests the state-form observation. No application/browser storage behavior is asserted.',helperSha256:sha(text)};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)console.log(JSON.stringify(await verifyRetainedHistoryOracles(),null,2));
