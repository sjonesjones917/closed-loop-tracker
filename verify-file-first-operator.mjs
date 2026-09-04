import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app=fs.readFileSync('app-core.js','utf8');
const ingestion=fs.readFileSync('response-ingestion.js','utf8');
const store=fs.readFileSync('project-store.js','utf8');
const engine=fs.readFileSync('workflow-engine.js','utf8');

function verify({appSource=app,ingestionSource=ingestion,storeSource=store,engineSource=engine}={}){
  assert.match(appSource,/id="response-json-file"[^>]*type="file"[^>]*accept="[^"]*(?:application\/json|\.json)/,'The normal external-response path must expose the authoritative JSON file selector.');
  assert.match(appSource,/const operationSelection=\{\},runSelection=\{\},responseFileSelection=\{\};/,'The file-first UI must retain declared response-file selection state before wiring change and process handlers.');
  assert.match(appSource,/id="process-response-file"/,'The normal path must stage and validate the selected response file.');
  assert.match(appSource,/stageResponseFile\(/,'The UI must stage selected response bytes before canonical ingestion.');
  assert.match(appSource,/readStagedResponseFile\(/,'The UI must read back staged bytes before parsing.');
  assert.match(appSource,/Export instruction file/,'The normal external handoff must expose authoritative instruction-file export.');
  assert.match(storeSource,/HASHED_AND_REVERIFIED/,'The store must record staged-byte hash/read-back verification.');
  assert.match(storeSource,/RESPONSE_STAGE_REHASH_MISMATCH/,'A read-back mismatch must fail closed.');
  assert.match(ingestionSource,/transport:transportRecord/,'Raw-response provenance must retain the response transport basis.');
  assert.match(appSource,/AUTHORITATIVE_RESPONSE_FILE/,'The primary selected-file path must be marked authoritative.');
  assert.match(appSource,/response-text-fallback[\s\S]*Nonauthoritative/,'Text entry may exist only as a clearly nonauthoritative fallback.');
  assert.match(appSource,/async function prepareStageResponseFallback\(\)[\s\S]*new Blob\([\s\S]*prepareStageResponseFile\(blob,\{nonauthoritativeFallback:true\}\)/,'Fallback text must be materialized as a response-file Blob and sent through the same staging path.');
  assert.doesNotMatch(engineSource,/PASTE_FINAL_JSON/,'Paste must not remain a primary structured workflow action.');
  assert.match(engineSource,/SELECT_RESPONSE_JSON_FILE/,'The engine must derive response-file selection as the operator action.');
  assert.doesNotMatch(appSource,/Paste only the final strict JSON/i,'The normal operator path must not instruct the user to paste final JSON.');
  return true;
}

verify();
assert.throws(()=>verify({appSource:app.replace('id="response-json-file" type="file"','id="response-json-file" type="text"')}),/authoritative JSON file selector/);
assert.throws(()=>verify({appSource:app.replace('const operationSelection={},runSelection={},responseFileSelection={};','const operationSelection={},runSelection={};')}),/declared response-file selection state/);
assert.throws(()=>verify({storeSource:store.replaceAll('RESPONSE_STAGE_REHASH_MISMATCH','RESPONSE_STAGE_IGNORED_MISMATCH')}),/read-back mismatch/);
assert.throws(()=>verify({engineSource:engine.replaceAll('SELECT_RESPONSE_JSON_FILE','PASTE_FINAL_JSON')}),/Paste must not remain/);
assert.throws(()=>verify({appSource:app.replaceAll('AUTHORITATIVE_RESPONSE_FILE','TEXT_ONLY')}),/marked authoritative/);
assert.throws(()=>verify({appSource:app.replace('prepareStageResponseFile(blob,{nonauthoritativeFallback:true})','ingestion.captureRaw(current,{text})')}),/same staging path/);
assert.throws(()=>verify({appSource:app.replaceAll('Export instruction file','Copy instruction text')}),/instruction-file export/);

// Permanent behavioral regression for Section 10.1: the exact exported instruction.txt
// bytes are the prompt body and bodySha256 authority. BOM insertion, CRLF conversion,
// missing final newline, wrapper text, or any one-byte mutation must change/reject identity.
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore;
const promptEngine=globalThis.closedLoopPromptEngine;
const hash=globalThis.closedLoopHash;
const project=core.createBlankState('JOB-PROMPT-BYTE-IDENTITY');
project.job.EXACT_USER_OBJECTIVE_VERBATIM='Verify exact authoritative prompt bytes.';
project.job.CURRENT_INPUT_VERSION=project.job.CURRENT_INPUT_VERSION||'INPUT-PROMPT-1';
const record=promptEngine.buildPromptRecord(1,project,{operation:'COMPLETE'});
const authoritativeBytes=new TextEncoder().encode(record.prompt);
assert.equal(authoritativeBytes[0]===0xEF&&authoritativeBytes[1]===0xBB&&authoritativeBytes[2]===0xBF,false,'Authoritative prompt contains a UTF-8 BOM.');
assert.equal(record.prompt.includes('\r\n'),false,'Authoritative prompt contains CRLF instead of LF.');
assert.equal(record.prompt.endsWith('\n'),true,'Authoritative prompt is missing the required final newline.');
assert.equal(hash.sha256Text(record.prompt),record.bodySha256,'promptIdentity.bodySha256 does not hash the exact authoritative instruction.txt byte sequence.');
for(const [name,mutated] of [
  ['BOM','\uFEFF'+record.prompt],
  ['CRLF',record.prompt.replaceAll('\n','\r\n')],
  ['missing final newline',record.prompt.slice(0,-1)],
  ['wrapper','WRAPPER\n'+record.prompt],
  ['one-byte',record.prompt.slice(0,-2)+'X\n']
])assert.notEqual(hash.sha256Text(mutated),record.bodySha256,`${name} mutation escaped prompt byte identity.`);

console.log(JSON.stringify({fileFirstOperatorPath:'PASS',promptFileExport:true,responseFileSelector:true,durableByteStaging:true,readBackRehash:true,pasteNotPrimary:true,fallbackSameStagingPath:true,promptByteIdentity:true,mutationsDetected:12},null,2));
