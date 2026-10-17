import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

export const HISTORY_STATIC_READ_FAULTS=Object.freeze({
 'history-static-trust-mutated-body':{id:'HISTORY_STATIC_TRUST_MUTATED_BODY',file:'project-store.js',before:'if(currentDefinition&&unchangedVerifiedProject(staticIntegrity,project,staticIntegrity?.digest)){',after:'if(currentDefinition){'},
 'history-static-retain-receipt':{id:'HISTORY_STATIC_RETAIN_RECEIPT',file:'project-store.js',before:'recoveryBodyStaticIntegrity.delete(project);',after:'void project;'},
 'history-static-skip-derived':{id:'HISTORY_STATIC_SKIP_DERIVED',file:'project-store.js',before:'const issues=derivedProjectIntegrityIssues(project);',after:'const issues=[];'},
 'history-static-trust-tolerated-legacy':{id:'HISTORY_STATIC_TRUST_TOLERATED_LEGACY',file:'project-store.js',before:'try{assertProjectIntegrity(project,{verifyDerived:false});recoveryBodyStaticIntegrity.set(project,verifiedProjectIntegrity(project,verifiedProjectSha256));}catch(error){if(!legacyJobPointerProjection(project,{verifyDerived:false}))throw error;}',after:'try{assertProjectIntegrity(project,{verifyDerived:false});}catch(error){if(!legacyJobPointerProjection(project,{verifyDerived:false}))throw error;}recoveryBodyStaticIntegrity.set(project,verifiedProjectIntegrity(project,verifiedProjectSha256));'}
});

