import fs from 'node:fs';

const schemaPath='workflow-schema.js';
let source=fs.readFileSync(schemaPath,'utf8');
if(source.includes('closed-loop-operation-scope-closure/1')) throw new Error('Scope/authority closure already present.');

const layer=String.raw`

/* CLOSED OPERATION / SCOPE CONTRACT CLOSURE */
;(()=>{
'use strict';
const prior=globalThis.closedLoopWorkflowSchema;
if(!prior)throw new Error('workflow schema must load before operation/scope closure');
const SCOPE_REQUIREMENTS=Object.freeze({
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
const EXECUTOR_CLASS=Object.freeze({EXTERNAL_AGENT:'EXTERNAL_AGENT',APPLICATION:'APPLICATION',HUMAN_DECISION:'HUMAN_DECISION',OPERATOR_ACTION:'OPERATOR_ACTION'});
const ACCEPTANCE_MODE=Object.freeze({HUMAN_ACCEPTANCE_REQUIRED:'HUMAN_ACCEPTANCE_REQUIRED',VALIDATED_AUTO_COMMIT:'VALIDATED_AUTO_COMMIT',NOT_APPLICABLE:'NOT_APPLICABLE'});
const applicationKeys=new Set([
'7:EXECUTE_FAILURE_TEST','10:FREEZE','15:EXECUTE_REGRESSION','18:COMPLETE','19:CONFIRM_FREEZE','19:REGRESSION_VERIFY','19:CONFIRM','20:FREEZE_BASELINE','22:RUN_NATIVE_TESTS','24:RUN_NATIVE_ATTACKS','25:FREEZE_DELIVERY_CANDIDATE','27:CALCULATE_RELEASE','28:VERIFY_IDENTITY','29:CALCULATE_EVIDENCE_CHAINS','30:CALCULATE_TERMINAL'
]);
const humanDecisionKeys=new Set(['28:CAPTURE_DELIVERY_INTENT']);
const nonAgentWritable=new Set([...applicationKeys,...humanDecisionKeys]);
const applicationResponseTypes=Object.freeze([]);
function operationKey(stage,operation){return Number(stage)+':'+String(operation);}
function classify(stage,operation){const key=operationKey(stage,operation);if(humanDecisionKeys.has(key))return EXECUTOR_CLASS.HUMAN_DECISION;if(applicationKeys.has(key))return EXECUTOR_CLASS.APPLICATION;return EXECUTOR_CLASS.EXTERNAL_AGENT;}
function operationContract(stage,operation){
 const n=Number(stage),op=String(operation||''),operations=prior.STAGE_OPERATIONS?.[n];
 if(!Array.isArray(operations)||!operations.includes(op))return null;
 const legacy=prior.operationContract?.(n,op)||{};
 const executorClass=classify(n,op),key=operationKey(n,op),isExternal=executorClass===EXECUTOR_CLASS.EXTERNAL_AGENT;
 const agentWritableCollections=nonAgentWritable.has(key)?[]:[...(legacy.agentWritableCollections||[])];
 const allowedStageData=nonAgentWritable.has(key)?[]:[...(legacy.allowedStageData||[])];
 const responseTypes=isExternal?Object.freeze(['DATA_PROPOSAL','HUMAN_INPUT_REQUIRED','BLOCKED','EXECUTION_FAILED']):applicationResponseTypes;
 const acceptanceMode=isExternal?(n===1&&['COMPLETE','RECONCILE_INTAKE'].includes(op)?ACCEPTANCE_MODE.HUMAN_ACCEPTANCE_REQUIRED:ACCEPTANCE_MODE.HUMAN_ACCEPTANCE_REQUIRED):ACCEPTANCE_MODE.NOT_APPLICABLE;
 return Object.freeze({...legacy,operation:op,executorClass,responseTypes,acceptanceMode,agentWritableCollections:Object.freeze(agentWritableCollections),allowedStageData:Object.freeze(allowedStageData),scopeRequirements:SCOPE_REQUIREMENTS[n],reservationRequired:isExternal});
}
const STAGE_OPERATION_SCOPE_MATRIX=Object.freeze(Object.fromEntries(Object.entries(prior.STAGE_OPERATIONS||{}).flatMap(([stage,ops])=>ops.map(operation=>{
 const n=Number(stage),key=operationKey(n,operation);return [key,Object.freeze({stage:n,operation,requiredDimensions:SCOPE_REQUIREMENTS[n],projectRevisionRequired:true,contractProfileIdRequired:true,scopeHashRequired:true})];
}))));
const STAGE_OPERATION_REGISTRY=Object.freeze(Object.fromEntries(Object.entries(prior.STAGE_OPERATIONS||{}).flatMap(([stage,ops])=>ops.map(operation=>{const n=Number(stage),c=operationContract(n,operation);return [operationKey(n,operation),c];}))));
for(const [key,contract] of Object.entries(STAGE_OPERATION_REGISTRY)){
 if(!contract)throw new Error('Missing operation contract '+key);
 if(contract.executorClass!==EXECUTOR_CLASS.EXTERNAL_AGENT&&(contract.agentWritableCollections.length||contract.allowedStageData.length||contract.responseTypes.length))throw new Error('Non-agent operation exposes external write/response authority '+key);
}
const operationCount=Object.values(prior.STAGE_OPERATIONS||{}).reduce((n,ops)=>n+ops.length,0);
if(operationCount!==66||Object.keys(STAGE_OPERATION_REGISTRY).length!==66)throw new Error('Closed operation registry must contain exactly 66 stage-operation combinations.');
globalThis.closedLoopWorkflowSchema=Object.freeze({...prior,version:'closed-loop-operation-scope-closure/1',SCOPE_REQUIREMENTS,EXECUTOR_CLASS,ACCEPTANCE_MODE,STAGE_OPERATION_SCOPE_MATRIX,STAGE_OPERATION_REGISTRY,operationContract});
})();
`;
source+=layer;
fs.writeFileSync(schemaPath,source);

