'use strict';
const BUILD_IDENTITY=new URL(self.location.href).searchParams.get('v')||'';
importScripts(`test-runtime.js?v=${encodeURIComponent(BUILD_IDENTITY)}`);
self.fetch=undefined;self.XMLHttpRequest=undefined;self.WebSocket=undefined;
self.onmessage=async event=>{
  const {requestId,spec,artifacts}=event.data||{};
  try{
    const result=await self.closedLoopTestRuntime.execute({spec,artifacts});
    self.postMessage({requestId,result});
  }catch(error){
    self.postMessage({requestId,result:{status:'EXECUTION_FAILED',determination:'UNDETERMINED',error:String(error?.message||error),runtimeVersion:self.closedLoopTestRuntime?.VERSION||'UNKNOWN'}});
  }
};