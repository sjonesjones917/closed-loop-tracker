import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const digest=()=>createHash('sha256').update(fs.readFileSync('project-store.js')).digest('hex'),sourceSha256=digest(),results=[],rawRuns=[];
const execute=(suite,args=[])=>{const started=Date.now(),result=spawnSync(process.execPath,[suite,...args],{encoding:'utf8',maxBuffer:32*1024*1024,timeout:120000,killSignal:'SIGKILL'});rawRuns.push({suite,args,timeoutMs:120000,elapsedMs:Date.now()-started,status:result.status,signal:result.signal,error:result.error?.message||null,stdout:result.stdout,stderr:result.stderr});return result;};
const run=args=>execute('verify-recoverable-history.mjs',args);
try{
 const base=run([]);assert.equal(base.status,0,base.stderr);
 for(const [name,reason]of [['mixed-versions',/AssertionError|HISTORY_VERSION_INCOMPATIBLE/],['mutate-retained',/HISTORY_SNAPSHOT_INTEGRITY_FAILED/],['import-projection',/IMPORT_PROJECTION_INTEGRITY_ORACLE/],['history-projection',/HISTORY_PROJECTION_INTEGRITY_ORACLE/]]){const fault=run(['--fault='+name]);assert.equal(fault.status,1,'Deliberate '+name+' must fail its assertion, not time out');assert.match(fault.stderr,reason,'The mutation failed for an unrelated reason');const restored=run([]);assert.equal(restored.status,0,restored.stderr);results.push({fault:name,result:'DETECTED',expectedFailure:reason.source,restoredImplementation:'PASS'});}
 for(const fault of ['refuse-removed','skip-file-inventory']){const failed=execute('verify-history-project-lifecycle.mjs',['--fault='+fault]);assert.equal(failed.status,1,'Deliberate '+fault+' must fail its assertion, not time out');assert.match(failed.stderr,/MISSING_RETAINED_FILE_ORACLE/,'The mutation failed for an unrelated reason');const restored=execute('verify-history-project-lifecycle.mjs');assert.equal(restored.status,0,restored.stderr);results.push({fault,result:'DETECTED',restoredImplementation:'PASS'});}
 assert.equal(digest(),sourceSha256,'Injected fault changed retained production source');
}catch(error){console.error(error.stack||error);process.exitCode=1;}
console.log(JSON.stringify({synthetic:true,environment:'Disposable Node module instances; production source file remains unchanged',sourceSha256,sourceRestored:digest()===sourceSha256,implementationFaults:results,rawRuns},null,2));
