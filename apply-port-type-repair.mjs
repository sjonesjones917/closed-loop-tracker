import fs from 'node:fs';

const runtimePath='test-runtime.js';
let source=fs.readFileSync(runtimePath,'utf8');
const insertionPoint="const OPS=Object.freeze(Object.keys(PORT_CONTRACTS));";
const inputTypes=`const INPUT_PORT_TYPES=Object.freeze({
  READ_BYTES:Object.freeze({artifact:Object.freeze(['ARTIFACT'])}),
  DECODE_UTF8:Object.freeze({bytes:Object.freeze(['BYTES'])}),
  PARSE_JSON:Object.freeze({text:Object.freeze(['STRING'])}),
  PARSE_CSV:Object.freeze({text:Object.freeze(['STRING'])}),
  PARSE_XML:Object.freeze({text:Object.freeze(['STRING'])}),
  SELECT_XML:Object.freeze({value:Object.freeze(['XML_NODE'])}),
  HASH_SHA256:Object.freeze({bytes:Object.freeze(['BYTES'])}),
  BYTE_COMPARE:Object.freeze({left:Object.freeze(['BYTES']),right:Object.freeze(['BYTES'])})
});
${insertionPoint}`;
if(!source.includes(insertionPoint))throw new Error('test-runtime insertion point missing');
source=source.replace(insertionPoint,inputTypes);
const oldValidation="else {const priorStep=prior.get(ref.stepRef),priorContract=PORT_CONTRACTS[priorStep.op];if(!priorContract||!hasOwn(priorContract.outputs,ref.output))issues.push(`Step ${index} references unknown output port ${ref.output} on ${ref.stepRef}.`);}";
const newValidation="else {const priorStep=prior.get(ref.stepRef),priorContract=PORT_CONTRACTS[priorStep.op];if(!priorContract||!hasOwn(priorContract.outputs,ref.output))issues.push(`Step ${index} references unknown output port ${ref.output} on ${ref.stepRef}.`);else {const producedType=priorContract.outputs[ref.output],acceptedTypes=INPUT_PORT_TYPES[step.op]?.[name];if(acceptedTypes&&!acceptedTypes.includes(producedType))issues.push(`Step ${index} input ${name} requires ${acceptedTypes.join(' or ')} but ${ref.stepRef}.${ref.output} produces ${producedType}.`);}}";
if(!source.includes(oldValidation))throw new Error('test-runtime reference validation point missing');
source=source.replace(oldValidation,newValidation);
const oldExport='root.closedLoopTestRuntime=Object.freeze({VERSION,SPEC_VERSION,EXECUTABLE_KIND,CAPABILITY,TEST_IR_LANGUAGE_VERSION,OPERATION_REGISTRY_VERSION,OPERATION_REGISTRY_SHA256,JSON_SELECTOR_REGISTRY_VERSION,JSON_SELECTOR_REGISTRY_SHA256,XML_SELECTOR_REGISTRY_VERSION,XML_SELECTOR_REGISTRY_SHA256,REGEX_REGISTRY_VERSION,REGEX_REGISTRY_SHA256,OPS,OP_DEFINITIONS,PORT_CONTRACTS,LIMITS,STATUS';
const newExport='root.closedLoopTestRuntime=Object.freeze({VERSION,SPEC_VERSION,EXECUTABLE_KIND,CAPABILITY,TEST_IR_LANGUAGE_VERSION,OPERATION_REGISTRY_VERSION,OPERATION_REGISTRY_SHA256,JSON_SELECTOR_REGISTRY_VERSION,JSON_SELECTOR_REGISTRY_SHA256,XML_SELECTOR_REGISTRY_VERSION,XML_SELECTOR_REGISTRY_SHA256,REGEX_REGISTRY_VERSION,REGEX_REGISTRY_SHA256,OPS,OP_DEFINITIONS,PORT_CONTRACTS,INPUT_PORT_TYPES,LIMITS,STATUS';
if(!source.includes(oldExport))throw new Error('test-runtime export point missing');
fs.writeFileSync(runtimePath,source.replace(oldExport,newExport));

fs.writeFileSync('verify-test-ir-port-types.mjs',`import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const context={console,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,structuredClone,crypto:globalThis.crypto};context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync('test-runtime.js','utf8'),context,{filename:'test-runtime.js'});const r=context.closedLoopTestRuntime;
const base={version:r.SPEC_VERSION,languageVersion:r.TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:r.OPERATION_REGISTRY_VERSION,operationRegistrySha256:r.OPERATION_REGISTRY_SHA256,steps:[{stepId:'S001',op:'LOAD_ARTIFACT',inputs:{binding:{bindingRef:'PRODUCT'}}},{stepId:'S002',op:'READ_BYTES',inputs:{artifact:{stepRef:'S001',output:'artifact'}}},{stepId:'S003',op:'DECODE_UTF8',inputs:{bytes:{stepRef:'S002',output:'bytes'}}}],result:{stepRef:'S003',output:'text'}};
assert.equal(r.validateSpec(base,{PRODUCT:'ARTIFACT-1'}).valid,true);
const wrong={...base,steps:[...base.steps,{stepId:'S004',op:'PARSE_JSON',inputs:{text:{stepRef:'S003',output:'text'}}},{stepId:'S005',op:'COUNT',inputs:{value:{stepRef:'S004',output:'value'}}},{stepId:'S006',op:'DECODE_UTF8',inputs:{bytes:{stepRef:'S005',output:'count'}}}],result:{stepRef:'S006',output:'text'}};
const check=r.validateSpec(wrong,{PRODUCT:'ARTIFACT-1'});assert.equal(check.valid,false);assert(check.issues.some(x=>/requires BYTES.*produces INTEGER/.test(x)),check.issues.join('\\n'));
const wrongBytes={...base,steps:[{stepId:'S001',op:'LOAD_ARTIFACT',inputs:{binding:{bindingRef:'PRODUCT'}}},{stepId:'S002',op:'READ_BYTES',inputs:{artifact:{stepRef:'S001',output:'artifact'}}},{stepId:'S003',op:'HASH_SHA256',inputs:{bytes:{stepRef:'S001',output:'artifact'}}}],result:{stepRef:'S003',output:'sha256'}};const check2=r.validateSpec(wrongBytes,{PRODUCT:'ARTIFACT-1'});assert.equal(check2.valid,false);assert(check2.issues.some(x=>/requires BYTES.*produces ARTIFACT/.test(x)),check2.issues.join('\\n'));
console.log(JSON.stringify({testIrPortTypes:'PASS',wrongPortTypeRejected:true}));
`);

const v3='verify-v3-contract.mjs';
let v3Source=fs.readFileSync(v3,'utf8');
if(!v3Source.includes("import './verify-test-ir-port-types.mjs';")){
  const marker="import fs from 'node:fs';";
  if(!v3Source.includes(marker))throw new Error('verify-v3-contract import point missing');
  v3Source=v3Source.replace(marker,"import './verify-test-ir-port-types.mjs';\n"+marker);
  fs.writeFileSync(v3,v3Source);
}
fs.unlinkSync(new URL(import.meta.url));
