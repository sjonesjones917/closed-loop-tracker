import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const engine=globalThis.closedLoopWorkflowEngine;

function accepted(project,stage,operation,eventSequence,{promptId=`PROMPT-${stage}-${eventSequence}`,contextSignature=`CONTEXT-${stage}-${eventSequence}`}={}){
  const change={changeId:`CHANGE-${stage}-${eventSequence}`,stage,responseType:'DATA_PROPOSAL',status:'COMMITTED',operation,eventSequence,promptId,contextSignature};
  project.projectData.acceptedChanges.push(change);
  return change;
}

function stageOneProject(jobId){
  const project=core.createBlankState(jobId);
  project.job.EXACT_USER_OBJECTIVE_VERBATIM='Create the exact requested deliverable.';
  engine.ensureShape(project);
  engine.recalculate(project);
  const manifest=engine.intakeCoverageManifest(project);
  project.stages[1].agentData={
    EXACT_DELIVERABLE_REQUESTED:'The exact requested deliverable.',
    ASSUMPTIONS:'NONE',
    UNKNOWN_INFORMATION:'NONE',
    INPUT_SET_CONTENTS:JSON.stringify({
      schema:'closed-loop-stage01-capture/1',
      inputVersion:manifest.inputVersion,
      manifestSha256:manifest.manifestSha256,
      semanticPasses:{exhaustiveExtractionCompleted:true,omissionChallengeCompleted:true,omissionsResolved:true},
      units:manifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'',extractedStatements:[{statementKey:`STATEMENT-${index+1}`,text:unit.rawValueText||unit.label,statementClass:'FACT'}]}))
    })
  };
  return project;
}

{
  const project=stageOneProject('STAGE01-ORDINARY');
  const complete=accepted(project,1,'COMPLETE',10);
  assert.deepEqual(engine.acceptedChanges(project,1).map(change=>change.operation),['COMPLETE'],'acceptedChanges did not preserve the exact accepted operation.');
  assert.equal(engine.stageSuboperationClosure(project,1).finalChange.changeId,complete.changeId,'The ordinary small-input path did not select COMPLETE as its final operation.');
  const confirmation=engine.recordStageConfirmation(project,1,true,'The current accepted intake matches human intent.');
  assert.equal(confirmation.acceptedChangeId,complete.changeId);
  assert.equal(confirmation.operation,'COMPLETE');
  assert.equal(engine.gate(1,project).complete,true,'The ordinary small-input COMPLETE path was blocked.');
}

{
  const project=stageOneProject('STAGE01-CHALLENGE-ONLY');
  accepted(project,1,'SEMANTIC_CHALLENGE',10);
  const closure=engine.stageSuboperationClosure(project,1);
  assert.equal(closure.finalChange,null,'A Stage 01 challenge operation alone became the controlling completion.');
  assert(closure.reasons.some(reason=>reason.includes('RECONCILE_INTAKE')));
  assert.throws(()=>engine.recordStageConfirmation(project,1,true,'Invalid challenge confirmation.'),/RECONCILE_INTAKE/);
  assert.equal(engine.gate(1,project).complete,false);
  const action=engine.operationalNextAction(project,1);
  assert.equal(action.operation,'RECONCILE_INTAKE');
  assert.equal(action.actionType,'CONTINUE_AGENT_CONVERSATION');
}

{
  const project=stageOneProject('STAGE01-SEQUENCE');
  accepted(project,1,'COMPLETE',10);
  const staleReconciliation=accepted(project,1,'RECONCILE_INTAKE',20);
  const challenge=accepted(project,1,'SEMANTIC_CHALLENGE',30);
  project.projectData.stageConfirmations.push({stage:1,confirmed:true,acceptedChangeId:staleReconciliation.changeId,inputVersion:project.job.CURRENT_INPUT_VERSION,operation:'RECONCILE_INTAKE'});
  assert.equal(engine.stageSuboperationClosure(project,1).finalChange,null,'A reconciliation accepted before the current challenge closed Stage 01.');
  assert.equal(engine.gate(1,project).complete,false,'A confirmation bound to a stale reconciliation closed Stage 01.');
  const reconciliation=accepted(project,1,'RECONCILE_INTAKE',40);
  assert.throws(()=>engine.recordStageConfirmation(project,1,true,'Wrong binding.','TEST',{acceptedChangeId:challenge.changeId}),/final accepted RECONCILE_INTAKE/);
  const confirmation=engine.recordStageConfirmation(project,1,true,'Reconciled intake matches human intent.');
  assert.equal(confirmation.acceptedChangeId,reconciliation.changeId);
  assert.equal(confirmation.operation,'RECONCILE_INTAKE');
  assert.equal(engine.gate(1,project).complete,true);
  accepted(project,1,'COMPLETE',50);
  assert.equal(engine.stageSuboperationClosure(project,1).finalChange,null,'A later unreconciled COMPLETE response bypassed the accepted semantic challenge.');
  assert.equal(engine.gate(1,project).complete,false);
}

