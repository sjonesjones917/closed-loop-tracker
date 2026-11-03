import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runVerifier} from './verify-conformance-regressions.mjs';

const originalForward="  process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');";
const drainedForward="  await Promise.all([new Promise((resolve,reject)=>process.stdout.write('',error=>error?reject(error):resolve())),new Promise((resolve,reject)=>process.stderr.write('',error=>error?reject(error):resolve()))]);";
const sha=value=>createHash('sha256').update(value).digest('hex');
const baselineSha256='fc2ef23be71f4b3816875d56449d611c243c85d695ea1315eba92b700a48d08c';

// Actual collector function and real backpressured OS pipes. Only its external
// producer/site/receipt dependencies are explicit fixtures; no browser or
// admissible verification receipt is produced by this output-lifecycle control.
export async function verifyBrowserProducerOutput(){
 const source=fs.readFileSync(new URL('./collect-verification-evidence.mjs',import.meta.url),'utf8');
 assert.equal(source.split(drainedForward).length,2,'BROWSER_PRODUCER_DRAIN_ANCHOR_ORACLE');
 const baseline=source.replace(drainedForward,originalForward).replace(",stdio:'inherit'",'').replace('  // Forward while the producer is alive; drain the forwarded streams before\n  // receipt validation can throw. Raw output remains owned by runVerifier.\n','');
 assert.equal(sha(baseline),baselineSha256,'BROWSER_PRODUCER_BASELINE_SOURCE_ORACLE');
 const payload={fixture:'browser-producer-output-only',payload:'X'.repeat(262144)},stdout=JSON.stringify(payload)+'\n',stderr='E'.repeat(131072)+'\n';
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'browser-producer-output-'));
 const extract=text=>{const start='export async function executeBrowserEvidenceProducer(',end='export async function collectVerificationEvidence(';assert.equal(text.split(start).length,2,'BROWSER_PRODUCER_FUNCTION_START_ORACLE');assert.equal(text.split(end).length,2,'BROWSER_PRODUCER_FUNCTION_END_ORACLE');const a=text.indexOf(start),b=text.indexOf(end);assert(b>a,'BROWSER_PRODUCER_FUNCTION_ORDER_ORACLE');return text.slice(a,b);};
 try{
  fs.writeFileSync(path.join(directory,'verified-site.mjs'),'export function validateSite(){return {syntheticOutputFixture:true};}\n');
  const relay=path.join(directory,'slow-reader.mjs');
  fs.writeFileSync(relay,`import fs from 'node:fs';
import {spawn} from 'node:child_process';
const child=spawn(process.execPath,[process.argv[2]],{stdio:['ignore','pipe','pipe','ipc']}),out=[],err=[];
let timer=null,released=false,releaseReason=null,total=0,relayError=null;
const release=reason=>{if(released)return;if(timer)clearTimeout(timer);released=true;releaseReason=reason;child.stdout.resume();child.stderr.resume();};
const collect=(chunks,chunk)=>{total+=chunk.length;if(total>1024*1024){relayError=new Error('BROWSER_OUTPUT_RELAY_LIMIT');child.kill('SIGTERM');release('limit');return;}chunks.push(chunk);};
child.stdout.on('data',chunk=>collect(out,chunk));child.stderr.on('data',chunk=>collect(err,chunk));child.stdout.pause();child.stderr.pause();
child.on('message',message=>{if(message==='ready'&&!released&&timer===null)timer=setTimeout(()=>release('timer'),250);});
child.on('exit',()=>release('exit'));
const outcome=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});
release('closed');fs.writeFileSync(process.argv[3],JSON.stringify({releaseReason,stdoutBytes:out.reduce((n,c)=>n+c.length,0),stderrBytes:err.reduce((n,c)=>n+c.length,0)}));
if(relayError)throw relayError;
const write=(stream,bytes)=>new Promise((resolve,reject)=>stream.write(bytes,error=>error?reject(error):resolve()));
await Promise.all([write(process.stdout,Buffer.concat(out)),write(process.stderr,Buffer.concat(err))]);
if(outcome.signal)throw new Error('BROWSER_OUTPUT_CHILD_SIGNAL:'+outcome.signal);
process.exitCode=outcome.code??1;
`);
  let sequence=0;
  async function runCase(text,mode){
   const caseDirectory=path.join(directory,String(++sequence));fs.mkdirSync(caseDirectory);
   const script=path.join(directory,'case-'+sequence+'.mjs'),observation=path.join(caseDirectory,'reader.json'),receipt=path.join(caseDirectory,'receipts/browser/LOCAL/fixture-browser-owner.mjs.json'),completed=path.join(caseDirectory,'completed.json');
   const fixture={stdout,stderr,status:mode==='success'?0:1,signal:null,error:null};
   fs.writeFileSync(script,`import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';\nconst browserVerificationCatalog={'fixture-browser-owner.mjs':{timeoutMs:600000}},fixture=${JSON.stringify(fixture)},mode=${JSON.stringify(mode)};\nconst evidenceFingerprint=()=>({sourceInputsSha256:'unchanged-fixture'}),sha=()=>{throw new Error('UNEXPECTED_SUPERSEDED_RECEIPT');},runVerifier=async(...args)=>{if(args[2]?.stdio==='inherit'){process.stdout.write(fixture.stdout);process.stderr.write(fixture.stderr);}return fixture;};\nconst createExecutionReceipt=()=>{if(mode==='failure')throw Object.assign(new Error('BROWSER_OUTPUT_EXPECTED_RECEIPT_REJECTION'),{code:'BROWSER_OUTPUT_EXPECTED_RECEIPT_REJECTION'});return {syntheticOutputFixture:true,result:'PASS'};};\n`+extract(text)+`\nawait new Promise((resolve,reject)=>process.send('ready',error=>error?reject(error):resolve()));\nconst result=await executeBrowserEvidenceProducer('fixture-browser-owner.mjs',{scope:'LOCAL',directory:${JSON.stringify(path.join(caseDirectory,'receipts'))},cwd:${JSON.stringify(caseDirectory)},environment:{STATIC_SITE_ROOT:${JSON.stringify(caseDirectory)}}});\nassert.deepEqual(result,{syntheticOutputFixture:true,result:'PASS'});assert.equal(mode,'success','BROWSER_PRODUCER_FAILURE_FALLTHROUGH_ORACLE');fs.writeFileSync(${JSON.stringify(completed)},'returned');\n`);
   const child=await runVerifier(process.execPath,[relay,script,observation],{timeout:30000,maxBuffer:1024*1024,evidenceDirectory:path.join(caseDirectory,'runner')});
   assert.equal(child.stdout,stdout,'BROWSER_PRODUCER_OUTPUT_COMPLETENESS_ORACLE:'+mode);
   assert.equal(child.stderr.slice(0,stderr.length),stderr,'BROWSER_PRODUCER_STDERR_COMPLETENESS_ORACLE:'+mode);
   assert.equal(child.signal,null,'BROWSER_PRODUCER_SIGNAL_ORACLE');assert(!child.error,'BROWSER_PRODUCER_EXECUTION_ORACLE');assert.equal(child.status,mode==='success'?0:1,'BROWSER_PRODUCER_EXIT_ORACLE');
   const observed=JSON.parse(fs.readFileSync(observation,'utf8'));assert.equal(observed.releaseReason,'timer','BROWSER_PRODUCER_BACKPRESSURE_ORACLE');assert.equal(observed.stdoutBytes,Buffer.byteLength(stdout));assert.equal(observed.stderrBytes,Buffer.byteLength(child.stderr));
   assert.deepEqual(JSON.parse(child.stdout),payload,'BROWSER_PRODUCER_JSON_ORACLE');
   if(mode==='success'){assert.equal(child.stderr,stderr);assert.equal(fs.readFileSync(completed,'utf8'),'returned');assert.deepEqual(JSON.parse(fs.readFileSync(receipt,'utf8')),{syntheticOutputFixture:true,result:'PASS'});}
   else{assert.match(child.stderr.slice(stderr.length),/BROWSER_OUTPUT_EXPECTED_RECEIPT_REJECTION/,'BROWSER_PRODUCER_ORIGINAL_REJECTION_ORACLE');assert.equal(fs.existsSync(completed),false);assert.equal(fs.existsSync(receipt),false);}
   return {caseId:mode,result:'PASS',stdoutComplete:true,stderrPrefixComplete:true,terminalOutcomePreserved:true,receiptOutcomePreserved:true,backpressureObserved:true};
  }
  // A real producer cannot finish until its progress reaches the observer.
  // This distinguishes streaming from replay-after-exit without timing a fast
  // child. Its own bounded wait fails closed if the collector buffers output.
  async function liveCase(text){
   const folder=path.join(directory,'live-'+(++sequence));fs.mkdirSync(folder);
   const producer=path.join(folder,'fixture-browser-owner.mjs'),release=path.join(folder,'release'),script=path.join(directory,'live-'+sequence+'.mjs'),observer=path.join(folder,'observer.mjs');
   fs.writeFileSync(producer,`import fs from 'node:fs';console.log('LIVE_PROGRESS');console.error('LIVE_DIAGNOSTIC');const deadline=Date.now()+2000;while(!fs.existsSync(${JSON.stringify(release)})){if(Date.now()>deadline)throw new Error('LIVE_PROGRESS_NOT_FORWARDED');await new Promise(r=>setTimeout(r,10));}console.log('LIVE_FINISHED');`);
   fs.writeFileSync(script,`import fs from 'node:fs';import path from 'node:path';import {runVerifier} from ${JSON.stringify(new URL('./verify-conformance-regressions.mjs',import.meta.url).href)};const browserVerificationCatalog={'fixture-browser-owner.mjs':{timeoutMs:5000}},evidenceFingerprint=()=>({sourceInputsSha256:'fixture'}),sha=()=>{throw new Error('unexpected prior receipt');};const createExecutionReceipt=(suite,result)=>{if(result.status!==0)throw new Error('LIVE_PRODUCER_FAILED');return {synthetic:true};};\n`.replaceAll('\\n','\n')+extract(text)+`\nawait executeBrowserEvidenceProducer('fixture-browser-owner.mjs',{scope:'LOCAL',cwd:${JSON.stringify(folder)},environment:{...process.env,STATIC_SITE_ROOT:${JSON.stringify(folder)}}});\n`.replaceAll('\\n','\n'));
   fs.writeFileSync(observer,`import fs from 'node:fs';import {spawn} from 'node:child_process';const child=spawn(process.execPath,[${JSON.stringify(script)}],{stdio:['ignore','pipe','pipe',3]}),out=[],err=[];let stdout='',stderr='';const release=()=>{if(stdout.includes('LIVE_PROGRESS\\n')&&stderr.includes('LIVE_DIAGNOSTIC\\n'))fs.writeFileSync(${JSON.stringify(release)},'observed');};child.stdout.on('data',b=>{out.push(b);stdout+=b;release();});child.stderr.on('data',b=>{err.push(b);stderr+=b;release();});const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});process.stdout.write(Buffer.concat(out));process.stderr.write(Buffer.concat(err));process.exitCode=code??1;`);
   const result=await runVerifier(process.execPath,[observer],{timeout:10000,evidenceDirectory:path.join(folder,'runner')});
   assert.equal(result.status,0,'BROWSER_PRODUCER_LIVE_OUTPUT_ORACLE: '+result.stderr);
   assert.equal(result.stdout,'LIVE_PROGRESS\nLIVE_FINISHED\n','BROWSER_PRODUCER_OUTPUT_ONCE_ORACLE');
   assert.equal(result.stderr,'LIVE_DIAGNOSTIC\n','BROWSER_PRODUCER_DIAGNOSTIC_ONCE_ORACLE');
  }
  await liveCase(source);
  const buffered=source.replace(",stdio:'inherit'",'').replace(drainedForward,drainedForward.replace("write('',error","write(result.stdout||'',error").replace("process.stderr.write('',error","process.stderr.write(result.stderr||'',error"));
  await assert.rejects(()=>liveCase(buffered),error=>error?.code==='ERR_ASSERTION'&&error.message.includes('BROWSER_PRODUCER_LIVE_OUTPUT_ORACLE'));
  const cases=[await runCase(source,'success'),await runCase(source,'failure')];
  await assert.rejects(()=>runCase(baseline,'failure'),error=>error?.code==='ERR_ASSERTION'&&error.message.includes('BROWSER_PRODUCER_OUTPUT_COMPLETENESS_ORACLE:failure'),'BROWSER_PRODUCER_BASELINE_SPECIFIC_FAILURE_ORACLE');
  return {schema:'browser-producer-output/1',result:'PASS',synthetic:true,actualBrowser:false,applicationExecuted:false,eligibleReceiptCreated:false,collectorSha256:sha(source),helperSha256:sha(fs.readFileSync(new URL(import.meta.url))),baselineSha256,stdoutBytes:Buffer.byteLength(stdout),stdoutSha256:sha(stdout),stderrPrefixBytes:Buffer.byteLength(stderr),stderrPrefixSha256:sha(stderr),liveOutputBeforeExit:true,liveOutputExactlyOnce:true,bufferedOutputFaultDetected:true,caseCount:2,cases,faults:[{fault:'unawaited-forwarding',detected:true,oracle:'BROWSER_PRODUCER_OUTPUT_COMPLETENESS_ORACLE:failure'}]};
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
