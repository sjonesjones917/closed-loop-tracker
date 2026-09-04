import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,hash=globalThis.closedLoopHash;

function fixture({disposition='EQUIVALENT',reviewRawId='RAW-REVIEW',reviewerContext='CONTEXT-REVIEW',targetSlot='SEMANTIC_REVIEW:TEST:TEST-1',providedHash=null,authorContext='CONTEXT-AUTHOR',targetActive=true,targetScope=null}={}){
  const project=core.createBlankState('JOB-SEMANTIC-REVIEW');Object.assign(project.job,{CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});engine.ensureShape(project);const scope=engine.currentScope(project);
  const requirement={id:'REQ-1',stage:4,active:true,scope,fields:{REQ_ID:'REQ-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}};
  const proposition={id:'PROPOSITION-1',stage:4,active:true,scope,rawResponseId:'RAW-PROPOSITION',sourceProposalId:'PROPOSAL-PROPOSITION',fields:{PROPOSITION_ID:'PROPOSITION-1',REQUIREMENT_ID:'REQ-1',PROPOSITION_TEXT:'Product contains exactly ten items.',SUBJECT_AND_SCOPE_DESCRIPTION:'Current product item collection.',SATISFACTION_MEANING:'The exact item count is ten.',FAILURE_MEANING:'The exact item count is not ten.',STATUS:'UNDETERMINED'},relationships:{REQUIREMENT_ID:'REQ-1'}};
  const test={id:'TEST-1',stage:6,active:targetActive,scope:targetScope||scope,rawResponseId:'RAW-AUTHOR',sourceProposalId:'PROPOSAL-AUTHOR',fields:{TEST_ID:'TEST-1',REQ_ID:'REQ-1',TEST_PROPOSITION_TEXT:'The current product item count equals ten.',TARGET_PROPOSITION_IDS:['PROPOSITION-1'],TESTED_SCOPE:'Current product item collection.',POSITIVE_RESULT_MEANING:'Count equals ten.',NEGATIVE_RESULT_MEANING:'Count differs from ten.',SEMANTIC_COVERAGE_DISPOSITION:'EQUIVALENT',SEMANTIC_REVIEW_IDS:[],TEST_ROLE:'REQUIRED_PROOF',RELEASE_BEARING:false,EXECUTABLE_KIND:'NONE',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:null,EXECUTABLE_INPUT_BINDINGS:{},TEST_TYPE:'MEANING',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',STATUS:'READY'},relationships:{REQ_ID:'REQ-1'}};
  project.projectData.requirements.push(requirement);project.projectData.propositions.push(proposition);project.projectData.tests.push(test);
  const authorScope={...scope,contextId:authorContext};
  project.projectData.rawResponses.push({rawResponseId:'RAW-PROPOSITION',contextId:'CONTEXT-PROPOSITION',promptInstructionId:'PROMPT-PROPOSITION'},{rawResponseId:'RAW-AUTHOR',contextId:authorContext,promptInstructionId:'PROMPT-AUTHOR'});
  project.projectData.generatedPrompts.push({instructionId:'PROMPT-PROPOSITION',stage:4,operation:'COMPLETE',scope},{instructionId:'PROMPT-AUTHOR',stage:6,operation:'COMPLETE',scope:authorScope});
  project.projectData.acceptedChanges.push({changeId:'CHANGE-PROPOSITION',stage:4,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'COMPLETE',rawResponseId:'RAW-PROPOSITION',proposalId:'PROPOSAL-PROPOSITION',promptId:'PROMPT-PROPOSITION',canonicalRecordIds:['PROPOSITION-1'],scope},{changeId:'CHANGE-AUTHOR',stage:6,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'COMPLETE',rawResponseId:'RAW-AUTHOR',proposalId:'PROPOSAL-AUTHOR',promptId:'PROMPT-AUTHOR',canonicalRecordIds:['TEST-1'],scope:authorScope});
  const authorContextRecord={id:'CONTEXT-AUTHOR',stage:6,active:true,scope,fields:{CONTEXT_ID:'CONTEXT-AUTHOR',EXTERNAL_CONTEXT_IDENTIFIER:authorContext==='CONTEXT-AUTHOR'?'external-author-context-1':'UNKNOWN',ROLE:'VERIFICATION ARCHITECT',ITERATION_ID:'NOT APPLICABLE',RUN_ID:'NOT APPLICABLE',AUTHORIZED_PROJECT_INPUTS:'INPUT-v001',AUTHORIZED_EXTERNAL_SOURCE_MATERIAL:'NOT APPLICABLE',FROZEN_ARTIFACT_VERSIONS:'CURRENT',TOOL_AVAILABILITY:'AVAILABLE',CONTAMINATION_STATUS:'UNKNOWN',OUTPUT_IDENTITY:'UNKNOWN',DEVIATIONS:'NONE',EVIDENCE:'Registered author context.',USABILITY_DETERMINATION:'READY'}},semanticHash=engine.semanticReviewTargetHash(project,'TEST','TEST-1'),reviewContextRecord={id:'CONTEXT-REVIEW',stage:6,active:true,scope,fields:{CONTEXT_ID:'CONTEXT-REVIEW',EXTERNAL_CONTEXT_IDENTIFIER:'external-review-context-1',ROLE:'INDEPENDENT REVIEWER',ITERATION_ID:'NOT APPLICABLE',RUN_ID:'NOT APPLICABLE',AUTHORIZED_PROJECT_INPUTS:'INPUT-v001',AUTHORIZED_EXTERNAL_SOURCE_MATERIAL:'NOT APPLICABLE',FROZEN_ARTIFACT_VERSIONS:'CURRENT',TOOL_AVAILABILITY:'AVAILABLE',CONTAMINATION_STATUS:'UNKNOWN',OUTPUT_IDENTITY:'UNKNOWN',DEVIATIONS:'NONE',EVIDENCE:'Registered reviewer context.',USABILITY_DETERMINATION:'READY'}};
  project.projectData.freshContexts.push(authorContextRecord,reviewContextRecord);
  const reservation={id:'RESERVATION-1',stage:6,active:true,scope:{...scope,contextId:'CONTEXT-REVIEW'},fields:{OPERATION_RESERVATION_ID:'RESERVATION-1',JOB_ID:project.job.JOB_ID,STAGE:6,OPERATION:'SEMANTIC_REVIEW',TARGET_SLOT:targetSlot,PACKAGE_ID:'PACKAGE-1',PROMPT_ID:'PROMPT-REVIEW',SCOPE:{...scope,contextId:'CONTEXT-REVIEW'},EXPECTED_REVISION:Number(project.revision||0),CHALLENGE_NONCE:'0'.repeat(32),STATUS:'ACCEPTED',OWNING_TAB_INSTANCE:'TAB-1',IDEMPOTENCY_KEY:'IDEMPOTENCY-1',PAYLOAD_HASH:'PAYLOAD-1'}};
  project.projectData.operationReservations.push(reservation);
  const manifestHash=providedHash??semanticHash,reviewPrompt={instructionId:'PROMPT-REVIEW',stage:6,operation:'SEMANTIC_REVIEW',scope:{...scope,contextId:'CONTEXT-REVIEW'},operationBinding:{operationReservationId:'RESERVATION-1',packageId:'PACKAGE-1',targetSlot,challengeNonce:'0'.repeat(32)},contextManifest:{semanticReviewTarget:{targetKind:'TEST',targetId:'TEST-1',targetSemanticHash:manifestHash,authorRawResponseId:'RAW-AUTHOR',authorPromptId:'PROMPT-AUTHOR',authorContextId:authorContext},semanticReviewIsolation:{applicationInputIsolation:'APPLICATION_ESTABLISHED'},readCollections:{tests:[{id:'TEST-1'}],semanticCoverageReviews:[]}}};
  project.projectData.generatedPrompts.push(reviewPrompt);project.projectData.rawResponses.push({rawResponseId:reviewRawId,contextId:reviewerContext,promptInstructionId:'PROMPT-REVIEW',operationReservationId:'RESERVATION-1',packageId:'PACKAGE-1',targetSlot});
  project.projectData.evidenceRecords.push({id:'EVIDENCE-REVIEW',stage:6,active:true,scope,fields:{EVIDENCE_ID:'EVIDENCE-REVIEW',KIND:'SEMANTIC_COVERAGE_REVIEW',DESCRIPTION:'Independent comparison of test and target proposition.',LOCATION:'semantic review',CONTENT:'Compared exact tested and target meanings.',STATUS:'PRESERVED'}});
  const review={id:'SEMANTIC-REVIEW-1',stage:6,active:true,scope:{...scope,contextId:'CONTEXT-REVIEW'},rawResponseId:reviewRawId,sourceProposalId:'PROPOSAL-REVIEW',evidenceRefs:['EVIDENCE-REVIEW'],fields:{SEMANTIC_REVIEW_ID:'SEMANTIC-REVIEW-1',SEMANTIC_COVERAGE_DISPOSITION:disposition,REASONING:'The tested truth condition was compared against the complete target proposition.',TARGET_SEMANTIC_HASH:manifestHash,OPERATION_RESERVATION_ID:'RESERVATION-1'}};
  project.projectData.semanticCoverageReviews.push(review);project.projectData.acceptedChanges.push({changeId:'CHANGE-REVIEW',stage:6,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'SEMANTIC_REVIEW',rawResponseId:reviewRawId,proposalId:'PROPOSAL-REVIEW',promptId:'PROMPT-REVIEW',canonicalRecordIds:['EVIDENCE-REVIEW','SEMANTIC-REVIEW-1']});
  return{project,review,test,semanticHash};
}

{
  const {project,review,test}=fixture();engine.recalculate(project);const assessment=engine.semanticCoverageReviewAssessment(project,review);assert.equal(assessment.current,true);assert.deepEqual(test.fields.SEMANTIC_REVIEW_IDS,['SEMANTIC-REVIEW-1']);assert.equal(test.fields.RELEASE_BEARING,true);
}
{
  const {project,review}=fixture({reviewRawId:'RAW-AUTHOR',reviewerContext:'CONTEXT-AUTHOR'});engine.recalculate(project);const assessment=engine.semanticCoverageReviewAssessment(project,review);assert.equal(assessment.current,false);assert.match(assessment.reasons.join(' '),/self-reviewed|reused/i);
}
{
  const {project,review}=fixture({reviewerContext:'CONTEXT-AUTHOR'});engine.recalculate(project);const assessment=engine.semanticCoverageReviewAssessment(project,review);assert.equal(assessment.current,false);assert.match(assessment.reasons.join(' '),/reused/i);
}
{
  const {project,review}=fixture({targetSlot:'SEMANTIC_REVIEW:TEST:TEST-WRONG'});engine.recalculate(project);assert.equal(engine.semanticCoverageReviewAssessment(project,review).current,false);
}
{
  const {project,review}=fixture({providedHash:'f'.repeat(64)});engine.recalculate(project);const assessment=engine.semanticCoverageReviewAssessment(project,review);assert.equal(assessment.current,false);assert.equal(assessment.status,'STALE');
}
{
  const {project,review}=fixture({targetActive:false});engine.recalculate(project);const assessment=engine.semanticCoverageReviewAssessment(project,review);assert.equal(assessment.current,false);assert.match(assessment.reasons.join(' '),/target slot|current/i);
}
{
  const {project,review}=fixture({targetScope:{inputVersion:'INPUT-stale'}});engine.recalculate(project);const assessment=engine.semanticCoverageReviewAssessment(project,review);assert.equal(assessment.current,false);assert.match(assessment.reasons.join(' '),/target slot|current/i);
}
{
  const {project,review}=fixture({authorContext:'UNKNOWN'});engine.recalculate(project);const assessment=engine.semanticCoverageReviewAssessment(project,review);assert.equal(assessment.current,false);assert.match(assessment.reasons.join(' '),/author context/i);
}
for(const disposition of ['PARTIAL','UNKNOWN']){
  const {project,review,test}=fixture({disposition});engine.recalculate(project);assert.equal(engine.semanticCoverageReviewAssessment(project,review).current,true);assert.deepEqual(test.fields.SEMANTIC_REVIEW_IDS,[]);assert.equal(test.fields.RELEASE_BEARING,false);
}

console.log(JSON.stringify({semanticReviewContract:'PASS',selfReviewRejected:true,reusedContextRejected:true,wrongTargetRejected:true,staleReviewRejected:true,historicalTargetRejected:true,unknownAuthorContextRejected:true,partialUnknownNonReleaseBearing:true}));
