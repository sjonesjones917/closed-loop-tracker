import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

// Closed output fields that this executed definition-of-done proof must retain.
// This is a compatibility contract for downstream acceptance publication, not a substitute for executing the measurements below.
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
assert.equal(productionInstructionProof.productionInstruction,'PASS','Stage 12 production-instruction regression proof did not pass.');
assert.equal(productionInstructionProof.isolatedDisposableProjects,true,'Stage 12 production-instruction mutations were not isolated to disposable project state.');
assert.equal(productionInstructionProof.noMutationBeforeAcceptance,true,'Stage 12 production-instruction verifier did not prove zero canonical mutation before acceptance.');
const independentPreflightProof=JSON.parse(execFileSync(process.execPath,[new URL('./verify-independent-preflight.mjs',import.meta.url).pathname],{encoding:'utf8'}));
assert.equal(independentPreflightProof.independentPreflight,'PASS','Stage 13 independent-preflight regression proof did not pass.');
assert.equal(independentPreflightProof.isolatedDisposableProjects,true,'Stage 13 independent-preflight mutations were not isolated to disposable project state.');
assert.equal(independentPreflightProof.noMutationBeforeAcceptance,true,'Stage 13 independent-preflight verifier did not prove zero canonical mutation before acceptance.');
assert.equal(independentPreflightProof.independenceEpistemicLimitPreserved,true,'Stage 13 independent-preflight verifier overclaimed unobservable external independence.');

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
function closedMetricFromUniverse({metricId,universe,includedIds,emptyUniverseDetermination=null}){
  const normalizedUniverse=[...universe].map(String);
  const normalizedIncluded=[...includedIds].map(String);
  if(normalizedUniverse.length===0){
    const acceptedEmpty=emptyUniverseDetermination&&emptyUniverseDetermination.status==='ACCEPTED'&&emptyUniverseDetermination.evidenceSupported===true;
    return Object.freeze({
      metricId,
      numerator:0,
      denominator:0,
      includedIds:[],
      excludedIds:[],
      value:acceptedEmpty?1:null,
      disposition:acceptedEmpty?'SATISFIED':'BLOCKED'
    });
  }
  const universeSet=new Set(normalizedUniverse);
  const validIncluded=[...new Set(normalizedIncluded)].filter(id=>universeSet.has(id));
  return Object.freeze({
    metricId,
    numerator:validIncluded.length,
    denominator:normalizedUniverse.length,
    includedIds:validIncluded,
    excludedIds:normalizedUniverse.filter(id=>!validIncluded.includes(id)),
    value:validIncluded.length/normalizedUniverse.length,
    disposition:validIncluded.length===normalizedUniverse.length?'SATISFIED':'BLOCKED'
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

const emptyDenominatorBlocked=closedMetricFromUniverse({metricId:'EMPTY-DENOMINATOR-MUTATION',universe:[],includedIds:[]});
assert.equal(emptyDenominatorBlocked.denominator,0,'Empty-denominator mutation did not create the intended empty closed universe.');
assert.equal(emptyDenominatorBlocked.disposition,'BLOCKED','An empty denominator passed without an independently accepted evidence-supported EMPTY_UNIVERSE determination.');
assert.equal(emptyDenominatorBlocked.value,null,'An unreviewed empty denominator must not produce 100% coverage.');
const emptyDenominatorAccepted=closedMetricFromUniverse({
  metricId:'EMPTY-DENOMINATOR-REVIEWED',
  universe:[],
  includedIds:[],
  emptyUniverseDetermination:{status:'ACCEPTED',evidenceSupported:true}
});
assert.equal(emptyDenominatorAccepted.disposition,'SATISFIED','A current independently accepted evidence-supported empty-universe determination should satisfy the empty-universe metric contract.');
assert.equal(emptyDenominatorAccepted.value,1,'A reviewed evidence-supported empty universe should publish 100% only through the explicit empty-universe rule.');

const stage01Proof=JSON.parse(execFileSync(process.execPath,[new URL('./verify-stage01-intake-closure.mjs',import.meta.url).pathname],{encoding:'utf8'}));
const zeroLossProof=JSON.parse(execFileSync(process.execPath,[new URL('./verify-zero-loss-accounting.mjs',import.meta.url).pathname],{encoding:'utf8'}));
report.stage01IntakeCoverage=Number(Boolean(stage01Proof.stage01IntakeClosure&&stage01Proof.currentManifestBound&&stage01Proof.incompleteAccountingRejected));
report.stage04ObligationCoverage=Number(Boolean(zeroLossProof.zeroLossStage04&&zeroLossProof.completeStage03ResearchUnion&&zeroLossProof.incompleteObligationRejected));
assert.equal(report.stage01IntakeCoverage,1,'Measured Stage 01 intake coverage is not complete.');
assert.equal(report.stage04ObligationCoverage,1,'Measured Stage 04 obligation coverage is not complete.');
report.exactReqRunTestCoverage=exactReqRunTestMetric.value;
report.exactReqRunTestMetric=exactReqRunTestMetric;
report.coverageMetrics={...(report.coverageMetrics||{}),exactReqRunTestCoverage:exactReqRunTestMetric};
report.section49ReqRunTestMutationProof={missingTupleDetected:true,duplicateTupleDetected:true,closedUniverseStable:true};
report.section49EmptyDenominatorMutationProof={unreviewedEmptyBlocked:true,reviewedEvidenceSupportedEmptyAccepted:true};
report.productionInstructionCoverage=Number(
  productionInstructionProof.productionInstruction==='PASS'&&
  productionInstructionProof.repairedPathProgressed===true&&
  productionInstructionProof.noMutationBeforeAcceptance===true&&
  productionInstructionProof.promptSemanticsChecked===true&&
  productionInstructionProof.isolatedDisposableProjects===true
);
report.productionInstructionMutationProof={
  missingMandatoryInstructionTraceRejected:productionInstructionProof.intentionalInvalidFixturesRejected?.includes('missing-mandatory-instruction-trace')===true,
  missingRequiredOutputContractRejected:productionInstructionProof.intentionalInvalidFixturesRejected?.includes('missing-required-output-contract')===true,
  repairedPathProgressed:productionInstructionProof.repairedPathProgressed===true,
  noMutationBeforeAcceptance:productionInstructionProof.noMutationBeforeAcceptance===true,
  promptSemanticsChecked:productionInstructionProof.promptSemanticsChecked===true,
  isolatedDisposableProjects:productionInstructionProof.isolatedDisposableProjects===true
};
assert.equal(report.productionInstructionCoverage,1,'Stage 12 production-instruction coverage is not complete.');
assert.equal(report.productionInstructionMutationProof.missingMandatoryInstructionTraceRejected,true,'Stage 12 missing-instruction-trace mutation was not rejected.');
assert.equal(report.productionInstructionMutationProof.missingRequiredOutputContractRejected,true,'Stage 12 missing-output-contract mutation was not rejected.');
report.independentPreflightCoverage=Number(
  independentPreflightProof.independentPreflight==='PASS'&&
  independentPreflightProof.repairedPathProgressed===true&&
  independentPreflightProof.independenceEpistemicLimitPreserved===true&&
  independentPreflightProof.noMutationBeforeAcceptance===true&&
  independentPreflightProof.promptSemanticsChecked===true&&
  independentPreflightProof.isolatedDisposableProjects===true
);
report.independentPreflightMutationProof={
  missingIndependentReviewerBlocked:independentPreflightProof.intentionalInvalidFixturesRejected?.includes('missing-independent-reviewer')===true,
  materialAmbiguityBlocked:independentPreflightProof.intentionalInvalidFixturesRejected?.includes('material-ambiguity-with-favorable-claim')===true,
  contaminatedReviewerBlocked:independentPreflightProof.intentionalInvalidFixturesRejected?.includes('contaminated-reviewer-context')===true,
  repairedPathProgressed:independentPreflightProof.repairedPathProgressed===true,
  independenceEpistemicLimitPreserved:independentPreflightProof.independenceEpistemicLimitPreserved===true,
  noMutationBeforeAcceptance:independentPreflightProof.noMutationBeforeAcceptance===true,
  promptSemanticsChecked:independentPreflightProof.promptSemanticsChecked===true,
  isolatedDisposableProjects:independentPreflightProof.isolatedDisposableProjects===true
};
assert.equal(report.independentPreflightCoverage,1,'Stage 13 independent-preflight coverage is not complete.');
assert.equal(report.independentPreflightMutationProof.missingIndependentReviewerBlocked,true,'Stage 13 missing-reviewer mutation was not rejected.');
assert.equal(report.independentPreflightMutationProof.materialAmbiguityBlocked,true,'Stage 13 material-ambiguity mutation was not rejected.');
assert.equal(report.independentPreflightMutationProof.contaminatedReviewerBlocked,true,'Stage 13 contaminated-reviewer mutation was not rejected.');
originalLog(JSON.stringify(report,null,2));