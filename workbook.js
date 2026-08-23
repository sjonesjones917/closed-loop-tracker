(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="human-facing-workbook-clean-ui-20260823";
    const names=["workbook.module.gz.1","workbook.module.gz.2","workbook.module.gz.3"];
    const responses=await Promise.all(names.map(name=>fetch(`${name}?${cacheKey}`,{cache:"no-store"})));
    for(const response of responses)if(!response.ok)throw new Error(`Runtime load failed: HTTP ${response.status}`);
    const parts=await Promise.all(responses.map(response=>response.arrayBuffer()));
    const total=parts.reduce((sum,part)=>sum+part.byteLength,0),bytes=new Uint8Array(total);let offset=0;
    for(const part of parts){bytes.set(new Uint8Array(part),offset);offset+=part.byteLength;}
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const source=await new Response(stream).text();const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));
    try{await import(url);}finally{URL.revokeObjectURL(url);}
  }catch(error){console.error(error);const target=document.getElementById("content");if(target)target.textContent=`Application runtime failed to load: ${error.message}`;}
})();

(()=>{
"use strict";
const BAD_NAV=/^(?:APPENDIX(?:ES)?\s+A\s*[–—-]\s*F(?:\s*[–—-].*)?|APPENDIX\s+[A-F]\s*[–—-].*|TEST PROJECT.*|WORKFLOW CONTROLS|OPERATIONAL CONTROLS.*)$/i;
const APPENDIX_HEADING=/^APPENDIX\s+[A-F]\s*[–—-]/i;
const STYLE_ID="human-workbook-ui";
let queued=false;
const text=e=>String(e?.textContent||"").replace(/\s+/g," ").trim();
function styles(){if(document.getElementById(STYLE_ID))return;const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`[data-internal-workflow-control="true"]{display:none!important}`;document.head.appendChild(s)}
function hideInternalSurfaces(){document.getElementById("repository-test-project")?.remove();for(const e of document.querySelectorAll("button,a,[role='button']")){if(BAD_NAV.test(text(e))){e.dataset.internalWorkflowControl="true";e.hidden=true;e.setAttribute("aria-hidden","true");e.setAttribute("tabindex","-1") }}for(const h of document.querySelectorAll("h1,h2,h3,h4,summary")){if(!APPENDIX_HEADING.test(text(h)))continue;const box=h.closest("section,article,details,.card,.panel")||h.parentElement;if(box&&!box.closest('[data-contextual-controls="true"]'))box.dataset.internalWorkflowControl="true"}}
function compactEventRecords(){for(const root of document.querySelectorAll('[data-contextual-controls="true"]')){root.dataset.workflowNative="true";for(const r of root.querySelectorAll('details[data-record]')){r.open=false;r.removeAttribute('open')}}}
function render(){styles();hideInternalSurfaces();compactEventRecords()}
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
document.addEventListener("click",queue,true);document.addEventListener("change",queue,true);window.addEventListener("pageshow",queue);new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});queue();
})();
