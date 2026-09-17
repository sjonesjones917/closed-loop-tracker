import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the real UI bindings with a deliberately delayed storage boundary.
// The oracle is the operator contract: one action, immediate duplicate lockout,
// delayed progress only past the configured threshold, and usable controls after completion.
let source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
if(process.argv.includes('--fault=obsolete-recovery-control')){
 const before='setControlDisabled(undo,!previous);';
 assert(source.includes(before),'Recovery control fault anchor is missing');
 source=source.replace(before,'undo.disabled=!previous;');
}
const workflowActionCall=source.slice(source.indexOf('function workflow(')).match(/\$\{(nextActionMarkup\([^}]+\))\}/)?.[1];
const cases=[];
function node(id){return {id,disabled:false,hidden:true,textContent:'',isConnected:true,attrs:{},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},getAttribute(k){return this.attrs[k]??null;},focus(){},classList:{contains(){return false;},add(){},remove(){}},querySelector(){return null;}};}
const nodes=new Map(['project-picker','new-project','export-project','header-backup-project','import-project','import-file','save-prompt','app-operation-status','operation-label','app-live-status','app','storage-status','history-undo','project-history'].map(id=>['#'+id,node(id)]));
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
    history:available=>{projectStore={HISTORY_LIMITS:{maxCheckpoints:2048}};historyState={entries:[],undoId:available?'SAVED-PREVIOUS':null};historyBrowseState=null;recoveryProjects=[];quarantinedProjects=[];paintHistory();},
    action:fn=>runOperatorAction('Restoring version',fn),
    markup:(action,stage=1)=>{
      current={job:{JOB_ID:'DISPOSABLE-UI',CURRENT_STATE:'IN PROGRESS',CURRENT_STAGE:String(stage)},activeStage:stage,stages:{[stage]:{status:'IN PROGRESS'}}};
      displayedStageAction=()=>action;nativeStage22Tests=()=>[{}];selectedOperation=()=> 'COMPLETE';
      stagePlanItems=()=>[{executionMode:'AI_REVIEW',operatorAction:'REVIEW'}];
      const call=${JSON.stringify(workflowActionCall)};
      if(!call)throw new Error('Workflow has no operational action rendering call');
      const markup=Function('nextActionMarkup','displayedStageAction','n','return '+call)(nextActionMarkup,displayedStageAction,stage);
      return {markup,purpose:stagePurposeMarkup(stage)};
    },
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
  assert.equal(nodes.get('#app-operation-status').hidden,true,`Stage ${stage}: sub-threshold action displayed a loading indicator.`);
  assert.equal(nodes.get('#save-prompt').disabled,true,`Stage ${stage}: repeated action remains enabled.`);
  await new Promise(resolve=>setTimeout(resolve,1510));await paint();
  assert.equal(nodes.get('#app-operation-status').hidden,false,`Stage ${stage}: over-threshold action has no visible loading indicator.`);
  assert.equal(nodes.get('#operation-label').textContent,'Working: current action',`Stage ${stage}: loading indicator is not bound to the actual action.`);
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
for(const available of [true,false]){
 const undo=nodes.get('#history-undo');undo.disabled=available;
 let release;const held=new Promise(resolve=>release=resolve);
 context.ui.install(async()=>{context.ui.historyAvailable(available);await held;});
 const pending=nodes.get('#save-prompt').onclick();await paint();
 assert.equal(undo.disabled,true,'HISTORY_CONTROL_STATE_ORACLE: History repaint must keep its control disabled while the action is pending');
 release();await pending;await paint();
 assert.equal(undo.disabled,!available,'HISTORY_CONTROL_STATE_ORACLE: completed action restored obsolete Undo availability');
 cases.push({caseId:'UI-RECOVERY-AVAILABILITY-'+available,result:'PASS'});
}

