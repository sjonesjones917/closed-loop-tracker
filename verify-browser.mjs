import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PAGE_URL=process.env.PAGE_URL;
if(!PAGE_URL)throw new Error('PAGE_URL is required');
const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
if(!browser)throw new Error('Chrome/Chromium was not found');
const port=9222+Math.floor(Math.random()*500);
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-browser-'));
const proc=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${userData}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url,opts){const r=await fetch(url,opts);if(!r.ok)throw new Error(`${url} -> ${r.status}`);return r.json();}
async function poll(fn,timeout=15000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{return await fn();}catch(e){last=e;await sleep(150);}}throw last||new Error('Timed out');}
class CDP{
  constructor(ws){this.ws=new WebSocket(ws);this.id=0;this.pending=new Map();this.events=[];this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}else this.events.push(m);};}
  async send(method,params={}){await this.ready;const id=++this.id;const p=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method,params}));return p;}
  close(){this.ws.close();}
}
const evalValue=async(cdp,expression)=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'Evaluation failed');return r.result?.value;};
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
async function waitExpr(cdp,expression,timeout=12000){return poll(async()=>{const v=await evalValue(cdp,expression);if(!v)throw new Error(`Waiting: ${expression}`);return v;},timeout);}
async function click(cdp,selector){const ok=await evalValue(cdp,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.click();return true})()`);assert(ok,`Missing clickable ${selector}`);await sleep(200);}
async function fill(cdp,selector,value){const ok=await evalValue(cdp,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);assert(ok,`Missing input ${selector}`);}
async function setWidth(cdp,width,height=900){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await sleep(150);}
async function pageSnapshot(cdp){return evalValue(cdp,`(()=>({text:document.body.innerText,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,maxButtonHeight:Math.max(0,...[...document.querySelectorAll('button')].map(x=>x.getBoundingClientRect().height)),title:document.title}))()`);}
async function main(){
  await poll(()=>json(`http://127.0.0.1:${port}/json/version`));
  const target=await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${PAGE_URL}?browser-verify=${Date.now()}`)}`,{method:'PUT'});
  const cdp=new CDP(target.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Log.enable');
  await waitExpr(cdp,`document.readyState==='complete'`);
  await waitExpr(cdp,`document.body.innerText.includes('Mobile Closed-Loop Agent Reliability Workbook')`);
  await evalValue(cdp,`localStorage.clear();location.reload();true`);await sleep(500);await waitExpr(cdp,`document.body.innerText.includes('1/30 complete')`);
  const clean=await pageSnapshot(cdp);
  assert(clean.text.includes('Mobile Closed-Loop Agent Reliability Workbook'),'Retained project title is not rendered.');
  assert(clean.text.includes('STAGE 02')||clean.text.includes('Stage 02'),'Stage 02 is not the current rendered workflow location.');
  assert(clean.text.includes('Proceed to Operation 02'),'Next action is not rendered.');

  for(const width of [320,393,1280]){
    await setWidth(cdp,width,width<600?900:1000);const s=await pageSnapshot(cdp);
    assert(s.scrollWidth<=s.width+1,`Horizontal overflow at ${width}px: ${s.scrollWidth}>${s.width}`);
    assert(s.maxButtonHeight<=72,`Oversized button at ${width}px: ${s.maxButtonHeight}px`);
    assert(!s.text.includes('Loading current project'),'Application remained on loading state.');
  }

  await click(cdp,'[data-view="Workflow"]');await waitExpr(cdp,`document.body.innerText.includes('Stage 02')`);
  await evalValue(cdp,`(()=>{const b=[...document.querySelectorAll('[data-stage="1"]')].at(-1);if(!b)return false;b.click();return true})()`);await sleep(250);
  await waitExpr(cdp,`document.body.innerText.includes('Stage 01')`);
  assert(await evalValue(cdp,`document.querySelectorAll('[data-stage-field]').length>5`),'Stage 01 structured fields are not rendered.');
  const prompt=await evalValue(cdp,`document.querySelector('#generated-prompt')?.textContent||''`);
  assert(prompt.includes('COPY BLOCK — STAGE 01')&&prompt.includes('JOB_ID: JOB-20260823144121')&&prompt.includes('UNIVERSAL OPERATING RULES'),'Complete Stage 01 generated instruction is not rendered.');
  const output=await evalValue(cdp,`document.querySelector('#stage-output')?.value||''`);
  assert(output.includes('OPERATION 01 — DEFINE JOB')&&output.includes('OPERATION 01 COMPLETION EVIDENCE'),'Complete Operation 01 output is not rendered.');

  await click(cdp,'[data-view="Records"]');await waitExpr(cdp,`document.body.innerText.includes('Complete project record')`);
  const records=await pageSnapshot(cdp);
  for(const text of ['Original user-entered data','Generated instructions','Generated outputs','Output receipts'])assert(records.text.includes(text),`Records view is missing ${text}.`);

  await click(cdp,'[data-view="Workflow"]');await evalValue(cdp,`(()=>{const b=[...document.querySelectorAll('[data-stage="2"]')].at(-1);if(!b)return false;b.click();return true})()`);await sleep(250);
  await waitExpr(cdp,`document.body.innerText.includes('Stage 02')`);
  const editable=await evalValue(cdp,`document.querySelector('[data-stage-field]')?.dataset.stageField||''`);assert(editable,'Stage 02 has no structured data field.');
  await fill(cdp,`[data-stage-field="${editable}"]`,'BROWSER-PERSISTENCE-CHECK');await click(cdp,'#save-stage-work');
  await waitExpr(cdp,`localStorage.getItem('closed-loop-reliability-projects-v3')?.includes('BROWSER-PERSISTENCE-CHECK')`);
  await evalValue(cdp,`location.reload();true`);await sleep(500);await waitExpr(cdp,`document.body.innerText.includes('Mobile Closed-Loop Agent Reliability Workbook')`);
  await click(cdp,'[data-view="Workflow"]');await evalValue(cdp,`(()=>{const b=[...document.querySelectorAll('[data-stage="2"]')].at(-1);if(!b)return false;b.click();return true})()`);await sleep(250);
  const persisted=await evalValue(cdp,`document.querySelector('[data-stage-field="${editable}"]')?.value||''`);assert(persisted==='BROWSER-PERSISTENCE-CHECK','Stage data did not survive refresh.');
  assert(await evalValue(cdp,`document.body.innerText.includes('Add supporting record')`),'Contextual Appendix controls are not available.');

  await click(cdp,'#new-project');await sleep(300);
  const afterNew=await evalValue(cdp,`document.querySelectorAll('#project-picker option').length`);assert(afterNew>=2,'New project did not coexist with retained project.');
  await evalValue(cdp,`location.reload();true`);await sleep(500);await waitExpr(cdp,`document.querySelectorAll('#project-picker option').length>=2`);
  const selectorText=await evalValue(cdp,`document.querySelector('#project-picker').innerText`);assert(selectorText.includes('Mobile Closed-Loop Agent Reliability Workbook'),'Retained project disappeared after creating/reloading another project.');

  const errors=cdp.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&['error','assert'].includes(e.params?.entry?.level)));
  assert(errors.length===0,`Browser/runtime errors detected: ${errors.map(x=>JSON.stringify(x.params)).join('\n')}`);
  console.log(JSON.stringify({browserVerified:true,widths:[320,393,1280],retainedProject:true,stage1Instruction:true,stage1Output:true,records:true,stage2Persistence:true,newProjectCoexists:true,horizontalOverflow:false,oversizedButtons:false,runtimeErrors:0},null,2));
  cdp.close();
}
async function cleanup(){
  if(!proc.killed)proc.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),sleep(2000)]);
  for(let attempt=0;attempt<5;attempt++){
    try{fs.rmSync(userData,{recursive:true,force:true,maxRetries:3,retryDelay:100});return;}catch(e){if(attempt===4)console.warn(`Browser profile cleanup warning: ${e.message}`);else await sleep(200);}
  }
}
try{await main();}finally{await cleanup();}
