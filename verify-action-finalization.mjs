import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
const frameQueue=[];const cases=[];
const element=id=>({id,disabled:false,hidden:true,isConnected:true,textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=String(v)},removeAttribute(k){delete this.attrs[k]},focus(){},scrollIntoView(){},classList:{add(){},remove(){},contains(){return false}}});
const nodes=new Map(['app','app-operation-status','operation-label','app-live-status','save-prompt','project-picker','import-project'].map(id=>['#'+id,element(id)]));
const ctx=vm.createContext({console,Event:class{},dispatchEvent(){},addEventListener(){},structuredClone,Blob,URL,TextEncoder,TextDecoder,crypto:globalThis.crypto,setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame:fn=>frameQueue.push(fn),document:{querySelector:s=>nodes.get(s)||null,querySelectorAll:s=>s==='button,input,select,textarea'?[nodes.get('#save-prompt')]:[],currentScript:null,addEventListener(){}}});
for(const name of ['workbook.js','hash.js','workflow-schema.js'])vm.runInContext(fs.readFileSync(name,'utf8'),ctx,{filename:name});
const marker='globalThis.closedLoopAppReady=false;';assert.equal(source.split(marker).length,2,'Unique application-start boundary is required');
vm.runInContext(source.replace(marker,`globalThis.finalization={run:fn=>runOperatorAction('Finalization regression',fn),capture:fn=>{captureCurrentView=fn},failure:()=>reportActionFailure(new Error('Recorded internal failure')),responseFailure:()=>{render=()=>{};reportResponseFailure('Your accepted work is unchanged.',new Error('The follow-up receipt failed'))},changed:()=>{current.projectSha256='CHANGED-PROJECT'},samples:()=>operationLatencyEvidence().samples,select:()=>{current={job:{JOB_ID:'FINALIZATION-FIXTURE'},revision:0,projectSha256:'SOURCE-PROJECT',activeStage:1,historyActivationId:null}}};return;`),ctx,{filename:'app-core.js'});
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
await check('ACTION-INTERNAL-FAILURE',async()=>{ui.capture(async()=>{});const run=ui.run(async()=>ui.failure());await frames();await run;assert.equal(ui.samples().at(-1).outcome,'FAILED','FINALIZATION_OUTCOME_ORACLE: an error handled by the production action was recorded as completed');assert.equal(nodes.get('#save-prompt').disabled,false)});
await check('ACTION-UNCHANGED-FAILURE-CONTROL',async()=>{ui.select();ui.capture(async()=>{});const run=ui.run(async()=>ui.responseFailure());await frames();await run;assert.match(nodes.get('#app-live-status').textContent,/accepted work is unchanged/);assert.equal(ui.samples().at(-1).outcome,'FAILED');});
await check('ACTION-POST-COMMIT-FAILURE',async()=>{ui.select();ui.capture(async()=>{});const run=ui.run(async()=>{ui.changed();ui.responseFailure()});await frames();await run;assert.doesNotMatch(nodes.get('#app-live-status').textContent,/accepted work is unchanged/,'POST_COMMIT_FEEDBACK_ORACLE: prior committed change was falsely reported as rolled back');assert.match(nodes.get('#app-live-status').textContent,/No rollback is claimed/);assert.equal(ui.samples().at(-1).outcome,'FAILED');});
console.log(JSON.stringify({schema:'closed-loop-executed-cases/1',synthetic:true,environment:'Node VM running production application controller with held persistence boundary; not a browser or physical-device observation',cases},null,2));
process.exitCode=cases.some(c=>c.result==='FAIL')?1:0;
