import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const engine=globalThis.closedLoopWorkflowEngine;
const hash=globalThis.closedLoopHash;

function project(name){
  const value=core.createBlankState(name);
  value.job.EXACT_USER_OBJECTIVE_VERBATIM='Produce the controlled result.';
  engine.ensureShape(value);
  return value;
}

function accept(value,stage,operation,{contextId=`CONTEXT-${stage}-${operation}`,rawResponseId=`RAW-${stage}-${operation}`,proposalId=`PROPOSAL-${stage}-${operation}`,eventSequence}={}){
  const sequence=eventSequence??value.projectData.acceptedChanges.length+1;
  const scope={...engine.currentScope(value),projectRevision:Number(value.revision||0),contextId};
  const change={changeId:`CHANGE-${stage}-${operation}-${sequence}`,rawResponseId,proposalId,validationId:`VALIDATION-${stage}-${operation}-${sequence}`,jobId:value.job.JOB_ID,stage,responseType:'DATA_PROPOSAL',status:'COMMITTED',operation,scope,eventSequence:sequence,canonicalRecordIds:[],stageFields:[]};
  value.projectData.acceptedChanges.push(change);
  value.projectData.responseProposals.push({proposalId,rawResponseId,stage,responseType:'DATA_PROPOSAL',envelope:{operation,scope},proposedStageData:{},canonicalRecords:{},evidence:[]});
  return change;
}

function record(value,collection,id,stage,fields,{rawResponseId='',proposalId='',evidenceRefs=[]}={}){
  const row={id,stage,active:true,scope:{...engine.currentScope(value)},fields:{...fields},...fields,source:rawResponseId?'AGENT_RESPONSE':'APPLICATION_DERIVED',rawResponseId,sourceProposalId:proposalId,evidenceRefs};
  row.contentSha256=hash.contentRecordSha256(row,globalThis.closedLoopWorkflowSchema.RECORD_SCHEMAS[collection].idField);
  row.recordSha256=hash.recordSha256(row);row.sha256=row.recordSha256;
  value.projectData[collection].push(row);
  return row;
}

function independentReviewerContext(value,id,stage=5){
  return record(value,'freshContexts',id,stage,{CONTEXT_ID:id,EXTERNAL_CONTEXT_IDENTIFIER:`EXTERNAL-${id}`,ROLE:'INDEPENDENT REVIEWER',ITERATION_ID:'NOT APPLICABLE',RUN_ID:'NOT APPLICABLE',AUTHORIZED_PROJECT_INPUTS:value.job.CURRENT_INPUT_VERSION||'UNKNOWN',AUTHORIZED_EXTERNAL_SOURCE_MATERIAL:value.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',FROZEN_ARTIFACT_VERSIONS:'CURRENT AUTHORIZED VERSIONS',TOOL_AVAILABILITY:'UNKNOWN',CONTAMINATION_STATUS:'UNKNOWN',OUTPUT_IDENTITY:'UNKNOWN',DEVIATIONS:'NONE',EVIDENCE:'Dedicated independent review context.',USABILITY_DETERMINATION:'CURRENT'});
}

function installCompleteIntake(value,{artifactDisposition='RETAINED_AS_CONTEXT'}={}){
  const manifest=engine.intakeCoverageManifest(value);
  const capture={schema:'closed-loop-stage01-capture/1',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,units:manifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:unit.kind==='SUPPLIED_MATERIAL'?artifactDisposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'Current controlled accounting.',...(unit.kind==='SUPPLIED_MATERIAL'?{artifactInspection:{artifactId:unit.artifactId,artifactSha256:unit.artifactSha256,inspectedActualBytes:true}}:{}),extractedStatements:['NO_PROJECT_RELEVANT_INFORMATION','INACCESSIBLE_OR_BLOCKED'].includes(unit.kind==='SUPPLIED_MATERIAL'?artifactDisposition:'EXTRACTED_RELEVANT_INFORMATION')?[]:[{statementKey:`S-${index+1}`,text:unit.rawValueText||unit.label,statementClass:'REQUIREMENT',sourceLocations:[{kind:'OTHER',value:unit.sourceLocation}]}]}))};
  value.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Controlled result',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)};
  return capture;
}

