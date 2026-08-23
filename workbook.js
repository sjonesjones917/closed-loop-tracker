(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="single-workbook-stage-native-controls-final";
    const names=["workbook.module.gz.1","workbook.module.gz.2","workbook.module.gz.3"];
    const responses=await Promise.all(names.map(name=>fetch(`${name}?${cacheKey}`,{cache:"no-store"})));
    for(const response of responses)if(!response.ok)throw new Error(`Runtime load failed: HTTP ${response.status}`);
    const parts=await Promise.all(responses.map(response=>response.arrayBuffer()));
    const total=parts.reduce((sum,part)=>sum+part.byteLength,0),bytes=new Uint8Array(total);
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

  const STORE="mclarw";
  const BAD_NAV=/^(?:Appendices\s+A\s*[–—-]\s*F|Control records|Appendix controls|Operational controls\s+A\s*[–—-]\s*F|[A-F]\s+(?:FRESH AGENT CONTEXT LAUNCH CHECKLIST|UNIVERSAL BLOCKER RECORD|UNIVERSAL CHANGE AND INVALIDATION LOG|EXACT FINAL RELEASE CHECKLIST|NEW-JOB RESET CHECKLIST|UNIVERSAL AGENT-OUTPUT RECEIPT))$/i;
  const WORKBOOK_NAV=/^30\s*[–—-]\s*stage workbook$/i;
  const APPENDIX_HEADING=/^APPENDIX\s+[A-F]\s*[-–—]/i;
  const CONTROL_HEADING=/^(?:APPENDICES\s+A\s*[–—-]\s*F|CONTROL RECORDS|APPENDIX CONTROLS|OPERATIONAL CONTROLS\s+A\s*[–—-]\s*F)$/i;
  const STYLE_ID="stage-native-control-style";
  const PURPOSE_ID="appendix-operational-purpose";
  const DEFINITIONS=[
    ["A","Fresh-context launch","Creates the launch evidence required for each fresh independent execution, verification, semantic review, adversarial review, or confirmation context, including exact frozen inputs, contamination, tools, output identity, and usability."],
    ["B","Universal blocker","Creates the blocker record whenever mandatory evidence, authority, input, capability, or a decision rule is unavailable; affected downstream work is stopped and READY remains prohibited until resolution and revalidation are established."],
    ["C","Change and invalidation","Creates an append-only change record for every material modification, records the earliest responsible layer and exact change, invalidates affected downstream determinations, and identifies every required rerun."],
    ["D","Exact final release","After Stage 28 establishes exact artifact identity, creates the final release record and prohibits RELEASED until every required process, product, representation, evidence-chain, coverage, regression, defect, hash, custody, authorization, and delivery condition is affirmatively established."],
    ["E","New-job reset","Creates clean job state for a different job and prevents silent inheritance of an old baseline, release decision, requirement, test, defect disposition, or job-specific evidence."],
    ["F","Agent-output receipt","Creates a receipt for every agent response or generated artifact, preserving exact context, inputs, output identity, files, hashes, deviations, defects or blockers, and the next independent verification route."]
  ];
  let queued=false;
  let forcingWorkbook=false;

  const normalizedText=element=>String(element?.textContent||"").replace(/\s+/g," ").trim();
  const allControls=()=>[...document.querySelectorAll("button,a,[role='button']")];
  const workbookButton=()=>allControls().find(element=>WORKBOOK_NAV.test(normalizedText(element)));
  const isActive=element=>Boolean(element&&(element.classList.contains("active")||element.getAttribute("aria-current")==="page"||element.getAttribute("aria-selected")==="true"||element.getAttribute("aria-pressed")==="true"));
  const isVisible=element=>Boolean(element&&!element.hidden&&element.getAttribute("aria-hidden")!=="true");

  function escapeHtml(value){
    return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }

  function readState(){
    try{return JSON.parse(localStorage.getItem(STORE)||"null");}
    catch{return null;}
  }

  function appendixRecords(state,letter){
    if(Array.isArray(state?.operationalRecords?.[letter]))return state.operationalRecords[letter];
    if(Array.isArray(state?.appendices?.[letter]?.records))return state.appendices[letter].records;
    return [];
  }

  function recordId(record){
    return record?.id||
      record?.FRESH_CONTEXT_LAUNCH_RECORD_ID||
      record?.BLOCKER_ID||
      record?.CHANGE_ID||
      record?.RELEASE_ID||
      record?.HASH_AUDIT_ID||
      record?.NEW_JOB_INITIALIZATION_RECORD_ID||
      record?.RECEIPT_ID||
      "recorded";
  }

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
      #${PURPOSE_ID} .appendix-row{border-top:1px solid #ddd;padding:9px 0}
      #${PURPOSE_ID} .appendix-meta{margin-top:4px}
    `;
    document.head.appendChild(style);
  }

  function activateWorkbook(){
    const button=workbookButton();
    if(button&&!button.hidden&&!forcingWorkbook){
      forcingWorkbook=true;
      try{button.click();}
      finally{queueMicrotask(()=>{forcingWorkbook=false;queue();});}
      return true;
    }
    let changed=false;
    try{
      if("view" in globalThis&&globalThis.view!=="workbook"){
        globalThis.view="workbook";
        changed=true;
      }
    }catch{}
    if(changed&&typeof globalThis.render==="function"){
      globalThis.render();
      return true;
    }
    return false;
  }

  function obsoleteSurfaceVisible(){
    if(allControls().some(element=>BAD_NAV.test(normalizedText(element))&&isActive(element)))return true;
    const content=document.getElementById("content");
    if(!content)return false;
    return [...content.querySelectorAll("h1,h2,h3,h4,summary")].some(heading=>{
      if(heading.closest('[data-contextual-controls="true"],[data-stage-native-operational-controls="true"]'))return false;
      const value=normalizedText(heading);
      return isVisible(heading)&&(APPENDIX_HEADING.test(value)||CONTROL_HEADING.test(value));
    });
  }

  function forceWorkbookSurface(){
    if(!obsoleteSurfaceVisible())return false;
    return activateWorkbook();
  }

  function keepWorkbookSurface(event){
    const clicked=event?.target?.closest?.("button,a,[role='button']")||null;
    if(!clicked||!BAD_NAV.test(normalizedText(clicked)))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activateWorkbook();
    queue();
  }

  function removeDuplicateNavigation(){
    const containers=new Set();
    for(const element of allControls()){
      if(!BAD_NAV.test(normalizedText(element)))continue;
      const container=element.closest(".tabs,[data-view-tabs],[role='tablist']")||element.parentElement;
      if(container)containers.add(container);
      element.remove();
    }
    for(const container of containers){
      if(!container?.isConnected)continue;
      const remaining=[...container.querySelectorAll("button,a,[role='button']")].filter(isVisible);
      if(!remaining.length||(remaining.length===1&&WORKBOOK_NAV.test(normalizedText(remaining[0]))))container.remove();
    }
  }

  function hideStandaloneAppendixReferences(){
    for(const heading of document.querySelectorAll("h1,h2,h3,h4,summary")){
      const value=normalizedText(heading);
      if(!APPENDIX_HEADING.test(value)&&!CONTROL_HEADING.test(value))continue;
      if(heading.closest('[data-contextual-controls="true"],[data-stage-native-operational-controls="true"]')||heading.closest(`#${PURPOSE_ID}`))continue;
      const box=heading.closest("section,article,details,.card,.panel")||heading.parentElement;
      if(!box)continue;
      box.dataset.appendixReferenceHidden="true";
      box.hidden=true;
      box.setAttribute("aria-hidden","true");
    }
  }

  function renderPurpose(){
    const master=document.getElementById("master");
    if(!master)return;
    let panel=document.getElementById(PURPOSE_ID);
    if(!panel){
      panel=document.createElement("details");
      panel.id=PURPOSE_ID;
      panel.className="card";
      panel.dataset.appendixOperationalPurpose="true";
      master.appendChild(panel);
    }
    const state=readState();
    const rows=DEFINITIONS.map(([letter,title,meaning])=>{
      const list=appendixRecords(state,letter);
      const latest=list.length?recordId(list[list.length-1]):"none yet";
      return {letter,title,meaning,count:list.length,latest};
    });
    const signature=JSON.stringify(rows.map(({letter,count,latest})=>[letter,count,latest]));
    if(panel.dataset.renderSignature===signature)return;
    const wasOpen=panel.open;
    panel.dataset.renderSignature=signature;
    panel.innerHTML=`<summary><strong>APPENDIX A–F — OPERATIONAL CONTROLS</strong></summary><p class="muted">Appendices A–F are retained inside this existing 30-stage application as reusable event-driven controls. They are not extra stages and not permanent checklist stacks. The matching control creates, enforces, or preserves the required record only when its workflow event occurs.</p>${rows.map(({letter,title,meaning,count,latest})=>`<div class="appendix-row"><strong>Appendix ${letter} — ${escapeHtml(title)}</strong><div class="muted appendix-meta">${escapeHtml(meaning)}</div><div class="muted appendix-meta">Preserved records: ${count}. Latest: ${escapeHtml(latest)}</div></div>`).join("")}`;
    panel.open=wasOpen;
  }

  function recordState(record){
    const values=[...record.querySelectorAll("[data-rfield]")].map(field=>(field.value||"").trim());
    const unresolved=values.filter(value=>!value||/^(?:UNKNOWN|NOT RESOLVED|NOT COMPLETE|PENDING)/i.test(value)).length;
    return unresolved?`${unresolved} unresolved`:"recorded";
  }

  function normalizeRecord(record){
    if(record.dataset.stageNativeInitialized!=="true"){
      record.open=false;
      record.removeAttribute("open");
      record.dataset.stageNativeInitialized="true";
    }
    record.dataset.stageNativeRecord="true";
    const summary=record.querySelector(":scope > summary");
    if(!summary)return;
    const raw=normalizedText(summary);
    const separator=raw.lastIndexOf("—");
    const title=(separator>=0?raw.slice(0,separator):raw).trim()||"Required workflow record";
    const id=(separator>=0?raw.slice(separator+1):"").trim();
    const status=recordState(record);
    const signature=`${title}|${id}|${status}`;
    if(summary.dataset.compactSignature===signature)return;
    summary.dataset.compactSignature=signature;
    summary.innerHTML=`<strong>${escapeHtml(title)}</strong>${id?` <span class="record-id">— ${escapeHtml(id)}</span>`:""}<span class="record-state">${escapeHtml(status)}</span>`;
  }

  function compactContextualControls(){
    document.querySelectorAll('[data-integrated-operational-controls="true"]').forEach(panel=>panel.remove());
    document.querySelectorAll('[data-contextual-controls="true"]').forEach(root=>{
      root.dataset.stageNativeOperationalControls="true";
      const all=[...root.querySelectorAll("details[data-record]")];
      all.forEach(normalizeRecord);
      let group=root.querySelector(':scope > details[data-control-records="true"]');
      const direct=all.filter(record=>record.parentElement===root);
      if(!group&&direct.length){
        group=document.createElement("details");
        group.className="card";
        group.dataset.controlRecords="true";
        group.dataset.stageNativeInitialized="true";
        group.appendChild(document.createElement("summary"));
        root.insertBefore(group,direct[0]);
        direct.forEach(record=>group.appendChild(record));
      }
      if(group){
        if(group.dataset.stageNativeInitialized!=="true"){
          group.open=false;
          group.removeAttribute("open");
          group.dataset.stageNativeInitialized="true";
        }
        const count=group.querySelectorAll("details[data-record]").length;
        const unresolved=[...group.querySelectorAll("details[data-record]")]
          .filter(record=>recordState(record)!=="recorded").length;
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
    forceWorkbookSurface();
    removeDuplicateNavigation();
    hideStandaloneAppendixReferences();
    compactContextualControls();
    renderPurpose();
  }

  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(refine);
  }

  document.addEventListener("click",keepWorkbookSurface,true);
  document.addEventListener("change",queue,true);
  window.addEventListener("pageshow",queue);
  window.addEventListener("popstate",queue);
  window.addEventListener("storage",queue);
  new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","hidden","aria-current","aria-selected","aria-pressed"]});
  queue();
})();
