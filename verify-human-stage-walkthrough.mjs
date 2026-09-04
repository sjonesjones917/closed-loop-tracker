import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
if(!browser)throw new Error('Chrome/Chromium was not found.');
const serverPort=9400+Math.floor(Math.random()*300);
const remotePort=10400+Math.floor(Math.random()*300);
const root=process.cwd();
const server=http.createServer((req,res)=>{
  const raw=(req.url||'/').split('?')[0],rel=raw==='/'?'index.html':decodeURIComponent(raw.replace(/^\//,''));
  const absolute=path.resolve(root,rel);
  if(!absolute.startsWith(root)||!fs.existsSync(absolute)){res.statusCode=404;res.end('not found');return;}
  res.setHeader('Content-Type',rel.endsWith('.js')?'text/javascript; charset=utf-8':rel.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');
  res.end(fs.readFileSync(absolute));
});
await new Promise((resolve,reject)=>server.listen(serverPort,'127.0.0.1',resolve).once('error',reject));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-human-stage-'));
let browserStderr='';
const child=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${remotePort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
child.stderr?.on('data',chunk=>{browserStderr=(browserStderr+String(chunk)).slice(-16000);});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function poll(fn,timeout=90000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{return await fn();}catch(e){last=e;await sleep(120);}}throw last||new Error('Timed out');}
async function getJson(url,opts){const r=await fetch(url,opts);if(!r.ok)throw new Error(`${url} -> ${r.status}`);return r.json();}
let ws;
try{
  await poll(async()=>{
    if(child.exitCode!==null)throw new Error(`Chrome exited before opening DevTools (exit ${child.exitCode}). ${browserStderr}`);
    await getJson(`http://127.0.0.1:${remotePort}/json/version`);
    return true;
  });
  const target=await getJson(`http://127.0.0.1:${remotePort}/json/new?${encodeURIComponent(`http://127.0.0.1:${serverPort}/?walkthrough=${Date.now()}`)}`,{method:'PUT'});
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evalJs=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text||'browser evaluation failed');return r.result?.value;};
  await send('Runtime.enable');await send('Page.enable');
  await poll(async()=>{const ready=await evalJs(`document.readyState==='complete'&&globalThis.closedLoopAppReady===true`);if(!ready)throw new Error('app not ready');return true;});
  const result=await evalJs(`(async()=>{
    const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,schema=globalThis.closedLoopWorkflowSchema;
    if(!core||!engine||!prompts||!schema)throw new Error('Application runtime not loaded.');
    const state=core.createBlankState('JOB-HUMAN-WALKTHROUGH');
    Object.assign(state.job,{JOB_ID:'JOB-HUMAN-WALKTHROUGH',JOB_TITLE:'Sequential human walkthrough',JOB_OWNER:'Operator',EXACT_USER_OBJECTIVE_VERBATIM:'Build one complete subject-neutral deliverable while preserving every supplied project requirement exactly once.',SUPPLIED_MATERIALS_INVENTORY:'intent.txt',REQUIRED_OUTPUT_FORMAT:'Use the actual artifact format required by the project.',DEADLINE_OR_TEMPORAL_SCOPE:'No artificial deadline.',DESIRED_SOURCE_COUNT:3,KNOWN_AUTHORITATIVE_SOURCES:'Use governing sources where applicable.',AVAILABLE_TOOLS:'Authorized research and deterministic application tools.',PROHIBITED_ACTIONS:'Never ask for project information already supplied. Never invent evidence.',EXPLICIT_USER_REQUIREMENTS:'Capture all human intent once. Each stage must perform only its own complete job and must receive every relevant canonical prior-stage fact.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-v001',CURRENT_REQUIREMENTS_VERSION:'REQ-v001',CURRENT_TEST_SUITE_VERSION:'TEST-v001',CURRENT_INSTRUCTION_VERSION:'INST-v001',CURRENT_ITERATION:'ITER-001',CURRENT_BASELINE_ID:'BASE-001',CURRENT_PRODUCT_ID:'PROD-001'});
    engine.ensureShape(state);engine.recalculate(state);
    const intake=engine.intakeCoverageManifest(state);
    const capture={schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Sequential browser prompt audit fixture preserves current human authority.',extractedStatements:[{statementKey:'statement-'+String(index+1),text:unit.rawValueText||unit.label||unit.unitId,statementClass:'CONTEXT'}]}))};
    state.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Complete subject-neutral deliverable.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)};
    state.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};
    state.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:'TRUE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'};
    for(let prerequisite=1;prerequisite<30;prerequisite++){state.stages[prerequisite].status='COMPLETE';state.stages[prerequisite].gate={complete:true,blocked:false,reasons:[]};}
    if(!engine.evaluateIntakeAccounting(state).complete)throw new Error('Sequential browser prompt audit failed to establish valid Stage 01 accounting.');
    const structuredAction=engine.operationalNextAction(state,30);
    if(!Array.isArray(structuredAction.operatorChecks)||structuredAction.operatorChecks.length===0)throw new Error('Structured operator action fixture does not expose the compact double-check guide.');
    const checked=[],lane={runId:'RUN-001',contextId:'CTX-001',iterationId:'ITER-001',candidateId:'CAND-001',baselineId:'BASE-001',productId:'PROD-001'};
    for(let stage=1;stage<=30;stage++)for(const operation of schema.STAGE_CONTRACTS[stage].operations){
      const record=prompts.buildPromptRecord(stage,state,{operation,scope:lane}),text=record.prompt;
      if(!text||text.length<200)throw new Error('Stage '+stage+' '+operation+' generated an incomplete prompt.');
      if(!text.includes('PROJECT DATA EXECUTION RULE — MANDATORY'))throw new Error('Stage '+stage+' '+operation+' omitted the one-time project-data rule.');
      if(stage>1&&!text.includes('The original Stage 01 intent file is prohibited input for this stage.'))throw new Error('Stage '+stage+' '+operation+' can request the original intent again.');
      if(!text.includes('RESPONSE CONTRACT DEFINITIONS'))throw new Error('Stage '+stage+' '+operation+' omitted its response contract.');
      checked.push(stage+':'+operation);
    }
    const workflowButton=document.querySelector('[data-view="Workflow"]');if(!workflowButton)throw new Error('Workflow navigation is missing.');workflowButton.click();await new Promise(r=>setTimeout(r,100));
    const picker=document.querySelector('#stage-picker');if(!picker)throw new Error('Stage picker is missing after opening Workflow.');
    const reached=[];for(let stage=1;stage<=30;stage++){picker.value=String(stage);picker.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,15));reached.push(Number(picker.value));}
    if(reached.length!==30||reached.some((value,index)=>value!==index+1))throw new Error('The UI stage picker cannot traverse all 30 stages in order.');
    picker.value='2';picker.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,100));
    const promptElement=document.querySelector('.prompt');if(!promptElement)throw new Error('Rendered prompt display is missing from the Workflow UI.');
    const css=[...document.styleSheets].flatMap(sheet=>{try{return [...sheet.cssRules].map(rule=>rule.cssText)}catch{return []}}).join(' ');
    const compact=css;
    if(!compact.includes('height: clamp(260px, 45vh, 520px)'))throw new Error('Prompt box base height changed from the restored baseline.');
    if(!compact.includes('.expandable-prompt { max-height: 280px;'))throw new Error('Prompt preview height changed from the restored baseline.');
    if(compact.includes('.expandable-prompt { max-height: 88px;'))throw new Error('Obsolete 88px prompt height returned.');
    return {stages:30,prompts:checked.length,first:checked[0],last:checked.at(-1),uiStagesReached:reached.length,oneTimeSupply:true,promptVisualBaseline:true,operatorDoubleCheckGuide:true};
  })()`);
  if(result?.stages!==30||result?.uiStagesReached!==30||result?.prompts<30||result?.oneTimeSupply!==true||result?.promptVisualBaseline!==true||result?.operatorDoubleCheckGuide!==true)throw new Error('Sequential browser walkthrough did not establish the complete operator path.');
  console.log(JSON.stringify({humanStageWalkthrough:true,...result}));
}finally{
  try{ws?.close();}catch{}
  const exited=new Promise(resolve=>child.once('exit',resolve));
  child.kill('SIGKILL');
  await Promise.race([exited,sleep(1200)]);
  await new Promise(r=>server.close(r));
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch{}
}
