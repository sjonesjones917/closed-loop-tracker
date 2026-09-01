(()=>{
'use strict';

const query=self.location?.search||'';
importScripts(`hash.js${query}`,`test-runtime.js${query}`);

/* Bootstrap is the only permitted import. Lock every executable or general
   network surface that exists in this worker; Test IR itself contains no op
   capable of invoking any of them. A failed lock is returned fail-closed. */
const unavailable=name=>function(){throw new Error(`${name} is unavailable in the Closed Loop Test IR worker.`);};
const rejectNetwork=()=>Promise.reject(new Error('Network access is unavailable in the Closed Loop Test IR worker.'));
const lock=(name,replacement)=>{
  if(!(name in self))return true;
  try{Object.defineProperty(self,name,{value:replacement,writable:false,configurable:false,enumerable:false});return self[name]===replacement;}catch{return false;}
};
const networkSurfaces=['fetch','XMLHttpRequest','WebSocket','EventSource','WebTransport','RTCPeerConnection'];
const networkLocks=networkSurfaces.map(name=>lock(name,name==='fetch'?rejectNetwork:unavailable(name)));
const dynamicCodeLocks=[lock('eval',unavailable('eval')),lock('Function',unavailable('Function'))];
const importLock=lock('importScripts',unavailable('Dynamic importScripts'));
const nestedWorkerLocks=[lock('Worker',unavailable('Nested Worker')),lock('SharedWorker',unavailable('SharedWorker'))];
const securityStatus=Object.freeze({
  workerContext:true,
  networkLocked:networkLocks.every(Boolean),
  dynamicCodeLocked:dynamicCodeLocks.every(Boolean),
  dynamicImportScriptsLocked:importLock,
  nestedWorkersLocked:nestedWorkerLocks.every(Boolean)
});
Object.defineProperty(self,'closedLoopWorkerSecurityStatus',{value:securityStatus,writable:false,configurable:false});

let busy=false;

self.addEventListener('message',async event=>{
  const message=event?.data||{};
  if(message.type!=='EXECUTE_TEST_IR'||typeof message.requestId!=='string')return;
  try{
    const runtime=self.closedLoopTestRuntime;
    if(!runtime)throw Object.assign(new Error('Deterministic Test IR runtime did not load.'),{code:'RUNTIME_UNAVAILABLE'});
    if(self.closedLoopHash?.BUILD_IDENTITY!==runtime.BUILD_IDENTITY||self.closedLoopHash?.CANONICAL_JSON_VERSION!==runtime.CANONICALIZATION_VERSION)throw Object.assign(new Error('Worker hash authority does not match the loaded runtime build.'),{code:'WORKER_HASH_IDENTITY_MISMATCH'});
    const allowed=new Set(['type','protocolVersion','runtimeBuildIdentity','testWorkerSha256','requestId','spec','bindings','artifacts','canonicalBindings','metadata']);
    for(const key of Object.keys(message))if(!allowed.has(key))throw Object.assign(new Error(`Unknown worker-protocol property ${key}.`),{code:'INVALID_WORKER_PROTOCOL'});
    if(message.protocolVersion!==runtime.WORKER_PROTOCOL_VERSION||message.runtimeBuildIdentity!==runtime.RUNTIME_BUILD_ID||message.testWorkerSha256!==runtime.TEST_WORKER_SHA256)throw Object.assign(new Error('Worker request identity does not match the loaded runtime and worker bytes.'),{code:'WORKER_REQUEST_IDENTITY_MISMATCH'});
    if(!message.metadata||typeof message.metadata!=='object'||Array.isArray(message.metadata))throw Object.assign(new Error('Worker metadata must be a closed object.'),{code:'INVALID_WORKER_PROTOCOL'});
    for(const key of Object.keys(message.metadata))if(!['testId','bindings'].includes(key))throw Object.assign(new Error(`Unknown worker metadata property ${key}.`),{code:'INVALID_WORKER_PROTOCOL'});
    if(message.metadata.bindings!==message.bindings)throw Object.assign(new Error('Worker metadata bindings must be the exact protocol binding object.'),{code:'INVALID_WORKER_PROTOCOL'});
    if(!securityStatus.networkLocked||!securityStatus.dynamicCodeLocked||!securityStatus.dynamicImportScriptsLocked||!securityStatus.nestedWorkersLocked)throw Object.assign(new Error('Worker security surfaces were not completely locked.'),{code:'WORKER_SECURITY_NOT_ESTABLISHED'});
    if(busy)throw Object.assign(new Error('The dedicated worker already has an active Test IR execution.'),{code:'WORKER_BUSY'});
    busy=true;
    const validation=runtime.validateSpec(message.spec,message.bindings);
    if(!validation.valid)throw Object.assign(new Error(validation.issues.join(' ')),{code:'INVALID_TEST_IR'});
    const result=await runtime.execute({spec:message.spec,artifacts:message.artifacts||{},canonicalBindings:message.canonicalBindings||{},metadata:message.metadata||{}});
    self.postMessage({requestId:message.requestId,ok:true,result});
  }catch(error){
    self.postMessage({requestId:message.requestId,ok:false,error:{code:error?.code||'WORKER_EXECUTION_FAILED',message:String(error?.message||error),disposition:error?.disposition||'EXECUTION_FAILED'}});
  }finally{
    busy=false;
  }
});
})();
