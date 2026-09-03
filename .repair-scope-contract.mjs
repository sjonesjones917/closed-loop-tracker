import fs from 'node:fs';

const schemaPath='workflow-schema.js';
let schema=fs.readFileSync(schemaPath,'utf8');
const oldScope="const SCOPE_REQUIREMENTS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>{const s=i+1,keys=['projectRevision','inputVersion'];if(s>=3)keys.push('sourceSetVersion');if(s>=5)keys.push('requirementsVersion');if(s>=7)keys.push('testSuiteVersion');if(s>=9)keys.push('instructionVersion');if(s>=10&&s<=20)keys.push('iterationId','candidateId');if(s===9)keys.push('contextId');if(s===11)keys.push('runId','contextId');if(s>=20)keys.push('baselineId');if(s>=21)keys.push('productId');return [s,Object.freeze([...new Set(keys)])];})));";
const newScope=`const SCOPE_REQUIREMENTS=Object.freeze({
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
});`;
if(!schema.includes(oldScope))throw new Error('Expected legacy SCOPE_REQUIREMENTS implementation not found.');
schema=schema.replace(oldScope,newScope);
const oldOperation="function operationContract(stage,operation){const operations=STAGE_OPERATIONS[stage]||['COMPLETE'];if(!operations.includes(operation))return null;const override=OPERATION_CONTRACT_OVERRIDES[stage]?.[operation]||{};let scopeRequirements=override.scopeRequirements||SCOPE_REQUIREMENTS[stage]||[];if((stage===17||stage===19)&&!['EXECUTE_RUN','VERIFY'].includes(operation))scopeRequirements=scopeRequirements.filter(key=>key!=='runId'&&key!=='contextId');const independentReview=stage===9||stage===12||stage===23||stage===24||((stage===17||stage===19)&&operation==='VERIFY');if(independentReview&&!scopeRequirements.includes('contextId'))scopeRequirements=[...scopeRequirements,'contextId'];return Object.freeze({operation,readCollections:Object.freeze(override.readCollections||READ_COLLECTIONS[stage]||[]),agentWritableCollections:Object.freeze(override.agentWritableCollections||STAGE_COLLECTIONS[stage]||[]),allowedStageData:Object.freeze(override.allowedStageData||STAGE_CONTRACTS[stage]?.allowedStageData||[]),applicationCollections:Object.freeze(APPLICATION_COLLECTIONS[stage]||[]),humanActions:Object.freeze(HUMAN_ACTIONS[stage]||[]),scopeRequirements:Object.freeze(scopeRequirements)});}";
const newOperation=`function operationContract(stage,operation){
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
}`;
if(!schema.includes(oldOperation))throw new Error('Expected legacy operationContract implementation not found.');
schema=schema.replace(oldOperation,newOperation);
fs.writeFileSync(schemaPath,schema);

const workflowPath='.github/workflows/pages.yml';
let workflow=fs.readFileSync(workflowPath,'utf8');
const marker='          node verify-spec3-contract.mjs\n';
if(!workflow.includes(marker))throw new Error('Expected v3 verification marker not found.');
if(!workflow.includes('node verify-section14-scope-matrix.mjs'))workflow=workflow.replace(marker,marker+'          node verify-section14-scope-matrix.mjs\n');
fs.writeFileSync(workflowPath,workflow);
