import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const results=[];
for(const [fault,oracle] of [['ownership','OPERATIONAL_OWNERSHIP_ORACLE'],['revision','RESERVATION_REVISION_ORACLE'],['canonical','STAGING_REVISION_ORACLE']]){
 const broken=spawnSync(process.execPath,['verify-operational-persistence.mjs','--fault='+fault],{encoding:'utf8',maxBuffer:8*1024*1024});
 assert.notEqual(broken.status,0,'The deliberate '+fault+' defect escaped detection');assert.match(broken.stderr,new RegExp(oracle));
 const restored=spawnSync(process.execPath,['verify-operational-persistence.mjs'],{encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(restored.status,0,restored.stderr);results.push({fault,result:'DETECTED',restoredImplementation:'PASS'});
}
console.log(JSON.stringify({synthetic:true,actualBrowser:false,method:'Targeted in-memory faults in the production modules; each original implementation is re-executed after the fault case.',results},null,2));
