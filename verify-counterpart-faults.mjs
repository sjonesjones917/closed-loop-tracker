import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cases=[];
for(const [fault,stage,expected] of [
  ['skipped-confirmation',1,'CONFIRMATION_ORACLE'],
  ['fractional-stability',12,/Cannot canonically hash non-safe-integer JSON number at \$\.stages\.13\.derivedData\.STABILITY_SUMMARY\.requirementStability\.[^.]+\.agreementRate/],
  ['missing-defect-gate',13,'An observed initial violation without an evidence-linked defect must be rejected']
]){
  const result=spawnSync(process.execPath,['verify-operator-counterpart.mjs'],{encoding:'utf8',maxBuffer:8*1024*1024,env:{...process.env,CLRT_COUNTERPART_FAULT:fault,CLRT_COUNTERPART_STAGE_LIMIT:String(stage)}});
  assert.notEqual(result.status,0,`${fault} escaped detection`);
  assert(typeof expected==='string'?result.stderr.includes(expected):expected.test(result.stderr),`${fault} failed for an unrelated reason: ${result.stderr}`);
  cases.push({fault,throughStage:stage,exitCode:result.status,detectedBy:String(expected),result:'PASS'});
}
const restored=spawnSync(process.execPath,['verify-operator-counterpart.mjs'],{encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,CLRT_COUNTERPART_FAULT:'',CLRT_COUNTERPART_STAGE_LIMIT:'13',CLRT_COUNTERPART_INITIAL_FAILURE:'1',CLRT_COUNTERPART_PROJECT_FILE:''}});
assert.equal(restored.status,0,`Restored implementation failed: ${restored.stderr}`);
const control=JSON.parse(restored.stdout);assert(control.stageGateChecks.length===13&&control.stageGateChecks.every(row=>row.result==='PASS'));assert(control.replacementCasesExecuted>0);
console.log(JSON.stringify({counterpartFaultDetection:'PASS',cases,restored:{result:'PASS',throughStage:13,stageGateChecks:control.stageGateChecks,canonicalSerializationChecked:control.canonicalSerializationCheckedAfterEveryOperation,sourceSha256:control.executedSourceSha256},injection:'Disposable VM production source; repository implementation stays unchanged.',synthetic:true,actualBrowserJourney:false,durablePersistenceChecked:false}));