{
  const project=stageOneProject('STAGE01-REQUIRED');
  const complete=accepted(project,1,'COMPLETE',10,{promptId:'PROMPT-REQUIRES-CHALLENGE',contextSignature:'REQUIRED-CONTEXT'});
  project.projectData.generatedPrompts.push({instructionId:complete.promptId,stage:1,operation:'COMPLETE',contextSignature:complete.contextSignature,contextManifest:{semanticChallengePlan:{challengeRequired:true,reasons:['LARGE_SUPPLIED_ARTIFACT']}}});
  const required=engine.stageSuboperationClosure(project,1);
  assert.equal(required.challengeRequired,true);
  assert.equal(required.finalChange,null,'Prompt-required semantic challenge was bypassed by COMPLETE.');
  assert(required.reasons.some(reason=>reason.includes('accepted SEMANTIC_CHALLENGE')));
  assert.throws(()=>engine.recordStageConfirmation(project,1,true,'Premature confirmation.'),/SEMANTIC_CHALLENGE/);
  assert.equal(engine.operationalNextAction(project,1).operation,'SEMANTIC_CHALLENGE','The operator action did not select the required Stage 01 challenge automatically.');
  accepted(project,1,'SEMANTIC_CHALLENGE',20);
  const reconciliation=accepted(project,1,'RECONCILE_INTAKE',30);
  assert.throws(()=>engine.recordStageConfirmation(project,1,true,'Wrong prompt binding.','TEST',{instructionId:'WRONG-PROMPT'}),/instruction identity/);
  const confirmation=engine.recordStageConfirmation(project,1,true,'Reconciled required challenge.');
  assert.equal(confirmation.acceptedChangeId,reconciliation.changeId);
  assert.equal(engine.gate(1,project).complete,true);
}

{
  const project=stageOneProject('STAGE01-VALIDATION-ROUTING');
  project.projectData.generatedPrompts.push({instructionId:'PROMPT-STAGE01-FAILED-COMPLETE',stage:1,operation:'COMPLETE',contextManifest:{semanticChallengePlan:{challengeRequired:false}}});
  project.projectData.responseValidations.push({validationId:'VALIDATION-STAGE01-FAILED-COMPLETE',stage:1,promptId:'PROMPT-STAGE01-FAILED-COMPLETE',valid:false,issues:[{code:'MATERIAL_INTAKE_UNCERTAINTY_UNCHALLENGED'}]});
  const action=engine.operationalNextAction(project,1);
  assert.equal(action.operation,'SEMANTIC_CHALLENGE');
  assert.equal(action.actionType,'AI_REVIEW');
}

function stageFourProject(jobId){const project=core.createBlankState(jobId);engine.ensureShape(project);return project;}

{
  const project=stageFourProject('STAGE04-ORDINARY');
  const complete=accepted(project,4,'COMPLETE',10);
  const closure=engine.stageSuboperationClosure(project,4);
  assert.equal(closure.challengeRequired,false);
  assert.equal(closure.finalChange.changeId,complete.changeId,'Stage 04 did not preserve the ordinary COMPLETE path when no challenge exists.');
}

{
  const project=stageFourProject('STAGE04-CHALLENGE-ONLY');
  accepted(project,4,'DISPOSITION_CHALLENGE',10);
  const closure=engine.stageSuboperationClosure(project,4);
  assert.equal(closure.finalChange,null,'A Stage 04 disposition challenge alone became the controlling completion.');
  assert(closure.reasons.some(reason=>reason.includes('RECONCILE_REQUIREMENTS')));
  assert.equal(engine.operationalNextAction(project,4).operation,'RECONCILE_REQUIREMENTS');
}

