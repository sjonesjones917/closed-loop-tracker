import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,hash=globalThis.closedLoopHash,schema=globalThis.closedLoopWorkflowSchema;
const baseScope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TESTS-v001',instructionVersion:'INSTRUCTION-v001'};

function project(name){
  const value=core.createBlankState(name);
  Object.assign(value.job,{CURRENT_INPUT_VERSION:baseScope.inputVersion,CURRENT_SOURCE_SET_VERSION:baseScope.sourceSetVersion,CURRENT_REQUIREMENTS_VERSION:baseScope.requirementsVersion,CURRENT_TEST_SUITE_VERSION:baseScope.testSuiteVersion,CURRENT_INSTRUCTION_VERSION:baseScope.instructionVersion});
  engine.ensureShape(value);
  return value;
}

function record(value,collection,id,stage,fields,{scope=baseScope,source='APPLICATION_DERIVED',evidenceRefs=[]}={}){
  const row={id,stage,active:true,scope:{...scope},fields:{...fields},...fields,source,evidenceRefs:[...evidenceRefs]};
  row.contentSha256=hash.contentRecordSha256(row,schema.RECORD_SCHEMAS[collection].idField);
  row.recordSha256=hash.recordSha256(row);
  row.sha256=row.recordSha256;
  value.projectData[collection].push(row);
  return row;
}

function refresh(row,collection){
  for(const [key,value] of Object.entries(row.fields||{}))row[key]=value;
  row.contentSha256=hash.contentRecordSha256(row,schema.RECORD_SCHEMAS[collection].idField);
  row.recordSha256=hash.recordSha256(row);
  row.sha256=row.recordSha256;
  return row;
}

function addProposition(value){
  record(value,'requirements','REQ-1',4,{REQ_ID:'REQ-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'});
  record(value,'propositions','PROPOSITION-1',4,{PROPOSITION_ID:'PROPOSITION-1',REQUIREMENT_ID:'REQ-1',PROPOSITION_TEXT:'The current result satisfies the controlled proposition.',SUBJECT_AND_SCOPE_DESCRIPTION:'Current controlled result',SATISFACTION_MEANING:'The proposition is established.',FAILURE_MEANING:'The proposition is refuted.',CURRENT_SCOPE:baseScope,CONTENT_SHA256:'',STATUS:'CURRENT'});
  record(value,'applicabilityRecords','APPLICABILITY-1',5,{APPLICABILITY_ID:'APPLICABILITY-1',SUBJECT_ID:'PROPOSITION-1',PROPOSED_APPLICABILITY:'APPLICABLE',REASONING:'The mandatory proposition applies.',SELECTED_APPLICABILITY:'APPLICABLE',TRUTH_VALUE:'TRUE',EPISTEMIC_BASIS:'EXTERNALLY_SUPPORTED',CURRENT_SCOPE_STATUS:'CURRENT',FRESHNESS_STATUS:'CURRENT',CONTRADICTION_STATUS:'CLEAR',REASONS:['Fixture establishes current applicability.'],SUPPORTING_EVIDENCE_IDS:[]});
}

function addIteration(value,candidateFields={}){
  const iterationScope={...baseScope,iterationId:'ITERATION-1',candidateId:'CANDIDATE-1'};
  record(value,'iterations','ITERATION-1',17,{ITERATION_ID:'ITERATION-1',CANDIDATE_ID:'CANDIDATE-1',STATUS:'FROZEN'},{scope:iterationScope});
  record(value,'candidateFreezes','CANDIDATE-1',17,{CANDIDATE_ID:'CANDIDATE-1',ITERATION_ID:'ITERATION-1',STATUS:'FROZEN',...candidateFields},{scope:iterationScope});
  value.job.CURRENT_ITERATION='ITERATION-1';
  return iterationScope;
}

