import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const plain=value=>value===undefined?null:JSON.parse(JSON.stringify(value));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
const ROOT_VALUE='ROOT_EXTENSION_SENTINEL_35_10';
const MANIFEST_VALUE='MANIFEST_EXTENSION_SENTINEL_35_10';
const MEMBER_VALUE='MEMBER_EXTENSION_SENTINEL_35_10';
const ROOT_CANONICAL='"futureRootExtension":{"escaped":"'+ROOT_VALUE+'","numeric":123}';
const MANIFEST_CANONICAL='"futureManifestExtension":{"escaped":"'+MANIFEST_VALUE+'","numeric":456}';
const MEMBER_CANONICAL='"futureMemberExtension":{"escaped":"'+MEMBER_VALUE+'","numeric":789}';
const ROOT_LEXICAL='"futureRootExtension" : { "escaped":"\\u0052OOT_EXTENSION_SENTINEL_35_10","numeric":1.2300e+02 }';
const MANIFEST_LEXICAL='"futureManifestExtension" : { "escaped":"\\u004dANIFEST_EXTENSION_SENTINEL_35_10","numeric":4.5600e+02 }';
const MEMBER_LEXICAL='"futureMemberExtension" : { "escaped":"\\u004dEMBER_EXTENSION_SENTINEL_35_10","numeric":7.8900e+02 }';
const EXACT_FRAGMENTS=[ROOT_LEXICAL,MANIFEST_LEXICAL,MEMBER_LEXICAL].map(text=>({text,bytes:Buffer.from(text,'utf8'),sha256:sha256(Buffer.from(text,'utf8'))}));

