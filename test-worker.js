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
  try{
    const runtime=self.closedLoopTestRuntime;
    if(!runtime)throw Object.assign(new Error('Deterministic Test IR runtime did not load.'),{code:'RUNTIME_UNAVAILABLE'});
    const validation=runtime.validateSpec(message.spec,message.bindings);
    if(!validation.valid)throw Object.assign(new Error(validation.issues.join(' ')),{code:'INVALID_TEST_IR'});
    const result=await runtime.execute({spec:message.spec,artifacts:message.artifacts||{},canonicalBindings:message.canonicalBindings||{},metadata:message.metadata||{}});
    self.postMessage({requestId:message.requestId,ok:true,result});
  }catch(error){
    self.postMessage({requestId:message.requestId,ok:false,error:{code:error?.code||'WORKER_EXECUTION_FAILED',message:String(error?.message||error),disposition:error?.disposition||'EXECUTION_FAILED'}});
  }
});
})();
