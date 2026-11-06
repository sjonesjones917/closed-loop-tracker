import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Actual UI persistence owner with a controlled storage command adapter. The
// owning acceptance suite separately executes real canonical acceptance/storage.
// Canonical writes, acceptance or ordinary, are confirmed only by the store
// transaction (MUTATION_CONFIRMATION_REQUIRED with its current impact), whose
// refusal opens the review; operational writes, which the store does not
// confirm, keep the single main-thread preflight.
const STORE_CONFIRMED_CASES=new Set(['required-storage-confirmation','stale-storage-confirmation','ordinary-store-confirmation-route']);
export async function verifyAcceptanceStorageImpactRouting({source=fs.readFileSync('app-core.js','utf8'),controls=true}={}){
 const start=source.indexOf('async function persistReplacement('),end=source.indexOf('async function save(',start);assert.ok(start>=0&&end>start);
 const cases=[],viewHelper=source.slice(source.indexOf('function acceptedProposalHistoryView('),source.indexOf('function rebaseAcceptedLaneSelection('));
 for(const name of ['conforming-acceptance','required-storage-confirmation','stale-storage-confirmation','failed-write','ordinary-store-confirmation-route','operational-preflight-preserved']){
  const prior={job:{JOB_ID:'SYNTHETIC-IMPACT'},revision:4,projectSha256:'prior',activeStage:2,activeView:'Workflow'},next=structuredClone(prior);next.proposed='exact candidate';
  const ordinary=name==='ordinary-store-confirmation-route',operational=name==='operational-preflight-preserved',acceptance=ordinary||operational?null:{stage:2,proposalId:'PENDING-PROPOSAL',rawResponseId:'RETAINED-RAW'};
  const impact={requiresConfirmation:true,confirmationKey:'current-storage-impact',affected:[{stage:3,work:[{id:'RETAINED-DOWNSTREAM'}]}]};let preflight=0,writes=0,review=null,saved=null;
  const runtime=createVerifierRuntime({current:prior,projects:[prior],projectStore:{mutationImpact(_source,_next,_derived,options){preflight++;assert.equal(options?.candidateWhenRequired,true,'OPERATIONAL_PREFLIGHT_DIGEST_WHEN_REQUIRED');return impact;},async replaceProject(candidate,options){writes++;assert.equal(candidate,next,'ACCEPTANCE_EXACT_CANDIDATE_ORACLE');assert.equal(options.acceptance,undefined);assert.equal(options.operational,operational,'STORAGE_WRITE_KIND_ORACLE '+name);if(STORE_CONFIRMED_CASES.has(name))throw Object.assign(new Error('Review current effect'),{code:'MUTATION_CONFIRMATION_REQUIRED',impact});if(name==='failed-write')throw Object.assign(new Error('Controlled failed write'),{code:'INJECTED_STORAGE_FAILURE'});saved={...candidate,revision:5,projectSha256:'saved'};return saved;}},showReplacementReview:async value=>{review=value;},captureCurrentView:async()=>{},captureView:()=>({activeStage:2}),acceptedContinuation:()=>null,rebaseAcceptedLaneSelection:()=>{},withStorageActivity:async(_label,operation)=>operation(),operationSelection:{},runSelection:{},unloadInactiveProjects:()=>{},mobileSessionCurrent:()=>false,recordCommittedBoundary:async()=>{},render:()=>{}});
  runtime.safe=value=>Array.isArray(value)?value:[];createVerifierRuntime.loadScript(runtime,viewHelper+source.slice(start,end)+'\nglobalThis.persist=persistReplacement;');
  const run=()=>runtime.persist(next,{acceptance,...(operational?{operational:true}:{}),...(name==='stale-storage-confirmation'?{mutationConfirmation:{confirmationKey:'older-impact'}}:{})});
  if(name==='conforming-acceptance'){assert.equal(await run(),saved);assert.equal(runtime.current,saved);assert.equal(review,null);}
  else if(name==='failed-write'){await assert.rejects(run,error=>error.code==='INJECTED_STORAGE_FAILURE');assert.equal(runtime.current,prior);assert.equal(review,null);}
  else{await assert.rejects(run,error=>error.code==='MUTATION_REVIEW_SHOWN','ACCEPTANCE_STORAGE_REVIEW_ROUTE_ORACLE '+name);assert.equal(review.next,next,'ACCEPTANCE_REVIEW_CANDIDATE_RETENTION_ORACLE');assert.equal(review.impact,impact,'ACCEPTANCE_REVIEW_STORAGE_IMPACT_ORACLE');assert.equal(review.acceptance,acceptance);assert.equal(runtime.current,prior,'ACCEPTANCE_REVIEW_NO_COMMIT_ORACLE');}
  assert.equal(preflight,operational?1:0,'ACCEPTANCE_NO_DUPLICATE_PREFLIGHT_ORACLE '+name);assert.equal(writes,operational?0:1,'ACCEPTANCE_STORAGE_OWNER_CALLED_ORACLE '+name);
  cases.push({caseId:name,result:'PASS',preflightCalls:preflight,storageCalls:writes,exactCandidateRetained:review?review.next===next:true});
 }
 {
  const begin=source.indexOf('async function confirmReplacement('),end=source.indexOf('async function acceptPendingProposal(',begin),impact={requiresConfirmation:true,confirmationKey:'current'},next={},review={next,expectedProjectRevision:4,impact,acceptance:{proposalId:'PENDING',rawResponseId:'RAW',humanAuthorityConfirmations:{}}};let finished=false,stored=false;
  const runtime=createVerifierRuntime({replacementReview:review,current:{revision:4,job:{JOB_ID:'SYNTHETIC'},projectSha256:'current'},ingestion:{findRaw:()=>({}),acceptanceImpact:()=>impact,validateAcceptanceCandidate:()=>{}},reverifyReturnedFiles:async()=>{},humanAuthorityConfirmationValues:()=>({}),closedLoopHash:{sha256Value:JSON.stringify},projectStore:{mutationImpact:()=>impact},engine:{records:()=>[]},persistReplacement:async candidate=>{assert.equal(candidate,next);stored=true;runtime.replacementReview={...review,impact:{...impact,confirmationKey:'changed-at-commit'}};throw Object.assign(new Error('Review refreshed'),{code:'MUTATION_REVIEW_SHOWN'});},finishAcceptedProposal:()=>{finished=true;}});
  createVerifierRuntime.loadScript(runtime,source.slice(begin,end)+'\nglobalThis.confirm=confirmReplacement;');await runtime.confirm();assert.equal(stored,true,'ACCEPTANCE_CONFIRM_STORAGE_RECHECK_ORACLE');assert.equal(finished,false,'ACCEPTANCE_CONFIRM_NO_FALSE_SUCCESS_ORACLE');assert.equal(runtime.replacementReview.impact.confirmationKey,'changed-at-commit');cases.push({caseId:'confirmation-refresh-remains-review',result:'PASS',noFalseSave:true,exactCandidateRetained:runtime.replacementReview.next===next});
 }
 // Intended regressions of the confirmation route; each must be refused by its owning oracle.
 const faults=[];
 if(controls)for(const [name,before,after,oracle] of [
  ['ordinary-duplicate-preflight','nativeProductResults||acceptance||!operational?null:projectStore.mutationImpact?.(source,next,recalculated?next:null,{candidateWhenRequired:true})','nativeProductResults||acceptance?null:projectStore.mutationImpact?.(source,next,recalculated?next:null,{candidateWhenRequired:true})','ACCEPTANCE_NO_DUPLICATE_PREFLIGHT_ORACLE ordinary-store-confirmation-route'],
  ['acceptance-only-store-route',"if((acceptance||!operational&&!nativeProductResults)&&error?.code==='MUTATION_CONFIRMATION_REQUIRED'&&error.impact)","if(acceptance&&error?.code==='MUTATION_CONFIRMATION_REQUIRED'&&error.impact)",'ACCEPTANCE_STORAGE_REVIEW_ROUTE_ORACLE ordinary-store-confirmation-route'],
  ['operational-preflight-dropped','nativeProductResults||acceptance||!operational?null:projectStore.mutationImpact?.(source,next,recalculated?next:null,{candidateWhenRequired:true})','null','ACCEPTANCE_STORAGE_REVIEW_ROUTE_ORACLE operational-preflight-preserved']
 ]){assert.equal(source.split(before).length-1,1,'Storage confirmation route fault anchor: '+name);await assert.rejects(verifyAcceptanceStorageImpactRouting({source:source.replace(before,after),controls:false}),error=>error.code==='ERR_ASSERTION'&&error.message.includes(oracle),'Storage confirmation route fault was not detected: '+name);faults.push({fault:name,result:'DETECTED',oracle});}
 return {result:'PASS',boundary:'Extracted actual UI persistence function with controlled store responses; owning suite separately proves real store acceptance',sourceSha256:createHash('sha256').update(source).digest('hex'),cases,faults,...(controls?{acceptedViewCheckpointReuse:await verifyAcceptedViewCheckpointReuse({source}),retainedViewCapture:await verifyRetainedViewCapture({source})}:{})};
}

