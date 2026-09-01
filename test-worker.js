(()=>{
'use strict';

const query=self.location?.search||'';
const RUNTIME_BUILD_ID='runtime-20260901-zero-loss-62';
const WORKER_PROTOCOL_VERSION='closed-loop-test-worker-protocol/1';
importScripts(`hash.js${query}`);
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
  try{
    if(message.runtimeBuildIdentity!==RUNTIME_BUILD_ID)throw Object.assign(new Error(`Requested runtime build ${String(message.runtimeBuildIdentity||'UNKNOWN')} does not match worker build ${RUNTIME_BUILD_ID}.`),{code:'WORKER_BUILD_IDENTITY_MISMATCH'});
    if(message.workerProtocolVersion!==WORKER_PROTOCOL_VERSION)throw Object.assign(new Error(`Requested worker protocol ${String(message.workerProtocolVersion||'UNKNOWN')} does not match ${WORKER_PROTOCOL_VERSION}.`),{code:'WORKER_PROTOCOL_MISMATCH'});
    const runtime=self.closedLoopTestRuntime;
    if(!runtime)throw Object.assign(new Error('Deterministic Test IR runtime did not load.'),{code:'RUNTIME_UNAVAILABLE'});
    if(runtime.RUNTIME_BUILD_ID!==RUNTIME_BUILD_ID)throw Object.assign(new Error(`Loaded runtime build ${String(runtime.RUNTIME_BUILD_ID||'UNKNOWN')} does not match worker build ${RUNTIME_BUILD_ID}.`),{code:'WORKER_RUNTIME_BUILD_IDENTITY_MISMATCH'});
    if(runtime.WORKER_PROTOCOL_VERSION!==WORKER_PROTOCOL_VERSION)throw Object.assign(new Error(`Loaded runtime protocol ${String(runtime.WORKER_PROTOCOL_VERSION||'UNKNOWN')} does not match worker protocol ${WORKER_PROTOCOL_VERSION}.`),{code:'WORKER_RUNTIME_PROTOCOL_MISMATCH'});
    const workerAttestation=message.workerAttestation;
    if(!workerAttestation||Object.keys(workerAttestation).sort().join(',')!=='runtimeBuildIdentity,testWorkerSha256,workerProtocolVersion'||workerAttestation.runtimeBuildIdentity!==RUNTIME_BUILD_ID||workerAttestation.workerProtocolVersion!==WORKER_PROTOCOL_VERSION||workerAttestation.testWorkerSha256!==runtime.TEST_WORKER_SHA256)throw Object.assign(new Error('The parent-observed Test IR worker-byte attestation does not match this worker runtime.'),{code:'WORKER_ATTESTATION_HANDSHAKE_MISMATCH'});
    const validation=runtime.validateSpec(message.spec,message.bindings);
    if(!validation.valid)throw Object.assign(new Error(validation.issues.join(' ')),{code:'INVALID_TEST_IR'});
    const result=await runtime.execute({spec:message.spec,artifacts:message.artifacts||{},canonicalBindings:message.canonicalBindings||{},metadata:message.metadata||{}});
    Object.assign(result,{runtimeBuildIdentity:RUNTIME_BUILD_ID,workerProtocolVersion:WORKER_PROTOCOL_VERSION,testWorkerSha256:workerAttestation.testWorkerSha256,workerAttestation:{...workerAttestation}});
    self.postMessage({requestId:message.requestId,ok:true,runtimeBuildIdentity:RUNTIME_BUILD_ID,workerProtocolVersion:WORKER_PROTOCOL_VERSION,workerAttestation,result});
  }catch(error){
    self.postMessage({requestId:message.requestId,ok:false,runtimeBuildIdentity:RUNTIME_BUILD_ID,workerProtocolVersion:WORKER_PROTOCOL_VERSION,workerAttestation:message.workerAttestation||null,error:{code:error?.code||'WORKER_EXECUTION_FAILED',message:String(error?.message||error),disposition:error?.disposition||'EXECUTION_FAILED'}});
  }
});
})();
