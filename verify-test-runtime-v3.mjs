import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {testIrLimitFixtures} from './test-fixtures.mjs';
import {verifyOperationRegistryAdmission,verifyTestIrDiagnosticBounds} from './test-runtime-operation-registry.mjs';
import {verifyTestIrProducerContract} from './test-test-ir-producer-contract.mjs';
import {verifyTestIrNativeIdentity} from './test-test-ir-native-identity.mjs';
import {verifyTestIrNativeRecovery} from './test-test-ir-native-recovery.mjs';

const source=fs.readFileSync(new URL('./test-runtime.js',import.meta.url),'utf8');
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL,setTimeout,clearTimeout,Date,Math,Promise};
context.globalThis=context;
createVerifierRuntime(context);
vm.runInContext(fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8'),context,{filename:'hash.js'});
vm.runInContext(source,context,{filename:'test-runtime.js'});
const runtime=context.closedLoopTestRuntime;
assert.ok(runtime,'runtime must load');

async function verifyIntegerBoundaryContract(runtime){
 const observations=[],bindings={VALUES:{kind:'CANONICAL_VALUE',canonicalKey:'VALUES'}};
 const execution=(op,values,expected)=>runtime.execute({spec:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'VALUES'},{op},{op:'ASSERT_EQ',value:expected}]},canonicalBindings:{VALUES:{value:values}},metadata:{testId:'SYNTHETIC-EXACT-INTEGER',bindings}});
 // Literal expected values derive from the safe-integer contract, independently
 // of the runtime arithmetic implementation and its exported limit constants.
 for(const [caseId,op,values,expected]of [
  ['sum-positive-boundary','SUM',[9007199254740990,1],9007199254740991],
  ['sum-negative-boundary','SUM',[-9007199254740990,-1],-9007199254740991],
  ['sum-exact-cancellation','SUM',[9007199254740991,-9007199254740991,7],7],
  ['minimum-boundary','MIN',[9007199254740991,-9007199254740991,0],-9007199254740991],
  ['maximum-boundary','MAX',[-9007199254740991,9007199254740991,0],9007199254740991],
  ['count-exact','COUNT',[-9007199254740991,9007199254740991,0],3]
 ]){const actual=await execution(op,values,expected);assert.equal(actual.determination,'SATISFIED','TEST_IR_INTEGER_BOUNDARY_ORACLE: '+caseId);assert.equal(actual.actual,expected,'TEST_IR_INTEGER_EXACT_VALUE_ORACLE: '+caseId);observations.push({caseId,op,expected,actual:actual.actual,determination:actual.determination});}
 for(const [caseId,op,values,code]of [
  ['sum-positive-overflow','SUM',[9007199254740991,1],'INTEGER_OVERFLOW'],
  ['sum-negative-overflow','SUM',[-9007199254740991,-1],'INTEGER_OVERFLOW'],
  ['sum-overflow-before-cancellation','SUM',[9007199254740991,1,-1],'INTEGER_OVERFLOW'],
  ['unsupported-integer-text-sum-input','SUM',['9007199254740992'],'UNSUPPORTED_NUMERIC_PRECISION'],
  ['decimal-minimum-input','MIN',[{numberType:'DECIMAL',value:'0.1'}],'UNSUPPORTED_NUMERIC_PRECISION'],
  ['decimal-maximum-input','MAX',[{numberType:'DECIMAL',value:'0.1'}],'UNSUPPORTED_NUMERIC_PRECISION']
 ]){let failure;await assert.rejects(()=>execution(op,values,0),error=>{failure=error;return error.code===code&&error.disposition==='UNDETERMINED';},'TEST_IR_INTEGER_REJECTION_ORACLE: '+caseId);observations.push({caseId,op,code:failure.code,disposition:failure.disposition,rejected:true});}
 const restored=await execution('SUM',[9007199254740990,1],9007199254740991);assert.equal(restored.determination,'SATISFIED','TEST_IR_INTEGER_RESTORED_CONTROL_ORACLE');
 return {checkId:'test-ir.exact-integer-boundaries',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:1927'],boundary:'Production Test IR execution with explicit immutable canonical bindings; no project commit or worker responsiveness claim',expected:{conforming:6,rejected:6,restoredControl:true},observed:{conforming:observations.filter(row=>!row.rejected).length,rejected:observations.filter(row=>row.rejected).length,restoredControl:restored.determination==='SATISFIED'},cases:observations,passed:true};
}
async function verifyLiteralRuntimeBoundaries(runtime){
 const cases=[],plain=value=>JSON.parse(JSON.stringify(value)),literal=value=>({literal:value});
 const base={version:'closed-loop-test-spec/1',languageVersion:'closed-loop-test-ir-language/1',operationRegistryVersion:'closed-loop-test-ir-operations/1',operationRegistrySha256:runtime.OPERATION_REGISTRY_SHA256};
 const dag=(steps)=>({...base,steps:steps.map((step,index)=>({stepId:'S'+String(index+1).padStart(3,'0'),...step})),result:{stepRef:'S'+String(steps.length).padStart(3,'0'),output:'assertion'}});
 const eq=(actual,expected,extra={})=>({op:'ASSERT_EQ',inputs:{actual,expected:literal(expected),...extra}}),ref=(stepRef,output)=>({stepRef,output});
 async function outcome(caseId,spec,expectedActual,expectedDetermination='SATISFIED'){
  const result=await runtime.execute({spec,metadata:{bindings:{}}});
  assert.equal(result.determination,expectedDetermination,'TEST_IR_LITERAL_CONTRACT_ORACLE: '+caseId);
  assert.deepEqual(plain(result.actual),expectedActual,'TEST_IR_LITERAL_VALUE_ORACLE: '+caseId);
  cases.push({caseId,result:'PASS',determination:result.determination,actual:plain(result.actual)});
 }
 // §21.6 literal expected output establishes root, array order, and per-parent
 // 1-based XML indexing independently of the selector implementation.
 for(const [caseId,parser,text,selector,path,expected]of [
  ['json-root','PARSE_JSON','{"answer":7}','SELECT_JSON_PATH','$',{answer:7}],
  ['json-array-wildcard-document-order','PARSE_JSON','[3,1,2]','SELECT_JSON_PATH','$[*]',[3,1,2]],
  ['xml-one-based-second-element','PARSE_XML','<r><x>A</x><x>B</x><x>C</x></r>','SELECT_XML','/r/x[2]/text()',['B']],
  ['xml-position-is-per-parent','PARSE_XML','<r><p><x>A</x><x>B</x></p><p><x>C</x><x>D</x></p></r>','SELECT_XML','/r/p/x[2]/text()',['B','D']]
 ])await outcome(caseId,dag([{op:parser,inputs:{text:literal(text)}},{op:selector,inputs:{value:ref('S001','value'),path:literal(path)}},eq(ref('S002','selection'),expected)]),expected);
 // §21.7 explicitly bound CR/CRLF/AUTO semantics and mismatched bytes.
 const csv=(text,newline)=>dag([{op:'PARSE_CSV',inputs:{text:literal(text),delimiter:literal(','),header:literal(false),quote:literal('"'),newline:literal(newline),encoding:literal('UTF-8')}},eq(ref('S001','value'),[['a'],['b']])]);
 for(const [caseId,text,newline]of [['csv-cr','a\rb','CR'],['csv-crlf','a\r\nb','CRLF'],['csv-auto-crlf','a\r\nb','AUTO']])await outcome(caseId,csv(text,newline),[['a'],['b']]);
 for(const [caseId,text,newline]of [['csv-cr-rejects-lf','a\nb','CR'],['csv-crlf-rejects-lf','a\nb','CRLF'],['csv-lf-rejects-crlf','a\r\nb','LF']]){
  await assert.rejects(()=>runtime.execute({spec:csv(text,newline),metadata:{bindings:{}}}),error=>error.code==='MALFORMED_CSV'&&error.message==='CSV newline does not match the explicit newline contract.','TEST_IR_LITERAL_CONTRACT_ORACLE: '+caseId);
  cases.push({caseId,result:'PASS',code:'MALFORMED_CSV'});
 }
 // §21.10 relative tolerance scales by max magnitude and combines with
 // absolute tolerance using max, never their sum; expected outcomes are literal.
 for(const [caseId,actual,expected,settings,determination]of [
  ['relative-tolerance-inside','110','100',{relTol:'0.1'},'SATISFIED'],
  ['relative-tolerance-outside','112','100',{relTol:'0.1'},'VIOLATED'],
  ['combined-relative-dominates','110','100',{absTol:'1',relTol:'0.1'},'SATISFIED'],
  ['combined-not-summed','112','100',{absTol:'1',relTol:'0.1'},'VIOLATED'],
  ['combined-absolute-boundary','120','100',{absTol:'20',relTol:'0.01'},'SATISFIED'],
  ['combined-absolute-outside','121','100',{absTol:'20',relTol:'0.01'},'VIOLATED']
 ])await outcome(caseId,dag([eq(literal(actual),expected,{numericMode:literal('APPROXIMATE'),...Object.fromEntries(Object.entries(settings).map(([key,value])=>[key,literal(value)]))})]),actual,determination);
 return {checkId:'test-ir.literal-contract-boundaries',passed:true,synthetic:true,actualBrowser:false,cases,boundary:'Production normalized DAG execution; literal selector/newline/tolerance outcomes only, no ingestion/storage/browser or whole-clause conformance claim',requirementRefs:['NREQ-da451a908ba4a4b028e03107ca54afb2','NREQ-ff6c454e36be6ed2e78201186509c537','NREQ-b0df53c5bb2160c660a516acf260b6c7']};
}

