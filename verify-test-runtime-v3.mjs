import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={console,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,structuredClone,crypto:globalThis.crypto};context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync('test-runtime.js','utf8'),context,{filename:'test-runtime.js'});const runtime=context.closedLoopTestRuntime;
const expectedOps=['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'];
assert.equal(runtime.SPEC_VERSION,'closed-loop-test-spec/1');
assert.deepEqual([...runtime.OPS],expectedOps);
const valid={version:runtime.SPEC_VERSION,steps:[{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'HASH_SHA256'},{op:'ASSERT_EQ',value:'abc'}]};
assert.equal(runtime.validateSpec(valid,{PRODUCT:'ARTIFACT-1'}).valid,true);
const invalidCases=[
  ['unknown version',{...valid,version:'closed-loop-test-spec/999'}],
  ['unknown operation',{version:runtime.SPEC_VERSION,steps:[{op:'EXEC_JAVASCRIPT',source:'return true'},{op:'ASSERT_EQ',value:true}]}],
  ['unknown operation property',{version:runtime.SPEC_VERSION,steps:[{op:'ASSERT_EQ',value:1,javascript:'alert(1)'}]}],
  ['missing required argument',{version:runtime.SPEC_VERSION,steps:[{op:'LOAD_ARTIFACT'},{op:'ASSERT_EQ',value:1}]}],
  ['wrong argument type',{version:runtime.SPEC_VERSION,steps:[{op:'LOAD_ARTIFACT',binding:7},{op:'ASSERT_EQ',value:1}]}],
  ['undeclared binding',{version:runtime.SPEC_VERSION,steps:[{op:'LOAD_ARTIFACT',binding:'MISSING'},{op:'READ_BYTES'},{op:'COUNT'},{op:'ASSERT_EQ',value:0}]}],
  ['unsupported json selector',{version:runtime.SPEC_VERSION,steps:[{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_JSON'},{op:'SELECT_JSON_PATH',path:'$..secret'},{op:'ASSERT_EQ',value:1}]}],
  ['unsafe regex',{version:runtime.SPEC_VERSION,steps:[{op:'REGEX',pattern:'(a+)+$'},{op:'ASSERT_EQ',value:true}]}],
  ['arbitrary source field',{version:runtime.SPEC_VERSION,steps:[{op:'ASSERT_EQ',value:true,source:'python: pass'}]}]
];
for(const [name,spec] of invalidCases)assert.equal(runtime.validateSpec(spec,{PRODUCT:'ARTIFACT-1'}).valid,false,`${name} was accepted.`);
for(const bad of [null,[],{PRODUCT:''},{'bad-name':'ARTIFACT-1'},{PRODUCT:{artifactId:'ART-1',unknown:true}}])assert.equal(runtime.validateBindings(bad).valid,false,`Invalid binding was accepted: ${JSON.stringify(bad)}`);
assert.equal(runtime.supports({EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:runtime.CAPABILITY,EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC:{version:'closed-loop-test-spec/999',steps:[]},EXECUTABLE_INPUT_BINDINGS:{}}),false,'Unsupported Test IR version was treated as executable.');
const workerSource=fs.readFileSync('test-worker.js','utf8');
for(const forbidden of ['eval(','new Function','import(','fetch(','XMLHttpRequest','WebSocket'])assert.ok(!workerSource.includes(forbidden),`Worker exposes prohibited dynamic/network primitive ${forbidden}`);
assert.ok(workerSource.includes('closedLoopTestRuntime.execute'),'Worker does not delegate to the application-owned deterministic runtime.');
console.log(JSON.stringify({testIrSchema:runtime.SPEC_VERSION,exactRegistry:true,unknownVersionRejected:true,unknownOperationRejected:true,unknownPropertyRejected:true,bindingValidation:true,arbitraryCodeRejected:true,workerNetworkSurfaceAbsent:true},null,2));
