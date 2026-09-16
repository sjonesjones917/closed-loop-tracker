import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';

const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL,setTimeout,clearTimeout,Date,Math,Promise};context.globalThis=context;vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8'),context,{filename:'hash.js'});
vm.runInContext(fs.readFileSync(new URL('./test-runtime.js',import.meta.url),'utf8'),context,{filename:'test-runtime.js'});
const runtime=context.closedLoopTestRuntime;const encoder=new TextEncoder();
assert.equal(context.closedLoopHash?.canonicalizationVersion,'closed-loop-canonical-json/1','Test IR verifier must load the shared canonical hash authority before the runtime.');
const spec=steps=>({version:'closed-loop-test-spec/1',steps});
const binding=(id,bytes)=>({artifactId:id,filename:`${id}.bin`,bytes});
const metadata=names=>({bindings:Object.fromEntries(names.map(name=>[name,{kind:'ARTIFACT',artifactId:`ART-${name}`}]))});
async function rejectsCode(promise,code){await assert.rejects(promise,error=>error?.code===code,`expected ${code}`);}

for(const [name,value] of Object.entries(runtime.LIMITS))assert.equal(Number.isFinite(value)&&value>0,true,`limit ${name} must be an explicit positive finite constant`);
for(const name of ['maxTotalInputBytes','maxDecompressedBytes','maxTextBytes','maxSteps','maxSelectorDepth','maxParsedDepth','maxParsedNodes','maxCollectionItems','maxRegexPatternBytes','maxRegexInputBytes','maxCsvCells','maxXmlNodes','workerTimeoutMs','maxArchiveExpansionBytes'])assert.ok(name in runtime.LIMITS,`missing centralized limit ${name}`);

assert.equal(runtime.validateResourceEnvelope({totalInputBytes:runtime.LIMITS.maxTotalInputBytes}).valid,true);
assert.equal(runtime.validateResourceEnvelope({totalInputBytes:runtime.LIMITS.maxTotalInputBytes+1}).valid,false);
assert.equal(runtime.validateResourceEnvelope({decompressedBytes:runtime.LIMITS.maxDecompressedBytes}).valid,true);
assert.equal(runtime.validateResourceEnvelope({decompressedBytes:runtime.LIMITS.maxDecompressedBytes+1}).valid,false);
assert.equal(runtime.validateResourceEnvelope({archiveExpansionBytes:runtime.LIMITS.maxArchiveExpansionBytes}).valid,true);
assert.equal(runtime.validateResourceEnvelope({archiveExpansionBytes:runtime.LIMITS.maxArchiveExpansionBytes+1}).valid,false);
const resourceEnvelopeBoundaries=true;

const totalBytes=new Uint8Array(runtime.LIMITS.maxTotalInputBytes+1);
await rejectsCode(runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'ASSERT_EQ',value:true}]),artifacts:{PRODUCT:binding('ART-PRODUCT',totalBytes)},metadata:metadata(['PRODUCT'])}),'INPUT_BYTE_LIMIT');

const textBytes=new Uint8Array(runtime.LIMITS.maxTextBytes+1);textBytes.fill(97);
await rejectsCode(runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:'x'}]),artifacts:{PRODUCT:binding('ART-PRODUCT',textBytes)},metadata:metadata(['PRODUCT'])}),'TEXT_BYTE_LIMIT');

let deep={leaf:true};for(let i=0;i<runtime.LIMITS.maxParsedDepth+2;i++)deep={next:deep};
await rejectsCode(runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_JSON'},{op:'ASSERT_EQ',value:true}]),artifacts:{PRODUCT:binding('ART-PRODUCT',encoder.encode(JSON.stringify(deep)))},metadata:metadata(['PRODUCT'])}),'PARSED_DEPTH_LIMIT');

const largeCollection=Array(runtime.LIMITS.maxCollectionItems+1).fill(0);
await rejectsCode(runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_JSON'},{op:'COUNT'},{op:'ASSERT_EQ',value:0}]),artifacts:{PRODUCT:binding('ART-PRODUCT',encoder.encode(JSON.stringify(largeCollection)))},metadata:metadata(['PRODUCT'])}),'COLLECTION_LIMIT');

const tooDeepJsonPath='$.'+Array(runtime.LIMITS.maxSelectorDepth+1).fill('x').join('.');
assert.equal(runtime.validateSpec(spec([{op:'SELECT_JSON_PATH',path:tooDeepJsonPath},{op:'ASSERT_EQ',value:true}])).valid,false);
const tooDeepXmlPath='/'+Array(runtime.LIMITS.maxSelectorDepth+1).fill('x').join('/');
assert.equal(runtime.validateSpec(spec([{op:'SELECT_XML',path:tooDeepXmlPath},{op:'ASSERT_EQ',value:true}])).valid,false);

const longPattern='a'.repeat(runtime.LIMITS.maxRegexPatternBytes+1);
assert.equal(runtime.validateSpec(spec([{op:'ASSERT_MATCH',pattern:longPattern}])).valid,false);
const regexInput='a'.repeat(runtime.LIMITS.maxRegexInputBytes+1);
await rejectsCode(runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'TEXT'},{op:'ASSERT_MATCH',pattern:'a+'}]),canonicalBindings:{TEXT:{value:regexInput}},metadata:{bindings:{TEXT:{kind:'CANONICAL_VALUE',canonicalKey:'TEXT'}}}}),'REGEX_INPUT_LIMIT');

