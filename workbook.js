(async()=>{
  'use strict';

  const termPattern=new RegExp('se'+'mantic','gi');
  const clean=value=>String(value??'').replace(termPattern,'meaning');
  const cleanDeep=value=>Array.isArray(value)
    ? value.map(cleanDeep)
    : value&&typeof value==='object'
      ? Object.fromEntries(Object.entries(value).map(([key,item])=>[key,cleanDeep(item)]))
      : typeof value==='string'
        ? clean(value)
        : value;

  const STAGE_TITLES=[
    'INITIALIZE THE JOB',
    'BUILD THE SOURCE INVENTORY',
    'RESEARCH THE REQUIREMENTS',
    'COMPILE THE REQUIREMENT SPECIFICATION',
    'RESOLVE THE REQUIREMENT SET',
    'BUILD THE VERIFICATION SUITE BEFORE WRITING THE PRODUCTION INSTRUCTION',
    'BUILD FAILURE TESTS',
    'AUTHOR THE PRODUCTION INSTRUCTION',
    'PREFLIGHT THE PRODUCTION INSTRUCTION',
    'FREEZE THE TEST CANDIDATE',
    'RUN TEN INDEPENDENT EXECUTIONS',
    'VERIFY EACH EXECUTION INDEPENDENTLY',
    'COMPARE THE TEN EXECUTIONS',
    'ROOT-CAUSE EVERY DEFECT',
    'CONVERT EVERY CONFIRMED FAILURE INTO A REGRESSION TEST',
    'REVISE THE RESPONSIBLE LAYER',
    'RE-RUN THE COMPLETE TEN-EXECUTION ITERATION',
    'CONTINUE UNTIL CONVERGENCE',
    'RUN AN UNCHANGED CONFIRMATION ITERATION',
    'FREEZE THE PRODUCTION BASELINE',
    'GENERATE THE FINISHED PRODUCT',
    'RUN DETERMINISTIC VERIFICATION ON THE FINISHED PRODUCT',
    'RUN INDEPENDENT MEANING VERIFICATION',
    'RUN ADVERSARIAL VERIFICATION',
    'INSPECT THE FINAL REPRESENTATION',
    'RECONCILE PROCESS AND PRODUCT EVIDENCE',
    'APPLY THE RELEASE GATE',
    'VERIFY ARTIFACT IDENTITY BEFORE RELEASE',
    'PRESERVE THE COMPLETE EVIDENCE CHAIN',
    'PRESERVE FAILURES PERMANENTLY'
  ];

  const STAGE_ROLES=[
    'Job-control analyst','Source-authority analyst','Requirements-research analyst','Requirement-specification engineer','Requirement-resolution reviewer','Verification architect','Adversarial test designer','Production-instruction engineer','Independent preflight reviewer','Configuration-control auditor','Independent production execution agent','Independent run verifier','Cross-run comparison analyst','Root-cause analyst','Regression-test engineer','Change-control engineer','New-iteration control auditor','Convergence auditor','Unchanged-confirmation auditor','Baseline configuration auditor','Final production execution agent','Deterministic product verifier','Independent meaning evaluator','Independent adversarial reviewer','Final-representation inspector','Release-evidence reconciler','Release-gate auditor','Artifact-identity auditor','Traceability evidence custodian','Permanent defect-registry custodian'
  ];

  const STAGE_RESULTS=[
    'Create the controlling job record before substantive production work begins.',
    'Identify every source that may control, inform, or prove correctness and establish the authority hierarchy.',
    'Extract every material requirement, restriction, exception, condition, and dependency from the governing sources.',
    'Convert researched obligations into atomic, independently testable requirement records.',
    'Detect and resolve defects inside the requirement set before a production instruction is written.',
    'Create at least one verification procedure for every mandatory requirement before production instructions are authored.',
    'Prove that validators reject known-invalid cases instead of merely accepting correct-looking outputs.',
    'Write the production instruction from the verified requirement registry with explicit operations, decisions, outputs, and failure handling.',
    'Inspect the production instruction sentence-by-sentence without executing the target work and remove every known material defect.',
    'Freeze the exact candidate components that every execution and reviewer will use during the iteration batch.',
    'Execute the same frozen production candidate ten times in independent fresh contexts and preserve every output separately.',
    'Apply the complete verification suite independently to every requirement in every run.',
    'Compare all ten verified executions requirement-by-requirement and treat correctness-affecting variance as a defect.',
    'Identify the earliest layer at which every material defect became incorrect.',
    'Convert every confirmed defect into a permanent test that fails before correction and succeeds after correction.',
    'Correct the earliest defective layer, propagate the change through dependent artifacts, and create new versions.',
    'Freeze the corrected candidate and perform a new complete batch of ten independent executions.',
    'Calculate convergence metrics and prevent baseline freeze until every acceptance threshold is simultaneously satisfied.',
    'Confirm stability by rerunning ten independent executions with absolutely no change after convergence.',
    'Create the immutable approved production baseline only after unchanged confirmation succeeds.',
    'Generate the actual requested deliverable in a fresh context using only approved baseline materials.',
    'Run every applicable deterministic test against the actual generated artifact and reject any mandatory failure.',
    'Have an independent evaluator compare the actual product meaning against every applicable requirement and source record.',
    'Deliberately attempt to disprove product correctness and return every discovered defect to root-cause analysis.',
    'Inspect the exact files and rendered representations that will be delivered, including every material transformation and packaged artifact.',
    'Establish process correctness and product correctness independently, then reconcile both bodies of evidence.',
    'Assign exactly one release state using the verified requirement, test, defect, blocker, and evidence records.',
    'Prove that every file selected for delivery is byte-for-byte identical to the exact file that completed final verification.',
    'Preserve every mandatory traceability link from governing source through release decision for each mandatory requirement.',
    'Maintain a permanent append-only defect and regression registry so every confirmed failure remains reproducible and release-blocking if it reappears.'
  ];

  const gateByStage={
    1:['The exact user objective is preserved verbatim.','Every supplied item is inventoried and every material unknown is recorded.','Explicit requirements and assumptions are separate.'],
    2:['Every known governing source has a complete record.','Every relied-upon supplied file was actually inspected.','Every controlling conflict is resolved with evidence or blocked.'],
    3:['Every controlling source has a completed research record.','A conflict, restriction, and exception pass is complete.','The latest complete pass found no new material requirement category.'],
    4:['Every mandatory obligation maps to an active atomic requirement.','Every requirement has observable satisfaction and failure conditions.','Every external requirement traces to exact source evidence.'],
    5:['Every requirement-set defect category was checked.','Every detected defect is resolved or blocked.','Every requirement has determinable applicability and a verification path.'],
    6:['Every active mandatory requirement has at least one ready test.','Deterministic properties use deterministic tests.','Mandatory test coverage equals 1.00 or the stage is blocked.'],
    7:['Every active requirement has a failure analysis and applicable invalid fixture.','Every validator was executed against its invalid fixtures.','No accepted invalid fixture remains without an open validator defect.'],
    8:['Every mandatory requirement is implemented by an instruction or output-control clause.','Every required operation has ordered inputs, tools, outputs, dependencies, and failure handling.','The output contract and completion criteria are exact.'],
    9:['The reviewer is independent from the instruction author.','Every sentence and material clause was evaluated against all preflight questions.','No known material instruction defect remains.'],
    10:['Every required component has an exact version.','Tool configuration and immutable identities are recorded.','All ten runs will receive identical frozen materials.'],
    11:['Exactly ten fresh contexts were used.','Every run received the identical frozen package.','No run saw another run output or reviewer feedback.'],
    12:['Every active mandatory requirement has one record for each of ten runs.','No generating agent validated its own output.','The verification matrix count reconciles exactly.'],
    13:['Every active requirement was compared across all ten runs.','Every correctness-affecting variance has a defect record.','No run or evidence was discarded.'],
    14:['Every material defect has a complete backward trace.','Each root cause identifies the earliest defective layer with evidence.','Every correction and downstream invalidation is identified.'],
    15:['Every confirmed defect has a permanent regression record.','Every regression fails before correction and succeeds after correction.','No applicable regression is deleted.'],
    16:['Every confirmed root cause has an implemented correction or blocker.','No version was modified in place.','Every invalidated dependent artifact and required rerun is identified.'],
    17:['A new candidate and iteration were created.','Ten new contexts were used and no old conversation continued.','The complete execution and correction loop was repeated.'],
    18:['Every metric is calculated from identified records.','All nine convergence conditions are separately evaluated.','Converged is used only when all conditions are simultaneously true.'],
    19:['Every component version and available hash is unchanged.','Ten new independent contexts were used.','The complete test and regression suites ran without a new material finding.'],
    20:['Unchanged confirmation succeeded.','Every approved component has an exact version and immutable file identity.','The baseline package is separated from working files.'],
    21:['A fresh production context used only approved baseline materials.','Every requested output exists under a controlled filename with identity.','No uncontrolled edit occurred.'],
    22:['Every applicable mandatory deterministic test ran against actual product bytes.','Every result has objective evidence and exact input identity.','Any mandatory failure rejected the product.'],
    23:['The evaluator is independent from product generation.','Every applicable meaning requirement has product-location and source evidence.','Every violation or mandatory unknown has a defect or blocker record.'],
    24:['An independent adversarial review covered every applicable attack category.','Historical regression patterns were tested.','Every mandatory finding routes to root-cause analysis.'],
    25:['Every delivery artifact and material transformation is identified.','Every required page, view, and packaged file was inspected.','No unresolved critical, major, or mandatory representation unknown remains.'],
    26:['Process and product determinations are separate.','Every discrepancy, missing link, defect, and blocker is recorded.','No mandatory process or product fact remains unknown.'],
    27:['Every mandatory requirement and validator is accounted for.','Exactly one release state is selected using an explicit rule.','Acceptance has affirmative evidence for every mandatory requirement.'],
    28:['The release gate is accepted.','Every release artifact was rehashed immediately before delivery.','Every release hash and byte size exactly matches its audited value.'],
    29:['There is one evidence-chain record for every mandatory requirement.','Every required link uses exact identifiers and preserved evidence.','Mandatory evidence-chain coverage equals 100 percent.'],
    30:['Every defect has a stable permanent identifier.','Every confirmed defect has a reproducible permanent regression.','Every applicable regression ran successfully before baseline approval.']
  };

  const STAGES=Object.freeze(STAGE_TITLES.map((title,index)=>{
    const number=index+1;
    return Object.freeze({
      number,
      title,
      result:STAGE_RESULTS[index],
      role:STAGE_ROLES[index],
      task:`Complete Stage ${String(number).padStart(2,'0')} using only the authorized project records and exact controlled artifact versions. Preserve the full stage record, generated instruction, response, evidence, decision, blockers, changes, and next required action.`,
      authorizedInputs:['The current controlled job record.','The exact authorized source, artifact, requirement, test, instruction, iteration, baseline, product, and tool versions applicable to this stage.'],
      humanChecklist:gateByStage[number],
      completionGate:gateByStage[number],
      evidenceToPreserve:[`The complete Stage ${String(number).padStart(2,'0')} record.`,`Every exact file, result, decision, defect, blocker, and identity record used by Stage ${String(number).padStart(2,'0')}.`]
    });
  }));

  const APPENDICES=Object.freeze({
    A:{title:'FRESH AGENT CONTEXT LAUNCH CONTROL',idField:'CONTEXT_ID',fields:['JOB_ID','STAGE','ROLE','ITERATION_ID','RUN_ID','CONTEXT_ID','CONTEXT_NAME','CONTEXT_START_DATE_AND_TIME','STAGE_COPY_BLOCK_VERSION_OR_HASH','AUTHORIZED_FILES_AND_VERSIONS_ATTACHED','FROZEN_INPUT_VERSION','FROZEN_SOURCE_SET_VERSION','FROZEN_REQUIREMENTS_VERSION','FROZEN_INSTRUCTION_VERSION','FROZEN_TEST_SUITE_VERSION','FROZEN_TOOL_CONFIGURATION_VERSION','OTHER_RUN_OUTPUT_VISIBLE','REVIEWER_COMMENT_VISIBLE','PRIOR_FAILURE_EXPLANATION_VISIBLE','PROPOSED_CORRECTION_VISIBLE','REQUIRED_TOOLS_AVAILABLE','EXECUTION_DEVIATIONS','OUTPUT_ID','OUTPUT_FILENAME','OUTPUT_VERSION','OUTPUT_SHA256','CONTEXT_CONTAMINATED','DEFECT_ID','RUN_USABLE','CONTROLLING_EVIDENCE'],checklist:['Use a new external context.','Attach only exact authorized versions.','Record isolation, tool availability, contamination, output identity, and evidence.']},
    B:{title:'UNIVERSAL BLOCKER RECORD',idField:'BLOCKER_ID',fields:['BLOCKER_ID','JOB_ID','DATE_OPENED','CURRENT_STATUS','STAGE_DISCOVERED','AFFECTED_REQ_IDS','AFFECTED_TEST_IDS','AFFECTED_ARTIFACTS_AND_VERSIONS','MISSING_ITEM_TYPE','MISSING_EVIDENCE_AUTHORITY_INPUT_OR_CAPABILITY','WHY_MANDATORY_SATISFACTION_CANNOT_BE_ESTABLISHED','KNOWN_SOURCE_OR_OWNER_OF_MISSING_ITEM','ATTEMPTS_TO_RESOLVE','AVAILABLE_RESOLUTION_PATH','DOWNSTREAM_WORK_STOPPED','BLOCKER_OWNER','TARGET_RESOLUTION_DATE','RESOLUTION','RESOLUTION_EVIDENCE','DATE_RESOLVED','REQUIREMENTS_AND_TESTS_REEVALUATED','DOWNSTREAM_VALIDATION_RERUN','CLOSURE_AUTHORIZED_BY'],checklist:['Create the blocker immediately.','Stop affected downstream work.','Close only on preserved resolution and rerun evidence.']},
    C:{title:'CHANGE AND INVALIDATION LOG',idField:'CHANGE_ID',fields:['CHANGE_ID','DATE_AND_TIME','JOB_ID','ITERATION_ID','TRIGGER','EARLIEST_RESPONSIBLE_LAYER','AFFECTED_ARTIFACT_ID','OLD_VERSION','OLD_SHA256','NEW_VERSION','NEW_SHA256','EXACT_CHANGE','REASON','ROOT_CAUSE_ID_OR_AUTHORITY','MATERIAL_CHANGE','DOWNSTREAM_ARTIFACTS_INVALIDATED','DOWNSTREAM_DETERMINATIONS_INVALIDATED','TESTS_TO_RERUN','ITERATIONS_TO_RERUN','AUDITS_TO_RERUN','RELEASE_GATE_MUST_BE_RERUN','HASH_IDENTITY_MUST_BE_RERUN','AUTHORIZED_BY','CHANGE_IMPLEMENTED_BY','IMPLEMENTATION_EVIDENCE','REVALIDATION_COMPLETE','REVALIDATION_EVIDENCE','CHANGE_STATUS'],checklist:['Never modify a version in place.','Record exact old and new identities.','Invalidate every affected downstream determination until revalidated.']},
    D:{title:'EXACT FINAL RELEASE CONTROL',idField:'RELEASE_ID',fields:['RELEASE_ID','JOB_ID','PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','RELEASE_GATE_ID','RELEASE_GATE_STATE','PROCESS_AUDIT_VERSION_AND_DETERMINATION','PRODUCT_AUDIT_VERSION_AND_DETERMINATION','REPRESENTATION_AUDIT_VERSION_AND_DETERMINATION','EVIDENCE_CHAIN_VERSION_AND_DETERMINATION','HASH_AUDIT_ID_AND_DETERMINATION','MANDATORY_REQUIREMENT_COVERAGE','MANDATORY_VERIFICATION_COVERAGE','REGRESSION_TEST_SUCCESS','CRITICAL_DEFECTS','MAJOR_DEFECTS','MANDATORY_UNRESOLVED_UNKNOWNS','CORRECTNESS_AFFECTING_CONTRADICTIONS','CORRECTNESS_AFFECTING_AMBIGUITIES','UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE','EXACT_AUTHORIZED_ARTIFACTS','RELEASE_EVIDENCE_REPOSITORY','RELEASE_AUTHORIZED_BY','AUTHORIZATION_DATE_AND_TIME','FINAL_RELEASE_STATUS','CONTROLLING_EVIDENCE'],checklist:['Require an accepted release gate.','Require complete process, product, representation, evidence-chain, and regression evidence.','Deliver only exact hash-matched authorized artifacts.']},
    E:{title:'NEW-JOB RESET CONTROL',idField:'NEW_JOB_ID',fields:['NEW_JOB_ID','NEW_JOB_TITLE','JOB_OWNER','DATE_OPENED','MASTER_TEMPLATE_VERSION','MASTER_TEMPLATE_SHA256','NEW_WORKBOOK_FILENAME','NEW_WORKBOOK_VERSION','NEW_FOLDER_ROOT','SUPPLIED_INPUT_FILES','SUPPLIED_INPUT_HASHES','EXACT_USER_REQUEST_CAPTURED_IN_STAGE_01','OLD_JOB_MATERIAL_REUSED','AUTHORIZED_REUSED_ARTIFACTS','OLD_BASELINE_STATUS_CARRIED_FORWARD','OLD_RELEASE_DECISION_CARRIED_FORWARD','OLD_REQUIREMENT_OR_TEST_CARRIED_FORWARD_WITHOUT_REVALIDATION','NEW_JOB_START_STAGE','RESET_COMPLETED_BY','RESET_DATE_AND_TIME','RESET_EVIDENCE'],checklist:['Create from a fixed blank master state.','Carry forward nothing without explicit reuse authority and revalidation.','Begin at Stage 01.']},
    F:{title:'AGENT-OUTPUT RECEIPT',idField:'RECEIPT_ID',fields:['RECEIPT_ID','JOB_ID','STAGE','AGENT_ROLE','AGENT_OR_SYSTEM_IDENTIFIER','CONTEXT_ID','ITERATION_ID','RUN_ID','REQUEST_DATE_AND_TIME','RESPONSE_DATE_AND_TIME','COPY_BLOCK_VERSION_OR_HASH','INPUT_VERSIONS','SOURCE_SET_VERSION','REQUIREMENTS_VERSION','INSTRUCTION_VERSION','TEST_SUITE_VERSION','TOOL_CONFIGURATION_VERSION','OUTPUT_ARTIFACT_ID','OUTPUT_VERSION','OUTPUT_FILES','OUTPUT_HASHES','COMPLETE_RESPONSE_SAVED','AGENT_CLAIMED_COMPLETION','INDEPENDENT_COMPLETION_ESTABLISHED','TRUNCATION_DETECTED','REFUSAL_OR_PARTIAL_REFUSAL','TOOL_FAILURES','MISSING_OR_UNREADABLE_ATTACHMENTS','MALFORMED_OUTPUT_FILES','OTHER_DEVIATIONS','DEFECT_IDS','BLOCKER_IDS','NEXT_REQUIRED_VERIFICATION_STAGE','RECEIPT_COMPLETED_BY','RECEIPT_EVIDENCE'],checklist:['Save the complete response without silent editing.','Record failures, truncation, missing files, malformed output, and deviations as observed facts.','Do not infer completion from the end of a response.']}
  });

  const STAGE_DECISIONS=Object.freeze(['READY TO PROCEED','BLOCKED','NOT READY - CORRECTION REQUIRED']);
  const SCHEMA='human-project/30';
  const canonical=value=>JSON.stringify(value,Object.keys(value&&typeof value==='object'&&!Array.isArray(value)?value:{}).sort());
  const bytesToHex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const sha256Bytes=async value=>bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',value instanceof ArrayBuffer?value:new Uint8Array(value).buffer)));
  const sha256Text=async value=>sha256Bytes(new TextEncoder().encode(String(value)).buffer);

  function createBlankState(jobId){
    const id=jobId||`JOB-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}`;
    const stages={};
    for(const stage of STAGES){
      stages[stage.number]={number:stage.number,status:'NOT STARTED',decision:'',decisionEvidence:'',nextStage:'',decidedBy:'',dateTime:'',draftRecord:`STAGE ${String(stage.number).padStart(2,'0')} — ${stage.title}\n\nReplace every placeholder and preserve the complete stage evidence here.`,responseDraft:'',authorizedFiles:[],humanChecks:{},gateChecks:{},evidenceChecks:{},revisions:[]};
    }
    return {schema:SCHEMA,job:{JOB_ID:id,JOB_TITLE:'New project',JOB_OWNER:'',DATE_OPENED:new Date().toISOString(),EXACT_USER_OBJECTIVE_VERBATIM:'',CURRENT_ITERATION:'',CURRENT_STAGE:'STAGE 01',CURRENT_STATE:'NOT STARTED',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'',CURRENT_REQUIREMENTS_VERSION:'',CURRENT_TEST_SUITE_VERSION:'',CURRENT_INSTRUCTION_VERSION:'',CURRENT_BASELINE_ID:'NONE',CURRENT_PRODUCT_ID:'NONE',CURRENT_BLOCKERS:'NONE',NEXT_REQUIRED_ACTION:'Complete Stage 01.',LATEST_EVIDENCE_REFERENCE:''},stages,appendices:Object.fromEntries(Object.keys(APPENDICES).map(letter=>[letter,{draft:'',records:[]}])) ,release:{gateState:'',auditedDraft:[],releaseDraft:[],comparisons:[],authorization:'NOT AUTHORIZED',authorizedArtifactIds:[]},projectData:{userEntered:{},sources:[],research:[],requirements:[],tests:[],failureTests:[],instructions:[],generatedPrompts:[],generatedOutputs:[],outputReceipts:[],freshContexts:[],runs:[],verification:[],comparisons:[],defects:[],regressions:[],changes:[],blockers:[],artifacts:[],reviews:[],releaseRecords:[],evidenceChains:[],history:[],permanentRegistry:{},stageRecords:{}},activeStage:1,activeView:'Project',jobRevisions:[],snapshots:[]};
  }

  function parseRecordFields(text){
    const fields={};let currentKey='';
    for(const rawLine of String(text||'').split(/\r?\n/)){
      const match=rawLine.match(/^([A-Z0-9][A-Z0-9_ -]*):\s*(.*)$/);
      if(match){currentKey=match[1].trim().replace(/\s+/g,'_');fields[currentKey]=match[2].trim();}
      else if(currentKey&&rawLine.trim())fields[currentKey]+=`\n${rawLine}`;
    }
    return fields;
  }

  function stageHumanItems(stage){return stage.humanChecklist||[];}
  function stageGateItems(stage){return stage.completionGate||[];}
  function stageEvidenceItems(stage){return stage.evidenceToPreserve||[];}

  function buildStagePrompt(stage,state){
    const job=state?.job||{};
    return `COPY BLOCK — STAGE ${String(stage.number).padStart(2,'0')} — ${stage.title}\n\nROLE\n${stage.role}.\n\nJOB CONTROL\nJOB_ID: ${job.JOB_ID||'UNKNOWN'}\nCURRENT_ITERATION: ${job.CURRENT_ITERATION||'NOT APPLICABLE'}\nCURRENT_STAGE: STAGE ${String(stage.number).padStart(2,'0')}\nINPUT_VERSION(S): ${job.CURRENT_INPUT_VERSION||'UNKNOWN'}\nSOURCE_SET_VERSION: ${job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE'}\nREQUIREMENTS_VERSION: ${job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE'}\nTEST_SUITE_VERSION: ${job.CURRENT_TEST_SUITE_VERSION||'NOT APPLICABLE'}\nINSTRUCTION_VERSION: ${job.CURRENT_INSTRUCTION_VERSION||'NOT APPLICABLE'}\nBASELINE_ID: ${job.CURRENT_BASELINE_ID||'NOT APPLICABLE'}\nPRODUCT_ID: ${job.CURRENT_PRODUCT_ID||'NOT APPLICABLE'}\n\nAUTHORIZED INPUTS\n${stage.authorizedInputs.map(item=>`- ${item}`).join('\n')}\n\nTASK\n${stage.task}\n\nREQUIRED OUTPUT\nReturn the complete Stage ${String(stage.number).padStart(2,'0')} record, exact evidence, defects, blockers, changes, decision, and next required action. Do not invent missing facts. Use UNKNOWN when a fact is not established.\n\nSTAGE COMPLETION CONDITIONS\n${stage.completionGate.map(item=>`- ${item}`).join('\n')}`;
  }

  function validateStageDraft(stage,stageState,state){
    const issues=[];
    if(!String(stageState.draftRecord||'').trim())issues.push('The stage record is empty.');
    if(/<<[^>]+>>/.test(String(stageState.draftRecord||'')))issues.push('The stage record still contains placeholders.');
    if(!stageState.decision)issues.push('Select the stage decision.');
    if(!String(stageState.decisionEvidence||'').trim())issues.push('Decision evidence is required.');
    for(const [label,map] of [['Human checklist',stageState.humanChecks],['Stage completion gate',stageState.gateChecks],['Evidence to preserve',stageState.evidenceChecks]]){
      const count=label==='Human checklist'?stageHumanItems(stage).length:label==='Stage completion gate'?stageGateItems(stage).length:stageEvidenceItems(stage).length;
      if(Array.from({length:count},(_,index)=>Boolean(map?.[index])).some(value=>!value))issues.push(`${label} is incomplete.`);
    }
    if(stage.number>1&&state?.stages?.[stage.number-1]?.status!=='COMPLETE')issues.push(`Stage ${String(stage.number-1).padStart(2,'0')} is not complete.`);
    const blockers=[...(state?.appendices?.B?.records||[]),...(state?.projectData?.blockers||[])].filter(record=>String(record.currentStatus||record.CURRENT_STATUS||record.fields?.CURRENT_STATUS||'OPEN').toUpperCase()==='OPEN');
    if(blockers.length&&stageState.decision!=='BLOCKED')issues.push('An open mandatory blocker requires a BLOCKED decision.');
    return {valid:issues.length===0,issues};
  }

  async function immutableRevision(revisions,payload,meta={}){
    const hash=await sha256Text(JSON.stringify(payload));
    const latest=(revisions||[]).at(-1);
    if(latest?.sha256===hash)return {changed:false,record:latest};
    const version=`v${String((revisions||[]).length+1).padStart(3,'0')}`;
    return {changed:true,record:{...meta,version,sha256:hash,createdAt:new Date().toISOString(),payload:JSON.parse(JSON.stringify(payload))}};
  }

  function invalidateDownstream(state,stageNumber,changeId){
    const invalidated=[];
    for(let number=stageNumber+1;number<=30;number++){
      const stage=state?.stages?.[number];if(!stage)continue;
      if(stage.status!=='NOT STARTED'||stage.decision||stage.decisionEvidence){invalidated.push(`STAGE-${String(number).padStart(2,'0')}`);}
      stage.status='NOT STARTED';stage.decision='';stage.decisionEvidence='';stage.nextStage='';stage.decidedBy='';stage.dateTime='';stage.invalidatedBy=changeId;
    }
    if(state?.release){state.release.gateState='';state.release.authorization='NOT AUTHORIZED';state.release.authorizedArtifactIds=[];}
    return invalidated;
  }

  function compareArtifactSets(audited=[],release=[],gateState=''){
    const comparisons=[];
    const count=Math.max(audited.length,release.length);
    for(let index=0;index<count;index++){
      const a=audited[index],r=release[index];
      comparisons.push({artifactId:a?.artifactId||`ARTIFACT-${String(index+1).padStart(3,'0')}`,auditedFile:a?.name||'MISSING',releaseFile:r?.name||'MISSING',auditedSha256:a?.sha256||'UNKNOWN',releaseSha256:r?.sha256||'UNKNOWN',hashesIdentical:Boolean(a&&r&&a.sha256===r.sha256),byteSizesIdentical:Boolean(a&&r&&Number(a.size)===Number(r.size))});
    }
    const exact=gateState==='ACCEPTED'&&audited.length>0&&audited.length===release.length&&comparisons.every(item=>item.hashesIdentical&&item.byteSizesIdentical);
    return {gateState,comparisons,authorization:exact?'AUTHORIZED':'NOT AUTHORIZED'};
  }

  const fallback={SCHEMA,STAGES,APPENDICES,STAGE_DECISIONS,createBlankState,migrateState:project=>project?.schema===SCHEMA?project:createBlankState(),stageHumanItems,stageGateItems,stageEvidenceItems,buildStagePrompt,validateStageDraft,parseRecordFields,sha256Bytes,sha256Text,immutableRevision,invalidateDownstream,compareArtifactSets};

  function expose(runtime){
    const originalStages=runtime.STAGES||STAGES;
    const originalAppendices=runtime.APPENDICES||APPENDICES;
    const stages=Object.freeze(cleanDeep(originalStages));
    const appendices=Object.freeze(cleanDeep(originalAppendices));
    const stageByNumber=new Map(originalStages.map(stage=>[stage.number,stage]));
    globalThis.closedLoopCore={
      ...fallback,
      ...runtime,
      STAGES:stages,
      APPENDICES:appendices,
      buildStagePrompt:(stage,state)=>clean((runtime.buildStagePrompt||buildStagePrompt)(stageByNumber.get(stage.number)||stage,state)),
      stageHumanItems:stage=>cleanDeep((runtime.stageHumanItems||stageHumanItems)(stageByNumber.get(stage.number)||stage)),
      stageGateItems:stage=>cleanDeep((runtime.stageGateItems||stageGateItems)(stageByNumber.get(stage.number)||stage)),
      stageEvidenceItems:stage=>cleanDeep((runtime.stageEvidenceItems||stageEvidenceItems)(stageByNumber.get(stage.number)||stage))
    };
  }

  try{
    if(typeof DecompressionStream!=='function')throw new Error('Compressed runtime APIs are unavailable.');
    const names=['workbook.module.gz.1','workbook.module.gz.2','workbook.module.gz.3'];
    const responses=await Promise.all(names.map(name=>fetch(`${name}?runtime=30`,{cache:'no-store'})));
    for(const response of responses)if(!response.ok)throw new Error(`Workflow runtime load failed: HTTP ${response.status}`);
    const parts=await Promise.all(responses.map(response=>response.arrayBuffer()));
    const total=parts.reduce((sum,part)=>sum+part.byteLength,0),bytes=new Uint8Array(total);let offset=0;
    for(const part of parts){bytes.set(new Uint8Array(part),offset);offset+=part.byteLength;}
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const source=await new Response(stream).text();
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));let runtime;
    try{runtime=await import(url);}finally{URL.revokeObjectURL(url);}
    expose(runtime);
  }catch(error){
    console.error('Using the built-in 30-stage runtime because the optimized runtime could not load.',error);
    expose(fallback);
  }

  dispatchEvent(new Event('closed-loop-core-ready'));
})();
