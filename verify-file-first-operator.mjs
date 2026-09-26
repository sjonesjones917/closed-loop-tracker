import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {stage04AcceptanceFixture,accumulatedStage04Fixture,evidence,stageHandoffRecoveryProof,scalarFor,recordProposal,stage04AcceptanceEnvelope} from './test-fixtures.mjs';
import {projectStoreRuntime,bindAcceptanceUi} from './test-project-store-runtime.mjs';
import {readStoreArchive} from './test-zip.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {appMarkup,observeWorkflowMarkup,assertWorkflowPresentation} from './test-app-markup.mjs';

// These focused fixtures exercise ordinary projects outside device acceptance mode.
// History is exercised by verify-recoverable-history and the browser recovery gate.
const inactiveMobileAcceptance={captureCurrentView:async()=>{},captureView:()=>null,recordCommittedBoundary:async()=>{},APPLICATION_SESSION_ID:'LIFECYCLE-TEST',initializeHistoryNavigation:async()=>{},focusAfterAction:node=>node?.focus(),mobileSessionCurrent:()=>false,recordMobileExport:async()=>{},recordMobileOperation:async()=>{},recordMobileValidation:async()=>{},mobileBackupSelection:async()=>null,recordMobileBackupRestore:async()=>{}};

let app=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');if(process.argv.includes('--fault=selected-operation')){const anchor='if(!registration||explicit===action.operation)return action;';assert.equal(app.split(anchor).length-1,1);app=app.replace(anchor,'if(true)return action;');}
const ingestion=fs.readFileSync('response-ingestion.js','utf8');
const store=fs.readFileSync('project-store.js','utf8');
const engine=fs.readFileSync('workflow-engine.js','utf8');
const prompt=fs.readFileSync('prompt-engine.js','utf8');

// The selected operation, its instruction and its sole handoff must agree.
{
 const runtime=createVerifierRuntime({Event:class Event{},dispatchEvent(){},document:{currentScript:null,querySelector:()=>null,querySelectorAll:()=>[]}});
 for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])createVerifierRuntime.loadScript(runtime,fs.readFileSync(file,'utf8'),{filename:file});
 const schema=runtime.closedLoopWorkflowSchema,engine=runtime.closedLoopWorkflowEngine,fixtureRuntime={core:runtime.closedLoopCore,schema,engine,prompts:runtime.closedLoopPromptEngine,ingestion:runtime.closedLoopResponseIngestion},results=[];
 const fixture=stage04AcceptanceFixture(fixtureRuntime,'SELECTED-OPERATION-HANDOFF');
 for(const stage of Object.keys(fixture.stages).map(Number))for(const operation of schema.STAGE_CONTRACTS[stage].operations){
  const p=engine.clone(fixture);p.activeStage=stage;const before=JSON.stringify(p),rendered=appMarkup(runtime,p,{operations:{[stage]:operation},source:app,instructionEvidence:true}),match=rendered.html.match(/id="next-export-prompt-file" data-operation="([^"]+)"/),actual=match?.[1]||null;
  assert.equal(JSON.stringify(p),before,'SELECTED_OPERATION_HANDOFF_ORACLE: selection changed accepted data');
  if(actual!==null){assert.equal(actual,operation,'SELECTED_OPERATION_HANDOFF_ORACLE: exported handoff ignores the chosen operation');assert.ok(rendered.html.includes('Double-check before you continue'),'SELECTED_OPERATION_HANDOFF_ORACLE: operation selection lost required operator checks');}
  if(schema.STAGE_OPERATION_REGISTRY[stage+':'+operation].executorClass!=='EXTERNAL_AGENT')assert.equal(actual,null,'SELECTED_OPERATION_HANDOFF_ORACLE: application or human work exported an agent instruction');
  if([1,2].includes(stage)&&schema.STAGE_OPERATION_REGISTRY[stage+':'+operation].executorClass==='EXTERNAL_AGENT')assert.equal(actual,operation,'SELECTED_OPERATION_HANDOFF_ORACLE: permitted earlier-stage operation has no handoff');
  results.push({stage,operation,exportedOperation:actual,acceptedStatePreserved:true,result:'PASS'});
 }
 console.log(JSON.stringify({caseId:'SELECTED_OPERATION_HANDOFF',synthetic:true,actualBrowser:false,results}));
}

// Exercise the application's one shared pending-action controller.
await import('./verify-operator-action-lifecycle.mjs');

// User input belongs to the project form; a successful save must lead to the
// current workflow, including an unchanged save. Repeated clicks share one save.
{
  const writes=[],views=[],notices=[];let release;
  const fields=[{dataset:{job:'EXACT_USER_OBJECTIVE_VERBATIM'},type:'text',value:'Create the requested checklist.'}];
  const runtime=createVerifierRuntime({...inactiveMobileAcceptance,structuredClone,clone:structuredClone,setTimeout,clearTimeout,
    current:{activeStage:1,activeView:'Project',job:{JOB_ID:'SAVE-PATH',EXACT_USER_OBJECTIVE_VERBATIM:''},stages:{1:{status:'NOT STARTED'}},projectData:{}},
    document:{querySelector:()=>null,querySelectorAll:()=>fields},$:()=>null,
    engine:{recordHumanInputVersion(p){p.job.CURRENT_STAGE='STAGE 01';}},
    canonicalCurrentStage:()=>1,withStorageActivity:async(_label,work)=>work(),
    announce:message=>notices.push(message),reportActionFailure:error=>notices.push(error.message),
    render:()=>views.push(runtime.current.activeView),requestAnimationFrame:fn=>fn(),
    persistReplacement:async p=>{writes.push(p);await new Promise(resolve=>release=resolve);runtime.current=p;}});
  const start=app.indexOf('let jobSaveInFlight=')>=0?app.indexOf('let jobSaveInFlight='):app.indexOf('async function saveJob(');
  vm.runInContext(app.slice(start,app.indexOf('async function saveHumanStageFields(',start))+'\nglobalThis.save=saveJob;',runtime);
  const first=runtime.save();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(writes.length,1,'Repeated project-save clicks execute duplicate canonical writes.');
  release();await first;
  assert.equal(runtime.current.activeView,'Workflow','Successful project-information save did not open the workflow.');
  runtime.current.activeView='Project';await runtime.save();
  assert.equal(runtime.current.activeView,'Workflow','Unchanged project-information save stranded the operator on the form.');
  assert.equal(writes.length,1,'An unchanged save must not create another canonical revision.');
  assert(notices.some(message=>/saved/i.test(message)),'Successful save has no completion feedback.');
}

