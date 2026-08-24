(()=>{
'use strict';
const REVISION='closed-loop-prompt-display-20260824-r2';
const STORE='closed-loop-reliability-projects-v3';
const core=globalThis.closedLoopCore;
if(!core)return;
let scheduled=false;
function currentProject(){
  try{
    const list=JSON.parse(localStorage.getItem(STORE)||'[]');
    if(!Array.isArray(list)||!list.length)return null;
    const picker=document.querySelector('#project-picker'),index=Number(picker?.value);
    return list[Number.isInteger(index)&&index>=0?index:0]||list[0]||null;
  }catch{return null;}
}
function currentPrompt(stage,project){
  const prompt=core.buildStagePrompt(stage,project);
  return typeof prompt==='string'?prompt.replace('\n\nOPERATING RULES\n','\n\nUNIVERSAL OPERATING RULES\n'):prompt;
}
function refresh(){
  scheduled=false;
  const out=document.querySelector('#generated-prompt'),picker=document.querySelector('#stage-picker');
  if(!out||!picker)return;
  const n=Number(picker.value);if(!Number.isInteger(n)||n<1||n>30)return;
  const project=currentProject();if(!project)return;
  const prompt=currentPrompt(core.STAGES[n-1],project);
  if(typeof prompt==='string'&&out.textContent!==prompt)out.textContent=prompt;
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(refresh);}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('change',event=>{if(event.target?.matches?.('#stage-picker,#project-picker'))schedule();},true);
document.addEventListener('click',event=>{if(event.target?.closest?.('[data-stage],[data-view="Workflow"]'))schedule();},true);
schedule();
globalThis.closedLoopPromptDisplay={revision:REVISION,refresh,currentPrompt};
})();
