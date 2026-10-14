import assert from 'node:assert/strict';
import {recordProposal,evidence} from './test-fixtures.mjs';
import {reservationScopeFixture} from './test-reservation-scope-fixture.mjs';
import {responseFixture,OBJECTIVE} from './operator-journey-fixtures.mjs';

// Isolated downstream fixture: the reserved author/reviewer contracts are real;
// earlier execution bodies and stage status projections are controlled inputs.
export function reservedReleasePrerequisiteFixture(runtime,jobId){
  const {core,schema,engine}=runtime;
  const p=core.createBlankState(jobId);
  Object.assign(p.job,{JOB_TITLE:'Isolated release-binding proof',EXACT_USER_OBJECTIVE_VERBATIM:OBJECTIVE});
  engine.ensureShape(p);
  p.activeStage=27;
  p.job.CURRENT_STAGE='27';
  for(let stage=1;stage<=26;stage++){
    p.stages[stage].status='COMPLETE';
    p.stages[stage].gate={complete:true,blocked:false,reasons:[]};
  }
  {
    // The earlier execution bodies remain explicit isolated prerequisites.
    // Author/reviewer authority is exercised through real reserved ingestion.
    const intake=acceptReservedSemanticFixture(runtime,p,1,'COMPLETE',null);
    const priorStages=engine.clone(p.stages);
    engine.recordStageConfirmation(p,1,true,'Controlled intake confirmed','RELEASE_BINDING_FIXTURE',{acceptedChangeId:intake.changeId,inputVersion:p.job.CURRENT_INPUT_VERSION,instructionId:intake.promptId,contextSignature:intake.contextSignature,operatorLabel:'RELEASE_BINDING_FIXTURE'});
    restoreStageProjections(p,priorStages);
    const discovery=installScopeReferences(runtime,p,19,'COMPARE');
    acceptReservedSemanticFixture(runtime,p,19,'COMPARE',{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'release-discovery-review',overrides:{REVIEW_QUESTION:'Does the exact accepted intake remain represented?',FINDING:'The closed release-binding fixture introduces no new user requirement.',REASONING:'Compared the actual accepted intake and current controlled scope references. This is an isolated fixture, not a complete execution journey.',RESULT:'ACCEPTED'}})]},discovery);
    const auditScope=installScopeReferences(runtime,p,26,'COMPLETE');
    acceptReservedSemanticFixture(runtime,p,26,'COMPLETE',null,auditScope);
    reviewReleaseAuditsFixture(runtime,p);
    assertReleaseSemanticPrerequisites(runtime,p);
  }
  return p;
}

function installScopeReferences(runtime,p,stage,operation){
  const {core,schema,engine}=runtime;
  const contract=schema.STAGE_OPERATION_REGISTRY[stage+':'+operation],fixture=reservationScopeFixture({...runtime,engine:{...engine,refreshRecordHashes:(row,family)=>Object.assign(row,engine.refreshRecordHashes(engine.clone(row),family))}},contract,{jobId:p.job.JOB_ID});
  for(const [key,field]of Object.entries({sourceConvergedIterationId:'CURRENT_ITERATION',confirmationIterationId:'CURRENT_ITERATION',candidateId:'CURRENT_CANDIDATE_ID',requirementsVersion:'CURRENT_REQUIREMENTS_VERSION',testSuiteVersion:'CURRENT_TEST_SUITE_VERSION',instructionVersion:'CURRENT_INSTRUCTION_VERSION',baselineId:'CURRENT_BASELINE_ID',productId:'CURRENT_PRODUCT_ID',productVersion:'CURRENT_PRODUCT_VERSION',deliveryCandidateSetId:'CURRENT_DELIVERY_CANDIDATE_SET_ID'}))if(Object.hasOwn(contract.scope.dimensions,key)&&fixture.scope[key])p.job[field]=fixture.scope[key];
  for(const [family,rows]of Object.entries(fixture.project.projectData))if(Array.isArray(rows))for(const row of rows){const record=engine.clone(row);record.scope=engine.clone({...engine.currentScope(p),...(family==='iterations'?{iterationId:record.id}:{})});engine.refreshRecordHashes(record,family);p.projectData[family].push(record);}
  return fixture.scope;
}