function installBoundedSearch(value){
  value.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'APPLICABLE_SOURCES_ESTABLISHED',SEARCH_UNIVERSE:'Declared current project scope',SEARCH_PROCEDURE:'Search each declared authority collection',SEARCH_LOCATIONS:['Authority registry'],SEARCH_QUERIES_OR_STRATEGIES:['current governing requirements'],SEARCH_CUTOFF:'CURRENT_VERSION',SEARCH_LIMITATIONS:'NONE',SEARCH_EXECUTION_EVIDENCE:['EVIDENCE-SEARCH'],DISCOVERY_RISK:'NONMATERIAL'};
}

function requirementFields(obligationIds,{classification='MANDATORY',applicability='APPLICABLE'}={}){return{REQ_ID:'REQ-1',OBLIGATION:'The controlled result must satisfy the current obligation.',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:classification,SOURCE_ID:'',SOURCE_LOCATION:'User Job Input',SOURCE_AUTHORITY:'HUMAN',USER_INPUT_RELATIONSHIP:obligationIds.join(' '),APPLICABILITY:applicability,DEPENDENCIES:'NONE',PROHIBITIONS:'NONE',DEFINED_TERMS:'NONE',OBSERVABLE_SATISFACTION_CONDITION:'The obligation is observed satisfied.',INTENDED_VERIFICATION_METHOD:'Inspect the result.',EXPECTED_EVIDENCE:'Current bound observation.',FAILURE_CONDITION:'The obligation is not satisfied.',SEVERITY:'MAJOR',STATUS:'ACTIVE',NOTES:''};}

// 197/199: a large artifact broadly dismissed as irrelevant cannot close Stage 01 without a fresh challenge and later reconciliation.
{
  const value=project('SEMANTIC-STAGE01-BYPASS');
  engine.registerArtifactBytes(value,{stage:1,artifactId:'ARTIFACT-LARGE',filename:'large-intent.txt',mediaType:'text/plain',byteSize:engine.SEMANTIC_CHALLENGE_LIMITS.maximumArtifactBytesWithoutChallenge+1,sha256:'a'.repeat(64),role:'HUMAN_INPUT'});
  value.stages[1].authorizedFiles=[{artifactId:'ARTIFACT-LARGE'}];
  installCompleteIntake(value,{artifactDisposition:'NO_PROJECT_RELEVANT_INFORMATION'});
  const initial=accept(value,1,'COMPLETE',{contextId:'CONTEXT-FIRST-EXTRACTION'});
  value.projectData.stageConfirmations.push({stage:1,confirmed:true,acceptedChangeId:initial.changeId,inputVersion:value.job.CURRENT_INPUT_VERSION});
  const status=engine.evaluateIntakeSemanticChallenge(value),gate=engine.gate(1,value);
  assert.equal(status.required,true,'Stage 01 did not trigger an independent challenge for a large supplied artifact dismissed as NO_PROJECT_RELEVANT_INFORMATION.');
  assert.equal(status.complete,false,'Stage 01 challenge was treated as complete without challenge/reconciliation receipts.');
  assert.equal(gate.complete,false,'Stage 01 gate completed without the required semantic challenge and reconciliation.');
  assert.match(gate.reasons.join(' '),/SEMANTIC_CHALLENGE/i,'Stage 01 gate did not localize the missing semantic challenge.');
  assert.ok(engine.executionHandoff(value,{stage:1,operation:'COMPLETE'}).send.length>0,'Stage 01 first extraction did not receive the stored supplied bytes.');
  assert.equal(engine.executionHandoff(value,{stage:1,operation:'RECONCILE_INTAKE'}).send.length,0,'Stage 01 reconciliation incorrectly required the original files to be transferred again.');
  assert.ok(engine.executionHandoff(value,{stage:1,operation:'SEMANTIC_CHALLENGE'}).withhold.some(item=>/first Stage 01 semantic extraction/i.test(item.artifactIdOrCategory)),'Stage 01 independent challenge handoff did not declare the first extraction withheld.');
  const challenge=accept(value,1,'SEMANTIC_CHALLENGE',{contextId:'CONTEXT-INDEPENDENT-CHALLENGE',eventSequence:2});value.projectData.responseProposals.find(item=>item.proposalId===challenge.proposalId).proposedStageData.CHALLENGE_FINDING_RECORDS={findings:[{findingKey:'FINDING-STAGE01-1',sourceUnitId:'INPUT-UNIT-1',finding:'The broad no-relevant-information exclusion requires reconciliation.'}]};
  const reconcile=accept(value,1,'RECONCILE_INTAKE',{contextId:'CONTEXT-RECONCILIATION',eventSequence:3});const reconcileProposal=value.projectData.responseProposals.find(item=>item.proposalId===reconcile.proposalId);reconcileProposal.proposedStageData.INPUT_SET_CONTENTS=value.stages[1].agentData.INPUT_SET_CONTENTS;
  assert.equal(engine.evaluateIntakeSemanticChallenge(value).complete,false,'Stage 01 treated an accepted reconciliation as complete while a material challenge finding remained undispositioned.');
  reconcileProposal.proposedStageData.CHALLENGE_FINDING_RECORDS={findings:[{findingKey:'FINDING-STAGE01-1',disposition:'NONMATERIAL',reason:'Independent review established the artifact contains no project-relevant statement.'}]};value.projectData.stageConfirmations.push({stage:1,confirmed:true,acceptedChangeId:reconcile.changeId,inputVersion:value.job.CURRENT_INPUT_VERSION});
  assert.equal(engine.evaluateIntakeSemanticChallenge(value).complete,true,'A correctly ordered independent Stage 01 challenge and reconciled intake did not close the trigger.');
}

