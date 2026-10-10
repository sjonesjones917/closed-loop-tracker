import {runVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
const results=[];
for(const [suite,fault,oracle] of [['verify-quarantine-recovery.mjs','quarantine-files','QUARANTINE_FILES_ORACLE'],['verify-quarantine-recovery.mjs','quarantine-body-delete','QUARANTINE_BODY_REMOVAL_ORACLE'],['verify-filename-transports.mjs','handoff-race','HANDOFF_ASSEMBLY_RACE_ORACLE'],['verify-filename-transports.mjs','stored-byte-comparison','STORED_BYTE_COMPARE_ORACLE']]){
 const broken=(await runVerifier(process.execPath,[suite,'--fault='+fault],{encoding:'utf8',maxBuffer:8*1024*1024}));assertDetectedFault(broken,oracle,'The '+fault+' implementation fault escaped detection');assert.match(broken.stderr,new RegExp(oracle));
 const restored=(await runVerifier(process.execPath,[suite],{encoding:'utf8',maxBuffer:8*1024*1024}));assert.equal(restored.status,0,restored.stderr);results.push({suite,fault,result:'DETECTED',restoredImplementation:'PASS'});
}
console.log(JSON.stringify({synthetic:true,actualBrowser:false,method:'Targeted in-memory production faults followed by replay against the unmodified implementation',results},null,2));
