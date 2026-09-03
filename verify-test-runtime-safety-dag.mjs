import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';

const context={console,TextEncoder,TextDecoder,crypto:webcrypto,Uint8Array,ArrayBuffer,DataView,URL,setTimeout,clearTimeout,Date,Math,Promise};
context.globalThis=context;vm.createContext(context);
for(const file of ['hash.js','test-runtime.js'])vm.runInContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),context,{filename:file});
const runtime=context.closedLoopTestRuntime;
const inRuntime=value=>vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(value))})`,context);
const artifact=(id,text)=>({artifactId:id,filename:`${id}.txt`,bytes:new TextEncoder().encode(text)});
const spec=(steps,result)=>inRuntime({version:runtime.SPEC_VERSION,languageVersion:runtime.TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:runtime.OPERATION_REGISTRY_VERSION,operationRegistrySha256:runtime.OPERATION_REGISTRY_SHA256,steps,result});
const parseSpec=spec([
 {stepId:'S1',op:'LOAD_ARTIFACT',inputs:{binding:{bindingRef:'PRODUCT'}}},
 {stepId:'S2',op:'READ_BYTES',inputs:{artifact:{stepRef:'S1',output:'artifact'}}},
 {stepId:'S3',op:'DECODE_UTF8',inputs:{bytes:{stepRef:'S2',output:'bytes'}}},
 {stepId:'S4',op:'PARSE_JSON',inputs:{text:{stepRef:'S3',output:'text'}}},
 {stepId:'S5',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S4',output:'value'},expected:{literal:{a:1}}}}
],{stepRef:'S5',output:'assertion'});
await assert.rejects(()=>runtime.execute({spec:parseSpec,artifacts:{PRODUCT:artifact('ART-DUP','{"a":1,"a":2}')}}),e=>e?.code==='DUPLICATE_JSON_MEMBER','Duplicate JSON members must fail closed.');

assert.equal(runtime.validateRegex('(ab)+','').valid,true,'Capturing groups are required by closed-loop-regex/1.');
assert.equal(runtime.validateRegex('(?:ab)+','').valid,true,'Noncapturing groups are required by closed-loop-regex/1.');
assert.equal(runtime.validateRegex('(a+)+$','').valid,false,'Catastrophic nested quantification must be rejected by the safe regex subset.');

const timeoutSpec=spec([
 {stepId:'S1',op:'LOAD_ARTIFACT',inputs:{binding:{bindingRef:'PRODUCT'}}},
 {stepId:'S2',op:'READ_BYTES',inputs:{artifact:{stepRef:'S1',output:'artifact'}}},
 {stepId:'S3',op:'ASSERT_EQ',inputs:{actual:{literal:true},expected:{literal:true}}}
],{stepRef:'S3',output:'assertion'});
const timeoutTest={TEST_ID:'TEST-TIMEOUT',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:runtime.SPEC_VERSION,EXECUTABLE_INPUT_BINDINGS:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-TIMEOUT'}},EXECUTABLE_SPEC:timeoutSpec};
class SilentWorker{postMessage(){}terminate(){this.terminated=true;}}
const timeout=await runtime.executeTest(timeoutTest,{PRODUCT:artifact('ART-TIMEOUT','x')},{},{Worker:SilentWorker,timeoutMs:5,workerUrl:'test-worker.js'});
assert.equal(timeout.status,'EXECUTION_FAILED');
assert.equal(timeout.failure.code,'WORKER_TIMEOUT');
assert.equal(timeout.observations.length,0,'Worker timeout must create no partial deterministic result.');

const hashSpec=spec([
 {stepId:'S1',op:'LOAD_ARTIFACT',inputs:{binding:{bindingRef:'PRODUCT'}}},
 {stepId:'S2',op:'READ_BYTES',inputs:{artifact:{stepRef:'S1',output:'artifact'}}},
 {stepId:'S3',op:'HASH_SHA256',inputs:{bytes:{stepRef:'S2',output:'bytes'}}},
 {stepId:'S4',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S3',output:'sha256'},expected:{literal:createHash('sha256').update('hash authority').digest('hex')}}}
],{stepRef:'S4',output:'assertion'});
const hashTest={TEST_ID:'TEST-HASH',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:runtime.SPEC_VERSION,EXECUTABLE_INPUT_BINDINGS:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-HASH'}},EXECUTABLE_SPEC:hashSpec};
const h=await runtime.executeTest(hashTest,{PRODUCT:artifact('ART-HASH','hash authority')},{},{directExecutionForTest:true});
assert.equal(h.determination,'SATISFIED');
assert.deepEqual(Array.from(h.inputArtifactIds),['ART-HASH']);
assert.deepEqual(Array.from(h.inputArtifactSha256Values),[createHash('sha256').update('hash authority').digest('hex')],'Native result must calculate actual input hashes from bytes.');

console.log(JSON.stringify({testRuntimeSafetyDag:'PASS',duplicateJsonRejected:true,safeRegex:true,workerTimeoutNoPartial:true,actualInputHashes:true}));
