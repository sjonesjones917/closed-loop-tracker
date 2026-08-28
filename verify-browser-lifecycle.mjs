import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PAGE_URL=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
if(!browser)throw new Error('Chrome/Chromium was not found');
const port=9950+Math.floor(Math.random()*40),profile=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-lifecycle-'));
const proc=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m);};
async function getJson(url,opts){const r=await fetch(url,opts);if(!r.ok)throw new Error(`${url} -> ${r.status}`);return r.json();}
async function poll(fn,timeout=20000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{return await fn();}catch(e){last=e;await sleep(120);}}throw last||new Error('Timed out');}
class CDP{constructor(wsUrl){this.ws=new WebSocket(wsUrl);this.id=0;this.pending=new Map();this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);};}async send(method,params={}){await this.ready;const id=++this.id,p=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method,params}));return p;}close(){this.ws.close();}}
async function evalValue(cdp,expression){const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text||'Evaluation failed');return r.result?.value;}
async function waitExpr(cdp,expression,timeout=20000){return poll(async()=>{const v=await evalValue(cdp,expression);if(!v)throw new Error(`Waiting: ${expression}`);return v;},timeout);}
async function click(cdp,selector){const ok=await evalValue(cdp,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.click();return true})()`);assert(ok,`Missing clickable ${selector}`);await sleep(160);}
async function fill(cdp,selector,value){const ok=await evalValue(cdp,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);assert(ok,`Missing input ${selector}`);}
async function snapshot(cdp){return evalValue(cdp,`(async()=>{const id=document.querySelector('#current-project-summary')?.textContent?.split(' · ')[0]||'';const all=await closedLoopProjectStore.readAll();return {id,count:all.length,ids:all.map(p=>p.job?.JOB_ID),selected:await closedLoopProjectStore.metaGet('selectedProject'),errors:window.__lifecycleErrors||[],alerts:window.__lifecycleAlerts||[],status:document.querySelector('#app-live-status')?.textContent||''};})()`);}
async function openProject(cdp){await click(cdp,'[data-view="Project"]');await waitExpr(cdp,`Boolean(document.querySelector('#project-management'))`);await evalValue(cdp,`document.querySelector('#project-management').open=true`);}
async function assertNoBrowserErrors(cdp,label){const state=await snapshot(cdp);assert(state.errors.length===0,`${label}: ${state.errors.join(' | ')}`);return state;}

async function main(){
  await poll(()=>getJson(`http://127.0.0.1:${port}/json/version`),20000);
  const target=await getJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${PAGE_URL}?lifecycle=${Date.now()}`)}`,{method:'PUT'}),cdp=new CDP(target.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Runtime.enable');
  try{
    await waitExpr(cdp,`globalThis.closedLoopAppReady===true`,20000);
    await evalValue(cdp,`(()=>{window.__lifecycleErrors=[];window.__lifecycleAlerts=[];addEventListener('unhandledrejection',e=>window.__lifecycleErrors.push(String(e.reason?.stack||e.reason||'unhandled rejection')));addEventListener('error',e=>window.__lifecycleErrors.push(String(e.error?.stack||e.message||'window error')));window.alert=m=>window.__lifecycleAlerts.push(String(m));return true})()`);

    console.log('lifecycle:new-project');await click(cdp,'#new-project');await waitExpr(cdp,`document.body.innerText.includes('Save User Job Input')`);const base=await assertNoBrowserErrors(cdp,'new project');assert(base.id,'New project did not become current.');

    console.log('lifecycle:rename');await openProject(cdp);await fill(cdp,'#project-display-name','Lifecycle operator proof');await click(cdp,'#rename-project');await waitExpr(cdp,`document.querySelector('#current-project-summary')?.textContent.includes('Lifecycle operator proof')`);await assertNoBrowserErrors(cdp,'rename');

    console.log('lifecycle:duplicate');await openProject(cdp);const before=await snapshot(cdp);await click(cdp,'#duplicate-project');await waitExpr(cdp,`document.querySelector('#current-project-summary')?.textContent?.split(' · ')[0]!==${JSON.stringify(before.id)}`,30000);const copy=await assertNoBrowserErrors(cdp,'duplicate');assert(copy.count===before.count+1,'Start from copy did not create exactly one project.');assert(copy.selected===copy.id,'Start from copy did not persist the new selected project.');const copyId=copy.id;
    const copiedProject=await evalValue(cdp,`closedLoopProjectStore.readAll().then(all=>all.find(p=>p.job?.JOB_ID===${JSON.stringify(copyId)}))`);assert(copiedProject?.job?.CURRENT_STAGE==='STAGE 01','Copied project is not reset to Stage 01.');assert((copiedProject?.projectData?.generatedPrompts||[]).length===0&&(copiedProject?.projectData?.verification||[]).length===0,'Copied project carried operational history forward.');

    console.log('lifecycle:archive-restore');await openProject(cdp);await click(cdp,'#archive-project');await waitExpr(cdp,`document.querySelector('#current-project-summary')?.textContent?.split(' · ')[0]!==${JSON.stringify(copyId)}`);await openProject(cdp);const restoreSelector=`[data-restore-project="${copyId}"]`;await waitExpr(cdp,`Boolean(document.querySelector(${JSON.stringify(restoreSelector)}))`);await click(cdp,restoreSelector);await waitExpr(cdp,`document.querySelector('#current-project-summary')?.textContent?.split(' · ')[0]===${JSON.stringify(copyId)}`);await assertNoBrowserErrors(cdp,'archive/restore');

    console.log('lifecycle:backup');await openProject(cdp);await evalValue(cdp,`(()=>{window.__backupBlob=null;window.__backupName='';window.__nativeCreateObjectURL=URL.createObjectURL;window.__nativeRevokeObjectURL=URL.revokeObjectURL;URL.createObjectURL=b=>{window.__backupBlob=b;return 'blob:lifecycle-proof';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){window.__backupName=this.download;};return true})()`);await click(cdp,'#backup-project');await waitExpr(cdp,`Boolean(window.__backupBlob)`);const backup=await evalValue(cdp,`({size:window.__backupBlob?.size||0,name:window.__backupName})`);assert(backup.size>0&&backup.name.includes('.backup.closed-loop.json.gz'),'Create backup did not produce a non-empty complete backup package.');await assertNoBrowserErrors(cdp,'backup');

    console.log('lifecycle:verify-stored-files');await openProject(cdp);await click(cdp,'#verify-stored-files');await waitExpr(cdp,`document.querySelector('#app-live-status')?.textContent?.includes('stored artifact')`);const verification=await evalValue(cdp,`({status:document.querySelector('#app-live-status')?.textContent||'',openCustody:closedLoopProjectStore.readAll().then(all=>{const p=all.find(x=>x.job?.JOB_ID===${JSON.stringify(copyId)});return (p?.projectData?.blockers||[]).filter(b=>b.source==='APPLICATION'&&b.applicationBlockerKind==='ARTIFACT_CUSTODY'&&String(b.fields?.STATUS||b.STATUS).toUpperCase()==='OPEN').length;})})`);const custodyCount=await evalValue(cdp,`closedLoopProjectStore.readAll().then(all=>{const p=all.find(x=>x.job?.JOB_ID===${JSON.stringify(copyId)});return (p?.projectData?.blockers||[]).filter(b=>b.source==='APPLICATION'&&b.applicationBlockerKind==='ARTIFACT_CUSTODY'&&String(b.fields?.STATUS||b.STATUS).toUpperCase()==='OPEN').length;})`);assert(custodyCount===0,'Verifying a project with no mismatched stored artifacts created a false custody blocker.');await assertNoBrowserErrors(cdp,'verify stored files');

    console.log('lifecycle:delete');await openProject(cdp);await evalValue(cdp,`document.querySelector('#project-danger-zone').open=true`);await fill(cdp,'#delete-project-confirmation',copyId);await waitExpr(cdp,`document.querySelector('#delete-project')?.disabled===false`);await click(cdp,'#delete-project');await waitExpr(cdp,`closedLoopProjectStore.readAll().then(all=>!all.some(p=>p.job?.JOB_ID===${JSON.stringify(copyId)}))`,20000);const deleted=await assertNoBrowserErrors(cdp,'delete');assert(deleted.id!==copyId,'Deleted project remained current.');assert(deleted.selected!==copyId,'Deleted project remained selected in metadata.');

    console.log(JSON.stringify({lifecycleOperatorPath:true,newProject:true,rename:true,duplicate:true,archiveRestore:true,backup:true,verifyStoredFiles:true,delete:true}));
  } finally {cdp.close();}
}
main().catch(error=>{console.error(error?.stack||error);process.exitCode=1;}).finally(()=>{proc.kill('SIGTERM');});
