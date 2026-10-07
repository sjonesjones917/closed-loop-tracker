import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const packageBody=async blob=>JSON.parse(gunzipSync(Buffer.from(await blob.arrayBuffer())).toString('utf8'));
// Independent transport-byte oracle: locate the root /project object without
// parsing and reserializing it. Its whitespace, escapes, and number spelling
// remain exactly the bytes supplied to the production package reader.
async function projectSourceBytes(blob){
 const bytes=gunzipSync(Buffer.from(await blob.arrayBuffer()));let depth=0,string=false,escaped=false,keyStart=-1,sourceStart=-1,awaitingProject=false;
 for(let offset=0;offset<bytes.length;offset++){
  const byte=bytes[offset];
  if(string){if(escaped)escaped=false;else if(byte===92)escaped=true;else if(byte===34){string=false;if(keyStart>=0){awaitingProject=bytes.subarray(keyStart,offset+1).toString('utf8')==='"project"';keyStart=-1;}}continue;}
  if(byte===34){string=true;if(depth===1)keyStart=offset;continue;}
  if(byte===123||byte===91){if(depth===1&&awaitingProject){assert.equal(byte,123);sourceStart=offset;awaitingProject=false;}depth++;}
  if(byte===125||byte===93){depth--;if(sourceStart>=0&&depth===1)return bytes.subarray(sourceStart,offset+1);}
 }
 assert.fail('Independent root project-byte span is absent.');
}

