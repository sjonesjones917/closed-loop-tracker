import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PAGE_URL=process.env.PAGE_URL;
if(!PAGE_URL)throw new Error('PAGE_URL is required');
const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
if(!browser)throw new Error('Chrome/Chromium was not found');
const port=9722+Math.floor(Math.random()*300),profile=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-integrity-'));
const proc=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url,opts){const r=await fetch(url,opts);if(!r.ok)throw new Error(`${url} -> ${r.status}`);return r.json();}
async function poll(fn,timeout=15000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{return await fn();}catch(e){last=e;await sleep(150);}}throw last||new Error('Timed out');}
class CDP{constructor(ws){this.ws=new WebSocket(ws);this.id=0;this.pending=new Map();this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);};}async send(method,params={}){await this.ready;const id=++this.id,p=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method,params}));return p;}close(){this.ws.close();}}
const value=async(cdp,expression)=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'Evaluation failed');return r.result?.value;};
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
async function waitExpr(cdp,expression,timeout=15000){return poll(async()=>{const result=await value(cdp,expression);if(!result)throw new Error(`Waiting: ${expression}`);return result;},timeout);}
async function click(cdp,selector){assert(await value(cdp,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.click();return true})()`),`Missing ${selector}`);}
async function fill(cdp,selector,text){assert(await value(cdp,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.value=${JSON.stringify(text)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`),`Missing ${selector}`);}
async function setWidth(cdp,width,height=900){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await sleep(180);}
async function waitForAppShell(cdp){
  await waitExpr(cdp,`document.body.innerText.includes('Mobile Closed-Loop Agent Reliability Workbook')`);
  await waitExpr(cdp,`globalThis.closedLoopIntegrityGuard===true`);
  await waitExpr(cdp,`document.querySelectorAll('#view-tabs [data-view]').length>=6`);
  await waitExpr(cdp,`document.querySelector('[data-view="Project"]')`);
}

