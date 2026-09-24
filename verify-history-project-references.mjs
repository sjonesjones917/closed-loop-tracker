import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const mode=process.argv.find(x=>x.startsWith('--fault='))?.slice(8),source=fs.readFileSync('project-store.js','utf8');
const faults={
 'repeat-import-root-digest':{id:'REPEAT_IMPORT_ROOT_DIGEST',file:'project-store.js',before:'({projectSha256:verifiedProjectSha256,workSha256:verifiedWorkSha256}=historyProjectDigests(project));',after:'verifiedProjectSha256=projectSha256(project);verifiedWorkSha256=historyWorkSha256(project);'},
 'repeat-import-byte-hash':{id:'REPEAT_IMPORT_BYTE_HASH',file:'project-store.js',before:'if(!verifiedByteDigests)return hash.sha256Bytes(blob);',after:'if(true)return hash.sha256Bytes(blob);'},
 'trust-import-declared-byte-hash':{id:'TRUST_IMPORT_DECLARED_BYTE_HASH',file:'project-store.js',before:'const digest=await historyBlobSha256(artifactBlob,verifiedByteDigests);',after:'const digest=a.sha256;verifiedByteDigests.set(artifactBlob,Promise.resolve(digest));'},
 'retain-import-project-roots':{id:'RETAIN_IMPORT_PROJECT_ROOTS',file:'project-store.js',before:'delete priorRoot.project;',after:'void priorRoot.project;'},
 'repeat-import-project-root':{id:'REPEAT_IMPORT_PROJECT_ROOT',file:'project-store.js',before:'if(!body.projectReference&&validatedRoots.has(entry.id))',after:'if(false)'},
 'skip-selected-version-binding':{id:'SKIP_SELECTED_VERSION_BINDING',file:'project-store.js',before:"if(entry.id!==id||hash.sha256Value(descriptor)!==hash.sha256Value(expected))",after:'if(false)'},
 'skip-project-body-byte-check':{id:'SKIP_PROJECT_BODY_BYTE_CHECK',file:'project-store.js',before:"if(!entry?.blob||entry.blob.size!==Number(entry.byteSize)||await historyBlobSha256(entry.blob,verifiedByteDigests)!==entry.sha256)",after:"if(!entry?.blob||entry.blob.size!==Number(entry.byteSize))"}
};
if(mode&&!faults[mode])throw new Error('Unknown disposable implementation fault: '+mode);
const cases=[],emit=(caseId,details={})=>cases.push({caseId,result:'PASS',...details});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const validationAnchor='({projectSha256:verifiedProjectSha256,workSha256:verifiedWorkSha256}=historyProjectDigests(project));';
const make=()=>{
 assert.equal(source.split(validationAnchor).length-1,1);
 const observed=source.replace(validationAnchor,"globalThis.__verifiedHistoryRoots?.push({checkpointId:entry.id,snapshotSha256:entry.sha256});globalThis.__historyDigestWatch={data:project.projectData,visits:0};"+validationAnchor+"globalThis.__historyDigestReads?.push({checkpointId:entry.id,visits:globalThis.__historyDigestWatch.visits});delete globalThis.__historyDigestWatch;");
 const residencyAnchor='checkpointId=>archiveSnapshots.get(checkpointId),validatedRoots,verifiedParts,verifiedByteDigests);if(entry.id===incoming.activeId)';
 assert.equal(observed.split(residencyAnchor).length-1,1);
 const measured=observed.replace(residencyAnchor,'checkpointId=>archiveSnapshots.get(checkpointId),validatedRoots,verifiedParts,verifiedByteDigests);globalThis.__historyRootResidency?.push([...validatedRoots.values()].filter(root=>root?.project).length);if(entry.id===incoming.activeId)');
 const inputAnchor='fileContents.delete(a);';
 assert.equal(measured.split(inputAnchor).length-1,1);
 const withBytes=measured.replace(inputAnchor,inputAnchor+'globalThis.__archiveImportByteObjects?.push(artifactBlob);');
 const hashSource=fs.readFileSync('hash.js','utf8'),hashAnchor='async function sha256Bytes(bytes){';
 assert.equal(hashSource.split(hashAnchor).length-1,1);
 const traversalAnchor='const frame=stack.at(-1),input=frame.value,path=frame.path;';assert.equal(hashSource.split(traversalAnchor).length-1,1);
 const observedHash=hashSource.replace(hashAnchor,hashAnchor+'globalThis.__historyBlobHashes?.push(bytes);').replace(traversalAnchor,traversalAnchor+"if(frame.kind==='value'&&input===globalThis.__historyDigestWatch?.data)globalThis.__historyDigestWatch.visits++;");
 return projectStoreRuntime({fault:faults[mode],sourceOverrides:{'project-store.js':withBytes.replace('function historyProjectDigests(project){','globalThis.__historyProjectDigests=historyProjectDigests;function historyProjectDigests(project){'),'hash.js':observedHash}});
};
async function fixture(r,name){
 let p=r.core.createBlankState(name);r.engine.ensureShape(p);r.engine.recalculate(p);p=await r.store.writeProject(p,{expectedProjectRevision:0});
 const root=(await r.store.historyList(p.job.JOB_ID)).activeId;
 const views=[{activeView:'Project',activeStage:1,scrollY:3,drafts:{'#job-objective':{value:'First retained draft'}}},{activeView:'Workflow',activeStage:1,scrollY:9,drafts:{'#job-objective':{value:'Second retained draft'}}}].map(r.copy);
 const children=[];for(const view of views)children.push(await r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,view}));
 for(let i=0;i<children.length;i++)assert.deepEqual(await r.store.readHistoryView(p.job.JOB_ID,children[i]),views[i]);
 return {r,p,root,children,views,key:id=>'recovery:'+p.job.JOB_ID+':snapshot:'+id,stateKey:'recovery:'+p.job.JOB_ID};
}
async function bodyOf(entry){return JSON.parse(gunzipSync(Buffer.from(await entry.blob.arrayBuffer())).toString('utf8'));}
function snapshotBody(r,original,body){
 delete body.packageSha256;
 const payload={...body,packageSha256:r.runtime.closedLoopHash.sha256Value(r.copy(body))};
 const bytes=gzipSync(Buffer.from(JSON.stringify(payload))),blob=new Blob([bytes],{type:'application/gzip'});
 return {...r.copy(original),blob,byteSize:blob.size,sha256:sha(bytes),...(body.projectReference?{projectReference:r.copy(body.projectReference)}:{})};
}
function installSnapshot(f,id,value){
 const meta=f.r.rows.get('meta'),row=f.r.copy(meta.get(f.key(id))),stateRow=f.r.copy(meta.get(f.stateKey));
 row.value=value;meta.set(f.key(id),row);const {blob,...descriptor}=value;
 stateRow.value.entries=stateRow.value.entries.map(x=>x.id===id?descriptor:x);
 stateRow.value.compressedProjectBytes=stateRow.value.entries.reduce((n,x)=>n+x.byteSize,0);meta.set(f.stateKey,stateRow);
}
function frozenRows(r){return new Map([...r.rows].map(([name,rows])=>[name,new Map([...rows].map(([key,row])=>[key,r.copy(row)]))]));}
const f=await fixture(make(),'HISTORY-PROJECT-REFERENCES'),{r,p}=f,meta=r.rows.get('meta');
emit('HISTORY-REFERENCE-VALID-PROGRESSION',{savedViews:f.children.length});
// Independent preimages retain the exact original exclusions, Unicode key
// ordering and invalid-value rejection. Large strings straddle encoder blocks.
const metadataKeys=['projectSha256','projectHash','revision','historyActivationId','restoredCandidates','activeView','activeStage'];
const digestVectors=[{}, {'10':'ten','2':'two','\uE000':17,'\u{10000}':'é🙂'},
 {a:'x'.repeat(16383)+'🙂é',projectData:{b:['\\\"\n'.repeat(10000),true,null,0]},z:'tail'},
 ...metadataKeys.map((key,i)=>({projectData:{a:'kept'},[key]:{a:'metadata-'+i}}))];
