import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {stage04AcceptanceFixture} from './test-fixtures.mjs';

// Scaled reproduction of the retained-version capacity failure from the real
// all-stage browser journey. This is not a production-capacity browser claim.
const source=fs.readFileSync(process.env.HISTORY_SOURCE||'project-store.js','utf8');
const faultMode=process.argv.find(value=>value.startsWith('--fault='))?.slice(8);
const faults={
 'duplicate-canonical-content':{before:'const contents=projectReference?null:await encodeHistoryProject(canonical,retainValue);',after:'const contents={project:canonical};'},
 'repeat-import-shared-content':{before:'const project=body.project; // verifiedParts belongs to this read/import only.',after:'const project=body.project;verifiedParts=new Map(); // disposable repeat-decoding fault'},
 // The size contract has two enforcing consumers. Mutating either alone is
 // behaviorally masked by the other; the fault removes that one contract at
 // both sites, while the disposable input contains only one size violation.
 'skip-import-shared-size':{changes:[
  {before:'entry.projectReference||entry.projectParts.entries.some(part=>state.files[part.sha256]?.byteSize!==part.byteSize)',after:'entry.projectReference'},
  {before:'if(value.byteSize!==part.byteSize)',after:'if(false)'}
 ]}
};
const engineFaults={
 'retain-failed-adjudication':{before:'try{return action();}finally{completedStageAdjudications.delete(project);}',after:'const result=action();completedStageAdjudications.delete(project);return result;'},
 'repeat-completed-adjudication':{before:'if(evaluation?.records){',after:'if(false){'},
 'retain-completed-adjudication':{before:'finally{completedStageAdjudications.delete(project);}',after:'finally{/* disposable retained-result fault */}'},
 'repeat-input-scope':{before:'if(byStage?.has(stage))return byStage.get(stage);',after:'if(false)return byStage.get(stage);'},
 'retain-input-scope':{before:'finally{inputScopeEvaluation=null;}',after:'finally{if(!globalThis.__retainInputScopeFault)inputScopeEvaluation=null;}'}
};
if(faultMode&&!faults[faultMode]&&!engineFaults[faultMode])throw new Error('Unknown implementation fault: '+faultMode);
const capacity=2*1024*1024,changes=12;
const anchor='maxCompressedProjectBytes:512*1024*1024';
assert.equal(source.split(anchor).length-1,1);
const parseAnchor='const decoded=await readPackageJson(file.blob,{compressed:false,spoolArtifacts:false});';
const engineSource=fs.readFileSync(process.env.WORKFLOW_ENGINE_SOURCE||'workflow-engine.js','utf8');
const inputProbeAnchor='function inputPayloadAtStage(payload,stage){';
assert.equal(engineSource.split(inputProbeAnchor).length-1,1);
let observedEngineSource=engineSource.replace(inputProbeAnchor,inputProbeAnchor+'globalThis.__historyInputProjection?.(payload,Number(stage));');
if(engineFaults[faultMode]){const fault=engineFaults[faultMode];assert.equal(observedEngineSource.split(fault.before).length-1,1);observedEngineSource=observedEngineSource.replace(fault.before,fault.after);}
const adjudicationProbeAnchor='for(const collection of collections)copy.projectData[collection]=safe(project?.projectData?.[collection]).map(record=>clone(record));';
assert.equal(observedEngineSource.split(adjudicationProbeAnchor).length-1,1);
observedEngineSource=observedEngineSource.replace(adjudicationProbeAnchor,'globalThis.__historyAdjudication?.(project);'+adjudicationProbeAnchor);
const stageProbeAnchor='ensure(p);const b=e0.gate(stage,p),rr=';
assert.equal(observedEngineSource.split(stageProbeAnchor).length-1,1);
observedEngineSource=observedEngineSource.replace(stageProbeAnchor,'ensure(p);globalThis.__historyCompatibilityStage?.(stage,p);const b=e0.gate(stage,p),rr=');
const make=()=>{
 let implementation=source.replace(anchor,`maxCompressedProjectBytes:${capacity}`);
 if(faults[faultMode])for(const fault of faults[faultMode].changes||[faults[faultMode]]){assert.equal(implementation.split(fault.before).length-1,1);implementation=implementation.replace(fault.before,fault.after);}
 // Observe actual immutable-content decoding during an import, not a source
 // match or elapsed-time guess. No storage or return-value behavior changes.
 assert.equal(implementation.split(parseAnchor).length-1,1);
 implementation=implementation.replace(parseAnchor,"globalThis.__historyDecodedParts?.push({sha256:part.sha256,byteSize:part.byteSize});"+parseAnchor);
 return projectStoreRuntime({sourceOverrides:{'project-store.js':implementation,'workflow-engine.js':observedEngineSource}});
};
const r=make(),{store,core,engine,copy}=r;
const content=Array.from({length:1024},(_,i)=>createHash('sha256').update('CANONICAL-HISTORY-'+i).digest('hex')).join('\n');
let p=core.createBlankState('HISTORY-CANONICAL-SHARING');
p.job.EXACT_USER_OBJECTIVE_VERBATIM=content;engine.ensureShape(p);engine.recalculate(p);
p=await store.writeProject(p,{expectedProjectRevision:0});
await store.beginHistorySession('CANONICAL-SHARING-SESSION');
const start=(await store.historyList(p.job.JOB_ID)).activeId,versions=[{id:start,project:copy(p)}],cases=[];
for(let i=0;i<changes;i++){
 const next=copy(p);next.job.JOB_TITLE='Retained human correction '+i;
 engine.recordHumanInputVersion(next,['JOB_TITLE'],'SYNTHETIC_VERIFIER');engine.recalculate(next);
 try{p=await store.writeProject(next,{expectedProjectRevision:p.revision});}
 catch(error){console.error(JSON.stringify({caseId:'HISTORY-CANONICAL-PROGRESSION',result:'FAIL',sourceSha256:createHash('sha256').update(source).digest('hex'),completedChanges:i,expectedChanges:changes,errorCode:error.code,history:await store.historyList(p.job.JOB_ID)}));assert.fail('HISTORY_CANONICAL_CAPACITY_ORACLE: retained complete versions exhausted the bounded history budget before valid progression finished: '+error.code);}
 versions.push({id:(await store.historyList(p.job.JOB_ID)).activeId,project:copy(p)});
}
// Recovery's completed-stage checks must not multiply projection/hash work by
// the number of consumers reading the same immutable input during one gate.
// This fixed small fixture uses the preceding authoritative input-version builder.
const accepted=copy(stage04AcceptanceFixture({...r,schema:r.runtime.closedLoopWorkflowSchema},'HISTORY-INPUT-SCOPE'));
// These completed stages arise from the actual preceding acceptance controls.
// Recovery checks a fixed saved project; adjudicating that same project's whole
// result inventory again for every completed stage cannot improve its evidence.
const compatible=copy(accepted),beforeCompatibility=copy(compatible);
let adjudications=0;r.runtime.__historyAdjudication=()=>{adjudications++;};
assert.equal(engine.completedStageCompatibility(compatible),true);
console.error(JSON.stringify({caseId:'HISTORY-COMPLETED-ADJUDICATION-COST',adjudications,completedStages:Object.values(compatible.stages).filter(stage=>stage.status==='COMPLETE').length}));
assert.equal(adjudications,1,'HISTORY_ADJUDICATION_COST_ORACLE: a completed-version compatibility evaluation must adjudicate the same immutable result inventory once, not once per completed stage');
assert.deepEqual(compatible,beforeCompatibility,'Compatibility evaluation must preserve the accepted saved project.');
cases.push({caseId:'HISTORY-COMPLETED-ADJUDICATION-COST',result:'PASS',adjudications,acceptedProjectUnchanged:true});
// Same project object, IDs and revision: every separate check must start fresh,
// and failed evaluation must discard its partial adjudication before retry.
adjudications=0;assert.equal(engine.completedStageCompatibility(compatible),true);
assert.equal(adjudications,1,'HISTORY_ADJUDICATION_FRESH_ORACLE: a later compatibility evaluation must re-adjudicate the actual saved content');
compatible.projectData.stageConfirmations[0].confirmed=false;
adjudications=0;assert.equal(engine.completedStageCompatibility(compatible),false,'Changed saved acceptance cannot inherit compatibility from an earlier evaluation.');
assert.equal(adjudications,1,'HISTORY_ADJUDICATION_FRESH_ORACLE: unchanged IDs/revision are not an adjudication receipt');
cases.push({caseId:'HISTORY-COMPLETED-ADJUDICATION-FRESH',result:'PASS',changedAcceptedStateRejected:true});
compatible.projectData.stageConfirmations[0].confirmed=true;
r.runtime.__historyCompatibilityStage=stage=>{if(stage===2)throw new Error('INJECTED_HISTORY_ADJUDICATION_FAILURE');};
assert.throws(()=>engine.completedStageCompatibility(compatible),/INJECTED_HISTORY_ADJUDICATION_FAILURE/);
delete r.runtime.__historyCompatibilityStage;
adjudications=0;r.runtime.__historyAdjudication=()=>{adjudications++;};
assert.equal(engine.completedStageCompatibility(compatible),true);
assert.equal(adjudications,1,'HISTORY_ADJUDICATION_EXCEPTION_ORACLE: retry must recompute failed adjudication');
delete r.runtime.__historyAdjudication;
cases.push({caseId:'HISTORY-COMPLETED-ADJUDICATION-FAILED-EVALUATION',result:'PASS',freshSuccessfulRetry:true});
const scoped=copy(accepted),projectionCounts=new Map(),payloadIds=new WeakMap();let payloadSerial=0;
engine.recordHumanInputVersion(scoped,['JOB_TITLE'],'SYNTHETIC_VERIFIER');
r.runtime.__historyInputProjection=(payload,stage)=>{if(!payloadIds.has(payload))payloadIds.set(payload,++payloadSerial);const key=payloadIds.get(payload)+':'+stage;projectionCounts.set(key,(projectionCounts.get(key)||0)+1);};
engine.gate(scoped.activeStage,scoped);
const projectionCalls=[...projectionCounts.values()].reduce((sum,n)=>sum+n,0);
console.error(JSON.stringify({caseId:'HISTORY-INPUT-SCOPE-COST',projectionCalls,distinctProjections:projectionCounts.size,inputVersions:scoped.projectData.inputVersions.length}));
assert.ok(projectionCounts.size>0,'The gate must actually inspect recorded input payloads.');
assert.equal(projectionCalls,projectionCounts.size,'HISTORY_INPUT_SCOPE_COST_ORACLE: one synchronous gate must project each distinct immutable input/stage once, not once per scope consumer');
delete r.runtime.__historyInputProjection;
cases.push({caseId:'HISTORY-INPUT-SCOPE-COST',result:'PASS',projectionCalls,distinctProjections:projectionCounts.size});
// Same IDs/revision are deliberately retained here: cache validity cannot be
// inferred from declared metadata when a saved payload changed or was corrupted.
const freshProjections=[];
r.runtime.__historyInputProjection=(payload,stage)=>freshProjections.push({title:payload.JOB_TITLE,stage});
r.runtime.__retainInputScopeFault=faultMode==='retain-input-scope';
engine.gate(scoped.activeStage,scoped);
freshProjections.length=0;
const changedPayload=scoped.projectData.inputVersions.at(-1).payload;
changedPayload.JOB_TITLE='Changed retained input under unchanged declared version';
engine.gate(scoped.activeStage,scoped);
assert.ok(freshProjections.some(row=>row.title===changedPayload.JOB_TITLE),'HISTORY_INPUT_SCOPE_FRESH_ORACLE: a later validation must re-read changed payloads even when IDs, version and revision did not change');
delete r.runtime.__retainInputScopeFault;
cases.push({caseId:'HISTORY-INPUT-SCOPE-FRESH-EVALUATION',result:'PASS',recomputedProjections:freshProjections.length});
let projectionSteps=0;
r.runtime.__historyInputProjection=()=>{if(++projectionSteps===2)throw new Error('INJECTED_INPUT_PROJECTION_FAILURE');};
assert.throws(()=>engine.gate(scoped.activeStage,scoped),/INJECTED_INPUT_PROJECTION_FAILURE/);
freshProjections.length=0;
r.runtime.__historyInputProjection=(payload,stage)=>freshProjections.push({title:payload.JOB_TITLE,stage});
engine.gate(scoped.activeStage,scoped);
assert.equal(freshProjections.length,projectionCounts.size,'HISTORY_INPUT_SCOPE_EXCEPTION_ORACLE: a failed validation must discard all cached input projections before retry');
delete r.runtime.__historyInputProjection;
cases.push({caseId:'HISTORY-INPUT-SCOPE-FAILED-EVALUATION',result:'PASS',retryRecomputedAllProjections:true});
const history=await store.historyList(p.job.JOB_ID);
assert.ok(history.retainedFileBytes<=history.limits.maxRetainedFileBytes,'The distinct retained-content limit remains binding.');
cases.push({caseId:'HISTORY-CANONICAL-PROGRESSION',result:'PASS',changes,checkpoints:history.entries.length,compressedProjectBytes:history.compressedProjectBytes,retainedFileBytes:history.retainedFileBytes});
for(const point of versions){const restored=await store.restoreCheckpoint(p.job.JOB_ID,point.id,{expectedProjectRevision:p.revision});p=restored.project;assert.deepEqual(p.job,point.project.job);assert.deepEqual(p.projectData,point.project.projectData);}
cases.push({caseId:'HISTORY-CANONICAL-EXACT-RESTORATION',result:'PASS',versions:versions.length});
const backup=await store.exportPackage(p.job.JOB_ID),fresh=make();fresh.runtime.__historyDecodedParts=[];
let imported=await fresh.store.importPackage(backup);
const observations=Array.from(fresh.runtime.__historyDecodedParts),unique=new Map(observations.map(part=>[part.sha256,part])),decodedBytes=observations.reduce((n,part)=>n+part.byteSize,0),distinctBytes=[...unique.values()].reduce((n,part)=>n+part.byteSize,0);
console.error(JSON.stringify({caseId:'HISTORY-IMPORT-SHARED-CONTENT-COST',decodings:observations.length,distinctContents:unique.size,decodedBytes,distinctBytes,versions:versions.length}));
assert.equal(observations.length,unique.size,'HISTORY_IMPORT_SHARED_CONTENT_ORACLE: complete backup restoration must decode each distinct immutable content once per import, rather than multiply decoding by retained version count');
assert.equal(decodedBytes,distinctBytes);
cases.push({caseId:'HISTORY-IMPORT-SHARED-CONTENT-COST',result:'PASS',decodings:observations.length,distinctContents:unique.size,decodedBytes,distinctBytes});
delete fresh.runtime.__historyDecodedParts;
for(const point of versions){const restored=await fresh.store.restoreCheckpoint(p.job.JOB_ID,point.id,{expectedProjectRevision:imported.revision});imported=restored.project;assert.deepEqual(copy(imported.job),point.project.job);assert.deepEqual(copy(imported.projectData),point.project.projectData);}
cases.push({caseId:'HISTORY-CANONICAL-EXPORTED-BYTES',result:'PASS',versions:versions.length,backupBytes:backup.size});
// A repeated part is reusable only with the exact promised size. Re-sign the
// enclosing checkpoint and archive consistently, leaving one size conflict as
// the sole violation. The importer must reject before any durable mutation.
const archive=JSON.parse(gunzipSync(Buffer.from(await backup.arrayBuffer())).toString('utf8'));
const referencedRoots=new Set(archive.recovery.entries.map(entry=>entry.projectReference?.checkpointId).filter(Boolean)),seenParts=new Set();let changedEntry,changedPart;
for(const entry of archive.recovery.entries){
 if(!entry.projectReference&&!referencedRoots.has(entry.id))for(const part of entry.projectParts?.entries||[])if(seenParts.has(part.sha256)){changedEntry=entry;changedPart=part;break;}
 for(const part of entry.projectParts?.entries||[])seenParts.add(part.sha256);
}
assert.ok(changedEntry&&changedPart,'The negative control needs a later complete version sharing earlier verified content.');
const archivedSnapshot=archive.artifacts.find(file=>file.archiveKind==='RECOVERY_SNAPSHOT'&&file.checkpointId===changedEntry.id);
const snapshot=JSON.parse(gunzipSync(Buffer.from(archivedSnapshot.base64,'base64')).toString('utf8'));
const snapshotPart=snapshot.projectParts.entries.find(part=>JSON.stringify(part.path)===JSON.stringify(changedPart.path));
assert.equal(snapshotPart.sha256,changedPart.sha256);snapshotPart.byteSize++;changedPart.byteSize++;
const sign=value=>{delete value.packageSha256;value.packageSha256=r.runtime.closedLoopHash.sha256Value(copy(value));return gzipSync(Buffer.from(JSON.stringify(value)));};
const snapshotBytes=sign(snapshot),snapshotSha256=createHash('sha256').update(snapshotBytes).digest('hex');
changedEntry.byteSize=snapshotBytes.length;changedEntry.sha256=snapshotSha256;
archivedSnapshot.base64=snapshotBytes.toString('base64');archivedSnapshot.byteSize=snapshotBytes.length;archivedSnapshot.sha256=snapshotSha256;
const declaredSnapshot=archive.packageManifest.artifacts.find(file=>file.artifactId===archivedSnapshot.artifactId);
assert.ok(declaredSnapshot);declaredSnapshot.byteSize=snapshotBytes.length;declaredSnapshot.sha256=snapshotSha256;
archive.recovery.compressedProjectBytes=archive.recovery.entries.reduce((n,entry)=>n+entry.byteSize,0);
const invalidBackup=new Blob([sign(archive)],{type:'application/gzip'}),rejected=make();
const frozenRows=()=>new Map([...rejected.rows].map(([name,rows])=>[name,new Map([...rows].map(([key,row])=>[key,rejected.copy(row)]))]));
const beforeRejected=frozenRows();
await assert.rejects(()=>rejected.store.importPackage(invalidBackup),error=>['HISTORY_VERSION_MISMATCH','HISTORY_FILE_INTEGRITY_FAILED'].includes(error.code),'HISTORY_IMPORT_PART_SIZE_ORACLE: sharing cannot accept a conflicting retained-content size');
assert.deepEqual(frozenRows(),beforeRejected,'An invalid retained version cannot partially import project, history or files.');
const corrected=await rejected.store.importPackage(backup);assert.equal(corrected.job.JOB_ID,p.job.JOB_ID);
cases.push({caseId:'HISTORY-IMPORT-SHARED-SIZE-CONFLICT',result:'PASS',failedImportPreservesAllRows:true,correctedImport:'PASS'});

