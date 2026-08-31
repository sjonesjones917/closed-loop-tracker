import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const source=fs.readFileSync(new URL('./test-runtime.js',import.meta.url),'utf8');
const runtimeScriptUrl='https://example.test/closed-loop/test-runtime.js?v=shared-build-identity';
const context={
  console,
  crypto:webcrypto,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  ArrayBuffer,
  DataView,
  URL,
  setTimeout,
  clearTimeout,
  Date,
  Math,
  Promise,
  document:{currentScript:{src:runtimeScriptUrl}},
  location:{href:'https://example.test/closed-loop/index.html'}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'test-runtime.js'});
const runtime=context.closedLoopTestRuntime;
assert.ok(runtime,'runtime must load');

let constructedWorkerUrl=null;
let terminated=false;
class CaptureWorker{
  constructor(url){constructedWorkerUrl=String(url);}
  postMessage(){}
  terminate(){terminated=true;}
}

const test={
  TEST_ID:'TEST-WORKER-BUILD-IDENTITY',
  EXECUTION_MODE:'APPLICATION_DETERMINISTIC',
  REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',
  EXECUTABLE_KIND:'TEST_IR',
  EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',
  EXECUTABLE_SPEC:{
    version:'closed-loop-test-spec/1',
    steps:[
      {op:'LOAD_ARTIFACT',binding:'PRODUCT'},
      {op:'READ_BYTES'},
      {op:'DECODE_UTF8'},
      {op:'ASSERT_EQ',value:'expected'}
    ]
  },
  EXECUTABLE_INPUT_BINDINGS:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-PRODUCT'}}
};
const artifact={artifactId:'ART-PRODUCT',filename:'product.txt',bytes:new TextEncoder().encode('expected')};
const result=await runtime.executeTest(test,{PRODUCT:artifact},{},{Worker:CaptureWorker,timeoutMs:5});

assert.equal(constructedWorkerUrl,'https://example.test/closed-loop/test-worker.js?v=shared-build-identity','worker must inherit the exact loaded runtime build identity');
assert.equal(result.status,'EXECUTION_FAILED','silent worker must fail closed');
assert.equal(result.failure?.code,'WORKER_TIMEOUT');
assert.equal(result.observations.length,0,'timeout must create no partial deterministic result');
assert.equal(terminated,true,'timed-out worker must be terminated');

console.log(JSON.stringify({
  verifyWorkerBuildIdentity:'PASS',
  runtimeScriptUrl,
  constructedWorkerUrl,
  timeoutFailClosed:true,
  partialDeterministicResult:false
}));
