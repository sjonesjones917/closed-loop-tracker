import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {createBrowserReadiness:readinessFactory}=await import(pathToFileURL(path.resolve(process.env.BROWSER_READINESS_SOURCE||'operator-browser-driver.mjs')));
const boundedWait=async(fn)=>{for(let i=0;i<6;i++){const value=await fn();if(value)return value;}throw new Error('Controlled destination never became ready');};
import {createVerifierRuntime} from './verifier-runtime.mjs';
const appSource=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),html=fs.readFileSync(process.env.HTML_SOURCE||'index.html','utf8');
const cases=[],prefixes=process.argv.filter(x=>x.startsWith('--case-prefix=')).map(x=>x.slice(14)),flush=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};
function startupGuardAuthorization(source=html){
 const policy=source.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1]||'',body=source.match(/<script id="closed-loop-startup-guard">([\s\S]*?)<\/script>/)?.[1];
 assert.equal(typeof body,'string','Startup guard script is missing.');
 const digest=crypto.createHash('sha256').update(body).digest('base64'),token=`'sha256-${digest}'`;
 return {policy,digest,token,authorized:policy.includes(token)};
}
function environment({loadError=null,core=true,controlledLoad=null}={}){
 let time=0,id=0,loadCalls=0,reloads=0;const timers=new Map(),listeners=new Map(),nodes=new Map(),logs=[];
 function node(id=''){const attrs={},classes=new Set();return {id,attrs,style:{},hidden:false,disabled:false,textContent:'',innerHTML:'',isConnected:true,parentElement:null,setAttribute(k,v){attrs[k]=String(v);},removeAttribute(k){delete attrs[k];},getAttribute(k){return attrs[k]??null;},hasAttribute(k){return k in attrs;},classList:{add(...c){c.forEach(x=>classes.add(x));},remove(...c){c.forEach(x=>classes.delete(x));},contains:x=>classes.has(x)},addEventListener(){},append(){},querySelector(){return null;},querySelectorAll(){return[];},closest(){return null;},focus(){},scrollIntoView(){},getBoundingClientRect(){return {top:0,bottom:44,height:44};}};}
 for(const m of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){const n=node(m[1]);n.hidden=/\bhidden\b/.test(m[0]);n.disabled=/\bdisabled\b/.test(m[0]);if(/\binert\b/.test(m[0]))n.setAttribute('inert','');if(/aria-busy="true"/.test(m[0]))n.setAttribute('aria-busy','true');nodes.set(m[1],n);}
 const setTimeout=(fn,delay=0)=>{timers.set(++id,{fn,at:time+delay});return id;},clearTimeout=id=>timers.delete(id),on=(name,fn,options)=>{const list=listeners.get(name)||[];list.push({fn,once:options?.once});listeners.set(name,list);};
 const document={currentScript:null,readyState:'loading',documentElement:{clientHeight:852},body:{append(n){if(n.id)nodes.set(n.id,n);}},querySelector:s=>s.startsWith('#')?nodes.get(s.slice(1))||null:null,querySelectorAll:()=>[],getElementById:id=>nodes.get(id)||null,createElement:()=>node(),addEventListener:on,elementFromPoint:()=>null};
 const context=createVerifierRuntime({console:{error(...args){logs.push(args.map(String));},log(){}},document,URL,URLSearchParams,Blob,TextEncoder,TextDecoder,AbortController,structuredClone,crypto:crypto.webcrypto,setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame:fn=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout,addEventListener:on,innerWidth:393,innerHeight:852,performance:{now:()=>time},location:{href:'https://fixture.invalid/',reload(){reloads++;}},Event:class Event{},dispatchEvent(){}});context.window=context;
 context.__controlledLoad=async paint=>{loadCalls++;if(loadError)throw Object.assign(new Error(loadError),{code:'STORAGE_OPEN_TIMEOUT'});if(controlledLoad)await controlledLoad(context,paint);};
 const bootstrap=html.match(/<script id="closed-loop-startup-guard">([\s\S]*?)<\/script>/)?.[1];if(bootstrap)vm.runInContext(bootstrap,context,{filename:'index.html#closed-loop-startup-guard'});
 const run=()=>{if(core)context.closedLoopCore={};const anchor='globalThis.closedLoopAppReady=false;';assert.equal(appSource.split(anchor).length-1,1,'Startup instrumentation anchor is not unique');const instrumented=appSource.replace(anchor,'load=()=>globalThis.__controlledLoad(paintOperatorAction);'+anchor);vm.runInContext(instrumented,context,{filename:'app-core.js'});};
 const emit=async name=>{const list=listeners.get(name)||[];listeners.set(name,list.filter(x=>!x.once));list.forEach(x=>x.fn({type:name}));await flush();};
 const advance=async ms=>{const target=time+ms;for(let n=0;n<10000;n++){const task=[...timers].filter(([,x])=>x.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!task){time=target;await flush();return;}time=task[1].at;timers.delete(task[0]);task[1].fn();await flush();}throw new Error('Timer loop exceeded the fixture bound');};
 return {run,emit,advance,context,nodes,timers,logs,observed:()=>({loadCalls,reloads,appBusy:nodes.get('app').getAttribute('aria-busy'),appInert:nodes.get('app').hasAttribute('inert'),startupHidden:nodes.get('app-startup-status').hidden,recoveryVisible:Boolean(nodes.get('startup-retry')&&!nodes.get('startup-retry').hidden),ready:context.closedLoopAppReady===true,error:context.closedLoopAppError||null})};
}
async function check(caseId,expected,fn){if(prefixes.length&&!prefixes.some(x=>caseId.startsWith(x)))return;const row={caseId,expected};cases.push(row);try{row.actual=await fn();row.status='PASS';}catch(error){row.actual={error:String(error.stack||error),observed:error.actual??null};row.status='FAIL';}}

