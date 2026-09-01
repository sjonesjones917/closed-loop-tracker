import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';

const hashSource=fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('./test-runtime.js',import.meta.url),'utf8');
const workerSource=fs.readFileSync(new URL('./test-worker.js',import.meta.url));
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL,setTimeout,clearTimeout,Date,Math,Promise};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(hashSource,context,{filename:'hash.js'});
vm.runInContext(source,context,{filename:'test-runtime.js'});
const runtime=context.closedLoopTestRuntime;
assert.ok(runtime,'runtime must load');
assert.equal(runtime.RUNTIME_BUILD_ID,'runtime-20260901-zero-loss-62');
assert.equal(runtime.WORKER_PROTOCOL_VERSION,'closed-loop-test-worker-protocol/1');
assert.equal(runtime.TEST_WORKER_SHA256,createHash('sha256').update(workerSource).digest('hex'),'runtime worker identity must match the exact test-worker.js bytes');
const workerBytes=new Uint8Array(workerSource),workerArrayBuffer=workerBytes.buffer.slice(workerBytes.byteOffset,workerBytes.byteOffset+workerBytes.byteLength),fetchCalls=[];
const attestedFetch=async(url,init)=>{fetchCalls.push({url:String(url),init});return{ok:true,status:200,redirected:false,url:String(url),arrayBuffer:async()=>workerArrayBuffer.slice(0)};};

const artifact=(id,text)=>({artifactId:id,filename:`${id}.txt`,bytes:new TextEncoder().encode(text)});
const test=(spec,bindings={PRODUCT:{kind:'ARTIFACT',artifactId:'ART-PRODUCT'}})=>({
  TEST_ID:'TEST-1',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',
  EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:spec,EXECUTABLE_INPUT_BINDINGS:bindings
});
const spec=steps=>({version:'closed-loop-test-spec/1',steps});
const canonicalInput=(canonicalKey,value)=>{const valueSha256=context.closedLoopHash.sha256Value(value);return {descriptor:{kind:'CANONICAL_VALUE',canonicalKey,valueSha256},payload:{canonicalKey,value,valueSha256}};};

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
const undeclaredBinding=runtime.validateSpec(spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'ASSERT_EXISTS'}]),{});
assert.equal(undeclaredBinding.valid,false);assert.match(undeclaredBinding.issues.join(' '),/undeclared binding PRODUCT/i);
assert.equal(runtime.validateSpec(spec([{op:'ASSERT_EQ',value:null}]),{}).valid,false,'an assertion without a bound pipeline input must be rejected');
assert.equal(runtime.validateSpec(spec([{op:'COUNT'},{op:'ASSERT_EQ',value:0}]),{}).valid,false,'COUNT cannot manufacture a result without a bound input');
assert.equal(runtime.validateSpec(spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'COMPARE',value:1},{op:'ASSERT_EQ',value:true}]),{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-PRODUCT'}}).valid,false,'COMPARE requires an explicit comparator mode');
assert.equal(runtime.validateSpec(spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'ASSERT_NE',value:{numberType:'DECIMAL',value:'1.0'},numericMode:'APPROXIMATE'}]),{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-PRODUCT'}}).valid,false,'ASSERT_NE approximate comparison requires explicit tolerance');
for(const path of ['$.items[00]','$.items[-1]','$.items[1]tail','$..items'])assert.equal(runtime.validateSpec(spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_JSON'},{op:'SELECT_JSON_PATH',path},{op:'ASSERT_EXISTS'}]),{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-PRODUCT'}}).valid,false,`unsafe selector ${path} must be rejected`);

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
assert.deepEqual(Array.from(equalBytes.inputBindings,x=>x.artifactId),['ART-L','ART-R']);assert.deepEqual(Array.from(equalBytes.inputArtifactIds),['ART-L','ART-R']);assert.equal(equalBytes.inputArtifactSha256Values.length,2,'artifact IDs and hashes must retain one-to-one pairing even when the digests are equal');
const unequalBytes=await runtime.execute({spec:byteSpec,artifacts:{LEFT:artifact('ART-L','same'),RIGHT:artifact('ART-R','different')},metadata:{bindings:byteBindings}});
assert.equal(unequalBytes.determination,'VIOLATED');
await assert.rejects(()=>runtime.execute({spec:byteSpec,artifacts:{LEFT:artifact('ART-WRONG','same'),RIGHT:artifact('ART-R','same')},metadata:{bindings:byteBindings}}),error=>error.code==='BINDING_IDENTITY_MISMATCH'&&error.disposition==='BLOCKED');
await assert.rejects(()=>runtime.execute({spec:byteSpec,artifacts:{LEFT:{...artifact('ART-L','same'),sha256:'0'.repeat(64)},RIGHT:artifact('ART-R','same')},metadata:{bindings:byteBindings}}),error=>error.code==='ARTIFACT_HASH_MISMATCH'&&error.disposition==='BLOCKED');

