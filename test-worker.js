'use strict';
importScripts('test-runtime.js');
const deny=()=>Promise.reject(new Error('Network access is unavailable to the deterministic Test IR worker.'));
try{Object.defineProperty(self,'fetch',{value:deny,writable:false,configurable:false});}catch{}
try{Object.defineProperty(self,'XMLHttpRequest',{value:undefined,writable:false,configurable:false});}catch{}
try{Object.defineProperty(self,'WebSocket',{value:undefined,writable:false,configurable:false});}catch{}
self.onmessage=async event=>{const {requestId,spec,artifacts,canonicalBindings}=event.data||{};try{const result=await self.closedLoopTestRuntime.execute({spec,artifacts,canonicalBindings});self.postMessage({requestId,result});}catch(error){self.postMessage({requestId,result:{status:'EXECUTION_FAILED',determination:'UNDETERMINED',error:String(error?.message||error),runtimeVersion:self.closedLoopTestRuntime?.VERSION||'UNKNOWN'}});}};
