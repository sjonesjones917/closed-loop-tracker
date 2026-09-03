import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';

const context={console,TextEncoder,TextDecoder,crypto:webcrypto,Blob};context.globalThis=context;vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8'),context,{filename:'hash.js'});
const h=context.closedLoopHash;
assert.ok(h,'hash runtime must load');
assert.equal(h.canonicalizationVersion,'closed-loop-canonical-json/1');
assert.equal(h.idVersion,'closed-loop-id/1');
assert.equal(typeof h.canonicalIdCandidate,'function');
assert.equal(typeof h.allocateCanonicalId,'function');

const inRuntime=value=>vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(value))})`,context);
const tupleValue={
  familyPrefix:'REQ',
  familyNamespace:'requirements',
  jobNamespace:'JOB-ALPHA',
  commandId:'COMMAND-17',
  targetSlot:'slot-9',
  parentId:'',
  allocationSequence:42,
  collisionCounter:0
};
const tuple=inRuntime(tupleValue);
const preimage=inRuntime({
  idVersion:'closed-loop-id/1',
  familyNamespace:'requirements',
  jobNamespace:'JOB-ALPHA',
  commandId:'COMMAND-17',
  targetSlot:'slot-9',
  parentId:'',
  allocationSequence:42,
  collisionCounter:0
});
const canonical='{"allocationSequence":42,"collisionCounter":0,"commandId":"COMMAND-17","familyNamespace":"requirements","idVersion":"closed-loop-id/1","jobNamespace":"JOB-ALPHA","parentId":"","targetSlot":"slot-9"}';
assert.equal(h.stableStringify(preimage),canonical,'ID preimage must use canonical JSON exactly.');
const digest=createHash('sha256').update(Buffer.from(canonical,'utf8')).digest();
const alphabet='0123456789abcdefghijklmnopqrstuv';
let bits=0,acc=0,payload='';
for(const byte of digest.subarray(0,20)){
  acc=(acc<<8)|byte;bits+=8;
  while(bits>=5){bits-=5;payload+=alphabet[(acc>>bits)&31];acc&=(1<<bits)-1;}
}
if(bits)payload+=alphabet[(acc<<(5-bits))&31];
const expected=`REQ-${payload}`;
assert.equal(h.canonicalIdCandidate(tuple),expected,'closed-loop-id/1 candidate must match an independent SHA-256/base32hex vector.');

const occupied=new Set([expected]);
const collisionTuple=inRuntime(tupleValue);collisionTuple.collisionExists=id=>occupied.has(id);
const allocation=h.allocateCanonicalId(collisionTuple);
assert.equal(allocation.collisionCounter,1,'Allocator must increment collisionCounter only after an actual collision.');
assert.notEqual(allocation.id,expected);
assert.equal(allocation.allocationSequence,42);
assert.equal(allocation.idVersion,'closed-loop-id/1');
const retryTuple=inRuntime(tupleValue);retryTuple.collisionExists=()=>false;
const retry=h.allocateCanonicalId(retryTuple);
assert.equal(retry.id,expected,'Same allocation tuple must be deterministic.');

for(const bad of [
  {...tupleValue,familyPrefix:'req'},
  {...tupleValue,familyPrefix:'REQ_1'},
  {...tupleValue,allocationSequence:-1},
  {...tupleValue,collisionCounter:-1},
  {...tupleValue,jobNamespace:''},
  {...tupleValue,commandId:''}
])assert.throws(()=>h.canonicalIdCandidate(inRuntime(bad)));

assert.throws(()=>h.stableStringify(-0));
assert.throws(()=>h.stableStringify(Number.MAX_SAFE_INTEGER+1));
assert.throws(()=>h.stableStringify(inRuntime({x:null,xMarker:'undefined'})),/./); // sanity: runtime errors remain observable
const undefinedObject=vm.runInContext('({x:undefined})',context);assert.throws(()=>h.stableStringify(undefinedObject));
const sparseArray=vm.runInContext('Array(2)',context);sparseArray[1]=1;assert.throws(()=>h.stableStringify(sparseArray));
assert.equal(h.stableStringify(inRuntime({'😀':1,'z':2})),'{"z":2,"😀":1}');

console.log(JSON.stringify({canonicalIdContract:'PASS',expected}));
