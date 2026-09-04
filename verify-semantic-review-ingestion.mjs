import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {recordProposal,evidence} from './test-fixtures.mjs';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion;

let contextSequence=0;
const stage6Ready=project=>{project.stages[5].status='COMPLETE';project.stages[5].gate={complete:true,blocked:false,reasons:[]};};
function registerContext(project,purpose,label){
  const record=engine.registerFreshContext(project,{stage:6,externalContextIdentifier:`semantic-review-${purpose.toLowerCase()}-${label}-${++contextSequence}`,operatorLabel:'SEMANTIC_REVIEW_FIXTURE',purpose});
  return engine.recordId(record,'freshContexts');
}
function activatePreparedPrompt(project,operation,prepared){
  stage6Ready(project);
  const preview=engine.clone(project);preview.revision=prepared.expectedRevision;stage6Ready(preview);
  const prompt={...prompts.buildPromptRecord(6,preview,{operation,scope:prepared.scope,operationReservation:prepared}),generatedAt:new Date().toISOString()};
  engine.registerGeneratedPrompt(project,prompt);
  engine.reserveOperation(project,{preparedReservation:prepared,promptId:prompt.instructionId});
  project.revision=prepared.expectedRevision;
  engine.recalculate(project);
  return prompt;
}
function authorPrompt(project,contextId){
  stage6Ready(project);
  const prepared=engine.prepareCurrentOperationReservation(project,{stage:6,operation:'COMPLETE',contextId,scope:{contextId},owningTabInstance:'SEMANTIC_REVIEW_FIXTURE'});
  return activatePreparedPrompt(project,'COMPLETE',prepared);
}
function responseEnvelope(project,prompt,records,label){
  const binding=prompt.operationBinding;
  return {schema:schema.RESPONSE_SCHEMA,jobId:project.job.JOB_ID,stage:6,operation:prompt.operation,packageId:binding.packageId||null,operationReservationId:binding.operationReservationId,challengeNonce:binding.challengeNonce,targetSlot:binding.targetSlot,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records,evidence:[evidence(label)],unresolved:[],warnings:[],attachments:[]};
}
function commitResponse(project,prompt,records,label){
  const envelope=responseEnvelope(project,prompt,records,label),prepared=ingestion.prepare(project,{stage:6,text:JSON.stringify(envelope),promptRecord:prompt});
  assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SEMANTIC_REVIEW_FIXTURE'});
  return {project:committed.project,envelope,prepared,committed};
}

let project=core.createBlankState('JOB-SEMANTIC-REVIEW-INGESTION');
Object.assign(project.job,{CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});
engine.ensureShape(project);engine.recalculate(project);
const scope=engine.currentScope(project),requirementId='REQ-SR-1',propositionId='PROPOSITION-SR-1';
const requirement={id:requirementId,stage:4,active:true,scope,fields:{REQ_ID:requirementId,OBLIGATION:'The product contains exactly ten current items.',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}};
const proposition={id:propositionId,stage:4,active:true,scope,fields:{PROPOSITION_ID:propositionId,REQUIREMENT_ID:requirementId,PROPOSITION_TEXT:'The current product item count equals ten.',SUBJECT_AND_SCOPE_DESCRIPTION:'Current product item collection.',SATISFACTION_MEANING:'The count is exactly ten.',FAILURE_MEANING:'The count is not exactly ten.',STATUS:'CURRENT'},relationships:{REQUIREMENT_ID:requirementId}};
engine.refreshRecordHashes(requirement,'requirements');engine.refreshRecordHashes(proposition,'propositions');project.projectData.requirements.push(requirement);project.projectData.propositions.push(proposition);

