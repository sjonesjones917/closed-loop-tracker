import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const sha=value=>createHash('sha256').update(value).digest('hex');
// Actual selected-lane, decision, prompt, persistence and export owners. DOM
// controls and view rendering are synthetic; this is not browser timing or a
// real human's authorization. The store uses the existing transaction adapter.
async function setup(sourceOverrides){
 const r=projectStoreRuntime({sourceOverrides}),t=r.runtime,e=r.engine,controls=new Map(),downloads=[],failures=[];
 let p=await r.store.createProject({commandId:'SYNTHETIC_HANDOFF_TRANSACTION'});
 p.job.EXACT_USER_OBJECTIVE_VERBATIM='Read this disposable synthetic project and produce a proposal.';e.recordHumanInputVersion(p,['EXACT_USER_OBJECTIVE_VERBATIM'],'SYNTHETIC_OPERATOR');
 p=await r.store.writeProject(p,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});p.activeStage=1;p.activeView='Workflow';
 Object.assign(t,{current:p,projects:r.copy([p]),projectStore:r.store,engine:e,core:r.core,schema:t.closedLoopWorkflowSchema,ingestion:r.ingestion,clone:r.copy,safe:e.safe,recordValue:e.recordValue,runSelection:{},operationSelection:{1:'COMPLETE'},handoffReview:null,handoffNavigationSequence:0,TAB_INSTANCE_ID:'SYNTHETIC_HANDOFF_TRANSACTION',selectedOperation:()=> 'COMPLETE',selectedOperationRegistration:n=>t.closedLoopWorkflowSchema.STAGE_OPERATION_REGISTRY[n+':COMPLETE'],unloadInactiveProjects(){},mobileSessionCurrent:()=>false,recordCommittedBoundary:async()=>{},render(){},announce(){},focusAfterAction(){},applySavedView(){},CSS:{escape:String},document:{activeElement:{id:'authorize-handoff'},querySelectorAll:()=>[]},requestAnimationFrame(){},innerHeight:900,$:selector=>controls.get(selector)||null,withStorageActivity:async(_label,fn)=>fn(),reportActionFailure:error=>failures.push(error),downloadBlob:(blob,filename)=>downloads.push({blob,filename}),displayedStageAction:()=>e.operationalNextAction(t.current),captureView:()=>r.copy({activeStage:t.current.activeStage,activeView:t.current.activeView,operationSelection:t.operationSelection,runSelection:t.runSelection,drafts:{}})});
 t.captureCurrentView=()=>r.store.saveCheckpoint(t.current.job.JOB_ID,{expectedProjectRevision:t.current.revision,view:t.captureView()});
 const source=sourceOverrides['app-core.js'],extract=(a,b)=>{const first=source.indexOf(a),last=source.indexOf(b,first+a.length);assert.ok(first>=0&&last>first,'HANDOFF_TRANSACTION_SOURCE_OWNER '+a);return source.slice(first,last);},line=prefix=>{const found=source.split('\n').find(row=>row.startsWith(prefix));assert.ok(found,prefix);return found;};
 vm.runInContext(line('function operationExecutorClass(')+'\n'+line('function externalAgentOperation(')+'\n'+line('function stagePlanItems(')+'\n'+extract('function currentRunSlots(','// A saved response may be inspected independently.')+extract('async function persistReplacement(','async function save(')+extract('async function savePromptRecord(','function promptTransportFilename(')+extract('let promptExportInFlight=null;','function fileSelectionKey('),t,{filename:'app-core.js:actual-handoff-transaction-owners'});
 vm.runInContext('presentHandoffReview=(review,key,origin)=>retainHandoffReview(review,key,origin);',t);
 for(const [key,value]of Object.entries({recipient:'Synthetic local actor',provider:'Synthetic isolated environment',suitabilityBasis:'Disposable synthetic fixture only; no actual user data or external transfer.',operator:'SYNTHETIC_OPERATOR'}))controls.set('#handoff-'+key,{value});
 controls.set('#handoff-purpose-DISCLOSURE_AUTHORIZATION',{checked:true});controls.set('#handoff-confirmed',{checked:true});controls.set('#authorize-handoff',{});controls.set('#handoff-review',{});
 await t.exportStageFiles();assert.equal(downloads.length,0);assert.equal(failures.length,0);assert.ok(t.handoffReview);
 const before=await r.store.readProject(t.current.job.JOB_ID),prompt=t.currentPromptRecord(1),subject=t.handoffReview.review.authorization.subjectSha256;
 return {r,t,e,controls,downloads,failures,before,prompt,subject};
}