// Execute the actual workflow's nextActionMarkup invocation, not a re-created
// argument. A false primary flag used to hide every control except confirmation.
// These are DOM-markup ownership checks; viewport geometry is checked by Chrome
// in verify-complete-operator-journey.mjs, not inferred from this VM.
const primaryControls=[
 ['CONTINUE_AGENT_CONVERSATION','Export instruction file','next-export-prompt-file',1],
 ['CONTINUE_AGENT_CONVERSATION','Continue conversation','next-export-prompt-file',1],
 ['AI_REVIEW','Export instruction file','next-export-prompt-file',23],
 ['EXTERNAL_AGENT_TOOL','Export instruction file','next-export-prompt-file',21],
 ['RUN_APP_TESTS','Run automatic tests','run-native-tests',22],
 ['CALCULATE_CONVERGENCE','Calculate convergence','calculate-stage18-convergence',18],
 ['CALCULATE_UNCHANGED_CONFIRMATION','Calculate confirmation','calculate-stage19-confirmation',19],
 ['CALCULATE_RELEASE','Calculate release','calculate-stage27-release',27],
 ['BUILD_EVIDENCE_CHAINS','Build evidence chains','build-evidence-chains',29],
 ['FREEZE_CANDIDATE','Freeze candidate','next-freeze-candidate',10],
 ['FREEZE_DELIVERY_CANDIDATE','Freeze delivery candidate','freeze-delivery-candidate',25],
 ['RESERVE_RUN_BATCH','Reserve ten runs','next-reserve-run-batch',11],
 ['BEGIN_UNCHANGED_CONFIRMATION','Begin unchanged confirmation','next-begin-unchanged-confirmation',19],
 ['FREEZE_BASELINE','Freeze baseline','next-freeze-baseline',20],
 ['REGISTER_PRODUCTION_CONTEXT','Register production context','next-register-production-context',21],
 ['RESERVE_PRODUCT_EXECUTION','Reserve product execution','next-reserve-product-execution',21],
 ['HUMAN_INSPECTION','Record observation','record-human-inspection',22],
 ['CONFIRM_STAGE_ONE_INTENT','Confirm captured intent','confirm-stage-one',1],
 ['CAPTURE_DELIVERY_INTENT','Record delivery intent','capture-delivery-intent',30],
 ['CALCULATE_TERMINAL','Calculate terminal state','calculate-stage30-terminal',30],
 ['EXPORT_PRE_DELIVERY_CHECKPOINT','Export recovery checkpoint','export-pre-delivery-checkpoint',30],
 ['EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','Export authorized files','export-authorized-artifacts',30],
 ['AI_REVIEW','Download verification package','download-execution-package',23],
 ['EXTERNAL_SYSTEM','Download verification package','download-execution-package',22],
];
for(const [actionType,primaryButton,id,stage]of primaryControls){
 const action={actionType,primaryButton,heading:'Perform the current action',explanation:'LONG-EXPLANATION '.repeat(300),operation:'COMPLETE',filesToSend:[],filesToWithhold:[],expectedReturnFiles:[],canonicalStateChanged:true,acceptedChange:'ACCEPTED-1',downstreamInvalidated:[23],newPromptRequired:true};
 const {markup,purpose}=context.ui.markup(action,stage),combined=markup+purpose;
 const occurrences=[...combined.matchAll(/id="([^" ]+)"/g)].map(match=>match[1]);
 assert.equal(occurrences.filter(value=>value===id).length,1,`PRIMARY_ACTION_ORACLE: ${actionType} must own exactly one live primary control ${id}`);
 const regionStart=markup.indexOf('id="next-required-action"'),control=markup.indexOf('id="'+id+'"'),explanation=markup.indexOf('<div class="notice');
 assert.ok(regionStart>=0&&control>regionStart&&control<explanation,`PRIMARY_ACTION_ORACLE: ${actionType} buried the control after unbounded explanation`);
 assert.match(markup.slice(regionStart,control),/Current state:/,'Current state must be adjacent to the primary control');
 assert.match(markup.slice(regionStart,control),/Who acts:/,'Actor must be adjacent to the primary control');
 for(const label of ['Canonical State Changed','Accepted Change','Downstream Invalidated','New Prompt Required'])assert.ok(markup.includes(label),`Required outcome accounting was removed: ${label}`);
 assert.ok(markup.includes('Advanced action details'),'Audit disclosure must be retained');
 cases.push({caseId:'UI-WORKFLOW-PRIMARY-'+actionType,stage,control:id,uniqueControl:true,beforeLongDetails:true,result:'PASS'});
}
console.log(JSON.stringify({schema:'closed-loop-executed-cases/1',synthetic:true,environment:'Node VM with delayed operation and frame boundary',scope:'Shared action binding and production workflow markup ownership; not browser layout or stage-by-stage file-transport acceptance.',cases},null,2));