const authorContextId=registerContext(project,'GENERAL','author'),testAuthorPrompt=authorPrompt(project,authorContextId),expectedTestId=`${schema.RECORD_SCHEMAS.tests.prefix}-000001`,testProposal=recordProposal(schema,'tests',{tempKey:'semantic-test',relationships:{REQ_ID:{recordId:requirementId}},overrides:{TEST_TYPE:'MEANING',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'Exact semantic comparison',ARTIFACT_REQUIREMENTS:'NONE',INPUTS:'Current product item collection',TOOLS:'Independent semantic review',PROCEDURE:'Compare the exact item-count truth condition.',EXPECTED_RESULT:'The count equals ten.',FAILURE_CONDITION:'The count differs from ten.',EVIDENCE_TO_PRESERVE:'Exact semantic comparison evidence.',TEST_PROPOSITION_TEXT:'The current product item count equals ten.',TESTED_SCOPE:'Current product item collection.',POSITIVE_RESULT_MEANING:'The count equals ten.',NEGATIVE_RESULT_MEANING:'The count differs from ten.',SEMANTIC_COVERAGE_DISPOSITION:'EQUIVALENT',TEST_ROLE:'REQUIRED_PROOF',EXPECTED_VARIANCE_CONTRACT:{mode:'EXACT'}}}),expressionProposal=recordProposal(schema,'proofExpressions',{tempKey:'proof-expression',relationships:{TARGET_PROPOSITION_ID:{recordId:propositionId}},overrides:{PROPOSED_EXPRESSION:{type:'LEAF',testId:expectedTestId},SEMANTIC_RATIONALE:'The exact reviewed test directly evaluates the target proposition.'}});
const testCommit=commitResponse(project,testAuthorPrompt,{tests:[testProposal],proofExpressions:[expressionProposal]},'Stage 6 author test and proof expression');project=testCommit.project;
const test=engine.recordsForCurrentScope(project,'tests').at(-1),targetId=engine.recordId(test,'tests');
assert(targetId&&test.rawResponseId,'Stage 6 author test was not created by accepted ingestion.');
assert.equal(targetId,expectedTestId,'The Stage 6 fixture did not receive its application-allocated test identity.');
assert.deepEqual(engine.recordValue(test,'TARGET_PROPOSITION_IDS'),[propositionId]);
const authorChange=project.projectData.acceptedChanges.find(change=>change.status==='COMMITTED'&&change.operation==='COMPLETE'&&change.canonicalRecordIds?.includes(targetId));
assert(authorChange&&authorChange.rawResponseId===test.rawResponseId,'Author test lacks its accepted Stage 6 COMPLETE binding.');
assert.notEqual(authorChange.scope.testSuiteVersion,project.job.CURRENT_TEST_SUITE_VERSION,'Stage 6 author fixture did not exercise the controlled post-commit test-suite version advance.');
assert.equal(project.projectData.artifactVersions.filter(version=>version.stage===6&&version.kind==='TEST-SUITE'&&version.acceptedChangeId===authorChange.changeId&&version.version===project.job.CURRENT_TEST_SUITE_VERSION).length,1,'Stage 6 author version advance lacks its exact application transition record.');
const expression=engine.recordsForCurrentScope(project,'proofExpressions').at(-1),expressionId=engine.recordId(expression,'proofExpressions');
assert(expressionId&&expression.rawResponseId,'Stage 6 proof expression was not created by accepted ingestion.');

const unrelatedVersion=engine.clone(project);unrelatedVersion.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v999';for(const collection of ['tests','proofExpressions'])for(const row of unrelatedVersion.projectData[collection].filter(record=>record.active!==false))row.scope={...(row.scope||{}),testSuiteVersion:'TEST-SUITE-v999'};
assert.throws(()=>engine.prepareSemanticReviewReservation(unrelatedVersion,{targetKind:'TEST',targetId,reviewerContextId:authorContextId,owningTabInstance:'SEMANTIC_REVIEW_FIXTURE'}),/(?:controlled test-suite version transition|accepted Stage 6 COMPLETE author binding)/i,'An unrelated current-version rewrite must not make an old author binding current.');

