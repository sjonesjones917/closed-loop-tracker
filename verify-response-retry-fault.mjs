import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const source=fs.readFileSync('app-core.js','utf8'),before='async function persistReplacement(next,{expectedProjectRevision=null,',after='async function persistReplacement(next,{expectedProjectRevision=Number(next?.revision||0),';
assert.ok(source.includes(before));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-retry-fault-')),file=path.join(directory,'app-core.js');
try{
 fs.writeFileSync(file,source.replace(before,after));
 const faulty=spawnSync(process.execPath,['verify-response-retry-persistence.mjs'],{env:{...process.env,APP_SOURCE:file},encoding:'utf8',maxBuffer:8*1024*1024});
 assert.notEqual(faulty.status,0,'The candidate-revision fault escaped detection');
 assert.ok(faulty.stderr.includes('RETRY_COMMIT_ORACLE'),'The injected fault failed for an unrelated reason: '+faulty.stderr);
 const restored=spawnSync(process.execPath,['verify-response-retry-persistence.mjs'],{encoding:'utf8',maxBuffer:8*1024*1024});
 assert.equal(restored.status,0,restored.stderr);assert.equal(fs.readFileSync('app-core.js','utf8'),source);
 console.log(JSON.stringify({synthetic:true,actualBrowser:false,cases:[{fault:'COMPARE_WITH_CANDIDATE_REVISION',oracle:'RETRY_COMMIT_ORACLE',result:'DETECTED'}],restoredImplementation:'PASS'},null,2));
}finally{fs.rmSync(directory,{recursive:true,force:true});}