// One isolated production-store owner: complete saved bytes, small actual view,
// shared project parts and artifacts. This is a transaction adapter, not native
// browser performance or delivery evidence.
export async function verifyHistoryStaticRead({sourceOverrides={},fault=null}={}){
 const names=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
 const frozen={...Object.fromEntries(names.map(name=>[name,fs.readFileSync(name,'utf8')])),...sourceOverrides};
 if(fault){assert.equal(fault.file,'project-store.js');assert.equal(frozen[fault.file].split(fault.before).length,2,'HISTORY_STATIC_FAULT_ANCHOR_ORACLE');frozen[fault.file]=frozen[fault.file].replace(fault.before,fault.after);}
 const anchor='globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS';
function instrument(source){
 assert.equal(source.split(anchor).length,2);
 return source.replace(anchor,`const historyOriginalValidate=validateProjectIntegrity,historyOriginalDerived=derivedProjectIntegrityIssues,historyOriginalHydrate=hydrateLegacyRunPromptContexts;
 globalThis.__historyMeasure={staticCalls:0,derivedCalls:0,sequence:[]};
 validateProjectIntegrity=function(project,options){globalThis.__historyMeasure.staticCalls++;return historyOriginalValidate(project,options);};
 derivedProjectIntegrityIssues=function(project,options){globalThis.__historyMeasure.derivedCalls++;globalThis.__historyMeasure.sequence.push('derived');return historyOriginalDerived(project,options);};
 hydrateLegacyRunPromptContexts=async function(project,artifacts){await historyOriginalHydrate(project,artifacts);globalThis.__historyMeasure.sequence.push('hydrated');if(globalThis.__historyAfterHydration)await globalThis.__historyAfterHydration(project,artifacts);};
 globalThis.__historyOwners={compatibility:assertRecoveryCompatibility,retained:readRetainedCheckpoint,readBody:readPackageJson,pack:compressPackage,digests:historyProjectDigests};
 `+anchor);
}
async function seed(source){
 const r=projectStoreRuntime({sourceOverrides:{...frozen,'project-store.js':instrument(source)},storageWorker:false});
 let p=await r.store.createProject({commandId:'SYNTHETIC-HISTORY-STATIC'});
 p.job.JOB_TITLE='Synthetic retained title '+'retained exact text '.repeat(400);
 r.engine.recalculate(p);p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});
 const blob=new Blob(['Retained synthetic file bytes'],{type:'text/plain'});
 await r.store.putArtifact({artifactId:'SYNTHETIC-HISTORY-FILE',jobId:p.job.JOB_ID,filename:'retained.txt',mediaType:blob.type,blob});
 const view=r.copy({activeStage:1,activeView:'Workflow',drafts:{'#draft':{value:'Exact retained draft'}},scrollX:'0',scrollY:'19'});
 await r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view});
 return {r,p,view,prefix:new Map([...r.rows].map(([family,rows])=>[family,new Map([...rows].map(([key,value])=>[key,r.copy(value)]))]))};
}
function spawn(source,prefix){const r=projectStoreRuntime({sourceOverrides:{...frozen,'project-store.js':instrument(source)},storageWorker:false});for(const[family,rows]of prefix)r.rows.set(family,new Map([...rows].map(([key,value])=>[key,r.copy(value)])));return r;}
const proposal=frozen['project-store.js'];
const fixture=await seed(proposal),jobId=fixture.p.job.JOB_ID;
const results=[];
for(const [phase,source]of [['current',proposal]]){
 const r=spawn(source,fixture.prefix),m=r.runtime.__historyMeasure,start=performance.now();
 const view=await r.store.readHistoryView(jobId);
 assert.deepEqual(view,r.copy(fixture.view),'HISTORY_STATIC_VIEW_RESTORATION_ORACLE');
 assert.equal(m.derivedCalls,1,'HISTORY_STATIC_DERIVED_AFTER_CUSTODY_ORACLE');assert.ok(m.sequence.indexOf('hydrated')>=0&&m.sequence.indexOf('hydrated')<m.sequence.indexOf('derived'),'HISTORY_CURRENT_DERIVED_AFTER_ARTIFACT_AWAIT_ORACLE');
 assert.equal(m.staticCalls,1,'HISTORY_SINGLE_BODY_STATIC_ORACLE');const owningOracle='PASS';
 results.push({phase,owningOracle,...m,durationMs:performance.now()-start});
}
for(const mode of ['repeat-public-cold','snapshot-corrupt','snapshot-descriptor','part-corrupt','artifact-corrupt','missing-artifact','changed-static-after-await','changed-derived-after-await','changed-definition-after-await','one-use']){
 const r=spawn(proposal,fixture.prefix),m=r.runtime.__historyMeasure,state=await r.store.historyList(jobId),active=state.entries.find(e=>e.id===state.activeId),root=state.entries.find(e=>e.id===(active.projectReference?.checkpointId||active.id)),meta=r.rows.get('meta'),historyKey='recovery:'+jobId;
 const before=r.copy([...r.rows].map(([family,rows])=>[family,[...rows]]));let error=null;
 if(mode==='snapshot-corrupt'){const row=meta.get(historyKey+':snapshot:'+active.id);row.value.blob=new Blob(['x'.repeat(row.value.byteSize)]);error='HISTORY_SNAPSHOT_INTEGRITY_FAILED';}
 if(mode==='snapshot-descriptor'){meta.get(historyKey+':snapshot:'+active.id).value.label='Changed descriptor';error='HISTORY_VERSION_MISMATCH';}
 if(mode==='part-corrupt'){assert.ok(root,'HISTORY_PART_FIXTURE_ORACLE');const part=root.projectParts.entries[0];const row=meta.get(historyKey+':bytes:'+part.sha256);row.value.blob=new Blob(['x'.repeat(row.value.blob.size)]);error='HISTORY_FILE_INTEGRITY_FAILED';}
 if(mode==='artifact-corrupt'||mode==='missing-artifact'){const file=[...meta].find(([key,row])=>key.startsWith(historyKey+':bytes:')&&row.value.blob.size===29);assert.ok(file,'HISTORY_ARTIFACT_FIXTURE_ORACLE');if(mode==='missing-artifact')meta.delete(file[0]);else file[1].value.blob=new Blob(['x'.repeat(29)]);error='HISTORY_FILE_INTEGRITY_FAILED';}
 if(mode.startsWith('changed-')){r.runtime.__historyAfterHydration=async project=>{delete r.runtime.__historyAfterHydration;if(mode==='changed-static-after-await')project.stageCount=29;if(mode==='changed-derived-after-await')project.stages[1].gate.complete=true;if(mode==='changed-definition-after-await')project.projectData.applicationProjection.receipt.derivationId='SYNTHETIC_UNKNOWN';};error='HISTORY_VERSION_INCOMPATIBLE';}
 const execute=()=>r.store.readHistoryView(jobId);
 if(error){await assert.rejects(execute,e=>e.code===error,'HISTORY_STATIC_REJECTION_ORACLE '+mode);if(mode.startsWith('changed-')){assert.ok(m.staticCalls>=2,'HISTORY_CHANGED_BODY_FULL_FALLBACK_ORACLE');assert.deepEqual(r.copy([...r.rows].map(([family,rows])=>[family,[...rows]])),before,'HISTORY_REJECTION_STORES_PRESERVED_ORACLE');}}
 else if(mode==='one-use'){const saved=await r.runtime.__historyOwners.retained(jobId,active.id);const after=m.staticCalls;r.runtime.__historyOwners.compatibility(saved.project);assert.equal(m.staticCalls,after+1,'HISTORY_RECEIPT_ONE_USE_ORACLE');}
 else{await execute();const once=m.staticCalls;await execute();assert.equal(m.staticCalls,once+1,'HISTORY_PUBLIC_READ_REVERIFIES_STATIC_ORACLE');assert.equal(m.derivedCalls,2,'HISTORY_PUBLIC_READ_REVERIFIES_DERIVED_ORACLE');}
 results.push({mode,result:'PASS',...m,error});
}
// Model an actual tolerated retained pointer projection, with self-consistent
// checkpoint bytes and digests. Its static validation fails before the normal
// compatibility repair; it must never acquire the private successful receipt.
for(const [phase,source]of [['current',proposal]]){
 const r=spawn(source,fixture.prefix),m=r.runtime.__historyMeasure,meta=r.rows.get('meta'),state=await r.store.historyList(jobId),active=state.entries.find(e=>e.id===state.activeId),key='recovery:'+jobId+':snapshot:'+active.id;
 const project=r.copy(fixture.p);delete project.projectSha256;
 project.projectData.artifactVersions.push(r.copy({versionId:'SYNTHETIC-RETAINED-SOURCE-VERSION',stage:2,kind:'SOURCE-SET',version:'SOURCE-SET-001',sha256:'a'.repeat(64),createdAt:new Date().toISOString(),payload:{}}));r.engine.recalculate(project);assert.equal(project.job.CURRENT_SOURCE_SET_VERSION,'SOURCE-SET-001');project.job.CURRENT_SOURCE_SET_VERSION=null;
 const {projectSha256,workSha256}=r.runtime.__historyOwners.digests(project),decoded=await r.runtime.__historyOwners.readBody(meta.get(key).value.blob,{spoolArtifacts:false}),body=decoded.payload;
 delete body.packageSha256;delete body.projectReference;delete body.projectParts;body.project=project;body.projectSha256=projectSha256;body.workSha256=workSha256;
 const packed=await r.runtime.__historyOwners.pack(body),blob=packed.blob,entry={...r.copy(active),blob,byteSize:blob.size,sha256:await r.runtime.closedLoopHash.sha256Bytes(blob),projectSha256,workSha256};delete entry.projectReference;delete entry.projectParts;
 meta.get(key).value=entry;const {blob:excluded,...descriptor}=entry;meta.get('recovery:'+jobId).value.entries=state.entries.map(e=>e.id===entry.id?descriptor:e);meta.get('recovery:'+jobId).value.activeProjectSha256=projectSha256;meta.get('recovery:'+jobId).value.compressedProjectBytes=meta.get('recovery:'+jobId).value.entries.reduce((sum,e)=>sum+e.byteSize,0);
 m.staticCalls=0;m.derivedCalls=0;assert.deepEqual(await r.store.readHistoryView(jobId),r.copy(fixture.view),'HISTORY_TOLERATED_LEGACY_VIEW_ORACLE');assert.ok(m.staticCalls>=4,'HISTORY_TOLERATED_STATIC_FAILURE_NO_PROOF_ORACLE');results.push({phase,mode:'tolerated-legacy-static-failure',result:'PASS',...m});
}
 const report={result:'PASS',boundary:'Actual store History decoder through isolated transaction adapter; no browser or startup latency claim',sourceSha256:Object.fromEntries(names.map(name=>[name,createHash('sha256').update(frozen[name]).digest('hex')])),implementationFault:fault?.id||null,caseCount:results.length,cases:results};
 return report;
}
