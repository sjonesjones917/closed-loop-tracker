import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const source=fs.readFileSync(new URL('./test-runtime.js',import.meta.url),'utf8');
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL,setTimeout,clearTimeout,Date,Math,Promise};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8'),context,{filename:'hash.js'});
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
const validTextSpec=spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:'x'}]);
assert.equal(runtime.supports(test(validTextSpec)),true);
assert.equal(runtime.supports({...test(validTextSpec),EXECUTABLE_KIND:'CUSTOM_PIPELINE'}),false);
const invalidSpecCases=[];
function rejectSpec(id,valid,change,reason){
  assert.equal(runtime.validateSpec(valid).valid,true,id+': repaired baseline is invalid');
  const invalid=structuredClone(valid);change(invalid);const result=runtime.validateSpec(invalid);
  assert.equal(result.valid,false,id+': deliberate violation accepted');assert.match(result.issues.join(' '),reason,id+': wrong rejection reason');
  assert.equal(runtime.validateSpec(valid).valid,true,id+': corrected spec did not validate');
  invalidSpecCases.push({id,result:'PASS',specificRejection:true,repaired:true});
}

for(const operation of [
  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML',
  'COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE',
  'ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'
])assert.ok(runtime.OPS.includes(operation),`missing operation ${operation}`);

rejectSpec('unknown-operation',validTextSpec,value=>{value.steps[0].op='SHELL';},/unknown operation/i);
rejectSpec('unknown-property',validTextSpec,value=>{value.steps.at(-1).javascript='return true';},/unknown property javascript/i);
rejectSpec('wrong-version',validTextSpec,value=>{value.version='closed-loop-test-spec/2';},/version/i);
rejectSpec('missing-assertion',validTextSpec,value=>{value.steps.pop();},/assertion/i);

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

const csvSpec=spec([
  {op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},
  {op:'PARSE_CSV',delimiter:';',header:true,quote:'"',newline:'LF',encoding:'UTF-8'},
  {op:'COUNT'},{op:'ASSERT_EQ',value:2}
]);
for(const field of ['delimiter','header','newline'])rejectSpec('csv-missing-'+field,csvSpec,value=>{delete value.steps[3][field];},new RegExp(field));
const csvResult=await runtime.execute({spec:csvSpec,artifacts:{PRODUCT:artifact('ART-CSV','name;value\na;1\nb;2\n')},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-CSV'}}}});
assert.equal(csvResult.determination,'SATISFIED');

const xmlSpec=spec([
  {op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_XML'},
  {op:'SELECT_XML',path:'/root/item'},{op:'COUNT'},{op:'ASSERT_EQ',value:2}
]);
const xmlResult=await runtime.execute({spec:xmlSpec,artifacts:{PRODUCT:artifact('ART-XML','<root><item id="1">a</item><item id="2">b</item></root>')},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-XML'}}}});
assert.equal(xmlResult.determination,'SATISFIED');
const xmlWildcardSpec=spec([
  {op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_XML'},
  {op:'SELECT_XML',path:'/root/*'},{op:'COUNT'},{op:'ASSERT_EQ',value:2}
]);
const xmlWildcardResult=await runtime.execute({spec:xmlWildcardSpec,artifacts:{PRODUCT:artifact('ART-XML-WILDCARD','<root><item>a</item><other>b</other></root>')},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-XML-WILDCARD'}}}});
assert.equal(xmlWildcardResult.determination,'SATISFIED','closed-loop-xml-selector/1 must support the element wildcard *');
rejectSpec('xml-descendant-selector',xmlSpec,value=>{value.steps[4].path='//item';},/XML selector|absolute path|descendant|unsupported/i);

const byteBindings={LEFT:{kind:'ARTIFACT',artifactId:'ART-L'},RIGHT:{kind:'ARTIFACT',artifactId:'ART-R'}};
const byteSpec=spec([{op:'LOAD_ARTIFACT',binding:'LEFT'},{op:'READ_BYTES'},{op:'BYTE_COMPARE',binding:'RIGHT'},{op:'ASSERT_EQ',value:true}]);
const equalBytes=await runtime.execute({spec:byteSpec,artifacts:{LEFT:artifact('ART-L','same'),RIGHT:artifact('ART-R','same')},metadata:{bindings:byteBindings}});
assert.equal(equalBytes.determination,'SATISFIED');
const unequalBytes=await runtime.execute({spec:byteSpec,artifacts:{LEFT:artifact('ART-L','same'),RIGHT:artifact('ART-R','different')},metadata:{bindings:byteBindings}});
assert.equal(unequalBytes.determination,'VIOLATED');

// Same-length unequal bytes must fail too; a length-only comparator passed the
// old two-case suite. Buffer.equals supplies a separate byte-equality oracle.
const byteCases=[];
async function checkBytes(api,left,right){
  const expected=Buffer.from(left).equals(Buffer.from(right));
  const result=await api.execute({spec:byteSpec,artifacts:{LEFT:{artifactId:'ART-L',bytes:left},RIGHT:{artifactId:'ART-R',bytes:right}},metadata:{bindings:byteBindings}});
  assert.equal(result.determination,expected?'SATISFIED':'VIOLATED','Actual byte equality must determine BYTE_COMPARE');
  return expected;
}
for(const length of [0,1,2,3,8,32,256,4096]){
  const left=Uint8Array.from({length},(_,index)=>(index*31+17)%256);
  await checkBytes(runtime,left,left.slice());byteCases.push({length,mutation:null,result:'PASS'});
  for(const position of [...new Set([0,Math.floor(length/2),length-1])].filter(index=>index>=0&&index<length)){
    const right=left.slice();right[position]^=1;await checkBytes(runtime,left,right);byteCases.push({length,mutation:position,result:'PASS'});
  }
}
const comparisonGuard='if(left[i]!==right[i])';assert.equal(source.split(comparisonGuard).length,2);
const lengthOnlyContext=vm.createContext({console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL,setTimeout,clearTimeout,Date,Math,Promise});
vm.runInContext(fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8'),lengthOnlyContext);
vm.runInContext(source.replace(comparisonGuard,'if(false)'),lengthOnlyContext);
await assert.rejects(()=>checkBytes(lengthOnlyContext.closedLoopTestRuntime,new Uint8Array([0,1]),new Uint8Array([0,2])),/Actual byte equality/);
await checkBytes(runtime,new Uint8Array([0,1]),new Uint8Array([0,2]));await checkBytes(runtime,new Uint8Array([0,1]),new Uint8Array([0,1]));

const integer=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'SUM'},{op:'ASSERT_EQ',value:6}]),canonicalBindings:{VALUES:{value:[1,2,3]}},metadata:{bindings:{VALUES:{kind:'CANONICAL_VALUE',canonicalKey:'VALUES'}}}});
assert.equal(integer.determination,'SATISFIED');
const numericControl=spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:1}]);
rejectSpec('untyped-fractional-number',numericControl,value=>{value.steps[1].value=0.1;},/typed DECIMAL/i);
const approximateControl=spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:{numberType:'DECIMAL',value:'0.1'},numericMode:'APPROXIMATE',absTol:'0.001'}]);
rejectSpec('approximate-without-tolerance',approximateControl,value=>{delete value.steps[1].absTol;},/tolerance/i);
const approximate=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:{numberType:'DECIMAL',value:'0.3'},numericMode:'APPROXIMATE',absTol:'0.000000000001'}]),canonicalBindings:{VALUE:{value:{numberType:'DECIMAL',value:'0.30000000000000004'}}},metadata:{bindings:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}});
assert.equal(approximate.determination,'SATISFIED');
const decimal=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:'1.2300',numericMode:'DECIMAL_STRING'}]),canonicalBindings:{VALUE:{value:'1.23'}},metadata:{bindings:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}});
assert.equal(decimal.determination,'SATISFIED');
const sortSpec=spec([{op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'SORT',domain:'STRING'},{op:'ASSERT_EQ',value:['','𐀀']}]);
const sorted=await runtime.execute({spec:sortSpec,canonicalBindings:{VALUES:{value:['𐀀','']}},metadata:{bindings:{VALUES:{kind:'CANONICAL_VALUE',canonicalKey:'VALUES'}}}});
assert.equal(sorted.determination,'SATISFIED');

