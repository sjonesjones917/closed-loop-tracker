(()=>{
'use strict';
const REVISION='closed-loop-prompt-display-20260824-r3';
const STORE='closed-loop-reliability-projects-v3';
const core=globalThis.closedLoopCore;
if(!core)return;
let scheduled=false,raf=0,timer=0;
const text=v=>String(v??'').trim();
function projects(){
  try{const parsed=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(parsed)?parsed:parsed?[parsed]:[];}catch{return [];}
}
function currentProject(){
  const list=projects();if(!list.length)return null;
  const picker=document.querySelector('#project-picker'),raw=text(picker?.value),index=Number(raw);
  if(Number.isInteger(index)&&index>=0&&index<list.length)return list[index];
  const selectedId=text(picker?.selectedOptions?.[0]?.dataset?.jobId||picker?.selectedOptions?.[0]?.value);
  const summaryId=text(document.querySelector('#current-project-summary')?.textContent).split(' · ')[0].trim();
  const wanted=selectedId||summaryId||raw;
  return list.find(p=>text(p?.job?.JOB_ID||p?.jobId)===wanted)||list[0]||null;
}
function currentPrompt(stage,project){
  const prompt=core.buildStagePrompt(stage,project);
  return typeof prompt==='string'?prompt.replace('\n\nOPERATING RULES\n','\n\nUNIVERSAL OPERATING RULES\n'):prompt;
}
function refresh(){
  scheduled=false;
  const out=document.querySelector('#generated-prompt'),picker=document.querySelector('#stage-picker');
  if(!out||!picker)return false;
  const n=Number(picker.value);if(!Number.isInteger(n)||n<1||n>30)return false;
  const project=currentProject();if(!project)return false;
  const prompt=currentPrompt(core.STAGES[n-1],project);
  if(typeof prompt!=='string'||!prompt)return false;
  if(out.textContent!==prompt)out.textContent=prompt;
  out.dataset.promptSource='current-project-generator';
  out.dataset.promptStage=String(n);
  out.dataset.promptJobId=text(project?.job?.JOB_ID||project?.jobId);
  return true;
}
function schedule(){
  if(scheduled)return;scheduled=true;
  queueMicrotask(()=>{refresh();cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>refresh());clearTimeout(timer);timer=setTimeout(refresh,80);});
}
new MutationObserver(records=>{
  if(records.some(r=>r.type==='childList'||r.type==='characterData'))schedule();
}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
document.addEventListener('change',event=>{if(event.target?.matches?.('#stage-picker,#project-picker'))schedule();},true);
document.addEventListener('click',event=>{if(event.target?.closest?.('[data-stage],[data-view="Workflow"]'))schedule();},true);
window.addEventListener('storage',event=>{if(event.key===STORE)schedule();});
schedule();
globalThis.closedLoopPromptDisplay={revision:REVISION,refresh,currentPrompt,currentProject};
})();
