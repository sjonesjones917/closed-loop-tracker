import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

// Legacy publication keys remain present as UNKNOWN until their full
// behavioral universes are measured. Executed component cases are separate.
const EXECUTED_DEFINITION_PROOF_FIELDS=Object.freeze([
  'acceptedAgentValueExtractionCoverage',
  'acceptedRelationshipProvenanceCoverage',
  'currentScopeSelectorCoverage',
  'exactReqRunTestCoverage',
  'applicableCurrentRegressionSuccess',
  'mandatoryEvidenceChainCoverage',
  'releaseArtifactIdentityCoverage'
]);

const productionInstructionProof=JSON.parse(execFileSync(process.execPath,[new URL('./verify-production-instruction.mjs',import.meta.url).pathname],{encoding:'utf8'}));
assert.equal(productionInstructionProof.productionInstruction,'PASS','Stage 08 production-instruction regression proof did not pass.');
assert.equal(productionInstructionProof.isolatedDisposableProjects,true,'Stage 08 production-instruction mutations were not isolated to disposable project state.');
assert.equal(productionInstructionProof.noMutationBeforeAcceptance,true,'Stage 08 production-instruction verifier did not prove zero canonical mutation before acceptance.');
const independentPreflightProof=JSON.parse(execFileSync(process.execPath,[new URL('./verify-independent-preflight.mjs',import.meta.url).pathname],{encoding:'utf8'}));
assert.equal(independentPreflightProof.independentPreflight,'PASS','Stage 09 independent-preflight regression proof did not pass.');
assert.equal(independentPreflightProof.isolatedDisposableProjects,true,'Stage 09 independent-preflight mutations were not isolated to disposable project state.');
assert.equal(independentPreflightProof.noMutationBeforeAcceptance,true,'Stage 09 independent-preflight verifier did not prove zero canonical mutation before acceptance.');
assert.equal(independentPreflightProof.independenceEpistemicLimitPreserved,true,'Stage 09 independent-preflight verifier overclaimed unobservable external independence.');
const candidateFreezeProof=JSON.parse(execFileSync(process.execPath,[new URL('./verify-candidate-freeze.mjs',import.meta.url).pathname],{encoding:'utf8'}));
assert.equal(candidateFreezeProof.candidateFreeze,'PASS','Stage 10 candidate-freeze regression proof did not pass.');
assert.equal(candidateFreezeProof.noPartialMutationOnRejectedFreeze,true,'Stage 10 rejected candidate freeze partially mutated application state.');
assert.equal(candidateFreezeProof.exactHumanSelectionReferenced,true,'Stage 10 frozen candidate did not bind the exact registered human component-selection decision.');
assert.equal(candidateFreezeProof.frozenManifestImmutable,true,'Stage 10 frozen candidate manifest was not immutable.');
assert.equal(candidateFreezeProof.isolatedDisposableProjects,true,'Stage 10 candidate-freeze mutations were not isolated.');
const productionBaselineAuthorityProof=JSON.parse(execFileSync(process.execPath,[new URL('./verify-production-baseline-authority.mjs',import.meta.url).pathname],{encoding:'utf8'}));
assert.equal(productionBaselineAuthorityProof.productionBaselineAuthority,'PASS','Stage 20 production-baseline-authority regression proof did not pass.');
assert.equal(productionBaselineAuthorityProof.noPartialMutationOnRejectedFreeze,true,'Stage 20 rejected baseline freeze partially mutated application state.');
assert.equal(productionBaselineAuthorityProof.exactHumanAuthorizationReferenced,true,'Stage 20 frozen baseline did not bind the exact registered BASELINE_AUTHORIZATION human decision.');
assert.equal(productionBaselineAuthorityProof.zeroAcceptedStage20ExternalResponses,true,'Stage 20 baseline freeze required an accepted Stage 20 external response envelope.');
assert.equal(productionBaselineAuthorityProof.isolatedDisposableProjects,true,'Stage 20 production-baseline-authority mutations were not isolated.');

const originalLog=console.log;
const captured=[];
console.log=(...args)=>captured.push(args.map(String).join(' '));
try{
  await import('./verify-definition-of-done-invariants.mjs');
}finally{
  console.log=originalLog;
}
assert.equal(captured.length,1,'Definition-of-done invariant verifier must emit exactly one JSON report.');
const report=JSON.parse(captured[0]);
for(const field of EXECUTED_DEFINITION_PROOF_FIELDS)assert(Object.hasOwn(report,field),`Definition-of-done proof omitted required report field ${field}.`);
const core=globalThis.closedLoopCore;
const engine=globalThis.closedLoopWorkflowEngine;
const hash=globalThis.closedLoopHash;
assert(core&&engine&&hash,'State-derived Section 49 metric verifier could not load runtime authorities.');

