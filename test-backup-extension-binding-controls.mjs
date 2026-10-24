import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import fs from 'node:fs';
import {projectStoreRuntime as mapRuntime} from './test-project-store-runtime.mjs';

const sha256=value=>createHash('sha256').update(value).digest('hex');
const runtimeWithSources=(sourceOverrides={})=>mapRuntime({sourceOverrides});
const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
const plain=value=>value===undefined?null:JSON.parse(JSON.stringify(value));

const ROOT_ONLY_FRAGMENT='"rootOnlyFuture" : { "lexical":"\\u0052OOT_ONLY_35_10","n":1.00e+1 }';
const DUP_ROOT_FIRST='"du\\u0070Future" : {"ordinal":"FIRST_35_10","n":1.0e+0}';
const DUP_ROOT_SECOND='"dupFuture": { "ordinal":"SECOND_35_10","n":2.00e+0 }';
const SUPERSEDED_FOREIGN='"packageManifest" : {"jobId":"FOREIGN-JOB","projectSha256":"bad","artifactCount":999,"artifacts":[],"futureSuperseded":{"marker":"FOREIGN_35_10"}}';
const SUPERSEDED_INVALID='"packageManifest": { "jobId":null,"projectSha256":7,"artifactCount":"bad","artifacts":"bad","futureSuperseded":{"marker":"INVALID_KNOWN_35_10"} }';
const SUPERSEDED_NESTED_DUPLICATE='"packageManifest" : {"jobId":"FOREIGN-NESTED","projectSha256":"bad","artifactCount":0,"artifacts":[{"artifactId":"OLD","filename":"old.bin","mediaType":"application/octet-stream","byteSize":0,"sha256":"0000000000000000000000000000000000000000000000000000000000000000","futureMember":"NESTED_OVERWRITTEN_35_10"}],"artifacts":[]}';
const exactSha256=text=>sha256(Buffer.from(text,'utf8'));

function packageBlobFromBody(body,replaceMember=text=>text){
  const effective=structuredClone(body);delete effective.packageSha256;
  const packageSha256=sha256(Buffer.from(canonical(effective),'utf8'));
  let text=canonical({...effective,packageSha256});
  text=replaceMember(text,effective);
  const parsed=JSON.parse(text),withoutDigest=structuredClone(parsed);delete withoutDigest.packageSha256;
  assert.equal(sha256(Buffer.from(canonical(withoutDigest),'utf8')),parsed.packageSha256,'BACKUP_EXTENSION_INDEPENDENT_PACKAGE_HASH_ORACLE');
  return {blob:new Blob([gzipSync(Buffer.from(text,'utf8'))],{type:'application/gzip'}),text,packageSha256};
}

function rootOnlyPackage(payload){
  const body=structuredClone(payload);delete body.packageSha256;body.rootOnlyFuture={lexical:'ROOT_ONLY_35_10',n:10};
  const canonicalMember='"rootOnlyFuture":'+canonical(body.rootOnlyFuture);
  return packageBlobFromBody(body,text=>{assert.equal(text.split(canonicalMember).length-1,1,'BACKUP_ROOT_ONLY_MEMBER_ANCHOR_ORACLE');return text.replace(canonicalMember,ROOT_ONLY_FRAGMENT);});
}

function duplicatePackage(payload){
  const body=structuredClone(payload);delete body.packageSha256;body.dupFuture={ordinal:'SECOND_35_10',n:2};
  const rootMember='"dupFuture":'+canonical(body.dupFuture),manifestMember='"packageManifest":'+canonical(body.packageManifest);
  return packageBlobFromBody(body,text=>{
    assert.equal(text.split(rootMember).length-1,1,'BACKUP_DUPLICATE_ROOT_ANCHOR_ORACLE');
    assert.equal(text.split(manifestMember).length-1,1,'BACKUP_DUPLICATE_MANIFEST_ANCHOR_ORACLE');
    return text.replace(rootMember,DUP_ROOT_FIRST+','+DUP_ROOT_SECOND).replace(manifestMember,SUPERSEDED_FOREIGN+','+SUPERSEDED_INVALID+','+SUPERSEDED_NESTED_DUPLICATE+','+manifestMember);
  });
}