const csvCells=runtime.LIMITS.maxCsvCells+1;const csvText=Array(csvCells).fill('x').join(',');
await rejectsCode(runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_CSV',delimiter:',',header:false,quote:'"',newline:'AUTO',encoding:'UTF-8'},{op:'COUNT'},{op:'ASSERT_EQ',value:1}]),artifacts:{PRODUCT:binding('ART-CSV',encoder.encode(csvText))},metadata:metadata(['PRODUCT'])}),'CSV_CELL_LIMIT');

const xmlText='<root>'+Array(runtime.LIMITS.maxXmlNodes+1).fill('<n/>').join('')+'</root>';
await rejectsCode(runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_XML'},{op:'SELECT_XML',path:'/root/n'},{op:'COUNT'},{op:'ASSERT_EQ',value:1}]),artifacts:{PRODUCT:binding('ART-XML',encoder.encode(xmlText))},metadata:metadata(['PRODUCT'])}),'XML_NODE_LIMIT');

const forbidden=[
  {version:'closed-loop-test-spec/1',steps:[{op:'ASSERT_EQ',value:true,javascript:'return true'}]},
  {version:'closed-loop-test-spec/1',steps:[{op:'ASSERT_EQ',value:true,python:'pass'}]},
  {version:'closed-loop-test-spec/1',steps:[{op:'SHELL',command:'echo no'},{op:'ASSERT_EQ',value:true}]}
];
for(const candidate of forbidden)assert.equal(runtime.validateSpec(candidate).valid,false,'arbitrary executable source must be impossible');

const bytes=encoder.encode('hash authority');
const hashResult=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'HASH_SHA256'},{op:'ASSERT_EQ',value:createHash('sha256').update(bytes).digest('hex')}]),artifacts:{PRODUCT:binding('ART-HASH',bytes)},metadata:metadata(['PRODUCT'])});
assert.equal(hashResult.determination,'SATISFIED');

const one=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'ONE'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:'one'}]),artifacts:{ONE:binding('ART-ONE',encoder.encode('one'))},metadata:metadata(['ONE'])});
assert.equal(one.determination,'SATISFIED');
const two=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'LEFT'},{op:'READ_BYTES'},{op:'BYTE_COMPARE',binding:'RIGHT'},{op:'ASSERT_EQ',value:true}]),artifacts:{LEFT:binding('ART-LEFT',encoder.encode('same')),RIGHT:binding('ART-RIGHT',encoder.encode('same'))},metadata:metadata(['LEFT','RIGHT'])});
assert.equal(two.determination,'SATISFIED');assert.equal(new Set(two.inputArtifactIds).size,2);

