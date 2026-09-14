import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const results=[];
for(const [suite,fault,oracle] of [['verify-quarantine-recovery.mjs','quarantine-files','QUARANTINE_FILES_ORACLE'],['verify-filename-transports.mjs','handoff-race','HANDOFF_ASSEMBLY_RACE_ORACLE'],['verify-filename-transports.mjs','stored-byte-comparison','STORED_BYTE_COMPARE_ORACLE']]){
 const broken=spawnSync(process.execPath,[suite,'--fault='+fault],{encoding:'utf8',maxBuffer:8*1024*1024});assert.notEqual(broken.status,0,'The '+fault+' implementation fault escaped detection');assert.match(broken.stderr,new RegExp(oracle));
 const restored=spawnSync(process.execPath,[suite],{encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(restored.status,0,restored.stderr);results.push({suite,fault,result:'DETECTED',restoredImplementation:'PASS'});
}
console.log(JSON.stringify({synthetic:true,actualBrowser:false,method:'Targeted in-memory production faults followed by replay against the unmodified implementation',results},null,2));
