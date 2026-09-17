import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

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
const context=vm.createContext({console,Date,setTimeout,clearTimeout,globalThis:null});context.globalThis=context;
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
const failed=vm.createContext({console,Date,setTimeout,clearTimeout,globalThis:null});failed.globalThis=failed;
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

console.log(JSON.stringify({schema:'closed-loop-operator-feedback-cases/1',productionSourceSha256:createHash('sha256').update(source).digest('hex'),htmlSha256:createHash('sha256').update(html).digest('hex'),synthetic:true,actualBrowser:false,cases},null,2));
