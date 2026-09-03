import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync('app-core.js','utf8');
const ingestion=fs.readFileSync('response-ingestion.js','utf8');
const store=fs.readFileSync('project-store.js','utf8');
const engine=fs.readFileSync('workflow-engine.js','utf8');

function verify({appSource=app,ingestionSource=ingestion,storeSource=store,engineSource=engine}={}){
  assert.match(appSource,/id="response-json-file"[^>]*type="file"[^>]*accept="[^"]*(?:application\/json|\.json)/,'The normal external-response path must expose the authoritative JSON file selector.');
  assert.match(appSource,/id="process-response-file"/,'The normal path must stage and validate the selected response file.');
  assert.match(appSource,/stageResponseFile\(/,'The UI must stage selected response bytes before canonical ingestion.');
  assert.match(appSource,/readStagedResponseFile\(/,'The UI must read back staged bytes before parsing.');
  assert.match(storeSource,/HASHED_AND_REVERIFIED/,'The store must record staged-byte hash/read-back verification.');
  assert.match(storeSource,/RESPONSE_STAGE_REHASH_MISMATCH/,'A read-back mismatch must fail closed.');
  assert.match(ingestionSource,/transport:transportRecord/,'Raw-response provenance must retain the response transport basis.');
  assert.match(appSource,/AUTHORITATIVE_RESPONSE_FILE/,'The primary selected-file path must be marked authoritative.');
  assert.match(appSource,/response-text-fallback[\s\S]*Nonauthoritative/,'Text entry may exist only as a clearly nonauthoritative fallback.');
  assert.doesNotMatch(engineSource,/PASTE_FINAL_JSON/,'Paste must not remain a primary structured workflow action.');
  assert.match(engineSource,/SELECT_RESPONSE_JSON_FILE/,'The engine must derive response-file selection as the operator action.');
  assert.doesNotMatch(appSource,/Paste only the final strict JSON/i,'The normal operator path must not instruct the user to paste final JSON.');
  return true;
}

verify();
assert.throws(()=>verify({appSource:app.replace('id="response-json-file" type="file"','id="response-json-file" type="text"')}),/authoritative JSON file selector/);
assert.throws(()=>verify({storeSource:store.replaceAll('RESPONSE_STAGE_REHASH_MISMATCH','RESPONSE_STAGE_IGNORED_MISMATCH')}),/read-back mismatch/);
assert.throws(()=>verify({engineSource:engine.replaceAll('SELECT_RESPONSE_JSON_FILE','PASTE_FINAL_JSON')}),/Paste must not remain/);
assert.throws(()=>verify({appSource:app.replaceAll('AUTHORITATIVE_RESPONSE_FILE','TEXT_ONLY')}),/marked authoritative/);

console.log(JSON.stringify({fileFirstOperatorPath:'PASS',responseFileSelector:true,durableByteStaging:true,readBackRehash:true,pasteNotPrimary:true,mutationsDetected:4},null,2));
