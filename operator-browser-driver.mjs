import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function until(read,description,timeout=90000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{const value=await read();if(value)return value;}catch(error){last=error;}await delay(80);}throw new Error(`${description}${last?`: ${last.message}`:''}`);}
// Every browser consumer uses the same document and interaction boundary.
// CDP can acknowledge navigation while the previous document is still ready.
export function createBrowserReadiness(cdp,evaluate,{timeout=90000,wait=until}={}){
  const interactive=`globalThis.closedLoopAppReady===true&&document.readyState==='complete'&&Boolean(document.querySelector('#app'))&&!document.querySelector('#app').hasAttribute('inert')&&document.querySelector('#app').getAttribute('aria-busy')!=='true'`;
  async function idle({allowStartupFailure=false}={}){return wait(()=>evaluate(allowStartupFailure?`(${interactive})||Boolean(globalThis.closedLoopAppError)`:interactive),'The application did not become interactive',timeout);}
  async function navigate(method,params={},options={}){
    const previous=(await cdp.send('Page.getFrameTree')).frameTree.frame.loaderId;
    const result=await cdp.send(method,params);
    if(result.errorText)throw new Error(result.errorText);
    await wait(async()=>{const destination=(await cdp.send('Page.getFrameTree')).frameTree.frame.loaderId;return Boolean(destination&&destination!==previous&&(!result.loaderId||destination===result.loaderId));},'The destination document did not arrive',timeout);
    await idle(options);
  }
  async function restoreEntry(entryId){
    await cdp.send('Page.navigateToHistoryEntry',{entryId});
    await wait(async()=>{const state=await cdp.send('Page.getNavigationHistory');return state.entries[state.currentIndex]?.id===entryId;},'The destination history entry did not arrive',timeout);
    await idle();
  }
  return {idle,navigate,restoreEntry};
}
class Connection{
  constructor(url){this.ws=new WebSocket(url);this.pending=new Map();this.events=[];this.sequence=0;this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=event=>{const message=JSON.parse(event.data),waiting=this.pending.get(message.id);if(waiting){this.pending.delete(message.id);clearTimeout(waiting.timer);message.error?waiting.reject(new Error(message.error.message)):waiting.resolve(message.result);}else this.events.push(message);};}
  async send(method,params={}){await this.ready;const id=++this.sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`Browser command timed out: ${method}`));},90000);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params}));});}
  close(){this.ws.close();for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error('Browser closed'));}this.pending.clear();}
}

