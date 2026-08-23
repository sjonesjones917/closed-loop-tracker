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
async function click(cdp,selector){const ok=await evalValue(cdp,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.click();return true})()`);assert(ok,`Missing clickable ${selector}`);await sleep(220);}
async function fill(cdp,selector,value){const ok=await evalValue(cdp,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);assert(ok,`Missing input ${selector}`);}
async function setWidth(cdp,width,height=900){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await sleep(150);}
async function pageSnapshot(cdp){return evalValue(cdp,`(()=>({text:document.body.innerText,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,maxButtonHeight:Math.max(0,...[...document.querySelectorAll('button')].map(x=>x.getBoundingClientRect().height)),title:document.title}))()`);}
async function openStage(cdp,n){await click(cdp,'[data-view="Workflow"]');await evalValue(cdp,`(()=>{const s=document.querySelector('#stage-picker');if(!s)return false;s.value=${JSON.stringify(String(n))};s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);await sleep(180);await waitExpr(cdp,`document.body.innerText.includes('Stage ${String(n).padStart(2,'0')}')`);}

async function main(){
  await poll(()=>json(`http://127.0.0.1:${port}/json/version`));
  const target=await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${PAGE_URL}?browser-verify=${Date.now()}`)}`,{method:'PUT'});
  const cdp=new CDP(target.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Log.enable');
  await waitExpr(cdp,`document.readyState==='complete'`);
  await waitExpr(cdp,`document.body.innerText.includes('Mobile Closed-Loop Agent Reliability Workbook')`);
  await evalValue(cdp,`localStorage.clear();location.reload();true`);await sleep(600);await waitExpr(cdp,`document.body.innerText.includes('1/30 complete')`);
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

  await click(cdp,'[data-view="Project"]');
  await fill(cdp,'[data-job="JOB_OWNER"]','BROWSER OWNER CHECK');await click(cdp,'#save-job');
  await click(cdp,'[data-view="Overview"]');const preservedState=await pageSnapshot(cdp);
  assert(preservedState.text.includes('READY'),'Saving a non-controlling project field incorrectly changed READY state.');
  assert(preservedState.text.includes('STAGE 02'),'Saving a non-controlling project field incorrectly moved the current stage.');

  await openStage(cdp,1);
  assert(await evalValue(cdp,`document.querySelectorAll('[data-stage-field]').length>5`),'Stage 01 structured fields are not rendered.');
  const prompt=await evalValue(cdp,`document.querySelector('#generated-prompt')?.textContent||''`);
  assert(prompt.includes('COPY BLOCK — STAGE 01')&&prompt.includes('JOB_ID: JOB-20260823144121')&&prompt.includes('UNIVERSAL OPERATING RULES'),'Complete Stage 01 generated instruction is not rendered.');
  await click(cdp,'#copy-prompt');
  const output=await evalValue(cdp,`document.querySelector('#stage-output')?.value||''`);
  assert(output.includes('OPERATION 01 — DEFINE JOB')&&output.includes('OPERATION 01 COMPLETION EVIDENCE'),'Complete Operation 01 output is not rendered.');

  await evalValue(cdp,`(()=>{for(const e of document.querySelectorAll('[data-appendix="B"]')){const f=e.dataset.appendixField;e.value=f==='BLOCKER_ID'?'BROWSER-BLOCKER-001':f==='CURRENT_STATUS'?'OPEN':f==='STAGE_DISCOVERED'?'STAGE 01':'UNKNOWN';}return true})()`);
  await click(cdp,'[data-save-appendix="B"]');
  await openStage(cdp,2);
  assert(await evalValue(cdp,`document.body.innerText.includes('Open blocker BROWSER-BLOCKER-001 stops downstream work.')`),'Open blocker did not block downstream Stage 02.');
  assert(await evalValue(cdp,`[...document.querySelectorAll('[data-stage-field]')].every(x=>x.disabled)`),'Blocked downstream stage still allowed stage editing.');

  await openStage(cdp,1);
  await evalValue(cdp,`(()=>{for(const e of document.querySelectorAll('[data-appendix="B"]')){const f=e.dataset.appendixField;e.value=f==='BLOCKER_ID'?'BROWSER-BLOCKER-001':f==='CURRENT_STATUS'?'RESOLVED':f==='STAGE_DISCOVERED'?'STAGE 01':f==='RESOLUTION_EVIDENCE'?'Browser verification resolution evidence':'UNKNOWN';}return true})()`);
  await click(cdp,'[data-save-appendix="B"]');
  await openStage(cdp,2);
  assert(!await evalValue(cdp,`document.body.innerText.includes('Open blocker BROWSER-BLOCKER-001 stops downstream work.')`),'Resolved blocker continued to stop downstream work.');
  assert(await evalValue(cdp,`document.querySelectorAll('[data-record-collection="sources"]').length>=5`),'Stage 02 structured source-record editor is missing.');
  await evalValue(cdp,`(()=>{for(const e of document.querySelectorAll('[data-record-collection="sources"]')){const f=e.dataset.recordField;e.value=f==='SOURCE_ID'?'SOURCE-BROWSER-001':f==='TYPE'?'User supplied input':f==='INSPECTION_STATE'?'INSPECTED':'UNKNOWN';}return true})()`);
  await click(cdp,'[data-add-record="sources"]');
  assert(await evalValue(cdp,`localStorage.getItem('closed-loop-reliability-projects-v3')?.includes('SOURCE-BROWSER-001')`),'Structured source record was not persisted.');

  const editable=await evalValue(cdp,`document.querySelector('[data-stage-field]')?.dataset.stageField||''`);assert(editable,'Stage 02 has no structured stage field.');
  await fill(cdp,`[data-stage-field="${editable}"]`,'BROWSER-PERSISTENCE-CHECK');
  await fill(cdp,'#stage-output','BROWSER STAGE 02 OUTPUT RECEIPT CHECK');await click(cdp,'#record-output');
  await click(cdp,'#save-stage-work');
  await waitExpr(cdp,`localStorage.getItem('closed-loop-reliability-projects-v3')?.includes('BROWSER-PERSISTENCE-CHECK')`);
  await evalValue(cdp,`location.reload();true`);await sleep(600);await waitExpr(cdp,`document.body.innerText.includes('Mobile Closed-Loop Agent Reliability Workbook')`);
  await openStage(cdp,2);
  const persisted=await evalValue(cdp,`document.querySelector('[data-stage-field="${editable}"]')?.value||''`);assert(persisted==='BROWSER-PERSISTENCE-CHECK','Stage data did not survive refresh.');
  assert(await evalValue(cdp,`document.body.innerText.includes('Add supporting record')`),'Contextual Appendix controls are not available.');

  await click(cdp,'[data-view="Records"]');await waitExpr(cdp,`document.body.innerText.includes('Complete project record')`);
  const records=await pageSnapshot(cdp);
  for(const text of ['Original user-entered data','Generated instructions','Generated outputs','Output receipts','Sources','Blockers'])assert(records.text.includes(text),`Records view is missing ${text}.`);
  const openedOutputs=await evalValue(cdp,`(()=>{const d=[...document.querySelectorAll('details.record-card')].find(x=>x.querySelector(':scope>summary')?.textContent.includes('Generated outputs'));if(!d)return false;d.open=true;return true})()`);
  assert(openedOutputs,'Generated outputs record group could not be opened.');
  await waitExpr(cdp,`document.body.innerText.includes('BROWSER STAGE 02 OUTPUT RECEIPT CHECK')`);

  for(let n=1;n<=30;n++){
    await openStage(cdp,n);
    assert(await evalValue(cdp,`document.querySelector('#stage-picker')?.value===${JSON.stringify(String(n))}`),`Stage ${n} could not be reached.`);
  }

  await click(cdp,'#new-project');await sleep(250);const id1=await evalValue(cdp,`document.querySelector('[data-job="JOB_ID"]')?.value||''`);
  await click(cdp,'#new-project');await sleep(250);const id2=await evalValue(cdp,`document.querySelector('[data-job="JOB_ID"]')?.value||''`);
  assert(id1&&id2&&id1!==id2,'Rapid new-job creation produced duplicate JOB_ID values.');
  const afterNew=await evalValue(cdp,`document.querySelectorAll('#project-picker option').length`);assert(afterNew>=3,'New projects did not coexist with retained project.');

  const imported=await evalValue(cdp,`(async()=>{const stored=JSON.parse(localStorage.getItem('closed-loop-reliability-projects-v3'));const src=stored.find(p=>p.job?.JOB_ID==='JOB-20260823144121');const copy=JSON.parse(JSON.stringify(src));copy.job.JOB_ID='JOB-BROWSER-IMPORT-001';copy.job.JOB_TITLE='Browser import preservation check';copy.extraPreserved={unknownField:'PRESERVE-ME'};const file=new File([JSON.stringify(copy)],'browser-import.json',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('#import-file');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,400));return document.querySelector('#project-picker').innerText.includes('Browser import preservation check')&&localStorage.getItem('closed-loop-reliability-projects-v3').includes('PRESERVE-ME');})()`);
  assert(imported,'Import did not preserve complete project data and unknown fields.');

  const exportOk=await evalValue(cdp,`(async()=>{let blob;const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL,oldClick=HTMLAnchorElement.prototype.click;URL.createObjectURL=b=>(blob=b,'blob:browser-test');URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};document.querySelector('#export-project').click();await new Promise(r=>setTimeout(r,50));const text=blob?await blob.text():'';URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;HTMLAnchorElement.prototype.click=oldClick;const obj=JSON.parse(text);return obj.job.JOB_ID==='JOB-BROWSER-IMPORT-001'&&Object.keys(obj.stages||{}).length===30&&obj.extraPreserved?.unknownField==='PRESERVE-ME';})()`);
  assert(exportOk,'Export did not preserve the complete imported project.');

  await evalValue(cdp,`location.reload();true`);await sleep(600);await waitExpr(cdp,`document.querySelectorAll('#project-picker option').length>=4`);
  const selectorText=await evalValue(cdp,`document.querySelector('#project-picker').innerText`);assert(selectorText.includes('Mobile Closed-Loop Agent Reliability Workbook'),'Retained project disappeared after creating/importing/reloading other projects.');
  const retainedCount=await evalValue(cdp,`[...document.querySelectorAll('#project-picker option')].filter(x=>x.textContent.includes('Mobile Closed-Loop Agent Reliability Workbook')).length`);assert(retainedCount===1,'Retained project was duplicated.');

  const errors=cdp.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&['error','assert'].includes(e.params?.entry?.level)));
  assert(errors.length===0,`Browser/runtime errors detected: ${errors.map(x=>JSON.stringify(x.params)).join('\n')}`);
  console.log(JSON.stringify({browserVerified:true,widths:[320,393,1280],retainedProject:true,stage1Instruction:true,stage1Output:true,records:true,structuredRecords:true,blockerLifecycle:true,stage2Persistence:true,all30StagesReachable:true,uniqueNewJobs:true,importExport:true,newProjectCoexists:true,horizontalOverflow:false,oversizedButtons:false,runtimeErrors:0},null,2));
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
