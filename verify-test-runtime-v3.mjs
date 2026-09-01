import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';

const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL,setTimeout,clearTimeout,Date,Math,Promise};
context.globalThis=context;
vm.createContext(context);
for(const file of ['hash.js','test-runtime.js'])vm.runInContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),context,{filename:file});
const runtime=context.closedLoopTestRuntime;
assert.ok(runtime,'runtime must load');

const artifact=(id,value)=>{const bytes=value instanceof Uint8Array?value:new TextEncoder().encode(value);return {artifactId:id,filename:`${id}.txt`,bytes,byteSize:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex')};};
const canonicalInput=async(canonicalKey,value)=>({canonicalKey,value,valueSha256:await runtime.sha256Canonical(value)});
const test=(spec,bindings={PRODUCT:{kind:'ARTIFACT',artifactId:'ART-PRODUCT'}})=>({
  TEST_ID:'TEST-1',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',
  EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:spec,EXECUTABLE_INPUT_BINDINGS:bindings
});
const spec=steps=>({version:'closed-loop-test-spec/1',steps});

assert.equal(runtime.SPEC_VERSION,'closed-loop-test-spec/1');
assert.equal(runtime.EXECUTABLE_KIND,'TEST_IR');
assert.equal(runtime.workerUrl(),`test-worker.js?v=${runtime.BUILD_IDENTITY}`,'worker URL must retain the exact shared build/cache identity after script evaluation');
assert.equal(runtime.supports(test(spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:'x'}]))),true);
assert.equal(runtime.supports({...test(spec([{op:'ASSERT_EQ',value:1}]),{}),EXECUTABLE_KIND:'CUSTOM_PIPELINE'}),false);

for(const operation of [
  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML',
  'COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE',
  'ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'
])assert.ok(runtime.OPS.includes(operation),`missing operation ${operation}`);

