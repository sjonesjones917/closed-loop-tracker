import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {verifyHistoryStaticRead,HISTORY_STATIC_READ_FAULTS} from './test-history-static-read.mjs';

const mode=process.argv.find(x=>x.startsWith('--fault='))?.slice(8),source=fs.readFileSync('project-store.js','utf8');
const faults={
 ...HISTORY_STATIC_READ_FAULTS,
 'repeat-import-compatibility':{id:'REPEAT_IMPORT_COMPATIBILITY',file:'project-store.js',before:'if(!deferCompatibility&&!validatedProjections?.has(projectionKey)){',after:'if(!deferCompatibility){'},
 'share-import-compatibility-inventory':{id:'SHARE_IMPORT_COMPATIBILITY_INVENTORY',file:'project-store.js',before:'JSON.stringify([body.projectSha256,historyArtifactsSha256(artifacts)])',after:'JSON.stringify([body.projectSha256])'},
 'retain-import-compatibility':{id:'RETAIN_IMPORT_COMPATIBILITY',file:'project-store.js',before:'validatedProjections=new Set();',after:'validatedProjections=(globalThis.__retainedImportProjections ||= new Set());'},
 'repeat-import-root-digest':{id:'REPEAT_IMPORT_ROOT_DIGEST',file:'project-store.js',before:'({projectSha256:verifiedProjectSha256,workSha256:verifiedWorkSha256}=checkpointPairMatches(measuredPair,project)?measuredPair:historyProjectDigests(project));',after:'verifiedProjectSha256=projectSha256(project);verifiedWorkSha256=historyWorkSha256(project);'},
 'repeat-import-byte-hash':{id:'REPEAT_IMPORT_BYTE_HASH',file:'project-store.js',before:'if(!verifiedByteDigests)return hash.sha256Bytes(blob);',after:'if(true)return hash.sha256Bytes(blob);'},
 'trust-import-declared-byte-hash':{id:'TRUST_IMPORT_DECLARED_BYTE_HASH',file:'project-store.js',before:'const digest=await historyBlobSha256(artifactBlob,verifiedByteDigests);',after:'const digest=a.sha256;verifiedByteDigests.set(artifactBlob,Promise.resolve(digest));'},
 'retain-import-project-roots':{id:'RETAIN_IMPORT_PROJECT_ROOTS',file:'project-store.js',before:'delete priorRoot.project;',after:'void priorRoot.project;'},
 'repeat-import-project-root':{id:'REPEAT_IMPORT_PROJECT_ROOT',file:'project-store.js',before:'if(!body.projectReference&&validatedRoots.has(entry.id)&&!inspection?.issues.length)',after:'if(false)'},
 'skip-selected-version-binding':{id:'SKIP_SELECTED_VERSION_BINDING',file:'project-store.js',before:"if(entry.id!==id||hash.sha256Value(descriptor)!==hash.sha256Value(expected))",after:'if(false)'},
 'skip-project-body-byte-check':{id:'SKIP_PROJECT_BODY_BYTE_CHECK',file:'project-store.js',before:"if(!entry?.blob||entry.blob.size!==Number(entry.byteSize)||(consumeCheckpointByteObservation(entry,rootBytes)||await historyBlobSha256(entry.blob,verifiedByteDigests))!==entry.sha256)",after:"if(!entry?.blob||entry.blob.size!==Number(entry.byteSize))"}
};
if(mode&&!faults[mode])throw new Error('Unknown disposable implementation fault: '+mode);
if(mode==='repeat-import-compatibility')assert.equal(source.split(faults[mode].before).length-1,1,'HISTORY_COMPATIBILITY_FAULT_SINGLE_ANCHOR_ORACLE');
const cases=[],emit=(caseId,details={})=>cases.push({caseId,result:'PASS',...details});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const validationAnchor='({projectSha256:verifiedProjectSha256,workSha256:verifiedWorkSha256}=checkpointPairMatches(measuredPair,project)?measuredPair:historyProjectDigests(project));';
const make=()=>{
 assert.equal(source.split(validationAnchor).length-1,1);
 const observed=source.replace(validationAnchor,"globalThis.__verifiedHistoryRoots?.push({checkpointId:entry.id,snapshotSha256:entry.sha256});globalThis.__historyDigestWatch={data:project.projectData,visits:0};"+validationAnchor+"globalThis.__historyDigestReads?.push({checkpointId:entry.id,visits:globalThis.__historyDigestWatch.visits});delete globalThis.__historyDigestWatch;");
 // Observe the one post-decode consumer, shared by normal and compatibility branches.
 const residencyAnchor='if(decoded&&entry.id===incoming.activeId)';
 assert.equal(observed.split(residencyAnchor).length-1,1);
 const measured=observed.replace(residencyAnchor,'globalThis.__historyRootResidency?.push([...validatedRoots.values()].filter(root=>root?.project).length);'+residencyAnchor);
 const inputAnchor='fileContents.delete(a);';
 assert.equal(measured.split(inputAnchor).length-1,1);
 const compatibilityAnchor='withVerifiedRecoveryCustody(artifacts,()=>assertRecoveryCompatibility(body.project));';
 assert.equal(measured.split(compatibilityAnchor).length-1,1);
 const withCompatibility=measured.replace(compatibilityAnchor,'globalThis.__historyCompatibilityChecks?.push({scope:validatedProjections?"incoming-import":"local-history",projectSha256:body.projectSha256,artifactManifestSha256:historyArtifactsSha256(artifacts)});'+compatibilityAnchor);
 const withBytes=withCompatibility.replace(inputAnchor,inputAnchor+'globalThis.__archiveImportByteObjects?.push(artifactBlob);');
 const hashSource=fs.readFileSync('hash.js','utf8'),hashAnchor='async function sha256Bytes(bytes){';
 assert.equal(hashSource.split(hashAnchor).length-1,1);
 const traversalAnchor='const frame=stack.at(-1),input=frame.value;diagnosticFrame=frame;';assert.equal(hashSource.split(traversalAnchor).length-1,1);
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
if(!mode||HISTORY_STATIC_READ_FAULTS[mode]){
const staticRead=await verifyHistoryStaticRead({sourceOverrides:{'project-store.js':source},fault:HISTORY_STATIC_READ_FAULTS[mode]||null});
emit('HISTORY-SINGLE-BODY-STATIC-VALIDATION',{caseCount:staticRead.caseCount,cases:staticRead.cases,sourceSha256:staticRead.sourceSha256});
}
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
const fresh=make();fresh.runtime.__verifiedHistoryRoots=[];fresh.runtime.__historyBlobHashes=[];fresh.runtime.__archiveImportByteObjects=[];fresh.runtime.__historyCompatibilityChecks=[];
const imported=await fresh.store.importPackage(reorderedBlob);
const compatibilityChecks=Array.from(fresh.runtime.__historyCompatibilityChecks),compatibilityStates=new Set(compatibilityChecks.map(row=>JSON.stringify(row)));
console.error(JSON.stringify({caseId:'HISTORY-IMPORT-COMPATIBILITY-COST',checks:compatibilityChecks.length,distinctStates:compatibilityStates.size,retainedViews:archive.recovery.entries.length}));
assert.ok(compatibilityChecks.length>0);
assert.equal(compatibilityChecks.length,compatibilityStates.size,'HISTORY_IMPORT_COMPATIBILITY_COST_ORACLE: importing saved views of the same verified project and exact file inventory must reuse its completed compatibility validation; each view still requires its own byte, identity and file-selection checks');
delete fresh.runtime.__historyCompatibilityChecks;
emit('HISTORY-IMPORT-COMPATIBILITY-COST',{checks:compatibilityChecks.length,distinctStates:compatibilityStates.size,retainedViews:archive.recovery.entries.length});
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
// A later import and an ordinary History read must establish their own proof.
fresh.runtime.__historyCompatibilityChecks=[];
await fresh.store.importPackage(reorderedBlob);
const repeatedCompatibilityChecks=Array.from(fresh.runtime.__historyCompatibilityChecks),reimportChecks=repeatedCompatibilityChecks.filter(row=>row.scope==='incoming-import'),localHistoryChecks=repeatedCompatibilityChecks.filter(row=>row.scope==='local-history');
// Reimport independently verifies the reused local active checkpoint before
// validating incoming archive projections with this import's fresh receipts.
assert.equal(reimportChecks.length,compatibilityStates.size,'HISTORY_IMPORT_COMPATIBILITY_FRESH_ORACLE: completed projection receipts must not survive into another import');
assert.equal(localHistoryChecks.length,1,'HISTORY_IMPORT_LOCAL_HISTORY_ORACLE: reimport must independently validate the reused local active checkpoint');
fresh.runtime.__historyCompatibilityChecks=[];
for(const child of f.children)await fresh.store.readHistoryView(p.job.JOB_ID,child);
assert.equal(fresh.runtime.__historyCompatibilityChecks.length,f.children.length,'HISTORY_IMPORT_COMPATIBILITY_FRESH_ORACLE: ordinary History reads must validate the current stored bytes anew');
assert.ok(fresh.runtime.__historyCompatibilityChecks.every(row=>row.scope==='local-history'),'HISTORY_IMPORT_COMPATIBILITY_FRESH_ORACLE: ordinary History reads cannot borrow incoming import receipts');
delete fresh.runtime.__historyCompatibilityChecks;
emit('HISTORY-IMPORT-COMPATIBILITY-FRESHNESS',{reimportChecks:reimportChecks.length,independentLocalHistoryChecks:localHistoryChecks.length,independentHistoryChecks:f.children.length});
// A canonical version can retain different file inventories in different
// views. Construct both through the real store and preserve each exact view.
const inventory=await fixture(make(),'HISTORY-COMPATIBILITY-INVENTORIES'),inventoryStore=inventory.r.store;
const selectedBytes=new Blob(['Exact retained file selection.']);
await inventoryStore.putArtifact({artifactId:'INVENTORY-SELECTION',jobId:inventory.p.job.JOB_ID,filename:'selected.txt',mediaType:'text/plain',blob:selectedBytes});
const selectedView=inventory.r.copy({activeView:'Workflow',activeStage:1,scrollY:15});
const selectedId=await inventoryStore.saveCheckpoint(inventory.p.job.JOB_ID,{expectedProjectRevision:inventory.p.revision,view:selectedView});
const inventoryBackup=await inventoryStore.exportPackage(inventory.p.job.JOB_ID),inventoryReader=make();inventoryReader.runtime.__historyCompatibilityChecks=[];
const inventoryProject=await inventoryReader.store.importPackage(inventoryBackup),inventoryChecks=Array.from(inventoryReader.runtime.__historyCompatibilityChecks);
assert.equal(new Set(inventoryChecks.map(row=>row.projectSha256)).size,1);
assert.equal(inventoryChecks.length,2,'HISTORY_IMPORT_COMPATIBILITY_INVENTORY_ORACLE: the same project with two exact saved file inventories requires two independently completed validations');
assert.equal(new Set(inventoryChecks.map(row=>row.artifactManifestSha256)).size,2,'HISTORY_IMPORT_COMPATIBILITY_INVENTORY_ORACLE: each distinct verified file inventory must bind its own projection receipt');
assert.deepEqual(inventory.r.copy(await inventoryReader.store.readHistoryView(inventoryProject.job.JOB_ID,selectedId)),selectedView);
const selectedFile=await inventoryReader.store.getArtifact('INVENTORY-SELECTION');assert.equal(await selectedFile.blob.text(),await selectedBytes.text());
assert.deepEqual(inventory.r.copy(await inventoryReader.store.readHistoryView(inventoryProject.job.JOB_ID,inventory.children[0])),inventory.views[0]);
emit('HISTORY-IMPORT-COMPATIBILITY-INVENTORIES',{projects:1,distinctInventories:2,checks:inventoryChecks.length,exactFileAndViewsPreserved:true});
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
// Export verifies each complete root once. A view reference that follows its
// root reuses that verification instead of decoding the root a second time;
// at Stage 30 the repeat decodes alone cost several minutes per backup.
boundedWriter.runtime.__verifiedHistoryRoots=[];
const boundedExport=await boundedWriter.store.exportPackage(boundedProject.job.JOB_ID);
{const exportValidations=Array.from(boundedWriter.runtime.__verifiedHistoryRoots);delete boundedWriter.runtime.__verifiedHistoryRoots;
 const writerEntries=(await boundedWriter.store.metaGet('recovery:'+boundedProject.job.JOB_ID)).entries,completeRoots=writerEntries.filter(entry=>!entry.projectReference).length;
 assert.ok(writerEntries.some(entry=>entry.projectReference)&&completeRoots===3,'HISTORY_EXPORT_ROOT_REUSE_FIXTURE_ORACLE: the fixture needs three complete roots, each followed by a view reference');
 console.error(JSON.stringify({caseId:'HISTORY-EXPORT-ROOT-REUSE',validations:exportValidations.length,completeRoots}));
 assert.equal(new Set(exportValidations.map(root=>root.snapshotSha256)).size,completeRoots,'HISTORY_EXPORT_ROOT_REUSE_ORACLE: an export must still validate every complete root');
 assert.equal(exportValidations.length,completeRoots,'HISTORY_EXPORT_ROOT_REUSE_ORACLE: an export must validate each complete root once; a view reference must reuse the root its own entry just verified');}
const boundedArchive=JSON.parse(gunzipSync(Buffer.from(await boundedExport.arrayBuffer())).toString('utf8'));
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
// History state form. The state names a complete version's inline parts by the
// canonical digest of that exact list; the immutable record, body and backup
// keep the complete descriptor. Independent expected digests below.
{
 const json=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(json).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+json(x[k])).join(',')+'}';
 const stateForm=d=>{if(!d?.projectParts)return d;const {projectParts,...rest}=d;return {...rest,projectPartsSha256:sha(Buffer.from(json(projectParts)))};};
 const w=make();let sp=w.core.createBlankState('HISTORY-STATE-FORM');sp.job.JOB_TITLE='State form retained title '.repeat(200);w.engine.ensureShape(sp);w.engine.recalculate(sp);sp=await w.store.writeProject(sp,{expectedProjectRevision:0});
 const jobId=sp.job.JOB_ID,stateKey='recovery:'+jobId,recordKey=id=>stateKey+':snapshot:'+id,draft=(n,t=w)=>t.copy({activeView:'Workflow',activeStage:1,scrollY:n,drafts:{'#job-objective':{value:'State form draft '+n}}});
 const firstRoot=(await w.store.historyList(jobId)).activeId,firstView=await w.store.saveCheckpoint(jobId,{expectedProjectRevision:sp.revision,view:draft(5,w)});
 let next=w.copy(sp);next.job.JOB_TITLE='Second state form title '.repeat(200);w.engine.recalculate(next);sp=await w.store.writeProject(next,{expectedProjectRevision:sp.revision});
 const secondRoot=(await w.store.historyList(jobId)).activeId,secondView=await w.store.saveCheckpoint(jobId,{expectedProjectRevision:sp.revision,view:draft(7,w)});
 const stateOf=t=>t.rows.get('meta').get(stateKey).value,recordOf=(t,id)=>{const {blob,...descriptor}=t.rows.get('meta').get(recordKey(id)).value;return descriptor;};
 const copyOf=from=>{const t=make();for(const [name,rows]of from.rows)t.rows.set(name,new Map([...rows].map(([key,row])=>[key,t.copy(row)])));return t;};
 const views={[firstView]:5,[secondView]:7},readAll=async t=>{for(const [id,n]of Object.entries(views))assert.deepEqual(t.copy(await t.store.readHistoryView(jobId,id)),draft(n,t),'HISTORY_STATE_FORM_READ_ORACLE');};
 const entryOf=(t,id)=>stateOf(t).entries.find(e=>e.id===id),inflate=(t,ids)=>{const state=stateOf(t);state.entries=state.entries.map(e=>ids.includes(e.id)?t.copy(recordOf(t,e.id)):e);};
 const refused=async(t,action,code,message,oracle)=>{const before=frozenRows(t);await assert.rejects(action,e=>e.code===code&&(message===null||e.message===message),oracle);assert.deepEqual(frozenRows(t),before,oracle+': refusal preserves every row');};
 const exportBody=async t=>{const blob=await t.store.exportPackage(jobId),body=JSON.parse(gunzipSync(Buffer.from(await blob.arrayBuffer())).toString('utf8'));const {packageSha256,exportedAt,...rest}=body;assert.equal(sha(Buffer.from(json({...rest,exportedAt}))),packageSha256,'HISTORY_STATE_FORM_PACKAGE_ORACLE');return {blob,rest};};
 const firstPart=recordOf(w,firstRoot).projectParts.entries.find(part=>!recordOf(w,secondRoot).projectParts.entries.some(other=>other.sha256===part.sha256));
 for(const id of [firstRoot,secondRoot]){const entry=entryOf(w,id),record=recordOf(w,id);assert.ok(record.projectParts?.entries?.length&&!Object.hasOwn(record,'projectPartsSha256'),'HISTORY_STATE_FORM_RECORD_ORACLE: the record keeps the complete descriptor');assert.equal(json(entry),json(stateForm(record)),'HISTORY_STATE_FORM_WRITE_ORACLE: a write records the exact state form');}
 for(const id of [firstView,secondView])assert.equal(json(entryOf(w,id)),json(recordOf(w,id)),'HISTORY_STATE_FORM_REFERENCE_ORACLE: a view reference entry is unchanged');
 assert.ok(firstPart,'HISTORY_STATE_FORM_DISTINCT_PART_FIXTURE_ORACLE');await readAll(w);
 const reference=await exportBody(w);
 for(const entry of reference.rest.recovery.entries)assert.equal(json(entry),json(recordOf(w,entry.id)),'HISTORY_STATE_FORM_EXPORT_ORACLE: a backup carries the complete recorded descriptor');
 emit('HISTORY-STATE-FORM-WRITE',{roots:2,views:2,stateBytes:JSON.stringify(stateOf(w)).length,inlineStateBytes:JSON.stringify({...stateOf(w),entries:stateOf(w).entries.map(e=>recordOf(w,e.id))}).length});
 // N1/N2: a digest that disagrees with the record or with the body.
 {const t=copyOf(w);entryOf(t,firstRoot).projectPartsSha256='f'.repeat(64);
  await refused(t,()=>t.store.readHistoryView(jobId,firstView),'HISTORY_VERSION_MISMATCH','Stored snapshot identity does not match the selected retained version.','HISTORY_STATE_FORM_RECORD_DIGEST_ORACLE read');
  await refused(t,()=>t.store.restoreCheckpoint(jobId,firstRoot,{expectedProjectRevision:sp.revision}),'HISTORY_VERSION_MISMATCH','Stored snapshot identity does not match the selected retained version.','HISTORY_STATE_FORM_RECORD_DIGEST_ORACLE restore');
  await refused(t,()=>t.store.exportPackage(jobId),'HISTORY_VERSION_MISMATCH','Saved project contents do not match their checkpoint.','HISTORY_STATE_FORM_BODY_DIGEST_ORACLE export');
  await t.store.readHistoryView(jobId,secondView);
  const u=copyOf(w);entryOf(u,secondRoot).projectPartsSha256='f'.repeat(64);
  await refused(u,()=>u.store.saveCheckpoint(jobId,{expectedProjectRevision:sp.revision,view:draft(9,u)}),'HISTORY_SNAPSHOT_INTEGRITY_FAILED','A retained project body failed exact-byte verification. The new checkpoint was not committed.','HISTORY_STATE_FORM_RECORD_DIGEST_ORACLE reuse');
  emit('HISTORY-STATE-FORM-DIGEST-MISMATCH',{read:'HISTORY_VERSION_MISMATCH',restore:'HISTORY_VERSION_MISMATCH',export:'HISTORY_VERSION_MISMATCH',reuse:'HISTORY_SNAPSHOT_INTEGRITY_FAILED',unrelatedRootReadable:true});}
 // N3: both fields, a digest on a reference entry, or a malformed digest.
 for(const [shape,change]of [['both-fields',t=>{entryOf(t,firstRoot).projectParts=t.copy(recordOf(t,firstRoot).projectParts);}],['reference-digest',t=>{entryOf(t,firstView).projectPartsSha256=entryOf(t,firstRoot).projectPartsSha256;}],['uppercase-digest',t=>{const e=entryOf(t,firstRoot);e.projectPartsSha256=e.projectPartsSha256.toUpperCase();}],['short-digest',t=>{const e=entryOf(t,firstRoot);e.projectPartsSha256=e.projectPartsSha256.slice(1);}],['non-string-digest',t=>{entryOf(t,firstRoot).projectPartsSha256={sha256:'0'.repeat(64)};}]]){
  const t=copyOf(w);change(t);
  await refused(t,()=>t.store.readHistoryView(jobId,secondView),'HISTORY_VERSION_MISMATCH','Saved project content references are unsupported.','HISTORY_STATE_FORM_SHAPE_ORACLE '+shape);
  const changed=t.copy(sp);changed.job.JOB_TITLE='Refused state form write';t.engine.recalculate(changed);
  await refused(t,()=>t.store.writeProject(changed,{expectedProjectRevision:sp.revision}),'HISTORY_VERSION_MISMATCH','Saved project content references are unsupported.','HISTORY_STATE_FORM_SHAPE_ORACLE write '+shape);
  await refused(t,()=>t.store.exportPackage(jobId),'HISTORY_VERSION_MISMATCH','Saved project content references are unsupported.','HISTORY_STATE_FORM_SHAPE_ORACLE export '+shape);
 }
 emit('HISTORY-STATE-FORM-SHAPES',{shapes:5,code:'HISTORY_VERSION_MISMATCH'});
 // N4: a state-form root whose part is not a retained file (accounting
 // adjusted) is refused by every use of that root; other roots stay readable.
 {const t=copyOf(w),state=stateOf(t);state.retainedFileBytes-=state.files[firstPart.sha256].byteSize;delete state.files[firstPart.sha256];
  const notRetained='Recovery project contents are not retained in this complete history.';
  await refused(t,()=>t.store.readHistoryView(jobId,firstView),'HISTORY_VERSION_MISMATCH',notRetained,'HISTORY_STATE_FORM_UNRETAINED_PART_ORACLE read');
  await refused(t,()=>t.store.restoreCheckpoint(jobId,firstRoot,{expectedProjectRevision:sp.revision}),'HISTORY_VERSION_MISMATCH',notRetained,'HISTORY_STATE_FORM_UNRETAINED_PART_ORACLE restore');
  await refused(t,()=>t.store.exportPackage(jobId),'HISTORY_VERSION_MISMATCH',notRetained,'HISTORY_STATE_FORM_UNRETAINED_PART_ORACLE export');
  assert.deepEqual(t.copy(await t.store.readHistoryView(jobId,secondView)),draft(7,t),'HISTORY_STATE_FORM_UNRELATED_ROOT_ORACLE');
  // Reusing the root for a new checkpoint is refused before commit.
  const u=copyOf(w),ustate=stateOf(u),secondPart=recordOf(u,secondRoot).projectParts.entries.find(part=>!recordOf(u,firstRoot).projectParts.entries.some(other=>other.sha256===part.sha256));ustate.retainedFileBytes-=ustate.files[secondPart.sha256].byteSize;delete ustate.files[secondPart.sha256];
  await refused(u,()=>u.store.saveCheckpoint(jobId,{expectedProjectRevision:sp.revision,view:draft(11,u)}),'HISTORY_VERSION_MISMATCH','A retained project content dependency is unavailable.','HISTORY_STATE_FORM_UNRETAINED_PART_ORACLE reuse');
  emit('HISTORY-STATE-FORM-UNRETAINED-PART',{read:notRetained,restore:notRetained,export:notRetained,reuse:'A retained project content dependency is unavailable.',unrelatedRootReadable:true});}
 // N11: an immutable record rewritten into the state form (its parts list
 // replaced by that list's exact digest, body untouched) is never a stored
 // record. Reads, restore and root reuse refuse it with the existing codes and
 // messages, for a state-form and a legacy inline History; nothing is written.
 {const forge=(t,id)=>{const row=t.rows.get('meta').get(recordKey(id)),forged={};for(const key of Object.keys(row.value))if(key==='projectParts')forged.projectPartsSha256=sha(Buffer.from(json(row.value.projectParts)));else forged[key]=row.value[key];row.value=forged;};
  const identity='Stored snapshot identity does not match the selected retained version.',bodyFailure='A retained project body failed exact-byte verification. The new checkpoint was not committed.';
  for(const form of ['state','legacy']){
   const prepare=()=>{const t=copyOf(w);if(form==='legacy')inflate(t,[firstRoot,secondRoot]);return t;};
   {const t=prepare();forge(t,firstRoot);
    await refused(t,()=>t.store.readHistoryView(jobId,firstView),'HISTORY_VERSION_MISMATCH',identity,'HISTORY_STATE_FORM_FORGED_RECORD_ORACLE '+form+' read view');
    await refused(t,()=>t.store.readHistoryView(jobId,firstRoot),'HISTORY_VERSION_MISMATCH',identity,'HISTORY_STATE_FORM_FORGED_RECORD_ORACLE '+form+' read root');
    await refused(t,()=>t.store.restoreCheckpoint(jobId,firstRoot,{expectedProjectRevision:sp.revision}),'HISTORY_VERSION_MISMATCH',identity,'HISTORY_STATE_FORM_FORGED_RECORD_ORACLE '+form+' restore');
    assert.deepEqual(t.copy(await t.store.readHistoryView(jobId,secondView)),draft(7,t),'HISTORY_STATE_FORM_FORGED_RECORD_UNRELATED_ROOT_ORACLE '+form);}
   // A legacy inline entry whose part is unretained is refused at conversion (N5).
   for(const dropped of form==='state'?[false,true]:[false]){const t=prepare();forge(t,secondRoot);
    if(dropped){const state=stateOf(t),part=recordOf(w,secondRoot).projectParts.entries.find(part=>!recordOf(w,firstRoot).projectParts.entries.some(other=>other.sha256===part.sha256));state.retainedFileBytes-=state.files[part.sha256].byteSize;delete state.files[part.sha256];}
    const generation=stateOf(t).generation;
    await refused(t,()=>t.store.saveCheckpoint(jobId,{expectedProjectRevision:sp.revision,view:draft(21,t)}),'HISTORY_SNAPSHOT_INTEGRITY_FAILED',bodyFailure,'HISTORY_STATE_FORM_FORGED_RECORD_ORACLE '+form+' reuse'+(dropped?' with an unretained part':''));
    assert.equal(stateOf(t).generation,generation,'HISTORY_STATE_FORM_FORGED_RECORD_ORACLE: generation unchanged');}
  }
  emit('HISTORY-STATE-FORM-FORGED-RECORD',{forms:['state','legacy'],read:'HISTORY_VERSION_MISMATCH',restore:'HISTORY_VERSION_MISMATCH',reuse:'HISTORY_SNAPSHOT_INTEGRITY_FAILED',reuseWithUnretainedPart:'HISTORY_SNAPSHOT_INTEGRITY_FAILED',unrelatedRootReadable:true});}
 // N5: the first write converts legacy inline entries; a corrupted inline
 // entry is refused, never converted, and nothing is written.
 {const t=copyOf(w);inflate(t,[firstRoot,secondRoot]);const legacyState=json(stateOf(t));await readAll(t);
  const legacyExport=await exportBody(t);assert.equal(json(legacyExport.rest),json(reference.rest),'HISTORY_STATE_FORM_LEGACY_EXPORT_ORACLE: legacy and state-form manifests export identical bytes');
  assert.equal(json(stateOf(t)),legacyState,'HISTORY_STATE_FORM_LEGACY_EXPORT_ORACLE: reads and export never convert the stored state');
  const bad=copyOf(t),state=stateOf(bad);state.retainedFileBytes-=state.files[firstPart.sha256].byteSize;delete state.files[firstPart.sha256];const generation=state.generation;
  const changed=bad.copy(sp);changed.job.JOB_TITLE='Refused migration write';bad.engine.recalculate(changed);
  await refused(bad,()=>bad.store.writeProject(changed,{expectedProjectRevision:sp.revision}),'HISTORY_VERSION_MISMATCH','Recovery project contents are not retained in this complete history.','HISTORY_STATE_FORM_MIGRATION_ORACLE write');
  await refused(bad,()=>bad.store.saveCheckpoint(jobId,{expectedProjectRevision:sp.revision,view:draft(13,bad)}),'HISTORY_VERSION_MISMATCH','Recovery project contents are not retained in this complete history.','HISTORY_STATE_FORM_MIGRATION_ORACLE checkpoint');
  assert.equal(stateOf(bad).generation,generation,'HISTORY_STATE_FORM_MIGRATION_ORACLE: generation unchanged');
  const id=await t.store.saveCheckpoint(jobId,{expectedProjectRevision:sp.revision,view:draft(15,t)});
  for(const root of [firstRoot,secondRoot])assert.equal(json(entryOf(t,root)),json(stateForm(recordOf(t,root))),'HISTORY_STATE_FORM_MIGRATION_ORACLE: converted once to the exact state form');
  await readAll(t);assert.deepEqual(t.copy(await t.store.readHistoryView(jobId,id)),draft(15,t));
  emit('HISTORY-STATE-FORM-MIGRATION',{legacyExportIdentical:true,corruptedLegacyRefused:'HISTORY_VERSION_MISMATCH',generationUnchanged:true,converted:2});}
 // N8: an observed version keeps the inline shape its descriptorSha256 binds.
 {const observe=t=>{const state=stateOf(t),root=entryOf(t,firstRoot);state.compatibility={schema:t.runtime.closedLoopWorkflowSchema.RECOVERY_COMPATIBILITY_CONTRACT.schema,observations:[{checkpointId:firstRoot,snapshotSha256:root.sha256,descriptorSha256:sha(Buffer.from(json(recordOf(t,firstRoot)))),issues:[{checkpointId:firstRoot,declaredWorkSha256:root.workSha256,measuredWorkSha256:'0'.repeat(64)}]}]};};
  const slim=copyOf(w);observe(slim);
  await refused(slim,()=>slim.store.readHistoryView(jobId,secondView),'HISTORY_VERSION_MISMATCH','Recovery observation does not identify its original checkpoint.','HISTORY_STATE_FORM_OBSERVED_ORACLE');
  const inline=copyOf(w);observe(inline);inflate(inline,[firstRoot]);
  assert.deepEqual(inline.copy(await inline.store.readHistoryView(jobId,secondView)),draft(7,inline),'HISTORY_STATE_FORM_OBSERVED_INLINE_CONTROL');
  inflate(inline,[secondRoot]);await inline.store.saveCheckpoint(jobId,{expectedProjectRevision:sp.revision,view:draft(17,inline)});
  assert.equal(json(entryOf(inline,firstRoot)),json(recordOf(inline,firstRoot)),'HISTORY_STATE_FORM_OBSERVED_ORACLE: an observed entry is never converted');
  assert.equal(json(entryOf(inline,secondRoot)),json(stateForm(recordOf(inline,secondRoot))),'HISTORY_STATE_FORM_OBSERVED_ORACLE: other entries are converted');
  emit('HISTORY-STATE-FORM-OBSERVED-ENTRY',{slimObservedRefused:'HISTORY_VERSION_MISMATCH',observedKeptInline:true});}
 // N9: the backup format stays closed to the state form.
 {const body={...reference.rest,exportedAt:'2026-11-04T00:00:00.000Z'};body.recovery={...body.recovery,entries:body.recovery.entries.map(stateForm)};
  const crafted=new Blob([gzipSync(Buffer.from(json({...body,packageSha256:sha(Buffer.from(json(body)))})))],{type:'application/gzip'}),fresh=make();
  await refused(fresh,()=>fresh.store.importPackage(crafted),'HISTORY_VERSION_MISMATCH','Backup History identity is invalid.','HISTORY_STATE_FORM_BACKUP_ORACLE');
  const local=copyOf(w);await refused(local,()=>local.store.importPackage(crafted),'HISTORY_VERSION_MISMATCH','Backup History identity is invalid.','HISTORY_STATE_FORM_BACKUP_ORACLE existing');
  emit('HISTORY-STATE-FORM-BACKUP-CLOSED',{code:'HISTORY_VERSION_MISMATCH'});}
 // N10: a mixed state reads, writes, exports and imports exactly.
 {const t=copyOf(w);inflate(t,[firstRoot]);await readAll(t);
  const mixedExport=await exportBody(t);assert.equal(json(mixedExport.rest),json(reference.rest),'HISTORY_STATE_FORM_MIXED_EXPORT_ORACLE');
  const fresh=make(),imported=await fresh.store.importPackage(mixedExport.blob);await readAll(fresh);
  for(const entry of reference.rest.recovery.entries){assert.equal(json(entryOf(fresh,entry.id)),json(stateForm(entry)),'HISTORY_STATE_FORM_IMPORT_ORACLE: an import records the state form');assert.equal(json(recordOf(fresh,entry.id)),json(entry),'HISTORY_STATE_FORM_IMPORT_ORACLE: the imported record is complete');}
  const again=await fresh.store.importPackage(mixedExport.blob);assert.equal(again.job.JOB_ID,jobId,'HISTORY_STATE_FORM_REIMPORT_ORACLE');await readAll(fresh);
  const local=copyOf(t);await local.store.importPackage(mixedExport.blob);await readAll(local);for(const id of [firstRoot,secondRoot])assert.equal(json(entryOf(local,id)),json(stateForm(recordOf(local,id))),'HISTORY_STATE_FORM_IMPORT_ORACLE: local mixed entries agree in state form');
  await t.store.saveCheckpoint(jobId,{expectedProjectRevision:sp.revision,view:draft(19,t)});await readAll(t);assert.equal(json(entryOf(t,firstRoot)),json(stateForm(recordOf(t,firstRoot))));
  emit('HISTORY-STATE-FORM-MIXED',{exportIdentical:true,imported:imported.job.JOB_ID===jobId,reimported:true,writeConverted:true});}
}
console.log(JSON.stringify({case:'history-project-references',productionSourceSha256:sha(source),implementationFault:mode||null,synthetic:true,actualBrowser:false,environment:'Production persistence and complete compressed backup bytes in Node lifecycle transaction adapter',cases},null,2));
