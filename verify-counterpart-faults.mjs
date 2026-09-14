import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cases=[];
for(const [fault,stage,expected] of [
  ['fractional-stability',12,'must remain persistable after every operation'],
  ['missing-defect-gate',13,'An observed initial violation without an evidence-linked defect must be rejected']
]){
  const result=spawnSync(process.execPath,['verify-operator-counterpart.mjs'],{encoding:'utf8',maxBuffer:8*1024*1024,env:{...process.env,CLRT_COUNTERPART_FAULT:fault,CLRT_COUNTERPART_STAGE_LIMIT:String(stage)}});
  assert.notEqual(result.status,0,`${fault} escaped detection`);
  assert(result.stderr.includes(expected),`${fault} failed for an unrelated reason: ${result.stderr}`);
  cases.push({fault,throughStage:stage,exitCode:result.status,detectedBy:expected,result:'PASS'});
}
console.log(JSON.stringify({counterpartFaultDetection:'PASS',cases,injection:'Disposable VM production source; repository implementation stays unchanged.',synthetic:true}));
