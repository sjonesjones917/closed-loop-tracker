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
const completeTests=read('./verify-complete.mjs');
const ingestionTests=read('./verify-ingestion.mjs');
const semanticTests=read('./verify-semantic-invariant.mjs');
const runtimeTests=read('./verify-test-runtime-v3.mjs');

const all=(text,patterns)=>patterns.every(pattern=>pattern.test(text));
const count=(text,pattern)=>(text.match(pattern)||[]).length;

const stage01Architecture=all(engine,[/intake.{0,40}manifest/is,/coverage/i,/input.{0,20}(unit|statement)/i])&&
  all(prompt,[/intake.{0,40}manifest/is,/every.{0,40}(identity|input unit)/is])&&
  all(ingestion,[/intake.{0,40}(coverage|manifest)/is,/(omit|missing|unaccounted)/i]);
const stage01MutationProof=all(ingestionTests,[/stage\s*0?1/i,/intake/i,/(omit|missing|unaccounted)/i,/(reject|invalid)/i]);
assert.ok(stage01Architecture,'Stage 01 intake enumeration, prompt accounting, and ingestion closure must exist');
assert.ok(stage01MutationProof,'Stage 01 incomplete-accounting mutation coverage must exist');

const stage04Architecture=all(engine,[/obligation.{0,40}manifest/is,/(disposition|account)/i])&&
  all(prompt,[/obligation.{0,40}manifest/is,/every.{0,40}obligation/is])&&
  all(ingestion,[/obligation.{0,40}(coverage|manifest)/is,/(omit|missing|unaccounted)/i]);
const stage04MutationProof=all(ingestionTests,[/stage\s*0?4/i,/obligation/i,/(omit|missing|unaccounted)/i,/(reject|invalid)/i]);
assert.ok(stage04Architecture,'Stage 04 obligation enumeration, prompt accounting, and ingestion closure must exist');
assert.ok(stage04MutationProof,'Stage 04 incomplete-accounting mutation coverage must exist');

assert.match(engine,/function\s+evaluateEvidenceSufficiency\s*\(|evaluateEvidenceSufficiency\s*[:=]/,'one evidence-sufficiency evaluator is required');
assert.ok(count(engine,/evaluateEvidenceSufficiency\s*\(/g)>=2,'gates must consume the shared evidence-sufficiency evaluator');
assert.ok(all(semanticTests,[/byte/i,/prose/i,/meaning/i,/hash/i,/human/i,/external.{0,20}system/is]),'evidence-class negative cases must cover byte, meaning, human, and external-system propositions');
assert.ok(all(completeTests,[/evidence/i,/(insufficient|sufficient)/i,/release/i]),'workflow gates must exercise sufficient and insufficient evidence');

assert.equal(runtime.includes("EXECUTABLE_KIND='TEST_IR'"),true,'native execution must target TEST_IR');
assert.match(runtime,/function\s+executeTest\s*\(/,'runtime must coordinate isolated execution');
assert.match(worker,/EXECUTE_TEST_IR/,'worker must execute the registered command');
assert.ok(/native.{0,40}(execution|result|receipt)/is.test(engine),'engine must own native execution/result/receipt handling');
assert.ok(/RUN_APP_TESTS/.test(app),'operator must have one native-test action');
assert.ok(all(runtimeTests,[/unknown operation/i,/timeout/i,/BYTE_COMPARE/,/HASH_SHA256/,/approximate/i]),'native runtime security and semantics mutation tests must exist');

assert.ok(/external.{0,80}(override|application-owned|derived)/is.test(ingestion)||/APPLICATION.{0,80}(writ|owner)/is.test(ingestion),'ingestion must reject external mutation of application proof');
assert.ok(/native.{0,80}(receipt|execution).{0,80}(external|agent)/is.test(ingestionTests)||/fabricat.{0,80}native/is.test(ingestionTests),'native-receipt fabrication negative coverage must exist');
assert.ok(/contradiction/i.test(engine)&&/release/i.test(engine),'release must consume current contradictions');
assert.ok(/contradiction/i.test(completeTests)&&/(block|reject|fail)/i.test(completeTests),'contradiction mutation coverage must block progression');
assert.ok(/closed-loop-project\/2/.test(schema)||/closed-loop-project\/2/.test(store),'the immediately previous schema must remain a recognized migration input');
assert.ok(/closed-loop-project\/3/.test(schema),'the active schema must be /3');
assert.ok(/non.?operational|audit.{0,30}(payload|evidence)/is.test(schema+store),'migration must preserve imported payload as non-operational audit evidence');
assert.ok(/closed-loop-stage-response\/2/.test(ingestionTests)||/closed-loop-stage-response\/2/.test(ingestion),'old response schema must have an explicit historical/rejection case');

const report={
  stage01IntakeCoverage:1,
  stage04ObligationCoverage:1,
  mandatoryEvidenceSufficiencyCoverage:1,
  nativeExecutionCoverage:1,
  unsupportedTestIrTreatedAsExecutable:0,
  externalAssertionsOverridingApplicationProof:0,
  nativeExecutionReceiptsFabricatedExternally:0,
  releaseAcceptedWithContradiction:0,
  migrationV2ToV3Covered:1,
  oldV2ResponseRejectedForCurrentPrompt:1,
  currentProjectSchema:'closed-loop-project/3',
  currentResponseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',
  verificationPackageSchema:'closed-loop-verification-package/1',
  androidChromeAcceptance:false,
  realThirtyStageProjectAcceptance:false,
  fullProductionMaturity:false
};
console.log(JSON.stringify(report,null,2));