const integerInput=canonicalInput('VALUES',[1,2,3]);
const integer=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'SUM'},{op:'ASSERT_EQ',value:6}]),canonicalBindings:{VALUES:integerInput.payload},metadata:{bindings:{VALUES:integerInput.descriptor}}});
assert.equal(integer.determination,'SATISFIED');
assert.equal(integer.inputBindings[0].canonicalKey,'VALUES');assert.equal(integer.inputBindings[0].valueSha256,integerInput.descriptor.valueSha256,'canonical input evidence must bind the exact immutable value hash');
const exactIntegerInput=canonicalInput('VALUES',[{numberType:'INTEGER',value:'9007199254740992'},{numberType:'INTEGER',value:'8'}]);
const exactInteger=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'SUM'},{op:'ASSERT_EQ',value:{numberType:'INTEGER',value:'9007199254741000'}}]),canonicalBindings:{VALUES:exactIntegerInput.payload},metadata:{bindings:{VALUES:exactIntegerInput.descriptor}}});assert.equal(exactInteger.determination,'SATISFIED','typed exact integer arithmetic must not round through Number');
const emptyInput=canonicalInput('VALUES',[]);for(const op of ['MIN','MAX'])await assert.rejects(()=>runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUES'},{op},{op:'ASSERT_EQ',value:0}]),canonicalBindings:{VALUES:emptyInput.payload},metadata:{bindings:{VALUES:emptyInput.descriptor}}}),error=>error.code==='EMPTY_COLLECTION'&&error.disposition==='UNDETERMINED');
await assert.rejects(()=>runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'ASSERT_EXISTS'}]),canonicalBindings:{VALUES:{...integerInput.payload,valueSha256:'0'.repeat(64)}},metadata:{bindings:{VALUES:integerInput.descriptor}}}),error=>error.code==='CANONICAL_VALUE_HASH_MISMATCH'&&error.disposition==='BLOCKED');
const unsafeEquality=runtime.validateSpec(spec([{op:'ASSERT_EQ',value:0.1}]));
assert.equal(unsafeEquality.valid,false);assert.match(unsafeEquality.issues.join(' '),/typed DECIMAL/i);
const missingTolerance=runtime.validateSpec(spec([{op:'ASSERT_EQ',value:{numberType:'DECIMAL',value:'0.1'},numericMode:'APPROXIMATE'}]));
assert.equal(missingTolerance.valid,false);assert.match(missingTolerance.issues.join(' '),/tolerance/i);
const approximateInput=canonicalInput('VALUE',{numberType:'DECIMAL',value:'0.30000000000000004'});
const approximate=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:{numberType:'DECIMAL',value:'0.3'},numericMode:'APPROXIMATE',absTol:'0.000000000001'}]),canonicalBindings:{VALUE:approximateInput.payload},metadata:{bindings:{VALUE:approximateInput.descriptor}}});
assert.equal(approximate.determination,'SATISFIED');
const decimalInput=canonicalInput('VALUE','1.23');
const decimal=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:'1.2300',numericMode:'DECIMAL_STRING'}]),canonicalBindings:{VALUE:decimalInput.payload},metadata:{bindings:{VALUE:decimalInput.descriptor}}});
assert.equal(decimal.determination,'SATISFIED');
const sortSpec=spec([{op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'SORT',domain:'STRING'},{op:'ASSERT_EQ',value:['','𐀀']}]);
const sortInput=canonicalInput('VALUES',['𐀀','']);
const sorted=await runtime.execute({spec:sortSpec,canonicalBindings:{VALUES:sortInput.payload},metadata:{bindings:{VALUES:sortInput.descriptor}}});
assert.equal(sorted.determination,'SATISFIED');
assert.equal(sorted.testWorkerSha256,null);assert.equal(sorted.workerProtocolVersion,null);assert.equal(sorted.workerAttestation,null,'direct interpreter execution must not self-assert worker-byte attestation');

