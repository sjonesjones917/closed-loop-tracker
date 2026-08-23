(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="human-workbook-20260823-r6";
    const names=["workbook.module.gz.1","workbook.module.gz.2","workbook.module.gz.3"];
    const responses=await Promise.all(names.map(name=>fetch(`${name}?${cacheKey}`,{cache:"no-store"})));
    for(const response of responses)if(!response.ok)throw new Error(`Runtime load failed: HTTP ${response.status}`);
    const parts=await Promise.all(responses.map(response=>response.arrayBuffer()));
    const total=parts.reduce((sum,part)=>sum+part.byteLength,0),bytes=new Uint8Array(total);let offset=0;
    for(const part of parts){bytes.set(new Uint8Array(part),offset);offset+=part.byteLength;}
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const source=await new Response(stream).text();
    const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));
    try{await import(url);}finally{URL.revokeObjectURL(url);}
  }catch(error){console.error(error);const target=document.getElementById("content");if(target)target.textContent=`Application runtime failed to load: ${error.message}`;}
})();

(()=>{
"use strict";
const STORE="mclarw",STYLE_ID="human-ui-r6";let queued=false,testSpec=null;
const clean=e=>String(e?.textContent||"").replace(/\s+/g," ").trim();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||"null")}catch{return null}};
const stageEntries=s=>Array.isArray(s?.stages)?s.stages.map((x,i)=>[Number(x?.number||i+1),x]).filter(([,x])=>x):Object.entries(s?.stages||{}).map(([k,x])=>[Number(x?.number||k),x]).filter(([n,x])=>Number.isFinite(n)&&x);
const pad=n=>String(n).padStart(2,"0");
function styles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
  body{font-size:14px;line-height:1.35;background:#f6f6f3}.app{max-width:760px}header,main{padding:10px 12px}h1{font-size:18px;line-height:1.15;margin:0 0 4px}#job{font-size:12px;color:#666;overflow-wrap:anywhere}
  .tools{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px!important;margin:7px 0!important}.tools button{min-height:32px!important;padding:5px 4px!important;border-radius:7px!important;font-size:11px!important;font-weight:650!important;line-height:1.05!important}
  .nav{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4px!important}.nav button{min-height:32px!important;padding:4px 3px!important;border-radius:7px!important;font-size:9px!important;line-height:1.08!important;font-weight:650!important}
  .card{padding:10px!important;margin:8px 0!important;border-radius:9px!important}.card h2{font-size:16px!important}.card h3{margin:11px 0 4px!important}.muted{font-size:12px!important}.copy{font-size:11px!important;max-height:300px!important}textarea,input,select{font-size:16px;min-height:36px!important;padding:6px!important}textarea{min-height:68px!important}
  #appendix-operational-purpose,#repository-test-project,[data-integrated-operational-controls="true"]{display:none!important}
  #test-project-view{margin:8px 0;border:1px solid #bbb;background:#fff}#test-project-view>summary{cursor:pointer;font-weight:750;font-size:15px;list-style-position:inside}.tp-lede{margin:8px 0 4px;color:#444}.tp-section{border-top:1px solid #ddd;padding:9px 0}.tp-section h3{margin:0 0 6px;font-size:13px}.tp-pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px ui-monospace,monospace;background:#f4f4f2;padding:7px;border-radius:6px;max-height:360px;overflow:auto}.tp-item{padding:5px 0}.tp-label{font-size:10px;text-transform:uppercase;color:#666}.tp-value{font-size:12px;overflow-wrap:anywhere}.tp-record{border-top:1px solid #eee;padding:7px 0}.tp-record:first-child{border-top:0}.tp-record summary{cursor:pointer;font-weight:700}.tp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 10px}.tp-status{display:inline-block;border:1px solid #bbb;border-radius:999px;padding:2px 6px;font-size:10px;font-weight:700}.tp-run{display:grid;grid-template-columns:68px 1fr;gap:6px;padding:4px 0;border-top:1px solid #eee}.tp-run:first-child{border-top:0}
  @media(max-width:520px){.tools{grid-template-columns:repeat(4,minmax(0,1fr))!important}.nav{grid-template-columns:repeat(3,minmax(0,1fr))!important}.tp-grid{grid-template-columns:1fr}.tools button{font-size:10.5px!important}.nav button{font-size:8.7px!important}}
  `;document.head.appendChild(s)
}
function removeInternalPanels(){
  document.getElementById("appendix-operational-purpose")?.remove();
  document.getElementById("repository-test-project")?.remove();
  for(const e of document.querySelectorAll('[data-integrated-operational-controls="true"]'))e.remove();
  for(const e of document.querySelectorAll("button,a,[role=button]"))if(/^(?:Appendices? A.?F|Operational controls|Control records)$/i.test(clean(e)))e.remove();
}
const GLOBAL_INTERNAL_TEXT="APPENDIX A–F — OPERATIONAL CONTROLS";
const GLOBAL_INTERNAL_HEADING="TEST PROJECT — EXISTING APPLICATION VERIFICATION";
function clearStores(s){for(const k of ["defects","regressions","blockers","changes","agentOutputReceipts","freshContextLaunches","releaseIdentityRecords","finalReleaseRecords","newJobResets"])if(Array.isArray(s[k]))s[k]=[];if(s.operationalRecords)for(const l of "ABCDEF")s.operationalRecords[l]=[];if(s.appendices)for(const l of "ABCDEF")if(s.appendices[l])s.appendices[l].records=[]}
function buildTestJobState(template,spec){
  const s=structuredClone(template);clearStores(s);s.currentStage=1;s.jobId=spec.jobId;
  s.testProject={id:spec.testProjectId,source:"TEST_PROJECT.json",loadedAt:new Date().toISOString(),spec:structuredClone(spec)};
  s.job=s.job||{};Object.assign(s.job,{id:spec.jobId,JOB_ID:spec.jobId,title:spec.title,JOB_TITLE:spec.title,owner:spec.projectData?.jobOwner||"Test project owner",dateOpened:spec.date,currentStage:1,currentIteration:spec.phases?.confirmation?.iterationId||"CONFIRMATION-001",currentState:spec.release?.releaseState||"ACCEPTED",inputVersion:spec.baseline?.inputVersion,sourceSetVersion:spec.baseline?.sourceSetVersion,requirementsVersion:spec.baseline?.requirementsVersion,testSuiteVersion:spec.baseline?.testSuiteVersion,instructionVersion:spec.baseline?.instructionVersion,toolConfigurationVersion:spec.baseline?.toolConfigurationVersion,baselineId:spec.baseline?.baselineId,productId:spec.product?.productId,blockers:"NONE",nextAction:"Review the completed project, then open any stage to inspect its workbook controls and copy block.",latestEvidence:"TEST_PROJECT.json"});
  const ev=spec.stageEvidence||[];
  for(const [n,st] of stageEntries(s)){
    const line=ev[n-1]||`Stage ${n}: completed test-project record.`;
    st.status="COMPLETE";st.decision="READY TO PROCEED";st.evidence=line;st.decisionEvidence=line;st.decidedBy="Test project";st.dateTime=spec.date;
    st.draftRecord=[`TEST PROJECT — STAGE ${pad(n)}`,line,"",`PROJECT: ${spec.title}`,`JOB_ID: ${spec.jobId}`,`OBJECTIVE: ${spec.objective?.exactUserObjective||""}`,`USER-FILLED PROJECT DATA: ${JSON.stringify(spec.projectData||{},null,2)}`].join("\n");
    for(const k of ["humanChecks","gateChecks","evidenceChecks"])if(Array.isArray(st[k]))st[k]=st[k].map(()=>true)
  }
  s.defects=structuredClone(spec.defects||[]);s.regressions=structuredClone(spec.regressions||[]);return s
}
async function getSpec(){if(testSpec)return testSpec;const r=await fetch(`TEST_PROJECT.json?t=${Date.now()}`,{cache:"no-store"});if(!r.ok)throw Error(`HTTP ${r.status}`);return testSpec=await r.json()}
async function loadTestJob(){const current=read();if(!current)return;try{const spec=await getSpec();localStorage.setItem(STORE,JSON.stringify(buildTestJobState(current,spec)));location.reload()}catch(e){alert(`Test project could not be loaded: ${e.message}`)}}
function testButton(){const tools=document.querySelector("header .tools");if(!tools||document.getElementById("load-test-job"))return;const b=document.createElement("button");b.id="load-test-job";b.type="button";b.textContent="Test project";b.addEventListener("click",loadTestJob);const imp=[...tools.querySelectorAll("button")].find(x=>clean(x)==="Import");tools.insertBefore(b,imp||null)}
const kv=(label,value)=>`<div class="tp-item"><div class="tp-label">${esc(label)}</div><div class="tp-value">${esc(value??"")}</div></div>`;
const section=(title,html)=>`<section class="tp-section"><h3>${esc(title)}</h3>${html||'<div class="muted">None recorded</div>'}</section>`;
function objectRows(value,depth=0){
  if(value===null||value===undefined)return '<div class="muted">None recorded</div>';
  if(typeof value!=="object")return `<div class="tp-value">${esc(value)}</div>`;
  if(Array.isArray(value))return value.map((x,i)=>typeof x==="object"?`<details class="tp-record"><summary>Record ${i+1}</summary>${objectRows(x,depth+1)}</details>`:`<div class="tp-item">${esc(x)}</div>`).join("")||'<div class="muted">None recorded</div>';
  return Object.entries(value).map(([k,v])=>typeof v==="object"&&v!==null?`<details class="tp-record"><summary>${esc(k.replace(/([A-Z])/g," $1").replace(/_/g," "))}</summary>${objectRows(v,depth+1)}</details>`:kv(k.replace(/([A-Z])/g," $1").replace(/_/g," "),v)).join("");
}
function runRows(spec){return Object.entries(spec.phases||{}).map(([name,p])=>{const rows=Array.from({length:p.runCount||0},(_,i)=>`<div class="tp-run"><b>RUN-${String(i+1).padStart(3,"0")}</b><span>${esc(p.expectedOutcome)} — ${esc(p.output?.filename)} — ${esc(p.output?.byteLength)} bytes — SHA-256 ${esc(p.output?.sha256)}</span></div>`).join("");return `<details class="tp-record"><summary>${esc(name)} — ${esc(p.iterationId)} — ${p.runCount} runs</summary>${rows}${objectRows(p)}</details>`}).join("")}
function stageRecords(state){return stageEntries(state).map(([n,st])=>`<details class="tp-record"><summary>Stage ${pad(n)} — ${esc(st.status)} — ${esc(st.decision)}</summary>${kv("Decision evidence",st.decisionEvidence||st.evidence||"")}${kv("Decided by",st.decidedBy||"")}${kv("Date/time",st.dateTime||"")}${st.draftRecord?`<div class="tp-pre">${esc(st.draftRecord)}</div>`:""}<div class="muted">Open Stage ${pad(n)} in the stage navigator to inspect its full human checklist, fill-in record, generated copy block, gate, and evidence controls.</div></details>`).join("")}
function testProjectView(){
  const state=read(),spec=state?.testProject?.spec;if(!spec){document.getElementById("test-project-view")?.remove();return}
  let root=document.getElementById("test-project-view");if(!root){root=document.createElement("details");root.id="test-project-view";root.className="card";document.querySelector("main")?.insertBefore(root,document.querySelector("main")?.firstChild)}root.open=true;
  root.innerHTML=`<summary>Test project — ${esc(spec.title)}</summary><p class="tp-lede">This is a complete project loaded into the same 30-stage workbook. The project data below is the job record: user-entered data, sources, requirements, generated instruction, tests, every execution batch, defects, corrections, stage evidence, final product, release evidence, and traceability. Nothing here is a developer diagnostic panel.</p>
  ${section("User-entered project data",objectRows(spec.projectData||{JOB_ID:spec.jobId,JOB_TITLE:spec.title,EXACT_USER_OBJECTIVE:spec.objective?.exactUserObjective}))}
  ${section("Exact requested deliverable",objectRows(spec.objective))}
  ${section("Supplied inputs and source inventory",objectRows(spec.sourceInventory))}
  ${section("Requirements",objectRows(spec.requirements))}
  ${section("Generated production instruction",`<div class="tp-pre">${esc([spec.productionInstruction?.objective,...(spec.productionInstruction?.procedure||[]),spec.productionInstruction?.completionCriteria].filter(Boolean).join("\n\n"))}</div>${objectRows(spec.productionInstruction)}`)}
  ${section("Verification tests",objectRows(spec.tests))}
  ${section("Failure and mutation tests",objectRows(spec.mutations))}
  ${section("All execution runs and outputs",runRows(spec))}
  ${section("Defects, root cause, corrections, and regressions",objectRows({defects:spec.defects,regressions:spec.regressions}))}
  ${section("Convergence and frozen baseline",objectRows({convergence:spec.convergence,baseline:spec.baseline}))}
  ${section("Finished product",objectRows(spec.product))}
  ${section("Release gate and byte identity",objectRows(spec.release))}
  ${section("Complete evidence chains",objectRows(spec.evidenceChains))}
  ${section("All 30 completed stage records",stageRecords(state))}`;
}
function humanizeContextualControls(){for(const e of document.querySelectorAll('[data-human-stage-records]')){const t=clean(e);if(t.includes("FRESH_CONTEXT"))e.dataset.humanTitle="Independent run setup"}}
function render(){styles();removeInternalPanels();testButton();testProjectView();humanizeContextualControls();removeInternalPanels()}
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
document.addEventListener("click",queue,true);document.addEventListener("change",queue,true);window.addEventListener("pageshow",queue);new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});queue();
})();
