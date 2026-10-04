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
