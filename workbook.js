(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="human-project-visibility-20260823-r4";
    const names=["workbook.module.gz.1","workbook.module.gz.2","workbook.module.gz.3"];
    const responses=await Promise.all(names.map(name=>fetch(`${name}?${cacheKey}`,{cache:"no-store"})));
    for(const response of responses)if(!response.ok)throw new Error(`Runtime load failed: HTTP ${response.status}`);
    const parts=await Promise.all(responses.map(response=>response.arrayBuffer()));
    const total=parts.reduce((sum,part)=>sum+part.byteLength,0);
    const bytes=new Uint8Array(total);
    let offset=0;
    for(const part of parts){bytes.set(new Uint8Array(part),offset);offset+=part.byteLength;}
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const source=await new Response(stream).text();
    const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));
    try{
      globalThis.ClosedLoopWorkbook=await import(url);
      window.dispatchEvent(new CustomEvent("closed-loop-workbook-ready",{detail:{workbook:globalThis.ClosedLoopWorkbook}}));
    }finally{
      URL.revokeObjectURL(url);
    }
  }catch(error){
    console.error(error);
    const target=document.getElementById("content");
    if(target)target.textContent=`Application runtime failed to load: ${error.message}`;
  }
})();

(()=>{
"use strict";

const STORE="mclarw";
const PROJECT_STORE="mclarw-projects";
const TEST_PROJECT_URL="TEST_PROJECT.json";
const TEST_PROJECT_ID="TEST-PROJECT-30-STAGE-001";
const STYLE_ID="human-workbook-ui-r4";
const PANEL_ID="project-inspector";
const INTERNAL_IDS=["appendix-operational-purpose","repository-test-project","human-test-project","run-test-project"];
const INTERNAL_NAV=/^(?:APPENDIX(?:ES)?\s+A\s*[–—-]\s*F|APPENDIX CONTROLS|OPERATIONAL CONTROLS(?:\s+A\s*[–—-]\s*F)?|CONTROL RECORDS|TEST PROJECT\s*[–—-]\s*EXISTING APPLICATION VERIFICATION)$/i;
const INTERNAL_TEXT=/(?:Repository test project|Deployment gate|Live application checks|Verifier coverage|Preserved records:\s*\d+\.\s*Latest:)/i;
const RECORD_TITLES=[
  [/Fresh[- ]context launch/i,"Independent run setup"],
  [/Universal blocker/i,"Blocked stage record"],
  [/Change and invalidation/i,"Change and rework record"],
  [/Exact final release/i,"Final release record"],
  [/New[- ]job/i,"New job setup record"],
  [/Agent[- ]output receipt/i,"Generated response record"]
];
const RECORD_HELP=[
  [/Fresh[- ]context launch/i,"Complete this before the independent run or review starts."],
  [/Universal blocker/i,"Record what is missing, why work cannot continue, and which later work must stop."],
  [/Change and invalidation/i,"Record exactly what changed and which later work must be repeated."],
  [/Exact final release/i,"Complete this only after the release gate and exact file-identity checks."],
  [/New[- ]job/i,"Confirm that this job starts clean and does not inherit an older job's decisions."],
  [/Agent[- ]output receipt/i,"Preserve the generated response, files, failures, and next verification step."]
];

let testProjectCache=null;
let renderQueued=false;
let lastSavedSignature="";
let deepLinkHandled=false;

const now=()=>new Date().toISOString();
const cleanText=element=>String(element?.textContent||"").replace(/\s+/g," ").trim();
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const safeJson=value=>JSON.stringify(value,null,2);
const pad=value=>String(value).padStart(2,"0");
const setText=(element,value)=>{const text=String(value??"");if(element&&element.textContent!==text)element.textContent=text;};
const setHtml=(element,value)=>{const html=String(value??"");if(element&&element.innerHTML!==html)element.innerHTML=html;};

function readJson(key,fallback){
  try{
    const value=JSON.parse(localStorage.getItem(key)||"null");
    return value??fallback;
  }catch{return fallback;}
}

function writeJson(key,value){
  localStorage.setItem(key,JSON.stringify(value));
}

function readState(){return readJson(STORE,null);}
function writeState(state){writeJson(STORE,state);}
function readProjectLibrary(){
  const value=readJson(PROJECT_STORE,{schema:"mclarw-project-library/1",projects:{}});
  if(!value||typeof value!=="object")return {schema:"mclarw-project-library/1",projects:{}};
  value.schema="mclarw-project-library/1";
  value.projects=value.projects&&typeof value.projects==="object"?value.projects:{};
  return value;
}
function writeProjectLibrary(library){writeJson(PROJECT_STORE,library);}

function jobId(state){
  return String(state?.job?.id||state?.job?.JOB_ID||state?.jobId||"").trim();
}

function jobTitle(state){
  return String(state?.job?.title||state?.job?.JOB_TITLE||"Untitled job").trim()||"Untitled job";
}

function stateStages(state){
  const stages=state?.stages;
  if(Array.isArray(stages))return stages.map((stage,index)=>[Number(stage?.number||index+1),stage]).filter(([,stage])=>stage);
  if(stages&&typeof stages==="object")return Object.entries(stages).map(([key,stage])=>[Number(stage?.number||key),stage]).filter(([number,stage])=>Number.isFinite(number)&&stage);
  return [];
}

function runtimeStage(number){
  return globalThis.ClosedLoopWorkbook?.STAGES?.find(stage=>Number(stage.number)===Number(number))||null;
}

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
    :root{--ink:#171715;--muted:#696965;--line:#d9d9d2;--soft:#f5f5f0;--panel:#ffffff;--accent:#20201e;--ok:#e8f3e8;--warn:#fff3d6;--bad:#f9e4e4}
    html{background:var(--soft)}
    body{background:var(--soft);color:var(--ink);font-size:15px;line-height:1.5}
    .app{max-width:840px;box-shadow:0 0 0 1px #e8e8e1;background:var(--panel)}
    header,main{padding:14px}
    header{background:#fff;border-bottom:1px solid var(--line)}
    h1{font-size:21px;line-height:1.2;margin:0 0 5px;letter-spacing:-.01em}
    #job{font-size:13px;color:var(--muted);overflow-wrap:anywhere}
    .tools{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:12px 0}
    .tools button{min-height:44px;border-radius:10px;padding:8px 10px;font-size:13px;font-weight:700;line-height:1.2}
    .nav{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .nav button{min-height:52px;border-radius:10px;padding:8px;font-size:12px;line-height:1.25;text-align:left}
    .card{border-color:var(--line);border-radius:12px;padding:14px;margin:12px 0;background:#fff}
    .card h2{font-size:18px;line-height:1.25;margin-top:0}
    .card h3{font-size:12px;margin:16px 0 6px;letter-spacing:.04em}
    .muted{font-size:13px;line-height:1.45;color:var(--muted)}
    .copy{font-size:12px;line-height:1.5;max-height:420px;white-space:pre-wrap;overflow-wrap:anywhere}
    textarea,input,select{font-size:16px;min-height:44px}
    textarea{min-height:96px}
    #project-status-strip{display:flex;gap:8px;align-items:center;justify-content:space-between;border-top:1px solid #ecece7;padding-top:9px;font-size:12px;color:var(--muted)}
    #project-status-strip strong{color:var(--ink);overflow-wrap:anywhere}
    #${PANEL_ID}{border:1px solid var(--line);border-radius:14px;padding:14px;margin:0 0 14px;background:#fff;box-shadow:0 8px 28px rgba(0,0,0,.05)}
    #${PANEL_ID} h2{font-size:21px;margin:0 0 4px;letter-spacing:-.01em}
    #${PANEL_ID} h3{font-size:16px;margin:0}
    .project-head{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}
    .project-head .project-title{min-width:0;flex:1}
    .project-actions{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}
    .project-actions button{border-radius:9px;padding:8px 10px;min-height:40px;font-weight:700}
    .project-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}
    .summary-tile{border:1px solid var(--line);border-radius:10px;padding:10px;min-width:0}
    .summary-tile b{display:block;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
    .summary-tile span{display:block;font-size:13px;font-weight:700;overflow-wrap:anywhere}
    .project-section{border-top:1px solid var(--line);padding:11px 0}
    .project-section>summary{cursor:pointer;font-weight:800;min-height:38px;display:flex;align-items:center;gap:6px}
    .project-section>summary small{font-weight:500;color:var(--muted)}
    .record-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}
    .record-card{border:1px solid var(--line);border-radius:10px;padding:10px;min-width:0;background:#fff}
    .record-card h4{font-size:13px;margin:0 0 6px;overflow-wrap:anywhere}
    .record-label{font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:3px}
    .record-value{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.45}
    .record-value.mono,.project-raw,.prompt-text{font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;background:#f4f4f0;border-radius:8px;padding:10px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:480px;overflow:auto}
    .stage-project-card{border:1px solid var(--line);border-radius:11px;padding:10px;margin:9px 0;background:#fff}
    .stage-project-card>summary{cursor:pointer;font-weight:800;display:flex;gap:8px;align-items:center;justify-content:space-between}
    .status-chip{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:800;white-space:nowrap;background:#eeeeea;color:#444}
    .status-chip.complete,.status-chip.accepted,.status-chip.satisfied{background:var(--ok)}
    .status-chip.blocked,.status-chip.undetermined{background:var(--warn)}
    .status-chip.rejected,.status-chip.violated{background:var(--bad)}
    .prompt-card{border-top:1px dashed var(--line);margin-top:10px;padding-top:10px}
    .prompt-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}
    .prompt-head strong{font-size:13px}
    .small-button{min-height:34px!important;padding:6px 9px!important;border-radius:8px!important;font-size:12px!important}
    [data-human-stage-records="true"]{margin-top:12px}
    [data-human-stage-records="true"]>summary{cursor:pointer;font-weight:800;list-style-position:outside}
    [data-human-stage-records="true"] .record-count{color:var(--muted);font-weight:500;font-size:12px}
    [data-human-stage-records="true"] details[data-record]{border:1px solid var(--line);border-radius:10px;padding:10px;margin:10px 0;background:#fff}
    [data-human-stage-records="true"] details[data-record]>summary{cursor:pointer;font-weight:750}
    [data-human-stage-records="true"] .record-state{float:right;color:var(--muted);font-size:11px;font-weight:700}
    [data-human-stage-records="true"] .record-id{color:#777;font-size:11px;font-weight:500}
    [data-human-stage-records="true"] [data-save-record]{width:100%;margin-top:12px}
    [data-hidden-internal-ui="true"]{display:none!important}
    @media(max-width:720px){.tools{grid-template-columns:repeat(3,minmax(0,1fr))}.project-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:520px){header,main{padding:12px}.tools{grid-template-columns:repeat(2,minmax(0,1fr))}.nav{grid-template-columns:repeat(2,minmax(0,1fr))}.nav button{min-height:50px}.card{padding:13px}.record-grid{grid-template-columns:1fr}.project-head{display:block}.project-summary{grid-template-columns:1fr 1fr}}
    @media(max-width:350px){.nav,.project-summary{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function removeInternalPanels(){
  for(const id of INTERNAL_IDS)document.getElementById(id)?.remove();
  for(const control of document.querySelectorAll("button,a,[role='button']")){
    if(INTERNAL_NAV.test(cleanText(control))){
      control.dataset.hiddenInternalUi="true";
      control.remove();
    }
  }
  for(const box of document.querySelectorAll("section,article,details,.card,.panel")){
    if(box.id===PANEL_ID||box.closest(`#${PANEL_ID}`)||box.closest('[data-contextual-controls="true"],[data-human-stage-records="true"]'))continue;
    if(INTERNAL_TEXT.test(cleanText(box))){
      box.dataset.hiddenInternalUi="true";
      box.remove();
    }
  }
}

function readableFieldName(name){
  return String(name||"")
    .replace(/SHA256/g,"SHA-256")
    .replace(/_/g," ")
    .replace(/([a-z0-9])([A-Z])/g,"$1 $2")
    .toLowerCase()
    .replace(/\b(id|sha-256|url|utc|api|utf-8)\b/g,word=>word.toUpperCase())
    .replace(/^./,char=>char.toUpperCase());
}

function mappedTitle(raw){
  for(const [pattern,title] of RECORD_TITLES)if(pattern.test(raw))return title;
  return raw.replace(/\s+[—-]\s+\S+$/," ").trim()||"Stage record";
}

function mappedHelp(raw){
  for(const [pattern,help] of RECORD_HELP)if(pattern.test(raw))return help;
  return "Complete and save this record before the stage relies on it.";
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
  const status=recordStatus(record);
  if(summary)setHtml(summary,`<span>${escapeHtml(mappedTitle(raw))}</span>${id?` <span class="record-id">${escapeHtml(id)}</span>`:""}<span class="record-state">${escapeHtml(status.label)}</span>`);
  const help=record.querySelector(":scope > p.muted");
  if(help)setText(help,mappedHelp(raw));
  for(const field of record.querySelectorAll("[data-rfield]")){
    const label=field.previousElementSibling;
    if(label?.tagName==="LABEL")setText(label,readableFieldName(field.dataset.rfield));
  }
  const save=record.querySelector("[data-save-record]");
  if(save)setText(save,"Save this record");
  if(record.open!==(status.unresolved>0))record.open=status.unresolved>0;
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
    records.forEach(record=>{unresolved+=humanizeRecord(record);});
    const summary=group.querySelector(":scope > summary");
    if(summary){
      const noun=records.length===1?"record":"records";
      const state=unresolved?`${unresolved} field${unresolved===1?"":"s"} need information`:"all saved";
      setHtml(summary,`Required records for this stage <span class="record-count">(${records.length} ${noun}; ${escapeHtml(state)})</span>`);
    }
    if(group.open!==(unresolved>0))group.open=unresolved>0;
  }
}

function saveCurrentProject(showError=false){
  const state=readState();
  const id=jobId(state);
  if(!state||!id)return false;
  const library=readProjectLibrary();
  library.projects[id]={
    id,
    title:jobTitle(state),
    savedAt:now(),
    currentStage:Number(state?.job?.currentStage||state?.currentStage||1),
    currentState:String(state?.job?.currentState||"NOT STARTED"),
    state
  };
  try{
    writeProjectLibrary(library);
    lastSavedSignature=JSON.stringify(state);
    return true;
  }catch(error){
    console.error(error);
    if(showError)alert(`This project could not be saved in this browser: ${error.message}`);
    return false;
  }
}

function autoSaveCurrentProject(){
  const state=readState();
  if(!state||!jobId(state))return;
  const signature=JSON.stringify(state);
  if(signature===lastSavedSignature)return;
  saveCurrentProject(false);
}

function projectStatusText(state){
  if(!state)return "No job is open";
  const id=jobId(state)||"Unassigned job";
  const stage=Number(state?.job?.currentStage||state?.currentStage||1);
  const status=String(state?.job?.currentState||"NOT STARTED");
  return `${id} · Stage ${pad(stage)} · ${status}`;
}

function ensureHeaderControls(){
  const tools=document.querySelector("header .tools");
  if(!tools)return;
  if(!document.getElementById("open-project-data")){
    const button=document.createElement("button");
    button.id="open-project-data";
    button.type="button";
    button.textContent="Project data";
    button.title="Inspect every stored field, stage record, generated prompt, instruction, output, and evidence item in the current project";
    button.addEventListener("click",()=>openCurrentProject());
    const importButton=[...tools.querySelectorAll("button")].find(item=>cleanText(item)==="Import");
    if(importButton)tools.insertBefore(button,importButton);else tools.appendChild(button);
  }
  if(!document.getElementById("open-test-project")){
    const button=document.createElement("button");
    button.id="open-test-project";
    button.type="button";
    button.textContent="Test project";
    button.title="Open the complete retained 30-stage test project without replacing the current job";
    button.addEventListener("click",()=>openTestProject());
    const importButton=[...tools.querySelectorAll("button")].find(item=>cleanText(item)==="Import");
    if(importButton)tools.insertBefore(button,importButton);else tools.appendChild(button);
  }
  let strip=document.getElementById("project-status-strip");
  if(!strip){
    strip=document.createElement("div");
    strip.id="project-status-strip";
    tools.insertAdjacentElement("afterend",strip);
  }
  const library=readProjectLibrary();
  const saved=Object.keys(library.projects).length;
  setHtml(strip,`<strong>${escapeHtml(projectStatusText(readState()))}</strong><span>${saved} saved project${saved===1?"":"s"}</span>`);
}

function wrapStateChangingFunctions(){
  for(const name of ["newJob","importProject"]){
    const original=globalThis[name];
    if(typeof original!=="function"||original.__projectSaveWrapped)continue;
    const wrapped=function(...args){
      saveCurrentProject(false);
      return original.apply(this,args);
    };
    wrapped.__projectSaveWrapped=true;
    wrapped.__original=original;
    globalThis[name]=wrapped;
  }
}

function statusClass(value){
  const text=String(value||"").toLowerCase();
  if(/complete|accepted|satisfied|ready/.test(text))return "complete";
  if(/blocked|undetermined|not ready|unknown/.test(text))return "blocked";
  if(/rejected|violated|failed/.test(text))return "rejected";
  return "";
}

function summaryTile(label,value){
  return `<div class="summary-tile"><b>${escapeHtml(label)}</b><span>${escapeHtml(value??"UNKNOWN")}</span></div>`;
}

function valueMarkup(value,mono=false){
  if(value===null||value===undefined)return '<div class="record-value">UNKNOWN</div>';
  if(typeof value==="object")return `<pre class="record-value mono">${escapeHtml(safeJson(value))}</pre>`;
  return `<div class="record-value${mono?" mono":""}">${escapeHtml(String(value))}</div>`;
}

function fieldCard(label,value,mono=false){
  return `<div class="record-card"><div class="record-label">${escapeHtml(readableFieldName(label))}</div>${valueMarkup(value,mono)}</div>`;
}

function objectGrid(value){
  const entries=Object.entries(value||{});
  if(!entries.length)return '<p class="muted">No data recorded.</p>';
  return `<div class="record-grid">${entries.map(([key,item])=>fieldCard(key,item,typeof item==="string"&&item.includes("\n"))).join("")}</div>`;
}

function recordIdentity(record,index){
  if(!record||typeof record!=="object")return `Record ${index+1}`;
  const preferred=["id","jobId","sourceId","reqId","testId","mutationId","runId","executionId","defectId","regId","changeId","chainRecordId","recordId","artifactId","iterationId","stage"];
  for(const key of preferred)if(record[key]!==undefined)return String(record[key]);
  return `Record ${index+1}`;
}

function recordList(title,items,{open=false,summary=""}={}){
  const list=Array.isArray(items)?items:[];
  return `<details class="project-section" ${open?"open":""}><summary>${escapeHtml(title)} <small>(${list.length}${summary?`; ${escapeHtml(summary)}`:""})</small></summary>${list.length?`<div class="record-grid">${list.map((item,index)=>`<div class="record-card"><h4>${escapeHtml(recordIdentity(item,index))}</h4>${valueMarkup(item,true)}</div>`).join("")}</div>`:'<p class="muted">No records.</p>'}</details>`;
}

function promptForStage(definition,state){
  try{
    if(!definition||typeof globalThis.ClosedLoopWorkbook?.buildStagePrompt!=="function")return "Prompt generation is unavailable because the workbook runtime did not finish loading.";
    return globalThis.ClosedLoopWorkbook.buildStagePrompt(definition,state);
  }catch(error){return `Prompt generation error: ${error.message}`;}
}

function checklistSummary(stage,definition){
  const runtime=globalThis.ClosedLoopWorkbook;
  const groups=[];
  const definitions=[
    ["Human checklist",runtime?.stageHumanItems?.(definition)||[],stage?.humanChecks||stage?.check||[]],
    ["Completion gate",runtime?.stageGateItems?.(definition)||[],stage?.gateChecks||[]],
    ["Evidence to preserve",runtime?.stageEvidenceItems?.(definition)||[],stage?.evidenceChecks||[]]
  ];
  for(const [name,items,values] of definitions){
    if(!items.length)continue;
    groups.push({name,total:items.length,complete:items.filter((_,index)=>Boolean(values[index])).length,items:items.map((item,index)=>({item,complete:Boolean(values[index])}))});
  }
  return groups;
}

function stageProjectCards(state,stageRecords=[]){
  const stages=stateStages(state);
  return stages.map(([number,stage])=>{
    const definition=runtimeStage(number);
    const storedRecord=stageRecords.find(record=>Number(record?.number)===number)||null;
    const title=definition?.title||stage?.title||storedRecord?.title||`Stage ${pad(number)}`;
    const status=stage?.status||storedRecord?.status||"NOT STARTED";
    const decision=stage?.decision||storedRecord?.decision||"NOT READY - CORRECTION REQUIRED";
    const recordText=stage?.draftRecord||stage?.record||storedRecord?.formattedRecord||"No stage record has been entered.";
    const fields=stage?.fields&&Object.keys(stage.fields).length?stage.fields:storedRecord?.userFilledData||{};
    const checks=checklistSummary(stage,definition);
    const prompt=promptForStage(definition,state);
    return `<details class="stage-project-card" ${number===1?"open":""} data-stage-project="${number}">
      <summary><span>${pad(number)} ${escapeHtml(title)}</span><span class="status-chip ${statusClass(status)}">${escapeHtml(status)}</span></summary>
      <div class="record-grid">
        ${fieldCard("Stage decision",decision)}
        ${fieldCard("Decision evidence",stage?.decisionEvidence||stage?.evidence||storedRecord?.evidence||"UNKNOWN",true)}
        ${fieldCard("Next stage or return stage",stage?.next||storedRecord?.nextStage||"UNKNOWN")}
        ${fieldCard("Decided by",stage?.decidedBy||storedRecord?.decidedBy||"UNKNOWN")}
      </div>
      <details class="project-section" open><summary>User-filled stage record</summary>${valueMarkup(recordText,true)}${objectGrid(fields)}</details>
      ${checks.length?`<details class="project-section"><summary>Checklist, gate, and evidence status</summary>${checks.map(group=>`<div class="record-card"><h4>${escapeHtml(group.name)} — ${group.complete}/${group.total}</h4><div class="record-value">${group.items.map(item=>`${item.complete?"✓":"○"} ${item.item}`).map(escapeHtml).join("<br>")}</div></div>`).join("")}</details>`:""}
      ${storedRecord?`<details class="project-section"><summary>Complete retained stage data</summary>${valueMarkup(storedRecord,true)}</details>`:""}
      <div class="prompt-card"><div class="prompt-head"><strong>Generated stage prompt</strong><button class="small-button" type="button" data-copy-target="prompt-${number}">Copy prompt</button></div><pre id="prompt-${number}" class="prompt-text" data-generated-prompt="${number}">${escapeHtml(prompt)}</pre></div>
    </details>`;
  }).join("");
}

function currentProjectCollections(state){
  const collections=[];
  const names=[
    ["Source inventory",state?.sourceInventory],
    ["Requirements",state?.requirements],
    ["Verification tests",state?.tests||state?.testSuite],
    ["Failure and mutation tests",state?.mutations||state?.mutationTests],
    ["Execution runs",state?.executionRuns||state?.runs],
    ["Verification records",state?.verificationMatrix||state?.verificationRecords],
    ["Defects",state?.defects],
    ["Regression tests",state?.regressions],
    ["Blockers",state?.blockers],
    ["Changes and invalidations",state?.changes],
    ["Fresh-context records",state?.freshContextLaunches],
    ["Generated-response records",state?.agentOutputReceipts],
    ["Release identity records",state?.releaseIdentityRecords],
    ["Final release records",state?.finalReleaseRecords]
  ];
  for(const [title,value] of names)if(Array.isArray(value)&&value.length)collections.push(recordList(title,value));
  const objects=[
    ["Generated production instruction",state?.productionInstruction],
    ["Convergence record",state?.convergence],
    ["Approved baseline",state?.baseline],
    ["Finished product",state?.product],
    ["Process audit",state?.processAudit],
    ["Product audit",state?.productAudit],
    ["Release record",state?.release],
    ["Permanent defect and regression registry",state?.permanentRegistry]
  ];
  for(const [title,value] of objects)if(value&&typeof value==="object"&&Object.keys(value).length){
    collections.push(`<details class="project-section"><summary>${escapeHtml(title)}</summary>${objectGrid(value)}</details>`);
  }
  if(state?.operationalRecords&&typeof state.operationalRecords==="object"){
    for(const [letter,value] of Object.entries(state.operationalRecords))if(Array.isArray(value)&&value.length)collections.push(recordList(`Operational records ${letter}`,value));
  }
  const shown=new Set(["schema","currentStage","jobId","job","stages","appendices","operationalRecords","projectData","sourceInventory","requirements","tests","testSuite","mutations","mutationTests","executionRuns","runs","verificationMatrix","verificationRecords","defects","regressions","blockers","changes","freshContextLaunches","agentOutputReceipts","releaseIdentityRecords","finalReleaseRecords","productionInstruction","convergence","baseline","product","processAudit","productAudit","release","permanentRegistry"]);
  const remaining=Object.fromEntries(Object.entries(state||{}).filter(([key])=>!shown.has(key)));
  if(Object.keys(remaining).length)collections.push(`<details class="project-section"><summary>All additional stored project fields</summary>${objectGrid(remaining)}</details>`);
  return collections.join("");
}

function savedProjectsSection(currentId){
  const library=readProjectLibrary();
  const projects=Object.values(library.projects).sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));
  return `<details class="project-section"><summary>Saved projects <small>(${projects.length})</small></summary>${projects.length?`<div class="record-grid">${projects.map(project=>`<div class="record-card"><h4>${escapeHtml(project.title||project.id)}</h4><div class="record-value">${escapeHtml(project.id)}<br>${escapeHtml(project.currentState||"UNKNOWN")} · Stage ${pad(project.currentStage||1)}<br>Saved ${escapeHtml(project.savedAt||"UNKNOWN")}</div><button class="small-button" type="button" data-open-saved-project="${escapeHtml(project.id)}" ${project.id===currentId?"disabled":""}>${project.id===currentId?"Current project":"Open project"}</button></div>`).join("")}</div>`:'<p class="muted">No saved projects yet. A named job is saved automatically as it changes.</p>'}</details>`;
}

function renderCurrentProjectPanel(state){
  const id=jobId(state)||"UNASSIGNED JOB";
  const stageNumber=Number(state?.job?.currentStage||state?.currentStage||1);
  const stageRecords=Array.isArray(state?.projectData?.stageRecords)?state.projectData.stageRecords:[];
  return `<div class="project-head"><div class="project-title"><h2>${escapeHtml(jobTitle(state))}</h2><p class="muted">Complete human-readable project record. Every stored field, user-entered stage record, generated stage prompt, instruction, output record, defect, evidence item, and raw project value remains inspectable here.</p></div><span class="status-chip ${statusClass(state?.job?.currentState)}">${escapeHtml(state?.job?.currentState||"NOT STARTED")}</span></div>
    <div class="project-actions"><button type="button" data-close-project>Close</button><button type="button" data-save-project>Save now</button><button type="button" data-download-current>Download complete project</button></div>
    <div class="project-summary">${summaryTile("Job ID",id)}${summaryTile("Current stage",`Stage ${pad(stageNumber)}`)}${summaryTile("Iteration",state?.job?.currentIteration||"NOT APPLICABLE")}${summaryTile("Latest evidence",state?.job?.latestEvidence||"UNKNOWN")}</div>
    ${savedProjectsSection(id)}
    <details class="project-section" open data-user-filled-data="true"><summary>Master job control and user-filled data</summary>${objectGrid(state?.job||{})}</details>
    ${state?.projectData?.userInputs?`<details class="project-section" open><summary>Exact user request and supplied materials</summary>${objectGrid(state.projectData.userInputs)}</details>`:""}
    <details class="project-section" open><summary>All 30 stage records and generated prompts <small>(${stateStages(state).length} stages)</small></summary>${stageProjectCards(state,stageRecords)}</details>
    ${currentProjectCollections(state)}
    <details class="project-section" data-project-complete-record="true"><summary>Complete stored project data</summary><pre class="project-raw">${escapeHtml(safeJson(state))}</pre></details>`;
}

function buildTestJobState(template,spec){
  const runtime=globalThis.ClosedLoopWorkbook;
  const state=structuredClone(template||runtime?.createBlankState?.()||{});
  state.schema=state.schema||"mclarw/30";
  state.currentStage=1;
  state.jobId=spec.jobId;
  state.testProject={id:spec.testProjectId,source:TEST_PROJECT_URL,loadedAt:now(),autoload:false};
  state.projectData=structuredClone(spec);
  state.job=state.job&&typeof state.job==="object"?state.job:{};
  Object.assign(state.job,{
    id:spec.jobId,
    JOB_ID:spec.jobId,
    title:spec.title,
    JOB_TITLE:spec.title,
    owner:spec.userInputs?.jobOwner||"Workbook user",
    dateOpened:spec.date,
    currentStage:1,
    currentIteration:spec.confirmation?.iterationId||"CONFIRMATION-001",
    currentState:spec.release?.releaseState||"ACCEPTED",
    inputVersion:spec.baseline?.inputVersion||"INPUT-v001",
    sourceSetVersion:spec.baseline?.sourceSetVersion||"SOURCE-SET-v001",
    requirementsVersion:spec.baseline?.requirementsVersion||"REQUIREMENTS-v001",
    testSuiteVersion:spec.baseline?.testSuiteVersion||"TEST-SUITE-v001",
    instructionVersion:spec.productionInstruction?.instructionVersion||"INSTRUCTION-v001",
    toolConfigurationVersion:spec.baseline?.toolConfigurationVersion||"TOOL-CONFIGURATION-v002",
    baselineId:spec.baseline?.baselineId||"BASELINE-TEST-001",
    productId:spec.product?.productId||"PRODUCT-TEST-001",
    blockers:"NONE",
    nextAction:"Inspect any stage or project-data section; this retained project is complete and remains non-authoritative for new jobs.",
    latestEvidence:spec.release?.hashAuditId||"TEST_PROJECT.json"
  });
  const records=Array.isArray(spec.stageRecords)?spec.stageRecords:[];
  for(const [number,stage] of stateStages(state)){
    const record=records.find(item=>Number(item.number)===number)||{};
    stage.status=record.status||"COMPLETE";
    stage.decision=record.decision||"READY TO PROCEED";
    stage.evidence=record.evidence||spec.stageEvidence?.[number-1]||"Retained test-project evidence recorded.";
    stage.decisionEvidence=stage.evidence;
    stage.next=record.nextStage||record.returnStage|| (number<30?`STAGE ${pad(number+1)}`:"RELEASE COMPLETE");
    stage.decidedBy=record.decidedBy||"Retained test-project verifier";
    stage.dateTime=record.dateTime||spec.date;
    stage.record=record.formattedRecord||`TEST PROJECT — STAGE ${pad(number)}\nJOB_ID: ${spec.jobId}\nSTATUS: ${stage.status}\nDECISION: ${stage.decision}\nEVIDENCE: ${stage.evidence}`;
    stage.draftRecord=stage.record;
    stage.fields=record.userFilledData&&typeof record.userFilledData==="object"?structuredClone(record.userFilledData):{};
    if(Array.isArray(stage.humanChecks))stage.humanChecks=stage.humanChecks.map(()=>true);
    if(Array.isArray(stage.gateChecks))stage.gateChecks=stage.gateChecks.map(()=>true);
    if(Array.isArray(stage.evidenceChecks))stage.evidenceChecks=stage.evidenceChecks.map(()=>true);
    if(Array.isArray(stage.check))stage.check=stage.check.map(()=>true);
  }
  for(const key of ["sourceInventory","requirements","tests","mutations","executionRuns","verificationMatrix","comparisons","defects","regressions","changes","evidenceChains"]){
    state[key]=Array.isArray(spec[key])?structuredClone(spec[key]):[];
  }
  state.productionInstruction=structuredClone(spec.productionInstruction||{});
  state.convergence=structuredClone(spec.convergence||{});
  state.baseline=structuredClone(spec.baseline||{});
  state.product=structuredClone(spec.product||{});
  state.release=structuredClone(spec.release||{});
  state.blockers=[];
  state.freshContextLaunches=Array.isArray(spec.freshContextLaunches)?structuredClone(spec.freshContextLaunches):[];
  state.agentOutputReceipts=Array.isArray(spec.agentOutputReceipts)?structuredClone(spec.agentOutputReceipts):[];
  state.releaseIdentityRecords=Array.isArray(spec.releaseIdentityRecords)?structuredClone(spec.releaseIdentityRecords):[];
  return state;
}

async function fetchTestProject(){
  if(testProjectCache)return testProjectCache;
  const response=await fetch(`${TEST_PROJECT_URL}?project-view=${Date.now()}`,{cache:"no-store"});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const spec=await response.json();
  if(spec?.testProjectId!==TEST_PROJECT_ID||spec?.autoload!==false||spec?.externalAuthority!==false)throw new Error("The retained test project has an invalid identity or authority setting.");
  testProjectCache=spec;
  return spec;
}

function testProjectCollections(spec){
  return [
    recordList("Source inventory",spec.sourceInventory,{open:true}),
    recordList("Generated requirements",spec.requirements,{open:true}),
    recordList("Generated verification tests",spec.tests),
    recordList("Failure and mutation tests",spec.mutations),
    recordList("Candidate freeze manifests",spec.freezeManifests),
    recordList("All execution records",spec.executionRuns,{summary:"10 initial, 10 corrected, 10 unchanged confirmation"}),
    recordList("All independent verification records",spec.verificationMatrix,{summary:"one record per requirement per run"}),
    recordList("Cross-run comparisons",spec.comparisons),
    recordList("Defects and root-cause records",[...(spec.defects||[]),...(spec.rootCauseRecords||[])]),
    recordList("Regression tests",spec.regressions),
    recordList("Change and invalidation records",spec.changes),
    recordList("Deterministic product verification",spec.deterministicVerification),
    recordList("Independent semantic verification",spec.semanticVerification),
    recordList("Adversarial verification",spec.adversarialVerification),
    recordList("Final representation inspection",spec.representationInspection),
    recordList("Evidence chains",spec.evidenceChains)
  ].join("");
}

function renderTestProjectPanel(spec){
  const template=globalThis.ClosedLoopWorkbook?.createBlankState?.()||readState()||{};
  const state=buildTestJobState(template,spec);
  return `<div class="project-head"><div class="project-title"><h2>${escapeHtml(spec.title)}</h2><p class="muted">This is the complete retained test project for the existing application. It is project data, not another app and not authority for a new job. Every input, generated requirement, test, instruction, run, verification record, stage record, generated stage prompt, defect, correction, product, and release item is visible below.</p></div><span class="status-chip accepted">${escapeHtml(spec.release?.releaseState||"UNKNOWN")}</span></div>
    <div class="project-actions"><button type="button" data-close-project>Close</button><button type="button" data-load-test-project>Load into workbook</button><button type="button" data-download-test>Download complete project</button></div>
    <div class="project-summary">${summaryTile("Job ID",spec.jobId)}${summaryTile("Stages",`${spec.stageRecords?.length||0}/30 complete`)}${summaryTile("Runs",spec.executionRuns?.length||0)}${summaryTile("Release hash",spec.release?.releaseSha256||"UNKNOWN")}</div>
    <details class="project-section" open data-user-filled-data="true"><summary>Exact user request, supplied materials, and filled-in job data</summary>${objectGrid(spec.userInputs||{})}${objectGrid(spec.objective||{})}</details>
    <details class="project-section" open><summary>Generated production instruction</summary>${valueMarkup(spec.productionInstruction||{},true)}</details>
    ${testProjectCollections(spec)}
    <details class="project-section" open><summary>Convergence, confirmation, baseline, product, and release</summary>${objectGrid({convergence:spec.convergence,confirmation:spec.confirmation,baseline:spec.baseline,product:spec.product,processAudit:spec.processAudit,productAudit:spec.productAudit,release:spec.release})}</details>
    <details class="project-section" open><summary>All 30 stage records and generated prompts <small>(${stateStages(state).length} stages)</small></summary>${stageProjectCards(state,spec.stageRecords||[])}</details>
    <details class="project-section" data-project-complete-record="true"><summary>Complete test-project data</summary><pre class="project-raw">${escapeHtml(safeJson(spec))}</pre></details>`;
}

function ensurePanel(){
  let panel=document.getElementById(PANEL_ID);
  if(panel)return panel;
  panel=document.createElement("section");
  panel.id=PANEL_ID;
  panel.setAttribute("aria-live","polite");
  const main=document.querySelector("main");
  const master=document.getElementById("master");
  if(main)main.insertBefore(panel,master||main.firstChild);else document.body.appendChild(panel);
  return panel;
}

function closeProjectPanel(){
  document.getElementById(PANEL_ID)?.remove();
}

function openCurrentProject(){
  const state=readState();
  if(!state){alert("The workbook is still loading.");return;}
  saveCurrentProject(false);
  const panel=ensurePanel();
  panel.dataset.projectView="current";
  panel.innerHTML=renderCurrentProjectPanel(state);
  panel.scrollIntoView({behavior:"smooth",block:"start"});
}

async function openTestProject(){
  try{
    const spec=await fetchTestProject();
    const panel=ensurePanel();
    panel.dataset.projectView="test";
    panel.innerHTML=renderTestProjectPanel(spec);
    panel.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    console.error(error);
    alert(`The test project could not be opened: ${error.message}`);
  }
}

function openSavedProject(id){
  const library=readProjectLibrary();
  const saved=library.projects[id];
  if(!saved?.state){alert("The selected saved project is unavailable.");return;}
  saveCurrentProject(false);
  writeState(saved.state);
  location.reload();
}

function downloadJson(filename,value){
  const blob=new Blob([safeJson(value)+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyElementText(id,button){
  const element=document.getElementById(id);
  if(!element)return;
  const text=element.textContent||"";
  try{
    await navigator.clipboard.writeText(text);
  }catch{
    const area=document.createElement("textarea");
    area.value=text;
    area.style.position="fixed";
    area.style.opacity="0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  const original=button.textContent;
  button.textContent="Copied";
  setTimeout(()=>{button.textContent=original;},1200);
}

async function loadTestProjectIntoWorkbook(){
  try{
    const spec=await fetchTestProject();
    saveCurrentProject(false);
    const template=globalThis.ClosedLoopWorkbook?.createBlankState?.()||readState()||{};
    const state=buildTestJobState(template,spec);
    writeState(state);
    saveCurrentProject(false);
    location.reload();
  }catch(error){
    console.error(error);
    alert(`The test project could not be loaded: ${error.message}`);
  }
}

function bindProjectActions(){
  document.addEventListener("click",event=>{
    const button=event.target.closest("button");
    if(!button)return;
    if(button.matches("[data-close-project]")){closeProjectPanel();return;}
    if(button.matches("[data-save-project]")){saveCurrentProject(true);ensureHeaderControls();return;}
    if(button.matches("[data-download-current]")){
      const state=readState();
      if(state)downloadJson(`${jobId(state)||"WORKBOOK"}__COMPLETE_PROJECT.json`,state);
      return;
    }
    if(button.matches("[data-download-test]")){
      if(testProjectCache)downloadJson("TEST_PROJECT.json",testProjectCache);
      return;
    }
    if(button.matches("[data-load-test-project]")){loadTestProjectIntoWorkbook();return;}
    if(button.matches("[data-open-saved-project]")){openSavedProject(button.dataset.openSavedProject);return;}
    if(button.matches("[data-copy-target]")){copyElementText(button.dataset.copyTarget,button);return;}
  },true);
}

function handleDeepLink(){
  if(deepLinkHandled||!globalThis.ClosedLoopWorkbook)return;
  deepLinkHandled=true;
  const params=new URLSearchParams(location.search);
  if(params.get("project")==="test")openTestProject();
  else if(params.get("project")==="current")openCurrentProject();
}

function render(){
  installStyles();
  removeInternalPanels();
  humanizeContextualControls();
  ensureHeaderControls();
  wrapStateChangingFunctions();
  handleDeepLink();
  removeInternalPanels();
}

function queueRender(){
  if(renderQueued)return;
  renderQueued=true;
  requestAnimationFrame(()=>{renderQueued=false;render();});
}

bindProjectActions();
document.addEventListener("change",()=>{setTimeout(autoSaveCurrentProject,0);queueRender();},true);
document.addEventListener("click",()=>{setTimeout(autoSaveCurrentProject,80);queueRender();},true);
window.addEventListener("closed-loop-workbook-ready",queueRender);
window.addEventListener("pageshow",queueRender);
window.addEventListener("beforeunload",()=>saveCurrentProject(false));
new MutationObserver(queueRender).observe(document.documentElement,{subtree:true,childList:true});
setInterval(autoSaveCurrentProject,1200);
queueRender();

})();
