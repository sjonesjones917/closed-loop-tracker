import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),frames=[],calls=[],nodes=new Map(),cases=[];
function element(id,rect={top:120,bottom:164,left:0,right:300,width:300,height:44}){return {id,tagName:'BUTTON',disabled:false,hidden:false,textContent:'',isConnected:true,parentElement:null,attrs:{},className:'',classList:{add(){},remove(){},contains(){return false;}},getBoundingClientRect:()=>rect,focus(options){calls.push({type:'focus',id,options,disabled:this.disabled});},scrollIntoView(options){calls.push({type:'scroll',id,options});},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},removeAttribute(k){delete this.attrs[k];},querySelector(){return null;}};}
for(const id of ['project-picker','new-project','import-project','import-file','app','app-operation-status','operation-label','app-live-status','operation-error','save-prompt'])nodes.set('#'+id,element(id));
nodes.get('#operation-error').tagName='DIV';nodes.get('#operation-error').hidden=true;
const c=vm.createContext({console,URL,URLSearchParams,Blob,TextEncoder,TextDecoder,crypto:globalThis.crypto,structuredClone,setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame:fn=>frames.push(fn),innerHeight:852,innerWidth:393,window:{innerHeight:852,innerWidth:393,scrollX:0,scrollY:0},document:{currentScript:null,querySelector:s=>nodes.get(s)||null,querySelectorAll:()=>[...nodes.values()].filter(x=>x.tagName==='BUTTON'),dispatchEvent(){}}});
vm.runInContext(source.slice(0,source.indexOf('globalThis.closedLoopAppReady=false;'))+`globalThis.ui={focus:focusAfterAction,run:runOperatorAction,fail:reportActionFailure,announce,retry:async()=>{const previous={current,savePromptRecord,render,selectedOperation};current={job:{JOB_ID:'FOCUS-DISPOSABLE'},activeStage:1};savePromptRecord=async()=>{};render=()=>{};selectedOperation=()=> 'COMPLETE';try{await prepareReplacementAttempt();await Promise.resolve();}finally{({current,savePromptRecord,render,selectedOperation}=previous);}}};})();`,c,{filename:'app-core.js'});
async function paint(){for(let i=0;i<3;i++){frames.splice(0).forEach(fn=>fn());await Promise.resolve();}}
const target=element('visible-next-control');c.ui.focus(target);
assert.deepEqual(calls.filter(x=>x.type==='scroll'),[],'FOCUS_VISIBLE_ORACLE: an already visible next action must not scroll.');
assert.equal(calls.at(-1)?.options?.preventScroll,true,'FOCUS_NATIVE_SCROLL_ORACLE: browser-default focus can scroll in the wrong direction.');cases.push({caseId:'FOCUS-VISIBLE-NEXT-CONTROL',result:'PASS'});calls.length=0;
let entered=0,release;const held=new Promise(r=>release=r);const delayed=nodes.get('#save-prompt');
const p=c.ui.run('Saving',async()=>{entered++;c.ui.focus(delayed);await held;});const duplicate=c.ui.run('Saving',()=>{entered++;});await paint();
assert.equal(entered,1);assert.equal(delayed.disabled,true);assert.equal(nodes.get('#app-operation-status').hidden,true,'Sub-threshold work must not display a loading indicator.');assert.equal(calls.some(x=>x.type==='focus'),false,'FOCUS_PENDING_ORACLE: disabled controls must not take focus before resolution.');release();await p;await duplicate;
const focus=calls.find(x=>x.type==='focus'&&x.id===delayed.id);assert.ok(focus,'FOCUS_DEFERRED_ORACLE: the next control was not focused after unlocking.');assert.equal(focus.disabled,false);assert.equal(focus.options?.preventScroll,true,'FOCUS_NATIVE_SCROLL_ORACLE: deferred focus reintroduced implicit scrolling.');assert.equal(calls.some(x=>x.type==='scroll'),false);assert.equal(delayed.disabled,false);cases.push({caseId:'FOCUS-AFTER-UNLOCK-WITHOUT-DUPLICATION',result:'PASS'});calls.length=0;
const below=element('next-field',{top:930,bottom:974,left:0,right:300,width:300,height:44});c.ui.focus(below);assert.equal(calls.filter(x=>x.type==='scroll').length,1);assert.equal(calls.at(-1).options.block,'nearest','FOCUS_DISTANCE_ORACLE: move only enough to expose the next required element.');cases.push({caseId:'FOCUS-NEXT-FIELD-BELOW-VIEWPORT',result:'PASS'});calls.length=0;
// Chromium may round the first nearest scroll down while the CSS box ends
// at a fractional coordinate. The computed residual must still be exposed.
const fractionalRect={top:900,bottom:944,width:300,height:44},fractional=element('fractional-next-action',fractionalRect);
fractional.scrollIntoView=options=>{calls.push({type:'scroll',id:fractional.id,options});fractionalRect.top=808.375;fractionalRect.bottom=852.375;};
c.window.scrollBy=options=>{calls.push({type:'residual-scroll',id:fractional.id,options});fractionalRect.top-=options.top;fractionalRect.bottom-=options.top;};
c.ui.focus(fractional);
assert.ok(fractionalRect.bottom<=c.innerHeight,'FOCUS_FRACTIONAL_EDGE_ORACLE: nearest scrolling left the actual action clipped');
assert.ok(calls.find(call=>call.type==='residual-scroll')?.options.top>0,'Fractional correction must move forward, not upward');
cases.push({caseId:'FOCUS-FRACTIONAL-EDGE',result:'PASS',bottomAfterCorrection:fractionalRect.bottom,viewportHeight:c.innerHeight});calls.length=0;delete c.window.scrollBy;
const forwardAbove=element('forward-above',{top:-220,bottom:-176,left:0,right:300,width:300,height:44});c.ui.focus(forwardAbove);assert.equal(calls.some(x=>x.type==='scroll'),false,'FOCUS_FORWARD_UP_ORACLE: ordinary forward progress must not auto-scroll upward.');cases.push({caseId:'FOCUS-NO-UPWARD-SCROLL-FOR-FORWARD-PROGRESS',result:'PASS'});calls.length=0;
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
c.ui.fail(new Error('Disposable storage failure'));assert.equal(nodes.get('#operation-error').hidden,false,'OPERATION_ERROR_ORACLE: a failed operation must have a visible report independent of optional tutorial content.');assert.equal(nodes.get('#operation-error').textContent,'Disposable storage failure');assert.equal(nodes.get('#app-live-status').textContent,'Disposable storage failure');c.ui.announce('Retry started');assert.equal(nodes.get('#operation-error').hidden,true);cases.push({caseId:'FOCUS-VISIBLE-FAILURE-AND-RETRY',result:'PASS'});
console.log(JSON.stringify({schema:'closed-loop-focus-observations/1',productionSourceSha256:createHash('sha256').update(source).digest('hex'),synthetic:true,actualBrowser:false,scope:'Production focus and shared operation lifecycle with controlled geometry/frame boundaries. These cases do not establish physical device acceptance or every cross-stage forward-scroll postcondition.',cases},null,2));

if(retryFailures.length)throw new AggregateError(retryFailures,'Explicit retry focus regression failed');
