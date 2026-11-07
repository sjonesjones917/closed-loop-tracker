import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {decodeDownloadedBackup,parseDownloadedBackupJson} from './downloaded-backup-decoder.mjs';
import {verifyRetainedBackup} from './test-retained-history-browser.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const compressed=text=>gzipSync(Buffer.from(text));
async function* chunks(bytes,size){for(let offset=0;offset<bytes.length;offset+=size)yield bytes.subarray(offset,offset+size);}

export async function verifyDownloadedBackupDecoder(){
 const cases=[],record=(caseId,details={})=>cases.push({caseId,result:'PASS',...details});
 const literals=['null','true','false','-0','1e400','{"unknown":{"future":[1,"é😀",null]},"n":-0}','["\\uD800","\\uDC00","\\uD83D\\uDE00","\\b\\f\\n\\r\\t\\/\\\\\\\""]'];
 for(const text of literals)assert.deepEqual(await decodeDownloadedBackup(compressed(text)),JSON.parse(text));
 record('DOWNLOADED_BACKUP_JSON_VALUE_PARITY',{literalCount:literals.length});

 const splitText='{"é😀":"α\\uD83D\\uDE00\\n𐐀","tail":[-0,1.2e-3,true,null]}',splitBytes=Buffer.from(splitText);
 for(const size of [1,2,3,7])assert.deepEqual(await parseDownloadedBackupJson(chunks(splitBytes,size)),JSON.parse(splitText));
 record('DOWNLOADED_BACKUP_UTF8_AND_ESCAPE_SPLITS',{chunkSizes:[1,2,3,7]});

 // Buffer.toString('utf8') replaced invalid byte sequences in the former path.
 const invalidUtf8=Buffer.from([0x22,0xf0,0x28,0x8c,0x28,0x22]);
 assert.deepEqual(await parseDownloadedBackupJson(chunks(invalidUtf8,1)),JSON.parse(invalidUtf8.toString('utf8')));
 record('DOWNLOADED_BACKUP_UTF8_REPLACEMENT_PARITY');

 const ownText='{"z":1,"__proto__":{"polluted":true},"2":2,"a":0,"z":3,"a":-0}';
 const ownValue=await decodeDownloadedBackup(compressed(ownText)),ownExpected=JSON.parse(ownText);
 assert.deepEqual(Object.getOwnPropertyDescriptors(ownValue),Object.getOwnPropertyDescriptors(ownExpected));
 assert.deepEqual(Object.keys(ownValue),Object.keys(ownExpected));assert.equal(Object.getPrototypeOf(ownValue),Object.prototype);assert.equal({}.polluted,undefined);
 record('DOWNLOADED_BACKUP_DUPLICATE_KEYS_AND_OWN_PROTO');

 const largeValue='é😀\\"\n'.repeat(180000),largeText=JSON.stringify({unknownExtension:largeValue,after:true});let progress;
 assert.deepEqual(await decodeDownloadedBackup(compressed(largeText),{onProgress:value=>{progress=value;}}),JSON.parse(largeText));
 assert.equal(progress.expandedBytes,Buffer.byteLength(largeText));assert.equal(progress.complete,true);assert.ok(progress.stringCodeUnits>=largeValue.length);
 record('DOWNLOADED_BACKUP_MULTICHUNK_MEMBER',{expandedBytes:progress.expandedBytes,stringCodeUnits:largeValue.length});

 const depth=2048,deepText='['.repeat(depth)+'0'+']'.repeat(depth);let deep=await decodeDownloadedBackup(compressed(deepText));
 for(let level=0;level<depth;level++){assert.equal(Array.isArray(deep),true);assert.equal(deep.length,1);deep=deep[0];}assert.equal(deep,0);
 record('DOWNLOADED_BACKUP_DEEP_CONTAINER_STACK',{depth});

 const malformed=['',' ','undefined','NaN','Infinity','+1','01','1.','1e','-','[1,]','[,1]','[1 2]','{"a":}','{"a" 1}','{"a":1,}','{a:1}','{}[]','true false','"unterminated','"\\x20"','"\\u123"','"line\nbreak"','[','{'];
 for(const text of malformed)await assert.rejects(()=>decodeDownloadedBackup(compressed(text)),SyntaxError);
 record('DOWNLOADED_BACKUP_MALFORMED_JSON_REFUSAL',{literalCount:malformed.length});

 const validGzip=compressed('{"ok":true}'),badCrc=Buffer.from(validGzip);badCrc[badCrc.length-8]^=1;
 await assert.rejects(()=>decodeDownloadedBackup(badCrc),error=>error.code==='Z_DATA_ERROR');record('DOWNLOADED_BACKUP_GZIP_CRC_REFUSAL');
 await assert.rejects(()=>decodeDownloadedBackup(validGzip.subarray(0,validGzip.length-4)),error=>error.code==='Z_BUF_ERROR');record('DOWNLOADED_BACKUP_GZIP_TRUNCATION_REFUSAL');
 const malformedBadCrc=compressed('not JSON');malformedBadCrc[malformedBadCrc.length-8]^=1;
 await assert.rejects(()=>decodeDownloadedBackup(malformedBadCrc),error=>error.code==='Z_DATA_ERROR');record('DOWNLOADED_BACKUP_GZIP_ERROR_PRECEDENCE');
 assert.deepEqual(await decodeDownloadedBackup(Buffer.concat([compressed('{"joined":'),compressed('[1,2]}')])),{joined:[1,2]});record('DOWNLOADED_BACKUP_CONCATENATED_GZIP');

 for(const [text,options]of [['{"x":1}',{maxExpandedBytes:3}],['"abcd"',{maxStringCodeUnits:3}],['[1,2]',{maxValues:2}]])await assert.rejects(()=>decodeDownloadedBackup(compressed(text),options),error=>error.code==='BACKUP_DECODE_RESOURCE_LIMIT');
 await assert.rejects(()=>decodeDownloadedBackup(validGzip,{maxExpandedBytes:0}),RangeError);
 record('DOWNLOADED_BACKUP_EXPLICIT_DIAGNOSTIC_LIMITS',{refusals:4});

 const snapshot=Buffer.from('literal retained snapshot é'),savedFile=Buffer.from('literal retained file'),fileSha=sha(savedFile),entry={id:'root-1',parentId:null,byteSize:snapshot.length,sha256:sha(snapshot),projectSha256:'a'.repeat(64)};
 const history={schema:'closed-loop-recovery/1',jobId:'DECODER-LITERAL',entries:[entry],sessions:{SESSION:{checkpointId:entry.id}},files:{[fileSha]:{byteSize:savedFile.length}}};
 const body={schema:'closed-loop-project-package/1',project:{job:{JOB_ID:history.jobId}},recovery:history,artifacts:[{artifactId:'RECOVERY-SNAPSHOT-'+entry.id,checkpointId:entry.id,archiveKind:'RECOVERY_SNAPSHOT',base64:snapshot.toString('base64')},{artifactId:'RECOVERY-BYTES-'+fileSha,archiveKind:'RECOVERY_BYTES',base64:savedFile.toString('base64')}],futureExtension:{records:[{unrecognized:'preserve me'}]}};
 const before={history:structuredClone(history)};
 async function retained(value){const file={bytes:compressed(JSON.stringify(value))},originalSha=sha(file.bytes),decoded=await decodeDownloadedBackup(file.bytes);assert.equal(sha(file.bytes),originalSha);assert.deepEqual(decoded,JSON.parse(JSON.stringify(value)));return verifyRetainedBackup(before,file,{decoded});}
 const ordinary=verifyRetainedBackup(before,{bytes:compressed(JSON.stringify(body))});assert.deepEqual(await retained(body),ordinary);record('DOWNLOADED_BACKUP_RETAINED_ORACLE_PARITY');
 const faults=[['DOWNLOADED_BACKUP_RETAINED_BYTES_GUARD',value=>{const bytes=Buffer.from(value.artifacts[0].base64,'base64');bytes[0]^=1;value.artifacts[0].base64=bytes.toString('base64');},'RETAINED_HISTORY_EXPORTED_SNAPSHOT_BYTES_ORACLE'],['DOWNLOADED_BACKUP_RETAINED_MEMBER_GUARD',value=>{value.artifacts.pop();},'RETAINED_HISTORY_EXPORTED_FILE_ORACLE'],['DOWNLOADED_BACKUP_RETAINED_PREFIX_GUARD',value=>{value.recovery.entries=[];},'RETAINED_HISTORY_IMMUTABLE_PREFIX_ORACLE'],['DOWNLOADED_BACKUP_RETAINED_SESSION_GUARD',value=>{delete value.recovery.sessions.SESSION;},'RETAINED_HISTORY_SESSION_ORACLE']];
 for(const [caseId,mutate,oracle]of faults){const changed=structuredClone(body);mutate(changed);await assert.rejects(()=>retained(changed),error=>error.message.includes(oracle));record(caseId,{intendedOracle:oracle});}

 // Execute both unchanged ordinary project-action bodies from the driver with
 // controlled transport. The decoder and exported-byte assertions are real;
 // this does not claim a Chromium or application execution.
 const driver=fs.readFileSync(new URL('./operator-browser-driver.mjs',import.meta.url),'utf8');
 const mainStart=driver.indexOf('  async function project(){'),mainEnd=driver.indexOf('\n  // Observe stored results',mainStart),isolatedStart=driver.indexOf('    const project=async()=>{'),isolatedEnd=driver.indexOf('\n    const observe=createWorkflowObservation',isolatedStart);
 assert.ok(mainStart>=0&&mainEnd>mainStart&&isolatedStart>=0&&isolatedEnd>isolatedStart);
 const expressions=[driver.slice(mainStart,mainEnd).trim(),driver.slice(isolatedStart,isolatedEnd).trim().slice('const project='.length,-1)];
 for(const [index,expression]of expressions.entries()){
  let calls=0;const actions=[],file={bytes:compressed(JSON.stringify(body))};
  const run=Function('evaluate','click','download','decodeDownloadedBackup','assert','return ('+expression+');')(async()=>false,async selector=>{actions.push(selector);},async selector=>{actions.push(selector);return [file];},async bytes=>{calls++;assert.equal(bytes,file.bytes);return decodeDownloadedBackup(bytes);},assert);
  const result=await run();assert.equal(calls,1);assert.equal(result.file,file);assert.deepEqual(result.package,body);assert.deepEqual(actions,index?['#project-actions-toggle','#export-project','#project-actions-toggle']:['#project-actions-toggle','#export-project']);
 }
 record('DOWNLOADED_BACKUP_BOTH_DRIVER_PROJECT_PATHS',{paths:2});
 const journey=fs.readFileSync(new URL('./verify-complete-operator-journey.mjs',import.meta.url),'utf8'),checkpointStart=journey.indexOf("      if(action.actionType==='EXPORT_PRE_DELIVERY_CHECKPOINT')"),checkpointEnd=journey.indexOf('\n      const controls=',checkpointStart);
 assert.ok(checkpointStart>=0&&checkpointEnd>checkpointStart);
 const checkpointFile={bytes:compressed(JSON.stringify(body))},checkpointReport={},checkpointCalls=[];checkpointFile.sha256=sha(checkpointFile.bytes);
 await Function('p','browser','report','decodeDownloadedBackup','observeRetainedHistory','verifyRetainedBackup','return (async()=>{for(const action of [{actionType:"EXPORT_PRE_DELIVERY_CHECKPOINT"}]){'+journey.slice(checkpointStart,checkpointEnd)+'}})();')(body.project,{download:async selector=>{assert.equal(selector,'#export-pre-delivery-checkpoint');checkpointCalls.push('DOWNLOAD');return [checkpointFile];}},checkpointReport,async bytes=>{assert.equal(bytes,checkpointFile.bytes);checkpointCalls.push('DECODE');return decodeDownloadedBackup(bytes);},async()=>{checkpointCalls.push('OBSERVE');return before;},(observed,file,{decoded}={})=>{assert.equal(observed,before);assert.equal(file,checkpointFile);assert.deepEqual(decoded,body);checkpointCalls.push('VERIFY');return verifyRetainedBackup(observed,file,{decoded});});
 assert.deepEqual(checkpointCalls,['OBSERVE','DOWNLOAD','DECODE','VERIFY']);assert.deepEqual(checkpointReport.preDeliveryBackup,{sha256:checkpointFile.sha256,byteSize:checkpointFile.bytes.length,history:ordinary.report});
 record('DOWNLOADED_BACKUP_CHECKPOINT_DECODED_HANDOFF');
 return {schema:'closed-loop-downloaded-backup-decoder/1',passed:true,synthetic:true,actualBrowser:false,actualApplication:false,cases,decoderSha256:sha(fs.readFileSync(new URL('./downloaded-backup-decoder.mjs',import.meta.url))),boundary:'Independent compressed fixture bytes exercise the verifier decoder, original retained-byte assertions and extracted driver project actions. No application/browser run or beyond-platform-string-limit fixture is claimed.'};
}
