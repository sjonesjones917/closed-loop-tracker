import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const digest=()=>createHash('sha256').update(fs.readFileSync('app-core.js')).digest('hex');
const sourceSha256=digest(),cases=[];
const run=args=>{
 const command=[process.execPath,'verify-operator-action-lifecycle.mjs',...args],startedAt=new Date().toISOString();
 const result=spawnSync(command[0],command.slice(1),{encoding:'utf8',timeout:30000,killSignal:'SIGKILL',maxBuffer:8*1024*1024});
 return {command,startedAt,finishedAt:new Date().toISOString(),exitCode:result.status,signal:result.signal,outcome:result.error?.code==='ETIMEDOUT'?'TIMEOUT':result.status===0?'PASS':'FAIL',error:result.error?{code:result.error.code,message:result.error.message}:null,stdout:result.stdout||'',stderr:result.stderr||''};
};
for(const [fault,oracle] of [
 ['obsolete-recovery-control','HISTORY_CONTROL_STATE_ORACLE'],
 ['overlapping-complete-exports','UI_EXPORT_DUPLICATE_ORACLE']
]){
 const injected=run(['--fault='+fault]);console.error(JSON.stringify({fault,phase:'injected',...injected}));
 assert.notEqual(injected.exitCode,0,'The intended action-control fault escaped detection: '+fault);
 assert.match(injected.stderr,new RegExp(oracle),'The fault failed for an unrelated reason: '+fault);
 const restored=run([]);console.error(JSON.stringify({fault,phase:'restored',...restored}));
 assert.equal(restored.exitCode,0,restored.stderr);
 cases.push({fault,oracle,result:'DETECTED',injected,restored});
}
assert.equal(digest(),sourceSha256,'Disposable faults must not change the production source.');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,sourceSha256,cases,restoredImplementation:'PASS'},null,2));