const occurrences=(bytes,needle)=>{let total=0,offset=0;while((offset=bytes.indexOf(needle,offset))>=0){total++;offset+=needle.length;}return total;};
function packCanonical(payload){
 const body=structuredClone(payload);delete body.packageSha256;const packageSha256=sha256(Buffer.from(canonical(body),'utf8'));
 return new Blob([gzipSync(Buffer.from(canonical({...body,packageSha256}),'utf8'))],{type:'application/gzip'});
}
function packageWithExactExtensions(payload,activeArtifactId,mutate=()=>{}){
 const body=structuredClone(payload);delete body.packageSha256;
 body.futureRootExtension={escaped:ROOT_VALUE,numeric:123};
 body.packageManifest.futureManifestExtension={escaped:MANIFEST_VALUE,numeric:456};
 const member=body.packageManifest.artifacts.find(row=>row.artifactId===activeArtifactId);assert(member,'BACKUP_EXTENSION_ACTIVE_MEMBER_FIXTURE_ORACLE');
 member.futureMemberExtension={escaped:MEMBER_VALUE,numeric:789};
 mutate(body);
 const packageSha256=sha256(Buffer.from(canonical(body),'utf8'));let text=canonical({...body,packageSha256});
 const presentFragments=[];for(const [before,after] of [[ROOT_CANONICAL,ROOT_LEXICAL],[MANIFEST_CANONICAL,MANIFEST_LEXICAL],[MEMBER_CANONICAL,MEMBER_LEXICAL]]){const count=text.split(before).length-1;assert(count===0||count===1,'BACKUP_EXTENSION_LEXICAL_ANCHOR_ORACLE');if(count){text=text.replace(before,after);presentFragments.push(EXACT_FRAGMENTS.find(row=>row.text===after));}}
 const exactBytes=Buffer.from(text,'utf8'),parsed=JSON.parse(text),withoutDigest=structuredClone(parsed);delete withoutDigest.packageSha256;
 assert.equal(sha256(Buffer.from(canonical(withoutDigest),'utf8')),packageSha256,'BACKUP_EXTENSION_INDEPENDENT_PACKAGE_DIGEST_ORACLE');
 assert.equal(parsed.futureRootExtension.escaped,ROOT_VALUE);assert.equal(parsed.futureRootExtension.numeric,123);
 assert.equal(parsed.packageManifest.futureManifestExtension.escaped,MANIFEST_VALUE);assert.equal(parsed.packageManifest.futureManifestExtension.numeric,456);
 const parsedMember=parsed.packageManifest.artifacts.find(row=>row.artifactId===activeArtifactId);if(parsedMember){assert.equal(parsedMember.futureMemberExtension.escaped,MEMBER_VALUE);assert.equal(parsedMember.futureMemberExtension.numeric,789);}
 for(const fragment of presentFragments)assert.equal(occurrences(exactBytes,fragment.bytes),1,'BACKUP_EXTENSION_LITERAL_PRECONDITION_ORACLE');
 return {blob:new Blob([gzipSync(exactBytes)],{type:'application/gzip'}),exactBytes,packageSha256,presentFragments};
}
function copyRows(from,to){for(const [name,rows] of from.rows)to.rows.set(name,new Map([...rows].map(([key,value])=>[key,to.copy(value)])));}
async function artifactSnapshot(store,jobId){
 const rows=[];for(const row of await store.listArtifacts(jobId)){const bytes=Buffer.from(await row.blob.arrayBuffer()),{blob,...metadata}=row;rows.push({...plain(metadata),actualByteSize:bytes.length,actualSha256:sha256(bytes)});}return rows.sort((a,b)=>a.artifactId.localeCompare(b.artifactId));
}
async function recoverableSourceBytes(store,jobId){
 const history=await store.historyList(jobId),rows=[];
 for(const descriptor of Object.values(history.sourceArchives||{})){
  const source=await store.readOriginalSourceArchive(jobId,descriptor.sha256),bytes=Buffer.from(await source.blob.arrayBuffer());
  assert.equal(bytes.length,descriptor.byteSize,'BACKUP_EXTENSION_SOURCE_SIZE_ORACLE');assert.equal(sha256(bytes),descriptor.sha256,'BACKUP_EXTENSION_SOURCE_DIGEST_ORACLE');
  rows.push({descriptor:plain(descriptor),bytes});
 }
 return rows;
}
async function durableSnapshot(store,jobId){return {project:plain(await store.readProject(jobId)),history:plain(await store.historyList(jobId)),artifacts:await artifactSnapshot(store,jobId),sources:(await recoverableSourceBytes(store,jobId)).map(row=>({descriptor:row.descriptor,bytesBase64:row.bytes.toString('base64')})),pending:plain(await store.pendingBackupImportIdentity(jobId))};}
function assertExactFragments(rows,label){
 for(const fragment of EXACT_FRAGMENTS){const matches=rows.filter(row=>row.descriptor.sourceEncoding==='UTF-8'&&row.bytes.includes(fragment.bytes));assert(matches.length>0,`BACKUP_EXTENSION_EXACT_UTF8_BYTES_ORACLE:${label}:${fragment.sha256}`);}
}
function assertNoSentinel(value,label){const text=typeof value==='string'?value:JSON.stringify(value);for(const sentinel of [ROOT_VALUE,MANIFEST_VALUE,MEMBER_VALUE])assert(!text.includes(sentinel),`BACKUP_EXTENSION_NONOPERATIONAL_ORACLE:${label}:${sentinel}`);}
const gateDecision=gate=>plain({stage:gate.stage,complete:gate.complete,blocked:gate.blocked,reasons:gate.reasons,acceptedResponseCount:gate.acceptedResponseCount,priorReasonCount:gate.priorReasonCount});
async function assertActiveAndNonoperational(r,jobId,artifactId,artifactBytes,baselineGate,label){
 const project=await r.store.readProject(jobId),artifact=await r.store.getArtifact(artifactId),actual=Buffer.from(await artifact.blob.arrayBuffer());assert.deepEqual(actual,artifactBytes,`BACKUP_EXTENSION_ACTIVE_ARTIFACT_ORACLE:${label}`);
 assertNoSentinel(project,label+':project');assertNoSentinel(r.engine.stageContext(project,1),label+':stage-context');assertNoSentinel((await artifactSnapshot(r.store,jobId)).map(row=>plain(row)),label+':artifact-metadata');assert.deepEqual(gateDecision(r.engine.gate(1,project)),baselineGate,`BACKUP_EXTENSION_GATE_BASELINE_ORACLE:${label}`);
}
async function exportReloadAndAssert(r,jobId,label){
 const backup=await r.store.exportPackage(jobId),fresh=projectStoreRuntime(),project=await fresh.store.importPackage(backup),rows=await recoverableSourceBytes(fresh.store,jobId);assertExactFragments(rows,label+':export-reload');return {fresh,project,sourceCount:rows.length,backupSha256:sha256(Buffer.from(await backup.arrayBuffer()))};
}

