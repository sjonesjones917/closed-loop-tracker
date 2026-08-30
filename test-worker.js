'use strict';
try{self.fetch=undefined;}catch{}
try{self.XMLHttpRequest=undefined;}catch{}
try{self.WebSocket=undefined;}catch{}
const token=new URL(self.location.href).searchParams.get('v');
importScripts('test-runtime.js'+(token?'?v='+encodeURIComponent(token):''));
self.onmessage=async event=>{const {requestId,spec,artifacts}=event.data||{};try{const result=await self.closedLoopTestRuntime.execute({spec,artifacts});self.postMessage({requestId,result});}catch(error){self.postMessage({requestId,result:{status:'EXECUTION_FAILED',determination:'UNDETERMINED',error:String(error?.message||error),runtimeVersion:self.closedLoopTestRuntime?.VERSION||'UNKNOWN'}});}};
