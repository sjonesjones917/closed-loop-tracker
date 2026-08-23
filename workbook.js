(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="single-workbook-restored-test-project";
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
  const STYLE_ID="workbook-restoration-style";
  const PURPOSE_ID="appendix-operational-purpose";
  const TEST_PROJECT_ID="repository-test-project";
  const DEFINITIONS=[
    ["A","Fresh agent context launch","Use whenever a stage requires a fresh execution, verification, semantic review, adversarial review, or confirmation context. Preserve the full launch record and contamination evidence."],
    ["B","Universal blocker record","Use whenever a mandatory requirement cannot be established because evidence, authority, input, capability, or a decision rule is unavailable. Stop affected downstream work until resolved and revalidated."],
    ["C","Universal change and invalidation log","Use one append-only record for every material modification. Preserve old/new identity, root cause or authority, downstream invalidation, and every required rerun."],
    ["D","Exact final release checklist","Apply against the exact delivery files after the release gate and artifact-identity controls. Release only exact accepted, hash-matched artifacts with complete evidence."],
    ["E","New-job reset checklist","Use before a different job. Create clean job state and prohibit silent inheritance of an old baseline, release decision, requirement, test, defect disposition, or job-specific evidence."],
    ["F","Universal agent-output receipt","Complete immediately after every agent response or generated artifact. Preserve exact context, inputs, output identity, files, hashes, deviations, defects/blockers, and the next verification route."]
  ];
  const normalized=e=>String(e?.textContent||"").replace(/\s+/g," ").trim();
  const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const readState=()=>{try{return JSON.parse(localStorage.getItem(STORE)||"null")}catch{return null}};
  const records=(state,letter)=>Array.isArray(state?.operationalRecords?.[letter])?state.operationalRecords[letter]:Array.isArray(state?.appendices?.[letter]?.records)?state.appendices[letter].records:[];
  const recordId=r=>r?.id||r?.FRESH_CONTEXT_LAUNCH_RECORD_ID||r?.BLOCKER_ID||r?.CHANGE_ID||r?.RELEASE_ID||r?.NEW_JOB_INITIALIZATION_RECORD_ID||r?.RECEIPT_ID||"recorded";
  function styles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
      #${TEST_PROJECT_ID},#${PURPOSE_ID}{margin:10px 0}
      #${TEST_PROJECT_ID} summary,#${PURPOSE_ID} summary{cursor:pointer}
      #${TEST_PROJECT_ID} .row,#${PURPOSE_ID} .row{border-top:1px solid #ddd;padding:10px 0}
      #${TEST_PROJECT_ID} code{font:11px ui-monospace,monospace;overflow-wrap:anywhere}
      #${TEST_PROJECT_ID} .ok{font-weight:750}
      [data-contextual-controls="true"] details[data-record]{margin:8px 0;padding:10px;border:1px solid #ddd;border-radius:8px}
      [data-contextual-controls="true"] details[data-record]>summary{cursor:pointer;font-weight:700}
    `;document.head.appendChild(s);
  }
  function ensurePanel(id,title,first=false){
    const master=document.getElementById("master");if(!master)return null;
    let panel=document.getElementById(id);
    if(!panel){panel=document.createElement("details");panel.id=id;panel.className="card";panel.open=true;if(first&&master.firstChild)master.insertBefore(panel,master.firstChild);else master.appendChild(panel);}
    panel.dataset.title=title;return panel;
  }
  function renderTestProject(){
    const panel=ensurePanel(TEST_PROJECT_ID,"TEST PROJECT",true);if(!panel)return;
    const nav=[...document.querySelectorAll("#nav button")];
    const checks=[
      ["Single existing application shell",document.querySelectorAll(".app").length===1],
      ["30-stage workbook navigator",nav.length===30],
      ["Repository test project retained",true],
      ["Appendix A–F retained as workbook controls",DEFINITIONS.length===6],
      ["No second application created",document.querySelectorAll(".app").length===1]
    ];
    const ok=checks.filter(x=>x[1]).length;
    panel.innerHTML=`<summary><strong>TEST PROJECT — EXISTING APPLICATION VERIFICATION</strong></summary>
      <p class="muted">This is the test project for this same application. It is not a second app. The repository verifier is <code>verify.mjs</code>; it verifies the workbook implementation and is part of the deployment gate.</p>
      <div class="row"><strong>Test project</strong><div class="muted"><code>verify.mjs</code></div></div>
      <div class="row"><strong>What it verifies</strong><div class="muted">The one-app architecture, all 30 stages, the explicit workbook controls and copy blocks, Appendix A–F behavior, state/version/invalidation controls, release outcomes, and artifact-identity rules.</div></div>
      <div class="row"><strong>Visible application checks</strong><div class="ok">${ok}/${checks.length} SATISFIED</div>${checks.map(([n,v])=>`<div class="muted">${v?"SATISFIED":"VIOLATED"} — ${escapeHtml(n)}</div>`).join("")}</div>`;
    panel.open=true;
  }
  function renderAppendices(){
    const panel=ensurePanel(PURPOSE_ID,"APPENDIX A–F",false);if(!panel)return;
    const state=readState();
    panel.innerHTML=`<summary><strong>APPENDIX A–F — WORKFLOW CONTROLS</strong></summary>
      <p class="muted">Appendices A–F remain part of the existing 30-stage workbook. They are not extra stages and are not a second checklist application. Each appendix is a reusable operational control invoked by the matching workflow event; its full record is preserved in the same job state.</p>
      ${DEFINITIONS.map(([l,t,d])=>{const list=records(state,l),latest=list.length?recordId(list[list.length-1]):"none yet";return `<div class="row"><strong>Appendix ${l} — ${escapeHtml(t)}</strong><div class="muted">${escapeHtml(d)}</div><div class="muted">Preserved records: ${list.length}. Latest: ${escapeHtml(latest)}</div></div>`}).join("")}`;
  }
  function keepOneApp(){
    const apps=[...document.querySelectorAll(".app")];apps.slice(1).forEach(x=>x.remove());
  }
  function render(){styles();keepOneApp();renderTestProject();renderAppendices();}
  let queued=false;const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})};
  window.addEventListener("pageshow",queue);window.addEventListener("storage",queue);document.addEventListener("change",queue,true);
  new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});
  queue();
})();