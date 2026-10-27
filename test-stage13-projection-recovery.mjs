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
 const oldEngine=sources['workflow-engine.js'].replace(anchor,'REPEATED_FAILURE_GROUPS:stability.repeatedDefectCount');
 const codecAnchor='globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS',codecProbe='globalThis.__stage13PhysicalFixture={read:readPhysicalStoredSource,encode:encodePhysicalRow,decode:decodePhysicalRow};\n';
 assert.equal(sources['project-store.js'].split(codecAnchor).length,2,'STAGE13_PHYSICAL_CODEC_UNIQUE_ANCHOR');assert.equal(sources['project-store.js'].includes('__stage13PhysicalFixture'),false);
 const observedStore=sources['project-store.js'].replace(codecAnchor,codecProbe+codecAnchor);assert.equal(observedStore.replace(codecProbe,''),sources['project-store.js'],'STAGE13_PHYSICAL_CODEC_EXACT_REVERSE');
 const r=projectStoreRuntime({sourceOverrides:{...sources,'workflow-engine.js':oldEngine,'project-store.js':observedStore}}),codec=r.runtime.__stage13PhysicalFixture;delete r.runtime.__stage13PhysicalFixture;assert.deepEqual(Object.keys(codec),['read','encode','decode']);assert.equal(Object.hasOwn(r.runtime,'__stage13PhysicalFixture'),false);
 let prefix=deferredReviewedPrerequisiteFixture(r,'nativeStage15');
 const clock=prefix.archivedFixtureClockUtc;assert.equal(typeof clock,'string','STAGE13_RECOVERY_ARCHIVED_CLOCK_ORACLE');
 r.runtime.Date=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return Date.parse(clock);}};
 let p=r.copy(prefix.project);await restoreArtifactFixture(r.store,prefix.artifacts);await hydrateRetainedPromptContexts(r,p,prefix.contextFiles||[]);
 // The complete artifact/context hydration finished; no later prefix consumer remains.
 prefix=null;
 const e=r.engine,h=r.runtime.closedLoopHash,s=r.runtime.closedLoopWorkflowSchema,original=p.projectData.defects[0];assert(original,'STAGE13_RECOVERY_ORIGINAL_DEFECT_ORACLE');
 const rawSha=h.sha256Value(p.projectData.rawResponses),acceptedSha=h.sha256Value(p.projectData.acceptedChanges),originalFields=r.copy(original.fields);delete originalFields.DEFECT_ID;
 canonicalFixtureRecord({engine:e,schema:s},p,'defects',originalFields,{stage:13,scope:r.copy(original.scope),relationships:r.copy(original.relationships||{})});
 e.recalculate(p);assert.equal(p.stages[13].derivedData.REPEATED_FAILURE_GROUPS,2,'STAGE13_RECOVERY_FORMER_COUNT_ORACLE');assert.equal(r.store.validateProjectIntegrity(p).valid,true,'STAGE13_RECOVERY_OLD_VALID_PROJECT_ORACLE');
 p=await r.store.writeProject(p,{expectedProjectRevision:0,createOnly:true,incrementRevision:false});
 const metricInputs=project=>h.sha256Value(r.copy(Object.fromEntries(['requirements','tests','runs','verification','defects','comparisons','iterations','candidateFreezes','freshContexts'].map(name=>[name,project.projectData[name]])))),inputSha=metricInputs(p);
 const jobId=p.job.JOB_ID,journalKey='responseOperations:'+jobId;
 // Test-only codec access is isolated above. No inline logical row is injected.
 // Keep exact detached original roots/parts for restoration between cases.
 const readPhysical=async(store,key,field)=>{const tx=await r.runtime.openStorageTransaction(['projects','meta'],'readonly');try{const value=await codec.read(tx,store,key,field);tx.commit();return value;}catch(error){tx.abort();throw error;}};
 const digest=value=>{const hash=createHash('sha256');if(value===undefined)return hash.update('ABSENT').digest('hex');hash.update('PRESENT:');for(const chunk of h.canonicalChunks(value))hash.update(chunk,'utf8');return hash.digest('hex');};
 const inventory=source=>({ownerStore:source.ownerStore,key:source.key,payloadField:source.payloadField,root:source.root,records:source.records.map(({key,row})=>({key,row})),packed:source.packed});
 let originalSource=await readPhysical('projects',jobId,'project');assert.equal(originalSource.packed,true,'STAGE13_AUTHENTIC_DEFAULT_PACKED_SOURCE');assert.equal(Object.hasOwn(originalSource.root,'project'),false);assert.equal(originalSource.records.length,originalSource.root.storageEncoding.partCount);
 const oldRow=originalSource.logical,oldPhysical=inventory({...originalSource,ownerStore:'projects',key:jobId,payloadField:'project'});originalSource=null;
 const oldJournal=inventory({...await readPhysical('meta',journalKey,'value'),ownerStore:'meta',key:journalKey,payloadField:'value'});
 const ledger=source=>({root:digest(source.root),parts:new Map(source.records.map(({key,row})=>[key,digest(row)]))}),oldPhysicalLedger=ledger(oldPhysical),oldJournalLedger=ledger(oldJournal);
 const assertInventory=(source,expected,label)=>{assert.equal(digest(source.root),expected.root,label+' ROOT');assert.deepEqual(Array.from(source.records.map(row=>row.key).sort()),[...expected.parts.keys()].sort(),label+' KEYS');for(const entry of source.records)assert.equal(digest(entry.row),expected.parts.get(entry.key),label+' PART');};
 const storedSource=source=>{const root=r.rows.get(source.ownerStore).get(source.key),generation=root?.storageEncoding?.generation;return {root,records:generation?[...r.rows.get('meta')].filter(([key])=>typeof key==='string'&&key.startsWith('recordPart:v1:'+generation+':')).map(([key,row])=>({key,row})):[]};};
 const assertStored=(source,expected,label)=>assertInventory(storedSource(source),expected,label);
 const assertUnshared=source=>{if(!source.packed)return;const generation=source.root.storageEncoding.generation;for(const [store,rows]of r.rows)for(const [key,row]of rows)if(!(store===source.ownerStore&&key===source.key))assert.notEqual(row?.storageEncoding?.generation,generation,'STAGE13_SOURCE_GENERATION_NOT_SHARED');};
 const restoreSource=source=>{const rows=r.rows.get(source.ownerStore);if(source.root===undefined)rows.delete(source.key);else rows.set(source.key,r.copy(source.root));for(const entry of source.records){const existing=r.rows.get('meta').get(entry.key);assert(existing===undefined||digest(existing)===digest(entry.row),'STAGE13_RESTORE_DOES_NOT_OVERWRITE_CHANGED_PART');r.rows.get('meta').set(entry.key,r.copy(entry.row));}};
 assert.equal(oldRow.projectSha256,p.projectSha256);assertStored(oldPhysical,oldPhysicalLedger,'STAGE13_ORIGINAL_PHYSICAL');assertStored(oldJournal,oldJournalLedger,'STAGE13_ORIGINAL_JOURNAL');
 {const encoded=codec.encode(oldRow,'projects','project');assert.equal(encoded.packed,true,'STAGE13_HEALTHY_DEFAULT_THRESHOLD');assert.equal(digest(codec.decode(encoded.root,'projects','project',encoded.parts)),digest(oldRow),'STAGE13_HEALTHY_PHYSICAL_ROUNDTRIP');}
 const oldHistory=await r.store.historyList(jobId),oldEntry=r.copy(oldHistory.entries.find(entry=>entry.id===oldHistory.activeId));assert(oldEntry,'STAGE13_RECOVERY_RETAINED_CHECKPOINT_ORACLE');
 vm.runInContext(sources['workflow-engine.js'],r.runtime,{filename:'workflow-engine.js:current-stage13-owner'});
 const currentEngine=r.runtime.closedLoopWorkflowEngine;
 let first=await r.store.readProject(jobId);assert.equal(first.projectSha256,p.projectSha256,'STAGE13_RECOVERY_READ_PRESERVES_ORIGINAL_ORACLE');assert.equal(first.stages[13].derivedData.REPEATED_FAILURE_GROUPS,2,'STAGE13_RECOVERY_READ_PRESERVES_ORIGINAL_ORACLE');
 // Later requests/reporting need only these already-checked scalar values.
 const originalRevision=p.revision,originalProjectSha256=p.projectSha256,originalGroups=first.stages[13].derivedData.REPEATED_FAILURE_GROUPS;p=null;first=null;
 const negatives=[],receiptTamperControls=[],projectionCounterexamples=[];
 // These are disposable self-consistent saved-row counterexamples. The actual
 // recognition boundary must reject them. Canonical corruption is retained
 // by the existing quarantine owner; projection-only failures preserve the row.
 for(const [name,alter,staleReceipt=false]of [
  ['wrong-numeric-old-count',q=>{q.stages[13].derivedData.REPEATED_FAILURE_GROUPS=3;}],
  ['string-old-count',q=>{q.stages[13].derivedData.REPEATED_FAILURE_GROUPS='2';}],
  ['array-old-count',q=>{q.stages[13].derivedData.REPEATED_FAILURE_GROUPS=r.copy([2]);}],
  ['unrelated-derived-change',q=>{q.stages[13].derivedData.UNIQUE_FAILURES=999;}],
  ['canonical-record-corruption',q=>{q.projectData.defects[0].fields.OBSERVED_FAILURE='Unhashed canonical corruption';}],
  ['wrong-numeric-old-count-stale-receipt',q=>{q.stages[13].derivedData.REPEATED_FAILURE_GROUPS=3;},true],
  ['unrelated-derived-change-stale-receipt',q=>{q.stages[13].derivedData.UNIQUE_FAILURES=999;},true]
 ]){
  let bad=r.copy(oldRow);alter(bad.project);
  if(['wrong-numeric-old-count','unrelated-derived-change'].includes(name)){
   // A declared saved-cache counterexample must bind its own stored output.
   // This fixture receipt is not a claim that the registered calculation
   // produced that deliberately wrong value. The refresh below must reject it.
   const retained=bad.project.projectData.applicationProjection,observedAt=retained.observedAt,observations=r.copy(retained.inputObservations),input=currentEngine.applicationProjectionInput(bad.project,observedAt,{observations:retained.inputObservations});
   retained.receipt=s.createApplicationDerivationReceipt({derivationKey:'project.currentProjection',canonicalInput:input,sourceRecordHashes:input.sourceBinding.records,output:currentEngine.applicationProjectionOutput(bad.project)});
   assert.equal(retained.observedAt,observedAt,'STAGE13_RECOVERY_FIXTURE_CLOCK_UNCHANGED_ORACLE');assert.deepEqual(r.copy(retained.inputObservations),observations,'STAGE13_RECOVERY_FIXTURE_OBSERVATIONS_UNCHANGED_ORACLE');
   assert.equal(metricInputs(bad.project),metricInputs(oldRow.project),'STAGE13_RECOVERY_FIXTURE_CANONICAL_INPUTS_UNCHANGED_ORACLE');
   assert.equal(h.sha256Value(bad.project.projectData.rawResponses),rawSha,'STAGE13_RECOVERY_FIXTURE_RAW_UNCHANGED_ORACLE');assert.equal(h.sha256Value(bad.project.projectData.acceptedChanges),acceptedSha,'STAGE13_RECOVERY_FIXTURE_ACCEPTED_UNCHANGED_ORACLE');
   const target=name==='wrong-numeric-old-count'?'REPEATED_FAILURE_GROUPS':'UNIQUE_FAILURES',nonTarget=project=>{const value=r.copy(project);delete value.stages[13].derivedData[target];delete value.projectData.applicationProjection.receipt;return h.sha256Value(value);};assert.equal(nonTarget(bad.project),nonTarget(oldRow.project),'STAGE13_RECOVERY_FIXTURE_NON_TARGET_UNCHANGED_ORACLE');
   assert.equal(r.store.validateProjectIntegrity(bad.project,{verifyDerived:false}).valid,true,'STAGE13_RECOVERY_SELF_CONSISTENT_COUNTEREXAMPLE_ORACLE: '+name);
  }
  if(staleReceipt){const checked=r.store.validateProjectIntegrity(bad.project,{verifyDerived:false});assert.equal(checked.valid,false,'STAGE13_RECOVERY_STALE_RECEIPT_FIXTURE_ORACLE');assert(checked.issues.some(issue=>issue.includes('STALE_DERIVATION_RECEIPT')&&issue.includes('outputSha256')),'STAGE13_RECOVERY_STALE_RECEIPT_FIXTURE_ORACLE');}
  bad.projectSha256=r.store.projectSha256(bad.project);
  assertStored(oldPhysical,oldPhysicalLedger,'STAGE13_CASE_START_EXACT_ORIGINAL');assertStored(oldJournal,oldJournalLedger,'STAGE13_CASE_START_EXACT_JOURNAL');assertUnshared(oldPhysical);assertUnshared(oldJournal);
  const corruptLogicalSha=digest(bad);let encoded=codec.encode(bad,'projects','project');assert.equal(encoded.packed,true,'STAGE13_CORRUPT_DEFAULT_THRESHOLD');assert.notEqual(encoded.root.storageEncoding.generation,oldPhysical.root.storageEncoding.generation);assert.equal(Object.hasOwn(encoded.root,'project'),false);
  assert.equal(digest(codec.decode(encoded.root,'projects','project',encoded.parts)),corruptLogicalSha,'STAGE13_LOGICAL_MUTATION_NOT_CODEC_DAMAGE');
  const badPhysical={ownerStore:'projects',key:jobId},badGeneration=encoded.root.storageEncoding.generation,badLedger=ledger({root:encoded.root,records:encoded.parts.map(row=>({key:row.key,row}))}),badKeys=[...badLedger.parts.keys()];
  for(const key of badKeys)assert.equal(r.rows.get('meta').has(key),false,'STAGE13_NEW_GENERATION_UNOCCUPIED');
  for(const entry of oldPhysical.records){assert.equal(digest(r.rows.get('meta').get(entry.key)),oldPhysicalLedger.parts.get(entry.key));r.rows.get('meta').delete(entry.key);}
  for(const part of encoded.parts)r.rows.get('meta').set(part.key,r.copy(part));r.rows.get('projects').set(jobId,r.copy(encoded.root));encoded=null;
  assertStored(badPhysical,badLedger,'STAGE13_INSTALLED_EXACT_CORRUPT_PHYSICAL');assertStored(oldJournal,oldJournalLedger,'STAGE13_INJECTION_PRESERVES_JOURNAL');
  const before=h.sha256Value(r.rows.get('projects').get(jobId)),historyBefore=r.copy(await r.store.historyList(jobId));
  const canonicalCorruption=staleReceipt||['string-old-count','array-old-count','canonical-record-corruption'].includes(name);
  // Actual encoded rows and independent logical/physical ledgers remain retained.
  const badRevision=bad.revision,badProjectSha256=bad.projectSha256;bad=null;
  await assert.rejects(()=>r.store.refreshProjectProjection(jobId,{expectedProjectRevision:badRevision,expectedStateSha256:badProjectSha256}),error=>error.code==='PROJECT_INTEGRITY_FAILED'&&(canonicalCorruption?/canonical integrity/.test(error.message):Array.isArray(error.issues)&&error.issues.length===1&&error.issues[0]==='Stage 13 derivedData does not match deterministic recalculation.'),'STAGE13_RECOVERY_NARROW_RECOGNITION_ORACLE: '+name);
  if(canonicalCorruption){const entry=(await r.store.listQuarantinedProjects()).filter(row=>row.jobId===jobId).at(-1);assert(entry?.completeSnapshot,'STAGE13_RECOVERY_CORRUPT_SNAPSHOT_PRESERVED_ORACLE');const preserved=await r.store.metaGet(entry.key);assert.equal(h.sha256Value(preserved.row),before,'STAGE13_RECOVERY_CORRUPT_SNAPSHOT_PRESERVED_ORACLE');assert.equal(r.rows.get('projects').has(jobId),false,'STAGE13_RECOVERY_CORRUPTION_NOT_CURRENT_ORACLE');
   assert.equal(preserved.reason.startsWith('PROJECT_CANONICAL_INTEGRITY_FAILED:'),true,'STAGE13_LOGICAL_INTEGRITY_NOT_CODEC_SETUP_FAILURE');const evidence=preserved.physicalEvidence;assert.equal(evidence?.schema,'closed-loop-physical-evidence/1');assert.equal(preserved.completeSnapshot,true);
   const capture=evidence.project;assert.equal(capture.ownerStore,'projects');assert.equal(capture.key,jobId);assert.equal(capture.payloadField,'project');assert.equal(capture.packed,true);assert.equal(capture.facts.complete,true);assert.equal(capture.facts.inventoryUnavailable,false);assert.equal(capture.facts.actualPartRecordCount,badKeys.length);assert.equal(capture.facts.declaredPartCount,badKeys.length);
   assertInventory(capture,badLedger,'STAGE13_QUARANTINE_EXACT_PHYSICAL');const parts=capture.records.map(entry=>entry.row).sort((a,b)=>a.value.index-b.value.index);assert.equal(digest(codec.decode(capture.root,'projects','project',parts)),corruptLogicalSha,'STAGE13_QUARANTINE_EXACT_LOGICAL_CORRUPTION');
   assertInventory(evidence.journal,oldJournalLedger,'STAGE13_QUARANTINE_EXACT_JOURNAL');assert.equal(evidence.journal.facts.complete,true);assert.equal(r.rows.get('meta').has(journalKey),false,'STAGE13_QUARANTINED_JOURNAL_ROOT_REMOVED');for(const key of oldJournalLedger.parts.keys())assert.equal(r.rows.get('meta').has(key),false,'STAGE13_QUARANTINED_JOURNAL_PART_REMOVED');for(const key of badKeys)assert.equal(r.rows.get('meta').has(key),false,'STAGE13_QUARANTINED_SOURCE_PART_REMOVED');
  }else{assert.equal(h.sha256Value(r.rows.get('projects').get(jobId)),before,'STAGE13_RECOVERY_FAILED_ROW_PRESERVED_ORACLE: '+name);assertStored(badPhysical,badLedger,'STAGE13_FAILED_EXACT_PHYSICAL_PRESERVATION');assertStored(oldJournal,oldJournalLedger,'STAGE13_FAILED_EXACT_JOURNAL_PRESERVATION');}
  assert.deepEqual(r.copy(await r.store.historyList(jobId)),historyBefore,'STAGE13_RECOVERY_FAILED_HISTORY_PRESERVED_ORACLE: '+name);
  if(['wrong-numeric-old-count','unrelated-derived-change'].includes(name))projectionCounterexamples.push({caseId:name,canonicalReceiptValid:true,unchangedAuthoritativeInputs:true,unchangedNonTargetFields:true,observedAtPreserved:true,retainedObservationsPreserved:true,refreshRejected:true,originalRowPreserved:true,historyPreserved:true});
  assertUnshared({packed:true,ownerStore:'projects',key:jobId,root:{storageEncoding:{generation:badGeneration}}});for(const key of badKeys){const existing=r.rows.get('meta').get(key);if(existing!==undefined)assert.equal(digest(existing),badLedger.parts.get(key),'STAGE13_REMOVE_ONLY_OWNED_CASE_PART');r.rows.get('meta').delete(key);}
  restoreSource(oldPhysical);restoreSource(oldJournal);assertStored(oldPhysical,oldPhysicalLedger,'STAGE13_RESTORED_EXACT_ORIGINAL_PHYSICAL');assertStored(oldJournal,oldJournalLedger,'STAGE13_RESTORED_EXACT_ORIGINAL_JOURNAL');if(staleReceipt)receiptTamperControls.push({caseId:name,staleReceiptRejected:true,completeQuarantineSnapshotPreserved:true,historyPreserved:true});else negatives.push(name);
 }
 const refreshed=await r.store.refreshProjectProjection(jobId,{expectedProjectRevision:originalRevision,expectedStateSha256:originalProjectSha256});
 assert.equal(refreshed.stages[13].derivedData.REPEATED_FAILURE_GROUPS,1,'STAGE13_RECOVERY_CURRENT_GROUP_ORACLE');assert.equal(refreshed.revision,originalRevision+1,'STAGE13_RECOVERY_NEW_NORMAL_REVISION_ORACLE');
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
 return {stage13ProjectionRecovery:'PASS',receiptTamperControls,projectionCounterexamples,verificationObservations:[{checkId:'stage13.old-group-projection-recovery',boundary:'Actual old-owner-equivalent write/checkpoint -> current read/refresh/reload/History; isolated transaction adapter and preserved artifact/context bytes',expected:{oldGroups:2,currentGroups:1,repeatedOccurrences:2,rawAndAcceptedHistoryPreserved:true,oldCheckpointPreserved:true,newNormalRevision:true,historyAuthorityBlockedStage:7,historyStage13ProjectionCleared:true,restoredComputedGroups:1,canonicalMetricInputsPreserved:true,negativeCases:['wrong-numeric-old-count','string-old-count','array-old-count','unrelated-derived-change','canonical-record-corruption']},observed:{oldGroups:originalGroups,currentGroups:refreshed.stages[13].derivedData.REPEATED_FAILURE_GROUPS,repeatedOccurrences:counts.repeatedDefectCount,rawAndAcceptedHistoryPreserved:true,oldCheckpointPreserved:true,newNormalRevision:refreshed.revision===originalRevision+1,historyAuthorityBlockedStage:restored.project.stages[7].status==='BLOCKED'?7:null,historyStage13ProjectionCleared:!Object.hasOwn(restored.project.stages[13].derivedData,'REPEATED_FAILURE_GROUPS'),restoredComputedGroups:counts.repeatedFailureGroupCount,canonicalMetricInputsPreserved:metricInputs(restored.project)===inputSha,negativeCases:negatives},passed:true,synthetic:true,actualBrowser:false,priorActorHistoryReplayed:false,duplicateDefectIsDeclaredFixtureInput:true}],sourceHashes:Object.fromEntries(Object.entries(sources).map(([name,text])=>[name,createHash('sha256').update(text).digest('hex')])),legacyOwnerSha256:createHash('sha256').update(oldEngine).digest('hex')};
}
