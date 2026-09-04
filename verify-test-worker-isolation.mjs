import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const encoder=new TextEncoder();
const workerSource=fs.readFileSync(new URL('./test-worker.js',import.meta.url),'utf8');
const runtimeSource=fs.readFileSync(new URL('./test-runtime.js',import.meta.url),'utf8');
const hashSource=fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8');

let listener=null;
const messages=[];
let bootstrapOpen=true;
const context={
  console,
  crypto:webcrypto,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  ArrayBuffer,
  DataView,
  URL,
  URLSearchParams,
  setTimeout,
  clearTimeout,
  Date,
  Math,
  Promise,
  location:{search:''},
  fetch:async()=>({ok:true}),
  XMLHttpRequest:function XMLHttpRequest(){},
  WebSocket:function WebSocket(){},
  EventSource:function EventSource(){},
  eval,
  Function,
  addEventListener(type,fn){if(type==='message')listener=fn;},
  postMessage(message){messages.push(message);},
  importScripts(...urls){
    assert.equal(bootstrapOpen,true,'worker bootstrap importScripts may execute only during initial load');
    for(const url of urls){
      const file=String(url).split('?')[0];
      if(file==='hash.js')vm.runInContext(hashSource,context,{filename:'hash.js'});
      else if(file==='test-runtime.js')vm.runInContext(runtimeSource,context,{filename:'test-runtime.js'});
      else throw new Error(`unexpected bootstrap script ${file}`);
    }
  }
};
context.self=context;context.globalThis=context;vm.createContext(context);
vm.runInContext(workerSource,context,{filename:'test-worker.js'});bootstrapOpen=false;
assert.equal(typeof listener,'function','worker must register exactly one message execution path');

await assert.rejects(()=>context.fetch('https://example.invalid'),/Network access is unavailable/);
for(const [name,args] of [['XMLHttpRequest',[]],['WebSocket',['wss://example.invalid']],['EventSource',['https://example.invalid']],['importScripts',['evil.js']],['eval',['1+1']],['Function',['return 1']]]){
  assert.throws(()=>context[name](...args),/unavailable/i,`${name} must be unavailable after bootstrap`);
}

const spec={
  version:'closed-loop-test-spec/1',
  languageVersion:context.closedLoopTestRuntime.TEST_IR_LANGUAGE_VERSION,
  operationRegistryVersion:context.closedLoopTestRuntime.OPERATION_REGISTRY_VERSION,
  operationRegistrySha256:context.closedLoopTestRuntime.OPERATION_REGISTRY_SHA256,
  steps:[
    {stepId:'S001',op:'LOAD_ARTIFACT',inputs:{binding:{bindingRef:'PRODUCT'}}},
    {stepId:'S002',op:'READ_BYTES',inputs:{artifact:{stepRef:'S001',output:'artifact'}}},
    {stepId:'S003',op:'DECODE_UTF8',inputs:{bytes:{stepRef:'S002',output:'bytes'}}},
    {stepId:'S004',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S003',output:'text'},expected:{literal:'worker-ok'}}}
  ],
  result:{stepRef:'S004',output:'assertion'}
};
await listener({data:{type:'EXECUTE_TEST_IR',requestId:'REQ-1',spec,bindings:{PRODUCT:'ART-WORKER'},artifacts:{PRODUCT:{artifactId:'ART-WORKER',filename:'worker.txt',bytes:encoder.encode('worker-ok')}},metadata:{testId:'TEST-WORKER',bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-WORKER'}}}}});
assert.equal(messages.length,1);
assert.equal(messages[0].requestId,'REQ-1');
assert.equal(messages[0].ok,true);
assert.equal(messages[0].result.determination,'SATISFIED');
assert.equal(messages[0].result.workerProtocolVersion,'closed-loop-test-worker-protocol/1');
assert.equal(messages[0].result.runtimeBuildIdentity,'UNMANIFESTED_LOCAL_RUNTIME');
assert.equal(messages[0].result.testWorkerSha256,null);

const beforeInvalid=messages.length;
await listener({data:{type:'EXECUTE_TEST_IR',requestId:'REQ-2',spec:{version:'closed-loop-test-spec/1',steps:[{stepId:'S001',op:'SHELL',inputs:{command:{literal:'echo forbidden'}}}],result:{stepRef:'S001',output:'value'}},bindings:{}}});
assert.equal(messages.length,beforeInvalid+1);
assert.equal(messages.at(-1).ok,false);
assert.equal(messages.at(-1).error.code,'INVALID_TEST_IR');

console.log(JSON.stringify({verifyTestWorkerIsolation:'PASS',networkDenied:true,dynamicCodeDenied:true,bootstrapClosed:true,declarativeExecution:true,invalidOperationRejected:true}));
