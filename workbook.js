(async()=>{
  "use strict";

  const STORE="mclarw";
  const USER_BACKUP_STORE="mclarw-user-job-backup-v1";
  const TEST_PROJECT_FILE="TEST_PROJECT.json";
  const CACHE_KEY="human-workbook-event-controls-20260823-r3";
  const RUNTIME_PARTS=["workbook.module.gz.1","workbook.module.gz.2","workbook.module.gz.3"];
  const LETTERS=["A","B","C","D","E","F"];
  const FRESH_STAGES=new Set([9,11,12,13,14,15,17,19,21,22,23,24,25,26,27,28,29,30]);
  const FIELD_ID={A:"FRESH_CONTEXT_LAUNCH_RECORD_ID",B:"BLOCKER_ID",C:"CHANGE_ID",D:"RELEASE_ID",E:"NEW_JOB_INITIALIZATION_RECORD_ID",F:"RECEIPT_ID"};
  const MIRROR={A:"freshContextLaunches",B:"blockers",C:"changes",D:"finalReleaseRecords",E:"newJobResets",F:"agentOutputReceipts"};
  const TITLES={A:"Fresh run or review",B:"Blocker",C:"Material change",D:"Final release",E:"New-job reset",F:"Received output"};
  const BAD_NAV=/^(?:Appendices\s+A\s*[–—-]\s*F|Control records|Appendix controls|Operational controls\s+A\s*[–—-]\s*F|[A-F]\s+(?:FRESH AGENT CONTEXT LAUNCH CHECKLIST|UNIVERSAL BLOCKER RECORD|UNIVERSAL CHANGE AND INVALIDATION LOG|EXACT FINAL RELEASE CHECKLIST|NEW-JOB RESET CHECKLIST|UNIVERSAL AGENT-OUTPUT RECEIPT))$/i;
  const WORKBOOK_NAV=/^30\s*[–—-]\s*stage workbook$/i;
  const APPENDIX_HEADING=/^(?:APPENDIX(?:ES)?\s+A\s*[–—-]\s*F|APPENDIX\s+[A-F]\s*[-–—])/i;

  let workbook=null;
  let scheduled=false;
  let painting=false;
  let writeQueue=Promise.resolve();
  let lastCreatedRecordId="";
  let beforeResetState=null;

  const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const normalizedText=element=>String(element?.textContent||"").replace(/\s+/g," ").trim();
  const now=()=>new Date().toISOString();
  const pad=number=>String(number).padStart(2,"0");
  const titleCase=key=>String(key).toLowerCase().replace(/_/g," ").replace(/\b\w/g,char=>char.toUpperCase());

  function notice(message,kind=""){
    const target=document.getElementById("appNotice");
    if(!target)return;
    target.textContent=message||"";
    target.className=message?`show ${kind}`.trim():"";
  }

  function failRuntime(error){
    console.error(error);
    const target=document.getElementById("content");
    if(target)target.innerHTML=`<div class="runtimeFailure"><strong>Application runtime failed to load.</strong>\n${escapeHtml(error?.message||String(error))}</div>`;
    notice("Application runtime failed to load.","bad");
  }

  async function loadWorkbookModule(){
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const responses=await Promise.all(RUNTIME_PARTS.map(name=>fetch(`${name}?${CACHE_KEY}`,{cache:"no-store"})));
    for(const response of responses)if(!response.ok)throw new Error(`Runtime load failed: HTTP ${response.status}`);
    const parts=await Promise.all(responses.map(response=>response.arrayBuffer()));
    const total=parts.reduce((sum,part)=>sum+part.byteLength,0);
    const bytes=new Uint8Array(total);
    let offset=0;
    for(const part of parts){bytes.set(new Uint8Array(part),offset);offset+=part.byteLength;}
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const source=await new Response(stream).text();
    const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));
    try{return await import(url);}
    finally{URL.revokeObjectURL(url);}
  }

  function readRawState(){
    try{return localStorage.getItem(STORE);}
    catch{return null;}
  }

  function readState(){
    try{return normalizeState(JSON.parse(localStorage.getItem(STORE)||"null"));}
    catch{return null;}
  }

  function recordId(letter,record){
    return String(record?.id||record?.[FIELD_ID[letter]]||"");
  }

  function normalizeState(state){
    if(!state||typeof state!=="object")return null;
    state.job=state.job&&typeof state.job==="object"?state.job:{};
    state.appendices=state.appendices&&typeof state.appendices==="object"?state.appendices:{};
    state.operationalRecords=state.operationalRecords&&typeof state.operationalRecords==="object"?state.operationalRecords:{};
    state.releaseIdentityRecords=Array.isArray(state.releaseIdentityRecords)?state.releaseIdentityRecords:[];
    for(const letter of LETTERS){
      state.appendices[letter]=state.appendices[letter]&&typeof state.appendices[letter]==="object"?state.appendices[letter]:{check:[],record:"",records:[]};
      state.appendices[letter].records=Array.isArray(state.appendices[letter].records)?state.appendices[letter].records:[];
      state.operationalRecords[letter]=Array.isArray(state.operationalRecords[letter])?state.operationalRecords[letter]:[];
      state[MIRROR[letter]]=Array.isArray(state[MIRROR[letter]])?state[MIRROR[letter]]:[];
      const merged=[state.operationalRecords[letter],state.appendices[letter].records,state[MIRROR[letter]]];
      for(const source of merged){
        for(const record of source){
          const id=recordId(letter,record);
          if(id&&!state.operationalRecords[letter].some(item=>recordId(letter,item)===id))state.operationalRecords[letter].push(record);
        }
      }
      for(const record of state.operationalRecords[letter]){
        const id=recordId(letter,record);
        if(id&&!state.appendices[letter].records.some(item=>recordId(letter,item)===id))state.appendices[letter].records.push(record);
        if(id&&!state[MIRROR[letter]].some(item=>recordId(letter,item)===id))state[MIRROR[letter]].push(record);
      }
    }
    return state;
  }

  function stageEntries(state){
    const stages=state?.stages;
    if(Array.isArray(stages))return stages.map((stage,index)=>[Number(stage?.number||index+1),stage]).filter(([,stage])=>stage);
    if(stages&&typeof stages==="object")return Object.entries(stages).map(([key,stage])=>[Number(stage?.number||key),stage]).filter(([number,stage])=>Number.isFinite(number)&&stage);
    return [];
  }

  function stageAt(state,number){
    return stageEntries(state).find(([candidate])=>candidate===Number(number))?.[1]||null;
  }

  function activeStageNumber(state){
    const activeButton=[...document.querySelectorAll("#nav button")].find(button=>button.classList.contains("active")||button.getAttribute("aria-current")==="step"||button.getAttribute("aria-pressed")==="true");
    const activeMatch=activeButton?.textContent?.match(/\b(\d{1,2})\b/);
    if(activeMatch)return Number(activeMatch[1]);
    const stored=Number(state?.job?.currentStage??state?.currentStage);
    return stored>=1&&stored<=30?stored:1;
  }

  function jobId(state){
    return String(state?.job?.id||state?.job?.JOB_ID||state?.jobId||"UNKNOWN");
  }

  function versions(state){
    const job=state?.job||{};
    return {
      input:job.inputVersion||job.CURRENT_INPUT_VERSION||"UNKNOWN",
      source:job.sourceSetVersion||job.CURRENT_SOURCE_SET_VERSION||"UNKNOWN",
      requirements:job.requirementsVersion||job.CURRENT_REQUIREMENTS_VERSION||"UNKNOWN",
      tests:job.testSuiteVersion||job.CURRENT_TEST_SUITE_VERSION||"UNKNOWN",
      instruction:job.instructionVersion||job.CURRENT_INSTRUCTION_VERSION||"UNKNOWN",
      tools:job.toolConfigurationVersion||job.TOOL_CONFIGURATION_VERSION||"UNKNOWN"
    };
  }

  function nextId(state,letter,prefix){
    const used=new Set(state.operationalRecords[letter].map(record=>recordId(letter,record)));
    let number=state.operationalRecords[letter].length+1;
    let id="";
    do{id=`${prefix}-${String(number++).padStart(3,"0")}`;}while(used.has(id));
    return id;
  }

  function appendRecord(state,letter,record){
    normalizeState(state);
    const id=recordId(letter,record)||nextId(state,letter,letter);
    record.id=id;
    record[FIELD_ID[letter]]=record[FIELD_ID[letter]]||id;
    for(const target of [state.operationalRecords[letter],state.appendices[letter].records,state[MIRROR[letter]]]){
      if(!target.some(item=>recordId(letter,item)===id))target.push(record);
    }
    lastCreatedRecordId=id;
    return record;
  }

  function replaceRecord(state,letter,id,record){
    record.id=id;
    record[FIELD_ID[letter]]=record[FIELD_ID[letter]]||id;
    for(const target of [state.operationalRecords[letter],state.appendices[letter].records,state[MIRROR[letter]]]){
      const index=target.findIndex(item=>recordId(letter,item)===id);
      if(index>=0)target[index]=record;
    }
  }

  async function importState(state,filename="WORKBOOK.json"){
    const payload=JSON.stringify(state);
    localStorage.setItem(STORE,payload);
    if(typeof globalThis.importProject==="function"){
      const input={files:[new File([payload],filename,{type:"application/json"})],value:""};
      const result=globalThis.importProject(input);
      if(result&&typeof result.then==="function")await result;
    }else if(typeof globalThis.render==="function"){
      globalThis.render();
    }
    setTimeout(schedulePaint,80);
  }

  function writeState(state){
    const snapshot=JSON.parse(JSON.stringify(state));
    writeQueue=writeQueue.then(()=>importState(snapshot)).catch(error=>{
      console.error(error);
      notice(`Could not save the workbook: ${error.message}`,"bad");
    }).finally(()=>{setTimeout(schedulePaint,100);});
  }

  function transact(operation){
    const state=readState();
    if(!state)return;
    const result=operation(state);
    if(result!==false)writeState(state);
  }

  function invalidateAfter(state,number,controlId){
    const affected=[];
    for(const [stageNumber,stage] of stageEntries(state)){
      if(stageNumber<=number)continue;
      stage.invalidations=Array.isArray(stage.invalidations)?stage.invalidations:[];
      stage.invalidations.push({controlId,invalidatedAt:now(),previousStatus:stage.status||"NOT STARTED",previousDecision:stage.decision||"NOT READY - CORRECTION REQUIRED"});
      stage.status="NOT STARTED";
      stage.decision="NOT READY - CORRECTION REQUIRED";
      stage.invalidatedBy=controlId;
      affected.push(`STAGE ${pad(stageNumber)}`);
    }
    return affected;
  }

  function freshContextRecord(state,number){
    const v=versions(state);
    const id=nextId(state,"A","CONTEXT");
    return appendRecord(state,"A",{id,FRESH_CONTEXT_LAUNCH_RECORD_ID:id,JOB_ID:jobId(state),STAGE:`STAGE ${pad(number)}`,ROLE:`STAGE ${pad(number)} INDEPENDENT CONTEXT`,ITERATION_ID:state.job?.currentIteration||"NOT APPLICABLE",RUN_ID:"NOT APPLICABLE",CONTEXT_ID:"UNKNOWN",CONTEXT_NAME:`${jobId(state)}__STAGE-${pad(number)}__FRESH`,CONTEXT_START_DATE_AND_TIME:now(),STAGE_COPY_BLOCK_VERSION_OR_HASH:"UNKNOWN",AUTHORIZED_FILES_AND_VERSIONS_ATTACHED:"UNKNOWN",FROZEN_INPUT_VERSION:v.input,FROZEN_SOURCE_SET_VERSION:v.source,FROZEN_REQUIREMENTS_VERSION:v.requirements,FROZEN_INSTRUCTION_VERSION:v.instruction,FROZEN_TEST_SUITE_VERSION:v.tests,FROZEN_TOOL_CONFIGURATION_VERSION:v.tools,OTHER_RUN_OUTPUT_VISIBLE:"UNKNOWN",REVIEWER_COMMENT_VISIBLE:"UNKNOWN",PRIOR_FAILURE_EXPLANATION_VISIBLE:"UNKNOWN",PROPOSED_CORRECTION_VISIBLE:"UNKNOWN",REQUIRED_TOOLS_AVAILABLE:"UNKNOWN",EXECUTION_DEVIATIONS:"NONE",OUTPUT_ID:"UNKNOWN",OUTPUT_FILENAME:"UNKNOWN",OUTPUT_VERSION:"UNKNOWN",OUTPUT_SHA256:"UNKNOWN",CONTEXT_CONTAMINATED:"UNKNOWN",DEFECT_ID:"NONE",RUN_USABLE:"UNKNOWN",CONTROLLING_EVIDENCE:"UNKNOWN",STATUS:"PENDING COMPLETION"});
  }

  function receiptRecord(state,number){
    const v=versions(state);
    const id=nextId(state,"F","RECEIPT");
    return appendRecord(state,"F",{id,RECEIPT_ID:id,JOB_ID:jobId(state),STAGE:`STAGE ${pad(number)}`,AGENT_ROLE:`STAGE ${pad(number)} ASSIGNED AGENT`,AGENT_OR_SYSTEM_IDENTIFIER:"UNKNOWN",CONTEXT_ID:"UNKNOWN",ITERATION_ID:state.job?.currentIteration||"NOT APPLICABLE",RUN_ID:"NOT APPLICABLE",REQUEST_DATE_AND_TIME:"UNKNOWN",RESPONSE_DATE_AND_TIME:now(),COPY_BLOCK_VERSION_OR_HASH:"UNKNOWN",INPUT_VERSIONS:v.input,SOURCE_SET_VERSION:v.source,REQUIREMENTS_VERSION:v.requirements,INSTRUCTION_VERSION:v.instruction,TEST_SUITE_VERSION:v.tests,TOOL_CONFIGURATION_VERSION:v.tools,OUTPUT_ARTIFACT_ID:"UNKNOWN",OUTPUT_VERSION:"UNKNOWN",OUTPUT_FILES:"UNKNOWN",OUTPUT_HASHES:"UNKNOWN",COMPLETE_RESPONSE_SAVED:"UNKNOWN",AGENT_CLAIMED_COMPLETION:"UNKNOWN",INDEPENDENT_COMPLETION_ESTABLISHED:"UNKNOWN",TRUNCATION_DETECTED:"UNKNOWN",REFUSAL_OR_PARTIAL_REFUSAL:"UNKNOWN",TOOL_FAILURES:"NONE",MISSING_OR_UNREADABLE_ATTACHMENTS:"NONE",MALFORMED_OUTPUT_FILES:"NONE",OTHER_DEVIATIONS:"NONE",DEFECT_IDS:"NONE",BLOCKER_IDS:"NONE",NEXT_REQUIRED_VERIFICATION_STAGE:number<30?`STAGE ${pad(number+1)}`:"STAGE 30",RECEIPT_COMPLETED_BY:"UNKNOWN",RECEIPT_EVIDENCE:"UNKNOWN",STATUS:"PENDING COMPLETION"});
  }

  function blockerRecord(state,number){
    const id=nextId(state,"B","BLOCKER");
    const affected=invalidateAfter(state,number,id);
    const stage=stageAt(state,number);
    if(stage){stage.status="BLOCKED";stage.decision="BLOCKED";}
    state.job.currentState="BLOCKED";
    state.job.blockers=[...(String(state.job.blockers||"").split(/\s*,\s*/).filter(value=>value&&value!=="NONE")),id].join(", ");
    return appendRecord(state,"B",{id,BLOCKER_ID:id,JOB_ID:jobId(state),DATE_OPENED:now(),CURRENT_STATUS:"OPEN",STAGE_DISCOVERED:`STAGE ${pad(number)}`,AFFECTED_REQ_IDS:"UNKNOWN",AFFECTED_TEST_IDS:"NONE",AFFECTED_ARTIFACTS_AND_VERSIONS:"UNKNOWN",MISSING_ITEM_TYPE:"OTHER",MISSING_EVIDENCE_AUTHORITY_INPUT_OR_CAPABILITY:"UNKNOWN",WHY_MANDATORY_SATISFACTION_CANNOT_BE_ESTABLISHED:stage?.decisionEvidence||stage?.evidence||"UNKNOWN",KNOWN_SOURCE_OR_OWNER_OF_MISSING_ITEM:"UNKNOWN",ATTEMPTS_TO_RESOLVE:"NONE",AVAILABLE_RESOLUTION_PATH:"UNKNOWN",DOWNSTREAM_WORK_STOPPED:affected.join(", ")||"NONE",BLOCKER_OWNER:state.job?.owner||"UNKNOWN",TARGET_RESOLUTION_DATE:"UNKNOWN",RESOLUTION:"NOT RESOLVED",RESOLUTION_EVIDENCE:"NOT RESOLVED",DATE_RESOLVED:"NOT RESOLVED",REQUIREMENTS_AND_TESTS_REEVALUATED:"NOT RESOLVED",DOWNSTREAM_VALIDATION_RERUN:"NOT RESOLVED",CLOSURE_AUTHORIZED_BY:"NOT RESOLVED",STATUS:"PENDING COMPLETION"});
  }

  function changeRecord(state,number){
    const stage=stageAt(state,number);
    const id=nextId(state,"C","CHANGE");
    const affected=invalidateAfter(state,number,id);
    return appendRecord(state,"C",{id,CHANGE_ID:id,STAGE:`STAGE ${pad(number)}`,DATE_AND_TIME:now(),JOB_ID:jobId(state),ITERATION_ID:state.job?.currentIteration||"NOT APPLICABLE",TRIGGER:"OTHER",EARLIEST_RESPONSIBLE_LAYER:"UNKNOWN",AFFECTED_ARTIFACT_ID:"UNKNOWN",OLD_VERSION:"UNKNOWN",OLD_SHA256:"UNKNOWN",NEW_VERSION:"UNKNOWN",NEW_SHA256:"UNKNOWN",EXACT_CHANGE:"UNKNOWN",REASON:"UNKNOWN",ROOT_CAUSE_ID_OR_AUTHORITY:"UNKNOWN",MATERIAL_CHANGE:"TRUE",DOWNSTREAM_ARTIFACTS_INVALIDATED:affected.join(", ")||"NONE",DOWNSTREAM_DETERMINATIONS_INVALIDATED:affected.join(", ")||"NONE",TESTS_TO_RERUN:"UNKNOWN",ITERATIONS_TO_RERUN:"UNKNOWN",AUDITS_TO_RERUN:"UNKNOWN",RELEASE_GATE_MUST_BE_RERUN:"UNKNOWN",HASH_IDENTITY_MUST_BE_RERUN:"UNKNOWN",AUTHORIZED_BY:"UNKNOWN",CHANGE_IMPLEMENTED_BY:"UNKNOWN",IMPLEMENTATION_EVIDENCE:stage?.decisionEvidence||stage?.evidence||"UNKNOWN",REVALIDATION_COMPLETE:"FALSE",REVALIDATION_EVIDENCE:"NOT COMPLETE",CHANGE_STATUS:"OPEN",STATUS:"PENDING COMPLETION"});
  }

  function resetRecord(state,oldState){
    const id=nextId(state,"E","RESET");
    return appendRecord(state,"E",{id,NEW_JOB_INITIALIZATION_RECORD_ID:id,STAGE:"STAGE 01",NEW_JOB_ID:jobId(state),NEW_JOB_TITLE:state.job?.title||"UNKNOWN",JOB_OWNER:state.job?.owner||"UNKNOWN",DATE_OPENED:state.job?.dateOpened||now(),MASTER_TEMPLATE_VERSION:"CURRENT APPLICATION",MASTER_TEMPLATE_SHA256:"NOT CALCULATED",NEW_WORKBOOK_FILENAME:`${jobId(state)}__WORKBOOK.json`,NEW_WORKBOOK_VERSION:"v001",NEW_FOLDER_ROOT:"UNKNOWN",SUPPLIED_INPUT_FILES:"UNKNOWN",SUPPLIED_INPUT_HASHES:"UNKNOWN",EXACT_USER_REQUEST_CAPTURED_IN_STAGE_01:"UNKNOWN",OLD_JOB_MATERIAL_REUSED:"FALSE",OLD_JOB_ID:oldState?.job?.id||oldState?.job?.JOB_ID||"NONE",ARTIFACT_ID:"NONE",ARTIFACT_VERSION:"NONE",ARTIFACT_SHA256:"NONE",AUTHORITY_FOR_REUSE:"NONE",APPLICABILITY_REESTABLISHED_FOR_NEW_JOB:"NOT APPLICABLE",OLD_BASELINE_STATUS_CARRIED_FORWARD:"FALSE",OLD_RELEASE_DECISION_CARRIED_FORWARD:"FALSE",OLD_REQUIREMENT_OR_TEST_CARRIED_FORWARD_WITHOUT_REVALIDATION:"FALSE",NEW_JOB_START_STAGE:"STAGE 01",RESET_COMPLETED_BY:state.job?.owner||"UNKNOWN",RESET_DATE_AND_TIME:now(),RESET_EVIDENCE:`Clean reset from ${oldState?.job?.id||oldState?.job?.JOB_ID||"UNKNOWN"}; prior baseline and release state were not carried forward.`,STATUS:"PENDING COMPLETION"});
  }

  function openBlockers(state,number){
    return state.operationalRecords.B.filter(record=>String(record.CURRENT_STATUS||"").toUpperCase()==="OPEN"&&String(record.STAGE_DISCOVERED||"").includes(pad(number)));
  }

  function recordsForStage(state,number){
    const result=[];
    for(const letter of LETTERS){
      for(const record of state.operationalRecords[letter]){
        const stageText=String(record.STAGE||record.STAGE_DISCOVERED||"");
        const match=stageText.match(/\b(\d{1,2})\b/);
        const belongs=(match&&Number(match[1])===number)||(!match&&letter==="E"&&number===1)||(!match&&letter==="D"&&number===30);
        if(belongs)result.push([letter,record]);
      }
    }
    return result;
  }

  function fieldOptions(key,value){
    const upper=String(value??"").toUpperCase();
    if(["TRUE","FALSE","UNKNOWN"].includes(upper))return ["UNKNOWN","TRUE","FALSE"];
    if(key==="CURRENT_STATUS")return ["OPEN","RESOLVED","SUPERSEDED"];
    if(key==="FINAL_RELEASE_STATUS")return ["NOT RELEASED","RELEASED"];
    if(key==="RELEASE_GATE_STATE")return ["BLOCKED","REJECTED","ACCEPTED"];
    if(key==="MISSING_ITEM_TYPE")return ["EVIDENCE","AUTHORITY","INPUT","CAPABILITY","DECISION_RULE","OTHER"];
    if(key==="CHANGE_STATUS")return ["OPEN","IMPLEMENTED_NOT_REVALIDATED","CLOSED_REVALIDATED","BLOCKED"];
    return null;
  }

  function fieldControl(key,value){
    const safeKey=escapeHtml(key);
    const safeValue=escapeHtml(value??"");
    const options=fieldOptions(key,value);
    if(options)return `<select data-rfield="${safeKey}">${options.map(option=>`<option${String(option)===String(value)?" selected":""}>${escapeHtml(option)}</option>`).join("")}</select>`;
    const long=String(value??"").includes("\n")||String(value??"").length>72||/(EVIDENCE|REASON|DESCRIPTION|CONTENTS|ACTIONS|ARTIFACTS|REQUIREMENTS|VALIDATION|FILES|VERSIONS|PROCEDURE|CHANGE|FAILURE|DEVIATIONS)/.test(key);
    return long?`<textarea data-rfield="${safeKey}">${safeValue}</textarea>`:`<input data-rfield="${safeKey}" value="${safeValue}">`;
  }

  function recordEditor(letter,record){
    const id=recordId(letter,record);
    const fields=Object.entries(record).filter(([key])=>key!=="id"&&key!=="STATUS");
    const status=String(record.STATUS||"PENDING COMPLETION").replace(/_/g," ");
    return `<details class="eventRecord" data-record="${escapeHtml(id)}"><summary><strong>${escapeHtml(TITLES[letter])}</strong> — ${escapeHtml(id)} <span class="recordState">${escapeHtml(status)}</span></summary><div class="eventRecordBody"><p class="muted">Created because this workflow event occurred. Complete the evidence here.</p>${fields.map(([key,value])=>`<label>${escapeHtml(titleCase(key))}</label>${fieldControl(key,value)}`).join("")}<div class="inlineButtons"><button class="primary" type="button" data-save-record="${letter}" data-record-id="${escapeHtml(id)}">Save record</button></div></div></details>`;
  }

  function stageControls(state,number){
    const records=recordsForStage(state,number);
    const actions=[];
    if(FRESH_STAGES.has(number))actions.push(`<button type="button" data-add-fresh>Start fresh run/review</button>`);
    actions.push(`<button type="button" data-add-receipt>Record received output</button>`,`<button type="button" data-open-blocker>Record blocker</button>`,`<button type="button" data-add-change>Record material change</button>`);
    let html=`<section class="eventActions" data-workflow-actions="true"><h3>When something happens in this stage</h3><p class="muted">Create a record only for an event that actually occurred.</p><div class="eventActionGrid">${actions.join("")}</div></section>`;
    if(records.length)html+=`<details class="card" data-event-records><summary>Stage event records (${records.length})</summary><div style="margin-top:10px">${records.map(([letter,record])=>recordEditor(letter,record)).join("")}</div></details>`;
    if(number===28)html+=`<section class="releaseIdentity" data-hash-control="true"><h3>Verify release files</h3><p class="muted">Select the exact audited file and the exact file selected for delivery. Delivery remains stopped unless the release gate is ACCEPTED and both size and SHA-256 match exactly.</p><label>Stage 27 release state</label><select data-gate-state><option>BLOCKED</option><option>REJECTED</option><option>ACCEPTED</option></select><label>Audited file</label><input type="file" data-audited><label>File selected for delivery</label><input type="file" data-release><div class="inlineButtons"><button class="primary" type="button" data-compare-hash>Compare exact bytes</button></div></section>`;
    return html;
  }

  function badValue(value){return !value||["UNKNOWN","NOT RESOLVED","NOT COMPLETE","PENDING COMPLETION"].includes(String(value).trim().toUpperCase());}
  function hundred(value){const normalized=String(value??"").trim().replace(/\s+/g,"");return /100(?:\.0+)?%/.test(normalized)||/^100(?:\.0+)?$/.test(normalized)||/^1(?:\.0+)?$/.test(normalized);}
  function zero(value){return Number(String(value??"").trim())===0;}
  function releaseReady(record){return String(record.RELEASE_GATE_STATE).toUpperCase()==="ACCEPTED"&&[record.PROCESS_AUDIT_VERSION_AND_DETERMINATION,record.PRODUCT_AUDIT_VERSION_AND_DETERMINATION,record.REPRESENTATION_AUDIT_VERSION_AND_DETERMINATION,record.EVIDENCE_CHAIN_VERSION_AND_DETERMINATION,record.HASH_AUDIT_ID_AND_DETERMINATION].every(value=>/SATISFIED/i.test(String(value||"")))&&[record.MANDATORY_REQUIREMENT_COVERAGE,record.MANDATORY_VERIFICATION_COVERAGE,record.REGRESSION_TEST_SUCCESS].every(hundred)&&[record.CRITICAL_DEFECTS,record.MAJOR_DEFECTS,record.MANDATORY_UNRESOLVED_UNKNOWNS,record.CORRECTNESS_AFFECTING_CONTRADICTIONS,record.CORRECTNESS_AFFECTING_AMBIGUITIES,record.UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE].every(zero)&&String(record.HASHES_IDENTICAL).toUpperCase()==="TRUE"&&String(record.ALL_EVIDENCE_FAILURES_DEFECTS_REGRESSIONS_AUDIT_AND_HASH_LOGS_PRESERVED).toUpperCase()==="TRUE"&&String(record.ONLY_EXACT_ACCEPTED_HASH_MATCHED_ARTIFACTS_DELIVERED).toUpperCase()==="TRUE"&&String(record.DELIVERY_CONFIRMED).toUpperCase()==="TRUE";}
  async function sha256(file){const digest=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");}

  function finalReleaseRecord(state,hashId,audited,release,auditedHash,releaseHash){
    const id=nextId(state,"D","RELEASE");
    return appendRecord(state,"D",{id,RELEASE_ID:id,STAGE:"STAGE 30",JOB_ID:jobId(state),PRODUCT_ID:state.job?.productId||"UNKNOWN",PRODUCT_VERSION:"UNKNOWN",BASELINE_ID:state.job?.baselineId||"UNKNOWN",RELEASE_GATE_ID:"UNKNOWN",RELEASE_GATE_STATE:"ACCEPTED",PROCESS_AUDIT_VERSION_AND_DETERMINATION:"UNKNOWN",PRODUCT_AUDIT_VERSION_AND_DETERMINATION:"UNKNOWN",REPRESENTATION_AUDIT_VERSION_AND_DETERMINATION:"UNKNOWN",EVIDENCE_CHAIN_VERSION_AND_DETERMINATION:"UNKNOWN",HASH_AUDIT_ID_AND_DETERMINATION:`${hashId} — SATISFIED`,MANDATORY_REQUIREMENT_COVERAGE:"UNKNOWN",MANDATORY_VERIFICATION_COVERAGE:"UNKNOWN",REGRESSION_TEST_SUCCESS:"UNKNOWN",CRITICAL_DEFECTS:"UNKNOWN",MAJOR_DEFECTS:"UNKNOWN",MANDATORY_UNRESOLVED_UNKNOWNS:"UNKNOWN",CORRECTNESS_AFFECTING_CONTRADICTIONS:"UNKNOWN",CORRECTNESS_AFFECTING_AMBIGUITIES:"UNKNOWN",UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE:"UNKNOWN",ARTIFACT_ID:"UNKNOWN",EXACT_FILENAME:release.name,ARTIFACT_PRODUCT_VERSION:"UNKNOWN",FILE_SIZE_BYTES:release.size,AUDITED_SHA256:auditedHash,RELEASE_SHA256:releaseHash,HASHES_IDENTICAL:"TRUE",ALL_EVIDENCE_FAILURES_DEFECTS_REGRESSIONS_AUDIT_AND_HASH_LOGS_PRESERVED:"UNKNOWN",ONLY_EXACT_ACCEPTED_HASH_MATCHED_ARTIFACTS_DELIVERED:"UNKNOWN",DELIVERY_LOCATION_OR_METHOD:"UNKNOWN",DELIVERY_DATE_AND_TIME:"UNKNOWN",DELIVERY_CONFIRMED:"UNKNOWN",RELEASE_EVIDENCE_REPOSITORY:"UNKNOWN",RELEASE_AUTHORIZED_BY:"UNKNOWN",AUTHORIZATION_DATE_AND_TIME:"UNKNOWN",FINAL_RELEASE_STATUS:"NOT RELEASED",CONTROLLING_EVIDENCE:`Stage 28 ${hashId}; audited file ${audited.name}; release file ${release.name}`,STATUS:"PENDING COMPLETION"});
  }

  async function verifyReleaseIdentity(state,number,gate,audited,release){
    if(!audited||!release){notice("Select both the audited file and the file selected for delivery.","warn");return;}
    const [auditedHash,releaseHash]=await Promise.all([sha256(audited),sha256(release)]);
    const sizeMatch=audited.size===release.size;
    const hashMatch=auditedHash===releaseHash;
    const authorized=gate==="ACCEPTED"&&sizeMatch&&hashMatch;
    const hashId=`HASH-AUDIT-${String(state.releaseIdentityRecords.length+1).padStart(3,"0")}`;
    state.releaseIdentityRecords.push({HASH_AUDIT_ID:hashId,RELEASE_GATE_STATE:gate,HASH_ALGORITHM:"SHA-256",HASH_TOOL_AND_VERSION:"Web Crypto API",AUDITED_FILENAME:audited.name,AUDITED_FILE_SIZE_BYTES:audited.size,AUDITED_SHA256:auditedHash,RELEASE_FILENAME:release.name,RELEASE_FILE_SIZE_BYTES:release.size,RELEASE_SHA256:releaseHash,RELEASE_HASH_EQUALS_AUDITED_HASH:hashMatch?"TRUE":"FALSE",BYTE_SIZE_EQUALS_AUDITED_BYTE_SIZE:sizeMatch?"TRUE":"FALSE",DELIVERY_AUTHORIZATION:authorized?"ELIGIBLE FOR FINAL RELEASE CONTROL":"NOT AUTHORIZED",DATE_AND_TIME:now()});
    if(authorized){finalReleaseRecord(state,hashId,audited,release,auditedHash,releaseHash);notice("Exact audited bytes verified. Complete the final release record at Stage 30 before delivery.","good");}
    else{const stage=stageAt(state,number);if(stage){stage.status="BLOCKED";stage.decision="BLOCKED";}state.job.currentState="BLOCKED";notice("Release stopped: the gate is not ACCEPTED or the file bytes differ.","bad");}
    writeState(state);
  }

  function saveRecord(button,number){
    transact(state=>{
      const letter=button.dataset.saveRecord,id=button.dataset.recordId,card=button.closest("[data-record]");
      const current=state.operationalRecords[letter].find(record=>recordId(letter,record)===id);
      if(!current||!card)return false;
      const next={...current};
      card.querySelectorAll("[data-rfield]").forEach(field=>{next[field.dataset.rfield]=field.value.trim()||"UNKNOWN";});
      let status="RECORDED";
      if(letter==="A"&&(String(next.CONTEXT_CONTAMINATED).toUpperCase()==="TRUE"||String(next.REQUIRED_TOOLS_AVAILABLE).toUpperCase()==="FALSE")){next.RUN_USABLE="FALSE";if(["NONE","UNKNOWN",""].includes(String(next.DEFECT_ID||"").trim().toUpperCase()))next.DEFECT_ID=`CONTEXT-DEFECT-${id}`;status="UNUSABLE";const stage=stageAt(state,number);if(stage){stage.status="IN PROGRESS";stage.decision="NOT READY - CORRECTION REQUIRED";}state.job.currentState="IN PROGRESS";state.job.nextAction=`Restart STAGE ${pad(number)} in a new clean context`;}
      if(letter==="B"&&String(next.CURRENT_STATUS).toUpperCase()==="RESOLVED"&&[next.RESOLUTION_EVIDENCE,next.REQUIREMENTS_AND_TESTS_REEVALUATED,next.DOWNSTREAM_VALIDATION_RERUN,next.CLOSURE_AUTHORIZED_BY].some(badValue)){notice("A blocker cannot close until resolution evidence, reevaluation, downstream rerun, and closure authority are recorded.","warn");return false;}
      if(letter==="D"){if(String(next.FINAL_RELEASE_STATUS).toUpperCase()==="RELEASED"&&!releaseReady(next)){notice("Final release remains prohibited until every release condition is established.","bad");return false;}next.FINAL_RELEASE_STATUS=releaseReady(next)?"RELEASED":"NOT RELEASED";}
      if(letter==="F"){const defective=String(next.TRUNCATION_DETECTED).toUpperCase()==="TRUE"||String(next.REFUSAL_OR_PARTIAL_REFUSAL).toUpperCase()==="TRUE"||!["NONE",""].includes(String(next.TOOL_FAILURES||"").trim().toUpperCase())||!["NONE",""].includes(String(next.MISSING_OR_UNREADABLE_ATTACHMENTS||"").trim().toUpperCase())||!["NONE",""].includes(String(next.MALFORMED_OUTPUT_FILES||"").trim().toUpperCase());if(defective&&String(next.INDEPENDENT_COMPLETION_ESTABLISHED).toUpperCase()==="TRUE")next.INDEPENDENT_COMPLETION_ESTABLISHED="FALSE";}
      next.STATUS=status;
      replaceRecord(state,letter,id,next);
      if(letter==="B"){const open=state.operationalRecords.B.filter(record=>String(record.CURRENT_STATUS).toUpperCase()==="OPEN").map(record=>recordId("B",record));state.job.blockers=open.join(", ")||"NONE";if(!open.length&&String(state.job.currentState).toUpperCase()==="BLOCKED")state.job.currentState="IN PROGRESS";}
      notice(`${TITLES[letter]} record saved.`,"good");
    });
  }

  function bindStageControls(state,number,root){
    root.querySelectorAll("[data-save-record]").forEach(button=>button.addEventListener("click",()=>saveRecord(button,number)));
    root.querySelector("[data-add-fresh]")?.addEventListener("click",()=>transact(current=>freshContextRecord(current,number)));
    root.querySelector("[data-add-receipt]")?.addEventListener("click",()=>transact(current=>receiptRecord(current,number)));
    root.querySelector("[data-open-blocker]")?.addEventListener("click",()=>transact(current=>blockerRecord(current,number)));
    root.querySelector("[data-add-change]")?.addEventListener("click",()=>transact(current=>changeRecord(current,number)));
    root.querySelector("[data-compare-hash]")?.addEventListener("click",()=>verifyReleaseIdentity(state,number,root.querySelector("[data-gate-state]")?.value,root.querySelector("[data-audited]")?.files?.[0],root.querySelector("[data-release]")?.files?.[0]));
  }

  function controls(){return [...document.querySelectorAll("button,a,[role='button']")];}
  function isActive(element){return Boolean(element&&(element.classList.contains("active")||element.getAttribute("aria-current")==="page"||element.getAttribute("aria-selected")==="true"||element.getAttribute("aria-pressed")==="true"));}
  function activateWorkbookSurface(){const legacyActive=controls().find(element=>BAD_NAV.test(normalizedText(element))&&isActive(element));if(!legacyActive)return;const workbookControl=controls().find(element=>WORKBOOK_NAV.test(normalizedText(element)));if(workbookControl)workbookControl.click();else{try{if("view" in globalThis)globalThis.view="workbook";if(typeof globalThis.render==="function")globalThis.render();}catch(error){console.error(error);}}}

  function removeLegacySurfaces(){
    activateWorkbookSurface();
    document.getElementById("repository-test-project")?.remove();
    document.getElementById("appendix-operational-purpose")?.remove();
    document.querySelectorAll('[data-integrated-operational-controls="true"]').forEach(element=>element.remove());
    const containers=new Set();
    for(const element of controls()){if(!BAD_NAV.test(normalizedText(element)))continue;const container=element.closest(".tabs,[data-view-tabs],[role='tablist']")||element.parentElement;if(container)containers.add(container);element.remove();}
    for(const container of containers){if(!container?.isConnected)continue;const remaining=[...container.querySelectorAll("button,a,[role='button']")];if(!remaining.length||(remaining.length===1&&WORKBOOK_NAV.test(normalizedText(remaining[0]))))container.remove();}
    for(const heading of document.querySelectorAll("#master h1,#master h2,#master h3,#master h4,#master summary,#content h1,#content h2,#content h3,#content h4,#content summary")){if(heading.closest('[data-contextual-controls="true"]'))continue;if(!APPENDIX_HEADING.test(normalizedText(heading)))continue;const box=heading.closest("section,article,details,.card,.panel")||heading.parentElement;box?.remove();}
  }

  function compactMaster(){document.querySelectorAll("#master>details").forEach(details=>{if(details.dataset.humanDefaultSet)return;details.dataset.humanDefaultSet="true";details.open=false;const summary=details.querySelector(":scope>summary");if(summary&&/WORKBOOK CONTROL|MASTER/i.test(normalizedText(summary)))summary.setAttribute("aria-label","Job overview and workbook reference");});}
  function stateSignature(state,number){return `${jobId(state)}|${number}|${LETTERS.map(letter=>state.operationalRecords[letter].map(record=>`${recordId(letter,record)}:${record.STATUS||""}:${record.CURRENT_STATUS||""}`).join(";")).join("|")}|${state.releaseIdentityRecords.length}`;}
  function syncRestoreButton(){const button=document.getElementById("returnToJob");if(!button)return;button.classList.toggle("hidden",!localStorage.getItem(USER_BACKUP_STORE));}

  function paint(){
    scheduled=false;
    if(painting)return;
    const state=readState(),target=document.getElementById("content");
    if(!state||!target){syncRestoreButton();return;}
    painting=true;
    try{
      removeLegacySurfaces();compactMaster();syncRestoreButton();
      const number=activeStageNumber(state),signature=stateSignature(state,number);
      let root=target.querySelector(':scope>[data-contextual-controls="true"]');
      if(!root||root.dataset.signature!==signature){root?.remove();root=document.createElement("div");root.dataset.contextualControls="true";root.dataset.signature=signature;root.innerHTML=stageControls(state,number);target.appendChild(root);bindStageControls(state,number,root);}
      if(lastCreatedRecordId){const record=root.querySelector(`[data-record="${CSS.escape(lastCreatedRecordId)}"]`),group=root.querySelector("[data-event-records]");if(group)group.open=true;if(record){record.open=true;record.scrollIntoView({behavior:"smooth",block:"center"});}lastCreatedRecordId="";}
    }finally{queueMicrotask(()=>{painting=false;});}
  }

  function schedulePaint(){if(scheduled)return;scheduled=true;requestAnimationFrame(paint);}

  async function loadTestProject(){
    try{
      const currentRaw=readRawState(),current=currentRaw?JSON.parse(currentRaw):null;
      const isTest=current?.projectKind==="RETAINED_TEST_PROJECT"||current?.job?.id==="RETAINED-TEST-PROJECT";
      if(currentRaw&&!isTest)localStorage.setItem(USER_BACKUP_STORE,currentRaw);
      notice("Loading the test project…","warn");
      const response=await fetch(`${TEST_PROJECT_FILE}?t=${Date.now()}`,{cache:"no-store"});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const project=await response.json();
      if(project?.schema!=="mclarw/30"||project?.projectKind!=="RETAINED_TEST_PROJECT"||!Array.isArray(project?.stages)||project.stages.length!==30)throw new Error("The retained test project is not a valid 30-stage workbook project.");
      await importState(project,TEST_PROJECT_FILE);syncRestoreButton();notice("Test project loaded in this workbook. Your previous job is preserved.","good");
    }catch(error){console.error(error);notice(`Could not load the test project: ${error.message}`,"bad");}
  }

  async function restoreUserJob(){
    const raw=localStorage.getItem(USER_BACKUP_STORE);
    if(!raw){notice("No saved job is available to restore.","warn");syncRestoreButton();return;}
    try{const state=JSON.parse(raw);await importState(state,"RESTORED_WORKBOOK.json");localStorage.removeItem(USER_BACKUP_STORE);syncRestoreButton();notice("Your saved job has been restored.","good");}
    catch(error){console.error(error);notice(`Could not restore the saved job: ${error.message}`,"bad");}
  }

  function installRenderGuard(){if(typeof globalThis.render!=="function"||globalThis.render.__humanWorkbookGuard)return;const original=globalThis.render;const guarded=function(...args){const result=original.apply(this,args);schedulePaint();return result;};guarded.__humanWorkbookGuard=true;globalThis.render=guarded;}

  function installEventGuards(){
    document.addEventListener("click",event=>{
      const button=event.target.closest("button");if(!button)return;
      const label=normalizedText(button),state=readState(),number=state?activeStageNumber(state):1;
      if(BAD_NAV.test(label)){event.preventDefault();event.stopImmediatePropagation();activateWorkbookSurface();schedulePaint();return;}
      if(label==="Apply gate"&&state){
        const decision=String(stageAt(state,number)?.decision||"").toUpperCase();
        if(decision==="READY TO PROCEED"&&openBlockers(state,number).length){event.preventDefault();event.stopImmediatePropagation();notice("READY is prohibited while a mandatory blocker is open.","bad");return;}
        setTimeout(()=>transact(current=>{const stage=stageAt(current,number),applied=String(stage?.decision||"").toUpperCase();if(applied==="BLOCKED"&&!openBlockers(current,number).length)blockerRecord(current,number);if(number===16&&applied==="READY TO PROCEED"&&!current.operationalRecords.C.some(record=>String(record.STAGE||"").includes("16")))changeRecord(current,number);}),120);
      }
      if(label==="New clean job"){
        beforeResetState=state;
        const checkReset=()=>{const current=readState();if(current&&beforeResetState&&jobId(current)!==jobId(beforeResetState)){const old=beforeResetState;beforeResetState=null;transact(next=>resetRecord(next,old));}};
        setTimeout(checkReset,300);setTimeout(checkReset,900);
      }
    },true);
  }

  function installUi(){
    document.getElementById("loadTestProject")?.addEventListener("click",loadTestProject);
    document.getElementById("returnToJob")?.addEventListener("click",restoreUserJob);
    globalThis.loadClosedLoopTestProject=loadTestProject;globalThis.restoreClosedLoopUserJob=restoreUserJob;
    installRenderGuard();installEventGuards();syncRestoreButton();
    const observer=new MutationObserver(mutations=>{if(painting)return;const external=mutations.some(mutation=>{const target=mutation.target instanceof Element?mutation.target:null;return !target?.closest?.('[data-contextual-controls="true"],#appNotice,#guideDialog');});if(external)schedulePaint();});
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","hidden","aria-current","aria-selected","aria-pressed"]});
    window.addEventListener("pageshow",schedulePaint);window.addEventListener("storage",schedulePaint);document.addEventListener("change",schedulePaint,true);schedulePaint();
  }

  try{workbook=await loadWorkbookModule();globalThis.ClosedLoopWorkbook=workbook;window.dispatchEvent(new CustomEvent("closed-loop-workbook-ready"));installUi();}
  catch(error){failRuntime(error);}
})();