await check('VERIFIER-LAYOUT-QUIESCENCE','A browser action is observed only after the destination layout has settled, including a later animation-frame geometry change.',async()=>{
 const source=fs.readFileSync(process.env.BROWSER_READINESS_SOURCE||'operator-browser-driver.mjs','utf8'),start=source.lastIndexOf('async function idle('),end=source.indexOf('\n  async function ',start+1);assert(start>=0&&end>start);
 let frames=0;const positions=[10,10,120,160,160,160],context=createVerifierRuntime({readiness:{idle:async()=>{}},document:{fonts:{ready:Promise.resolve()},querySelectorAll:()=>[{getBoundingClientRect:()=>({toJSON:()=>({top:positions[Math.min(frames,positions.length)-1]||10})})}]},requestAnimationFrame:fn=>queueMicrotask(()=>{frames++;fn();})});
 context.evaluate=expression=>vm.runInContext(expression,context);vm.runInContext(source.slice(start,end),context);await context.idle();assert(frames>=positions.length,'VERIFIER_LAYOUT_QUIESCENCE_ORACLE: the verifier returned before the late layout transition settled');return {frames,positions,actualDriverOwner:true,syntheticAnimationFrames:true};
});
await check('VERIFIER-CONSUMER-INTERACTION','Every browser operator control waits until actual startup completes and the application is interactive.',async()=>{
 const observed=[];
 for(const [file,functions,kind] of [['verify-browser.mjs',['waitForIdle','click','fill'],'cdp'],['verify-browser-extra.mjs',['waitForIdle','click','fill'],'cdp'],['verify-mobile-stage-action.mjs',['waitForIdle','click','fill'],'mobile'],['operator-browser-driver.mjs',['idle','click','fill'],'driver']]){
  for(const action of ['click','fill']){
   let release,actions=0;const held=new Promise(resolve=>{release=resolve;}),blocked=Symbol('waiting');
   const e=environment({controlledLoad:async(context,paint)=>{context.document.readyState='complete';paint();await held;}});e.run();await flush();
   const button={disabled:false,parentElement:null,scrollIntoView(){},click(){actions++;},dispatchEvent(){actions++;},value:''};e.nodes.set('test-control',button);
   const source=fs.readFileSync(file,'utf8');let extracted='';
   for(const name of functions){const start=kind==='driver'?source.lastIndexOf('async function '+name+'('):source.indexOf('async function '+name+'(');assert(start>=0);const next=source.indexOf('\n',start);let end=source.indexOf('\nasync function ',start+1);if(kind==='driver')end=source.indexOf('\n  async function ',start+1);assert(end>start);extracted+=source.slice(start,end)+'\n';}
   const evaluate=async(...args)=>{const result=vm.runInContext(args.at(-1),e.context);await flush();await e.advance(0);return result;},wait=async(_cdp,expression)=>{if(!await evaluate(expression))throw blocked;return true;};
   Object.assign(e.context,{evalValue:evaluate,evaluate,waitExpr:wait,waitFor:wait,events:[],assert:(v,m)=>assert.ok(v,m),until:async fn=>{if(!await fn())throw blocked;return true;}});e.context.assert.equal=assert.equal;
   e.context.createBrowserReadiness=(cdp,evaluate,options)=>readinessFactory(cdp,evaluate,{...options,wait:e.context.until});e.context.readiness=e.context.createBrowserReadiness({},evaluate);
   vm.runInContext(extracted,e.context);
   const invoke=()=>kind==='driver'?e.context[action]('#test-control','draft'):e.context[action]({},'#test-control','draft');
   try{await invoke();}catch(error){if(error!==blocked)throw error;}
   const before={...e.observed(),actions};release();await flush();
   await invoke();const after={...e.observed(),actions};
   observed.push({file,action,before,after});
  }
 }
 const failed=observed.filter(row=>row.before.actions!==0||row.after.actions===0);
 assert.equal(failed.length,0,'VERIFIER_CONSUMER_INTERACTION_ORACLE: '+JSON.stringify(observed));return observed;
});
await check('VERIFIER-CONSUMER-NAVIGATION','Each reload or direct project navigation binds readiness to the destination document; no fixed delay permits a prior document to stand in for it.',async()=>{
 const observed=[];
 for(const file of ['verify-browser.mjs','verify-browser-extra.mjs','verify-mobile-stage-action.mjs','operator-browser-driver.mjs']){
  const source=fs.readFileSync(file,'utf8'),driver=file==='operator-browser-driver.mjs';
  const extract=name=>{const start=source.indexOf('async function '+name+'(');if(start<0)return '';const end=source.indexOf(driver?'\n  async function ':'\nasync function ',start+1);assert(end>start);return source.slice(start,end);};
  for(const action of driver?['reload','openUrl']:['openStoredFixture']){
   let loader='previous-document',navigating=false,reads=0,readyDocument=null;
   const cdp={async send(method){if(method==='Page.navigate'||method==='Page.reload'){navigating=true;return {frameId:'main',loaderId:'destination-document'};}if(method==='Page.getFrameTree'){if(navigating&&++reads>=2)loader='destination-document';return {frameTree:{frame:{id:'main',loaderId:loader}}};}throw new Error('Unexpected CDP method: '+method);}};
   const runtime=createVerifierRuntime({page:cdp,events:[],delay:async()=>{},evaluate:async()=> 'https://fixture.invalid/?project=retained',evalValue:async()=> 'https://fixture.invalid/?project=retained',waitForIdle:async()=>{readyDocument=loader;},idle:async()=>{readyDocument=loader;},waitExpr:async()=>{readyDocument=loader;},poll:async fn=>{let error;for(let attempt=0;attempt<4;attempt++){try{return await fn();}catch(caught){error=caught;}}throw error;}});
   runtime.createBrowserReadiness=(cdp,evaluate,options)=>readinessFactory(cdp,evaluate,{...options,wait:boundedWait});runtime.evalValue=runtime.evaluate=async(...args)=>{const expression=args.at(-1);if(expression.includes('new URL'))return 'https://fixture.invalid/?project=retained';readyDocument=loader;return true;};runtime.readiness=runtime.createBrowserReadiness(cdp,runtime.evaluate);
   vm.runInContext(extract('navigateAndWait')+extract(action),runtime);
   if(driver)await runtime[action]('https://fixture.invalid/?project=retained');else await runtime[action](cdp);
   observed.push({file,action,readyDocument,loader});
  }
 }
 assert.equal(observed.filter(row=>row.readyDocument!=='destination-document').length,0,'VERIFIER_CONSUMER_NAVIGATION_ORACLE: '+JSON.stringify(observed));return observed;
});
await check('VERIFIER-HISTORY-DESTINATION','Browser history traversal waits for the requested entry before judging readiness, including delayed multi-entry traversal.',async()=>{
 const source=fs.readFileSync('operator-browser-driver.mjs','utf8'),start=source.lastIndexOf('async function restoreEntry('),end=source.indexOf('\n  async function ',start+1);assert(start>=0&&end>start);
 let entry=11,polls=0,navigating=false,readyEntry=null;const events=[];
 const page={async send(method,params){if(method==='Page.navigateToHistoryEntry'){navigating=true;return {};}if(method==='Page.getNavigationHistory'){if(navigating&&++polls>=3)entry=44;return {currentIndex:entry===44?3:0,entries:[{id:11},{id:22},{id:33},{id:44}]};}throw new Error(method);}};
 const runtime=createVerifierRuntime({page,events,delay:async()=>{},idle:async()=>{readyEntry=entry;},until:async fn=>{for(let i=0;i<5;i++){const value=await fn();if(value)return value;}throw new Error('Destination history entry never arrived');}});
 runtime.readiness=readinessFactory(page,async()=>{readyEntry=entry;return true;},{wait:boundedWait});
 vm.runInContext(source.slice(start,end),runtime);await runtime.restoreEntry(44);
 assert.equal(readyEntry,44,'VERIFIER_HISTORY_DESTINATION_ORACLE: previous history entry cannot satisfy destination readiness');return {readyEntry,polls,events,syntheticCdp:true};
});
await check('VERIFIER-STARTUP-INTERACTION','An operator verifier waits for completed startup and an interactive application, even after controls render during saved-view restoration.',async()=>{
 let release;const held=new Promise(resolve=>{release=resolve;});
 const e=environment({controlledLoad:async(context,paint)=>{context.document.readyState='complete';paint();await held;}});
 e.run();await flush();
 const source=fs.readFileSync(process.env.BROWSER_EXTRA_SOURCE||'verify-browser-extra.mjs','utf8'),start=source.indexOf('async function waitForIdle('),end=source.indexOf('\nasync function ',start+1);
 assert(start>=0&&end>start);let admitted;
 e.context.evalValue=async(_cdp,expression)=>vm.runInContext(expression,e.context);
 e.context.createBrowserReadiness=(cdp,evaluate,options)=>readinessFactory(cdp,evaluate,{...options,wait:async fn=>{admitted=Boolean(await fn());return admitted;}});
 vm.runInContext(source.slice(start,end),e.context);
 await e.context.waitForIdle({});const before={...e.observed(),verifierAdmitted:admitted};
 release();await flush();await e.context.waitForIdle({});const after={...e.observed(),verifierAdmitted:admitted};
 assert.equal(before.error,null);assert.equal(before.ready,false);assert.equal(before.appInert,true);assert.equal(before.appBusy,null);
 assert.equal(before.verifierAdmitted,false,'VERIFIER_STARTUP_INTERACTION_ORACLE: inert startup controls are not available to the operator');
 assert.equal(after.ready,true);assert.equal(after.appInert,false);assert.equal(after.verifierAdmitted,true,'VERIFIER_READY_INTERACTION_ORACLE');
 return {before,after,syntheticPolling:true,actualStartupOwner:true};
});
await check('IO-STARTUP-CSP','The exact authored startup guard bytes are authorized by the document CSP, and a one-byte script mutation is rejected by the same oracle.',async()=>{const healthy=startupGuardAuthorization();assert.equal(healthy.authorized,true,'IO_STARTUP_CSP_ORACLE');const marker='Application files did not load. Check the connection, then reload.';const mutated=html.replace(marker,marker+'!');const fault=startupGuardAuthorization(mutated);assert.equal(fault.authorized,false,'IO_STARTUP_CSP_FAULT_ORACLE');return {healthyDigest:healthy.digest,faultDigest:fault.digest,faultDetected:!fault.authorized};});
await check('VERIFIER-DESTINATION-DOCUMENT','Opening saved work waits for the new document and its completed startup; readiness of the previous document cannot release the operator.',async()=>{
 const source=fs.readFileSync(process.env.BROWSER_EXTRA_SOURCE||'verify-browser-extra.mjs','utf8');
 const extract=name=>{const start=source.indexOf('async function '+name+'(');if(start<0)return '';const end=source.indexOf('\nasync function ',start+1);assert(end>start);return source.slice(start,end);};
 const observations=[];let navigating=false,reads=0,loader='previous-document',readyDocument=null;
 const cdp={async send(method){observations.push(method);if(method==='Page.navigate'||method==='Page.reload'){navigating=true;return {frameId:'main',loaderId:'destination-document'};}if(method==='Page.getFrameTree'){if(navigating&&++reads>=2)loader='destination-document';return {frameTree:{frame:{id:'main',loaderId:loader}}};}throw new Error('Unexpected CDP method: '+method);}};
 const runtime=createVerifierRuntime({evalValue:async()=> 'https://fixture.invalid/?project=retained',waitForIdle:async()=>{readyDocument=loader;},waitExpr:async()=>{readyDocument=loader;},poll:async fn=>{let error;for(let attempt=0;attempt<4;attempt++){try{return await fn();}catch(caught){error=caught;}}throw error;}});
 runtime.createBrowserReadiness=(cdp,evaluate,options)=>readinessFactory(cdp,evaluate,{...options,wait:boundedWait});runtime.evalValue=async(_cdp,expression)=>{if(expression.includes('new URL'))return 'https://fixture.invalid/?project=retained';readyDocument=loader;return true;};
 vm.runInContext(extract('navigateAndWait')+extract('openStoredFixture'),runtime);
 await runtime.openStoredFixture(cdp);
 assert.equal(readyDocument,'destination-document','VERIFIER_DESTINATION_DOCUMENT_ORACLE: the prior document cannot satisfy destination readiness');
 if(runtime.navigateAndWait){navigating=false;reads=0;loader='previous-document';readyDocument=null;await runtime.navigateAndWait(cdp,'Page.reload');assert.equal(readyDocument,'destination-document','VERIFIER_RELOAD_DOCUMENT_ORACLE');}
 return {observations,readyDocument,syntheticCdp:true,priorDocumentReadyThroughout:true};
});
await check('IO-STARTUP-CONTROL','A successful startup hides its own startup view, clears busy/inert, and cannot initialize twice.',async()=>{const e=environment();e.run();await flush();await e.emit('closed-loop-core-ready');await e.advance(60001);const observed=e.observed();assert.equal(observed.ready,true);assert.equal(observed.loadCalls,1);assert.equal(observed.appBusy,null);assert.equal(observed.appInert,false);assert.equal(observed.startupHidden,true);assert.equal(observed.error,null);return observed;});
await check('IO-STARTUP-FAILURE','A failed storage startup stops loading semantics and exposes recovery outside the protected application.',async()=>{const e=environment({loadError:'The storage request did not return.'});e.run();await flush();const observed=e.observed();assert.equal(observed.ready,false);assert.equal(observed.appBusy,null,'IO_STARTUP_BUSY_ORACLE');assert.equal(observed.appInert,true);assert.equal(observed.recoveryVisible,true,'IO_STARTUP_RECOVERY_ORACLE');assert.equal(e.nodes.get('app-operation-status').hidden,true);assert(observed.error.includes('storage request'));return observed;});
await check('IO-STARTUP-RELOAD','Recovery reload remains available after failure and repeated activation does not issue a second reload.',async()=>{const e=environment({loadError:'Storage is unavailable.'});e.run();await flush();const control=e.nodes.get('startup-retry');assert(control&&!control.hidden,'IO_STARTUP_RELOAD_ORACLE');control.onclick();control.onclick();assert.equal(e.observed().reloads,1);assert.equal(control.disabled,true);return e.observed();});
await check('IO-STARTUP-MODULES','If a deferred runtime script never arrives, the startup view becomes an actionable failure by its declared module deadline.',async()=>{const e=environment();await e.advance(30000);const observed=e.observed();assert(observed.error,'IO_MODULE_DEADLINE_ORACLE');assert.equal(observed.appBusy,null);assert.equal(observed.recoveryVisible,true);assert.equal(observed.ready,false);return observed;});
await check('IO-STARTUP-LATE-MODULE','A runtime arriving after module startup failed cannot later activate saved work behind the failure message.',async()=>{const e=environment();await e.advance(30000);e.run();await flush();const observed=e.observed();assert.equal(observed.loadCalls,0,'IO_LATE_MODULE_ORACLE');assert.equal(observed.ready,false);assert.equal(observed.recoveryVisible,true);return observed;});
await check('IO-STARTUP-CORE','An app script with an unavailable prerequisite stops waiting and ignores a late ready event until reload.',async()=>{const e=environment({core:false});e.run();await e.advance(30000);const before=e.observed();assert(before.error,'IO_CORE_DEADLINE_ORACLE');await e.emit('closed-loop-core-ready');await flush();assert.equal(e.observed().loadCalls,0);assert.equal(e.observed().ready,false);return {before,after:e.observed()};});
// The named Chromium hangs must terminate at the gate's budget, not at a
// slower CDP request deadline. These are pending platform reads, not product
// failures. The outer watchdog observes a missing timeout without hanging CI.
async function boundedObservation(operation){
 let timer;
 try{return await Promise.race([operation.then(value=>({outcome:'PASS',value}),error=>({outcome:error.code==='VERIFIER_TIMEOUT'?'TIMEOUT':'FAIL',code:error.code,message:error.message})),new Promise(resolve=>{timer=setTimeout(()=>resolve({outcome:'UNSETTLED'}),100);})]);}
 finally{clearTimeout(timer);}
}
await check('VERIFIER-BOUNDED-READ','A pending browser observation terminates as TIMEOUT at its declared gate budget; a late answer cannot turn it into success or start another read.',async()=>{
 let release,reads=0;const pending=new Promise(resolve=>{release=resolve;});
 const readiness=readinessFactory({},async()=>{reads++;return pending;},{timeout:20});
 const outcome=await boundedObservation(readiness.idle());release(true);await flush();
 assert.equal(outcome.outcome,'TIMEOUT','VERIFIER_GATE_DEADLINE_ORACLE: a non-resolving browser read escaped its gate deadline');
 assert.equal(reads,1,'VERIFIER_GATE_DEADLINE_ORACLE: the expired gate issued another observation');
 assert.equal(await readinessFactory({},async()=>true,{timeout:20}).idle(),true,'A corrected observation must still progress');
 return {outcome,reads,disposableBudgetMs:20,outerWatchdogMs:100,lateAnswerIgnored:true,correctedObservation:'PASS'};
});
await check('VERIFIER-BOUNDED-NAVIGATION','A pending destination lookup or navigation command terminates as TIMEOUT; a late lookup cannot issue a navigation after the gate has ended.',async()=>{
 const observations=[];
 for(const heldMethod of ['Page.getFrameTree','Page.navigate','Page.navigateToHistoryEntry']){
  let release;const pending=new Promise(resolve=>{release=resolve;}),calls=[];
  const cdp={async send(method){calls.push(method);if(method===heldMethod)return pending;return {frameTree:{frame:{loaderId:'previous'}}};}};
  const readiness=readinessFactory(cdp,async()=>true,{timeout:20});
  const operation=heldMethod==='Page.navigateToHistoryEntry'?readiness.restoreEntry(7):readiness.navigate('Page.navigate',{url:'https://fixture.invalid/'});
  const outcome=await boundedObservation(operation),callsAtTimeout=[...calls];release({frameTree:{frame:{loaderId:'previous'}},loaderId:'destination'});await flush();
  assert.equal(outcome.outcome,'TIMEOUT','VERIFIER_NAVIGATION_DEADLINE_ORACLE: '+heldMethod+' escaped its gate deadline');
  assert.deepEqual(calls,callsAtTimeout,'VERIFIER_NAVIGATION_DEADLINE_ORACLE: a late answer started further navigation work');
  observations.push({heldMethod,outcome,calls,disposableBudgetMs:20,outerWatchdogMs:100});
 }
 return observations;
});
if(!cases.length)throw new Error('No selected startup cases');console.log(JSON.stringify({schema:'closed-loop-startup-deadlines/1',syntheticDom:true,controlledLoadBoundary:true,physicalBrowser:false,appSha256:crypto.createHash('sha256').update(appSource).digest('hex'),htmlSha256:crypto.createHash('sha256').update(html).digest('hex'),cases},null,2));if(cases.some(x=>x.status!=='PASS'))process.exitCode=1;
