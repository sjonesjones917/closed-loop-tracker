import './verify-contract-closure.mjs';
import './verify-test-worker-isolation.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createVerifierRuntime} from './verifier-runtime.mjs';
const context={console,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,structuredClone,crypto:globalThis.crypto};
context.globalThis=context;createVerifierRuntime(context);vm.runInContext(fs.readFileSync('test-runtime.js','utf8'),context,{filename:'test-runtime.js'});
const r=context.closedLoopTestRuntime;
const base={version:r.SPEC_VERSION,languageVersion:r.TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:r.OPERATION_REGISTRY_VERSION,operationRegistrySha256:r.OPERATION_REGISTRY_SHA256,steps:[
 {stepId:'S001',op:'LOAD_ARTIFACT',inputs:{binding:{bindingRef:'PRODUCT'}}},
 {stepId:'S002',op:'READ_BYTES',inputs:{artifact:{stepRef:'S001',output:'artifact'}}},
 {stepId:'S003',op:'DECODE_UTF8',inputs:{bytes:{stepRef:'S002',output:'bytes'}}},
 {stepId:'S004',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S003',output:'text'},expected:{literal:'expected'}}}
],result:{stepRef:'S004',output:'assertion'}};
assert.equal(r.validateSpec(base,{PRODUCT:'ARTIFACT-1'}).valid,true);
const wrong={...base,steps:[...base.steps.slice(0,3),
 {stepId:'S004',op:'PARSE_JSON',inputs:{text:{stepRef:'S003',output:'text'}}},
 {stepId:'S005',op:'COUNT',inputs:{value:{stepRef:'S004',output:'value'}}},
 {stepId:'S006',op:'DECODE_UTF8',inputs:{bytes:{stepRef:'S005',output:'count'}}},
 {stepId:'S007',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S006',output:'text'},expected:{literal:'expected'}}}
],result:{stepRef:'S007',output:'assertion'}};
const check=r.validateSpec(wrong,{PRODUCT:'ARTIFACT-1'});assert.equal(check.valid,false);assert(check.issues.some(x=>/requires BYTES.*produces INTEGER/.test(x)),check.issues.join('\n'));
const wrongBytes={...base,steps:[...base.steps.slice(0,2),
 {stepId:'S003',op:'HASH_SHA256',inputs:{bytes:{stepRef:'S001',output:'artifact'}}},
 {stepId:'S004',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S003',output:'sha256'},expected:{literal:'expected'}}}
]};
const check2=r.validateSpec(wrongBytes,{PRODUCT:'ARTIFACT-1'});assert.equal(check2.valid,false);assert(check2.issues.some(x=>/requires BYTES.*produces ARTIFACT/.test(x)),check2.issues.join('\n'));
const nonAssertion={...base,result:{stepRef:'S003',output:'text'}};
assert.equal(r.validateSpec(nonAssertion,{PRODUCT:'ARTIFACT-1'}).valid,false,'A well-typed intermediate value is not a terminal determination.');
console.log(JSON.stringify({testIrPortTypes:'PASS',wrongPortTypeRejected:true,terminalAssertionRequired:true}));