// A write that retains the selected view as its own History view does not save
// that view separately first. Captures already admitted (edits) still finish
// before the write, and a pending replacement review is still captured.
export async function verifyRetainedViewCapture({source=fs.readFileSync('app-core.js','utf8'),controls=true}={}){
 const extract=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);};
 const body=extract('function acceptedProposalHistoryView(','function rebaseAcceptedLaneSelection(')+extract('async function persistReplacement(','async function save(')+extract('async function captureCurrentView(','async function navigateWithinVersion('),cases=[];
 const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex'),expectedOrder={'retained-by-write':['write'],'admitted-capture-first':['checkpoint-start','checkpoint','write'],'pending-review-captured':['checkpoint','write'],'ordinary-write-captures':['checkpoint','write']};
 for(const name of Object.keys(expectedOrder)){
  const prior={job:{JOB_ID:'SYNTHETIC-RETAINED-VIEW'},revision:4,projectSha256:'prior',activeStage:1,activeView:'Workflow',projectData:{}},next=structuredClone(prior);next.exportRecorded=true;
  const view={activeStage:1,activeView:'Workflow',operationSelection:{},runSelection:{},drafts:{'#handoff-recipient':{value:'Unsaved recipient draft'}},pendingMutation:null},order=[];let committedView,release=()=>{};
  const runtime=createVerifierRuntime({ingestion:{proposalAccepted:()=>false},current:prior,projects:[prior],safe:value=>Array.isArray(value)?value:[],operationSelection:{},runSelection:{},replacementReview:name==='pending-review-captured'?{next:structuredClone(prior),impact:{requiresConfirmation:true,confirmationKey:'pending'},expectedProjectRevision:4}:null,historyRestoreController:null,restoringHistory:false,operatorActionInFlight:null,pendingViewCaptures:[],capturingViewPromise:null,savedDraftView:null,savedViewSignature:'earlier-view',displayedHistoryEntryId:'entry',APPLICATION_SESSION_ID:'SYNTHETIC-SESSION',closedLoopHash:{sha256Value:sha},acceptedContinuation:()=>null,rebaseAcceptedLaneSelection:()=>{},withStorageActivity:async(_label,fn)=>fn(),unloadInactiveProjects:()=>{},mobileSessionCurrent:()=>false,writeBrowserEntry:()=>{},displayedBrowserEntry:()=>({entryId:'entry'}),showReplacementReview:()=>{throw Error('Unexpected replacement review');},refreshHistory:async()=>{},recordCommittedBoundary:async()=>{}});
  runtime.captureView=()=>structuredClone({...view,pendingMutation:runtime.replacementReview?{next:runtime.replacementReview.next,impact:runtime.replacementReview.impact}:null});
  runtime.projectStore={mutationImpact:()=>({requiresConfirmation:false}),async saveCheckpoint(){order.push('checkpoint');return 'view-checkpoint';},async replaceProject(candidate,options){order.push('write');committedView=structuredClone(options.historyView);return {...candidate,revision:5,projectSha256:'committed'};}};
  createVerifierRuntime.loadScript(runtime,body+'\nglobalThis.persist=persistReplacement;globalThis.capture=captureCurrentView;');
  if(name==='admitted-capture-first'){
   runtime.projectStore.saveCheckpoint=async()=>{order.push('checkpoint-start');await new Promise(resolve=>{release=resolve;});order.push('checkpoint');return 'edit-checkpoint';};
   const edit=runtime.capture(),write=runtime.persist(next,{operational:true,viewRetainedByWrite:true});
   try{await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(order,['checkpoint-start'],'RETAINED_VIEW_ADMITTED_CAPTURE_ORDER_ORACLE');}finally{release();}
   await Promise.all([edit,write]);
  }else await runtime.persist(next,{operational:true,viewRetainedByWrite:name!=='ordinary-write-captures'});
  assert.deepEqual(order,expectedOrder[name],'RETAINED_VIEW_CHECKPOINT_ORACLE '+name);
  assert.equal(JSON.stringify(committedView),JSON.stringify({...view,pendingMutation:null}),'RETAINED_VIEW_HISTORY_ORACLE '+name);
  cases.push({caseId:name,result:'PASS',order,historyViewRetained:true});
 }
 const faults=[];
 if(controls)for(const [name,before,after,oracle] of [
  ['admitted-capture-not-awaited','if(retainedByWrite&&!replacementReview)return capturingViewPromise;','if(retainedByWrite&&!replacementReview)return;','RETAINED_VIEW_ADMITTED_CAPTURE_ORDER_ORACLE'],
  ['pending-review-not-captured','if(retainedByWrite&&!replacementReview)return capturingViewPromise;','if(retainedByWrite)return capturingViewPromise;','RETAINED_VIEW_CHECKPOINT_ORACLE pending-review-captured'],
  ['retained-view-captured-again','await captureCurrentView(viewRetainedByWrite&&selectedOwner&&!acceptance&&!nativeProductResults?{retainedByWrite:true}:undefined);','await captureCurrentView();','RETAINED_VIEW_CHECKPOINT_ORACLE retained-by-write']
 ]){assert.equal(source.split(before).length-1,1,'Retained view fault anchor: '+name);await assert.rejects(verifyRetainedViewCapture({source:source.replace(before,after),controls:false}),error=>error.code==='ERR_ASSERTION'&&error.message.includes(oracle),'Retained view fault was not detected: '+name);faults.push({fault:name,result:'DETECTED',oracle});}
 return {result:'PASS',boundary:'Actual extracted UI persist and view-capture functions with explicit synthetic storage adapter; not browser timing',cases,faults};
}

