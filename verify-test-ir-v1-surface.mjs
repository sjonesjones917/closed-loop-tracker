import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

globalThis.crypto=globalThis.crypto||webcrypto;
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
vm.runInThisContext(fs.readFileSync(new URL('./test-runtime.js',import.meta.url),'utf8'),{filename:'test-runtime.js'});
const runtime=globalThis.closedLoopTestRuntime;
assert(runtime,'Test IR runtime did not load.');

const exactOps=[
  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML',
  'COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE',
  'ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'
];
assert.deepEqual([...runtime.OPS],exactOps,'Version 1 operation registry must be the exact closed Section 21.4 set.');
for(const forbidden of ['ASSERT_EXISTS','ASSERT_TYPE','ASSERT_NE','CUSTOM_PIPELINE']){
  const check=runtime.validateSpec({version:'closed-loop-test-spec/1',steps:[{op:forbidden}]});
  assert.equal(check.valid,false,`${forbidden} must not be accepted by Version 1.`);
}
const spec=steps=>({version:'closed-loop-test-spec/1',steps});
const bindingMetadata=name=>({bindings:{[name]:{kind:'CANONICAL_VALUE',canonicalKey:name}}});

for(const pattern of ['(ab)+','(?:ab)+','^(a|b)+$']){
  const check=runtime.validateSpec(spec([{op:'LOAD_ARTIFACT',binding:'TEXT'},{op:'REGEX',pattern},{op:'ASSERT_EQ',value:true}]),{TEXT:{kind:'CANONICAL_VALUE',canonicalKey:'TEXT'}});
  assert.equal(check.valid,true,`Required safe grouping pattern ${pattern} was rejected: ${check.issues.join(' ')}`);
}
for(const pattern of ['(a)\\1','(?=a)a','(?!b)a','(?<=a)b','(?<!a)b','\\p{L}+']){
  const check=runtime.validateSpec(spec([{op:'LOAD_ARTIFACT',binding:'TEXT'},{op:'REGEX',pattern,flags:pattern.includes('\\p')?'u':''},{op:'ASSERT_EQ',value:true}]),{TEXT:{kind:'CANONICAL_VALUE',canonicalKey:'TEXT'}});
  assert.equal(check.valid,false,`Prohibited regex construct ${pattern} was accepted.`);
}
const grouped=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'TEXT'},{op:'REGEX',pattern:'(?:ab)+'},{op:'ASSERT_EQ',value:true}]),canonicalBindings:{TEXT:'abab'},metadata:bindingMetadata('TEXT')});
assert.equal(grouped.determination,'SATISFIED','Non-capturing groups must execute under the registered regex subset.');

const bracket=await runtime.execute({
  spec:spec([{op:'LOAD_ARTIFACT',binding:'JSON_TEXT'},{op:'PARSE_JSON'},{op:'SELECT_JSON_PATH',path:"$['odd-key']"},{op:'ASSERT_EQ',value:'value'}]),
  canonicalBindings:{JSON_TEXT:'{"odd-key":"value"}'},metadata:bindingMetadata('JSON_TEXT')
});
assert.equal(bracket.determination,'SATISFIED','Single-quoted bracket child access must execute.');
const wildcard=await runtime.execute({
  spec:spec([{op:'LOAD_ARTIFACT',binding:'JSON_TEXT'},{op:'PARSE_JSON'},{op:'SELECT_JSON_PATH',path:'$.items.*'},{op:'COUNT'},{op:'ASSERT_EQ',value:2}]),
  canonicalBindings:{JSON_TEXT:'{"items":[{"v":1},{"v":2}]}'},metadata:bindingMetadata('JSON_TEXT')
});
assert.equal(wildcard.determination,'SATISFIED','JSON wildcard must select array elements in document order.');

const xml=await runtime.execute({
  spec:spec([{op:'LOAD_ARTIFACT',binding:'XML_TEXT'},{op:'PARSE_XML'},{op:'SELECT_XML',path:'/root/*/text()'},{op:'ASSERT_SET_EQUAL',value:['one','two']}]),
  canonicalBindings:{XML_TEXT:'<root><a>one</a><b>two</b></root>'},metadata:bindingMetadata('XML_TEXT')
});
assert.equal(xml.determination,'SATISFIED','XML element wildcard must execute in document order.');
for(const path of ['$.items[0:2]','$.items..v','$.items[?(@.v)]']){
  const check=runtime.validateSpec(spec([{op:'LOAD_ARTIFACT',binding:'JSON_TEXT'},{op:'PARSE_JSON'},{op:'SELECT_JSON_PATH',path},{op:'COUNT'},{op:'ASSERT_EQ',value:1}]),{JSON_TEXT:{kind:'CANONICAL_VALUE',canonicalKey:'JSON_TEXT'}});
  assert.equal(check.valid,false,`Excluded JSON selector syntax ${path} was accepted.`);
}
for(const path of ['//a','/root/a[@x]','/root/a[last()]']){
  const check=runtime.validateSpec(spec([{op:'LOAD_ARTIFACT',binding:'XML_TEXT'},{op:'PARSE_XML'},{op:'SELECT_XML',path},{op:'COUNT'},{op:'ASSERT_EQ',value:1}]),{XML_TEXT:{kind:'CANONICAL_VALUE',canonicalKey:'XML_TEXT'}});
  assert.equal(check.valid,false,`Excluded XML selector syntax ${path} was accepted.`);
}
console.log(JSON.stringify({testIrV1Surface:'PASS',operations:exactOps.length,jsonSelectorRegistry:'closed-loop-json-selector/1',xmlSelectorRegistry:'closed-loop-xml-selector/1',regexRegistry:'closed-loop-regex/1'}));
