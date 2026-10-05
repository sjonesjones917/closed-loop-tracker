import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {deferredDefinitionRestorationFixture} from './test-fixtures.mjs';
import {appMarkup} from './test-app-markup.mjs';
const {createBrowserReadiness}=await import(process.env.OPERATOR_DRIVER_MODULE||'./operator-browser-driver.mjs');

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
// A deliberately blocked startup must let the browser verifier observe the
// destination document before application interactivity. Normal navigation
// still waits for the interactive application boundary.
{
 let loader='L0',interactiveWaits=0;
 const cdp={async send(method){
  if(method==='Page.getFrameTree')return {frameTree:{frame:{loaderId:loader}}};
  if(method==='Page.navigate'){loader=loader==='L0'?'L1':'L2';return {loaderId:loader};}
  throw new Error('Unexpected CDP command '+method);
 }};
 const wait=async(read,description)=>{
  if(description==='The destination document did not arrive'){const value=await read();assert.equal(value,true);return true;}
  if(description==='The application did not become interactive'){interactiveWaits++;return true;}
  throw new Error('Unexpected readiness wait '+description);
 };
 const readiness=createBrowserReadiness(cdp,async()=>true,{timeout:1000,wait});
 await readiness.navigate('Page.navigate',{url:'http://fixture.invalid/'},{waitForInteractive:false});
 assert.equal(interactiveWaits,0,'BLOCKED_STARTUP_NAVIGATION_ORACLE: blocked-startup observation was forced through interactive readiness');
 await readiness.navigate('Page.navigate',{url:'http://fixture.invalid/'});
 assert.equal(interactiveWaits,1,'Normal navigation stopped enforcing application interactivity.');
 cases.push({caseId:'BROWSER-BLOCKED-STARTUP-DOCUMENT-BOUNDARY',result:'PASS'});
}
// Execute the actual shared activation policy with supplied DOM observations.
// This proves decision/dispatch logic; real-browser layout remains mandatory.
{
 let driver=fs.readFileSync(process.env.OPERATOR_DRIVER_SOURCE||'operator-browser-driver.mjs','utf8');
 if(process.argv.includes('--fault=forced-operator-scroll')){
  const before="if(rect.top<0||rect.left<0||rect.bottom>innerHeight||rect.right>innerWidth)node.scrollIntoView({block:'nearest',inline:'nearest'});";
  assert.equal(driver.split(before).length-1,1,'Operator scroll fault anchor is missing');
  driver=driver.replace(before,"node.scrollIntoView({block:'center'});");
 }
 const start=driver.indexOf('async function click(selector)'),end=driver.indexOf('async function fill(',start);
 assert.ok(start>=0&&end>start,'The actual browser-driver control activation is required.');
 const helperStart=driver.indexOf('export async function activateOperatorControl('),helperEnd=driver.indexOf('// This starts its own disposable CI browser.',helperStart);
 const helper=helperStart<0?'':driver.slice(helperStart,helperEnd).replace('export async function','async function');
 const rect=(top,left=24,width=180,height=44)=>({top,left,width,height,bottom:top+height,right:left+width});
 for(const specimen of [
  {name:'visible centre',box:rect(310),scroll:false},
  {name:'visible at top edge',box:rect(0),scroll:false},
  {name:'visible at bottom edge',box:rect(808),scroll:false},
  {name:'pending focus before activation',box:rect(310),frameMotion:true,pendingFocus:true,scroll:true},
  {name:'partly above',box:rect(-12),scroll:true},
  {name:'partly below',box:rect(825),scroll:true},
  {name:'partly left',box:rect(310,-8),scroll:true},
  {name:'partly right',box:rect(310,380),scroll:true},
  {name:'inside closed disclosure',box:rect(210),disclosure:true,scroll:false},
  {name:'closed disclosure summary',box:rect(100),disclosure:true,summaryTarget:true,scroll:false},
  {name:'covered by sticky header',box:rect(70),obscuredUntilReveal:true,scroll:true},
  {name:'sticky header reveal on later frames',box:rect(70),obscuredUntilReveal:true,frameMotion:true,scroll:true},
  {name:'sticky panel covers viewport center',box:rect(70),obscuredUntilReveal:true,centerCovered:true,scroll:true},
  {name:'display none',box:rect(310),display:'none',reject:true},
  {name:'visibility hidden',box:rect(310),visibility:'hidden',reject:true},
  {name:'zero area',box:rect(310,24,0,0),reject:true},
  {name:'obstructed control',box:rect(310),obscured:true,reject:true},
  {name:'disabled control',box:rect(310),disabled:true,reject:true},
  {name:'inert control',box:rect(310),inert:true,reject:true},
  {name:'layout hides revealed control',box:rect(900),hideAfterReveal:true,reject:true}
 ]){
  const moves=[],events=[],inputEvents=[];let clicks=0,directClicks=0,opened=!specimen.disclosure,box={...specimen.box},pendingReveal=false,hidden=false,revealBlock;
  let focusFrames=specimen.pendingFocus?2:0,revealFrames=0,layoutFrames=0;
  const summary={disabled:false,parentElement:null,getBoundingClientRect:()=>rect(100),contains:n=>n===summary,click(){opened=true;disclosure.open=true;directClicks++;}};
  const disclosure={tagName:'DETAILS',open:false,parentElement:null,querySelector(){return summary;}};
  if(specimen.summaryTarget)summary.parentElement=disclosure;
  const control={disabled:Boolean(specimen.disabled),parentElement:specimen.disclosure?disclosure:null,contains:n=>n===control,closest:()=>specimen.inert?{}:null,
   getBoundingClientRect(){assert.ok(opened,'Visibility is measured after opening the target disclosure.');return box;},
   scrollIntoView(options){moves.push({...options});revealBlock=options.block;pendingReveal=true;revealFrames=2;},click(){clicks++;directClicks++;}};
  const target=specimen.summaryTarget?summary:control;
  const currentNode=()=>specimen.summaryTarget||specimen.disclosure&&!disclosure.open?summary:target;
  let covered=Boolean(specimen.obscuredUntilReveal);
  const finishReveal=()=>{box=rect(specimen.centerCovered&&revealBlock==='end'?852-box.height:specimen.obscuredUntilReveal?310:Math.max(0,Math.min(852-box.height,box.top)),Math.max(0,Math.min(393-box.width,box.left)),box.width,box.height);hidden=Boolean(specimen.hideAfterReveal);covered=Boolean(specimen.centerCovered&&revealBlock!=='end');pendingReveal=false;};
  // Interactivity does not settle a prior action's deferred focus or a reveal.
  // These controls move only on later browser frames, just as the native case.
  const animationFrame=callback=>setTimeout(()=>{layoutFrames++;if(focusFrames){focusFrames--;box=rect(focusFrames?900:930,box.left,box.width,box.height);}if(pendingReveal&&--revealFrames===0)finishReveal();callback(performance.now());},0);
  const dom=createVerifierRuntime({document:{querySelector:()=>target,elementFromPoint:()=>specimen.obscured||covered?{}:currentNode()},innerHeight:852,innerWidth:393,scrollX:0,scrollY:0,requestAnimationFrame:animationFrame,getComputedStyle:()=>({visibility:specimen.visibility||'visible',display:hidden?'none':specimen.display||'block',opacity:'1'})});
  const idle=async()=>{if(pendingReveal&&!specimen.frameMotion)finishReveal();};
  const page={send:async(method,params)=>{assert.equal(method,'Input.dispatchMouseEvent','DRIVER_POINTER_AUTHORITY_ORACLE');assert.ok(!focusFrames&&!pendingReveal,'DRIVER_LAYOUT_SETTLEMENT_ORACLE: native activation preceded deferred focus or reveal completion: '+specimen.name);inputEvents.push(params);if(params.type==='mouseReleased'){if(specimen.summaryTarget){disclosure.open=!disclosure.open;opened=disclosure.open;clicks++;}else if(specimen.disclosure&&!disclosure.open){opened=true;disclosure.open=true;}else clicks++;}}};
  const click=Function('idle','evaluate','events','performance','assert','page',helper+driver.slice(start,end)+';return click;')(idle,async expression=>vm.runInContext(expression,dom),events,performance,assert,page);
  let rejection=null;try{await click('#current-action');}catch(error){rejection=error;}
  if(specimen.reject){
   assert.equal(clicks,0,'DRIVER_INTERACTABILITY_ORACLE: hidden or obstructed control was activated: '+specimen.name);
   assert.ok(rejection?.message.startsWith('DRIVER_INTERACTABILITY_ORACLE'),'DRIVER_INTERACTABILITY_ORACLE: rejection must identify the unavailable control: '+specimen.name);
   assert.equal(events.length,0,'DRIVER_INTERACTABILITY_ORACLE: rejected activation was recorded as success');
   assert.equal(inputEvents.length,0,'DRIVER_INTERACTABILITY_ORACLE: rejected activation sent input');
  }else{
   if(specimen.centerCovered)assert.equal(rejection,null,'DRIVER_STICKY_REVEAL_ORACLE: a sticky panel covering the viewport center must allow an ordinary reveal below it');
   if(rejection)throw rejection;
   if(specimen.summaryTarget){assert.equal(clicks,1,'DRIVER_SUMMARY_TOGGLE_ORACLE: the requested summary must toggle exactly once');assert.equal(disclosure.open,true,'DRIVER_SUMMARY_TOGGLE_ORACLE: the requested opening was immediately reversed');}
   assert.equal(clicks,1,'DRIVER_ACTIVATION_ORACLE: one selected control must be activated exactly once');
   assert.equal(directClicks,0,'DRIVER_POINTER_AUTHORITY_ORACLE: a DOM click is not native operator input');
   assert.equal(inputEvents.length,specimen.disclosure&&!specimen.summaryTarget?4:2,'DRIVER_POINTER_AUTHORITY_ORACLE: each activation needs one press/release pair');
   for(let index=0;index<inputEvents.length;index+=2){assert.equal(inputEvents[index].type,'mousePressed');assert.equal(inputEvents[index+1].type,'mouseReleased');assert.equal(inputEvents[index].x,inputEvents[index+1].x);assert.equal(inputEvents[index].y,inputEvents[index+1].y);}
   assert.equal(moves.length,specimen.centerCovered?2:specimen.scroll?1:0,'DRIVER_VIEW_PRESERVATION_ORACLE: activating an already visible control must not manufacture a new view: '+specimen.name);
   if(specimen.centerCovered)assert.deepEqual(moves,[{block:'center',inline:'nearest',behavior:'instant'},{block:'end',inline:'nearest',behavior:'instant'}],'DRIVER_STICKY_REVEAL_ORACLE: the native hit must follow bounded ordinary viewport reveals');
   if(specimen.scroll&&!specimen.obscuredUntilReveal)assert.deepEqual(moves,[{block:'nearest',inline:'nearest'}],'DRIVER_VIEW_PRESERVATION_ORACLE: an ordinary viewport reveal must not recenter the complete view');
   assert.equal(events.length,1,'One actual driver activation must retain one event.');
  }
  cases.push({caseId:'DRIVER-VIEW-PRESERVATION',class:specimen.name,result:'PASS',actualBrowser:false,scrollRequests:moves.length,layoutFrames,activations:clicks,nativeInputEvents:inputEvents.length,rejection:rejection?.message||null});
 }
}

