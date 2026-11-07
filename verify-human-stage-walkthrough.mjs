import {stage04AcceptanceFixtureSource} from './test-fixtures.mjs';
import {createBrowserExecutionObserver} from './browser-execution-evidence.mjs';
import {downloadSyntheticHandoff} from './test-browser-handoff-authorization.mjs';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const stage04PrerequisiteFixtureSource=stage04AcceptanceFixtureSource();
const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
if(!browser)throw new Error('Chrome/Chromium was not found.');
const serverPort=9400+Math.floor(Math.random()*300);
const remotePort=10400+Math.floor(Math.random()*300);
const root=path.resolve(process.env.VERIFIED_SITE_DIR||process.env.STATIC_SITE_ROOT||process.cwd());
const server=http.createServer((req,res)=>{
  const raw=(req.url||'/').split('?')[0],rel=raw==='/'?'index.html':decodeURIComponent(raw.replace(/^\//,''));
  const absolute=path.resolve(root,rel);
  if(!absolute.startsWith(root)||!fs.existsSync(absolute)){res.statusCode=404;res.end('not found');return;}
  res.setHeader('Content-Type',rel.endsWith('.js')?'text/javascript; charset=utf-8':rel.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');
  res.end(fs.readFileSync(absolute));
});
if(!process.env.PAGE_URL)await new Promise((resolve,reject)=>server.listen(serverPort,'127.0.0.1',resolve).once('error',reject));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-human-stage-'));
let browserStderr='';
const child=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${remotePort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
child.stderr?.on('data',chunk=>{browserStderr=(browserStderr+String(chunk)).slice(-16000);});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function poll(fn,timeout=90000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{return await fn();}catch(e){last=e;await sleep(120);}}throw last||new Error('Timed out');}
async function getJson(url,opts){const r=await fetch(url,opts);if(!r.ok)throw new Error(`${url} -> ${r.status}`);return r.json();}
let ws,executionObserver;
const pageUrl=process.env.PAGE_URL||`http://127.0.0.1:${serverPort}/`;
try{
  await poll(async()=>{
    if(child.exitCode!==null)throw new Error(`Chrome exited before opening DevTools (exit ${child.exitCode}). ${browserStderr}`);
    await getJson(`http://127.0.0.1:${remotePort}/json/version`);
    return true;
  });
  const target=await getJson(`http://127.0.0.1:${remotePort}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'});
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let seq=0,browserDialog='';const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);return;}if(m.method==='Page.javascriptDialogOpening'){browserDialog=String(m.params?.message||'Unexpected browser dialog');send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});}};
  const send=(method,params={})=>{const id=++seq,timeoutError=new Error('Chromium did not respond to '+method+' within 180 seconds.');return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(timeoutError);},180000),finish=fn=>value=>{clearTimeout(timer);pending.delete(id);fn(value);};pending.set(id,{resolve:finish(resolve),reject:finish(reject)});try{ws.send(JSON.stringify({id,method,params}));}catch(error){pending.get(id)?.reject(error);}});};
  const evalJs=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text||'browser evaluation failed');return r.result?.value;};
  await send('Runtime.enable');await send('Page.enable');
  executionObserver=await createBrowserExecutionObserver({webSocketDebuggerUrl:target.webSocketDebuggerUrl,pageUrl});
  await send('Page.navigate',{url:pageUrl});
  await poll(async()=>{const ready=await evalJs(`document.readyState==='complete'&&globalThis.closedLoopAppReady===true`);if(!ready)throw new Error('app not ready');return true;});
  const result=await evalJs(`(async()=>{
    const waitFor=async(check,description)=>{const end=Date.now()+15000;while(Date.now()<end){if(check())return;await new Promise(r=>setTimeout(r,25));}throw new Error(description);};
    const idle=()=>waitFor(()=>document.querySelector('#app')?.getAttribute('aria-busy')!=='true','The operator action did not finish.');
    await idle();
    const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,schema=globalThis.closedLoopWorkflowSchema;
    if(!core||!engine||!prompts||!schema)throw new Error('Application runtime not loaded.');
    ${stage04PrerequisiteFixtureSource}
    const state=core.createBlankState('JOB-HUMAN-WALKTHROUGH');
    Object.assign(state.job,{JOB_ID:'JOB-HUMAN-WALKTHROUGH',JOB_TITLE:'Sequential human walkthrough',JOB_OWNER:'Operator',EXACT_USER_OBJECTIVE_VERBATIM:'Build one complete subject-neutral deliverable while preserving every supplied project requirement exactly once.',SUPPLIED_MATERIALS_INVENTORY:'intent.txt',REQUIRED_OUTPUT_FORMAT:'Use the actual artifact format required by the project.',DEADLINE_OR_TEMPORAL_SCOPE:'No artificial deadline.',DESIRED_SOURCE_COUNT:3,KNOWN_AUTHORITATIVE_SOURCES:'Use governing sources where applicable.',AVAILABLE_TOOLS:'Authorized research and deterministic application tools.',PROHIBITED_ACTIONS:'Never ask for project information already supplied. Never invent evidence.',EXPLICIT_USER_REQUIREMENTS:'Capture all human intent once. Each stage must perform only its own complete job and must receive every relevant canonical prior-stage fact.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-v001',CURRENT_REQUIREMENTS_VERSION:'REQ-v001',CURRENT_TEST_SUITE_VERSION:'TEST-v001',CURRENT_INSTRUCTION_VERSION:'INST-v001',CURRENT_ITERATION:'ITER-001',CURRENT_BASELINE_ID:'BASE-001',CURRENT_PRODUCT_ID:'PROD-001'});
    engine.ensureShape(state);engine.recalculate(state);
    const intake=engine.intakeCoverageManifest(state);
    const capture={schema:'closed-loop-stage01-capture/2',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'],omissionsFound:[],omissionsResolved:true},units:intake.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Sequential browser prompt audit fixture preserves current human authority.',extractedStatements:[{statementKey:'statement-'+String(index+1),text:unit.rawValueText||unit.label||unit.unitId,statementClass:'CONTEXT'}]}))};
    state.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Complete subject-neutral deliverable.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)};
    state.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};
    state.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:'TRUE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'};
    for(let prerequisite=1;prerequisite<30;prerequisite++){state.stages[prerequisite].status='COMPLETE';state.stages[prerequisite].gate={complete:true,blocked:false,reasons:[]};}
    if(!engine.evaluateIntakeAccounting(state).complete)throw new Error('Sequential browser prompt audit failed to establish valid Stage 01 accounting.');
    // The old synthetic cached gates are insufficient authority for Stage 04.
    // Keep that exact stale setup as a permanent refusal control, then use the
    // shared production-admitted hermetic Stage 01–03 fixture for prompt audit.
    let legacyFixtureRefused=false;
    try{prompts.buildPromptRecord(4,state,{operation:'RECONCILE_REQUIREMENTS'});}catch(error){if(error?.code!=='STAGE4_UPSTREAM_INCOMPLETE')throw error;legacyFixtureRefused=true;}
    if(!legacyFixtureRefused)throw new Error('HUMAN_WALKTHROUGH_PREREQUISITE_ORACLE: stale Stage02 flags bypassed current Stage04 prerequisites.');
    const originalStage01Capture=state.stages[1].agentData.INPUT_SET_CONTENTS;
    Object.assign(state,stage04AcceptanceFixture({core,schema,engine,prompts,ingestion:globalThis.closedLoopResponseIngestion},state.job.JOB_ID,{project:state,stageData:state.stages[1].agentData}));
    const currentUpstreamGates=[1,2,3].filter(stage=>engine.gate(stage,state).complete),sourceApplicability=engine.sourceApplicabilityState(state).determination,stage01CapturePreserved=state.stages[1].agentData.INPUT_SET_CONTENTS===originalStage01Capture;
    if(currentUpstreamGates.length!==3||sourceApplicability!=='NO_APPLICABLE_EXTERNAL_SOURCE'||!stage01CapturePreserved)throw new Error('HUMAN_WALKTHROUGH_PREREQUISITE_ORACLE: current admitted prerequisite fixture is incomplete.');
    const stage04Prerequisites={legacyFixtureRefused,currentUpstreamGates,sourceApplicability,stage01CapturePreserved,synthetic:true,actualProductionAcceptance:true,realExternalActor:false};
    // Later cached gates remain setup-only for the original prompt-family audit;
    // they are not evidence that any later stage actually completed.
    for(let prerequisite=4;prerequisite<30;prerequisite++){state.stages[prerequisite].status='COMPLETE';state.stages[prerequisite].gate={complete:true,blocked:false,reasons:[]};}

    const structuredAction=engine.operationalNextAction(state,30);
    if(!Array.isArray(structuredAction.operatorChecks)||structuredAction.operatorChecks.length===0)throw new Error('Structured operator action fixture does not expose the compact double-check guide.');
    const checked=[],applicationOnly=[],lane={runId:'RUN-001',contextId:'CTX-001',iterationId:'ITER-001',candidateId:'CAND-001',baselineId:'BASE-001',productId:'PROD-001'};
    // Node-level prompt-contract tests exhaustively build every external operation. The browser walkthrough
    // verifies representative operation families plus every non-external operation rejection, keeping this
    // UI test bounded enough to finish on hosted Chromium without weakening operation coverage.
    const representativeExternal=[[1,'COMPLETE'],[1,'SEMANTIC_CHALLENGE'],[2,'SEARCH_ADEQUACY_REVIEW'],[4,'RECONCILE_REQUIREMENTS'],[7,'EXECUTE_FAILURE_TEST'],[17,'EXECUTE_RUN'],[22,'EXECUTE_EXTERNAL_TEST'],[29,'INVESTIGATE_MISSING_EVIDENCE']];
    for(let stage=1;stage<=30;stage++)for(const operation of schema.STAGE_CONTRACTS[stage].operations){
      const registration=schema.STAGE_OPERATION_REGISTRY[stage+':'+operation];
      if(registration.executorClass==='EXTERNAL_AGENT')continue;
      let rejected=false;try{prompts.buildPromptRecord(stage,state,{operation,scope:Object.fromEntries(schema.operationContract(stage,operation).scopeRequirements.map(key=>[key,lane[key]||key.toUpperCase()+'-AUDIT']))});}catch(error){rejected=error?.code==='NON_EXTERNAL_OPERATION';}
      if(!rejected)throw new Error('Stage '+stage+' '+operation+' incorrectly generated an external prompt for '+registration.executorClass+'.');
      applicationOnly.push(stage+':'+operation+':'+registration.executorClass);
    }
    for(const [stage,operation] of representativeExternal){
      const registration=schema.STAGE_OPERATION_REGISTRY[stage+':'+operation];
      if(registration?.executorClass!=='EXTERNAL_AGENT')throw new Error('Representative external operation is misregistered: '+stage+':'+operation+'.');
      const record=prompts.buildPromptRecord(stage,state,{operation,scope:Object.fromEntries(schema.operationContract(stage,operation).scopeRequirements.map(key=>[key,lane[key]||key.toUpperCase()+'-AUDIT']))}),text=record.prompt;
      if(!text||text.length<200)throw new Error('Stage '+stage+' '+operation+' generated an incomplete prompt.');
      if(!text.includes('PROJECT DATA EXECUTION RULE — MANDATORY'))throw new Error('Stage '+stage+' '+operation+' omitted the one-time project-data rule.');
      if(stage>1&&!text.includes('The original Stage 01 intent file is prohibited input for this stage.'))throw new Error('Stage '+stage+' '+operation+' can request the original intent again.');
      if(!text.includes('STRICT RESPONSE CONTRACT'))throw new Error('Stage '+stage+' '+operation+' omitted its response contract.');
      if(stage===1&&operation==='COMPLETE'&&(!text.includes('first semantic reader')||!text.includes('PASS 1 — EXHAUSTIVE EXTRACTION')||!text.includes('PASS 2 — OMISSION CHALLENGE')||!text.includes('humanAuthorityCandidates')))throw new Error('Stage 01 COMPLETE prompt is missing mandatory semantic-intake behavior.');
      checked.push(stage+':'+operation);
    }
    const workflowButton=document.querySelector('[data-view="Workflow"]');if(!workflowButton)throw new Error('Workflow navigation is missing.');workflowButton.click();await idle();
    const picker=document.querySelector('#stage-picker');if(!picker)throw new Error('Stage picker is missing after opening Workflow.');
    const reached=[...picker.options].map(option=>Number(option.value));
    if(reached.length!==30||reached.some((value,index)=>value!==index+1))throw new Error('The UI stage picker does not expose all 30 stages in order.');
    picker.value='1';picker.dispatchEvent(new Event('change',{bubbles:true}));await idle();
    const operationPicker=document.querySelector('#operation-picker');if(operationPicker){operationPicker.value='COMPLETE';operationPicker.dispatchEvent(new Event('change',{bubbles:true}));await idle();}
    const promptElement=document.querySelector('#generated-prompt');if(!promptElement)throw new Error('Rendered prompt display is missing from the Workflow UI.');
    const renderedStage1=promptElement.textContent||'';
    for(const required of ['first semantic reader','PASS 1 — EXHAUSTIVE EXTRACTION','PASS 2 — OMISSION CHALLENGE','humanAuthorityCandidates'])if(!renderedStage1.includes(required))throw new Error('Rendered Stage 01 COMPLETE prompt omitted required behavior: '+required+'; selected stage: '+document.querySelector('#stage-picker')?.value+'; operation: '+document.querySelector('#operation-picker')?.value+'; feedback: '+document.querySelector('#app-live-status')?.textContent+'; notice: '+document.querySelector('#next-required-action > .notice')?.textContent+'; actual prompt: '+renderedStage1.slice(0,1200));
    // The retained bootstrap remains legacy, non-gating evidence. Its Stage02
    // view must not expose an export while current Stage01 is incomplete.
    const stage2Picker=document.querySelector('#stage-picker');stage2Picker.value='2';stage2Picker.dispatchEvent(new Event('change',{bubbles:true}));await idle();
    const store=globalThis.closedLoopProjectStore,legacyId=document.querySelector('#current-project-summary')?.dataset?.projectId,legacy=await store.readProject(legacyId),legacyButton=document.getElementById('next-export-prompt-file');
    const legacyUi={jobId:legacyId,profile:legacy?.projectData?.contractProfileMigration?.status,stage01Complete:engine.gate(1,legacy).complete,stage02Allowed:engine.stageEntryState(legacy,2).allowed,exportExists:Boolean(legacyButton),exportDisabled:legacyButton?legacyButton.disabled:null,selectedStage:document.querySelector('#stage-picker')?.value};
    if(legacyUi.jobId!=='JOB-20260823144121'||legacyUi.profile!=='LEGACY_NON_GATING'||legacyUi.stage01Complete||legacyUi.stage02Allowed||legacyUi.exportExists||legacyUi.selectedStage!=='2')throw new Error('HUMAN_WALKTHROUGH_LEGACY_UI_ORACLE: '+JSON.stringify(legacyUi));
    // A separate current UI project needs only real Stage01 acceptance and its
    // bound synthetic confirmation. Never persist the prompt audit's gate flags.
    const uiProject=stage01AcceptanceFixture({core,schema,engine,prompts,ingestion:globalThis.closedLoopResponseIngestion},'JOB-HUMAN-WALKTHROUGH-UI');
    uiProject.activeStage=1;uiProject.activeView='Workflow';
    const savedUiProject=await store.writeProject(uiProject,{createOnly:true,expectedProjectRevision:0});
    return {stage04Prerequisites,legacyUi,uiProjectIdentity:{jobId:savedUiProject.job.JOB_ID,projectSha256:savedUiProject.projectSha256,revision:savedUiProject.revision},stages:30,prompts:checked.length,applicationOnlyOperations:applicationOnly.length,first:checked[0],last:checked.at(-1),uiStagesReached:reached.length,oneTimeSupply:true,operatorDoubleCheckGuide:true};
  })()`);
  const uiUrl=new URL(pageUrl);for(const key of ['project','version','stage','view'])uiUrl.searchParams.delete(key);uiUrl.searchParams.set('project',result.uiProjectIdentity.jobId);
  await send('Page.navigate',{url:uiUrl.href});
  await poll(async()=>{const ready=await evalJs(`document.readyState==='complete'&&globalThis.closedLoopAppReady===true&&document.querySelector('#current-project-summary')?.dataset?.projectId===${JSON.stringify(result.uiProjectIdentity.jobId)}`);if(!ready)throw new Error('The admitted UI fixture is not active.');return true;});
  Object.assign(result,await evalJs(`(async()=>{
    const idle=async()=>{const end=Date.now()+15000;while(Date.now()<end){if(document.querySelector('#app')?.getAttribute('aria-busy')!=='true')return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error('The operator action did not finish.');};await idle();
    const store=globalThis.closedLoopProjectStore,engine=globalThis.closedLoopWorkflowEngine,expected=${JSON.stringify(result.uiProjectIdentity)},selected=document.querySelector('#current-project-summary')?.dataset?.projectId,current=await store.readProject(selected);
    const stage01Accepted=current.projectData.acceptedChanges.filter(row=>Number(row.stage)===1&&!row.invalidatedBy),stage01Confirmations=current.projectData.stageConfirmations.filter(row=>Number(row.stage)===1&&row.confirmed&&!row.invalidatedBy);
    const ui={selectedProject:selected===expected.jobId,exactStoredIdentity:current.projectSha256===expected.projectSha256&&current.revision===expected.revision,stage01Complete:engine.gate(1,current).complete,stage02Allowed:engine.stageEntryState(current,2).allowed,acceptedStage01Count:stage01Accepted.length,confirmedStage01Count:stage01Confirmations.length,laterAcceptedCount:current.projectData.acceptedChanges.filter(row=>Number(row.stage)>1&&!row.invalidatedBy).length,laterCompleteCount:Array.from({length:29},(_,i)=>i+2).filter(stage=>current.stages[stage].status==='COMPLETE'||current.stages[stage].gate?.complete===true).length};
    if(!ui.selectedProject||!ui.exactStoredIdentity||!ui.stage01Complete||!ui.stage02Allowed||ui.acceptedStage01Count!==1||ui.confirmedStage01Count!==1||ui.laterAcceptedCount!==0||ui.laterCompleteCount!==0)throw new Error('HUMAN_WALKTHROUGH_CURRENT_UI_ORACLE: '+JSON.stringify(ui));
    // Exercise the original real stage-package action on the admitted fixture.
    const workflowButton=document.querySelector('[data-view="Workflow"]');if(!workflowButton)throw new Error('Workflow navigation is missing.');workflowButton.click();await idle();
    const stage2Picker=document.querySelector('#stage-picker');stage2Picker.value='2';stage2Picker.dispatchEvent(new Event('change',{bubbles:true}));await idle();
    const exportButton=document.getElementById('next-export-prompt-file');
    if(!exportButton||exportButton.disabled)throw new Error('Current consolidated stage-file package control is not available.');
    for(const legacy of ['export-prompt-file','export-prompt-manifest','export-prompt-context','export-stage-files'])if(document.getElementById(legacy))throw new Error('Superseded export control remains: '+legacy);
    return {stage02UiPrerequisites:{...ui,legacyBootstrapBlocked:true,actualProjectNavigation:true,productionCreateOnlyWrite:true,synthetic:true,actualExternalActor:false}};
  })()`));
  const idleExpression=`(async()=>{const end=Date.now()+15000;while(Date.now()<end){if(document.querySelector('#app')?.getAttribute('aria-busy')!=='true')return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error('The operator action did not finish.');})()`;
  const handoff={
    click:async selector=>{await evalJs(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node||node.disabled)throw new Error('The required handoff control is unavailable.');node.click();})()`);await evalJs(idleExpression);},
    fill:async(selector,value)=>{await evalJs(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node||node.disabled)throw new Error('The required handoff field is unavailable.');node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));})()`);await evalJs(idleExpression);},
    exists:selector=>evalJs(`Boolean(document.querySelector(${JSON.stringify(selector)}))`),evaluate:evalJs,captureDownloads:task=>task(),events:[]
  };
  await evalJs(`(()=>{globalThis.__humanWalkthroughExport={createObjectURL:URL.createObjectURL,blobs:[]};URL.createObjectURL=blob=>{globalThis.__humanWalkthroughExport.blobs.push(blob);return globalThis.__humanWalkthroughExport.createObjectURL.call(URL,blob);};})()`);
  try{
    await downloadSyntheticHandoff(handoff,'#next-export-prompt-file',{syntheticProject:true});
    if(handoff.events.length!==1||handoff.events[0].purposes.length!==1||handoff.events[0].purposes[0]!=='DISCLOSURE_AUTHORIZATION'||handoff.events[0].actualExternalTransfer!==false)throw new Error('Stage package export did not use its exact rendered synthetic disclosure decision.');
    await evalJs(`(async()=>{const end=Date.now()+15000;while(Date.now()<end){if(globalThis.__humanWalkthroughExport.blobs.length)return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error('Stage package export did not create one Blob.');})()`);
    Object.assign(result,await evalJs(`(async()=>{
    const blobs=globalThis.__humanWalkthroughExport.blobs,exportedBlob=blobs[0];
    if(blobs.length!==1)throw new Error('Stage package export did not create exactly one Blob.');
    if(!(exportedBlob instanceof Blob)||exportedBlob.type!=='application/zip')throw new Error('Stage package export did not create the required ZIP Blob.');
    const committedDisplayed=document.getElementById('generated-prompt')?.textContent||'';
    if(!committedDisplayed.includes('STRICT RESPONSE CONTRACT'))throw new Error('Export did not commit the displayed controlling instruction.');
    const stage18Picker=document.querySelector('#stage-picker');stage18Picker.value='18';stage18Picker.dispatchEvent(new Event('change',{bubbles:true}));await ${idleExpression};
    const appOnlyPrompt=document.querySelector('#generated-prompt')?.textContent||'';
    if(!appOnlyPrompt.includes('NO EXTERNAL AGENT INSTRUCTION REQUIRED'))throw new Error('Application-owned Stage 18 is rendered as external-agent work.');
    for(const id of ['export-prompt-file','export-prompt-manifest','export-prompt-context','export-stage-files','next-export-prompt-file','download-execution-package'])if(document.getElementById(id)&&!document.getElementById(id)?.disabled)throw new Error('Application-owned Stage 18 exposes external transfer control '+id+'.');
    const css=[...document.styleSheets].flatMap(sheet=>{try{return [...sheet.cssRules].map(rule=>rule.cssText)}catch{return []}}).join(' ');
    const compact=css;
    if(!compact.includes('height: clamp(260px, 45vh, 520px)'))throw new Error('Prompt box base height changed from the restored baseline.');
    if(!compact.includes('.expandable-prompt { max-height: 280px;'))throw new Error('Prompt preview height changed from the restored baseline.');
    if(compact.includes('.expandable-prompt { max-height: 88px;'))throw new Error('Obsolete 88px prompt height returned.');
    return {promptVisualBaseline:true};
  })()`));
  }finally{await evalJs(`(()=>{URL.createObjectURL=globalThis.__humanWalkthroughExport.createObjectURL;delete globalThis.__humanWalkthroughExport;})()`);}
  if(browserDialog)throw new Error(`Browser UI opened an unexpected dialog: ${browserDialog}`);
  if(result?.stages!==30||result?.uiStagesReached!==30||result?.prompts<8||result?.applicationOnlyOperations<1||result?.oneTimeSupply!==true||result?.promptVisualBaseline!==true||result?.operatorDoubleCheckGuide!==true)throw new Error('Synthetic prompt and navigation checks did not pass.');
  console.log(JSON.stringify({syntheticPromptAndNavigationChecks:true,browserExecution:await executionObserver?.finish(),completeOperatorJourney:false,humanIndependenceEstablished:false,...result}));
}finally{
  executionObserver?.close();
  try{ws?.close();}catch{}
  const exited=new Promise(resolve=>child.once('exit',resolve));
  child.kill('SIGKILL');
  await Promise.race([exited,sleep(1200)]);
  if(server.listening)await new Promise(r=>server.close(r));
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch{}
}