// 204-206: a no-source conclusion requires a bounded executed search, nonmaterial risk, and independent adequacy review.
{
  const value=project('SEMANTIC-STAGE02-BYPASS');installCompleteIntake(value);value.stages[1].status='COMPLETE';
  value.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};
  const change=accept(value,2,'COMPLETE',{contextId:'CONTEXT-SOURCE-SEARCH'});const proposal=value.projectData.responseProposals.find(item=>item.proposalId===change.proposalId);proposal.evidence=[{temporaryKey:'evidence-1',kind:'SEARCH',description:'Bare no-source claim',authorityType:'AGENT_CLAIM',location:'response',content:'None found.'}];
  const status=engine.evaluateSourceSearchClosure(value),gate=engine.gate(2,value);
  assert.equal(status.complete,false,'NO_APPLICABLE_EXTERNAL_SOURCE closed without a bounded source-search contract and independent adequacy review.');
  assert.equal(gate.complete,false,'Stage 02 gate completed on a bare no-source claim.');
  assert.match(gate.reasons.join(' '),/bounded source-search|SEARCH_ADEQUACY_REVIEW/i,'Stage 02 gate did not localize the absent bounded search/review.');
  record(value,'evidenceRecords','EVIDENCE-SEARCH',2,{EVIDENCE_ID:'EVIDENCE-SEARCH',KIND:'SEARCH_EXECUTION',DESCRIPTION:'The bounded source search was executed.',CONTENT:'Every source in the declared universe was dispositioned.',STATUS:'PRESERVED'},{rawResponseId:change.rawResponseId,proposalId:change.proposalId});change.canonicalRecordIds.push('EVIDENCE-SEARCH');
  Object.assign(value.stages[2].agentData,{SEARCH_UNIVERSE:'Declared governing-source scope',SEARCH_PROCEDURE:'Search every named current authority',SEARCH_LOCATIONS:['Authority registry'],SEARCH_QUERIES_OR_STRATEGIES:['current governing rules'],SEARCH_CUTOFF:'CURRENT_VERSION',SEARCH_LIMITATIONS:'NONE',SEARCH_EXECUTION_EVIDENCE:'EVIDENCE-SEARCH',DISCOVERY_RISK:'NONMATERIAL'});const review=accept(value,2,'SEARCH_ADEQUACY_REVIEW',{contextId:'CONTEXT-INDEPENDENT-SEARCH-REVIEW',eventSequence:2}),reviewProposal=value.projectData.responseProposals.find(item=>item.proposalId===review.proposalId);record(value,'evidenceRecords','EVIDENCE-INDEPENDENT-ADEQUACY',2,{EVIDENCE_ID:'EVIDENCE-INDEPENDENT-ADEQUACY',KIND:'SEARCH_REVIEW',DESCRIPTION:'Independent adequacy finding.',CONTENT:'Adequate within the bounded search contract.',STATUS:'PRESERVED'},{rawResponseId:review.rawResponseId,proposalId:review.proposalId});review.canonicalRecordIds.push('EVIDENCE-INDEPENDENT-ADEQUACY');Object.assign(value.stages[2].agentData,{SEARCH_EXECUTION_EVIDENCE:'EVIDENCE-SEARCH; EVIDENCE-INDEPENDENT-ADEQUACY',DISCOVERY_RISK:'NONMATERIAL'});reviewProposal.proposedStageData={SEARCH_EXECUTION_EVIDENCE:'EVIDENCE-SEARCH; EVIDENCE-INDEPENDENT-ADEQUACY',DISCOVERY_RISK:'NONMATERIAL'};reviewProposal.evidence=[{id:'EVIDENCE-INDEPENDENT-ADEQUACY',temporaryKey:'review-evidence',kind:'SEARCH_REVIEW',description:'Independent adequacy finding',authorityType:'AGENT_CLAIM',location:'response',content:'Adequate within the bounded search contract.'}];
  assert.equal(engine.evaluateSourceSearchClosure(value).complete,true,'A bounded no-source search with independent adequacy evidence did not close.');
}

