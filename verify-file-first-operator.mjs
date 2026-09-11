import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const app=fs.readFileSync('app-core.js','utf8');
const ingestion=fs.readFileSync('response-ingestion.js','utf8');
const store=fs.readFileSync('project-store.js','utf8');
const engine=fs.readFileSync('workflow-engine.js','utf8');
const prompt=fs.readFileSync('prompt-engine.js','utf8');

function verify({appSource=app,ingestionSource=ingestion,storeSource=store,engineSource=engine,promptSource=prompt}={}){
  assert.match(appSource,/id="response-json-file"[^>]*type="file"[^>]*accept="[^"]*(?:application\/json|\.json)/,'The normal external-response path must expose the authoritative JSON file selector.');
  assert.match(appSource,/const operationSelection=\{\},runSelection=\{\},responseFileSelection=\{\};/,'The file-first UI must retain declared response-file selection state before wiring change and process handlers.');
  assert.match(appSource,/id="process-response-file"/,'The normal path must stage and validate the selected response file.');
  assert.match(appSource,/stageResponseFile\(/,'The UI must stage selected response bytes before canonical ingestion.');
  assert.match(appSource,/async function savePromptRecord\(n\)[\s\S]*reserveAndBuildPromptRecord\(/,'Saving an external instruction must use the reservation-bound prompt transaction helper in the production path.');
  assert.match(promptSource,/function reserveAndBuildPromptRecord\([\s\S]*reserveOperation\(/,'The reservation-bound prompt transaction helper must establish the application-owned operation reservation before prompt registration.');
  assert.match(appSource,/projectStore\.stageResponseFile\(\{[^}]*promptIdentity[^}]*packageId:expectedPrompt\.packageId[^}]*operationReservationId:expectedPrompt\.operationReservationId[^}]*challengeNonce:expectedPrompt\.challengeNonce[^}]*\}\)/,'Response-file staging must retain exact prompt, package, operation-reservation, and challenge-nonce identity in the production staging call.');
  assert.match(storeSource,/stageResponseFile\(\{[\s\S]*promptIdentity=null[\s\S]*packageId=null[\s\S]*operationReservationId=null[\s\S]*challengeNonce=null/,'Durable response-file staging must expose storage for every reservation-bound transport identity.');
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
assert.throws(()=>verify({appSource:app.replace('reserveAndBuildPromptRecord','buildPromptRecord')}),/reservation-bound prompt transaction helper/);
assert.throws(()=>verify({promptSource:prompt.replace('workflow.reserveOperation','workflow.__removedReserveOperation')}),/establish the application-owned operation reservation/);
assert.throws(()=>verify({appSource:app.replace('operationReservationId:expectedPrompt.operationReservationId,challengeNonce:expectedPrompt.challengeNonce','operationReservationId:expectedPrompt.operationReservationId')}),/challenge-nonce identity/);
assert.throws(()=>verify({appSource:app.replaceAll('Export instruction file','Copy instruction text')}),/instruction-file export/);

console.log(JSON.stringify({fileFirstOperatorPath:'PASS',promptFileExport:true,responseFileSelector:true,durableByteStaging:true,readBackRehash:true,reservationTransportIdentityComplete:true,pasteNotPrimary:true,fallbackSameStagingPath:true,mutationsDetected:10},null,2));

// A saved attempt remains the response's authority after staging advanced the UI
// revision. Exercise the production handler rather than a fresh-prompt-only path.
{
  const sha=text=>createHash('sha256').update(text).digest('hex'),text=JSON.stringify({promptIdentity:{instructionId:'SAVED-INSTRUCTION'}}),digest=sha(text);
  const saved={stage:4,operation:'COMPLETE',scope:{projectRevision:1},instructionId:'SAVED-INSTRUCTION',bodySha256:'body',contractSha256:'contract',contextSignature:'context',promptEngineVersion:'test-version',transportBindingRequired:true,packageId:'package',operationReservationId:'reservation',challengeNonce:'nonce'};
  const proposal={proposalId:'EXISTING-PROPOSAL',rawResponseId:'EXISTING-RAW',promptId:saved.instructionId,stage:4,status:'PENDING_OPERATOR_REVIEW',preconditions:{projectRevision:3,promptEngineVersion:'test-version'}};
  const current={job:{JOB_ID:'RESELECT-PENDING'},activeStage:4,revision:3,stages:{4:{}},projectData:{generatedPrompts:[saved],rawResponses:[{rawResponseId:'EXISTING-RAW',sha256:digest,promptInstructionId:saved.instructionId,status:'VALIDATED_PENDING_REVIEW',transport:{authority:'AUTHORITATIVE_RESPONSE_FILE'},proposalId:proposal.proposalId}],responseProposals:[proposal]}};
  const dialogs=[],reports=[];let staged=0,captured=0,downloaded=0,renders=0,inlineReplacements=0;const removedStages=[];
  const runtime=vm.createContext({responseActionFailure:null,closedLoopPromptEngine:{version:saved.promptEngineVersion},current,Blob,Uint8Array,TextDecoder,queueMicrotask,safe:value=>Array.isArray(value)?value:[],promptOptions:()=>({operation:'COMPLETE',scope:{}}),currentPromptEngineVersion:()=>saved.promptEngineVersion,pendingProposal:()=>proposal,announce:message=>reports.push(message),render:()=>renders++,detailViews:new Map(),wireDetails:()=>{},document:{createElement:()=>({content:{firstElementChild:{}}})},esc:String,details:()=>'',$:selector=>selector==='#validation-report'?{focus(){},querySelectorAll:()=>[],replaceWith:()=>inlineReplacements++}:{focus(){}},alert:message=>dialogs.push(String(message)),console:{error(){}},downloadRawRecovery:()=>downloaded++,closedLoopHash:{sha256Text:sha},projectStore:{removeStagedResponseFile:async options=>removedStages.push(options),stageResponseFile:async options=>{staged++;return {...options,stagingId:'STAGED',sha256:digest,byteSize:Buffer.byteLength(text)};},readStagedResponseFile:async()=>({bytes:new TextEncoder().encode(text),sha256:digest,stagingId:'STAGED',byteSize:Buffer.byteLength(text)})},ingestion:{strictParse:JSON.parse,captureRaw:()=>{captured++;throw new Error('A reselected pending response must not be captured again.');}},persistReplacement:async()=>{throw new Error('Reselection must not advance canonical revision.');}});
  const helpers=app.slice(app.indexOf('function promptMatches'),app.indexOf('function operationMarkup'));
  const handler=app.slice(app.indexOf('async function prepareStageResponseFile('),app.indexOf('async function prepareStageResponseFallback('));
  vm.runInContext(helpers+'\n'+app.slice(app.indexOf('function reportResponseFailure'),app.indexOf('function proposalMarkup'))+'\n'+handler+'\nglobalThis.selectResponse=prepareStageResponseFile;',runtime);
  await runtime.selectResponse(new Blob([text],{type:'application/json'}));
  assert.equal(dialogs.length,0,`Response reselection raised a blocking popup instead of preserving the pending proposal: ${dialogs.join(' | ')}`);
  assert.equal(staged,1,'Saved response attempt was rejected before byte staging.');
  assert.equal(captured,0,'Reselection duplicated a pending response.');
  assert.equal(removedStages.length,1,'Reselection retained an unnecessary duplicate response Blob.');
  assert.equal(removedStages[0].stagingId,'STAGED');
  assert.equal(downloaded,0,'Reselection unexpectedly downloaded a recovery file.');
  assert.equal(current.revision,3,'Reselection made the pending proposal stale.');
  assert.equal(proposal.status,'PENDING_OPERATOR_REVIEW');
  const beforeFailureRenders=renders;
  runtime.projectStore.stageResponseFile=async()=>{throw new Error('storage test failure');};
  await runtime.selectResponse(new Blob([text],{type:'application/json'}));
  assert.equal(renders,beforeFailureRenders,'An inline response failure rerendered the form and discarded unsaved operator input.');
  assert.equal(inlineReplacements,1,'Response failure did not update the existing inline validation area.');
  assert.equal(runtime.responseActionFailure.stage,4);
  assert.equal(runtime.responseActionFailure.detail,'storage test failure');
  assert.equal(dialogs.length,0,'A storage failure must use the existing inline validation area.');
  assert.equal(downloaded,0,'A handled storage failure must not automatically copy/download the accumulated response.');
  assert.equal(current.revision,3);
  console.log(JSON.stringify({savedAttemptSurvivesUiRevision:true,pendingResponseReselectionIdempotent:true,responseReselectionDialogs:0}));
}

// Reproduce the reported Stage 05 export through the actual save/export handlers.
// Operational errors belong in existing inline notices, without replacing forms.
{
  const dialogs=[],announcements=[];let rendered=0,downloaded=0,focused=0;
  const notice={textContent:'Existing next action',classList:{add(){}},setAttribute(){},focus(){},scrollIntoView(){}},disclosure={open:false,parentElement:null};
  const input={value:'Unsaved operator text',parentElement:disclosure,focus(){focused++;}};
  const runtime=vm.createContext({actionFailureNotice:null,current:{activeStage:5,revision:7,job:{JOB_ID:'INLINE-EXPORT'}},setTimeout,queueMicrotask,announce:message=>announcements.push(message),alert:message=>dialogs.push(String(message)),render:()=>rendered++,externalAgentOperation:()=>true,selectedOperation:()=> 'COMPLETE',currentPromptRecord:()=>null,currentStage5AuthorContext:()=>null,currentReviewerContext:()=>null,reviewerOperation:()=>false,$:selector=>selector==='#fresh-context-id'?input:notice,document:{activeElement:input},console:{error(){}},Element:class{}});
  disclosure.tagName='DETAILS';
  const reporterStart=app.indexOf('function reportActionFailure(');
  if(reporterStart>=0)vm.runInContext(app.slice(reporterStart,app.indexOf('\nfunction ',reporterStart+1)),runtime);
  vm.runInContext(app.slice(app.indexOf('async function savePromptRecord('),app.indexOf('function promptTransportFilename('))+'\n'+app.slice(app.indexOf('let promptExportInFlight='),app.indexOf('async function exportPromptContext('))+'\nglobalThis.exportAttempt=promptExport;',runtime);
  await runtime.exportAttempt(()=>downloaded++);
  assert.equal(dialogs.length,0,`Stage 05 instruction export opened the reported popup: ${dialogs.join(' | ')}`);
  assert.match(notice.textContent,/conversation|fresh.context/i,'The existing inline notice must explain the missing conversation identifier.');
  assert.equal(disclosure.open,true,'The required existing context input remains hidden.');
  assert.equal(focused,1,'The inline error must point to the existing context input.');
  assert.equal(downloaded,0,'An unbound author instruction was exported.');
  assert.equal(runtime.current.revision,7);
  assert.equal(input.value,'Unsaved operator text');
  assert.equal(rendered,0,'Reporting an operational error must not rerender the form.');
  runtime.savePromptRecord=async()=>{throw new Error('The selected file could not be read. Select it again.');};
  for(let stage=1;stage<=30;stage++){
    runtime.current.activeStage=stage;await runtime.exportAttempt(()=>downloaded++);
    assert.match(notice.textContent,/selected file could not be read/);
  }
  assert.equal(dialogs.length,0,'An all-stage handoff failure opened a native popup.');
  assert.equal(downloaded,0);
  assert.doesNotMatch(app,/\b(?:alert|confirm|prompt)\s*\(/,'Application handlers must use existing inline messaging instead of native popups.');
  console.log(JSON.stringify({stage05ExportFailureInline:true,existingContextControlReachable:true,all30HandoffFailuresInline:true,nativePopups:0,operatorInputPreserved:true}));
}
