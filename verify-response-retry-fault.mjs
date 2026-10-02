import {runVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const source=fs.readFileSync('app-core.js','utf8'),before='async function persistReplacement(next,{expectedProjectRevision=null,',after='async function persistReplacement(next,{expectedProjectRevision=Number(next?.revision||0),';
assert.ok(source.includes(before));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-retry-fault-')),file=path.join(directory,'app-core.js');
try{
 fs.writeFileSync(file,source.replace(before,after));
 const faulty=(await runVerifier(process.execPath,['verify-response-retry-persistence.mjs'],{env:{...process.env,APP_SOURCE:file},encoding:'utf8',maxBuffer:8*1024*1024}));
 assertDetectedFault(faulty,'RETRY_COMMIT_ORACLE','The candidate-revision fault escaped detection');
 assert.ok(faulty.stderr.includes('RETRY_COMMIT_ORACLE'),'The injected fault failed for an unrelated reason: '+faulty.stderr);
 const restored=(await runVerifier(process.execPath,['verify-response-retry-persistence.mjs'],{encoding:'utf8',maxBuffer:8*1024*1024}));
 assert.equal(restored.status,0,restored.stderr);assert.equal(fs.readFileSync('app-core.js','utf8'),source);
 const draftFault=(await runVerifier(process.execPath,['verify-file-selection-drafts.mjs','--fault=drop-selection-drafts'],{encoding:'utf8',maxBuffer:8*1024*1024}));
 assertDetectedFault(draftFault,'FILE_SELECTION_DRAFT_RETENTION_ORACLE','The lost-draft fault escaped detection');assert.ok(draftFault.stderr.includes('FILE_SELECTION_DRAFT_RETENTION_ORACLE'),draftFault.stderr);
 const draftRestored=(await runVerifier(process.execPath,['verify-file-selection-drafts.mjs'],{encoding:'utf8',maxBuffer:8*1024*1024}));assert.equal(draftRestored.status,0,draftRestored.stderr);
 console.log(JSON.stringify({synthetic:true,actualBrowser:false,cases:[{fault:'COMPARE_WITH_CANDIDATE_REVISION',oracle:'RETRY_COMMIT_ORACLE',result:'DETECTED',stdout:faulty.stdout,stderr:faulty.stderr},{fault:'DROP_FILE_SELECTION_DRAFTS',oracle:'FILE_SELECTION_DRAFT_RETENTION_ORACLE',result:'DETECTED',stdout:draftFault.stdout,stderr:draftFault.stderr}],restoredImplementation:'PASS',restoredDraftEvidence:{stdout:draftRestored.stdout,stderr:draftRestored.stderr}},null,2));
}finally{fs.rmSync(directory,{recursive:true,force:true});}