// 203: mapping distinct obligations into one requirement requires an atomicity challenge and later reconciliation.
{
  const value=project('SEMANTIC-STAGE04-BYPASS');value.job.EXPLICIT_USER_REQUIREMENTS='Preserve A. Preserve B.';installCompleteIntake(value);installBoundedSearch(value);value.stages[1].status='COMPLETE';value.stages[3].status='COMPLETE';
  const obligationIds=engine.obligationManifest(value).items.map(item=>item.obligationId);assert.ok(obligationIds.length>=2,'Stage 04 regression fixture did not create distinct obligations.');
  record(value,'requirements','REQ-1',4,requirementFields(obligationIds));record(value,'propositions','PROPOSITION-1',4,{PROPOSITION_ID:'PROPOSITION-1',REQUIREMENT_ID:'REQ-1',PROPOSITION_TEXT:'The controlled result preserves each required item.',SUBJECT_AND_SCOPE_DESCRIPTION:'Current result',SATISFACTION_MEANING:'Each required item is preserved.',FAILURE_MEANING:'A required item is not preserved.',CURRENT_SCOPE:engine.currentScope(value),CONTENT_SHA256:'',STATUS:'CURRENT'});
  accept(value,4,'COMPLETE',{contextId:'CONTEXT-FIRST-COMPILER'});
  const status=engine.evaluateStage4SemanticChallenges(value),gate=engine.gate(4,value);
  assert.equal(status.required,true,'Stage 04 did not trigger an atomicity challenge for a many-obligation merge.');
  assert.equal(status.complete,false,'Stage 04 merge challenge was treated as complete without challenge/reconciliation.');
  assert.equal(gate.complete,false,'Stage 04 gate completed after merging distinct obligations without a challenge.');
  assert.match(gate.reasons.join(' '),/ATOMICITY_CHALLENGE/i,'Stage 04 gate did not localize the missing merge/atomicity challenge.');
  assert.ok(engine.executionHandoff(value,{stage:4,operation:'ATOMICITY_CHALLENGE'}).withhold.some(item=>/disposition-challenge conclusions/i.test(item.artifactIdOrCategory)),'Stage 04 atomicity challenge did not declare other semantic challenge conclusions withheld.');
  const challenge=accept(value,4,'ATOMICITY_CHALLENGE',{contextId:'CONTEXT-INDEPENDENT-ATOMICITY',eventSequence:2});value.projectData.responseProposals.find(item=>item.proposalId===challenge.proposalId).proposedStageData.ATOMICITY_CHALLENGE_RECORDS={findings:[{findingKey:'FINDING-STAGE04-1',requirementId:'REQ-1',finding:'Confirm that the merge preserves equivalent semantics.'}]};const reconcile=accept(value,4,'RECONCILE_REQUIREMENTS',{contextId:'CONTEXT-RECONCILE-REQUIREMENTS',eventSequence:3}),reconcileProposal=value.projectData.responseProposals.find(item=>item.proposalId===reconcile.proposalId);
  assert.equal(engine.evaluateStage4SemanticChallenges(value).complete,false,'Stage 04 treated reconciliation as complete while an atomicity challenge finding remained undispositioned.');
  reconcileProposal.proposedStageData.ATOMICITY_CHALLENGE_RECORDS={findings:[{findingKey:'FINDING-STAGE04-1',disposition:'RESOLVED',reason:'The reconciled proposition explicitly preserves both independently testable obligations.'}]};
  assert.equal(engine.evaluateStage4SemanticChallenges(value).complete,true,'A current Stage 04 atomicity challenge followed by reconciliation did not close the merge challenge.');
}

