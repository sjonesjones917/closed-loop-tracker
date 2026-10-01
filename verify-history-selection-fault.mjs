import {runVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
const cases=[];
for(const [name,oracle] of [['late-history-selection','HISTORY_SELECTION_ORACLE'],['reset-selected-destination','HISTORY_DESTINATION_RETENTION_ORACLE']]){
 const fault=(await runVerifier(process.execPath,['verify-history-selection-capture.mjs','--fault='+name],{encoding:'utf8'}));
 assertDetectedFault(fault,oracle,'The History destination fault was not detected: '+name);
 assert.match(fault.stderr,new RegExp(oracle),'The test failed for an unrelated reason');
 cases.push({fault:name,oracle,result:'DETECTED'});
}
const restored=(await runVerifier(process.execPath,['verify-history-selection-capture.mjs'],{encoding:'utf8'}));
assert.equal(restored.status,0,restored.stderr);
console.log(JSON.stringify({synthetic:true,actualBrowser:false,cases,restoredImplementation:'PASS'},null,2));
