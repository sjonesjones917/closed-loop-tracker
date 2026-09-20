import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const mode=process.argv.find(x=>x.startsWith('--fault='))?.slice(8),source=fs.readFileSync('project-store.js','utf8');
const faults={
 'skip-selected-version-binding':{id:'SKIP_SELECTED_VERSION_BINDING',file:'project-store.js',before:"if(entry.id!==id||hash.sha256Value(descriptor)!==hash.sha256Value(expected))",after:'if(false)'},
 'skip-project-body-byte-check':{id:'SKIP_PROJECT_BODY_BYTE_CHECK',file:'project-store.js',before:"if(!entry?.blob||entry.blob.size!==Number(entry.byteSize)||await hash.sha256Bytes(entry.blob)!==entry.sha256)",after:"if(!entry?.blob||entry.blob.size!==Number(entry.byteSize))"}
};
if(mode&&!faults[mode])throw new Error('Unknown disposable implementation fault: '+mode);
const cases=[],emit=(caseId,details={})=>cases.push({caseId,result:'PASS',...details});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const make=()=>projectStoreRuntime({fault:faults[mode]});
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
const fresh=make(),imported=await fresh.store.importPackage(reorderedBlob);
assert.deepEqual(r.copy(imported.projectData),p.projectData);
for(let i=0;i<f.children.length;i++)assert.deepEqual(r.copy(await fresh.store.readHistoryView(p.job.JOB_ID,f.children[i])),f.views[i]);
emit('HISTORY-REFERENCE-REORDERED-BACKUP-CLOSURE',{exportedBytes:exported.size,exportedSha256:sha(Buffer.from(await exported.arrayBuffer())),importedBytes:reorderedBlob.size,importedSha256:sha(Buffer.from(await reorderedBlob.arrayBuffer())),freshStore:true});

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