// 172/176/177: an agent-only release-obligation downgrade and unsupported NOT_APPLICABLE proposal cannot close Stage 05.
{
  const value=project('SEMANTIC-STAGE05-BYPASS');installCompleteIntake(value);installBoundedSearch(value);value.stages[1].status='COMPLETE';value.stages[4].status='COMPLETE';
  const obligationId=engine.obligationManifest(value).items[0].obligationId;
  record(value,'requirements','REQ-1',4,requirementFields([obligationId],{classification:'OPTIONAL',applicability:'NOT_APPLICABLE'}));record(value,'propositions','PROPOSITION-1',4,{PROPOSITION_ID:'PROPOSITION-1',REQUIREMENT_ID:'REQ-1',PROPOSITION_TEXT:'The controlled result satisfies the obligation.',SUBJECT_AND_SCOPE_DESCRIPTION:'Current result',SATISFACTION_MEANING:'The obligation is satisfied.',FAILURE_MEANING:'The obligation is not satisfied.',CURRENT_SCOPE:engine.currentScope(value),CONTENT_SHA256:'',STATUS:'CURRENT'});
  const complete=accept(value,5,'COMPLETE',{contextId:'CONTEXT-AGENT-CLOSURE'});
  record(value,'applicabilityRecords','APPLICABILITY-1',5,{APPLICABILITY_ID:'APPLICABILITY-1',SUBJECT_ID:'PROPOSITION-1',PROPOSED_APPLICABILITY:'NOT_APPLICABLE',REASONING:'The agent says it does not apply.'},{rawResponseId:complete.rawResponseId,proposalId:complete.proposalId});
  const status=engine.evaluateStage5SemanticClosure(value),gate=engine.gate(5,value);
  assert.equal(status.complete,false,'Stage 05 semantic closure accepted an agent-only downgrade and unsupported NOT_APPLICABLE proposal.');
  assert.equal(gate.complete,false,'Stage 05 gate completed with no independent classification/applicability review.');
  assert.match(gate.reasons.join(' '),/NORMATIVE_CLASSIFICATION_REVIEW|NOT_APPLICABLE|APPLICABILITY_REVIEW/i,'Stage 05 gate did not localize the downgrade/applicability defects.');
  value.projectData.applicabilityRecords[0].active=false;const classification=accept(value,5,'NORMATIVE_CLASSIFICATION_REVIEW',{contextId:'CONTEXT-INDEPENDENT-CLASSIFICATION',eventSequence:2});value.projectData.responseProposals.find(item=>item.proposalId===classification.proposalId).proposedStageData.NORMATIVE_CLASSIFICATION_REVIEWS=[{requirementId:'REQ-1',finding:'OPTIONAL classification independently accepted.'}];independentReviewerContext(value,'CONTEXT-INDEPENDENT-APPLICABILITY');const reviewed=accept(value,5,'APPLICABILITY_REVIEW',{contextId:'CONTEXT-INDEPENDENT-APPLICABILITY',eventSequence:3});record(value,'evidenceRecords','EVIDENCE-NON-ACTIVATION',5,{EVIDENCE_ID:'EVIDENCE-NON-ACTIVATION',KIND:'APPLICABILITY',DESCRIPTION:'Current non-activation evidence.',CONTENT:'The activation condition is affirmatively false.',STATUS:'CURRENT'});record(value,'applicabilityRecords','APPLICABILITY-2',5,{APPLICABILITY_ID:'APPLICABILITY-2',SUBJECT_ID:'PROPOSITION-1',PROPOSED_APPLICABILITY:'NOT_APPLICABLE',REASONING:'Current affirmative evidence establishes non-activation.'},{rawResponseId:reviewed.rawResponseId,proposalId:reviewed.proposalId,evidenceRefs:['EVIDENCE-NON-ACTIVATION']});
  assert.equal(engine.evaluateStage5SemanticClosure(value).complete,true,'Independent classification and evidence-backed applicability review did not close Stage 05 semantics.');
}

