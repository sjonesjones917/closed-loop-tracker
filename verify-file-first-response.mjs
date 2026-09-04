import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const app=read('./app-core.js');
const prompt=read('./prompt-engine.js');
const engine=read('./workflow-engine.js');
const ingestion=read('./response-ingestion.js');
const store=read('./project-store.js');
const html=read('./index.html');
const ingestionProof=read('./verify-ingestion.mjs');

export function assertFileFirstResponseContract({appSource=app,promptSource=prompt,engineSource=engine,ingestionSource=ingestion,storeSource=store,htmlSource=html,ingestionProofSource=ingestionProof}={}){
  assertResponseFileInstruction(promptSource);
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
  assert.match(htmlSource,/Select the exact response\.json file returned by the agent in the application/i,'Static operator guidance must identify the selected response.json file and its external-agent origin.');
  assert.doesNotMatch(htmlSource,/Paste only that final JSON|Parse \/ validate response/,'Static guidance must not require pasted final JSON.');
  assert.match(ingestionProofSource,/import ['"]\.\/verify-file-first-response\.mjs['"]/,'The required ingestion proof must permanently execute this file-first regression.');
  assert.match(ingestionProofSource,/import ['"]\.\/verify-file-first-operator\.mjs['"]/,'The required ingestion proof must permanently execute the operator-path mutation regression.');
  return true;
}

function assertResponseFileInstruction(text){
  assert.match(text,/create exactly one authoritative UTF-8 JSON file named response\.json/,'The controlling prompt must require the response.json file.');
  assert.match(text,/Return one authoritative UTF-8 JSON file named response\.json only when ready for machine ingestion/,'Mandatory response rules must require response.json file transport.');
  assert.match(text,/Return every required output artifact as a separate file/,'Required returned artifacts must remain separate files.');
  assert.match(text,/Do not substitute inline or pasted JSON for response\.json/,'Inline JSON must not replace the authoritative response file.');
  assert.match(text,/final chat message must contain only links or attachments to the actual returned files/,'The final files must be accessible to the operator.');
  assert.doesNotMatch(text,/return exactly one complete strict JSON object and no surrounding prose|Return one final strict JSON object only when ready for machine ingestion/,'Inline-only final JSON instructions must not remain.');
}

// Exercise the generated instruction for every registered operation in an isolated runtime.
const runtime=vm.createContext({TextEncoder,TextDecoder,Event:class Event{constructor(type){this.type=type;}},dispatchEvent:()=>true});
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInContext(read('./'+file),runtime,{filename:file});
const {closedLoopCore:core,closedLoopWorkflowSchema:schema,closedLoopWorkflowEngine:workflow,closedLoopPromptEngine:prompts}=runtime;
const state=core.createBlankState('JOB-RESPONSE-FILE-PROMPTS');
Object.assign(state.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Verify response-file transport only.',SUPPLIED_MATERIALS_INVENTORY:'NONE',CURRENT_INPUT_VERSION:'INPUT-FILE-TEST'});
workflow.ensureShape(state);
const manifest=prompts.intakeCoverageManifest(state);
state.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,units:manifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',extractedStatements:[{statementKey:'S'+index,text:unit.rawValueText||unit.label,statementClass:'CONTEXT'}]}))});
state.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';
let generatedOperations=0;
for(let stage=1;stage<=schema.STAGE_COUNT;stage++){
  if(stage>1){state.stages[stage-1].status='COMPLETE';state.stages[stage-1].gate={complete:true};}
  for(const operation of schema.STAGE_CONTRACTS[stage].operations){
    const scope=Object.fromEntries(schema.operationContract(stage,operation).scopeRequirements.map(key=>[key,key==='projectRevision'?0:key.toUpperCase()+'-FILE-TEST']));
    const record=prompts.buildPromptRecord(stage,state,{operation,scope});
    assertResponseFileInstruction(record.prompt);
    generatedOperations++;
  }
}
assert(generatedOperations>=30,'Every stage must be exercised.');

assertFileFirstResponseContract();
assert.throws(()=>assertFileFirstResponseContract({engineSource:engine.replaceAll('SELECT_RESPONSE_JSON_FILE','PASTE_FINAL_JSON')}),/Paste must not remain/,'Mutation restoring paste as the workflow action must fail.');
assert.throws(()=>assertFileFirstResponseContract({appSource:app.replace('id="response-json-file" type="file"','id="response-json-file" type="text"')}),/file input/,'Mutation replacing the primary file selector must fail.');
assert.throws(()=>assertFileFirstResponseContract({storeSource:store.replaceAll('RESPONSE_STAGE_REHASH_MISMATCH','RESPONSE_STAGE_IGNORED_MISMATCH')}),/Read-back byte mismatch/,'Mutation removing staged-byte mismatch enforcement must fail.');
assert.throws(()=>assertFileFirstResponseContract({appSource:app.replaceAll('AUTHORITATIVE_RESPONSE_FILE','TEXT_ONLY')}),/authoritative response-file transport/,'Mutation erasing authoritative transport provenance must fail.');
assert.throws(()=>assertFileFirstResponseContract({htmlSource:html.replace('returned by the agent','from an unspecified source')}),/external-agent origin/,'Mutation erasing the returned-file origin must fail.');
assert.throws(()=>assertFileFirstResponseContract({ingestionProofSource:ingestionProof.replace("import './verify-file-first-response.mjs';",'')}),/permanently execute this file-first regression/,'Mutation removing the regression from the required ingestion proof must fail.');

assert.throws(()=>assertFileFirstResponseContract({promptSource:prompt.replace('create exactly one authoritative UTF-8 JSON file named response.json','return exactly one complete strict JSON object and no surrounding prose')}),/response.json file/,'Mutation restoring inline-only output must fail.');
assert.throws(()=>assertFileFirstResponseContract({promptSource:prompt.replace('Return one authoritative UTF-8 JSON file named response.json only when ready for machine ingestion','Return one final strict JSON object only when ready for machine ingestion')}),/response.json file transport/,'Mutation restoring inline mandatory response rules must fail.');
assert.throws(()=>assertFileFirstResponseContract({promptSource:prompt.replace('Return every required output artifact as a separate file','Describe output artifacts in chat')}),/separate files/,'Mutation dropping required artifact files must fail.');
assert.throws(()=>assertFileFirstResponseContract({promptSource:prompt.replace('final chat message must contain only links or attachments to the actual returned files','final chat message may describe unavailable files')}),/accessible to the operator/,'Mutation removing actual file delivery must fail.');

console.log(JSON.stringify({
  fileFirstResponseContract:'PASS',
  generatedStages:schema.STAGE_COUNT,
  generatedOperations,
  promptOutputMutationsDetected:4,
  primaryResponseFileSelection:true,
  durableByteStaging:true,
  stagedReadBackRehash:true,
  strictUtf8:true,
  textFallbackNonauthoritative:true,
  promptFileExportExposed:true,
  responseFileOriginBound:true,
  requiredIngestionProofInvocation:true,
  pastePrimaryMutationDetected:true,
  fileSelectorMutationDetected:true,
  stagedRehashMutationDetected:true,
  provenanceMutationDetected:true,
  responseOriginMutationDetected:true,
  ciInvocationMutationDetected:true
},null,2));
