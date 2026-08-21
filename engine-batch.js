(function(global){
"use strict";
const E=global.CLE,{buildPrompt,pad}=E;
function createRunBatch(j,kind,n){
  const arr=j.runs[kind]; if(arr.length) return arr;
  for(let i=1;i<=10;i++) arr.push({runId:"RUN-"+pad(i),status:"NOT_STARTED",prompt:buildPrompt(j,n,`RUN_ID: RUN-${pad(i)}\nThis is one of ten independent executions. Do not use or infer any other run's output.`),output:"",verified:false,verification:""});
  return arr;
}
function saveRunOutput(j,kind,index,output){const r=j.runs[kind][index];r.output=output;r.status=output.trim()?"COMPLETE":"FAILED";return r}
function validateRunBatch(j,kind){const arr=j.runs[kind];return {ok:arr.length===10&&arr.every(r=>r.status==="COMPLETE"),count:arr.filter(r=>r.status==="COMPLETE").length}}
function createVerificationPrompts(j,kind="candidate"){
  const arr=j.runs[kind];
  return arr.map(r=>({runId:r.runId,prompt:buildPrompt(j,12,`RUN_ID: ${r.runId}\nRUN OUTPUT TO VERIFY:\n${r.output}`)}));
}
function saveVerification(j,kind,index,text){const r=j.runs[kind][index];r.verification=text;r.verified=!!text.trim()&&!/\bRESULT\s*:\s*(VIOLATED|UNDETERMINED)\b/i.test(text);return r}
function validateVerificationBatch(j,kind){const arr=j.runs[kind];return {ok:arr.length===10&&arr.every(r=>r.verified),count:arr.filter(r=>r.verified).length}}
function markBatchStage(j,n,kind){
  const s=j.stages[n-1],v=validateRunBatch(j,kind);s.result=`${kind.toUpperCase()} RUN BATCH: ${v.count}/10 complete`;s.validated=v.ok;s.status=v.ok?"COMPLETE":"FAILED";if(v.ok&&j.currentStage===n)j.currentStage=n+1;return v
}
function markVerificationStage(j,n,kind){
  const s=j.stages[n-1],v=validateVerificationBatch(j,kind);s.result=`${kind.toUpperCase()} VERIFICATION BATCH: ${v.count}/10 verified`;s.validated=v.ok;s.status=v.ok?"COMPLETE":"FAILED";if(v.ok&&j.currentStage===n)j.currentStage=n+1;return v
}
function exportState(j){return JSON.stringify(j,null,2)}

const API={...E,createRunBatch,saveRunOutput,validateRunBatch,createVerificationPrompts,saveVerification,validateVerificationBatch,markBatchStage,markVerificationStage,exportState};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
global.ClosedLoopCore=API;
})(typeof window!=="undefined"?window:globalThis);
