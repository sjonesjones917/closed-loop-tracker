import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {MAIN_RUNTIME_SCRIPT_PATHS,WORKER_PROTOCOL_VERSION} from './deployment-contract.mjs';

const PAGE_URL=process.env.PAGE_URL;
if(!PAGE_URL)throw new Error('PAGE_URL is required.');
const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
if(!browser)throw new Error('Chrome/Chromium was not found.');
const manifestPath=process.env.DEPLOYMENT_MANIFEST_PATH||(fs.existsSync('_site/deployment-manifest.json')?'_site/deployment-manifest.json':'deployment-manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const expected=new Map(manifest.runtimeResources.map(resource=>[resource.path,resource]));
const temporaryRoot=fs.existsSync(os.tmpdir())?os.tmpdir():path.dirname(path.resolve(manifestPath));
const port=9700+Math.floor(Math.random()*200),profile=fs.mkdtempSync(path.join(temporaryRoot,'closed-loop-deployed-graph-'));
const proc=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
async function request(url,options){const response=await fetch(url,options);if(!response.ok)throw new Error(`${url} -> ${response.status}`);return response.json();}
async function poll(fn,timeout=20000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{return await fn();}catch(error){last=error;await sleep(120);}}throw last||new Error('Timed out.');}
class CDP{
  constructor(url){this.ws=new WebSocket(url);this.id=0;this.pending=new Map();this.events=[];this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);}else this.events.push(message);};}
  async send(method,params={}){await this.ready;const id=++this.id;const result=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method,params}));return result;}
  close(){this.ws.close();}
}
async function evaluate(cdp,expression){const response=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);return response.result?.value;}
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const workerResource=expected.get('test-worker.js');