// 161/162: distinct proposition identities remain separate until a current independent equivalence review covers them.
{
  const value=project('SEMANTIC-STAGE05-EQUIVALENCE');value.job.CURRENT_REQUIREMENTS_VERSION='REQ-v001';
  record(value,'requirements','REQ-1',4,requirementFields(['OBLIGATION-A']));record(value,'requirements','REQ-2',4,{...requirementFields(['OBLIGATION-B']),REQ_ID:'REQ-2',OBLIGATION:'The second controlled obligation must be satisfied.'});
  record(value,'propositions','PROPOSITION-1',4,{PROPOSITION_ID:'PROPOSITION-1',REQUIREMENT_ID:'REQ-1',PROPOSITION_TEXT:'The first obligation is satisfied.',SUBJECT_AND_SCOPE_DESCRIPTION:'Current result',SATISFACTION_MEANING:'First obligation satisfied.',FAILURE_MEANING:'First obligation not satisfied.',CURRENT_SCOPE:engine.currentScope(value),CONTENT_SHA256:'',STATUS:'CURRENT'});
  record(value,'propositions','PROPOSITION-2',4,{PROPOSITION_ID:'PROPOSITION-2',REQUIREMENT_ID:'REQ-2',PROPOSITION_TEXT:'The second obligation is satisfied.',SUBJECT_AND_SCOPE_DESCRIPTION:'Current result',SATISFACTION_MEANING:'Second obligation satisfied.',FAILURE_MEANING:'Second obligation not satisfied.',CURRENT_SCOPE:engine.currentScope(value),CONTENT_SHA256:'',STATUS:'CURRENT'});
  accept(value,4,'COMPLETE',{contextId:'CONTEXT-STAGE04-COMPILER',eventSequence:1});independentReviewerContext(value,'CONTEXT-STAGE05-APPLICABILITY');const applicability=accept(value,5,'APPLICABILITY_REVIEW',{contextId:'CONTEXT-STAGE05-APPLICABILITY',eventSequence:2});
  for(const [index,propositionId] of ['PROPOSITION-1','PROPOSITION-2'].entries())record(value,'applicabilityRecords',`APPLICABILITY-${index+1}`,5,{APPLICABILITY_ID:`APPLICABILITY-${index+1}`,SUBJECT_ID:propositionId,PROPOSED_APPLICABILITY:'APPLICABLE',REASONING:'The current unconditional requirement applies.'},{rawResponseId:applicability.rawResponseId,proposalId:applicability.proposalId});
  assert.equal(engine.evaluateStage5SemanticClosure(value).complete,false,'Stage 05 closed multiple current propositions without an independent proposition-equivalence review.');
  assert.match(engine.evaluateStage5SemanticClosure(value).reasons.join(' '),/PROPOSITION_EQUIVALENCE_REVIEW/i,'Stage 05 did not localize missing proposition-equivalence coverage.');
  const equivalence=accept(value,5,'PROPOSITION_EQUIVALENCE_REVIEW',{contextId:'CONTEXT-STAGE05-EQUIVALENCE',eventSequence:3}),equivalenceProposal=value.projectData.responseProposals.find(item=>item.proposalId===equivalence.proposalId);equivalenceProposal.proposedStageData.PROPOSITION_EQUIVALENCE_REVIEWS={reviewedPropositionIds:['PROPOSITION-1','PROPOSITION-2'],finding:'The propositions have distinct subjects and are not equivalent.'};
  record(value,'propositionEquivalenceReviews','PROP-EQ-1',5,{PROP_EQ_REVIEW_ID:'PROP-EQ-1',PROPOSITION_A_ID:'PROPOSITION-1',PROPOSITION_B_ID:'PROPOSITION-2',DISPOSITION:'NOT_EQUIVALENT',REASONING:'The propositions establish different obligations.'},{rawResponseId:equivalence.rawResponseId,proposalId:equivalence.proposalId});
  assert.equal(engine.evaluateStage5SemanticClosure(value).complete,true,'A current independent proposition-equivalence review covering the current proposition set did not close Stage 05 semantics.');
}

