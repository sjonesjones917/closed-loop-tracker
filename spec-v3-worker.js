(()=>{
'use strict';

for(const name of ['fetch','XMLHttpRequest','WebSocket','EventSource']){
  try{Object.defineProperty(self,name,{value:undefined,writable:false,configurable:false});}catch{}
}
const token=new URL(self.location.href).searchParams.get('v');
importScripts('test-runtime.js'+(token?'?v='+encodeURIComponent(token):''));

self.onmessage=async event=>{
  try{
    const result=await self.closedLoopTestRuntime.executeNormalizedSpec(event.data);
    self.postMessage(result);
  }catch(error){
    self.postMessage({
      testId:event.data?.testId||'',
      testSpecVersion:'closed-loop-test-spec/1',
      testSpecSha256:event.data?.testSpecSha256||'',
      status:'EXECUTION_FAILED',
      expected:null,
      actual:null,
      observations:[{errorCode:error.code||error.name||'WORKER_ERROR',message:error.message||String(error)}],
      evidence:[],
      executorVersion:'closed-loop-test-runtime/1',
      inputArtifactIds:event.data?.inputArtifactIds||[],
      inputArtifactSha256Values:event.data?.inputArtifactSha256Values||[],
      startedAtDeviceTime:new Date().toISOString(),
      endedAtDeviceTime:new Date().toISOString()
    });
  }
};
})();
