import './verify-test-ir-port-types.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const workbook=read('./workbook.js');
const schema=read('./workflow-schema.js');
const runtime=read('./test-runtime.js');
const worker=read('./test-worker.js');
const engine=read('./workflow-engine.js');
const prompt=read('./prompt-engine.js');
const ingestion=read('./response-ingestion.js');
const store=read('./project-store.js');
const app=read('./app-core.js');
const html=read('./index.html');
const workflow=read('./.github/workflows/pages.yml');
const definitionProof=read('./verify-definition-of-done.mjs');
const v3Proof=read('./verify-v3-definition-of-done.mjs');
const reservationProof=read('./verify-reservation-contract.mjs');
const stateReleaseProof=read('./verify-state-release-contract.mjs');

const requiredRuntimeOps=[
  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML',
  'SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256',
  'REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE',
  'ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'
];
const requiredLimits=[
  'maxTotalInputBytes','maxDecompressedBytes','maxSteps','maxSelectorDepth','maxParsedDepth',
  'maxCollectionItems','maxRegexPatternBytes','maxRegexInputBytes','workerTimeoutMs','maxArchiveExpansionBytes'
];

// Execute the shipped modules. A source token or a matching test filename is
// not evidence that initialization, parsing or reservation behavior works.
const context=vm.createContext({TextEncoder,TextDecoder,Blob,crypto:globalThis.crypto,Event:class{},dispatchEvent(){}});
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInContext(read('./'+file),context,{filename:file});
const core=context.closedLoopCore,definitions=context.closedLoopWorkflowSchema,execution=context.closedLoopTestRuntime,workflowEngine=context.closedLoopWorkflowEngine;
const project=core.createBlankState('CONTRACT-INITIALIZATION');
assert.equal(project.contractProfileId||project.job.CONTRACT_PROFILE_ID,'closed-loop-completion-profile/1');
for(const pointer of ['CURRENT_ITERATION','CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION','CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION','CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','LATEST_EVIDENCE_REFERENCE'])assert.equal(project.job[pointer],null,'A new project must have no invented '+pointer);
assert.equal(project.job.CURRENT_STATE,'AWAITING_HUMAN_INPUT');assert.equal(project.job.JOB_RECORD_STATUS,'INCOMPLETE');
for(const [key,expected] of Object.entries({PROJECT_SCHEMA:'closed-loop-project/3',RESPONSE_SCHEMA:'closed-loop-stage-response/3',TEST_IR_SCHEMA:'closed-loop-test-spec/1',PACKAGE_SCHEMA:'closed-loop-verification-package/1',CONTRACT_PROFILE_ID:'closed-loop-completion-profile/1'}))assert.equal(definitions[key],expected,key);
const enums=definitions.RECORD_SCHEMAS.operationReservations.fieldDefinitions.STATUS.enumValues;
assert.deepEqual(Array.from(enums),['RESERVED','EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED','ACCEPTED','REJECTED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE']);
assert(!definitions.RECORD_SCHEMAS.tests.fieldDefinitions.EXECUTABLE_KIND.enumValues.includes('CUSTOM_PIPELINE'));
assert(definitions.RECORD_SCHEMAS.tests.fieldDefinitions.EXECUTABLE_KIND.enumValues.includes('TEST_IR'));
for(const op of requiredRuntimeOps)assert(execution.OPS.includes(op),'Missing declared runtime operation '+op);
for(const limit of requiredLimits)assert(Number.isFinite(execution.LIMITS[limit])&&execution.LIMITS[limit]>0,'Invalid runtime limit '+limit);
assert.equal(typeof execution.executeTest,'function');
const parser=context.closedLoopResponseIngestion;
assert.deepEqual(JSON.parse(JSON.stringify(parser.strictParse('{"value":1}'))),{value:1});
assert.throws(()=>parser.strictParse('{"value":1,"value":2}'),/duplicate member/i);
assert.throws(()=>parser.strictParse('{“value”:1}'),/UNSAFE_SMART_QUOTES|quotation|quote/i);
const executedReports=[];
for(const file of ['verify-reservation-contract.mjs','verify-state-release-contract.mjs','verify-test-worker-isolation.mjs']){
 const output=execFileSync(process.execPath,[file],{encoding:'utf8'});
 executedReports.push({file,result:'PASS',stdoutSha256:context.closedLoopHash.sha256Text(output)});
}
// These remaining checks concern the actual HTML/CI configuration, rather
// than claiming runtime behavior from implementation source spelling.
const scripts=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1].split('?')[0]);
assert.deepEqual(scripts,[
  'workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js',
  'prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'
],'runtime scripts must use the controlling dependency order');
const scriptTokens=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>new URLSearchParams(match[1].split('?')[1]||'').get('v'));
assert(scriptTokens.length===scripts.length&&scriptTokens.every(Boolean),'every runtime script must declare its build identity');
assert.equal(new Set(scriptTokens).size,1,'all runtime scripts must share one build identity');
assert.match(html,/worker-src\s+'self'/,'CSP must permit only the same-origin worker');
assert.doesNotMatch(html,/worker-src[^;]*(?:\*|https?:|blob:|data:)/,'CSP must not open arbitrary worker sources');