export function acceptReservedSemanticFixture(runtime,p,stage,operation,records,scope={}){
  const {schema,engine,prompts,ingestion}=runtime;
  const priorStages=engine.clone(p.stages),{prompt}=prompts.reserveAndBuildPromptRecord(p,stage,{operation,scope});
  const envelope=records?{schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage,operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records,evidence:[evidence('isolated-release-prerequisite-review')],unresolved:[],warnings:[],attachments:[]}:responseFixture({schema,engine,prompt,manifest:prompts.promptFileManifest(prompt),instructionBytes:Buffer.from(prompt.prompt),contextFiles:prompts.materializePromptContextFiles(prompt,p).map(file=>({bytes:Buffer.from(file.text)}))});
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord:prompt,transport:{packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});
  assert.equal(prepared.validation.valid,true,'RELEASE_PREREQUISITE_INTAKE_ORACLE: '+JSON.stringify(prepared.validation.issues));
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{replacementConfirmation:ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId)});
  Object.assign(p,committed.project);restoreStageProjections(p,priorStages);
  return committed.acceptedChange;
}
function restoreStageProjections(p,priorStages){for(const[key,prior]of Object.entries(priorStages)){p.stages[key].status=prior.status;p.stages[key].gate=prior.gate;}}

export function reviewReleaseAuditsFixture(runtime,p){return acceptReservedSemanticFixture(runtime,p,26,'SEMANTIC_REVIEW',null);}
export function assertReleaseSemanticPrerequisites(runtime,p){const {engine}=runtime;for(const stage of[19,26]){const state=engine.semanticReviewCompletion(p,stage);assert.equal(state.complete,true,'RELEASE_SEMANTIC_PREREQUISITE_ORACLE: Stage '+stage+' '+state.reasons.join(' '));}}