async function extensionInventory(r,jobId){
  const history=await r.store.historyList(jobId),rows=[];
  for(const descriptor of Object.values(history.sourceArchives||{}).filter(row=>row.kind==='ORIGINAL_PACKAGE_EXTENSION_SOURCE')){
    const archive=await r.store.readOriginalSourceArchive(jobId,descriptor.sha256),bytes=Buffer.from(await archive.blob.arrayBuffer());
    assert.equal(bytes.length,descriptor.byteSize,'BACKUP_EXTENSION_INVENTORY_SIZE_ORACLE');
    assert.equal(sha256(bytes),descriptor.sha256,'BACKUP_EXTENSION_INVENTORY_DIGEST_ORACLE');
    rows.push({descriptor:plain(descriptor),bytes});
  }
  return rows;
}

async function artifactSnapshot(store,jobId){
  const rows=[];
  for(const row of await store.listArtifacts(jobId)){const bytes=Buffer.from(await row.blob.arrayBuffer()),{blob,...metadata}=row;rows.push({...plain(metadata),actualSha256:sha256(bytes),actualByteSize:bytes.length});}
  return rows.sort((a,b)=>a.artifactId.localeCompare(b.artifactId));
}

async function durableSnapshot(r,jobId){
  const pending=await r.store.readPendingBackupImport(jobId),pendingBytes=pending?Buffer.from(await pending.blob.arrayBuffer()):null;
  const history=await r.store.historyList(jobId),sources=[];
  for(const descriptor of Object.values(history.sourceArchives||{})){
    const archive=await r.store.readOriginalSourceArchive(jobId,descriptor.sha256),bytes=Buffer.from(await archive.blob.arrayBuffer());
    sources.push({descriptor:plain(descriptor),bytesBase64:bytes.toString('base64')});
  }
  sources.sort((a,b)=>canonical(a.descriptor).localeCompare(canonical(b.descriptor)));
  return {project:plain(await r.store.readProject(jobId)),history:plain(history),artifacts:await artifactSnapshot(r.store,jobId),sources,pending:pending?plain(Object.fromEntries(Object.entries(pending).filter(([key])=>key!=='blob'))):null,pendingBytesBase64:pendingBytes?.toString('base64')||null};
}

async function completeMapStateFingerprint(r){
  async function value(item){
    if(item instanceof Blob){const bytes=Buffer.from(await item.arrayBuffer());return {blob:true,size:bytes.length,type:item.type,sha256:sha256(bytes)};}
    if(item===undefined)return {undefined:true};
    if(item===null||typeof item!=='object')return item;
    if(Array.isArray(item))return Promise.all(item.map(value));
    const result={};for(const key of Object.keys(item).sort())result[key]=await value(item[key]);return result;
  }
  const stores=[];
  for(const [name,rows]of r.rows){
    const entries=[];for(const [key,row]of rows)entries.push([await value(key),await value(row)]);
    entries.sort((a,b)=>canonical(a[0]).localeCompare(canonical(b[0])));stores.push([name,entries]);
  }
  stores.sort((a,b)=>a[0].localeCompare(b[0]));return sha256(Buffer.from(canonical(stores),'utf8'));
}

function assertExactRows(rows,expectations,label){
  assert.equal(rows.length,expectations.length,`BACKUP_EXTENSION_DESCRIPTOR_COUNT_ORACLE:${label}`);
  for(const expected of expectations){
    const bytes=Buffer.from(expected.text,'utf8'),matches=rows.filter(row=>row.descriptor.retentionRole===expected.role&&row.bytes.equals(bytes));
    assert.equal(matches.length,1,`BACKUP_EXTENSION_EXACT_MEMBER_ORACLE:${label}:${expected.role}:${exactSha256(expected.text)}`);
  }
}

