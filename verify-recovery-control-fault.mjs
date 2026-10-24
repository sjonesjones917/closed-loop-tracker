import {recoveryFaults,assertRecoveryScopeReport,verifyRecoveryScopeContract} from './recovery-scope-contract.mjs';
import {runVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const digest=()=>createHash('sha256').update(fs.readFileSync('app-core.js')).digest('hex');
const sourceSha256=digest(),cases=[],scopeContractControls=verifyRecoveryScopeContract();
const run=async (args,env={})=>{
 const command=[process.execPath,'verify-operator-action-lifecycle.mjs','--recovery-scope=controls-v1',...args],startedAt=new Date().toISOString();
 const result=(await runVerifier(command[0],command.slice(1),{encoding:'utf8',timeout:30000,killSignal:'SIGKILL',maxBuffer:8*1024*1024,env:{...process.env,...env}}));
 return {command,startedAt,finishedAt:new Date().toISOString(),exitCode:result.status,signal:result.signal,outcome:result.error?.code==='ETIMEDOUT'?'TIMEOUT':result.status===0?'PASS':'FAIL',error:result.error?{code:result.error.code,message:result.error.message}:null,stdout:result.stdout||'',stderr:result.stderr||''};
};
for(const [fault,oracle] of recoveryFaults){
 let injected;
 let faultDriver=null;
 if(fault==='blocked-startup-navigation-readiness'){
  const source=fs.readFileSync('operator-browser-driver.mjs','utf8'),before="if(options.waitForInteractive!==false)await idle(options);";
  assert.equal(source.split(before).length-1,1,'Blocked-startup navigation fault anchor is missing');
  faultDriver='.verify-operator-browser-driver-fault.mjs';
  fs.writeFileSync(faultDriver,source.replace(before,'await idle(options);'));
  injected=(await run([],{OPERATOR_DRIVER_MODULE:'./'+faultDriver}));
 }else injected=(await run(['--fault='+fault]));
 console.error(JSON.stringify({fault,phase:'injected',...injected}));
 assertDetectedFault(injected,oracle,'The intended action-control fault escaped detection: '+fault);
 assert.match(injected.stderr,new RegExp(oracle),'The fault failed for an unrelated reason: '+fault);
 if(faultDriver)fs.rmSync(faultDriver,{force:true});
 const restored=(await run([]));console.error(JSON.stringify({fault,phase:'restored',...restored}));
 assert.equal(restored.exitCode,0,restored.stderr);
 assert.equal(restored.outcome,'PASS','RECOVERY_RESTORED_COMPLETION_ORACLE');assert.equal(restored.signal,null);assert.equal(restored.error,null);
 assertRecoveryScopeReport(JSON.parse(restored.stdout));
 cases.push({fault,oracle,result:'DETECTED',injected,restored});
}
assert.equal(digest(),sourceSha256,'Disposable faults must not change the production source.');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,sourceSha256,scope:'controls-v1',defaultLifecycleComplete:false,scopeContractControls,cases,restoredImplementation:'PASS'},null,2));
