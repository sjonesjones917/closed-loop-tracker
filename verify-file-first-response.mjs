import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const app=read('./app-core.js');
const engine=read('./workflow-engine.js');
const ingestion=read('./response-ingestion.js');
const store=read('./project-store.js');
const html=read('./index.html');
const ingestionProof=read('./verify-ingestion.mjs');

export function assertFileFirstResponseContract({appSource=app,engineSource=engine,ingestionSource=ingestion,storeSource=store,htmlSource=html,ingestionProofSource=ingestionProof}={}){
  assert.doesNotMatch(engineSource,/PASTE_FINAL_JSON/,'Paste must not remain a primary workflow action.');
  assert.match(engineSource,/SELECT_RESPONSE_JSON_FILE/,'Workflow engine must expose authoritative response-file selection.');
  assert.match(appSource,/id="response-json-file"[^>]*type="file"/,'Primary response UI must use a file input.');
  assert.match(appSource,/id="process-response-file"/,'Primary response UI must stage and validate the selected file.');
  assert.match(appSource,/response-text-fallback[\s\S]*Nonauthoritative/,'Text entry must be explicitly nonauthoritative fallback only.');
  assert.match(appSource,/stageResponseFile\(/,'Application must stage selected response bytes before ingestion.');
  assert.match(appSource,/readStagedResponseFile\(/,'Application must read back and reverify staged response bytes.');
  assert.match(appSource,/new TextDecoder\('utf-8',\{fatal:true\}\)/,'Authoritative response bytes must use strict UTF-8 decoding.');
  assert.match(appSource,/RESPONSE_FILE_BOM/,'BOM mutation must be rejected.');
  assert.match(storeSource,/closed-loop-response-staging\/1/,'Project store must use one durable response-staging contract.');
  assert.match(storeSource,/HASHED_AND_REVERIFIED/,'Staging must record hash/read-back verification state.');
  assert.match(storeSource,/RESPONSE_STAGE_REHASH_MISMATCH/,'Read-back byte mismatch must fail closed.');
  assert.match(appSource,/AUTHORITATIVE_RESPONSE_FILE/,'Primary file path must declare authoritative response-file transport.');
  assert.match(ingestionSource,/transport:transportRecord/,'Raw response records must preserve the supplied transport basis.');
  assert.match(ingestionSource,/NONAUTHORITATIVE_TEXT_FALLBACK/,'Fallback transport must remain explicitly nonauthoritative.');
  assert.match(ingestionSource,/RESPONSE_FILE_DECODE_HASH_MISMATCH/,'Decoded text must remain bound to exact staged bytes.');
  assert.match(appSource,/id="export-prompt-file"/,'External work must expose instruction-file export without requiring clipboard use.');
  assert.match(htmlSource,/obtain the authoritative response\.json file for the current instruction/i,'Static operator guidance must identify the authoritative response.json filename and current-instruction binding.');
  assert.match(htmlSource,/Select that exact response JSON file in the application/,'Static operator guidance must describe file-first response ingestion.');
  assert.doesNotMatch(htmlSource,/Paste only that final JSON|Parse \/ validate response/,'Static guidance must not require pasted final JSON.');
  assert.match(ingestionProofSource,/import ['"]\.\/verify-file-first-response\.mjs['"]/,'The required ingestion proof must permanently execute this file-first regression.');
  assert.match(ingestionProofSource,/import ['"]\.\/verify-file-first-operator\.mjs['"]/,'The required ingestion proof must permanently execute the operator-path mutation regression.');
  return true;
}

assertFileFirstResponseContract();
assert.throws(()=>assertFileFirstResponseContract({engineSource:engine.replaceAll('SELECT_RESPONSE_JSON_FILE','PASTE_FINAL_JSON')}),/Paste must not remain/,'Mutation restoring paste as the workflow action must fail.');
assert.throws(()=>assertFileFirstResponseContract({appSource:app.replace('id="response-json-file" type="file"','id="response-json-file" type="text"')}),/file input/,'Mutation replacing the primary file selector must fail.');
assert.throws(()=>assertFileFirstResponseContract({storeSource:store.replaceAll('RESPONSE_STAGE_REHASH_MISMATCH','RESPONSE_STAGE_IGNORED_MISMATCH')}),/Read-back byte mismatch/,'Mutation removing staged-byte mismatch enforcement must fail.');
assert.throws(()=>assertFileFirstResponseContract({appSource:app.replaceAll('AUTHORITATIVE_RESPONSE_FILE','TEXT_ONLY')}),/authoritative response-file transport/,'Mutation erasing authoritative transport provenance must fail.');
assert.throws(()=>assertFileFirstResponseContract({ingestionProofSource:ingestionProof.replace("import './verify-file-first-response.mjs';",'')}),/permanently execute this file-first regression/,'Mutation removing the regression from the required ingestion proof must fail.');

console.log(JSON.stringify({
  fileFirstResponseContract:'PASS',
  primaryResponseFileSelection:true,
  durableByteStaging:true,
  stagedReadBackRehash:true,
  strictUtf8:true,
  textFallbackNonauthoritative:true,
  promptFileExportExposed:true,
  requiredIngestionProofInvocation:true,
  pastePrimaryMutationDetected:true,
  fileSelectorMutationDetected:true,
  stagedRehashMutationDetected:true,
  provenanceMutationDetected:true,
  ciInvocationMutationDetected:true
},null,2));
