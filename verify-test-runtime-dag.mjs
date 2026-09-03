import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const context={console,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,structuredClone,crypto:webcrypto,Blob};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('hash.js','utf8'),context,{filename:'hash.js'});
vm.runInContext(fs.readFileSync('test-runtime.js','utf8'),context,{filename:'test-runtime.js'});
const runtime=context.closedLoopTestRuntime;
const plain=value=>JSON.parse(JSON.stringify(value));

assert.equal(runtime.TEST_IR_LANGUAGE_VERSION,'closed-loop-test-ir-language/1');
assert.equal(runtime.OPERATION_REGISTRY_VERSION,'closed-loop-test-ir-operations/1');
assert.match(runtime.OPERATION_REGISTRY_SHA256,/^[0-9a-f]{64}$/);
assert.equal(runtime.JSON_SELECTOR_REGISTRY_VERSION,'closed-loop-json-selector/1');
assert.equal(runtime.XML_SELECTOR_REGISTRY_VERSION,'closed-loop-xml-selector/1');
assert.equal(runtime.REGEX_REGISTRY_VERSION,'closed-loop-regex/1');

const legacy={version:runtime.SPEC_VERSION,steps:[
  {op:'LOAD_ARTIFACT',binding:'PRODUCT'},
  {op:'READ_BYTES'},
  {op:'DECODE_UTF8'},
  {op:'PARSE_JSON'},
  {op:'SELECT_JSON_PATH',path:"$['records']"},
  {op:'COUNT'},
  {op:'ASSERT_EQ',value:2}
]};
const normalized=runtime.normalizeSpec(legacy);
assert.deepEqual(plain(Object.keys(normalized)),['version','languageVersion','operationRegistryVersion','operationRegistrySha256','steps','result']);
assert.equal(normalized.steps.length,7);
for(const [index,step] of normalized.steps.entries()){
  assert.equal(step.stepId,`S${String(index+1).padStart(3,'0')}`);
  assert.equal(typeof step.inputs,'object');
  assert.equal(Array.isArray(step.inputs),false);
}
assert.deepEqual(plain(normalized.result),{stepRef:'S007',output:'assertion'});
assert.equal(normalized.steps[5].inputs.value.stepRef,'S005');
assert.equal(normalized.steps[6].inputs.actual.stepRef,'S006');

const explicit={
  version:runtime.SPEC_VERSION,
  languageVersion:runtime.TEST_IR_LANGUAGE_VERSION,
  operationRegistryVersion:runtime.OPERATION_REGISTRY_VERSION,
  operationRegistrySha256:runtime.OPERATION_REGISTRY_SHA256,
  steps:[
    {stepId:'S001',op:'LOAD_ARTIFACT',inputs:{binding:{bindingRef:'PRODUCT'}}},
    {stepId:'S002',op:'READ_BYTES',inputs:{artifact:{stepRef:'S001',output:'artifact'}}},
    {stepId:'S003',op:'DECODE_UTF8',inputs:{bytes:{stepRef:'S002',output:'bytes'}}},
    {stepId:'S004',op:'PARSE_JSON',inputs:{text:{stepRef:'S003',output:'text'}}},
    {stepId:'S005',op:'SELECT_JSON_PATH',inputs:{value:{stepRef:'S004',output:'value'},path:{literal:"$['records'][*]"}}},
    {stepId:'S006',op:'COUNT',inputs:{value:{stepRef:'S005',output:'selection'}}},
    {stepId:'S007',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S006',output:'count'},expected:{literal:2}}}
  ],
  result:{stepRef:'S007',output:'assertion'}
};
assert.equal(runtime.validateSpec(explicit,{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-1'}}).valid,true);

const duplicate=structuredClone(explicit);duplicate.steps[1].stepId='S001';
assert.equal(runtime.validateSpec(duplicate,{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-1'}}).valid,false);
const forward=structuredClone(explicit);forward.steps[1].inputs.artifact={stepRef:'S003',output:'text'};
assert.equal(runtime.validateSpec(forward,{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-1'}}).valid,false);
const wrongPort=structuredClone(explicit);wrongPort.steps[2].inputs.bytes={stepRef:'S002',output:'notARealPort'};
assert.equal(runtime.validateSpec(wrongPort,{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-1'}}).valid,false);
const implicit={version:runtime.SPEC_VERSION,languageVersion:runtime.TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:runtime.OPERATION_REGISTRY_VERSION,operationRegistrySha256:runtime.OPERATION_REGISTRY_SHA256,steps:[{stepId:'S001',op:'ASSERT_EQ',inputs:{expected:{literal:true}}}],result:{stepRef:'S001',output:'assertion'}};
assert.equal(runtime.validateSpec(implicit).valid,false,'Canonical DAG assertions cannot use an implicit current operand.');

const compareContract=runtime.operationContracts().COMPARE;
assert.deepEqual(plain(compareContract.requiredInputs),['left','right']);
const byteCompareContract=runtime.operationContracts().BYTE_COMPARE;
assert.deepEqual(plain(byteCompareContract.requiredInputs),['left','right']);

assert.equal(runtime.validateRegex('(ab)+').length,0,'Capturing groups are required by closed-loop-regex/1.');
assert.equal(runtime.validateRegex('(?:ab)+').length,0,'Non-capturing groups are required by closed-loop-regex/1.');
assert.ok(runtime.validateRegex('(?=ab)').length>0,'Lookaround remains prohibited.');
assert.ok(runtime.validateRegex('(a+)+$').length>0,'Nested unbounded quantification must be rejected.');

const bytes=new TextEncoder().encode(JSON.stringify({records:[1,2]}));
const sha=Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const result=await runtime.execute({spec:explicit,artifacts:{PRODUCT:{artifactId:'ART-1',filename:'input.json',sha256:sha,bytes}},metadata:{testId:'TEST-DAG-1',bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-1'}}}});
assert.equal(result.determination,'SATISFIED');
assert.equal(result.testIrLanguageVersion,runtime.TEST_IR_LANGUAGE_VERSION);
assert.equal(result.operationRegistryVersion,runtime.OPERATION_REGISTRY_VERSION);
assert.equal(result.operationRegistrySha256,runtime.OPERATION_REGISTRY_SHA256);
assert.equal(result.selectedResultPort,'assertion');
assert.match(result.normalizedDagSha256,/^[0-9a-f]{64}$/);
assert.equal(await runtime.sha256Canonical(normalized),context.closedLoopHash.sha256Value(normalized),'Test IR canonical hashing must use the single shared closed-loop-canonical-json/1 authority.');

const nonAdjacent={...explicit,steps:[explicit.steps[0],explicit.steps[1],explicit.steps[2],{stepId:'S004',op:'HASH_SHA256',inputs:{bytes:{stepRef:'S002',output:'bytes'}}},{stepId:'S005',op:'ASSERT_MATCH',inputs:{actual:{stepRef:'S004',output:'sha256'},pattern:{literal:'^[0-9a-f]{64}$'}}}],result:{stepRef:'S005',output:'assertion'}};
assert.equal(runtime.validateSpec(nonAdjacent,{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-1'}}).valid,true);
const nonAdjacentResult=await runtime.execute({spec:nonAdjacent,artifacts:{PRODUCT:{artifactId:'ART-1',sha256:sha,bytes}},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-1'}}}});
assert.equal(nonAdjacentResult.determination,'SATISFIED');

console.log(JSON.stringify({explicitDag:true,typedPorts:true,forwardReferenceRejected:true,legacyCompiledBeforeExecution:true,regexContract:true,jsonSelectorContract:true},null,2));
console.log('verify-test-runtime-dag: PASS');
