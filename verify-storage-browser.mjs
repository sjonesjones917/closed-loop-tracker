import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PAGE_URL=process.env.PAGE_URL;
if(!PAGE_URL)throw new Error('PAGE_URL is required');
const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
if(!browser)throw new Error('Chrome/Chromium was not found');
const port=11222+Math.floor(Math.random()*400),profile=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-storage-'));
const proc=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url,opts){const r=await fetch(url,opts);if(!r.ok)throw new Error(`${url} -> ${r.status}`);return r.json();}
async function poll(fn,timeout=18000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{return await fn();}catch(e){last=e;await sleep(120);}}throw last||new Error('Timed out');}
class CDP{constructor(ws){this.ws=new WebSocket(ws);this.id=0;this.pending=new Map();this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);};}async send(method,params={}){await this.ready;const id=++this.id,p=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method,params}));return p;}close(){this.ws.close();}}
const evaluate=async(cdp,expression)=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'Evaluation failed');return r.result?.value;};
const assert=(v,m)=>{if(!v)throw new Error(m);};
async function waitExpr(cdp,expression,timeout=18000){return poll(async()=>{const v=await evaluate(cdp,expression);if(!v)throw new Error(`Waiting: ${expression}`);return v;},timeout);}
async function click(cdp,selector){assert(await evaluate(cdp,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.click();return true})()`),`Missing ${selector}`);await sleep(25);}

try{
  await poll(()=>json(`http://127.0.0.1:${port}/json/version`));
  const target=await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${PAGE_URL}?storage-verify=${Date.now()}`)}`,{method:'PUT'});
  const cdp=new CDP(target.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('DOMStorage.enable');
  await waitExpr(cdp,`document.readyState==='complete'&&globalThis.closedLoopStorageReliability?.revision==='closed-loop-storage-20260824-r2'&&globalThis.closedLoopStorageReliability?.metrics().installed===true`);
  await evaluate(cdp,`window.__alerts=[];window.alert=m=>window.__alerts.push(String(m));localStorage.clear();location.reload();true`);await sleep(650);
  await waitExpr(cdp,`document.body.innerText.includes('1/30 complete')&&globalThis.closedLoopStorageReliability?.revision==='closed-loop-storage-20260824-r2'&&globalThis.closedLoopStorageReliability?.metrics().installed===true`);
  await evaluate(cdp,`window.__alerts=[];window.alert=m=>window.__alerts.push(String(m));true`);
  const storeKey='closed-loop-reliability-projects-v3',backupKey=`${storeKey}-preserved-backup`,origin=new URL(PAGE_URL).origin;
  const primary=await evaluate(cdp,`localStorage.getItem(${JSON.stringify(storeKey)})`);assert(primary&&primary.includes('JOB-20260823144121'),'Primary retained-project store is missing.');

  await cdp.send('DOMStorage.setDOMStorageItem',{storageId:{securityOrigin:origin,isLocalStorage:true},key:backupKey,value:primary});
  assert(await evaluate(cdp,`localStorage.getItem(${JSON.stringify(backupKey)})!==null`),'Could not seed a legacy redundant backup for recovery testing.');
  await evaluate(cdp,`location.reload();true`);await sleep(650);await waitExpr(cdp,`globalThis.closedLoopStorageReliability?.revision==='closed-loop-storage-20260824-r2'&&globalThis.closedLoopStorageReliability?.metrics().installed===true`);
  assert(await evaluate(cdp,`localStorage.getItem(${JSON.stringify(backupKey)})===null`),'Redundant full-store backup was not reclaimed on startup.');
  assert(await evaluate(cdp,`localStorage.getItem(${JSON.stringify(storeKey)})?.includes('JOB-20260823144121')`),'Backup reclamation damaged the retained project.');

  await evaluate(cdp,`window.__alerts=[];window.alert=m=>window.__alerts.push(String(m));(()=>{for(let i=0;i<40;i++){try{localStorage.setItem('__quota_nav_'+i,'x'.repeat(250000));}catch{break;}}window.__alerts=[];return true})()`);
  const before=await evaluate(cdp,`localStorage.getItem(${JSON.stringify(storeKey)})`);
  for(let i=0;i<250;i++){
    for(const view of ['Overview','Workflow','Records','Files'])await click(cdp,`[data-view="${view}"]`);
  }
  const alerts=await evaluate(cdp,`window.__alerts.slice()`);assert(alerts.length===0,`Pure navigation produced storage alerts under quota pressure: ${alerts.join(' | ')}`);
  const after=await evaluate(cdp,`localStorage.getItem(${JSON.stringify(storeKey)})`);assert(before===after,'Pure navigation rewrote the full project store.');
  const metrics=await evaluate(cdp,`globalThis.closedLoopStorageReliability.metrics()`);assert(metrics.skippedWrites>=1000,`Expected at least 1000 skipped navigation writes, observed ${metrics.skippedWrites}.`);

  await evaluate(cdp,`(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('__quota_nav_'))localStorage.removeItem(k);window.__alerts=[];return true})()`);
  await click(cdp,'[data-view="Project"]');
  const owner='STORAGE-RECOVERY-'+Date.now();
  assert(await evaluate(cdp,`(()=>{const e=document.querySelector('[data-job="JOB_OWNER"]');if(!e)return false;e.value=${JSON.stringify(owner)};e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`),'JOB_OWNER input unavailable.');
  await click(cdp,'#save-job');await sleep(250);
  assert(await evaluate(cdp,`localStorage.getItem(${JSON.stringify(storeKey)})?.includes(${JSON.stringify(owner)})`),'A real project save did not persist after quota pressure was removed.');
  assert((await evaluate(cdp,`window.__alerts.slice()`)).length===0,'Recovered real save still produced a storage error.');

  console.log(JSON.stringify({storageReliabilityVerified:true,revision:'closed-loop-storage-20260824-r2',outerGuardInstalled:true,redundantBackupReclaimed:true,retainedProjectPreserved:true,quotaPressureApplied:true,navigationActions:1000,navigationAlerts:0,fullStoreNavigationWrites:0,realSaveAfterRecovery:true},null,2));
  cdp.close();
}finally{
  if(!proc.killed)proc.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),sleep(1800)]);
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}
}