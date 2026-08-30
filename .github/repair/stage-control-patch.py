from pathlib import Path

engine = Path('workflow-engine.js')
s = engine.read_text()
old = "const ACTION_TYPES=Object.freeze(['RUN_APP_TESTS','CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS','AI_REVIEW','EXTERNAL_AGENT_TOOL','HUMAN_INSPECTION','EXTERNAL_SYSTEM','ATTACH_REQUIRED_FILES','CONTINUE_AGENT_CONVERSATION','PASTE_FINAL_JSON','REVIEW_PROPOSAL','BLOCKED','COMPLETE']);"
new = "const ACTION_TYPES=Object.freeze(['RUN_APP_TESTS','CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS','FREEZE_CANDIDATE','RESERVE_RUN_BATCH','BEGIN_UNCHANGED_CONFIRMATION','FREEZE_BASELINE','REGISTER_PRODUCTION_CONTEXT','RESERVE_PRODUCT_EXECUTION','AI_REVIEW','EXTERNAL_AGENT_TOOL','HUMAN_INSPECTION','EXTERNAL_SYSTEM','ATTACH_REQUIRED_FILES','CONTINUE_AGENT_CONVERSATION','PASTE_FINAL_JSON','REVIEW_PROPOSAL','BLOCKED','COMPLETE']);"
assert old in s, 'ACTION_TYPES declaration changed unexpectedly'
s = s.replace(old, new, 1)
marker = "  if(stage===16){const correction=stage16CorrectionPlan(project);if(correction.actionType==='BLOCKED')return actionEnvelope(project,stage,{actionType:'BLOCKED',heading:correction.heading,explanation:correction.explanation,blockingReason:correction.explanation});if(correction.actionType==='HUMAN_AUTHORITY')return actionEnvelope(project,stage,{actionType:'CONTINUE_AGENT_CONVERSATION',heading:correction.heading,explanation:correction.explanation,primaryButton:'Provide human authority'});return actionEnvelope(project,stage,{actionType:'REVIEW_PROPOSAL',heading:correction.heading,explanation:correction.explanation,primaryButton:'Review correction'});}\n\n"
assert marker in s, 'Stage 16 action marker changed unexpectedly'
insert = """  if(stage===10&&acceptedChanges(project,10).length){
    const freezes=recordsForCurrentScope(project,'candidateFreezes').filter(r=>Number(r.stage)===10&&isActiveRecord(r));
    if(!freezes.length)return actionEnvelope(project,stage,{actionType:'FREEZE_CANDIDATE',heading:'Freeze the exact test candidate',explanation:'Select the exact verified component files for this candidate. The application allocates iteration/candidate identities, hashes the actual bytes, freezes the component set, and prevents in-place mutation. No additional agent response belongs to this control step.',primaryButton:'Freeze candidate'});
  }
  if(stage===11){
    const iteration=latestIteration(project,[10]),iterationId=recordId(iteration,'iterations');
    if(iterationId){const runs=records(project,'runs').filter(r=>isActiveRecord(r)&&String(recordValue(r,'ITERATION_ID')||r.relationships?.ITERATION_ID||r.scope?.iterationId||'')===iterationId);if(!runs.length)return actionEnvelope(project,stage,{actionType:'RESERVE_RUN_BATCH',heading:'Reserve the ten independent execution lanes',explanation:'The application must create exactly ten current run identities and ten fresh context identities for the frozen candidate before any run prompt is sent. You do not allocate run IDs or context IDs.',primaryButton:'Reserve 10 runs'});if(runs.length!==10)return actionEnvelope(project,stage,{actionType:'BLOCKED',heading:'Run reservation is inconsistent',explanation:'The current iteration contains '+runs.length+' reserved run records instead of exactly ten. Do not create ad hoc runs or reuse contexts.',blockingReason:'Exactly ten application-reserved run lanes are required.'});}
  }
  if(stage===17){
    const iteration=latestIteration(project,[17]),iterationId=recordId(iteration,'iterations'),freeze=recordsForCurrentScope(project,'candidateFreezes').filter(r=>Number(r.stage)===17&&isActiveRecord(r)).at(-1);
    if(!iterationId||!freeze)return actionEnvelope(project,stage,{actionType:'FREEZE_CANDIDATE',heading:'Freeze the corrected candidate',explanation:'Select the exact corrected candidate files. The application creates the new iteration/candidate identities, hashes the exact bytes, preserves the prior candidate, and determines downstream scope. Do not continue an old execution conversation.',primaryButton:'Freeze corrected candidate'});
    const runs=records(project,'runs').filter(r=>isActiveRecord(r)&&String(recordValue(r,'ITERATION_ID')||r.relationships?.ITERATION_ID||r.scope?.iterationId||'')===iterationId);
    if(!runs.length)return actionEnvelope(project,stage,{actionType:'RESERVE_RUN_BATCH',heading:'Reserve ten new corrected-run lanes',explanation:'The corrected iteration requires exactly ten new independent run/context identities before execution. The application allocates them; prior run conversations and outputs remain outside authorized inputs.',primaryButton:'Reserve 10 runs'});
    if(runs.length!==10)return actionEnvelope(project,stage,{actionType:'BLOCKED',heading:'Corrected run reservation is inconsistent',explanation:'The corrected iteration contains '+runs.length+' current run records instead of exactly ten.',blockingReason:'Exactly ten application-reserved corrected run lanes are required.'});
  }
  if(stage===19){
    const iteration=latestIteration(project,[19]),iterationId=recordId(iteration,'iterations');
    if(!iterationId)return actionEnvelope(project,stage,{actionType:'BEGIN_UNCHANGED_CONFIRMATION',heading:'Begin the unchanged confirmation iteration',explanation:'The application first binds a new confirmation iteration to the exact converged candidate and proves the frozen versions/hashes are unchanged. No external CONFIRM_FREEZE prompt is required.',primaryButton:'Begin unchanged confirmation'});
    const runs=records(project,'runs').filter(r=>isActiveRecord(r)&&String(recordValue(r,'ITERATION_ID')||r.relationships?.ITERATION_ID||r.scope?.iterationId||'')===iterationId);
    if(!runs.length)return actionEnvelope(project,stage,{actionType:'RESERVE_RUN_BATCH',heading:'Reserve ten new confirmation lanes',explanation:'The unchanged confirmation requires ten new independent run/context identities. The application allocates them before any execution prompt is sent.',primaryButton:'Reserve 10 runs'});
    if(runs.length!==10)return actionEnvelope(project,stage,{actionType:'BLOCKED',heading:'Confirmation run reservation is inconsistent',explanation:'The confirmation iteration contains '+runs.length+' current run records instead of exactly ten.',blockingReason:'Exactly ten application-reserved confirmation run lanes are required.'});
  }
  if(stage===20&&acceptedChanges(project,20).length){
    const baselines=recordsForCurrentScope(project,'baselines').filter(isActiveRecord);
    if(!baselines.length)return actionEnvelope(project,stage,{actionType:'FREEZE_BASELINE',heading:'Authorize and freeze the production baseline',explanation:'Select the exact approved component files. The application binds them to the successful unchanged confirmation, computes byte identities, allocates the baseline identity, and freezes the immutable baseline.',primaryButton:'Freeze baseline'});
  }
  if(stage===21){
    const productionContext=records(project,'freshContexts').filter(r=>isActiveRecord(r)&&Number(r.stage)===21).at(-1);
    if(!productionContext)return actionEnvelope(project,stage,{actionType:'REGISTER_PRODUCTION_CONTEXT',heading:'Register a fresh production context',explanation:'Open a fresh external production conversation/context. Enter its identifier in the Stage 21 supporting-record control; the application binds it before creating the product execution.',primaryButton:'Register production context'});
    const products=recordsForCurrentScope(project,'products').filter(isActiveRecord);
    if(!products.length)return actionEnvelope(project,stage,{actionType:'RESERVE_PRODUCT_EXECUTION',heading:'Reserve the finished-product execution',explanation:'The application must allocate product/execution identities and bind them to the approved baseline and fresh production context before the Stage 21 production instruction is sent.',primaryButton:'Reserve product execution'});
  }

"""
s = s.replace(marker, marker + insert, 1)
engine.write_text(s)

