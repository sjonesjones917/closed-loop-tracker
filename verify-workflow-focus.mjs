import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';

const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),frames=[],calls=[],nodes=new Map(),cases=[];let humanFields=[];
function element(id,rect={top:120,bottom:164,left:0,right:300,width:300,height:44}){return {id,tagName:'BUTTON',disabled:false,hidden:false,textContent:'',isConnected:true,parentElement:null,attrs:{},className:'',classList:{add(){},remove(){},contains(){return false;}},getBoundingClientRect:()=>rect,focus(options){calls.push({type:'focus',id,options,disabled:this.disabled});},scrollIntoView(options){calls.push({type:'scroll',id,options});},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},removeAttribute(k){delete this.attrs[k];},querySelector(){return null;}};}
for(const id of ['project-picker','new-project','import-project','import-file','app','app-operation-status','operation-label','app-live-status','operation-error','save-prompt'])nodes.set('#'+id,element(id));
nodes.get('#operation-error').tagName='DIV';nodes.get('#operation-error').hidden=true;
const c=createVerifierRuntime({console,URL,URLSearchParams,Blob,TextEncoder,TextDecoder,crypto:globalThis.crypto,structuredClone,setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame:fn=>frames.push(fn),innerHeight:852,innerWidth:393,window:{innerHeight:852,innerWidth:393,scrollX:0,scrollY:0},CSS:{escape:value=>value},document:{currentScript:null,querySelector:s=>nodes.get(s)||null,querySelectorAll:s=>s==='[data-human-answer]'?humanFields:[...nodes.values()].filter(x=>x.tagName==='BUTTON'),dispatchEvent(){}}});
vm.runInContext(source.slice(0,source.indexOf('globalThis.closedLoopAppReady=false;'))+`globalThis.ui={answers:async()=>{const previous={current,ingestion};current={projectData:{humanInputRequests:[]}};ingestion={answerHumanInput(){throw Object.assign(new Error('Correct the required answer.'),{requestId:'REQUIRED-ANSWER'});}};try{await saveHumanAnswers();}finally{({current,ingestion}=previous);}},capture:fn=>{captureCurrentView=fn;},focus:focusAfterAction,run:runOperatorAction,fail:reportActionFailure,announce,retry:async()=>{const previous={current,savePromptRecord,render,selectedOperation};current={job:{JOB_ID:'FOCUS-DISPOSABLE'},activeStage:1};savePromptRecord=async()=>{};render=()=>{};selectedOperation=()=> 'COMPLETE';try{await prepareReplacementAttempt();await Promise.resolve();}finally{({current,savePromptRecord,render,selectedOperation}=previous);}},accept:async()=>{const previous={current,recordMobileOperation,render,replacementReview};current={job:{JOB_ID:'FOCUS-ACCEPT',CURRENT_STAGE:'STAGE 01'},activeStage:1,activeView:'Workflow',projectData:{generatedPrompts:[]},stages:{1:{gate:{complete:false}}}};recordMobileOperation=async()=>{};render=()=>{};replacementReview={};try{await finishAcceptedProposal({proposalId:'P1',rawResponseId:'R1',stage:1,continuationInstructionId:null});}finally{({current,recordMobileOperation,render,replacementReview}=previous);}}};})();`,c,{filename:'app-core.js'});
async function paint(){for(let i=0;i<3;i++){frames.splice(0).forEach(fn=>fn());await Promise.resolve();}}
const target=element('visible-next-control');c.ui.focus(target);
assert.deepEqual(calls.filter(x=>x.type==='scroll'),[],'FOCUS_VISIBLE_ORACLE: an already visible next action must not scroll.');
assert.equal(calls.at(-1)?.options?.preventScroll,true,'FOCUS_NATIVE_SCROLL_ORACLE: browser-default focus can scroll in the wrong direction.');cases.push({caseId:'FOCUS-VISIBLE-NEXT-CONTROL',result:'PASS'});calls.length=0;
let entered=0,release;const held=new Promise(r=>release=r);const delayed=nodes.get('#save-prompt');
const p=c.ui.run('Saving',async()=>{entered++;c.ui.focus(delayed);await held;});const duplicate=c.ui.run('Saving',()=>{entered++;});await paint();
assert.equal(entered,1);assert.equal(delayed.disabled,true);assert.equal(nodes.get('#app-operation-status').hidden,true,'Sub-threshold work must not display a loading indicator.');assert.equal(calls.some(x=>x.type==='focus'),false,'FOCUS_PENDING_ORACLE: disabled controls must not take focus before resolution.');release();await p;await duplicate;
const focus=calls.find(x=>x.type==='focus'&&x.id===delayed.id);assert.ok(focus,'FOCUS_DEFERRED_ORACLE: the next control was not focused after unlocking.');assert.equal(focus.disabled,false);assert.equal(focus.options?.preventScroll,true,'FOCUS_NATIVE_SCROLL_ORACLE: deferred focus reintroduced implicit scrolling.');assert.equal(calls.some(x=>x.type==='scroll'),false);assert.equal(delayed.disabled,false);cases.push({caseId:'FOCUS-AFTER-UNLOCK-WITHOUT-DUPLICATION',result:'PASS'});calls.length=0;
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
// UX-003: acceptance is forward progress, not an operator-requested return.
// The real browser journey separately requires the sticky action to be visible.
for(const [caseId,rect] of [['FOCUS-ACCEPTANCE-VISIBLE',{top:100,bottom:253,width:347,height:153}],['FOCUS-ACCEPTANCE-NO-UPWARD-RETURN',{top:-3412.875,bottom:-3259.875,width:347,height:153}]] ){
 const acceptedNext=element('next-required-action',rect);nodes.set('#next-required-action',acceptedNext);await c.ui.accept();
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
c.ui.fail(new Error('Disposable storage failure'));assert.equal(nodes.get('#operation-error').hidden,false,'OPERATION_ERROR_ORACLE: a failed operation must have a visible report independent of optional tutorial content.');assert.equal(nodes.get('#operation-error').textContent,'Disposable storage failure');assert.equal(nodes.get('#app-live-status').textContent,'Disposable storage failure');c.ui.announce('Retry started');assert.equal(nodes.get('#operation-error').hidden,true);cases.push({caseId:'FOCUS-VISIBLE-FAILURE-AND-RETRY',result:'PASS'});
console.log(JSON.stringify({schema:'closed-loop-focus-observations/1',productionSourceSha256:createHash('sha256').update(source).digest('hex'),synthetic:true,actualBrowser:false,scope:'Production focus and shared operation lifecycle with controlled geometry/frame boundaries. These cases do not establish physical device acceptance or every cross-stage forward-scroll postcondition.',cases},null,2));

if(retryFailures.length)throw new AggregateError(retryFailures,'Explicit retry focus regression failed');