async function loadAndProve(cdp,label,cacheDisabled,url){
  const eventStart=cdp.events.length;
  await cdp.send('Network.setCacheDisabled',{cacheDisabled});
  await cdp.send('Page.navigate',{url});
  await poll(async()=>{if(!cdp.events.slice(eventStart).some(event=>event.method==='Page.loadEventFired'))throw new Error(`${label}: navigation has not completed.`);if(!(await evaluate(cdp,`location.href===${JSON.stringify(url)}&&document.readyState==='complete'&&globalThis.closedLoopAppReady===true`)))throw new Error(`${label}: application is not ready.`);return true;});
  const workerResult=await evaluate(cdp,`closedLoopTestRuntime.executeTest({fields:{TEST_ID:'DEPLOYED-WORKER-IDENTITY-${label}',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:'deployed-worker-proof'}]},EXECUTABLE_INPUT_BINDINGS:{PRODUCT:{kind:'ARTIFACT',artifactId:'DEPLOYED-GRAPH-ARTIFACT'}}}},{PRODUCT:{artifactId:'DEPLOYED-GRAPH-ARTIFACT',filename:'deployed-proof.txt',bytes:new TextEncoder().encode('deployed-worker-proof')}},{})`);
  if(workerResult?.status!=='COMPLETE')throw new Error(`${label}: deployed worker result status is not COMPLETE: ${JSON.stringify(workerResult)}`);
  if(workerResult?.determination!=='SATISFIED')throw new Error(`${label}: deployed worker determination is not SATISFIED: ${JSON.stringify(workerResult)}`);
  if(workerResult?.testWorkerSha256!==workerResource.digest)throw new Error(`${label}: worker result is not bound to the exact manifested worker bytes.`);
  if(workerResult?.runtimeBuildIdentity!==manifest.buildIdentity)throw new Error(`${label}: worker result build identity is mixed or stale.`);
  if(workerResult?.workerProtocolVersion!==WORKER_PROTOCOL_VERSION)throw new Error(`${label}: worker result protocol identity is wrong.`);
  const browserState=await evaluate(cdp,`(async()=>({
    controller:Boolean(navigator.serviceWorker?.controller),
    registrations:navigator.serviceWorker?await navigator.serviceWorker.getRegistrations().then(items=>items.length):0,
    resources:performance.getEntriesByType('resource').map(entry=>entry.name),
    scriptSources:[...document.scripts].map(script=>script.src).filter(Boolean),
    runtimeBuildIdentity:closedLoopTestRuntime.runtimeBuildIdentity(),
    injectedWorkerSha256:closedLoopTestRuntime.deploymentWorkerSha256(),
    runtimeManifestGlobalPresent:Boolean(globalThis.closedLoopDeploymentManifest||globalThis.closedLoopDeploymentManifestStatus),
    buildIdentityStatus:globalThis.closedLoopBuildIdentityStatus||null
  }))()`);
  if(browserState.controller||browserState.registrations)throw new Error(`${label}: a controlling or registered service worker exists.`);
  if(browserState.runtimeBuildIdentity!==manifest.buildIdentity)throw new Error(`${label}: main runtime build identity differs from the deployment manifest.`);
  if(browserState.injectedWorkerSha256!==workerResource.digest)throw new Error(`${label}: main runtime did not receive the exact build-time worker identity.`);
  if(browserState.runtimeManifestGlobalPresent)throw new Error(`${label}: deployment-manifest.json remains an unmanifested runtime dependency instead of build-time worker identity injection.`);
  if(browserState.buildIdentityStatus?.status!=='CURRENT'||browserState.buildIdentityStatus?.buildIdentity!==manifest.buildIdentity||browserState.buildIdentityStatus?.testWorkerSha256!==workerResource.digest||browserState.buildIdentityStatus?.workerProtocolVersion!==WORKER_PROTOCOL_VERSION||browserState.buildIdentityStatus?.sourceCommit!==manifest.sourceCommit||String(browserState.buildIdentityStatus?.workflowRunIdentity)!==String(manifest.workflowRunIdentity))throw new Error(`${label}: current generated build identity was not established before application readiness.`);
  const scriptPaths=browserState.scriptSources.map(source=>new URL(source).pathname.split('/').pop());
  if(JSON.stringify(scriptPaths)!==JSON.stringify(MAIN_RUNTIME_SCRIPT_PATHS))throw new Error(`${label}: executed script graph differs from the manifested graph: ${JSON.stringify(scriptPaths)}`);
  for(const source of browserState.scriptSources){const urlObject=new URL(source),resource=expected.get(urlObject.pathname.split('/').pop());if(!resource)throw new Error(`${label}: page executed an unmanifested script: ${source}`);if(urlObject.searchParams.get('v')!==manifest.buildIdentity)throw new Error(`${label}: page executed mixed-build script ${source}.`);}
  const manifestFetches=browserState.resources.filter(resource=>new URL(resource).pathname.endsWith('/deployment-manifest.json'));
  if(manifestFetches.length)throw new Error(`${label}: application fetched deployment-manifest.json at runtime.`);
  const buildIdentityFetches=browserState.resources.filter(resource=>new URL(resource).pathname.endsWith('/build-identity.json'));
  if(buildIdentityFetches.length!==1)throw new Error(`${label}: expected exactly one cache-bypassed build-identity request; observed ${buildIdentityFetches.length}.`);
  const buildIdentityUrl=new URL(buildIdentityFetches[0]);
  if(buildIdentityUrl.searchParams.get('expected')!==manifest.buildIdentity||!buildIdentityUrl.searchParams.get('nonce'))throw new Error(`${label}: build-identity request is not bound to the compiled build and a cache-bypass nonce.`);
  const newEvents=cdp.events.slice(eventStart);
  const requestedUrls=newEvents.filter(event=>event.method==='Network.requestWillBeSent').map(event=>event.params?.request?.url).filter(Boolean);
  for(const requested of requestedUrls){
    const requestedUrl=new URL(requested);
    if(!['http:','https:'].includes(requestedUrl.protocol))continue;
    if(requestedUrl.origin!==new URL(PAGE_URL).origin)throw new Error(`${label}: runtime made an unmanifested cross-origin request: ${requested}`);
    if(requestedUrl.pathname.endsWith('.js')){
      const resource=expected.get(requestedUrl.pathname.split('/').pop());
      if(!resource)throw new Error(`${label}: runtime requested an unmanifested JavaScript resource: ${requested}`);
      if(requestedUrl.searchParams.get('v')!==manifest.buildIdentity)throw new Error(`${label}: runtime requested a mixed-build JavaScript resource: ${requested}`);
    }
  }
  const workerRequests=requestedUrls.filter(requested=>new URL(requested).pathname.endsWith('/test-worker.js'));
  if(!workerRequests.length)throw new Error(`${label}: no Test IR worker request was observed.`);
  if(workerRequests.some(requested=>new URL(requested).searchParams.get('v')!==manifest.buildIdentity))throw new Error(`${label}: Test IR worker URL does not carry the content-derived build identity.`);
  return {label,workerResult,browserState,requestedUrls,cacheHitObserved:newEvents.some(event=>event.method==='Network.requestServedFromCache'||event.params?.response?.fromDiskCache===true)};
}

