import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {boundedBrowserCommand,fetchJsonWithTimeout,guardBrowserProcess} from './browser-verifier-lifecycle.mjs';

const PAGE_URL=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
if(!browser)throw new Error('Chrome/Chromium was not found');
const port=9700+Math.floor(Math.random()*200),profile=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-mobile-stage-'));
const proc=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const teardownBrowser=guardBrowserProcess(proc);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
async function getJson(url,opts){return fetchJsonWithTimeout(url,opts);}
async function poll(fn,timeout=20000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{return await fn();}catch(error){last=error;await sleep(120);}}throw last||new Error('Timed out');}
class CDP{constructor(ws){this.ws=new WebSocket(ws);this.id=0;this.pending=new Map();this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);};}async send(method,params={}){await boundedBrowserCommand(this.ready,'CDP websocket connection');const id=++this.id,promise=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method,params}));try{return await boundedBrowserCommand(promise,`CDP ${method}`);}finally{this.pending.delete(id);}}close(){this.ws.close();}}
async function evaluate(cdp,expression){const result=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Evaluation failed');return result.result?.value;}
async function waitFor(cdp,expression,timeout=20000){return poll(async()=>{const value=await evaluate(cdp,expression);if(!value)throw new Error(`Waiting: ${expression}`);return value;},timeout);}
async function click(cdp,selector){assert(await evaluate(cdp,`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;node.click();return true})()`),`Missing clickable ${selector}`);await sleep(160);}
async function fill(cdp,selector,value){assert(await evaluate(cdp,`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));return true})()`),`Missing input ${selector}`);}
async function setWidth(cdp,width,height=844){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=620});await sleep(150);}
async function openStage(cdp,stage){await click(cdp,'[data-view="Workflow"]');await evaluate(cdp,`(()=>{const select=document.querySelector('#stage-picker');if(!select)return false;select.value=${JSON.stringify(String(stage))};select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);await waitFor(cdp,`document.body.innerText.includes('Stage ${String(stage).padStart(2,'0')}')`);}

async function main(){
  await poll(()=>getJson(`http://127.0.0.1:${port}/json/version`));
  const target=await getJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${PAGE_URL}?mobile-stage-regression=${Date.now()}`)}`,{method:'PUT'}),cdp=new CDP(target.webSocketDebuggerUrl);
  await boundedBrowserCommand(cdp.ready,'CDP websocket connection');await cdp.send('Runtime.enable');await cdp.send('Page.enable');
  await waitFor(cdp,`document.readyState==='complete'`);await waitFor(cdp,`globalThis.closedLoopAppReady===true`);assert(!(await evaluate(cdp,'globalThis.closedLoopAppError')),await evaluate(cdp,'globalThis.closedLoopAppError'));
  await click(cdp,'#new-project');await waitFor(cdp,`Boolean(document.querySelector('[data-job="SUPPLIED_MATERIALS_INVENTORY"]'))`);
  const filename='MAINFRAME_INVENTION_DISCLOSURE_COUNSEL_READY_LOGIC_CLEAN_2_WITH_A_DELIBERATELY_LONG_UNBROKEN_MOBILE_FILENAME_1234567890.pdf';
  await fill(cdp,'[data-job="SUPPLIED_MATERIALS_INVENTORY"]',JSON.stringify([{type:'FILE',exactNameOrReference:filename}]));await click(cdp,'#save-job');
  await openStage(cdp,4);
  await evaluate(cdp,`(()=>{const next=document.querySelector('.stage-hero>.stage-action-strip>span:last-child');if(!next)return false;next.textContent='Send the Stage 04 instruction with '+${JSON.stringify(filename)}+'. The prompt does not include those materials.';return true})()`);
  await evaluate(cdp,"(()=>{const prompt=document.querySelector('#generated-prompt');if(!prompt)return false;prompt.textContent=Array.from({length:240},(_,index)=>`Prompt geometry regression line ${index+1}`).join('\\n');return true})()");
  for(const width of [320,393,1180]){
    await setWidth(cdp,width);
    const state=await evaluate(cdp,`(()=>{const filename=${JSON.stringify(filename)},strip=document.querySelector('.stage-hero>.stage-action-strip'),spans=[...strip?.querySelectorAll(':scope>span')||[]],copy=document.querySelector('#copy-prompt'),prompt=document.querySelector('#generated-prompt'),nodes=[...document.querySelectorAll('.notice,.stage-hero>.stage-action-strip>span')].filter(node=>node.textContent.includes(filename));const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight};};return {innerWidth,innerHeight,documentScroll:document.documentElement.scrollWidth,bodyScroll:document.body.scrollWidth,strip:strip&&rect(strip),spans:spans.map(rect),labels:spans.map(node=>getComputedStyle(node,'::before').content),filenameNodes:nodes.map(rect),copy:copy&&rect(copy),prompt:prompt&&rect(prompt),promptExpanded:prompt?.classList.contains('expanded'),toggleExpanded:document.querySelector('#toggle-prompt')?.getAttribute('aria-expanded'),filenamePresent:document.body.innerText.includes(filename)};})()`);
    assert(state.filenamePresent,`Long Stage 04 filename is missing at ${width}px.`);
    assert(state.documentScroll<=width+1&&state.bodyScroll<=width+1,`Document horizontally overflows at ${width}px: ${JSON.stringify(state)}`);
    assert(state.strip&&state.spans.length===2&&state.spans.every(rect=>rect.left>=-1&&rect.right<=width+1&&rect.scrollWidth<=rect.clientWidth+1),`Current state or next action is clipped at ${width}px: ${JSON.stringify(state)}`);
    assert(state.labels[0].includes('Current state:')&&state.labels[1].includes('Next:'),`State/action labels are not explicit at ${width}px: ${JSON.stringify(state.labels)}`);
    assert(state.filenameNodes.length>=1&&state.filenameNodes.every(rect=>rect.left>=-1&&rect.right<=width+1&&rect.scrollWidth<=rect.clientWidth+1),`Long filename is clipped at ${width}px: ${JSON.stringify(state.filenameNodes)}`);
    assert(state.copy&&state.copy.left>=-1&&state.copy.right<=width+1&&state.copy.height>=44,`Primary copy action is unusable at ${width}px: ${JSON.stringify(state.copy)}`);
    assert(state.prompt&&state.prompt.left>=-1&&state.prompt.right<=width+1,`Prompt box exceeds the viewport at ${width}px: ${JSON.stringify(state.prompt)}`);
    assert(Math.abs(state.prompt.height-280)<=1&&!state.promptExpanded&&state.toggleExpanded==='false'&&state.prompt.scrollHeight>state.prompt.clientHeight,`Collapsed prompt geometry is not the established 280px scroll surface at ${width}px: ${JSON.stringify(state)}`);
    await click(cdp,'#toggle-prompt');
    const expanded=await evaluate(cdp,"(()=>{const prompt=document.querySelector('#generated-prompt'),r=prompt?.getBoundingClientRect();return {height:r?.height,scrollHeight:prompt?.scrollHeight,clientHeight:prompt?.clientHeight,expanded:prompt?.classList.contains('expanded'),maxHeight:prompt&&getComputedStyle(prompt).maxHeight,aria:document.querySelector('#toggle-prompt')?.getAttribute('aria-expanded'),documentScroll:document.documentElement.scrollWidth,bodyScroll:document.body.scrollWidth}})()");
    assert(expanded.expanded&&expanded.aria==='true'&&expanded.maxHeight==='none'&&expanded.height>280&&expanded.clientHeight>=expanded.scrollHeight,`Expanded prompt geometry did not remove the collapsed height constraints at ${width}px: ${JSON.stringify(expanded)}`);
    assert(expanded.documentScroll<=width+1&&expanded.bodyScroll<=width+1,`Expanded prompt causes horizontal overflow at ${width}px: ${JSON.stringify(expanded)}`);
    await click(cdp,'#toggle-prompt');
    const collapsedAgain=await evaluate(cdp,"(()=>{const prompt=document.querySelector('#generated-prompt');return {height:prompt?.getBoundingClientRect().height,expanded:prompt?.classList.contains('expanded'),aria:document.querySelector('#toggle-prompt')?.getAttribute('aria-expanded')}})()");
    assert(Math.abs(collapsedAgain.height-280)<=1&&!collapsedAgain.expanded&&collapsedAgain.aria==='false',`Prompt did not return to the exact collapsed geometry at ${width}px: ${JSON.stringify(collapsedAgain)}`);
  }
  console.log(JSON.stringify({mobileStageActionRegression:true,widths:[320,393,1180],longFilenameWrapped:true,stateAndActionExplicit:true,primaryActionReachable:true,collapsedPromptHeight:280,expandedPromptUnbounded:true,promptVisualBaselinePreserved:true,horizontalOverflow:false}));
  cdp.close();
}
async function cleanup(){await teardownBrowser();try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}}
try{await main();}finally{await cleanup();}
