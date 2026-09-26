import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';

const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
const html=fs.readFileSync(process.env.HTML_SOURCE||'index.html','utf8');
const cases=[];
const note=(caseId,details={})=>cases.push({caseId,...details,result:'PASS'});

// D-1 remains operator-reserved; this verifies only the configurable production default.
assert.match(source,/const OPERATION_LOADING_THRESHOLD_MS=1500;/,'D-1 default is not a single 1.5 second production constant.');
assert.match(html,/id="app-startup-status"[^>]*role="status"/,'Startup has no dedicated status surface.');
assert.match(html,/id="app-operation-status"[^>]*hidden/,'Ordinary operation indicator is visible during startup.');
assert.notEqual(html.indexOf('id="app-startup-status"'),html.indexOf('id="app-operation-status"'),'Startup and operation loading reuse one element.');
note('UX-014-D1-SINGLE-THRESHOLD',{thresholdMs:1500});
note('UX-015-SEPARATE-STARTUP-SURFACE');

function element(id){return {id,hidden:id==='app-operation-status'||id==='operation-error',textContent:'',innerHTML:'',className:'',attrs:{},isConnected:true,classList:{add(...v){this.values=(this.values||new Set());for(const x of v)this.values.add(x);},remove(){},contains(v){return this.values?.has(v)||false;}},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},getAttribute(k){return this.attrs[k]??null;}};}
const nodes=new Map(['app-startup-status','app-operation-status','operation-label','app-live-status','app','storage-status'].map(id=>['#'+id,element(id)]));
let releaseLoad,failLoad=false,announcements=[];
const loadPromise=()=>new Promise((resolve,reject)=>{releaseLoad=()=>failLoad?reject(Object.assign(new Error('CONTROLLED_STARTUP_FAILURE'),{code:'CONTROLLED_STARTUP'})):resolve();});
const start=source.indexOf('globalThis.closedLoopAppReady=false;');
const end=source.indexOf('// Long-section navigation',start);
assert.ok(start>=0&&end>start,'Startup production block missing.');
const context=createVerifierRuntime({console,Date,setTimeout,clearTimeout});
Object.assign(context,{closedLoopCore:true,operationLatencySamples:[],OPERATION_LOADING_THRESHOLD_MS:1500,OPERATION_LATENCY_SAMPLE_LIMIT:512,operationClock:()=>Date.now(),recordOperationLatency(kind,label,startedAt,outcome){const durationMs=Date.now()-startedAt;context.operationLatencySamples.push({kind,label,durationMs,outcome,thresholdMs:1500});return durationMs;},$:selector=>nodes.get(selector)||null,load:loadPromise,esc:String,announce:m=>announcements.push(String(m)),addEventListener(){}});
vm.runInContext(source.slice(start,end),context,{filename:'app-core-startup.js'});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(nodes.get('#app-startup-status').hidden,false,'Startup status disappeared before startup completed.');
assert.equal(nodes.get('#app-operation-status').hidden,true,'Startup activated ordinary operation loading.');
assert.equal(nodes.get('#app').attrs.inert,'','Application controls were not inert during startup.');
assert.equal(nodes.get('#app').attrs['aria-busy'],'true','Application did not expose startup busy state.');
releaseLoad();await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(context.closedLoopAppReady,true,'Successful startup did not mark readiness.');
assert.equal(nodes.get('#app-startup-status').hidden,true,'Successful startup left startup status visible.');
assert.equal(nodes.get('#app').attrs.inert,undefined,'Successful startup left application inert.');
assert.equal(nodes.get('#app').attrs['aria-busy'],undefined,'Successful startup left application busy.');
assert.equal(context.operationLatencySamples.at(-1).outcome,'COMPLETED');
note('UX-015-STARTUP-LIFECYCLE');
note('UX-020-STARTUP-LATENCY-RECORDED',{recordedOutcome:'COMPLETED'});

