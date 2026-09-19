import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cases=[];
for(const [fault,oracle] of [['input-invalidation','WORK_VERSION_INVALIDATION_ORACLE'],['pending-impact','PENDING_DEPENDENCY_IMPACT_ORACLE'],['candidate-files','CANDIDATE_FILE_RETENTION_ORACLE'],['cancel-checkpoint','CANCELLATION_CHECKPOINT_ORACLE'],['history-navigation-draft','HISTORY_NAVIGATION_DRAFT_ORACLE'],['history-double-rebase','HISTORY_ALREADY_REBASED_ORACLE']]){
 const broken=spawnSync(process.execPath,['verify-file-correction-recovery.mjs','--fault='+fault],{encoding:'utf8',maxBuffer:8*1024*1024});assert.notEqual(broken.status,0,'Undetected implementation fault: '+fault);assert.match(broken.stderr,new RegExp(oracle));
 const restored=spawnSync(process.execPath,['verify-file-correction-recovery.mjs'],{encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(restored.status,0,restored.stderr);cases.push({fault,result:'DETECTED',restoredImplementation:'PASS'});
}
console.log(JSON.stringify({synthetic:true,actualBrowser:false,cases},null,2));
