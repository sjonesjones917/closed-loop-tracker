(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="human-workbook-20260823-r3";
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
  }catch(error){
    console.error(error);
    const target=document.getElementById("content");
    if(target)target.textContent=`Application runtime failed to load: ${error.message}`;
  }
})();

(()=>{
"use strict";
const STORE="mclarw";
const STYLE_ID="human-stage-controls-r3";
const GLOBAL_INTERNAL_HEADING=/^(?:APPENDIX(?:ES)?\s+A\s*[–—-]\s*F(?:\s*[–—-].*)?|APPENDIX\s+[A-F]\s*[–—-].*|TEST PROJECT\s*[–—-]\s*EXISTING APPLICATION VERIFICATION|OPERATIONAL CONTROLS\s+A\s*[–—-]\s*F)$/i;
const GLOBAL_INTERNAL_TEXT=/(?:Repository test project|Deployment gate|Live application checks|Verifier coverage|Preserved records:\s*\d+\.\s*Latest:)/i;
const NAV_INTERNAL=/^(?:Appendices?\s+A\s*[–—-]\s*F|Appendix controls|Operational controls(?:\s+A\s*[–—-]\s*F)?|Control records|Test project)$/i;
const RECORD_TITLES=[
  [/Fresh[- ]context launch/i,"Independent run setup"],
  [/Universal blocker/i,"Blocked stage"],
  [/Change and invalidation/i,"Change impact"],
  [/Exact final release/i,"Final release"],
  [/New[- ]job/i,"New job setup"],
  [/Agent[- ]output receipt/i,"Response record"]
];
const RECORD_HELP=[
  [/Fresh[- ]context launch/i,"Complete this before starting the independent run or review."],
  [/Universal blocker/i,"Record what is missing, why the stage cannot continue, and what work must stop."],
  [/Change and invalidation/i,"Record what changed and which later work must be repeated."],
  [/Exact final release/i,"Complete this only after the release gate and exact file-identity checks."],
  [/New[- ]job/i,"Confirm this job starts clean and does not inherit decisions or evidence from an older job."],
  [/Agent[- ]output receipt/i,"Save the response identity, files, problems, and next verification step."]
];
let queued=false;
const cleanText=element=>String(element?.textContent||"").replace(/\s+/g," ").trim();
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
    :root{--human-ink:#171717;--human-muted:#666;--human-line:#d9d9d4;--human-soft:#f5f5f2}
    body{background:var(--human-soft);color:var(--human-ink);font-size:15px;line-height:1.45}
    .app{max-width:760px;box-shadow:0 0 0 1px #e8e8e3}
    header,main{padding:14px}
    header{background:#fff;position:static}
    h1{font-size:20px;line-height:1.2;margin:0 0 5px}
    #job{font-size:13px;color:var(--human-muted);overflow-wrap:anywhere}
    .tools{display:grid;grid-template-columns:1.45fr repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}
    .tools button{min-height:44px;border-radius:10px;padding:8px 10px;font-size:14px;font-weight:650;line-height:1.2}
    .nav{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .nav button{min-height:52px;border-radius:10px;padding:8px;font-size:12px;line-height:1.25}
    .card{border-color:var(--human-line);border-radius:12px;padding:14px;margin:12px 0}
    .card h2{font-size:18px;line-height:1.25;margin-top:0}
    .card h3{font-size:12px;margin:16px 0 6px}
    .muted{font-size:13px;line-height:1.4;color:var(--human-muted)}
    .copy{font-size:12px;line-height:1.45;max-height:360px}
    textarea,input,select{font-size:16px;min-height:44px}
    textarea{min-height:92px}
    #appendix-operational-purpose,#repository-test-project,#human-test-project,#run-test-project,[data-integrated-operational-controls="true"],[data-hidden-internal-ui="true"]{display:none!important}
    [data-human-stage-records="true"]{margin-top:12px}
    [data-human-stage-records="true"]>summary{cursor:pointer;font-weight:750;list-style-position:outside}
    [data-human-stage-records="true"] .record-count{color:#666;font-weight:500;font-size:12px}
    [data-human-stage-records="true"] details[data-record]{border:1px solid #ddd;border-radius:10px;padding:10px;margin:10px 0;background:#fff}
    [data-human-stage-records="true"] details[data-record]>summary{cursor:pointer;font-weight:700}
    [data-human-stage-records="true"] .record-state{float:right;color:#666;font-size:11px;font-weight:600}
    [data-human-stage-records="true"] .record-id{color:#777;font-size:11px;font-weight:500}
    [data-human-stage-records="true"] p.muted{margin:6px 0 10px}
    [data-human-stage-records="true"] [data-save-record]{width:100%;margin-top:12px}
    #load-test-job{background:#fff}
    @media(max-width:520px){header,main{padding:12px}.tools{grid-template-columns:repeat(2,minmax(0,1fr))}.nav{grid-template-columns:repeat(2,minmax(0,1fr))}.nav button{min-height:50px}.card{padding:13px}}
    @media(max-width:350px){.nav{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function removeInternalPanels(){
  for(const id of ["appendix-operational-purpose","repository-test-project","human-test-project","run-test-project"]){
    document.getElementById(id)?.remove();
  }
  for(const control of document.querySelectorAll("button,a,[role='button']")){
    if(NAV_INTERNAL.test(cleanText(control))){
      control.remove();
    }
  }
  for(const heading of document.querySelectorAll("h1,h2,h3,h4,summary")){
    if(!GLOBAL_INTERNAL_HEADING.test(cleanText(heading)))continue;
    if(heading.closest('[data-contextual-controls="true"],[data-human-stage-records="true"]'))continue;
    const box=heading.closest("section,article,details,.card,.panel")||heading.parentElement;
    box?.remove();
  }
  for(const box of document.querySelectorAll("section,article,details,.card,.panel")){
    if(box.closest('[data-contextual-controls="true"],[data-human-stage-records="true"]'))continue;
    if(GLOBAL_INTERNAL_TEXT.test(cleanText(box)))box.remove();
  }
}

function readableFieldName(name){
  return String(name||"")
    .replace(/SHA256/g,"SHA-256")
    .replace(/_/g," ")
    .toLowerCase()
    .replace(/\b(id|sha-256|url|utc|api)\b/g,word=>word.toUpperCase())
    .replace(/^./,char=>char.toUpperCase());
}

function mappedTitle(raw){
  for(const [pattern,title] of RECORD_TITLES)if(pattern.test(raw))return title;
  return raw.replace(/\s+[—-]\s+\S+$/," ").trim()||"Stage record";
}

function mappedHelp(raw){
  for(const [pattern,help] of RECORD_HELP)if(pattern.test(raw))return help;
  return "Complete and save this record before the stage can rely on it.";
}

function recordStatus(record){
  const values=[...record.querySelectorAll("[data-rfield]")].map(field=>(field.value||"").trim());
  const unresolved=values.filter(value=>!value||/^(?:UNKNOWN|NOT RESOLVED|NOT COMPLETE|PENDING)/i.test(value)).length;
  return {unresolved,label:unresolved?"Needs information":"Saved"};
}

function humanizeRecord(record){
  record.dataset.humanStageRecord="true";
  const summary=record.querySelector(":scope > summary");
  const rendered=cleanText(summary);
  const raw=record.dataset.originalRecordTitle||rendered;
  if(!record.dataset.originalRecordTitle)record.dataset.originalRecordTitle=raw;
  const id=record.dataset.originalRecordId||(raw.match(/(?:—|-)\s*([A-Z][A-Z0-9-]*-\d+)\s*$/)||[])[1]||"";
  if(id&&!record.dataset.originalRecordId)record.dataset.originalRecordId=id;
  const title=mappedTitle(raw);
  const status=recordStatus(record);
  if(summary){
    summary.innerHTML=`<span>${escapeHtml(title)}</span>${id?` <span class="record-id">${escapeHtml(id)}</span>`:""}<span class="record-state">${escapeHtml(status.label)}</span>`;
  }
  const help=record.querySelector(":scope > p.muted");
  if(help)help.textContent=mappedHelp(raw);
  for(const field of record.querySelectorAll("[data-rfield]")){
    const label=field.previousElementSibling;
    if(label?.tagName==="LABEL")label.textContent=readableFieldName(field.dataset.rfield);
  }
  const save=record.querySelector("[data-save-record]");
  if(save)save.textContent="Save this record";
  record.open=true;
  return status.unresolved;
}

function humanizeContextualControls(){
  for(const root of document.querySelectorAll('[data-contextual-controls="true"]')){
    root.dataset.workflowNative="true";
    let group=root.querySelector(':scope > details[data-human-stage-records="true"]');
    const direct=[...root.querySelectorAll(':scope > details[data-record]')];
    if(!group&&direct.length){
      group=document.createElement("details");
      group.className="card";
      group.dataset.humanStageRecords="true";
      group.appendChild(document.createElement("summary"));
      root.insertBefore(group,direct[0]);
      direct.forEach(record=>group.appendChild(record));
    }
    if(!group)continue;
    const records=[...group.querySelectorAll(":scope > details[data-record]")];
    let unresolved=0;
    records.forEach(record=>{unresolved+=humanizeRecord(record)});
    const summary=group.querySelector(":scope > summary");
    if(summary){
      const noun=records.length===1?"record":"records";
      const state=unresolved?`${unresolved} field${unresolved===1?"":"s"} need information`:"all saved";
      summary.innerHTML=`Additional information for this stage <span class="record-count">(${records.length} ${noun}; ${escapeHtml(state)})</span>`;
    }
    group.open=records.length===1&&unresolved>0;
  }
}

function readState(){
  try{return JSON.parse(localStorage.getItem(STORE)||"null")}catch{return null}
}

function stageEntries(state){
  const stages=state?.stages;
  if(Array.isArray(stages))return stages.map((stage,index)=>[Number(stage?.number||index+1),stage]).filter(([,stage])=>stage);
  if(stages&&typeof stages==="object")return Object.entries(stages).map(([key,stage])=>[Number(stage?.number||key),stage]).filter(([number,stage])=>Number.isFinite(number)&&stage);
  return [];
}

function clearRecordStores(state){
  for(const key of ["defects","regressions","blockers","changes","agentOutputReceipts","freshContextLaunches","releaseIdentityRecords","finalReleaseRecords","newJobResets"]){
    if(Array.isArray(state[key]))state[key]=[];
  }
  if(state.operationalRecords&&typeof state.operationalRecords==="object"){
    for(const letter of ["A","B","C","D","E","F"])state.operationalRecords[letter]=[];
  }
  if(state.appendices&&typeof state.appendices==="object"){
    for(const letter of ["A","B","C","D","E","F"])if(state.appendices[letter])state.appendices[letter].records=[];
  }
}

function buildTestJobState(template,spec){
  const state=structuredClone(template);
  clearRecordStores(state);
  state.currentStage=1;
  state.jobId=spec.jobId;
  state.testProject={id:spec.testProjectId,source:"TEST_PROJECT.json",loadedAt:new Date().toISOString(),autoload:false};
  state.job=state.job&&typeof state.job==="object"?state.job:{};
  Object.assign(state.job,{
    id:spec.jobId,
    JOB_ID:spec.jobId,
    title:spec.title,
    JOB_TITLE:spec.title,
    owner:"Workbook user",
    dateOpened:new Date().toISOString(),
    currentStage:1,
    currentIteration:spec.phases?.confirmation?.iterationId||"CONFIRMATION-001",
    currentState:"ACCEPTED",
    inputVersion:spec.baseline?.inputVersion||"INPUT-v001",
    sourceSetVersion:spec.baseline?.sourceSetVersion||"SOURCE-SET-v001",
    requirementsVersion:spec.baseline?.requirementsVersion||"REQUIREMENTS-v001",
    testSuiteVersion:spec.baseline?.testSuiteVersion||"TEST-SUITE-v001",
    instructionVersion:spec.baseline?.instructionVersion||"INSTRUCTION-v001",
    toolConfigurationVersion:spec.baseline?.toolConfigurationVersion||"TOOL-CONFIGURATION-v002",
    baselineId:spec.baseline?.baselineId||"BASELINE-TEST-001",
    productId:spec.product?.productId||"PRODUCT-TEST-001",
    blockers:"NONE",
    nextAction:"Review the retained completed test job or start a new clean job.",
    latestEvidence:"TEST_PROJECT.json"
  });
  const evidence=Array.isArray(spec.stageEvidence)?spec.stageEvidence:[];
  for(const [number,stage] of stageEntries(state)){
    const line=evidence[number-1]||`STAGE ${String(number).padStart(2,"0")}: Retained test evidence.`;
    stage.status="COMPLETE";
    stage.decision="READY TO PROCEED";
    stage.evidence=line;
    stage.decisionEvidence=line;
    stage.decidedBy="Retained test project";
    stage.dateTime=spec.date||new Date().toISOString();
    stage.draftRecord=`TEST PROJECT — STAGE ${String(number).padStart(2,"0")}\nJOB_ID: ${spec.jobId}\nSTATUS: COMPLETE\nEVIDENCE: ${line}`;
    if(stage.fields&&typeof stage.fields==="object")stage.fields={TEST_PROJECT_EVIDENCE:line};
    for(const key of ["humanChecks","gateChecks","evidenceChecks"]){
      if(Array.isArray(stage[key]))stage[key]=stage[key].map(()=>true);
    }
  }
  state.defects=Array.isArray(spec.defects)?structuredClone(spec.defects):[];
  state.regressions=Array.isArray(spec.regressions)?structuredClone(spec.regressions):[];
  return state;
}

async function loadTestJob(){
  const current=readState();
  if(!current){alert("The workbook is still loading. Try again in a moment.");return;}
  if(!confirm("Load the retained test job into this workbook? Export the current job first if it must be kept."))return;
  try{
    const response=await fetch(`TEST_PROJECT.json?t=${Date.now()}`,{cache:"no-store"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const spec=await response.json();
    if(spec?.testProjectId!=="TEST-PROJECT-30-STAGE-001"||spec?.autoload!==false)throw new Error("The retained test project is invalid.");
    const state=buildTestJobState(current,spec);
    localStorage.setItem(STORE,JSON.stringify(state));
    location.reload();
  }catch(error){
    console.error(error);
    alert(`The test job could not be loaded: ${error.message}`);
  }
}

function ensureLoadTestJobButton(){
  const tools=document.querySelector("header .tools");
  if(!tools||document.getElementById("load-test-job"))return;
  const button=document.createElement("button");
  button.id="load-test-job";
  button.type="button";
  button.textContent="Test job";
  button.title="Load the retained completed test project into this workbook";
  button.addEventListener("click",loadTestJob);
  const importButton=[...tools.querySelectorAll("button")].find(item=>cleanText(item)==="Import");
  if(importButton)tools.insertBefore(button,importButton);
  else tools.appendChild(button);
}

function render(){
  installStyles();
  removeInternalPanels();
  humanizeContextualControls();
  ensureLoadTestJobButton();
  removeInternalPanels();
}

function queue(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;render()});
}

document.addEventListener("click",queue,true);
document.addEventListener("change",queue,true);
window.addEventListener("pageshow",queue);
new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});
queue();
})();