{
  const project=stageFourProject('STAGE04-SEQUENCE');
  accepted(project,4,'COMPLETE',10);
  accepted(project,4,'DISPOSITION_CHALLENGE',20);
  const reconciliation=accepted(project,4,'RECONCILE_REQUIREMENTS',30);
  assert.equal(engine.stageSuboperationClosure(project,4).finalChange.changeId,reconciliation.changeId);
  accepted(project,4,'ATOMICITY_CHALLENGE',40);
  assert.equal(engine.stageSuboperationClosure(project,4).finalChange,null,'A reconciliation accepted before the latest atomicity challenge closed Stage 04.');
  const finalReconciliation=accepted(project,4,'RECONCILE_REQUIREMENTS',50);
  assert.equal(engine.stageSuboperationClosure(project,4).finalChange.changeId,finalReconciliation.changeId);
  accepted(project,4,'COMPLETE',60);
  assert.equal(engine.stageSuboperationClosure(project,4).finalChange,null,'A later unreconciled Stage 04 compilation bypassed prior challenges.');
}

{
  const project=stageFourProject('STAGE04-REQUIRED-DISPOSITION');
  project.stages[4].agentData.OBLIGATION_DISPOSITION_CHALLENGE_RECORDS=[{obligationId:'OBLIGATION-REQUIRES-INDEPENDENT-CHALLENGE'}];
  accepted(project,4,'COMPLETE',10);
  let closure=engine.stageSuboperationClosure(project,4);
  assert.equal(closure.finalChange,null,'Declared release-reducing disposition challenge was self-approved by COMPLETE.');
  assert(closure.reasons.some(reason=>reason.includes('accepted DISPOSITION_CHALLENGE')));
  assert.equal(engine.operationalNextAction(project,4).operation,'DISPOSITION_CHALLENGE');
  accepted(project,4,'DISPOSITION_CHALLENGE',20);
  assert.equal(engine.operationalNextAction(project,4).operation,'RECONCILE_REQUIREMENTS');
  const reconciliation=accepted(project,4,'RECONCILE_REQUIREMENTS',30);
  closure=engine.stageSuboperationClosure(project,4);
  assert.equal(closure.finalChange.changeId,reconciliation.changeId);
}

{
  const project=stageFourProject('STAGE04-VALIDATION-ROUTING');
  project.projectData.generatedPrompts.push({instructionId:'PROMPT-STAGE04-FAILED-COMPLETE',stage:4,operation:'COMPLETE'});
  project.projectData.responseValidations.push({validationId:'VALIDATION-STAGE04-FAILED-COMPLETE',stage:4,promptId:'PROMPT-STAGE04-FAILED-COMPLETE',valid:false,issues:[{code:'REQUIRED_STAGE04_DISPOSITION_CHALLENGE_MISSING'},{code:'REQUIRED_STAGE04_ATOMICITY_CHALLENGE_MISSING'}]});
  assert.equal(engine.operationalNextAction(project,4).operation,'DISPOSITION_CHALLENGE');
  accepted(project,4,'DISPOSITION_CHALLENGE',20);
  assert.equal(engine.operationalNextAction(project,4).operation,'ATOMICITY_CHALLENGE');
  accepted(project,4,'ATOMICITY_CHALLENGE',30);
  assert.equal(engine.operationalNextAction(project,4).operation,'RECONCILE_REQUIREMENTS');
}

console.log(JSON.stringify({
  stage01OrdinaryCompletePath:true,
  stage01ChallengeRequiresLaterReconciliation:true,
  stage01PromptRequiredChallengeFailsClosed:true,
  stage01ConfirmationBindsFinalAcceptedOperation:true,
  stage04OrdinaryCompletePath:true,
  stage04ChallengesRequireLaterReconciliation:true,
  stage04DeclaredChallengeCannotSelfApprove:true,
  acceptedChangeOperationSequencing:true,
  operatorSuboperationSelectionIsApplicationDerived:true
},null,2));
