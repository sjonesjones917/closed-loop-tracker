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
  assert.match(appSource,/async function savePromptRecord\(n(?:,retry=true)?\)[\s\S]*reserveAndBuildPromptRecord\(/,'Saving an external instruction must use the reservation-bound prompt transaction helper in the production path.');
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

// The old failed attempt remains audit history after a newer response is
// accepted. Exercise the production selector in every stage view.
{
  const runtime=vm.createContext({safe:x=>Array.isArray(x)?x:[],operatorLaneMatches:(x,n)=>Number(x.stage)===n&&x.operation==='COMPLETE'});
  const selectionSource=(app.match(/^function (?:latestResponseAttempt|latestResponseValidation|pendingReturnedResponse)\([^\n]+/gm)||[]).join('\n');
  const validationSource=app.slice(app.indexOf('function validationMarkup('),app.indexOf('function proposalMarkup('));
  Object.assign(runtime,{responseActionFailure:null,esc:String,details:()=>'',currentPromptRecord:()=>null});
  vm.runInContext(selectionSource+'\n'+validationSource+'\nglobalThis.pending=pendingReturnedResponse;globalThis.validation=validationMarkup;',runtime);
  for(let stage=1;stage<=30;stage++){
    const old={rawResponseId:'OLD',stage,status:'VALIDATION_FAILED',validationId:'OLD-VALIDATION',promptInstructionId:'OLD-PROMPT',files:[{name:'old-design.md'}]},latest={rawResponseId:'NEW',stage,status:'ACCEPTED_DATA_CHANGE',validationId:'NEW-VALIDATION',promptInstructionId:'NEW-PROMPT',files:[]};
    runtime.current={activeStage:stage,projectData:{rawResponses:[old,latest],responseValidations:[{stage,validationId:'NEW-VALIDATION',valid:true},{stage,validationId:'OLD-VALIDATION',valid:false,issues:[]}],generatedPrompts:[{instructionId:'OLD-PROMPT',stage,operation:'COMPLETE',scope:{}},{instructionId:'NEW-PROMPT',stage,operation:'COMPLETE',scope:{}}]}};
    assert.equal(runtime.pending(),null,`Stage ${stage} resurrected a failed response's files after a newer response was accepted.`);
    assert.equal(runtime.validation(stage),'',`Stage ${stage} displayed an obsolete validation report for the accepted attempt.`);
    latest.status='PRESERVED';assert.equal(runtime.pending()?.rawResponseId,'NEW',`Stage ${stage} lost its current pending file attempt.`);
    latest.status='ACCEPTED_DATA_CHANGE';runtime.current.projectData.rawResponses.push({...old,rawResponseId:'OTHER-OP',promptInstructionId:'OTHER-PROMPT'});runtime.current.projectData.generatedPrompts.push({instructionId:'OTHER-PROMPT',stage,operation:'OTHER',scope:{}});
    assert.equal(runtime.pending(),null,`Stage ${stage} mixed an unrelated operation's pending response into the accepted operation.`);
  }
}
// One current response mode: an older success cannot hide a newer rejection.
{
 const runtime=vm.createContext({safe:x=>Array.isArray(x)?x:[],esc:String,operatorLaneMatches:(x,n)=>Number(x.stage)===n&&x.operation==='COMPLETE',currentNextAction:()=>({}),pendingProposal:()=>null,acceptedLaneChanges:()=>[{changeId:'OLD-CHANGE'}],stageLocked:()=>null,canonicalCurrentStage:()=>1,reviewerOperation:()=>false});
 const source=(app.match(/^function (?:latestResponseAttempt|latestResponseValidation|interactionModeMarkup)\([^\n]+/gm)||[]).join('\n');
 vm.runInContext(source+'\nglobalThis.mode=interactionModeMarkup;',runtime);
 for(let stage=1;stage<=30;stage++){
  runtime.current={activeStage:stage,stages:{[stage]:{status:'IN PROGRESS'}},projectData:{generatedPrompts:[{instructionId:'CURRENT',stage,operation:'COMPLETE',scope:{}}],rawResponses:[{rawResponseId:'NEW',stage,status:'VALIDATION_FAILED',promptInstructionId:'CURRENT',validationId:'FAILED'}],responseValidations:[{validationId:'FAILED',stage,valid:false}]}};
  assert.match(runtime.mode(stage),/Return a corrected final JSON/,'An old acceptance hid the current rejection at stage '+stage);
  runtime.current.projectData.rawResponses[0].status='ACCEPTED_DATA_CHANGE';runtime.current.projectData.responseValidations[0].valid=true;
  assert.match(runtime.mode(stage),/The application accepted this response/,'The current accepted response lost its receipt at stage '+stage);
 }
}
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

// Real save/export must prepare its own context. No naming form, popup,
// or human bookkeeping event may stand between the operator and the files.
{
  const dialogs=[],announcements=[];let rendered=0,downloaded=0;
  const notice={textContent:'Existing next action',className:'notice',classList:{add(){}},focus(){},scrollIntoView(){},setAttribute(){}};
  const runtime=vm.createContext({setTimeout,queueMicrotask,structuredClone,TextEncoder,TextDecoder,URL,Blob,crypto:globalThis.crypto,Event:class Event{},dispatchEvent(){},console,actionFailureNotice:null,announce:message=>announcements.push(message),alert:message=>dialogs.push(String(message)),render:()=>rendered++,externalAgentOperation:()=>true,selectedOperation:()=> 'COMPLETE',promptOptions:()=>({operation:'COMPLETE'}),currentStage5AuthorContext:()=>null,currentReviewerContext:()=>null,reviewerOperation:()=>false,clone:structuredClone,TAB_INSTANCE_ID:'TAB-FILE-FIRST', $:selector=>selector==='#fresh-context-id'?null:notice});
  for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInContext(fs.readFileSync(file,'utf8'),runtime,{filename:file});
  runtime.current=runtime.closedLoopCore.createBlankState('JOB-FILE-FIRST-AUTOMATIC-CONTEXT');runtime.current.activeStage=5;runtime.current.revision=7;
  runtime.closedLoopWorkflowEngine.ensureShape(runtime.current);runtime.closedLoopWorkflowEngine.recalculate(runtime.current);runtime.current.stages[4].status='COMPLETE';runtime.current.stages[4].gate={complete:true};
  runtime.currentPromptRecord=n=>runtime.current.projectData.generatedPrompts.filter(p=>Number(p.stage)===Number(n)&&!p.invalidatedBy&&Number(p.scope.projectRevision)===runtime.current.revision).at(-1)||null;
  runtime.persistReplacement=async next=>{runtime.current=next;};
  const reporterStart=app.indexOf('function reportActionFailure(');
  vm.runInContext(app.slice(reporterStart,app.indexOf('\nfunction ',reporterStart+1)),runtime);
  vm.runInContext(app.slice(app.indexOf('async function savePromptRecord('),app.indexOf('function promptTransportFilename('))+'\n'+app.slice(app.indexOf('let promptExportInFlight='),app.indexOf('async function exportPromptContext('))+'\nglobalThis.exportAttempt=promptExport;',runtime);
  let exported;
  await runtime.exportAttempt(record=>{exported=record;downloaded++;});
  assert.equal(downloaded,1,`Stage 05 still blocks export on manual bookkeeping: ${notice.textContent}`);
  assert(exported.contextManifest.semanticReviewBinding.authorContextId,'Export did not bind the application-created context.');
  assert.equal(runtime.current.revision,8,'Context and prompt reservation must persist in one transaction.');
  assert.equal(runtime.current.projectData.freshContexts.length,1);
  assert.equal(runtime.current.projectData.freshContexts[0].EXTERNAL_CONTEXT_IDENTIFIER,'UNKNOWN');
  await runtime.exportAttempt(record=>{assert.equal(record.instructionId,exported.instructionId);downloaded++;});
  assert.equal(runtime.current.projectData.freshContexts.length,1,'Manifest/instruction export must not duplicate context records.');
  assert.equal(runtime.current.revision,8);
  assert.equal(dialogs.length,0);
  assert.doesNotMatch(app,/id="fresh-context-id"|id="add-fresh-context"/,'Routine workflow must not ask the human to name/register application contexts.');
  runtime.current=runtime.closedLoopCore.createBlankState('JOB-REVIEWER-NEXT-ACTION');runtime.current.activeStage=9;runtime.closedLoopWorkflowEngine.ensureShape(runtime.current);runtime.current.stages[8].status='COMPLETE';runtime.current.stages[8].gate={complete:true};
  const nextAction=runtime.closedLoopWorkflowEngine.operationalNextAction(runtime.current,9);
  assert.equal(nextAction.primaryButton,'Export instruction file','The reviewer action must export instructions directly, not require a saved verification package first.');
  const button={dataset:{operation:nextAction.operation}};runtime.$=selector=>selector==='#next-export-prompt-file'?button:notice;runtime.operationSelection={};runtime.exportPromptFile=()=>runtime.exportAttempt(()=>downloaded++);
  const wireStart=app.indexOf('function wire(){')+'function wire(){'.length,wireEnd=app.indexOf("if($('#export-prompt-context'))",wireStart);
  vm.runInContext(app.slice(wireStart,wireEnd),runtime);await button.onclick();
  assert.equal(downloaded,3,'The actual next-action handler failed to reach automatic instruction export.');
  assert.equal(runtime.operationSelection[9],'COMPLETE');assert.equal(runtime.current.projectData.freshContexts.length,1);
  runtime.savePromptRecord=async()=>{throw new Error('The selected file could not be read. Select it again.');};
  for(let stage=1;stage<=30;stage++){
    runtime.current.activeStage=stage;await runtime.exportAttempt(()=>downloaded++);
    assert.match(notice.textContent,/selected file could not be read/);
  }
  assert.equal(downloaded,3);assert.equal(dialogs.length,0);assert.equal(rendered,0);
  assert.doesNotMatch(app,/\b(?:alert|confirm|prompt)\s*\(/,'Application handlers must use existing inline messaging instead of native popups.');
  console.log(JSON.stringify({stage05ContextAutomatic:true,noManualContextForm:true,contextReservationAtomic:true,all30HandoffFailuresInline:true,nativePopups:0}));
}


// A durable write from another operation/tab must not strand the UI at its old
// revision. Retry validation from the stored raw response and retained files;
// never overwrite the newer project with the failed candidate.
{
  const failures=[],downloads=[];
  const runtime=vm.createContext({setTimeout,queueMicrotask,structuredClone,TextEncoder,TextDecoder,Blob,crypto:globalThis.crypto,Event:class Event{},dispatchEvent(){},console,safe:v=>Array.isArray(v)?v:[],clone:structuredClone,TAB_INSTANCE_ID:'TAB-REVISION-RECOVERY',responseActionFailure:null,announce(){},render(){},$:()=>({focus(){}}),reportResponseFailure:(message,error)=>failures.push(String(error?.message||message)),reportActionFailure:error=>failures.push(String(error.message||error)),externalAgentOperation:()=>true,selectedOperation:()=> 'COMPLETE',promptOptions:()=>({operation:'COMPLETE'}),operatorLaneMatches:()=>true,reverifyReturnedFiles:async()=>{}});
  for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInContext(fs.readFileSync(file,'utf8'),runtime,{filename:file});
  runtime.clone=vm.runInContext('(value)=>JSON.parse(JSON.stringify(value))',runtime);
  const engine=runtime.closedLoopWorkflowEngine,ingestion=runtime.closedLoopResponseIngestion,prompts=runtime.closedLoopPromptEngine;
  let p=runtime.closedLoopCore.createBlankState('JOB-RETURNED-REVISION-RECOVERY');p.activeStage=6;p.activeView='Workflow';p.revision=82;engine.ensureShape(p);p.stages[5].status='COMPLETE';p.stages[5].gate={complete:true};
  const saved=prompts.reserveAndBuildPromptRecord(p,6,{operation:'COMPLETE'}).prompt;
  p=ingestion.captureRaw(p,{stage:6,text:'{"broken":true}',promptRecord:saved,files:[{attachmentSlotId:'DESIGN',artifactId:'DESIGN-BYTES',name:'design.md',sha256:'retained-digest'}]}).project;p.revision=84;
  runtime.current=p;runtime.projects=[p];runtime.ingestion=ingestion;runtime.engine=engine;runtime.schema=runtime.closedLoopWorkflowSchema;runtime.operatorScopeKeys=['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId'];runtime.currentPromptEngineVersion=()=>prompts.version;
  let stored=structuredClone(p);stored.revision=85;stored.projectData.userEntered.concurrentMarker='PRESERVE NEWER WORK';let staleWrites=0;
  runtime.projectStore={readProject:async()=>structuredClone(stored),replaceProject:async(next,{expectedProjectRevision})=>{if(expectedProjectRevision!==stored.revision){staleWrites++;throw Object.assign(new Error(`Project revision conflict: expected ${expectedProjectRevision}, found ${stored.revision}.`),{code:'STALE_PROJECT_REVISION'});}stored=structuredClone(next);stored.revision=expectedProjectRevision+1;return structuredClone(stored);}};
  runtime.currentPromptRecord=n=>runtime.current.projectData.generatedPrompts.filter(x=>Number(x.stage)===n&&!x.invalidatedBy&&Number(x.scope.projectRevision)===runtime.current.revision).at(-1)||null;
  function fn(name){const start=app.search(new RegExp('(?:async )?function '+name+'\\(')),end=app.indexOf('\nfunction ',start+1),asyncEnd=app.indexOf('\nasync function ',start+1);return app.slice(start,Math.min(...[end,asyncEnd].filter(x=>x>=0)));}
  vm.runInContext(['currentOperatorScope','operatorLaneMatches','promptMatches','promptVersionCurrent','currentPromptRecord','persistReplacement','latestResponseAttempt','pendingReturnedResponse','validateReturnedResponse','savePromptRecord'].map(fn).join('\n')+'\n'+app.slice(app.indexOf('let promptExportInFlight='),app.indexOf('async function exportPromptContext('))+'\nglobalThis.validate=validateReturnedResponse;globalThis.exportAttempt=promptExport;',runtime);
  assert.equal(vm.runInContext('currentPromptRecord(6)?.instructionId',runtime),saved.instructionId,'Raw capture incorrectly stales the still-open instruction and blocks manifest re-export.');
  const priorInput=runtime.current.job.CURRENT_INPUT_VERSION;runtime.current.job.CURRENT_INPUT_VERSION='CHANGED-AUTHORITY';
  assert.equal(vm.runInContext('currentPromptRecord(6)',runtime),null,'A changed authority scope must not reuse an older instruction.');runtime.current.job.CURRENT_INPUT_VERSION=priorInput;
  await runtime.validate();
  assert.equal(failures.length,0,`Returned-file validation stranded the operator: ${failures.join(' | ')}`);
  assert.equal(staleWrites,1,'The fixture did not exercise the durable revision conflict.');
  assert.equal(stored.projectData.userEntered.concurrentMarker,'PRESERVE NEWER WORK');
  assert.equal(stored.projectData.rawResponses[0].files[0].artifactId,'DESIGN-BYTES');
  assert.equal(stored.projectData.responseValidations.length,1,'Recovery must validate the retained response once.');
  assert.equal(stored.projectData.responseValidations[0].valid,false);
  // A second stale revision must also recover on the actual manifest exporter.
  // This focused fixture represents completed upstream work without constructing
  // the separate Stage 01–05 acceptance fixtures. Restore that prerequisite.
  stored.stages[5].status='COMPLETE';stored.stages[5].gate={complete:true};runtime.current.stages[5].status='COMPLETE';runtime.current.stages[5].gate={complete:true};
  stored.revision++;stored.projectData.userEntered.secondMarker='KEEP THIS TOO';
  await runtime.exportAttempt(record=>downloads.push(prompts.promptFileManifest(record)));
  assert.equal(failures.length,0,`Correction manifest export failed: ${failures.join(' | ')}`);
  assert.equal(downloads.length,1,'The correction manifest was not exported.');
  assert.notEqual(downloads[0].promptIdentity.instructionId,saved.instructionId);
  assert.equal(stored.projectData.userEntered.secondMarker,'KEEP THIS TOO');
  assert(stored.projectData.generatedPrompts.at(-1).contextManifest.latestValidationFailure.length,'Correction instruction must carry the recorded validation failure.');
  // An already-open Stage 06 attempt created before this repair must receive the
  // missing schedule on export, without invalidating its preserved response.
  stored.stages[5].status='COMPLETE';stored.stages[5].gate={complete:true};runtime.current.stages[5].status='COMPLETE';runtime.current.stages[5].gate={complete:true};
  delete stored.projectData.generatedPrompts.at(-1).contextManifest.verificationScheduleVersion;
  delete runtime.current.projectData.generatedPrompts.at(-1).contextManifest.verificationScheduleVersion;
  await runtime.exportAttempt(record=>downloads.push(prompts.promptFileManifest(record)));
  assert.equal(failures.length,0,`Historical Stage 06 instruction upgrade failed: ${failures.join(' | ')}`);
  assert.notEqual(downloads.at(-1).promptIdentity.instructionId,downloads[0].promptIdentity.instructionId);
  assert.equal(stored.projectData.generatedPrompts.at(-1).contextManifest.verificationScheduleVersion,'closed-loop-verification-schedule/1');
  const count=stored.projectData.generatedPrompts.length;
  await runtime.exportAttempt(record=>downloads.push(prompts.promptFileManifest(record)));
  assert.equal(stored.projectData.generatedPrompts.length,count,'Repeated manifest export created another attempt.');
  assert.equal(downloads.at(-1).promptIdentity.instructionId,downloads.at(-2).promptIdentity.instructionId);
  console.log(JSON.stringify({returnedFileRevisionRecovery:true,retainedBytesPreserved:true,newerWorkPreserved:true,correctionManifestExported:true}));
}
