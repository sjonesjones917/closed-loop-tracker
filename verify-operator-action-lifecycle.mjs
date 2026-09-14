import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the real UI bindings with a deliberately delayed storage boundary.
// The oracle is the operator contract: one action, visible progress before work,
// no concurrent mutation, and usable controls after success or failure.
let source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
if(process.argv.includes('--fault=obsolete-recovery-control')){
 const before='setControlDisabled(undo,!previous);';
 assert(source.includes(before),'Recovery control fault anchor is missing');
 source=source.replace(before,'undo.disabled=!previous;');
}
const cases=[];
function node(id){return {id,disabled:false,hidden:true,textContent:'',isConnected:true,attrs:{},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},getAttribute(k){return this.attrs[k]??null;},focus(){},classList:{contains(){return false;},add(){},remove(){}},querySelector(){return null;}};}
const nodes=new Map(['project-picker','new-project','export-project','header-backup-project','import-project','import-file','save-prompt','app-operation-status','operation-label','app-live-status','app','storage-status','project-history','history-undo'].map(id=>['#'+id,node(id)]));
const frames=[];
const context=vm.createContext({console,Event:class Event{},dispatchEvent(){},structuredClone,URL,Blob,TextDecoder,TextEncoder,crypto:globalThis.crypto,setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame:fn=>frames.push(fn),
  document:{currentScript:null,querySelector:s=>nodes.get(s)||null,querySelectorAll:s=>s.includes('button')||s.includes('input')||s.includes('select')?[...nodes.values()].filter(n=>!['app','app-live-status','app-operation-status','operation-label','storage-status','project-history'].includes(n.id)):[]}});
for(const file of ['workbook.js','hash.js','workflow-schema.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
vm.runInContext(source.slice(0,source.indexOf('globalThis.closedLoopAppReady=false;'))+`
  schema=globalThis.closedLoopWorkflowSchema;projectStore={HISTORY_LIMITS:{maxCheckpoints:2048}};
  globalThis.ui={
    bind:()=>wire(),
    historyAvailable:available=>{historyState={jobId:current.job.JOB_ID,entries:[],sessions:{},redo:[],undoId:available?'PREVIOUS-COMPLETE-VERSION':null};paintHistory();},
    select:stage=>{current={job:{JOB_ID:'DISPOSABLE-UI'},activeStage:stage,revision:0};},
    install:fn=>{addNew=fn;savePromptRecord=fn;render=()=>wire();},
  };
})();`,context);
async function paint(){for(let n=0;n<3;n++){const pending=frames.splice(0);pending.forEach(fn=>fn());await Promise.resolve();}}
for(const stage of [1]){
  let entered=0,release;
  const held=new Promise(resolve=>release=resolve);
  context.ui.select(stage);context.ui.install(async()=>{entered++;await held;});context.ui.bind();
  const first=nodes.get('#save-prompt').onclick();
  const duplicate=nodes.get('#save-prompt').onclick();
  await paint();
  assert.equal(entered,1,`Stage ${stage}: repeated click started another operation.`);
  assert.equal(nodes.get('#app-operation-status').hidden,false,`Stage ${stage}: no visible action feedback while waiting.`);
  assert.equal(nodes.get('#save-prompt').disabled,true,`Stage ${stage}: repeated action remains enabled.`);
  release();await Promise.all([first,duplicate]);await paint();
  assert.equal(nodes.get('#save-prompt').disabled,false,`Stage ${stage}: successful completion left controls disabled.`);
  assert.equal(nodes.get('#app-operation-status').hidden,true,`Stage ${stage}: completed action still appears to run.`);
  cases.push({caseId:'UI-SHARED-ACTION-DUPLICATE',fixtureStage:stage,operation:'SAVE_INSTRUCTION',repeatedClicks:2,executions:entered,result:'PASS'});
}
let failures=0;
context.ui.install(async()=>{failures++;throw new Error('Injected storage failure');});
const failed=nodes.get('#save-prompt').onclick();await paint();await failed;
assert.equal(nodes.get('#save-prompt').disabled,false,'Failure left the action disabled.');
assert.match(nodes.get('#app-live-status').textContent,/Injected storage failure/,'Failure was not announced.');
context.ui.install(async()=>{failures++;});
const retry=nodes.get('#save-prompt').onclick();await paint();await retry;
assert.equal(failures,2,'A failed action prevented its corrected retry.');
cases.push({caseId:'UI-ACTION-FAILURE-RETRY',result:'PASS'});
for(const available of [true,false]){
 const undo=nodes.get('#history-undo');undo.disabled=available;
 let release;const held=new Promise(resolve=>release=resolve);
 context.ui.install(async()=>{context.ui.historyAvailable(available);await held;});
 const pending=nodes.get('#save-prompt').onclick();await paint();
 assert.equal(undo.disabled,true,'RECOVERY_CONTROL_ORACLE: History repaint must keep its control disabled while the action is pending');
 release();await pending;await paint();
 assert.equal(undo.disabled,!available,'RECOVERY_CONTROL_ORACLE: completed action restored obsolete Undo availability');
 cases.push({caseId:'UI-RECOVERY-AVAILABILITY-'+available,result:'PASS'});
}
console.log(JSON.stringify({schema:'closed-loop-executed-cases/1',synthetic:true,environment:'Node VM with delayed operation and frame boundary',scope:'Shared action binding only; this is not stage-by-stage or file-transport acceptance.',cases},null,2));