app = Path('app-core.js')
s = app.read_text()
old = "function actionActor(action){return ({RUN_APP_TESTS:'Application',CALCULATE_RELEASE:'Application',BUILD_EVIDENCE_CHAINS:'Application',AI_REVIEW:'Fresh independent reviewer',EXTERNAL_AGENT_TOOL:'External tool-capable agent',HUMAN_INSPECTION:'Human operator',EXTERNAL_SYSTEM:'External system',ATTACH_REQUIRED_FILES:'Human operator',CONTINUE_AGENT_CONVERSATION:'Human and external agent',PASTE_FINAL_JSON:'Human operator',REVIEW_PROPOSAL:'Human operator',BLOCKED:'No executor until blocker is resolved',COMPLETE:'No further workflow execution'})[action.actionType]||'Current operator';}"
new = "function actionActor(action){return ({RUN_APP_TESTS:'Application',CALCULATE_RELEASE:'Application',BUILD_EVIDENCE_CHAINS:'Application',FREEZE_CANDIDATE:'Human operator and application',RESERVE_RUN_BATCH:'Application',BEGIN_UNCHANGED_CONFIRMATION:'Application',FREEZE_BASELINE:'Human operator and application',REGISTER_PRODUCTION_CONTEXT:'Human operator',RESERVE_PRODUCT_EXECUTION:'Application',AI_REVIEW:'Fresh independent reviewer',EXTERNAL_AGENT_TOOL:'External tool-capable agent',HUMAN_INSPECTION:'Human operator',EXTERNAL_SYSTEM:'External system',ATTACH_REQUIRED_FILES:'Human operator',CONTINUE_AGENT_CONVERSATION:'Human and external agent',PASTE_FINAL_JSON:'Human operator',REVIEW_PROPOSAL:'Human operator',BLOCKED:'No executor until blocker is resolved',COMPLETE:'No further workflow execution'})[action.actionType]||'Current operator';}"
assert old in s, 'actionActor changed unexpectedly'
s = s.replace(old, new, 1)
old = "action.actionType==='BUILD_EVIDENCE_CHAINS'?`<button class=\"primary\" id=\"build-evidence-chains\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='HUMAN_INSPECTION'?"
new = "action.actionType==='BUILD_EVIDENCE_CHAINS'?`<button class=\"primary\" id=\"build-evidence-chains\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='FREEZE_CANDIDATE'?`<button class=\"primary\" id=\"next-freeze-candidate\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='RESERVE_RUN_BATCH'?`<button class=\"primary\" id=\"next-reserve-run-batch\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='BEGIN_UNCHANGED_CONFIRMATION'?`<button class=\"primary\" id=\"next-begin-unchanged-confirmation\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='FREEZE_BASELINE'?`<button class=\"primary\" id=\"next-freeze-baseline\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='REGISTER_PRODUCTION_CONTEXT'?`<button class=\"primary\" id=\"next-register-production-context\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='RESERVE_PRODUCT_EXECUTION'?`<button class=\"primary\" id=\"next-reserve-product-execution\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='HUMAN_INSPECTION'?"
assert old in s, 'next-action button chain changed unexpectedly'
s = s.replace(old, new, 1)
old = "applicationOnlyInteraction=(n===22&&nativeStage22Tests().length>0)||n===28||['CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS'].includes(displayedStageAction(n).actionType)"
new = "applicationOnlyInteraction=(n===22&&nativeStage22Tests().length>0)||n===28||['CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS','FREEZE_CANDIDATE','RESERVE_RUN_BATCH','BEGIN_UNCHANGED_CONFIRMATION','FREEZE_BASELINE','REGISTER_PRODUCTION_CONTEXT','RESERVE_PRODUCT_EXECUTION'].includes(displayedStageAction(n).actionType)"
assert old in s, 'applicationOnlyInteraction changed unexpectedly'
s = s.replace(old, new, 1)
old = "if(['RUN_APP_TESTS','CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS'].includes(action.actionType))return `<div class=\"notice\"><strong>The application acts now.</strong><br>${esc(action.explanation||action.heading)} Do not send an agent prompt or paste final JSON until the application shows a new current action.</div>`;"
new = "if(['RUN_APP_TESTS','CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS','FREEZE_CANDIDATE','RESERVE_RUN_BATCH','BEGIN_UNCHANGED_CONFIRMATION','FREEZE_BASELINE','REGISTER_PRODUCTION_CONTEXT','RESERVE_PRODUCT_EXECUTION'].includes(action.actionType))return `<div class=\"notice\"><strong>Complete this control step now.</strong><br>${esc(action.explanation||action.heading)} Do not send an agent prompt or paste final JSON until the application shows a new current action.</div>`;"
assert old in s, 'interaction mode application-action list changed unexpectedly'
s = s.replace(old, new, 1)
wire = "function wire(){document.querySelectorAll('[data-view]')"
replacement = "function wire(){if($('#next-freeze-candidate'))$('#next-freeze-candidate').onclick=()=>$('#freeze-candidate')?.click();if($('#next-reserve-run-batch'))$('#next-reserve-run-batch').onclick=()=>reserveRunBatch();if($('#next-begin-unchanged-confirmation'))$('#next-begin-unchanged-confirmation').onclick=()=>$('#begin-unchanged-confirmation')?.click();if($('#next-freeze-baseline'))$('#next-freeze-baseline').onclick=()=>$('#freeze-baseline')?.click();if($('#next-register-production-context'))$('#next-register-production-context').onclick=()=>{const input=$('#fresh-context-id');const box=input?.closest('details');if(box)box.open=true;input?.scrollIntoView({behavior:'smooth',block:'center'});input?.focus();};if($('#next-reserve-product-execution'))$('#next-reserve-product-execution').onclick=()=>$('#reserve-product-execution')?.click();document.querySelectorAll('[data-view]')"
assert wire in s, 'wire() changed unexpectedly'
s = s.replace(wire, replacement, 1)
app.write_text(s)