const unknown=runtime.validateSpec(spec([{op:'SHELL',command:'rm -rf /'},{op:'ASSERT_EQ',value:true}]));
assert.equal(unknown.valid,false);assert.match(unknown.issues.join(' '),/unknown operation/i);
const unknownProperty=runtime.validateSpec(spec([{op:'ASSERT_EQ',value:true,javascript:'return true'}]));
assert.equal(unknownProperty.valid,false);assert.match(unknownProperty.issues.join(' '),/unknown property javascript/i);
const wrongVersion=runtime.validateSpec({version:'closed-loop-test-spec/2',steps:[{op:'ASSERT_EQ',value:true}]});
assert.equal(wrongVersion.valid,false);
const noAssertion=runtime.validateSpec(spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'}]));
assert.equal(noAssertion.valid,false);assert.match(noAssertion.issues.join(' '),/assertion/i);

const jsonSpec=spec([
  {op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_JSON'},
  {op:'SELECT_JSON_PATH',path:'$.items'},{op:'COUNT'},{op:'ASSERT_EQ',value:10}
]);
const jsonResult=await runtime.execute({spec:jsonSpec,artifacts:{PRODUCT:artifact('ART-PRODUCT',JSON.stringify({items:Array(10).fill(0)}))},metadata:{testId:'TEST-JSON',bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-PRODUCT'}}}});
assert.equal(jsonResult.determination,'SATISFIED');
assert.equal(jsonResult.testId,'TEST-JSON');
await assert.rejects(
  ()=>runtime.execute({spec:jsonSpec,artifacts:{PRODUCT:artifact('ART-DUPLICATE-JSON','{"items":[],"items":[]}')},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-DUPLICATE-JSON'}}}}),
  error=>error.code==='DUPLICATE_JSON_MEMBER',
  'PARSE_JSON must reject duplicate object members before JSON.parse can erase the ambiguity'
);
await assert.rejects(
  ()=>runtime.execute({spec:jsonSpec,artifacts:{PRODUCT:artifact('ART-UNSAFE-JSON-NUMBER','{"items":[0.1]}')},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-UNSAFE-JSON-NUMBER'}}}}),
  error=>error.code==='UNSUPPORTED_NUMERIC_PRECISION',
  'PARSE_JSON must reject non-safe numeric tokens rather than round through Number'
);
assert.equal(jsonResult.inputArtifactIds[0],'ART-PRODUCT');
assert.match(jsonResult.inputArtifactSha256Values[0],/^[0-9a-f]{64}$/);
assert.match(jsonResult.testSpecSha256,/^[0-9a-f]{64}$/);

const csvWithoutContract=runtime.validateSpec(spec([
  {op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_CSV'},{op:'COUNT'},{op:'ASSERT_EQ',value:1}
]));
assert.equal(csvWithoutContract.valid,false);assert.match(csvWithoutContract.issues.join(' '),/delimiter/);assert.match(csvWithoutContract.issues.join(' '),/header/);assert.match(csvWithoutContract.issues.join(' '),/newline/);
const csvSpec=spec([
  {op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},
  {op:'PARSE_CSV',delimiter:';',header:true,quote:'"',quoteEscaping:'DOUBLE_QUOTE',newline:'LF',emptyLinePolicy:'KEEP',columnCountPolicy:'STRICT',encoding:'UTF-8'},
  {op:'COUNT'},{op:'ASSERT_EQ',value:2}
]);
const csvResult=await runtime.execute({spec:csvSpec,artifacts:{PRODUCT:artifact('ART-CSV','name;value\na;1\nb;2\n')},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-CSV'}}}});
assert.equal(csvResult.determination,'SATISFIED');

const xmlSpec=spec([
  {op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_XML'},
  {op:'SELECT_XML',path:'/root/item'},{op:'COUNT'},{op:'ASSERT_EQ',value:2}
]);
const xmlResult=await runtime.execute({spec:xmlSpec,artifacts:{PRODUCT:artifact('ART-XML','<root><item id="1">a</item><item id="2">b</item></root>')},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-XML'}}}});
assert.equal(xmlResult.determination,'SATISFIED');
assert.equal(runtime.validateSpec(spec([{op:'PARSE_XML'},{op:'SELECT_XML',path:'//item'},{op:'ASSERT_EQ',value:1}])).valid,false);
const xmlPrototypeSpec=spec([
  {op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_XML'},
  {op:'SELECT_XML',path:'/root/@__proto__'},{op:'ASSERT_CONTAINS',value:'safe'}
]);
const xmlPrototypeResult=await runtime.execute({spec:xmlPrototypeSpec,artifacts:{PRODUCT:artifact('ART-XML-PROTOTYPE','<root __proto__="safe"/>')},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-XML-PROTOTYPE'}}}});
assert.equal(xmlPrototypeResult.determination,'SATISFIED','XML attribute names must not mutate or resolve through Object.prototype');

const byteBindings={LEFT:{kind:'ARTIFACT',artifactId:'ART-L'},RIGHT:{kind:'ARTIFACT',artifactId:'ART-R'}};
const byteSpec=spec([{op:'LOAD_ARTIFACT',binding:'LEFT'},{op:'READ_BYTES'},{op:'BYTE_COMPARE',binding:'RIGHT'},{op:'ASSERT_EQ',value:true}]);
const equalBytes=await runtime.execute({spec:byteSpec,artifacts:{LEFT:artifact('ART-L','same'),RIGHT:artifact('ART-R','same')},metadata:{bindings:byteBindings}});
assert.equal(equalBytes.determination,'SATISFIED');
const unequalBytes=await runtime.execute({spec:byteSpec,artifacts:{LEFT:artifact('ART-L','same'),RIGHT:artifact('ART-R','different')},metadata:{bindings:byteBindings}});
assert.equal(unequalBytes.determination,'VIOLATED');

const integer=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'SUM'},{op:'ASSERT_EQ',value:6}]),canonicalBindings:{VALUES:await canonicalInput('VALUES',[1,2,3])},metadata:{bindings:{VALUES:{kind:'CANONICAL_VALUE',canonicalKey:'VALUES'}}}});
assert.equal(integer.determination,'SATISFIED');
const unsafeEquality=runtime.validateSpec(spec([{op:'ASSERT_EQ',value:0.1}]));
assert.equal(unsafeEquality.valid,false);assert.match(unsafeEquality.issues.join(' '),/safe integer|canonical/i);
const typedPointThree={numberType:'DECIMAL',value:'0.3'};
const missingTolerance=runtime.validateSpec(spec([{op:'ASSERT_EQ',value:typedPointThree,numericMode:'APPROXIMATE'}]));
assert.equal(missingTolerance.valid,false);assert.match(missingTolerance.issues.join(' '),/tolerance/i);
const approximateValue={numberType:'DECIMAL',value:'0.30000000000000004'};
const canonicalApproximateSpec=spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:typedPointThree,numericMode:'APPROXIMATE',absTol:{numberType:'DECIMAL',value:'0.000000000001'}}]);
const approximate=await runtime.execute({spec:canonicalApproximateSpec,canonicalBindings:{VALUE:await canonicalInput('VALUE',approximateValue)},metadata:{bindings:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}});
assert.equal(approximate.determination,'SATISFIED');
const decimalStringApproximateSpec=spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:typedPointThree,numericMode:'APPROXIMATE',absTol:'0.000000000001'}]);
assert.deepEqual(runtime.normalizeSpec(decimalStringApproximateSpec),runtime.normalizeSpec(canonicalApproximateSpec),'exact-decimal tolerance authoring text must compile to the typed canonical Test IR form');
const compatibilityApproximateSpec=spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:typedPointThree,numericMode:'APPROXIMATE',absoluteTolerance:{numberType:'DECIMAL',value:'0.000000000001'}}]);
assert.deepEqual(runtime.normalizeSpec(compatibilityApproximateSpec),runtime.normalizeSpec(canonicalApproximateSpec),'compatibility tolerance spelling must normalize to one canonical Test IR');
const duplicateToleranceAliases=runtime.validateSpec(spec([{op:'ASSERT_EQ',value:typedPointThree,numericMode:'APPROXIMATE',absTol:{numberType:'DECIMAL',value:'0.1'},absoluteTolerance:{numberType:'DECIMAL',value:'0.1'}}]));
assert.equal(duplicateToleranceAliases.valid,false);assert.match(duplicateToleranceAliases.issues.join(' '),/both absTol and its compatibility alias/i);
const nonDecimalTolerance=runtime.validateSpec(spec([{op:'ASSERT_EQ',value:typedPointThree,numericMode:'APPROXIMATE',absTol:1}]));
assert.equal(nonDecimalTolerance.valid,false,'approximate tolerance accepted a non-DECIMAL value');
for(const invalidTolerance of ['-0','1e-3','+0.1','01'])assert.equal(runtime.validateSpec(spec([{op:'ASSERT_EQ',value:typedPointThree,numericMode:'APPROXIMATE',absTol:invalidTolerance}])).valid,false,`approximate tolerance accepted noncanonical decimal text ${invalidTolerance}`);
const nearZero={numberType:'DECIMAL',value:'0.0001'},zero={numberType:'DECIMAL',value:'0'},nearZeroResult=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:zero,numericMode:'APPROXIMATE',absTol:{numberType:'DECIMAL',value:'0.0001'}}]),canonicalBindings:{VALUE:await canonicalInput('VALUE',nearZero)},metadata:{bindings:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}});
assert.equal(nearZeroResult.determination,'SATISFIED','absolute tolerance boundary around zero was not inclusive');
const outsideZero={numberType:'DECIMAL',value:'0.0001001'},outsideZeroResult=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:zero,numericMode:'APPROXIMATE',absTol:{numberType:'DECIMAL',value:'0.0001'}}]),canonicalBindings:{VALUE:await canonicalInput('VALUE',outsideZero)},metadata:{bindings:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}});
assert.equal(outsideZeroResult.determination,'VIOLATED','absolute tolerance accepted a value outside the exact boundary');
const largeExpected={numberType:'DECIMAL',value:'100000000000000000000'},largeActual={numberType:'DECIMAL',value:'100000000000000000001'},largeRelativeResult=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:largeExpected,numericMode:'APPROXIMATE',relTol:'0.00000000000000000001'}]),canonicalBindings:{VALUE:await canonicalInput('VALUE',largeActual)},metadata:{bindings:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}});
assert.equal(largeRelativeResult.determination,'SATISFIED','relative tolerance at a large magnitude did not use exact decimal arithmetic');
const decimalValue={numberType:'DECIMAL',value:'1.23'};
const decimal=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:{numberType:'DECIMAL',value:'1.2300'},numericMode:'DECIMAL_STRING'}]),canonicalBindings:{VALUE:await canonicalInput('VALUE',decimalValue)},metadata:{bindings:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}});
assert.equal(decimal.determination,'SATISFIED');
const scalarSortInput=['\u{10000}','\ue000'];
const scalarSortSpec=spec([{op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'SORT',valueType:'STRING'},{op:'ASSERT_EQ',value:['\ue000','\u{10000}']}]);
const scalarSorted=await runtime.execute({spec:scalarSortSpec,canonicalBindings:{VALUES:await canonicalInput('VALUES',scalarSortInput)},metadata:{bindings:{VALUES:{kind:'CANONICAL_VALUE',canonicalKey:'VALUES'}}}});
assert.equal(scalarSorted.determination,'SATISFIED','SORT STRING must use unsigned Unicode scalar-value ordering rather than locale or UTF-16 ordering');
const orderedTolerance=runtime.validateSpec(spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'COMPARE',operator:'GT',value:typedPointThree,numericMode:'APPROXIMATE',absTol:{numberType:'DECIMAL',value:'0.01'}},{op:'ASSERT_EQ',value:true}]),{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}});
assert.equal(orderedTolerance.valid,false);assert.match(orderedTolerance.issues.join(' '),/only for EQ or NE/i);

