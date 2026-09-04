(()=>{
'use strict';

const query=self.location?.search||'';
const params=new URLSearchParams(query);
const WORKER_PROTOCOL_VERSION='closed-loop-test-worker-protocol/1';
const WORKER_BUILD_ID=params.get('v')||'UNMANIFESTED_LOCAL_RUNTIME';
const EXPECTED_WORKER_SHA256=/^[0-9a-f]{64}$/.test(params.get('workerSha256')||'')?params.get('workerSha256'):null;
importScripts(`hash.js${query}`,`test-runtime.js${query}`);

/* The worker entry owns the only permitted bootstrap load. Once the declarative
   runtime is loaded, all general network and dynamic-code surfaces are denied. */
const unavailable=name=>()=>{throw new Error(`${name} is unavailable in the Closed Loop Test IR worker.`);};
try{self.fetch=()=>Promise.reject(new Error('Network access is unavailable in the Closed Loop Test IR worker.'));}catch{}
try{self.XMLHttpRequest=unavailable('XMLHttpRequest');}catch{}
try{self.WebSocket=unavailable('WebSocket');}catch{}
try{self.EventSource=unavailable('EventSource');}catch{}
try{self.importScripts=unavailable('Dynamic importScripts');}catch{}
try{self.eval=unavailable('eval');}catch{}
try{self.Function=unavailable('Function');}catch{}

const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const REQUEST_KEYS=Object.freeze(['type','requestId','spec','bindings','artifacts','canonicalBindings','metadata']);
const METADATA_KEYS=Object.freeze(['testId','bindings']);
function assertClosedWorkerRequest(message){
  if(!message||typeof message!=='object'||Array.isArray(message))throw Object.assign(new Error('Test IR worker request must be one closed object.'),{code:'INVALID_WORKER_REQUEST'});
  for(const key of Object.keys(message))if(!REQUEST_KEYS.includes(key))throw Object.assign(new Error(`Unknown Test IR worker request property ${key}.`),{code:'INVALID_WORKER_REQUEST'});
  for(const key of ['type','requestId','spec','bindings','artifacts','canonicalBindings','metadata'])if(!hasOwn(message,key))throw Object.assign(new Error(`Missing Test IR worker request property ${key}.`),{code:'INVALID_WORKER_REQUEST'});
  if(message.type!=='EXECUTE_TEST_IR'||typeof message.requestId!=='string'||!message.requestId)throw Object.assign(new Error('Invalid Test IR worker command identity.'),{code:'INVALID_WORKER_REQUEST'});
  if(!message.metadata||typeof message.metadata!=='object'||Array.isArray(message.metadata))throw Object.assign(new Error('Test IR worker metadata must be one closed object.'),{code:'INVALID_WORKER_REQUEST'});
  for(const key of Object.keys(message.metadata))if(!METADATA_KEYS.includes(key))throw Object.assign(new Error(`Unknown Test IR worker metadata property ${key}.`),{code:'INVALID_WORKER_REQUEST'});
  if(message.metadata.bindings!==message.bindings)throw Object.assign(new Error('Test IR worker metadata bindings must be the exact request binding object.'),{code:'INVALID_WORKER_REQUEST'});
  return true;
}

self.addEventListener('message',async event=>{
  const message=event?.data||{};
  const requestId=typeof message.requestId==='string'?message.requestId:null;
  try{
    assertClosedWorkerRequest(message);
    const runtime=self.closedLoopTestRuntime;
    if(!runtime)throw Object.assign(new Error('Deterministic Test IR runtime did not load.'),{code:'RUNTIME_UNAVAILABLE'});
    if(WORKER_BUILD_ID!=='UNMANIFESTED_LOCAL_RUNTIME'&&!EXPECTED_WORKER_SHA256){
      throw Object.assign(new Error('Deployed Test IR worker URL lacks the manifest-bound worker SHA-256.'),{code:'WORKER_DIGEST_IDENTITY_MISSING'});
    }
    const validation=runtime.validateSpec(message.spec,message.bindings);
    if(!validation.valid)throw Object.assign(new Error(validation.issues.join(' ')),{code:'INVALID_TEST_IR'});
    const result=await runtime.execute({spec:message.spec,artifacts:message.artifacts||{},canonicalBindings:message.canonicalBindings||{},metadata:message.metadata});
    const runtimeReportedBuildIdentity=String(result?.runtimeBuildIdentity||'');
    if(runtimeReportedBuildIdentity&&runtimeReportedBuildIdentity!=='UNMANIFESTED_LOCAL_RUNTIME'&&runtimeReportedBuildIdentity!==WORKER_BUILD_ID){
      throw Object.assign(new Error('Test IR runtime build identity does not match the worker build identity.'),{code:'RUNTIME_BUILD_IDENTITY_MISMATCH'});
    }
    self.postMessage({requestId:message.requestId,ok:true,result:{...result,runtimeBuildIdentity:WORKER_BUILD_ID,workerProtocolVersion:WORKER_PROTOCOL_VERSION,testWorkerSha256:EXPECTED_WORKER_SHA256}});
  }catch(error){
    self.postMessage({requestId,ok:false,error:{code:error?.code||'WORKER_EXECUTION_FAILED',message:String(error?.message||error),disposition:error?.disposition||'EXECUTION_FAILED',runtimeBuildIdentity:WORKER_BUILD_ID,workerProtocolVersion:WORKER_PROTOCOL_VERSION,testWorkerSha256:EXPECTED_WORKER_SHA256}});
  }
});
})();