// Simultaneous export clicks must share the same operation and receipt, not
// serialize duplicate exports after the first one completes.
{
  let saves=0,downloads=0,release;const notices=[];
  const runtime=createVerifierRuntime({current:{activeStage:1,job:{JOB_ID:'EXPORT-RETRY'}},setTimeout,clearTimeout,
    announce:message=>notices.push(message),reportActionFailure:error=>notices.push(error.message),
    withStorageActivity:async(_label,work)=>work(),document:{querySelectorAll:()=>[]},$:()=>null,
    savePromptRecord:async()=>{saves++;await new Promise(resolve=>release=resolve);return {instructionId:'SAME'};}});
  vm.runInContext(app.slice(app.indexOf('let promptExportInFlight='),app.indexOf('async function exportPromptContext('))+'\nglobalThis.exportAttempt=promptExport;',runtime);
  const first=runtime.exportAttempt(()=>downloads++,'stage-files'),duplicate=runtime.exportAttempt(()=>downloads++,'stage-files');
  await new Promise(resolve=>setTimeout(resolve,5));assert.equal(saves,1);release();
  await Promise.all([first,duplicate]);
  assert.equal(saves,1,'Repeated export clicks prepared another instruction after completion.');
  assert.equal(downloads,1,'Repeated export clicks downloaded the same handoff twice.');
}

// The complete workflow renderer must advertise required files before the first
// save/export, using the same preview it already built without reserving work.
{
  const runtime=createVerifierRuntime({...inactiveMobileAcceptance,crypto:globalThis.crypto,URL,structuredClone,console,TextEncoder,TextDecoder,Blob,setTimeout,
    Event:class Event{},dispatchEvent(){},document:{currentScript:null,querySelector:()=>({}),querySelectorAll:()=>[]}});
  for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInContext(fs.readFileSync(file,'utf8'),runtime,{filename:file});
  vm.runInContext(app.slice(0,app.indexOf('globalThis.closedLoopAppReady=false;'))+`
    core=closedLoopCore;schema=closedLoopWorkflowSchema;engine=closedLoopWorkflowEngine;ingestion=closedLoopResponseIngestion;
    globalThis.ui={select:p=>{current=p;projects=[p];},instruction:()=>currentPromptRecord(current.activeStage)?.prompt||currentStagePrompt(current.activeStage),workflow:()=>{detailViews.clear();return workflow();}};
  })();`,runtime);
  const renderWorkflow=runtime.ui.workflow,presentationCases=[];
  runtime.ui.workflow=()=>{const html=renderWorkflow();presentationCases.push(assertWorkflowPresentation(observeWorkflowMarkup(html),{instruction:runtime.ui.instruction(),caseId:'file-first-view-'+presentationCases.length}));return html;};
  vm.runInContext(`globalThis.previewBuilds=0;const realPromptEngine=closedLoopPromptEngine;
    closedLoopPromptEngine={...realPromptEngine,buildPromptRecord(...args){previewBuilds++;return realPromptEngine.buildPromptRecord(...args);}};
    globalThis.previewProject=closedLoopCore.createBlankState('CONTEXT-FIRST-PREVIEW');
    previewProject.job.EXACT_USER_OBJECTIVE_VERBATIM='Preserve the complete source é🙂. '.repeat(4000)+'FIRST-PREVIEW-TAIL';
    closedLoopWorkflowEngine.recalculate(previewProject);ui.select(previewProject);`,runtime);
  const p=runtime.previewProject,before=JSON.stringify(p),first=runtime.ui.workflow();
  assert.match(first,/This instruction requires context\.json\. It is included in the one stage ZIP\./,'Required context must be disclosed as a member of the consolidated stage package.');
  for(const legacy of ['export-prompt-file','export-prompt-manifest','export-prompt-context','export-stage-files'])assert.doesNotMatch(first,new RegExp('id="'+legacy+'"'),'Superseded export control remains: '+legacy);
  const panelStart=first.indexOf('id="next-required-action"'),exportStart=first.indexOf('id="next-export-prompt-file"',panelStart),detailsStart=first.indexOf('<div class="notice ',panelStart);
  assert(exportStart>panelStart,'The initial external operation must expose the consolidated stage-files export in its next-action panel.');
  assert(exportStart<detailsStart,'The next transport control must precede the potentially taller-than-viewport action details.');
  assert.equal((first.match(/id="next-export-prompt-file"/g)||[]).length,1,'There must be exactly one next-action stage-files export control.');
  assert.match(first,/This instruction requires context\.json/);
  assert.equal(JSON.stringify(p),before,'Displaying required context must not reserve an operation or change project data.');
  assert.equal(runtime.previewBuilds,1,'Displaying required context built the accumulated prompt more than once.');
  assert.match(runtime.ui.workflow(),/This instruction requires context\.json\. It is included in the one stage ZIP\./);
  assert.equal(runtime.previewBuilds,1,'Revisiting the same preview rebuilt its context.');
  for(let stage=2;stage<=30;stage++){
    p.activeStage=stage;
    assert.doesNotMatch(runtime.ui.workflow(),/This instruction requires context\.json\. It is included in the one stage ZIP\./,`Stage ${stage} exposed stale packaged context for an unavailable operation.`);
    assert.doesNotMatch(runtime.ui.workflow(),/id="next-export-prompt-file"/,`Stage ${stage} exposed transport for an unavailable operation.`);
  }
  p.activeStage=1;p.revision++;p.job.EXACT_USER_OBJECTIVE_VERBATIM='Produce a short checklist.';
  assert.doesNotMatch(runtime.ui.workflow(),/This instruction requires context\.json\. It is included in the one stage ZIP\./,'A new revision with inline context retained stale packaged-context guidance.');
  p.revision++;p.job.EXACT_USER_OBJECTIVE_VERBATIM='Large current project context. '.repeat(4000);
  assert.match(runtime.ui.workflow(),/This instruction requires context\.json\. It is included in the one stage ZIP\./);
  const other=runtime.closedLoopCore.createBlankState('CONTEXT-OTHER-PROJECT');other.revision=p.revision;
  runtime.closedLoopWorkflowEngine.recalculate(other);runtime.ui.select(other);
  assert.doesNotMatch(runtime.ui.workflow(),/This instruction requires context\.json\. It is included in the one stage ZIP\./,'Switching projects leaked the preceding project\'s required packaged context.');
  const saved=runtime.closedLoopPromptEngine.reserveAndBuildPromptRecord(other,1,{operation:'COMPLETE'});
  assert.doesNotMatch(runtime.ui.workflow(),/Regenerated and saved for the remaining work/,'INSTRUCTION_STATE_ORACLE: The first saved instruction was mislabeled as regenerated.');
  runtime.closedLoopWorkflowEngine.transitionOperationReservation(saved.reservation,'SUPERSEDED');
  runtime.closedLoopPromptEngine.reserveAndBuildPromptRecord(other,1,{operation:'COMPLETE'});
  assert.match(runtime.ui.workflow(),/Regenerated and saved for the remaining work/, 'INSTRUCTION_STATE_ORACLE: The existing instruction text does not identify the saved replacement.');
  console.log(JSON.stringify({contextFirstPreview:true,previewDoesNotCommit:true,previewBuildsPerRender:1,unavailableStageChecks:29,staleRevisionAndProjectContextRejected:true,presentationCases}));
}