const dangerousRegex=runtime.validateSpec(spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_MATCH',pattern:'(a+)+$',flags:''}]));
assert.equal(dangerousRegex.valid,false);assert.match(dangerousRegex.issues.join(' '),/nested unbounded quantification|safe subset/i);
assert.equal(runtime.validateRegex('(ab)+').length,0);
assert.equal(runtime.validateRegex('(?:ab)+').length,0);
assert.ok(runtime.validateRegex('(?=ab)').length>0);
const regexControl=spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_MATCH',pattern:'x'}]);
rejectSpec('regex-byte-limit',regexControl,value=>{value.steps[1].pattern='a'.repeat(runtime.LIMITS.maxRegexPatternBytes+1);},/registered byte limit/i);
const stepLimitControl=spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},...Array.from({length:runtime.LIMITS.maxSteps-1},()=>({op:'ASSERT_EQ',value:true}))]);
rejectSpec('step-limit',stepLimitControl,value=>{value.steps.push({op:'ASSERT_EQ',value:true});},/step limit/i);

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
const timeoutResult=await runtime.executeTest(test(jsonSpec),{PRODUCT:artifact('ART-PRODUCT','{}')},{},{Worker:SilentWorker,timeoutMs:5,workerUrl:'test-worker.js'});
assert.equal(timeoutResult.status,'EXECUTION_FAILED');
assert.equal(timeoutResult.failure.code,'WORKER_TIMEOUT');
assert.equal(timeoutResult.observations.length,0,'timeout must produce no partial result');

console.log(JSON.stringify({
  verifyTestRuntimeV3:'PASS',invalidSpecCases,byteCases,lengthOnlyComparatorFaultDetected:true,
  operations:runtime.OPS.length,
  inputLimit:runtime.LIMITS.maxTotalInputBytes,
  workerTimeoutMs:runtime.LIMITS.workerTimeoutMs,
  json:true,csv:true,xml:true,xmlWildcard:true,byteCompare:true,integerExact:true,approximateTolerance:true,
  unknownOperationRejected:true,unknownPropertyRejected:true,arbitraryCodeRejected:true,timeoutNoPartialResult:true
}));
