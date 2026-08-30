'use strict';
const build=(()=>{try{return new URL(self.location.href).searchParams.get('v')||'';}catch{return '';}})();
importScripts('test-runtime.js'+(build?'?v='+encodeURIComponent(build):''));
try{self.fetch=()=>Promise.reject(new Error('Network access is disabled in the deterministic test worker.'));self.XMLHttpRequest=undefined;self.WebSocket=undefined;}catch{}
self.onmessage=async event=>{const {requestId,spec,artifacts}=event.data||{};try{const result=await self.closedLoopTestRuntime.execute({spec,artifacts});self.postMessage({requestId,result});}catch(error){self.postMessage({requestId,result:{status:'EXECUTION_FAILED',determination:'UNDETERMINED',error:String(error?.message||error),executorVersion:self.closedLoopTestRuntime?.VERSION||'UNKNOWN'}});}};
