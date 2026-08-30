'use strict';
for(const name of ['fetch','XMLHttpRequest','WebSocket','EventSource']){
  try{Object.defineProperty(self,name,{value:undefined,writable:false,configurable:false});}catch(_error){try{self[name]=undefined;}catch(_ignored){}}
}
importScripts('test-runtime.js'+self.location.search);
self.onmessage=async event=>{
  const {requestId,spec,artifacts,canonicalBindings}=event.data||{};
  try{
    const result=await self.closedLoopTestRuntime.execute({spec,artifacts,canonicalBindings});
    self.postMessage({requestId,result});
  }catch(error){
    self.postMessage({requestId,result:{status:'EXECUTION_FAILED',determination:'UNDETERMINED',error:String(error?.message||error),runtimeVersion:self.closedLoopTestRuntime?.VERSION||'UNKNOWN',specVersion:self.closedLoopTestRuntime?.SPEC_VERSION||'UNKNOWN'}});
  }
};