const largeObservationInput=canonicalInput('VALUE','x'.repeat(runtime.LIMITS.maxObservationValueBytes+1));
const boundedObservation=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:'different'}]),canonicalBindings:{VALUE:largeObservationInput.payload},metadata:{bindings:{VALUE:largeObservationInput.descriptor}}});
assert.equal(boundedObservation.actual.summaryType,'CANONICAL_VALUE');assert.match(boundedObservation.actual.sha256,/^[0-9a-f]{64}$/);assert.ok(!JSON.stringify(boundedObservation).includes('x'.repeat(1024)),'large observed values must be hash-bound summaries rather than duplicated into results');

const deepJson='['.repeat(12000)+'0'+']'.repeat(12000);
await assert.rejects(()=>runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_JSON'},{op:'ASSERT_EXISTS'}]),artifacts:{PRODUCT:artifact('ART-DEEP',deepJson)},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-DEEP'}}}}),error=>error.code==='PARSED_DEPTH_LIMIT','deep JSON must fail at the registered depth boundary rather than overflowing the JavaScript stack');


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
const timeoutResult=await runtime.executeTest(test(jsonSpec),{PRODUCT:artifact('ART-PRODUCT','{}')},{},{Worker:SilentWorker,fetch:attestedFetch,timeoutMs:5,workerUrl:'test-worker.js'});
assert.equal(timeoutResult.status,'EXECUTION_FAILED');
assert.equal(timeoutResult.failure.code,'WORKER_TIMEOUT');
assert.equal(timeoutResult.observations.length,0,'timeout must produce no partial result');
assert.equal(timeoutResult.testWorkerSha256,runtime.TEST_WORKER_SHA256);assert.equal(JSON.stringify(timeoutResult.workerAttestation),JSON.stringify({runtimeBuildIdentity:runtime.RUNTIME_BUILD_ID,workerProtocolVersion:runtime.WORKER_PROTOCOL_VERSION,testWorkerSha256:runtime.TEST_WORKER_SHA256}),'post-attestation failures must preserve the exact observed worker identity');

