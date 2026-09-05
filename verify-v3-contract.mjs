import './verify-test-ir-port-types.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';

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

assert.match(workbook,/CONTRACT_PROFILE_ID='closed-loop-completion-profile\/1'/,'blank-project owner must bind the current contract profile');
for(const token of [
  'CURRENT_ITERATION:null','CURRENT_SOURCE_SET_VERSION:null','CURRENT_RESEARCH_VERSION:null',
  'CURRENT_REQUIREMENTS_VERSION:null','CURRENT_TEST_SUITE_VERSION:null','CURRENT_INSTRUCTION_VERSION:null',
  'CURRENT_CANDIDATE_ID:null','CURRENT_BASELINE_ID:null','CURRENT_PRODUCT_ID:null','CURRENT_PRODUCT_VERSION:null',
  'CURRENT_DELIVERY_CANDIDATE_SET_ID:null','CURRENT_REVIEW_VERSION:null','CURRENT_RECONCILED_REVIEW_VERSION:null',
  'CURRENT_RELEASE_ID:null','CURRENT_HASH_REVIEW_ID:null','CURRENT_EVIDENCE_CHAIN_VERSION:null','CURRENT_DELIVERY_ID:null',
  'LATEST_EVIDENCE_REFERENCE:null'
])assert.ok(workbook.includes(token),`blank-project canonical pointer contract missing: ${token}`);
assert.match(workbook,/CURRENT_STATE:'AWAITING_HUMAN_INPUT'/,'new project must start in the closed CURRENT_STATE enum');
assert.match(workbook,/JOB_RECORD_STATUS:'INCOMPLETE'/,'new project must start in the closed JOB_RECORD_STATUS enum');
assert.doesNotMatch(workbook,/CURRENT_(?:ITERATION|SOURCE_SET_VERSION|REQUIREMENTS_VERSION|TEST_SUITE_VERSION|INSTRUCTION_VERSION):''/,'nullable canonical pointers must not use empty-string sentinels');
assert.doesNotMatch(workbook,/CURRENT_(?:BASELINE_ID|PRODUCT_ID):'NONE'/,'nullable canonical pointers must not use NONE sentinels');

assert.match(schema,/closed-loop-project\/3/,'project schema /3 is required');
assert.match(schema,/closed-loop-stage-response\/3/,'response schema /3 is required');
assert.match(schema,/closed-loop-test-spec\/1/,'Test IR schema /1 is required');
assert.match(schema,/closed-loop-verification-package\/1/,'verification-package schema /1 is required');
assert.match(schema,/closed-loop-completion-profile\/1/,'current contract profile identity is required');
for(const name of ['CONTRACT_PROFILE_ID','CURRENT_RESEARCH_VERSION','CURRENT_CANDIDATE_ID','CURRENT_PRODUCT_VERSION','CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID'])assert.match(schema,new RegExp(`['"]${name}['"]`),`canonical Job field missing: ${name}`);
assert.match(schema,/BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE/,'CURRENT_STATE must use the closed enum');
assert.match(schema,/INCOMPLETE','BLOCKED','COMPLETE/,'JOB_RECORD_STATUS must use the closed enum');
assert.match(reservationProof,/RESERVED','EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED','ACCEPTED','REJECTED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE/,'permanent reservation regression must pin the closed state machine');
assert.match(engine,/p.revision=reservationRevision/,'reservation creation must commit R+1');
assert.match(engine,/TARGET_SLOT is application-calculated/,'caller-supplied target slots must be rejected');
assert.match(stateReleaseProof,/mandatory refutation must control/,'release precedence regression must distinguish refutation from blockers');
assert.doesNotMatch(engine,/CURRENT_STATE=projectOpenBlockers.length\?'BLOCKED':completed===30\?'COMPLETE'/,'runtime must not emit legacy CURRENT_STATE values');
assert.match(schema,/fields\.EXECUTABLE_KIND='NONE'/,'schema migration/default path must define NONE as the non-executable state');
assert.doesNotMatch(schema,/enumValues\s*:\s*\[[^\]]*CUSTOM_PIPELINE[^\]]*\]/,'CUSTOM_PIPELINE cannot remain an active executable enum member');
assert.match(schema,/fields\.EXECUTABLE_KIND==='CUSTOM_PIPELINE'[^\n]*fields\.EXECUTABLE_KIND='TEST_IR'/,'historical CUSTOM_PIPELINE records must migrate deterministically to TEST_IR');
assert.match(schema,/\bTEST_IR\b/,'TEST_IR executable kind is required');

