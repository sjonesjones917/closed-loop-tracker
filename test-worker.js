(()=>{
'use strict';

const query=self.location?.search||'';
importScripts(`test-runtime.js${query}`);

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
  const protocol=self.closedLoopTestRuntime?.WORKER_PROTOCOL_VERSION||'closed-loop-test-worker-protocol/1';
  const identity={requestId:message.requestId,workerProtocolVersion:protocol,workerChallengeNonce:String(message.workerChallengeNonce||'')};
  try{
    const runtime=self.closedLoopTestRuntime;
    if(!runtime)throw Object.assign(new Error('Deterministic Test IR runtime did not load.'),{code:'RUNTIME_UNAVAILABLE'});
    if(message.workerProtocolVersion!==protocol||!/^[0-9a-f]{32}$/i.test(String(message.workerChallengeNonce||'')))throw Object.assign(new Error('Worker request protocol or challenge identity is invalid.'),{code:'WORKER_IDENTITY_MISMATCH'});
    const validation=runtime.validateSpec(message.spec,message.bindings);
    if(!validation.valid)throw Object.assign(new Error(validation.issues.join(' ')),{code:'INVALID_TEST_IR'});
    const result=await runtime.execute({spec:message.spec,artifacts:message.artifacts||{},canonicalBindings:message.canonicalBindings||{},metadata:message.metadata||{}});
    self.postMessage({...identity,ok:true,result:{...result,runtimeBuildIdentity:runtime.runtimeBuildIdentity(),workerProtocolVersion:protocol,testWorkerSha256:message.metadata?.testWorkerSha256||null}});
  }catch(error){
    self.postMessage({...identity,ok:false,error:{code:error?.code||'WORKER_EXECUTION_FAILED',message:String(error?.message||error),disposition:error?.disposition||'EXECUTION_FAILED'}});
  }
});
})();