export async function verifyBackupExtensionByteRetention(){
 const cases=[],artifactId='SYNTHETIC-BACKUP-EXTENSION-MEMBER',artifactBytes=Buffer.from('Independent active artifact bytes for extension retention.','utf8');
 const origin=projectStoreRuntime(),project=await origin.store.createProject({commandId:'SYNTHETIC-BACKUP-EXTENSION-RETENTION'}),jobId=project.job.JOB_ID;
 await origin.store.putArtifact({artifactId,jobId,blob:new Blob([artifactBytes],{type:'application/octet-stream'}),filename:'extension-member.bin',mediaType:'application/octet-stream',lineage:{stage:1,role:'SOURCE_MATERIAL'}});
 const baselineBlob=await origin.store.exportPackage(jobId),exported=JSON.parse(gunzipSync(Buffer.from(await baselineBlob.arrayBuffer())).toString('utf8')),extension=packageWithExactExtensions(exported,artifactId);
 const baselineRuntime=projectStoreRuntime(),baselineProject=await baselineRuntime.store.importPackage(baselineBlob),baselineGate=gateDecision(baselineRuntime.engine.gate(1,baselineProject));
 assert.equal((await recoverableSourceBytes(baselineRuntime.store,jobId)).some(row=>EXACT_FRAGMENTS.some(fragment=>row.bytes.includes(fragment.bytes))),false,'BACKUP_EXTENSION_BASELINE_ABSENCE_ORACLE');
 cases.push({caseId:'independent-literal-extension-and-baseline',passed:true,fragmentSha256:EXACT_FRAGMENTS.map(row=>row.sha256),packageSha256:extension.packageSha256});

 const precommitBefore=await durableSnapshot(origin.store,jobId),missing=structuredClone(exported);missing.packageManifest.artifacts=missing.packageManifest.artifacts.filter(row=>row.artifactId!==artifactId);missing.packageManifest.artifactCount--;
 await assert.rejects(origin.store.importPackage(packCanonical(missing)),error=>error.existingProjectsUnchanged===true&&error.message==='Package manifest does not reconcile with the embedded project and artifacts.','BACKUP_EXTENSION_MISSING_MEMBER_PRECOMMIT_ORACLE');assert.deepEqual(await durableSnapshot(origin.store,jobId),precommitBefore,'BACKUP_EXTENSION_MISSING_MEMBER_PRECOMMIT_STATE_ORACLE');
 const wrong=structuredClone(exported);wrong.packageManifest.artifacts.find(row=>row.artifactId===artifactId).sha256='0'.repeat(64);
 await assert.rejects(origin.store.importPackage(packCanonical(wrong)),error=>error.existingProjectsUnchanged===true&&error.message===`Package manifest mismatch for artifact ${artifactId}.`,'BACKUP_EXTENSION_WRONG_MEMBER_PRECOMMIT_ORACLE');assert.deepEqual(await durableSnapshot(origin.store,jobId),precommitBefore,'BACKUP_EXTENSION_WRONG_MEMBER_PRECOMMIT_STATE_ORACLE');
 cases.push({caseId:'known-member-precommit-validation-controls',passed:true,extensionCarrierRollbackClaimed:false});

 const stage=async(blob,expectedStagingId)=>origin.store.stageBackupImport({jobId,blob,rawFilename:'unknown-extension.closed-loop.gz',mediaType:'application/gzip',expectedProjectRevision:project.revision,expectedStateSha256:project.projectSha256,expectedStagingId});
 const assertPendingBytes=async(expected,stagingId,label)=>{const pending=await origin.store.readPendingBackupImport(jobId),bytes=Buffer.from(await pending.blob.arrayBuffer());assert.equal(pending.stagingId,stagingId,`BACKUP_EXTENSION_PENDING_IDENTITY_ORACLE:${label}`);assert.deepEqual(bytes,Buffer.from(await expected.arrayBuffer()),`BACKUP_EXTENSION_PENDING_EXACT_BYTES_ORACLE:${label}`);return bytes;};
 const missingExtension=packageWithExactExtensions(exported,artifactId,body=>{body.packageManifest.artifacts=body.packageManifest.artifacts.filter(row=>row.artifactId!==artifactId);body.packageManifest.artifactCount--;});
 let staged=await stage(missingExtension.blob,null),invalidBefore=await durableSnapshot(origin.store,jobId);await assertPendingBytes(missingExtension.blob,staged.stagingId,'missing-before');
 await assert.rejects(origin.store.importPackage(missingExtension.blob,{pendingBackupImport:{jobId,stagingId:staged.stagingId}}),error=>error.existingProjectsUnchanged===true&&error.message==='Package manifest does not reconcile with the embedded project and artifacts.','BACKUP_EXTENSION_STAGED_MISSING_MEMBER_ORACLE');assert.deepEqual(await durableSnapshot(origin.store,jobId),invalidBefore,'BACKUP_EXTENSION_STAGED_MISSING_STATE_ORACLE');await assertPendingBytes(missingExtension.blob,staged.stagingId,'missing-after');
 const wrongExtension=packageWithExactExtensions(exported,artifactId,body=>{body.packageManifest.artifacts.find(row=>row.artifactId===artifactId).sha256='0'.repeat(64);});
 staged=await stage(wrongExtension.blob,staged.stagingId);invalidBefore=await durableSnapshot(origin.store,jobId);await assertPendingBytes(wrongExtension.blob,staged.stagingId,'wrong-before');
 await assert.rejects(origin.store.importPackage(wrongExtension.blob,{pendingBackupImport:{jobId,stagingId:staged.stagingId}}),error=>error.existingProjectsUnchanged===true&&error.message===`Package manifest mismatch for artifact ${artifactId}.`,'BACKUP_EXTENSION_STAGED_WRONG_MEMBER_ORACLE');assert.deepEqual(await durableSnapshot(origin.store,jobId),invalidBefore,'BACKUP_EXTENSION_STAGED_WRONG_STATE_ORACLE');await assertPendingBytes(wrongExtension.blob,staged.stagingId,'wrong-after');
 staged=await stage(extension.blob,staged.stagingId);const selectedBytes=await assertPendingBytes(extension.blob,staged.stagingId,'valid-before-resume');cases.push({caseId:'extension-bearing-staged-validation-retries-preserve-exact-selected-input',passed:true,missingFragmentCount:missingExtension.presentFragments.length,wrongFragmentCount:wrongExtension.presentFragments.length});

 const resumed=projectStoreRuntime();copyRows(origin,resumed);const resumedInput=await resumed.store.readPendingBackupImport(jobId);assert.deepEqual(Buffer.from(await resumedInput.blob.arrayBuffer()),selectedBytes,'BACKUP_EXTENSION_RESUME_INPUT_ORACLE');
 const faultBefore=await durableSnapshot(resumed.store,jobId),faultPendingBytes=Buffer.from(await resumedInput.blob.arrayBuffer());resumed.runtime.__closedLoopStorageFault='before-import-commit';
 try{await assert.rejects(resumed.store.importPackage(extension.blob,{pendingBackupImport:{jobId,stagingId:staged.stagingId}}),error=>error.code==='INJECTED_STORAGE_FAILURE'&&error.existingProjectsUnchanged===true,'BACKUP_EXTENSION_BEFORE_COMMIT_FAULT_ORACLE');}finally{delete resumed.runtime.__closedLoopStorageFault;}
 assert.deepEqual(await durableSnapshot(resumed.store,jobId),faultBefore,'BACKUP_EXTENSION_BEFORE_COMMIT_COMPLETE_STATE_ORACLE');const pendingAfterFault=await resumed.store.readPendingBackupImport(jobId);assert.equal(pendingAfterFault.stagingId,staged.stagingId,'BACKUP_EXTENSION_BEFORE_COMMIT_PENDING_IDENTITY_ORACLE');assert.deepEqual(Buffer.from(await pendingAfterFault.blob.arrayBuffer()),faultPendingBytes,'BACKUP_EXTENSION_BEFORE_COMMIT_PENDING_BYTES_ORACLE');
 await resumed.store.importPackage(extension.blob,{pendingBackupImport:{jobId,stagingId:staged.stagingId}});assert.equal(await resumed.store.pendingBackupImportIdentity(jobId),null,'BACKUP_EXTENSION_STAGED_CONSUME_ORACLE');
 const stagedSources=await recoverableSourceBytes(resumed.store,jobId);assertExactFragments(stagedSources,'staged');await assertActiveAndNonoperational(resumed,jobId,artifactId,artifactBytes,baselineGate,'staged');const stagedReload=await exportReloadAndAssert(resumed,jobId,'staged');await assertActiveAndNonoperational(stagedReload.fresh,jobId,artifactId,artifactBytes,baselineGate,'staged-export-reload');
 cases.push({caseId:'staged-resume-before-commit-rollback-retry-export-reload-exact-extension-bytes',passed:true,sourceCount:stagedSources.length,reloadSourceCount:stagedReload.sourceCount,rollbackCompared:['project','History','artifact metadata and bytes','retained source descriptors and bytes','pending staging identity and bytes']});

 const direct=projectStoreRuntime();await direct.store.importPackage(extension.blob);const directSources=await recoverableSourceBytes(direct.store,jobId);assertExactFragments(directSources,'direct');await assertActiveAndNonoperational(direct,jobId,artifactId,artifactBytes,baselineGate,'direct');const directReload=await exportReloadAndAssert(direct,jobId,'direct');await assertActiveAndNonoperational(directReload.fresh,jobId,artifactId,artifactBytes,baselineGate,'direct-export-reload');
 cases.push({caseId:'direct-import-export-reload-exact-extension-bytes',passed:true,sourceCount:directSources.length,reloadSourceCount:directReload.sourceCount});

 return {schema:'backup-extension-byte-retention-check/2',synthetic:true,actualBrowser:false,boundary:'Production project-store import, staging, History raw UTF-8 source archive and export owners through the existing Map transaction adapter; no native IndexedDB or browser claim.',cases,result:'PASS'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await verifyBackupExtensionByteRetention(),null,2));
