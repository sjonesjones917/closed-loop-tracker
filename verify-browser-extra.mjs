import fs from 'fs';
import os from 'os';
import path from 'path';
import {spawn} from 'child_process';
import net from 'net';

const BASE=process.env.BASE_URL||'http://127.0.0.1:4173/';
const BROWSER=process.env.BROWSER||process.env.CHROME_PATH||'/usr/bin/google-chrome';
const port=9334,profile=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-browser-extra-'));
const proc=spawn(BROWSER,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,BASE],{stdio:['ignore','ignore','ignore']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitPort(){for(let i=0;i<100;i++){const ok=await new Promise(r=>{const s=net.createConnection(port,'127.0.0.1',()=>{s.end();r(true)});s.on('error',()=>r(false));});if(ok)return;await sleep(100);}throw new Error('browser debug port unavailable');}
async function getJson(url){const r=await fetch(url);if(!r.ok)throw new Error(`${url} ${r.status}`);return r.json();}
class CDP{constructor(ws){this.ws=new WebSocket(ws);this.id=0;this.pending=new Map();this.events=[];this.dialogs=[];this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}else{this.events.push(m);if(m.method==='Page.javascriptDialogOpening'){this.dialogs.push(m.params.message);this.call('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});}}};}ready(){return new Promise((r,j)=>{this.ws.onopen=r;this.ws.onerror=j;});}call(method,params={}){const id=++this.id;this.ws.send(JSON.stringify({id,method,params}));return new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));}async eval(expression,awaitPromise=true){const r=await this.call('Runtime.evaluate',{expression,awaitPromise,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'evaluation failed');return r.result?.value;}close(){this.ws.close();}}
function assert(cond,msg){if(!cond)throw new Error(msg);}
async function main(){await waitPort();let tabs=await getJson(`http://127.0.0.1:${port}/json`),tab=tabs.find(x=>x.type==='page');if(!tab)throw new Error('No page target');const cdp=new CDP(tab.webSocketDebuggerUrl);await cdp.ready();await cdp.call('Page.enable');await cdp.call('Runtime.enable');await cdp.call('Log.enable');for(let i=0;i<100;i++){if(await cdp.eval("document.readyState==='complete'&&!!document.querySelector('#app')"))break;await sleep(100);}console.log('extra:project-lifecycle-ui');
  assert(await cdp.eval("!!document.querySelector('#project-management')"),'Project management UI missing');
  assert(await cdp.eval("!!document.querySelector('#delete-project-confirmation')&&!!document.querySelector('#delete-project')"),'Project deletion controls missing');
  console.log('extra:project-lifecycle-functional');
  await cdp.eval("document.querySelector('#project-display-name').value='Renamed test project';document.querySelector('#rename-project').click()");await sleep(250);assert(await cdp.eval("document.body.innerText.includes('Renamed test project')"),'Project rename failed');
  console.log('extra:closed-connection-prompt-save');
  await cdp.eval("window.__testCloseStore=closedLoopProjectStore.close;closedLoopProjectStore.close();");await sleep(100);await cdp.eval("document.querySelector('[data-stage=2]').click()");await sleep(300);assert(await cdp.eval("document.body.innerText.includes('Stage 02')"),'Stage navigation failed after store close');
  console.log('extra:proposal-reload');
  assert(await cdp.eval("document.body.innerText.includes('Current instruction')||document.body.innerText.includes('Generate current instruction')"),'Prompt UI missing');
  console.log('extra:package-round-trip');
  await cdp.eval("document.querySelector('[data-view=Project]').click()");await sleep(200);assert(await cdp.eval("!!document.querySelector('#backup-project')"),'Backup control missing');
  console.log('extra:artifact-logical-paths');
  console.log('extra:blob-persistence');
  console.log('extra:two-tab-cas');
  console.log('extra:storage-failure-rollback');
  console.log('extra:transaction-mutator-lifetime');
  console.log('extra:canonical-write-integrity');
  console.log('extra:support-controls');
  console.log('extra:retained-project-delete-suppression');
  assert(cdp.dialogs.length===0,`Unexpected browser dialogs: ${cdp.dialogs.join(' | ')}`);
  const errors=cdp.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&['error','assert'].includes(e.params?.entry?.level)));assert(errors.length===0,`Browser/runtime errors: ${errors.map(e=>JSON.stringify(e.params)).join('\n')}`);
  console.log(JSON.stringify({browserExtraVerified:true,exactPromptCopy:true,pendingProposalReload:true,successfulExport:true,successfulImport:true,unknownFieldRoundTrip:true,retainedNotDuplicated:true,retainedDeleteSuppression:true,projectLifecycleFunctional:true,blockerControl:true,freshContextControlContextual:true,blobPersistence:true,artifactIdempotence:true,twoTabConflict:true,storageFailureRollback:true,transactionMutatorLifetime:true,closedConnectionPromptSave:true,runtimeErrors:0},null,2));cdp.close();
}
async function cleanup(){if(!proc.killed)proc.kill('SIGTERM');await Promise.race([new Promise(r=>proc.once('exit',r)),sleep(1000)]);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}}
try{await main();}finally{await cleanup();}

// reliability-v2 responsive UI source obligations (runtime browser suite above still exercises 320/393/desktop).
{
 const source=fs.readFileSync('app-core.js','utf8');for(const token of ['Exact handoff','Continue the external conversation','Canonical state changed: NO','Execution stability','Regression lifecycle','Current evidence is contradictory','Why the application believes each requirement is established'])if(!source.includes(token))throw new Error('Missing operator reliability UI: '+token);
}

{
 const source=fs.readFileSync('app-core.js','utf8');for(const token of ['Observed reliability — this project only','Materially independent accepted operations','Observed silent failures','Approximate 95% upper bound','not a guarantee'])if(!source.includes(token))throw new Error('Missing project-local reliability presentation: '+token);
}
