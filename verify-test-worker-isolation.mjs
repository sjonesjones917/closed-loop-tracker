import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const encoder=new TextEncoder();
const workerSource=fs.readFileSync(new URL('./test-worker.js',import.meta.url),'utf8');
const runtimeSource=fs.readFileSync(new URL('./test-runtime.js',import.meta.url),'utf8');
const hashSource=fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8');
function workerFixture(source=workerSource,{search=''}={}){
let listener=null;const messages=[],imports=[];let bootstrapOpen=true;
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL,URLSearchParams,setTimeout,clearTimeout,Date,Math,Promise,location:{search},fetch:async()=>({ok:true}),XMLHttpRequest:function(){},WebSocket:function(){},EventSource:function(){},eval,Function,addEventListener(type,fn){if(type==='message')listener=fn;},postMessage(message){messages.push(message);},importScripts(...urls){assert.equal(bootstrapOpen,true);for(const url of urls){imports.push(String(url));const file=String(url).split('?')[0];if(file==='hash.js')vm.runInContext(hashSource,context,{filename:'hash.js'});else if(file==='test-runtime.js')vm.runInContext(runtimeSource,context,{filename:'test-runtime.js'});else throw new Error(`unexpected bootstrap script ${file}`);}}};
context.self=context;context.globalThis=context;vm.createContext(context);vm.runInContext(source,context,{filename:'test-worker.js'});bootstrapOpen=false;assert.equal(typeof listener,'function');return {context,listener,messages,imports};
}
async function guards(context){
await assert.rejects(()=>context.fetch('https://example.invalid'),/Network access is unavailable/);for(const [name,args] of [['XMLHttpRequest',[]],['WebSocket',['wss://example.invalid']],['EventSource',['https://example.invalid']],['importScripts',['evil.js']],['eval',['1+1']],['Function',['return 1']]])assert.throws(()=>context[name](...args),/unavailable/i,'WORKER_ISOLATION_ORACLE: '+name+' must be disabled');
}
const {context,listener,messages}=workerFixture();await guards(context);
const spec={version:'closed-loop-test-spec/1',languageVersion:context.closedLoopTestRuntime.TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:context.closedLoopTestRuntime.OPERATION_REGISTRY_VERSION,operationRegistrySha256:context.closedLoopTestRuntime.OPERATION_REGISTRY_SHA256,steps:[{stepId:'S001',op:'LOAD_ARTIFACT',inputs:{binding:{bindingRef:'PRODUCT'}}},{stepId:'S002',op:'READ_BYTES',inputs:{artifact:{stepRef:'S001',output:'artifact'}}},{stepId:'S003',op:'DECODE_UTF8',inputs:{bytes:{stepRef:'S002',output:'bytes'}}},{stepId:'S004',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S003',output:'text'},expected:{literal:'worker-ok'}}}],result:{stepRef:'S004',output:'assertion'}};
const bindings={PRODUCT:'ART-WORKER'};const metadata={testId:'TEST-WORKER',bindings};
await listener({data:{type:'EXECUTE_TEST_IR',requestId:'REQ-1',spec,bindings,artifacts:{PRODUCT:{artifactId:'ART-WORKER',filename:'worker.txt',bytes:encoder.encode('worker-ok')}},canonicalBindings:{},metadata}});assert.equal(messages.length,1);assert.equal(messages[0].requestId,'REQ-1');assert.equal(messages[0].ok,true);assert.equal(messages[0].result.determination,'SATISFIED');assert.equal(messages[0].result.workerProtocolVersion,'closed-loop-test-worker-protocol/1');
const beforeExtra=messages.length;await listener({data:{type:'EXECUTE_TEST_IR',requestId:'REQ-EXTRA',spec,bindings,artifacts:{},canonicalBindings:{},metadata,ambientProjectState:{secret:true}}});assert.equal(messages.length,beforeExtra+1);assert.equal(messages.at(-1).ok,false);assert.equal(messages.at(-1).error.code,'INVALID_WORKER_REQUEST');
const beforeInvalid=messages.length;const invalidBindings={};await listener({data:{type:'EXECUTE_TEST_IR',requestId:'REQ-2',spec:{version:'closed-loop-test-spec/1',steps:[{stepId:'S001',op:'SHELL',inputs:{command:{literal:'echo forbidden'}}}],result:{stepRef:'S001',output:'value'}},bindings:invalidBindings,artifacts:{},canonicalBindings:{},metadata:{testId:'TEST-INVALID',bindings:invalidBindings}}});assert.equal(messages.length,beforeInvalid+1);assert.equal(messages.at(-1).ok,false);assert.equal(messages.at(-1).error.code,'INVALID_TEST_IR');
const workerBuild='build-sha256-'+'b'.repeat(64),workerDigest='a'.repeat(64),query='?v='+workerBuild+'&workerSha256='+workerDigest;
const bound=workerFixture(workerSource,{search:query});
assert.deepEqual(bound.imports,['hash.js'+query,'test-runtime.js'+query],'Worker bootstrap lost the exact build query or dependency order.');
const request={type:'EXECUTE_TEST_IR',requestId:'BOUND-REQUEST',spec,bindings,artifacts:{PRODUCT:{artifactId:'ART-WORKER',filename:'worker.txt',bytes:encoder.encode('worker-ok')}},canonicalBindings:{},metadata};
await bound.listener({data:request});
assert.equal(bound.messages.at(-1).ok,true);assert.equal(bound.messages.at(-1).result.determination,'SATISFIED');
for(const [key,value] of Object.entries({runtimeBuildIdentity:workerBuild,testWorkerSha256:workerDigest,workerProtocolVersion:'closed-loop-test-worker-protocol/1'}))assert.equal(bound.messages.at(-1).result[key],value,'Bound worker result omitted '+key);
const missingDigest=workerFixture(workerSource,{search:'?v='+workerBuild});await missingDigest.listener({data:request});assert.equal(missingDigest.messages.at(-1).ok,false);assert.equal(missingDigest.messages.at(-1).error.code,'WORKER_DIGEST_IDENTITY_MISSING');
const mismatch=workerFixture(workerSource,{search:query}),actualExecute=mismatch.context.closedLoopTestRuntime.execute;
mismatch.context.closedLoopTestRuntime={...mismatch.context.closedLoopTestRuntime,execute:async options=>({...await actualExecute(options),runtimeBuildIdentity:'DIFFERENT_BUILD'})};
await mismatch.listener({data:request});assert.equal(mismatch.messages.at(-1).ok,false);assert.equal(mismatch.messages.at(-1).error.code,'RUNTIME_BUILD_IDENTITY_MISMATCH');
const callerIdentity=workerFixture(workerSource,{search:query});await callerIdentity.listener({data:{...request,metadata:{...metadata,testWorkerSha256:'f'.repeat(64)}}});assert.equal(callerIdentity.messages.at(-1).ok,false);assert.equal(callerIdentity.messages.at(-1).error.code,'INVALID_WORKER_REQUEST');
const boundWorkerCases=['versioned-bootstrap-dependency-order','bound-success-result','missing-url-digest-rejected','mismatched-runtime-result-rejected','caller-supplied-digest-rejected'];
const faults=[];
for(const name of ['eval','Function']){
 const before=`self.${name}=unavailable('${name}')`,after=`self.${name}=globalThis.${name}`;
 assert(workerSource.includes(before),'Worker fault target must exist');
 await assert.rejects(guards(workerFixture(workerSource.replace(before,after)).context),/WORKER_ISOLATION_ORACLE/,'The faulted worker must fail because its callable surface is open.');
 await guards(workerFixture().context);faults.push({caseId:'enabled-'+name,detected:true,restored:'PASS'});
}
console.log(JSON.stringify({verifyTestWorkerIsolation:'PASS',boundWorkerCases,environment:'Node VM worker protocol; not a physical browser worker',faults,networkDenied:true,dynamicCodeDenied:true,bootstrapClosed:true,declarativeExecution:true,closedRequestEnvelope:true,ambientProjectStateRejected:true,invalidOperationRejected:true}));