let successfulWorkerUrl='',successfulWorkerAttestation=null;
class MatchingIdentityWorker{
  constructor(url){successfulWorkerUrl=String(url);}
  async postMessage(message){
    successfulWorkerAttestation=message.workerAttestation;
    const result=await runtime.execute({spec:message.spec,artifacts:message.artifacts,canonicalBindings:message.canonicalBindings,metadata:message.metadata});
    Object.assign(result,{runtimeBuildIdentity:message.workerAttestation.runtimeBuildIdentity,workerProtocolVersion:message.workerAttestation.workerProtocolVersion,testWorkerSha256:message.workerAttestation.testWorkerSha256,workerAttestation:{...message.workerAttestation}});
    this.onmessage?.({data:{requestId:message.requestId,ok:true,runtimeBuildIdentity:runtime.RUNTIME_BUILD_ID,workerProtocolVersion:runtime.WORKER_PROTOCOL_VERSION,workerAttestation:message.workerAttestation,result}});
  }
  terminate(){this.terminated=true;}
}
const workerSuccess=await runtime.executeTest(test(jsonSpec),{PRODUCT:artifact('ART-PRODUCT',JSON.stringify({items:Array(10).fill(0)}))},{},{Worker:MatchingIdentityWorker,fetch:attestedFetch,timeoutMs:100,workerUrl:'test-worker.js'});
assert.equal(workerSuccess.status,'COMPLETE');
assert.equal(workerSuccess.determination,'SATISFIED');
assert.equal(workerSuccess.runtimeBuildIdentity,runtime.RUNTIME_BUILD_ID);
assert.equal(workerSuccess.workerProtocolVersion,runtime.WORKER_PROTOCOL_VERSION);
assert.equal(workerSuccess.testWorkerSha256,runtime.TEST_WORKER_SHA256);
assert.equal(JSON.stringify(successfulWorkerAttestation),JSON.stringify({runtimeBuildIdentity:runtime.RUNTIME_BUILD_ID,workerProtocolVersion:runtime.WORKER_PROTOCOL_VERSION,testWorkerSha256:runtime.TEST_WORKER_SHA256}),'worker handshake must receive the parent-observed byte/build/protocol identity');
assert.equal(successfulWorkerUrl,fetchCalls.at(-1).url,'the exact attested worker URL must be the URL executed');
assert.equal(new URL(successfulWorkerUrl).search,'?v='+runtime.RUNTIME_BUILD_ID,'worker execution URL must carry only the cache-safe shared build identity');
assert.equal(JSON.stringify(fetchCalls.at(-1).init),JSON.stringify({method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error'}),'worker attestation fetch must bypass stale cache and reject redirects');

let mismatchedWorkerConstructed=false;
class MustNotStartWorker{constructor(){mismatchedWorkerConstructed=true;}terminate(){}}
const changedWorkerBytes=workerBytes.slice();changedWorkerBytes[changedWorkerBytes.length-1]^=1;
const mismatchedDigest=createHash('sha256').update(changedWorkerBytes).digest('hex');
const mismatchedFetch=async url=>({ok:true,status:200,redirected:false,url:String(url),arrayBuffer:async()=>changedWorkerBytes.buffer.slice(changedWorkerBytes.byteOffset,changedWorkerBytes.byteOffset+changedWorkerBytes.byteLength)});
const byteMismatch=await runtime.executeTest(test(jsonSpec),{PRODUCT:artifact('ART-PRODUCT','{}')},{},{Worker:MustNotStartWorker,fetch:mismatchedFetch,timeoutMs:100,workerUrl:'test-worker.js'});
assert.equal(byteMismatch.status,'EXECUTION_FAILED');assert.equal(byteMismatch.failure.code,'WORKER_BYTE_IDENTITY_MISMATCH');assert.equal(byteMismatch.testWorkerSha256,mismatchedDigest,'mismatch result must preserve the actually observed worker digest');assert.equal(byteMismatch.workerAttestation.testWorkerSha256,mismatchedDigest);assert.equal(mismatchedWorkerConstructed,false,'worker execution must not start after byte-attestation failure');
const staleUrl=await runtime.executeTest(test(jsonSpec),{PRODUCT:artifact('ART-PRODUCT','{}')},{},{Worker:MustNotStartWorker,fetch:attestedFetch,timeoutMs:100,workerUrl:'test-worker.js?v=stale-build'});
assert.equal(staleUrl.status,'EXECUTION_FAILED');assert.equal(staleUrl.failure.code,'WORKER_URL_BUILD_IDENTITY_MISMATCH');assert.equal(mismatchedWorkerConstructed,false,'worker execution must not start with a stale build URL');

class StaleBuildWorker{
  postMessage(message){queueMicrotask(()=>this.onmessage?.({data:{requestId:message.requestId,ok:false,runtimeBuildIdentity:'runtime-stale',workerProtocolVersion:runtime.WORKER_PROTOCOL_VERSION,workerAttestation:message.workerAttestation,error:{code:'STALE_WORKER'}}}));}
  terminate(){this.terminated=true;}
}
const staleBuild=await runtime.executeTest(test(jsonSpec),{PRODUCT:artifact('ART-PRODUCT','{}')},{},{Worker:StaleBuildWorker,fetch:attestedFetch,timeoutMs:100,workerUrl:'test-worker.js'});
assert.equal(staleBuild.status,'EXECUTION_FAILED');
assert.equal(staleBuild.failure.code,'WORKER_BUILD_IDENTITY_MISMATCH');

class StaleProtocolWorker{
  postMessage(message){queueMicrotask(()=>this.onmessage?.({data:{requestId:message.requestId,ok:false,runtimeBuildIdentity:runtime.RUNTIME_BUILD_ID,workerProtocolVersion:'closed-loop-test-worker-protocol/0',workerAttestation:message.workerAttestation,error:{code:'STALE_WORKER'}}}));}
  terminate(){this.terminated=true;}
}
const staleProtocol=await runtime.executeTest(test(jsonSpec),{PRODUCT:artifact('ART-PRODUCT','{}')},{},{Worker:StaleProtocolWorker,fetch:attestedFetch,timeoutMs:100,workerUrl:'test-worker.js'});
assert.equal(staleProtocol.status,'EXECUTION_FAILED');
assert.equal(staleProtocol.failure.code,'WORKER_PROTOCOL_MISMATCH');

class WrongWorkerDigestResult{
  postMessage(message){queueMicrotask(()=>this.onmessage?.({data:{requestId:message.requestId,ok:true,runtimeBuildIdentity:runtime.RUNTIME_BUILD_ID,workerProtocolVersion:runtime.WORKER_PROTOCOL_VERSION,workerAttestation:message.workerAttestation,result:{runtimeBuildIdentity:runtime.RUNTIME_BUILD_ID,workerProtocolVersion:runtime.WORKER_PROTOCOL_VERSION,testWorkerSha256:'0'.repeat(64)}}}));}
  terminate(){this.terminated=true;}
}
const wrongWorkerDigest=await runtime.executeTest(test(jsonSpec),{PRODUCT:artifact('ART-PRODUCT','{}')},{},{Worker:WrongWorkerDigestResult,fetch:attestedFetch,timeoutMs:100,workerUrl:'test-worker.js'});
assert.equal(wrongWorkerDigest.status,'EXECUTION_FAILED');
assert.equal(wrongWorkerDigest.failure.code,'WORKER_RESULT_BYTE_IDENTITY_MISMATCH');

class WrongInputBindingResult{
  async postMessage(message){const result=await runtime.execute({spec:message.spec,artifacts:message.artifacts,canonicalBindings:message.canonicalBindings,metadata:message.metadata});Object.assign(result,{runtimeBuildIdentity:message.workerAttestation.runtimeBuildIdentity,workerProtocolVersion:message.workerAttestation.workerProtocolVersion,testWorkerSha256:message.workerAttestation.testWorkerSha256,workerAttestation:{...message.workerAttestation}});result.inputBindings[0].artifactId='ART-FORGED';this.onmessage?.({data:{requestId:message.requestId,ok:true,runtimeBuildIdentity:runtime.RUNTIME_BUILD_ID,workerProtocolVersion:runtime.WORKER_PROTOCOL_VERSION,workerAttestation:message.workerAttestation,result}});}
  terminate(){this.terminated=true;}
}
const wrongInputBinding=await runtime.executeTest(test(jsonSpec),{PRODUCT:artifact('ART-PRODUCT',JSON.stringify({items:Array(10).fill(0)}))},{},{Worker:WrongInputBindingResult,fetch:attestedFetch,timeoutMs:100,workerUrl:'test-worker.js'});
assert.equal(wrongInputBinding.status,'EXECUTION_FAILED');assert.equal(wrongInputBinding.failure.code,'WORKER_RESULT_INPUT_BINDING_MISMATCH');

let workerHandler=null;const workerMessages=[];
const workerContext={console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL,setTimeout,clearTimeout,Date,Math,Promise,location:{search:'?v=runtime-20260901-zero-loss-62'}};
workerContext.self=workerContext;workerContext.globalThis=workerContext;
workerContext.addEventListener=(type,handler)=>{if(type==='message')workerHandler=handler;};
workerContext.postMessage=message=>workerMessages.push(message);
vm.createContext(workerContext);
workerContext.importScripts=url=>vm.runInContext(String(url).startsWith('hash.js')?hashSource:source,workerContext,{filename:String(url).startsWith('hash.js')?'hash.js':'test-runtime.js'});
vm.runInContext(workerSource.toString('utf8'),workerContext,{filename:'test-worker.js'});
assert.equal(typeof workerHandler,'function','worker message handler must register');
await workerHandler({data:{type:'EXECUTE_TEST_IR',requestId:'wrong-build',runtimeBuildIdentity:'runtime-stale',workerProtocolVersion:runtime.WORKER_PROTOCOL_VERSION}});
assert.equal(workerMessages.at(-1).error.code,'WORKER_BUILD_IDENTITY_MISMATCH');
await workerHandler({data:{type:'EXECUTE_TEST_IR',requestId:'wrong-protocol',runtimeBuildIdentity:runtime.RUNTIME_BUILD_ID,workerProtocolVersion:'closed-loop-test-worker-protocol/0'}});
assert.equal(workerMessages.at(-1).error.code,'WORKER_PROTOCOL_MISMATCH');
const exactWorkerAttestation={runtimeBuildIdentity:runtime.RUNTIME_BUILD_ID,workerProtocolVersion:runtime.WORKER_PROTOCOL_VERSION,testWorkerSha256:runtime.TEST_WORKER_SHA256};
await workerHandler({data:{type:'EXECUTE_TEST_IR',requestId:'wrong-attestation',runtimeBuildIdentity:runtime.RUNTIME_BUILD_ID,workerProtocolVersion:runtime.WORKER_PROTOCOL_VERSION,workerAttestation:{...exactWorkerAttestation,testWorkerSha256:'0'.repeat(64)}}});
assert.equal(workerMessages.at(-1).error.code,'WORKER_ATTESTATION_HANDSHAKE_MISMATCH');
await workerHandler({data:{type:'EXECUTE_TEST_IR',requestId:'undeclared-binding',runtimeBuildIdentity:runtime.RUNTIME_BUILD_ID,workerProtocolVersion:runtime.WORKER_PROTOCOL_VERSION,workerAttestation:exactWorkerAttestation,spec:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'ASSERT_EXISTS'}]),bindings:{}}});
assert.equal(workerMessages.at(-1).error.code,'INVALID_TEST_IR');