for(const input of digestVectors){
 const value=r.copy(input),canonical=r.copy(value),work=r.copy(value);delete canonical.projectSha256;for(const key of metadataKeys)delete work[key];
 const expectedProject=sha(Buffer.from(r.runtime.closedLoopHash.stableStringify(canonical))),expectedWork=sha(Buffer.from(r.runtime.closedLoopHash.stableStringify(work)));
 const before=r.runtime.closedLoopHash.sha256Value(value),actual=r.runtime.__historyProjectDigests(value);
 assert.equal(actual.projectSha256,expectedProject,'HISTORY_ROOT_PROJECT_PREIMAGE_ORACLE: shared traversal changed the canonical project preimage');
 assert.equal(actual.workSha256,expectedWork,'HISTORY_ROOT_WORK_PREIMAGE_ORACLE: shared traversal changed the work preimage');
 assert.equal(r.runtime.closedLoopHash.sha256Value(value),before);
}
const invalidRoots=[r.copy({a:'valid'.repeat(5000)+'\uD800'}),r.copy({a:[1,-0]}),r.copy({a:[1,1.25]}),r.copy({a:undefined})];
const cyclic=r.copy({a:{}});cyclic.a.self=cyclic;invalidRoots.push(cyclic);
for(const value of invalidRoots)assert.throws(()=>r.runtime.__historyProjectDigests(value),error=>error.name==='TypeError','An invalid canonical tail or cycle must not produce either recovery digest.');
emit('HISTORY-ROOT-DIGEST-PREIMAGES',{vectors:digestVectors.length,invalidRootsRejected:invalidRoots.length,nodeCryptoIndependent:true,inputUnchanged:true});


