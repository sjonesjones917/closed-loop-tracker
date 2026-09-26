import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const cases=[],faults=[],note=(name,details={})=>cases.push({name,...details,result:'PASS'});
function contextOracle(r){
 const {core,engine,copy}=r,schema=r.runtime.closedLoopWorkflowSchema;
 for(const selected of Object.keys(schema.STAGE_CONTRACTS).map(Number)){
  const p=core.createBlankState('CONTEXT-ORACLE');engine.ensureShape(p);p._contextStage=selected;
  for(const stage of Object.keys(schema.STAGE_CONTRACTS).map(Number)){
   const token='PRIVATE_STAGE_'+stage+'_END';p.stages[stage].agentData={TOKEN:token};
   p.projectData.generatedPrompts.push(copy({stage,instructionId:'PROMPT-'+stage,prompt:token}));
   p.projectData.evidenceRecords.push(copy({stage,id:'EVIDENCE-'+stage,fields:{OBSERVATION:token}}));
  }
  if(selected<schema.STAGE_COUNT)p.projectData.evidenceRecords.push(copy({stage:selected,id:'COPIED-LATER',fields:{OBSERVATION:'PRIVATE_STAGE_'+(selected+1)+'_END'},lineage:{sourceRecordIds:['EVIDENCE-'+(selected+1)]}}));
  const before=JSON.stringify(p),context=engine.stageContext(p,selected),text=JSON.stringify(context);
  for(let stage=1;stage<=schema.STAGE_COUNT;stage++)assert.equal(text.includes('PRIVATE_STAGE_'+stage+'_END'),stage<=selected,`CONTEXT_ORACLE: stage ${selected} includes wrong information from ${stage}`);
  assert.equal(JSON.stringify(p),before,'CONTEXT_ORACLE: context construction changed project history');
 }
}
contextOracle(projectStoreRuntime());note('Every selected stage excludes all subsequent-stage sentinels, including copied records and forged projection marker',{selectedStages:30,comparedStagePairs:900,basis:'Synthetic context-boundary sentinels; not full stage execution'});
const contextFault={id:'BYPASS-CONTEXT-PROJECTION',file:'workflow-engine.js',before:'function stageContext(project,stage){',after:'function stageContext(project,stage){return project;'};
assert.throws(()=>contextOracle(projectStoreRuntime({fault:contextFault})),/CONTEXT_ORACLE/);contextOracle(projectStoreRuntime());faults.push({id:contextFault.id,result:'DETECTED',restored:'PASS'});
function metadataBoundaryOracle(r){
 const {core,engine,copy}=r,schema=r.runtime.closedLoopWorkflowSchema,prompt=r.runtime.closedLoopPromptEngine;
 const governed={sources:'CURRENT_SOURCE_SET_VERSION',research:'CURRENT_RESEARCH_VERSION',requirements:'CURRENT_REQUIREMENTS_VERSION',tests:'CURRENT_TEST_SUITE_VERSION',instructions:'CURRENT_INSTRUCTION_VERSION',products:'CURRENT_PRODUCT_VERSION'};
 for(const selected of Object.keys(schema.STAGE_CONTRACTS).map(Number)){
  const p=core.createBlankState('METADATA-BOUNDARY');engine.ensureShape(p);p.job.EXACT_USER_OBJECTIVE_VERBATIM='Preserve the selected-stage boundary.';engine.recalculate(p);
  for(const [family,key] of Object.entries(governed))if(Number(schema.RECORD_SCHEMAS[family].stage)>selected)p.job[key]='PRIVATE_'+family+'_VERSION';
  p.job.CURRENT_STATE='WORKFLOW_COMPLETE';
  const context=engine.stageContext(p,selected);assert.equal(JSON.stringify(context.job).includes('PRIVATE_'),false,'METADATA_ORACLE: subsequent-stage version escaped through job metadata');
  if(selected<schema.STAGE_COUNT)assert.notEqual(context.job.CURRENT_STATE,'WORKFLOW_COMPLETE','METADATA_ORACLE: global downstream completion escaped into selected-stage context');
 }
}
metadataBoundaryOracle(projectStoreRuntime());note('All selected-stage job metadata excludes later version pointers and global completion');
function preparationScopeOracle(r){
 const {core,engine,copy}=r,schema=r.runtime.closedLoopWorkflowSchema;let operations=0;
 for(const [stageText,semantic] of Object.entries(schema.SEMANTIC_STAGE_OPERATIONS)){const stage=Number(stageText);if(stage===schema.STAGE_COUNT)continue;for(const operation of [...semantic.authorOperations,...semantic.reviewOperations]){
  const p=core.createBlankState('SELECTED-OPERATION-SCOPE');engine.ensureShape(p);p.job.CURRENT_PRODUCT_ID='LATER_PRODUCT';p.job.CURRENT_ITERATION='LATER_ITERATION';p.projectData.products.push(copy({id:'LATER_PRODUCT',stage:stage+1,active:true,fields:{PRODUCT_ID:'LATER_PRODUCT'}}));p.projectData.iterations.push(copy({id:'LATER_ITERATION',stage:stage+1,active:true,fields:{ITERATION_ID:'LATER_ITERATION'}}));
  const prepared=engine.preparePromptContext(p,stage,{operation}),id=prepared.options.authorContextId||prepared.options.reviewerContextId||prepared.options.scope.contextId,context=p.projectData.freshContexts.find(row=>engine.recordId(row,'freshContexts')===id);assert.ok(context,'PREPARATION_SCOPE_ORACLE: applicable operation has no prepared context');assert.equal(JSON.stringify(context.scope).includes('LATER_'),false,'PREPARATION_SCOPE_ORACLE: preparing earlier work inherited a later execution scope');operations++;
 }}return operations;
}
const preparedOperations=preparationScopeOracle(projectStoreRuntime());note('Every semantic author/reviewer operation prepares its selected-stage scope independently of later execution scopes',{operations:preparedOperations});
const scopeFault={id:'INHERIT-LATER-EXECUTION-SCOPE',file:'workflow-engine.js',before:'operationScope(target,number,operation,options.scope||{},{reserveTargets:true})',after:'currentScope(project)'};assert.throws(()=>preparationScopeOracle(projectStoreRuntime({fault:scopeFault})),/PREPARATION_SCOPE_ORACLE/);preparationScopeOracle(projectStoreRuntime());faults.push({id:scopeFault.id,result:'DETECTED',restored:'PASS'});
async function pendingCandidate(r){
 const {store,core,engine,prompts,ingestion,copy}=r,schema=r.runtime.closedLoopWorkflowSchema;
 let p=core.createBlankState('RESTORED-CANDIDATE');engine.ensureShape(p);engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:0});
 const prompt=prompts.buildPromptRecord(1,p),envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:1,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'external-unavailable',kind:'MISSING_CAPABILITY',description:'Synthetic missing external observation',whyBlocking:'Observation has not occurred.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};
 p.projectData.generatedPrompts.push(prompt);const prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope),promptRecord:prompt,expectedProjectRevision:p.revision+1});assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation));
 p=await store.writeProject(prepared.project,{expectedProjectRevision:p.revision});const proposal=prepared.proposal,checkpoint=(await store.historyList(p.job.JOB_ID)).activeId;
 const accepted=ingestion.commit(p,proposal.proposalId);p=await store.writeProject(accepted.project,{expectedProjectRevision:p.revision});
 p=(await store.restoreCheckpoint(p.job.JOB_ID,checkpoint,{expectedProjectRevision:p.revision})).project;
 assert.equal(ingestion.findProposal(p,proposal.proposalId).status,'PENDING_OPERATOR_REVIEW');
 assert.equal(ingestion.validateEnvelope(p,copy(envelope),{stage:1,promptRecord:prompt,rawSha256:'different-new-response'}).issues.some(issue=>issue.code==='STALE_PROJECT_VERSION'),true);
 const result=ingestion.commit(p,proposal.proposalId);assert.equal(result.idempotent,false);assert.equal(result.project.projectData.responseProposals.find(row=>row.proposalId===proposal.proposalId).status,'BLOCKER_ACCEPTED');
 return {p,proposal,checkpoint};
}
await pendingCandidate(projectStoreRuntime());note('Restored pending candidate stays unaccepted; retained bytes revalidate locally; new abandoned-operation response rejects');
async function selectedResponseRecovery(r){
 const {store,core,engine,prompts,ingestion}=r,schema=r.runtime.closedLoopWorkflowSchema;let p=core.createBlankState('UNVALIDATED-SELECTION');engine.ensureShape(p);engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:0});const prompt=prompts.buildPromptRecord(1,p);p.projectData.generatedPrompts.push(prompt);p=await store.writeProject(p,{expectedProjectRevision:p.revision});
 const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:1,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'external-unavailable',kind:'MISSING_CAPABILITY',description:'Synthetic missing external observation',whyBlocking:'Observation has not occurred.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]},text=JSON.stringify(envelope),file=await store.putArtifact({jobId:p.job.JOB_ID,artifactId:'SAVED-RESPONSE-FILE',blob:new Blob([text]),filename:'response.json',mediaType:'application/json',lineage:{stage:1,role:'FILE_SELECTION_RECOVERY',selectionKind:'response',promptId:prompt.instructionId}}),view=r.copy({activeStage:1,activeView:'Workflow',fileSelections:{response:{kind:'response',jobId:p.job.JOB_ID,stage:1,promptId:prompt.instructionId,files:[{artifactId:file.artifactId,filename:file.filename,mediaType:file.mediaType,byteSize:file.byteSize,sha256:file.sha256}]}}});
 const checkpoint=await store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,view});p.job.JOB_TITLE='Another continuation';p=await store.writeProject(p,{expectedProjectRevision:p.revision});p=(await store.restoreCheckpoint(p.job.JOB_ID,checkpoint,{expectedProjectRevision:p.revision})).project;
 assert.equal(p.projectData.rawResponses.length,0);assert.equal(p.projectData.responseProposals.length,0);
 const delayed=ingestion.prepare(p,{stage:1,text,promptRecord:prompt});assert.ok(delayed.validation.issues.some(issue=>issue.code==='STALE_PROJECT_VERSION'),'A newly arriving response reused retained file permission');
 const preserved=ingestion.prepare(p,{stage:1,text,promptRecord:prompt,transport:{recoverySelectionArtifactId:file.artifactId},expectedCommittedRevision:p.revision});assert.equal(preserved.validation.valid,true,JSON.stringify(preserved.validation.issues));p=await store.writeProject(preserved.project,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,operational:true});assert.equal(p.projectData.acceptedChanges.length,0);const accepted=ingestion.commit(p,preserved.proposal.proposalId);assert.equal(accepted.project.projectData.responseProposals.find(row=>row.proposalId===preserved.proposal.proposalId).status,'BLOCKER_ACCEPTED');
}
await selectedResponseRecovery(projectStoreRuntime());note('Restored unvalidated file progresses only through its saved exact-byte permission; an arriving response stays stale');
async function mutationOracle(r){
 const {store,core,engine,copy}=r;let p=core.createBlankState('MUTATION-CONFIRMATION');engine.ensureShape(p);engine.recalculate(p);
 // An accepted sentinel tests persistence's independent replacement gate. It
 // does not claim any stage gate was completed by this synthetic state.
 p.projectData.acceptedChanges.push(copy({changeId:'ACCEPTED-SENTINEL',stage:1,operation:'COMPLETE',active:true}));
 p=await store.writeProject(p,{expectedProjectRevision:0});const next=copy(p);next.projectData.acceptedChanges[0].invalidatedBy='CORRECTION';
 const impact=store.mutationImpact(p,next),before=JSON.stringify(await store.readProject(p.job.JOB_ID));assert.equal(impact.requiresConfirmation,true);
 let rejected=false;try{await store.writeProject(next,{expectedProjectRevision:p.revision});}catch(error){rejected=error.code==='MUTATION_CONFIRMATION_REQUIRED';}assert.equal(rejected,true,'CONFIRMATION_ORACLE: unconfirmed invalidation committed');assert.equal(JSON.stringify(await store.readProject(p.job.JOB_ID)),before);
 const changed=copy(next);changed.job.JOB_TITLE='Different candidate';await assert.rejects(store.writeProject(changed,{expectedProjectRevision:p.revision,mutationConfirmation:impact}),error=>error.code==='MUTATION_CONFIRMATION_REQUIRED');
 const committed=await store.writeProject(next,{expectedProjectRevision:p.revision,mutationConfirmation:impact});assert.equal(committed.projectData.acceptedChanges[0].invalidatedBy,'CORRECTION');
}
await mutationOracle(projectStoreRuntime());note('Unconfirmed and stale-confirmation mutations reject; exact confirmed change commits');
async function pendingCorrectionRecovery(r){
 const {store,core,engine,copy}=r;let p=core.createBlankState('PENDING-CORRECTION-RECOVERY');engine.ensureShape(p);engine.recalculate(p);p.projectData.acceptedChanges.push(copy({changeId:'ACCEPTED-PRIOR',stage:1,operation:'COMPLETE',active:true}));p=await store.writeProject(p,{expectedProjectRevision:0});
 const next=copy(p);next.projectData.acceptedChanges[0].invalidatedBy='CORRECTION';const view=copy({activeView:'Workflow',activeStage:1,drafts:{},pendingMutation:{baseProjectSha256:p.projectSha256,next,impact:store.mutationImpact(p,next),expectedProjectRevision:p.revision}}),id=await store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,view});
 const restored=await store.restoreCheckpoint(p.job.JOB_ID,id,{expectedProjectRevision:p.revision}),rebound=store.rebaseHistoryView(restored.project,restored.view);assert.equal(rebound.pendingMutation.expectedProjectRevision,restored.project.revision);assert.equal(restored.project.projectData.acceptedChanges[0].invalidatedBy,undefined);await assert.rejects(store.writeProject(rebound.pendingMutation.next,{expectedProjectRevision:restored.project.revision}),error=>error.code==='MUTATION_CONFIRMATION_REQUIRED');
 await store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:restored.project.revision,view:rebound});const exported=await store.exportPackage(p.job.JOB_ID),fresh=projectStoreRuntime(),imported=await fresh.store.importPackage(exported),importedView=await fresh.store.readHistoryView(p.job.JOB_ID);assert.ok(importedView.pendingMutation);assert.equal(imported.projectData.acceptedChanges[0].invalidatedBy,undefined);assert.equal(importedView.pendingMutation.baseProjectSha256,imported.projectSha256);await assert.rejects(fresh.store.writeProject(importedView.pendingMutation.next,{expectedProjectRevision:imported.revision}),error=>error.code==='MUTATION_CONFIRMATION_REQUIRED');const accepted=await fresh.store.writeProject(importedView.pendingMutation.next,{expectedProjectRevision:imported.revision,mutationConfirmation:importedView.pendingMutation.impact});assert.equal(accepted.projectData.acceptedChanges[0].invalidatedBy,'CORRECTION');
}
await pendingCorrectionRecovery(projectStoreRuntime());note('Pending correction restores and imports as an unconfirmed exact candidate with a fresh confirmation binding');
async function exportedScopeOracle(r){
 const {core,engine,store,copy}=r,promptEngine=r.runtime.closedLoopPromptEngine;const sentinel=core.createBlankState('PROMPT-ITERATION-METADATA');engine.ensureShape(sentinel);sentinel.job.EXACT_USER_OBJECTIVE_VERBATIM='Current human intent';sentinel.job.CURRENT_ITERATION='LATER_ITERATION_PRIVATE';engine.recalculate(sentinel);const generated=promptEngine.reserveAndBuildPromptRecord(sentinel,1,{operation:'COMPLETE'},{iteration:'LATER_ITERATION_PRIVATE'}).prompt;assert.equal(generated.iteration,'NOT APPLICABLE','PROMPT_METADATA_ORACLE: earlier prompt inherits a later iteration outside its governing scope');let p=core.createBlankState('EXPORTED-SCOPE');engine.ensureShape(p);p.job.EXACT_USER_OBJECTIVE_VERBATIM='Produce an exact text file.';engine.recalculate(p);const prepared=engine.preparePromptContext(p,1,{operation:'COMPLETE'}),prompt=promptEngine.buildPromptRecord(1,prepared.project,prepared.options);p.projectData.generatedPrompts.push(prompt);p=await store.writeProject(p,{expectedProjectRevision:0});const bundle=await store.createExecutionPackage({project:p,stage:1,operation:'COMPLETE'}),manifest=promptEngine.promptFileManifest(prompt);assert.deepEqual(copy(bundle.manifest.scope),copy(manifest.scope),'EXPORT_SCOPE_ORACLE: consolidated manifest omitted the exact response scope');assert.equal(bundle.manifest.contractProfileId,manifest.contractProfileId);
}
await exportedScopeOracle(projectStoreRuntime());note('Consolidated stage export includes the same authoritative response scope and profile as its instruction manifest');
const promptMetadataFault={id:'INHERIT-GLOBAL-PROMPT-ITERATION',file:'prompt-engine.js',before:"iteration:candidate.scope?.iterationId||'NOT APPLICABLE'",after:"iteration:metadata.iteration??state?.job?.CURRENT_ITERATION??'NOT APPLICABLE'"};await assert.rejects(exportedScopeOracle(projectStoreRuntime({fault:promptMetadataFault})),/PROMPT_METADATA_ORACLE/);await exportedScopeOracle(projectStoreRuntime());faults.push({id:promptMetadataFault.id,result:'DETECTED',restored:'PASS'});

const confirmationFault={id:'SKIP-PERSISTENCE-CONFIRMATION',file:'project-store.js',before:'assertMutationConfirmation(prior,project,options.mutationConfirmation,next);',after:'/* deliberately bypassed gate */'};
await assert.rejects(mutationOracle(projectStoreRuntime({fault:confirmationFault})),/CONFIRMATION_ORACLE/);await mutationOracle(projectStoreRuntime());faults.push({id:confirmationFault.id,result:'DETECTED',restored:'PASS'});
console.log(JSON.stringify({synthetic:true,environment:'Node VM production modules and lifecycle transaction adapter',realIndexedDB:false,cases,implementationFaults:faults},null,2));