// This starts its own disposable CI browser. It never connects to an operator's
// browser and never invokes workflow commands or writes project state through JS.
export async function createOperatorBrowser({url=process.env.PAGE_URL||'http://127.0.0.1:4173/',directory,width=393,height=852}={}){
  const executable=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
  if(!executable)throw new Error('Chrome/Chromium is required for the complete operator journey.');
  directory=path.resolve(directory||fs.mkdtempSync(path.join(os.tmpdir(),'operator-journey-')));fs.mkdirSync(directory,{recursive:true});
  const downloads=path.join(directory,'downloads'),inputs=path.join(directory,'inputs'),profile=path.join(directory,'profile');for(const folder of [downloads,inputs,profile])fs.mkdirSync(folder,{recursive:true});
  const port=11000+Math.floor(Math.random()*1500),child=spawn(executable,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.on('data',bytes=>{stderr=(stderr+bytes).slice(-8000);});
  const json=async(route,options)=>{const response=await fetch(`http://127.0.0.1:${port}${route}`,options);if(!response.ok)throw new Error(`Browser ${route}: ${response.status}`);return response.json();};
  const version=await until(()=>json('/json/version'),`Browser did not start: ${stderr}`),root=new Connection(version.webSocketDebuggerUrl);await root.ready;
  // CDP Browser.downloadProgress and allowAndName provide actual downloaded
  // bytes, not a mocked Blob or an application-declared success flag.
  await root.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloads,eventsEnabled:true});
  const target=await json(`/json/new?${encodeURIComponent(url)}`,{method:'PUT'}),page=new Connection(target.webSocketDebuggerUrl);await page.ready;await page.send('Runtime.enable');await page.send('Page.enable');
  await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  const events=[];let inputSequence=0;
  async function evaluate(expression){const result=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value;}
  const readiness=createBrowserReadiness(page,evaluate);
  async function idle(){await readiness.idle();await evaluate(`(async()=>{await document.fonts?.ready;return new Promise((resolve,reject)=>{let previous='',stable=0,frames=0;const sample=()=>{const current=JSON.stringify([globalThis.scrollX||0,globalThis.scrollY||0,...[...document.querySelectorAll('#app,#screen,#next-required-action,#replacement-confirmation,#operation-error')].map(node=>node.getBoundingClientRect().toJSON())]);stable=current===previous?stable+1:0;previous=current;frames++;if(frames>=4&&stable>=2)return resolve(true);if(frames>=120)return reject(new Error('LAYOUT_QUIESCENCE_ORACLE: destination layout did not settle'));requestAnimationFrame(sample);};requestAnimationFrame(sample);});})()`);await readiness.idle();}
  async function exists(selector){return evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);}
  async function visible(selector){return evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node||node.disabled)return false;const rect=node.getBoundingClientRect(),style=getComputedStyle(node);return style.visibility!=='hidden'&&style.display!=='none'&&rect.width>0&&rect.height>0&&rect.top>=0&&rect.bottom<=innerHeight;})()`);}
  async function click(selector){const started=performance.now();await idle();const clicked=await evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node||node.disabled)return false;for(const box of [...(function*(n){for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open)yield p;})(node)].reverse())box.querySelector(':scope > summary')?.click();node.scrollIntoView({block:'center'});node.click();return true;})()`);assert.equal(clicked,true,`Missing or disabled control: ${selector}`);await idle();events.push({operation:'click',selector,elapsedMs:performance.now()-started});}
  async function fill(selector,value){const started=performance.now();await idle();const filled=await evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node||node.disabled)return false;for(const box of [...(function*(n){for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open)yield p;})(node)].reverse())box.querySelector(':scope > summary')?.click();node.value=${JSON.stringify(String(value))};node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);assert.equal(filled,true,`Missing or disabled field: ${selector}`);await idle();events.push({operation:'fill',selector,elapsedMs:performance.now()-started});}
  async function selectFiles(selector,members){await idle();const paths=members.map(member=>{const filename=String(member.filename||'response.json');assert.equal(path.basename(filename),filename,'Test file names must be individual file names');const folder=path.join(inputs,String(++inputSequence));fs.mkdirSync(folder);const file=path.join(folder,filename);fs.writeFileSync(file,member.bytes);events.push({operation:'selectFile',selector,filename,sha256:digest(member.bytes),byteSize:member.bytes.length});return file;});const handle=await page.send('Runtime.evaluate',{expression:`document.querySelector(${JSON.stringify(selector)})`,returnByValue:false});assert.ok(handle.result?.objectId,`Missing file input: ${selector}`);await page.send('DOM.setFileInputFiles',{objectId:handle.result.objectId,files:paths});await idle();}
  async function collectDownloads(after,minimum=1){const begun=await until(()=>{const items=root.events.slice(after).filter(event=>event.method==='Browser.downloadWillBegin');return items.length>=minimum?items:null;},'The browser did not begin the requested download');const completed=[];for(const event of begun){const {guid,suggestedFilename}=event.params;const result=await until(()=>root.events.find(item=>item.method==='Browser.downloadProgress'&&item.params.guid===guid&&item.params.state!=='inProgress'),'The browser did not complete the download');assert.equal(result.params.state,'completed',`Download cancelled: ${suggestedFilename}`);assert.match(guid,/^[a-zA-Z0-9-]+$/);const bytes=fs.readFileSync(path.join(downloads,guid));assert.equal(bytes.length,result.params.receivedBytes,'Downloaded byte length differs from the browser completion event');completed.push({filename:suggestedFilename,bytes,sha256:digest(bytes),path:path.join(downloads,guid)});events.push({operation:'download',filename:suggestedFilename,sha256:digest(bytes),byteSize:bytes.length});}return completed;}
  async function download(selector,minimum=1){const after=root.events.length;await click(selector);return collectDownloads(after,minimum);}
  async function project(){if(!(await evaluate(`document.querySelector('#project-actions-toggle')?.closest('details')?.open`)))await click('#project-actions-toggle');const [file]=await download('#export-project'),decoded=JSON.parse(gunzipSync(file.bytes).toString('utf8'));assert.equal(decoded.schema,'closed-loop-project-package/1');assert.ok(decoded.project?.job?.JOB_ID);return {project:decoded.project,package:decoded,file};}
  // Observe stored results without adding another whole-History backup action
  // to every ordinary control interaction. Required exports still use downloads.
  async function readProject(){const started=performance.now();await idle();const result=await evaluate(`(async()=>{const store=closedLoopProjectStore,id=history.state?.jobId||await store.metaGet('selectedProject');return store.readProject(id);})()`);assert.ok(result?.job?.JOB_ID);events.push({operation:'observeStoredProject',jobId:result.job.JOB_ID,revision:result.revision,projectSha256:result.projectSha256,elapsedMs:performance.now()-started,projectBytes:Buffer.byteLength(JSON.stringify(result))});return result;}
  async function inspect(stage){await idle();const result=await evaluate(`(()=>{const body=document.documentElement,controls=[...document.querySelectorAll('button,input,select,textarea')].filter(node=>node.getBoundingClientRect().height&&getComputedStyle(node).visibility!=='hidden'),sizes=controls.map(node=>({id:node.id,label:node.getAttribute('aria-label')||node.textContent||node.labels?.[0]?.textContent||'',width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height}));return {width:innerWidth,height:innerHeight,horizontalOverflow:Math.max(0,body.scrollWidth-innerWidth),action:document.querySelector('#next-required-action')?.innerText||'',controls:sizes,liveStatus:Boolean(document.querySelector('[role="status"]')),activeElement:document.activeElement?.id||''};})()`);assert.ok(result.horizontalOverflow<=1,`Stage ${stage}: horizontal overflow ${result.horizontalOverflow}px`);assert.ok(result.liveStatus,`Stage ${stage}: missing live status`);const picture=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(directory,`stage-${String(stage).padStart(2,'0')}.png`),Buffer.from(picture.data,'base64'));return result;}
  async function reload(){await readiness.navigate('Page.reload',{ignoreCache:true});await idle();events.push({operation:'reload'});}
  async function navigationHistory(){return page.send('Page.getNavigationHistory');}
  async function restoreEntry(entryId){await readiness.restoreEntry(entryId);await idle();events.push({operation:'browserHistoryTraversal',entryId});}
  async function openUrl(destination){await readiness.navigate('Page.navigate',{url:destination});await idle();events.push({operation:'directLink',url:destination});}
  async function close(){try{page.close();root.close();}finally{child.kill('SIGKILL');}}
  await idle();return {click,fill,selectFiles,download,project,readProject,inspect,reload,exists,visible,settle:idle,evaluate,navigationHistory,restoreEntry,openUrl,events,directory,close,exceptions:()=>page.events.filter(event=>event.method==='Runtime.exceptionThrown'||event.method==='Page.javascriptDialogOpening')};
}
