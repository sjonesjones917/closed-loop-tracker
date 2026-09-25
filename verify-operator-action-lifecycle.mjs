import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createVerifierRuntime} from './verifier-runtime.mjs';

// Execute the real UI bindings with a deliberately delayed storage boundary.
// The oracle is the operator contract: one action, immediate duplicate lockout,
// delayed progress only past the configured threshold, and usable controls after completion.
let source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
if(process.argv.includes('--fault=obsolete-recovery-control')){
 const before='setControlDisabled(undo,!previous);';
 assert(source.includes(before),'Recovery control fault anchor is missing');
 source=source.replace(before,'undo.disabled=!previous;');
}
if(process.argv.includes('--fault=overlapping-complete-exports')){
 const before='if(operatorActionInFlight)return operatorActionInFlight.promise;';
 assert(source.includes(before),'Complete-export duplicate fault anchor is missing');
 source=source.replace(before,"if(operatorActionInFlight&&label!=='Creating complete backup')return operatorActionInFlight.promise;");
}
if(process.argv.includes('--fault=incorrect-storage-persistence')){
 const before="health.persistent?'Persistent storage available.':'Browser storage available. Keep an exported backup.'";
 assert.equal(source.split(before).length-1,1,'Storage persistence fault anchor is missing');
 source=source.replace(before,"!"+before);
}
const workflowActionCall=source.slice(source.indexOf('function workflow(')).match(/\$\{(nextActionMarkup\([^}]+\))\}/)?.[1];
const cases=[];
// Execute the browser driver's actual activation path. Supplied rectangles
// prove its branch decisions, not real-browser layout. Browser gates retain
// their independent layout/scroll/visibility oracles.
{
 let driver=fs.readFileSync(process.env.OPERATOR_DRIVER_SOURCE||'operator-browser-driver.mjs','utf8');
 if(process.argv.includes('--fault=forced-operator-scroll')){
  const before="if(rect.top<0||rect.left<0||rect.bottom>innerHeight||rect.right>innerWidth)node.scrollIntoView({block:'nearest',inline:'nearest'});";
  assert.equal(driver.split(before).length-1,1,'Operator scroll fault anchor is missing');
  driver=driver.replace(before,"node.scrollIntoView({block:'center'});");
 }
 const start=driver.indexOf('async function click(selector)'),end=driver.indexOf('async function fill(',start);
 assert.ok(start>=0&&end>start,'The actual browser-driver control activation is required.');
 const rect=(top,left=24,width=180,height=44)=>({top,left,width,height,bottom:top+height,right:left+width});
 for(const specimen of [
  {name:'visible centre',box:rect(310),scroll:false},
  {name:'visible at top edge',box:rect(0),scroll:false},
  {name:'visible at bottom edge',box:rect(808),scroll:false},
  {name:'partly above',box:rect(-12),scroll:true},
  {name:'partly below',box:rect(825),scroll:true},
  {name:'partly left',box:rect(310,-8),scroll:true},
  {name:'partly right',box:rect(310,380),scroll:true},
  {name:'inside closed disclosure',box:rect(210),disclosure:true,scroll:false}
 ]){
  const moves=[],events=[];let clicks=0,opened=!specimen.disclosure;
  const disclosure={tagName:'DETAILS',open:false,parentElement:null,querySelector(){return {click(){opened=true;disclosure.open=true;}};}};
  const target={disabled:false,parentElement:specimen.disclosure?disclosure:null,
    getBoundingClientRect(){assert.ok(opened,'Visibility is measured after opening the target disclosure.');return specimen.box;},
    scrollIntoView(options){moves.push({...options});},click(){clicks++;}};
  const dom=createVerifierRuntime({document:{querySelector:()=>target},innerHeight:852,innerWidth:393,getComputedStyle:()=>({visibility:'visible',display:'block'})});
  const click=Function('idle','evaluate','events','performance','assert',driver.slice(start,end)+';return click;')(
    async()=>{},async expression=>vm.runInContext(expression,dom),events,performance,assert);
  await click('#current-action');
  assert.equal(clicks,1,'DRIVER_ACTIVATION_ORACLE: one selected control must be activated exactly once');
  assert.equal(moves.length,specimen.scroll?1:0,'DRIVER_VIEW_PRESERVATION_ORACLE: activating an already visible control must not manufacture a new view: '+specimen.name);
  if(specimen.scroll)assert.deepEqual(moves,[{block:'nearest',inline:'nearest'}],'DRIVER_VIEW_PRESERVATION_ORACLE: a necessary reveal must not recenter the complete view');
  assert.equal(events.length,1,'One actual driver activation must retain one event.');
  cases.push({caseId:'DRIVER-VIEW-PRESERVATION',class:specimen.name,result:'PASS',actualBrowser:false,scrollRequests:moves.length,activations:clicks});
 }
}