const reviewTarget=target=>{
  const reviewerContextId=registerContext(project,'REVIEWER',`${target.targetKind.toLowerCase()}-${target.targetId}`);
  assert.throws(()=>engine.prepareSemanticReviewReservation(project,{targetKind:target.targetKind,targetId:target.targetId,reviewerContextId:authorContextId,owningTabInstance:'SEMANTIC_REVIEW_FIXTURE'}),/(?:independent-reviewer|distinct|differ)/i);
  const preparedReservation=engine.prepareSemanticReviewReservation(project,{targetKind:target.targetKind,targetId:target.targetId,reviewerContextId,owningTabInstance:'SEMANTIC_REVIEW_FIXTURE'}),reservationId=String(engine.recordValue(preparedReservation,'OPERATION_RESERVATION_ID')||preparedReservation.operationReservationId),prompt=activatePreparedPrompt(project,'SEMANTIC_REVIEW',preparedReservation),read=prompt.contextManifest.readCollections||{},targetCollection=target.targetKind==='TEST'?'tests':'proofExpressions',otherCollection=target.targetKind==='TEST'?'proofExpressions':'tests';
  assert.equal(prompt.contextManifest.semanticReviewTarget.targetId,target.targetId);
  assert.equal(prompt.contextManifest.semanticReviewTarget.targetSemanticHash,engine.semanticReviewTargetHash(project,target.targetKind,target.targetId));
  assert.equal(prompt.contextManifest.semanticReviewIsolation.applicationInputIsolation,'APPLICATION_ESTABLISHED');
  assert.deepEqual((read[targetCollection]||[]).map(row=>row.id),[target.targetId]);
  assert.equal((read[otherCollection]||[]).length,0);assert.equal((read.semanticCoverageReviews||[]).length,0);
  const proposal=recordProposal(schema,'semanticCoverageReviews',{tempKey:`review-${target.targetKind.toLowerCase()}`,overrides:{SEMANTIC_COVERAGE_DISPOSITION:'EQUIVALENT',REASONING:'The exact selected target and target proposition have the same subject, scope, truth condition, satisfaction meaning, and failure meaning.'}}),beforeCommit=engine.clone(project),result=commitResponse(project,prompt,{semanticCoverageReviews:[proposal]},`Independent ${target.targetKind} semantic review`);project=result.project;
  const review=engine.recordsForCurrentScope(project,'semanticCoverageReviews').at(-1),assessment=engine.semanticCoverageReviewAssessment(project,review);
  assert.equal(assessment.current,true,assessment.reasons.join(' | '));assert.equal(assessment.reservationId,reservationId);
  return {reviewId:engine.recordId(review,'semanticCoverageReviews'),reviewerContextId,reservationId,promptId:prompt.instructionId,beforeCommit,envelope:result.envelope};
};

const testTarget=engine.semanticReviewTargets(project).find(target=>target.targetKind==='TEST'&&target.targetId===targetId);assert(testTarget,'The ingested test was not routed to semantic review.');
const testReview=reviewTarget(testTarget);
const expressionTarget=engine.semanticReviewTargets(project).find(target=>target.targetKind==='PROOF_EXPRESSION'&&target.targetId===expressionId);assert(expressionTarget,'The ingested proof expression was not routed to semantic review.');
const expressionReview=reviewTarget(expressionTarget);
const acceptedTest=engine.recordsForCurrentScope(project,'tests').find(row=>engine.recordId(row,'tests')===targetId),acceptedReview=engine.recordsForCurrentScope(project,'semanticCoverageReviews').find(row=>engine.recordId(row,'semanticCoverageReviews')===testReview.reviewId);
assert.equal(engine.recordValue(acceptedReview,'ACCEPTED_STATUS'),'ACCEPTED');assert.equal(engine.recordValue(acceptedReview,'TARGET_TEST_ID'),targetId);
assert(engine.recordValue(acceptedReview,'OPERATION_RESERVATION_ID')&&engine.recordValue(acceptedReview,'TARGET_SEMANTIC_HASH'));
assert.equal(String(engine.recordValue(acceptedReview,'PACKAGE_ID')||''),String(project.projectData.generatedPrompts.find(row=>row.instructionId===testReview.promptId)?.operationBinding?.packageId||''),'Optional package identity must remain exact when no execution package is required.');
assert.equal(engine.recordValue(acceptedReview,'REVIEWER_CONTEXT_DISTINCT'),true);assert.equal(engine.recordValue(acceptedReview,'RAW_RESPONSE_DISTINCT'),true);
assert.deepEqual(engine.recordValue(acceptedTest,'SEMANTIC_REVIEW_IDS'),[testReview.reviewId]);assert.equal(engine.recordValue(acceptedTest,'RELEASE_BEARING'),true);

