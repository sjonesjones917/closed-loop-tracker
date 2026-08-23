(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="stage-native-controls";
    const names=["workbook.module.gz.1","workbook.module.gz.2","workbook.module.gz.3"];
    const responses=await Promise.all(names.map(name=>fetch(`${name}?${cacheKey}`,{cache:"no-store"})));
    for(const response of responses)if(!response.ok)throw new Error(`Runtime load failed: HTTP ${response.status}`);
    const parts=await Promise.all(responses.map(response=>response.arrayBuffer()));
    const total=parts.reduce((sum,part)=>sum+part.byteLength,0),bytes=new Uint8Array(total);
    let offset=0;for(const part of parts){bytes.set(new Uint8Array(part),offset);offset+=part.byteLength;}
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
  const BAD_NAV=/^(?:Appendices A[–-]F|Appendix controls|Operational controls A[–-]F)$/i;
  const APPENDIX_HEADING=/^APPENDIX\s+[A-F]\s*[-–—]/i;
  const STYLE_ID="stage-native-control-style";
  const PURPOSE_ID="appendix-operational-purpose";
  const DEFINITIONS=[
    ["A","Fresh-context launch","When a fresh independent execution or review context is required, record its identity, exact frozen inputs, contamination checks, tool availability, output identity, and usability."],
    ["B","Mandatory blocker","When mandatory evidence, authority, input, capability, or a decision rule is unavailable, record the blocker, stop affected downstream work, and prohibit READY until resolution and revalidation are established."],
    ["C","Material change and invalidation","For every material change, record the responsible layer, exact change, artifact identity, downstream invalidation, and every required rerun. Historical versions remain preserved."],
    ["D","Exact final release","At release, require an ACCEPTED Stage 27 gate and exact SHA-256 plus byte-size identity between the audited artifact and the exact artifact selected for delivery."],
    ["E","New-job reset","When a different job begins, create clean job state and prevent silent inheritance of an old baseline, release decision, requirement, test, defect disposition, or job-specific evidence."],
    ["F","Agent-output receipt","Immediately after every agent response or generated artifact, preserve the exact context, inputs, output identity, files, hashes, deviations, defects or blockers, and next verification route."]
  ];
  let queued=false;

  function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
  function state(){try{return JSON.parse(localStorage.getItem(STORE)||"null")}catch{return null}}
  function records(s,letter){if(Array.isArray(s?.operationalRecords?.[letter]))return s.operationalRecords[letter];if(Array.isArray(s?.appendices?.[letter]?.records))return s.appendices[letter].records;return[]}

  function addStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");style.id=STYLE_ID;
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

  function removeDuplicateNavigation(){document.querySelectorAll("button,a,[role='button']").forEach(element=>{if(BAD_NAV.test((element.textContent||"").trim()))element.remove()})}
  function keepWorkbookSurface(event){const control=event.target.closest?.("button,a,[role='button']");if(!control||!BAD_NAV.test((control.textContent||"").trim()))return;event.preventDefault();event.stopImmediatePropagation();if("view" in globalThis)globalThis.view="workbook";if(typeof globalThis.render==="function")globalThis.render()}
  function hideStandaloneAppendixReferences(){document.querySelectorAll("h1,h2,h3,h4,summary").forEach(heading=>{if(!APPENDIX_HEADING.test((heading.textContent||"").trim()))return;if(heading.closest('[data-contextual-controls="true"]')||heading.closest(`#${PURPOSE_ID}`))return;const box=heading.closest("section,article,details,.card,.panel")||heading.parentElement;if(!box)return;box.dataset.appendixReferenceHidden="true";box.hidden=true;box.setAttribute("aria-hidden","true")})}

  function renderPurpose(){
    const master=document.getElementById("master");if(!master)return;
    let panel=document.getElementById(PURPOSE_ID);
    if(!panel){panel=document.createElement("details");panel.id=PURPOSE_ID;panel.className="card";panel.dataset.appendixOperationalPurpose="true";master.appendChild(panel)}
    const s=state();
    const rows=DEFINITIONS.map(([letter,title,meaning])=>{const list=records(s,letter),last=list[list.length-1],latest=last?(last.id||last.FRESH_CONTEXT_LAUNCH_RECORD_ID||last.BLOCKER_ID||last.CHANGE_ID||last.HASH_AUDIT_ID||last.NEW_JOB_INITIALIZATION_RECORD_ID||last.RECEIPT_ID||"recorded"):"none yet";return `<div class="appendix-row"><strong>Appendix ${letter} — ${escapeHtml(title)}</strong><div class="muted appendix-meta">${escapeHtml(meaning)}</div><div class="muted appendix-meta">Preserved records: ${list.length}. Latest: ${escapeHtml(latest)}</div></div>`}).join("");
    panel.innerHTML=`<summary><strong>APPENDIX A–F — OPERATIONAL CONTROLS</strong></summary><p class="muted">These are part of the existing 30-stage application. They are reusable event-driven controls, not six extra stages and not six permanent checklist stacks. A control appears inside the stage only when its triggering event requires a record; completed records remain preserved in the same job.</p>${rows}`;
  }

  function recordState(record){const values=[...record.querySelectorAll("[data-rfield]")].map(field=>(field.value||"").trim());const unresolved=values.filter(value=>!value||/^(?:UNKNOWN|NOT RESOLVED|NOT COMPLETE|PENDING)/i.test(value)).length;return unresolved?`${unresolved} unresolved`:"recorded"}
  function normalizeRecord(record){record.open=false;record.removeAttribute("open");record.dataset.stageNativeRecord="true";const summary=record.querySelector(":scope > summary");if(!summary)return;const raw=(summary.textContent||"").trim(),separator=raw.lastIndexOf("—"),title=(separator>=0?raw.slice(0,separator):raw).trim()||"Required workflow record",id=(separator>=0?raw.slice(separator+1):"").trim(),status=recordState(record),signature=`${title}|${id}|${status}`;if(summary.dataset.compactSignature===signature)return;summary.dataset.compactSignature=signature;summary.innerHTML=`<strong>${escapeHtml(title)}</strong>${id?` <span class="record-id">— ${escapeHtml(id)}</span>`:""}<span class="record-state">${escapeHtml(status)}</span>`}
  function compactContextualControls(){
    document.querySelectorAll('[data-integrated-operational-controls="true"]').forEach(panel=>panel.remove());
    document.querySelectorAll('[data-contextual-controls="true"]').forEach(root=>{
      root.dataset.stageNativeOperationalControls="true";
      const all=[...root.querySelectorAll("details[data-record]")];all.forEach(normalizeRecord);
      let group=root.querySelector(':scope > details[data-control-records="true"]');const direct=all.filter(record=>record.parentElement===root);
      if(!group&&direct.length){group=document.createElement("details");group.className="card";group.dataset.controlRecords="true";group.appendChild(document.createElement("summary"));root.insertBefore(group,direct[0]);direct.forEach(record=>group.appendChild(record))}
      if(group){group.open=false;group.removeAttribute("open");const count=group.querySelectorAll("details[data-record]").length,unresolved=[...group.querySelectorAll("details[data-record]")].filter(record=>recordState(record)!=="recorded").length,summary=group.querySelector(":scope > summary");if(summary){const signature=`${count}|${unresolved}`;if(summary.dataset.compactSignature!==signature){summary.dataset.compactSignature=signature;summary.innerHTML=`Required stage control records <span class="control-count">(${count}; ${unresolved} need evidence)</span>`}}}
    })
  }

  function refine(){queued=false;addStyles();removeDuplicateNavigation();hideStandaloneAppendixReferences();compactContextualControls();renderPurpose()}
  function queue(){if(queued)return;queued=true;requestAnimationFrame(refine)}
  document.addEventListener("click",keepWorkbookSurface,true);document.addEventListener("change",queue,true);window.addEventListener("storage",queue);new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});setInterval(renderPurpose,600);queue();
})();
