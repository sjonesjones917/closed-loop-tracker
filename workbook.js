(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const names=["workbook.module.gz.1","workbook.module.gz.2","workbook.module.gz.3"];
    const responses=await Promise.all(names.map(name=>fetch(`${name}?human-project-view-20260823`,{cache:"no-store"})));
    for(const response of responses)if(!response.ok)throw new Error(`Runtime load failed: HTTP ${response.status}`);
    const parts=await Promise.all(responses.map(response=>response.arrayBuffer()));
    const bytes=new Uint8Array(parts.reduce((n,p)=>n+p.byteLength,0));let at=0;for(const p of parts){bytes.set(new Uint8Array(p),at);at+=p.byteLength;}
    const source=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));
    try{globalThis.ClosedLoopWorkbook=await import(url);}finally{URL.revokeObjectURL(url)}
    window.dispatchEvent(new CustomEvent("closed-loop-workbook-ready"));
  }catch(error){console.error(error);const target=document.getElementById("content");if(target)target.textContent=`Application runtime failed to load: ${error.message}`;}
})();

(()=>{
"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pretty=v=>typeof v==="string"?v:JSON.stringify(v,null,2);
const style=document.createElement("style");style.textContent=`
#project-view{margin:12px 0}.project-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.project-head h2{margin:0;flex:1}.project-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.project-summary>div{border:1px solid #ddd;border-radius:9px;padding:9px}.project-summary b{display:block;font-size:11px;text-transform:uppercase;color:#666;margin-bottom:3px}.project-section{border-top:1px solid #ddd;padding:12px 0}.project-section>summary{font-weight:750;cursor:pointer}.project-section pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f5f2;border-radius:8px;padding:10px;font:11px ui-monospace,monospace;max-height:420px;overflow:auto}.project-item{border:1px solid #ddd;border-radius:8px;padding:9px;margin:8px 0}.project-item h4{margin:0 0 6px}.project-item p{margin:4px 0}.project-stage{border-left:3px solid #111;padding-left:10px}.project-stage .copy{max-height:260px}.project-actions{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}@media(max-width:520px){.project-summary{grid-template-columns:1fr}}
`;document.head.appendChild(style);
let retained=null;
function section(title,body,open=false){return `<details class="project-section" ${open?"open":""}><summary>${esc(title)}</summary>${body}</details>`}
function cards(items,titleKey,textKey){return (items||[]).map(x=>`<div class="project-item"><h4>${esc(x[titleKey]||x.id||"Record")}</h4><pre>${esc(pretty(x))}</pre></div>`).join("")||'<p class="muted">None recorded.</p>'}
function stagePrompt(stage,state){try{return globalThis.ClosedLoopWorkbook?.buildStagePrompt?.(stage,state)||"Prompt generator unavailable."}catch(e){return `Prompt generation error: ${e.message}`}}
function syntheticState(){try{const s=globalThis.ClosedLoopWorkbook?.createBlankState?.();if(!s)return null;s.job=s.job||{};s.job.id=retained.jobId;s.job.title=retained.title;s.job.currentState="ACCEPTED";s.job.currentStage=30;return s}catch{return null}}
function renderProject(){
 const root=document.getElementById("master");if(!root||!retained)return;document.getElementById("project-view")?.remove();
 const stages=globalThis.ClosedLoopWorkbook?.STAGES||[];const state=syntheticState();
 const stageHtml=stages.map((st,i)=>`<details class="project-item project-stage"><summary><strong>${String(st.number).padStart(2,"0")} ${esc(st.title)}</strong> — COMPLETE</summary><p>${esc(retained.stageEvidence?.[i]||"Completed project evidence retained.")}</p><h4>Generated agent prompt</h4><pre class="copy">${esc(stagePrompt(st,state))}</pre></details>`).join("");
 const phases=Object.entries(retained.phases||{}).map(([name,p])=>`<div class="project-item"><h4>${esc(name.toUpperCase())}</h4><p><b>${esc(p.iterationId)}</b> · ${esc(p.runCount)} independent runs · ${esc(p.expectedOutcome)}</p><pre>${esc(pretty(p))}</pre></div>`).join("");
 const panel=document.createElement("section");panel.id="project-view";panel.className="card";panel.innerHTML=`
 <div class="project-head"><h2>${esc(retained.title)}</h2><strong>30/30 COMPLETE</strong></div>
 <p class="muted">Complete retained project record. Open any section to inspect the actual project inputs, requirements, tests, generated instructions, runs, defects, evidence, release data, and generated stage prompts.</p>
 <div class="project-summary"><div><b>Job</b>${esc(retained.jobId)}</div><div><b>Release</b>${esc(retained.release?.releaseState)}</div><div><b>Product</b>${esc(retained.product?.filename)}</div><div><b>Verification</b>${esc(retained.convergence?.mandatoryVerificationCoverage)}</div></div>
 <div class="project-actions"><button type="button" data-close-project>Close project</button><button type="button" data-raw-project>Complete raw record</button></div>
 ${section("User objective and requested deliverable",`<pre>${esc(pretty(retained.objective))}</pre>`,true)}
 ${section("User/project input and source inventory",cards(retained.sourceInventory,"sourceId"))}
 ${section("Requirements",cards(retained.requirements,"reqId"))}
 ${section("Acceptance tests",cards(retained.tests,"testId"))}
 ${section("Failure and mutation tests",cards(retained.mutations,"mutationId"))}
 ${section("Generated production instruction",`<pre>${esc(pretty(retained.productionInstruction))}</pre>`,true)}
 ${section("Execution iterations and all run results",phases,true)}
 ${section("Defects and root cause",cards(retained.defects,"defectId"))}
 ${section("Regression tests",cards(retained.regressions,"regId"))}
 ${section("Convergence",`<pre>${esc(pretty(retained.convergence))}</pre>`)}
 ${section("Approved baseline",`<pre>${esc(pretty(retained.baseline))}</pre>`)}
 ${section("Finished product",`<pre>${esc(pretty(retained.product))}</pre>`,true)}
 ${section("Release decision and hash identity",`<pre>${esc(pretty(retained.release))}</pre>`,true)}
 ${section("Evidence chains",cards(retained.evidenceChains,"chainRecordId"))}
 ${section("All 30 completed stages and generated prompts",stageHtml,true)}
 ${section("Complete retained project data",`<pre>${esc(pretty(retained))}</pre>`)}
 `;root.prepend(panel);
 panel.querySelector('[data-close-project]').onclick=()=>{panel.remove();document.getElementById("job").textContent="UNASSIGNED JOB"};
 panel.querySelector('[data-raw-project]').onclick=()=>panel.querySelector('.project-section:last-child').open=true;
 if(globalThis.job)globalThis.job.textContent=retained.jobId;
 if(globalThis.count)globalThis.count.textContent="30/30 complete • 0 blocked";
 if(globalThis.bar)globalThis.bar.style.width="100%";
}
async function loadProject(){
 try{const r=await fetch("TEST_PROJECT.json?human-project-view-20260823",{cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status}`);retained=await r.json();renderProject()}
 catch(e){alert(`Test project could not be loaded: ${e.message}`)}
}
function install(){
 const tools=document.querySelector("header .tools");if(tools&&!document.getElementById("load-test-project")){const b=document.createElement("button");b.id="load-test-project";b.type="button";b.textContent="Test project";b.onclick=loadProject;tools.appendChild(b)}
 for(const el of document.querySelectorAll("button,a,[role='button']")){const t=String(el.textContent||"").trim();if(/^(?:APPENDIX(?:ES)?\s+A\s*[–—-]\s*F|OPERATIONAL CONTROLS|WORKFLOW CONTROLS)/i.test(t))el.remove()}
 document.getElementById("appendix-operational-purpose")?.remove();
 document.querySelectorAll('[data-integrated-operational-controls="true"],[data-contextual-controls="true"]').forEach(el=>{if(el.closest("#content"))el.remove()});
}
let q=false;function queue(){if(q)return;q=true;requestAnimationFrame(()=>{q=false;install()})}
document.addEventListener("click",queue,true);window.addEventListener("closed-loop-workbook-ready",queue);new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});queue();
globalThis.loadRetainedTestProject=loadProject;
})();
