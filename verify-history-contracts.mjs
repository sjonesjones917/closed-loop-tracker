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
function preparationScopeOracle(r){
 const {core,engine,copy}=r,schema=r.runtime.closedLoopWorkflowSchema;let operations=0;
 for(const [stageText,semantic] of Object.entries(schema.SEMANTIC_STAGE_OPERATIONS)){const stage=Number(stageText);if(stage===schema.STAGE_COUNT)continue;for(const operation of [...semantic.authorOperations,...semantic.reviewOperations]){
  const p=core.createBlankState('SELECTED-OPERATION-SCOPE');engine.ensureShape(p);p.job.CURRENT_PRODUCT_ID='LATER_PRODUCT';p.job.CURRENT_ITERATION='LATER_ITERATION';p.projectData.products.push(copy({id:'LATER_PRODUCT',stage:stage+1,active:true,fields:{PRODUCT_ID:'LATER_PRODUCT'}}));p.projectData.iterations.push(copy({id:'LATER_ITERATION',stage:stage+1,active:true,fields:{ITERATION_ID:'LATER_ITERATION'}}));
  const prepared=engine.preparePromptContext(p,stage,{operation}),id=prepared.options.authorContextId||prepared.options.reviewerContextId||prepared.options.scope.contextId,context=p.projectData.freshContexts.find(row=>engine.recordId(row,'freshContexts')===id);assert.ok(context,'PREPARATION_SCOPE_ORACLE: applicable operation has no prepared context');assert.equal(JSON.stringify(context.scope).includes('LATER_'),false,'PREPARATION_SCOPE_ORACLE: preparing earlier work inherited a later execution scope');operations++;
 }}return operations;
}
const preparedOperations=preparationScopeOracle(projectStoreRuntime());note('Every semantic author/reviewer operation prepares its selected-stage scope independently of later execution scopes',{operations:preparedOperations});
const scopeFault={id:'INHERIT-LATER-EXECUTION-SCOPE',file:'workflow-engine.js',before:'globalThis.closedLoopPromptEngine.scopeFor(number,project,options.scope||{})',after:'currentScope(project)'};assert.throws(()=>preparationScopeOracle(projectStoreRuntime({fault:scopeFault})),/PREPARATION_SCOPE_ORACLE/);preparationScopeOracle(projectStoreRuntime());faults.push({id:scopeFault.id,result:'DETECTED',restored:'PASS'});
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
 const preserved=ingestion.prepare(p,{stage:1,text,promptRecord:prompt,transport:{recoverySelectionArtifactId:file.artifactId},expectedCommittedRevision:p.revision+1});assert.equal(preserved.validation.valid,true,JSON.stringify(preserved.validation.issues));p=await store.writeProject(preserved.project,{expectedProjectRevision:p.revision});assert.equal(p.projectData.acceptedChanges.length,0);const accepted=ingestion.commit(p,preserved.proposal.proposalId);assert.equal(accepted.project.projectData.responseProposals.find(row=>row.proposalId===preserved.proposal.proposalId).status,'BLOCKER_ACCEPTED');
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
const confirmationFault={id:'SKIP-PERSISTENCE-CONFIRMATION',file:'project-store.js',before:'assertMutationConfirmation(prior,project,options.mutationConfirmation);',after:'/* deliberately bypassed gate */'};
await assert.rejects(mutationOracle(projectStoreRuntime({fault:confirmationFault})),/CONFIRMATION_ORACLE/);await mutationOracle(projectStoreRuntime());faults.push({id:confirmationFault.id,result:'DETECTED',restored:'PASS'});
console.log(JSON.stringify({synthetic:true,environment:'Node VM production modules and lifecycle transaction adapter',realIndexedDB:false,cases,implementationFaults:faults},null,2));