function packageExtensionArtifactId(jobId,descriptor){
  const keys=['kind','schema','retentionRole','sha256','sourceSha256','containerPayloadSha256','bindingAnchorSha256','sourceLocation','parser','parsedPayloadSha256','disclosureClassification'];
  const preimage={jobId:String(jobId),...Object.fromEntries(keys.map(key=>[key,descriptor[key]]))};
  return 'PACKAGE-EXTENSION-SOURCE-'+sha256(Buffer.from(canonical(preimage),'utf8'));
}

function replaceDescriptor(recovery,oldKey,descriptor,identityJobId=recovery.jobId){
  const next=structuredClone(descriptor);next.artifactId=packageExtensionArtifactId(identityJobId,next);next.filename=next.artifactId+'.json-member.utf8';
  delete recovery.sourceArchives[oldKey];recovery.sourceArchives[sha256(Buffer.from(canonical(next),'utf8'))]=next;return next;
}

function recoveryMutationPackage(exported,mutate){
  const body=structuredClone(exported);delete body.packageSha256;mutate(body);
  return packageBlobFromBody(body);
}

function recoveryBytesArtifact(body,sha){return body.artifacts.find(row=>row.archiveKind==='RECOVERY_BYTES'&&row.sha256===sha);}
function copyRows(from,to){for(const [name,rows]of from.rows)to.rows.set(name,new Map([...rows].map(([key,value])=>[key,to.copy(value)])));}

async function expectStagedRejection(guard,jobId,blob,previousStagingId,caseId,match){
  const current=await guard.store.readProject(jobId),staged=await guard.store.stageBackupImport({jobId,blob,rawFilename:caseId+'.closed-loop.gz',mediaType:'application/gzip',expectedProjectRevision:current.revision,expectedStateSha256:current.projectSha256,expectedStagingId:previousStagingId});
  const before=await durableSnapshot(guard,jobId);
  await assert.rejects(guard.store.importPackage(blob,{pendingBackupImport:{jobId,stagingId:staged.stagingId}}),error=>match(error),`BACKUP_EXTENSION_REJECTION_ORACLE:${caseId}`);
  assert.deepEqual(await durableSnapshot(guard,jobId),before,`BACKUP_EXTENSION_REJECTION_ATOMICITY_ORACLE:${caseId}`);
  const pending=await guard.store.readPendingBackupImport(jobId);assert.equal(pending.stagingId,staged.stagingId,`BACKUP_EXTENSION_REJECTION_STAGING_ID_ORACLE:${caseId}`);assert.deepEqual(Buffer.from(await pending.blob.arrayBuffer()),Buffer.from(await blob.arrayBuffer()),`BACKUP_EXTENSION_REJECTION_STAGING_BYTES_ORACLE:${caseId}`);
  return staged.stagingId;
}