// Changing selection while raw bytes are being staged must never make the
// handler read/capture them through the newly selected project or stage.
for(const change of ['project','stage','revision']){
  let release,entered;const held=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve),reads=[],captures=[],failures=[];
  const source={job:{JOB_ID:'RESPONSE-OWNER'},revision:4,activeStage:1},other={job:{JOB_ID:'RESPONSE-OTHER'},revision:4,activeStage:2};
  const runtime=createVerifierRuntime({...inactiveMobileAcceptance,current:source,responseActionFailure:null,Blob,TextDecoder,reportResponseFailure:(message,error)=>failures.push(String(error?.message||message)),responseAttemptPrompt:()=>({transportBindingRequired:true,instructionId:'PROMPT-OWNER',bodySha256:'hash',contractSha256:'contract',contextSignature:'scope'}),projectStore:{stageResponseFile:async options=>{entered();await held;return {stagingId:'OWNER-STAGED',jobId:options.jobId};},readStagedResponseFile:async options=>{reads.push(options);return {bytes:new Uint8Array([123,125]),sha256:'digest'};}},closedLoopHash:{sha256Text:()=> 'digest'},responsePromptRecord:()=>({scope:{}}),pendingProposal:()=>null,ingestion:{captureRaw:()=>{captures.push(true);throw new Error('CAPTURE_REACHED');}}});
  vm.runInContext(app.slice(app.indexOf('async function prepareStageResponseFile('),app.indexOf('async function prepareStageResponseFallback('))+'\nglobalThis.selectResponse=prepareStageResponseFile;',runtime);
  const pending=runtime.selectResponse(new Blob(['{}'],{type:'application/json'}));await started;
  if(change==='project')runtime.current=other;else if(change==='stage')source.activeStage=2;else source.revision++;
  release();await pending;
  assert(captures.length===0,`Response intake captured raw bytes after a ${change} change.`);
  assert(reads.every(row=>row.jobId==='RESPONSE-OWNER'),'Response intake read staged bytes under another project.');
  assert(failures.length===1,'Interrupted response intake must report the preserved staged file.');
}