const selfRaw=engine.clone(project),selfRawReview=selfRaw.projectData.semanticCoverageReviews.find(row=>engine.recordId(row,'semanticCoverageReviews')===testReview.reviewId),selfRawTest=selfRaw.projectData.tests.find(row=>engine.recordId(row,'tests')===targetId);selfRawReview.rawResponseId=selfRawTest.rawResponseId;engine.recalculate(selfRaw);assert.equal(engine.recordValue(selfRawReview,'ACCEPTED_STATUS'),'BLOCKED');assert.equal(engine.recordValue(selfRawTest,'RELEASE_BEARING'),false);

const reusedContext=engine.clone(project),reusedReview=reusedContext.projectData.semanticCoverageReviews.find(row=>engine.recordId(row,'semanticCoverageReviews')===testReview.reviewId),reusedTest=reusedContext.projectData.tests.find(row=>engine.recordId(row,'tests')===targetId),reusedRaw=reusedContext.projectData.rawResponses.find(row=>row.rawResponseId===engine.recordValue(reusedReview,'REVIEWER_RAW_RESPONSE_ID')),reusedPrompt=reusedContext.projectData.generatedPrompts.find(row=>row.instructionId===engine.recordValue(reusedReview,'REVIEWER_PROMPT_ID'));reusedRaw.contextId=engine.recordValue(reusedReview,'AUTHOR_CONTEXT_ID');reusedPrompt.scope.contextId=engine.recordValue(reusedReview,'AUTHOR_CONTEXT_ID');engine.recalculate(reusedContext);assert.equal(engine.recordValue(reusedReview,'ACCEPTED_STATUS'),'BLOCKED');assert.equal(engine.recordValue(reusedTest,'RELEASE_BEARING'),false);

const missingReservation=engine.clone(project),missingReservationReview=missingReservation.projectData.semanticCoverageReviews.find(row=>engine.recordId(row,'semanticCoverageReviews')===testReview.reviewId),missingReservationTest=missingReservation.projectData.tests.find(row=>engine.recordId(row,'tests')===targetId),reservation=missingReservation.projectData.operationReservations.find(row=>engine.recordId(row,'operationReservations')===engine.recordValue(missingReservationReview,'OPERATION_RESERVATION_ID'));reservation.active=false;reservation.invalidatedBy='SEMANTIC-REVIEW-RESERVATION-REMOVED';engine.recalculate(missingReservation);assert.equal(engine.recordValue(missingReservationReview,'ACCEPTED_STATUS'),'BLOCKED');assert.equal(engine.recordValue(missingReservationTest,'RELEASE_BEARING'),false);

const missingHash=engine.clone(project),missingHashReview=missingHash.projectData.semanticCoverageReviews.find(row=>engine.recordId(row,'semanticCoverageReviews')===testReview.reviewId),missingHashTest=missingHash.projectData.tests.find(row=>engine.recordId(row,'tests')===targetId),missingHashPrompt=missingHash.projectData.generatedPrompts.find(row=>row.instructionId===engine.recordValue(missingHashReview,'REVIEWER_PROMPT_ID'));missingHashPrompt.contextManifest.semanticReviewTarget.targetSemanticHash='';missingHashReview.fields.TARGET_SEMANTIC_HASH='';missingHashReview.TARGET_SEMANTIC_HASH='';engine.recalculate(missingHash);assert.equal(engine.recordValue(missingHashReview,'ACCEPTED_STATUS'),'BLOCKED');assert.equal(engine.recordValue(missingHashTest,'RELEASE_BEARING'),false);