export async function verifyHandoffAuthorizationTransaction({sourceOverrides={},scenario=null}={}){
 sourceOverrides=Object.fromEntries(files.map(file=>[file,sourceOverrides[file]??fs.readFileSync(file,'utf8')]));
 const sourceSha256=Object.fromEntries(Object.entries(sourceOverrides).map(([file,source])=>[file,sha(source)])),cases=[];
 for(const kind of ['success','preparation-failure','transaction-failure','concurrent-change','navigation-after-commit']){
  if(scenario&&scenario!==kind)continue;
  const f=await setup(sourceOverrides),{r,t,e,before,prompt}=f,originalPrompts=t.closedLoopPromptEngine,originalStore=r.store;
  const history=e.clone({raw:before.projectData.rawResponses,accepted:before.projectData.acceptedChanges}),decisionCount=before.projectData.humanDecisions.length,promptCount=before.projectData.generatedPrompts.length;
  if(kind==='preparation-failure')t.closedLoopPromptEngine={...originalPrompts,reserveAndBuildPromptRecord:project=>{project.projectData.generatedPrompts.push({instructionId:'SYNTHETIC_UNCOMMITTED_PREPARATION'});throw new Error('SYNTHETIC_PROMPT_PREPARATION_FAILED');}};
  if(kind==='transaction-failure')t.projectStore={...originalStore,replaceProject:async(...args)=>{t.__closedLoopStorageFault='during-project-write';try{return await originalStore.replaceProject(...args);}finally{delete t.__closedLoopStorageFault;}}};
  if(kind==='concurrent-change')t.projectStore={...originalStore,replaceProject:async(...args)=>{const concurrent=await originalStore.readProject(before.job.JOB_ID);concurrent.job.JOB_TITLE='Synthetic independently saved work';await originalStore.writeProject(concurrent,{expectedProjectRevision:concurrent.revision,expectedStateSha256:concurrent.projectSha256});return originalStore.replaceProject(...args);}};
  if(kind==='navigation-after-commit')t.projectStore={...originalStore,replaceProject:async(...args)=>{const saved=await originalStore.replaceProject(...args);t.handoffNavigationSequence++;return saved;}};
  let error=null;try{await t.recordCurrentHandoffAuthorization(true);}catch(caught){error=caught;}
  t.closedLoopPromptEngine=originalPrompts;
  const stored=await originalStore.readProject(before.job.JOB_ID);
  assert.equal(JSON.stringify({raw:stored.projectData.rawResponses,accepted:stored.projectData.acceptedChanges}),JSON.stringify(history),'HANDOFF_UNRELATED_HISTORY_PRESERVED');
  if(kind==='success'){
   assert.equal(error,null);assert.equal(f.failures.length,0);assert.equal(f.downloads.length,1);
   assert.equal(stored.revision,before.revision+1,'HANDOFF_SINGLE_CANONICAL_TRANSACTION_ORACLE: decision and replacement prompt must share one revision');
   assert.equal(stored.projectData.humanDecisions.length,decisionCount+1);assert.equal(stored.projectData.generatedPrompts.length,promptCount+1);
   const fresh=t.currentPromptRecord(1);assert.ok(fresh&&fresh.instructionId!==prompt.instructionId);assert.equal(fresh.scope.projectRevision,stored.revision);assert.ok(originalPrompts.promptTransportBinding(stored,1,'COMPLETE',fresh.instructionId,fresh.scope));
   assert.equal(e.recordValue(stored.projectData.operationReservations.find(row=>e.recordId(row,'operationReservations')===prompt.operationReservationId),'STATUS'),'EXPIRED_BY_SCOPE');
   const review=await originalStore.prepareExecutionPackageReview({project:stored,stage:1,operation:'COMPLETE',instructionId:fresh.instructionId});assert.equal(review.authorization.allowed,true);assert.equal(review.authorization.subjectSha256,f.subject);
   const retained=await originalStore.historyList(stored.job.JOB_ID);assert.equal(retained.activeProjectSha256,stored.projectSha256);assert.ok(await originalStore.readHistoryView(stored.job.JOB_ID));
   cases.push({caseId:kind,revisionAdvances:1,decisionSaved:true,promptSaved:true,strictTransportCurrent:true,authorizedZip:true,exactSubjectPreserved:true,historyReload:true});
  }else{
   assert.ok(error,'HANDOFF_FAILURE_MUST_BE_REPORTED '+kind);assert.equal(f.downloads.length,0,'HANDOFF_FAILURE_MUST_NOT_EXPORT '+kind);
   if(kind==='preparation-failure'){
    assert.match(error.message,/sharing decision was saved.*SYNTHETIC_PROMPT_PREPARATION_FAILED/);assert.equal(stored.revision,before.revision+1);assert.equal(stored.projectData.humanDecisions.length,decisionCount+1);assert.equal(stored.projectData.generatedPrompts.length,promptCount);assert.ok(!JSON.stringify(stored).includes('SYNTHETIC_UNCOMMITTED_PREPARATION'));
    cases.push({caseId:kind,decisionSaved:true,speculativePromptAbsent:true,noExport:true,honestSavedDecisionError:true});
   }else if(kind==='navigation-after-commit'){
    assert.match(error.message,/sharing decision was saved.*selected project, stage, operation or view changed/);assert.equal(stored.revision,before.revision+1);assert.equal(stored.projectData.humanDecisions.length,decisionCount+1);assert.equal(stored.projectData.generatedPrompts.length,promptCount+1);
    cases.push({caseId:kind,decisionSaved:true,promptSaved:true,noExport:true,honestSavedDecisionError:true});
   }else{
    assert.equal(error.code,kind==='transaction-failure'?'INJECTED_STORAGE_FAILURE':'STALE_PROJECT_REVISION');assert.doesNotMatch(error.message,/sharing decision was saved/);assert.equal(stored.projectData.humanDecisions.length,decisionCount);assert.equal(stored.projectData.generatedPrompts.length,promptCount);
    if(kind==='transaction-failure')assert.equal(stored.projectSha256,before.projectSha256);else assert.equal(stored.job.JOB_TITLE,'Synthetic independently saved work');
    cases.push({caseId:kind,decisionSaved:false,promptSaved:false,noExport:true,priorOrConcurrentWorkPreserved:true});
   }
  }
 }
 return {passed:true,checkId:'handoff.authorization-canonical-transaction',synthetic:true,actualBrowser:false,sourceSha256,boundary:'Actual extracted UI owners, generated instruction and exact package review, registered synthetic decision, canonical transaction, reload and History under storage adapter; fault injection at preparation/transaction/concurrency/navigation boundaries.',cases};
}
