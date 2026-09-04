import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
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

assert.match(schema,/closed-loop-project\/3/,'project schema /3 is required');
assert.match(schema,/closed-loop-stage-response\/3/,'response schema /3 is required');
assert.match(schema,/closed-loop-test-spec\/1/,'Test IR schema /1 is required');
assert.match(schema,/closed-loop-verification-package\/1/,'verification-package schema /1 is required');
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
assert.match(workflow,/test "\$LIVE_RESULT" = success[\s\S]*DEPLOYMENT_MANIFEST_PATH=_site\/deployment-manifest\.json node verify-live\.mjs[\s\S]*DEPLOYMENT_MANIFEST_PATH=_site\/deployment-manifest\.json node verify-deployed-resource-graph\.mjs[\s\S]*deployedByteIdentity\s*:\s*live\.liveSourceIdentity===true/,'post-deploy byte identity must depend on successful live verification and the exact manifest/resource-graph proof');
assert.match(workflow,/deploymentManifestDigest\s*:\s*manifest\.overallManifestDigest[\s\S]*deploymentRuntimeResources\s*:\s*manifest\.runtimeResources\.map[\s\S]*deploymentWorkerSha256\s*:\s*deployedResourceGraph\.workerDigest[\s\S]*executedWorkerSha256\s*:\s*deployedResourceGraph\.returnedWorkerDigest/,'machine acceptance must retain exact manifest and executed worker resource identities');
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