const dangerousRegex=runtime.validateSpec(spec([{op:'ASSERT_MATCH',pattern:'(a+)+$',flags:''}]));
assert.equal(dangerousRegex.valid,false);assert.match(dangerousRegex.issues.join(' '),/grouping/);
const legacyOctalRegex=runtime.validateSpec(spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_MATCH',pattern:'\\01'}]),{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}});
assert.equal(legacyOctalRegex.valid,false);assert.match(legacyOctalRegex.issues.join(' '),/legacy-octal/i);
const hugeRegex='a'.repeat(runtime.LIMITS.maxRegexPatternBytes+1);
assert.equal(runtime.validateSpec(spec([{op:'ASSERT_MATCH',pattern:hugeRegex}])).valid,false);
const tooManySteps=spec(Array(runtime.LIMITS.maxSteps+1).fill(null).map(()=>({op:'ASSERT_EQ',value:true})));
assert.equal(runtime.validateSpec(tooManySteps).valid,false);

const normalized=runtime.normalizeSpec(jsonSpec);
const hashA=await runtime.sha256Canonical(normalized);
const hashB=await runtime.sha256Canonical(runtime.normalizeSpec(JSON.parse(JSON.stringify(jsonSpec))));
assert.equal(hashA,hashB,'normalized Test IR hash must be stable');
const changed=JSON.parse(JSON.stringify(jsonSpec));changed.steps.at(-1).value=11;
assert.notEqual(hashA,await runtime.sha256Canonical(runtime.normalizeSpec(changed)),'semantic Test IR change must change the hash');

const invalidUtf8=new Uint8Array([0xc3,0x28]);
await assert.rejects(()=>runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:'x'}]),artifacts:{PRODUCT:artifact('ART-BAD',invalidUtf8)},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-BAD'}}}}),error=>error.code==='INVALID_UTF8'&&error.disposition==='UNDETERMINED');

