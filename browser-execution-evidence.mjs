// Repository-only observation. Parsed script sources and HTTP byte checks are
// separate evidence; neither is labelled physical-device or independent-agent proof.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const schema='closed-loop-browser-execution/1';
const mainScripts=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const check=(value,message)=>assert.ok(value,'BROWSER_EXECUTION_EVIDENCE: '+message);
function commandError(message,id,pending,details={}){const error=new Error(message);error.observerCommand={commandId:id,sentAt:pending.sentAt,method:pending.method,params:pending.params,sessionId:pending.sessionId||null,errorAt:Date.now(),...details};return error;}
function parsedUrl(value){try{return new URL(value);}catch{check(false,'invalid observed URL');}}
function siteBase(pageUrl,scope,manifest){
  const url=parsedUrl(pageUrl);check(!url.username&&!url.password,'page URL contains credentials');
  if(scope==='DEPLOYED')check(url.origin===manifest.canonicalOrigin&&[manifest.canonicalBasePath,manifest.canonicalBasePath+'index.html'].includes(url.pathname),'deployed page is outside the canonical site');
  else check(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname),'local page must use the isolated loopback server');
  return new URL('.',url);
}
export async function loadBrowserExpectedSite(environment=process.env){
  const scope=environment.CLOSED_LOOP_BROWSER_SCOPE;
  if(!scope)return null; // Unscoped legacy checks cannot issue browser proof.
  check(['LOCAL','DEPLOYED'].includes(scope),'unknown scope');
  const directory=scope==='DEPLOYED'?environment.VERIFIED_SITE_DIR:environment.STATIC_SITE_ROOT;
  check(directory,'explicit expected built artifact directory is required');
  const {validateSite}=await import('./verified-site.mjs'),manifest=validateSite(path.resolve(directory));
  const sourceCommit=environment.CLOSED_LOOP_BROWSER_SOURCE_COMMIT;
  check(/^[a-f0-9]{40}$/.test(sourceCommit||'')&&sourceCommit===manifest.sourceCommit,'source commit differs from the validated artifact');
  return {manifest,scope,sourceCommit};
}
export function validateBrowserExecution(carrier,{suite,scope,manifest,sourceCommit,requiredWorkerPaths=[]}){
  check(carrier?.schema===schema&&carrier.suite===suite,'missing or wrong suite carrier');
  check(['LOCAL','DEPLOYED'].includes(scope)&&carrier.scope===scope,'scope mismatch');
  check(carrier.sourceCommit===sourceCommit&&manifest.sourceCommit===sourceCommit,'source mismatch');
  check(carrier.manifestDigest===manifest.manifestDigest.digest&&carrier.buildIdentity===manifest.buildIdentity,'artifact mismatch');
  check(carrier.complete===true&&carrier.applicationReady===true&&typeof carrier.browserVersion==='string'&&carrier.browserVersion.length>0,'incomplete browser execution');
  const base=siteBase(carrier.pageUrl,scope,manifest);check(carrier.pageOrigin===base.origin,'page origin mismatch');
  const expected=new Map(manifest.runtimeResources.map(item=>[item.path,item]));
  check(Array.isArray(carrier.resources)&&carrier.resources.length===expected.size,'incomplete HTTP resource graph');
  const paths=new Set();
  for(const row of carrier.resources){const item=expected.get(row.path);check(item&&!paths.has(row.path),'unknown or duplicate HTTP resource');paths.add(row.path);check(row.observation==='BROWSER_HTTP_BYTES'&&row.status===200&&row.responseUrl===new URL(row.path,base).href,'wrong HTTP observation');check(row.byteSize===item.byteSize&&row.sha256===item.digest,'HTTP resource differs: '+row.path);}
  check(Array.isArray(carrier.observedScriptSources),'missing script observations');
  check(Array.isArray(carrier.observedDocuments)&&carrier.observedDocuments.length>0,'loaded document was not observed');
  const index=expected.get('index.html');
  for(const row of carrier.observedDocuments){const url=parsedUrl(row.url);check(url.origin===base.origin&&[base.pathname,base.pathname+'index.html'].includes(url.pathname)&&row.status===200&&row.observation==='BROWSER_DOCUMENT_RESPONSE','invalid loaded document observation');check(row.byteSize===index.byteSize&&row.sha256===index.digest,'loaded document differs');}
  const seen=new Set(),pageScripts=new Set();
  for(const row of carrier.observedScriptSources){const item=expected.get(row.path),url=parsedUrl(row.url),key=row.targetType+':'+row.url;check(item&&row.path.endsWith('.js')&&!seen.has(key),'unknown or duplicate script source');seen.add(key);check(['PAGE','WORKER'].includes(row.targetType)&&row.observation==='DEBUGGER_SCRIPT_SOURCE','wrong script observation');check(url.origin===base.origin&&url.pathname===new URL(row.path,base).pathname,'script outside expected graph');check(row.byteSize===item.byteSize&&row.sha256===item.digest,'parsed script differs: '+row.path);if(row.targetType==='PAGE')pageScripts.add(row.path);}
  check(mainScripts.every(name=>pageScripts.has(name)),'main application scripts were not observed');
  check(Array.isArray(carrier.observedWorkers)&&new Set(carrier.observedWorkers).size===carrier.observedWorkers.length,'invalid observed worker list');
  for(const url of carrier.observedWorkers)check(carrier.observedScriptSources.some(row=>row.targetType==='WORKER'&&row.url===url),'worker source was not observed');
  check(Array.isArray(requiredWorkerPaths)&&new Set(requiredWorkerPaths).size===requiredWorkerPaths.length,'invalid required worker source contract');
  for(const name of requiredWorkerPaths)check(expected.has(name)&&carrier.observedScriptSources.some(row=>row.path===name&&row.targetType==='WORKER'&&carrier.observedWorkers.includes(row.url)),'required worker source was not observed: '+name);
  const unobserved=[...expected.keys()].filter(name=>!carrier.observedScriptSources.some(row=>row.path===name)).sort();
  check(JSON.stringify(carrier.unobservedRuntimeResources)===JSON.stringify(unobserved),'unobserved resource list differs');
  return true;
}
class ObserverConnection{
  constructor(url,onEvent){
    this.pending=new Map();this.sequence=0;this.closed=false;this.expectedClose=false;this.ws=new WebSocket(url);
    this.ready=new Promise((resolve,reject)=>{this.rejectReady=reject;this.ws.onopen=resolve;this.ws.onerror=()=>this.failTransport(new Error('Browser evidence transport error'),onEvent);});
    this.ws.onclose=()=>this.failTransport(new Error('Browser evidence transport closed unexpectedly'),onEvent);
    this.ws.onmessage=event=>{if(this.closed)return;const message=JSON.parse(event.data),pending=this.pending.get(message.id);if(pending){this.pending.delete(message.id);clearTimeout(pending.timer);if(message.error){pending.reject(commandError(message.error.message,message.id,pending,{code:message.error.code,data:message.error.data}));}else pending.resolve(message.result);}else onEvent(message);};
  }
  failTransport(error,onEvent){if(this.closed)return;this.closed=true;this.rejectReady(error);for(const [id,item] of this.pending){clearTimeout(item.timer);item.reject(commandError(error.message,id,item,{failure:'TRANSPORT'}));}this.pending.clear();if(!this.expectedClose)onEvent({method:'Observer.transportClosed',params:{message:error.message}});}
  async send(method,params={},sessionId){await this.ready;const id=++this.sequence,context={method,params,sessionId,sentAt:Date.now()};if(this.closed)throw commandError('Browser evidence transport closed before '+method,id,context,{failure:'TRANSPORT'});return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(commandError('Browser evidence command timed out: '+method,id,context,{failure:'TIMEOUT'}));},30000);this.pending.set(id,{resolve,reject,timer,...context});try{this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));}catch(error){this.pending.delete(id);clearTimeout(timer);reject(commandError(error.message,id,context,{failure:'SEND'}));}});}
  close(){if(this.closed)return;this.expectedClose=true;this.closed=true;this.ws.close();for(const [id,item] of this.pending){clearTimeout(item.timer);item.reject(commandError('Browser evidence observer closed',id,item,{failure:'OBSERVER_CLOSE'}));}this.pending.clear();}
}
// CDP command completion can precede the parsed-source event for a worker
// attached during navigation. Wait for observations, never infer them from a
// completed Debugger.enable request or a separately fetched copy of the file.
export async function waitForBrowserExecutionObservations({pending,errors,workerTargets,workers,timeoutMs=30000}){
  const deadline=Date.now()+timeoutMs;
  while(pending.size||[...workerTargets].some(url=>!workers.has(url))){
    if(errors.length)throw errors[0];
    const remaining=deadline-Date.now();
    check(remaining>0,'timed out waiting for parsed script observations from every started worker');
    await new Promise(resolve=>setTimeout(resolve,Math.min(25,remaining)));
  }
  if(errors.length)throw errors[0];
}
export async function createBrowserExecutionObserver({webSocketDebuggerUrl,pageUrl,suite=path.basename(process.argv[1]),environment=process.env}){
  const expected=await loadBrowserExpectedSite(environment);if(!expected)return null;
  const base=siteBase(pageUrl,expected.scope,expected.manifest),resources=new Map(expected.manifest.runtimeResources.map(item=>[item.path,item]));
  const pending=new Set(),errors=[],sources=new Map(),workers=new Set(),workerTargets=new Set(),sessions=new Map(),documentRequests=new Map(),documents=new Map(),diagnosticSessions=new Map(),workerSessionIds=new Set(),verifiedWorkerSessionIds=new Set(),scriptIdentities=new Map(),retiredSessions=new Set();let closed=false;
  const track=promise=>{pending.add(promise);promise.catch(error=>{if(!closed){errors.push(error);const session=diagnosticSessions.get(error.observerCommand?.sessionId);console.error('BROWSER_EXECUTION_OBSERVER_DIAGNOSTIC '+JSON.stringify({error:error.message,command:error.observerCommand||null,session:session||null,pendingCount:pending.size,workerTargetCount:workerTargets.size,observedWorkerCount:workers.size,at:Date.now()}));}}).finally(()=>pending.delete(promise));};
  const connection=new ObserverConnection(webSocketDebuggerUrl,message=>{
    if(closed)return;
    if(message.method==='Observer.transportClosed'){errors.push(new Error(message.params.message));return;}
    if(message.method==='Target.detachedFromTarget'){const known=sessions.get(message.params.sessionId);if(!known||(message.params.targetId&&message.params.targetId!==known.targetId)){errors.push(new Error('BROWSER_EXECUTION_EVIDENCE: detached target identity differs: '+message.params.sessionId));return;}retiredSessions.add(message.params.sessionId);const session=diagnosticSessions.get(message.params.sessionId);if(session){session.detachedAt=Date.now();session.detachEvent=message.params;console.error('BROWSER_EXECUTION_OBSERVER_EVENT '+JSON.stringify({kind:'detached',sessionId:message.params.sessionId,targetInfo:session.targetInfo,at:session.detachedAt}));}}
    if(message.method==='Network.responseReceived'&&message.params.type==='Document'){
      const {requestId,response}=message.params;documentRequests.set(requestId,{url:response.url,status:response.status});return;
    }
    if(message.method==='Network.loadingFinished'&&documentRequests.has(message.params.requestId)){
      const requestId=message.params.requestId,row=documentRequests.get(requestId);documentRequests.delete(requestId);
      track((async()=>{const result=await connection.send('Network.getResponseBody',{requestId}),bytes=Buffer.from(result.body,result.base64Encoded?'base64':'utf8');documents.set(row.url,{...row,byteSize:bytes.length,sha256:sha(bytes),observation:'BROWSER_DOCUMENT_RESPONSE'});})());return;
    }
    if(message.method==='Target.attachedToTarget'){
      const {sessionId,targetInfo}=message.params;
      const prior=sessions.get(sessionId);if(prior){if(retiredSessions.has(sessionId)){errors.push(new Error('BROWSER_EXECUTION_EVIDENCE: retired worker session was reattached: '+sessionId));return;}if(prior.targetId!==targetInfo.targetId||prior.type!==targetInfo.type||prior.url!==targetInfo.url)errors.push(new Error('BROWSER_EXECUTION_EVIDENCE: attached session identity changed: '+sessionId));return;}
      if(targetInfo.type!=='worker'||!targetInfo.url){errors.push(new Error('BROWSER_EXECUTION_EVIDENCE: attached target is not an identified worker: '+sessionId));return;}
      workerSessionIds.add(sessionId);diagnosticSessions.set(sessionId,{sessionId,targetInfo,attachedAt:Date.now(),detachedAt:null,parsed:[],verified:[]});console.error('BROWSER_EXECUTION_OBSERVER_EVENT '+JSON.stringify({kind:'attached',sessionId,targetInfo,at:Date.now()}));sessions.set(sessionId,targetInfo);if(targetInfo.type==='worker'&&targetInfo.url)workerTargets.add(targetInfo.url);
      track(connection.send('Debugger.enable',{},sessionId));
      return;
    }
    if(message.method!=='Debugger.scriptParsed'||!message.params.url)return;
    const {url,scriptId}=message.params,parsedAt=Date.now();diagnosticSessions.get(message.sessionId)?.parsed.push({url,scriptId,at:parsedAt});if(message.sessionId)console.error('BROWSER_EXECUTION_OBSERVER_EVENT '+JSON.stringify({kind:'parsed',sessionId:message.sessionId,url,scriptId,at:parsedAt}));let parsed;try{parsed=new URL(url);}catch{if(message.sessionId)errors.push(new Error('BROWSER_EXECUTION_EVIDENCE: malformed worker script URL: '+url));return;}
    const name=parsed.pathname.slice(base.pathname.length),item=resources.get(name);
    // The document's CSP-authorized inline bootstrap is bound through the actual
    // loaded document response. URL-less scripts are verifier CDP expressions.
    if(!message.sessionId&&parsed.origin===base.origin&&[base.pathname,base.pathname+'index.html'].includes(parsed.pathname))return;
    if(parsed.origin!==base.origin||!parsed.pathname.startsWith(base.pathname)||!item||!name.endsWith('.js')){errors.push(new Error('BROWSER_EXECUTION_EVIDENCE: script outside expected runtime graph: '+url));return;}
    const session=message.sessionId?sessions.get(message.sessionId):null;
    if(message.sessionId&&(!session||session.type!=='worker')){errors.push(new Error('BROWSER_EXECUTION_EVIDENCE: parsed source has unknown or non-worker session: '+message.sessionId));return;}
    const identityKey=message.sessionId?message.sessionId+':'+scriptId:null,priorIdentity=identityKey?scriptIdentities.get(identityKey):null;
    if(priorIdentity&&(priorIdentity.url!==url||priorIdentity.targetId!==(session?.targetId||null))){errors.push(new Error('BROWSER_EXECUTION_EVIDENCE: parsed script identity changed: '+identityKey));return;}
    const identity=identityKey?(priorIdentity||{url,targetId:session.targetId,verified:false}):null;if(identity)scriptIdentities.set(identityKey,identity);
    const targetType=message.sessionId?'WORKER':'PAGE',key=targetType+':'+url;
    track((async()=>{const {scriptSource}=await connection.send('Debugger.getScriptSource',{scriptId},message.sessionId),bytes=Buffer.from(scriptSource,'utf8'),row={path:name,byteSize:bytes.length,sha256:sha(bytes),url,targetType,observation:'DEBUGGER_SCRIPT_SOURCE'};check(row.byteSize===item.byteSize&&row.sha256===item.digest,'loaded script bytes differ: '+name);diagnosticSessions.get(message.sessionId)?.verified.push({url,scriptId,sha256:row.sha256,byteSize:row.byteSize,at:Date.now()});if(message.sessionId)console.error('BROWSER_EXECUTION_OBSERVER_EVENT '+JSON.stringify({kind:'verified',sessionId:message.sessionId,url,scriptId,sha256:row.sha256,at:Date.now()}));if(identity)identity.verified=true;sources.set(key,row);if(message.sessionId&&session.url===url){workers.add(url);verifiedWorkerSessionIds.add(message.sessionId);}})());
  });
  try{await connection.ready;await connection.send('Runtime.enable');await connection.send('Network.enable');await connection.send('Debugger.enable');
  // Workers remain runnable: attaching the observer does not pause execution or
  // replace application worker, storage, timing, or response functions.
  await connection.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true});}
  catch(error){closed=true;connection.close();throw error;}
  async function evaluate(expression){const result=await connection.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});check(!result.exceptionDetails,result.exceptionDetails?.text||'browser evaluation failed');return result.result?.value;}
  return {close(){closed=true;connection.close();},async finish(){
    const page=await evaluate(`({url:location.href,origin:location.origin,ready:globalThis.closedLoopAppReady===true,buildIdentity:document.querySelector('meta[name="closed-loop-build-identity"]')?.content})`);
    check(page.ready&&page.buildIdentity===expected.manifest.buildIdentity,'current document is not the expected ready application');siteBase(page.url,expected.scope,expected.manifest);
    const actualBase=new URL('.',page.url);check(actualBase.href===base.href,'suite navigated outside its artifact root');
    const received=await evaluate(`(async()=>{const paths=${JSON.stringify([...resources.keys()])},out=[];for(const path of paths){const response=await fetch(new URL(path,${JSON.stringify(base.href)}),{cache:'no-store',redirect:'error'}),bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));out.push({path,responseUrl:response.url,status:response.status,base64:btoa(binary)});}return out;})()`);
    // The final protocol await may itself deliver new worker/source events.
    // Drain and validate them after that await, then finalize synchronously.
    const browser=await connection.send('Browser.getVersion');
    await waitForBrowserExecutionObservations({pending,errors,workerTargets:workerSessionIds,workers:verifiedWorkerSessionIds});
    for(const sessionId of workerSessionIds)check(verifiedWorkerSessionIds.has(sessionId),'started worker session source was not observed: '+sessionId);
    for(const [key,identity] of scriptIdentities)check(identity.verified,'parsed source was not verified: '+key);
    check(!pending.size&&!errors.length,'observer changed during finalization');
    const observedScriptSources=[...sources.values()].sort((a,b)=>(a.targetType+a.url).localeCompare(b.targetType+b.url));
    const carrier={schema,suite,...{scope:expected.scope,sourceCommit:expected.sourceCommit},manifestDigest:expected.manifest.manifestDigest.digest,buildIdentity:expected.manifest.buildIdentity,pageUrl:page.url,pageOrigin:page.origin,browserVersion:browser.product,complete:true,applicationReady:true,resources:received.map(({base64,...row})=>{const bytes=Buffer.from(base64,'base64');return {...row,byteSize:bytes.length,sha256:sha(bytes),observation:'BROWSER_HTTP_BYTES'};}),observedScriptSources,observedDocuments:[...documents.values()],observedWorkers:[...workers].sort(),unobservedRuntimeResources:[...resources.keys()].filter(name=>!observedScriptSources.some(row=>row.path===name)).sort()};
    validateBrowserExecution(carrier,{suite,...expected});closed=true;connection.close();return carrier;
  }};
}
