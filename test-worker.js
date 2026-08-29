'use strict';
importScripts('test-runtime.js');
self.onmessage=async event=>{try{const {test,artifacts}=event.data||{},map=new Map((artifacts||[]).map(([id,a])=>[id,{...a,bytes:a?.bytes instanceof Uint8Array?a.bytes:new Uint8Array(a?.bytes||[])}])),result=await self.closedLoopTestRuntime.execute(test,map);self.postMessage({ok:true,result});}catch(error){self.postMessage({ok:false,error:String(error?.message||error)});}};
