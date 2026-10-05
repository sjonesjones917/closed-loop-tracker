import {authorizeSyntheticHandoff} from './test-handoff-authorization.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {projectStoreRuntime,bindAcceptanceUi,bindProjectActivationUi} from './test-project-store-runtime.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import {readStoreArchive} from './test-zip.mjs';

const app=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const observations=[];
const extract=(a,b)=>{const i=app.indexOf(a),j=app.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,'PROJECT_ACTIVATION_FIXTURE_DEPENDENCY: '+a);return app.slice(i,j);};
async function ui(){
 const r=projectStoreRuntime({sourceOverrides:{'app-core.js':app}}),t=r.runtime,source=await r.store.createProject({commandId:'ACTIVATION-SOURCE'});
 bindAcceptanceUi(r,source,null);
 let nodes;const scroll=[];const entries=[];const downloads=[];
 const reset=()=>{nodes=new Map([
  ['#draft',{id:'draft',type:'textarea',value:''}],['#check',{id:'check',type:'checkbox',value:'yes',checked:false}],
  ['#multiple',{id:'multiple',type:'select-multiple',multiple:true,options:[{value:'a',selected:false},{value:'b',selected:false}],get selectedOptions(){return this.options.filter(option=>option.selected);}}],
  ['#delete-project-confirmation',{value:t.current.job.JOB_ID,focus(){}}],['#delete-project',{disabled:false}],['#response-file-status',{textContent:''}]
 ]);};
 reset();Object.assign(t,{schema:t.closedLoopWorkflowSchema,recordValue:r.engine.recordValue,projectUi:{},views:['Overview','Project','Workflow','Records','Files','Release'],
  document:{querySelectorAll:()=>[...nodes.values()].filter(node=>node.id),querySelector:selector=>nodes.get(selector)||null},$:selector=>nodes.get(selector)||null,CSS:{escape:String},
  window:{scrollX:0,scrollY:0,scrollTo(x,y){this.scrollX=x;this.scrollY=y;scroll.push({x,y});}},requestAnimationFrame:fn=>fn(),render:reset,
  captureCurrentView:async()=>r.store.saveCheckpoint(t.current.job.JOB_ID,{expectedProjectRevision:t.current.revision,view:r.copy(t.captureView())}),
  refreshHistory:async()=>{t.historyState=await r.store.historyList(t.current.job.JOB_ID);},historyState:{activeId:null},writeBrowserEntry(checkpointId,view){entries.push({jobId:t.current.job.JOB_ID,checkpointId,view:r.copy(view)});},
  refreshProjectStorage:async()=>{},announce(){},reportActionFailure(error){throw error;},header(){},historyRestoreController:null,restoringHistory:false,recordMobileBackupRestore:async()=>{},requestBackupPassword:()=>false,
  setControlDisabled:(control,disabled)=>{if(control)control.disabled=disabled;},location:{reload(){throw Error('PROJECT_ACTIVATION_UNEXPECTED_RELOAD');}},
  RUNTIME_BUILD_ID:'CONTROLLED-ACTIVATION-BUILD',parseMobileAcceptanceTargetControl:()=>({testProjectId:'PINNED-ACTIVATION-TEST'}),verifyMobileBuild:async()=>({buildIdentity:'CONTROLLED-ACTIVATION-BUILD'}),recordMobileOperation:async()=>{},
  stagePlanItems:(stage,operation)=>r.engine.stageTestExecutionPlan(t.current,{stage,operation}).items,displayedStageAction:stage=>r.engine.operationalNextAction(t.current,stage),presentationAction:stage=>r.engine.operationalNextAction(t.current,stage),currentNextAction:()=>r.engine.operationalNextAction(t.current,1),
  downloadBlob:(blob,filename)=>downloads.push({blob,filename}),responseSelectionLabel:()=> 'Saved response selection'
 });
 bindProjectActivationUi(r,{source:app});
 vm.runInContext(extract('const projectUiEntry=','async function refreshProjectStorage(')+extract('function stageOperations(','// A saved response may be inspected independently.')+
  extract('async function savePromptRecord(','function promptTransportFilename(')+extract('let promptExportInFlight=','async function exportPromptContext(')+
  extract('async function duplicateCurrentProject(','function selectStageContinuation(')+extract('async function selectProject(','async function importProjectPackageFile(')+
  extract('async function importProjectPackageFile(','let pendingBackupAction=')+extract('async function loadAcceptanceSession(','async function saveAcceptanceSession(')+extract('async function recordCommittedBoundary(','async function navigateWithinVersion(')+
  extract('function syncDeleteProjectControl(','function setProjectActionsOpen(')+extract('async function startMobileAcceptanceProject(','function mobileProbeMembers(')+
  extract('async function persistNewProject(','async function persistReplacement(')+extract('function blankStage(','function importSeed(')+
  extract('async function addNew(','async function readApplicationResource('),t);
 t.operationSelection[1]='RECONCILE_INTAKE';t.runSelection[11]='FOREIGN-RUN';nodes.get('#draft').value='Source-only unsaved draft';
 return {...r,source,t,nodes:()=>nodes,scroll,entries,downloads};
}
function assertDestination(x,expected){
 const {t}=x;assert.equal(t.current.job.JOB_ID,expected.jobId,'PROJECT_ACTIVATION_DESTINATION_ORACLE');
 assert.equal(t.selectedOperation(1),'COMPLETE','PROJECT_ACTIVATION_OPERATION_ORACLE');assert.equal(t.operationSelection[1],expected.savedSelection?'COMPLETE':undefined,'PROJECT_ACTIVATION_SAVED_SELECTION_ORACLE');
 assert.equal(t.runSelection[11],expected.runId,'PROJECT_ACTIVATION_RUN_ORACLE');
 assert.equal(x.nodes().get('#draft').value,expected.draft,'PROJECT_ACTIVATION_DRAFT_ORACLE');
 assert.equal(x.nodes().get('#check').checked,expected.checked,'PROJECT_ACTIVATION_CHECKBOX_ORACLE');
 assert.deepEqual(x.nodes().get('#multiple').selectedOptions.map(option=>option.value),expected.multiple,'PROJECT_ACTIVATION_MULTIPLE_ORACLE');
 assert.equal(t.window.scrollX,expected.scrollX,'PROJECT_ACTIVATION_SCROLL_X_ORACLE');assert.equal(t.window.scrollY,expected.scrollY,'PROJECT_ACTIVATION_SCROLL_Y_ORACLE');
 const entry=x.entries.at(-1);assert.ok(entry,'PROJECT_ACTIVATION_BROWSER_ENTRY_ORACLE');assert.equal(entry.jobId,expected.jobId);assert.equal(entry.view.operationSelection?.[1],expected.savedSelection?'COMPLETE':undefined);assert.equal(entry.view.drafts?.['#draft']?.value||'',expected.draft);
 if(expected.pendingTitle){assert.ok(t.replacementReview?.next,'PROJECT_ACTIVATION_PENDING_REVIEW_ORACLE');assert.equal(t.replacementReview.next.job.JOB_TITLE,expected.pendingTitle);}
}
async function destination(x){
 const {store,engine,t}=x;let p=await store.createProject({commandId:'ACTIVATION-DESTINATION'});
 const bytes=new TextEncoder().encode('candidate'),aid=artifactFixtureId(engine,p,'activation-candidate');await store.putArtifact({artifactId:aid,jobId:p.job.JOB_ID,blob:new Blob([bytes]),filename:'candidate.txt',mediaType:'text/plain'});
 engine.registerArtifactBytes(p,{stage:10,artifactId:aid,filename:'candidate.txt',mediaType:'text/plain',byteSize:9,sha256:digest(bytes)});
 const decision=engine.recordRegisteredHumanDecision(p,{stage:10,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:t.closedLoopHash.sha256Value([aid]),value:[aid],operatorLabel:'CONTROLLED_ACTIVATION_FIXTURE'});
 const frozen=engine.freezeCandidate(p,{stage:10,artifactIds:[aid],selectionDecisionId:engine.recordId(decision,'humanDecisions')}),slots=engine.reserveRunBatch(p,{stage:11,iterationId:engine.recordId(frozen.iteration,'iterations'),count:10});
 p=await store.writeProject(p,{expectedProjectRevision:p.revision});const runId=slots[0].runId;assert.ok(engine.records(p,'runs').some(run=>engine.recordId(run,'runs')===runId),'PROJECT_ACTIVATION_OWNED_RUN_FIXTURE_ORACLE');
 const next=x.copy(p);next.job.JOB_TITLE='Destination pending title';engine.recordHumanInputVersion(next,['JOB_TITLE'],'CONTROLLED_ACTIVATION_FIXTURE');
 const view=x.copy({activeStage:1,activeView:'Workflow',operationSelection:{1:'COMPLETE',11:'EXECUTE_RUN'},runSelection:{11:runId},fileSelections:{},scrollX:'17',scrollY:'243',drafts:{'#draft':{value:'Destination-own draft'},'#check':{value:'yes',checked:true},'#multiple':{value:['b']}},pendingMutation:{baseProjectSha256:p.projectSha256,next,impact:store.mutationImpact(p,next),expectedProjectRevision:p.revision}});
 await store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,view});
 x.t.projects=[x.source,p];return {project:p,view,expected:{jobId:p.job.JOB_ID,savedSelection:true,runId,draft:'Destination-own draft',checked:true,multiple:['b'],scrollX:17,scrollY:243,pendingTitle:'Destination pending title'}};
}
// Direct proof at the real reservation/commit/package boundary; expected operation is literal contract data.
{
 const x=await ui(),before=x.source.projectSha256;await x.t.addNew();const initial=await x.t.savePromptRecord(1);assert.equal(x.t.current.projectData.generatedPrompts.length,1,'PROJECT_ACTIVATION_INITIAL_PROMPT_COUNT_ORACLE');const authorized=await authorizeSyntheticHandoff(x,{project:x.t.current,prompt:initial});x.t.current=authorized.project;x.t.projects=[x.source,authorized.project];const authorizedPromptCount=x.t.current.projectData.generatedPrompts.length;await x.t.exportStageFiles();
 assert.equal(x.downloads.length,1,'PROJECT_ACTIVATION_EXPORT_COUNT_ORACLE');
 const p=x.t.current,pr=p.projectData.generatedPrompts.at(-1),reservation=p.projectData.operationReservations.find(row=>x.engine.recordId(row,'operationReservations')===pr.operationReservationId);
 assert.equal(pr.operation,'COMPLETE','PROJECT_ACTIVATION_OPERATION_ORACLE: a clean destination must export Stage01 COMPLETE, not source reconciliation.');
 assert.equal(x.engine.recordValue(reservation,'OPERATION'),'COMPLETE','PROJECT_ACTIVATION_RESERVATION_ORACLE');assert.equal(pr.transportBindingRequired,true);
 const durable=await x.store.readProject(p.job.JOB_ID),storedPrompt=durable.projectData.generatedPrompts.at(-1),storedReservation=durable.projectData.operationReservations.find(row=>x.engine.recordId(row,'operationReservations')===storedPrompt.operationReservationId);
 assert.equal(durable.projectSha256,p.projectSha256,'PROJECT_ACTIVATION_PERSISTED_PROJECT_ORACLE');assert.equal(durable.projectData.generatedPrompts.length,authorizedPromptCount,'PROJECT_ACTIVATION_PERSISTED_PROMPT_COUNT_ORACLE: exporting an already authorized handoff must not create another instruction.');assert.equal(x.t.currentPromptRecord(1).instructionId,pr.instructionId,'PROJECT_ACTIVATION_CURRENT_AUTHORIZED_PROMPT_ORACLE');
 assert.equal(storedPrompt.operation,'COMPLETE','PROJECT_ACTIVATION_PERSISTED_OPERATION_ORACLE');assert.equal(storedPrompt.prompt,pr.prompt,'PROJECT_ACTIVATION_PERSISTED_BODY_ORACLE');assert.equal(storedPrompt.bodySha256,pr.bodySha256);assert.equal(x.engine.recordValue(storedReservation,'OPERATION'),'COMPLETE','PROJECT_ACTIVATION_PERSISTED_RESERVATION_ORACLE');
 const zip=new Uint8Array(await x.downloads[0].blob.arrayBuffer()),members=readStoreArchive(zip),instruction=members.find(member=>member.canonicalPath==='instruction.txt');assert.ok(instruction,'PROJECT_ACTIVATION_ARCHIVE_MEMBER_ORACLE');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(instruction.bytes);assert.ok(text.includes('Stage 01 COMPLETE'),'PROJECT_ACTIVATION_INSTRUCTION_SEMANTICS_ORACLE');assert.ok(text.includes(p.job.JOB_ID));assert.equal(text,pr.prompt);assert.equal(digest(instruction.bytes),pr.bodySha256,'PROJECT_ACTIVATION_INSTRUCTION_BYTES_ORACLE');
 assert.equal((await x.store.readProject(x.source.job.JOB_ID)).projectSha256,before,'PROJECT_ACTIVATION_SOURCE_UNCHANGED_ORACLE');assert.equal(p.projectData.rawResponses.length,0);assert.equal(x.t.runSelection[11],undefined);
 observations.push({id:'PROJECT_ACTIVATION_EXPORTED_INSTRUCTION',result:'PASS',caller:'addNew',newJobId:p.job.JOB_ID,activeView:p.activeView,activeStage:p.activeStage,operation:pr.operation,reservationOperation:x.engine.recordValue(reservation,'OPERATION'),durableProjectSha256:durable.projectSha256,persistedPromptOperation:storedPrompt.operation,persistedPromptBodySha256:storedPrompt.bodySha256,generatedPromptCount:durable.projectData.generatedPrompts.length,rawResponseCount:0,instructionSha256:digest(instruction.bytes),bodySha256:pr.bodySha256,archiveSha256:digest(zip),archiveBytes:zip.length,instructionBytes:instruction.bytes.length,sourceUnchanged:true});
}
const callerResults=[];
for(const caller of ['addNew','duplicateCurrentProject','archiveCurrentProject','restoreArchivedProject','deleteCurrentProject','selectProject','startMobileAcceptanceProject']){
 const x=await ui();let expected,argument;
 if(['archiveCurrentProject','restoreArchivedProject','deleteCurrentProject','selectProject'].includes(caller)){
  const dest=await destination(x);expected=dest.expected;argument=caller==='restoreArchivedProject'?dest.project.job.JOB_ID:caller==='selectProject'?dest.project:undefined;
  if(caller==='restoreArchivedProject')x.t.projectUi[dest.project.job.JOB_ID]={archivedAt:'2026-10-02T00:00:00.000Z'};
 }else expected={runId:undefined,draft:'',checked:false,multiple:[],scrollX:0,scrollY:0};
 await x.t[caller](argument);if(!expected.jobId)expected.jobId=x.t.current.job.JOB_ID;assertDestination(x,expected);
 if(caller==='startMobileAcceptanceProject'){assert.equal(x.t.acceptanceSession.jobId,expected.jobId);assert.equal(x.t.acceptanceSession.buildIdentity,'CONTROLLED-ACTIVATION-BUILD');}
 const durable=await x.store.readProject(expected.jobId);assert.equal(durable.job.JOB_ID,expected.jobId);
 callerResults.push({caller,result:'PASS',destinationJobId:expected.jobId,selectedOperation:x.t.selectedOperation(1),savedOperation:x.t.operationSelection[1]||null,selectedRun:x.t.runSelection[11]||null,draft:x.nodes().get('#draft').value,scroll:{x:x.t.window.scrollX,y:x.t.window.scrollY},pendingReviewRestored:Boolean(x.t.replacementReview?.next),durableProjectSha256:durable.projectSha256});
}
observations.push({id:'PROJECT_ACTIVATION_CALLERS',result:'PASS',callers:callerResults,actorBasis:'Actual production caller/activation/store/view functions with synthetic DOM/history; pinned mobile target/build is controlled, no physical-device claim.'});
{
 const x=await ui(),dest=await destination(x),backup=await x.store.exportPackage(dest.project.job.JOB_ID),sourceSha256=x.source.projectSha256;
 await x.t.importProjectPackageFile(backup,{recordSelection:false});assertDestination(x,dest.expected);
 assert.equal(x.t.replacementReview.next.job.JOB_TITLE,'Destination pending title','PROJECT_ACTIVATION_IMPORT_PENDING_REVIEW_ORACLE');
 const imported=await x.store.readProject(dest.project.job.JOB_ID),savedView=await x.store.readHistoryView(dest.project.job.JOB_ID);
 assert.equal(savedView.drafts['#draft'].value,'Destination-own draft','PROJECT_ACTIVATION_IMPORT_DURABLE_DRAFT_ORACLE');
 assert.equal(savedView.pendingMutation.next.job.JOB_TITLE,'Destination pending title','PROJECT_ACTIVATION_IMPORT_DURABLE_PENDING_REVIEW_ORACLE');
 assert.equal((await x.store.readProject(x.source.job.JOB_ID)).projectSha256,sourceSha256,'PROJECT_ACTIVATION_IMPORT_SOURCE_UNCHANGED_ORACLE');
 observations.push({id:'PROJECT_ACTIVATION_IMPORTED_VIEW',result:'PASS',destinationJobId:imported.job.JOB_ID,browserEntryDraft:x.entries.at(-1).view.drafts['#draft'].value,pendingReplacementPreserved:true,sourceUnchanged:true,backupSha256:digest(new Uint8Array(await backup.arrayBuffer()))});
}
{
 const x=await ui(),dest=await destination(x),backup=await x.store.exportPackage(dest.project.job.JOB_ID);
 x.t.refreshProjectStorage=async()=>{throw new Error('Controlled post-import refresh failure');};
 await assert.rejects(x.t.importProjectPackageFile(backup,{recordSelection:false}),error=>error.code==='IMPORT_COMMITTED_REFRESH_FAILED','PROJECT_ACTIVATION_IMPORT_REFRESH_FAILURE_ORACLE');
 assert.equal(x.t.current.job.JOB_ID,dest.expected.jobId,'PROJECT_ACTIVATION_IMPORT_COMMITTED_STATE_ORACLE');
 assert.equal(x.nodes().get('#draft').value,'Destination-own draft','PROJECT_ACTIVATION_IMPORT_REFRESH_DRAFT_ORACLE');
 assert.equal(x.t.replacementReview.next.job.JOB_TITLE,'Destination pending title','PROJECT_ACTIVATION_IMPORT_REFRESH_PENDING_REVIEW_ORACLE');
 assert.equal((await x.store.readProject(dest.expected.jobId)).job.JOB_ID,dest.expected.jobId);
 observations.push({id:'PROJECT_ACTIVATION_IMPORTED_REFRESH_FAILURE',result:'PASS',committed:true,destinationDraftPreserved:true,pendingReplacementPreserved:true,errorCode:'IMPORT_COMMITTED_REFRESH_FAILED'});
}
{
 const x=await ui(),dest=await destination(x),backup=await x.store.exportPackage(dest.project.job.JOB_ID);
 x.t.projectStore={...x.store,readHistoryView:async()=>{throw new Error('Controlled post-import view-read failure');}};
 await assert.rejects(x.t.importProjectPackageFile(backup,{recordSelection:false}),error=>error.code==='IMPORT_COMMITTED_REFRESH_FAILED','PROJECT_ACTIVATION_IMPORT_VIEW_READ_FAILURE_ORACLE');
 assert.equal(x.t.current.job.JOB_ID,dest.expected.jobId);assert.deepEqual(Object.keys(x.t.operationSelection),[]);assert.deepEqual(Object.keys(x.t.runSelection),[]);assert.deepEqual(Object.keys(x.t.fileSelectionDrafts),[]);
 assert.equal(x.nodes().get('#draft').value,'','PROJECT_ACTIVATION_IMPORT_VIEW_READ_ISOLATION_ORACLE');
 const savedView=await x.store.readHistoryView(dest.expected.jobId);assert.equal(savedView.drafts['#draft'].value,'Destination-own draft');assert.equal(savedView.pendingMutation.next.job.JOB_TITLE,'Destination pending title');
 observations.push({id:'PROJECT_ACTIVATION_IMPORTED_VIEW_READ_FAILURE',result:'PASS',committed:true,departingControlsCleared:true,destinationDraftAndPendingReviewRecoverable:true,errorCode:'IMPORT_COMMITTED_REFRESH_FAILED'});
}
{
 const x=await ui(),before=await x.store.readProject(x.source.job.JOB_ID);
 await assert.rejects(x.t.importProjectPackageFile(new Blob(['invalid backup']),{recordSelection:false}),/Import rejected without changing existing projects/,'PROJECT_ACTIVATION_IMPORT_REJECTION_ORACLE');
 assert.equal(x.t.current.job.JOB_ID,x.source.job.JOB_ID);assert.equal(x.nodes().get('#draft').value,'Source-only unsaved draft');
 assert.equal((await x.store.readProject(x.source.job.JOB_ID)).projectSha256,before.projectSha256);
 observations.push({id:'PROJECT_ACTIVATION_REJECTED_IMPORT',result:'PASS',sourceProjectUnchanged:true,sourceDraftPreserved:true});
}
{
 const x=await ui();x.t.replacementReview={next:x.copy(x.source)};x.t.fileSelectionDrafts.stale={jobId:x.source.job.JOB_ID};x.t.selectSavedView(null);
 assert.deepEqual(Object.keys(x.t.operationSelection),[],'PROJECT_ACTIVATION_NULL_OPERATION_ORACLE');assert.deepEqual(Object.keys(x.t.runSelection),[]);assert.deepEqual(Object.keys(x.t.fileSelectionDrafts),[]);assert.equal(x.t.replacementReview,null);
 observations.push({id:'PROJECT_ACTIVATION_NULL_VIEW',result:'PASS',operationKeys:[],runKeys:[],fileSelectionKeys:[],pendingReview:false});
}
{
 const x=await ui(),dest=await destination(x);x.t.current=dest.project;x.t.selectSavedView(dest.view,{alreadyRebased:true});x.t.applySavedView(dest.view);
 assert.equal(x.t.selectedOperation(1),'COMPLETE');assert.equal(x.t.selectedRun(11).id,dest.expected.runId,'PROJECT_ACTIVATION_VALID_RUN_ORACLE');assert.equal(x.nodes().get('#draft').value,'Destination-own draft');assert.equal(x.t.replacementReview.next.job.JOB_TITLE,'Destination pending title');
 x.t.operationSelection[1]='RECONCILE_INTAKE';assert.equal(x.t.selectedOperation(1),'RECONCILE_INTAKE','PROJECT_ACTIVATION_SAME_PROJECT_EXPLICIT_ORACLE');
 observations.push({id:'PROJECT_ACTIVATION_SAME_PROJECT_VIEW',result:'PASS',savedOperation:'COMPLETE',ownedRunId:dest.expected.runId,draft:'Destination-own draft',pendingTitle:'Destination pending title',explicitOperationPreserved:'RECONCILE_INTAKE'});
}
console.log(JSON.stringify({schema:'closed-loop-project-activation-proof/1',appSha256:digest(app),actualBrowser:false,transactionAdapter:true,observations},null,2));
