import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cases=[];
for(const [fault,oracle] of [['secret','SECRET_EXPORT_ORACLE'],['history','RETAINED_SECRET_ORACLE']]){
 const run=spawnSync(process.execPath,['verify-encrypted-backups.mjs','--fault='+fault],{encoding:'utf8',maxBuffer:16*1024*1024});assert.notEqual(run.status,0,'Encryption fault was not detected: '+fault);assert.ok((run.stdout+run.stderr).includes(oracle),'The fault failed for an unrelated reason: '+run.stderr);cases.push({fault,oracle,result:'DETECTED'});
}
const restored=spawnSync(process.execPath,['verify-encrypted-backups.mjs'],{encoding:'utf8',maxBuffer:16*1024*1024});assert.equal(restored.status,0,restored.stderr);console.log(JSON.stringify({synthetic:true,actualBrowser:false,cases,restoredImplementation:'PASS'},null,2));
