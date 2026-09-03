import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js'])vm.runInThisContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),{filename:file});
const schema=globalThis.closedLoopWorkflowSchema;

const expected={
1:['inputVersion'],
2:['inputVersion','sourceSetVersion'],
3:['inputVersion','sourceSetVersion','researchVersion'],
4:['inputVersion','sourceSetVersion','researchVersion','requirementsVersion'],
5:['inputVersion','sourceSetVersion','researchVersion','requirementsVersion'],
6:['requirementsVersion','testSuiteVersion'],
7:['requirementsVersion','testSuiteVersion'],
8:['requirementsVersion','testSuiteVersion','instructionVersion'],
9:['requirementsVersion','testSuiteVersion','instructionVersion'],
10:['requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId'],
11:['iterationId','candidateId','runId'],
12:['iterationId','candidateId','runId','requirementsVersion','testSuiteVersion'],
13:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],
14:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],
15:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],
16:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],
17:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],
18:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],
19:['sourceConvergedIterationId','confirmationIterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],
20:['confirmationIterationId','baselineId'],
21:['baselineId','productId'],
22:['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion'],
23:['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion'],
24:['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion'],
25:['baselineId','productId','productVersion','deliveryCandidateSetId'],
26:['baselineId','productId','productVersion','deliveryCandidateSetId','reviewVersion'],
27:['baselineId','productId','productVersion','deliveryCandidateSetId','reconciledReviewVersion'],
28:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId'],
29:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId'],
30:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId','evidenceChainVersion']
};

for(let stage=1;stage<=30;stage++){
  assert.deepEqual([...schema.SCOPE_REQUIREMENTS[stage]],expected[stage],`Stage ${stage} scope matrix mismatch`);
  for(const operation of schema.STAGE_OPERATIONS[stage]){
    const contract=schema.operationContract(stage,operation);
    assert(contract,`Missing operation contract ${stage}/${operation}`);
    assert.deepEqual([...contract.scopeRequirements],expected[stage],`Operation ${stage}/${operation} scope mismatch`);
  }
}
assert.equal(schema.operationContract(31,'COMPLETE'),null,'Unknown stage-operation must fail closed');
assert.equal(schema.operationContract(1,'NOT_A_REAL_OPERATION'),null,'Unknown operation must fail closed');
console.log(JSON.stringify({section14ScopeMatrix:'PASS',stages:30,operations:Object.values(schema.STAGE_OPERATIONS).reduce((n,v)=>n+v.length,0)},null,2));
