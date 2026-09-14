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

const validationCases=[];
function invalidOnly(id,good,mutate,reason){
 const baseline=runtime.validateSpec(good);assert.equal(baseline.valid,true,id+': invalid baseline: '+baseline.issues.join('; '));
 const bad=structuredClone(good);mutate(bad);const actual=runtime.validateSpec(bad);
 assert.equal(actual.valid,false,id+': violation accepted');assert(actual.issues.some(issue=>reason.test(issue)),id+': wrong rejection: '+actual.issues.join('; '));
 assert.equal(runtime.validateSpec(good).valid,true,id+': repaired input did not progress');validationCases.push({id,result:'PASS',actualIssues:actual.issues,corrected:'PASS'});
}
const parseSteps=kind=>[{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:kind}];
const tooDeepJsonPath='$.'+Array(runtime.LIMITS.maxSelectorDepth+1).fill('x').join('.');
invalidOnly('json-selector-depth',spec([...parseSteps('PARSE_JSON'),{op:'SELECT_JSON_PATH',path:'$.x'},{op:'ASSERT_EQ',value:true}]),s=>s.steps[4].path=tooDeepJsonPath,/JSON selector exceeds.*depth limit/);
const tooDeepXmlPath='/'+Array(runtime.LIMITS.maxSelectorDepth+1).fill('x').join('/');
invalidOnly('xml-selector-depth',spec([...parseSteps('PARSE_XML'),{op:'SELECT_XML',path:'/root/x'},{op:'COUNT'},{op:'ASSERT_EQ',value:1}]),s=>s.steps[4].path=tooDeepXmlPath,/XML selector exceeds.*depth limit/);

for(const [kind,op,path,badPath] of [['PARSE_JSON','SELECT_JSON_PATH','$.x',tooDeepJsonPath],['PARSE_XML','SELECT_XML','/root/x',tooDeepXmlPath]]){
 const canonical=runtime.normalizeSpec(spec([...parseSteps(kind),{op,path},{op:'COUNT'},{op:'ASSERT_EQ',value:1}]));
 invalidOnly('canonical-'+op+'-depth',canonical,s=>s.steps[4].inputs.path.literal=badPath,/selector exceeds.*depth limit/);
}
const longPattern='a'.repeat(runtime.LIMITS.maxRegexPatternBytes+1);
invalidOnly('regex-pattern-bytes',spec([{op:'LOAD_ARTIFACT',binding:'TEXT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_MATCH',pattern:'a'}]),s=>s.steps[3].pattern=longPattern,/Regex pattern exceeds.*byte limit/);
const regexInput='a'.repeat(runtime.LIMITS.maxRegexInputBytes+1);
await rejectsCode(runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'TEXT'},{op:'ASSERT_MATCH',pattern:'a+'}]),canonicalBindings:{TEXT:{value:regexInput}},metadata:{bindings:{TEXT:{kind:'CANONICAL_VALUE',canonicalKey:'TEXT'}}}}),'REGEX_INPUT_LIMIT');

const csvCells=runtime.LIMITS.maxCsvCells+1;const csvText=Array(csvCells).fill('x').join(',');
await rejectsCode(runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_CSV',delimiter:',',header:false,quote:'"',newline:'AUTO',encoding:'UTF-8'},{op:'COUNT'},{op:'ASSERT_EQ',value:1}]),artifacts:{PRODUCT:binding('ART-CSV',encoder.encode(csvText))},metadata:metadata(['PRODUCT'])}),'CSV_CELL_LIMIT');

const xmlText='<root>'+Array(runtime.LIMITS.maxXmlNodes+1).fill('<n/>').join('')+'</root>';
await rejectsCode(runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_XML'},{op:'SELECT_XML',path:'/root/n'},{op:'COUNT'},{op:'ASSERT_EQ',value:1}]),artifacts:{PRODUCT:binding('ART-XML',encoder.encode(xmlText))},metadata:metadata(['PRODUCT'])}),'XML_NODE_LIMIT');

const literalTest=spec([{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:'x'}]);
for(const field of ['javascript','python'])invalidOnly('forbidden-'+field,literalTest,s=>s.steps[3][field]='executable source',new RegExp('unknown property '+field));
invalidOnly('forbidden-shell-operation',literalTest,s=>s.steps[3]={op:'SHELL',command:'echo no'},/Unknown|unknown|not registered|Unsupported/);

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

console.log(JSON.stringify({verifyTestRuntimeLimits:'PASS',limits:Object.keys(runtime.LIMITS).sort(),totalInputBoundary:true,textBoundary:true,parsedDepthBoundary:true,collectionBoundary:true,selectorDepthBoundary:true,regexPatternBoundary:true,regexInputBoundary:true,csvCellBoundary:true,xmlNodeBoundary:true,workerTimeoutBoundary:true,hashAuthority:true,oneArtifact:true,multiArtifact:true,arbitrarySourceExamplesRejected:true,validationCases,resourceEnvelopeBoundaries}));
