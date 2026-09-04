import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,hash=globalThis.closedLoopHash;
const project=core.createBlankState('JOB-STAGE6-PACKAGE-UI');
Object.assign(project.job,{CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});
engine.ensureShape(project);engine.recalculate(project);
const author=engine.registerFreshContext(project,{stage:6,externalContextIdentifier:'external-author-session-1',purpose:'GENERAL'}),authorContextId=engine.recordId(author,'freshContexts');
project.stages[5].status='COMPLETE';project.stages[5].gate={complete:true,blocked:false,reasons:[]};
const scope=engine.currentScope(project),requirement={id:'REQ-1',stage:4,active:true,scope,fields:{REQ_ID:'REQ-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}},proposition={id:'PROPOSITION-1',stage:4,active:true,scope,fields:{PROPOSITION_ID:'PROPOSITION-1',REQUIREMENT_ID:'REQ-1',PROPOSITION_TEXT:'The current product contains exactly ten items.',SUBJECT_AND_SCOPE_DESCRIPTION:'The current product item collection.',SATISFACTION_MEANING:'The count is ten.',FAILURE_MEANING:'The count is not ten.',STATUS:'UNDETERMINED'},relationships:{REQUIREMENT_ID:'REQ-1'}};
project.projectData.requirements.push(requirement);project.projectData.propositions.push(proposition);engine.refreshRecordHashes(requirement,'requirements');engine.refreshRecordHashes(proposition,'propositions');

const authorPreview=structuredClone(project);authorPreview.revision=Number(project.revision||0)+1;const authorScope=prompts.assertRequiredPromptScope(6,'COMPLETE',prompts.scopeFor(6,authorPreview,{contextId:authorContextId})),authorReservation=engine.prepareOperationReservation(project,{stage:6,operation:'COMPLETE',targetSlot:'STAGE6:COMPLETE:AUTHORING',scope:authorScope,payload:{stage:6,operation:'COMPLETE',contextId:authorContextId}}),authorPrompt=prompts.buildPromptRecord(6,authorPreview,{operation:'COMPLETE',scope:authorScope,operationReservation:authorReservation});
assert.equal(authorPrompt.scope.contextId,authorContextId);
assert.equal(authorPrompt.operationBinding.targetSlot,'STAGE6:COMPLETE:AUTHORING');

const rawResponseId='RAW-STAGE6-AUTHOR',test={id:'TEST-1',stage:6,active:true,scope,rawResponseId,sourceProposalId:'PROPOSAL-STAGE6-AUTHOR',fields:{TEST_ID:'TEST-1',REQ_ID:'REQ-1',TEST_PROPOSITION_TEXT:'The current product item count equals ten.',TARGET_PROPOSITION_IDS:['PROPOSITION-1'],TESTED_SCOPE:'Current product item collection.',POSITIVE_RESULT_MEANING:'The count equals ten.',NEGATIVE_RESULT_MEANING:'The count differs from ten.',SEMANTIC_COVERAGE_DISPOSITION:'EQUIVALENT',SEMANTIC_REVIEW_IDS:[],TEST_ROLE:'REQUIRED_PROOF',RELEASE_BEARING:false,EXECUTABLE_KIND:'NONE',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:null,EXECUTABLE_INPUT_BINDINGS:{},TEST_TYPE:'MEANING',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',STATUS:'READY'},relationships:{REQ_ID:'REQ-1'}};
engine.refreshRecordHashes(test,'tests');project.projectData.tests.push(test);project.projectData.generatedPrompts.push(authorPrompt);project.projectData.rawResponses.push({rawResponseId,contextId:authorContextId,promptInstructionId:authorPrompt.instructionId});project.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE6-AUTHOR',stage:6,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'COMPLETE',rawResponseId,proposalId:'PROPOSAL-STAGE6-AUTHOR',promptId:authorPrompt.instructionId,canonicalRecordIds:['TEST-1'],scope:authorScope});
const reviewer=engine.registerFreshContext(project,{stage:6,externalContextIdentifier:'external-reviewer-session-1',purpose:'REVIEWER'}),reviewerContextId=engine.recordId(reviewer,'freshContexts'),target=engine.semanticReviewTargets(project)[0];
assert(target&&target.targetKind==='TEST'&&target.targetId==='TEST-1');
assert.throws(()=>engine.prepareSemanticReviewReservation(project,{targetKind:target.targetKind,targetId:target.targetId,reviewerContextId:authorContextId}),/independent-reviewer context|differ from the author context/i);
project.stages[5].status='COMPLETE';project.stages[5].gate={complete:true,blocked:false,reasons:[]};
const prepared=engine.prepareSemanticReviewReservation(project,{targetKind:target.targetKind,targetId:target.targetId,reviewerContextId}),reviewPreview=structuredClone(project);reviewPreview.revision=Number(project.revision||0)+1;const reviewPrompt=prompts.buildPromptRecord(6,reviewPreview,{operation:'SEMANTIC_REVIEW',scope:{...engine.currentScope(reviewPreview),contextId:reviewerContextId},operationReservation:prepared});
assert.equal(reviewPrompt.scope.contextId,reviewerContextId);
assert.notEqual(reviewerContextId,authorContextId);
assert.equal(reviewPrompt.contextManifest.semanticReviewTarget.targetId,'TEST-1');
assert.equal(reviewPrompt.contextManifest.semanticReviewTarget.targetSemanticHash,target.targetSemanticHash);
assert.equal(reviewPrompt.contextManifest.semanticReviewIsolation.reviewerContextDistinct,true);
assert.deepEqual(Object.keys(reviewPrompt.contextManifest.readCollections).filter(name=>['tests','proofExpressions'].includes(name)).map(name=>[name,reviewPrompt.contextManifest.readCollections[name].length]),[['tests',1],['proofExpressions',0]]);
assert.match(reviewPrompt.prompt,/all prior semantic coverage reviews/i);

const appSource=fs.readFileSync('app-core.js','utf8'),storeSource=fs.readFileSync('project-store.js','utf8');
for(const token of ['REGISTER_AUTHOR_CONTEXT','stage6AuthorContextMarkup','pendingSemanticReviewTarget(stage)','createExecutionPackage({project:current'])assert(appSource.includes(token),`Stage 06 one-action UI is missing ${token}`);
for(const token of ['async function createExecutionPackage','EXECUTION_PACKAGE_SEMANTIC_TEST_BATCH_PROHIBITED','semanticReviewTarget:exactSemanticReviewTarget','records:semanticRecord?[semanticRecord]','reservationPayloadHash:preparedPayloadHash','operationReservationTarget(project'])assert(storeSource.includes(token),`Stage 06 execution-package binding is missing ${token}`);

console.log(JSON.stringify({stage6AuthorContextBound:true,selfReviewBlocked:true,distinctReviewerReserved:true,targetOnlyPrompt:true,zeroTestBatchSemanticPackage:true}));
