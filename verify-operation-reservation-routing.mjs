import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const engine=globalThis.closedLoopWorkflowEngine;
const hash=globalThis.closedLoopHash;

function project(jobId){
  const value=core.createBlankState(jobId);
  Object.assign(value.job,{
    EXACT_USER_OBJECTIVE_VERBATIM:'Exercise deterministic workflow operation routing.',
    CURRENT_INPUT_VERSION:'INPUT-v001',
    CURRENT_SOURCE_SET_VERSION:'SOURCE-v001',
    CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',
    CURRENT_TEST_SUITE_VERSION:'TEST-v001',
    CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'
  });
  engine.ensureShape(value);
  return value;
}

function reservationFixture(jobId,instructionId='INSTRUCTION-A'){
  const value=project(jobId);
  value.revision=5;
  const scope=engine.currentScope(value);
  assert.throws(()=>engine.reserveOperation(value,{stage:1,operation:'COMPLETE',targetSlot:'STAGE-01-COMPLETE',promptIdentity:'',expectedRevision:5,promptProjectRevision:7,scope}),/PROMPT_IDENTITY|prompt identity/i);
  const reservation=engine.reserveOperation(value,{
    stage:1,
    operation:'COMPLETE',
    targetSlot:'STAGE-01-COMPLETE',
    packageId:'PACKAGE-A',
    packageManifestHash:'a'.repeat(64),
    promptIdentity:instructionId,
    contextSignature:'CONTEXT-A',
    expectedRevision:5,
    promptProjectRevision:7,
    owningBrowserTabInstance:'TAB-A',
    scope
  });
  const reservationId=engine.recordId(reservation,'operationReservations');
  const nonce=String(engine.recordValue(reservation,'CHALLENGE_NONCE'));
  const boundScope=engine.clone(engine.recordValue(reservation,'SCOPE'));
  assert.equal(engine.recordValue(reservation,'EXPECTED_REVISION'),7,'Reservation did not bind the future prompt commit revision separately from the command CAS revision.');
  assert.equal(boundScope.projectRevision,7);
  assert.equal(engine.recordValue(reservation,'PROMPT_IDENTITY'),instructionId);
  value.revision=6; // Persistent reservation transaction committed.
  assert.throws(()=>engine.registerGeneratedPrompt(value,{instructionId:'WRONG-INSTRUCTION',stage:1,operation:'COMPLETE',scope:boundScope,contextSignature:'CONTEXT-A',operationReservationId:reservationId,challengeNonce:nonce}),/PROMPT_IDENTITY|instruction identity/i);
  assert.throws(()=>engine.registerGeneratedPrompt(value,{instructionId,stage:1,operation:'COMPLETE',scope:{...boundScope,inputVersion:'WRONG-INPUT'},contextSignature:'CONTEXT-A',operationReservationId:reservationId,challengeNonce:nonce}),/scope/i);
  const prompt=engine.registerGeneratedPrompt(value,{instructionId,stage:1,operation:'COMPLETE',scope:boundScope,contextSignature:'CONTEXT-A',operationReservationId:reservationId,challengeNonce:nonce});
  value.revision=7; // Persistent prompt transaction committed.
  return {project:value,reservation,reservationId,nonce,boundScope,prompt};
}

