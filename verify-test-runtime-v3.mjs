import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const source=fs.readFileSync(new URL('./test-runtime.js',import.meta.url),'utf8');
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL,setTimeout,clearTimeout,Date,Math,Promise};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'test-runtime.js'});
const runtime=context.closedLoopTestRuntime;
assert.ok(runtime,'runtime must load');

const artifact=(id,text)=>({artifactId:id,filename:`${id}.txt`,bytes:new TextEncoder().encode(text)});
const test=(spec,bindings={PRODUCT:{kind:'ARTIFACT',artifactId:'ART-PRODUCT'}})=>({
  TEST_ID:'TEST-1',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',
  EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:spec,EXECUTABLE_INPUT_BINDINGS:bindings
});
const spec=steps=>({version:'closed-loop-test-spec/1',steps});

assert.equal(runtime.SPEC_VERSION,'closed-loop-test-spec/1');
assert.equal(runtime.EXECUTABLE_KIND,'TEST_IR');
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
await assert.rejects(()=>runtime.execute({spec:jsonSpec,artifacts:{PRODUCT:artifact('ART-DUP','{\"a\":1,\"a\":2}')},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-DUP'}}}}),error=>error.code==='DUPLICATE_JSON_MEMBER');
await assert.rejects(()=>runtime.execute({spec:jsonSpec,artifacts:{PRODUCT:artifact('ART-DECIMAL','{\"items\":[0.1]}')},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-DECIMAL'}}}}),error=>error.code==='UNSUPPORTED_JSON_NUMBER');

assert.equal(jsonResult.inputArtifactIds[0],'ART-PRODUCT');
assert.match(jsonResult.inputArtifactSha256Values[0],/^[0-9a-f]{64}$/);
assert.match(jsonResult.testSpecSha256,/^[0-9a-f]{64}$/);

const csvWithoutContract=runtime.validateSpec(spec([
  {op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_CSV'},{op:'COUNT'},{op:'ASSERT_EQ',value:1}
]));
assert.equal(csvWithoutContract.valid,false);assert.match(csvWithoutContract.issues.join(' '),/delimiter/);assert.match(csvWithoutContract.issues.join(' '),/header/);assert.match(csvWithoutContract.issues.join(' '),/newline/);
const csvSpec=spec([
  {op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},
  {op:'PARSE_CSV',delimiter:';',header:true,quote:'"',newline:'LF',encoding:'UTF-8'},
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

const byteBindings={LEFT:{kind:'ARTIFACT',artifactId:'ART-L'},RIGHT:{kind:'ARTIFACT',artifactId:'ART-R'}};
const byteSpec=spec([{op:'LOAD_ARTIFACT',binding:'LEFT'},{op:'READ_BYTES'},{op:'BYTE_COMPARE',binding:'RIGHT'},{op:'ASSERT_EQ',value:true}]);
const equalBytes=await runtime.execute({spec:byteSpec,artifacts:{LEFT:artifact('ART-L','same'),RIGHT:artifact('ART-R','same')},metadata:{bindings:byteBindings}});
assert.equal(equalBytes.determination,'SATISFIED');
const unequalBytes=await runtime.execute({spec:byteSpec,artifacts:{LEFT:artifact('ART-L','same'),RIGHT:artifact('ART-R','different')},metadata:{bindings:byteBindings}});
assert.equal(unequalBytes.determination,'VIOLATED');

const integer=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'SUM'},{op:'ASSERT_EQ',value:6}]),canonicalBindings:{VALUES:{value:[1,2,3]}},metadata:{bindings:{VALUES:{kind:'CANONICAL_VALUE',canonicalKey:'VALUES'}}}});
assert.equal(integer.determination,'SATISFIED');
const unsafeEquality=runtime.validateSpec(spec([{op:'ASSERT_EQ',value:0.1}]));
assert.equal(unsafeEquality.valid,false);assert.match(unsafeEquality.issues.join(' '),/typed DECIMAL/i);
const missingTolerance=runtime.validateSpec(spec([{op:'ASSERT_EQ',value:{numberType:'DECIMAL',value:'0.1'},numericMode:'APPROXIMATE'}]));
assert.equal(missingTolerance.valid,false);assert.match(missingTolerance.issues.join(' '),/tolerance/i);
const approximate=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:{numberType:'DECIMAL',value:'0.3'},numericMode:'APPROXIMATE',absTol:'0.000000000001'}]),canonicalBindings:{VALUE:{value:{numberType:'DECIMAL',value:'0.30000000000000004'}}},metadata:{bindings:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}});
assert.equal(approximate.determination,'SATISFIED');
const decimal=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:'1.2300',numericMode:'DECIMAL_STRING'}]),canonicalBindings:{VALUE:{value:'1.23'}},metadata:{bindings:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}});
assert.equal(decimal.determination,'SATISFIED');
const sortSpec=spec([{op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'SORT',domain:'STRING'},{op:'ASSERT_EQ',value:['','𐀀']}]);
const sorted=await runtime.execute({spec:sortSpec,canonicalBindings:{VALUES:{value:['𐀀','']}},metadata:{bindings:{VALUES:{kind:'CANONICAL_VALUE',canonicalKey:'VALUES'}}}});
assert.equal(sorted.determination,'SATISFIED');


const dangerousRegex=runtime.validateSpec(spec([{op:'ASSERT_MATCH',pattern:'(a+)+$',flags:''}]));
assert.equal(dangerousRegex.valid,false);assert.match(dangerousRegex.issues.join(' '),/grouping/);
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
await assert.rejects(()=>runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:'x'}]),artifacts:{PRODUCT:{artifactId:'ART-BAD',bytes:invalidUtf8}},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-BAD'}}}}),error=>error.code==='INVALID_UTF8'&&error.disposition==='UNDETERMINED');

class SilentWorker{
  postMessage(){}
  terminate(){this.terminated=true;}
}
const timeoutResult=await runtime.executeTest(test(jsonSpec),{PRODUCT:artifact('ART-PRODUCT','{}')},{},{Worker:SilentWorker,timeoutMs:5,workerUrl:'test-worker.js',testWorkerSha256:'0'.repeat(64)});
assert.equal(timeoutResult.status,'EXECUTION_FAILED');
assert.equal(timeoutResult.failure.code,'WORKER_TIMEOUT');
assert.equal(timeoutResult.observations.length,0,'timeout must produce no partial result');

console.log(JSON.stringify({
  verifyTestRuntimeV3:'PASS',
  operations:runtime.OPS.length,
  inputLimit:runtime.LIMITS.maxTotalInputBytes,
  workerTimeoutMs:runtime.LIMITS.workerTimeoutMs,
  json:true,csv:true,xml:true,byteCompare:true,integerExact:true,approximateTolerance:true,
  unknownOperationRejected:true,unknownPropertyRejected:true,arbitraryCodeRejected:true,timeoutNoPartialResult:true
}));
