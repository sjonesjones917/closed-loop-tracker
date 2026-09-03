(()=>{
'use strict';

const query=self.location?.search||'';
const params=new URLSearchParams(query);
const WORKER_PROTOCOL_VERSION='closed-loop-test-worker-protocol/1';
const WORKER_BUILD_ID=params.get('v')||'UNMANIFESTED_LOCAL_RUNTIME';
importScripts(`hash.js${query}`,`test-runtime.js${query}`);

/* The worker entry owns the only permitted bootstrap load. Once the declarative
   runtime is loaded, all general network and dynamic-code surfaces are denied. */
const unavailable=name=>()=>{throw new Error(`${name} is unavailable in the Closed Loop Test IR worker.`);};
try{self.fetch=()=>Promise.reject(new Error('Network access is unavailable in the Closed Loop Test IR worker.'));}catch{}
try{self.XMLHttpRequest=unavailable('XMLHttpRequest');}catch{}
try{self.WebSocket=unavailable('WebSocket');}catch{}
try{self.EventSource=unavailable('EventSource');}catch{}
try{self.importScripts=unavailable('Dynamic importScripts');}catch{}

self.addEventListener('message',async event=>{
  const message=event?.data||{};
  if(message.type!=='EXECUTE_TEST_IR'||typeof message.requestId!=='string')return;
  try{
    const runtime=self.closedLoopTestRuntime;
    if(!runtime)throw Object.assign(new Error('Deterministic Test IR runtime did not load.'),{code:'RUNTIME_UNAVAILABLE'});
    const validation=runtime.validateSpec(message.spec,message.bindings);
    if(!validation.valid)throw Object.assign(new Error(validation.issues.join(' ')),{code:'INVALID_TEST_IR'});
    const result=await runtime.execute({spec:message.spec,artifacts:message.artifacts||{},canonicalBindings:message.canonicalBindings||{},metadata:message.metadata||{}});
    const testWorkerSha256=typeof message.metadata?.testWorkerSha256==='string'&&/^[0-9a-f]{64}$/.test(message.metadata.testWorkerSha256)?message.metadata.testWorkerSha256:null;
    self.postMessage({requestId:message.requestId,ok:true,result:{...result,runtimeBuildIdentity:result.runtimeBuildIdentity||WORKER_BUILD_ID,workerProtocolVersion:WORKER_PROTOCOL_VERSION,testWorkerSha256}});
  }catch(error){
    self.postMessage({requestId:message.requestId,ok:false,error:{code:error?.code||'WORKER_EXECUTION_FAILED',message:String(error?.message||error),disposition:error?.disposition||'EXECUTION_FAILED',runtimeBuildIdentity:WORKER_BUILD_ID,workerProtocolVersion:WORKER_PROTOCOL_VERSION}});
  }
});
})();