// Actual accepted lifecycle input, copied only for negative controls. These
// edits do not create replacement reviews, observations or favorable receipts.
export function verifyActualReleaseProofControls({engine,hash},project){
 const original=hash.sha256Value(project),metrics=engine.releaseMetrics(project),cases=[];
 assert.equal(metrics.determination,'ACCEPTED','RELEASE_ACTUAL_DUE_UNIVERSE_ORACLE');
 assert.equal(metrics.requirementProofs.length,metrics.mandatoryRequirementCount,'RELEASE_COMPLETE_REQUIREMENT_UNIVERSE_ORACLE');
 assert.equal(metrics.satisfied+metrics.violated+metrics.undetermined+metrics.scheduledRequirementIds.length,metrics.mandatoryRequirementCount,'RELEASE_DISJOINT_EXHAUSTIVE_OUTCOME_PARTITION_ORACLE');
 assert.equal(new Set(metrics.requirementProofs.map(row=>row.requirementId)).size,metrics.mandatoryRequirementCount,'RELEASE_UNIQUE_REQUIREMENT_CLASSIFICATIONS_ORACLE');
 for(const [classification,count]of [['SATISFIED',metrics.satisfied],['VIOLATED',metrics.violated],['UNDETERMINED',metrics.undetermined],['SCHEDULED',metrics.scheduledRequirementIds.length]])assert.equal(metrics.requirementProofs.filter(row=>row.releaseClassification===classification).length,count,'RELEASE_EXACT_OUTCOME_CLASSIFICATION_ORACLE: '+classification);
 assert.equal(metrics.satisfied,metrics.mandatoryRequirementCount,'RELEASE_ACTUAL_AFFIRMATIVE_COUNTS_ORACLE');
 for(const proof of metrics.requirementProofs){
  assert.equal(proof.classification,'SATISFIED');assert.equal(proof.truth,'TRUE');assert(proof.proofObligationId);assert(proof.leaves.length);
  const requirementId=proof.requirementId,propositionId=proof.propositionId,expressionId=engine.recordValue(engine.recordsForCurrentScope(project,'proofObligations').find(row=>row.id===proof.proofObligationId),'PROOF_EXPRESSION_ID');
  const reject=(caseId,mutate)=>{const copy=engine.clone(project);mutate(copy);const requirement=copy.projectData.requirements.find(row=>row.id===requirementId),actual=engine.releaseRequirementProof(copy,requirement,27);assert.equal(actual.classification,'UNDETERMINED',caseId);cases.push({caseId:caseId+':'+requirementId,result:'PASS'});};
  const boundObligation=project.projectData.proofObligations.find(row=>row.id===proof.proofObligationId),preimage='RELEASE_PROOF_OBLIGATION_SOURCE/1',originalObligationHash=hash.hashRegistered(preimage,boundObligation);
  const selfOnly=engine.clone(boundObligation);for(const field of ['CURRENT_SCOPE_HASH','PROOF_OBLIGATION_SET_HASH'])selfOnly.fields[field]=selfOnly[field]='self-allocation-summary-control';for(const field of ['updatedAt','contentSha256','recordSha256','sha256'])selfOnly[field]='self-allocation-bookkeeping-control';assert.equal(hash.hashRegistered(preimage,selfOnly),originalObligationHash,'RELEASE_EXACT_SELF_SUMMARY_PREIMAGE_ORACLE');
  for(const field of ['PROOF_OBLIGATION_ID','REQUIREMENT_ID','PROPOSITION_ID','PROOF_EXPRESSION_ID','NORMATIVE_CLASS','APPLICABILITY','REQUIRED_TEST_IDS','REQUIRED_EVIDENCE_CLASSES','ALLOWED_EPISTEMIC_BASES','REQUIRED_ARTIFACT_IDS','REQUIRED_DEPENDENCY_IDS','FRESHNESS_REQUIREMENTS','INDEPENDENCE_REQUIREMENTS','SATISFACTION_STATE','BLOCKING_REASONS','TIMING_ENTRIES','TIMING_SCHEDULE_SHA256']){const changed=engine.clone(boundObligation),prior=changed.fields[field];changed.fields[field]=changed[field]=Array.isArray(prior)?[...prior,'MATERIAL-CONTROL']:String(prior??'')+'-MATERIAL-CONTROL';assert.notEqual(hash.hashRegistered(preimage,changed),originalObligationHash,'RELEASE_SUBSTANTIVE_OBLIGATION_FIELD_BOUND: '+field);}
  for(const field of ['id','active','validity','createdAt','unknownExtension']){const changed=engine.clone(boundObligation);changed[field]=field==='active'?false:String(changed[field]??'')+'-MATERIAL-CONTROL';assert.notEqual(hash.hashRegistered(preimage,changed),originalObligationHash,'RELEASE_OBLIGATION_LIFECYCLE_EXTENSION_BOUND: '+field);}
  const originalReleaseInput=engine.releaseCalculation(project).inputSha256;
  for(const action of ['ADD','REMOVE']){const changed=engine.clone(project);if(action==='REMOVE')changed.projectData.proofObligations=changed.projectData.proofObligations.filter(row=>row.id!==proof.proofObligationId);else{const added=engine.clone(boundObligation);added.id=added.PROOF_OBLIGATION_ID=added.fields.PROOF_OBLIGATION_ID='ADDED-MATERIAL-OBLIGATION';changed.projectData.proofObligations.push(added);}assert.notEqual(engine.releaseCalculation(changed).inputSha256,originalReleaseInput,'RELEASE_OBLIGATION_'+action+'_CHANGES_CURRENT_INPUT');cases.push({caseId:'RELEASE_OBLIGATION_'+action+':'+requirementId,result:'PASS'});}
  const changedScope=engine.clone(boundObligation);changedScope.scope={...changedScope.scope,candidateId:'MATERIAL-CANDIDATE'};assert.notEqual(hash.hashRegistered(preimage,changedScope),originalObligationHash,'RELEASE_OBLIGATION_SCOPE_BOUND');cases.push({caseId:'RELEASE_PRECISE_OBLIGATION_PREIMAGE:'+requirementId,result:'PASS',substantiveFields:17});
  reject('RELEASE_MISSING_PRIMARY',p=>{p.projectData.propositions=p.projectData.propositions.filter(row=>row.id!==propositionId);});
  reject('RELEASE_DUPLICATE_PRIMARY',p=>{p.projectData.propositions.push(engine.clone(p.projectData.propositions.find(row=>row.id===propositionId)));});
  reject('RELEASE_PRIMARY_WRONG_SCOPE',p=>{p.projectData.propositions.find(row=>row.id===propositionId).scope.inputVersion='UNREGISTERED-INPUT';});
  reject('RELEASE_MISSING_EXPRESSION',p=>{p.projectData.proofExpressions=p.projectData.proofExpressions.filter(row=>row.id!==expressionId);});
  reject('RELEASE_DUPLICATE_EXPRESSION',p=>{p.projectData.proofExpressions.push(engine.clone(p.projectData.proofExpressions.find(row=>row.id===expressionId)));});
  reject('RELEASE_MISSING_OBLIGATION',p=>{p.projectData.proofObligations=p.projectData.proofObligations.filter(row=>row.id!==proof.proofObligationId);});
  reject('RELEASE_DUPLICATE_OBLIGATION',p=>{p.projectData.proofObligations.push(engine.clone(p.projectData.proofObligations.find(row=>row.id===proof.proofObligationId)));});
  reject('RELEASE_OBLIGATION_EXPRESSION_MISMATCH',p=>{const row=p.projectData.proofObligations.find(row=>row.id===proof.proofObligationId);row.fields.PROOF_EXPRESSION_ID=row.PROOF_EXPRESSION_ID='UNREGISTERED-EXPRESSION';});
  reject('RELEASE_UNKNOWN_NORMATIVE_CLASS',p=>{const row=p.projectData.requirements.find(row=>row.id===requirementId);row.fields.MANDATORY_OPTIONAL_STATUS=row.MANDATORY_OPTIONAL_STATUS='UNKNOWN';});
  reject('RELEASE_MISSING_ACCEPTED_ENTAILMENT',p=>{p.projectData.entailmentReviews=p.projectData.entailmentReviews.filter(row=>engine.recordValue(row,'TARGET_PROPOSITION_ID')!==propositionId);});
  reject('RELEASE_STALE_ACCEPTED_TRANSPORT',p=>{for(const row of p.projectData.entailmentReviews.filter(row=>engine.recordValue(row,'TARGET_PROPOSITION_ID')===propositionId))row.rawResponseId='UNREGISTERED-RAW';});
  reject('RELEASE_CHANGED_REVIEWED_TIMING',p=>{const id=proof.leaves.find(row=>row.subjectFamily==='tests')?.subjectId;if(!id)throw new Error('Actual release control requires a reviewed test leaf.');const row=p.projectData.tests.find(row=>row.id===id);row.fields.REQUIRED_BY_STAGE=row.REQUIRED_BY_STAGE=Number(engine.recordValue(row,'REQUIRED_BY_STAGE'))+1;});
 }
 for(const [stage,family]of [[22,'deterministicResults'],[23,'meaningResults'],[24,'adversarialResults']]){
  const copy=engine.clone(project);assert(engine.finalProductTestSelection(copy,stage).tests.length,'RELEASE_DUE_FINAL_TEST_FIXTURE_ORACLE');const unavailable=engine.clone(project),product=unavailable.projectData.products.find(row=>row.id===unavailable.job.CURRENT_PRODUCT_ID);product.fields.STATUS=product.STATUS='PENDING';const unavailableMetrics=engine.releaseMetrics(unavailable),selection=engine.finalProductTestSelection(unavailable,stage,{evaluationStage:27});for(const test of selection.requiredTests){const id=engine.recordValue(test,'REQ_ID'),proof=unavailableMetrics.requirementProofs.find(row=>row.requirementId===id);assert(proof.finalTestBlockers.some(row=>row.testId===test.id),'RELEASE_EXISTING_RESULT_UNAVAILABLE_TARGET_BLOCKER_'+stage);assert.equal(proof.releaseClassification,'UNDETERMINED','RELEASE_EXISTING_RESULT_NOT_AFFIRMATIVE_WITHOUT_TARGET_'+stage);}assert.equal(unavailable.projectData[family].length,project.projectData[family].length,'RELEASE_PRIOR_RESULT_RETAINED_'+stage);cases.push({caseId:'RELEASE_PRIOR_SATISFIED_RESULT_TARGET_UNAVAILABLE_'+stage,result:'PASS'});copy.projectData[family]=[];assert.notEqual(engine.releaseMetrics(copy).determination,'ACCEPTED','RELEASE_DUE_FINAL_TEST_MISSING_'+stage);cases.push({caseId:'RELEASE_DUE_FINAL_TEST_MISSING_'+stage,result:'PASS'});
 }
 assert.equal(hash.sha256Value(project),original,'RELEASE_NEGATIVES_PRESERVE_ACTUAL_PROJECT');
 return {result:'PASS',scope:'Actual accepted lifecycle due-proof controls; no replacement acceptance was manufactured.',mandatoryRequirementCount:metrics.mandatoryRequirementCount,cases};
}