{
  const fixture=reservationFixture('JOB-RESERVATION-REBIND');
  const {project:value,reservationId,nonce}=fixture;
  engine.orphanOperationReservation(value,reservationId,{expectedRevision:7,reason:'Simulated crashed tab.'});
  value.revision=8;
  const replacementScope=engine.currentScope(value);
  const resumed=engine.resumeOperationReservation(value,reservationId,{
    expectedRevision:8,
    promptProjectRevision:10,
    owningBrowserTabInstance:'TAB-B',
    reason:'Resume with a replacement prompt.',
    stage:1,
    operation:'COMPLETE',
    targetSlot:'STAGE-01-COMPLETE',
    promptIdentity:'INSTRUCTION-B',
    contextSignature:'CONTEXT-B',
    scope:replacementScope,
    packageId:'PACKAGE-B',
    packageManifestHash:'b'.repeat(64)
  });
  assert.equal(engine.recordId(resumed,'operationReservations'),reservationId,'Resume allocated a second authoritative reservation instead of reusing the orphaned identity.');
  assert.equal(engine.recordValue(resumed,'PROMPT_IDENTITY'),'INSTRUCTION-B');
  assert.equal(engine.recordValue(resumed,'EXPECTED_REVISION'),10);
  assert.notEqual(engine.recordValue(resumed,'CHALLENGE_NONCE'),nonce,'Controlled prompt rebind reused the stale challenge nonce.');
  assert(fixture.prompt.invalidatedBy,'Controlled prompt rebind left the obsolete prompt active.');
  value.revision=9;
  const reboundScope=engine.clone(engine.recordValue(resumed,'SCOPE'));
  engine.registerGeneratedPrompt(value,{instructionId:'INSTRUCTION-B',stage:1,operation:'COMPLETE',scope:reboundScope,contextSignature:'CONTEXT-B',operationReservationId:reservationId,challengeNonce:engine.recordValue(resumed,'CHALLENGE_NONCE')});
}

{
  const fixture=reservationFixture('JOB-RESERVATION-PENDING','INSTRUCTION-PENDING');
  const {project:value,reservation,reservationId,nonce,prompt}=fixture;
  const pending={
    proposalId:'PROPOSAL-PENDING',
    stage:1,
    operation:'COMPLETE',
    status:'PENDING_OPERATOR_REVIEW',
    promptId:'INSTRUCTION-PENDING',
    preconditions:{projectRevision:7},
    envelope:{operation:'COMPLETE',operationBinding:{
      operationReservationId:reservationId,
      packageId:engine.recordValue(reservation,'PACKAGE_ID'),
      challengeNonce:nonce,
      projectRevision:engine.recordValue(reservation,'EXPECTED_REVISION'),
      scopeSha256:engine.recordValue(reservation,'SCOPE_HASH')
    }}
  };
  value.projectData.responseProposals.push(pending);
  engine.orphanOperationReservation(value,reservationId,{expectedRevision:7,reason:'Simulated crash after validation.'});
  value.revision=8;
  const resumed=engine.resumeOperationReservation(value,reservationId,{
    expectedRevision:8,
    promptProjectRevision:10,
    owningBrowserTabInstance:'TAB-RESUMED',
    reason:'Resume the already validated proposal.',
    stage:1,
    operation:'COMPLETE',
    targetSlot:'STAGE-01-COMPLETE',
    promptIdentity:'UNUSED-REPLACEMENT-IDENTITY',
    contextSignature:'UNUSED-REPLACEMENT-CONTEXT',
    scope:engine.currentScope(value),
    packageId:'UNUSED-REPLACEMENT-PACKAGE',
    packageManifestHash:'c'.repeat(64)
  });
  assert.equal(engine.recordValue(resumed,'PROMPT_IDENTITY'),'INSTRUCTION-PENDING','Pending-proposal resume incorrectly replaced the controlling prompt.');
  assert.equal(engine.recordValue(resumed,'CHALLENGE_NONCE'),nonce,'Pending-proposal resume rotated a still-valid accepted response binding.');
  assert.equal(pending.status,'PENDING_OPERATOR_REVIEW');
  assert.equal(pending.invalidatedBy,undefined);
  assert.equal(pending.preconditions.projectRevision,9,'Pending proposal was not rebound to the resume transaction commit revision.');
  assert.equal(prompt.invalidatedBy,undefined,'Pending-proposal resume invalidated the prompt needed to review the proposal.');
  value.revision=9;
  const action=engine.operationalNextAction(value,1);
  assert.equal(action.actionType,'REVIEW_PROPOSAL','Resuming a valid pending proposal did not return directly to proposal review.');
  assert.equal(action.operation,'COMPLETE');
}

