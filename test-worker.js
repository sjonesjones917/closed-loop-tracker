'use strict';
const params=new URLSearchParams(self.location.search),token=params.get('v')||'';
importScripts(`test-runtime.js${token?`?v=${encodeURIComponent(token)}`:''}`);
const runtime=self.closedLoopTestRuntime;
if(!runtime)throw new Error('Closed Loop Test Runtime failed to load in worker.');
self.onmessage=async event=>{
  const message=event.data||{},requestId=String(message.requestId||'');
  if(message.type!=='EXECUTE_TEST_IR'){self.postMessage({requestId,ok:false,error:'Unsupported worker message type.'});return;}
  try{const result=await runtime.execute(message.payload||{});self.postMessage({requestId,ok:true,result});}
  catch(error){self.postMessage({requestId,ok:false,error:String(error?.message||error)});}
};
