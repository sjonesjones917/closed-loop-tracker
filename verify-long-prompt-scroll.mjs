import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PAGE_URL=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
if(!browser)throw new Error('Chrome/Chromium was not found');
const port=9900+Math.floor(Math.random()*80),profile=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-long-prompt-'));
const proc=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
async function getJson(url,opts){const response=await fetch(url,opts);if(!response.ok)throw new Error(`${url} -> ${response.status}`);return response.json();}
async function poll(fn,timeout=20000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{return await fn();}catch(error){last=error;await sleep(120);}}throw last||new Error('Timed out');}
class CDP{constructor(ws){this.ws=new WebSocket(ws);this.id=0;this.pending=new Map();this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);};}async send(method,params={}){await this.ready;const id=++this.id,promise=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method,params}));return promise;}close(){this.ws.close();}}
async function evaluate(cdp,expression){const result=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Evaluation failed');return result.result?.value;}
async function waitFor(cdp,expression,timeout=20000){return poll(async()=>{const value=await evaluate(cdp,expression);if(!value)throw new Error(`Waiting: ${expression}`);return value;},timeout);}
async function click(cdp,selector){assert(await evaluate(cdp,`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;node.click();return true})()`),`Missing clickable ${selector}`);await sleep(160);}

async function main(){
  await poll(()=>getJson(`http://127.0.0.1:${port}/json/version`));
  const target=await getJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${PAGE_URL}?long-prompt-regression=${Date.now()}`)}`,{method:'PUT'}),cdp=new CDP(target.webSocketDebuggerUrl);
  await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});
  await waitFor(cdp,`document.readyState==='complete'`);await waitFor(cdp,`globalThis.closedLoopAppReady===true`);
  assert(!(await evaluate(cdp,'globalThis.closedLoopAppError')),await evaluate(cdp,'globalThis.closedLoopAppError'));
  await click(cdp,'#new-project');await waitFor(cdp,`Boolean(document.querySelector('[data-view="Workflow"]'))`);await click(cdp,'[data-view="Workflow"]');
  await evaluate(cdp,`(()=>{const select=document.querySelector('#stage-picker');if(!select)return false;select.value='4';select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  await waitFor(cdp,`document.body.innerText.includes('Stage 04')&&Boolean(document.querySelector('#generated-prompt'))`);
  const collapsed=await evaluate(cdp,`(()=>{const prompt=document.querySelector('#generated-prompt'),toggle=document.querySelector('#toggle-prompt');prompt.textContent=('STAGE 04 LONG PROMPT REGRESSION '+('X'.repeat(96))+'\\n').repeat(6000);const r=prompt.getBoundingClientRect();return {clientHeight:prompt.clientHeight,scrollHeight:prompt.scrollHeight,documentHeight:document.documentElement.scrollHeight,viewportHeight:innerHeight,expanded:prompt.classList.contains('expanded'),ariaExpanded:toggle?.getAttribute('aria-expanded'),top:r.top,bottom:r.bottom};})()`);
  assert(collapsed&&!collapsed.expanded&&collapsed.ariaExpanded==='false',`Prompt did not start collapsed: ${JSON.stringify(collapsed)}`);
  assert(collapsed.clientHeight<=282&&collapsed.scrollHeight>collapsed.clientHeight,`Long prompt fixture is not a bounded overflowing preview before expansion: ${JSON.stringify(collapsed)}`);
  await click(cdp,'#toggle-prompt');
  const expanded=await evaluate(cdp,`(()=>{const prompt=document.querySelector('#generated-prompt'),toggle=document.querySelector('#toggle-prompt'),style=getComputedStyle(prompt);const before=prompt.scrollTop;prompt.scrollTop=prompt.scrollHeight;const r=prompt.getBoundingClientRect();return {clientHeight:prompt.clientHeight,scrollHeight:prompt.scrollHeight,scrollTop:prompt.scrollTop,before,documentHeight:document.documentElement.scrollHeight,viewportHeight:innerHeight,expanded:prompt.classList.contains('expanded'),ariaExpanded:toggle?.getAttribute('aria-expanded'),overflowY:style.overflowY,overscrollBehaviorY:style.overscrollBehaviorY,top:r.top,bottom:r.bottom};})()`);
  assert(expanded?.expanded&&expanded.ariaExpanded==='true',`Long Stage 04 prompt did not enter expanded mode: ${JSON.stringify(expanded)}`);
  assert(expanded.clientHeight<=Math.ceil(expanded.viewportHeight*.8)+2,`Expanded Stage 04 prompt escaped the viewport height bound: ${JSON.stringify(expanded)}`);
  assert(expanded.scrollHeight>expanded.clientHeight&&expanded.scrollTop>0,`Expanded Stage 04 prompt is not internally scrollable to its bottom: ${JSON.stringify(expanded)}`);
  assert(['auto','scroll'].includes(expanded.overflowY),`Expanded Stage 04 prompt does not retain an internal overflow scroller: ${JSON.stringify(expanded)}`);
  assert(expanded.documentHeight<=collapsed.documentHeight+expanded.viewportHeight,`Expanding a long Stage 04 prompt created an unbounded document-height surface: collapsed=${collapsed.documentHeight} expanded=${expanded.documentHeight}`);
  assert(!(await evaluate(cdp,'globalThis.closedLoopAppError')),`Long-prompt scroll surfaced an application error: ${await evaluate(cdp,'globalThis.closedLoopAppError')}`);
  assert(await evaluate(cdp,`globalThis.closedLoopAppReady===true`),'Application stopped reporting ready after scrolling a long Stage 04 prompt.');
  await click(cdp,'#toggle-prompt');
  const recollapsed=await evaluate(cdp,`(()=>{const prompt=document.querySelector('#generated-prompt'),toggle=document.querySelector('#toggle-prompt');return {expanded:prompt.classList.contains('expanded'),ariaExpanded:toggle?.getAttribute('aria-expanded'),clientHeight:prompt.clientHeight,scrollHeight:prompt.scrollHeight,documentHeight:document.documentElement.scrollHeight};})()`);
  assert(!recollapsed.expanded&&recollapsed.ariaExpanded==='false'&&recollapsed.clientHeight<=282,`Long Stage 04 prompt did not return to the bounded collapsed state: ${JSON.stringify(recollapsed)}`);
  assert(!(await evaluate(cdp,'globalThis.closedLoopAppError')),`Collapsing the long prompt surfaced an application error: ${await evaluate(cdp,'globalThis.closedLoopAppError')}`);
  console.log(JSON.stringify({longPromptScrollRegression:true,stage:4,viewport:[393,852],fixtureLines:6000,viewportBounded:true,internallyScrollable:true,scrollToBottom:true,recollapseStable:true,runtimeErrors:0}));
  cdp.close();
}
async function cleanup(){if(!proc.killed)proc.kill('SIGTERM');await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),sleep(1000)]);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}}
try{await main();}finally{await cleanup();}
