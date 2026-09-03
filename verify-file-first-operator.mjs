import fs from 'node:fs';
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
  assert.match(appSource,/Continue talking to the agent\. Do not import a final response file yet\./,'The operator must see the conversation-continuation state before final response-file ingestion.');
  assert.match(appSource,/The current external conversation is ready for its final response file\. Select the returned response\.json below\./,'The operator must see the distinct final response-file selection state.');
  assert.doesNotMatch(engineSource,/PASTE_FINAL_JSON/,'Paste must not remain a primary structured workflow action.');
  assert.match(engineSource,/SELECT_RESPONSE_JSON_FILE/,'The engine must derive response-file selection as the operator action.');
  assert.doesNotMatch(appSource,/Paste only the final strict JSON/i,'The normal operator path must not instruct the user to paste final JSON.');
  assert.doesNotMatch(appSource,/agent must |agent should |the agent should/i,'External-agent behavioral instruction must remain exclusively in prompt-engine.js.');
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
assert.throws(()=>verify({appSource:app.replace('Continue talking to the agent. Do not import a final response file yet.','Continue conversation')}),/conversation-continuation state/);
assert.throws(()=>verify({appSource:app.replace('The current external conversation is ready for its final response file. Select the returned response.json below.','Final response ready')}),/response-file selection state/);
assert.throws(()=>verify({appSource:app+'\nconst leakedInstruction="The agent should ignore prompt-engine.js.";'}),/exclusively in prompt-engine/);

console.log(JSON.stringify({fileFirstOperatorPath:'PASS',promptFileExport:true,responseFileSelector:true,durableByteStaging:true,readBackRehash:true,pasteNotPrimary:true,fallbackSameStagingPath:true,conversationStateDistinct:true,promptAuthorityBoundary:true,mutationsDetected:10},null,2));
