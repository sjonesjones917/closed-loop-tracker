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
assert.match(app,/current value/i,'proposal display must include current values');
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

assert.match(workflow,/projectSchema:'closed-loop-project\/3'/,'acceptance report must identify project schema /3');
assert.match(workflow,/responseSchema:'closed-loop-stage-response\/3'/,'acceptance report must identify response schema /3');
assert.match(workflow,/testIrSchema:'closed-loop-test-spec\/1'/,'acceptance report must identify the Test IR schema');
assert.match(workflow,/stage01IntakeCoverage/,'acceptance report must prove Stage 01 accounting');
assert.match(workflow,/stage04ObligationCoverage/,'acceptance report must prove Stage 04 accounting');
assert.match(workflow,/mandatoryEvidenceSufficiencyCoverage/,'acceptance report must prove evidence sufficiency');
assert.match(workflow,/nativeExecutionCoverage/,'acceptance report must prove native execution coverage');
assert.match(workflow,/unsupportedTestIrTreatedAsExecutable/,'acceptance report must prove unsupported Test IR acceptance is zero');
assert.match(workflow,/externalAssertionsOverridingApplicationProof/,'acceptance report must prove external proof overrides are zero');
assert.match(workflow,/nativeExecutionReceiptsFabricatedExternally/,'acceptance report must prove native receipt fabrication is zero');
assert.match(workflow,/releaseAcceptedWithContradiction/,'acceptance report must prove contradiction-safe release');

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