for(const op of requiredRuntimeOps)assert.match(runtime,new RegExp(`\\b${op}\\b`),`runtime operation missing: ${op}`);
for(const limit of requiredLimits)assert.match(runtime,new RegExp(`\\b${limit}\\b`),`central runtime limit missing: ${limit}`);
assert.doesNotMatch(runtime,/\beval\s*\(/,'runtime must not use eval');
assert.doesNotMatch(runtime,/\bFunction\s*\(/,'runtime must not use Function');
assert.doesNotMatch(runtime,/CUSTOM_PIPELINE/,'runtime must not accept CUSTOM_PIPELINE');
assert.match(runtime,/EXECUTABLE_KIND='TEST_IR'/,'runtime executable kind must be TEST_IR');
assert.match(runtime,/function executeTest\s*\(/,'runtime must expose worker-coordinated executeTest');
assert.match(worker,/Network access is unavailable/,'worker must deny network access');
assert.match(worker,/EXECUTE_TEST_IR/,'worker must accept only the registered execution command');
assert.doesNotMatch(worker,/\beval\s*\(/,'worker must not use eval');
assert.doesNotMatch(worker,/\bFunction\s*\(/,'worker must not use Function');
assert.match(worker,/self\.eval=unavailable\('eval'\)/,'worker must make the eval execution surface unavailable after bootstrap');
assert.match(worker,/self\.Function=unavailable\('Function'\)/,'worker must make the Function constructor unavailable after bootstrap');
for(const mutation of [worker.replace("self.eval=unavailable('eval')","self.eval=globalThis.eval"),worker.replace("self.Function=unavailable('Function')","self.Function=globalThis.Function")]){
  assert.ok(!/self\.eval=unavailable\('eval'\)/.test(mutation)||!/self\.Function=unavailable\('Function'\)/.test(mutation),'dynamic-code denial mutation must remove a required worker guard');
}

for(const helper of ['testExecutionPlan','evaluateContextIndependence','evaluateEvidenceSufficiency','detectCurrentContradictions','operationalNextAction'])assert.match(engine,new RegExp(`\\b${helper}\\b`),`workflow engine helper missing: ${helper}`);
assert.match(store,/\bcreateExecutionPackage\b/,'project store must construct execution packages');
assert.match(store,/closed-loop-verification-package\/1/,'execution package must use the controlling package schema');
assert.match(app,/RUN_APP_TESTS/,'primary UI must support native application tests');
assert.match(app,/canonical state changed/i,'UI must report canonical-change certainty');
assert.match(app,/\bcurrentValue\s*:/,'proposal display must bind every diff row to its current canonical value before rendering');
assert.match(prompt,/FILES YOU MUST RECEIVE/,'prompt handoff must name files to receive');
assert.match(prompt,/FILES YOU MUST NOT RECEIVE/,'prompt handoff must name withheld material');
assert.match(prompt,/FILES OR EVIDENCE YOU MUST RETURN/,'prompt handoff must name required returns');
assert.match(ingestion,/duplicate member/i,'ingestion must scan duplicate JSON members');
assert.match(ingestion,/UNSAFE_SMART_QUOTES/,'authoritative response JSON must reject smart/curly delimiters');
assert.doesNotMatch(ingestion,/normalizeSmartJsonDelimiters|SMART_JSON_DELIMITERS/,'authoritative response JSON must never be repaired before parsing');

const scripts=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1].split('?')[0]);
assert.deepEqual(scripts,[
  'workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js',
  'prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'
],'runtime scripts must use the controlling dependency order');
const scriptTokens=[...html.matchAll(/<script\s+defer\s+src="[^"]+\?v=([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
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
const proofSource=definitionProof+'\n'+v3Proof;
for(const field of [
  'stage01IntakeCoverage','stage04ObligationCoverage','mandatoryEvidenceSufficiencyCoverage','nativeExecutionCoverage',
  'acceptedAgentValueExtractionCoverage','acceptedRelationshipProvenanceCoverage','currentScopeSelectorCoverage',
  'exactReqRunTestCoverage','applicableCurrentRegressionSuccess','releaseArtifactIdentityCoverage',
  'unsupportedTestIrTreatedAsExecutable','externalAssertionsOverridingApplicationProof',
  'nativeExecutionReceiptsFabricatedExternally','releaseAcceptedWithContradiction'
])assert.match(proofSource,new RegExp(`\\b${field}\\b`),`executed acceptance proof must identify ${field}`);
assert.match(definitionProof,/\bmandatoryEvidenceChainCoverage\b/,'executed acceptance proof must identify mandatory evidence-chain structural coverage');
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
  runtimeOperations:requiredRuntimeOps.length,
  centralizedLimits:requiredLimits.length
}));
await import('./verify-stage-contract-closure.mjs');
await import('./verify-stage27-release-binding.mjs');