const storeSource=fs.readFileSync('project-store.js','utf8');
assert.match(storeSource,/promptProjectRevision\s*=\s*commandRevision\s*\+\s*2/,'Persistent reservation flow does not bind the revision after reservation and prompt commits.');
assert.match(storeSource,/resumeOperationReservation\(project,id,\{expectedRevision:commandRevision,promptProjectRevision/,'Persistent orphan resume does not forward the prompt-bound revision to the engine.');
const engineSource=fs.readFileSync('workflow-engine.js','utf8');
assert.match(engineSource,/operationRoute=currentStageOperation\(project,stage\),operation=schema\.operationContract\(stage,operationRoute\?\.operation\)\?operationRoute\.operation:'COMPLETE'/,'Human-inspection reservation does not consume the exact operation selected by the engine route object.');
assert.doesNotMatch(engineSource,/schema\.operationContract\(stage,currentStageOperation\(project,stage\)\)/,'A route object is still being passed to the operation-contract lookup as though it were an operation string.');

function accepted(value,stage,operation,eventSequence,scope){
  value.projectData.acceptedChanges.push({changeId:`CHANGE-${stage}-${operation}-${eventSequence}`,stage,operation,eventSequence,scope:engine.clone(scope||{}),status:'COMMITTED',responseType:'DATA_PROPOSAL'});
}

function iterationFixture(jobId){
  const value=project(jobId);
  engine.registerArtifactBytes(value,{stage:17,artifactId:`ARTIFACT-${jobId}`,filename:'candidate.bin',mediaType:'application/octet-stream',byteSize:1,sha256:'d'.repeat(64)});
  const scope=engine.currentScope(value),requirementScope={inputVersion:scope.inputVersion,sourceSetVersion:scope.sourceSetVersion,requirementsVersion:scope.requirementsVersion},testScope={...requirementScope,testSuiteVersion:scope.testSuiteVersion};
  value.projectData.requirements.push({id:'REQ-ROUTE',stage:4,active:true,scope:requirementScope,fields:{REQ_ID:'REQ-ROUTE',MANDATORY_OPTIONAL_STATUS:'MANDATORY',APPLICABILITY:'APPLICABLE'}});
  value.projectData.tests.push({id:'TEST-ROUTE',stage:6,active:true,scope:testScope,fields:{TEST_ID:'TEST-ROUTE',REQ_ID:'REQ-ROUTE',STATUS:'READY',TEST_ROLE:'REQUIRED_PROOF',SEMANTIC_COVERAGE_DISPOSITION:'EQUIVALENT',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',ARTIFACT_REQUIREMENTS:'NONE'}});
  return value;
}

function assertRoute(value,stage,operation,state){
  const route=engine.currentStageOperation(value,stage);
  assert.equal(route.operation,operation);
  assert.equal(route.state,state);
  const action=engine.operationalNextAction(value,stage);
  assert.equal(action.operation,operation,'The operator action diverged from the engine-selected suboperation.');
  assert.equal(action.targetSlot,route.targetSlot);
  return route;
}

function freezeAndReserve(value,stage){
  const before=assertRoute(value,stage,stage===17?'FREEZE':'CONFIRM_FREEZE','APPLICATION_CONTROL');
  assert(!before.scope.runId,'Freeze route exposed a user-selected run identity.');
  const artifactId=engine.recordId(value.projectData.artifacts[0],'artifacts');
  const frozen=engine.freezeCandidate(value,{stage,artifactIds:[artifactId],purpose:stage===19?'UNCHANGED_CONFIRMATION':'CORRECTED'});
  let route=assertRoute(value,stage,'EXECUTE_RUN','RESERVE_RUN_BATCH');
  const iterationId=engine.recordId(frozen.iteration,'iterations'),candidateId=engine.recordId(frozen.candidate,'candidateFreezes');
  const slots=engine.reserveRunBatch(value,{stage,iterationId,candidateId,count:10});
  route=assertRoute(value,stage,'EXECUTE_RUN','CONTEXT_REQUIRED');
  assert.equal(route.scope.runId,slots[0].runId);
  assert.equal(route.scope.contextId,slots[0].contextId);
  assert.equal(engine.operationalNextAction(value,stage).promptAvailable,false,'A run prompt was exposed before the real external context identity was registered.');
  return {iterationId,candidateId,slots};
}

function completeRuns(value,stage,{iterationId,candidateId,slots}){
  for(let index=0;index<slots.length;index+=1){
    const context=value.projectData.freshContexts.find(item=>engine.recordId(item,'freshContexts')===slots[index].contextId);
    if(engine.recordValue(context,'EXTERNAL_CONTEXT_IDENTIFIER')==='UNASSIGNED')engine.registerFreshContext(value,{stage,externalContextIdentifier:`EXECUTOR-${stage}-${index+1}`});
    const run=value.projectData.runs.find(item=>engine.recordId(item,'runs')===slots[index].runId);
    run.completionState='COMPLETED';
    run.fields.EXECUTION_STATUS='COMPLETED';
    run.EXECUTION_STATUS='COMPLETED';
    accepted(value,stage,'EXECUTE_RUN',100+index,{iterationId,candidateId,runId:slots[index].runId,contextId:slots[index].contextId});
  }
  const route=assertRoute(value,stage,'VERIFY','CONTEXT_REQUIRED');
  assert.equal(route.scope.runId,slots[0].runId);
  assert.equal(route.scope.contextId,undefined,'VERIFY fabricated a reviewer context instead of requiring its application registration.');
  assert.equal(engine.operationalNextAction(value,stage).promptAvailable,false);
}

function completeVerification(value,stage,{iterationId,candidateId,slots},{violateFirst=false}={}){
  const reviewer=engine.registerFreshContext(value,{stage,externalContextIdentifier:`REVIEWER-${stage}`,purpose:'REVIEWER'}),reviewerContextId=engine.recordId(reviewer,'freshContexts');
  let selected=assertRoute(value,stage,'VERIFY','ACTION_REQUIRED');
  assert.equal(selected.scope.runId,slots[0].runId);
  assert.equal(selected.scope.contextId,reviewerContextId);
  for(let index=0;index<slots.length;index+=1){
    const evidenceId=`EVIDENCE-${stage}-${index+1}`,verificationId=`VERIFICATION-${stage}-${index+1}`,scope={...engine.scopeForIteration(value,iterationId),runId:slots[index].runId,contextId:reviewerContextId},observed=violateFirst&&index===0?'VIOLATED':'SATISFIED';
    value.projectData.evidenceRecords.push({id:evidenceId,stage,active:true,scope,fields:{EVIDENCE_ID:evidenceId,KIND:'EXECUTION_OBSERVATION',AUTHORITY_TYPE:'AGENT',CONTENT:'Exact current verification evidence.',STATUS:'CURRENT'}});
    value.projectData.verification.push({id:verificationId,stage,active:true,scope,fields:{VERIFICATION_ID:verificationId,REQ_ID:'REQ-ROUTE',RUN_ID:slots[index].runId,TEST_ID:'TEST-ROUTE',VERIFIER_CONTEXT_ID:reviewerContextId,EXPECTED_RESULT:'SATISFIED',OBSERVED_RESULT:observed,DETERMINATION:observed,EXACT_EVIDENCE:evidenceId},relationships:{REQ_ID:'REQ-ROUTE',RUN_ID:slots[index].runId,TEST_ID:'TEST-ROUTE'},evidenceRefs:[evidenceId]});
    accepted(value,stage,'VERIFY',200+index,{iterationId,candidateId,runId:slots[index].runId,contextId:reviewerContextId});
  }
  const matrix=engine.verificationMatrix(value,iterationId);
  assert.equal(matrix.expected.length,10);
  assert.equal(matrix.missing.length,0);
  assert.equal(matrix.invalid.length,0);
  selected=assertRoute(value,stage,'COMPARE','ACTION_REQUIRED');
  return selected;
}

function acceptComparison(value,stage,{iterationId,candidateId},{defectSignal=false}={}){
  const scope=engine.scopeForIteration(value,iterationId);
  value.projectData.comparisons.push({id:`COMPARISON-${stage}`,stage,active:true,scope,fields:{COMPARISON_ID:`COMPARISON-${stage}`,REQ_ID:'REQ-ROUTE',CORRECTNESS_AFFECTING_VARIANCE:defectSignal?'TRUE':'FALSE',INCONCLUSIVE_TESTS:'NONE',PROHIBITED_VARIANCE:defectSignal?'FOUND':'NONE'},relationships:{REQ_ID:'REQ-ROUTE'}});
  accepted(value,stage,'COMPARE',400,{iterationId,candidateId});
}

{
  const value=iterationFixture('ROUTE-NO-DEFECT');
  const iteration=freezeAndReserve(value,17);
  engine.registerFreshContext(value,{stage:17,externalContextIdentifier:'EXECUTOR-17-1'});
  assertRoute(value,17,'EXECUTE_RUN','ACTION_REQUIRED');
  completeRuns(value,17,iteration);
  completeVerification(value,17,iteration);
  acceptComparison(value,17,iteration);
  assertRoute(value,17,'COMPARE','COMPLETE');
  const historicalVerification=value.projectData.verification.find(item=>Number(item.stage)===17);
  assert.equal(engine.evaluateResultConsistency('verification',historicalVerification,value.projectData.tests[0],value).determination,'SATISFIED');

  assertRoute(value,19,'CONFIRM_FREEZE','APPLICATION_CONTROL');
  const confirmation=freezeAndReserve(value,19);
  assert.equal(engine.evaluateResultConsistency('verification',historicalVerification,value.projectData.tests[0],value).determination,'SATISFIED','Changing CURRENT_ITERATION for a deliberate downstream transition reopened historical upstream evidence against the wrong scope.');
  completeRuns(value,19,confirmation);
  completeVerification(value,19,confirmation);
  acceptComparison(value,19,confirmation);
  assertRoute(value,19,'REGRESSION_VERIFY','ACTION_REQUIRED');
  accepted(value,19,'REGRESSION_VERIFY',500,{iterationId:confirmation.iterationId,candidateId:confirmation.candidateId});
  assertRoute(value,19,'CONFIRM','ACTION_REQUIRED');
  value.projectData.confirmationRecords.push({id:'CONFIRMATION-19',stage:19,active:true,scope:engine.scopeForIteration(value,confirmation.iterationId),fields:{CONFIRMATION_ID:'CONFIRMATION-19'}});
  accepted(value,19,'CONFIRM',600,{iterationId:confirmation.iterationId,candidateId:confirmation.candidateId});
  assertRoute(value,19,'CONFIRM','COMPLETE');
}

{
  const value=iterationFixture('ROUTE-ACTIVE-REGRESSION');
  value.projectData.regressions.push({id:'REGRESSION-HISTORICAL',stage:15,active:true,scope:engine.currentScope(value),fields:{REG_ID:'REGRESSION-HISTORICAL',ACTIVE_RETIRED_STATE:'ACTIVE'}});
  const iteration=freezeAndReserve(value,17);
  completeRuns(value,17,iteration);
  completeVerification(value,17,iteration);
  acceptComparison(value,17,iteration);
  assertRoute(value,17,'REGRESSION','ACTION_REQUIRED');
  const scope=engine.scopeForIteration(value,iteration.iterationId);
  value.projectData.evidenceRecords.push({id:'EVIDENCE-HISTORICAL-REGRESSION',stage:17,active:true,scope,fields:{EVIDENCE_ID:'EVIDENCE-HISTORICAL-REGRESSION',KIND:'REGRESSION_EXECUTION',AUTHORITY_TYPE:'AGENT',CONTENT:'Exact successful execution of the active historical regression.',STATUS:'CURRENT'}});
  value.projectData.regressionExecutions.push({id:'REGRESSION-EXECUTION-HISTORICAL',stage:17,active:true,scope,fields:{REG_EXEC_ID:'REGRESSION-EXECUTION-HISTORICAL',REG_ID:'REGRESSION-HISTORICAL',ITERATION_ID:iteration.iterationId,PHASE:'POST_CORRECTION',RESULT:'SATISFIED'},relationships:{REG_ID:'REGRESSION-HISTORICAL',ITERATION_ID:iteration.iterationId},evidenceRefs:['EVIDENCE-HISTORICAL-REGRESSION']});
  accepted(value,17,'REGRESSION',500,{iterationId:iteration.iterationId,candidateId:iteration.candidateId});
  assertRoute(value,17,'REGRESSION','COMPLETE');
}

{
  const value=iterationFixture('ROUTE-DEFECT');
  const iteration=freezeAndReserve(value,17);
  completeRuns(value,17,iteration);
  completeVerification(value,17,iteration,{violateFirst:true});
  acceptComparison(value,17,iteration,{defectSignal:true});
  assertRoute(value,17,'ROOT_CAUSE','ACTION_REQUIRED');
  const scope=engine.scopeForIteration(value,iteration.iterationId);
  value.projectData.defects.push({id:'DEFECT-ROUTE',stage:17,active:true,scope,fields:{DEFECT_ID:'DEFECT-ROUTE',STATUS:'CONFIRMED'}});
  value.projectData.rootCauses.push({id:'RCA-ROUTE',stage:17,active:true,scope,fields:{RCA_ID:'RCA-ROUTE',DEFECT_ID:'DEFECT-ROUTE'},relationships:{DEFECT_ID:'DEFECT-ROUTE'}});
  accepted(value,17,'ROOT_CAUSE',500,{iterationId:iteration.iterationId,candidateId:iteration.candidateId});
  assertRoute(value,17,'REGRESSION','ACTION_REQUIRED');
  value.projectData.regressions.push({id:'REGRESSION-ROUTE',stage:17,active:true,scope,fields:{REG_ID:'REGRESSION-ROUTE',DEFECT_ID:'DEFECT-ROUTE',ACTIVE_RETIRED_STATE:'ACTIVE'},relationships:{DEFECT_ID:'DEFECT-ROUTE'}});
  value.projectData.evidenceRecords.push({id:'EVIDENCE-REGRESSION-ROUTE',stage:17,active:true,scope,fields:{EVIDENCE_ID:'EVIDENCE-REGRESSION-ROUTE',KIND:'REGRESSION_EXECUTION',AUTHORITY_TYPE:'AGENT',CONTENT:'Exact current regression execution evidence.',STATUS:'CURRENT'}});
  value.projectData.regressionExecutions.push({id:'REGRESSION-EXECUTION-ROUTE',stage:17,active:true,scope,fields:{REG_EXEC_ID:'REGRESSION-EXECUTION-ROUTE',REG_ID:'REGRESSION-ROUTE',ITERATION_ID:iteration.iterationId,PHASE:'POST_CORRECTION',RESULT:'SATISFIED'},relationships:{REG_ID:'REGRESSION-ROUTE',ITERATION_ID:iteration.iterationId},evidenceRefs:['EVIDENCE-REGRESSION-ROUTE']});
  accepted(value,17,'REGRESSION',600,{iterationId:iteration.iterationId,candidateId:iteration.candidateId});
  assertRoute(value,17,'CORRECT','ACTION_REQUIRED');
  value.projectData.changes.push({id:'CHANGESET-ROUTE',stage:17,active:true,scope,fields:{CHANGESET_ID:'CHANGESET-ROUTE',TRIGGERING_DEFECT_IDS:['DEFECT-ROUTE']}});
  accepted(value,17,'CORRECT',700,{iterationId:iteration.iterationId,candidateId:iteration.candidateId});
  assertRoute(value,17,'CORRECT','COMPLETE');
}

console.log(JSON.stringify({
  reservationPromptIdentityBound:true,
  reservationFutureRevisionBound:true,
  orphanControlledRebindUsesSameReservation:true,
  orphanPendingProposalPreserved:true,
  stage17NoDefectClosure:true,
  stage17ActiveRegressionCannotBeSkipped:true,
  stage17DefectPhaseOrder:true,
  stage19ExactPhaseOrder:true,
  downstreamIterationPreservesUpstreamEvidenceScope:true,
  operatorActionUsesEngineOperation:true,
  humanInspectionReservationUsesEngineOperation:true
},null,2));
