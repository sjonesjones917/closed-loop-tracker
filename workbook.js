(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="human-facing-workbook-20260823-final";
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
const STYLE_ID="human-workbook-ui";
const INTERNAL=/^(?:APPENDIX(?:ES)?\s+A\s*[–—-]\s*F(?:\s*[–—-].*)?|APPENDIX\s+[A-F]\s*[–—-].*|WORKFLOW CONTROLS|OPERATIONAL CONTROLS.*|TEST PROJECT\s*[–—-]\s*EXISTING APPLICATION VERIFICATION)$/i;
let queued=false;
const text=e=>String(e?.textContent||"").replace(/\s+/g," ").trim();
function styles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");s.id=STYLE_ID;
  s.textContent=`[data-internal-workflow-control="true"]{display:none!important}.test-project-sheet{border:1px solid #ddd;border-radius:10px;padding:12px;margin:10px 0;background:#fff}.test-project-sheet h2{font-size:16px;margin:0 0 8px}.test-project-sheet p{margin:6px 0;color:#555}.test-project-sheet button{margin-top:8px}.test-results{margin-top:10px;padding-top:8px;border-top:1px solid #ddd}.test-results div{padding:4px 0}.test-ok{font-weight:700}.test-bad{font-weight:700}`;
  document.head.appendChild(s);
}
function hideInternalSurfaces(){
  document.getElementById("repository-test-project")?.remove();
  for(const e of document.querySelectorAll("button,a,[role='button']"))if(INTERNAL.test(text(e))){e.dataset.internalWorkflowControl="true";e.hidden=true;e.setAttribute("aria-hidden","true");e.setAttribute("tabindex","-1")}
  for(const h of document.querySelectorAll("h1,h2,h3,h4,summary"))if(/^APPENDIX\s+[A-F]\s*[–—-]/i.test(text(h))){const box=h.closest("section,article,details,.card,.panel")||h.parentElement;if(box&&!box.closest('[data-contextual-controls="true"]'))box.dataset.internalWorkflowControl="true"}
  for(const e of document.querySelectorAll("section,article,details,.card,.panel"))if(/Preserved records:\s*\d+/i.test(text(e))&&/Appendix [A-F]/i.test(text(e)))e.dataset.internalWorkflowControl="true";
}
function compactStageControls(){
  for(const root of document.querySelectorAll('[data-contextual-controls="true"]')){
    root.dataset.workflowNative="true";
    for(const r of root.querySelectorAll('details[data-record]')){r.open=false;r.removeAttribute('open')}
  }
}
async function runBrowserTestProject(){
  const out=document.getElementById("test-project-results");if(!out)return;
  out.textContent="Running…";
  const checks=[];const add=(name,ok,detail="")=>checks.push({name,ok,detail});
  try{
    const spec=await fetch(`TEST_PROJECT.json?t=${Date.now()}`,{cache:"no-store"});
    add("Retained test-project fixture",spec.ok,spec.ok?"TEST_PROJECT.json loaded":"TEST_PROJECT.json could not be loaded");
    if(spec.ok){const data=await spec.json();add("Test-project identity",data?.testProjectId==="TEST-PROJECT-30-STAGE-001",data?.testProjectId||"missing");add("Test project is not another app",data?.autoload===false&&data?.externalAuthority===false,"retained verification fixture");}
  }catch(error){add("Retained test-project fixture",false,error.message)}
  add("One application entry",document.querySelectorAll(".app").length===1,"single workbook shell");
  add("30 stages available",document.querySelectorAll("#nav button").length===30,`${document.querySelectorAll("#nav button").length} stage buttons`);
  add("Appendix reference screens removed",![...document.querySelectorAll("button,a,[role='button']")].some(e=>/^APPENDIX/i.test(text(e))&&!e.hidden),"controls remain contextual, not separate navigation");
  add("Import control available",!!document.getElementById("imp"),"existing job import path");
  out.innerHTML=checks.map(c=>`<div class="${c.ok?'test-ok':'test-bad'}">${c.ok?'SATISFIED':'VIOLATED'} — ${c.name}${c.detail?`<br><span class="muted">${c.detail}</span>`:''}</div>`).join("");
}
function ensureTestProject(){
  const tools=document.querySelector("header .tools");if(!tools||document.getElementById("run-test-project"))return;
  const b=document.createElement("button");b.id="run-test-project";b.type="button";b.textContent="Test project";b.addEventListener("click",()=>{
    let sheet=document.getElementById("human-test-project");
    if(!sheet){sheet=document.createElement("section");sheet.id="human-test-project";sheet.className="test-project-sheet";sheet.innerHTML='<h2>Test project</h2><p>Checks this existing workbook application. It does not create or open another app.</p><button type="button" id="run-test-project-now">Run checks</button><div id="test-project-results" class="test-results" aria-live="polite"></div>';document.querySelector("main")?.prepend(sheet);sheet.querySelector("#run-test-project-now")?.addEventListener("click",runBrowserTestProject)}
    sheet.scrollIntoView({behavior:"smooth",block:"start"});runBrowserTestProject();
  });tools.appendChild(b);
}
function render(){styles();hideInternalSurfaces();compactStageControls();ensureTestProject()}
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
document.addEventListener("click",queue,true);document.addEventListener("change",queue,true);window.addEventListener("pageshow",queue);new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});queue();
})();
