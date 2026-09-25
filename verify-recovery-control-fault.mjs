import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const digest=()=>createHash('sha256').update(fs.readFileSync('app-core.js')).digest('hex');
const sourceSha256=digest(),cases=[];
const run=(args,env={})=>{
 const command=[process.execPath,'verify-operator-action-lifecycle.mjs',...args],startedAt=new Date().toISOString();
 const result=spawnSync(command[0],command.slice(1),{encoding:'utf8',timeout:30000,killSignal:'SIGKILL',maxBuffer:8*1024*1024,env:{...process.env,...env}});
 return {command,startedAt,finishedAt:new Date().toISOString(),exitCode:result.status,signal:result.signal,outcome:result.error?.code==='ETIMEDOUT'?'TIMEOUT':result.status===0?'PASS':'FAIL',error:result.error?{code:result.error.code,message:result.error.message}:null,stdout:result.stdout||'',stderr:result.stderr||''};
};
for(const [fault,oracle] of [
 ['blocked-startup-navigation-readiness','BLOCKED_STARTUP_NAVIGATION_ORACLE'],
 ['obsolete-recovery-control','HISTORY_CONTROL_STATE_ORACLE'],
 ['overlapping-complete-exports','UI_EXPORT_DUPLICATE_ORACLE'],
 ['obsolete-storage-health-oracle','STORAGE_HEALTH_BROWSER_ORACLE'],
 ['incorrect-storage-persistence','STORAGE_HEALTH_BROWSER_ORACLE'],
 ['forced-operator-scroll','DRIVER_VIEW_PRESERVATION_ORACLE'],
 ['repeat-pre-ingestion-read','JOURNEY_READ_BOUNDARY_ORACLE'],
 ['stale-post-ingestion-state','Accept did not commit exactly one response'],
 ['repeat-post-ingestion-read','JOURNEY_CONTINUATION_READ_ORACLE']
]){
 let injected;
 let faultDriver=null;
 if(fault==='blocked-startup-navigation-readiness'){
  const source=fs.readFileSync('operator-browser-driver.mjs','utf8'),before="if(options.waitForInteractive!==false)await idle(options);";
  assert.equal(source.split(before).length-1,1,'Blocked-startup navigation fault anchor is missing');
  faultDriver='.verify-operator-browser-driver-fault.mjs';
  fs.writeFileSync(faultDriver,source.replace(before,'await idle(options);'));
  injected=run([],{OPERATOR_DRIVER_MODULE:'./'+faultDriver});
 }else injected=run(['--fault='+fault]);
 console.error(JSON.stringify({fault,phase:'injected',...injected}));
 assert.notEqual(injected.exitCode,0,'The intended action-control fault escaped detection: '+fault);
 assert.match(injected.stderr,new RegExp(oracle),'The fault failed for an unrelated reason: '+fault);
 if(faultDriver)fs.rmSync(faultDriver,{force:true});
 const restored=run([]);console.error(JSON.stringify({fault,phase:'restored',...restored}));
 assert.equal(restored.exitCode,0,restored.stderr);
 cases.push({fault,oracle,result:'DETECTED',injected,restored});
}
assert.equal(digest(),sourceSha256,'Disposable faults must not change the production source.');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,sourceSha256,cases,restoredImplementation:'PASS'},null,2));
