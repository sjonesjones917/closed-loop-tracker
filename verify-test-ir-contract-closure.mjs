import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const context={console,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,structuredClone,crypto:webcrypto,Blob};
context.globalThis=context;
vm.createContext(context);
for(const file of ['hash.js','test-runtime.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const runtime=context.closedLoopTestRuntime;
assert.ok(runtime,'test-runtime.js did not load');

const binding={PRODUCT:{kind:'ARTIFACT',artifactId:'ART-PORT-CLOSURE'}};
const dag=steps=>({
  version:runtime.SPEC_VERSION,
  languageVersion:runtime.TEST_IR_LANGUAGE_VERSION,
  operationRegistryVersion:runtime.OPERATION_REGISTRY_VERSION,
  operationRegistrySha256:runtime.OPERATION_REGISTRY_SHA256,
  steps,
  result:{stepRef:steps.at(-1).stepId,output:Object.keys(runtime.PORT_CONTRACTS[steps.at(-1).op].outputs)[0]}
});

for(const [operation,contract] of Object.entries(runtime.PORT_CONTRACTS)){
  assert.ok(runtime.INPUT_PORT_TYPES[operation],`${operation} has no registered input-type contract`);
  for(const port of [...contract.requiredInputs,...contract.optionalInputs]){
    assert.ok(Array.isArray(runtime.INPUT_PORT_TYPES[operation][port])&&runtime.INPUT_PORT_TYPES[operation][port].length>0,`${operation}.${port} has no exact accepted-type contract`);
  }
}

const artifactIntoCount=dag([
  {stepId:'S001',op:'LOAD_ARTIFACT',inputs:{binding:{bindingRef:'PRODUCT'}}},
  {stepId:'S002',op:'COUNT',inputs:{value:{stepRef:'S001',output:'artifact'}}}
]);
const artifactCountCheck=runtime.validateSpec(artifactIntoCount,binding);
assert.equal(artifactCountCheck.valid,false,'COUNT must reject an ARTIFACT input during DAG validation');
assert.ok(artifactCountCheck.issues.some(issue=>/COUNT|requires/.test(issue)),artifactCountCheck.issues.join('\n'));

const bytesIntoRegexAssertion=dag([
  {stepId:'S001',op:'LOAD_ARTIFACT',inputs:{binding:{bindingRef:'PRODUCT'}}},
  {stepId:'S002',op:'READ_BYTES',inputs:{artifact:{stepRef:'S001',output:'artifact'}}},
  {stepId:'S003',op:'ASSERT_MATCH',inputs:{actual:{stepRef:'S002',output:'bytes'},pattern:{literal:'x'}}}
]);
const bytesRegexCheck=runtime.validateSpec(bytesIntoRegexAssertion,binding);
assert.equal(bytesRegexCheck.valid,false,'ASSERT_MATCH must reject BYTES during DAG validation');
assert.ok(bytesRegexCheck.issues.some(issue=>/ASSERT_MATCH|requires/.test(issue)),bytesRegexCheck.issues.join('\n'));

console.log(JSON.stringify({testIrContractClosure:'PASS',operations:Object.keys(runtime.PORT_CONTRACTS).length,wrongTypedEdgesRejected:2}));