// Re-run the exact startup block with a controlled failure. It must terminate in
// an actionable failure state, not an indefinitely running loading indicator.
const failedNodes=new Map(['app-startup-status','app-operation-status','operation-label','app-live-status','app','storage-status'].map(id=>['#'+id,element(id)]));
const failed=createVerifierRuntime({console,Date,setTimeout,clearTimeout});
let rejectStartup;
Object.assign(failed,{closedLoopCore:true,operationLatencySamples:[],OPERATION_LOADING_THRESHOLD_MS:1500,OPERATION_LATENCY_SAMPLE_LIMIT:512,operationClock:()=>Date.now(),recordOperationLatency(kind,label,startedAt,outcome){const durationMs=Date.now()-startedAt;failed.operationLatencySamples.push({kind,label,durationMs,outcome,thresholdMs:1500});return durationMs;},$:selector=>failedNodes.get(selector)||null,load:()=>new Promise((_resolve,reject)=>{rejectStartup=reject;}),esc:String,announce:m=>announcements.push(String(m)),addEventListener(){}});
vm.runInContext(source.slice(start,end),failed,{filename:'app-core-startup-failure.js'});await new Promise(resolve=>setTimeout(resolve,0));rejectStartup(new Error('CONTROLLED_STARTUP_FAILURE'));await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(failed.closedLoopAppReady,false);
assert.match(failed.closedLoopAppError,/CONTROLLED_STARTUP_FAILURE/);
assert.equal(failedNodes.get('#app-startup-status').hidden,false,'Failed startup hid its failure state.');
assert.match(failedNodes.get('#app-startup-status').innerHTML,/Startup failed/);
assert.equal(failedNodes.get('#app-operation-status').hidden,true,'Failed startup was misrepresented as an ordinary loading operation.');
assert.equal(failed.operationLatencySamples.at(-1).outcome,'FAILED');
note('UX-016-STARTUP-FAILURE-TERMINATES');
note('UX-017-FAILED-STARTUP-NOT-SPINNER');