function verify({appSource=app,ingestionSource=ingestion,storeSource=store,engineSource=engine,promptSource=prompt}={}){
  assert.match(appSource,/id="response-json-file"[^>]*type="file"[^>]*accept="[^"]*(?:application\/json|\.json)/,'The normal external-response path must expose the authoritative JSON file selector.');
  assert.match(appSource,/const operationSelection=\{\},runSelection=\{\},responseFileSelection=\{\},fileSelectionDrafts=\{\};/,'The file-first UI must retain declared response-file selection state before wiring change and process handlers.');
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
  const runtime=createVerifierRuntime({...inactiveMobileAcceptance,safe:x=>Array.isArray(x)?x:[],operatorLaneMatches:(x,n)=>Number(x.stage)===n&&x.operation==='COMPLETE'});
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
 const runtime=createVerifierRuntime({...inactiveMobileAcceptance,safe:x=>Array.isArray(x)?x:[],esc:String,operatorLaneMatches:(x,n)=>Number(x.stage)===n&&x.operation==='COMPLETE',currentNextAction:()=>({}),pendingProposal:()=>null,acceptedLaneChanges:()=>[{changeId:'OLD-CHANGE'}],stageLocked:()=>null,canonicalCurrentStage:()=>1,reviewerOperation:()=>false});
 const source=(app.match(/^function (?:latestResponseAttempt|latestResponseValidation|interactionModeMarkup)\([^\n]+/gm)||[]).join('\n');
 vm.runInContext(source+'\nglobalThis.mode=interactionModeMarkup;',runtime);
 for(let stage=1;stage<=30;stage++){
  runtime.current={activeStage:stage,stages:{[stage]:{status:'IN PROGRESS'}},projectData:{generatedPrompts:[{instructionId:'CURRENT',stage,operation:'COMPLETE',scope:{}}],rawResponses:[{rawResponseId:'NEW',stage,status:'VALIDATION_FAILED',promptInstructionId:'CURRENT',validationId:'FAILED'}],responseValidations:[{validationId:'FAILED',stage,valid:false}]}};
  assert.match(runtime.mode(stage),/Return a corrected final JSON/,'An old acceptance hid the current rejection at stage '+stage);
  runtime.current.projectData.rawResponses[0].status='ACCEPTED_DATA_CHANGE';runtime.current.projectData.responseValidations[0].valid=true;
  assert.match(runtime.mode(stage),/Response accepted/,'The saved response lost its acceptance feedback at stage '+stage);
  assert.doesNotMatch(runtime.mode(stage),/OLD-CHANGE/,'An internal accepted-change identity leaked into primary feedback at stage '+stage);
  assert.match(runtime.mode(stage),/notice warn.*this stage has not passed/,'A saved response appeared to pass an incomplete stage '+stage);
  runtime.current.stages[stage].gate={complete:true};
  assert.match(runtime.mode(stage),/notice success.*this stage is complete/,'The satisfied completion gate was not reported at stage '+stage);
 }
}
// An action on an inspected stage belongs to that selected stage in the active version.
{
 const wireStart=app.indexOf("bindAction('#next-export-prompt-file'"),wireEnd=app.indexOf("document.querySelectorAll('[data-returned-slot]'",wireStart),source=app.slice(wireStart,wireEnd);
 assert(wireStart>=0&&wireEnd>wireStart,'The existing next-instruction action is missing.');
 for(const [stage,operation] of [[5,'SEMANTIC_REVIEW'],[6,'RECONCILE_VERIFICATION_SUITE'],[11,'EXECUTE_RUN'],[17,'VERIFY'],[21,'COMPLETE']]){
  const button={dataset:{operation}},current={activeStage:stage},operationSelection={[stage]:operation};let exported;
  const runtime=createVerifierRuntime({...inactiveMobileAcceptance,bindAction:(_selector,operation)=>{button.onclick=operation;},$:()=>button,current,operationSelection,selectedOperation:n=>operationSelection[n],canonicalCurrentStage:()=>stage===30?1:stage+1,exportStageFiles:()=>{exported={stage:current.activeStage,operation:operationSelection[current.activeStage]};}});
  vm.runInContext(source,runtime);await button.onclick();
  assert.deepEqual(exported,{stage,operation},'The action escaped the selected stage.');
  exported=null;button.dataset.operation='STALE-OPERATION';assert.throws(()=>button.onclick(),/selected operation changed/);assert.equal(exported,null,'A stale control exported another operation.');assert.equal(operationSelection[stage],operation);
 }
}
assert.throws(()=>verify({appSource:app.replace('id="response-json-file" type="file"','id="response-json-file" type="text"')}),/authoritative JSON file selector/);
assert.throws(()=>verify({appSource:app.replace('const operationSelection={},runSelection={},responseFileSelection={},fileSelectionDrafts={};','const operationSelection={},runSelection={};')}),/declared response-file selection state/);
assert.throws(()=>verify({storeSource:store.replaceAll('RESPONSE_STAGE_REHASH_MISMATCH','RESPONSE_STAGE_IGNORED_MISMATCH')}),/read-back mismatch/);
assert.throws(()=>verify({engineSource:engine.replaceAll('SELECT_RESPONSE_JSON_FILE','PASTE_FINAL_JSON')}),/Paste must not remain/);
assert.throws(()=>verify({appSource:app.replaceAll('AUTHORITATIVE_RESPONSE_FILE','TEXT_ONLY')}),/marked authoritative/);
assert.throws(()=>verify({appSource:app.replace('prepareStageResponseFile(blob,{nonauthoritativeFallback:true})','ingestion.captureRaw(current,{text})')}),/same staging path/);
assert.throws(()=>verify({appSource:app.replaceAll('reserveAndBuildPromptRecord','buildPromptRecord')}),/reservation-bound prompt transaction helper/);
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
  const runtime=createVerifierRuntime({...inactiveMobileAcceptance,operatorActionInFlight:null,responseActionFailure:null,closedLoopPromptEngine:{version:saved.promptEngineVersion},current,Blob,Uint8Array,TextDecoder,queueMicrotask,safe:value=>Array.isArray(value)?value:[],promptOptions:()=>({operation:'COMPLETE',scope:{}}),currentPromptEngineVersion:()=>saved.promptEngineVersion,pendingProposal:()=>proposal,announce:message=>reports.push(message),render:()=>renders++,detailViews:new Map(),wireDetails:()=>{},document:{createElement:()=>({content:{firstElementChild:{}}})},esc:String,details:()=>'', $:selector=>selector==='#validation-report'?{focus(){},querySelectorAll:()=>[],replaceWith:()=>inlineReplacements++}:{focus(){}},alert:message=>dialogs.push(String(message)),console:{error(){}},downloadRawRecovery:()=>downloaded++,closedLoopHash:{sha256Text:sha},projectStore:{removeStagedResponseFile:async options=>removedStages.push(options),stageResponseFile:async options=>{staged++;return {...options,stagingId:'STAGED',sha256:digest,byteSize:Buffer.byteLength(text)};},readStagedResponseFile:async()=>({bytes:new TextEncoder().encode(text),sha256:digest,stagingId:'STAGED',byteSize:Buffer.byteLength(text)})},ingestion:{strictParse:JSON.parse,captureRaw:()=>{captured++;throw new Error('A reselected pending response must not be captured again.');}},persistReplacement:async()=>{throw new Error('Reselection must not advance canonical revision.');}});
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
  // The real handler runs inside the shared action lifecycle. Supply its exact
  // pending context so the failure oracle also checks the recorded outcome.
  runtime.operatorActionInFlight={jobId:current.job.JOB_ID,projectSha256:current.projectSha256||null,failed:false,focusReason:'FORWARD'};
  runtime.projectStore.stageResponseFile=async()=>{throw new Error('storage test failure');};
  await runtime.selectResponse(new Blob([text],{type:'application/json'}));
  assert.equal(renders,beforeFailureRenders,'An inline response failure rerendered the form and discarded unsaved operator input.');
  assert.equal(inlineReplacements,1,'Response failure did not update the existing inline validation area.');
  assert.equal(runtime.responseActionFailure.stage,4);
  assert.equal(runtime.responseActionFailure.detail,'storage test failure');
  assert.equal(runtime.operatorActionInFlight.failed,true,'A handled staging failure must mark its owning action failed.');
  assert.equal(runtime.operatorActionInFlight.focusReason,'RETRY','The failed action must retain explicit retry focus.');
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
  const runtime=createVerifierRuntime({...inactiveMobileAcceptance,operatorActionInFlight:null,actionFocusTarget:null,setTimeout,queueMicrotask,structuredClone,TextEncoder,TextDecoder,URL,Blob,crypto:globalThis.crypto,Event:class Event{},dispatchEvent(){},console,actionFailureNotice:null,announce:message=>announcements.push(message),alert:message=>dialogs.push(String(message)),render:()=>rendered++,externalAgentOperation:()=>true,selectedOperation:()=> 'COMPLETE',promptOptions:()=>({operation:'COMPLETE'}),currentStage5AuthorContext:()=>null,currentReviewerContext:()=>null,reviewerOperation:()=>false,clone:structuredClone,TAB_INSTANCE_ID:'TAB-FILE-FIRST', $:selector=>selector==='#fresh-context-id'?null:notice});
  for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInContext(fs.readFileSync(file,'utf8'),runtime,{filename:file});
  runtime.ingestion=runtime.closedLoopResponseIngestion;runtime.stageContinuationErrors=new Map();
  vm.runInContext(app.slice(app.indexOf('async function restoreStageContinuation('),app.indexOf('async function materializeProject(')),runtime);
  runtime.current=runtime.closedLoopCore.createBlankState('JOB-FILE-FIRST-AUTOMATIC-CONTEXT');runtime.current.activeStage=5;runtime.current.revision=7;Object.assign(runtime.current.job,{CURRENT_SOURCE_SET_VERSION:'SYNTHETIC-SOURCES',CURRENT_RESEARCH_VERSION:'SYNTHETIC-RESEARCH',CURRENT_REQUIREMENTS_VERSION:'SYNTHETIC-REQUIREMENTS'});
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
  runtime.current=runtime.closedLoopCore.createBlankState('JOB-REVIEWER-NEXT-ACTION');runtime.current.activeStage=9;Object.assign(runtime.current.job,{CURRENT_SOURCE_SET_VERSION:'SYNTHETIC-SOURCES',CURRENT_RESEARCH_VERSION:'SYNTHETIC-RESEARCH',CURRENT_REQUIREMENTS_VERSION:'SYNTHETIC-REQUIREMENTS',CURRENT_TEST_SUITE_VERSION:'SYNTHETIC-TESTS',CURRENT_INSTRUCTION_VERSION:'SYNTHETIC-INSTRUCTIONS'});runtime.current.job.CURRENT_STAGE='STAGE 09';runtime.closedLoopWorkflowEngine.ensureShape(runtime.current);runtime.current.stages[8].status='COMPLETE';runtime.current.stages[8].gate={complete:true};
  const nextAction=runtime.closedLoopWorkflowEngine.operationalNextAction(runtime.current,9);
  assert.equal(nextAction.primaryButton,'Export instruction file','The reviewer action must export instructions directly, not require a saved verification package first.');
  const button={dataset:{operation:nextAction.operation}};runtime.$=selector=>selector==='#next-export-prompt-file'?button:notice;runtime.operationSelection={};runtime.exportStageFiles=()=>runtime.exportAttempt(()=>downloaded++);
  const wireStart=app.indexOf("bindAction('#next-export-prompt-file'"),wireEnd=app.indexOf("document.querySelectorAll('[data-returned-slot]'",wireStart);
  runtime.bindAction=(_selector,operation)=>{button.onclick=operation;};
  vm.runInContext(app.match(/^function canonicalCurrentStage\([^\n]+/m)[0]+'\n'+app.slice(wireStart,wireEnd),runtime);await button.onclick();
  assert.equal(downloaded,3,'The actual next-action handler failed to reach automatic instruction export.');
  assert.equal(runtime.current.projectData.generatedPrompts.at(-1).operation,'COMPLETE');assert.equal(runtime.operationSelection[9],undefined,'Export must preserve an implicit selection without inventing an explicit override');assert.equal(runtime.current.projectData.freshContexts.length,1);
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
  const runtime=createVerifierRuntime({...inactiveMobileAcceptance,setTimeout,queueMicrotask,structuredClone,TextEncoder,TextDecoder,Blob,crypto:globalThis.crypto,Event:class Event{},dispatchEvent(){},console,safe:v=>Array.isArray(v)?v:[],clone:structuredClone,TAB_INSTANCE_ID:'TAB-REVISION-RECOVERY',responseActionFailure:null,announce(){},render(){},$:()=>({focus(){}}),reportResponseFailure:(message,error)=>failures.push(String(error?.message||message)),reportActionFailure:error=>failures.push(String(error.message||error)),externalAgentOperation:()=>true,selectedOperation:()=> 'COMPLETE',promptOptions:()=>({operation:'COMPLETE'}),operatorLaneMatches:()=>true,reverifyReturnedFiles:async()=>{}});
  for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInContext(fs.readFileSync(file,'utf8'),runtime,{filename:file});
  runtime.clone=vm.runInContext('(value)=>JSON.parse(JSON.stringify(value))',runtime);
  const engine=runtime.closedLoopWorkflowEngine,ingestion=runtime.closedLoopResponseIngestion,prompts=runtime.closedLoopPromptEngine;
  let p=runtime.closedLoopCore.createBlankState('JOB-RETURNED-REVISION-RECOVERY');p.activeStage=6;p.activeView='Workflow';p.revision=82;Object.assign(p.job,{CURRENT_SOURCE_SET_VERSION:'SYNTHETIC-SOURCES',CURRENT_RESEARCH_VERSION:'SYNTHETIC-RESEARCH',CURRENT_REQUIREMENTS_VERSION:'SYNTHETIC-REQUIREMENTS'});engine.ensureShape(p);p.stages[5].status='COMPLETE';p.stages[5].gate={complete:true};
  const saved=prompts.reserveAndBuildPromptRecord(p,6,{operation:'COMPLETE'}).prompt;
  p=ingestion.captureRaw(p,{stage:6,text:'{"broken":true}',promptRecord:saved,files:[{attachmentSlotId:'DESIGN',artifactId:'DESIGN-BYTES',name:'design.md',sha256:'retained-digest'}]}).project;
  runtime.withStorageActivity=async(_label,operation)=>operation();runtime.current=p;runtime.projects=[p];runtime.ingestion=ingestion;runtime.engine=engine;runtime.schema=runtime.closedLoopWorkflowSchema;runtime.operatorScopeKeys=['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId'];runtime.currentPromptEngineVersion=()=>prompts.version;
  runtime.stageContinuationErrors=new Map();runtime.operationSelection={};
  let stored=structuredClone(p);stored.revision=p.revision+1;stored.projectData.userEntered.concurrentMarker='PRESERVE NEWER WORK';let staleWrites=0;
  // IndexedDB materializes plain objects in the application's realm. A host
  // structuredClone here would incorrectly give the VM foreign prototypes.
  runtime.projectStore={readProject:async()=>runtime.clone(stored),replaceProject:async(next,{expectedProjectRevision,operational=false})=>{if(expectedProjectRevision!==stored.revision){staleWrites++;throw Object.assign(new Error(`Project revision conflict: expected ${expectedProjectRevision}, found ${stored.revision}.`),{code:'STALE_PROJECT_REVISION'});}stored=structuredClone(next);stored.revision=expectedProjectRevision+(operational?0:1);return runtime.clone(stored);}};
  runtime.currentPromptRecord=n=>runtime.current.projectData.generatedPrompts.filter(x=>Number(x.stage)===n&&!x.invalidatedBy&&Number(x.scope.projectRevision)===runtime.current.revision).at(-1)||null;
  function fn(name){const start=app.search(new RegExp('(?:async )?function '+name+'\\(')),end=app.indexOf('\nfunction ',start+1),asyncEnd=app.indexOf('\nasync function ',start+1);return app.slice(start,Math.min(...[end,asyncEnd].filter(x=>x>=0)));}
  vm.runInContext(['currentOperatorScope','operatorLaneMatches','promptMatches','promptVersionCurrent','currentPromptRecord','unloadInactiveProjects','persistReplacement','latestResponseAttempt','pendingReturnedResponse','validateReturnedResponse','saveRequiredContinuation','restoreStageContinuation','savePromptRecord'].map(fn).join('\n')+'\n'+app.slice(app.indexOf('let promptExportInFlight='),app.indexOf('async function exportPromptContext('))+'\nglobalThis.validate=validateReturnedResponse;globalThis.exportAttempt=promptExport;',runtime);
  assert.equal(vm.runInContext('currentPromptRecord(6)?.instructionId',runtime),saved.instructionId,'Raw capture incorrectly stales the still-open instruction and blocks manifest re-export.');
  const priorRequirements=runtime.current.job.CURRENT_REQUIREMENTS_VERSION;runtime.current.job.CURRENT_REQUIREMENTS_VERSION='CHANGED-AUTHORITY';
  assert.equal(vm.runInContext('currentPromptRecord(6)',runtime),null,'A changed authority scope must not reuse an older instruction.');runtime.current.job.CURRENT_REQUIREMENTS_VERSION=priorRequirements;
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
  stored.stages[5].status='COMPLETE';stored.stages[5].gate={complete:true};runtime.current.stages[5].status='COMPLETE';runtime.current.stages[5].gate={complete:true};
  const priorProofPrompt=downloads.at(-1).promptIdentity.instructionId;
  delete stored.projectData.generatedPrompts.at(-1).contextManifest.proofExpressionContractVersion;
  delete runtime.current.projectData.generatedPrompts.at(-1).contextManifest.proofExpressionContractVersion;
  await runtime.exportAttempt(record=>downloads.push(prompts.promptFileManifest(record)));
  assert.equal(failures.length,0,'Historical proof-contract instruction upgrade failed.');
  assert.notEqual(downloads.at(-1).promptIdentity.instructionId,priorProofPrompt,'An old Stage 06 instruction still omits the closed proof contract.');
  assert.equal(stored.projectData.generatedPrompts.at(-1).contextManifest.proofExpressionContractVersion,'closed-loop-proof-expression/1');
  console.log(JSON.stringify({returnedFileRevisionRecovery:true,retainedBytesPreserved:true,newerWorkPreserved:true,correctionManifestExported:true}));
}

