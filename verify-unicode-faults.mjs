import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cases=[];
for(const [fault,oracle] of [['fold','CASE_FOLD_ORACLE'],['confusable','CONFUSABLE_ORACLE'],['order','NFC_ORACLE']]){const run=spawnSync(process.execPath,['verify-unicode-filenames.mjs','--fault='+fault],{encoding:'utf8',maxBuffer:16*1024*1024});assert.notEqual(run.status,0,'Unicode fault was not detected: '+fault);assert.ok((run.stdout+run.stderr).includes(oracle),'Fault failed for an unrelated reason: '+run.stderr);cases.push({fault,oracle,result:'DETECTED'});}
const restored=spawnSync(process.execPath,['verify-unicode-filenames.mjs'],{encoding:'utf8',maxBuffer:16*1024*1024});assert.equal(restored.status,0,restored.stderr);console.log(JSON.stringify({synthetic:true,actualBrowser:false,cases,restoredImplementation:'PASS'},null,2));