const changedTarget=engine.clone(project),changedReview=changedTarget.projectData.semanticCoverageReviews.find(row=>engine.recordId(row,'semanticCoverageReviews')===testReview.reviewId),changedTest=changedTarget.projectData.tests.find(row=>engine.recordId(row,'tests')===targetId);changedTest.fields.TEST_PROPOSITION_TEXT='The current product item count is at least ten.';changedTest.TEST_PROPOSITION_TEXT=changedTest.fields.TEST_PROPOSITION_TEXT;engine.refreshRecordHashes(changedTest,'tests');engine.recalculate(changedTarget);assert.equal(engine.recordValue(changedReview,'ACCEPTED_STATUS'),'STALE');assert.equal(engine.recordValue(changedTest,'RELEASE_BEARING'),false);assert.deepEqual(engine.recordValue(changedTest,'SEMANTIC_REVIEW_IDS'),[]);

const wrongRelationship=structuredClone(testReview.envelope);wrongRelationship.records.semanticCoverageReviews[0].relationships={TARGET_TEST_ID:{recordId:targetId}};const rejected=ingestion.prepare(testReview.beforeCommit,{stage:6,text:JSON.stringify(wrongRelationship),promptRecord:testReview.beforeCommit.projectData.generatedPrompts.find(row=>row.instructionId===testReview.promptId)});assert.equal(rejected.validation.valid,false);assert(rejected.validation.issues.some(row=>row.code==='SEMANTIC_REVIEW_RELATIONSHIP_OWNERSHIP'));

engine.recalculate(project);const releaseBearingHash=acceptedTest.recordSha256;assert.equal(releaseBearingHash,globalThis.closedLoopHash.recordSha256(acceptedTest),'Application-derived RELEASE_BEARING changed without refreshing the canonical test record hash.');engine.recalculate(project);assert.equal(acceptedTest.recordSha256,releaseBearingHash,'Idempotent recalculation changed the current release-bearing test hash.');assert.equal(acceptedTest.recordSha256,globalThis.closedLoopHash.recordSha256(acceptedTest),'Repeated recalculation left a stale current test hash.');

const projectReportPath=String(process.env.SEMANTIC_REVIEW_PROJECT_REPORT_PATH||'').trim();
if(projectReportPath)fs.writeFileSync(projectReportPath,`${JSON.stringify({schema:'closed-loop-semantic-review-ingestion-project/1',project,requirementId,propositionId,targetId,testReviewId:testReview.reviewId,proofExpressionId:expressionId,proofExpressionReviewId:expressionReview.reviewId})}\n`,{encoding:'utf8',flag:'wx'});

console.log(JSON.stringify({semanticReviewIngestion:'PASS',authorTargetIngested:true,controlledAuthorVersionAdvanceAccepted:true,unrelatedAuthorVersionRejected:true,targetOnlyPrompt:true,distinctReviewContext:true,exactTargetHash:true,applicationDerivedBindings:true,selfReviewReservationBlocked:true,selfRawResponseBlocked:true,reusedContextBlocked:true,missingReservationBlocked:true,missingTargetHashBlocked:true,acceptedIndependentReview:true,acceptedReviewBindsExactIds:true,targetChangeStale:true,targetChangeWithdrawsReleaseBearing:true,wrongRelationshipRejected:true,releaseBearingRecordHashCurrent:true,idempotentRecalculationPreservesTestHash:true,targetId,testReviewId:testReview.reviewId,proofExpressionId:expressionId,proofExpressionReviewId:expressionReview.reviewId},null,2));