// Run each existing caller's function with a controlled shared-policy boundary.
// A copied DOM-click implementation cannot satisfy this caller contract.
for(const file of ['verify-browser.mjs','verify-browser-extra.mjs','verify-mobile-stage-action.mjs']){
 const source=fs.readFileSync(file,'utf8'),start=source.indexOf('async function click(cdp,'),end=source.indexOf('\nasync function ',start+5);
 assert.ok(start>=0&&end>start,'DRIVER_CONSUMER_ORACLE: missing caller '+file);
 const invocations=[],cdp={fixture:file};
 const policy=async(channel,evaluate,idle,selector)=>{assert.equal(channel,cdp);await idle();assert.equal(await evaluate('CONTROLLED_QUERY'),'CONTROLLED_RESULT');invocations.push(selector);};
 const evaluate=async(channel,expression)=>{assert.equal(channel,cdp);return expression==='CONTROLLED_QUERY'?'CONTROLLED_RESULT':true;};
 const click=Function('activateOperatorControl','evalValue','evaluate','waitForIdle','assert',source.slice(start,end)+';return click;')(policy,evaluate,evaluate,async()=>{},assert);
 await click(cdp,'#controlled-target');
 assert.deepEqual(invocations,['#controlled-target'],'DRIVER_CONSUMER_ORACLE: '+file+' must use the shared observed pointer activation');
 cases.push({caseId:'DRIVER-CONSUMER-AUTHORITY',consumer:file,result:'PASS',actualBrowser:false});
}

