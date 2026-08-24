import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PAGE_URL=process.env.PAGE_URL;
if(!PAGE_URL)throw new Error('PAGE_URL is required');
const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
if(!browser)throw new Error('Chrome/Chromium was not found');
const port=11800+Math.floor(Math.random()*400),profile=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-prompt-isolation-'));
const proc=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url,opts){const r=await fetch(url,opts);if(!r.ok)throw new Error(`${url} -> ${r.status}`);return r.json();}
async function poll(fn,timeout=20000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{return await fn();}catch(e){last=e;await sleep(100);}}throw last||new Error('Timed out');}
class CDP{constructor(url){this.ws=new WebSocket(url);this.id=0;this.pending=new Map();this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);};}async send(method,params={}){await this.ready;const id=++this.id,p=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method,params}));return p;}close(){this.ws.close();}}
const evaluate=async(cdp,expression)=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text||'Evaluation failed');return r.result?.value;};
try{
  await poll(()=>json(`http://127.0.0.1:${port}/json/version`));
  const target=await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${PAGE_URL}?prompt-isolation=${Date.now()}`)}`,{method:'PUT'});
  const cdp=new CDP(target.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');
  await poll(async()=>{const ok=await evaluate(cdp,`document.readyState==='complete'&&globalThis.closedLoopPromptEngine?.version==='2026-08-24-r2'&&globalThis.closedLoopCore?.STAGES?.length===30`);if(!ok)throw new Error('waiting for prompt engine r2');return true;});
  const result=await evaluate(cdp,`(()=>{
    const core=globalThis.closedLoopCore;
    const forbidden=['JOB-20260823144121','Mobile Closed-Loop Agent Reliability Workbook','MASTER TEMPLATE - DUPLICATE THIS FILE FOR EACH NEW JOB'];
    let checked=0;
    for(let i=0;i<100000;i++){
      const n=(i%30)+1,id='JOB-SYNTHETIC-'+String(i).padStart(6,'0'),objective='SYNTHETIC OBJECTIVE '+i,deliverable='SYNTHETIC DELIVERABLE '+i;
      const state=core.createBlankState(id);
      state.job.JOB_ID=id;state.job.JOB_TITLE='Synthetic Project '+i;state.job.EXACT_USER_OBJECTIVE_VERBATIM=objective;state.job.EXACT_DELIVERABLE_REQUESTED=deliverable;state.job.CURRENT_STAGE='STAGE '+String(n).padStart(2,'0');state.job.CURRENT_STATE='READY';state.job.NEXT_REQUIRED_ACTION='Perform synthetic stage '+n;
      const prompt=core.buildStagePrompt(core.STAGES[n-1],state);
      if(!prompt.includes('JOB_ID: '+id))throw new Error('Prompt lost current JOB_ID at case '+i);
      if(!prompt.includes(objective))throw new Error('Prompt lost current objective at case '+i);
      if(!prompt.includes(deliverable))throw new Error('Prompt lost current deliverable at case '+i);
      if(!prompt.includes('This instruction belongs only to JOB_ID '+id))throw new Error('Missing project-scope boundary at case '+i);
      for(const bad of forbidden)if(prompt.includes(bad))throw new Error('Cross-project retained-test contamination '+JSON.stringify(bad)+' at case '+i);
      if(n===1&&!prompt.includes('Do not create, prescribe, or instruct reuse of a master prompt'))throw new Error('Stage 01 reusable-template prohibition missing at case '+i);
      if(n===2){for(const token of ['genuinely independent external authorities','Never use the target product, this operating application, its repository','User Job Input and Supplied Material remain authorized project inputs, but they are not automatically independent external governing sources'])if(!prompt.includes(token))throw new Error('Stage 02 authority boundary missing '+JSON.stringify(token)+' at case '+i);}
      if(n===3&&!prompt.includes('Research only the legitimate Stage 02 external governing source set'))throw new Error('Stage 03 external-source boundary missing at case '+i);
      checked++;
    }
    const a=core.createBlankState('JOB-A'),b=core.createBlankState('JOB-B');
    a.job.EXACT_USER_OBJECTIVE_VERBATIM='OBJECTIVE-A-ONLY';b.job.EXACT_USER_OBJECTIVE_VERBATIM='OBJECTIVE-B-ONLY';
    for(let n=1;n<=30;n++){
      const pa=core.buildStagePrompt(core.STAGES[n-1],a),pb=core.buildStagePrompt(core.STAGES[n-1],b);
      if(pa.includes('OBJECTIVE-B-ONLY')||pb.includes('OBJECTIVE-A-ONLY'))throw new Error('Two-project isolation failed at stage '+n);
    }
    return {promptIsolationVerified:true,syntheticPromptCases:checked,stagesCovered:30,crossProjectLeakage:0,stage1ReusableTemplateLeakage:0,stage2CircularAuthorityLeakage:0};
  })()`);
  console.log(JSON.stringify(result,null,2));
  cdp.close();
}finally{
  if(!proc.killed)proc.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),sleep(1500)]);
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:2,retryDelay:100});}catch{}
}