function varianceFixture(name,contract,observedValues,{defectIds=[]}={}){
  const value=project(name);
  addProposition(value);
  record(value,'tests','TEST-1',6,{TEST_ID:'TEST-1',REQ_ID:'REQ-1',TEST_NAME:'Repeated observation',TEST_TYPE:'MEANING',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',PROCEDURE:'Observe the controlled value.',EXPECTED_RESULT:'SATISFIED',EVIDENCE_TO_PRESERVE:'Current observation evidence.',FAILURE_CONDITION:'VIOLATED',STATUS:'READY',TEST_PROPOSITION_TEXT:'The current result satisfies the controlled proposition.',TARGET_PROPOSITION_IDS:['PROPOSITION-1'],TESTED_SCOPE:'Current repeated iteration',POSITIVE_RESULT_MEANING:'The proposition is established.',NEGATIVE_RESULT_MEANING:'The proposition is refuted.',SEMANTIC_COVERAGE_DISPOSITION:'EQUIVALENT',SEMANTIC_REVIEW_IDS:['SEMANTIC-REVIEW-1'],TEST_ROLE:'REQUIRED_PROOF',RELEASE_BEARING:true,EXPECTED_VARIANCE_CONTRACT:contract});
  const varianceSet=engine.expectedVarianceSet(value);
  assert.equal(varianceSet.complete,true,'The verifier fixture did not create a valid expected-variance set.');
  const iterationScope=addIteration(value,{EXPECTED_VARIANCE_SET_SHA256:varianceSet.setHash});
  for(let index=0;index<10;index++){
    const runId=`RUN-${index+1}`,runScope={...iterationScope,runId};
    record(value,'runs',runId,17,{RUN_ID:runId,ITERATION_ID:'ITERATION-1',CANDIDATE_ID:'CANDIDATE-1',COMPLETE_OUTPUT:'IDENTICAL PRODUCT BYTES',OUTPUT_HASHES:'f'.repeat(64),EXECUTION_STATUS:'COMPLETED'},{scope:runScope});
    record(value,'verification',`VERIFICATION-${index+1}`,12,{VERIFICATION_ID:`VERIFICATION-${index+1}`,REQ_ID:'REQ-1',RUN_ID:runId,TEST_ID:'TEST-1',OBSERVED_RESULT:observedValues[index],DETERMINATION:'SATISFIED'},{scope:runScope});
  }
  const comparison=record(value,'comparisons','COMPARISON-1',13,{COMPARISON_ID:'COMPARISON-1',REQ_ID:'REQ-1',DEFECT_IDS:[...defectIds]},{scope:iterationScope});
  return{value,varianceSet,comparison,test:value.projectData.tests[0]};
}

function environmentDependency(value,{freshness='CURRENT',version='ENV-v1',truthValue='TRUE',basis='EXTERNALLY_SUPPORTED',authenticity='EXTERNALLY_SUPPORTED',requiresComparability=true}={}){
  return record(value,'environmentDependencies','DEPENDENCY-1',6,{DEPENDENCY_ID:'DEPENDENCY-1',DEPENDENCY_DESCRIPTION:'The controlled renderer environment must remain current and comparable.',PROPOSED_REQUIRED_CONDITION:'Use ENV-v1.',TARGET_PROPOSITION_IDS:['PROPOSITION-1'],MATERIALITY:'MATERIAL',FRESHNESS_REQUIREMENT:'Current for the repeated iteration.',REQUIRES_ENVIRONMENT_COMPARABILITY:requiresComparability,EVIDENCE_REQUIREMENTS:'Current attributable environment evidence.',CURRENT_SCOPE:baseScope,VERSION_OR_CONDITION:version,TRUTH_VALUE:truthValue,EPISTEMIC_BASIS:basis,FRESHNESS_STATUS:freshness,AUTHENTICITY_STATUS:authenticity,RELEASE_CONSEQUENCE:'BLOCK_IF_UNKNOWN_OR_CHANGED'});
}

// The application freeze command, rather than a fixture or operator, binds both
// current contract-set identities even when the two current sets are empty.
{
  const value=project('APPLICATION-FREEZE-SET-IDENTITIES');
  record(value,'artifacts','ARTIFACT-1',10,{ARTIFACT_ID:'ARTIFACT-1',FILENAME:'candidate.bin',BYTE_SIZE:1,SHA256:'0'.repeat(64),STORAGE_REFERENCE:'indexeddb:ARTIFACT-1',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'});
  const expectedVarianceSet=engine.expectedVarianceSet(value),environmentDependencySet=engine.environmentDependencySet(value);
  const frozen=engine.freezeCandidate(value,{stage:10,artifactIds:['ARTIFACT-1']});
  assert.equal(engine.recordValue(frozen.candidate,'EXPECTED_VARIANCE_SET_SHA256'),expectedVarianceSet.setHash);
  assert.equal(engine.recordValue(frozen.candidate,'ENVIRONMENT_DEPENDENCY_SET_SHA256'),environmentDependencySet.setHash);
  assert.equal(engine.recordValue(frozen.candidate,'PROOF_OBLIGATION_SET_ID'),engine.proofObligationSet(value).setHash);
  assert.equal(frozen.candidate.recordSha256,hash.recordSha256(frozen.candidate),'Freeze-derived identities must be included in the refreshed candidate record hash.');
}

// 242: a target that exists at Stage 07 must be executed then and needs canonical evidence.
{
  const value=project('FAILURE-EXECUTABLE-NOW');
  const mutation=record(value,'failureTests','MUTATION-1',7,{MUTATION_ID:'MUTATION-1',REQ_ID:'REQ-1',FIXTURE:'Known-invalid fixture',EXPECTED_REJECTION:'REJECTED_INVALID_FIXTURE',ACTUAL_RESULT:'',EXECUTION_OUTCOME:'NOT_RUN',EVIDENCE:'An unbound prose assertion is not evidence.',FAILURE_TEST_AVAILABILITY_CLASS:'EXECUTABLE_NOW'});
  let status=engine.evaluateFailureTests(value,7);
  assert.equal(status.complete,false);
  assert.equal(status.records[0].status,'UNDETERMINED');
  assert.match(status.records[0].reasons.join(' '),/actual observed result|canonical execution evidence/i);
  record(value,'evidenceRecords','EVIDENCE-1',7,{EVIDENCE_ID:'EVIDENCE-1',APPLICATION_EVIDENCE_KIND:'NATIVE_RUNTIME_EVIDENCE',APPLICATION_EVIDENCE_DESCRIPTION:'The validator rejected the exact invalid fixture.',APPLICATION_EVIDENCE_CONTENT:'REJECTED_INVALID_FIXTURE',SHA256:'a'.repeat(64),STATUS:'CURRENT'},{source:'APPLICATION_TEST_RUNTIME'});
  mutation.fields.ACTUAL_RESULT='REJECTED_INVALID_FIXTURE';
  mutation.fields.EXECUTION_OUTCOME='REJECTED_INVALID';
  mutation.evidenceRefs=['EVIDENCE-1'];
  refresh(mutation,'failureTests');
  status=engine.evaluateFailureTests(value,7);
  assert.equal(status.complete,true);
  assert.equal(status.records[0].status,'SATISFIED');
  mutation.fields.ACTUAL_RESULT='A_DIFFERENT_REJECTION';
  refresh(mutation,'failureTests');
  status=engine.evaluateFailureTests(value,7);
  assert.equal(status.complete,false);
  assert.match(status.reasons.join(' '),/does not exactly match the frozen expected rejection/i);
}

// 243-245: only a genuinely future target may defer, deferral is not execution, and a due test blocks until a distinct evidenced execution is recorded.
{
  const value=project('FAILURE-DEFERRED-TARGET');
  const plan={version:'closed-loop-deferred-failure-plan/1',triggerStage:15,executionRoute:'APPLICATION',target:{collection:'artifacts',artifactRole:'CANDIDATE_MUTATION_TARGET'},requiredArtifactIds:[],requiredArtifactRoles:['CANDIDATE_MUTATION_TARGET'],requiredEvidenceClasses:['NATIVE_RUNTIME_EVIDENCE'],proofObligation:'The candidate-specific validator rejects the invalid candidate fixture.',executionProcedure:'Execute the registered mutation against the available candidate target and preserve its canonical evidence.'};
  const deferredDefinition=record(value,'failureTests','MUTATION-DEFERRED',7,{MUTATION_ID:'MUTATION-DEFERRED',REQ_ID:'REQ-1',FIXTURE:'Future product-specific invalid fixture',EXPECTED_REJECTION:'REJECTED_INVALID_FIXTURE',ACTUAL_RESULT:'',EXECUTION_OUTCOME:'NOT_RUN',EVIDENCE:'Deferred until the product target exists.',FAILURE_TEST_AVAILABILITY_CLASS:'DEFERRED_TARGET_DEPENDENT',DEFERRED_EXECUTION_TRIGGER_STAGE:15,DEFERRED_EXECUTION_PLAN:plan,EXECUTION_ROUTE:'APPLICATION',REQUIRED_ARTIFACT_IDS:[],PROOF_OBLIGATION:plan.proofObligation});
  assert.equal(engine.validateDeferredFailureTestPlan(plan).valid,true);
  let status=engine.evaluateFailureTests(value,7);
  assert.equal(status.complete,true);
  assert.equal(status.records[0].status,'DEFERRED');
  assert.equal(status.records[0].due,false);
  assert.equal(status.records[0].executionReceiptId,'');
  deferredDefinition.fields.ACTUAL_RESULT='FALSELY_MARKED_EXECUTED';
  deferredDefinition.fields.EXECUTION_OUTCOME='REJECTED_INVALID';
  refresh(deferredDefinition,'failureTests');
  status=engine.evaluateFailureTests(value,7);
  assert.equal(status.complete,false);
  assert.match(status.reasons.join(' '),/cannot be represented as executed/i);
  deferredDefinition.fields.ACTUAL_RESULT='';
  deferredDefinition.fields.EXECUTION_OUTCOME='NOT_RUN';
  refresh(deferredDefinition,'failureTests');
  status=engine.evaluateFailureTests(value,18);
  assert.equal(status.complete,false);
  assert.deepEqual(status.dueIncomplete,['MUTATION-DEFERRED']);
  assert.match(status.reasons.join(' '),/due.*no current sufficiently evidenced successful execution/i);

  value.activeStage=15;
  record(value,'artifacts','ARTIFACT-FUTURE-TARGET',15,{ARTIFACT_ID:'ARTIFACT-FUTURE-TARGET',FILENAME:'candidate-mutation-target.bin',BYTE_SIZE:1,SHA256:'d'.repeat(64),ROLE:'CANDIDATE_MUTATION_TARGET',STORAGE_REFERENCE:'indexeddb:ARTIFACT-FUTURE-TARGET',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'});
  record(value,'evidenceRecords','EVIDENCE-DEFERRED',15,{EVIDENCE_ID:'EVIDENCE-DEFERRED',APPLICATION_EVIDENCE_KIND:'NATIVE_RUNTIME_EVIDENCE',APPLICATION_EVIDENCE_DESCRIPTION:'The future product validator rejected the invalid fixture.',APPLICATION_EVIDENCE_CONTENT:'REJECTED_INVALID_FIXTURE',SHA256:'b'.repeat(64),STATUS:'CURRENT'});
  value.projectData.nativeExecutionEvents.push({schema:'closed-loop-native-test-execution/1',executionEventId:'SOURCE-EXECUTION-1',failureTestId:'MUTATION-DEFERRED',executionRoute:'APPLICATION',scopeHash:hash.sha256Value(engine.currentScope(value)),actualResult:'REJECTED_INVALID_FIXTURE',status:'SATISFIED',evidenceIds:['EVIDENCE-DEFERRED']});
  const receipt=engine.recordDeferredFailureTestExecution(value,{failureTestId:'MUTATION-DEFERRED',sourceExecutionEventId:'SOURCE-EXECUTION-1',expectedRevision:value.revision});
  assert.equal(receipt.status,'SATISFIED');
  status=engine.evaluateFailureTests(value,18);
  assert.equal(status.complete,true);
  assert.equal(status.records[0].status,'SATISFIED');
  assert.ok(status.records[0].executionReceiptId);
}

// A target already available at Stage 07 cannot be mislabeled as deferred.
{
  const value=project('FAILURE-FALSE-DEFERRAL');
  record(value,'artifacts','ARTIFACT-AVAILABLE',7,{ARTIFACT_ID:'ARTIFACT-AVAILABLE',FILENAME:'available-mutation-target.bin',BYTE_SIZE:1,SHA256:'e'.repeat(64),ROLE:'CANDIDATE_MUTATION_TARGET',STORAGE_REFERENCE:'indexeddb:ARTIFACT-AVAILABLE',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'});
  const plan={version:'closed-loop-deferred-failure-plan/1',triggerStage:15,executionRoute:'APPLICATION',target:{collection:'artifacts',artifactRole:'CANDIDATE_MUTATION_TARGET'},requiredArtifactIds:[],requiredArtifactRoles:['CANDIDATE_MUTATION_TARGET'],requiredEvidenceClasses:['NATIVE_RUNTIME_EVIDENCE'],proofObligation:'The available validator rejects the invalid fixture.',executionProcedure:'Execute the invalid fixture now.'};
  record(value,'failureTests','MUTATION-FALSE-DEFERRED',7,{MUTATION_ID:'MUTATION-FALSE-DEFERRED',REQ_ID:'REQ-1',FIXTURE:'Available product fixture',EXPECTED_REJECTION:'REJECTED_INVALID_FIXTURE',FAILURE_TEST_AVAILABILITY_CLASS:'DEFERRED_TARGET_DEPENDENT',DEFERRED_EXECUTION_TRIGGER_STAGE:15,DEFERRED_EXECUTION_PLAN:plan});
  const status=engine.evaluateFailureTests(value,7);
  assert.equal(status.complete,false);
  assert.match(status.reasons.join(' '),/already has its required target.*executed now/i);
}

// 246: values inside a frozen allowed set are allowed and need no defect.
{
  const contract={version:'closed-loop-expected-variance/1',dimensions:[{dimensionId:'semantic-outcome',selector:'VERIFICATION_OBSERVED_RESULT',mode:'ALLOWED_SET',effect:'CORRECTNESS_AFFECTING',allowedValues:['ALPHA','BETA']}]};
  const fixture=varianceFixture('VARIANCE-ALLOWED',contract,Array.from({length:10},(_,index)=>index%2?'BETA':'ALPHA'));
  const status=engine.evaluateExpectedVariance(fixture.value,'ITERATION-1');
  assert.equal(status.complete,true);
  assert.equal(status.allowed.length,1);
  assert.equal(status.prohibited.length,0);
  assert.equal(status.unknown.length,0);
}

// 247: variance outside an invariant contract is prohibited and requires a linked defect before comparison closure.
{
  const contract={version:'closed-loop-expected-variance/1',dimensions:[{dimensionId:'invariant-result',selector:'VERIFICATION_OBSERVED_RESULT',mode:'INVARIANT',effect:'CORRECTNESS_AFFECTING'}]};
  const fixture=varianceFixture('VARIANCE-PROHIBITED',contract,Array.from({length:10},(_,index)=>index===9?'DIFFERENT':'SAME'));
  let status=engine.evaluateExpectedVariance(fixture.value,'ITERATION-1');
  assert.equal(status.prohibited.length,1);
  assert.equal(status.complete,false);
  assert.match(status.reasons.join(' '),/requires a linked defect/i);
  record(fixture.value,'defects','DEFECT-VARIANCE',14,{DEFECT_ID:'DEFECT-VARIANCE',REQ_ID:'REQ-1',OBSERVED_FAILURE:'A prohibited invariant difference occurred.',STATUS:'CONFIRMED'},{scope:{...baseScope,iterationId:'ITERATION-1',candidateId:'CANDIDATE-1'}});
  fixture.comparison.fields.DEFECT_IDS=['DEFECT-VARIANCE'];
  refresh(fixture.comparison,'comparisons');
  status=engine.evaluateExpectedVariance(fixture.value,'ITERATION-1');
  assert.equal(status.complete,true);
  assert.equal(status.prohibited.length,1);
}

// 248: UNKNOWN expected variance is never averaged away or treated as allowed.
{
  const contract={version:'closed-loop-expected-variance/1',dimensions:[{dimensionId:'unclassified-result',selector:'VERIFICATION_OBSERVED_RESULT',mode:'UNKNOWN',effect:'CORRECTNESS_AFFECTING'}]};
  const fixture=varianceFixture('VARIANCE-UNKNOWN',contract,Array(10).fill('SAME'));
  const status=engine.evaluateExpectedVariance(fixture.value,'ITERATION-1');
  assert.equal(status.complete,false);
  assert.equal(status.unknown.length,1);
  assert.match(status.reasons.join(' '),/is UNKNOWN/i);
}

// The expected-variance set is frozen before repeated execution and later changes invalidate comparison.
{
  const original={version:'closed-loop-expected-variance/1',dimensions:[{dimensionId:'frozen-result',selector:'VERIFICATION_OBSERVED_RESULT',mode:'INVARIANT',effect:'CORRECTNESS_AFFECTING'}]};
  const fixture=varianceFixture('VARIANCE-FROZEN',original,Array(10).fill('SAME'));
  assert.equal(engine.evaluateExpectedVariance(fixture.value,'ITERATION-1').complete,true);
  fixture.test.fields.EXPECTED_VARIANCE_CONTRACT={version:'closed-loop-expected-variance/1',dimensions:[{dimensionId:'frozen-result',selector:'VERIFICATION_OBSERVED_RESULT',mode:'ALLOWED_SET',effect:'CORRECTNESS_AFFECTING',allowedValues:['SAME']}]};
  refresh(fixture.test,'tests');
  const changed=engine.evaluateExpectedVariance(fixture.value,'ITERATION-1');
  assert.equal(changed.complete,false);
  assert.match(changed.reasons.join(' '),/does not match the application-frozen candidate contract/i);
}

// 249 and 277: a material dependency with unknown or expired current state blocks its proof obligation.
{
  const value=project('ENVIRONMENT-STALE');
  addProposition(value);
  environmentDependency(value,{freshness:'EXPIRED'});
  let status=engine.environmentDependencySet(value);
  assert.equal(status.complete,false);
  assert.match(status.reasons.join(' '),/unknown, expired, false, or below/i);
  const dependency=value.projectData.environmentDependencies[0];
  dependency.fields.FRESHNESS_STATUS='CURRENT';
  dependency.fields.TRUTH_VALUE='UNKNOWN';
  refresh(dependency,'environmentDependencies');
  status=engine.environmentDependencySet(value);
  assert.equal(status.complete,false);
  assert.match(status.reasons.join(' '),/unknown, expired, false, or below/i);
}

// 249 and 278: identical output bytes do not hide a changed material environment.
{
  const value=project('ENVIRONMENT-DIFFERENCE');
  addProposition(value);
  environmentDependency(value);
  const dependencyState=engine.environmentDependencySet(value);
  assert.equal(dependencyState.complete,true);
  const iterationScope=addIteration(value,{ENVIRONMENT_DEPENDENCY_SET_SHA256:dependencyState.setHash});
  const manifest=version=>({version:'closed-loop-environment-manifest/1',dependencies:[{dependencyId:'DEPENDENCY-1',versionOrCondition:version,truthValue:'TRUE',epistemicBasis:'EXTERNALLY_SUPPORTED',freshnessStatus:'CURRENT'}],applicationBuildIdentity:'BUILD-1',browser:'Chromium fixture',operatingEnvironment:'Fixture OS',locale:'en-US',timezone:'UTC',externalTools:[],fonts:[],models:[],services:[],hardware:'Fixture hardware',unavailableFacts:[],epistemicBasisByField:{dependencies:'EXTERNALLY_SUPPORTED'}});
  for(let index=0;index<10;index++){
    const runId=`RUN-${index+1}`,runScope={...iterationScope,runId};
    record(value,'runs',runId,17,{RUN_ID:runId,ITERATION_ID:'ITERATION-1',CANDIDATE_ID:'CANDIDATE-1',COMPLETE_OUTPUT:'EXACT SAME PRODUCT BYTES',OUTPUT_HASHES:'c'.repeat(64),EXECUTION_STATUS:'COMPLETED',DECLARED_ENVIRONMENT_MANIFEST:manifest(index===9?'ENV-v2':'ENV-v1')},{scope:runScope,source:'AGENT_RESPONSE'});
  }
  const status=engine.evaluateRunEnvironment(value,'ITERATION-1');
  assert.equal(new Set(value.projectData.runs.map(run=>run.fields.OUTPUT_HASHES)).size,1,'The fixture no longer holds product bytes constant.');
  assert.equal(status.complete,false);
  assert.equal(status.status,'UNKNOWN');
  assert.equal(status.differences.length,1);
  assert.equal(status.differences[0].dependencyId,'DEPENDENCY-1');
  assert.match(status.reasons.join(' '),/differs or is unknown across current runs|does not establish current comparable dependency/i);
}

console.log(JSON.stringify({
  executableNowRequiresExecutionEvidence:true,
  futureTargetDeferralValidated:true,
  deferredNeverMarkedExecuted:true,
  dueDeferredBlocksUntilRecordedExecution:true,
  availableTargetCannotBeDeferred:true,
  allowedVarianceNeedsNoDefect:true,
  prohibitedVarianceRequiresDefect:true,
  unknownVarianceBlocks:true,
  candidateFreezeDerivesSetHashes:true,
  expectedVarianceFrozenBeforeRuns:true,
  materialEnvironmentUnknownOrExpiredBlocks:true,
  materialEnvironmentDifferenceDetected:true,
  sameBytesDoNotOverrideEnvironmentChange:true
}));