// Otherwise valid compressed JSON, project, view, manifest and package hashes;
// only the root's promised compressed-byte identity is deliberately violated.
const rootRow=r.copy(meta.get(f.key(f.root))),alteredRow=r.copy(rootRow),originalRootBytes=Buffer.from(await rootRow.value.blob.arrayBuffer()),alteredRootBytes=Buffer.from(originalRootBytes);
alteredRootBytes[4]^=1;assert.deepEqual(gunzipSync(alteredRootBytes),gunzipSync(originalRootBytes),'The gzip header variation must retain exactly the same decoded bytes.');
alteredRow.value.blob=new Blob([alteredRootBytes],{type:'application/gzip'});
meta.set(f.key(f.root),alteredRow);
await assert.rejects(()=>r.store.readHistoryView(p.job.JOB_ID,f.children[1]),e=>e.code==='HISTORY_SNAPSHOT_INTEGRITY_FAILED','HISTORY_REFERENCE_BYTE_ORACLE: changed well-formed project-body bytes must be rejected for their exact-byte mismatch');
const beforeFailedSave=frozenRows(r);
await assert.rejects(()=>r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,view:r.copy({activeView:'Project',activeStage:1,scrollY:17})}),e=>e.code==='HISTORY_SNAPSHOT_INTEGRITY_FAILED');
assert.deepEqual(frozenRows(r),beforeFailedSave,'A corrupt reference dependency cannot partially commit a new checkpoint.');
meta.set(f.key(f.root),rootRow);assert.deepEqual(await r.store.readHistoryView(p.job.JOB_ID,f.children[1]),f.views[1]);
emit('HISTORY-REFERENCE-EXACT-BYTES',{rejectionCode:'HISTORY_SNAPSHOT_INTEGRITY_FAILED',canonicalAndHistoryMutationOnFailedSave:false,correctedCase:'PASS'});