async function main(){
  await poll(()=>json(`http://127.0.0.1:${port}/json/version`));
  const target=await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${PAGE_URL}?integrity-browser=${Date.now()}`)}`,{method:'PUT'}),cdp=new CDP(target.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');
  await waitExpr(cdp,`document.readyState==='complete'`);await waitForAppShell(cdp);
  await value(cdp,`localStorage.clear();location.reload();true`);await waitForAppShell(cdp);await waitExpr(cdp,`document.body.innerText.includes('1/30 complete')`);

  await setWidth(cdp,393,900);
  const mobile=await value(cdp,`(()=>{const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};const controls=[...document.querySelectorAll('button,select,input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])')].filter(e=>visible(e)&&!e.disabled);const text=[...document.querySelectorAll('.brand-kicker,.brand p,.project-select label,.view-tabs button,.fact span,.status,.field label,.field .help,.record-key,.record-value,.stage-number,.stage-name,.stage-meta,.record-card>summary')].filter(visible);return {minControl:Math.min(...controls.map(e=>e.getBoundingClientRect().height)),minText:Math.min(...text.map(e=>parseFloat(getComputedStyle(e).fontSize))),columns:getComputedStyle(document.querySelector('.facts')).gridTemplateColumns.split(' ').length};})()`);
  assert(mobile.minControl>=44,`Mobile touch target below 44px: ${mobile.minControl}`);
  assert(mobile.minText>=11,`Mobile supporting text below 11px: ${mobile.minText}`);
  assert(mobile.columns===1,`393px summary facts remain ${mobile.columns} columns instead of one.`);
  await setWidth(cdp,1280,1000);

  await click(cdp,'[data-view="Project"]');await waitExpr(cdp,`document.querySelector('#save-job')?.dataset.integrityGuard==='1'`);
  await value(cdp,`window.__integrityAlerts=[];window.alert=m=>window.__integrityAlerts.push(String(m));true`);
  assert(await value(cdp,`document.querySelector('[data-job="JOB_ID"]')?.readOnly===true`),'JOB_ID is not read-only.');
  const retained='JOB-20260823144121';
  await fill(cdp,'[data-job="JOB_ID"]','');await click(cdp,'#save-job');await sleep(150);
  assert(await value(cdp,`document.querySelector('[data-job="JOB_ID"]')?.value===${JSON.stringify(retained)}`),'Blank JOB_ID was not rejected and restored.');
  assert(await value(cdp,`window.__integrityAlerts.some(x=>x.includes('JOB_ID is immutable'))`),'Immutable JOB_ID rejection was not surfaced.');
  assert(await value(cdp,`JSON.parse(localStorage.getItem('closed-loop-reliability-projects-v3')).some(p=>p.job?.JOB_ID===${JSON.stringify(retained)})`),'Retained JOB_ID changed after rejected edit.');

  const changedValue='INTEGRITY-INVALIDATION-CHECK-'+Date.now();
  await fill(cdp,'[data-job="REQUIRED_OUTPUT_FORMAT"]',changedValue);await click(cdp,'#save-job');
  await waitExpr(cdp,`(()=>{const p=JSON.parse(localStorage.getItem('closed-loop-reliability-projects-v3')||'[]').find(x=>x.job?.JOB_ID===${JSON.stringify(retained)});return p?.stages?.['1']?.status==='NOT READY'&&p?.projectData?.stageRecords?.['1']?.status==='NOT READY';})()`,20000);
  await waitExpr(cdp,`document.body.innerText.includes('0/30 complete')`,20000);
  const invalidated=await value(cdp,`(()=>{const p=JSON.parse(localStorage.getItem('closed-loop-reliability-projects-v3')).find(x=>x.job?.JOB_ID===${JSON.stringify(retained)});return {stage:p.stages['1'].status,record:p.projectData.stageRecords['1'].status,decision:p.projectData.stageRecords['1'].decision,outputs:p.projectData.generatedOutputs.length,prompts:p.projectData.generatedPrompts.length,jobRevisions:p.jobRevisions.length};})()`);
  assert(invalidated.stage==='NOT READY'&&invalidated.record==='NOT READY','Stage 01 invalidation representations disagree.');
  assert(!invalidated.decision,'Invalidated authoritative Stage 01 record kept a completed decision.');
  assert(invalidated.outputs>=1&&invalidated.prompts>=1,'Historical Stage 01 evidence was lost during invalidation.');
  assert(invalidated.jobRevisions>=1,'Controlling-input change was not revision-recorded.');

  await waitExpr(cdp,`document.querySelector('[data-view="Project"]')`);await click(cdp,'[data-view="Project"]');await waitExpr(cdp,`document.querySelector('#save-job')?.dataset.integrityGuard==='1'`);await value(cdp,`window.__integrityAlerts=[];window.alert=m=>window.__integrityAlerts.push(String(m));true`);
  const countBefore=await value(cdp,`document.querySelectorAll('#project-picker option').length`);
  const duplicateRejected=await value(cdp,`(async()=>{const p=JSON.parse(localStorage.getItem('closed-loop-reliability-projects-v3')).find(x=>x.job?.JOB_ID===${JSON.stringify(retained)});const file=new File([JSON.stringify(p)],'duplicate.json',{type:'application/json'}),dt=new DataTransfer(),input=document.querySelector('#import-file');dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,300));return window.__integrityAlerts.some(x=>x.includes('already exists'));})()`);
  assert(duplicateRejected,'Duplicate imported JOB_ID was not rejected.');
  const countAfter=await value(cdp,`document.querySelectorAll('#project-picker option').length`);assert(countAfter===countBefore,'Rejected duplicate import changed the project set.');
  console.log(JSON.stringify({integrityVerified:true,renderReadinessDeterministic:true,mobileTouchTargets:true,mobileReadableType:true,mobileDensityReduced:true,jobIdImmutable:true,duplicateImportRejected:true,stage1InvalidationConsistent:true,historicalEvidencePreserved:true},null,2));
  cdp.close();
}
async function cleanup(){if(!proc.killed)proc.kill('SIGTERM');await Promise.race([new Promise(r=>proc.once('exit',r)),sleep(1500)]);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}}
try{await main();}finally{await cleanup();}