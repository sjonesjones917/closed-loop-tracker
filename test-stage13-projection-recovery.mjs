import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {projectStoreRuntime,restoreArtifactFixture,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';
import {canonicalFixtureRecord,deferredReviewedPrerequisiteFixture} from './test-fixtures.mjs';

// Reuse the retained, genuinely authored prefix; only the duplicate defect is
// explicit canonical fixture input. It is not a newly executed agent finding.
// The historical engine equivalent changes the single former group mapping.
export async function verifyStage13ProjectionRecovery(){
 const names=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'],sources=Object.fromEntries(names.map(name=>[name,fs.readFileSync(name,'utf8')]));
 const anchor='REPEATED_FAILURE_GROUPS:stability.repeatedFailureGroupCount';assert.equal(sources['workflow-engine.js'].split(anchor).length-1,1,'STAGE13_RECOVERY_OLD_OWNER_ANCHOR_ORACLE');
 const oldEngine=sources['workflow-engine.js'].replace(anchor,'REPEATED_FAILURE_GROUPS:stability.repeatedDefectCount'),r=projectStoreRuntime({sourceOverrides:{...sources,'workflow-engine.js':oldEngine}}),prefix=deferredReviewedPrerequisiteFixture(r,'nativeStage15');
 const clock=prefix.archivedFixtureClockUtc;assert.equal(typeof clock,'string','STAGE13_RECOVERY_ARCHIVED_CLOCK_ORACLE');
 r.runtime.Date=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return Date.parse(clock);}};
 let p=r.copy(prefix.project);await restoreArtifactFixture(r.store,prefix.artifacts);await hydrateRetainedPromptContexts(r,p,prefix.contextFiles||[]);
 const e=r.engine,h=r.runtime.closedLoopHash,s=r.runtime.closedLoopWorkflowSchema,original=p.projectData.defects[0];assert(original,'STAGE13_RECOVERY_ORIGINAL_DEFECT_ORACLE');
 const rawSha=h.sha256Value(p.projectData.rawResponses),acceptedSha=h.sha256Value(p.projectData.acceptedChanges),originalFields=r.copy(original.fields);delete originalFields.DEFECT_ID;
 canonicalFixtureRecord({engine:e,schema:s},p,'defects',originalFields,{stage:13,scope:r.copy(original.scope),relationships:r.copy(original.relationships||{})});
 e.recalculate(p);assert.equal(p.stages[13].derivedData.REPEATED_FAILURE_GROUPS,2,'STAGE13_RECOVERY_FORMER_COUNT_ORACLE');assert.equal(r.store.validateProjectIntegrity(p).valid,true,'STAGE13_RECOVERY_OLD_VALID_PROJECT_ORACLE');
 p=await r.store.writeProject(p,{expectedProjectRevision:0,createOnly:true,incrementRevision:false});
 const metricInputs=project=>h.sha256Value(r.copy(Object.fromEntries(['requirements','tests','runs','verification','defects','comparisons','iterations','candidateFreezes','freshContexts'].map(name=>[name,project.projectData[name]])))),inputSha=metricInputs(p);
 const jobId=p.job.JOB_ID,oldRow=r.copy(r.rows.get('projects').get(jobId)),oldHistory=await r.store.historyList(jobId),oldEntry=r.copy(oldHistory.entries.find(entry=>entry.id===oldHistory.activeId));assert(oldEntry,'STAGE13_RECOVERY_RETAINED_CHECKPOINT_ORACLE');
 vm.runInContext(sources['workflow-engine.js'],r.runtime,{filename:'workflow-engine.js:current-stage13-owner'});
 const currentEngine=r.runtime.closedLoopWorkflowEngine;
 const first=await r.store.readProject(jobId);assert.equal(first.projectSha256,p.projectSha256,'STAGE13_RECOVERY_READ_PRESERVES_ORIGINAL_ORACLE');assert.equal(first.stages[13].derivedData.REPEATED_FAILURE_GROUPS,2,'STAGE13_RECOVERY_READ_PRESERVES_ORIGINAL_ORACLE');
 const negatives=[];
 // These are disposable self-consistent saved-row counterexamples. The actual
 // recognition boundary must reject them. Canonical corruption is retained
 // by the existing quarantine owner; projection-only failures preserve the row.
 for(const [name,alter]of [
  ['wrong-numeric-old-count',q=>{q.stages[13].derivedData.REPEATED_FAILURE_GROUPS=3;}],
  ['string-old-count',q=>{q.stages[13].derivedData.REPEATED_FAILURE_GROUPS='2';}],
  ['array-old-count',q=>{q.stages[13].derivedData.REPEATED_FAILURE_GROUPS=[2];}],
  ['unrelated-derived-change',q=>{q.stages[13].derivedData.UNIQUE_FAILURES=999;}],
  ['canonical-record-corruption',q=>{q.projectData.defects[0].fields.OBSERVED_FAILURE='Unhashed canonical corruption';}]
 ]){
  const bad=r.copy(oldRow);alter(bad.project);bad.projectSha256=r.store.projectSha256(bad.project);r.rows.get('projects').set(jobId,bad);
  const before=h.sha256Value(r.rows.get('projects').get(jobId)),historyBefore=r.copy(await r.store.historyList(jobId));
  const canonicalCorruption=['string-old-count','array-old-count','canonical-record-corruption'].includes(name);
  await assert.rejects(()=>r.store.refreshProjectProjection(jobId,{expectedProjectRevision:bad.revision,expectedStateSha256:bad.projectSha256}),error=>error.code==='PROJECT_INTEGRITY_FAILED'&&(canonicalCorruption?/canonical integrity/.test(error.message):Array.isArray(error.issues)&&error.issues.length===1&&error.issues[0]==='Stage 13 derivedData does not match deterministic recalculation.'),'STAGE13_RECOVERY_NARROW_RECOGNITION_ORACLE: '+name);
  if(canonicalCorruption){const entry=(await r.store.listQuarantinedProjects()).filter(row=>row.jobId===jobId).at(-1);assert(entry?.completeSnapshot,'STAGE13_RECOVERY_CORRUPT_SNAPSHOT_PRESERVED_ORACLE');const preserved=await r.store.metaGet(entry.key);assert.equal(h.sha256Value(preserved.row),before,'STAGE13_RECOVERY_CORRUPT_SNAPSHOT_PRESERVED_ORACLE');assert.equal(r.rows.get('projects').has(jobId),false,'STAGE13_RECOVERY_CORRUPTION_NOT_CURRENT_ORACLE');}
  else assert.equal(h.sha256Value(r.rows.get('projects').get(jobId)),before,'STAGE13_RECOVERY_FAILED_ROW_PRESERVED_ORACLE: '+name);
  assert.deepEqual(r.copy(await r.store.historyList(jobId)),historyBefore,'STAGE13_RECOVERY_FAILED_HISTORY_PRESERVED_ORACLE: '+name);
  r.rows.get('projects').set(jobId,r.copy(oldRow));negatives.push(name);
 }
 const refreshed=await r.store.refreshProjectProjection(jobId,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 assert.equal(refreshed.stages[13].derivedData.REPEATED_FAILURE_GROUPS,1,'STAGE13_RECOVERY_CURRENT_GROUP_ORACLE');assert.equal(refreshed.revision,p.revision+1,'STAGE13_RECOVERY_NEW_NORMAL_REVISION_ORACLE');
 assert.equal(h.sha256Value(refreshed.projectData.rawResponses),rawSha,'STAGE13_RECOVERY_RAW_PRESERVED_ORACLE');assert.equal(h.sha256Value(refreshed.projectData.acceptedChanges),acceptedSha,'STAGE13_RECOVERY_ACCEPTED_HISTORY_PRESERVED_ORACLE');
 const reloaded=await r.store.readProject(jobId);assert.equal(reloaded.projectSha256,refreshed.projectSha256);assert.equal(r.store.validateProjectIntegrity(reloaded).valid,true,'STAGE13_RECOVERY_RELOAD_INTEGRITY_ORACLE');
 assert.deepEqual(r.copy((await r.store.historyList(jobId)).entries.find(entry=>entry.id===oldEntry.id)),oldEntry,'STAGE13_RECOVERY_OLD_CHECKPOINT_IDENTITY_ORACLE');
 const restored=await r.store.restoreCheckpoint(jobId,oldEntry.id,{expectedProjectRevision:refreshed.revision});
 // A History activation requires the preserved Stage7 definition to renew
 // its execution authority. It must not manufacture a completed Stage13.
 assert.equal(restored.project.stages[7].status,'BLOCKED','STAGE13_RECOVERY_HISTORY_AUTHORITY_ORACLE');assert(restored.project.stages[7].gate.reasons.some(reason=>reason.includes('History activation changed.')&&reason.includes('owning stage correction instruction')),'STAGE13_RECOVERY_HISTORY_AUTHORITY_ORACLE');
 assert.equal(restored.project.stages[13].status,'NOT STARTED','STAGE13_RECOVERY_HISTORY_DOWNSTREAM_ORACLE');assert.equal(Object.hasOwn(restored.project.stages[13].derivedData,'REPEATED_FAILURE_GROUPS'),false,'STAGE13_RECOVERY_HISTORY_DOWNSTREAM_ORACLE');
 assert.equal(metricInputs(restored.project),inputSha,'STAGE13_RECOVERY_CANONICAL_INPUTS_PRESERVED_ORACLE');assert.equal(r.store.validateProjectIntegrity(restored.project).valid,true,'STAGE13_RECOVERY_HISTORY_INTEGRITY_ORACLE');
 assert.equal(h.sha256Value(restored.project.projectData.rawResponses),rawSha);assert.equal(h.sha256Value(restored.project.projectData.acceptedChanges),acceptedSha);
 assert.deepEqual(r.copy((await r.store.historyList(jobId)).entries.find(entry=>entry.id===oldEntry.id)),oldEntry,'STAGE13_RECOVERY_HISTORY_SOURCE_PRESERVED_ORACLE');
 const counts=currentEngine.executionStability(restored.project,currentEngine.evaluateCrossRunComparison(restored.project).iterationId);assert.equal(counts.repeatedDefectCount,2);assert.equal(counts.repeatedFailureGroupCount,1);
 return {stage13ProjectionRecovery:'PASS',verificationObservations:[{checkId:'stage13.old-group-projection-recovery',boundary:'Actual old-owner-equivalent write/checkpoint -> current read/refresh/reload/History; isolated transaction adapter and preserved artifact/context bytes',expected:{oldGroups:2,currentGroups:1,repeatedOccurrences:2,rawAndAcceptedHistoryPreserved:true,oldCheckpointPreserved:true,newNormalRevision:true,historyAuthorityBlockedStage:7,historyStage13ProjectionCleared:true,restoredComputedGroups:1,canonicalMetricInputsPreserved:true,negativeCases:['wrong-numeric-old-count','string-old-count','array-old-count','unrelated-derived-change','canonical-record-corruption']},observed:{oldGroups:first.stages[13].derivedData.REPEATED_FAILURE_GROUPS,currentGroups:refreshed.stages[13].derivedData.REPEATED_FAILURE_GROUPS,repeatedOccurrences:counts.repeatedDefectCount,rawAndAcceptedHistoryPreserved:true,oldCheckpointPreserved:true,newNormalRevision:refreshed.revision===p.revision+1,historyAuthorityBlockedStage:restored.project.stages[7].status==='BLOCKED'?7:null,historyStage13ProjectionCleared:!Object.hasOwn(restored.project.stages[13].derivedData,'REPEATED_FAILURE_GROUPS'),restoredComputedGroups:counts.repeatedFailureGroupCount,canonicalMetricInputsPreserved:metricInputs(restored.project)===inputSha,negativeCases:negatives},passed:true,synthetic:true,actualBrowser:false,priorActorHistoryReplayed:false,duplicateDefectIsDeclaredFixtureInput:true}],sourceHashes:Object.fromEntries(Object.entries(sources).map(([name,text])=>[name,createHash('sha256').update(text).digest('hex')])),legacyOwnerSha256:createHash('sha256').update(oldEngine).digest('hex')};
}
