import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cases=[];
for(const [fault,oracle] of [['namespace','PROJECT_NAMESPACE_ORACLE'],['receipt','RECEIPT_INTEGRITY_ORACLE']]){
 const run=spawnSync(process.execPath,['verify-canonical-allocation.mjs','--fault='+fault],{encoding:'utf8',maxBuffer:16*1024*1024});
 assert.notEqual(run.status,0,'Targeted allocator fault was not detected: '+fault);assert.ok((run.stderr+run.stdout).includes(oracle),'Fault failed for an unrelated reason: '+run.stderr);cases.push({fault,oracle,result:'DETECTED'});
}
const restored=spawnSync(process.execPath,['verify-canonical-allocation.mjs'],{encoding:'utf8',maxBuffer:16*1024*1024});assert.equal(restored.status,0,restored.stderr);
console.log(JSON.stringify({synthetic:true,actualBrowser:false,cases,restoredImplementation:'PASS'},null,2));