// Replay actual UI preparation/export and production backup restoration.
{
const r=projectStoreRuntime(),t=r.runtime,s=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
const extract=(a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)+a.length));
t.fixtureRuntime={core:r.core,schema:t.closedLoopWorkflowSchema,engine:r.engine,prompts:r.prompts,ingestion:r.ingestion,store:r.store};
await vm.runInContext([evidence,stage04AcceptanceFixture,accumulatedStage04Fixture].map(f=>f.toString()).join('\n')+'\n(async()=>{globalThis.fixture=await accumulatedStage04Fixture(fixtureRuntime,{jobId:"PROBE-5922",attempts:2,responseCharacters:128});})()',t);
const initial=await r.store.writeProject(t.fixture,{expectedProjectRevision:0,createOnly:true,incrementRevision:false});
bindAcceptanceUi(r,initial,null);
Object.assign(t,{schema:t.closedLoopWorkflowSchema,recordValue:r.engine.recordValue,stageContinuationErrors:new Map(),stagePlanItems:(stage,operation)=>r.engine.stageTestExecutionPlan(t.current,{stage,operation}).items,displayedStageAction:stage=>r.engine.operationalNextAction(t.current,stage),announce(){},reportActionFailure(e){throw e;},downloadBlob(blob,filename){t.downloads.push({blob,filename});},downloads:[],$:()=>null});
vm.runInContext(extract('function canonicalCurrentStage(','function displayedStageAction(')+extract('function stageOperations(','// A saved response may be inspected independently.')+extract('async function savePromptRecord(','function promptTransportFilename(')+extract('let promptExportInFlight=','async function exportPromptContext(')+extract('function selectStageContinuation(','async function materializeProject('),t);
const snapshots={initial};
t.current=await t.restoreStageContinuation(initial,{throwOnFailure:true});snapshots.startup=r.copy(t.current);
await t.exportStageFiles();snapshots.exported=r.copy(t.current);
const backup=await r.store.exportPackage(initial.job.JOB_ID);snapshots.backup=await r.store.readProject(initial.job.JOB_ID);
snapshots.restored=await r.store.importPackage(backup);

 const hash=t.closedLoopHash,proof=stageHandoffRecoveryProof(initial,snapshots.backup,snapshots.restored,hash);
 for(const [key,value]of Object.entries(proof))if(typeof value==='boolean')assert.equal(value,true,'HANDOFF_PRESERVATION_ORACLE: '+key);
 assert.equal(snapshots.startup.projectData.generatedPrompts.length,initial.projectData.generatedPrompts.length+1,'HANDOFF_CURRENT_INSTRUCTION_ORACLE: stale scope must get a new current instruction');
 const current=t.currentPromptRecord(4),reservation=t.current.projectData.operationReservations.find(row=>r.engine.recordId(row,'operationReservations')===current.operationReservationId);
 assert.equal(r.engine.recordValue(reservation,'STATUS'),'EXPORTED','HANDOFF_RECEIPT_ORACLE: export must record its successful transfer');
 const browser=fs.readFileSync(process.env.BROWSER_EXTRA_SOURCE||'verify-browser-extra.mjs','utf8'),oracle=browser.match(/  assert\(accumulatedRoundTrip[\s\S]*?;\n/)?.[0];
 assert(oracle,'HANDOFF_BROWSER_ORACLE: the real browser assertion must exist');
 const accumulatedRoundTrip={...proof,instructionVerified:true,canonicalUnchanged:snapshots.backup.projectSha256===initial.projectSha256,tailPreserved:true,restoredDigest:true,singleStagePackage:true};
 try{vm.runInNewContext(oracle,{accumulatedRoundTrip,assert,JSON});}catch(error){throw new Error('HANDOFF_BROWSER_VALID_TRANSITION_ORACLE: a valid current-instruction/export/restore sequence must pass the actual browser oracle: '+error.message);}

 for(const [fault,violate]of [
  ['accepted-response-bytes',p=>{p.projectData.rawResponses[0].completeRawResponse+=' CORRUPTION';}],
  ['retained-instruction-bytes',p=>{p.projectData.generatedPrompts[0].prompt+=' CORRUPTION';}],
  ['retained-history',p=>{p.projectData.history[0].eventType='CORRUPTION';}],
  ['restored-response-bytes',p=>{p.projectData.rawResponses[0].completeRawResponse+=' CORRUPTION';}]
 ]){
  const exported=r.copy(snapshots.backup),restored=r.copy(snapshots.restored);
  if(fault.startsWith('restored'))violate(restored);else {violate(exported);violate(restored);}
  const bad={...accumulatedRoundTrip,...stageHandoffRecoveryProof(initial,exported,restored,hash)};
  assert.throws(()=>vm.runInNewContext(oracle,{accumulatedRoundTrip:bad,assert,JSON}),/changed exact retained data/,'HANDOFF_BROWSER_CORRUPTION_ORACLE: '+fault);
 }
 console.log(JSON.stringify({caseId:'HANDOFF_BROWSER_VALID_TRANSITION',result:'PASS',actualBrowser:false,attempts:2,responseCharacters:128,beforePrompts:initial.projectData.generatedPrompts.length,afterPrompts:snapshots.backup.projectData.generatedPrompts.length,proof}));
 t.current=await r.store.readProject(initial.job.JOB_ID);await t.savePromptRecord(4);
 const cdp=null,evalValue=async(_cdp,expression)=>vm.runInContext(expression,t),fixtureFunctions=[scalarFor,recordProposal,evidence,stage04AcceptanceFixture,stage04AcceptanceEnvelope].map(fn=>fn.toString()).join('\n'),runtimeBindings='const runtime=fixtureRuntime;';
  console.log('nonbrowser:large-history-execution-package');
  const executionContext=await evalValue(cdp,`(async()=>{${fixtureFunctions}\n${runtimeBindings}
    const store=closedLoopProjectStore,p=await store.readProject('PROBE-5922'),prompt=p.projectData.generatedPrompts.filter(row=>row.stage===4&&!row.invalidatedBy).at(-1),manifest=runtime.prompts.promptFileManifest(prompt),text=JSON.stringify(stage04AcceptanceEnvelope(runtime,p,prompt));
    const staged=await store.stageResponseFile({jobId:p.job.JOB_ID,stage:4,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce});
    const prepared=runtime.ingestion.prepare(p,{stage:4,text,promptRecord:prompt,transport:staged});if(!prepared.validation.valid)throw new Error('Execution context fixture response failed: '+JSON.stringify(prepared.validation.issues));
    const rejected=runtime.ingestion.reject(prepared.project,prepared.proposal.proposalId,{requestCorrection:true,reason:'é🙂'.repeat(70000)+'EXECUTION-CONTEXT-TAIL'}),replacement=rejected.project.projectData.generatedPrompts.find(row=>row.instructionId===rejected.replacementPromptId);
    await store.persistPromptContextFiles(replacement,rejected.project);const mutationConfirmation=store.mutationImpact(p,rejected.project);if(mutationConfirmation.requiresConfirmation){let blocked=false;try{await store.writeProject(rejected.project,{expectedProjectRevision:p.revision,incrementRevision:true});}catch(error){blocked=error.code==='MUTATION_CONFIRMATION_REQUIRED';}if(!blocked||(await store.readProject(p.job.JOB_ID)).projectSha256!==p.projectSha256)throw new Error('HANDOFF_CORRECTION_CONFIRMATION_ORACLE: correction must preserve current work until exact impact confirmation.');}const saved=await store.writeProject(rejected.project,{expectedProjectRevision:p.revision,incrementRevision:true,mutationConfirmation}),file=await store.readPromptContextFile(replacement,p.job.JOB_ID);
    return {contextBytes:file.byteSize,tailPreserved:(await file.blob.text()).includes('EXECUTION-CONTEXT-TAIL'),revision:saved.revision};
  })()`);
  assert(executionContext.contextBytes>262144&&executionContext.tailPreserved,'The accumulated execution fixture did not persist the exact large correction context: '+JSON.stringify(executionContext));
  const largeExecution=await evalValue(cdp,`(async()=>{const store=closedLoopProjectStore,hash=closedLoopHash,before=await store.readProject('PROBE-5922'),nativeRead=Blob.prototype.arrayBuffer;let sourceReadBytes=0,largestRead=0,result;Blob.prototype.arrayBuffer=function(){sourceReadBytes+=this.size;largestRead=Math.max(largestRead,this.size);return nativeRead.call(this);};try{result=await store.createExecutionPackage({jobId:before.job.JOB_ID,stage:4,operation:'COMPLETE'});}finally{Blob.prototype.arrayBuffer=nativeRead;}const archiveBytes=new Uint8Array(await result.blob.arrayBuffer()),members=(${readStoreArchive.toString()})(archiveBytes),files=new Map(members.map(member=>[member.canonicalPath,member.bytes])),manifest=JSON.parse(new TextDecoder().decode(files.get('manifest.json'))),{packageManifestSha256,...body}=manifest,sourceBytes=manifest.members.reduce((sum,file)=>sum+file.byteSize,0),after=await store.readProject(before.job.JOB_ID),contexts=manifest.members.filter(file=>file.role==='PROMPT_CONTEXT');return {packageVerified:hash.sha256Value(body)===packageManifestSha256&&await hash.sha256Bytes(archiveBytes)===result.packageSha256,instructionVerified:await hash.sha256Bytes(files.get('instruction.txt'))===manifest.instructionFullTextSha256,contextVerified:(await Promise.all(contexts.map(async file=>files.get(file.canonicalPath)?.byteLength===file.byteSize&&await hash.sha256Bytes(files.get(file.canonicalPath))===file.sha256))).every(Boolean),contextFiles:contexts.length,sourceBytes,sourceReadBytes,largestRead,canonicalUnchanged:after.projectSha256===before.projectSha256};})()`);
  assert(largeExecution.packageVerified&&largeExecution.instructionVerified&&largeExecution.contextVerified&&largeExecution.contextFiles>0&&largeExecution.largestRead<=65536&&largeExecution.sourceReadBytes<=largeExecution.sourceBytes*4&&largeExecution.canonicalUnchanged,'Accumulated execution package changed exact bytes, canonical state, or reread its file sources: '+JSON.stringify(largeExecution));
  console.log(JSON.stringify({largeExecutionPackage:{...largeExecution,fixture:executionContext}}));


}
