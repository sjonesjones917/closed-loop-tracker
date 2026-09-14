import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const run=args=>spawnSync(process.execPath,['verify-recoverable-history.mjs',...args],{encoding:'utf8',maxBuffer:32*1024*1024});
const base=run([]);assert.equal(base.status,0,base.stderr);const results=[];
for(const [name,reason]of [['mixed-versions',/AssertionError|HISTORY_VERSION_INCOMPATIBLE/],['mutate-retained',/HISTORY_SNAPSHOT_INTEGRITY_FAILED/]]){const fault=run(['--fault='+name]);assert.notEqual(fault.status,0,'Deliberate '+name+' survived');assert.match(fault.stderr,reason,'The mutation failed for an unrelated reason');const restored=run([]);assert.equal(restored.status,0,restored.stderr);results.push({fault:name,result:'DETECTED',expectedFailure:reason.source,restoredImplementation:'PASS'});}
console.log(JSON.stringify({synthetic:true,environment:'Disposable Node module instances; production source file remains unchanged',implementationFaults:results},null,2));