// 156/159: one Stage 06 raw response cannot review its own semantic coverage or make a weaker/unknown test release-bearing.
{
  const value=project('SEMANTIC-STAGE06-SELF-REVIEW');value.job.CURRENT_REQUIREMENTS_VERSION='REQ-v001';value.job.CURRENT_TEST_SUITE_VERSION='TEST-v001';
  record(value,'requirements','REQ-1',4,requirementFields(['OBLIGATION-AAAAAAAAAAAAAAAAAAAA']));record(value,'propositions','PROPOSITION-1',4,{PROPOSITION_ID:'PROPOSITION-1',REQUIREMENT_ID:'REQ-1',PROPOSITION_TEXT:'The complete product satisfies the whole obligation.',SUBJECT_AND_SCOPE_DESCRIPTION:'Complete current product',SATISFACTION_MEANING:'Every required semantic condition is satisfied.',FAILURE_MEANING:'Any required semantic condition is absent.',CURRENT_SCOPE:engine.currentScope(value),CONTENT_SHA256:'',STATUS:'CURRENT'});
  const raw='RAW-6-COMPLETE',proposal='PROPOSAL-6-COMPLETE';accept(value,6,'COMPLETE',{contextId:'CONTEXT-TEST-AUTHOR',rawResponseId:raw,proposalId:proposal});
  record(value,'tests','TEST-1',6,{TEST_ID:'TEST-1',REQ_ID:'REQ-1',TEST_NAME:'Weaker check',TEST_TYPE:'MEANING_REVIEW',EXECUTION_MODE:'HUMAN_INSPECTION',REQUIRED_CAPABILITY:'HUMAN',ARTIFACT_REQUIREMENTS:'Current product',PROCEDURE:'Check only one subset.',EXPECTED_RESULT:'Subset exists.',EVIDENCE_REQUIRED:'Observation',FAILURE_MEANING:'Subset missing.',FALSE_POSITIVE_RISK:'The rest may be absent.',BOUNDARY_CASES:'Missing other conditions.',PARTIAL_SUCCESS_CASES:'Only subset present.',STALE_STATE_CASES:'Old product.',MALFORMED_INPUT_CASES:'Malformed product.',INCORRECT_AUTHORITY_CASES:'Self review.',WRONG_ARTIFACT_CASES:'Wrong bytes.',CAPABILITY_SUBSTITUTION_CASES:'Agent claim.',EXECUTABLE_KIND:'NONE',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:null,EXECUTABLE_INPUT_BINDINGS:{},EXECUTABLE_SPEC_SHA256:'',STATUS:'READY',TEST_PROPOSITION_TEXT:'One subset exists.',TARGET_PROPOSITION_IDS:['PROPOSITION-1'],TESTED_SCOPE:'One subset only',POSITIVE_RESULT_MEANING:'The subset exists.',NEGATIVE_RESULT_MEANING:'The subset does not exist.',SEMANTIC_COVERAGE_DISPOSITION:'EQUIVALENT',SEMANTIC_REVIEW_IDS:[raw],TEST_ROLE:'REQUIRED_PROOF',RELEASE_BEARING:false,EXPECTED_VARIANCE_CONTRACT:{dimension:'INVARIANT'}},{rawResponseId:raw,proposalId:proposal});
  engine.recalculate(value);
  const test=value.projectData.tests.find(item=>item.id==='TEST-1');
  assert.equal(engine.recordValue(test,'RELEASE_BEARING'),false,'A weaker Stage 06 test became release-bearing when its authoring raw response self-asserted EQUIVALENT coverage and cited itself as the semantic review.');
}

console.log(JSON.stringify({stage01ChallengeGate:true,stage02BoundedSearchGate:true,stage04AtomicityChallengeGate:true,stage05SemanticClosureGate:true,stage05EquivalenceReviewGate:true,stage06SelfReviewBlocked:true}));
