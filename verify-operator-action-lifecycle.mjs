import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the real UI bindings with a deliberately delayed storage boundary.
// The oracle is the operator contract: one action, visible progress before work,
// no concurrent mutation, and usable controls after success or failure.
const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
const cases=[];
function node(id){return {id,disabled:false,hidden:true,textContent:'',isConnected:true,attrs:{},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},getAttribute(k){return this.attrs[k]??null;},focus(){},classList:{contains(){return false;},add(){},remove(){}},querySelector(){return null;}};}
const nodes=new Map(['project-picker','new-project','export-project','header-backup-project','import-project','import-file','save-prompt','app-operation-status','operation-label','app-live-status','app','storage-status','history-undo','project-history'].map(id=>['#'+id,node(id)]));
const frames=[];
const context=vm.createContext({console,Event:class Event{},dispatchEvent(){},structuredClone,URL,Blob,TextDecoder,TextEncoder,crypto:globalThis.crypto,setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame:fn=>frames.push(fn),
  document:{currentScript:null,querySelector:s=>nodes.get(s)||null,querySelectorAll:s=>s.includes('button')||s.includes('input')||s.includes('select')?[...nodes.values()].filter(n=>!['app','app-live-status','app-operation-status','operation-label','storage-status'].includes(n.id)):[]}});
for(const file of ['workbook.js','hash.js','workflow-schema.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
vm.runInContext(source.slice(0,source.indexOf('globalThis.closedLoopAppReady=false;'))+`
  schema=globalThis.closedLoopWorkflowSchema;
  globalThis.ui={
    bind:()=>wire(),
    select:stage=>{current={job:{JOB_ID:'DISPOSABLE-UI'},activeStage:stage,revision:0};},
    install:fn=>{addNew=fn;savePromptRecord=fn;render=()=>wire();},
    history:available=>{projectStore={HISTORY_LIMITS:{maxCheckpoints:2048}};historyState={entries:[],undoId:available?'SAVED-PREVIOUS':null};historyBrowseState=null;recoveryProjects=[];quarantinedProjects=[];paintHistory();},
    action:fn=>runOperatorAction('Restoring version',fn),
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
for(const initiallyAvailable of [false,true])for(const becomesAvailable of [false,true])for(const failsAfterUpdate of [false,true]){
 context.ui.history(initiallyAvailable);
 let observedWhilePending=false;
 const pending=context.ui.action(async()=>{
  context.ui.history(becomesAvailable);
  observedWhilePending=nodes.get('#history-undo').disabled;
  if(failsAfterUpdate)throw new Error('Injected failure after current History was rendered');
 });
 await paint();await pending;
 assert.equal(observedWhilePending,true,'HISTORY_CONTROL_STATE_ORACLE: a newly available Undo must stay disabled while restoration owns the controls');
 assert.equal(nodes.get('#history-undo').disabled,!becomesAvailable,'HISTORY_CONTROL_STATE_ORACLE: action completion restored obsolete Undo availability');
 assert.equal(nodes.get('#history-undo').hidden,!becomesAvailable,'History visibility must reflect the restored version');
 cases.push({caseId:'UI-HISTORY-CONTROL-STATE',initiallyAvailable,becomesAvailable,failsAfterUpdate,result:'PASS'});
}
console.log(JSON.stringify({schema:'closed-loop-executed-cases/1',synthetic:true,environment:'Node VM with delayed operation and frame boundary',scope:'Shared action binding only; this is not stage-by-stage or file-transport acceptance.',cases},null,2));