// The ordinary action lifecycle regression exercises the actual timer and
// duplicate-control state. This suite verifies the production telemetry owner
// is present and bounded rather than inferring runtime measurements from source.
assert.match(source,/operationLatencySamples\.length>OPERATION_LATENCY_SAMPLE_LIMIT/,'Operation latency evidence is unbounded.');
assert.match(source,/recordOperationLatency\('operator'/,'Operator actions do not record latency.');
assert.match(source,/recordOperationLatency\('storage'/,'Storage operations do not record latency.');
assert.match(source,/recordOperationLatency\('restoration'/,'History restoration does not record latency.');
note('UX-020-WORKFLOW-LATENCY-OWNERS',{sampleLimit:512});

// Execute the production telemetry owner and the journey's actual collection
// owner. Equal observations remain distinct; rereads must not count them twice.
const journeySource=fs.readFileSync(process.env.JOURNEY_SOURCE||'verify-complete-operator-journey.mjs','utf8');
async function verifyJourneyLatency(appSource,journey){
  const boundary=appSource.indexOf('let core,schema,engine');assert.ok(boundary>0);
  function applicationSession(identity){
    const runtime=createVerifierRuntime({document:{currentScript:null,querySelector:()=>null},performance:{now:()=>100},crypto:{randomUUID:()=>identity}});
    createVerifierRuntime.loadScript(runtime,appSource.slice(0,boundary)+'globalThis.recordMeasuredOperation=()=>recordOperationLatency("operator","Repeated measured operation",83,"COMPLETED");})();',{filename:'app-core.js:actual-latency-owner'});
    return runtime;
  }
  let active=applicationSession('before-reload');const report={},browser={evaluate:async expression=>createVerifierRuntime.loadScript(active,expression,{filename:'actual-latency-observation'})};
  const runtime=createVerifierRuntime({report,browser,assert,stage:1,preserveReport:()=>{}});
  const begin=journey.indexOf('async function captureOperationLatency('),end=journey.indexOf('\nasync function inspectPresentation(',begin);
  if(begin>=0){assert.ok(end>begin);createVerifierRuntime.loadScript(runtime,journey.slice(begin,end)+'\nglobalThis.collectLatency=captureOperationLatency;',{filename:'journey:actual-latency-collection'});}
  else{
    const original=journey.match(/report\.operationLatency=await browser\.evaluate\(`closedLoopOperationLatencyEvidence\(\)`\);/)?.[0];assert.ok(original,'The defective-source replay requires the original observation owner.');
    createVerifierRuntime.loadScript(runtime,'globalThis.collectLatency=async()=>{'+original+'};',{filename:'journey:original-latency-observation'});
  }
  active.recordMeasuredOperation();await runtime.collectLatency();
  active=applicationSession('after-reload');active.recordMeasuredOperation();await runtime.collectLatency();
  assert.equal(report.operationLatency.samples.length,2,'LATENCY_JOURNEY_COVERAGE_ORACLE: reload discarded previously observed operation latency.');
  assert.equal(new Set(report.operationLatency.samples.map(sample=>sample.sessionId)).size,2,'LATENCY_JOURNEY_COVERAGE_ORACLE: reload observations require distinct runtime identities.');
  const limit=active.closedLoopOperationLatencyEvidence().sampleLimit,total=limit*2+17;
  for(let i=0;i<total;i++){active.recordMeasuredOperation();if(i%37===0)await runtime.collectLatency();}
  await runtime.collectLatency();await runtime.collectLatency();
  assert.equal(report.operationLatency.samples.length,total+2,'LATENCY_JOURNEY_COVERAGE_ORACLE: rolling windows or repeated reads lost or duplicated measured operations.');
  assert.ok(report.operationLatency.samples.every(sample=>sample.durationMs===17),'LATENCY_JOURNEY_COVERAGE_ORACLE: measured durations changed.');
  assert.equal(active.closedLoopOperationLatencyEvidence().samples.length,limit,'Application observation retention must remain bounded.');
  const retained=JSON.stringify(report.operationLatency.samples);active=applicationSession('missed-window');for(let i=0;i<=limit;i++)active.recordMeasuredOperation();
  await assert.rejects(()=>runtime.collectLatency(),/LATENCY_WINDOW_GAP/,'LATENCY_JOURNEY_COVERAGE_ORACLE: silently accepted a missed sample window.');
  assert.equal(JSON.stringify(report.operationLatency.samples),retained,'A missed window destroyed already observed evidence.');
  return {samplesPreserved:total+2,runtimeSessions:2,applicationSampleLimit:limit,repeatedReadsNotCounted:true,missingWindowRejected:true};
}
const latencyJourney=await verifyJourneyLatency(source,journeySource);
note('UX-021-LATENCY-ACROSS-RELOAD-AND-ROLLOVER',latencyJourney);
assert.ok(journeySource.includes('report.operationLatency??='),'The overwrite fault must target the actual collection owner.');
await assert.rejects(()=>verifyJourneyLatency(source,journeySource.replace('report.operationLatency??=','report.operationLatency=')),/LATENCY_JOURNEY_COVERAGE_ORACLE/);
await verifyJourneyLatency(source,journeySource);note('UX-021-LATENCY-OVERWRITE-FAULT-DETECTED');
assert.ok(source.includes('sequence:++operationLatencySequence'),'The sequence fault must target the actual telemetry owner.');
await assert.rejects(()=>verifyJourneyLatency(source.replace('sequence:++operationLatencySequence','sequence:operationLatencySequence'),journeySource),/LATENCY_JOURNEY_COVERAGE_ORACLE|LATENCY_WINDOW_GAP/);
await verifyJourneyLatency(source,journeySource);note('UX-021-LATENCY-SEQUENCE-FAULT-DETECTED');

console.log(JSON.stringify({schema:'closed-loop-operator-feedback-cases/1',productionSourceSha256:createHash('sha256').update(source).digest('hex'),htmlSha256:createHash('sha256').update(html).digest('hex'),synthetic:true,actualBrowser:false,cases},null,2));