function node(id){return {id,disabled:false,hidden:true,textContent:'',isConnected:true,attrs:{},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},getAttribute(k){return this.attrs[k]??null;},focus(){},classList:{contains(){return false;},add(){},remove(){}},querySelector(){return null;}};}
const nodes=new Map(['project-picker','new-project','export-project','header-backup-project','import-project','import-file','save-prompt','app-operation-status','operation-label','app-live-status','app','storage-status','history-undo','project-history'].map(id=>['#'+id,node(id)]));
const frames=[];
const context=createVerifierRuntime({console,Event:class Event{},dispatchEvent(){},structuredClone,URL,Blob,TextDecoder,TextEncoder,crypto:globalThis.crypto,setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame:fn=>frames.push(fn),
  document:{currentScript:null,querySelector:s=>nodes.get(s)||null,querySelectorAll:s=>s.includes('button')||s.includes('input')||s.includes('select')?[...nodes.values()].filter(n=>!['app','app-live-status','app-operation-status','operation-label','storage-status','project-history'].includes(n.id)):[]}});
for(const file of ['workbook.js','hash.js','workflow-schema.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
vm.runInContext(source.slice(0,source.indexOf('globalThis.closedLoopAppReady=false;'))+`
  schema=globalThis.closedLoopWorkflowSchema;projectStore={HISTORY_LIMITS:{maxCheckpoints:2048}};
  globalThis.ui={
    bind:()=>wire(),
    historyAvailable:available=>{historyState={jobId:current.job.JOB_ID,entries:[],sessions:{},redo:[],undoId:available?'PREVIOUS-COMPLETE-VERSION':null};paintHistory();},
    select:stage=>{current={job:{JOB_ID:'DISPOSABLE-UI'},activeStage:stage,revision:0};},
    install:fn=>{addNew=fn;savePromptRecord=fn;render=()=>wire();},
    exports:fn=>{downloadProjectPackage=fn;render=()=>wire();},
    health:fn=>{projectStore={storageHealth:fn};globalThis.closedLoopStorageHealth=null;paintStorageHealth();},
    refreshHealth:()=>refreshStorageHealth(),

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
// The full journey already observed the stored project after exporting the
// request. Reuse that pre-operation observation, never a post-mutation cache.
// This runs the actual verifier control sequence with a bounded driver double;
// production acceptance and browser file transport remain separate gates.
{
 let journey=fs.readFileSync(process.env.OPERATOR_JOURNEY_SOURCE||'verify-complete-operator-journey.mjs','utf8');
 if(process.argv.includes('--fault=repeat-pre-ingestion-read')){
  const before='const before=observedBefore||await saved(),count=before.projectData.acceptedChanges.length';
  assert.equal(journey.split(before).length-1,1,'Pre-ingestion observation fault anchor is missing');
  journey=journey.replace(before,'const before=await saved(),count=before.projectData.acceptedChanges.length');
 }
 if(process.argv.includes('--fault=stale-post-ingestion-state')){
  const before='const after=await saved();assert.equal(after.projectData.acceptedChanges.length,count+1';
  assert.equal(journey.split(before).length-1,1,'Post-ingestion observation fault anchor is missing');
  journey=journey.replace(before,'const after=before;assert.equal(after.projectData.acceptedChanges.length,count+1');
 }
 const start=journey.indexOf('async function ingest('),end=journey.indexOf('async function external(',start);
 assert.ok(start>=0&&end>start,'The actual journey ingestion verifier is required.');
 for(const invalid of [false,true])for(const reuse of [true,false]){
  const request={jobId:invalid?'WRONG-PROJECT':'READ-BOUNDARY',operation:'COMPLETE',attachments:[]};
  const stored={job:{JOB_ID:'READ-BOUNDARY'},revision:4,projectData:{acceptedChanges:[{changeId:'PREVIOUS'}],rawResponses:[],responseValidations:[]}};
  const before=structuredClone(stored),report={operations:[]};let reads=0,selected;
  const saved=async()=>{reads++;return structuredClone(stored);};
  const browser={selectFiles:async(_selector,files)=>{selected=files[0].bytes;},
   click:async selector=>{
    if(selector==='#process-response-file'&&invalid)stored.projectData.responseValidations.push({valid:false});
    if(selector==='#accept-proposal'){stored.projectData.acceptedChanges.push({changeId:'ACCEPTED'});stored.projectData.rawResponses.push({completeRawResponse:selected.toString()});stored.revision++;}
   },exists:async selector=>selector==='#accept-proposal',evaluate:async()=>{throw new Error('Unexpected browser fallback in the valid fixture.');}};
  const ingest=Function('saved','browser','stage','report','assert','digest',journey.slice(start,end)+';return ingest;')(
   saved,browser,1,report,assert,bytes=>context.closedLoopHash.sha256Text(bytes.toString()));
  const observedAfter=await ingest(request,{invalid,...(reuse?{observedBefore:before}:{})});
  if(!invalid)assert.deepEqual(observedAfter,stored,'JOURNEY_POST_OBSERVATION_ORACLE: continuation receives the independently verified post-action project');
  assert.equal(reads,reuse?1:2,'JOURNEY_READ_BOUNDARY_ORACLE: an unchanged pre-operation snapshot must not trigger another complete project read; the post-action observation is always fresh');
  assert.deepEqual(before.projectData.acceptedChanges,[{changeId:'PREVIOUS'}],'Pre-operation observations must remain unchanged.');
  assert.equal(report.operations.length,invalid?0:1,'The actual verifier must still distinguish rejection from committed acceptance.');
  cases.push({caseId:'JOURNEY-READ-BOUNDARY',invalid,reusedPreOperation:reuse,result:'PASS',actualBrowser:false,reads,freshPostActionRead:true});
 }
}

// Run the actual all-stage verifier loop with a bounded operation adapter.
// Only the verifier's observation reuse is under test here: it must consume
// fresh post-action results and discard them across another UI action.
{
 let journey=fs.readFileSync(process.env.OPERATOR_JOURNEY_SOURCE||'verify-complete-operator-journey.mjs','utf8');
 if(process.argv.includes('--fault=repeat-post-ingestion-read')){
  const before='const p=nextObservedProject||await saved(),gate=engine.gate(stage,p)';
  assert.equal(journey.split(before).length-1,1,'Continuation observation fault anchor is missing');
  journey=journey.replace(before,'const p=await saved(),gate=engine.gate(stage,p)');
 }
 const start=journey.indexOf('  for(stage=1;stage<=30;stage++){'),end=journey.indexOf('  for(const selected of ',start);
 assert.ok(start>=0&&end>start,'The complete existing operator loop is required.');
 for(const mode of ['external-observation','external-without-observation','application-command','reload']){
  const report={operations:[],stages:[]},complete=new Set();let selected=1,reads=0,revision=0;
  const state=()=>({activeStage:selected,revision,projectData:{acceptedChanges:[...complete]},stages:Object.fromEntries(Array.from({length:30},(_,i)=>[i+1,{status:complete.has(i+1)?'COMPLETE':'READY'}]))});
  const browser={fill:async(selector,value)=>{if(selector==='#stage-picker')selected=Number(value);},settle:async()=>{},visible:async()=>true,
   inspect:async()=>({synthetic:true}),reload:async()=>{},click:async selector=>{if(selector==='#confirm-stage-one'){complete.add(selected);revision++;}}};
  const saved=async()=>{reads++;return structuredClone(state());};
  const engine={gate:(stage,p)=>({complete:p.stages[stage].status==='COMPLETE',reasons:[]}),
   operationalNextAction:(p,stage)=>({actionType:p.stages[stage].status==='COMPLETE'?'COMPLETE':mode==='application-command'?'CONFIRM_STAGE_ONE_INTENT':'EXTERNAL_AGENT_TOOL'}),
   recordValue:()=>true,recordsForCurrentScope:()=>[{}]};
  const external=async()=>{complete.add(selected);revision++;report.operations.push({stage:selected});return mode==='external-without-observation'?null:structuredClone(state());};
  const run=Function('browser','engine','saved','external','report','assert','inspectPresentation','verifyCompletedStageProjection','preserveReport','captureOperationLatency','schema','console','mode',
   'return (async()=>{let stage=1,sequence=0,reloaded=mode!=="reload";'+journey.slice(start,end)+';return sequence;})();');
  await run(browser,engine,saved,external,report,assert,async()=>{},(p,stage)=>{assert.equal(p.stages[stage].status,'COMPLETE');return {verified:true};},()=>{},async()=>{},{},{log(){}},mode);
  const expected=mode==='external-observation'?30:mode==='reload'?33:60;
  assert.equal(reads,expected,'JOURNEY_CONTINUATION_READ_ORACLE: consume the verified post-operation snapshot only until another state-changing browser action: '+mode);
  assert.equal(report.stages.length,30,'All existing stage iterations must still finish.');
  cases.push({caseId:'JOURNEY-CONTINUATION-READS',mode,result:'PASS',actualBrowser:false,stages:report.stages.length,reads});
 }
}

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
// The complete-export and backup controls share the same pending UI action.
// A second disabled control is not another queued operator request. Once that
// action finishes, a newly activated backup remains a separate valid action.
{
 const exportKinds=[];let releaseExport;
 const held=new Promise(resolve=>releaseExport=resolve);
 context.ui.select(1);context.ui.exports(async kind=>{exportKinds.push(kind);if(kind==='export')await held;});context.ui.bind();
 const first=nodes.get('#export-project').onclick(),duplicate=nodes.get('#header-backup-project').onclick();
 await paint();
 assert.deepEqual(exportKinds,['export'],'UI_EXPORT_DUPLICATE_ORACLE: two in-flight controls must execute one operator action');
 assert.equal(nodes.get('#export-project').disabled,true,'Complete export must remain disabled while it is pending.');
 assert.equal(nodes.get('#header-backup-project').disabled,true,'Backup must remain disabled while complete export owns the action.');
 releaseExport();await Promise.all([first,duplicate]);await paint();
 assert.deepEqual(exportKinds,['export'],'UI_EXPORT_DUPLICATE_ORACLE: a blocked backup must not silently queue after export');
 const second=nodes.get('#header-backup-project').onclick();await paint();await second;await paint();
 assert.deepEqual(exportKinds,['export','backup'],'A new backup action must execute after the earlier export completes.');
 assert.equal(nodes.get('#header-backup-project').disabled,false,'Completed backup must release its control.');
 cases.push({caseId:'UI-COMPLETE-EXPORT-CROSS-CONTROL-DUPLICATE',result:'PASS',simultaneousActivations:2,simultaneousExecutions:1,subsequentBackupExecuted:true});
}
// Execute the browser gate's actual completion predicate against the real
// asynchronous health painter. A copied obsolete label cannot hide until CI.
{
 let browserSource=fs.readFileSync(process.env.BROWSER_EXTRA_SOURCE||'verify-browser-extra.mjs','utf8');
 if(process.argv.includes('--fault=obsolete-storage-health-oracle')){
  const before="document.querySelector('#storage-status').textContent===(closedLoopStorageHealth?.persistent===true?'Persistent storage available.':closedLoopStorageHealth?.persistent===false?'Browser storage available. Keep an exported backup.':null)";
  assert.equal(browserSource.split(before).length-1,1,'Browser completion fault anchor is missing');
  browserSource=browserSource.replace(before,"/^Storage: (persistent|not persistent)/.test(document.querySelector('#storage-status').textContent)");
 }
 const anchor='await waitExpr(cdp,failHealth?',start=browserSource.indexOf(anchor);
 assert.ok(start>=0,'The existing browser health-completion predicate is required.');
 const end=browserSource.indexOf(',30000);',start);
 assert.ok(end>start,'The browser health wait must have its existing finite deadline.');
 const completionFor=Function('failHealth','return ('+browserSource.slice(start+'await waitExpr(cdp,'.length,end)+');');
 for(const persistent of [false,true])for(const failHealth of [false,true]){
  let releaseHealth,calls=0;
  const held=new Promise(resolve=>releaseHealth=resolve),health={persistent,usage:1024,quota:4096};
  context.ui.select(1);context.ui.health(async()=>{calls++;await held;if(failHealth)throw new Error('CONTROLLED_HEALTH_METADATA_FAILURE');return health;});
  const first=context.ui.refreshHealth(),coalesced=context.ui.refreshHealth();
  await paint();assert.equal(calls,1,'STORAGE_HEALTH_COALESCING_ORACLE: pending optional health calls must share one request');
  assert.equal(nodes.get('#storage-status').textContent,'Checking storage.');
  assert.equal(vm.runInContext(completionFor(failHealth),context),false,'STORAGE_HEALTH_BROWSER_ORACLE: unresolved health cannot satisfy the completed observation');
  const exports=[];context.ui.exports(async kind=>exports.push(kind));context.ui.bind();
  const exported=nodes.get('#export-project').onclick();await paint();await exported;await paint();
  const backedUp=nodes.get('#header-backup-project').onclick();await paint();await backedUp;await paint();
  assert.deepEqual(exports,['export','backup'],'Optional diagnostics must not own the completion of independent exports.');
  assert.equal(calls,1,'Exports must not start another pending health request.');
  releaseHealth();await Promise.all([first,coalesced]);await paint();
  const text=nodes.get('#storage-status').textContent;
  assert.equal(vm.runInContext(completionFor(failHealth),context),true,
   'STORAGE_HEALTH_BROWSER_ORACLE: the existing browser completion predicate rejected settled truthful production status: '+JSON.stringify({persistent,failHealth,text}));
  assert.equal(text,failHealth?'Storage status unavailable.':persistent?'Persistent storage available.':'Browser storage available. Keep an exported backup.',
   'STORAGE_HEALTH_TRUTH_ORACLE: a completed optional observation must report its actual persistence result');
  cases.push({caseId:'UI-OPTIONAL-HEALTH-BROWSER-COMPLETION',persistent,failHealth,healthCalls:calls,exports:exports.length,status:text,result:'PASS'});
 }
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
