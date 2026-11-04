import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),frames=[],calls=[],nodes=new Map(),cases=[];let humanFields=[];
function element(id,rect={top:120,bottom:164,left:0,right:300,width:300,height:44}){return {id,tagName:'BUTTON',disabled:false,hidden:false,textContent:'',isConnected:true,parentElement:null,attrs:{},className:'',classList:{add(){},remove(){},contains(){return false;}},getBoundingClientRect:()=>rect,focus(options){calls.push({type:'focus',id,options,disabled:this.disabled});},scrollIntoView(options){calls.push({type:'scroll',id,options});},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},removeAttribute(k){delete this.attrs[k];},querySelector(){return null;}};}
for(const id of ['project-picker','new-project','import-project','import-file','app','app-operation-status','operation-label','app-live-status','operation-error','save-prompt'])nodes.set('#'+id,element(id));
nodes.get('#operation-error').tagName='DIV';nodes.get('#operation-error').hidden=true;
const c=createVerifierRuntime({console,Event,dispatchEvent(){},URL,URLSearchParams,Blob,TextEncoder,TextDecoder,crypto:globalThis.crypto,structuredClone,setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame:fn=>frames.push(fn),innerHeight:852,innerWidth:393,window:{innerHeight:852,innerWidth:393,scrollX:0,scrollY:0},CSS:{escape:value=>value},document:{currentScript:null,querySelector:s=>nodes.get(s)||null,querySelectorAll:s=>s==='[data-human-answer]'?humanFields:[...nodes.values()].filter(x=>x.tagName==='BUTTON'),dispatchEvent(){}}});
vm.runInContext(source.slice(0,source.indexOf('globalThis.closedLoopAppReady=false;'))+`const productionViewCapture=captureCurrentView;globalThis.ui={viewCapture:{enter:fixture=>{
  const previous={current,projectStore,captureCurrentView,savedDraftView,savedViewSignature,displayedHistoryEntryId,historyState,recoveryProjects,quarantinedProjects,responseStagingRecovery,responseStagingRecoveryReadError};
  current=fixture.project;projectStore=fixture.store;captureCurrentView=productionViewCapture;savedDraftView=null;savedViewSignature=null;displayedHistoryEntryId=null;
  return ()=>{({current,projectStore,captureCurrentView,savedDraftView,savedViewSignature,displayedHistoryEntryId,historyState,recoveryProjects,quarantinedProjects,responseStagingRecovery,responseStagingRecoveryReadError}=previous);};
 },capture:()=>captureCurrentView(),commit:()=>{operatorActionInFlight.confirmedCommit={jobId:current.job.JOB_ID,revision:Number(current.revision),projectSha256:current.projectSha256};}},contentTop:(control,options)=>visibleContentTop(control,options),native:async fixture=>{
 const previous={current,engine,schema,nativeProductTests,nativeTestInputs,persistReplacement,render,runtime:globalThis.closedLoopTestRuntime};
 current=fixture.project;engine=fixture.engine;schema=globalThis.closedLoopWorkflowSchema;nativeProductTests=fixture.select;nativeTestInputs=fixture.inputs;persistReplacement=async (next,options)=>{await fixture.commit(next,options);current=next;};render=fixture.render;globalThis.closedLoopTestRuntime=fixture.runtime;
 try{return await runOperatorAction('Running registered application tests',()=>runNativeProductTests(Number(current.activeStage)));}finally{({current,engine,schema,nativeProductTests,nativeTestInputs,persistReplacement,render}=previous);globalThis.closedLoopTestRuntime=previous.runtime;}
},preDelivery:async fixture=>{
 const previous={current,engine,projectStore,persistReplacement,downloadBlob,recordMobileExport,render};
 current=fixture.project;engine=fixture.engine;projectStore=fixture.store;persistReplacement=async next=>{await fixture.commit(next);current=next;};downloadBlob=fixture.download;recordMobileExport=fixture.mobile;render=fixture.render;
 try{return await runOperatorAction('Preparing and exporting pre-delivery backup',exportPreDeliveryCheckpoint);}finally{({current,engine,projectStore,persistReplacement,downloadBlob,recordMobileExport,render}=previous);}
},answers:async()=>{const previous={current,ingestion};current={projectData:{humanInputRequests:[]}};ingestion={answerHumanInput(){throw Object.assign(new Error('Correct the required answer.'),{requestId:'REQUIRED-ANSWER'});}};try{await saveHumanAnswers();}finally{({current,ingestion}=previous);}},capture:fn=>{captureCurrentView=fn;},storage:withStorageActivity,focus:focusAfterAction,prompt:setPromptExpanded,run:runOperatorAction,fail:reportActionFailure,announce,retry:async()=>{const previous={current,savePromptRecord,render,selectedOperation};current={job:{JOB_ID:'FOCUS-DISPOSABLE'},activeStage:1};savePromptRecord=async()=>{};render=()=>{};selectedOperation=()=> 'COMPLETE';try{await prepareReplacementAttempt();await Promise.resolve();}finally{({current,savePromptRecord,render,selectedOperation}=previous);}},accept:async fixture=>{const previous={current,engine,recordMobileOperation,render,replacementReview};current=fixture.project;engine=fixture.engine;recordMobileOperation=async()=>{};render=()=>{};replacementReview={};try{await finishAcceptedProposal({proposalId:'P1',rawResponseId:'R1',stage:1,continuationInstructionId:null});}finally{({current,engine,recordMobileOperation,render,replacementReview}=previous);}}};})();`,c,{filename:'app-core.js'});
async function paint(){for(let i=0;i<3;i++){frames.splice(0).forEach(fn=>fn());await Promise.resolve();}}
const target=element('visible-next-control');c.ui.focus(target);
assert.deepEqual(calls.filter(x=>x.type==='scroll'),[],'FOCUS_VISIBLE_ORACLE: an already visible next action must not scroll.');
assert.equal(calls.at(-1)?.options?.preventScroll,true,'FOCUS_NATIVE_SCROLL_ORACLE: browser-default focus can scroll in the wrong direction.');cases.push({caseId:'FOCUS-VISIBLE-NEXT-CONTROL',result:'PASS'});calls.length=0;
let entered=0,release;const held=new Promise(r=>release=r);const delayed=nodes.get('#save-prompt');
const p=c.ui.run('Saving',async()=>{entered++;c.ui.focus(delayed);await held;});const duplicate=c.ui.run('Saving',()=>{entered++;});await paint();
assert.equal(entered,1);assert.equal(delayed.disabled,true);assert.equal(nodes.get('#app-operation-status').hidden,true,'Sub-threshold work must not display a loading indicator.');assert.equal(calls.some(x=>x.type==='focus'),false,'FOCUS_PENDING_ORACLE: disabled controls must not take focus before resolution.');release();await p;await duplicate;
const focus=calls.find(x=>x.type==='focus'&&x.id===delayed.id);assert.ok(focus,'FOCUS_DEFERRED_ORACLE: the next control was not focused after unlocking.');assert.equal(focus.disabled,false);assert.equal(focus.options?.preventScroll,true,'FOCUS_NATIVE_SCROLL_ORACLE: deferred focus reintroduced implicit scrolling.');assert.equal(calls.some(x=>x.type==='scroll'),false);assert.equal(delayed.disabled,false);cases.push({caseId:'FOCUS-AFTER-UNLOCK-WITHOUT-DUPLICATION',result:'PASS'});calls.length=0;
// An error and delayed progress share one feedback surface. Dismissal reads
// the current activity state rather than exposing a hidden stale message.
{
 const report=nodes.get('#operation-error'),status=nodes.get('#app-operation-status');let dismiss,finish;
 c.document.createElement=()=>element('dismiss-error');report.append=button=>{dismiss=button;};
 const work=c.ui.storage('Saving current view',()=>new Promise(resolve=>finish=resolve));
 await new Promise(resolve=>setTimeout(resolve,1550));assert.equal(status.hidden,false);
 c.ui.fail(new Error('The view could not be saved.'));assert.equal(report.hidden,false);assert.equal(status.hidden,true,'ERROR_PROGRESS_ORACLE: a pending indicator remained underneath the error');
 dismiss.onclick();assert.equal(report.hidden,true);assert.equal(status.hidden,false,'ERROR_PROGRESS_ORACLE: dismissing an error failed to restore a genuinely pending activity');
 c.ui.fail(new Error('Review the saved view.'));finish();await work;
 dismiss.onclick();assert.equal(report.hidden,true);assert.equal(status.hidden,true,'ERROR_PROGRESS_ORACLE: dismissal revealed progress for completed work');
 delete c.document.createElement;delete report.append;await paint();calls.length=0;
 cases.push({caseId:'ERROR-REPLACES-PROGRESS-WITHOUT-STALE-DISMISSAL',result:'PASS'});
}
// UX-001/DEF-10: a non-form next-action container rendered during an
// in-flight operation must not be placed until the operation unlocks and the
// final post-action layout has settled. This is the real Stage 9 -> 10 class.
let releaseRegion;const heldRegion=new Promise(r=>releaseRegion=r),regionRect={top:651.21875,bottom:852.21875,left:10,right:383,width:373,height:201};
const region=element('next-required-action',regionRect);region.tagName='DIV';nodes.set('#next-required-action',region);
region.scrollIntoView=options=>{calls.push({type:'scroll',id:region.id,options});regionRect.top-=1;regionRect.bottom-=1;};
c.window.scrollBy=options=>{calls.push({type:'residual-scroll',id:region.id,options});regionRect.top-=options.top;regionRect.bottom-=options.top;};
const regionRun=c.ui.run('Advancing stage',async()=>{c.ui.focus(region);await heldRegion;});await paint();
assert.equal(calls.some(call=>call.type==='focus'&&call.id===region.id),false,'FOCUS_PENDING_REGION_ORACLE: a next-action region was placed before operator-action finalization.');
releaseRegion();await regionRun;await paint();
assert.ok(calls.some(call=>call.type==='focus'&&call.id===region.id),'FOCUS_FINALIZED_REGION_ORACLE: finalized next-action region did not receive focus.');
assert.ok(regionRect.bottom<=c.innerHeight,'FOCUS_FINALIZED_REGION_VISIBILITY_ORACLE: finalized next-action region remained clipped after layout settled.');
cases.push({caseId:'FOCUS-NONCONTROL-REGION-AFTER-ACTION-FINALIZATION',result:'PASS',bottomAfterFinalization:regionRect.bottom,viewportHeight:c.innerHeight});calls.length=0;delete c.window.scrollBy;nodes.delete('#next-required-action');
// A fixed error banner is already visible; reporting it must not move the page.
const bannerRect={top:0,bottom:160,width:393,height:160},banner=element('operation-error',bannerRect),sticky=element('sticky-tabs',{top:125,bottom:181,width:393,height:56});
nodes.set('.view-tabs',sticky);c.getComputedStyle=node=>({position:node===sticky?'sticky':node===banner?'fixed':'static',top:node===sticky?'125px':'0px'});
c.ui.focus(banner,{reason:'RETRY'});assert.equal(calls.some(call=>call.type==='scroll'),false,'ERROR_SCROLL_ORACLE: an already visible fixed error must not move the document');calls.length=0;
const obscuredRect={top:130,bottom:174,width:180,height:44},obscured=element('collapse-prompt',obscuredRect);
c.window.scrollBy=options=>{obscuredRect.top-=options.top;obscuredRect.bottom-=options.top;};
c.ui.focus(obscured,{reason:'RETURN'});assert(obscuredRect.top>=181,'STICKY_COLLAPSE_ORACLE: the correction/collapse control remained underneath sticky navigation');
cases.push({caseId:'FOCUS-FIXED-ERROR-WITHOUT-JUMP-AND-STICKY-CONTROL',result:'PASS'});calls.length=0;delete c.window.scrollBy;delete c.getComputedStyle;nodes.delete('.view-tabs');
const prompt=element('generated-prompt'),toggle=element('toggle-prompt'),collapse=element('collapse-prompt');let expanded=false;
prompt.classList.toggle=(_class,value)=>{expanded=value;return expanded;};
nodes.set('#generated-prompt',prompt);nodes.set('#toggle-prompt',toggle);nodes.set('#collapse-prompt',collapse);
c.ui.prompt(true);await paint();assert.equal(expanded,true);assert.equal(collapse.hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');assert(!calls.some(call=>['focus','scroll','residual-scroll'].includes(call.type)),'EXPAND_POSITION_ORACLE: expanding the preview moved focus or scrolled away from the existing control');
c.ui.prompt(false);c.ui.prompt(true);await paint();assert.equal(expanded,true);assert(!calls.some(call=>['focus','scroll','residual-scroll'].includes(call.type)),'EXPAND_POSITION_ORACLE: a previous collapse moved the view after the user expanded it again');
c.ui.prompt(false);await paint();assert.equal(expanded,false);assert.equal(collapse.hidden,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');assert(calls.some(call=>call.type==='focus'&&call.id==='toggle-prompt'));
cases.push({caseId:'PROMPT-COLLAPSE-AVAILABLE-AT-BOTH-ENDS',result:'PASS'});calls.length=0;for(const id of ['generated-prompt','toggle-prompt','collapse-prompt'])nodes.delete('#'+id);
const below=element('next-field',{top:930,bottom:974,left:0,right:300,width:300,height:44});c.ui.focus(below);assert.equal(calls.filter(x=>x.type==='scroll').length,1);assert.equal(calls.at(-1).options.block,'nearest','FOCUS_DISTANCE_ORACLE: move only enough to expose the next required element.');cases.push({caseId:'FOCUS-NEXT-FIELD-BELOW-VIEWPORT',result:'PASS'});calls.length=0;
// Chromium may round the first nearest scroll down while the CSS box ends
// at a fractional coordinate. The computed residual must still be exposed.
const fractionalRect={top:900,bottom:944,width:300,height:44},fractional=element('fractional-next-action',fractionalRect);
fractional.scrollIntoView=options=>{calls.push({type:'scroll',id:fractional.id,options});fractionalRect.top=808.375;fractionalRect.bottom=852.375;};
c.window.scrollBy=options=>{calls.push({type:'residual-scroll',id:fractional.id,options});fractionalRect.top-=options.top;fractionalRect.bottom-=options.top;};
c.ui.focus(fractional);
assert.ok(fractionalRect.bottom<=c.innerHeight,'FOCUS_FRACTIONAL_EDGE_ORACLE: nearest scrolling left the actual action clipped');
assert.ok(calls.find(call=>call.type==='residual-scroll')?.options.top>0,'Fractional correction must move forward, not upward');
cases.push({caseId:'FOCUS-FRACTIONAL-EDGE',result:'PASS',bottomAfterCorrection:fractionalRect.bottom,viewportHeight:c.innerHeight});calls.length=0;
// A render can settle a fractional pixel after the synchronous focus pass.
// The shared authority must recheck after layout without another operator action.
const settledRect={top:760,bottom:851.75,width:300,height:91.75},settled=element('settled-next-action',settledRect);
settled.scrollIntoView=options=>{calls.push({type:'scroll',id:settled.id,options});settledRect.top=759.625;settledRect.bottom=852.375;};
c.window.scrollBy=options=>{calls.push({type:'residual-scroll',id:settled.id,options});settledRect.top-=options.top;settledRect.bottom-=options.top;};
c.ui.focus(settled);settledRect.bottom=852.375;settledRect.top=760.625;await paint();
assert.ok(settledRect.bottom<=c.innerHeight,'FOCUS_POST_LAYOUT_FRACTIONAL_ORACLE: the next action became clipped after layout settled');
assert.ok(calls.some(call=>call.type==='residual-scroll'&&call.id===settled.id&&call.options.top>0),'Post-layout fractional correction did not expose the action');
cases.push({caseId:'FOCUS-POST-LAYOUT-FRACTIONAL-EDGE',result:'PASS',bottomAfterCorrection:settledRect.bottom,viewportHeight:c.innerHeight});calls.length=0;delete c.window.scrollBy;
// Layout work can arrive after the first scheduled placement pass (for example,
// sticky-header/inset geometry on the next frame). The shared authority must
// remain active through quiescence rather than assuming one RAF is enough.
const lateRect={top:650.75,bottom:851.75,width:373,height:201},late=element('late-layout-next-action',lateRect);
late.scrollIntoView=options=>{calls.push({type:'scroll',id:late.id,options});};
c.window.scrollBy=options=>{calls.push({type:'residual-scroll',id:late.id,options});lateRect.top-=options.top;lateRect.bottom-=options.top;};
c.ui.focus(late);
frames.splice(0).forEach(fn=>fn());await Promise.resolve();
lateRect.top=651.21875;lateRect.bottom=852.21875;
await paint();
assert.ok(lateRect.bottom<=c.innerHeight,'FOCUS_LAYOUT_QUIESCENCE_ORACLE: a later layout phase clipped the next action after the focus authority stopped observing geometry');
assert.ok(calls.some(call=>call.type==='residual-scroll'&&call.id===late.id&&call.options.top>0),'FOCUS_LAYOUT_QUIESCENCE_DIRECTION_ORACLE: late-layout correction must move forward, never upward');
cases.push({caseId:'FOCUS-LAYOUT-QUIESCENCE-AFTER-LATE-FRAME',result:'PASS',bottomAfterCorrection:lateRect.bottom,viewportHeight:c.innerHeight});calls.length=0;delete c.window.scrollBy;
const forwardAbove=element('forward-above',{top:-220,bottom:-176,left:0,right:300,width:300,height:44});c.ui.focus(forwardAbove);assert.equal(calls.some(x=>x.type==='scroll'),false,'FOCUS_FORWARD_UP_ORACLE: ordinary forward progress must not auto-scroll upward.');cases.push({caseId:'FOCUS-NO-UPWARD-SCROLL-FOR-FORWARD-PROGRESS',result:'PASS'});calls.length=0;
// Use the current production stage owner and authoritative blank-state shape.
const acceptanceRuntime=projectStoreRuntime({storageWorker:false});
// UX-003: acceptance is forward progress, not an operator-requested return.
// The real browser journey separately requires the sticky action to be visible.
for(const [caseId,rect] of [['FOCUS-ACCEPTANCE-VISIBLE',{top:100,bottom:253,width:347,height:153}],['FOCUS-ACCEPTANCE-NO-UPWARD-RETURN',{top:-3412.875,bottom:-3259.875,width:347,height:153}]] ){
 const acceptedNext=element('next-required-action',rect);nodes.set('#next-required-action',acceptedNext);await c.ui.accept({project:acceptanceRuntime.core.createBlankState('FOCUS-ACCEPT-'+caseId),engine:acceptanceRuntime.engine});
 assert.equal(calls.some(call=>call.type==='scroll'||call.type==='residual-scroll'),false,'FOCUS_ACCEPTANCE_DIRECTION_ORACLE: forward acceptance was relabeled as an explicit return.');
 assert.equal(calls.find(call=>call.type==='focus'&&call.id===acceptedNext.id)?.options.preventScroll,true,'FOCUS_ACCEPTANCE_TARGET_ORACLE: the next required action did not receive non-scrolling focus.');
 cases.push({caseId,result:'PASS'});calls.length=0;nodes.delete('#next-required-action');
}
const correction=element('required-correction',{top:-220,bottom:-176,left:0,right:300,width:300,height:44}),details={tagName:'DETAILS',open:false,parentElement:null};correction.parentElement=details;c.ui.focus(correction,{reason:'CORRECTION'});assert.equal(details.open,true,'FOCUS_CLOSED_PARENT_ORACLE: corrective control remains inside a closed disclosure.');assert.equal(calls.find(x=>x.type==='scroll')?.id,correction.id);cases.push({caseId:'FOCUS-EXACT-CORRECTION-CONTROL',result:'PASS'});calls.length=0;
// Retry is an explicit return, not ordinary forward progress. Exercise both
// its authored operation caller and the shared disabled-control continuation.
const retryFailures=[];
try{
 const retryControl=nodes.get('#save-prompt'),oldRect=retryControl.getBoundingClientRect;
 retryControl.getBoundingClientRect=()=>({top:-220,bottom:-176,width:300,height:44});
 let completeRetry;const heldRetry=new Promise(resolve=>completeRetry=resolve);
 const retryOperation=c.ui.run('Retrying',async()=>{c.ui.focus(retryControl,{reason:'RETRY'});await heldRetry;});await paint();completeRetry();await retryOperation;
 assert.ok(calls.some(call=>call.type==='scroll'&&call.id===retryControl.id),'FOCUS_DEFERRED_REASON_ORACLE: explicit retry lost permission to return to its action after unlocking');
 retryControl.getBoundingClientRect=oldRect;cases.push({caseId:'FOCUS-DEFERRED-EXPLICIT-RETRY',result:'PASS'});
}catch(error){retryFailures.push(String(error.stack||error));cases.push({caseId:'FOCUS-DEFERRED-EXPLICIT-RETRY',result:'FAIL'});}calls.length=0;
try{
 const retryRegion=element('next-required-action',{top:-240,bottom:-20,width:300,height:220});nodes.set('#next-required-action',retryRegion);
 await c.ui.retry();
 assert.ok(calls.some(call=>call.type==='scroll'&&call.id===retryRegion.id),'FOCUS_RETRY_CALLER_ORACLE: the authored replacement-attempt operation treated an explicit retry as forward progress');
 cases.push({caseId:'FOCUS-AUTHORED-REPLACEMENT-ATTEMPT',result:'PASS'});
}catch(error){retryFailures.push(String(error.stack||error));cases.push({caseId:'FOCUS-AUTHORED-REPLACEMENT-ATTEMPT',result:'FAIL'});}calls.length=0;
// Error recovery is the next required action, including errors emitted after an
// earlier operation already queued a different target. Actual browser geometry
// remains asserted by verify-browser-extra.mjs; these are controlled phase tests.
for(const mode of ['pending-report','pending-control','standalone-report']){
 const errorNode=nodes.get('#operation-error'),rect={top:100,bottom:180,width:300,height:80};
 const correctionNode=element('error-correction-control',rect);
 const target=mode==='pending-control'?correctionNode:errorNode;
 const originalRect=errorNode.getBoundingClientRect,originalScroll=errorNode.scrollIntoView;
 errorNode.getBoundingClientRect=()=>rect;
 target.scrollIntoView=options=>{calls.push({type:'scroll',id:target.id,options});rect.top=100;rect.bottom=180;};
 nodes.set('#error-correction-control',correctionNode);
 try{
  const error=Object.assign(new Error('Correct the required input.'),mode==='pending-control'?{control:'#error-correction-control'}:{});
  if(mode.startsWith('pending')){
   c.ui.capture(async()=>{rect.top=920;rect.bottom=1000;});
   const action=c.ui.run('Checking input',async()=>{c.ui.focus(nodes.get('#save-prompt'));c.ui.fail(error);});
   await paint();await action;
  }else c.ui.fail(error);
  // An independently scheduled layout phase arrives after initial presentation.
  frames.splice(0).forEach(fn=>fn());await Promise.resolve();rect.top=940;rect.bottom=1020;await paint();
  const focused=calls.filter(call=>call.type==='focus').at(-1);
  assert.equal(focused?.id,target.id,'ERROR_NEXT_ACTION_ORACLE: failure must replace a previously queued forward action with its required recovery target.');
  assert.equal(focused?.options?.preventScroll,true,'ERROR_NATIVE_FOCUS_ORACLE: recovery uses the shared controlled focus policy.');
  assert.ok(rect.top>=0&&rect.bottom<=c.innerHeight,'ERROR_LAYOUT_FINALIZATION_ORACLE: the error recovery target left the viewport after finalization or later layout.');
  assert.equal(errorNode.hidden,false,'ERROR_STATUS_ORACLE: the actionable error is visible independently of tutorial panels.');
  cases.push({caseId:'FOCUS-ERROR-'+mode.toUpperCase(),result:'PASS',bottomAfterSettling:rect.bottom});
 }catch(error){retryFailures.push(String(error.stack||error));cases.push({caseId:'FOCUS-ERROR-'+mode.toUpperCase(),result:'FAIL',error:String(error.stack||error)});}
 finally{c.ui.capture(async()=>{});errorNode.getBoundingClientRect=originalRect;errorNode.scrollIntoView=originalScroll;nodes.delete('#error-correction-control');calls.length=0;}
}
// An authored caller that knows the corrective input must carry that identity
// through the shared reporter, not leave an earlier forward target in control.
const humanRect={top:900,bottom:960,width:300,height:60},human=element('required-human-answer',humanRect);
human.tagName='TEXTAREA';human.dataset={humanAnswer:'REQUIRED-ANSWER'};human.value='';human.type='text';humanFields=[human];
nodes.set('[data-human-answer="REQUIRED-ANSWER"]',human);
human.scrollIntoView=options=>{calls.push({type:'scroll',id:human.id,options});humanRect.top=100;humanRect.bottom=160;};
try{
 const action=c.ui.run('Validating human answers',async()=>{c.ui.focus(nodes.get('#save-prompt'));await c.ui.answers();});await paint();await action;await paint();
 assert.equal(calls.filter(call=>call.type==='focus').at(-1)?.id,human.id,'HUMAN_ANSWER_RECOVERY_TARGET_ORACLE: the actual answer-validation caller lost its corrective input identity.');
 assert.ok(humanRect.bottom<=c.innerHeight);
 cases.push({caseId:'FOCUS-HUMAN-ANSWER-ERROR-CALLER',result:'PASS'});
}catch(error){retryFailures.push(String(error.stack||error));cases.push({caseId:'FOCUS-HUMAN-ANSWER-ERROR-CALLER',result:'FAIL',error:String(error.stack||error)});}
finally{humanFields=[];nodes.delete('[data-human-answer="REQUIRED-ANSWER"]');calls.length=0;}
// Native application results bypass external proposal acceptance. Their own
// committed completion must nevertheless expose the resulting next action,
// after the worker, required persistence, unlocking, and later layout frames.
// State shape comes from the authoritative blank-state builder; runtime and
// storage completion are held here to isolate the production UI authority.
for(const file of ['workbook.js','hash.js','workflow-schema.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
// Stage 30 checkpoint export replaces the backup action with terminal
// calculation. Exercise the authored caller, including both commits and the
// controller's final view checkpoint; settled forward progress must expose
// the new action without moving an already visible action.
async function checkpointPhase(check,message){for(let i=0;i<64&&!check();i++){await paint();await new Promise(resolve=>setImmediate(resolve));}assert.ok(check(),message);}
for(const outcome of ['success-clipped','success-visible','first-commit-failure','second-commit-failure']){
 frames.length=0;calls.length=0;c.ui.announce('Starting checkpoint export');
 const project=c.closedLoopCore.createBlankState('PREDELIVERY-FOCUS-'+outcome);project.activeStage=30;project.revision=7;project.projectSha256='PROJECT-CONTROL';
 const rect=outcome==='success-visible'?{top:500,bottom:677,width:373,height:177}:{top:698.921875,bottom:875.921875,width:373,height:177};
 const next=element('next-required-action',rect);next.tagName='DIV';nodes.set('#next-required-action',next);
 next.scrollIntoView=options=>{calls.push({type:'scroll',id:next.id,options});const distance=Math.max(0,rect.bottom-c.innerHeight);rect.top-=distance;rect.bottom-=distance;};
 c.window.scrollBy=options=>{calls.push({type:'residual-scroll',id:next.id,options});rect.top-=options.top;rect.bottom-=options.top;};
 let releaseExport,releaseFirst,releaseSecond,releaseFinal,commits=0,downloads=0,exports=0,renders=0,finalCaptures=0;
 const exported=new Promise(resolve=>releaseExport=resolve),first=new Promise(resolve=>releaseFirst=resolve),second=new Promise(resolve=>releaseSecond=resolve),final=new Promise(resolve=>releaseFinal=resolve),blob=new Blob(['actual synthetic checkpoint bytes']);
 const fixture={project,store:{async exportPackage(){await exported;return blob;},async metaGet(){return {projectRevision:7,projectSha256:'PROJECT-CONTROL',artifactManifestSha256:'MANIFEST-CONTROL'};},async readProject(){return {revision:7};}},engine:{createPreDeliveryCheckpoint(_project,input){assert.equal(input.projectRevision,7);assert.equal(input.projectSha256,'PROJECT-CONTROL');return {checkpointId:'CHECKPOINT-CONTROL'};},recordId:record=>record.checkpointId,recordCheckpointExportAction(_project,input){assert.equal(input.checkpointId,'CHECKPOINT-CONTROL');exports++;}},async commit(){commits++;await (commits===1?first:second);if(outcome===(commits===1?'first-commit-failure':'second-commit-failure'))throw new Error('Injected pre-delivery commit '+commits+' failure');},download(){downloads++;},async mobile(){},render(){renders++;}};
 try{
  c.ui.capture(async()=>{finalCaptures++;await final;});
  const operation=c.ui.preDelivery(fixture);await paint();
  assert.equal(calls.some(call=>call.type==='focus'&&call.id===next.id),false,'PREDELIVERY_FOCUS_ORDER_ORACLE: placement preceded verified export bytes.');
  releaseExport();await checkpointPhase(()=>commits===1,'PREDELIVERY_PHASE_ORACLE: the checkpoint commit was not reached.');
  assert.equal(calls.some(call=>call.type==='focus'&&call.id===next.id),false,'PREDELIVERY_FOCUS_ORDER_ORACLE: placement preceded the checkpoint commit.');
  releaseFirst();await checkpointPhase(()=>commits===2||finalCaptures===1,'PREDELIVERY_PHASE_ORACLE: neither export-action commit nor failed-operation finalization was reached.');
  assert.equal(calls.some(call=>call.type==='focus'&&call.id===next.id),false,'PREDELIVERY_FOCUS_ORDER_ORACLE: placement preceded the export-action commit.');
  releaseSecond();await checkpointPhase(()=>finalCaptures===1,'PREDELIVERY_PHASE_ORACLE: final durable view capture was not reached.');
  assert.equal(calls.some(call=>call.type==='focus'&&call.id===next.id),false,'PREDELIVERY_FOCUS_ORDER_ORACLE: placement preceded final durable view capture and unlock.');
  releaseFinal();await operation;
  if(outcome.startsWith('success')){
   assert.equal(commits,2);assert.equal(downloads,1);assert.equal(exports,1);assert.equal(renders,1);assert.equal(finalCaptures,1);
   assert.equal(calls.filter(call=>call.type==='focus').at(-1)?.id,next.id,'PREDELIVERY_NEXT_ACTION_ORACLE: successful checkpoint export did not expose terminal calculation.');
   assert.ok(rect.top>=0&&rect.bottom<=c.innerHeight,'PREDELIVERY_NEXT_ACTION_VISIBILITY_ORACLE: terminal calculation remained clipped after checkpoint export.');
   if(outcome==='success-visible')assert.equal(calls.some(call=>['scroll','residual-scroll'].includes(call.type)),false,'PREDELIVERY_VISIBLE_ORACLE: an already visible next action must not move.');
   else{frames.splice(0).forEach(fn=>fn());await Promise.resolve();rect.top=698.921875;rect.bottom=875.921875;await paint();assert.ok(rect.bottom<=c.innerHeight,'PREDELIVERY_SETTLED_LAYOUT_ORACLE: terminal calculation became clipped after later layout.');}
   assert.ok(calls.filter(call=>call.type==='residual-scroll').every(call=>call.options.top>=0),'PREDELIVERY_FORWARD_ORACLE: forward checkpoint completion must not scroll upward.');
  }else{
   assert.equal(commits,outcome==='first-commit-failure'?1:2);assert.equal(downloads,outcome==='first-commit-failure'?0:1);assert.equal(exports,outcome==='first-commit-failure'?0:1);assert.equal(renders,0);
   assert.equal(calls.filter(call=>call.type==='focus').at(-1)?.id,'operation-error','PREDELIVERY_FAILED_COMMIT_ORACLE: a failed commit must expose recovery, not terminal calculation.');
   assert.match(nodes.get('#operation-error').textContent,/Injected pre-delivery commit [12] failure/,'The intended commit boundary must fail, rather than fixture setup.');
  }
  cases.push({caseId:'FOCUS-PREDELIVERY-CHECKPOINT-COMPLETION',outcome,result:'PASS',actualBrowser:false,commits,downloads,exports,renders,finalCaptures});
 }catch(error){retryFailures.push(String(error.stack||error));cases.push({caseId:'FOCUS-PREDELIVERY-CHECKPOINT-COMPLETION',outcome,result:'FAIL',commits,downloads,exports,renders,finalCaptures,error:String(error.stack||error)});}
 finally{releaseExport();releaseFirst();releaseSecond();releaseFinal();c.ui.capture(async()=>{});frames.length=0;calls.length=0;nodes.delete('#next-required-action');delete c.window.scrollBy;}
}
// The held commit receives the real UI command shape. A thrown worker error
// exercises the precommit failure path; completed inconclusive runtime results
// remain persistable under the native storage owner and are not this fault.
for(const stage of [22,24])for(const count of [1,3])for(const outcome of ['success','runtime-failure','commit-failure']){
 frames.length=0;calls.length=0;
 const project=c.closedLoopCore.createBlankState('NATIVE-FOCUS-'+stage+'-'+count+'-'+outcome);project.activeStage=stage;project.job.CURRENT_STAGE='STAGE '+stage;
 const rect={top:920,bottom:1121,width:373,height:201},next=element('next-required-action',rect);next.tagName='DIV';nodes.set('#next-required-action',next);
 next.scrollIntoView=options=>{calls.push({type:'scroll',id:next.id,options});const distance=Math.max(0,rect.bottom-c.innerHeight);rect.top-=distance;rect.bottom-=distance;};
 c.window.scrollBy=options=>{calls.push({type:'residual-scroll',id:next.id,options});rect.top-=options.top;rect.bottom-=options.top;};
 let releaseWorker,releaseCommit,executed=0,commits=0,renders=0,submittedResults=0;
 const worker=new Promise(resolve=>releaseWorker=resolve),commit=new Promise(resolve=>releaseCommit=resolve);
 const items=Array.from({length:count},(_,i)=>({testId:'NATIVE-'+i}));
 const fixture={project,select(selectedStage){assert.equal(selectedStage,stage);return items;},engine:{records:()=>items,recordId:item=>item.testId},inputs:async()=>({artifactPayload:{},canonicalPayload:{},identities:[]}),runtime:{async executeTest(){executed++;await worker;if(outcome==='runtime-failure')throw new Error('Injected runtime failure');return {status:'COMPLETE',determination:'SATISFIED'};}},async commit(_project,options){commits++;const command=options.nativeProductResults;assert.equal(command.stage,stage);assert.deepEqual(Array.from(command.results,row=>row.testId),items.map(item=>item.testId));assert(command.results.every(row=>row.runtimeResult.status==='COMPLETE'&&row.runtimeResult.determination==='SATISFIED'));submittedResults+=command.results.length;await commit;if(outcome==='commit-failure')throw new Error('Injected checkpoint failure');},render(){renders++;}};
 try{
  c.ui.capture(async()=>{});
  const operation=c.ui.native(fixture);await paint();
  assert.equal(calls.some(x=>x.type==='focus'&&x.id===next.id),false,'Native-result placement cannot precede execution.');
  releaseWorker();for(let i=0;i<24;i++)await Promise.resolve();await paint();
  if(outcome!=='runtime-failure')assert.equal(calls.some(x=>x.type==='focus'&&x.id===next.id),false,'Native-result placement cannot precede its required commit.');
  releaseCommit();await operation;
  if(outcome==='success'){
   // Geometry changes after the first post-completion placement frame.
   frames.splice(0).forEach(fn=>fn());await Promise.resolve();rect.top=651.21875;rect.bottom=852.21875;await paint();
   assert.equal(renders,1);assert.equal(commits,1);assert.equal(submittedResults,count);assert.equal(executed,count);
   assert.equal(calls.filter(x=>x.type==='focus').at(-1)?.id,next.id,'NATIVE_RESULT_NEXT_ACTION_ORACLE: committed native results must expose the required next action.');
   assert.ok(rect.top>=0&&rect.bottom<=c.innerHeight,'NATIVE_RESULT_NEXT_ACTION_ORACLE: the next action must remain visible after layout settles.');
   assert.ok(calls.filter(x=>x.type==='residual-scroll').every(x=>x.options.top>=0),'Native-result forward progress cannot move upward.');
  }else{
   await paint();assert.equal(renders,0);assert.equal(calls.filter(x=>x.type==='focus').at(-1)?.id,'operation-error','A failed native operation must expose recovery, not successful next-action feedback.');
   assert.equal(commits,outcome==='runtime-failure'?0:1);
   assert.equal(executed,outcome==='runtime-failure'?1:count,'The failure oracle must reach the intended runtime or commit boundary.');
   assert.equal(submittedResults,outcome==='runtime-failure'?0:count,'No partial runtime command may be submitted after an execution exception.');
   assert.match(nodes.get('#operation-error').textContent,outcome==='runtime-failure'?/Injected runtime failure/:/Injected checkpoint failure/,'The failure must report the injected boundary, not a fixture setup error.');
  }
  cases.push({caseId:'FOCUS-NATIVE-RESULT-COMPLETION',stage,count,outcome,result:'PASS',actualBrowser:false,executed,commits,renders});
 }catch(error){retryFailures.push(String(error.stack||error));cases.push({caseId:'FOCUS-NATIVE-RESULT-COMPLETION',stage,count,outcome,result:'FAIL',error:String(error.stack||error)});}
 finally{releaseWorker();releaseCommit();frames.length=0;calls.length=0;nodes.delete('#next-required-action');delete c.window.scrollBy;}
}
// The deferred target's scroll placement precedes the action's final view
// capture, using the production capture owner. That capture saves the placed
// position, focus still follows unlock, and the capture after a later scroll
// event (preserveView) finds the view unchanged and saves no checkpoint. The
// fixed progress banner, hidden after unlock, cannot change that placement.
async function finished(promise,message){let done=false;promise.then(()=>{done=true;},()=>{done=true;});await checkpointPhase(()=>done,message);return promise;}
for(const variant of ['forward-clipped-next-action','retry-under-progress-banner']){
 frames.length=0;calls.length=0;c.window.scrollY=0;c.ui.announce('Starting final capture placement');
 const banner=variant==='retry-under-progress-banner',status=nodes.get('#app-operation-status'),statusRect=status.getBoundingClientRect,saves=[];
 const rect=banner?{top:30,bottom:74,left:0,right:300,width:300,height:44}:{top:920,bottom:1121,left:10,right:383,width:373,height:201};
 const target=element(banner?'banner-covered-retry':'next-required-action',rect);if(!banner){target.tagName='DIV';nodes.set('#next-required-action',target);}
 target.scrollIntoView=options=>{const distance=rect.bottom>c.innerHeight?rect.bottom-c.innerHeight:Math.min(0,rect.top);calls.push({type:'scroll',id:target.id,options});rect.top-=distance;rect.bottom-=distance;c.window.scrollY+=distance;};
 c.window.scrollBy=options=>{calls.push({type:'residual-scroll',id:target.id,options});rect.top-=options.top;rect.bottom-=options.top;c.window.scrollY+=options.top;};
 const store={async saveCheckpoint(jobId,{view}){saves.push({jobId,scrollY:view.scrollY});calls.push({type:'checkpoint',scrollY:view.scrollY});return 'FINAL-CAPTURE-CHECKPOINT-'+saves.length;},async historyList(jobId){return {jobId,entries:[],sessions:{},redo:[],undoId:null,activeId:'FINAL-CAPTURE-CHECKPOINT-'+saves.length};},async listRecoverableProjects(){return [];},async pendingBackupImportIdentity(){return null;}};
 const project={job:{JOB_ID:'FOCUS-FINAL-CAPTURE-'+variant},revision:5,projectSha256:'FINAL-CAPTURE-PROJECT',historyActivationId:null,activeView:'Workflow',activeStage:9};
 c.history={state:null};const leave=c.ui.viewCapture.enter({project,store});let release=()=>{},actionDone=true;
 try{
  nodes.get('#operation-error').hidden=true;
  if(banner){status.getBoundingClientRect=()=>({top:0,bottom:64,left:0,right:393,width:393,height:64});c.getComputedStyle=node=>({position:node===status?'fixed':'static',top:'0px',visibility:'visible',display:'block'});}
  const held=new Promise(resolve=>release=resolve);
  const action=c.ui.run(banner?'Retrying':'Advancing stage',async()=>{c.ui.focus(target,banner?{reason:'RETRY'}:undefined);await held;});actionDone=false;action.finally(()=>{actionDone=true;});await paint();
  if(banner){
   await new Promise(resolve=>setTimeout(resolve,1550));
   assert.equal(status.hidden,false,'The fixture must show the delayed progress banner during the action.');
   assert.equal(c.ui.contentTop(target),64,'The fixture banner must cover the target while it is visible.');
   assert.equal(c.ui.contentTop(target,{excludeOperationStatus:true}),0);
  }
  assert.equal(calls.some(call=>['scroll','residual-scroll','focus','checkpoint'].includes(call.type)),false,'FINAL_CAPTURE_PLACEMENT_ORACLE: placement, focus or the final capture preceded the end of the operation.');
  release();await finished(action,'FINAL_CAPTURE_PLACEMENT_ORACLE: the action did not finish.');await paint();
  const checkpoint=calls.findIndex(call=>call.type==='checkpoint'),focus=calls.findIndex(call=>call.type==='focus'&&call.id===target.id),moves=calls.filter(call=>['scroll','residual-scroll'].includes(call.type));
  assert.equal(saves.length,1,'The action must save its final view once.');
  assert.ok(checkpoint>=0&&focus>checkpoint,'FINAL_CAPTURE_PLACEMENT_ORACLE: focus must still wait for the final capture and unlock.');
  assert.equal(calls[focus].disabled,false);assert.equal(calls[focus].options?.preventScroll,true,'FOCUS_NATIVE_SCROLL_ORACLE: deferred focus reintroduced implicit scrolling.');
  assert.equal(saves[0].scrollY,String(c.window.scrollY),'FINAL_CAPTURE_PLACEMENT_ORACLE: the final capture did not hold the position the deferred focus left.');
  assert.ok(calls.slice(checkpoint).every(call=>!['scroll','residual-scroll'].includes(call.type)),'FINAL_CAPTURE_PLACEMENT_ORACLE: the page moved after the final capture.');
  if(banner)assert.equal(moves.length,0,'FINAL_CAPTURE_BANNER_ORACLE: the progress banner, hidden after unlock, moved the page for an otherwise visible target.');
  else{assert.ok(moves.length>0&&calls.indexOf(moves[0])<checkpoint,'FINAL_CAPTURE_PLACEMENT_ORACLE: the clipped next action was not placed before the final capture.');assert.ok(rect.top>=0&&rect.bottom<=c.innerHeight,'The placed next action must be visible.');}
  // preserveView's capture after the action's later scroll event.
  await c.ui.viewCapture.capture();
  assert.equal(saves.length,1,'FINAL_CAPTURE_SKIP_ORACLE: a scroll-triggered capture after the action saved the unchanged view again.');
  // Control: a genuine later scroll is still saved, so the skip discriminates.
  c.window.scrollY+=40;await c.ui.viewCapture.capture();
  assert.equal(saves.length,2,'FINAL_CAPTURE_SKIP_ORACLE: a changed scroll position was not saved.');assert.equal(saves[1].scrollY,String(c.window.scrollY));
  cases.push({caseId:'FOCUS-FINAL-CAPTURE-CARRIES-PLACEMENT',variant,result:'PASS',actualBrowser:false,savedScrollY:saves[0].scrollY,moves:moves.length,checkpoints:saves.length});
 }catch(error){retryFailures.push(String(error.stack||error));cases.push({caseId:'FOCUS-FINAL-CAPTURE-CARRIES-PLACEMENT',variant,result:'FAIL',error:String(error.stack||error)});}
 finally{release();for(let i=0;i<64&&!actionDone;i++){await paint();await new Promise(resolve=>setImmediate(resolve));}leave();delete c.history;delete c.getComputedStyle;status.getBoundingClientRect=statusRect;c.window.scrollY=0;frames.length=0;calls.length=0;if(!banner)nodes.delete('#next-required-action');delete c.window.scrollBy;}
}
// A final capture that fails with no confirmed commit saved no view, and its
// failure report replaces the placed target. The pre-capture placement is then
// undone: the page returns to where the operation left it (not the origin) and
// the error report takes focus. Control: after a confirmed commit the
// post-commit warning keeps the placement and the deferred next action.
for(const outcome of ['capture-failure-without-commit','capture-failure-after-commit']){
 const committed=outcome==='capture-failure-after-commit',report=nodes.get('#operation-error'),saves=[];
 frames.length=0;calls.length=0;c.window.scrollX=12;c.window.scrollY=300;c.ui.announce('Starting final capture failure');
 const start={left:c.window.scrollX,top:c.window.scrollY},rect={top:920,bottom:1121,left:10,right:383,width:373,height:201},distance=rect.bottom-c.innerHeight;
 const target=element('next-required-action',rect);target.tagName='DIV';nodes.set('#next-required-action',target);
 target.scrollIntoView=options=>{const move=Math.max(0,rect.bottom-c.innerHeight);calls.push({type:'scroll',id:target.id,options});rect.top-=move;rect.bottom-=move;c.window.scrollY+=move;};
 c.window.scrollBy=options=>{calls.push({type:'residual-scroll',id:target.id,options});rect.top-=options.top;rect.bottom-=options.top;c.window.scrollY+=options.top;};
 c.window.scrollTo=options=>{calls.push({type:'restore-scroll',options:{...options}});const move=options.top-c.window.scrollY;rect.top-=move;rect.bottom-=move;c.window.scrollX=options.left;c.window.scrollY=options.top;};
 const store={async saveCheckpoint(jobId,{view}){saves.push({jobId,scrollX:view.scrollX,scrollY:view.scrollY});calls.push({type:'checkpoint',scrollY:view.scrollY});throw new Error('Injected final view capture failure');},async historyList(jobId){return {jobId,entries:[],sessions:{},redo:[],undoId:null,activeId:null};},async listRecoverableProjects(){return [];},async pendingBackupImportIdentity(){return null;}};
 const project={job:{JOB_ID:'FOCUS-FINAL-CAPTURE-FAILURE-'+outcome},revision:5,projectSha256:'FINAL-CAPTURE-FAILURE-PROJECT',historyActivationId:null,activeView:'Workflow',activeStage:9};
 c.history={state:null};const leave=c.ui.viewCapture.enter({project,store});let release=()=>{},actionDone=true;
 try{
  report.hidden=true;
  const held=new Promise(resolve=>release=resolve);
  const action=c.ui.run('Advancing stage',async()=>{c.ui.focus(target);if(committed)c.ui.viewCapture.commit();await held;});actionDone=false;action.finally(()=>{actionDone=true;});await paint();
  assert.equal(calls.some(call=>['scroll','residual-scroll','restore-scroll','focus','checkpoint'].includes(call.type)),false,'FINAL_CAPTURE_FAILURE_SCROLL_ORACLE: placement, focus or the final capture preceded the end of the operation.');
  release();await finished(action,'FINAL_CAPTURE_FAILURE_SCROLL_ORACLE: the action did not finish.');await paint();
  const checkpoint=calls.findIndex(call=>call.type==='checkpoint'),restores=calls.filter(call=>call.type==='restore-scroll'),focused=calls.filter(call=>call.type==='focus').at(-1);
  assert.equal(saves.length,1,'The action must attempt its final view capture once.');
  assert.ok(checkpoint>0&&calls.slice(0,checkpoint).some(call=>call.type==='scroll'&&call.id===target.id),'The fixture must place the clipped next action before the final capture.');
  assert.equal(saves[0].scrollY,String(start.top+distance),'The failed final capture must have read the placed position.');
  if(committed){
   assert.equal(restores.length,0,'FINAL_CAPTURE_COMMITTED_PLACEMENT_ORACLE: a known commit undid the placement its next action needs.');
   assert.equal(c.window.scrollY,start.top+distance,'FINAL_CAPTURE_COMMITTED_PLACEMENT_ORACLE: a known commit moved the page away from the placed next action.');
   assert.equal(focused?.id,target.id,'FINAL_CAPTURE_COMMITTED_PLACEMENT_ORACLE: a known commit lost its deferred next action.');
   assert.match(report.textContent,/^Project change saved, but the final draft and view could not be saved\./,'The known-commit branch must show the post-commit recovery warning.');
  }else{
   assert.equal(restores.length,1,'FINAL_CAPTURE_FAILURE_SCROLL_ORACLE: a capture that failed without a commit left the page at the unsaved pre-capture placement.');
   assert.deepEqual(restores[0].options,{left:start.left,top:start.top,behavior:'instant'},'FINAL_CAPTURE_FAILURE_SCROLL_ORACLE: the page did not return instantly to the pre-placement position.');
   assert.equal(c.window.scrollX,start.left);assert.equal(c.window.scrollY,start.top,'FINAL_CAPTURE_FAILURE_SCROLL_ORACLE: the page did not return to where the operation left it.');
   assert.ok(calls.indexOf(restores[0])>checkpoint&&calls.indexOf(restores[0])<calls.indexOf(focused),'FINAL_CAPTURE_FAILURE_SCROLL_ORACLE: the restore must follow the failed capture and precede the error focus.');
   assert.ok(calls.slice(calls.indexOf(restores[0])+1).every(call=>!['scroll','residual-scroll'].includes(call.type)),'FINAL_CAPTURE_FAILURE_SCROLL_ORACLE: the page moved again after returning to the pre-placement position.');
   assert.equal(focused?.id,'operation-error','FINAL_CAPTURE_FAILURE_FOCUS_ORACLE: the failed final capture did not focus its error report.');
   assert.equal(focused.disabled,false);assert.equal(focused.options?.preventScroll,true,'FOCUS_NATIVE_SCROLL_ORACLE: error focus reintroduced implicit scrolling.');
   assert.equal(report.hidden,false);assert.equal(report.textContent,'Injected final view capture failure','The intended final capture boundary must fail, rather than fixture setup.');
  }
  cases.push({caseId:'FOCUS-FINAL-CAPTURE-FAILURE-RESTORES-SCROLL',outcome,result:'PASS',actualBrowser:false,startScrollY:start.top,placedScrollY:saves[0].scrollY,endScrollY:c.window.scrollY,restores:restores.length});
 }catch(error){retryFailures.push(String(error.stack||error));cases.push({caseId:'FOCUS-FINAL-CAPTURE-FAILURE-RESTORES-SCROLL',outcome,result:'FAIL',error:String(error.stack||error)});}
 finally{release();for(let i=0;i<64&&!actionDone;i++){await paint();await new Promise(resolve=>setImmediate(resolve));}leave();delete c.history;c.ui.announce('Final capture failure case finished');report.hidden=true;c.window.scrollX=0;c.window.scrollY=0;frames.length=0;calls.length=0;nodes.delete('#next-required-action');delete c.window.scrollBy;delete c.window.scrollTo;}
}
c.ui.fail(new Error('Disposable storage failure'));assert.equal(nodes.get('#operation-error').hidden,false,'OPERATION_ERROR_ORACLE: a failed operation must have a visible report independent of optional tutorial content.');assert.equal(nodes.get('#operation-error').textContent,'Disposable storage failure');assert.equal(nodes.get('#app-live-status').textContent,'Disposable storage failure');c.ui.announce('Retry started');assert.equal(nodes.get('#operation-error').hidden,true);cases.push({caseId:'FOCUS-VISIBLE-FAILURE-AND-RETRY',result:'PASS'});
console.log(JSON.stringify({schema:'closed-loop-focus-observations/1',productionSourceSha256:createHash('sha256').update(source).digest('hex'),synthetic:true,actualBrowser:false,scope:'Production focus and shared operation lifecycle with controlled geometry/frame boundaries. These cases do not establish physical device acceptance or every cross-stage forward-scroll postcondition.',cases},null,2));

if(retryFailures.length)throw new AggregateError(retryFailures,'Explicit retry focus regression failed');
