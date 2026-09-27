import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const cases=[],sourcePath='workflow-engine.js',digest=()=>createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),sourceBefore=digest();
for(const [fault,stage,expected] of [
  ['fractional-stability',12,'must remain persistable after every operation'],
  ['missing-defect-gate',13,'An observed initial violation without an evidence-linked defect must be rejected'],
  ['unrelated-defect-reason',13,'COUNTERPART_DEFECT_REASON_ORACLE'],
  ['partial-verification-completes-operation',17,'ITERATION_PARTIAL_VERIFY_ORACLE']
]){
  const result=spawnSync(process.execPath,['verify-operator-counterpart.mjs'],{encoding:'utf8',timeout:300000,killSignal:'SIGKILL',maxBuffer:8*1024*1024,env:{...process.env,CLRT_COUNTERPART_FAULT:fault,CLRT_COUNTERPART_STAGE_LIMIT:String(stage)}});
  assert.equal(result.error,undefined,`${fault} must finish within its hard timeout: ${result.error}`);
  assert.equal(result.signal,null,`${fault} must be detected by its oracle, not a killed process`);
  assert.notEqual(result.status,0,`${fault} escaped detection`);
  assert(result.stderr.includes(expected),`${fault} failed for an unrelated reason: ${result.stderr}`);
  cases.push({fault,throughStage:stage,exitCode:result.status,detectedBy:expected,result:'PASS',stdout:result.stdout,stderr:result.stderr});
}
assert.equal(digest(),sourceBefore,'COUNTERPART_SOURCE_RESTORED_ORACLE: fault execution must leave production source unchanged');
console.log(JSON.stringify({sourceRestored:true,counterpartFaultDetection:'PASS',cases,injection:'Disposable VM production source; repository implementation stays unchanged.',synthetic:true}));
