import {runVerifierSync,assertDetectedFault} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const cases=[],sourcePath='workflow-engine.js',digest=()=>createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),sourceBefore=digest();
for(const [fault,stage,expected] of [
  ['missing-candidate-bytes',10,'COUNTERPART_RETAINED_ARTIFACT_CUSTODY_ORACLE'],
  ['missing-product-bytes',21,'COUNTERPART_RETAINED_ARTIFACT_CUSTODY_ORACLE'],
  ['fractional-stability',12,'must remain persistable after every operation'],
  ['missing-defect-gate',13,'An observed initial violation without an evidence-linked defect must be rejected'],
  ['unrelated-defect-reason',13,'COUNTERPART_DEFECT_REASON_ORACLE'],
  ['partial-verification-completes-operation',17,'ITERATION_PARTIAL_VERIFY_ORACLE']
]){
  const result=runVerifierSync(process.execPath,['verify-operator-counterpart.mjs'],{encoding:'utf8',timeout:300000,killSignal:'SIGKILL',maxBuffer:8*1024*1024,env:{...process.env,CLRT_COUNTERPART_FAULT:fault,CLRT_COUNTERPART_STAGE_LIMIT:String(stage)}});
  assert.equal(result.error,undefined,`${fault} must finish within its hard timeout: ${result.error}`);
  assert.equal(result.signal,null,`${fault} must be detected by its oracle, not a killed process`);
  assertDetectedFault(result,expected,`${fault} escaped detection`);
  assert(result.stderr.includes(expected),`${fault} failed for an unrelated reason: ${result.stderr}`);
  cases.push({fault,owner:fault.startsWith('missing-')&&fault.endsWith('-bytes')?'verifier':'production',throughStage:stage,exitCode:result.status,detectedBy:expected,result:'PASS',stdout:result.stdout,stderr:result.stderr});
}
const restored=runVerifierSync(process.execPath,['verify-operator-counterpart.mjs'],{encoding:'utf8',timeout:300000,killSignal:'SIGKILL',maxBuffer:8*1024*1024,env:{...process.env,CLRT_COUNTERPART_FAULT:'',CLRT_COUNTERPART_STAGE_LIMIT:'30'}});
assert.equal(restored.error,undefined,'The restored journey must finish within its hard timeout.');
assert.equal(restored.status,0,restored.stderr);
assert.equal(JSON.parse(restored.stdout).counterpartContracts,'PASS');
assert.equal(digest(),sourceBefore,'COUNTERPART_SOURCE_RESTORED_ORACLE: fault execution must leave production source unchanged');
console.log(JSON.stringify({sourceRestored:true,counterpartFaultDetection:'PASS',cases,restoredRun:{exitCode:restored.status,stdout:restored.stdout,stderr:restored.stderr},injection:'Disposable loaded production faults and fixture byte-write omissions; repository production source stays unchanged.',synthetic:true}));