// Each parameter is changed alone while package bytes and descriptor copies
// are regenerated consistently. No unrelated broken JSON/hash is substituted.
for(const [name,change,expectedCode='HISTORY_VERSION_MISMATCH'] of [
 ['UNSUPPORTED_REFERENCE_VERSION',ref=>{ref.schema='closed-loop-recovery-project-reference/999';}],
 ['MISSING_RETAINED_ROOT',ref=>{ref.checkpointId='NO-SUCH-RETAINED-ROOT';}],
 ['SELF_REFERENCE',ref=>{ref.checkpointId=f.children[0];}],
 ['NONINLINE_REFERENCE_TARGET',ref=>{ref.checkpointId=f.children[1];ref.snapshotSha256=meta.get(f.key(f.children[1])).value.sha256;}],
 ['WRONG_ROOT_BYTE_IDENTITY',ref=>{ref.snapshotSha256='0'.repeat(64);}]
]){
 const originalRow=r.copy(meta.get(f.key(f.children[0]))),originalState=r.copy(meta.get(f.stateKey)),body=await bodyOf(originalRow.value);
 change(body.projectReference);installSnapshot(f,f.children[0],snapshotBody(r,originalRow.value,body));
 const before=frozenRows(r);
 await assert.rejects(()=>r.store.restoreCheckpoint(p.job.JOB_ID,f.children[0],{expectedProjectRevision:p.revision}),e=>e.code===expectedCode,name+' must not activate an incompatible version.');
 assert.deepEqual(frozenRows(r),before);meta.set(f.key(f.children[0]),originalRow);meta.set(f.stateKey,originalState);
 assert.deepEqual(await r.store.readHistoryView(p.job.JOB_ID,f.children[0]),f.views[0]);
 emit('HISTORY-REFERENCE-'+name,{rejectionCode:expectedCode,correctedCase:'PASS',failedActivationPreservesEveryStoredRow:true});
}
// A missing root's bytes (as distinct from an unknown manifest identifier)
// cannot be reconstructed by borrowing the current project or another job.
meta.delete(f.key(f.root));const missingState=frozenRows(r);
await assert.rejects(()=>r.store.restoreCheckpoint(p.job.JOB_ID,f.children[0],{expectedProjectRevision:p.revision}),e=>e.code==='HISTORY_PROJECT_REFERENCE_UNAVAILABLE');assert.deepEqual(frozenRows(r),missingState);
meta.set(f.key(f.root),rootRow);assert.deepEqual(await r.store.readHistoryView(p.job.JOB_ID,f.children[0]),f.views[0]);
emit('HISTORY-REFERENCE-MISSING-ROOT-BYTES',{rejectionCode:'HISTORY_PROJECT_REFERENCE_UNAVAILABLE',correctedCase:'PASS'});

// A valid saved body placed under the selected version's storage key is not
// the version selected by the operator. Refuse rather than activate its view.
const selectedRow=r.copy(meta.get(f.key(f.children[0]))),otherRow=r.copy(meta.get(f.key(f.children[1])));
const wrongSelectedRow=r.copy(selectedRow);wrongSelectedRow.value=otherRow.value;
meta.set(f.key(f.children[0]),wrongSelectedRow);const beforeSubstitution=frozenRows(r);
await assert.rejects(()=>r.store.restoreCheckpoint(p.job.JOB_ID,f.children[0],{expectedProjectRevision:p.revision}),e=>e.code==='HISTORY_VERSION_MISMATCH','HISTORY_SELECTED_VERSION_ORACLE: substituted valid snapshot must not activate as the selected version');
assert.deepEqual(frozenRows(r),beforeSubstitution);meta.set(f.key(f.children[0]),selectedRow);assert.deepEqual(await r.store.readHistoryView(p.job.JOB_ID,f.children[0]),f.views[0]);
emit('HISTORY-REFERENCE-SELECTED-VERSION-BINDING',{rejectionCode:'HISTORY_VERSION_MISMATCH',correctedCase:'PASS'});

