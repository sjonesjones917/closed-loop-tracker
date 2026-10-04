import {COUNTERPART_FAULT_CASES} from './operator-journey-fixtures.mjs';
import {runVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const cases=[],sourcePath='workflow-engine.js',digest=()=>createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),sourceBefore=digest();
for(const [fault,stage,expected] of COUNTERPART_FAULT_CASES){
  const result=(await runVerifier(process.execPath,['verify-operator-counterpart.mjs'],{encoding:'utf8',timeout:300000,killSignal:'SIGKILL',maxBuffer:8*1024*1024,env:{...process.env,CLRT_COUNTERPART_FAULT:fault,CLRT_COUNTERPART_STAGE_LIMIT:String(stage)}}));
  assert.equal(result.error,null,`${fault} must finish within its hard timeout: ${result.error}`);
  assert.equal(result.signal,null,`${fault} must be detected by its oracle, not a killed process`);
  assertDetectedFault(result,expected,`${fault} escaped detection`);
  assert(result.stderr.includes(expected),`${fault} failed for an unrelated reason: ${result.stderr}`);
  cases.push({fault,owner:['missing-source-search-registration','missing-retained-prompt-context'].includes(fault)||fault.startsWith('missing-')&&fault.endsWith('-bytes')?'verifier':'production',throughStage:stage,exitCode:result.status,detectedBy:expected,result:'PASS',stdout:result.stdout,stderr:result.stderr});
}
// The restored control traverses all30 stages, so retain the same finite
// full-suite supervision budget as its independent conformance entry point.
const restored=(await runVerifier(process.execPath,['verify-operator-counterpart.mjs'],{encoding:'utf8',killSignal:'SIGKILL',maxBuffer:8*1024*1024,env:{...process.env,CLRT_COUNTERPART_FAULT:'',CLRT_COUNTERPART_STAGE_LIMIT:'30'}}));
assert.equal(restored.error,null,'The restored journey must finish within its hard timeout.');
assert.equal(restored.status,0,restored.stderr);
assert.equal(JSON.parse(restored.stdout).counterpartContracts,'PASS');
assert.equal(digest(),sourceBefore,'COUNTERPART_SOURCE_RESTORED_ORACLE: fault execution must leave production source unchanged');
console.log(JSON.stringify({sourceRestored:true,counterpartFaultDetection:'PASS',cases,restoredRun:{exitCode:restored.status,stdout:restored.stdout,stderr:restored.stderr},injection:'Disposable loaded production faults and fixture byte-write omissions; repository production source stays unchanged.',synthetic:true}));