const reportField=(name,valuePattern)=>new RegExp(`(?:['\"])?${name}(?:['\"])?\\s*:\\s*${valuePattern}`);
assert.match(workflow,reportField('projectSchema',"['\"]closed-loop-project\\/3['\"]"),'acceptance report must identify project schema /3');
assert.match(workflow,reportField('responseSchema',"['\"]closed-loop-stage-response\\/3['\"]"),'acceptance report must identify response schema /3');
assert.match(workflow,reportField('testIrSchema',"['\"]closed-loop-test-spec\\/1['\"]"),'acceptance report must identify the Test IR schema');
assert.match(workflow,reportField('verificationPackageSchema',"['\"]closed-loop-verification-package\\/1['\"]"),'acceptance report must identify the verification-package schema');
assert.match(workflow,/node verify-definition-of-done\.mjs/,'publish job must execute the deterministic definition-of-done proof');
assert.match(workflow,/node verify-v3-definition-of-done\.mjs/,'publish job must execute the v3 definition-of-done proof');
assert.match(workflow,/\.\.\.definition/,'acceptance report must include the executed definition-of-done result');
assert.match(workflow,/\.\.\.v3/,'acceptance report must include the executed v3 result');
assert.match(workflow,/closed-loop-acceptance\.json/,'post-deploy machine acceptance artifact is required');
assert.match(workflow,/deployedByteIdentity\s*:\s*process\.env\.LIVE_RESULT\s*===\s*['"]success['"]/,'post-deploy byte identity must derive from the successful live-verification job');
assert.match(workflow,/deployedChromiumAcceptance\s*:\s*process\.env\.LIVE_RESULT\s*===\s*['"]success['"]/,'deployed browser acceptance must derive from the successful live-verification job');
assert.match(workflow,/localChromiumAcceptance\s*:\s*process\.env\.TEST_RESULT\s*===\s*['"]success['"]/,'local browser acceptance must derive from the successful test job');
assert.doesNotMatch(workflow,/deployedByteIdentity\s*:\s*true/,'post-deploy byte identity must not be hard-coded');
assert.doesNotMatch(workflow,/(?:deployedChromiumAcceptance|liveBrowserVerification)\s*:\s*true/,'deployed browser acceptance must not be hard-coded');

console.log(JSON.stringify({
  verifyV3Contract:'PASS',
  projectSchema:'closed-loop-project/3',
  responseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',
  packageSchema:'closed-loop-verification-package/1',
  stageCount:30,
  evidenceClass:'CONTRACT_DECLARATIONS_AND_EXECUTED_BOUNDARY_CASES',
  applicationCompletion:false,
  executedReports,
  runtimeOperationDeclarations:requiredRuntimeOps.length,
  centralizedLimits:requiredLimits.length
}));
await import('./verify-stage-contract-closure.mjs');
await import('./verify-stage27-release-binding.mjs');
