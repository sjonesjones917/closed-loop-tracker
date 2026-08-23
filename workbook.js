(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="single-workbook-operational-controls-and-test-project-20260823";
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
      const workbook=await import(url);
      globalThis.ClosedLoopWorkbook=workbook;
      window.dispatchEvent(new CustomEvent("closed-loop-workbook-ready"));
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

  const TEST_PANEL_ID="repository-test-project";
  const TEST_BUTTON_ID="run-repository-test-project";
  const STYLE_ID="single-workbook-test-project-style";
  const TEST_STORAGE_KEY="mclarw-repository-test-project";
  const BAD_NAV=/^(?:Appendices\s+A\s*[–—-]\s*F|Control records|Appendix controls|Operational controls\s+A\s*[–—-]\s*F|[A-F]\s+(?:FRESH AGENT CONTEXT LAUNCH CHECKLIST|UNIVERSAL BLOCKER RECORD|UNIVERSAL CHANGE AND INVALIDATION LOG|EXACT FINAL RELEASE CHECKLIST|NEW-JOB RESET CHECKLIST|UNIVERSAL AGENT-OUTPUT RECEIPT))$/i;
  const WORKBOOK_NAV=/^30\s*[–—-]\s*stage workbook$/i;
  let running=false;
  let scheduled=false;
  let latestReport=null;

  const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const normalizedText=element=>String(element?.textContent||"").replace(/\s+/g," ").trim();
  const controls=()=>[...document.querySelectorAll("button,a,[role='button']")];
  const isActive=element=>Boolean(element&&(element.classList.contains("active")||element.getAttribute("aria-current")==="page"||element.getAttribute("aria-selected")==="true"||element.getAttribute("aria-pressed")==="true"));

  function addStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      #${TEST_PANEL_ID}{margin:10px 0}
      #${TEST_PANEL_ID}>summary{cursor:pointer}
      #${TEST_PANEL_ID} .test-project-summary{margin:8px 0 0}
      #${TEST_PANEL_ID} .test-project-grid{display:grid;gap:6px;margin-top:10px}
      #${TEST_PANEL_ID} .test-project-check{border-top:1px solid #ddd;padding-top:7px}
      #${TEST_PANEL_ID} .test-project-state{font-weight:800}
      #${TEST_PANEL_ID} code{font:11px ui-monospace,monospace;overflow-wrap:anywhere}
      [data-contextual-controls="true"] details[data-record]{display:block}
      [data-contextual-controls="true"] details[data-record]>summary{cursor:pointer}
    `;
    document.head.appendChild(style);
  }

  function activateWorkbookSurface(){
    const legacyActive=controls().find(element=>BAD_NAV.test(normalizedText(element))&&isActive(element));
    if(!legacyActive)return;
    const workbook=controls().find(element=>WORKBOOK_NAV.test(normalizedText(element)));
    if(workbook)workbook.click();
    else{
      try{
        if("view" in globalThis)globalThis.view="workbook";
        if(typeof globalThis.render==="function")globalThis.render();
      }catch(error){console.error(error);}
    }
  }

  function removeDuplicateNavigation(){
    const containers=new Set();
    for(const element of controls()){
      if(!BAD_NAV.test(normalizedText(element)))continue;
      const container=element.closest(".tabs,[data-view-tabs],[role='tablist']")||element.parentElement;
      if(container)containers.add(container);
      element.remove();
    }
    for(const container of containers){
      if(!container?.isConnected)continue;
      const remaining=[...container.querySelectorAll("button,a,[role='button']")];
      if(!remaining.length||(remaining.length===1&&WORKBOOK_NAV.test(normalizedText(remaining[0]))))container.remove();
    }
  }

  function keepRequiredRecordsVisible(){
    document.querySelectorAll('[data-contextual-controls="true"] details[data-record]').forEach(record=>{
      if(!record.open)record.open=true;
      record.removeAttribute("data-stage-native-initialized");
    });
    document.querySelectorAll('[data-integrated-operational-controls="true"]').forEach(panel=>panel.remove());
    document.getElementById("appendix-operational-purpose")?.remove();
  }

  function ensureButton(){
    const toolRow=document.querySelector("header .tools");
    if(!toolRow||document.getElementById(TEST_BUTTON_ID))return;
    const button=document.createElement("button");
    button.id=TEST_BUTTON_ID;
    button.type="button";
    button.textContent="Run test project";
    button.addEventListener("click",()=>runTestProject(true));
    toolRow.appendChild(button);
  }

  function ensurePanel(){
    const master=document.getElementById("master");
    if(!master)return null;
    let panel=document.getElementById(TEST_PANEL_ID);
    if(!panel){
      panel=document.createElement("details");
      panel.id=TEST_PANEL_ID;
      panel.className="card";
      panel.open=true;
      master.insertBefore(panel,master.firstChild);
    }
    return panel;
  }

  function readStoredReport(){
    try{return JSON.parse(localStorage.getItem(TEST_STORAGE_KEY)||"null");}
    catch{return null;}
  }

  function saveReport(report){
    latestReport=report;
    try{localStorage.setItem(TEST_STORAGE_KEY,JSON.stringify(report));}
    catch(error){console.error(error);}
  }

  function renderReport(report){
    const panel=ensurePanel();
    if(!panel)return;
    const result=report?.determination||"NOT RUN";
    const checks=Array.isArray(report?.checks)?report.checks:[];
    const satisfied=checks.filter(check=>check.result==="SATISFIED").length;
    const signature=JSON.stringify([result,report?.completedAt,checks.map(check=>[check.id,check.result,check.observed])]);
    if(panel.dataset.signature===signature)return;
    panel.dataset.signature=signature;
    panel.innerHTML=`<summary><strong>TEST PROJECT — ${escapeHtml(result)}</strong></summary>
      <p class="muted">This is the deterministic test project for this existing application. It runs against an isolated in-memory workbook state and does not replace, reset, or modify the active job. The retained synthetic project evidence is <code>TEST_PROJECT.json</code>.</p>
      <div class="test-project-summary"><span class="test-project-state">${escapeHtml(result)}</span> — ${satisfied}/${checks.length||0} checks SATISFIED</div>
      <div class="muted">Repository test: <code>verify.mjs</code>. Deployment gate: <code>.github/workflows/pages.yml</code>. Last run: ${escapeHtml(report?.completedAt||"not run")}</div>
      <div class="tools"><button type="button" data-run-test-project>Run test project</button><button type="button" data-open-retained-test-project>Open retained test project</button><button type="button" data-download-test-project ${report?"":"disabled"}>Download test evidence</button></div>
      <div class="test-project-grid">${checks.map(check=>`<div class="test-project-check"><strong>${escapeHtml(check.result)} — ${escapeHtml(check.name)}</strong><div class="muted">${escapeHtml(check.observed||"")}</div></div>`).join("")}</div>`;
    panel.open=true;
    panel.querySelector("[data-run-test-project]")?.addEventListener("click",()=>runTestProject(true));
    panel.querySelector("[data-open-retained-test-project]")?.addEventListener("click",()=>window.open("TEST_PROJECT.json","_blank","noopener"));
    panel.querySelector("[data-download-test-project]")?.addEventListener("click",()=>downloadReport(report));
  }

  function downloadReport(report){
    if(!report)return;
    const blob=new Blob([JSON.stringify(report,null,2)+"\n"],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download="WORKBOOK_TEST_PROJECT_EVIDENCE.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function runTestProject(userInitiated=false){
    if(running)return;
    const workbook=globalThis.ClosedLoopWorkbook;
    if(!workbook){
      if(userInitiated)renderReport({determination:"BLOCKED",completedAt:new Date().toISOString(),checks:[{id:"TP-000",name:"Workbook runtime available",result:"UNDETERMINED",observed:"The workbook module has not finished loading."}]});
      return;
    }
    running=true;
    const checks=[];
    const record=(id,name,condition,observed)=>checks.push({id,name,result:condition?"SATISFIED":"VIOLATED",observed:String(observed??"")});
    try{
      const {
        STAGES,APPENDICES,SECTION_HEADINGS,STAGE_DECISIONS,REQUIREMENT_OUTCOMES,RELEASE_OUTCOMES,
        createBlankState,buildStagePrompt,stageHumanItems,stageGateItems,stageEvidenceItems,
        immutableRevision,invalidateDownstream,compareArtifactSets
      }=workbook;
      record("TP-001","Single application shell",document.querySelectorAll(".app").length===1,`${document.querySelectorAll(".app").length} application shell(s)`);
      record("TP-002","Exactly 30 ordered stages",Array.isArray(STAGES)&&STAGES.length===30&&STAGES.every((stage,index)=>stage.number===index+1),`${STAGES?.length??0} stages`);
      record("TP-003","Thirty distinct stage titles",new Set((STAGES||[]).map(stage=>stage.title)).size===30,`${new Set((STAGES||[]).map(stage=>stage.title)).size} distinct titles`);
      record("TP-004","Appendix control families A–F",Object.keys(APPENDICES||{}).sort().join("")==="ABCDEF",Object.keys(APPENDICES||{}).sort().join("")||"none");
      const blank=createBlankState();
      record("TP-005","Every job retains A–F record stores",Object.keys(blank?.appendices||{}).sort().join("")==="ABCDEF",Object.keys(blank?.appendices||{}).sort().join("")||"none");
      record("TP-006","Seven controlling stage sections",SECTION_HEADINGS?.length===7,`${SECTION_HEADINGS?.length??0} sections`);
      record("TP-007","Exact stage-decision vocabulary",STAGE_DECISIONS?.join("|")==="READY TO PROCEED|BLOCKED|NOT READY - CORRECTION REQUIRED",STAGE_DECISIONS?.join(" | ")||"missing");
      record("TP-008","Exact requirement-outcome vocabulary",REQUIREMENT_OUTCOMES?.join("|")==="SATISFIED|VIOLATED|UNDETERMINED",REQUIREMENT_OUTCOMES?.join(" | ")||"missing");
      record("TP-009","Exact release-outcome vocabulary",RELEASE_OUTCOMES?.join("|")==="ACCEPTED|REJECTED|BLOCKED",RELEASE_OUTCOMES?.join(" | ")||"missing");
      const controlCount=(STAGES||[]).reduce((sum,stage)=>sum+stageHumanItems(stage).length+stageGateItems(stage).length+stageEvidenceItems(stage).length,0);
      record("TP-010","At least 400 explicit workbook controls",controlCount>=400,`${controlCount} human/gate/evidence controls`);
      record("TP-011","Every stage has human, gate, and evidence controls",(STAGES||[]).every(stage=>stageHumanItems(stage).length&&stageGateItems(stage).length&&stageEvidenceItems(stage).length),"all 30 stage control groups evaluated");
      const prompts=(STAGES||[]).map(stage=>buildStagePrompt(stage,createBlankState()));
      record("TP-012","One reusable agent block per stage",prompts.length===30,`${prompts.length} copy blocks`);
      record("TP-013","Every agent block preserves role and task",prompts.every((prompt,index)=>prompt.includes(STAGES[index].role)&&prompt.includes(STAGES[index].task)),"all generated blocks compared to stage definitions");
      record("TP-014","Every agent block carries universal rules and outcomes",prompts.every(prompt=>prompt.includes("Do not invent a missing fact")&&prompt.includes("SATISFIED")&&prompt.includes("VIOLATED")&&prompt.includes("UNDETERMINED")&&prompt.includes("ACCEPTED")&&prompt.includes("REJECTED")&&prompt.includes("BLOCKED")),"all 30 generated blocks evaluated");
      const history=[];
      const first=await immutableRevision(history,{value:1},{artifactType:"TEST"});
      history.push(first.record);
      const second=await immutableRevision(history,{value:2},{artifactType:"TEST"});
      record("TP-015","Material revisions are append-only",first.record.version==="v001"&&second.record.version==="v002"&&history[0].payload.value===1,`${first.record.version} → ${second.record.version}; prior payload ${history[0].payload.value}`);
      const downstream=createBlankState();
      downstream.stages[2].decision="READY TO PROCEED";
      downstream.stages[2].status="COMPLETE";
      const invalidated=invalidateDownstream(downstream,1,"CHANGE-TEST-001");
      record("TP-016","Upstream material change invalidates downstream determinations",invalidated.length>0&&downstream.stages[2].decision==="NOT READY - CORRECTION REQUIRED",`${invalidated.length} downstream stage(s) invalidated`);
      const audited=[{artifactId:"A1",name:"artifact",size:1,sha256:"1".repeat(64)}];
      const identical=[{name:"artifact",size:1,sha256:"1".repeat(64)}];
      const different=[{name:"artifact",size:1,sha256:"2".repeat(64)}];
      record("TP-017","Accepted byte-identical artifact is authorized",compareArtifactSets(audited,identical,"ACCEPTED").authorization==="AUTHORIZED","ACCEPTED + identical bytes");
      record("TP-018","Hash mismatch stops release",compareArtifactSets(audited,different,"ACCEPTED").authorization==="NOT AUTHORIZED","ACCEPTED + mismatched hash");
      record("TP-019","Non-ACCEPTED gate stops release",compareArtifactSets(audited,identical,"BLOCKED").authorization==="NOT AUTHORIZED","BLOCKED + identical bytes");
      record("TP-020","Operational Appendix controls are integrated into the application",Boolean(document.querySelector('script[data-integrated-appendix-controls="true"]')),"integrated Appendix control runtime located in index.html");
      record("TP-021","Appendix records are stage-native and actionable",Boolean(document.querySelector('[data-contextual-controls="true"] [data-workflow-actions="true"]')),"active stage workflow actions rendered");
      record("TP-022","No static Appendix description panel replaces the controls",!document.getElementById("appendix-operational-purpose"),"static purpose panel absent");
      record("TP-023","No separate Appendix application navigation",!controls().some(element=>BAD_NAV.test(normalizedText(element))),"obsolete Appendix/control navigation absent");
      const retainedResponse=await fetch("TEST_PROJECT.json",{cache:"no-store"});
      const retained=retainedResponse.ok?await retainedResponse.json():null;
      record("TP-024","Retained test-project file is available",Boolean(retainedResponse.ok&&retained),`HTTP ${retainedResponse.status}`);
      record("TP-025","Retained test project covers all 30 stages",Array.isArray(retained?.stageEvidence)&&retained.stageEvidence.length===30,`${retained?.stageEvidence?.length??0} stage evidence records`);
      record("TP-026","Retained test-project release evidence is internally consistent",retained?.release?.releaseState==="ACCEPTED"&&retained.release.auditedSha256===retained.release.releaseSha256&&retained.release.hashesEqual===true,retained?.release?.releaseState||"missing release evidence");
    }catch(error){
      checks.push({id:"TP-999",name:"Test project execution",result:"VIOLATED",observed:error?.stack||error?.message||String(error)});
    }
    const report={
      testProject:"Mobile Closed-Loop Agent Reliability Workbook",
      application:"index.html",
      activeJobModified:false,
      completedAt:new Date().toISOString(),
      determination:checks.every(check=>check.result==="SATISFIED")?"SATISFIED":"VIOLATED",
      checks
    };
    saveReport(report);
    renderReport(report);
    running=false;
  }

  function refine(){
    scheduled=false;
    addStyles();
    activateWorkbookSurface();
    removeDuplicateNavigation();
    keepRequiredRecordsVisible();
    ensureButton();
    const stored=latestReport||readStoredReport();
    if(stored)renderReport(stored);
    else renderReport({determination:"NOT RUN",completedAt:null,checks:[]});
  }

  function queue(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(refine);
  }

  document.addEventListener("click",event=>{
    const clicked=event.target.closest("button,a,[role='button']");
    if(!clicked||!BAD_NAV.test(normalizedText(clicked)))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activateWorkbookSurface();
    queue();
  },true);
  window.addEventListener("closed-loop-workbook-ready",()=>{
    queue();
    setTimeout(()=>runTestProject(false),250);
  });
  window.addEventListener("pageshow",queue);
  window.addEventListener("storage",queue);
  document.addEventListener("change",queue,true);
  setInterval(()=>{
    if(!document.getElementById(TEST_PANEL_ID)||!document.getElementById(TEST_BUTTON_ID)||controls().some(element=>BAD_NAV.test(normalizedText(element))))queue();
  },500);
  globalThis.runClosedLoopTestProject=()=>runTestProject(true);
  queue();
})();
