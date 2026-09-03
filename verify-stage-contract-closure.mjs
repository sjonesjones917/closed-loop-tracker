import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
vm.runInThisContext(fs.readFileSync('workbook.js','utf8'),{filename:'workbook.js'});

const core=globalThis.closedLoopCore;
assert(core,'workbook runtime did not load');

function stage(number){
  const value=core.STAGES[number-1];
  assert.equal(value?.number,number,`Stage ${number} missing`);
  return value;
}
function requireFields(number,names){
  const value=stage(number);
  for(const name of names){
    assert(value.fields.includes(name),`Stage ${number} is missing required field ${name}`);
    assert(value.ownership.application.includes(name),`Stage ${number} required application-owned field ${name} is not application-owned`);
  }
}
function assertOwnershipClosed(number){
  const value=stage(number);
  const partitions=['human','humanDecision','agent','application'].flatMap(key=>value.ownership[key]||[]);
  assert.equal(new Set(partitions).size,partitions.length,`Stage ${number} ownership partitions overlap`);
  assert.deepEqual([...new Set(partitions)].sort(),[...value.fields].sort(),`Stage ${number} ownership universe does not exactly cover its field contract`);
}

requireFields(10,['ALL_FROZEN_COMPONENT_BYTES_HASHED']);
assert(!stage(10).fields.includes('HASHES_RECORDED_WHERE_PRACTICAL'),'Stage 10 retains obsolete best-effort hashing field');

requireFields(25,['DELIVERY_CANDIDATE_SET_ID']);
requireFields(28,['DELIVERY_CANDIDATE_SET_ID']);
requireFields(30,['PRE_DELIVERY_CHECKPOINT_ID','DELIVERY_ID','DELIVERY_STATE','DELIVERY_RECORD_HASH','DELIVERY_ATTEMPT_RECORDS']);
assert.equal(stage(30).title,'PRESERVE FAILURES PERMANENTLY AND CLOSE DELIVERY');
assert.equal(stage(30).role,'Permanent defect-registry and terminal-delivery custodian');

for(const number of [10,25,28,30])assertOwnershipClosed(number);

console.log(JSON.stringify({stageContractClosure:'PASS',stages:[10,25,28,30]},null,2));