// A complete valid inline project body outside the retained manifest cannot
// silently become a dependency of a promised version (and evade its backup).
const orphanId='UNLISTED-BUT-WELL-FORMED-ROOT',orphanBody=await bodyOf(rootRow.value);orphanBody.id=orphanId;
const orphan=snapshotBody(r,{...rootRow.value,id:orphanId},orphanBody);meta.set(f.key(orphanId),{key:f.key(orphanId),value:orphan});
const priorChild=r.copy(meta.get(f.key(f.children[0]))),priorManifest=r.copy(meta.get(f.stateKey)),orphanChildBody=await bodyOf(priorChild.value);
orphanChildBody.projectReference={...orphanChildBody.projectReference,checkpointId:orphanId,snapshotSha256:orphan.sha256};installSnapshot(f,f.children[0],snapshotBody(r,priorChild.value,orphanChildBody));
const beforeOrphan=frozenRows(r);
await assert.rejects(()=>r.store.restoreCheckpoint(p.job.JOB_ID,f.children[0],{expectedProjectRevision:p.revision}),e=>e.code==='HISTORY_VERSION_MISMATCH','HISTORY_MANIFEST_CLOSURE_ORACLE: a valid unlisted body cannot satisfy a retained dependency');
assert.deepEqual(frozenRows(r),beforeOrphan);meta.set(f.key(f.children[0]),priorChild);meta.set(f.stateKey,priorManifest);meta.delete(f.key(orphanId));assert.deepEqual(await r.store.readHistoryView(p.job.JOB_ID,f.children[0]),f.views[0]);
emit('HISTORY-REFERENCE-MANIFEST-CLOSURE',{rejectionCode:'HISTORY_VERSION_MISMATCH',correctedCase:'PASS'});

