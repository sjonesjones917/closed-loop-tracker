import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const context={console,TextEncoder,TextDecoder,crypto:webcrypto,Uint8Array,ArrayBuffer,DataView};
context.globalThis=context;
vm.createContext(context);
for(const file of ['hash.js','test-runtime.js'])vm.runInContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),context,{filename:file});
const runtime=context.closedLoopTestRuntime;
assert.ok(runtime,'Test runtime must load.');
assert.equal(runtime.SPEC_VERSION,'closed-loop-test-spec/1');
assert.equal(runtime.TEST_IR_LANGUAGE_VERSION,'closed-loop-test-ir-language/1');
assert.equal(runtime.OPERATION_REGISTRY_VERSION,'closed-loop-test-ir-operations/1');
assert.match(runtime.OPERATION_REGISTRY_SHA256,/^[0-9a-f]{64}$/);
assert.equal(runtime.JSON_SELECTOR_REGISTRY_VERSION,'closed-loop-json-selector/1');
assert.equal(runtime.XML_SELECTOR_REGISTRY_VERSION,'closed-loop-xml-selector/1');
assert.equal(runtime.REGEX_REGISTRY_VERSION,'closed-loop-regex/1');

const opNames=Object.keys(runtime.OP_DEFINITIONS).sort();
assert.deepEqual(opNames,[
  'ASSERT_CONTAINS','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL',
  'BYTE_COMPARE','COMPARE','COUNT','DECODE_UTF8','HASH_SHA256','LOAD_ARTIFACT','MAX','MIN','PARSE_CSV','PARSE_JSON','PARSE_XML','READ_BYTES','REGEX',
  'SELECT_JSON_PATH','SELECT_XML','SORT','SUM','UNIQUE'
].sort(),'Version 1 operation registry must contain only the controlling primitives.');
for(const [name,definition] of Object.entries(runtime.OP_DEFINITIONS)){
  assert.equal(typeof definition.inputs,'object',`${name} must declare named input ports.`);
  assert.equal(typeof definition.outputs,'object',`${name} must declare named output ports.`);
  assert.equal(typeof definition.errorCodes,'object',`${name} must declare deterministic error codes.`);
  assert.equal(typeof definition.resourceCost,'string',`${name} must declare a resource-cost category.`);
}

const validSpec={
  version:'closed-loop-test-spec/1',
  languageVersion:'closed-loop-test-ir-language/1',
  operationRegistryVersion:'closed-loop-test-ir-operations/1',
  operationRegistrySha256:runtime.OPERATION_REGISTRY_SHA256,
  steps:[
    {stepId:'S001',op:'LOAD_ARTIFACT',inputs:{binding:{bindingRef:'PRODUCT'}}},
    {stepId:'S002',op:'READ_BYTES',inputs:{artifact:{stepRef:'S001',output:'artifact'}}},
    {stepId:'S003',op:'DECODE_UTF8',inputs:{bytes:{stepRef:'S002',output:'bytes'}}},
    {stepId:'S004',op:'PARSE_JSON',inputs:{text:{stepRef:'S003',output:'text'}}},
    {stepId:'S005',op:'SELECT_JSON_PATH',inputs:{value:{stepRef:'S004',output:'value'},path:{literal:"$['items'][*]"}}},
    {stepId:'S006',op:'COUNT',inputs:{value:{stepRef:'S005',output:'selection'}}},
    {stepId:'S007',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S006',output:'count'},expected:{literal:2}}}
  ],
  result:{stepRef:'S007',output:'assertion'}
};
const validCheck=runtime.validateSpec(validSpec);
assert.equal(validCheck.valid,true,Array.from(validCheck.issues).join(' | '));
assert.deepEqual(Array.from(validCheck.issues),[]);
const execution=await runtime.execute({
  spec:validSpec,
  artifacts:{PRODUCT:{artifactId:'ART-1',bytes:new TextEncoder().encode('{"items":[1,2]}')}},
  canonicalBindings:{}
});
assert.equal(execution.determination,'SATISFIED');
assert.equal(execution.selectedResultStepId,'S007');
assert.equal(execution.selectedResultOutputPort,'assertion');
assert.equal(execution.normalizedDagSha256.length,64);
assert.equal(execution.operationRegistrySha256,runtime.OPERATION_REGISTRY_SHA256);

const badSpecs=[
  {...validSpec,steps:validSpec.steps.map(({stepId,...rest})=>rest)},
  {...validSpec,steps:[...validSpec.steps,{stepId:'S007',op:'COUNT',inputs:{value:{literal:[]}}}]},
  {...validSpec,steps:[{stepId:'S001',op:'COUNT',inputs:{value:{stepRef:'S002',output:'selection'}}},{stepId:'S002',op:'SELECT_JSON_PATH',inputs:{value:{literal:[]},path:{literal:'$'}}}],result:{stepRef:'S001',output:'count'}},
  {...validSpec,steps:[{stepId:'S001',op:'COUNT',inputs:{value:{stepRef:'S001',output:'count'}}}],result:{stepRef:'S001',output:'count'}},
  {...validSpec,steps:[{stepId:'S001',op:'BYTE_COMPARE',inputs:{left:{literal:new Uint8Array([1])}}}],result:{stepRef:'S001',output:'comparison'}},
  {...validSpec,steps:[{stepId:'S001',op:'COMPARE',inputs:{left:{literal:1},right:{literal:1},extra:{literal:1}}}],result:{stepRef:'S001',output:'comparison'}},
  {...validSpec,steps:[{stepId:'S001',op:'ASSERT_EXISTS',inputs:{actual:{literal:1}}}],result:{stepRef:'S001',output:'assertion'}}
];
for(const [index,spec] of badSpecs.entries())assert.equal(runtime.validateSpec(spec).valid,false,`Invalid DAG fixture ${index+1} must fail.`);

for(const selector of ["$['a']",'$[*]',"$['a'][0]",'$[0]'])assert.equal(runtime.validateJsonSelector(selector).valid,true,`${selector} must be supported.`);
for(const selector of ['$..a','$[?(@.a)]','$[0:2]'])assert.equal(runtime.validateJsonSelector(selector).valid,false,`${selector} must be rejected.`);
for(const pattern of ['(ab)+','(?:ab)+','^a[0-9]+$'])assert.equal(runtime.validateRegex(pattern,'').valid,true,`${pattern} must be supported.`);
for(const pattern of ['(a)\\1','(?=a)','(?<=a)','\\p{L}'])assert.equal(runtime.validateRegex(pattern,'u').valid,false,`${pattern} must be rejected.`);

console.log(JSON.stringify({testIrDagContract:'PASS',operations:opNames.length,registrySha256:runtime.OPERATION_REGISTRY_SHA256}));
