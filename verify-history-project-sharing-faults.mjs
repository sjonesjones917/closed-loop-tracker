import {runVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const digest=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const originalSourceSha256=digest('project-store.js'),originalEngineSha256=digest('workflow-engine.js'),results=[],healthyControls=[],controlSuites=new Set();
// This limit covers a complete fixed-fixture control: twelve retained views,
// backup round-trip, missing dependencies, and exact-byte corruption checks.
// Keep a hard child deadline inside the aggregate's twenty-minute gate bound.
const CHILD_TIMEOUT_MS=3*60*1000;
for(const [suite,fault,oracle] of [
 ['verify-history-project-references.mjs','repeat-import-compatibility','HISTORY_IMPORT_COMPATIBILITY_COST_ORACLE'],
 ['verify-history-project-references.mjs','share-import-compatibility-inventory','HISTORY_IMPORT_COMPATIBILITY_INVENTORY_ORACLE'],
 ['verify-history-project-references.mjs','retain-import-compatibility','HISTORY_IMPORT_COMPATIBILITY_FRESH_ORACLE'],
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
 const run=async args=>{const command=[process.execPath,suite,...args],startedAt=new Date().toISOString(),actual=(await runVerifier(command[0],command.slice(1),{encoding:'utf8',maxBuffer:64*1024*1024,timeout:CHILD_TIMEOUT_MS,killSignal:'SIGKILL'}));return {command,startedAt,finishedAt:new Date().toISOString(),timeoutMs:CHILD_TIMEOUT_MS,exitCode:actual.status,signal:actual.signal,outcome:actual.error?.code==='ETIMEDOUT'?'TIMEOUT':actual.status===0?'PASS':'FAIL',error:actual.error?{code:actual.error.code,message:actual.error.message}:null,stdout:actual.stdout||'',stderr:actual.stderr||''};};
 const injected=(await run(['--fault='+fault]));console.error(JSON.stringify({suite,fault,phase:'injected',...injected}));
 assertDetectedFault(injected,oracle,'Implementation fault escaped detection: '+fault);
 assert.ok(injected.stderr.includes(oracle),'Implementation fault failed for an unrelated reason: '+fault+'\n'+injected.stderr);
 assert.equal(digest('project-store.js'),originalSourceSha256,'A disposable fault changed the production store.');
 assert.equal(digest('workflow-engine.js'),originalEngineSha256,'A disposable fault changed the production engine.');
 controlSuites.add(suite);
 results.push({suite,testSha256:digest(suite),fault,expectedFailureOracle:oracle,result:'DETECTED',injected,restoredControl:suite});
}
// Each mutant runs in a fresh process and leaves canonical source unchanged.
// One fresh unmodified control per distinct program closes the entire class;
// repeating the identical healthy fixture after every in-memory mutant adds no
// additional state or operation coverage.
for(const suite of controlSuites){
 const command=[process.execPath,suite],run=(await runVerifier(command[0],command.slice(1),{encoding:'utf8',maxBuffer:64*1024*1024,timeout:CHILD_TIMEOUT_MS,killSignal:'SIGKILL'}));
 assert.equal(run.status,0,'Restored implementation did not return to green: '+suite+'\n'+run.stderr);
 healthyControls.push({suite,command,result:'PASS',exitCode:run.status,signal:run.signal,startedAt:run.startedAt,finishedAt:run.finishedAt,stdout:run.stdout,stderr:run.stderr,evidencePath:run.evidencePath});
}
assert.equal(digest('project-store.js'),originalSourceSha256,'Disposable mutants changed the production file.');
assert.equal(digest('workflow-engine.js'),originalEngineSha256,'Disposable mutants changed the workflow engine.');
console.log(JSON.stringify({case:'history-project-sharing-faults',workflowEngineSha256:originalEngineSha256,productionSourceSha256:originalSourceSha256,synthetic:true,actualBrowser:false,method:'Targeted isolated-process production faults; specific rejection required; source digests checked after every mutant; one fresh healthy control per distinct fixture program. Raw output retained for every execution.',results,healthyControls},null,2));