const engineContext={console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL,setTimeout,clearTimeout,Date,Math,Promise,Event:class Event{constructor(type){this.type=type;}},dispatchEvent:()=>true};engineContext.globalThis=engineContext;vm.createContext(engineContext);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),engineContext,{filename:file});
const nativeCore=engineContext.closedLoopCore,nativeEngine=engineContext.closedLoopWorkflowEngine,nativeRuntime=engineContext.closedLoopTestRuntime,nativeHash=engineContext.closedLoopHash,nativeProject=nativeCore.createBlankState('JOB-NATIVE-RESULT-AUTHORITY');nativeEngine.ensureShape(nativeProject);Object.assign(nativeProject.job,{CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_PRODUCT_ID:'PRODUCT-NATIVE-AUTHORITY'});
const nativeBytes=new TextEncoder().encode('native authority'),nativeSha=await nativeHash.sha256Bytes(nativeBytes),nativeSpec=spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'ASSERT_EXISTS'}]),nativeBindings={PRODUCT:{kind:'ARTIFACT',artifactId:'ARTIFACT-NATIVE-AUTHORITY',filename:'native.bin',expectedSha256:nativeSha}},nativeScope=nativeEngine.currentScope(nativeProject);
const nativeRecord=(collection,stage,id,fields)=>({id,recordId:id,stage,active:true,scope:{...nativeScope},fields:{...(fields||{})},relationships:{},evidenceRefs:[]});
const nativeTest=nativeRecord('tests',6,'TEST-NATIVE-AUTHORITY',{TEST_ID:'TEST-NATIVE-AUTHORITY',REQ_ID:'REQ-NATIVE-AUTHORITY',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',ARTIFACT_REQUIREMENTS:'native.bin',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:nativeRuntime.SPEC_VERSION,EXECUTABLE_SPEC:nativeSpec,EXECUTABLE_SPEC_SHA256:nativeHash.sha256Value(nativeRuntime.normalizeSpec(nativeSpec,nativeBindings)),EXECUTABLE_INPUT_BINDINGS:nativeBindings,INPUTS:'native.bin',TOOLS:'Closed Loop Test IR',PROCEDURE:'read exact bytes',EXPECTED_RESULT:'present',FAILURE_CONDITION:'missing',EVIDENCE_TO_PRESERVE:'native result',STATUS:'READY'}),nativeProduct=nativeRecord('products',21,'PRODUCT-NATIVE-AUTHORITY',{PRODUCT_ID:'PRODUCT-NATIVE-AUTHORITY',PRODUCT_VERSION:'PRODUCT-v001',STATUS:'COMPLETE'}),nativeArtifact=nativeRecord('artifacts',21,'ARTIFACT-NATIVE-AUTHORITY',{ARTIFACT_ID:'ARTIFACT-NATIVE-AUTHORITY',FILENAME:'native.bin',BYTE_SIZE:nativeBytes.byteLength,SHA256:nativeSha,ROLE:'FINISHED_PRODUCT',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'});nativeProject.projectData.tests.push(nativeTest);nativeProject.projectData.products.push(nativeProduct);nativeProject.projectData.artifacts.push(nativeArtifact);
const nativeResult=await nativeRuntime.execute({spec:nativeSpec,artifacts:{PRODUCT:{artifactId:'ARTIFACT-NATIVE-AUTHORITY',filename:'native.bin',byteSize:nativeBytes.byteLength,sha256:nativeSha,bytes:nativeBytes}},metadata:{testId:'TEST-NATIVE-AUTHORITY',bindings:nativeBindings}}),nativeArtifacts=[{artifactId:'ARTIFACT-NATIVE-AUTHORITY',filename:'native.bin',byteSize:nativeBytes.byteLength,sha256:nativeSha}];nativeResult.workerAttestation={runtimeBuildIdentity:nativeRuntime.RUNTIME_BUILD_ID,workerProtocolVersion:nativeRuntime.WORKER_PROTOCOL_VERSION,testWorkerSha256:nativeRuntime.TEST_WORKER_SHA256};Object.assign(nativeResult,nativeResult.workerAttestation);
const nativeMutations=[['testId','TEST-FORGED'],['testSpecVersion','closed-loop-test-spec/0'],['testSpecSha256','0'.repeat(64)],['runtimeBuildIdentity','runtime-forged'],['workerProtocolVersion','closed-loop-test-worker-protocol/0'],['testWorkerSha256','0'.repeat(64)],['workerAttestation',{...nativeResult.workerAttestation,testWorkerSha256:'0'.repeat(64)}],['inputBindings',nativeResult.inputBindings.map((item,index)=>index?item:{...item,artifactId:'ARTIFACT-FORGED'})],['inputArtifactIds',['ARTIFACT-FORGED']],['status','EXECUTION_FAILED']];
for(const [key,value] of nativeMutations){const candidate=nativeEngine.clone(nativeProject),before={results:candidate.projectData.deterministicResults.length,evidence:candidate.projectData.evidenceRecords.length,history:candidate.projectData.history.length,counters:nativeHash.sha256Value(candidate.projectData.idCounters)};assert.throws(()=>nativeEngine.recordApplicationDeterministicResult(candidate,{testId:'TEST-NATIVE-AUTHORITY',productId:'PRODUCT-NATIVE-AUTHORITY',runtimeResult:{...nativeResult,[key]:value},inputArtifacts:nativeArtifacts}),/native|runtime|input|complete|status|worker|specification/i,`forged native result field ${key} was accepted`);assert.deepEqual({results:candidate.projectData.deterministicResults.length,evidence:candidate.projectData.evidenceRecords.length,history:candidate.projectData.history.length,counters:nativeHash.sha256Value(candidate.projectData.idCounters)},before,`rejected native result ${key} partially mutated canonical state`);}
const committedNative=nativeEngine.recordApplicationDeterministicResult(nativeProject,{testId:'TEST-NATIVE-AUTHORITY',productId:'PRODUCT-NATIVE-AUTHORITY',runtimeResult:nativeResult,inputArtifacts:nativeArtifacts});assert.equal(nativeEngine.recordValue(committedNative,'APPLICATION_DETERMINATION'),'SATISFIED');const nativeEvidence=JSON.parse(nativeEngine.recordValue(nativeEngine.records(nativeProject,'evidenceRecords').at(-1),'APPLICATION_EVIDENCE_CONTENT'));assert.equal(nativeEvidence.runtimeBuildIdentity,nativeRuntime.RUNTIME_BUILD_ID);assert.equal(nativeEvidence.workerProtocolVersion,nativeRuntime.WORKER_PROTOCOL_VERSION);assert.equal(nativeEvidence.testWorkerSha256,nativeRuntime.TEST_WORKER_SHA256);assert.deepEqual(nativeEvidence.workerAttestation,nativeResult.workerAttestation);assert.equal(nativeEvidence.inputBindings[0].artifactId,'ARTIFACT-NATIVE-AUTHORITY');

console.log(JSON.stringify({
  verifyTestRuntimeV3:'PASS',
  operations:runtime.OPS.length,
  inputLimit:runtime.LIMITS.maxTotalInputBytes,
  workerTimeoutMs:runtime.LIMITS.workerTimeoutMs,
  json:true,csv:true,xml:true,byteCompare:true,integerExact:true,approximateTolerance:true,
  unknownOperationRejected:true,unknownPropertyRejected:true,arbitraryCodeRejected:true,timeoutNoPartialResult:true,
  runtimeBuildIdentity:runtime.RUNTIME_BUILD_ID,workerProtocolVersion:runtime.WORKER_PROTOCOL_VERSION,testWorkerSha256:runtime.TEST_WORKER_SHA256,
  staleWorkerBuildRejected:true,staleWorkerProtocolRejected:true,wrongWorkerDigestRejected:true,wrongInputBindingRejected:true,undeclaredWorkerBindingRejected:true,preExecutionWorkerByteMismatchRejected:true,observedWorkerIdentityPersisted:true,nativeCommitAuthorityBound:true
}));