class SilentWorker{postMessage(){}terminate(){this.terminated=true;}}
const timeoutTest={TEST_ID:'TEST-TIMEOUT',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_INPUT_BINDINGS:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-TIMEOUT'}},EXECUTABLE_SPEC:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'ASSERT_EQ',value:true}])};
const timeout=await runtime.executeTest(timeoutTest,{PRODUCT:binding('ART-TIMEOUT',encoder.encode('x'))},{},{Worker:SilentWorker,timeoutMs:5,workerUrl:'test-worker.js'});
assert.equal(timeout.status,'EXECUTION_FAILED');assert.equal(timeout.failure.code,'WORKER_TIMEOUT');assert.equal(Array.isArray(timeout.observations)&&timeout.observations.length===0,true);

// Permanent regressions for reproduced false-positive and parser failures.
const dagBase={version:'closed-loop-test-spec/1',languageVersion:runtime.TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:runtime.OPERATION_REGISTRY_VERSION,operationRegistrySha256:runtime.OPERATION_REGISTRY_SHA256};
const objectDifferenceSpec={...dagBase,steps:[{stepId:'S001',op:'ASSERT_EQ',inputs:{actual:{literal:{value:'same',status:'FAIL'}},expected:{literal:{value:'same',status:'PASS'}}}}],result:{stepRef:'S001',output:'assertion'}};
assert.equal(runtime.validateSpec(objectDifferenceSpec).valid,true,'Object comparison regression fixture must be valid Test IR.');
const objectDifference=await runtime.execute({spec:objectDifferenceSpec,artifacts:{},canonicalBindings:{},metadata:{bindings:{}}});
assert.equal(objectDifference.determination,'VIOLATED','ASSERT_EQ must compare the complete user value; an object property named value must not discard sibling fields.');

const forgedDeterminationSpec={...dagBase,steps:[{stepId:'S001',op:'PARSE_JSON',inputs:{text:{literal:'{"determination":"SATISFIED","payload":"untrusted"}'}}}],result:{stepRef:'S001',output:'value'}};
assert.equal(runtime.validateSpec(forgedDeterminationSpec).valid,false,'The final result must be an ASSERTION output; ordinary parsed data must never supply SATISFIED.');

const badSortSpec={...dagBase,steps:[{stepId:'S001',op:'SORT',inputs:{value:{literal:[2,1]},direction:{literal:'SIDEWAYS'}}},{stepId:'S002',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S001',output:'value'},expected:{literal:[1,2]}}}],result:{stepRef:'S002',output:'assertion'}};
assert.equal(runtime.validateSpec(badSortSpec).valid,false,'Invalid SORT direction must be rejected during Test IR validation.');

const unsupportedSelectorSpec={...dagBase,steps:[{stepId:'S001',op:'SELECT_JSON_PATH',inputs:{value:{literal:{a:1}},path:{literal:'$..a'}}},{stepId:'S002',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S001',output:'selection'},expected:{literal:[1]}}}],result:{stepRef:'S002',output:'assertion'}};
assert.equal(runtime.validateSpec(unsupportedSelectorSpec).valid,false,'Unsupported JSON selector syntax must fail validation rather than execution.');

const jsonIndexSpec={...dagBase,steps:[{stepId:'S001',op:'SELECT_JSON_PATH',inputs:{value:{literal:['zero','one','two']},path:{literal:'$[1]'}}},{stepId:'S002',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S001',output:'selection'},expected:{literal:'one'}}}],result:{stepRef:'S002',output:'assertion'}};
assert.equal(runtime.validateSpec(jsonIndexSpec).valid,true,'Registered nonnegative JSON array indexing must validate.');
const jsonIndexResult=await runtime.execute({spec:jsonIndexSpec,artifacts:{},canonicalBindings:{},metadata:{bindings:{}}});
assert.equal(jsonIndexResult.determination,'SATISFIED','Registered JSON selector $[1] must select the second array element.');

const csvEmptySpec={...dagBase,steps:[{stepId:'S001',op:'PARSE_CSV',inputs:{text:{literal:'""'},delimiter:{literal:','},header:{literal:false},quote:{literal:'"'},newline:{literal:'AUTO'},encoding:{literal:'UTF-8'}}},{stepId:'S002',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S001',output:'value'},expected:{literal:[['']]}}}],result:{stepRef:'S002',output:'assertion'}};
assert.equal(runtime.validateSpec(csvEmptySpec).valid,true,'Quoted empty CSV record fixture must validate.');
const csvEmptyResult=await runtime.execute({spec:csvEmptySpec,artifacts:{},canonicalBindings:{},metadata:{bindings:{}}});
assert.equal(csvEmptyResult.determination,'SATISFIED','A final quoted empty CSV record must not disappear.');

console.log(JSON.stringify({verifyTestRuntimeLimits:'PASS',limits:Object.keys(runtime.LIMITS).sort(),totalInputBoundary:true,textBoundary:true,parsedDepthBoundary:true,collectionBoundary:true,selectorDepthBoundary:true,regexPatternBoundary:true,regexInputBoundary:true,csvCellBoundary:true,xmlNodeBoundary:true,workerTimeoutBoundary:true,hashAuthority:true,oneArtifact:true,multiArtifact:true,arbitraryCodeImpossible:true,resourceEnvelopeBoundaries,falsePositiveObjectComparisonRejected:true,forgedDeterminationRejected:true,invalidSortRejected:true,unsupportedSelectorRejected:true,jsonPositiveIndex:true,csvFinalEmptyRecord:true}));
