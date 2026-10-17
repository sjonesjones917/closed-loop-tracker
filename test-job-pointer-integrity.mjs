import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {stage01AcceptanceFixture} from './test-fixtures.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';

// Specification §15 lines 1224/1226/1227: retained identity and current authority
// are different facts. The actual store runs through the isolated transaction
// adapter; these synthetic controls do not establish a complete stage journey.
const POINTERS=['CURRENT_ITERATION','CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION','CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION','CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','LATEST_EVIDENCE_REFERENCE'];
export async function verifyJobPointerIntegrity({sourceOverrides={}}={}){
 const r=projectStoreRuntime({sourceOverrides}),{store,engine,copy}=r,schema=r.runtime.closedLoopWorkflowSchema,hash=r.runtime.closedLoopHash;
 const blank=await store.createProject({commandId:'SYNTHETIC-JOB-POINTER-INTEGRITY'}),before=await store.readProject(blank.job.JOB_ID),history=await store.historyList(blank.job.JOB_ID),rejected=[];
 assert.equal(store.validateProjectIntegrity(blank).valid,true,'JOB_POINTER_EMPTY_CONTROL_ORACLE');
 for(const name of POINTERS){
  const bad=copy(blank);bad.job[name]='UNALLOCATED-IDENTITY';
  const checked=store.validateProjectIntegrity(bad,{verifyDerived:false});
  assert.equal(checked.valid,false,'JOB_POINTER_UNKNOWN_ID_ORACLE: '+name);
  assert(checked.issues.some(value=>value.includes('/job/'+name)),'JOB_POINTER_DIAGNOSTIC_ORACLE: '+name);
  await assert.rejects(store.writeProject(bad,{expectedProjectRevision:blank.revision}),error=>error.code==='PROJECT_INTEGRITY_FAILED'&&error.message.includes('/job/'+name),'JOB_POINTER_WRITE_REJECTION_ORACLE: '+name);
  assert.deepEqual(await store.readProject(blank.job.JOB_ID),before,'JOB_POINTER_ATOMIC_STATE_ORACLE');assert.deepEqual(await store.historyList(blank.job.JOB_ID),history,'JOB_POINTER_ATOMIC_HISTORY_ORACLE');rejected.push(name);
 }
 const importBad=copy(blank);delete importBad.projectSha256;importBad.job.CURRENT_PRODUCT_ID='NONEXISTENT-PRODUCT';
 const importBody={schema:'closed-loop-project-package/1',projectSchema:importBad.schema,workflow:importBad.workflow,responseSchema:schema.RESPONSE_SCHEMA,project:importBad,artifacts:[],packageManifest:{jobId:importBad.job.JOB_ID,projectSha256:store.projectSha256(importBad),artifactCount:0,artifacts:[]},exportedAt:new Date().toISOString()},importBytes=new Blob([gzipSync(Buffer.from(JSON.stringify({...importBody,packageSha256:hash.sha256Value(copy(importBody))})))]);
 await assert.rejects(projectStoreRuntime({sourceOverrides}).store.importPackage(importBytes),error=>error.code==='PROJECT_INTEGRITY_FAILED'&&error.message.includes('/job/CURRENT_PRODUCT_ID'),'JOB_POINTER_IMPORT_REJECTION_ORACLE');
 let admitted;const fixtureIngestion={...r.ingestion,commit(project,proposalId,options){admitted={project:copy(project),proposalId};return r.ingestion.commit(project,proposalId,options);}};
 let p=stage01AcceptanceFixture({...r,schema,ingestion:fixtureIngestion},'SYNTHETIC-LATEST-EVIDENCE-RETENTION');
 const acceptedProjection=r.ingestion.prepareAcceptanceCandidate(admitted.project,admitted.proposalId,{operator:'SYNTHETIC'});assert.equal(engine.jobPointerIntegrityIssues(acceptedProjection.project).length,0,'JOB_POINTER_ADMISSION_VALID_CONTROL_ORACLE');
 const invalidProjection=copy(admitted.project);invalidProjection.job.CURRENT_PRODUCT_ID='NONEXISTENT-PRODUCT';assert.throws(()=>r.ingestion.prepareAcceptanceCandidate(invalidProjection,admitted.proposalId,{operator:'SYNTHETIC'}),error=>error.code==='PROJECT_INTEGRITY_FAILED'&&error.issues?.some(value=>value.includes('/job/CURRENT_PRODUCT_ID')),'JOB_POINTER_ADMISSION_INVALID_ORACLE');
 p=await store.writeProject(p,{expectedProjectRevision:0,createOnly:true,incrementRevision:false});
 const evidenceId=p.job.LATEST_EVIDENCE_REFERENCE;assert(evidenceId&&p.projectData.evidenceRecords.length,'JOB_POINTER_EVIDENCE_ESTABLISHMENT_CONTROL_ORACLE');
 const wrongFamily=copy(p);wrongFamily.job.CURRENT_PRODUCT_ID=evidenceId;assert(engine.jobPointerIntegrityIssues(wrongFamily).some(value=>value.includes('/job/CURRENT_PRODUCT_ID')),'JOB_POINTER_FAMILY_ORACLE');
 const corrected=copy(p);engine.invalidateStageForAuthorityChange(corrected,{stage:1,reason:'Synthetic correction retains earlier canonical evidence.',operatorLabel:'SYNTHETIC'});
 assert.equal(corrected.job.LATEST_EVIDENCE_REFERENCE,evidenceId,'JOB_POINTER_INVALIDATED_EVIDENCE_RETAINED_ORACLE');
 assert.equal(engine.gate(1,corrected).complete,false,'JOB_POINTER_RETAINED_EVIDENCE_NOT_CURRENT_ORACLE');
 assert.equal(engine.recordsForCurrentScope(corrected,'evidenceRecords').some(row=>engine.recordId(row,'evidenceRecords')===evidenceId),false,'JOB_POINTER_INVALIDATED_EVIDENCE_SCOPE_ORACLE');
 p=await store.writeProject(corrected,{expectedProjectRevision:p.revision,mutationConfirmation:store.mutationImpact(p,corrected)});
 const destination=projectStoreRuntime({sourceOverrides}),restored=await destination.store.importPackage(await store.exportPackage(p.job.JOB_ID)),reloaded=await destination.store.readProject(restored.job.JOB_ID);
 assert.equal(reloaded.job.LATEST_EVIDENCE_REFERENCE,evidenceId,'JOB_POINTER_BACKUP_RELOAD_ORACLE');assert.equal(destination.engine.gate(1,reloaded).complete,false,'JOB_POINTER_RESTORED_GATE_STAYS_BLOCKED_ORACLE');
 // A valid future product reservation is a canonical target, not an existing
 // completed product. It must not prevent a partial project from being saved.
 const reserved=copy(blank),productId=engine.allocateId(reserved,'products');reserved.projectData.products.push({id:productId,stage:21,fields:{PRODUCT_ID:productId,PRODUCT_VERSION:'PRODUCT-v001',STATUS:'RESERVED'},active:true,completionState:'AWAITING_AGENT_COMPLETION'});
 assert.equal(engine.jobPointerIntegrityIssues(reserved).length,0,'JOB_POINTER_RESERVED_FUTURE_CONTROL_ORACLE');
 // Own the real candidate creation path, including exact bytes and the explicit
 // human-decision command. No preceding stage completion is asserted here.
 let candidateProject=await store.createProject({commandId:'SYNTHETIC-CANDIDATE-POINTER'});const bytes=new Blob(['candidate pointer bytes']),artifactId=artifactFixtureId(engine,candidateProject,'CANDIDATE-POINTER'),stored=await store.putArtifact({artifactId,jobId:candidateProject.job.JOB_ID,blob:bytes,filename:'candidate.txt',mediaType:'text/plain'});await store.getArtifact(artifactId);
 engine.registerArtifactBytes(candidateProject,{stage:10,artifactId,filename:'candidate.txt',mediaType:'text/plain',byteSize:bytes.size,sha256:stored.sha256});
 const decision=engine.recordRegisteredHumanDecision(candidateProject,{stage:10,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value(copy([artifactId])),value:[artifactId],operatorLabel:'SYNTHETIC'}),frozen=engine.freezeCandidate(candidateProject,{stage:10,artifactIds:[artifactId],selectionDecisionId:engine.recordId(decision,'humanDecisions'),operatorLabel:'SYNTHETIC'}),candidateId=engine.recordId(frozen.candidate,'candidateFreezes');
 assert.equal(candidateProject.job.CURRENT_CANDIDATE_ID,candidateId,'JOB_POINTER_CANDIDATE_CREATION_ORACLE');
 const nextDecision=engine.recordRegisteredHumanDecision(candidateProject,{stage:10,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value(copy([artifactId])),value:[artifactId],operatorLabel:'SYNTHETIC'}),nextFrozen=engine.freezeCandidate(candidateProject,{stage:10,artifactIds:[artifactId],selectionDecisionId:engine.recordId(nextDecision,'humanDecisions'),operatorLabel:'SYNTHETIC'}),newCandidateId=engine.recordId(nextFrozen.candidate,'candidateFreezes');
 assert.notEqual(newCandidateId,candidateId);assert.equal(candidateProject.job.CURRENT_CANDIDATE_ID,newCandidateId,'JOB_POINTER_CANDIDATE_SUPERSESSION_ORACLE');
 engine.invalidateDownstream(candidateProject,9,'SYNTHETIC-UPSTREAM-CHANGE','Synthetic predecessor correction');
 assert.equal(candidateProject.job.CURRENT_CANDIDATE_ID,newCandidateId,'JOB_POINTER_CANDIDATE_RETAINED_ORACLE');assert.equal(engine.gate(10,candidateProject).complete,false,'JOB_POINTER_CANDIDATE_NOT_CURRENT_ORACLE');
 // Stage 26 first creates its version independently of completion; Stage 27
 // consumes that same reconciled version. The writer must stamp both scopes.
 const audit=copy(blank),auditFamily=schema.STAGE_CONTRACTS[26].primaryCollections[0],auditRecord=copy({id:engine.allocateId(audit,auditFamily),stage:26,fields:{},active:true});audit.projectData[auditFamily].push(auditRecord);
 const firstReview=engine.registerStageVersion(audit,26,'SYNTHETIC-FIRST-REVIEW');
 assert.equal(audit.job.CURRENT_RECONCILED_REVIEW_VERSION,firstReview.version,'JOB_POINTER_REVIEW_CREATION_ORACLE');assert.equal(audit.job.CURRENT_REVIEW_VERSION,firstReview.version);
 assert.equal(auditRecord.scope.reviewVersion,firstReview.version);assert.equal(auditRecord.scope.reconciledReviewVersion,firstReview.version,'JOB_POINTER_REVIEW_SCOPE_ORACLE');
 assert.equal(engine.gate(26,audit).complete,false,'JOB_POINTER_REVIEW_CREATION_IS_NOT_COMPLETION_ORACLE');
 audit.stages[26].acceptedData=copy({...audit.stages[26].acceptedData,REVIEW_RESULT:'Synthetic second author output'});const secondReview=engine.registerStageVersion(audit,26,'SYNTHETIC-SECOND-REVIEW');
 assert.notEqual(secondReview.version,firstReview.version);assert.equal(audit.job.CURRENT_RECONCILED_REVIEW_VERSION,secondReview.version,'JOB_POINTER_REVIEW_SUPERSESSION_ORACLE');assert.equal(auditRecord.scope.reconciledReviewVersion,secondReview.version);
 // Literal late-stage identity cohorts isolate retention during recalculation.
 // They are intentionally insufficient for any corresponding completion gate.
 const late=copy(blank),review='REVIEW-v001',chain='EVIDENCE-CHAIN-'+('A'.repeat(64)),digest='b'.repeat(64),deliveryId=engine.allocateId(late,'deliveryRecords');
 late.projectData.artifactVersions.push({stage:26,kind:'REVIEW',version:review});late.job.CURRENT_REVIEW_VERSION=review;late.job.CURRENT_RECONCILED_REVIEW_VERSION=review;
 late.projectData.commandReceipts.push({COMMAND_ID:'CALCULATE_EVIDENCE_CHAINS',result:{complete:true,version:chain}});late.job.CURRENT_EVIDENCE_CHAIN_VERSION=chain;
 const deliveryCandidateId=engine.allocateId(late,'deliveryCandidateSets');late.projectData.deliveryCandidateSets.push(copy({id:deliveryCandidateId,active:false,fields:{DELIVERY_CANDIDATE_SET_ID:deliveryCandidateId,ARTIFACT_IDS:['SYNTHETIC-RETAINED-ARTIFACT']}}));late.job.CURRENT_DELIVERY_CANDIDATE_SET_ID=deliveryCandidateId;
 late.projectData.artifactIdentities.push(copy({id:engine.allocateId(late,'artifactIdentities'),stage:28,identityEvidenceSha256:digest,active:false,scope:{deliveryCandidateSetId:deliveryCandidateId},fields:{ARTIFACT_ID:'SYNTHETIC-RETAINED-ARTIFACT',EXACT_HASH_MATCH:true,EXACT_SIZE_MATCH:true}}));late.job.CURRENT_HASH_REVIEW_ID='HASH_REVIEW-'+digest.toUpperCase();
 late.job.CURRENT_DELIVERY_ID=deliveryId;late.projectData.deliveryRecords.push(copy({id:deliveryId,stage:30,active:true,scope:engine.currentScope(late),terminalFingerprint:'STALE-SYNTHETIC-TERMINAL',fields:{DELIVERY_ID:deliveryId,DELIVERY_STATE:'AUTHORIZED'}}));
 const incompleteHash=copy(late);incompleteHash.projectData.artifactIdentities[0].fields.EXACT_HASH_MATCH=false;assert(engine.jobPointerIntegrityIssues(incompleteHash).some(issue=>issue.includes('/job/CURRENT_HASH_REVIEW_ID')),'JOB_POINTER_INCOMPLETE_HASH_CREATION_ORACLE');
 const incompleteChain=copy(late);incompleteChain.projectData.commandReceipts[0].result.complete=false;incompleteChain.projectData.evidenceChains.push(copy({id:'SYNTHETIC-INCOMPLETE-CHAIN',fields:{EVIDENCE_CHAIN_VERSION:chain,STATUS:'INCOMPLETE'}}));assert(engine.jobPointerIntegrityIssues(incompleteChain).some(issue=>issue.includes('/job/CURRENT_EVIDENCE_CHAIN_VERSION')),'JOB_POINTER_INCOMPLETE_CHAIN_CREATION_ORACLE');
 const retained=Object.fromEntries(['CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_HASH_REVIEW_ID','CURRENT_DELIVERY_ID'].map(name=>[name,late.job[name]]));engine.recalculate(late);
 for(const [name,value]of Object.entries(retained)){assert.equal(late.job[name],value,'JOB_POINTER_LATE_RETENTION_ORACLE: '+name);const lost=copy(late);lost.job[name]=null;assert(engine.jobPointerIntegrityIssues(lost,{prior:late}).some(issue=>issue.includes('/job/'+name)),'JOB_POINTER_PRIOR_NULL_REVERSAL_ORACLE: '+name);}
 const removedOwner=copy(late);removedOwner.projectData.deliveryRecords=[];removedOwner.job.CURRENT_DELIVERY_ID=null;assert(engine.jobPointerIntegrityIssues(removedOwner,{prior:late}).some(issue=>issue.includes('/job/CURRENT_DELIVERY_ID')),'JOB_POINTER_PRIOR_ESTABLISHED_OWNER_REMOVED_ORACLE');
 for(const stage of [26,28,29,30])assert.equal(engine.gate(stage,late).complete,false,'JOB_POINTER_LATE_GATE_BLOCKED_ORACLE: '+stage);
 assert.equal(engine.recordValue(late.projectData.deliveryRecords[0],'DELIVERY_STATE'),'WITHDRAWN_FOR_FUTURE_USE','JOB_POINTER_DELIVERY_WITHDRAWAL_CONTROL_ORACLE');
 assert.notEqual(engine.operationalNextAction(late,30).actionType,'EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','JOB_POINTER_RETAINED_DELIVERY_NOT_EXPORTABLE_ORACLE');
 for(const family of ['deliveryRecords','artifactIdentities'])assert.equal(engine.recordsForCurrentScope(late,family).length,0,'JOB_POINTER_RETAINED_CURRENT_SCOPE_ORACLE: '+family);
 const incompleteChains=engine.calculateEvidenceChains(late);assert.equal(incompleteChains.complete,false,'JOB_POINTER_CHAIN_INCOMPLETE_CONTROL_ORACLE');assert.equal(late.job.CURRENT_EVIDENCE_CHAIN_VERSION,chain,'JOB_POINTER_CHAIN_COMMAND_RETENTION_ORACLE');
 return {status:'PASS',pointerFields:POINTERS.length,rejectedUnknownIdentities:rejected,wrongFamilyRejected:true,projectedAdmissionChecked:true,stage26CreatedBeforeCompletion:true,stage26SupersessionScopeStamped:true,retainedDeliveryNotExportable:true,invalidatedEvidenceRetained:true,nativeBackupReloadPreserved:true,reservedFutureProductAllowed:true,candidateCreationRetained:true,latePointersRetained:Object.keys(retained),incompleteGatesBlocked:true,synthetic:true,boundary:'Actual engine/store and native backup through isolated transaction adapter; late identity cohorts are helper-only, not valid stage-completion fixtures.'};
}
// Equivalent pre-fix preparation disables only the new pointer admission and
// projection repair, and restores the old current-only latest-evidence writer.
// The actual Stage 1 acceptance, invalidation, store and backup paths remain.
export async function verifyLegacyJobPointerRecovery({sourceOverrides={}}={}){
 const current=sourceOverrides['workflow-engine.js']||fs.readFileSync('workflow-engine.js','utf8'),legacy=current
  .replace('function jobPointerIntegrityIssues(project,{prior=null}={}){','function jobPointerIntegrityIssues(project,{prior=null}={}){return [];')
  .replace('function jobPointerProjectionRepairs(project){','function jobPointerProjectionRepairs(project){return [];')
  .replace("recordId(records(project,'evidenceRecords',{active:false}).at(-1),'evidenceRecords')||null","recordId(recordsForCurrentScope(project,'evidenceRecords').at(-1),'evidenceRecords')||null");
 const old=projectStoreRuntime({sourceOverrides:{...sourceOverrides,'workflow-engine.js':legacy}}),id='SYNTHETIC-LEGACY-POINTER-RECOVERY';
 let prior=stage01AcceptanceFixture({...old,schema:old.runtime.closedLoopWorkflowSchema},id);prior=await old.store.writeProject(prior,{expectedProjectRevision:0,createOnly:true,incrementRevision:false});const evidenceId=prior.job.LATEST_EVIDENCE_REFERENCE;
 const invalidated=old.copy(prior);old.engine.invalidateStageForAuthorityChange(invalidated,{stage:1,reason:'Synthetic pre-fix pointer loss',operatorLabel:'SYNTHETIC'});prior=await old.store.writeProject(invalidated,{expectedProjectRevision:prior.revision,mutationConfirmation:old.store.mutationImpact(prior,invalidated)});
 assert.equal(prior.job.LATEST_EVIDENCE_REFERENCE,null,'JOB_POINTER_LEGACY_CONTROL_ORACLE');assert.equal(old.store.projectSha256(prior),prior.projectSha256);
 const backup=await old.store.exportPackage(id),backupText=gunzipSync(Buffer.from(await backup.arrayBuffer())).toString('utf8'),priorHistory=await old.store.historyList(id);
 // Capture the exact exported object span independently of the application
 // parser/encoder: braces inside JSON strings cannot end the root member.
 const start=backupText.indexOf('\"project\":')+10;assert(start>=10&&backupText[start]==='{');let depth=0,inString=false,escaped=false,end=start;
 for(;end<backupText.length;end++){const c=backupText[end];if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='\"')inString=false;}else if(c==='\"')inString=true;else if(c==='{')depth++;else if(c==='}'&&!--depth){end++;break;}}
 const exactProjectSource=backupText.slice(start,end);assert.equal(JSON.parse(exactProjectSource).job.LATEST_EVIDENCE_REFERENCE,null);

 const fresh=()=>{const r=projectStoreRuntime({sourceOverrides});for(const [name,rows]of old.rows)r.rows.set(name,new Map([...rows].map(([key,row])=>[key,r.copy(row)])));return r;};
 const snapshot=async r=>{const visit=async value=>{if(value instanceof Blob)return {type:value.type,bytes:Buffer.from(await value.arrayBuffer()).toString('base64')};if(Array.isArray(value))return Promise.all(value.map(visit));if(value&&typeof value==='object')return Object.fromEntries(await Promise.all(Object.entries(value).map(async([key,item])=>[key,await visit(item)])));return value;};return visit([...r.rows].map(([name,rows])=>[name,[...rows]]));};
 const loaded=fresh(),retainedBefore=await snapshot(loaded),repaired=await loaded.store.readProject(id),newHistory=await loaded.store.historyList(id);
 assert.equal(repaired.revision,prior.revision+1,'JOB_POINTER_LEGACY_REVISION_ORACLE');assert.equal(repaired.job.LATEST_EVIDENCE_REFERENCE,evidenceId,'JOB_POINTER_LEGACY_REPAIR_ORACLE');assert.equal(loaded.engine.gate(1,repaired).complete,false);
 for(const entry of priorHistory.entries){assert.deepEqual(JSON.parse(JSON.stringify(newHistory.entries.find(row=>row.id===entry.id))),JSON.parse(JSON.stringify(entry)),'JOB_POINTER_LEGACY_HISTORY_IDENTITY_ORACLE');const key=[...loaded.rows.get('meta').keys()].find(value=>value.endsWith(':snapshot:'+entry.id));assert.equal(Buffer.compare(Buffer.from(await loaded.rows.get('meta').get(key).value.blob.arrayBuffer()),Buffer.from(await old.rows.get('meta').get(key).value.blob.arrayBuffer())),0,'JOB_POINTER_LEGACY_SNAPSHOT_BYTES_ORACLE');}
 const event=repaired.projectData.history.find(row=>row.type==='JOB_POINTER_PROJECTION_REPAIRED');assert.equal(event.sourceProjectSha256,prior.projectSha256);assert.deepEqual(JSON.parse(JSON.stringify(event.repairs)),[{field:'LATEST_EVIDENCE_REFERENCE',from:null,to:evidenceId}]);
 assert.equal((await loaded.store.readProject(id)).revision,repaired.revision,'JOB_POINTER_LEGACY_IDEMPOTENT_READ_ORACLE');
 assert.equal((repaired.projectData.migrationArchives||[]).filter(row=>row.kind==='ORIGINAL_PROJECT_SOURCE').length,(prior.projectData.migrationArchives||[]).filter(row=>row.kind==='ORIGINAL_PROJECT_SOURCE').length,'JOB_POINTER_NO_FABRICATED_RAW_SOURCE_ORACLE');
 for(const phase of ['during-project-write','before-transaction-commit']){const failed=fresh(),before=await snapshot(failed);failed.runtime.__closedLoopStorageFault=phase;await assert.rejects(failed.store.readProject(id),error=>error.code==='INJECTED_STORAGE_FAILURE','JOB_POINTER_LEGACY_ABORT_ORACLE: '+phase);assert.deepEqual(await snapshot(failed),before,'JOB_POINTER_LEGACY_ATOMIC_ROLLBACK_ORACLE');delete failed.runtime.__closedLoopStorageFault;assert.equal((await failed.store.readProject(id)).job.LATEST_EVIDENCE_REFERENCE,evidenceId);}
 const stale=fresh(),open=stale.runtime.openStorageTransaction;let raced=false,concurrent;
 stale.runtime.openStorageTransaction=async(names,mode)=>{if(!raced&&mode==='readwrite'&&Array.isArray(names)&&names.includes('projects')){raced=true;const row=stale.copy(stale.rows.get('meta').get('recovery:'+id));row.value.generation++;stale.rows.get('meta').set(row.key,row);concurrent=await snapshot(stale);}return open(names,mode);};
 await assert.rejects(stale.store.readProject(id),error=>error.code==='STALE_HISTORY_REVISION','JOB_POINTER_LEGACY_CONCURRENT_HISTORY_ORACLE');assert(raced);assert.deepEqual(await snapshot(stale),concurrent,'JOB_POINTER_LEGACY_CONCURRENT_WORK_PRESERVED_ORACLE');
 const cold=fresh(),coldBackup=JSON.parse(gunzipSync(Buffer.from(await(await cold.store.exportPackage(id)).arrayBuffer())));assert.equal(coldBackup.project.job.LATEST_EVIDENCE_REFERENCE,evidenceId,'JOB_POINTER_COLD_BACKUP_RECOVERY_ORACLE');
 const destination=projectStoreRuntime({sourceOverrides}),imported=await destination.store.importPackage(backup);assert.equal(imported.job.LATEST_EVIDENCE_REFERENCE,evidenceId,'JOB_POINTER_LEGACY_NATIVE_IMPORT_ORACLE');assert.equal(destination.engine.gate(1,imported).complete,false);
 const archived=Object.values((await destination.store.historyList(id)).sourceArchives);assert(archived.length);let exact=false;for(const row of archived){const source=await destination.store.readOriginalSourceArchive(id,row.sha256);if(await source.blob.text()===exactProjectSource)exact=true;}assert(exact,'JOB_POINTER_LEGACY_NATIVE_SOURCE_BYTES_ORACLE');
 const restored=(await destination.store.restoreCheckpoint(id,priorHistory.activeId,{expectedProjectRevision:imported.revision})).project;assert.equal(restored.job.LATEST_EVIDENCE_REFERENCE,evidenceId,'JOB_POINTER_LEGACY_RESTORE_ORACLE');assert.equal(destination.engine.gate(1,restored).complete,false);
 const draft=old.copy(prior),prompt=old.prompts.reserveAndBuildPromptRecord(draft,1,{},{}).prompt;prior=await old.store.writeProject(draft,{expectedProjectRevision:prior.revision});const captured=old.ingestion.captureRaw(prior,{stage:1,text:'{',promptRecord:prompt});prior=await old.store.writeProject(captured.project,{operational:true,expectedProjectRevision:prior.revision,expectedStateSha256:prior.projectSha256});assert([...old.rows.get('meta').keys()].some(key=>key.startsWith('responseOperations:')),'JOB_POINTER_LEGACY_OPERATIONAL_CONTROL_ORACLE');
 const operational=fresh(),afterOperational=await operational.store.readProject(id);assert.equal(afterOperational.job.LATEST_EVIDENCE_REFERENCE,evidenceId,'JOB_POINTER_LEGACY_OPERATIONAL_REPAIR_ORACLE');assert.equal(afterOperational.projectData.rawResponses.at(-1).completeRawResponse,'{','JOB_POINTER_LEGACY_RECOVERABLE_RAW_ORACLE');assert.equal(afterOperational.revision,prior.revision+1);
 // This preserved copy of the shipped legacy support project takes the normal
 // UI mapper. The mutable build fixture is outside execution-source identity;
 // this existing governed specimen pins the exact originally shipped bytes.
 const seedFixturePath='verification/stage01-retained-capture-legacy-fixture-20261005.json',seedFixtureBytes=fs.readFileSync(seedFixturePath),seedFixtureSha256=createHash('sha256').update(seedFixtureBytes).digest('hex');
 assert.equal(seedFixtureSha256,'8352b036eca02dfd86bb441df4ea3fe0ea54b9ad6bcaaee9a000219ddfae09c5','JOB_POINTER_LEGACY_SEED_FIXTURE_IDENTITY_ORACLE');
 const seedRuntime=projectStoreRuntime({sourceOverrides}),app=sourceOverrides['app-core.js']||fs.readFileSync('app-core.js','utf8'),rawSeed=JSON.parse(seedFixtureBytes.toString('utf8'));
 Object.assign(seedRuntime.runtime,{core:seedRuntime.core,engine:seedRuntime.engine,projectStore:seedRuntime.store,schema:seedRuntime.runtime.closedLoopWorkflowSchema,safe:seedRuntime.engine.safe,clone:seedRuntime.copy,views:['Overview','Project','Workflow','Records','Files','Release']});
 vm.runInContext(app.split('\n').filter(line=>line.startsWith('const stageRecordText=')||line.startsWith('const stageOutputText=')).join('\n')+'\n'+app.slice(app.indexOf('function blankStage('),app.indexOf('function normalize(')),seedRuntime.runtime,{filename:'app-core.js:actual-bundled-seed-mapper'});
 const seed=seedRuntime.runtime.importSeed(seedRuntime.copy(rawSeed));assert.equal(seedRuntime.engine.jobPointerIntegrityIssues(seed).length,0,'JOB_POINTER_BUNDLED_SEED_MAPPING_ORACLE');
 const savedSeed=await seedRuntime.store.writeProject(seed,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});assert.equal((await seedRuntime.store.readProject(seed.job.JOB_ID)).projectSha256,savedSeed.projectSha256,'JOB_POINTER_BUNDLED_SEED_DURABLE_ORACLE');
 await seedRuntime.store.saveCheckpoint(savedSeed.job.JOB_ID,{expectedProjectRevision:savedSeed.revision});const ordinary=await seedRuntime.store.createProject();assert.notEqual(ordinary.job.JOB_ID,savedSeed.job.JOB_ID);assert(await seedRuntime.store.readProject(ordinary.job.JOB_ID));assert(await seedRuntime.store.readProject(savedSeed.job.JOB_ID),'JOB_POINTER_BUNDLED_DEPARTURE_HISTORY_ORACLE');
 assert(seed.projectData.migrationArchives.some(row=>row.kind==='ORIGINAL_IMPORT_PAYLOAD'&&JSON.stringify(row.payload)===JSON.stringify(rawSeed)),'JOB_POINTER_BUNDLED_SOURCE_ARCHIVE_ORACLE');
 const oldSeedRuntime=projectStoreRuntime({sourceOverrides:{...sourceOverrides,'workflow-engine.js':legacy}});Object.assign(oldSeedRuntime.runtime,{core:oldSeedRuntime.core,engine:oldSeedRuntime.engine,projectStore:oldSeedRuntime.store,schema:oldSeedRuntime.runtime.closedLoopWorkflowSchema,safe:oldSeedRuntime.engine.safe,clone:oldSeedRuntime.copy,views:['Overview','Project','Workflow','Records','Files','Release']});
 vm.runInContext(app.split('\n').filter(line=>line.startsWith('const stageRecordText=')||line.startsWith('const stageOutputText=')).join('\n')+'\n'+app.slice(app.indexOf('function blankStage('),app.indexOf('function normalize(')),oldSeedRuntime.runtime);
 const oldSeed=oldSeedRuntime.runtime.importSeed(oldSeedRuntime.copy(rawSeed));Object.assign(oldSeed.job,{CURRENT_SOURCE_SET_VERSION:rawSeed.currentVersions?.sources||'NOT APPLICABLE',CURRENT_REQUIREMENTS_VERSION:rawSeed.currentVersions?.requirements||'NOT APPLICABLE',CURRENT_TEST_SUITE_VERSION:rawSeed.currentVersions?.tests||'NOT APPLICABLE',CURRENT_INSTRUCTION_VERSION:rawSeed.currentVersions?.instruction||'NOT APPLICABLE',CURRENT_BASELINE_ID:rawSeed.baseline?.baselineId||'NONE',CURRENT_PRODUCT_ID:rawSeed.product?.productId||'NONE'});
 const oldSeedSaved=await oldSeedRuntime.store.writeProject(oldSeed,{expectedProjectRevision:0,incrementRevision:false,createOnly:true}),oldSeedBackup=await oldSeedRuntime.store.exportPackage(oldSeed.job.JOB_ID),seedReload=projectStoreRuntime({sourceOverrides});for(const [name,rows]of oldSeedRuntime.rows)seedReload.rows.set(name,new Map([...rows].map(([key,row])=>[key,seedReload.copy(row)])));
 const migratedSeed=await seedReload.store.readProject(oldSeed.job.JOB_ID);assert.equal(migratedSeed.revision,oldSeedSaved.revision+1,'JOB_POINTER_LEGACY_SEED_RECOVERY_ORACLE');for(const key of ['CURRENT_SOURCE_SET_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION','CURRENT_INSTRUCTION_VERSION','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID'])assert.equal(migratedSeed.job[key],null,'JOB_POINTER_LEGACY_SEED_RECOVERY_ORACLE: '+key);
 const importedOldSeed=await projectStoreRuntime({sourceOverrides}).store.importPackage(oldSeedBackup);assert.equal(importedOldSeed.job.CURRENT_SOURCE_SET_VERSION,null,'JOB_POINTER_LEGACY_SEED_BACKUP_ORACLE');
 const seedFresh=()=>{const r=projectStoreRuntime({sourceOverrides});for(const [name,rows]of oldSeedRuntime.rows)r.rows.set(name,new Map([...rows].map(([key,row])=>[key,r.copy(row)])));return r;};
 for(const mode of ['missing-legacy-source','wrong-source-job','different-source-value']){const rejected=seedFresh(),row=rejected.copy(rejected.rows.get('projects').get(oldSeed.job.JOB_ID)),source=row.project.projectData.migrationArchives.find(item=>item.kind==='ORIGINAL_IMPORT_PAYLOAD');if(mode==='missing-legacy-source')row.project.projectData.migrationArchives=row.project.projectData.migrationArchives.filter(item=>item!==source);else if(mode==='wrong-source-job')source.payload.jobId='DIFFERENT-SOURCE-PROJECT';else source.payload.currentVersions.sources='ACTUAL-UNALLOCATED-SOURCE-VERSION';row.projectSha256=rejected.store.projectSha256(row.project);rejected.rows.get('projects').set(oldSeed.job.JOB_ID,row);await assert.rejects(rejected.store.readProject(oldSeed.job.JOB_ID),error=>error.code==='PROJECT_INTEGRITY_FAILED','JOB_POINTER_LEGACY_SENTINEL_SCOPE_ORACLE: '+mode);const quarantined=[...rejected.rows.get('meta').values()].find(item=>item.key.startsWith('quarantine:'));assert.equal(quarantined.value.row.projectSha256,row.projectSha256,'JOB_POINTER_LEGACY_SENTINEL_REJECT_PRESERVES_SOURCE_ORACLE');}
 const failedSeed=seedFresh(),beforeSeed=await snapshot(failedSeed);failedSeed.runtime.__closedLoopStorageFault='before-transaction-commit';await assert.rejects(failedSeed.store.readProject(oldSeed.job.JOB_ID),error=>error.code==='INJECTED_STORAGE_FAILURE');assert.deepEqual(await snapshot(failedSeed),beforeSeed,'JOB_POINTER_LEGACY_SENTINEL_ABORT_ORACLE');


 assert.notDeepEqual(await snapshot(loaded),retainedBefore);
 return {status:'PASS',legacyFixture:'Documented equivalent pre-fix writer through actual acceptance/invalidation/store',checks:['cold-IDB-read','exact-old-checkpoint-bytes','repair-history-provenance','revision-and-idempotency','no-fabricated-raw-source','two-atomic-aborts-and-retry','concurrent-history-CAS','cold-export','native-backup-import-exact-source','old-checkpoint-restore','operational-journal-and-recoverable-raw-preserved','bundled-legacy-seed-durable-departure','existing-legacy-sentinel-seed-reload-and-import'],boundary:'Actual storage and backup owners with isolated transaction adapter; no native-browser or physical-device claim.'};
}
export async function verifyJobPointerIntegrityFaults(){
 const source=fs.readFileSync('workflow-engine.js','utf8'),faults=[
  ['missing-membership-check',"function jobPointerIntegrityIssues(project,{prior=null}={}){","function jobPointerIntegrityIssues(project,{prior=null}={}){return [];",'JOB_POINTER_UNKNOWN_ID_ORACLE'],
  ['current-only-latest-evidence',"recordId(records(project,'evidenceRecords',{active:false}).at(-1),'evidenceRecords')||null","recordId(recordsForCurrentScope(project,'evidenceRecords').at(-1),'evidenceRecords')||null",'JOB_POINTER_INVALIDATED_EVIDENCE_RETAINED_ORACLE'],
  ['missing-candidate-pointer',"project.job.CURRENT_ITERATION=iterationId;project.job.CURRENT_CANDIDATE_ID=candidateId;addHistory(project,'CANDIDATE_FROZEN'","project.job.CURRENT_ITERATION=iterationId;addHistory(project,'CANDIDATE_FROZEN'",'JOB_POINTER_CANDIDATE_SUPERSESSION_ORACLE'],
  ['cleared-hash-review',"project.job.CURRENT_HASH_REVIEW_ID=deriveArtifactIdentity(project).value.HASH_REVIEW_ID||project.job.CURRENT_HASH_REVIEW_ID||null;","project.job.CURRENT_HASH_REVIEW_ID=deriveArtifactIdentity(project).value.HASH_REVIEW_ID;",'JOB_POINTER_LATE_RETENTION_ORACLE'],
  ['cleared-reconciled-review',"e0.recalculate(p,{evaluateGate:gate,nextAction:next});ensure(p);","e0.recalculate(p,{evaluateGate:gate,nextAction:next});ensure(p);p.job.CURRENT_RECONCILED_REVIEW_VERSION=p.stages[26]?.status==='COMPLETE'?String(p.job.CURRENT_REVIEW_VERSION||''):'';",'JOB_POINTER_LATE_RETENTION_ORACLE'],
  ['cleared-delivery',"set(r,'deliveryRecords','DELIVERY_STATE','WITHDRAWN_FOR_FUTURE_USE');r.active=false;r.validity='SUPERSEDED';","set(r,'deliveryRecords','DELIVERY_STATE','WITHDRAWN_FOR_FUTURE_USE');r.active=false;r.validity='SUPERSEDED';if(p.job?.CURRENT_DELIVERY_ID===rid(r,'deliveryRecords'))p.job.CURRENT_DELIVERY_ID='';",'JOB_POINTER_LATE_RETENTION_ORACLE'],
  ['cleared-chain-command',"if(payload.requirementIds.length===0){recalculate(project);return","if(payload.requirementIds.length===0){recalculate(project);project.job.CURRENT_EVIDENCE_CHAIN_VERSION=null;return",'JOB_POINTER_CHAIN_COMMAND_RETENTION_ORACLE']
 ],results=[];
 for(const [name,before,after,oracle]of faults){assert.equal(source.split(before).length,2,'JOB_POINTER_FAULT_ANCHOR_ORACLE: '+name);let caught;try{await verifyJobPointerIntegrity({sourceOverrides:{'workflow-engine.js':source.replace(before,after)}});}catch(error){caught=error;}assert(caught?.message.includes(oracle),'JOB_POINTER_FAULT_DETECTION_ORACLE: '+name+' failed for '+(caught?.message||'no failure'));results.push({name,status:'DETECTED',oracle});}
 const ingestion=fs.readFileSync('response-ingestion.js','utf8'),guard="const pointerIssues=workflow.jobPointerIntegrityIssues(result.project,{prior:project});";assert.equal(ingestion.split(guard).length,2,'JOB_POINTER_ADMISSION_FAULT_ANCHOR_ORACLE');let caught;
 try{await verifyJobPointerIntegrity({sourceOverrides:{'response-ingestion.js':ingestion.replace(guard,'const pointerIssues=[];')}});}catch(error){caught=error;}
 assert(caught?.message.includes('JOB_POINTER_ADMISSION_INVALID_ORACLE'),'JOB_POINTER_ADMISSION_FAULT_DETECTION_ORACLE: '+(caught?.message||'no failure'));results.push({name:'missing-admission-pointer-validation',status:'DETECTED',oracle:'JOB_POINTER_ADMISSION_INVALID_ORACLE'});
 return results;
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
 const sourceOverrides=process.env.JOB_POINTER_ENGINE_SOURCE?{'workflow-engine.js':fs.readFileSync(process.env.JOB_POINTER_ENGINE_SOURCE,'utf8')}:{},report=await verifyJobPointerIntegrity({sourceOverrides});
 report.legacyRecovery=await verifyLegacyJobPointerRecovery({sourceOverrides});
 if(process.argv.includes('--faults'))report.faults=await verifyJobPointerIntegrityFaults();
 console.log(JSON.stringify(report));
}
