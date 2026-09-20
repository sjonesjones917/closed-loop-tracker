import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const digest=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const originalSourceSha256=digest('project-store.js'),results=[];
for(const [suite,fault,oracle] of [
 ['verify-history-canonical-sharing.mjs','duplicate-canonical-content','HISTORY_CANONICAL_CAPACITY_ORACLE'],
 ['verify-history-project-sharing.mjs','duplicate-project-body','HISTORY_STORAGE_AMPLIFICATION_ORACLE'],
 ['verify-history-project-references.mjs','skip-project-body-byte-check','HISTORY_REFERENCE_BYTE_ORACLE'],
 ['verify-history-project-references.mjs','skip-selected-version-binding','HISTORY_SELECTED_VERSION_ORACLE']
]){
 const run=args=>{const command=[process.execPath,suite,...args],startedAt=new Date().toISOString(),actual=spawnSync(command[0],command.slice(1),{encoding:'utf8',maxBuffer:64*1024*1024});return {command,startedAt,finishedAt:new Date().toISOString(),exitCode:actual.status,signal:actual.signal,stdout:actual.stdout||'',stderr:actual.stderr||''};};
 const injected=run(['--fault='+fault]);
 assert.notEqual(injected.exitCode,0,'Implementation fault escaped detection: '+fault);
 assert.ok(injected.stderr.includes(oracle),'Implementation fault failed for an unrelated reason: '+fault+'\n'+injected.stderr);
 const restored=run([]);assert.equal(restored.exitCode,0,'Restored implementation did not return to green:\n'+restored.stderr);
 results.push({suite,testSha256:digest(suite),fault,expectedFailureOracle:oracle,result:'DETECTED',injected,restored});
}
assert.equal(digest('project-store.js'),originalSourceSha256,'Disposable mutants changed the production file.');
console.log(JSON.stringify({case:'history-project-sharing-faults',productionSourceSha256:originalSourceSha256,synthetic:true,actualBrowser:false,method:'Targeted disposable production-source faults; intended behavioral oracle must fail; unmodified implementation is then rerun. Raw output is retained for every run.',results},null,2));
