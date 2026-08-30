'use strict';
const runtimeQuery=self.location?.search||'';
importScripts(`test-runtime.js${runtimeQuery}`);
self.onmessage=async event=>{
  const {requestId,spec,artifacts,canonicalBindings}=event.data||{};
  try{
    const result=await self.closedLoopTestRuntime.execute({spec,artifacts,canonicalBindings});
    self.postMessage({requestId,result});
  }catch(error){
    self.postMessage({requestId,result:{status:'EXECUTION_FAILED',determination:'UNDETERMINED',error:String(error?.message||error),runtimeVersion:self.closedLoopTestRuntime?.VERSION||'UNKNOWN'}});
  }
};