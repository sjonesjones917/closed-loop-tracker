import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cases=[];
for(const [suite,fault,oracle] of [['verify-mutation-impact-projections.mjs','stale-projection','DERIVED_IMPACT_CONFIRMATION_ORACLE'],['verify-semantic-review-acceptance.mjs','review-request-invalidates','REVIEW_REQUEST_PROGRESS_ORACLE']]){
 const broken=spawnSync(process.execPath,[suite,'--fault='+fault],{encoding:'utf8',maxBuffer:8*1024*1024});assert.notEqual(broken.status,0,'Undetected implementation fault: '+fault);assert.match(broken.stderr,new RegExp(oracle),'The implementation fault failed for an unrelated reason.');
 const restored=spawnSync(process.execPath,[suite],{encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(restored.status,0,restored.stderr);cases.push({suite,fault,result:'DETECTED',restoredImplementation:'PASS'});
}
console.log(JSON.stringify({synthetic:true,actualBrowser:false,method:'Targeted in-memory production faults; source files remain unchanged',cases},null,2));
