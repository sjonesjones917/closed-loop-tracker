(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="human-facing-workbook-20260823-r2";
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
let queued=false;
const text=e=>String(e?.textContent||"").replace(/\s+/g," ").trim();
function styles(){
 if(document.getElementById(STYLE_ID))return;
 const s=document.createElement("style");s.id=STYLE_ID;
 s.textContent=`
 body{background:#f4f4f1;color:#171717;font-size:16px}.app{max-width:760px;box-shadow:0 0 0 1px #e8e8e3}header,main{padding:16px}header{background:#fff;position:sticky;top:0;z-index:20}h1{font-size:22px;line-height:1.15}.tools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.tools button{min-height:46px;padding:8px 6px;font-size:15px}.nav{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.nav button{min-height:58px;font-size:13px;line-height:1.25}.card{border-color:#d7d7d2;border-radius:14px;padding:16px;margin:14px 0}.card h2{font-size:19px;line-height:1.2}.card h3{font-size:13px}.muted{font-size:13px;line-height:1.4}.copy{font-size:12px;line-height:1.45;max-height:420px}textarea,input,select{font-size:16px;min-height:44px}textarea{min-height:96px}
 [data-internal-workflow-control="true"]{display:none!important}
 .test-project-sheet{border:1px solid #d7d7d2;border-radius:14px;padding:16px;margin:14px 0;background:#fff}.test-project-sheet h2{font-size:19px;margin:0 0 8px}.test-project-sheet p{margin:6px 0;color:#555;line-height:1.45}.test-project-sheet button{margin-top:10px;min-height:44px}.test-results{margin-top:12px;padding-top:10px;border-top:1px solid #ddd}.test-results div{padding:6px 0}.test-ok,.test-bad{font-weight:700}
 @media(max-width:520px){header,main{padding:12px}.tools{grid-template-columns:repeat(2,minmax(0,1fr))}.nav{grid-template-columns:1fr}.nav button{min-height:52px}.card{padding:14px}}
 `;document.head.appendChild(s);
}
function hideDeveloperSurfaces(){
 document.getElementById("repository-test-project")?.remove();
 document.querySelectorAll("h1,h2,h3,h4,summary").forEach(h=>{
  const t=text(h);
  if(/^APPENDIX(?:ES)?\s+A\s*[–—-]\s*F/i.test(t)||/^APPENDIX\s+[A-F]\s*[–—-]/i.test(t)||/^TEST PROJECT\s*[–—-]\s*EXISTING APPLICATION VERIFICATION/i.test(t)){
   const box=h.closest("section,article,details,.card,.panel")||h.parentElement;
   if(box&&!box.closest('[data-contextual-controls="true"]')){box.dataset.internalWorkflowControl="true";box.hidden=true;}
  }
 });
 document.querySelectorAll("section,article,details,.card,.panel").forEach(e=>{
  const t=text(e);if(/Preserved records:\s*\d+/i.test(t)&&/Appendix [A-F]/i.test(t)&&!e.closest('[data-contextual-controls="true"]')){e.dataset.internalWorkflowControl="true";e.hidden=true;}
 });
 document.querySelectorAll("button,a,[role='button']").forEach(e=>{
  const t=text(e);if(/^APPENDIX(?:ES)?\b/i.test(t)||/^OPERATIONAL CONTROLS\b/i.test(t)){e.dataset.internalWorkflowControl="true";e.hidden=true;e.setAttribute("aria-hidden","true");e.setAttribute("tabindex","-1");}
 });
}
function compactContextualControls(){
 document.querySelectorAll('[data-contextual-controls="true"]').forEach(root=>{
  root.dataset.workflowNative="true";
  root.querySelectorAll('details[data-record]').forEach(r=>{r.open=false;r.removeAttribute('open')});
 });
}
async function runBrowserTestProject(){
 const out=document.getElementById("test-project-results");if(!out)return;out.textContent="Running checks…";
 const checks=[];const add=(name,ok,detail="")=>checks.push({name,ok,detail});
 try{const spec=await fetch(`TEST_PROJECT.json?t=${Date.now()}`,{cache:"no-store"});add("Test project available",spec.ok,spec.ok?"Retained deterministic test data loaded":"Could not load TEST_PROJECT.json");if(spec.ok){const data=await spec.json();add("Correct test project",data?.testProjectId==="TEST-PROJECT-30-STAGE-001",data?.title||"missing");add("Test project stays separate from real jobs",data?.autoload===false&&data?.externalAuthority===false,"It never replaces a clean job automatically");}}catch(error){add("Test project available",false,error.message)}
 add("One application",document.querySelectorAll(".app").length===1,"single workbook shell");
 add("All 30 stages",document.querySelectorAll("#nav button").length===30,`${document.querySelectorAll("#nav button").length} stages visible`);
 add("No appendix dashboard",![...document.querySelectorAll("h1,h2,h3,h4,summary")].some(e=>/^APPENDIX(?:ES)?\b/i.test(text(e))&&!e.closest('[data-contextual-controls="true"]')&&!e.hidden),"Appendix rules are used only where the workflow needs them");
 add("Import available",!!document.getElementById("imp"),"existing job import remains available");
 out.innerHTML=checks.map(c=>`<div class="${c.ok?'test-ok':'test-bad'}">${c.ok?'SATISFIED':'VIOLATED'} — ${c.name}${c.detail?`<br><span class="muted">${c.detail}</span>`:''}</div>`).join("");
}
function ensureTestProject(){
 const tools=document.querySelector("header .tools");if(!tools||document.getElementById("run-test-project"))return;
 const b=document.createElement("button");b.id="run-test-project";b.type="button";b.textContent="Test project";b.addEventListener("click",()=>{
  let sheet=document.getElementById("human-test-project");if(!sheet){sheet=document.createElement("section");sheet.id="human-test-project";sheet.className="test-project-sheet";sheet.innerHTML='<h2>Test project</h2><p>Use the retained test project to check this workbook without changing your current job. It verifies the single-app shell, all 30 stages, the retained test data, and that appendix controls are not shown as a separate dashboard.</p><button type="button" id="run-test-project-now">Run test project</button><div id="test-project-results" class="test-results" aria-live="polite"></div>';document.querySelector("main")?.prepend(sheet);sheet.querySelector("#run-test-project-now")?.addEventListener("click",runBrowserTestProject)}sheet.scrollIntoView({behavior:"smooth",block:"start"});runBrowserTestProject();
 });tools.appendChild(b);
}
function render(){styles();hideDeveloperSurfaces();compactContextualControls();ensureTestProject()}
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
document.addEventListener("click",queue,true);document.addEventListener("change",queue,true);window.addEventListener("pageshow",queue);new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});queue();
})();