if(process.argv.includes('--driver-activation-only')){console.log(JSON.stringify({operatorActivation:'PASS',cases,actualBrowser:false}));process.exit(0);}

function node(id){return {id,disabled:false,hidden:true,textContent:'',isConnected:true,attrs:{},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},getAttribute(k){return this.attrs[k]??null;},focus(){},classList:{contains(){return false;},add(){},remove(){}},querySelector(){return null;}};}
const nodes=new Map(['project-picker','new-project','export-project','header-backup-project','import-project','import-file','save-prompt','app-operation-status','operation-label','app-live-status','app','storage-status','history-undo','project-history'].map(id=>['#'+id,node(id)]));
const frames=[];
const context=createVerifierRuntime({console,Event:class Event{},dispatchEvent(){},structuredClone,URL,Blob,TextDecoder,TextEncoder,crypto:globalThis.crypto,setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame:fn=>frames.push(fn),
  document:{currentScript:null,querySelector:s=>nodes.get(s)||null,querySelectorAll:s=>s.includes('button')||s.includes('input')||s.includes('select')?[...nodes.values()].filter(n=>!['app','app-live-status','app-operation-status','operation-label','storage-status','project-history'].includes(n.id)):[]}});
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
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
  const before='const observation=await saved({workflow:true}),after=observation.project;';
  assert.equal(journey.split(before).length-1,1,'Post-ingestion observation fault anchor is missing');
  journey=journey.replace(before,'const observation={project:before,workflow:[]},after=observation.project;');
 }
 const start=journey.indexOf('async function ingest('),end=journey.indexOf('async function external(',start);
 assert.ok(start>=0&&end>start,'The actual journey ingestion verifier is required.');
 for(const invalid of [false,true])for(const reuse of [true,false]){
  const request={jobId:invalid?'WRONG-PROJECT':'READ-BOUNDARY',operation:'COMPLETE',attachments:[]};
  const stored={job:{JOB_ID:'READ-BOUNDARY'},revision:4,projectData:{acceptedChanges:[{changeId:'PREVIOUS'}],rawResponses:[],responseValidations:[]}};
  const before=structuredClone(stored),report={operations:[]};let reads=0,selected;
  const saved=async({workflow=false}={})=>{reads++;const project=structuredClone(stored);return workflow?{project,workflow:[{stage:1,revision:project.revision}]}:project;};
  const browser={selectFiles:async(_selector,files)=>{selected=files[0].bytes;},
   click:async selector=>{
    if(selector==='#process-response-file'&&invalid)stored.projectData.responseValidations.push({valid:false});
    if(selector==='#accept-proposal'){stored.projectData.acceptedChanges.push({changeId:'ACCEPTED'});stored.projectData.rawResponses.push({completeRawResponse:selected.toString()});stored.revision++;}
   },exists:async selector=>selector==='#accept-proposal',evaluate:async()=>({validation:'Controlled failed acceptance',operation:'Controlled diagnostic'})};
  const ingest=Function('saved','browser','stage','report','assert','digest','preserveReport',journey.slice(start,end)+';return ingest;')(
   saved,browser,1,report,assert,bytes=>context.closedLoopHash.sha256Text(bytes.toString()),()=>{});
  const observedAfter=await ingest(request,{invalid,...(reuse?{observedBefore:before}:{})});
  if(!invalid){assert.deepEqual(observedAfter.project,stored,'JOURNEY_POST_OBSERVATION_ORACLE: continuation receives the independently verified post-action project');assert.equal(observedAfter.workflow[0].revision,stored.revision,'JOURNEY_POST_OBSERVATION_ORACLE: decisions belong to the same post-action version');}
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
  const before='const observed=nextObservedWorkflow||await saved({workflow:true})';
  assert.equal(journey.split(before).length-1,1,'Continuation observation fault anchor is missing');
  journey=journey.replace(before,'const observed=await saved({workflow:true})');
 }
 if(process.argv.includes('--fault=detached-workflow-decision')){
  const before='p=observed.project,{gate,action}=observed.workflow[0]';
  assert.equal(journey.split(before).length-1,1,'Workflow runtime fault anchor is missing');
  journey=journey.replace(before,'p=observed.project,gate=engine.gate(stage,p),action=engine.operationalNextAction(p,stage)');
 }
 const start=journey.indexOf('  for(stage=1;stage<=30;stage++){'),end=journey.indexOf('  for(const selected of ',start);
 assert.ok(start>=0&&end>start,'The complete existing operator loop is required.');
 for(const mode of ['external-observation','external-without-observation','application-command','reload']){
  const report={operations:[],stages:[]},complete=new Set();let selected=1,reads=0,revision=0;
  const state=()=>({activeStage:selected,revision,projectData:{acceptedChanges:[...complete]},stages:Object.fromEntries(Array.from({length:30},(_,i)=>[i+1,{status:complete.has(i+1)?'COMPLETE':'READY'}]))});
  const browser={fill:async(selector,value)=>{if(selector==='#stage-picker')selected=Number(value);},settle:async()=>{},visible:async()=>true,
   inspect:async()=>({synthetic:true}),reload:async()=>{},click:async selector=>{if(selector==='#confirm-stage-one'){complete.add(selected);revision++;}}};
  const owner={gate:(stage,p)=>({complete:p.stages[stage].status==='COMPLETE',reasons:[]}),
   operationalNextAction:(p,stage)=>({actionType:p.stages[stage].status==='COMPLETE'?'COMPLETE':mode==='application-command'?'CONFIRM_STAGE_ONE_INTENT':'EXTERNAL_AGENT_TOOL'}),
   recordValue:()=>true,recordsForCurrentScope:()=>[{}]};
  const detachedDecision=()=>assert.fail('JOURNEY_RUNTIME_AUTHORITY_ORACLE: JSON alone cannot re-establish the observed application workflow or artifact custody.');
  const engine={...owner,gate:detachedDecision,operationalNextAction:detachedDecision};
  const observation=()=>{const project=structuredClone(state());return {project,workflow:[{stage:selected,gate:owner.gate(selected,project),action:owner.operationalNextAction(project,selected)}]};};
  const saved=async({workflow=false}={})=>{reads++;return workflow?observation():structuredClone(state());};
  const external=async()=>{complete.add(selected);revision++;report.operations.push({stage:selected});return mode==='external-without-observation'?null:observation();};
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
// Execute the actual final backup/restore sequence with fixed, small bytes.
// Export once, import those bytes through the control, then observe fresh saved
// state. A second whole-History export is not a read and adds no acceptance proof.
{
 const journey=fs.readFileSync(process.env.OPERATOR_JOURNEY_SOURCE||'verify-complete-operator-journey.mjs','utf8');
 const functionStart=journey.indexOf('async function verifyFinalBackupRoundTrip(');
 const start=functionStart>=0?functionStart:journey.indexOf('  const before=await saved({backup:true}),backup=snapshot.file;');
 const end=functionStart>=0?journey.indexOf('\nasync function ingest(',start):journey.indexOf('  await captureOperationLatency();assert.equal(report.operationLatency.thresholdMs',start);
 assert.ok(start>=0&&end>start,'The actual final backup round trip must be executable.');
 const sequence=journey.slice(start,end)+(functionStart>=0?'\nawait verifyFinalBackupRoundTrip();':'');
 const bytes=Buffer.from('fixed exported backup bytes'),snapshot={file:{bytes,sha256:'verified-backup-digest'}},report={},phases=[];
 const project={job:{JOB_ID:'ROUNDTRIP'},projectData:{acceptedChanges:[{changeId:'accepted'}]},stages:Object.fromEntries(Array.from({length:30},(_,i)=>[i+1,{status:'COMPLETE'}]))};
 let exported=0,imported=false,reads=0,bounded=false;
 const workflow=Object.keys(project.stages).map(stage=>({stage:Number(stage),gate:{complete:true},action:{actionType:'COMPLETE'}}));
 const saved=async({backup=false,workflow:includeWorkflow=false,stages=[]}={})=>{if(backup){assert.equal(bounded,true,'FINAL_BACKUP_FIXTURE_BOUND_ORACLE: accumulated journey views must not become the final browser backup workload');exported++;}else{assert.equal(imported,true,'Restore observation must follow the import control');reads++;}if(includeWorkflow)assert.deepEqual(stages,workflow.map(row=>row.stage));return includeWorkflow?{project:structuredClone(project),workflow:structuredClone(workflow)}:structuredClone(project);};
 const browser={readProject:async()=>structuredClone(project),selectFiles:async(selector,files)=>{assert.equal(selector,'#import-file');assert.deepEqual(files[0].bytes,bytes,'BACKUP_INPUT_BYTES_ORACLE: restore must select the actual exported bytes');imported=true;}};
 const boundStage30BrowserRecovery=async current=>{assert.deepEqual(current,project,'Bounding the browser history must use the actual completed project, preserving every stage.');bounded=true;};
 await Function('saved','browser','snapshot','report','assert','schema','preserveReport','stage','sequence','boundStage30BrowserRecovery','return (async()=>{'+sequence+'})();')(saved,browser,snapshot,report,assert,{STAGE_COUNT:30},()=>phases.push(report.currentOperation?.phase),31,133,boundStage30BrowserRecovery);
 assert.equal(exported,1,'FINAL_BACKUP_OBSERVATION_ORACLE: restored state must be read without exporting the complete history again');
 assert.equal(reads,1,'FINAL_BACKUP_OBSERVATION_ORACLE: verify a fresh post-import stored project');
 assert.deepEqual(report.backupRestore,{selectedSha256:snapshot.file.sha256,stagesPreserved:30,workflow});
 assert.deepEqual(phases,['FINAL_BACKUP_FIXTURE','FINAL_BACKUP_EXPORT','FINAL_BACKUP_IMPORT','FINAL_BACKUP_VERIFY'],'FINAL_BACKUP_PHASE_ORACLE: an interruption must identify the actual final operation');
 cases.push({caseId:'FINAL-BACKUP-OBSERVATION',result:'PASS',actualBrowser:false,exports:exported,freshReads:reads,phases});
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
// Conditional independent review is selected by the production route owner,
// even though the registered operation has the generic execution name. Use the
// admitted archived fixture at its declared clock; these are presentation
// assertions, not fresh external review or predecessor-stage acceptance.
{
 const r=projectStoreRuntime(),fixture=await deferredDefinitionRestorationFixture(r,{family:'failureTests',executionStage:8}),p=fixture.p;
 const policy=r.prompts.deferredExecutionContextPolicy(p,8,'EXECUTE_FAILURE_TEST');
 assert.equal(policy.executionMode,'INDEPENDENT_AGENT_REVIEW','INDEPENDENT_REVIEW_GUIDANCE_FIXTURE_ORACLE');
 assert.equal(policy.requiresFreshConversation,true);assert.equal(policy.priorExportMayHaveExposedReviewContent,false);
 const html=appMarkup(r.runtime,p,{source,operations:{8:'EXECUTE_FAILURE_TEST'}}),start=html.indexOf('id="next-required-action"'),notice=html.indexOf('id="independent-review-context-guidance"'),button=html.indexOf('id="next-export-prompt-file"');
 assert.ok(start>=0&&notice>start&&button>notice,'INDEPENDENT_REVIEW_GUIDANCE_ORACLE: the selected conditional reviewer needs recovery guidance before the primary export control.');
 const warning=html.slice(notice,button);
 assert.match(warning,/Start a fresh independent reviewer conversation/,'INDEPENDENT_REVIEW_GUIDANCE_ORACLE');
 assert.match(warning,/has not received prior verifier conclusions, proposed corrections, or rejected response content/,'INDEPENDENT_REVIEW_GUIDANCE_ORACLE');
 assert.match(warning,/Prior responses and valid work remain in project History/,'INDEPENDENT_REVIEW_GUIDANCE_ORACLE');
 assert.doesNotMatch(warning,/earlier exported package may have included/,'INDEPENDENT_REVIEW_UNEXPORTED_GUIDANCE_ORACLE');
 const ordinary=appMarkup(r.runtime,p,{source,operations:{8:'COMPLETE'}});
 assert.doesNotMatch(ordinary,/id="independent-review-context-guidance"/,'INDEPENDENT_REVIEW_ORDINARY_CONTROL_ORACLE');
 cases.push({caseId:'UI-CONDITIONAL-INDEPENDENT-REVIEW-GUIDANCE',stage:8,operation:'EXECUTE_FAILURE_TEST',actualSelectedMode:policy.executionMode,freshConversationVisibleBeforeExport:true,unexportedExposureNeverClaimed:true,ordinaryAuthorControl:true,archivedFixtureClockUtc:fixture.archivedFixtureClockUtc,synthetic:true,actualBrowser:false,result:'PASS'});
}
// Replay the browser gate's actual selected-file setup through the production
// binding, filename policy, recovery artifact custody and import owner. The
// transport below is synthetic; layout and native worker delivery stay in CI.
{
 const browserSource=fs.readFileSync(process.env.BROWSER_EXTRA_SOURCE||'verify-browser-extra.mjs','utf8');
 const marker="console.log('extra:delayed-import-activity-preserves-layout');",start=browserSource.indexOf(marker),end=browserSource.indexOf("console.log('extra:native-worker-owned-inputs');",start);
 assert.ok(start>=0&&end>start,'The actual delayed-import browser case is required.');
 const setup=browserSource.slice(start,end).match(/await evalValue\(cdp,`([\s\S]*?)`\);/)?.[1];
 assert.ok(setup,'The delayed-import browser setup expression is required.');
 const observe=browserSource.slice(start,end).match(/const activityProof=await evalValue\(cdp,`([\s\S]*?)`\);/)?.[1];
 assert.ok(observe,'The actual delayed-import browser observation is required.');
 const r=projectStoreRuntime(),p=await r.store.writeProject(r.core.createBlankState('STARTUP-BROWSER-0'),{expectedProjectRevision:0,createOnly:true});
 const activityNodes=new Map(['app','app-operation-status','operation-label','app-live-status','operation-error','storage-status','import-file','project-picker','import-project'].map(id=>['#'+id,{...node(id),value:'',hasAttribute(key){return key in this.attrs;},getBoundingClientRect(){return {top:0,bottom:24,left:0,right:180,width:180,height:24};}}]));
 const delivered=[],requests=[],pending=new Map();let sequence=0,selected;
 class Worker{
  postMessage(message){requests.push(message);this.onmessage({data:{operationId:'UNRELATED',buildIdentity:message.buildIdentity,ok:true}});void r.store.importPackage(message.args[0]).then(project=>this.onmessage({data:{...message,ok:true,project}}),error=>this.onmessage({data:{...message,ok:false,error}}));}
 }
 const worker=new Worker();worker.onmessage=event=>{delivered.push(event.data);const request=pending.get(event.data.operationId);if(!request)return;pending.delete(event.data.operationId);event.data.ok?request.resolve(event.data.project):request.reject(event.data.error);};
 class DataTransfer{constructor(){this.files=[];this.items={add:file=>{assert.ok(file instanceof File,'DELAYED_IMPORT_VALID_SELECTION_ORACLE: a browser file selection requires a File.');this.files.push(file);}};}}
 const facade={...r.store,importPackage:async blob=>{selected=(await r.store.listArtifacts(p.job.JOB_ID)).find(row=>row.lineage?.selectionKind==='backup-import');return new Promise((resolve,reject)=>{const operationId='IMPORT-'+(++sequence);pending.set(operationId,{resolve,reject});worker.postMessage({method:'IMPORT_PACKAGE',operationId,buildIdentity:'ACTIVITY-TEST',args:[blob]});});}};
 Object.assign(r.runtime,{File,DataTransfer,Worker,history:{state:null},document:{currentScript:null,querySelector:s=>activityNodes.get(s)||null,querySelectorAll:s=>s==='button,input,select,textarea'?[activityNodes.get('#import-file')]:[]},getComputedStyle:()=>({display:'block',visibility:'visible'}),requestAnimationFrame:fn=>setTimeout(fn,0),scrollX:0,scrollY:0,scrollTo(){},closedLoopProjectStore:facade,__activityProject:p});r.runtime.window=r.runtime;
 vm.runInContext(source.slice(0,source.indexOf('globalThis.closedLoopAppReady=false;'))+`
  core=closedLoopCore;schema=closedLoopWorkflowSchema;engine=closedLoopWorkflowEngine;projectStore=closedLoopProjectStore;current=__activityProject;projects=[current];
  captureCurrentView=async()=>{};refreshHistory=async()=>{historyState=await projectStore.historyList(current.job.JOB_ID);};writeBrowserEntry=()=>{};loadAcceptanceSession=async()=>{};refreshProjectStorage=async()=>{};recordCommittedBoundary=async()=>{};render=()=>wire();wire();
 })();`,r.runtime,{filename:'app-core.js:delayed-import-control'});
 try{
  await vm.runInContext(setup,r.runtime);
  for(let i=0;i<200&&typeof r.runtime.__releaseActivityReply!=='function'&&!r.runtime.__activityDone;i++)await new Promise(resolve=>setTimeout(resolve,5));
  const observation={requests:requests.length,held:typeof r.runtime.__releaseActivityReply==='function',done:r.runtime.__activityDone,notice:activityNodes.get('#app-live-status').textContent};
  if(requests.length)assert.ok(delivered.length===1&&delivered[0].operationId==='UNRELATED','DELAYED_IMPORT_CORRELATION_ORACLE: the delay must hold the selected import response and pass unrelated replies through.');
  assert.ok(observation.requests===1&&observation.held&&!observation.done,'DELAYED_IMPORT_VALID_SELECTION_ORACLE: the browser loading case must reach one valid pending import through its actual file binding: '+JSON.stringify(observation));
  assert.ok(selected&&selected.filename&&selected.byteSize===r.runtime.__activityPackage.size,'DELAYED_IMPORT_VALID_SELECTION_ORACLE: the selected backup must retain its filename and exact bytes.');
  assert.equal(selected.sha256,await r.runtime.closedLoopHash.sha256Bytes(r.runtime.__activityPackage));
  await new Promise(resolve=>setTimeout(resolve,1510));
  assert.equal(activityNodes.get('#storage-status').getAttribute('aria-busy'),'true','DELAYED_IMPORT_LOADING_ORACLE: a pending import past the threshold must show storage activity.');
  assert.equal(activityNodes.get('#app-operation-status').hidden,false,'DELAYED_IMPORT_LOADING_ORACLE: a pending import past the threshold must show operator progress.');
  assert.equal(activityNodes.get('#import-file').disabled,true,'DELAYED_IMPORT_LOADING_ORACLE: a pending import must retain its control lock.');
  assert.ok(Object.values(await vm.runInContext(observe,r.runtime)).every(Boolean),'DELAYED_IMPORT_LAYOUT_ORACLE: settled valid progress must pass the actual browser observation.');
  const status=activityNodes.get('#storage-status'),originalBox=status.getBoundingClientRect;let samples=0;
  status.getBoundingClientRect=()=>({...originalBox(),width:++samples<2?180:200});
  const shifted=await vm.runInContext(observe,r.runtime);
  assert.equal(shifted.width,false,'DELAYED_IMPORT_LAYOUT_ORACLE: the observation must reject a layout shift on a later frame.');
  status.getBoundingClientRect=originalBox;
  r.runtime.__restoreActivityWorker();r.runtime.__releaseActivityReply();r.runtime.__releaseActivityReply();await r.runtime.__activityImport;
  assert.equal(activityNodes.get('#storage-status').hasAttribute('aria-busy'),false,'Completed import must clear storage progress.');
  assert.equal(activityNodes.get('#app-operation-status').hidden,true,'Completed import must clear operator progress.');
  assert.equal(activityNodes.get('#import-file').disabled,false,'Completed import must release its control.');
  assert.equal(activityNodes.get('#import-file').value,'','Completed import must clear the selected control.');
  assert.match(activityNodes.get('#app-live-status').textContent,/project package imported and reloaded/,'Import must explicitly report completion.');
  assert.equal(delivered.filter(message=>message.operationId===requests[0].operationId).length,1,'DELAYED_IMPORT_RELEASE_ORACLE: a held import response must be delivered exactly once.');
  cases.push({caseId:'UI-DELAYED-IMPORT-BROWSER-SELECTION',result:'PASS',actualBrowser:false,requests:requests.length,selectedFilename:selected.filename,selectedByteSize:selected.byteSize,selectedSha256:selected.sha256,importReplies:1,unrelatedReplies:1,lateLayoutShiftRejected:true});
 }finally{r.runtime.__restoreActivityWorker?.();r.runtime.__releaseActivityReply?.();if(r.runtime.__activityImport)await r.runtime.__activityImport;}
}
console.log(JSON.stringify({schema:'closed-loop-executed-cases/1',synthetic:true,environment:'Node VM with delayed operation and frame boundary',scope:'Shared action binding and production workflow markup ownership; not browser layout or stage-by-stage file-transport acceptance.',cases},null,2));
