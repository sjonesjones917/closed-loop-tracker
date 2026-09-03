import fs from 'node:fs';

let schema=fs.readFileSync('workflow-schema.js','utf8');
const scopeBlock=/const SCOPE_REQUIREMENTS=Object\.freeze\([\s\S]*?\);\nconst OPERATION_CONTRACT_OVERRIDES/;
if(!scopeBlock.test(schema))throw new Error('SCOPE_REQUIREMENTS block not found.');
const scope=`const SCOPE_REQUIREMENTS=Object.freeze({
  1:Object.freeze(['inputVersion']),
  2:Object.freeze(['inputVersion','sourceSetVersion']),
  3:Object.freeze(['inputVersion','sourceSetVersion','researchVersion']),
  4:Object.freeze(['inputVersion','sourceSetVersion','researchVersion','requirementsVersion']),
  5:Object.freeze(['inputVersion','sourceSetVersion','researchVersion','requirementsVersion']),
  6:Object.freeze(['requirementsVersion','testSuiteVersion']),
  7:Object.freeze(['requirementsVersion','testSuiteVersion']),
  8:Object.freeze(['requirementsVersion','testSuiteVersion','instructionVersion']),
  9:Object.freeze(['requirementsVersion','testSuiteVersion','instructionVersion']),
  10:Object.freeze(['requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId']),
  11:Object.freeze(['iterationId','candidateId','runId']),
  12:Object.freeze(['iterationId','candidateId','runId','requirementsVersion','testSuiteVersion']),
  13:Object.freeze(['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  14:Object.freeze(['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  15:Object.freeze(['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  16:Object.freeze(['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  17:Object.freeze(['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  18:Object.freeze(['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  19:Object.freeze(['sourceConvergedIterationId','confirmationIterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  20:Object.freeze(['confirmationIterationId','baselineId']),
  21:Object.freeze(['baselineId','productId']),
  22:Object.freeze(['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion']),
  23:Object.freeze(['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion']),
  24:Object.freeze(['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion']),
  25:Object.freeze(['baselineId','productId','productVersion','deliveryCandidateSetId']),
  26:Object.freeze(['baselineId','productId','productVersion','deliveryCandidateSetId','reviewVersion']),
  27:Object.freeze(['baselineId','productId','productVersion','deliveryCandidateSetId','reconciledReviewVersion']),
  28:Object.freeze(['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId']),
  29:Object.freeze(['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId']),
  30:Object.freeze(['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId','evidenceChainVersion'])
});
const OPERATION_CONTRACT_OVERRIDES`;
schema=schema.replace(scopeBlock,scope);
const operationFn=/function operationContract\(stage,operation\)\{[\s\S]*?\}\n\nconst HUMAN_INTAKE_FIELDS/;
if(!operationFn.test(schema))throw new Error('operationContract block not found.');
schema=schema.replace(operationFn,`function operationContract(stage,operation){
  const operations=STAGE_OPERATIONS[stage];
  if(!operations||!operations.includes(operation))return null;
  const override=OPERATION_CONTRACT_OVERRIDES[stage]?.[operation]||{};
  return Object.freeze({
    operation,
    readCollections:Object.freeze(override.readCollections||READ_COLLECTIONS[stage]||[]),
    agentWritableCollections:Object.freeze(override.agentWritableCollections||STAGE_COLLECTIONS[stage]||[]),
    allowedStageData:Object.freeze(override.allowedStageData||STAGE_CONTRACTS[stage]?.allowedStageData||[]),
    applicationCollections:Object.freeze(APPLICATION_COLLECTIONS[stage]||[]),
    humanActions:Object.freeze(HUMAN_ACTIONS[stage]||[]),
    scopeRequirements:SCOPE_REQUIREMENTS[stage]
  });
}

const HUMAN_INTAKE_FIELDS`);
fs.writeFileSync('workflow-schema.js',schema);

let route=fs.readFileSync('verify-data-route-closure.mjs','utf8');
const oldRoute="    const scope={projectRevision:state.revision,inputVersion:state.job.CURRENT_INPUT_VERSION,sourceSetVersion:state.job.CURRENT_SOURCE_SET_VERSION,requirementsVersion:state.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:state.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:state.job.CURRENT_INSTRUCTION_VERSION,iterationId:'ITER-ROUTE-v1',candidateId:'CAND-ROUTE-v1',runId:collectionSentinels.runs.currentId,contextId:collectionSentinels.freshContexts.currentId,baselineId:'BASE-ROUTE-v1',productId:'PROD-ROUTE-v1'};\n    for(const key of op.scopeRequirements)assert(scope[key]!==undefined,`Fixture missing required scope ${key} for Stage ${stage}/${operation}.`);";
if(!route.includes(oldRoute))throw new Error('Data-route scope fixture block not found.');
const newRoute="    const scopeValues={inputVersion:state.job.CURRENT_INPUT_VERSION,sourceSetVersion:state.job.CURRENT_SOURCE_SET_VERSION,researchVersion:'RESEARCH-ROUTE-v1',requirementsVersion:state.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:state.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:state.job.CURRENT_INSTRUCTION_VERSION,iterationId:'ITER-ROUTE-v1',candidateId:'CAND-ROUTE-v1',runId:collectionSentinels.runs.currentId,sourceConvergedIterationId:'ITER-CONVERGED-ROUTE-v1',confirmationIterationId:'ITER-CONFIRM-ROUTE-v1',baselineId:'BASE-ROUTE-v1',productId:'PROD-ROUTE-v1',productVersion:'PRODUCT-VERSION-ROUTE-v1',deliveryCandidateSetId:'DELIVERY-CANDIDATE-ROUTE-v1',reviewVersion:'REVIEW-ROUTE-v1',reconciledReviewVersion:'RECONCILED-REVIEW-ROUTE-v1',releaseId:'RELEASE-ROUTE-v1',hashReviewId:'HASH-ROUTE-v1',evidenceChainVersion:'EVIDENCE-CHAIN-ROUTE-v1'};\n    const scope=Object.fromEntries(op.scopeRequirements.map(key=>[key,scopeValues[key]]));\n    for(const key of op.scopeRequirements)assert(scope[key]!==undefined,`Fixture missing required scope ${key} for Stage ${stage}/${operation}.`);";
route=route.replace(oldRoute,newRoute);
fs.writeFileSync('verify-data-route-closure.mjs',route);

let workflow=fs.readFileSync('.github/workflows/pages.yml','utf8');
const needle='          node verify-v3-contract.mjs\n          node verify-spec3-contract.mjs\n';
if(!workflow.includes(needle))throw new Error('Migration-and-v3 workflow insertion point not found.');
workflow=workflow.replace(needle,'          node verify-v3-contract.mjs\n          node verify-section15-job-contract.mjs\n          node verify-section14-scope-matrix.mjs\n          node verify-spec3-contract.mjs\n');
fs.writeFileSync('.github/workflows/pages.yml',workflow);
console.log('Repaired exact scope matrix, data-route fixture, and fixed contract regression wiring.');