async function proveStaleBuildBlocked(cdp){
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*build-identity.json*',requestStage:'Request'}]});
  const eventStart=cdp.events.length;
  const url=new URL(`?staleBuildProbe=${Date.now()}`,PAGE_URL).href;
  await cdp.send('Page.navigate',{url});
  const paused=await poll(async()=>{const event=cdp.events.slice(eventStart).find(item=>item.method==='Fetch.requestPaused'&&new URL(item.params?.request?.url||'about:blank').pathname.endsWith('/build-identity.json'));if(!event)throw new Error('Stale-build probe is waiting for the build-identity request.');return event;});
  const staleIdentity={schema:'closed-loop-build-identity/1',buildIdentity:'runtime-prior-stale-build',testWorkerSha256:workerResource.digest,workerProtocolVersion:WORKER_PROTOCOL_VERSION,sourceCommit:manifest.sourceCommit,workflowRunIdentity:manifest.workflowRunIdentity,hashAlgorithm:'SHA-256'};
  await cdp.send('Fetch.fulfillRequest',{requestId:paused.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json; charset=utf-8'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify(staleIdentity),'utf8').toString('base64')});
  const state=await poll(async()=>{const value=await evaluate(cdp,`({href:location.href,ready:globalThis.closedLoopAppReady===true,error:String(globalThis.closedLoopAppError||''),identityStatus:globalThis.closedLoopBuildIdentityStatus||null,text:document.body.innerText})`);if(value.href!==url||value.ready||!value.error||!/(stale|mismatch|build identity|build-identity)/i.test(`${value.error} ${value.identityStatus?.reason||''} ${value.text||''}`))throw new Error('Stale build has not visibly failed closed.');return value;});
  await cdp.send('Fetch.disable');
  if(!/(stale|mismatch|blocked|reload|current build)/i.test(state.text||''))throw new Error('Stale build failure is not visible to the operator.');
  return {blocked:true,status:state.identityStatus?.status||'BLOCKED',appReady:false,visible:true};
}

async function main(){
  await poll(()=>request(`http://127.0.0.1:${port}/json/version`));
  const target=await request(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'}),cdp=new CDP(target.webSocketDebuggerUrl);
  await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Network.enable');
  const browserVersion=await cdp.send('Browser.getVersion');
  const currentUrl=new URL(`?deployedGraph=${encodeURIComponent(manifest.buildIdentity)}`,PAGE_URL).href;
  const clean=await loadAndProve(cdp,'CLEAN_PROFILE',false,currentUrl);
  const cached=await loadAndProve(cdp,'PREVIOUSLY_CACHED_PROFILE',false,currentUrl);
  const stale=await proveStaleBuildBlocked(cdp);
  const recovered=await loadAndProve(cdp,'POST_STALE_CURRENT_PROFILE',false,currentUrl);
  const workerBytes=Buffer.from(await (await fetch(new URL(`test-worker.js?v=${manifest.buildIdentity}&verify=${Date.now()}`,PAGE_URL),{cache:'no-store'})).arrayBuffer());
  if(sha256(workerBytes)!==workerResource.digest)throw new Error('The deployed worker entry does not match the deployment manifest.');
  const exceptions=cdp.events.filter(event=>event.method==='Runtime.exceptionThrown');if(exceptions.length)throw new Error(`Runtime exceptions: ${JSON.stringify(exceptions)}`);
  cdp.close();
  console.log(JSON.stringify({
    deployedResourceGraph:'PASS',
    buildIdentity:manifest.buildIdentity,
    browserProduct:browserVersion.product,
    browserUserAgent:browserVersion.userAgent,
    cleanProfileCurrentBuild:true,
    previouslyCachedProfileCurrentBuild:true,
    cachedProfileCacheHitObserved:cached.cacheHitObserved,
    staleBuildMismatchBlocked:stale.blocked,
    staleBuildBlockVisible:stale.visible,
    staleBuildStatus:stale.status,
    postStaleCurrentBuildRecovered:recovered.workerResult.determination==='SATISFIED',
    cacheScenario:'CLEAN LOAD, PERSISTENT-PROFILE RELOAD, SYNTHETIC PRIOR-BUILD IDENTITY MISMATCH, CURRENT-BUILD RECOVERY',
    staleBuildExecuted:false,
    mainRuntimeScripts:clean.browserState.scriptSources.length,
    workerExecuted:true,
    workerResultStatus:clean.workerResult.status,
    workerDetermination:clean.workerResult.determination,
    runtimeBuildIdentity:clean.workerResult.runtimeBuildIdentity,
    workerProtocolVersion:clean.workerResult.workerProtocolVersion,
    workerDigest:workerResource.digest,
    returnedWorkerDigest:clean.workerResult.testWorkerSha256,
    workerDigestMatch:true,
    workerRequestObserved:true,
    crossOriginRuntimeRequests:0,
    runtimeManifestFetches:0,
    buildIdentityRuntimeControl:true,
    buildIdentityStatus:'CURRENT',
    serviceWorkerController:false,
    serviceWorkerRegistrations:0,
    mixedBuildResources:0,
    unmanifestedExecutedResources:0
  },null,2));
}
async function cleanup(){if(!proc.killed)proc.kill('SIGTERM');await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),sleep(1000)]);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}}
try{await main();}finally{await cleanup();}
