import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PAGE_URL=process.env.PAGE_URL;
if(!PAGE_URL)throw new Error('PAGE_URL is required');
const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
if(!browser)throw new Error('Chrome/Chromium was not found');
const port=9722+Math.floor(Math.random()*400);
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-prompts-'));
const proc=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${userData}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url,opts){const r=await fetch(url,opts);if(!r.ok)throw new Error(`${url} -> ${r.status}`);return r.json();}
async function poll(fn,timeout=15000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{return await fn();}catch(e){last=e;await sleep(150);}}throw last||new Error('Timed out');}
class CDP{constructor(ws){this.ws=new WebSocket(ws);this.id=0;this.pending=new Map();this.ready=new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});ws.onmessage=e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);};}async send(method,params={}){await this.ready;const id=++this.id;const p=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method,params}));return p;}close(){this.ws.close();}}
const evaluate=async(cdp,expression)=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'Evaluation failed');return r.result?.value;};
const assert=(v,m)=>{if(!v)throw new Error(m);};
try{
  await poll(()=>json(`http://127.0.0.1:${port}/json/version`));
  const target=await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${PAGE_URL}?prompt-verify=${Date.now()}`)}`,{method:'PUT'});
  const cdp=new CDP(target.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');
  await poll(async()=>{const ok=await evaluate(cdp,`document.readyState==='complete'&&document.body.innerText.includes('Mobile Closed-Loop Agent Reliability Workbook')`);if(!ok)throw new Error('waiting for application');return true;});
  await evaluate(cdp,`localStorage.clear();location.reload();true`);await sleep(700);
  await poll(async()=>{const ok=await evaluate(cdp,`document.body.innerText.includes('1/30 complete')`);if(!ok)throw new Error('waiting for retained project');return true;});
  assert(await evaluate(cdp,`(()=>{const b=[...document.querySelectorAll('[data-view]')].find(x=>x.dataset.view==='Workflow');if(!b)return false;b.click();return true})()`),'Workflow tab missing');await sleep(250);
  const generated=[];
  for(let n=1;n<=30;n++){
    const changed=await evaluate(cdp,`(()=>{const s=document.querySelector('#stage-picker');if(!s)return false;s.value='${n}';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);assert(changed,`Stage ${n} selector failed`);await sleep(120);
    const prompt=await evaluate(cdp,`document.querySelector('#generated-prompt')?.textContent||''`);
    assert(prompt.includes(`COPY BLOCK — STAGE ${String(n).padStart(2,'0')}`),`Stage ${n} prompt identity is wrong`);
    assert(prompt.includes('JOB_ID: JOB-20260823144121'),`Stage ${n} prompt lost project identity`);
    generated.push(prompt);
  }
  const stage2=generated[1];
  for(const token of ['BUILD THE SOURCE INVENTORY','Source-authority analyst','OPERATION 01 — DEFINE JOB','SOURCE-SET-v001','Assign stable SOURCE_ID values','explicit authority hierarchy','Do not perform Stage 03 requirements research'])assert(stage2.includes(token),`Rendered Stage 02 prompt missing ${token}`);
  for(const [n,token] of [[6,'Build the verification suite before any production instruction is authored'],[11,'Run exactly ten independent executions'],[12,'REQ_ID by RUN_ID combination'],[18,'Converged is permitted only when'],[19,'mandatory unchanged confirmation iteration'],[23,'actual product meaning'],[28,'verify exact artifact identity immediately before delivery'],[29,'SOURCE -> REQUIREMENT -> INSTRUCTION -> EXECUTION'],[30,'append-only permanent defect and regression history']])assert(generated[n-1].includes(token),`Rendered Stage ${n} prompt is missing its controlling procedure`);
  assert(new Set(generated.slice(1)).size===29,'Stages 02-30 did not render distinct project-specific instructions');
  console.log(JSON.stringify({renderedPromptsVerified:30,stage2ProjectSpecific:true,jobId:'JOB-20260823144121'},null,2));
  cdp.close();
}finally{proc.kill('SIGTERM');fs.rmSync(userData,{recursive:true,force:true});}