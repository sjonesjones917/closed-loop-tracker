import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';

const context={console,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,structuredClone,crypto:webcrypto,Blob};
context.globalThis=context;
createVerifierRuntime(context);
vm.runInContext(fs.readFileSync('hash.js','utf8'),context,{filename:'hash.js'});
const runtimeSource=fs.readFileSync('test-runtime.js','utf8');
vm.runInContext(runtimeSource,context,{filename:'test-runtime.js'});
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

// Spec 21.3: unique step IDs, explicit operands, prior references and typed
// outputs. Each invalid fixture differs from a validated control in one rule.
// In particular, duplicate IDs must not ALSO leave another reference dangling.
const literalAssertions={...explicit,steps:['S001','S002'].map(stepId=>({stepId,op:'ASSERT_EQ',inputs:{actual:{literal:true},expected:{literal:true}}})),result:{stepRef:'S001',output:'assertion'}};
const dagCases=[
 {id:'duplicate-id',base:literalAssertions,mutate:s=>{s.steps[1].stepId='S001';},issue:'Duplicate stepId S001.'},
 {id:'forward-reference',base:explicit,mutate:s=>{[s.steps[0],s.steps[1]]=[s.steps[1],s.steps[0]];},issue:'Step 0 has a forward, missing, or cyclic reference to S001.'},
 {id:'missing-reference',base:literalAssertions,mutate:s=>{s.steps[0].inputs.actual={stepRef:'S999',output:'assertion'};},issue:'Step 0 has a forward, missing, or cyclic reference to S999.'},
 {id:'self-cycle',base:literalAssertions,mutate:s=>{s.steps[0].inputs.actual={stepRef:'S001',output:'assertion'};},issue:'Step 0 has a forward, missing, or cyclic reference to S001.'},
 {id:'two-step-cycle',base:literalAssertions,mutate:s=>{s.steps[0].inputs.actual={stepRef:'S002',output:'assertion'};s.steps[1].inputs.actual={stepRef:'S001',output:'assertion'};},issue:'Step 0 has a forward, missing, or cyclic reference to S002.'},
 {id:'unknown-output-port',base:explicit,mutate:s=>{s.steps[2].inputs.bytes.output='notARealPort';},issue:'Step 2 references unknown output port notARealPort on S002.'},
 {id:'wrong-output-type',base:explicit,mutate:s=>{s.steps[2].inputs.bytes={stepRef:'S001',output:'artifact'};},issue:'Step 2 input bytes requires BYTES but S001.artifact produces ARTIFACT.'},
 {id:'implicit-operand',base:literalAssertions,mutate:s=>{delete s.steps[0].inputs.actual;},issue:'Step 0 operation ASSERT_EQ is missing required input port actual.'},
 {id:'non-assertion-result',base:explicit,mutate:s=>{s.result={stepRef:'S006',output:'count'};},issue:'Test IR result must be a registered ASSERTION output; ordinary data cannot supply a determination.'}
];
function verifyDagCases(implementation){
 const results=[];
 for(const row of dagCases){
  const control=structuredClone(row.base),invalid=structuredClone(row.base),bindings={PRODUCT:{kind:'ARTIFACT',artifactId:'ART-1'}};
  assert.deepEqual(plain(implementation.validateSpec(control,bindings)),{valid:true,issues:[]},'DAG_CONTROL_ORACLE: '+row.id);
  row.mutate(invalid);
  const observed=plain(implementation.validateSpec(invalid,bindings));
  assert.deepEqual(observed,{valid:false,issues:[row.issue]},'DAG_REJECTION_ORACLE: '+row.id);
  assert.deepEqual(plain(implementation.validateSpec(control,bindings)),{valid:true,issues:[]},'DAG_REPAIRED_CONTROL_ORACLE: '+row.id);
  results.push({caseId:row.id,result:'PASS',expectedIssue:row.issue,observed});
 }
 return results;
}
const dagResults=verifyDagCases(runtime),dagFaults=[];
for(const [fault,before,after,oracle] of [
 ['duplicate-check-bypassed','else if(ids.has(step.stepId))issues.push(`Duplicate stepId ${step.stepId}.`);','', 'duplicate-id'],
 ['prior-reference-check-bypassed','if(!prior.has(ref.stepRef))issues.push(`Step ${index} has a forward, missing, or cyclic reference to ${ref.stepRef}.`);','if(!prior.has(ref.stepRef)){}','forward-reference'],
 ['output-port-check-bypassed','issues.push(`Step ${index} references unknown output port ${ref.output} on ${ref.stepRef}.`);','void 0;','unknown-output-port'],
 ['output-type-check-bypassed','if(acceptedTypes&&!acceptedTypes.includes(producedType))','if(false)','wrong-output-type'],
 ['explicit-input-check-bypassed','if(!hasOwn(step.inputs,key))issues.push(`Step ${index} operation ${step.op} is missing required input port ${key}.`);','if(false){}','implicit-operand'],
 ['assertion-result-check-bypassed',"if(contract.outputs[spec.result.output]!=='ASSERTION'||!ASSERTION_OPS.has(prior.get(spec.result.stepRef).op))","if(false)",'non-assertion-result']
]){
 assert.equal(runtimeSource.split(before).length,2,'DAG_FAULT_ANCHOR_ORACLE: '+fault);
 const mutant=createVerifierRuntime();
 vm.runInContext(fs.readFileSync('hash.js','utf8'),mutant,{filename:'hash.js'});
 vm.runInContext(runtimeSource.replace(before,after),mutant,{filename:'test-runtime.js'});
 assert.throws(()=>verifyDagCases(mutant.closedLoopTestRuntime),error=>error.code==='ERR_ASSERTION'&&error.message.startsWith('DAG_REJECTION_ORACLE: '+oracle),'DAG_FAULT_DETECTION_ORACLE: '+fault);
 dagFaults.push({fault,detectedBy:'DAG_REJECTION_ORACLE: '+oracle,result:'DETECTED'});
}
verifyDagCases(runtime);
assert.equal(fs.readFileSync('test-runtime.js','utf8'),runtimeSource,'DAG_SOURCE_UNCHANGED_ORACLE');

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

console.log(JSON.stringify({explicitDag:true,typedPorts:true,forwardReferenceRejected:true,legacyCompiledBeforeExecution:true,regexContract:true,jsonSelectorContract:true,dagResults,dagFaults,productionSourceUnchanged:true},null,2));
console.log('verify-test-runtime-dag: PASS');
