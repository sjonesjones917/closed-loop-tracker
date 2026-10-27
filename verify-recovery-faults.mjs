import {runVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const digest=()=>createHash('sha256').update(fs.readFileSync('project-store.js')).digest('hex'),sourceSha256=digest(),results=[],rawRuns=[];
const execute=async (suite,args=[])=>{const started=Date.now(),result=(await runVerifier(process.execPath,[suite,...args],{encoding:'utf8',maxBuffer:32*1024*1024,timeout:120000,killSignal:'SIGKILL'}));rawRuns.push({suite,args,timeoutMs:120000,elapsedMs:Date.now()-started,status:result.status,signal:result.signal,error:result.error?.message||null,stdout:result.stdout,stderr:result.stderr});return result;};
const run=async args=>(await execute('verify-recoverable-history.mjs',args));
// The retained-mutation child raises a storage Error, not an assertion. Bind
// its code to the same terminal Error block after the shared clean-exit gate.
// These are the four current HISTORY_SNAPSHOT_INTEGRITY_FAILED owner messages;
// a raw code in an earlier diagnostic or source excerpt is not fault evidence.
const retainedMutationMessage=/^(?:The retained root changed before checkpoint commit\.|A retained project body failed exact-byte verification\. The new checkpoint was not committed\.|The inspected saved view changed before recovery\.|This saved version is missing or corrupt\. The current project is preserved\.)$/;
try{
 const base=(await run([]));assert.equal(base.status,0,base.stderr);
 for(const [name,reason]of [['mixed-versions',/MIXED_VERSION_RESTORE_INTEGRITY_ORACLE/],['mutate-retained',/HISTORY_SNAPSHOT_INTEGRITY_FAILED/],['import-projection',/IMPORT_PROJECTION_INTEGRITY_ORACLE/],['history-projection',/HISTORY_PROJECTION_INTEGRITY_ORACLE/]]){const fault=(await run(['--fault='+name]));assertDetectedFault(fault,name==='mutate-retained'?retainedMutationMessage:reason,name);if(name==='mutate-retained'){const terminal=[...fault.stderr.matchAll(/^([A-Za-z_$][\w$.]*Error|Error)(?: \[[^\]\n]+\])?: ([^\n]*)/gm)].at(-1);assert.equal(terminal?.[1],'Error','RETAINED_MUTATION_TERMINAL_ERROR_ORACLE');const codes=[...fault.stderr.slice(terminal.index).matchAll(/^  code: '([^'\n]*)',?$/gm)];assert.equal(codes.length,1,'RETAINED_MUTATION_TERMINAL_CODE_ORACLE');assert.equal(codes[0][1],'HISTORY_SNAPSHOT_INTEGRITY_FAILED','RETAINED_MUTATION_TERMINAL_CODE_ORACLE');}const restored=(await run([]));assert.equal(restored.status,0,restored.stderr);results.push({fault:name,result:'DETECTED',expectedFailure:reason.source,restoredImplementation:'PASS'});}
 for(const [suite,fault,reason]of [
  ...['refuse-removed','skip-file-inventory'].map(fault=>['verify-history-project-lifecycle.mjs',fault,/MISSING_RETAINED_FILE_ORACLE/]),
  ...['skip-receipt-validation','skip-transaction-receipt-validation','skip-restored-receipt-validation'].map(fault=>['verify-history-project-lifecycle.mjs',fault,/COMMAND_RECEIPT_VALIDATION_ORACLE/]),
  ['verify-copy-transaction.mjs','skip-clone-receipt-validation',/CLONE_RECEIPT_VALIDATION_ORACLE/]
 ]){const failed=(await execute(suite,['--fault='+fault]));assertDetectedFault(failed,reason,'Deliberate '+fault+' must fail its intended assertion');const restored=(await execute(suite));assert.equal(restored.status,0,restored.stderr);JSON.parse(restored.stdout);results.push({suite,fault,result:'DETECTED',expectedFailure:reason.source,restoredImplementation:'PASS'});}
 assert.equal(digest(),sourceSha256,'Injected fault changed retained production source');
}catch(error){console.error(error.stack||error);process.exitCode=1;}
console.log(JSON.stringify({synthetic:true,environment:'Disposable Node module instances; production source file remains unchanged',sourceSha256,sourceRestored:digest()===sourceSha256,implementationFaults:results,rawRuns},null,2));
