import fs from 'node:fs';
import assert from 'node:assert/strict';

const workbook=fs.readFileSync(new URL('./workbook.js',import.meta.url),'utf8');
const schema=fs.readFileSync(new URL('./workflow-schema.js',import.meta.url),'utf8');
const fixture=fs.readFileSync(new URL('./TEST_PROJECT.json',import.meta.url),'utf8');
const complete=fs.readFileSync(new URL('./verify-complete.mjs',import.meta.url),'utf8');

for(const [name,source] of [['workbook.js',workbook],['workflow-schema.js',schema],['TEST_PROJECT.json',fixture],['verify-complete.mjs',complete]]){
  assert.doesNotMatch(source,/HASHES_RECORDED_WHERE_PRACTICAL/,`${name} retains the obsolete best-effort Stage 10 hashing field.`);
}
assert.match(workbook,/ALL_FROZEN_COMPONENT_BYTES_HASHED/,'Stage 10 workbook contract must require every frozen component byte set to be hashed.');
assert.match(schema,/ALL_FROZEN_COMPONENT_BYTES_HASHED/,'Stage 10 schema contract must require every frozen component byte set to be hashed.');
assert.match(fixture,/ALL_FROZEN_COMPONENT_BYTES_HASHED/,'The retained project fixture must use the controlling Stage 10 field.');

console.log(JSON.stringify({stage10FrozenComponentByteHashing:'PASS'}));