if(process.argv.includes('--contract-boundaries-only')){console.log(JSON.stringify({verifyTestRuntimeContractBoundaries:'PASS',literalContractBoundaries:await verifyLiteralRuntimeBoundaries(runtime)}));process.exit(0);}
if(process.argv.includes('--numeric-only')){console.log(JSON.stringify({verifyTestRuntimeInteger:'PASS',verificationObservations:[await verifyIntegerBoundaryContract(runtime)]}));process.exit(0);}


const artifact=(id,text)=>({artifactId:id,filename:`${id}.txt`,bytes:new TextEncoder().encode(text)});
const test=(spec,bindings={PRODUCT:{kind:'ARTIFACT',artifactId:'ART-PRODUCT'}})=>({
  TEST_ID:'TEST-1',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',
  EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:spec,EXECUTABLE_INPUT_BINDINGS:bindings
});
const spec=steps=>({version:'closed-loop-test-spec/1',steps});
const scalarSpec=assertion=>spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},assertion]);
const scalarControl=scalarSpec({op:'ASSERT_EQ',value:true});
assert.equal(runtime.validateSpec(scalarControl).valid,true,'TEST_IR_SCALAR_CONTROL_ORACLE');
function rejectOnly(candidate,expected,oracle){
 const result=runtime.validateSpec(candidate);
 assert.equal(result.valid,false,oracle+': violation accepted');
 assert.ok(result.issues.length>0&&result.issues.every(issue=>expected.test(issue)),oracle+': unrelated rejection: '+JSON.stringify(result.issues));
 return result;
}

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
const unknownProperty=runtime.validateSpec(scalarSpec({op:'ASSERT_EQ',value:true,javascript:'return true'}));
assert.equal(unknownProperty.valid,false);assert.match(unknownProperty.issues.join(' '),/unknown property javascript/i);
rejectOnly({...scalarControl,version:'closed-loop-test-spec/2'},/Unsupported Test IR version/,'TEST_IR_VERSION_ORACLE');
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
const xmlWildcardSpec=spec([
  {op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_XML'},
  {op:'SELECT_XML',path:'/root/*'},{op:'COUNT'},{op:'ASSERT_EQ',value:2}
]);
const xmlWildcardResult=await runtime.execute({spec:xmlWildcardSpec,artifacts:{PRODUCT:artifact('ART-XML-WILDCARD','<root><item>a</item><other>b</other></root>')},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-XML-WILDCARD'}}}});
assert.equal(xmlWildcardResult.determination,'SATISFIED','closed-loop-xml-selector/1 must support the element wildcard *');
const unsupportedXmlPath=structuredClone(xmlSpec);unsupportedXmlPath.steps[4].path='//item';
assert.equal(runtime.validateSpec(xmlSpec).valid,true,'TEST_IR_XML_PATH_CONTROL_ORACLE');
rejectOnly(unsupportedXmlPath,/operation SELECT_XML has invalid path/,'TEST_IR_XML_PATH_ORACLE');

const byteBindings={LEFT:{kind:'ARTIFACT',artifactId:'ART-L'},RIGHT:{kind:'ARTIFACT',artifactId:'ART-R'}};
const byteSpec=spec([{op:'LOAD_ARTIFACT',binding:'LEFT'},{op:'READ_BYTES'},{op:'BYTE_COMPARE',binding:'RIGHT'},{op:'ASSERT_EQ',value:true}]);
const equalBytes=await runtime.execute({spec:byteSpec,artifacts:{LEFT:artifact('ART-L','same'),RIGHT:artifact('ART-R','same')},metadata:{bindings:byteBindings}});
assert.equal(equalBytes.determination,'SATISFIED');
const unequalBytes=await runtime.execute({spec:byteSpec,artifacts:{LEFT:artifact('ART-L','same'),RIGHT:artifact('ART-R','different')},metadata:{bindings:byteBindings}});
assert.equal(unequalBytes.determination,'VIOLATED');

const integer=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'SUM'},{op:'ASSERT_EQ',value:6}]),canonicalBindings:{VALUES:{value:[1,2,3]}},metadata:{bindings:{VALUES:{kind:'CANONICAL_VALUE',canonicalKey:'VALUES'}}}});
assert.equal(integer.determination,'SATISFIED');
const unsafeEquality=runtime.validateSpec(scalarSpec({op:'ASSERT_EQ',value:0.1}));
assert.equal(unsafeEquality.valid,false);assert.match(unsafeEquality.issues.join(' '),/typed DECIMAL/i);
const missingTolerance=runtime.validateSpec(scalarSpec({op:'ASSERT_EQ',value:{numberType:'DECIMAL',value:'0.1'},numericMode:'APPROXIMATE'}));
assert.equal(missingTolerance.valid,false);assert.match(missingTolerance.issues.join(' '),/tolerance/i);
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
const patternLimitCases=[];
for(const row of testIrLimitFixtures(runtime).filter(row=>row.caseId.startsWith('REGEX_PATTERN_'))){
 assert.equal(runtime.validateSpec(row.control).valid,true,'TEST_IR_LIMIT_'+row.caseId+'_CONTROL_ORACLE');
 rejectOnly(row.invalid,/Regex pattern exceeds the registered byte limit/,'TEST_IR_LIMIT_'+row.caseId+'_ORACLE');
 patternLimitCases.push({caseId:row.caseId,limit:row.limit,result:'PASS'});
}
const atStepLimit=spec([...Array.from({length:runtime.LIMITS.maxSteps-1},()=>({op:'LOAD_ARTIFACT',binding:'VALUE'})),{op:'ASSERT_EQ',value:true}]);
assert.equal(runtime.validateSpec(atStepLimit).valid,true,'TEST_IR_STEP_LIMIT_CONTROL_ORACLE');
const tooManySteps=structuredClone(atStepLimit);tooManySteps.steps.unshift({op:'LOAD_ARTIFACT',binding:'VALUE'});
rejectOnly(tooManySteps,new RegExp(`exceeds the ${runtime.LIMITS.maxSteps}-step limit`),'TEST_IR_STEP_LIMIT_ORACLE');
const stepLimitResult=await runtime.execute({spec:atStepLimit,canonicalBindings:{VALUE:{value:true}},metadata:{bindings:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}});
assert.equal(stepLimitResult.determination,'SATISFIED','TEST_IR_STEP_LIMIT_EXECUTION_ORACLE');

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

