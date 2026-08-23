(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="2026-08-23-stage-native-controls";
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
    try{await import(url);}finally{URL.revokeObjectURL(url);}
  }catch(error){
    console.error(error);
    const target=document.getElementById("content");
    if(target)target.textContent=`Application runtime failed to load: ${error.message}`;
  }
})();

(()=>{
  "use strict";

  const BAD_NAV=/^(?:Appendices A[–-]F|Appendix controls|Operational controls A[–-]F)$/i;
  const APPENDIX_HEADING=/^APPENDIX\s+[A-F]\s*[-–—]/i;
  const STYLE_ID="stage-native-control-style";
  let queued=false;

  function addStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      [data-contextual-controls="true"]{margin-top:12px}
      [data-contextual-controls="true"]>[data-control-records="true"]{margin:10px 0}
      [data-control-records="true"]>summary{cursor:pointer;font-weight:700}
      [data-control-records="true"] .control-count{font-weight:400;color:#666}
      [data-control-records="true"] details[data-record]{margin:8px 0;padding:10px;border:1px solid #ddd;border-radius:8px}
      [data-control-records="true"] details[data-record]>summary{cursor:pointer}
      [data-control-records="true"] details[data-record]>p.muted{display:none}
      [data-control-records="true"] .record-state{float:right;color:#666;font-size:11px;font-weight:400}
      [data-control-records="true"] .record-id{color:#666;font-weight:400}
      [data-contextual-controls="true"] [data-hash-control="true"]{margin-top:10px}
      [data-appendix-reference-hidden="true"]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function removeDuplicateNavigation(){
    document.querySelectorAll("button,a,[role='button']").forEach(element=>{
      const label=(element.textContent||"").trim();
      if(BAD_NAV.test(label))element.remove();
    });
  }

  function keepWorkbookSurface(event){
    const control=event.target.closest?.("button,a,[role='button']");
    if(!control||!BAD_NAV.test((control.textContent||"").trim()))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if("view" in globalThis)globalThis.view="workbook";
    if(typeof globalThis.render==="function")globalThis.render();
  }

  function hideStandaloneAppendixReferences(){
    document.querySelectorAll("h1,h2,h3,h4,summary").forEach(heading=>{
      if(!APPENDIX_HEADING.test((heading.textContent||"").trim()))return;
      if(heading.closest('[data-contextual-controls="true"]'))return;
      const box=heading.closest("section,article,details,.card,.panel")||heading.parentElement;
      if(!box)return;
      box.dataset.appendixReferenceHidden="true";
      box.hidden=true;
      box.setAttribute("aria-hidden","true");
    });
  }

  function recordState(record){
    const values=[...record.querySelectorAll("[data-rfield]")].map(field=>(field.value||"").trim());
    const unresolved=values.filter(value=>!value||/^(?:UNKNOWN|NOT RESOLVED|NOT COMPLETE|PENDING)/i.test(value)).length;
    return unresolved?`${unresolved} unresolved`:"recorded";
  }

  function normalizeRecord(record){
    record.open=false;
    record.removeAttribute("open");
    record.dataset.stageNativeRecord="true";
    const summary=record.querySelector(":scope > summary");
    if(summary){
      const raw=(summary.textContent||"").trim();
      const separator=raw.lastIndexOf("—");
      const title=(separator>=0?raw.slice(0,separator):raw).trim()||"Required workflow record";
      const id=(separator>=0?raw.slice(separator+1):"").trim();
      const state=recordState(record);
      const signature=`${title}|${id}|${state}`;
      if(summary.dataset.compactSignature!==signature){
        summary.dataset.compactSignature=signature;
        summary.innerHTML=`<strong>${escapeHtml(title)}</strong>${id?` <span class="record-id">— ${escapeHtml(id)}</span>`:""}<span class="record-state">${escapeHtml(state)}</span>`;
      }
    }
  }

  function escapeHtml(value){
    return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }

  function compactContextualControls(){
    document.querySelectorAll('[data-integrated-operational-controls="true"]').forEach(panel=>panel.remove());
    document.querySelectorAll('[data-contextual-controls="true"]').forEach(root=>{
      root.dataset.stageNativeOperationalControls="true";
      const records=[...root.querySelectorAll("details[data-record]")];
      records.forEach(normalizeRecord);
      let group=root.querySelector(':scope > details[data-control-records="true"]');
      const directRecords=records.filter(record=>record.parentElement===root);
      if(!group&&directRecords.length){
        group=document.createElement("details");
        group.className="card";
        group.dataset.controlRecords="true";
        const summary=document.createElement("summary");
        group.appendChild(summary);
        root.insertBefore(group,directRecords[0]);
        directRecords.forEach(record=>group.appendChild(record));
      }
      if(group){
        group.open=false;
        group.removeAttribute("open");
        const count=group.querySelectorAll("details[data-record]").length;
        const unresolved=[...group.querySelectorAll("details[data-record]")].filter(record=>recordState(record)!=="recorded").length;
        const summary=group.querySelector(":scope > summary");
        if(summary){
          const signature=`${count}|${unresolved}`;
          if(summary.dataset.compactSignature!==signature){
            summary.dataset.compactSignature=signature;
            summary.innerHTML=`Required stage control records <span class="control-count">(${count}; ${unresolved} need evidence)</span>`;
          }
        }
      }
    });
  }

  function refine(){
    queued=false;
    addStyles();
    removeDuplicateNavigation();
    hideStandaloneAppendixReferences();
    compactContextualControls();
  }

  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(refine);
  }

  document.addEventListener("click",keepWorkbookSurface,true);
  document.addEventListener("change",queue,true);
  new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});
  queue();
})();