const state=await store.metaGet('recovery:'+p.job.JOB_ID),part=state.entries.flatMap(entry=>entry.projectParts?.entries||[]).find(part=>JSON.stringify(part.path)===JSON.stringify(['job','EXACT_USER_OBJECTIVE_VERBATIM']));
assert.ok(part,'The retained input must have exact-byte custody.');
const key='recovery:'+p.job.JOB_ID+':bytes:'+part.sha256,original=r.rows.get('meta').get(key),before=copy(await store.readProject(p.job.JOB_ID)),beforeHistory=copy(await store.historyList(p.job.JOB_ID));
for(const failure of ['missing','corrupt']){
 if(failure==='missing')r.rows.get('meta').delete(key);else {const altered=copy(original);const bytes=new Uint8Array(await original.value.blob.arrayBuffer());bytes[0]^=1;altered.value.blob=new Blob([bytes]);r.rows.get('meta').set(key,altered);}
 await assert.rejects(()=>store.restoreCheckpoint(p.job.JOB_ID,start,{expectedProjectRevision:p.revision}),error=>error.code==='HISTORY_FILE_INTEGRITY_FAILED');
 await assert.rejects(()=>store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,view:copy({activeStage:1,activeView:'Workflow',drafts:{note:{value:'Unsaved view'}}})}),error=>error.code==='HISTORY_FILE_INTEGRITY_FAILED');
 assert.deepEqual(await store.readProject(p.job.JOB_ID),before);assert.deepEqual(await store.historyList(p.job.JOB_ID),beforeHistory);
 r.rows.get('meta').set(key,original);
 assert.equal((await store.readHistoryView(p.job.JOB_ID,start)).activeStage,1);
 cases.push({caseId:'HISTORY-CANONICAL-'+failure.toUpperCase()+'-CONTENT',result:'PASS',failedRestorationAndSavePreserveState:true,correctedBytesAllowRead:true});
}
r.runtime.__closedLoopStorageFault='during-history-write';
const next=copy(p);next.job.JOB_TITLE='Interrupted correction';engine.recordHumanInputVersion(next,['JOB_TITLE'],'SYNTHETIC_VERIFIER');engine.recalculate(next);
await assert.rejects(()=>store.writeProject(next,{expectedProjectRevision:p.revision}),error=>error.code==='INJECTED_STORAGE_FAILURE');
r.runtime.__closedLoopStorageFault=null;assert.deepEqual(await store.readProject(p.job.JOB_ID),before);assert.deepEqual(await store.historyList(p.job.JOB_ID),beforeHistory);
cases.push({caseId:'HISTORY-CANONICAL-ATOMIC-FAILURE',result:'PASS'});
console.log(JSON.stringify({synthetic:true,actualBrowser:false,productionByteCapacityTested:false,implementationFault:faultMode||null,sourceSha256:createHash('sha256').update(source).digest('hex'),disposableCapacity:capacity,cases},null,2));