const literalContractBoundaries=await verifyLiteralRuntimeBoundaries(runtime);
const integerBoundaryContract=await verifyIntegerBoundaryContract(runtime);
const diagnosticBounds=verifyTestIrDiagnosticBounds(source,runtime);
const operationRegistryAdmission=await verifyOperationRegistryAdmission(source,runtime);
const producerContract=await verifyTestIrProducerContract(runtime);
const nativeCanonicalIdentity=await verifyTestIrNativeIdentity();
const nativeStaleRecovery=await verifyTestIrNativeRecovery();
console.log(JSON.stringify({
  verifyTestRuntimeV3:'PASS',literalContractBoundaries,diagnosticBounds,operationRegistryAdmission,producerContract,nativeCanonicalIdentity,nativeStaleRecovery,verificationObservations:[integerBoundaryContract],
  operations:runtime.OPS.length,
  inputLimit:runtime.LIMITS.maxTotalInputBytes,
  workerTimeoutMs:runtime.LIMITS.workerTimeoutMs,
  json:true,csv:true,xml:true,xmlWildcard:true,byteCompare:true,integerExact:true,approximateTolerance:true,
  unknownOperationRejected:true,unknownPropertyRejected:true,arbitraryCodeRejected:true,timeoutNoPartialResult:true,patternLimitCases,stepCountBoundary:true
}));
