import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {BUILD_IDENTITY_SCHEMA,MAIN_RUNTIME_SCRIPT_PATHS,WORKER_PROTOCOL_VERSION} from './deployment-contract.mjs';

const PAGE_URL=process.env.PAGE_URL;
if(!PAGE_URL)throw new Error('PAGE_URL is required.');
const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
if(!browser)throw new Error('Chrome/Chromium was not found.');
const manifestPath=process.env.DEPLOYMENT_MANIFEST_PATH||(fs.existsSync('_site/deployment-manifest.json')?'_site/deployment-manifest.json':'deployment-manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const workerDigest=manifest.runtimeResources.find(resource=>resource.path==='test-worker.js')?.digest;
if(!/^[a-f0-9]{64}$/.test(String(workerDigest||'')))throw new Error('Deployment manifest lacks the exact worker identity.');
const temporaryRoot=fs.existsSync(os.tmpdir())?os.tmpdir():path.dirname(path.resolve(manifestPath));
const port=9820+Math.floor(Math.random()*100),profile=fs.mkdtempSync(path.join(temporaryRoot,'closed-loop-cached-profile-'));
const child=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
async function json(url,options){const response=await fetch(url,options);if(!response.ok)throw new Error(`${url} -> ${response.status}`);return response.json();}
async function poll(fn,timeout=20000){const end=Date.now()+timeout;let prior;while(Date.now()<end){try{return await fn();}catch(error){prior=error;await sleep(120);}}throw prior||new Error('Timed out.');}
class CDP{
  constructor(url){this.socket=new WebSocket(url);this.id=0;this.pending=new Map();this.events=[];this.ready=new Promise((resolve,reject)=>{this.socket.onopen=resolve;this.socket.onerror=reject;});this.socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);}else this.events.push(message);};}
  async send(method,params={}){await this.ready;const id=++this.id,promise=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.socket.send(JSON.stringify({id,method,params}));return promise;}
  close(){this.socket.close();}
}
async function evaluate(cdp,expression){const result=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Evaluation failed.');return result.result?.value;}
async function loadCurrent(cdp,label,url){
  const eventStart=cdp.events.length;
  await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});
  await cdp.send('Page.navigate',{url});
  await poll(async()=>{if(!cdp.events.slice(eventStart).some(event=>event.method==='Page.loadEventFired'))throw new Error(`${label}: navigation incomplete.`);const ready=await evaluate(cdp,`location.href===${JSON.stringify(url)}&&document.readyState==='complete'&&globalThis.closedLoopAppReady===true`);if(!ready)throw new Error(`${label}: current application is not ready.`);return true;});
  const state=await evaluate(cdp,`(async()=>({
    appError:String(globalThis.closedLoopAppError||''),
    buildIdentityStatus:globalThis.closedLoopBuildIdentityStatus||null,
    runtimeBuildIdentity:globalThis.closedLoopTestRuntime?.runtimeBuildIdentity?.(),
    workerSha256:globalThis.closedLoopTestRuntime?.deploymentWorkerSha256?.(),
    scripts:[...document.scripts].map(script=>script.src).filter(Boolean),
    resources:performance.getEntriesByType('resource').map(entry=>entry.name),
    serviceWorkerController:Boolean(navigator.serviceWorker?.controller),
    serviceWorkerRegistrations:navigator.serviceWorker?await navigator.serviceWorker.getRegistrations().then(items=>items.length):0
  }))()`);
  if(state.appError)throw new Error(`${label}: ${state.appError}`);
  if(state.buildIdentityStatus?.status!=='CURRENT'||state.buildIdentityStatus?.buildIdentity!==manifest.buildIdentity||state.buildIdentityStatus?.testWorkerSha256!==workerDigest||state.buildIdentityStatus?.workerProtocolVersion!==WORKER_PROTOCOL_VERSION||state.buildIdentityStatus?.sourceCommit!==manifest.sourceCommit||String(state.buildIdentityStatus?.workflowRunIdentity)!==String(manifest.workflowRunIdentity))throw new Error(`${label}: build identity status is not current and exact.`);
  if(state.runtimeBuildIdentity!==manifest.buildIdentity||state.workerSha256!==workerDigest)throw new Error(`${label}: runtime identity does not match the current deployment.`);
  if(state.serviceWorkerController||state.serviceWorkerRegistrations)throw new Error(`${label}: service worker controls the cached profile.`);
  if(JSON.stringify(state.scripts.map(source=>new URL(source).pathname.split('/').pop()))!==JSON.stringify(MAIN_RUNTIME_SCRIPT_PATHS))throw new Error(`${label}: cached profile executed a different script graph.`);
  for(const source of state.scripts)if(new URL(source).searchParams.get('v')!==manifest.buildIdentity)throw new Error(`${label}: cached profile executed a mixed build.`);
  const identityRequests=state.resources.filter(resource=>new URL(resource).pathname.endsWith('/build-identity.json'));
  if(identityRequests.length!==1)throw new Error(`${label}: expected one current build identity request.`);
  const identityUrl=new URL(identityRequests[0]);
  if(identityUrl.searchParams.get('expected')!==manifest.buildIdentity||!identityUrl.searchParams.get('nonce'))throw new Error(`${label}: build identity request lacks expected build binding and cache bypass.`);
  return state;
}
async function loadStaleIdentity(cdp){
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*build-identity.json*',requestStage:'Request'}]});
  const start=cdp.events.length,url=new URL(`?staleCachedProfile=${Date.now()}`,PAGE_URL).href;
  await cdp.send('Page.navigate',{url});
  const paused=await poll(async()=>{const event=cdp.events.slice(start).find(item=>item.method==='Fetch.requestPaused'&&new URL(item.params?.request?.url||'about:blank').pathname.endsWith('/build-identity.json'));if(!event)throw new Error('Waiting for build identity interception.');return event;});
  const prior={schema:BUILD_IDENTITY_SCHEMA,buildIdentity:'runtime-prior-cached-build',testWorkerSha256:workerDigest,workerProtocolVersion:WORKER_PROTOCOL_VERSION,sourceCommit:manifest.sourceCommit,workflowRunIdentity:manifest.workflowRunIdentity,hashAlgorithm:'SHA-256'};
  await cdp.send('Fetch.fulfillRequest',{requestId:paused.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json; charset=utf-8'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify(prior),'utf8').toString('base64')});
  const blocked=await poll(async()=>{const state=await evaluate(cdp,`({ready:globalThis.closedLoopAppReady===true,error:String(globalThis.closedLoopAppError||''),status:globalThis.closedLoopBuildIdentityStatus||null,text:document.body.innerText})`);if(state.ready||!state.error||!/(stale|mismatch|build identity|build-identity)/i.test(`${state.error} ${state.status?.reason||''}`)||!/(stale|mismatch|blocked|reload|current build)/i.test(state.text||''))throw new Error('Prior cached build identity has not visibly failed closed.');return state;});
  await cdp.send('Fetch.disable');
  return {blocked:!blocked.ready,visible:true,status:blocked.status?.status||'BLOCKED'};
}

async function main(){
  await poll(()=>json(`http://127.0.0.1:${port}/json/version`));
  const target=await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'}),cdp=new CDP(target.webSocketDebuggerUrl);
  await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Network.enable');
  const browserVersion=await cdp.send('Browser.getVersion'),currentUrl=new URL(`?cachedProfile=${encodeURIComponent(manifest.buildIdentity)}`,PAGE_URL).href;
  await loadCurrent(cdp,'CLEAN_PROFILE',currentUrl);
  const cacheEventStart=cdp.events.length;
  await loadCurrent(cdp,'PRE_CACHED_PROFILE',currentUrl);
  const cacheHitObserved=cdp.events.slice(cacheEventStart).some(event=>event.method==='Network.requestServedFromCache'||event.params?.response?.fromDiskCache===true);
  const stale=await loadStaleIdentity(cdp);
  await loadCurrent(cdp,'POST_STALE_RECOVERY',currentUrl);
  cdp.close();
  console.log(JSON.stringify({cachedDeploymentProfile:'PASS',browserProduct:browserVersion.product,cleanProfileCurrentBuild:true,preCachedProfileCurrentBuild:true,cacheHitObserved,priorBuildIdentityMismatchBlocked:stale.blocked,priorBuildIdentityBlockVisible:stale.visible,priorBuildIdentityStatus:stale.status,currentBuildRecovered:true,serviceWorkerController:false,serviceWorkerRegistrations:0,mixedBuildResources:0},null,2));
}
async function cleanup(){if(!child.killed)child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(1000)]);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}}
try{await main();}finally{await cleanup();}
