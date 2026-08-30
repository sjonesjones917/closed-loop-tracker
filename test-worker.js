'use strict';
importScripts('test-runtime.js');
try{self.fetch=()=>Promise.reject(new Error('Network access is unavailable in the deterministic test worker.'));}catch{}
try{self.XMLHttpRequest=undefined;}catch{}
self.onmessage=async event=>{const {requestId,spec,artifacts,canonicalBindings}=event.data||{};try{const result=await self.closedLoopTestRuntime.executeTest(spec,artifacts||{},canonicalBindings||{});self.postMessage({requestId,result});}catch(error){self.postMessage({requestId,result:{status:'EXECUTION_FAILED',determination:'UNDETERMINED',error:String(error?.message||error),runtimeVersion:self.closedLoopTestRuntime?.VERSION||'UNKNOWN'}});}};
