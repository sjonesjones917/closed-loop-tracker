import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createVerifierRuntime} from './verifier-runtime.mjs';
const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
const frameQueue=[];const cases=[];
const element=id=>({id,disabled:false,hidden:true,isConnected:true,textContent:'',diagnosticMarkup:'',insertAdjacentHTML(_position,html){this.diagnosticMarkup+=html;},attrs:{},setAttribute(k,v){this.attrs[k]=String(v)},removeAttribute(k){delete this.attrs[k]},focus(){},scrollIntoView(){},classList:{add(){},remove(){},contains(){return false}}});
const nodes=new Map(['app','app-operation-status','operation-label','app-live-status','operation-error','save-prompt','project-picker','import-project'].map(id=>['#'+id,element(id)]));
const ctx=createVerifierRuntime({console,Event:class{},dispatchEvent(){},addEventListener(){},structuredClone,Blob,URL,TextEncoder,TextDecoder,crypto:globalThis.crypto,setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame:fn=>frameQueue.push(fn),document:{querySelector:s=>nodes.get(s)||null,querySelectorAll:s=>s==='button,input,select,textarea'?[nodes.get('#save-prompt')]:[],currentScript:null,addEventListener(){}}});
for(const name of ['workbook.js','hash.js','workflow-schema.js'])vm.runInContext(fs.readFileSync(name,'utf8'),ctx,{filename:name});
const marker='globalThis.closedLoopAppReady=false;';assert.equal(source.split(marker).length,2,'Unique application-start boundary is required');
vm.runInContext(source.replace(marker,`core=globalThis.closedLoopCore;schema=globalThis.closedLoopWorkflowSchema;globalThis.nativeFinalizationCase=async(kind,phase)=>{
 const previous={current,engine,selectedOperation,nativeProductTests,nativeTestInputs,persistReplacement,render,runtime:globalThis.closedLoopTestRuntime};
 const observations={executions:0,commits:0,renders:0};
 current=core.createBlankState('NATIVE-FINALIZATION-'+kind+'-'+phase);
 current.projectSha256='SOURCE-PROJECT';
 current.activeStage=kind==='deferred'?Number(schema.RECORD_SCHEMAS.failureTests.stage)+1:Number(schema.RECORD_SCHEMAS[kind==='adversarial'?'adversarialResults':'deterministicResults'].stage);
 selectedOperation=()=>kind==='deferred'?'EXECUTE_FAILURE_TEST':schema.NATIVE_PRODUCT_RESULT_CONTRACTS[current.activeStage].operation;
 const test={testId:'FINALIZATION-TEST'};
 engine={records:()=>[test],recordId:row=>row.testId,currentDeferredExecution:()=>({testId:test.testId,subjectId:'FINALIZATION-SUBJECT',bindingSha256:'CONTROLLED-BINDING'}),async executeDeferredNative(){observations.executions++;},recordApplicationNativeProductResult(){}};
 nativeProductTests=()=>[test];nativeTestInputs=async()=>({artifactPayload:{},canonicalPayload:{},identities:[]});
 globalThis.closedLoopTestRuntime={async executeTest(){observations.executions++;return {status:'COMPLETE',determination:'SATISFIED'};}};
 persistReplacement=async next=>{if(phase==='before-commit')throw new Error('Injected storage rejection');if(phase==='unknown-commit')throw Object.assign(new Error('Storage outcome is unconfirmed'),{existingProjectsUnchanged:false});observations.commits++;current=next;current.projectSha256='SAVED-PROJECT';if(kind==='save'&&phase==='after-commit')throw new Error('Injected view refresh failure');return next;};
 render=()=>{observations.renders++;if(phase==='after-commit')throw new Error('Injected view refresh failure');};
 try{await runOperatorAction('Native finalization regression',()=>kind==='save'?save():kind==='deferred'?runNativeDeferredTest():runNativeProductTests(Number(current.activeStage)));return observations;}
 finally{({current,engine,selectedOperation,nativeProductTests,nativeTestInputs,persistReplacement,render}=previous);globalThis.closedLoopTestRuntime=previous.runtime;}
};globalThis.finalization={run:fn=>runOperatorAction('Finalization regression',fn),capture:fn=>{captureCurrentView=fn},failure:()=>reportActionFailure(new Error('Recorded internal failure')),responseFailure:()=>{render=()=>{};reportResponseFailure('Your accepted work is unchanged.',new Error('The follow-up receipt failed'))},changed:()=>{current.projectSha256='CHANGED-PROJECT'},samples:()=>operationLatencyEvidence().samples,select:()=>{current={job:{JOB_ID:'FINALIZATION-FIXTURE'},revision:0,projectSha256:'SOURCE-PROJECT',activeStage:1,historyActivationId:null}}};return;`),ctx,{filename:'app-core.js'});
const ui=ctx.finalization;ui.select();
async function frames(){for(let n=0;n<6;n++){frameQueue.splice(0).forEach(fn=>fn());await Promise.resolve();}}
async function check(caseId,fn){try{await fn();cases.push({caseId,result:'PASS'});}catch(error){cases.push({caseId,result:'FAIL',error:String(error.stack||error)});}}
await check('ACTION-FINALIZATION-VALID',async()=>{let entered=0;ui.capture(async()=>{entered++});const run=ui.run(async()=>{});await frames();await run;assert.equal(entered,1);assert.equal(ui.samples().at(-1).outcome,'COMPLETED');assert.equal(nodes.get('#save-prompt').disabled,false);assert.equal(nodes.get('#app-operation-status').hidden,true)});
await check('ACTION-FINALIZATION-HELD',async()=>{
 let release,entered=0,activations=0;const held=new Promise(resolve=>{release=resolve});ui.capture(async()=>{entered++;await held});
 const count=ui.samples().length;const run=ui.run(async()=>{activations++});await frames();assert.equal(entered,1,'Required checkpoint was not attempted');
 const duplicate=ui.run(async()=>{activations++});await frames();
 await new Promise(resolve=>setTimeout(resolve,1510));await frames();
 // Capture all observations before releasing a deliberately held valid boundary.
 const observed={loading:!nodes.get('#app-operation-status').hidden,disabled:nodes.get('#save-prompt').disabled,partialSamples:ui.samples().length-count,activations};
 release();await Promise.all([run,duplicate]);await frames();
 assert.equal(observed.loading,true,'FINALIZATION_LOADING_ORACLE: a pending required checkpoint has no loading indicator');
 assert.equal(observed.disabled,true);assert.equal(observed.partialSamples,0,'FINALIZATION_LATENCY_ORACLE: completion was recorded before required persistence settled');assert.equal(observed.activations,1);
 assert.ok(ui.samples().at(-1).durationMs>=1500,'FINALIZATION_LATENCY_ORACLE: measured duration omitted final persistence');assert.equal(nodes.get('#save-prompt').disabled,false);assert.equal(nodes.get('#app-operation-status').hidden,true);
});
await check('ACTION-FINALIZATION-FAILURE',async()=>{ui.capture(async()=>{throw new Error('Required view checkpoint failed')});const run=ui.run(async()=>{});await frames();await run;assert.match(nodes.get('#app-live-status').textContent,/Required view checkpoint failed/);assert.equal(ui.samples().at(-1).outcome,'FAILED','FINALIZATION_OUTCOME_ORACLE: failed persistence was recorded as completed');assert.equal(nodes.get('#save-prompt').disabled,false);assert.equal(nodes.get('#app-operation-status').hidden,true)});
await check('ACTION-FAILURE-WHILE-FINALIZATION-HELD',async()=>{
 let release;const held=new Promise(resolve=>{release=resolve});ui.capture(async()=>{await held});
 const run=ui.run(async()=>ui.failure());await frames();
 await new Promise(resolve=>setTimeout(resolve,1510));await frames();
 const observed={message:nodes.get('#app-live-status').textContent,errorHidden:nodes.get('#operation-error').hidden,disabled:nodes.get('#save-prompt').disabled};
 release();await run;await frames();
 assert.match(observed.message,/Recorded internal failure/,'ERROR_FEEDBACK_PENDING_ORACLE: a delayed loading announcement replaced actionable failure feedback.');
 assert.equal(observed.errorHidden,false,'ERROR_FEEDBACK_PENDING_ORACLE: pending checkpoint loading hid the recovery error.');
 assert.equal(observed.disabled,true);assert.equal(ui.samples().at(-1).outcome,'FAILED');
});
await check('ACTION-INTERNAL-FAILURE',async()=>{ui.capture(async()=>{});const run=ui.run(async()=>ui.failure());await frames();await run;assert.equal(ui.samples().at(-1).outcome,'FAILED','FINALIZATION_OUTCOME_ORACLE: an error handled by the production action was recorded as completed');assert.equal(nodes.get('#save-prompt').disabled,false)});
await check('ACTION-UNCHANGED-FAILURE-CONTROL',async()=>{ui.select();ui.capture(async()=>{});const run=ui.run(async()=>ui.responseFailure());await frames();await run;assert.match(nodes.get('#app-live-status').textContent,/accepted work is unchanged/);assert.equal(ui.samples().at(-1).outcome,'FAILED');});
await check('ACTION-POST-COMMIT-FAILURE',async()=>{ui.select();ui.capture(async()=>{});const run=ui.run(async()=>{ui.changed();ui.responseFailure()});await frames();await run;assert.doesNotMatch(nodes.get('#app-live-status').textContent,/accepted work is unchanged/,'POST_COMMIT_FEEDBACK_ORACLE: prior committed change was falsely reported as rolled back');assert.match(nodes.get('#app-live-status').textContent,/No rollback is claimed/);assert.equal(ui.samples().at(-1).outcome,'FAILED');});
await check('ACTION-DIRECT-POST-COMMIT-FAILURE',async()=>{
 ui.select();ui.capture(async()=>{});
 const run=ui.run(async()=>{ui.changed();throw new Error('Scheduled test did not commit: the view could not refresh.');});
 await frames();await run;
 assert.doesNotMatch(nodes.get('#app-live-status').textContent,/did not commit/,'DIRECT_POST_COMMIT_FEEDBACK_ORACLE: a completed state transition was falsely reported as uncommitted.');
 assert.match(nodes.get('#app-live-status').textContent,/saved outcome needs verification/,'DIRECT_POST_COMMIT_FEEDBACK_ORACLE: failure feedback must direct recovery without claiming rollback.');
 assert.equal(ui.samples().at(-1).outcome,'FAILED');assert.equal(nodes.get('#save-prompt').disabled,false);assert.equal(nodes.get('#app-operation-status').hidden,true);
});
for(const kind of ['deferred','product','adversarial','save'])for(const phase of ['before-commit','unknown-commit','after-commit','success'])await check('ACTION-NATIVE-COMMIT-FEEDBACK-'+kind+'-'+phase,async()=>{
 ui.capture(async()=>{});nodes.get('#operation-error').diagnosticMarkup='';const run=ctx.nativeFinalizationCase(kind,phase);await frames();const observed=await run;await frames();
 assert.equal(observed.executions,kind==='save'?0:1,'NATIVE_COMMIT_FEEDBACK_ORACLE: execution repeated.');
 assert.equal(observed.commits,['after-commit','success'].includes(phase)?1:0,'NATIVE_COMMIT_FEEDBACK_ORACLE: unexpected commit boundary.');
 const message=nodes.get('#app-live-status').textContent;
 if(phase==='unknown-commit'||phase==='after-commit'){
  assert.doesNotMatch(message,/did not commit|did not commit any partial result/,'NATIVE_COMMIT_FEEDBACK_ORACLE: a committed or unconfirmed result was reported as uncommitted.');
  assert.match(message,/saved outcome needs verification/,'NATIVE_COMMIT_FEEDBACK_ORACLE: the operator must verify the stored result before retrying.');
  assert.doesNotMatch(nodes.get('#operation-error').diagnosticMarkup,/did not commit|without replacing the prior persisted project state/,'COMMIT_DIAGNOSTIC_ORACLE: technical details cannot claim rollback after a committed or unconfirmed write.');
 }else if(phase==='before-commit')assert.match(message,/Injected storage rejection/,'NATIVE_COMMIT_FEEDBACK_ORACLE: a confirmed rejected commit lost its useful failure explanation.');
 else assert.match(message,/saved|verification complete/,'NATIVE_COMMIT_FEEDBACK_ORACLE: successful execution lacks completion feedback.');
 assert.equal(ui.samples().at(-1).outcome,phase==='success'?'COMPLETED':'FAILED');
 assert.equal(nodes.get('#save-prompt').disabled,false);assert.equal(nodes.get('#app-operation-status').hidden,true);
});
console.log(JSON.stringify({schema:'closed-loop-executed-cases/1',synthetic:true,environment:'Node VM running production application controller with held persistence boundary; not a browser or physical-device observation',cases},null,2));
const failed=cases.filter(c=>c.result==='FAIL');
if(failed.length)throw new AggregateError(failed.map(c=>new Error(c.error)),'Action finalization assertions failed');