// Exported byte closure must work in a fresh store with no local roots. A
// complete backup round-trip also must not depend on snapshot archive order.
const exported=await r.store.exportPackage(p.job.JOB_ID),archive=JSON.parse(gunzipSync(Buffer.from(await exported.arrayBuffer())).toString('utf8'));
assert.ok(Array.isArray(archive.artifacts));archive.artifacts.reverse();delete archive.packageSha256;
const reordered={...archive,packageSha256:r.runtime.closedLoopHash.sha256Value(r.copy(archive))};
const reorderedBlob=new Blob([gzipSync(Buffer.from(JSON.stringify(reordered)))],{type:'application/gzip'});
const fresh=make();fresh.runtime.__verifiedHistoryRoots=[];fresh.runtime.__historyBlobHashes=[];fresh.runtime.__archiveImportByteObjects=[];
const imported=await fresh.store.importPackage(reorderedBlob);
const importByteObjects=Array.from(fresh.runtime.__archiveImportByteObjects),importHashCalls=Array.from(fresh.runtime.__historyBlobHashes),perObjectHashes=importByteObjects.map(blob=>importHashCalls.filter(value=>value===blob).length);
assert.ok(importByteObjects.length>0);
console.error(JSON.stringify({caseId:'HISTORY-IMPORT-VERIFIED-BYTE-COST',archiveObjects:importByteObjects.length,actualHashCalls:perObjectHashes.reduce((a,b)=>a+b,0),maxHashesPerObject:Math.max(...perObjectHashes)}));
delete fresh.runtime.__historyBlobHashes;delete fresh.runtime.__archiveImportByteObjects;
// Alter only a snapshot gzip header: its decoded project remains identical,
// but its promised exact bytes do not. Re-sign the enclosing package so the
// initial member-byte verification, not the outer envelope, must reject it.
const corruptArchive=JSON.parse(JSON.stringify(archive));
const corruptSnapshot=corruptArchive.artifacts.find(file=>file.archiveKind==='RECOVERY_SNAPSHOT');
assert.ok(corruptSnapshot);
const goodSnapshotBytes=Buffer.from(corruptSnapshot.base64,'base64'),badSnapshotBytes=Buffer.from(goodSnapshotBytes);badSnapshotBytes[4]^=1;
assert.deepEqual(gunzipSync(badSnapshotBytes),gunzipSync(goodSnapshotBytes));
corruptSnapshot.base64=badSnapshotBytes.toString('base64');delete corruptArchive.packageSha256;
const corruptImportBlob=new Blob([gzipSync(Buffer.from(JSON.stringify({...corruptArchive,packageSha256:r.runtime.closedLoopHash.sha256Value(r.copy(corruptArchive))})))],{type:'application/gzip'});
const rowsBeforeCorrupt=frozenRows(fresh);
await assert.rejects(()=>fresh.store.importPackage(corruptImportBlob),error=>String(error.message).includes('hash mismatch'),'HISTORY_IMPORT_BYTE_INTEGRITY_ORACLE: previously imported identities cannot authorize changed archive bytes');
assert.deepEqual(frozenRows(fresh),rowsBeforeCorrupt,'A member-byte failure must leave every project, artifact and recovery row unchanged.');
assert.ok(perObjectHashes.every(count=>count===1),'HISTORY_IMPORT_BYTE_REUSE_ORACLE: hash each immutable archive Blob once per import, while still checking every checkpoint and descriptor');
emit('HISTORY-IMPORT-VERIFIED-BYTE-COST',{archiveObjects:importByteObjects.length,actualHashCalls:perObjectHashes.reduce((a,b)=>a+b,0),maxHashesPerObject:Math.max(...perObjectHashes)});
const correctedReader=make();
await assert.rejects(()=>correctedReader.store.importPackage(corruptImportBlob),error=>String(error.message).includes('hash mismatch'));
correctedReader.runtime.__historyBlobHashes=[];correctedReader.runtime.__archiveImportByteObjects=[];
await correctedReader.store.importPackage(reorderedBlob);
const retryObjects=Array.from(correctedReader.runtime.__archiveImportByteObjects),retryHashes=Array.from(correctedReader.runtime.__historyBlobHashes);
assert.ok(retryObjects.length===importByteObjects.length&&retryObjects.every(blob=>retryHashes.filter(value=>value===blob).length===1),'HISTORY_IMPORT_BYTE_RETRY_ORACLE: failed import cannot supply verification receipts to a corrected retry');
emit('HISTORY-IMPORT-BYTE-INTEGRITY-AND-RETRY',{gzipPayloadUnchanged:true,changedArchiveBytesRejected:true,failedImportPreservesAllRows:true,correctedRetry:'PASS',freshByteHashes:retryObjects.length});
const rootObservations=Array.from(fresh.runtime.__verifiedHistoryRoots),distinctRoots=new Set(rootObservations.map(root=>root.snapshotSha256));
console.error(JSON.stringify({caseId:'HISTORY-IMPORT-ROOT-VALIDATION-COST',validations:rootObservations.length,distinctRoots:distinctRoots.size,checkpointCount:archive.recovery.entries.length}));
assert.equal(rootObservations.length,distinctRoots.size,'HISTORY_IMPORT_ROOT_REUSE_ORACLE: shared complete project roots must be validated once per immutable import, not again for each view');
assert.equal(distinctRoots.size,archive.recovery.entries.filter(entry=>!entry.projectReference).length);
delete fresh.runtime.__verifiedHistoryRoots;
emit('HISTORY-IMPORT-ROOT-VALIDATION-COST',{validations:rootObservations.length,distinctRoots:distinctRoots.size});
assert.deepEqual(r.copy(imported.projectData),p.projectData);
for(let i=0;i<f.children.length;i++)assert.deepEqual(r.copy(await fresh.store.readHistoryView(p.job.JOB_ID,f.children[i])),f.views[i]);
emit('HISTORY-REFERENCE-REORDERED-BACKUP-CLOSURE',{exportedBytes:exported.size,exportedSha256:sha(Buffer.from(await exported.arrayBuffer())),importedBytes:reorderedBlob.size,importedSha256:sha(Buffer.from(await reorderedBlob.arrayBuffer())),freshStore:true});
// Dependencies may be encountered before their full roots. Reordering the
// complete manifest must preserve every version and must not revalidate roots.
archive.recovery.entries.reverse();delete archive.packageSha256;
const forwardBody={...archive,packageSha256:r.runtime.closedLoopHash.sha256Value(r.copy(archive))};
const forwardBlob=new Blob([gzipSync(Buffer.from(JSON.stringify(forwardBody)))],{type:'application/gzip'}),forward=make();forward.runtime.__verifiedHistoryRoots=[];
const forwardProject=await forward.store.importPackage(forwardBlob);assert.deepEqual(r.copy(forwardProject.projectData),p.projectData);
const forwardObservations=Array.from(forward.runtime.__verifiedHistoryRoots),forwardRoots=new Set(forwardObservations.map(root=>root.snapshotSha256));
assert.equal(forwardObservations.length,forwardRoots.size,'HISTORY_IMPORT_ROOT_REUSE_ORACLE: forward references cannot cause a repeated complete-root validation');
for(let i=0;i<f.children.length;i++)assert.deepEqual(r.copy(await forward.store.readHistoryView(p.job.JOB_ID,f.children[i])),f.views[i]);
emit('HISTORY-IMPORT-FORWARD-ROOT-VALIDATION',{validations:forwardObservations.length,distinctRoots:forwardRoots.size,restoredViews:f.children.length});


