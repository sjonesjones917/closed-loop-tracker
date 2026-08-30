import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const APP_URL=process.env.APP_URL||'http://127.0.0.1:4173/';
const PORT=Number(process.env.CDP_PORT||9222);
const WIDTHS=[320,393,1280];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function chromeBinary(){
  const candidates=[process.env.CHROME_BIN,'google-chrome-stable','google-chrome','chromium','chromium-browser'].filter(Boolean);
  for(const candidate of candidates){
    const found=spawnSync('bash',['-lc',`command -v ${JSON.stringify(candidate)} 2>/dev/null || true`],{encoding:'utf8'}).stdout.trim();
    if(found)return found;
  }
  throw new Error('No Chrome or Chromium binary is available.');
}
async function waitJson(url,{method='GET',timeout=20000}={}){
  const deadline=Date.now()+timeout;let last;
  while(Date.now()<deadline){
    try{const response=await fetch(url,{method});if(response.ok)return await response.json();last=new Error(`${response.status} ${response.statusText}`);}catch(error){last=error;}
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${url}: ${last?.message||'unknown error'}`);
}
class CDP{
  constructor(url){this.url=url;this.nextId=1;this.pending=new Map();this.listeners=new Map();this.events=[];}
  async open(){
    this.ws=new WebSocket(this.url);
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('CDP WebSocket open timeout')),10000);this.ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});this.ws.addEventListener('error',event=>{clearTimeout(timer);reject(new Error(`CDP WebSocket error: ${event.message||'unknown'}`));},{once:true});});
    this.ws.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(`${pending.method}: ${message.error.message}`)):pending.resolve(message.result);return;}this.events.push(message);for(const listener of this.listeners.get(message.method)||[])listener(message.params||{});});
  }
  send(method,params={}){const id=this.nextId++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject,method});this.ws.send(JSON.stringify({id,method,params}));});}
  waitEvent(method,predicate=()=>true,timeout=15000){return new Promise((resolve,reject)=>{const listener=params=>{if(!predicate(params))return;cleanup();resolve(params);};const cleanup=()=>{clearTimeout(timer);const set=this.listeners.get(method);if(set){set.delete(listener);if(!set.size)this.listeners.delete(method);}};const timer=setTimeout(()=>{cleanup();reject(new Error(`Timed out waiting for ${method}`));},timeout);if(!this.listeners.has(method))this.listeners.set(method,new Set());this.listeners.get(method).add(listener);});}
  async evaluate(expression){const result=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw new Error(`Runtime evaluation failed: ${result.exceptionDetails.text||'exception'}`);return result.result?.value;}
  close(){try{this.ws?.close();}catch{}}
}

const userData=mkdtempSync(join(tmpdir(),'closed-loop-browser-'));
const chrome=spawn(chromeBinary(),[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  `--remote-debugging-port=${PORT}`,`--user-data-dir=${userData}`,'about:blank'
],{stdio:'ignore'});
let cdp;
try{
  await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  const page=await waitJson(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(APP_URL)}`,{method:'PUT'});
  cdp=new CDP(page.webSocketDebuggerUrl);await cdp.open();
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Log.enable');
  const browserErrors=[];
  cdp.listeners.set('Runtime.exceptionThrown',new Set([params=>browserErrors.push(`exception: ${params.exceptionDetails?.text||'unknown'}`)]));
  cdp.listeners.set('Log.entryAdded',new Set([params=>{if(['error','warning'].includes(params.entry?.level))browserErrors.push(`log ${params.entry.level}: ${params.entry.text}`);}]))
  cdp.listeners.set('Runtime.consoleAPICalled',new Set([params=>{if(['error','warning'].includes(params.type))browserErrors.push(`console ${params.type}: ${(params.args||[]).map(x=>x.value??x.description??'').join(' ')}`);}]))

  const observations=[];
  for(const width of WIDTHS){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600,screenWidth:width,screenHeight:900});
    const loaded=cdp.waitEvent('Page.loadEventFired');await cdp.send('Page.navigate',{url:APP_URL});await loaded;await sleep(750);
    const result=await cdp.evaluate(`(()=>{
      const css=[...document.styleSheets].flatMap(sheet=>{try{return [...sheet.cssRules]}catch{return []}});
      const promptRule=css.find(rule=>rule.selectorText==='.expandable-prompt');
      const globals={core:Boolean(globalThis.closedLoopCore),schema:Boolean(globalThis.closedLoopWorkflowSchema),runtime:Boolean(globalThis.closedLoopTestRuntime),engine:Boolean(globalThis.closedLoopWorkflowEngine),prompts:Boolean(globalThis.closedLoopPromptEngine),ingestion:Boolean(globalThis.closedLoopResponseIngestion),store:Boolean(globalThis.closedLoopProjectStore)};
      let semantic=null;
      if(Object.values(globals).every(Boolean)){
        const p=globalThis.closedLoopCore.createBlankState('JOB-BROWSER-PROOF');
        p.job.JOB_ID='JOB-BROWSER-PROOF';p.job.JOB_TITLE='Browser proof';p.job.EXACT_USER_OBJECTIVE_VERBATIM='Create the requested product while retaining every project requirement supplied once.';p.job.EXPLICIT_USER_REQUIREMENTS='Never ask the operator to resupply captured project information.';p.job.SUPPLIED_MATERIALS_INVENTORY='intent-package.zip';p.job.CURRENT_INPUT_VERSION='INPUT-v001';
        globalThis.closedLoopWorkflowEngine.ensureShape(p);globalThis.closedLoopWorkflowEngine.recalculate(p);
        const one=globalThis.closedLoopPromptEngine.buildPromptRecord(1,p).prompt;
        const three=globalThis.closedLoopPromptEngine.buildPromptRecord(3,p).prompt;
        const four=globalThis.closedLoopPromptEngine.buildPromptRecord(4,p).prompt;
        semantic={
          stage1Complete:one.includes('Stage 01 is COMPLETE HUMAN-AUTHORITY INTAKE')&&one.includes('account for EVERY INPUT UNIT ID'),
          stage3Exhaustive:three.includes('Exhaustively research every current accepted Stage 02 independent external source')&&three.includes('Do not mark Stage 03 complete until all current sources have coverage'),
          stage4Closed:four.includes('Compile the requirement specification ONLY from the complete APPLICATION OBLIGATION MANIFEST')&&four.includes('NEVER ask the human to reattach, resend, retype, restate, reconstruct, or summarize')&&four.includes('If an earlier stage is incomplete, return BLOCKED with INADEQUATE_PRIOR_OUTPUT'),
          taskBeforeData:four.indexOf('YOUR TASK — DO THIS NOW')<four.indexOf('JOB CONTROL'),
          noHardCodedSubjects:!['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'].some(token=>one.includes(token)||three.includes(token)||four.includes(token))
        };
      }
      const root=document.documentElement,body=document.body;
      return {width:innerWidth,rootScrollWidth:root.scrollWidth,bodyScrollWidth:body?.scrollWidth||0,promptMaxHeight:promptRule?.style?.maxHeight||null,globals,semantic,readyState:document.readyState,hasLiveRegion:Boolean(document.querySelector('[aria-live]'))};
    })()`);
    if(result.readyState!=='complete')throw new Error(`Document did not complete at ${width}px.`);
    if(result.rootScrollWidth>width||result.bodyScrollWidth>width)throw new Error(`Horizontal overflow at ${width}px: root=${result.rootScrollWidth}, body=${result.bodyScrollWidth}.`);
    if(result.promptMaxHeight!=='280px')throw new Error(`Prompt preview CSS changed at ${width}px: ${result.promptMaxHeight}.`);
    if(!Object.values(result.globals).every(Boolean))throw new Error(`Runtime module graph incomplete at ${width}px: ${JSON.stringify(result.globals)}.`);
    if(!result.semantic||!Object.values(result.semantic).every(Boolean))throw new Error(`Prompt semantic proof failed at ${width}px: ${JSON.stringify(result.semantic)}.`);
    if(!result.hasLiveRegion)throw new Error(`Accessible live region missing at ${width}px.`);
    observations.push(result);
  }
  const materialErrors=browserErrors.filter(text=>!(/favicon|Failed to load resource/i.test(text)));
  if(materialErrors.length)throw new Error(`Browser emitted runtime errors: ${materialErrors.join(' | ')}`);
  console.log(JSON.stringify({status:'PASSED',appUrl:APP_URL,widths:observations.map(x=>x.width),noHorizontalOverflow:true,promptPreviewMaxHeight:'280px',runtimeGraph:true,stage1Exhaustive:true,stage3Exhaustive:true,stage4ClosedSingleSupply:true,liveRegion:true},null,2));
}finally{
  cdp?.close();chrome.kill('SIGKILL');rmSync(userData,{recursive:true,force:true});
}