// Scaled capacities exercise the production accounting and transaction owners;
// no fixture bypasses save, checkpoint, export, import, reload, or restoration.
// This adapter is not browser/physical-device or full-production-byte evidence.
export async function verifyBackupCapacityRoundtrip({ownerSource=fs.readFileSync('project-store.js','utf8'),headroom=false}={}){
 const cases=[],make=(retainedBytes=1024*1024,compressedBytes=512*1024*1024)=>{
  for(const anchor of ['maxRetainedFileBytes:1024*1024*1024','maxCompressedProjectBytes:512*1024*1024'])assert.equal(ownerSource.split(anchor).length-1,1,'CAPACITY_CONFIGURATION_ANCHOR_ORACLE');
  const r=projectStoreRuntime({sourceOverrides:{'project-store.js':ownerSource.replace('maxRetainedFileBytes:1024*1024*1024','maxRetainedFileBytes:'+retainedBytes).replace('maxCompressedProjectBytes:512*1024*1024','maxCompressedProjectBytes:'+compressedBytes)}});
  assert.equal(r.store.HISTORY_LIMITS.maxRetainedFileBytes,retainedBytes);assert.equal(r.store.HISTORY_LIMITS.maxCompressedProjectBytes,compressedBytes);return r;
 };
 const source=make(),p=source.core.createBlankState('JOB-SYNTHETIC-BACKUP-CAPACITY');source.engine.ensureShape(p);
 p.opaqueExtension=source.copy({payload:'Unknown original source bytes. '.repeat(22000),decimal:1,escaped:'a'});
 source.engine.recalculate(p);const saved=await source.store.writeProject(p,{expectedProjectRevision:0});
 await source.store.beginHistorySession('SYNTHETIC-CAPACITY-SESSION');
 const baseline=await source.store.historyList(saved.job.JOB_ID),backup=await source.store.exportPackage(saved.job.JOB_ID),body=await packageBody(backup);
 const sourceBytes=(await projectSourceBytes(backup)).length;
 assert(baseline.retainedFileBytes<1024*1024&&baseline.retainedFileBytes+sourceBytes>1024*1024,'CAPACITY_TRIGGER_ORACLE');
 const destination=make(headroom?3*1024*1024:baseline.retainedFileBytes,headroom?512*1024*1024:baseline.compressedProjectBytes);
 let imported;
 try{imported=await destination.store.importPackage(backup);}catch(error){assert.fail('BACKUP_CAPACITY_ROUNDTRIP_ORACLE: native backup within both declared limits must restore; actual '+error.code);}
 assert.deepEqual(plain(imported.projectData),plain(saved.projectData));assert.deepEqual(plain(imported.opaqueExtension),plain(saved.opaqueExtension));
 assert.equal((await destination.store.readProject(saved.job.JOB_ID)).projectSha256,imported.projectSha256);
 cases.push({caseId:headroom?'sufficient-headroom-control':'both-exact-byte-limits-native-restore',passed:true,retainedFileBytes:baseline.retainedFileBytes,compressedProjectBytes:baseline.compressedProjectBytes,sourceBytes});
 if(headroom)return {synthetic:true,actualBrowser:false,cases};
 const originalEntries=plain(baseline.entries),expectedSources=new Map();let current=destination,currentProject=imported,currentBackup=backup;
 for(let cycle=0;cycle<3;cycle++){
  const expected=await projectSourceBytes(currentBackup),digest=sha(expected);expectedSources.set(digest,expected);
  const history=await current.store.historyList(saved.job.JOB_ID);
  assert.deepEqual(plain(history.entries),originalEntries,'CAPACITY_HISTORY_PRESERVED_ORACLE');
  assert.equal(history.retainedFileBytes,baseline.retainedFileBytes,'CAPACITY_NO_DUPLICATE_SOURCE_BYTES_ORACLE');assert.equal(history.compressedProjectBytes,baseline.compressedProjectBytes);
  for(const [sourceSha256,bytes] of expectedSources){const row=await current.store.readOriginalSourceArchive(saved.job.JOB_ID,sourceSha256);assert.deepEqual(Buffer.from(await row.blob.arrayBuffer()),bytes,'CAPACITY_EXACT_SOURCE_BYTES_ORACLE');}
  const repeat=await current.store.importPackage(currentBackup),repeatHistory=await current.store.historyList(saved.job.JOB_ID);assert.deepEqual(plain(repeatHistory.sourceArchives),plain(history.sourceArchives),'CAPACITY_IDENTICAL_SOURCE_DEDUP_ORACLE');
  currentProject=(await current.store.restoreCheckpoint(saved.job.JOB_ID,history.sessions['SYNTHETIC-CAPACITY-SESSION'].checkpointId,{expectedProjectRevision:repeat.revision})).project;
  assert.deepEqual(plain(currentProject.opaqueExtension),plain(saved.opaqueExtension));
  currentBackup=await current.store.exportPackage(saved.job.JOB_ID);const fresh=make(baseline.retainedFileBytes,baseline.compressedProjectBytes);currentProject=await fresh.store.importPackage(currentBackup);current=fresh;
 }
 cases.push({caseId:'three-export-import-reload-history-cycles-and-exact-retry',passed:true,cycles:3,allOriginalHistory:true,exactSourceBytes:true});
 // Noncanonical source spelling carries information not represented by the
 // parsed project. It must retain its actual bytes through the existing path.
 const exportedText=gunzipSync(Buffer.from(await backup.arrayBuffer())).toString('utf8'),spelling='"decimal":1,"escaped":"a"',originalSpelling='"decimal":1.000e0,"escaped":"\\u0061"';
 assert(exportedText.includes(spelling));const lexicalBackup=new Blob([gzipSync(exportedText.replace(spelling,originalSpelling))]),lexicalExpected=await projectSourceBytes(lexicalBackup),lexicalSha=sha(lexicalExpected),lexical=make(3*1024*1024);
 assert(lexicalExpected.includes(Buffer.from(originalSpelling)),'CAPACITY_LEXICAL_FIXTURE_ORACLE');
 const lexicalProject=await lexical.store.importPackage(lexicalBackup),lexicalHistory=await lexical.store.historyList(saved.job.JOB_ID);
 assert(!lexicalHistory.sourceArchiveReferences?.[lexicalSha],'CAPACITY_LEXICAL_FALLBACK_ORACLE');
 assert.deepEqual(Buffer.from(await (await lexical.store.readOriginalSourceArchive(saved.job.JOB_ID,lexicalSha)).blob.arrayBuffer()),lexicalExpected,'CAPACITY_LEXICAL_EXACT_BYTES_ORACLE');
 const lexicalNext=await lexical.store.exportPackage(saved.job.JOB_ID),lexicalFresh=make(3*1024*1024);await lexicalFresh.store.importPackage(lexicalNext);
 assert.deepEqual(Buffer.from(await (await lexicalFresh.store.readOriginalSourceArchive(saved.job.JOB_ID,lexicalSha)).blob.arrayBuffer()),lexicalExpected);
 assert.deepEqual(plain((await lexicalFresh.store.readProject(saved.job.JOB_ID)).opaqueExtension),plain(lexicalProject.opaqueExtension));
 cases.push({caseId:'noncanonical-number-and-escape-spelling-retained-through-second-export',passed:true,rawFallbackBytes:lexicalExpected.length});

 const protectedStore=make(),prior=await protectedStore.store.importPackage(backup),unrelated=await protectedStore.store.createProject({commandId:'CAPACITY-UNRELATED'}),priorHistory=plain(await protectedStore.store.historyList(saved.job.JOB_ID));
 const unchanged=async()=>{assert.deepEqual(plain(await protectedStore.store.readProject(saved.job.JOB_ID)),plain(prior),'CAPACITY_IMPORT_ATOMIC_ORACLE');assert.deepEqual(plain(await protectedStore.store.readProject(unrelated.job.JOB_ID)),plain(unrelated));assert.deepEqual(plain(await protectedStore.store.historyList(saved.job.JOB_ID)),priorHistory);};
 const referencedBody=await packageBody(currentBackup),pack=payload=>{delete payload.packageSha256;payload.packageSha256=source.runtime.closedLoopHash.sha256Value(source.copy(payload));return new Blob([gzipSync(JSON.stringify(payload))]);};
 for(const fault of ['missing-checkpoint','wrong-snapshot-digest','unauthorized-overlay','changed-overlay','non-utf8-source','missing-snapshot-bytes','corrupt-snapshot-bytes','unknown-version','null-overlay','array-overlay','unknown-property','parsed-payload-mismatch','orphan-reference','null-reference']){
  const malformed=structuredClone(referencedBody),sourceDigest=Object.keys(malformed.recovery.sourceArchiveReferences)[0],reference=malformed.recovery.sourceArchiveReferences[sourceDigest];
  if(fault==='missing-checkpoint')reference.checkpointId='MISSING-SOURCE-CHECKPOINT';
  if(fault==='wrong-snapshot-digest')reference.snapshotSha256='0'.repeat(64);
  if(fault==='unauthorized-overlay')reference.activation.job={JOB_ID:'WRONG-PROJECT'};
  if(fault==='changed-overlay')reference.activation.revision=Number(reference.activation.revision)+1;
  if(fault==='unknown-version')reference.schema='closed-loop-recovery-source-reference/999';
  if(fault==='null-overlay')reference.activation=null;
  if(fault==='array-overlay')reference.activation=[];
  if(fault==='unknown-property')reference.unregistered='rejected';
  if(fault==='orphan-reference')malformed.recovery.sourceArchiveReferences['0'.repeat(64)]=reference;
  if(fault==='null-reference')malformed.recovery.sourceArchiveReferences[sourceDigest]=null;
  if(fault==='parsed-payload-mismatch'){
   const [key,descriptor]=Object.entries(malformed.recovery.sourceArchives).find(([,row])=>row.sha256===sourceDigest);delete malformed.recovery.sourceArchives[key];descriptor.parsedPayloadSha256='0'.repeat(64);malformed.recovery.sourceArchives[source.runtime.closedLoopHash.sha256Value(source.copy(descriptor))]=descriptor;
  }
  if(fault==='non-utf8-source'){
   const [key,descriptor]=Object.entries(malformed.recovery.sourceArchives).find(([,row])=>row.sha256===sourceDigest);delete malformed.recovery.sourceArchives[key];descriptor.sourceEncoding='UTF-16LE_CODE_UNITS';malformed.recovery.sourceArchives[source.runtime.closedLoopHash.sha256Value(source.copy(descriptor))]=descriptor;
  }
  if(fault==='missing-snapshot-bytes'||fault==='corrupt-snapshot-bytes'){
   const artifact=malformed.artifacts.find(row=>row.archiveKind==='RECOVERY_SNAPSHOT'&&row.checkpointId===reference.checkpointId);
   if(fault==='missing-snapshot-bytes'){malformed.artifacts=malformed.artifacts.filter(row=>row!==artifact);malformed.packageManifest.artifacts=malformed.packageManifest.artifacts.filter(row=>row.artifactId!==artifact.artifactId);malformed.packageManifest.artifactCount--;}
   else{const corrupt=Buffer.from(artifact.base64,'base64');corrupt[Math.floor(corrupt.length/2)]^=1;artifact.base64=corrupt.toString('base64');artifact.sha256=sha(corrupt);Object.assign(malformed.packageManifest.artifacts.find(row=>row.artifactId===artifact.artifactId),{sha256:artifact.sha256});}
  }
  await assert.rejects(protectedStore.store.importPackage(pack(malformed)),error=>error.code===(fault==='corrupt-snapshot-bytes'?'HISTORY_SNAPSHOT_INTEGRITY_FAILED':'SOURCE_ARCHIVE_INTEGRITY_FAILED'),'CAPACITY_REFERENCE_REJECTION_ORACLE: '+fault);await unchanged();
 }
 cases.push({caseId:'malformed-and-missing-corrupt-source-reference-dependencies',passed:true,cases:14,lastValidAndUnrelatedProjectPreserved:true});
 protectedStore.runtime.__closedLoopStorageFault='before-import-commit';
 await assert.rejects(protectedStore.store.importPackage(currentBackup),error=>error.code==='INJECTED_STORAGE_FAILURE','CAPACITY_TRANSACTION_ABORT_ORACLE');await unchanged();delete protectedStore.runtime.__closedLoopStorageFault;
 const committed=await protectedStore.store.importPackage(currentBackup);assert.equal((await protectedStore.store.readProject(saved.job.JOB_ID)).projectSha256,committed.projectSha256);
 const merged=await protectedStore.store.historyList(saved.job.JOB_ID);for(const key of Object.keys(priorHistory.sourceArchives))assert.deepEqual(plain(merged.sourceArchives[key]),priorHistory.sourceArchives[key]);
 assert.equal(merged.retainedFileBytes,baseline.retainedFileBytes);cases.push({caseId:'interrupted-import-preserves-last-valid-state-and-retry-merges-history',passed:true});
 const full=make(baseline.retainedFileBytes,baseline.compressedProjectBytes),fullProject=await full.store.importPackage(backup),fullHistory=plain(await full.store.historyList(saved.job.JOB_ID));
 await assert.rejects(full.store.importPackage(lexicalBackup),error=>error.code==='HISTORY_LIMIT_REACHED','CAPACITY_DISTINCT_RAW_BOUND_ORACLE');
 assert.deepEqual(plain(await full.store.readProject(saved.job.JOB_ID)),plain(fullProject));assert.deepEqual(plain(await full.store.historyList(saved.job.JOB_ID)),fullHistory);
 cases.push({caseId:'distinct-raw-source-beyond-bound-rejected-with-prior-state-intact',passed:true});
 return {synthetic:true,actualBrowser:false,boundary:'Production store through transaction adapter; scaled exact simultaneous byte limits',cases};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const path=process.argv.find(arg=>arg.startsWith('--owner-source='))?.slice('--owner-source='.length);
 let ownerSource=fs.readFileSync(path||'project-store.js','utf8');
 if(process.argv.includes('--fault=source-copy')){
  const guard='if(reconstructed.size===sourceRow.byteSize&&await hash.sha256Bytes(reconstructed)===sourceRow.sha256)sourceReference=reference;';
  assert(ownerSource.includes(guard),'Capacity fault owner is missing.');ownerSource=ownerSource.replace(guard,'sourceReference=null;');
 }
 console.log(JSON.stringify(await verifyBackupCapacityRoundtrip({ownerSource,headroom:process.argv.includes('--headroom')})));
}
