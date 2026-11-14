import {runVerifier} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
// Allow the full 60-minute lifecycle child plus bounded fault-owner reporting
// and cleanup. This is not a product-operation timeout relaxation.
const nativeFaultTimeoutMs=65*60*1000;
const result=(await runVerifier(process.execPath,['verify-native-proof-journey.mjs'],{encoding:'utf8',timeout:nativeFaultTimeoutMs,maxBuffer:64*1024*1024,env:{...process.env,CONFORMANCE_NATIVE_FAULT:'skip-proof-recording'}}));
if(result.error)throw result.error;
const report=JSON.parse(result.stdout);assert.equal(result.status,0,result.stderr);assert.equal(report.nativeProofJourney,'FAULT_DETECTED');
console.log(JSON.stringify({...report,productionFilesModified:false,mutationEnvironment:'Disposable loaded production module; native proof owner bypassed'}));
