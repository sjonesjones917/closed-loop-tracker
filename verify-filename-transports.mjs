import {authorizeSyntheticHandoff} from './test-handoff-authorization.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {projectStoreRuntime,storedArtifactBody} from './test-project-store-runtime.mjs';
import {readStoreArchive} from './test-zip.mjs';
const faultName=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8);
// Handoff assembly is guarded twice: after members and authorization are assembled, and again
// after the archive bytes exist. The injected fault removes both, so only a real race guard remains.
const staleGuard=name=>`if(!${name}||${name}.projectSha256!==activeProject.projectSha256||Number(${name}.revision||0)!==Number(activeProject.revision||0)||(${name}.historyActivationId||null)!==(activeProject.historyActivationId||null))`;
const handoffRaceSource=()=>{let source=fs.readFileSync('project-store.js','utf8');for(const name of ['currentProject','afterArchive']){const guard=staleGuard(name);if(source.split(guard).length!==2)throw new Error('Fault anchor missing: handoff-race '+name);source=source.replace(guard,'if(false)');}return source;};
const sourceOverrides=faultName==='handoff-race'?{'project-store.js':handoffRaceSource()}:{};
const r=projectStoreRuntime({sourceOverrides}),{core,engine,store,prompts,copy}=r,hash=r.runtime.closedLoopHash,cases=[],note=name=>cases.push({name,result:'PASS'});
let app=fs.readFileSync('app-core.js','utf8');if(faultName==='stored-byte-comparison')app=app.replace('if(stored.size!==digest.size||stored.sha256.toLowerCase()!==digest.sha256.toLowerCase())','if(false)');const start=app.indexOf('function logicalFilePath('),end=app.indexOf('\n',start);vm.runInContext(app.slice(start,end)+'\nglobalThis.logicalPath=logicalFilePath;',r.runtime);
for(const filename of ['/secret.txt','C:/secret.txt','folder//file.txt','../secret.txt','bad\u0085name.txt'])assert.throws(()=>r.runtime.logicalPath({name:filename}),/UNSAFE_FILENAME/,'PICKER_PATH_ORACLE');
assert.equal(r.runtime.logicalPath({name:'résumé.txt',webkitRelativePath:'selected-folder/資料/re\u0301sume\u0301.txt'}),'資料/re\u0301sume\u0301.txt');note('Picker path handling rejects unsafe paths before changing them and retains valid relative-path spelling');
const transportStart=app.indexOf('function promptTransportFilename(');vm.runInContext(app.slice(transportStart,app.indexOf('\n',transportStart))+'\nglobalThis.promptFilename=promptTransportFilename;',r.runtime);r.runtime.current={job:{JOB_ID:'Projet-re\u0301sume\u0301'}};assert.equal(r.runtime.promptFilename({operation:'COMPLETE',instructionId:'INSTRUCTION-1'},1),'Projet-résumé_01_COMPLETE_INSTRUCTION-1.txt');note('Individual instruction exports retain valid Unicode and use the same pinned filename normalizer as consolidated handoffs');
let p=core.createBlankState('FILENAME-TRANSPORT');p.job.EXACT_USER_OBJECTIVE_VERBATIM='Use the supplied Unicode text.';engine.ensureShape(p);engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});const initial=(await store.historyList(p.job.JOB_ID)).activeId;
const rawFilename='re\u0301sume\u0301-中文.txt',bytes=Buffer.from('Exact file bytes: é🙂\n'),blob=new Blob([bytes],{type:'text/plain'}),stored=await store.putArtifact({artifactId:artifactFixtureId(engine,p,'UNICODE-ARTIFACT'),jobId:p.job.JOB_ID,filename:rawFilename,blob});
const next=copy(p);engine.registerArtifactBytes(next,copy({stage:1,artifactId:stored.artifactId,filename:rawFilename,mediaType:'text/plain',byteSize:bytes.length,sha256:stored.sha256}));next.stages[1].authorizedFiles.push(copy({artifactId:stored.artifactId,name:rawFilename,sha256:stored.sha256,size:bytes.length}));p=await store.writeProject(next,{expectedProjectRevision:p.revision});
const prepared=copy(p);let prompt=prompts.reserveAndBuildPromptRecord(prepared,1,{},{}).prompt;p=await store.writeProject(prepared,{expectedProjectRevision:p.revision});
({project:p,prompt}=await authorizeSyntheticHandoff(r,{project:p,prompt}));
const checkpoint=(await store.historyList(p.job.JOB_ID)).activeId,backup=await store.exportPackage(p.job.JOB_ID);
for(const name of ['digestFile','auditedSelections']){const offset=app.indexOf('async function '+name+'(');vm.runInContext(app.slice(offset,app.indexOf('\n',offset)),r.runtime);}Object.assign(r.runtime,{current:p,engine,recordValue:engine.recordValue,projectStore:store});vm.runInContext('globalThis.auditSelections=auditedSelections;',r.runtime);
const selected=new Blob([bytes],{type:'text/plain'});Object.defineProperty(selected,'name',{value:rawFilename});let audited;await assert.doesNotReject(async()=>{audited=await r.runtime.auditSelections([selected]);},'STORED_BLOB_AUDIT_ORACLE: byte comparison must use stored artifact metadata rather than assume a persisted Blob retains a File name');assert.equal(audited[0].sha256,stored.sha256);
const different=new Blob([Buffer.alloc(bytes.length,33)],{type:'text/plain'});Object.defineProperty(different,'name',{value:rawFilename});await assert.rejects(()=>r.runtime.auditSelections([different]),/does not match the current stored canonical bytes/,'STORED_BYTE_COMPARE_ORACLE');note('Release auditing compares selected File bytes with persisted Blob bytes and rejects a same-size byte mismatch');
async function inspect(project){const archive=await store.createExecutionPackage({project,stage:1,operation:prompt.operation,instructionId:prompt.instructionId}),members=readStoreArchive(new Uint8Array(await archive.blob.arrayBuffer())),manifest=JSON.parse(new TextDecoder().decode(members.find(member=>member.canonicalPath==='manifest.json').bytes)),identity=manifest.members.find(member=>member.artifactId===stored.artifactId);assert.ok(identity,'FILENAME_EXPORT_ORACLE');assert.equal(identity.rawFilename,rawFilename);assert.equal(identity.canonicalPath,`artifacts/${stored.artifactId}/résumé-中文.txt`);assert.deepEqual(Buffer.from(members.find(member=>member.canonicalPath===identity.canonicalPath).bytes),bytes);return archive;}
await inspect(p);note('The stage ZIP contains the manifest-bound NFC path, original filename, and exact file bytes');
p=(await store.restoreCheckpoint(p.job.JOB_ID,initial,{expectedProjectRevision:p.revision})).project;assert.equal((await store.listArtifacts(p.job.JOB_ID)).length,0);p=(await store.restoreCheckpoint(p.job.JOB_ID,checkpoint,{expectedProjectRevision:p.revision})).project;
assert.equal(p.projectData.artifacts[0].rawFilename,rawFilename);assert.equal(p.projectData.artifacts[0].canonicalPath,'résumé-中文.txt');assert.deepEqual(Buffer.from(await (await store.getArtifact(stored.artifactId)).blob.arrayBuffer()),bytes);note('Whole-version reversal and forward restoration retain original filename, canonical identity, and exact bytes');
// Saved prompts are activation-bound: restoration requires a current handoff.
await assert.rejects(()=>inspect(p),error=>error.code==='EXECUTION_PACKAGE_VERSION_STALE');const restoredDraft=copy(p);let newPrompt=prompts.reserveAndBuildPromptRecord(restoredDraft,1,{},{}).prompt;p=await store.writeProject(restoredDraft,{expectedProjectRevision:p.revision});({project:p,prompt:newPrompt}=await authorizeSyntheticHandoff(r,{project:p,prompt:newPrompt}));const currentPackage=await store.createExecutionPackage({project:p,stage:1,operation:newPrompt.operation,instructionId:newPrompt.instructionId});assert.ok(readStoreArchive(new Uint8Array(await currentPackage.blob.arrayBuffer())).some(member=>member.canonicalPath===`artifacts/${stored.artifactId}/résumé-中文.txt`));note('Restoration rejects stale handoffs and regenerates a Unicode-safe package for the active version');
const fresh=projectStoreRuntime(),imported=await fresh.store.importPackage(backup);assert.equal(imported.projectData.artifacts[0].rawFilename,rawFilename);assert.equal(imported.projectData.artifacts[0].canonicalPath,'résumé-中文.txt');assert.deepEqual(Buffer.from(await (await fresh.store.getArtifact(stored.artifactId)).blob.arrayBuffer()),bytes);note('Backup restoration from exported bytes preserves Unicode identities, complete History and exact file bytes');
const earlier=copy(p),independent=copy(p);independent.job.JOB_TITLE='Independent current revision';p=await store.writeProject(independent,{expectedProjectRevision:p.revision});await assert.rejects(()=>store.createExecutionPackage({project:earlier,stage:1,operation:newPrompt.operation,instructionId:newPrompt.instructionId}),error=>error.code==='EXECUTION_PACKAGE_VERSION_STALE','HANDOFF_ACTIVE_VERSION_ORACLE');note('A cached project cannot export a handoff after an independent revision changes its authoritative stored version');
const latest=copy(p);let latestPrompt=prompts.reserveAndBuildPromptRecord(latest,1,{},{}).prompt;p=await store.writeProject(latest,{expectedProjectRevision:p.revision});
({project:p,prompt:latestPrompt}=await authorizeSyntheticHandoff(r,{project:p,prompt:latestPrompt}));
const open=r.runtime.openStorageTransaction;let concurrent=true,interleaved=false;r.runtime.openStorageTransaction=async(names,mode)=>{if(concurrent&&mode==='readonly'&&(Array.isArray(names)?names:[names]).includes('artifacts')){concurrent=false;const edit=copy(p);edit.job.JOB_TITLE='Changed during file assembly';await store.writeProject(edit,{expectedProjectRevision:p.revision});interleaved=true;}return open(names,mode);};
await assert.rejects(()=>store.createExecutionPackage({project:p,stage:1,operation:latestPrompt.operation,instructionId:latestPrompt.instructionId}),error=>error.code==='EXECUTION_PACKAGE_VERSION_STALE','HANDOFF_ASSEMBLY_RACE_ORACLE');assert.equal(interleaved,true);r.runtime.openStorageTransaction=open;note('A change committed while file bytes are being assembled prevents release of the stale handoff');
p=await store.readProject(p.job.JOB_ID);r.rows.get('projects').get(p.job.JOB_ID).project.job.JOB_TITLE='Corrupted after tab cached the project';await assert.rejects(()=>store.createExecutionPackage({project:p,stage:1,operation:latestPrompt.operation,instructionId:latestPrompt.instructionId}),error=>error.code==='PROJECT_HASH_MISMATCH','QUARANTINED_HANDOFF_ORACLE');assert.equal((await store.listQuarantinedProjects()).length,1);note('A cached project cannot supply agent-facing context after its authoritative stored data becomes corrupt');
// A package's later staleness reads compare its own cold read's stored sources
// with a fresh read; stored bytes corrupted after that cold read, while the
// package is assembled, take the cold read, which refuses them and preserves
// them in quarantine.
{const r2=projectStoreRuntime({sourceOverrides}),open2=r2.runtime.openStorageTransaction;let q=r2.core.createBlankState('ASSEMBLY-CORRUPTION');q.job.EXACT_USER_OBJECTIVE_VERBATIM='Use the supplied text.';r2.engine.ensureShape(q);r2.engine.recalculate(q);q=await r2.store.writeProject(q,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
 const draft=r2.copy(q);let qPrompt=r2.prompts.reserveAndBuildPromptRecord(draft,1,{},{}).prompt;q=await r2.store.writeProject(draft,{expectedProjectRevision:q.revision});({project:q,prompt:qPrompt}=await authorizeSyntheticHandoff(r2,{project:q,prompt:qPrompt}));
 const request={project:q,stage:1,operation:qPrompt.operation,instructionId:qPrompt.instructionId};assert.ok((await r2.store.createExecutionPackage(request)).blob,'HANDOFF_ASSEMBLY_CORRUPTION_FIXTURE_ORACLE');
 let corrupted=false,projectReads=0;r2.runtime.openStorageTransaction=async(names,mode)=>{if(!corrupted&&mode==='readonly'&&(Array.isArray(names)?names:[names]).includes('projects')&&++projectReads===2){corrupted=true;r2.rows.get('projects').get(q.job.JOB_ID).project.job.JOB_TITLE='Corrupted while its handoff was assembled';}return open2(names,mode);};
 try{await assert.rejects(()=>r2.store.createExecutionPackage(request),error=>error.code==='PROJECT_HASH_MISMATCH','HANDOFF_ASSEMBLY_CORRUPTION_ORACLE');}finally{r2.runtime.openStorageTransaction=open2;}
 assert.equal(corrupted,true,'HANDOFF_ASSEMBLY_CORRUPTION_FIXTURE_ORACLE');assert.equal((await r2.store.listQuarantinedProjects()).length,1,'HANDOFF_ASSEMBLY_CORRUPTION_ORACLE: the corrupted row is preserved in quarantine');}
note('Stored project bytes corrupted while a handoff is assembled are refused and preserved in quarantine');
// Each block below builds its own isolated store and authorized handoff, then
// acts at the n-th read-only projects transaction of one package build: the
// first is the package's cold read, the second its first staleness read.
// storeSource null is the store under test; a string is an intended fault.
async function assemblyFixture(storeSource,title,{journal=false,artifact=false}={}){
 const f={r3:projectStoreRuntime({sourceOverrides:storeSource===null?sourceOverrides:{...sourceOverrides,'project-store.js':storeSource}}),identity:null},{r3}=f;let q=r3.core.createBlankState(title);q.job.EXACT_USER_OBJECTIVE_VERBATIM='Use the supplied text.';r3.engine.ensureShape(q);r3.engine.recalculate(q);q=await r3.store.writeProject(q,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
 if(artifact){const name='assembly.txt',body=Buffer.from('Exact assembly bytes\n'),saved=await r3.store.putArtifact({artifactId:artifactFixtureId(r3.engine,q,'ASSEMBLY-ARTIFACT'),jobId:q.job.JOB_ID,filename:name,blob:new Blob([body],{type:'text/plain'})}),next=r3.copy(q);r3.engine.registerArtifactBytes(next,r3.copy({stage:1,artifactId:saved.artifactId,filename:name,mediaType:'text/plain',byteSize:body.length,sha256:saved.sha256}));next.stages[1].authorizedFiles.push(r3.copy({artifactId:saved.artifactId,name,sha256:saved.sha256,size:body.length}));q=await r3.store.writeProject(next,{expectedProjectRevision:q.revision});f.identity={jobId:q.job.JOB_ID,artifactId:saved.artifactId,filename:name,byteSize:body.length,sha256:saved.sha256};}
 const draft=r3.copy(q);let qPrompt=r3.prompts.reserveAndBuildPromptRecord(draft,1,{},{}).prompt;q=await r3.store.writeProject(draft,{expectedProjectRevision:q.revision});({project:q,prompt:qPrompt}=await authorizeSyntheticHandoff(r3,{project:q,prompt:qPrompt}));
 if(journal){const changed=r3.copy(q);r3.engine.addHistory(changed,'SYNTHETIC_PRIOR_OBSERVATION',{synthetic:true});q=await r3.store.writeProject(changed,{operational:true,expectedProjectRevision:q.revision,expectedStateSha256:q.projectSha256});assert.ok(r3.rows.get('meta').get('responseOperations:'+q.job.JOB_ID),'HANDOFF_ASSEMBLY_FIXTURE_ORACLE: operational journal present');}
 f.q=q;f.request={project:q,stage:1,operation:qPrompt.operation,instructionId:qPrompt.instructionId};assert.ok((await r3.store.createExecutionPackage(f.request)).blob,'HANDOFF_ASSEMBLY_FIXTURE_ORACLE');return f;
}
async function assemble(f,{at,act,review=false}){
 const open3=f.r3.runtime.openStorageTransaction;let reads=0,acted=false,outcome;
 f.r3.runtime.openStorageTransaction=async(names,mode)=>{if(!acted&&mode==='readonly'&&(Array.isArray(names)?names:[names]).includes('projects')&&++reads===at){acted=true;await act();}return open3(names,mode);};
 try{const result=review?await f.r3.store.prepareExecutionPackageReview(f.request):await f.r3.store.createExecutionPackage(f.request);outcome={released:true,allowed:result?.authorization?.allowed??null};}catch(error){outcome={released:false,code:error.code};}finally{f.r3.runtime.openStorageTransaction=open3;}
 assert.equal(acted,true,'HANDOFF_ASSEMBLY_FIXTURE_ORACLE: interleaving point reached');return {...outcome,quarantined:(await f.r3.store.listQuarantinedProjects()).length};
}
// A package's first cold read hashes its row across awaits through replaceable
// natives. A one-shot, self-restoring swap of the realm's Array.prototype.join
// or of TextEncoder.prototype.encode during that read makes a stored row,
// corrupted outside its projection receipt, pass once; the staleness read
// before the review or package leaves recomputes the digest and refuses it.
async function firstReadSwap(storeSource,swapKind,review,{duringYield=false}={}){
 if(duringYield){
  const base=storeSource||sourceOverrides['project-store.js']||fs.readFileSync('project-store.js','utf8');
  const slice='if(units>=1024*1024){',resumed='        await new Promise(resolve=>setTimeout(resolve,0));';
  assert.equal(base.split(slice).length,2);assert.equal(base.split(resumed).length,2);
  storeSource=base.replace(slice,'if(globalThis.__packageDigestSwap||units>=1024*1024){').replace(resumed,resumed+'globalThis.__packageDigestSwap?.();');
 }
 const f=await assemblyFixture(storeSource,'ASSEMBLY-FIRST-READ-SWAP'),row=f.r3.rows.get('projects').get(f.q.job.JOB_ID);assert.ok(row?.project,'HANDOFF_ASSEMBLY_FIXTURE_ORACLE: inline project row');
 const stored=row.projectSha256,originalView=row.project.activeView,corruptView='Corrupted outside the projection receipt';row.project.activeView=corruptView;
 const h=f.r3.runtime.closedLoopHash,canonical=f.r3.copy(row.project);delete canonical.projectSha256;const corrupted=await h.sha256Chunks(h.canonicalChunks(canonical));assert.notEqual(corrupted,stored,'HANDOFF_ASSEMBLY_FIXTURE_ORACLE: corruption changes the digest');
 const arrays=f.r3.runtime.Array.prototype,join=arrays.join,encoders=TextEncoder.prototype,encode=encoders.encode,marker=JSON.stringify(corruptView);let fired=0,outcome;
 const swappedJoin=function(...args){const out=Reflect.apply(join,this,args);if(out===corrupted){arrays.join=join;fired++;return stored;}return out;};
 const swappedEncode=function(input){const text=String(input);if(text.includes(marker)){encoders.encode=encode;fired++;return Reflect.apply(encode,this,[text.replace(marker,JSON.stringify(originalView))]);}return Reflect.apply(encode,this,[input]);};
 try{outcome=await assemble(f,{at:1,review,act:async()=>{const install=()=>{if(swapKind==='encoder')encoders.encode=swappedEncode;else arrays.join=swappedJoin;};
 if(duringYield)f.r3.runtime.__packageDigestSwap=()=>{delete f.r3.runtime.__packageDigestSwap;install();};else install();}});}finally{arrays.join=join;encoders.encode=encode;}
 assert.equal(fired,1,'HANDOFF_ASSEMBLY_FIXTURE_ORACLE: the swap fired exactly once');return outcome;
}
// A concurrent operational write changes only the journal; a tampered journal
// changes only its stored value. Both must reach the cold read's refusal.
async function journalAssembly(storeSource,kind){
 const f=await assemblyFixture(storeSource,'ASSEMBLY-JOURNAL',{journal:true}),key='responseOperations:'+f.q.job.JOB_ID;
 return assemble(f,{at:2,act:async()=>{if(kind==='concurrent'){const changed=f.r3.copy(f.q);f.r3.engine.addHistory(changed,'SYNTHETIC_CONCURRENT_OBSERVATION',{synthetic:true});await f.r3.store.writeProject(changed,{operational:true,expectedProjectRevision:f.q.revision,expectedStateSha256:f.q.projectSha256});}else{const stored=f.r3.rows.get('meta').get(key);stored.value=JSON.parse(JSON.stringify(stored.value).replace('SYNTHETIC_PRIOR_OBSERVATION','SYNTHETIC_TAMPERED_OBSERVATION'));}}});
}
// Current-scope artifact bytes corrupted while the handoff is assembled: each
// staleness read observes custody again, as a cold read does, so custody is
// no longer TRUE for those bytes after the build.
async function custodyAssembly(storeSource){
 const f=await assemblyFixture(storeSource,'ASSEMBLY-CUSTODY',{artifact:true});assert.equal(f.r3.store.artifactCustodyState(f.identity),'TRUE','HANDOFF_ASSEMBLY_FIXTURE_ORACLE: custody before assembly');
 const outcome=await assemble(f,{at:2,act:async()=>{storedArtifactBody(f.r3,f.identity.artifactId).blob=new Blob([Buffer.alloc(f.identity.byteSize,33)]);}});return {...outcome,custody:f.r3.store.artifactCustodyState(f.identity)};
}
// A package digest may yield while holding a detached source. A change to
// the live row just before its verification must take the normal cold path.
async function liveDigestRowChange(source){
 const anchor='    if(digestScope&&computed!==null){';
 const observe='    globalThis.__changeDigestRow?.(row);';
 assert.equal(source.split(anchor).length,2);
 const f=await assemblyFixture(source.replace(anchor,observe+'\n'+anchor),'ASSEMBLY-DIGEST-LIVE-ROW');
 return assemble(f,{at:1,act:async()=>{f.r3.runtime.__changeDigestRow=row=>{delete f.r3.runtime.__changeDigestRow;row.project.activeView='Changed on digest resume';};}});
}
async function privateDigestRowChange(source){
 const anchor='    const digest=hash.createSha256(),chunks=hash.canonicalChunks(canonicalProject(privateRow.project));';
 assert.equal(source.split(anchor).length,2);
 const f=await assemblyFixture(source.replace(anchor,'    globalThis.__changeDigestPrivate?.(privateRow);\n'+anchor),'ASSEMBLY-DIGEST-PRIVATE-ROW');let changed=null;
 const outcome=await assemble(f,{at:1,act:async()=>{f.r3.runtime.__changeDigestPrivate=row=>{delete f.r3.runtime.__changeDigestPrivate;changed=Reflect.set(row.project,'activeView','Changed private digest preimage');};}});
 assert.deepEqual([outcome.released,changed],[true,false],'HANDOFF_ASSEMBLY_PRIVATE_DIGEST_SOURCE_ORACLE');
}
async function swappedPackageSource(storeSource){
 const probe='    globalThis.__substitutePackageRow?.(source,sources.row);';
 const boundary='    // An IndexedDB read spanned awaits.';
 assert.equal(storeSource.split(boundary).length,2);
 const f=await assemblyFixture(storeSource.replace(boundary,probe+'\n'+boundary),'ASSEMBLY-SWAPPED-ROW');
 return assemble(f,{at:2,act:async()=>{
  f.r3.rows.get('projects').get(f.q.job.JOB_ID).project.activeView='Substituted after the guarded digest';
  f.r3.runtime.__substitutePackageRow=(source,row)=>{delete f.r3.runtime.__substitutePackageRow;source.row=row;};
 }});
}
const digestBindingSource=fs.readFileSync('project-store.js','utf8');
// Exercise an ordinary public read after a real, authorized package. Count
// whole-row digests independently of the returned project and its validation.
{
 const cold='if(computed===null)computed=await hash.sha256Chunks(hash.canonicalChunks(canonicalProject(row.project)));';
 assert.equal(digestBindingSource.split(cold).length,2);
 const match='    const nodes=ordinaryPackageRowNodes(row);';assert.equal(digestBindingSource.split(match).length,2);
 const observed=digestBindingSource.replace(match,"    if(globalThis.__failPackageComparison){delete globalThis.__failPackageComparison;throw new Error('Synthetic comparison fault');}\n"+match).replace(cold,"if(computed===null){globalThis.__publicBaseCold=(globalThis.__publicBaseCold||0)+1;computed=await hash.sha256Chunks(hash.canonicalChunks(canonicalProject(row.project)));}");
 for(const scenario of ['unchanged','tamper','other-tab','validator-swap','comparison-throws','journal','migration']){
  const f=await assemblyFixture(observed,'PUBLIC-PACKAGE-BASE-'+scenario,{journal:scenario==='journal'}),r=f.r3,id=f.q.job.JOB_ID;
  r.runtime.__publicBaseCold=0;
  if(scenario==='unchanged'){
   const first=await r.store.readProject(id);assert.equal(r.runtime.__publicBaseCold,0,'PACKAGE_BASE_DIGEST_REUSED_ONCE');first.job.JOB_TITLE+=' caller edit';
   const again=await r.store.readProject(id);assert.equal(r.runtime.__publicBaseCold,1);assert.notEqual(again.job.JOB_TITLE,first.job.JOB_TITLE);assert.equal(again.projectSha256,r.store.projectSha256(again));
  }else if(scenario==='tamper'){
   r.rows.get('projects').get(id).project.activeView='Corrupted with the same stored digest';
   await assert.rejects(()=>r.store.readProject(id),e=>e.code==='PROJECT_HASH_MISMATCH'&&e.message==='Project hash mismatch. The original row was preserved in quarantine.');assert.equal((await r.store.listQuarantinedProjects()).length,1);
  }else if(scenario==='other-tab'){
   const tab=projectStoreRuntime();tab.rows.get=name=>r.rows.get(name);tab.rows.set=(name,value)=>r.rows.set(name,value);
   const next=await tab.store.readProject(id);next.job.JOB_TITLE='Written by the other tab';const saved=await tab.store.writeProject(next,{expectedProjectRevision:next.revision,expectedStateSha256:next.projectSha256});
   const current=await r.store.readProject(id);assert.equal(r.runtime.__publicBaseCold,1);assert.equal(current.job.JOB_TITLE,next.job.JOB_TITLE);assert.equal(current.projectSha256,saved.projectSha256);
  }else if(scenario==='validator-swap'){
   const original=r.runtime.closedLoopWorkflowEngine;r.runtime.closedLoopWorkflowEngine=Object.freeze({...original});
   try{const current=await r.store.readProject(id);assert.equal(current.projectSha256,f.q.projectSha256);assert.equal(r.runtime.__publicBaseCold,1,'PACKAGE_BASE_REPLACED_VALIDATOR_COLD');}finally{r.runtime.closedLoopWorkflowEngine=original;}
  }else if(scenario==='comparison-throws'){
   r.runtime.__failPackageComparison=true;const current=await r.store.readProject(id);
   assert.equal(current.projectSha256,f.q.projectSha256);assert.equal(r.runtime.__publicBaseCold,1);assert.equal((await r.store.listQuarantinedProjects()).length,0,'PACKAGE_BASE_COMPARISON_COLD_FALLBACK');
  }else if(scenario==='journal'){
   r.rows.get('meta').get('responseOperations:'+id).value.sha256='0'.repeat(64);
   await assert.rejects(()=>r.store.readProject(id),e=>e.code==='OPERATIONAL_STATE_INTEGRITY_FAILED'&&e.message==='Saved response operations failed integrity verification. Their exact state was preserved in quarantine.');assert.equal(r.runtime.__publicBaseCold,1);assert.equal((await r.store.listQuarantinedProjects()).length,1);
  }else{
   const tab=projectStoreRuntime(),legacy=tab.core.createBlankState(id);tab.engine.ensureShape(legacy);
   const fields=['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'];for(const key of fields)legacy.job[key]='';tab.engine.recalculate(legacy);
   const saved=await tab.store.writeProject(legacy,{expectedProjectRevision:0,createOnly:true});
   for(const [name,rows] of tab.rows)r.rows.set(name,rows);
   const migrated=await r.store.readProject(id);assert.equal(migrated.revision,saved.revision+1);assert.ok(migrated.projectData.migrationArchives.some(item=>item.kind==='LEGACY_UNACCEPTED_AGENT_JOB_DEFAULTS'));assert.ok(fields.every(key=>!Object.hasOwn(migrated.job,key)));assert.ok(r.runtime.__publicBaseCold>0);
  }
 }
}

const liveChanged=await liveDigestRowChange(digestBindingSource);
assert.deepEqual(liveChanged,{released:false,code:'STALE_PROJECT_REVISION',quarantined:0},'HANDOFF_ASSEMBLY_LIVE_DIGEST_SOURCE_ORACLE');
await privateDigestRowChange(digestBindingSource);
assert.deepEqual(await swappedPackageSource(digestBindingSource),{released:false,code:'PROJECT_HASH_MISMATCH',quarantined:1},'HANDOFF_ASSEMBLY_DIGEST_CARRIER_ORACLE');
const swapRefused={released:false,code:'PROJECT_HASH_MISMATCH',quarantined:1};
for(const swapKind of ['join','encoder'])for(const review of [false,true])assert.deepEqual(await firstReadSwap(null,swapKind,review),swapRefused,`HANDOFF_ASSEMBLY_FIRST_READ_SWAP_ORACLE: ${swapKind} ${review?'review':'package'}`);
assert.deepEqual(await firstReadSwap(null,'join',true,{duringYield:true}),swapRefused,'HANDOFF_ASSEMBLY_RESUMED_DIGEST_ORACLE');
note('A corrupted stored row that one transient hash or encoder swap passes during the package cold read is still refused and preserved in quarantine before any review or package is returned');
assert.deepEqual(await journalAssembly(null,'concurrent'),{released:false,code:'EXECUTION_PACKAGE_VERSION_STALE',quarantined:0},'HANDOFF_ASSEMBLY_JOURNAL_RACE_ORACLE');
assert.deepEqual(await journalAssembly(null,'tampered'),{released:false,code:'OPERATIONAL_STATE_INTEGRITY_FAILED',quarantined:1},'HANDOFF_ASSEMBLY_JOURNAL_CORRUPTION_ORACLE');
note('A journal-only concurrent write or tampered journal during assembly is refused with its stale or integrity code');
assert.equal((await custodyAssembly(null)).custody,'UNKNOWN','HANDOFF_ASSEMBLY_CUSTODY_REOBSERVED_ORACLE');
note('Artifact bytes corrupted during assembly lose custody at the staleness read, as at a cold read');
// Intended faults: each removes one part of the staleness read and must be detected.
const storeSource=fs.readFileSync('project-store.js','utf8'),storeFault=(name,before,after)=>{if(storeSource.split(before).length!==2)throw new Error('Fault anchor missing: '+name);return storeSource.replace(before,after);};
const rehash='    if(unchanged&&verifyBytes&&certificate?.digest!==sources.row.projectSha256){let computed=null;try{computed=await hash.sha256Chunks(hash.canonicalChunks(canonicalProject(sources.row.project)));}catch{computed=null;}unchanged=computed!==null&&computed===sources.row.projectSha256;}\n';
const assemblyFaults=[
 ['package-digest-unbound-row',storeFault('package-digest-unbound-row','    const certificate=packageBaseFor(source);','    const base=packageBaseFor(source),certificate=base&&{row:source.row,digest:base.digest};'),async source=>swappedPackageSource(source),swapRefused,'HANDOFF_ASSEMBLY_DIGEST_CARRIER_ORACLE'],
 ['package-resume-native-unchecked',storeFault('package-resume-native-unchecked','        if(!current())return null;\n',''),async source=>firstReadSwap(source,'join',true,{duringYield:true}),swapRefused,'HANDOFF_ASSEMBLY_RESUMED_DIGEST_ORACLE'],
 ['first-read-digest-trusted',storeFault('first-read-digest-trusted',rehash,''),async source=>firstReadSwap(source,'join',false),swapRefused,'HANDOFF_ASSEMBLY_FIRST_READ_SWAP_ORACLE'],
 ['package-digest-after-archive-only',storeFault('package-digest-after-archive-only','rereadPackageProject(canonicalJobId,packageSource,{verifyBytes:true})','rereadPackageProject(canonicalJobId,packageSource,{verifyBytes:false})').replace('rereadPackageProject(canonicalJobId,packageSource,{verifyBytes:false});if(!afterArchive','rereadPackageProject(canonicalJobId,packageSource,{verifyBytes:true});if(!afterArchive'),async source=>firstReadSwap(source,'join',true),swapRefused,'HANDOFF_ASSEMBLY_FIRST_READ_SWAP_ORACLE'],
 ['package-journal-uncompared',storeFault('package-journal-uncompared','&&verifiedValuesEqual(source.journal,sources.journal)',''),async source=>journalAssembly(source,'concurrent'),{released:false,code:'EXECUTION_PACKAGE_VERSION_STALE',quarantined:0},'HANDOFF_ASSEMBLY_JOURNAL_RACE_ORACLE'],
 ['package-custody-unobserved',storeFault('package-custody-unobserved','      forgetArtifactCustody(jobId);\n      for(const artifactId of source.artifactIds){try{await getArtifact(artifactId);}catch(error){if(!CUSTODY_UNAVAILABLE_CODES.includes(error.code))throw error;}}\n',''),async source=>({custody:(await custodyAssembly(source)).custody}),{custody:'UNKNOWN'},'HANDOFF_ASSEMBLY_CUSTODY_REOBSERVED_ORACLE']];
const faultsDetected=[];
for(const [name,source,run,expected,oracle] of assemblyFaults){let detected=false;try{assert.deepEqual(await run(source),expected,oracle);}catch(error){if(error?.code!=='ERR_ASSERTION'||!String(error.message).includes(oracle))throw error;detected=true;}assert.equal(detected,true,'HANDOFF_ASSEMBLY_INTENDED_FAULT_ORACLE: '+name+' escaped '+oracle);faultsDetected.push({fault:name,oracle,result:'DETECTED'});}
note('Intended faults removing the staleness read digest, its placement, journal comparison or custody observation are each detected');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Node production modules with lifecycle transaction adapter',artifactBytes:bytes.length,cases,faultsDetected},null,2));