function buildMetricFixture(){
  const project=core.createBlankState('JOB-SECTION49-REQ-RUN-TEST');
  engine.ensureShape(project);
  Object.assign(project.job,{
    CURRENT_INPUT_VERSION:'INPUT-METRIC-1',
    CURRENT_SOURCE_SET_VERSION:'SOURCE-METRIC-1',
    CURRENT_REQUIREMENTS_VERSION:'REQSET-METRIC-1',
    CURRENT_TEST_SUITE_VERSION:'TESTSET-METRIC-1',
    CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-METRIC-1',
    CURRENT_ITERATION:'ITER-METRIC-1'
  });
  const scope={
    inputVersion:'INPUT-METRIC-1',sourceSetVersion:'SOURCE-METRIC-1',requirementsVersion:'REQSET-METRIC-1',
    testSuiteVersion:'TESTSET-METRIC-1',instructionVersion:'INSTRUCTION-METRIC-1',iterationId:'ITER-METRIC-1',candidateId:'CAND-METRIC-1'
  };
  const rec=(id,stage,fields)=>({id,stage,active:true,scope:{...scope},fields:{...fields},...fields});
  project.projectData.iterations.push(rec('ITER-METRIC-1',10,{ITERATION_ID:'ITER-METRIC-1',CANDIDATE_ID:'CAND-METRIC-1',STATUS:'FROZEN'}));
  project.projectData.candidateFreezes.push(rec('CAND-METRIC-1',10,{CANDIDATE_ID:'CAND-METRIC-1',ITERATION_ID:'ITER-METRIC-1',STATUS:'FROZEN'}));
  project.projectData.requirements.push(rec('REQ-METRIC-1',4,{REQ_ID:'REQ-METRIC-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}));
  project.projectData.tests.push(rec('TEST-METRIC-1',6,{
    TEST_ID:'TEST-METRIC-1',REQ_ID:'REQ-METRIC-1',STATUS:'READY',
    VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,
    PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,
    TARGET_AVAILABILITY_CONDITION:{phaseTarget:true}
  }));
  for(let index=1;index<=10;index++){
    const runId=`RUN-METRIC-${String(index).padStart(2,'0')}`;
    project.projectData.runs.push(rec(runId,11,{RUN_ID:runId,ITERATION_ID:'ITER-METRIC-1',CANDIDATE_ID:'CAND-METRIC-1'}));
    project.projectData.verification.push(rec(`VERIFY-METRIC-${String(index).padStart(2,'0')}`,12,{VERIFICATION_ID:`VERIFY-METRIC-${String(index).padStart(2,'0')}`,REQ_ID:'REQ-METRIC-1',RUN_ID:runId,TEST_ID:'TEST-METRIC-1',DETERMINATION:'UNDETERMINED'}));
  }
  return project;
}
function metricFor(project){
  const matrix=engine.verificationMatrix(project,'ITER-METRIC-1');
  const universe=[...matrix.expected].map(String);
  assert(universe.length===10,'Section 49 REQ × RUN × TEST fixture must contain exactly ten required due per-run tuples.');
  const included=universe.filter(key=>matrix.counts.get(key)===1);
  const excluded=[
    ...matrix.missing.map(id=>({id:String(id),reason:'MISSING_CURRENT_REQUIRED_TRIPLE'})),
    ...matrix.duplicates.map(item=>({id:String(item.key),reason:`DUPLICATE_CURRENT_REQUIRED_TRIPLE_COUNT_${item.count}`}))
  ];
  return Object.freeze({
    metricId:'REQ_RUN_TEST_COVERAGE',
    derivationVersion:'closed-loop-section49-state-metrics/1',
    universeDefinition:'Exact current required and due PREPRODUCT_ITERATION per-run REQ_ID × RUN_ID × TEST_ID tuples derived by workflow-engine.verificationMatrix for the controlled ten-run acceptance fixture.',
    numerator:included.length,
    denominator:universe.length,
    includedIds:included,
    excludedIds:excluded,
    scopeHash:hash.sha256Value({iterationId:'ITER-METRIC-1',expected:universe}),
    evidenceReferences:['workflow-engine.js:verificationMatrix','verify-definition-of-done.mjs:state-derived mutation fixture'],
    value:included.length/universe.length,
    disposition:included.length===universe.length&&excluded.length===0?'SATISFIED':'VIOLATED'
  });
}
const conformantFixture=buildMetricFixture();
const exactReqRunTestMetric=metricFor(conformantFixture);
assert.equal(exactReqRunTestMetric.value,1,'Exact REQ × RUN × TEST coverage is not 100%.');
assert.equal(exactReqRunTestMetric.numerator,10);
assert.equal(exactReqRunTestMetric.denominator,10);
assert.equal(exactReqRunTestMetric.includedIds.length,10);
assert.equal(exactReqRunTestMetric.excludedIds.length,0);

const missingFixture=structuredClone(conformantFixture);
missingFixture.projectData.verification.pop();
const missingMetric=metricFor(missingFixture);
assert.equal(missingMetric.numerator,9,'Deleting one required verification tuple did not reduce the numerator.');
assert.equal(missingMetric.denominator,10,'Deleting one verification result illegally reduced the closed universe.');
assert.equal(missingMetric.value,0.9,'Missing-tuple mutation did not reduce REQ × RUN × TEST coverage to 0.9.');
assert(missingMetric.excludedIds.some(item=>item.reason==='MISSING_CURRENT_REQUIRED_TRIPLE'),'Missing-tuple mutation was not recorded explicitly.');

const duplicateFixture=structuredClone(conformantFixture);
duplicateFixture.projectData.verification.push(structuredClone(duplicateFixture.projectData.verification[0]));
const duplicateMetric=metricFor(duplicateFixture);
assert.equal(duplicateMetric.numerator,9,'Duplicating one required verification tuple did not reduce the numerator.');
assert.equal(duplicateMetric.denominator,10,'Duplicate verification illegally changed the closed universe denominator.');
assert(duplicateMetric.excludedIds.some(item=>item.reason.startsWith('DUPLICATE_CURRENT_REQUIRED_TRIPLE')),'Duplicate-tuple mutation was not recorded explicitly.');

// Do not publish the cardinality of this single synthetic matrix as complete
// application coverage. It checks tuple counting, not evidence sufficiency.
report.syntheticMatrixCardinality={
 evidenceClass:'EXECUTED_COMPONENT_CASES',applicationCompletion:false,
 cases:[
  {caseId:'ten-required-tuples',result:'PASS',actual:exactReqRunTestMetric},
  {caseId:'missing-tuple-keeps-universe',result:'PASS',actual:missingMetric},
  {caseId:'duplicate-tuple-keeps-universe',result:'PASS',actual:duplicateMetric}
 ]
};
const stage01Proof=JSON.parse(execFileSync(process.execPath,[new URL('./verify-stage01-intake-closure.mjs',import.meta.url).pathname],{encoding:'utf8'}));
const zeroLossProof=JSON.parse(execFileSync(process.execPath,[new URL('./verify-zero-loss-accounting.mjs',import.meta.url).pathname],{encoding:'utf8'}));
assert(stage01Proof.stage01IntakeClosure&&stage01Proof.currentManifestBound&&stage01Proof.incompleteAccountingRejected,'The executed intake cases failed.');
assert(zeroLossProof.zeroLossStage04&&zeroLossProof.completeStage03ResearchUnion&&zeroLossProof.incompleteObligationRejected,'The executed obligation accounting cases failed.');
report.executedSuites=[
 ['verify-production-instruction.mjs',productionInstructionProof],
 ['verify-independent-preflight.mjs',independentPreflightProof],
 ['verify-candidate-freeze.mjs',candidateFreezeProof],
 ['verify-production-baseline-authority.mjs',productionBaselineAuthorityProof],
 ['verify-stage01-intake-closure.mjs',stage01Proof],
 ['verify-zero-loss-accounting.mjs',zeroLossProof]
].map(([file,actual])=>({file,result:'PASS',actual,scope:'Executed synthetic cases in this suite; not every mandatory behavior.'}));
report.stage01IntakeCoverage=null;report.stage04ObligationCoverage=null;
report.productionInstructionCoverage=null;report.independentPreflightCoverage=null;report.candidateFreezeCoverage=null;
report.evidenceClass='DECLARATIONS_AND_EXECUTED_SYNTHETIC_COMPONENT_CASES';
report.applicationCompletion=false;
originalLog(JSON.stringify(report,null,2));
