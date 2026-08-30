import fs from 'node:fs';
import http from 'node:http';
import {spawn} from 'node:child_process';

const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>fs.existsSync(p));
if(!browser)throw new Error('Chromium-compatible browser is required.');
const port=Number(process.env.PORT||4191);
const root=process.cwd();
const server=http.createServer((req,res)=>{
  const raw=(req.url||'/').split('?')[0];
  const rel=raw==='/'?'index.html':decodeURIComponent(raw.replace(/^\//,''));
  const path=new URL(rel,'file://'+root.replace(/\\/g,'/')+'/').pathname;
  if(!path.startsWith(root.replace(/\\/g,'/'))||!fs.existsSync(path)){res.statusCode=404;res.end('not found');return;}
  res.setHeader('Content-Type',rel.endsWith('.js')?'text/javascript; charset=utf-8':rel.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');
  res.end(fs.readFileSync(path));
});
await new Promise((resolve,reject)=>server.listen(port,'127.0.0.1',resolve).once('error',reject));

const remotePort=port+1000;
const userData=`/tmp/closed-loop-human-walkthrough-${process.pid}`;
const child=spawn(browser,[`--remote-debugging-port=${remotePort}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${userData}`,'--headless=new','--no-sandbox','--disable-gpu',`http://127.0.0.1:${port}/`],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let wsUrl='';
for(let i=0;i<80&&!wsUrl;i++){
  try{const pages=await (await fetch(`http://127.0.0.1:${remotePort}/json`)).json();wsUrl=pages.find(x=>x.type==='page')?.webSocketDebuggerUrl||'';}catch{}
  if(!wsUrl)await sleep(100);
}
if(!wsUrl){child.kill('SIGKILL');server.close();throw new Error('Could not connect to browser.');}
const ws=new WebSocket(wsUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evalJs=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'browser evaluation failed');return r.result?.result?.value;};
await send('Runtime.enable');await send('Page.enable');await sleep(800);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

try{
  const result=await evalJs(`(async()=>{
    const app=globalThis.closedLoopApp,core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,schema=globalThis.closedLoopWorkflowSchema;
    if(!app||!core||!engine||!prompts||!schema)throw new Error('Application runtime not loaded.');
    const state=core.createBlankState('JOB-HUMAN-WALKTHROUGH');
    Object.assign(state.job,{JOB_ID:'JOB-HUMAN-WALKTHROUGH',JOB_TITLE:'Sequential human walkthrough',JOB_OWNER:'Operator',EXACT_USER_OBJECTIVE_VERBATIM:'Build one complete subject-neutral deliverable while preserving every supplied project requirement exactly once.',SUPPLIED_MATERIALS_INVENTORY:'intent.txt',REQUIRED_OUTPUT_FORMAT:'Use the actual artifact format required by the project.',DEADLINE_OR_TEMPORAL_SCOPE:'No artificial deadline.',DESIRED_SOURCE_COUNT:3,KNOWN_AUTHORITATIVE_SOURCES:'Use governing sources where applicable.',AVAILABLE_TOOLS:'Authorized research and deterministic application tools.',PROHIBITED_ACTIONS:'Never ask for project information already supplied. Never invent evidence.',EXPLICIT_USER_REQUIREMENTS:'Capture all human intent once. Each stage must perform only its own complete job and must receive every relevant canonical prior-stage fact.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-v001',CURRENT_REQUIREMENTS_VERSION:'REQ-v001',CURRENT_TEST_SUITE_VERSION:'TEST-v001',CURRENT_INSTRUCTION_VERSION:'INST-v001',CURRENT_ITERATION:'ITER-001',CURRENT_BASELINE_ID:'BASE-001',CURRENT_PRODUCT_ID:'PROD-001'});
    engine.ensureShape(state);engine.recalculate(state);
    const checked=[];
    const lane={runId:'RUN-001',contextId:'CTX-001',iterationId:'ITER-001',candidateId:'CAND-001',baselineId:'BASE-001',productId:'PROD-001'};
    for(let stage=1;stage<=30;stage++){
      const contract=schema.STAGE_CONTRACTS[stage];
      for(const operation of contract.operations){
        let record;
        try{record=prompts.buildPromptRecord(stage,state,{operation,scope:lane});}catch(error){
          if(error?.code==='MISSING_REQUIRED_PROMPT_SCOPE')record=prompts.buildPromptRecord(stage,state,{operation,scope:lane});else throw error;
        }
        const text=record.prompt;
        if(!text||text.length<200)throw new Error('Stage '+stage+' '+operation+' generated an incomplete prompt.');
        if(!text.includes('PROJECT DATA EXECUTION RULE — MANDATORY'))throw new Error('Stage '+stage+' '+operation+' omitted the one-time project-data rule.');
        if(stage>1&&!text.includes('The original Stage 01 intent file is prohibited input for this stage.'))throw new Error('Stage '+stage+' '+operation+' can request the original intent again.');
        if(!text.includes('STRICT RESPONSE CONTRACT'))throw new Error('Stage '+stage+' '+operation+' omitted its response contract.');
        checked.push(stage+':'+operation);
      }
    }
    const promptElement=document.querySelector('.prompt');
    if(!promptElement)throw new Error('Prompt display is missing.');
    const style=getComputedStyle(promptElement);
    const visual={minHeight:style.minHeight,height:style.height,maxHeight:style.maxHeight};
    return {stages:30,prompts:checked.length,first:checked[0],last:checked.at(-1),promptVisual:visual,oneTimeSupply:true};
  })()`);
  assert(result?.stages===30,'Sequential walkthrough did not cover 30 stages.');
  assert(result?.prompts>=30,'Sequential walkthrough did not cover every stage prompt.');
  assert(result?.oneTimeSupply===true,'One-time input invariant failed.');
  console.log(JSON.stringify({humanStageWalkthrough:true,...result},null,2));
}finally{
  try{ws.close();}catch{}
  child.kill('SIGKILL');
  await new Promise(r=>server.close(r));
  fs.rmSync(userData,{recursive:true,force:true});
}