// Retaining every reconstructed project makes a shared-content backup use
// memory proportional to all expanded versions. Exercise both grouped roots
// and later references, with exact state restoration for every saved version.
const boundedWriter=make();let boundedProject=boundedWriter.core.createBlankState('HISTORY-ROOT-RESIDENCY');
boundedProject.job.EXACT_USER_OBJECTIVE_VERBATIM='A retained immutable objective. '.repeat(300);
boundedWriter.engine.ensureShape(boundedProject);boundedWriter.engine.recalculate(boundedProject);
boundedProject=await boundedWriter.store.writeProject(boundedProject,{expectedProjectRevision:0});
const retainedStates=[];
for(let i=0;i<3;i++){
 if(i){const next=boundedWriter.copy(boundedProject);next.job.JOB_TITLE='Distinct retained root '+i;boundedWriter.engine.recordHumanInputVersion(next,['JOB_TITLE'],'SYNTHETIC_VERIFIER');boundedWriter.engine.recalculate(next);boundedProject=await boundedWriter.store.writeProject(next,{expectedProjectRevision:boundedProject.revision});}
 const rootId=(await boundedWriter.store.historyList(boundedProject.job.JOB_ID)).activeId;
 retainedStates.push({id:rootId,project:boundedWriter.copy(boundedProject)});
 const viewId=await boundedWriter.store.saveCheckpoint(boundedProject.job.JOB_ID,{expectedProjectRevision:boundedProject.revision,view:boundedWriter.copy({activeView:'Workflow',activeStage:1,scrollY:i+1})});
 retainedStates.push({id:viewId,project:boundedWriter.copy(boundedProject)});
}
const boundedExport=await boundedWriter.store.exportPackage(boundedProject.job.JOB_ID),boundedArchive=JSON.parse(gunzipSync(Buffer.from(await boundedExport.arrayBuffer())).toString('utf8'));
boundedArchive.recovery.entries.sort((a,b)=>Number(Boolean(a.projectReference))-Number(Boolean(b.projectReference)));delete boundedArchive.packageSha256;
const groupedBody={...boundedArchive,packageSha256:r.runtime.closedLoopHash.sha256Value(r.copy(boundedArchive))},groupedBlob=new Blob([gzipSync(Buffer.from(JSON.stringify(groupedBody)))],{type:'application/gzip'}),boundedReader=make();
boundedReader.runtime.__historyRootResidency=[];boundedReader.runtime.__verifiedHistoryRoots=[];boundedReader.runtime.__historyDigestReads=[];
let boundedImported=await boundedReader.store.importPackage(groupedBlob);
const rootResidency=Array.from(boundedReader.runtime.__historyRootResidency),boundedValidations=Array.from(boundedReader.runtime.__verifiedHistoryRoots);
console.error(JSON.stringify({caseId:'HISTORY-IMPORT-ROOT-RESIDENCY',peakMaterializedRoots:Math.max(...rootResidency),completeRoots:3,validations:boundedValidations.length,retainedVersions:retainedStates.length}));
assert.ok(rootResidency.length>=retainedStates.length);
assert.ok(rootResidency.every(count=>count<=1),'HISTORY_IMPORT_ROOT_RESIDENCY_ORACLE: an import must not retain every expanded canonical root; only the current materialization may remain in its validation cache');
assert.equal(boundedValidations.length,3,'HISTORY_IMPORT_ROOT_REUSE_ORACLE: bounding materialization must not revalidate roots when references revisit them');
const digestTraversals=Array.from(boundedReader.runtime.__historyDigestReads);
console.error(JSON.stringify({caseId:'HISTORY-IMPORT-ROOT-DIGEST-COST',roots:digestTraversals}));
assert.equal(digestTraversals.length,3);
assert.ok(digestTraversals.every(row=>row.visits===1),'HISTORY_IMPORT_ROOT_DIGEST_COST_ORACLE: both required root identities must consume one canonical traversal of shared project data, not reserialize the inventory for each identity');
emit('HISTORY-IMPORT-ROOT-DIGEST-COST',{roots:digestTraversals,expectedTraversalsPerRoot:1});
delete boundedReader.runtime.__historyDigestReads;
delete boundedReader.runtime.__historyRootResidency;delete boundedReader.runtime.__verifiedHistoryRoots;
for(const point of retainedStates){const restored=await boundedReader.store.restoreCheckpoint(boundedProject.job.JOB_ID,point.id,{expectedProjectRevision:boundedImported.revision});boundedImported=restored.project;assert.deepEqual(r.copy(boundedImported.job),r.copy(point.project.job),'HISTORY_IMPORT_ROOT_STATE_ORACLE: wrong retained project materialized');assert.deepEqual(r.copy(boundedImported.projectData),r.copy(point.project.projectData));}
emit('HISTORY-IMPORT-ROOT-RESIDENCY',{peakMaterializedRoots:Math.max(...rootResidency),completeRoots:3,validations:boundedValidations.length,restoredVersions:retainedStates.length,manifestOrder:'all complete roots, then their view references'});

