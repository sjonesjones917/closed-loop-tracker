import fs from 'node:fs';
function replaceOnce(path,before,after){const text=fs.readFileSync(path,'utf8');if(!text.includes(before))throw new Error(`${path}: expected source fragment not found`);if(text.indexOf(before)!==text.lastIndexOf(before))throw new Error(`${path}: ambiguous source fragment`);fs.writeFileSync(path,text.replace(before,after));}
const oldScope=`const SCOPE_REQUIREMENTS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>{const s=i+1,keys=['projectRevision','inputVersion'];if(s>=3)keys.push('sourceSetVersion');if(s>=5)keys.push('requirementsVersion');if(s>=7)keys.push('testSuiteVersion');if(s>=9)keys.push('instructionVersion');if(s>=10&&s<=20)keys.push('iterationId','candidateId');if(s===9)keys.push('contextId');if(s===11)keys.push('runId','contextId');if(s>=20)keys.push('baselineId');if(s>=21)keys.push('productId');return [s,Object.freeze([...new Set(keys)])];})));`;
const newScope=`const SCOPE_REQUIREMENTS=Object.freeze({
  1:Object.freeze(['projectRevision','inputVersion']),
  2:Object.freeze(['projectRevision','inputVersion','sourceSetVersion']),
  3:Object.freeze(['projectRevision','inputVersion','sourceSetVersion','researchVersion']),
  4:Object.freeze(['projectRevision','inputVersion','sourceSetVersion','researchVersion','requirementsVersion']),
  5:Object.freeze(['projectRevision','inputVersion','sourceSetVersion','researchVersion','requirementsVersion']),
  6:Object.freeze(['projectRevision','requirementsVersion','testSuiteVersion']),
  7:Object.freeze(['projectRevision','requirementsVersion','testSuiteVersion']),
  8:Object.freeze(['projectRevision','requirementsVersion','testSuiteVersion','instructionVersion']),
  9:Object.freeze(['projectRevision','requirementsVersion','testSuiteVersion','instructionVersion']),
  10:Object.freeze(['projectRevision','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId']),
  11:Object.freeze(['projectRevision','iterationId','candidateId','runId']),
  12:Object.freeze(['projectRevision','iterationId','candidateId','runId','requirementsVersion','testSuiteVersion']),
  13:Object.freeze(['projectRevision','iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  14:Object.freeze(['projectRevision','iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  15:Object.freeze(['projectRevision','iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  16:Object.freeze(['projectRevision','iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  17:Object.freeze(['projectRevision','iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  18:Object.freeze(['projectRevision','iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  19:Object.freeze(['projectRevision','sourceConvergedIterationId','confirmationIterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']),
  20:Object.freeze(['projectRevision','confirmationIterationId','baselineId']),
  21:Object.freeze(['projectRevision','baselineId','productId']),
  22:Object.freeze(['projectRevision','baselineId','productId','productVersion','requirementsVersion','testSuiteVersion']),
  23:Object.freeze(['projectRevision','baselineId','productId','productVersion','requirementsVersion','testSuiteVersion']),
  24:Object.freeze(['projectRevision','baselineId','productId','productVersion','requirementsVersion','testSuiteVersion']),
  25:Object.freeze(['projectRevision','baselineId','productId','productVersion','deliveryCandidateSetId']),
  26:Object.freeze(['projectRevision','baselineId','productId','productVersion','deliveryCandidateSetId','reviewVersion']),
  27:Object.freeze(['projectRevision','baselineId','productId','productVersion','deliveryCandidateSetId','reconciledReviewVersion']),
  28:Object.freeze(['projectRevision','baselineId','productId','productVersion','deliveryCandidateSetId','releaseId']),
  29:Object.freeze(['projectRevision','baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId']),
  30:Object.freeze(['projectRevision','baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId','evidenceChainVersion'])
});`;
replaceOnce('workflow-schema.js',oldScope,newScope);
const oldOp=`function operationContract(stage,operation){const operations=STAGE_OPERATIONS[stage]||['COMPLETE'];if(!operations.includes(operation))return null;const override=OPERATION_CONTRACT_OVERRIDES[stage]?.[operation]||{};let scopeRequirements=override.scopeRequirements||SCOPE_REQUIREMENTS[stage]||[];if((stage===17||stage===19)&&!['EXECUTE_RUN','VERIFY'].includes(operation))scopeRequirements=scopeRequirements.filter(key=>key!=='runId'&&key!=='contextId');const independentReview=stage===9||stage===12||stage===23||stage===24||((stage===17||stage===19)&&operation==='VERIFY');if(independentReview&&!scopeRequirements.includes('contextId'))scopeRequirements=[...scopeRequirements,'contextId'];return Object.freeze({operation,readCollections:Object.freeze(override.readCollections||READ_COLLECTIONS[stage]||[]),agentWritableCollections:Object.freeze(override.agentWritableCollections||STAGE_COLLECTIONS[stage]||[]),allowedStageData:Object.freeze(override.allowedStageData||STAGE_CONTRACTS[stage]?.allowedStageData||[]),applicationCollections:Object.freeze(APPLICATION_COLLECTIONS[stage]||[]),humanActions:Object.freeze(HUMAN_ACTIONS[stage]||[]),scopeRequirements:Object.freeze(scopeRequirements)});}`;
const newOp=`function operationContract(stage,operation){const operations=STAGE_OPERATIONS[stage]||['COMPLETE'];if(!operations.includes(operation))return null;const override=OPERATION_CONTRACT_OVERRIDES[stage]?.[operation]||{};const scopeRequirements=override.scopeRequirements||SCOPE_REQUIREMENTS[stage]||[];return Object.freeze({operation,readCollections:Object.freeze(override.readCollections||READ_COLLECTIONS[stage]||[]),agentWritableCollections:Object.freeze(override.agentWritableCollections||STAGE_COLLECTIONS[stage]||[]),allowedStageData:Object.freeze(override.allowedStageData||STAGE_CONTRACTS[stage]?.allowedStageData||[]),applicationCollections:Object.freeze(APPLICATION_COLLECTIONS[stage]||[]),humanActions:Object.freeze(HUMAN_ACTIONS[stage]||[]),scopeRequirements:Object.freeze(scopeRequirements)});}`;
replaceOnce('workflow-schema.js',oldOp,newOp);