const test=`import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport vm from 'node:vm';\nimport {webcrypto} from 'node:crypto';\nconst context={console,TextEncoder,TextDecoder,crypto:webcrypto,structuredClone,Event:class Event{constructor(type){this.type=type;}},dispatchEvent(){},addEventListener(){},removeEventListener(){},setTimeout,clearTimeout};context.globalThis=context;vm.createContext(context);for(const f of ['workbook.js','hash.js','workflow-schema.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context,{filename:f});const s=context.closedLoopWorkflowSchema;\nconst expected={1:['inputVersion'],2:['inputVersion','sourceSetVersion'],3:['inputVersion','sourceSetVersion','researchVersion'],4:['inputVersion','sourceSetVersion','researchVersion','requirementsVersion'],5:['inputVersion','sourceSetVersion','researchVersion','requirementsVersion'],6:['requirementsVersion','testSuiteVersion'],7:['requirementsVersion','testSuiteVersion'],8:['requirementsVersion','testSuiteVersion','instructionVersion'],9:['requirementsVersion','testSuiteVersion','instructionVersion'],10:['requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId'],11:['iterationId','candidateId','runId'],12:['iterationId','candidateId','runId','requirementsVersion','testSuiteVersion'],13:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],14:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],15:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],16:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],17:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],18:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],19:['sourceConvergedIterationId','confirmationIterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],20:['confirmationIterationId','baselineId'],21:['baselineId','productId'],22:['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion'],23:['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion'],24:['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion'],25:['baselineId','productId','productVersion','deliveryCandidateSetId'],26:['baselineId','productId','productVersion','deliveryCandidateSetId','reviewVersion'],27:['baselineId','productId','productVersion','deliveryCandidateSetId','reconciledReviewVersion'],28:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId'],29:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId'],30:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId','evidenceChainVersion']};for(let n=1;n<=30;n++){assert.deepEqual(Array.from(s.SCOPE_REQUIREMENTS[n]),expected[n]);for(const op of s.STAGE_OPERATIONS[n])assert.deepEqual(Array.from(s.operationContract(n,op).scopeRequirements),expected[n],n+'/'+op);}assert.equal(Object.keys(s.STAGE_OPERATION_REGISTRY).length,66);for(const key of ['10:FREEZE','18:COMPLETE','22:RUN_NATIVE_TESTS','24:RUN_NATIVE_ATTACKS','25:FREEZE_DELIVERY_CANDIDATE','27:CALCULATE_RELEASE','28:VERIFY_IDENTITY','29:CALCULATE_EVIDENCE_CHAINS','30:CALCULATE_TERMINAL']){const c=s.STAGE_OPERATION_REGISTRY[key];assert.equal(c.executorClass,'APPLICATION',key);assert.deepEqual(Array.from(c.agentWritableCollections),[],key);assert.deepEqual(Array.from(c.allowedStageData),[],key);assert.deepEqual(Array.from(c.responseTypes),[],key);}assert.equal(s.operationContract(31,'COMPLETE'),null);assert.equal(s.operationContract(1,'NOT_REAL'),null);console.log(JSON.stringify({scopeAuthorityContract:'PASS',operations:66,stages:30}));\n`;
fs.writeFileSync('verify-operation-scope-authority.mjs',test);

const v3='verify-v3-contract.mjs';let v3s=fs.readFileSync(v3,'utf8');if(!v3s.includes("verify-operation-scope-authority.mjs"))v3s="await import('./verify-operation-scope-authority.mjs');\n"+v3s;fs.writeFileSync(v3,v3s);

console.log('scope/authority repair applied');
