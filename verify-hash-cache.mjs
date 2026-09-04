import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

vm.runInThisContext(fs.readFileSync('hash.js','utf8'),{filename:'hash.js'});
const hash=globalThis.closedLoopHash;

const expectedAbc='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
for(let index=0;index<1000;index++)assert.equal(hash.sha256Text('abc'),expectedAbc);

const retained=[];
for(let index=0;index<600;index++){
  const value=`bounded-cache-entry-${String(index).padStart(4,'0')}`;
  retained.push([value,hash.sha256Text(value)]);
}
for(const [value,digest] of retained)assert.equal(hash.sha256Text(value),digest);

const aboveCacheLimit='x'.repeat(65537),first=hash.sha256Text(aboveCacheLimit);
assert.equal(hash.sha256Text(aboveCacheLimit),first);
assert.equal(hash.sha256Value({b:2,a:1}),hash.sha256Value({a:1,b:2}));

console.log(JSON.stringify({hashCache:'PASS',knownVector:true,boundedEntryChurn:600,oversizedInputDeterministic:true}));