class SilentWorker{
  postMessage(){}
  terminate(){this.terminated=true;}
}
const timeoutResult=await runtime.executeTest(test(jsonSpec),{PRODUCT:artifact('ART-PRODUCT','{}')},{},{Worker:SilentWorker,timeoutMs:5,workerUrl:'test-worker.js'});
assert.equal(timeoutResult.status,'EXECUTION_FAILED');
assert.equal(timeoutResult.failure.code,'WORKER_TIMEOUT');
assert.equal(timeoutResult.observations.length,0,'timeout must produce no partial result');

console.log(JSON.stringify({
  verifyTestRuntimeV3:'PASS',
  operations:runtime.OPS.length,
  inputLimit:runtime.LIMITS.maxTotalInputBytes,
  workerTimeoutMs:runtime.LIMITS.workerTimeoutMs,
  json:true,duplicateJsonMemberRejected:true,unsafeJsonNumberRejected:true,csv:true,xml:true,xmlPrototypeSafe:true,byteCompare:true,integerExact:true,approximateTolerance:true,unicodeScalarSort:true,orderedToleranceRejected:true,legacyOctalRegexRejected:true,
  unknownOperationRejected:true,unknownPropertyRejected:true,arbitraryCodeRejected:true,timeoutNoPartialResult:true
}));
