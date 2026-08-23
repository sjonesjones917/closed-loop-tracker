(()=>{
'use strict';
const STORE='mobile-closed-loop-agent';
const OPS=['Define Job','Inventory Sources','Research Requirements','Compile Atomic Requirements','Resolve Conflicts','Build Acceptance Tests','Build Failure / Mutation Tests','Author Production Instruction','Preflight Instruction','Freeze Candidate','Run 10 Independent Executions','Verify Every Run','Compare Runs','Root-Cause Defects','Add Regression Tests','Correct Responsible Layer','Freeze New Version','Run 10 New Independent Executions','Repeat Until Converged','Unchanged 10-Execution Confirmation','Freeze Approved Baseline','Generate Finished Product','Deterministic Verification','Independent Semantic Verification','Adversarial Verification','Final Representation Inspection','Process Audit','Product Audit','ACCEPTED / REJECTED / BLOCKED','Verify Release Hash','Release Exact Accepted Artifact'];
const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}};
const pad=n=>String(n).padStart(2,'0');
function openOperation(n,copy=false){
  const workflow=[...document.querySelectorAll('[data-view]')].find(b=>b.dataset.view==='workflow');
  if(workflow)workflow.click();
  const tryOpen=()=>{const b=document.querySelector(`[data-operation="${n}"]`);if(!b)return false;b.click();if(copy){let count=0;const wait=()=>{const c=document.querySelector('#copy-agent-prompt');if(c){c.click();return}if(count++<80)setTimeout(wait,50)};wait()}return true};
  if(!tryOpen()){let count=0;const wait=()=>{if(tryOpen())return;if(count++<40)setTimeout(wait,50)};setTimeout(wait,0)}
}
function renderPromptCenter(){
  const host=document.querySelector('#project-view');if(!host)return;
  const s=read(),current=Number(s?.projectData?.currentOperation||1);
  host.innerHTML=`<div class="project-panel prompt-center"><div class="prompt-center-head"><div><h2>Prompts</h2><p class="muted">Every workflow operation has a project-specific prompt. Open one to inspect the exact authorized context, copy it to your agent, and capture the complete response.</p></div><button id="copy-current-prompt" class="prompt-primary">Copy current prompt</button></div><div class="prompt-current"><strong>${pad(current)} · ${OPS[current-1]}</strong><span>Current operation</span></div><div class="prompt-list">${OPS.map((name,i)=>{const n=i+1;return `<button type="button" data-prompt-operation="${n}" class="${n===current?'current':''}"><span>${pad(n)}</span><strong>${name}</strong><em>${n===current?'Current':'Open prompt'}</em></button>`}).join('')}</div></div>`;
  host.querySelector('#copy-current-prompt').onclick=()=>openOperation(current,true);
  host.querySelectorAll('[data-prompt-operation]').forEach(b=>b.onclick=()=>openOperation(Number(b.dataset.promptOperation),false));
}
function installNav(){
  const nav=document.querySelector('.project-tabs');if(!nav||nav.querySelector('[data-prompt-center]'))return;
  const b=document.createElement('button');b.type='button';b.dataset.promptCenter='true';b.textContent='Prompts';b.onclick=()=>{nav.querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected','false'));b.setAttribute('aria-selected','true');renderPromptCenter()};nav.appendChild(b);
}
function installOverviewAction(){
  const banner=document.querySelector('#project-view .action-banner');if(!banner||banner.querySelector('[data-copy-current-prompt]'))return;
  const s=read(),n=Number(s?.projectData?.currentOperation||1),actions=document.createElement('div');actions.className='prompt-overview-actions';actions.innerHTML=`<button type="button" data-copy-current-prompt class="prompt-primary">Copy prompt</button>`;const original=banner.querySelector('button');if(original)actions.appendChild(original);banner.appendChild(actions);actions.querySelector('[data-copy-current-prompt]').onclick=()=>openOperation(n,true);
}
function install(){installNav();installOverviewAction()}
const style=document.createElement('style');style.textContent=`.prompt-center-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.prompt-center-head h2{margin:0}.prompt-center-head p{margin:3px 0 0;max-width:470px}.prompt-primary{background:#1557c9!important;color:#fff!important;border-color:#1557c9!important}.prompt-current{display:flex;justify-content:space-between;gap:8px;border:1px solid #b8c8e8;background:#f7faff;border-radius:8px;padding:8px;margin:9px 0}.prompt-current strong{font-size:11.5px}.prompt-current span{font-size:9px;text-transform:uppercase;color:#56627a}.prompt-list{display:grid;gap:5px}.prompt-list button{width:100%;min-height:34px;display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:7px;text-align:left;border:1px solid #ddd;border-radius:8px;background:#fff;padding:6px 7px}.prompt-list button.current{border-color:#1557c9;background:#f5f8ff}.prompt-list button span{font-size:9.5px;font-weight:800;color:#666}.prompt-list button strong{font-size:10.5px}.prompt-list button em{font-size:9px;font-style:normal;color:#1557c9}.prompt-overview-actions{display:flex;gap:5px;flex:0 0 auto}.action-banner>.prompt-overview-actions button{min-height:30px;border:1px solid #999;border-radius:7px;padding:4px 8px;font-size:10.5px;font-weight:700}@media(max-width:560px){.prompt-center-head{display:grid}.prompt-center-head>button{width:100%}.prompt-overview-actions{display:grid;grid-template-columns:1fr 1fr;width:100%}.action-banner{display:grid}.prompt-list button{grid-template-columns:25px 1fr auto}}`;document.head.appendChild(style);
new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('click',()=>setTimeout(install,0),true);setTimeout(install,600);
})();