// Actual completed release command, transferred with original byte/context
// custody to the existing isolated transaction adapter. No prefix is invented.
export async function verifyActualReleasePersistence({sourceProject,sourcePrompts,artifacts,onCheckpoint=null}){
 const {projectStoreRuntime,restoreArtifactFixture}=await import('./test-project-store-runtime.mjs'),r=projectStoreRuntime({storageWorker:false}),e=r.engine,h=r.runtime.closedLoopHash,p=r.copy(sourceProject),sourceHash=h.sha256Value(p);
 await restoreArtifactFixture(r.store,artifacts);
 const contexts=sourceProject.projectData.generatedPrompts.map(row=>({instructionId:row.instructionId||row.promptId,files:sourcePrompts.materializePromptContextFiles(row)}));
 for(const entry of contexts){const row=p.projectData.generatedPrompts.find(row=>(row.instructionId||row.promptId)===entry.instructionId);assert(row,'RELEASE_PERSISTENCE_ORIGINAL_PROMPT_ID');r.prompts.retainPromptContextFiles(row,r.copy(entry.files));r.prompts.materializePromptContextFiles(row);await r.store.persistPromptContextFiles(row,p);}
 assert.equal(h.sha256Value(p),sourceHash,'RELEASE_PERSISTENCE_CUSTODY_PRESERVES_CANONICAL_SOURCE');
 const record=p.projectData.releaseRecords.find(row=>row.id===p.job.CURRENT_RELEASE_ID),originalRelease=h.stableStringify(record),originalRaw=h.stableStringify(p.projectData.rawResponses),originalHistory=h.stableStringify(p.projectData.history);
 assert(record&&record.derivationReceipt.derivationId==='closed-loop-derivation/stage27-release/4','RELEASE_PERSISTENCE_CURRENT_OWNER');assert.equal(e.releaseRecordMatchesBinding(record,e.releaseBinding(p)),true,'RELEASE_PERSISTENCE_ORIGINAL_CURRENT');assert.equal(e.gate(27,p).complete,true,'RELEASE_PERSISTENCE_ORIGINAL_GATE');
 const retryHash=h.sha256Value(p);e.recordReleaseDetermination(p);assert.equal(h.sha256Value(p),retryHash,'RELEASE_EXACT_RETRY_PRESERVES_PROJECT');
 if(onCheckpoint)await onCheckpoint({label:'release-before-public-save',r,project:p,captureKind:'UNSAVED_COMMAND_RESULT_WITH_ISOLATED_ADAPTER'});
 const saved=await r.store.writeProject(p,{createOnly:true,expectedProjectRevision:0,incrementRevision:false}),savedHash=h.sha256Value(saved);for(const entry of contexts){const row=saved.projectData.generatedPrompts.find(row=>(row.instructionId||row.promptId)===entry.instructionId);assert(row);r.prompts.retainPromptContextFiles(row,r.copy(entry.files));r.prompts.materializePromptContextFiles(row);}assert.equal(h.sha256Value(saved),savedHash,'RELEASE_SAVED_CONTEXT_HYDRATION_PRESERVES_PROJECT');
 if(onCheckpoint)await onCheckpoint({label:'release-public-saved',r,project:saved,captureKind:'PUBLIC_SAVED_PROJECT'});
 const cold=await r.store.readProject(saved.job.JOB_ID),coldHash=h.sha256Value(cold);for(const entry of contexts){const row=cold.projectData.generatedPrompts.find(row=>(row.instructionId||row.promptId)===entry.instructionId);assert(row);r.prompts.retainPromptContextFiles(row,r.copy(entry.files));r.prompts.materializePromptContextFiles(row);}assert.equal(h.sha256Value(cold),coldHash,'RELEASE_COLD_CONTEXT_HYDRATION_PRESERVES_PROJECT');
 if(onCheckpoint)await onCheckpoint({label:'release-public-cold',r,project:cold,captureKind:'PUBLIC_SAVED_AND_COLD_READ'});
 assert.equal(r.store.validateProjectIntegrity(cold).valid,true,'RELEASE_PUBLIC_COLD_INTEGRITY');const current=cold.projectData.releaseRecords.find(row=>row.id===cold.job.CURRENT_RELEASE_ID);assert.equal(h.stableStringify(current),originalRelease,'RELEASE_PUBLIC_COLD_EXACT_RECORD');assert.equal(h.stableStringify(cold.projectData.rawResponses),originalRaw,'RELEASE_PUBLIC_COLD_EXACT_RAW');assert.equal(h.stableStringify(cold.projectData.history),originalHistory,'RELEASE_PUBLIC_COLD_EXACT_HISTORY');assert.equal(e.releaseRecordMatchesBinding(current,e.releaseBinding(cold)),true,'RELEASE_PUBLIC_COLD_CURRENT');assert.equal(e.gate(27,cold).complete,true,'RELEASE_PUBLIC_COLD_GATE');assert.equal(h.sha256Value(r.copy(sourceProject)),sourceHash,'RELEASE_ISOLATED_STORE_PRESERVES_CALLER');
 return {result:'PASS',basis:'Actual accepted synthetic lifecycle release command and original byte/context custody; isolated existing transaction adapter, not browser execution.',releaseId:record.id,sourceProjectSha256:sourceHash,savedProjectSha256:cold.projectSha256,revision:cold.revision,cases:['exact-current-release-command','exact-retry-project-stability','public-save-and-cold-integrity','retained-release-raw-history-bytes','current-release-and-gate-after-cold-read']};
}