// Historical inline snapshots remain supported: the disposable writer turns
// off sharing only, emitting the previous full-project checkpoint encoding.
const inlineAnchor='const base=state.entries.find(entry=>entry.projectSha256===digest(project)&&!entry.projectReference);';
assert.equal(source.split(inlineAnchor).length-1,1);
const partsAnchor='const contents=projectReference?null:await encodeHistoryProject(canonical,retainValue);';assert.equal(source.split(partsAnchor).length-1,1);
const legacy=projectStoreRuntime({sourceOverrides:{'project-store.js':source.replace(inlineAnchor,'const base=null;').replace(partsAnchor,'const contents={project:canonical};')}}),old=await fixture(legacy,'HISTORY-LEGACY-INLINE');
for(const id of [old.root,...old.children]){const body=await bodyOf(legacy.rows.get('meta').get(old.key(id)).value);assert.ok(body.project);assert.equal(Object.hasOwn(body,'projectReference'),false);assert.equal(Object.hasOwn(body,'projectParts'),false);}
const legacyBytes=await legacy.store.exportPackage(old.p.job.JOB_ID),newReader=make();await newReader.store.importPackage(legacyBytes);
for(let i=0;i<old.children.length;i++)assert.deepEqual(legacy.copy(await newReader.store.readHistoryView(old.p.job.JOB_ID,old.children[i])),old.views[i]);
emit('HISTORY-REFERENCE-LEGACY-INLINE-BACKUP',{legacyBytes:legacyBytes.size,legacySha256:sha(Buffer.from(await legacyBytes.arrayBuffer())),legacyEncoding:'Inline project member; sharing suppressed only in the disposable writer.'});
console.log(JSON.stringify({case:'history-project-references',productionSourceSha256:sha(source),implementationFault:mode||null,synthetic:true,actualBrowser:false,environment:'Production persistence and complete compressed backup bytes in Node lifecycle transaction adapter',cases},null,2));
