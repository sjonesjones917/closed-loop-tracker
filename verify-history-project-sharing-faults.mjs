import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const digest=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const originalSourceSha256=digest('project-store.js'),originalEngineSha256=digest('workflow-engine.js'),results=[];
for(const [suite,fault,oracle] of [
 ['verify-history-view-cost.mjs','repeat-verified-project-hash','HISTORY_HASH_PASS_ORACLE'],
 ['verify-history-canonical-sharing.mjs','duplicate-canonical-content','HISTORY_CANONICAL_CAPACITY_ORACLE'],
 ['verify-history-canonical-sharing.mjs','repeat-import-shared-content','HISTORY_IMPORT_SHARED_CONTENT_ORACLE'],
 ['verify-history-canonical-sharing.mjs','repeat-completed-adjudication','HISTORY_ADJUDICATION_COST_ORACLE'],
 ['verify-history-canonical-sharing.mjs','repeat-recalculation-adjudication','HISTORY_RECALCULATION_ADJUDICATION_COST_ORACLE'],
 ['verify-history-canonical-sharing.mjs','share-custom-recalculation','HISTORY_RECALCULATION_CUSTOM_ORACLE'],
 ['verify-history-canonical-sharing.mjs','retain-failed-adjudication','HISTORY_ADJUDICATION_EXCEPTION_ORACLE'],
 ['verify-history-canonical-sharing.mjs','retain-completed-adjudication','HISTORY_ADJUDICATION_FRESH_ORACLE'],
 ['verify-history-canonical-sharing.mjs','repeat-input-scope','HISTORY_INPUT_SCOPE_COST_ORACLE'],
 ['verify-history-canonical-sharing.mjs','retain-input-scope','HISTORY_INPUT_SCOPE_FRESH_ORACLE'],
 ['verify-history-canonical-sharing.mjs','skip-import-shared-size','HISTORY_IMPORT_PART_SIZE_ORACLE'],
 ['verify-history-project-sharing.mjs','duplicate-project-body','HISTORY_STORAGE_AMPLIFICATION_ORACLE'],
 ['verify-history-project-references.mjs','repeat-import-byte-hash','HISTORY_IMPORT_BYTE_REUSE_ORACLE'],
 ['verify-history-project-references.mjs','trust-import-declared-byte-hash','HISTORY_IMPORT_BYTE_INTEGRITY_ORACLE'],
 ['verify-history-project-references.mjs','repeat-import-project-root','HISTORY_IMPORT_ROOT_REUSE_ORACLE'],
 ['verify-history-project-references.mjs','repeat-import-root-digest','HISTORY_IMPORT_ROOT_DIGEST_COST_ORACLE'],
 ['verify-history-project-references.mjs','retain-import-project-roots','HISTORY_IMPORT_ROOT_RESIDENCY_ORACLE'],
 ['verify-history-project-references.mjs','skip-project-body-byte-check','HISTORY_REFERENCE_BYTE_ORACLE'],
 ['verify-history-project-references.mjs','skip-selected-version-binding','HISTORY_SELECTED_VERSION_ORACLE']
]){
 const run=args=>{const command=[process.execPath,suite,...args],startedAt=new Date().toISOString(),actual=spawnSync(command[0],command.slice(1),{encoding:'utf8',maxBuffer:64*1024*1024,timeout:120000,killSignal:'SIGKILL'});return {command,startedAt,finishedAt:new Date().toISOString(),exitCode:actual.status,signal:actual.signal,outcome:actual.error?.code==='ETIMEDOUT'?'TIMEOUT':actual.status===0?'PASS':'FAIL',error:actual.error?{code:actual.error.code,message:actual.error.message}:null,stdout:actual.stdout||'',stderr:actual.stderr||''};};
 const injected=run(['--fault='+fault]);console.error(JSON.stringify({suite,fault,phase:'injected',...injected}));
 assert.notEqual(injected.exitCode,0,'Implementation fault escaped detection: '+fault);
 assert.ok(injected.stderr.includes(oracle),'Implementation fault failed for an unrelated reason: '+fault+'\n'+injected.stderr);
 const restored=run([]);console.error(JSON.stringify({suite,fault,phase:'restored',...restored}));assert.equal(restored.exitCode,0,'Restored implementation did not return to green:\n'+restored.stderr);
 results.push({suite,testSha256:digest(suite),fault,expectedFailureOracle:oracle,result:'DETECTED',injected,restored});
}
assert.equal(digest('project-store.js'),originalSourceSha256,'Disposable mutants changed the production file.');
assert.equal(digest('workflow-engine.js'),originalEngineSha256,'Disposable mutants changed the workflow engine.');
console.log(JSON.stringify({case:'history-project-sharing-faults',workflowEngineSha256:originalEngineSha256,productionSourceSha256:originalSourceSha256,synthetic:true,actualBrowser:false,method:'Targeted disposable production-source faults; intended behavioral oracle must fail; unmodified implementation is then rerun. Raw output is retained for every run.',results},null,2));