export async function verifyAcceptedViewCheckpointReuse({source=fs.readFileSync('app-core.js','utf8'),controls=true}={}){
 const extract=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);};
 const ingestionSource=fs.readFileSync('response-ingestion.js','utf8'),predicateLine=ingestionSource.split('\n').find(line=>line.startsWith('function proposalAccepted('));assert.ok(predicateLine);const proposalAccepted=Function(predicateLine+';return proposalAccepted;')();
 const body=extract('function acceptedProposalHistoryView(','function rebaseAcceptedLaneSelection(')+extract('async function persistReplacement(','async function save(')+extract('async function captureCurrentView(','async function navigateWithinVersion('),cases=[];
 const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 for(const name of ['empty-consumed-proposal','nonempty-consumed-proposal','proposal-not-accepted','no-acceptance','changed-other-draft','failed-history-refresh','questions-created','blocker-accepted','execution-failure-accepted','proposal-rejected']){
  const prior={job:{JOB_ID:'SYNTHETIC-VIEW'},revision:4,projectSha256:'prior',activeStage:1,activeView:'Workflow',projectData:{responseProposals:[{proposalId:'PENDING',status:'PENDING_OPERATOR_REVIEW'}]}},next=structuredClone(prior);next.projectData.responseProposals[0].status=({'proposal-not-accepted':'PENDING_OPERATOR_REVIEW','questions-created':'QUESTIONS_CREATED','blocker-accepted':'BLOCKER_ACCEPTED','execution-failure-accepted':'EXECUTION_FAILURE_ACCEPTED','proposal-rejected':'REJECTED'})[name]||'ACCEPTED';
  let dom={activeStage:1,activeView:'Workflow',operationSelection:{},runSelection:{},drafts:{'#correction-reason':{value:name==='nonempty-consumed-proposal'?'Retain this correction note':''},'#other-draft':{value:'Unrelated draft retained'}},pendingMutation:null},committedView,checkpointWrites=0,refreshFails=false;
  const acceptance=name==='no-acceptance'?null:{stage:1,proposalId:'PENDING'},copy=value=>structuredClone(value),runtime=createVerifierRuntime({ingestion:{proposalAccepted},current:prior,projects:[prior],safe:value=>Array.isArray(value)?value:[],operationSelection:{},runSelection:{},replacementReview:null,historyRestoreController:null,restoringHistory:false,operatorActionInFlight:null,pendingViewCaptures:[],capturingViewPromise:null,savedDraftView:null,savedViewSignature:sha({jobId:prior.job.JOB_ID,revision:4,projectSha256:'prior',entryId:'entry',view:dom}),displayedHistoryEntryId:'entry',APPLICATION_SESSION_ID:'SYNTHETIC-SESSION',closedLoopHash:{sha256Value:sha},captureView:()=>copy(dom),acceptedContinuation:()=>null,rebaseAcceptedLaneSelection:()=>{},withStorageActivity:async(_label,fn)=>fn(),unloadInactiveProjects:()=>{},mobileSessionCurrent:()=>false,writeBrowserEntry:()=>{},displayedBrowserEntry:()=>({entryId:'entry'}),showReplacementReview:()=>{throw Error('Unexpected replacement');},refreshHistory:async()=>{if(refreshFails)throw Error('Controlled refresh failure');}});
  runtime.projectStore={historyList:async()=>runtime.historyState,mutationImpact:()=>({requiresConfirmation:false}),async replaceProject(candidate,options){committedView=copy(options.historyView);const saved={...candidate,revision:5,projectSha256:'committed'};runtime.historyState={jobId:prior.job.JOB_ID,activeId:'committed-checkpoint',activeProjectSha256:'committed',entries:[{id:'committed-checkpoint',viewSha256:sha(committedView)}]};refreshFails=name==='failed-history-refresh';return saved;},async saveCheckpoint(_jobId,{view}){checkpointWrites++;assert.equal(view.drafts['#other-draft'].value,dom.drafts['#other-draft'].value,'ACCEPTED_VIEW_OTHER_DRAFT_PRESERVED');return 'final-view';}};
  createVerifierRuntime.loadScript(runtime,body+'\nglobalThis.persist=persistReplacement;globalThis.capture=captureCurrentView;');
  await runtime.persist(next,{acceptance});
  const consumed=acceptance&&['ACCEPTED','QUESTIONS_CREATED','BLOCKER_ACCEPTED','EXECUTION_FAILURE_ACCEPTED'].includes(next.projectData.responseProposals[0].status);
  if(consumed)delete dom.drafts['#correction-reason'];
  if(name==='changed-other-draft')dom.drafts['#other-draft'].value='New legitimate draft';
  refreshFails=false;await runtime.capture();
  const expectedWrites=['nonempty-consumed-proposal','changed-other-draft','failed-history-refresh'].includes(name)?1:0;
  assert.equal(checkpointWrites,expectedWrites,'ACCEPTED_EMPTY_DRAFT_CHECKPOINT_ORACLE '+name);
  const shouldRemove=consumed&&name!=='nonempty-consumed-proposal';assert.equal(Object.hasOwn(committedView.drafts,'#correction-reason'),!shouldRemove,'ACCEPTED_VIEW_SCOPE_ORACLE '+name);
  assert.equal(committedView.drafts['#other-draft'].value,'Unrelated draft retained');
  if(name==='nonempty-consumed-proposal')assert.equal(committedView.drafts['#correction-reason'].value,'Retain this correction note','ACCEPTED_NONEMPTY_DRAFT_RETAINED');
  cases.push({caseId:name,result:'PASS',checkpointWrites,expectedWrites,unrelatedDraftPreserved:true,emptyConsumedDraftOnly:true});
 }
 const faults=[];
 if(controls)for(const [name,before,after]of [
  ['omit-prepared-view-normalization','committedView=acceptedProposalHistoryView(next,committedView,acceptance);',''],
  ['omit-boundary-view-normalization','const view=acceptedProposalHistoryView(current,captureView(),committed?.acceptance);','const view=captureView();']
 ]){assert.equal(source.split(before).length-1,1,'Accepted view fault anchor');await assert.rejects(verifyAcceptedViewCheckpointReuse({source:source.replace(before,after),controls:false}),error=>error.code==='ERR_ASSERTION'&&error.message.includes('ACCEPTED_EMPTY_DRAFT_CHECKPOINT_ORACLE empty-consumed-proposal'),'Required empty-draft extra checkpoint was not detected');faults.push({fault:name,result:'DETECTED',oracle:'ACCEPTED_EMPTY_DRAFT_CHECKPOINT_ORACLE empty-consumed-proposal'});}
 return {result:'PASS',boundary:'Actual extracted UI persist, committed-boundary and final capture functions with explicit synthetic transaction adapter; real large-browser snapshots independently establish original extra write',cases,faults};
}