export async function verifyBackupExtensionBindingControls({sourceOverrides={}}={}){
  const projectStoreRuntime=(overrides={})=>runtimeWithSources({...sourceOverrides,...overrides});
  const cases=[],artifactId='SYNTHETIC-EXTENSION-BINDING-MEMBER',artifactBytes=Buffer.from('Known active bytes for package extension binding controls.','utf8');
  const origin=projectStoreRuntime(),project=await origin.store.createProject({commandId:'SYNTHETIC-PACKAGE-EXTENSION-BINDING'}),jobId=project.job.JOB_ID;
  await origin.store.putArtifact({artifactId,jobId,blob:new Blob([artifactBytes],{type:'application/octet-stream'}),filename:'binding-member.bin',mediaType:'application/octet-stream',lineage:{stage:1,role:'SOURCE_MATERIAL'}});
  const baselineBlob=await origin.store.exportPackage(jobId),baseline=JSON.parse(gunzipSync(Buffer.from(await baselineBlob.arrayBuffer())).toString('utf8'));

  const knownOnly=projectStoreRuntime();await knownOnly.store.importPackage(baselineBlob);assert.equal((await extensionInventory(knownOnly,jobId)).length,0,'BACKUP_EXTENSION_KNOWN_ONLY_NO_CARRIER_ORACLE');
  cases.push({caseId:'known-only-package-creates-no-extension-carrier',passed:true});

  const rootOnlyFixture=rootOnlyPackage(baseline),rootOnly=projectStoreRuntime();await rootOnly.store.importPackage(rootOnlyFixture.blob);const rootOnlyRows=await extensionInventory(rootOnly,jobId);
  const rootOnlyRoot=rootOnlyRows.find(row=>row.descriptor.retentionRole==='ROOT_EXTENSION'),rootOnlyAnchor=rootOnlyRows.find(row=>row.descriptor.retentionRole==='PACKAGE_BINDING_ANCHOR');
  assert(rootOnlyRoot&&rootOnlyAnchor,'BACKUP_EXTENSION_ROOT_ONLY_ROLES_ORACLE');assert.equal(rootOnlyRoot.descriptor.bindingAnchorSha256,rootOnlyAnchor.descriptor.sha256,'BACKUP_EXTENSION_ROOT_ONLY_ANCHOR_BINDING_ORACLE');assert.equal(rootOnlyAnchor.descriptor.bindingAnchorSha256,rootOnlyAnchor.descriptor.sha256,'BACKUP_EXTENSION_ROOT_ONLY_SELF_BINDING_ORACLE');
  const expectedRootOnlyAnchor='"packageManifest":'+canonical(baseline.packageManifest);assertExactRows(rootOnlyRows,[{role:'ROOT_EXTENSION',text:ROOT_ONLY_FRAGMENT},{role:'PACKAGE_BINDING_ANCHOR',text:expectedRootOnlyAnchor}],'root-only');
  cases.push({caseId:'root-only-extension-retains-one-exact-root-member-and-effective-manifest-anchor',passed:true,fragmentSha256:[exactSha256(ROOT_ONLY_FRAGMENT),exactSha256(expectedRootOnlyAnchor)]});

  const duplicateFixture=duplicatePackage(baseline),accepted=projectStoreRuntime(),acceptedProject=await accepted.store.importPackage(duplicateFixture.blob);assert.equal(acceptedProject.job.JOB_ID,jobId,'BACKUP_EXTENSION_DUPLICATE_ACCEPTANCE_ORACLE');
  const duplicateRows=await extensionInventory(accepted,jobId),finalAnchor='"packageManifest":'+canonical(baseline.packageManifest);
  assertExactRows(duplicateRows,[{role:'ROOT_EXTENSION',text:DUP_ROOT_FIRST},{role:'ROOT_EXTENSION',text:DUP_ROOT_SECOND},{role:'SUPERSEDED_EXTENSION',text:SUPERSEDED_FOREIGN},{role:'SUPERSEDED_EXTENSION',text:SUPERSEDED_INVALID},{role:'SUPERSEDED_EXTENSION',text:SUPERSEDED_NESTED_DUPLICATE},{role:'PACKAGE_BINDING_ANCHOR',text:finalAnchor}],'duplicates');
  const roots=duplicateRows.filter(row=>row.descriptor.retentionRole==='ROOT_EXTENSION').sort((a,b)=>a.descriptor.sourceLocation.rootMemberOccurrence-b.descriptor.sourceLocation.rootMemberOccurrence),superseded=duplicateRows.filter(row=>row.descriptor.retentionRole==='SUPERSEDED_EXTENSION').sort((a,b)=>a.descriptor.sourceLocation.rootMemberOccurrence-b.descriptor.sourceLocation.rootMemberOccurrence),anchor=duplicateRows.find(row=>row.descriptor.retentionRole==='PACKAGE_BINDING_ANCHOR');
  assert.deepEqual(roots.map(row=>[row.descriptor.sourceLocation.jsonPointer,row.descriptor.sourceLocation.rootMemberOccurrence,row.descriptor.sourceLocation.rootMemberOccurrenceCount]),[['/dupFuture',0,2],['/dupFuture',1,2]],'BACKUP_EXTENSION_DECODED_DUPLICATE_ORDINAL_ORACLE');
  assert.deepEqual(superseded.map(row=>[row.descriptor.sourceLocation.rootMemberOccurrence,row.descriptor.sourceLocation.rootMemberOccurrenceCount]),[[0,4],[1,4],[2,4]],'BACKUP_EXTENSION_SUPERSEDED_ORDINAL_ORACLE');assert.deepEqual([anchor.descriptor.sourceLocation.rootMemberOccurrence,anchor.descriptor.sourceLocation.rootMemberOccurrenceCount],[3,4],'BACKUP_EXTENSION_EFFECTIVE_ANCHOR_ORDINAL_ORACLE');
  assert(duplicateRows.every(row=>row.descriptor.bindingAnchorSha256===anchor.descriptor.sha256),'BACKUP_EXTENSION_SHARED_ANCHOR_ORACLE');
  const acceptedArtifact=Buffer.from(await (await accepted.store.getArtifact(artifactId)).blob.arrayBuffer());assert.deepEqual(acceptedArtifact,artifactBytes,'BACKUP_EXTENSION_DUPLICATE_KNOWN_BYTES_ORACLE');
  const operationalText=JSON.stringify({project:await accepted.store.readProject(jobId),context:accepted.engine.stageContext(acceptedProject,1)});for(const marker of ['FIRST_35_10','SECOND_35_10','FOREIGN_35_10','INVALID_KNOWN_35_10','NESTED_OVERWRITTEN_35_10'])assert(!operationalText.includes(marker),`BACKUP_EXTENSION_DUPLICATE_NONOPERATIONAL_ORACLE:${marker}`);
  cases.push({caseId:'decoded-duplicate-roots-and-invalid-or-foreign-superseded-manifests-are-accepted-and-retained-exactly',passed:true,descriptorCount:duplicateRows.length,fragmentSha256:[DUP_ROOT_FIRST,DUP_ROOT_SECOND,SUPERSEDED_FOREIGN,SUPERSEDED_INVALID,SUPERSEDED_NESTED_DUPLICATE,finalAnchor].map(exactSha256)});

  const recoveryBlob=await accepted.store.exportPackage(jobId),recoveryExport=JSON.parse(gunzipSync(Buffer.from(await recoveryBlob.arrayBuffer())).toString('utf8')),extensionEntries=Object.entries(recoveryExport.recovery.sourceArchives).filter(([,row])=>row.kind==='ORIGINAL_PACKAGE_EXTENSION_SOURCE'),rootEntries=extensionEntries.filter(([,row])=>row.retentionRole==='ROOT_EXTENSION');
  assert.equal(extensionEntries.length,6,'BACKUP_EXTENSION_RECOVERY_DESCRIPTOR_PRECONDITION_ORACLE');assert.equal(rootEntries.length,2,'BACKUP_EXTENSION_RECOVERY_ROOT_PRECONDITION_ORACLE');
  const invalidPackages=[];
  invalidPackages.push({caseId:'missing-retained-extension-bytes',fixture:recoveryMutationPackage(recoveryExport,body=>{const target=rootEntries[0][1],artifact=recoveryBytesArtifact(body,target.sha256);assert(artifact,'BACKUP_EXTENSION_MISSING_BYTES_FIXTURE_ORACLE');body.artifacts=body.artifacts.filter(row=>row!==artifact);body.packageManifest.artifacts=body.packageManifest.artifacts.filter(row=>row.artifactId!==artifact.artifactId);body.packageManifest.artifactCount=body.packageManifest.artifacts.length;}),match:error=>error.code==='SOURCE_ARCHIVE_INTEGRITY_FAILED'||error.code==='HISTORY_FILE_INTEGRITY_FAILED'});
  invalidPackages.push({caseId:'corrupt-retained-extension-bytes',fixture:recoveryMutationPackage(recoveryExport,body=>{const target=rootEntries[0][1],artifact=recoveryBytesArtifact(body,target.sha256);assert(artifact,'BACKUP_EXTENSION_CORRUPT_BYTES_FIXTURE_ORACLE');const bytes=Buffer.from(artifact.base64,'base64');bytes[Math.floor(bytes.length/2)]^=1;artifact.base64=bytes.toString('base64');}),match:error=>error.message===`Artifact RECOVERY-BYTES-${rootEntries[0][1].sha256} hash mismatch.`});
  invalidPackages.push({caseId:'wrong-job-descriptor-binding',fixture:recoveryMutationPackage(recoveryExport,body=>{const [key,row]=Object.entries(body.recovery.sourceArchives).find(([,source])=>source.kind==='ORIGINAL_PACKAGE_EXTENSION_SOURCE'&&source.retentionRole==='ROOT_EXTENSION');replaceDescriptor(body.recovery,key,row,'FOREIGN-JOB');}),match:error=>error.code==='SOURCE_ARCHIVE_INTEGRITY_FAILED'});
  invalidPackages.push({caseId:'wrong-anchor-cross-binding',fixture:recoveryMutationPackage(recoveryExport,body=>{const [key,row]=Object.entries(body.recovery.sourceArchives).find(([,source])=>source.kind==='ORIGINAL_PACKAGE_EXTENSION_SOURCE'&&source.retentionRole==='ROOT_EXTENSION');row.bindingAnchorSha256='f'.repeat(64);replaceDescriptor(body.recovery,key,row);}),match:error=>error.code==='SOURCE_ARCHIVE_INTEGRITY_FAILED'});
  invalidPackages.push({caseId:'duplicate-occurrence-binding',fixture:recoveryMutationPackage(recoveryExport,body=>{const entries=Object.entries(body.recovery.sourceArchives).filter(([,source])=>source.kind==='ORIGINAL_PACKAGE_EXTENSION_SOURCE'&&source.retentionRole==='ROOT_EXTENSION').sort((a,b)=>a[1].sourceLocation.rootMemberOccurrence-b[1].sourceLocation.rootMemberOccurrence);const [key,row]=entries[1];row.sourceLocation.rootMemberOccurrence=entries[0][1].sourceLocation.rootMemberOccurrence;replaceDescriptor(body.recovery,key,row);}),match:error=>error.code==='SOURCE_ARCHIVE_INTEGRITY_FAILED'});
  invalidPackages.push({caseId:'known-only-anchor-without-extension',fixture:recoveryMutationPackage(recoveryExport,body=>{for(const [key,row]of Object.entries(body.recovery.sourceArchives))if(row.kind==='ORIGINAL_PACKAGE_EXTENSION_SOURCE'&&row.retentionRole!=='PACKAGE_BINDING_ANCHOR')delete body.recovery.sourceArchives[key];}),match:error=>error.code==='SOURCE_ARCHIVE_INTEGRITY_FAILED'});
  invalidPackages.push({caseId:'nonsecret-bytes-overclassified-as-credential-secret',fixture:recoveryMutationPackage(recoveryExport,body=>{const [key,row]=Object.entries(body.recovery.sourceArchives).find(([,source])=>source.kind==='ORIGINAL_PACKAGE_EXTENSION_SOURCE'&&source.retentionRole==='ROOT_EXTENSION');row.disclosureClassification='CREDENTIAL_SECRET';replaceDescriptor(body.recovery,key,row);}),match:error=>error.code==='SOURCE_ARCHIVE_INTEGRITY_FAILED'});

  let stagingId=null;
  for(const negative of invalidPackages){stagingId=await expectStagedRejection(origin,jobId,negative.fixture.blob,stagingId,negative.caseId,negative.match);cases.push({caseId:negative.caseId,passed:true,failMechanism:'rehashed enclosing package rejected before commit; prior project, History, artifacts, source bytes, staging identity, and exact staged Blob remain unchanged',packageSha256:negative.fixture.packageSha256});}

  const workflowSchemaSource=sourceOverrides['workflow-schema.js']??fs.readFileSync(new URL('./workflow-schema.js',import.meta.url),'utf8');
  const mutatingValidatorSource=workflowSchemaSource+`\n;(()=>{const prior=globalThis.closedLoopWorkflowSchema,validate=prior.validatePackageExtensionSourceDescriptor;globalThis.closedLoopWorkflowSchema=Object.freeze({...prior,validatePackageExtensionSourceDescriptor(value){const result=validate(value);if(result.valid)value.operational=true;return result;}});})();\n`;
  const mutatingGuard=projectStoreRuntime({'workflow-schema.js':mutatingValidatorSource});copyRows(origin,mutatingGuard);
  const inheritedStagingId=(await mutatingGuard.store.pendingBackupImportIdentity(jobId))?.stagingId||null;
  await expectStagedRejection(mutatingGuard,jobId,recoveryBlob,inheritedStagingId,'replaceable-validator-owned-descriptor-mutation',error=>error.code==='SOURCE_ARCHIVE_INTEGRITY_FAILED');
  cases.push({caseId:'replaceable-validator-cannot-mutate-owned-descriptor-after-map-key-verification',passed:true,failMechanism:'instrumented schema validator changes operational false to true after returning valid; import rejects before commit and preserves exact staged input and all prior durable state'});

  const projectStoreSource=sourceOverrides['project-store.js']??fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8'),capacityAnchor='maxRetainedFileBytes:1024*1024*1024';
  assert.equal(projectStoreSource.split(capacityAnchor).length-1,1,'BACKUP_EXTENSION_CAPACITY_CONFIGURATION_ANCHOR_ORACLE');
  const capacityReference=projectStoreRuntime();await capacityReference.store.importPackage(baselineBlob);
  const baselineHistory=await capacityReference.store.historyList(jobId),retainedFileByteLimit=baselineHistory.retainedFileBytes;
  assert(Number.isSafeInteger(retainedFileByteLimit)&&retainedFileByteLimit>0,'BACKUP_EXTENSION_CAPACITY_POSITIVE_LIMIT_PRECONDITION_ORACLE');
  const limitedProjectStoreSource=projectStoreSource.replace(capacityAnchor,'maxRetainedFileBytes:'+retainedFileByteLimit);
  const faultControl=projectStoreRuntime({'project-store.js':limitedProjectStoreSource}),faultControlBefore=await completeMapStateFingerprint(faultControl);
  faultControl.runtime.__closedLoopStorageFault='before-import-transaction';
  try{await assert.rejects(faultControl.store.importPackage(baselineBlob),error=>error.code==='INJECTED_STORAGE_FAILURE','BACKUP_EXTENSION_CAPACITY_LIVE_FAULT_CONTROL_ORACLE');}finally{delete faultControl.runtime.__closedLoopStorageFault;}
  assert.equal(await completeMapStateFingerprint(faultControl),faultControlBefore,'BACKUP_EXTENSION_CAPACITY_LIVE_FAULT_ATOMICITY_ORACLE');

  const capacityGuard=projectStoreRuntime({'project-store.js':limitedProjectStoreSource}),capacityImported=await capacityGuard.store.importPackage(baselineBlob),capacityHistory=await capacityGuard.store.historyList(jobId);
  const originalSources=Object.entries(capacityHistory.sourceArchives||{}).filter(([,row])=>row.kind==='ORIGINAL_PROJECT_SOURCE');
  assert(originalSources.length>0,'BACKUP_EXTENSION_CAPACITY_ORIGINAL_DESCRIPTOR_CONTROL_ORACLE');
  assert(Object.keys(capacityHistory.sourceArchiveReferences||{}).length>0,'BACKUP_EXTENSION_CAPACITY_REFERENCE_CONTROL_ORACLE');
  assert.equal(Object.values(capacityHistory.sourceArchives||{}).some(row=>row.kind==='ORIGINAL_PACKAGE_EXTENSION_SOURCE'),false,'BACKUP_EXTENSION_CAPACITY_BASELINE_NO_EXTENSION_ORACLE');
  assert.equal(capacityHistory.retainedFileBytes,retainedFileByteLimit,'BACKUP_EXTENSION_CAPACITY_EXACT_LIMIT_CONTROL_ORACLE');
  const capacityExtension=rootOnlyPackage(baseline),capacityStaged=await capacityGuard.store.stageBackupImport({jobId,blob:capacityExtension.blob,rawFilename:'capacity-extension.closed-loop.gz',mediaType:'application/gzip',expectedProjectRevision:capacityImported.revision,expectedStateSha256:capacityImported.projectSha256});
  const capacityCompleteBefore=await completeMapStateFingerprint(capacityGuard),capacityDurableBefore=await durableSnapshot(capacityGuard,jobId),capacityPendingBefore=await capacityGuard.store.readPendingBackupImport(jobId),capacityPendingBytesBefore=Buffer.from(await capacityPendingBefore.blob.arrayBuffer());
  capacityGuard.runtime.__closedLoopStorageFault='before-import-transaction';
  try{await assert.rejects(capacityGuard.store.importPackage(capacityExtension.blob,{pendingBackupImport:{jobId,stagingId:capacityStaged.stagingId}}),error=>error.code==='HISTORY_LIMIT_REACHED','BACKUP_EXTENSION_CAPACITY_BEFORE_DESIGNATED_WRITE_TRANSACTION_ORACLE');}finally{delete capacityGuard.runtime.__closedLoopStorageFault;}
  assert.equal(await completeMapStateFingerprint(capacityGuard),capacityCompleteBefore,'BACKUP_EXTENSION_CAPACITY_COMPLETE_STATE_ORACLE');
  assert.deepEqual(await durableSnapshot(capacityGuard,jobId),capacityDurableBefore,'BACKUP_EXTENSION_CAPACITY_DURABLE_STATE_ORACLE');
  const capacityPendingAfter=await capacityGuard.store.readPendingBackupImport(jobId);assert.equal(capacityPendingAfter.stagingId,capacityStaged.stagingId,'BACKUP_EXTENSION_CAPACITY_STAGING_ID_ORACLE');assert.deepEqual(Buffer.from(await capacityPendingAfter.blob.arrayBuffer()),capacityPendingBytesBefore,'BACKUP_EXTENSION_CAPACITY_STAGING_BYTES_ORACLE');
  const capacityHistoryAfter=await capacityGuard.store.historyList(jobId);for(const [key,row]of originalSources)assert.deepEqual(plain(capacityHistoryAfter.sourceArchives[key]),plain(row),'BACKUP_EXTENSION_CAPACITY_ORIGINAL_DESCRIPTOR_UNCHANGED_ORACLE');
  cases.push({caseId:'extension-capacity-rejects-before-designated-import-write-transaction',passed:true,faultControlLive:true,capacityWonBeforeDesignatedWriteTransaction:true,completeStatePreserved:true,pendingStagingPreserved:true,retainedFileByteLimit,sourceArchiveReferenceCount:Object.keys(capacityHistory.sourceArchiveReferences||{}).length,originalSourceDescriptorCount:originalSources.length});

  return {schema:'backup-extension-binding-controls/1',result:'PASS',synthetic:true,actualBrowser:false,normativeRequirementId:'NREQ-1096a56af1ea51fc0081ded2d594896f',sourceLine:3182,sourceLineSha256:'f26b6320858ddb23e5e792e64b9e34eb1be607e6bc4197cfe9ee2659c73a1697',boundary:'Production project-store import, History source archive, export and staged rejection owners through the existing project-runtime Map transaction adapter. The capacity case changes only project-store maxRetainedFileBytes to the exact retained bytes observed after a successful reference import, then exercises the resulting production import logic. No native IndexedDB, browser, prompt, executable, or whole-clause claim.',sourceOverridesApplied:Object.keys(sourceOverrides).sort(),cases};
}


