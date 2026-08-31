from pathlib import Path

p=Path('workflow-engine.js')
s=p.read_text()
# Add application convergence action type.
s=s.replace("const ACTION_TYPES=Object.freeze(['RUN_APP_TESTS','CALCULATE_RELEASE'", "const ACTION_TYPES=Object.freeze(['RUN_APP_TESTS','CALCULATE_CONVERGENCE','CALCULATE_RELEASE'", 1)
# Replace Stage 18 gate so an external accepted response is not required.
old="""    case 18:{
      requireAccepted();const metrics=convergenceMetrics(project);
      if(!metrics.converged)reasons.push('All convergence conditions are not simultaneously satisfied.');
      break;
    }"""
new="""    case 18:{
      const metrics=convergenceMetrics(project),rows=recordsForCurrentScope(project,'convergenceRecords').filter(r=>Number(r.stage)===18),expectedHash=hash.sha256Value({scope:currentScope(project),metrics});
      if(rows.length!==1)reasons.push(`Exactly one current application convergence record is required; found ${rows.length}.`);
      const row=rows[0];
      if(row){
        if(String(recordValue(row,'ITERATION_ID')||row.relationships?.ITERATION_ID||'')!==String(metrics.iterationId||''))reasons.push('The convergence record is not bound to the latest corrected iteration.');
        if(String(recordValue(row,'EVIDENCE')||'')!==expectedHash)reasons.push('The convergence record is stale relative to the current application metrics.');
        if(Boolean(recordValue(row,'CONVERGED'))!==Boolean(metrics.converged))reasons.push('The convergence record does not match the application convergence calculation.');
      }
      if(!metrics.converged)reasons.push('All convergence conditions are not simultaneously satisfied.');
      break;
    }"""
if old not in s: raise SystemExit('Stage 18 gate anchor missing')
s=s.replace(old,new,1)
# Add application-owned convergence recorder before release recorder.
anchor="""function recordReleaseDetermination(project){"""
helper="""function convergenceFailedConditions(metrics){const failed=[];if(metrics.requirementCoverage!==1)failed.push('MANDATORY_REQUIREMENT_COVERAGE');if(metrics.verificationCoverage!==1)failed.push('MANDATORY_VERIFICATION_COVERAGE');if(metrics.regressionSuccess!==1)failed.push('REGRESSION_TEST_SUCCESS');if(metrics.criticalDefects)failed.push('CRITICAL_DEFECTS');if(metrics.majorDefects)failed.push('MAJOR_DEFECTS');if(metrics.mandatoryUnresolvedUnknowns)failed.push('MANDATORY_UNRESOLVED_UNKNOWNS');if(metrics.contradictions)failed.push('KNOWN_CORRECTNESS_AFFECTING_CONTRADICTIONS');if(metrics.ambiguities)failed.push('KNOWN_CORRECTNESS_AFFECTING_AMBIGUITIES');if(metrics.unexplainedVariance)failed.push('UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE');return failed;}
function convergenceReturnStages(failed){const map={MANDATORY_REQUIREMENT_COVERAGE:4,MANDATORY_VERIFICATION_COVERAGE:12,REGRESSION_TEST_SUCCESS:15,CRITICAL_DEFECTS:14,MAJOR_DEFECTS:14,MANDATORY_UNRESOLVED_UNKNOWNS:4,KNOWN_CORRECTNESS_AFFECTING_CONTRADICTIONS:13,KNOWN_CORRECTNESS_AFFECTING_AMBIGUITIES:13,UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE:13};return [...new Set(failed.map(x=>map[x]).filter(Boolean))].sort((a,b)=>a-b);}
function recordConvergenceDetermination(project){
  ensureShape(project);const metrics=convergenceMetrics(project);if(!metrics.iterationId)throw new Error('Stage 18 cannot calculate convergence until a current corrected iteration exists.');
  const scope=currentScope(project),evidence=hash.sha256Value({scope,metrics}),current=recordsForCurrentScope(project,'convergenceRecords').filter(r=>Number(r.stage)===18),existing=current.find(r=>String(recordValue(r,'EVIDENCE')||'')===evidence&&String(recordValue(r,'ITERATION_ID')||r.relationships?.ITERATION_ID||'')===String(metrics.iterationId));
  if(existing)return existing;
  for(const prior of records(project,'convergenceRecords')){prior.active=false;prior.validity='SUPERSEDED';prior.supersededBy='APPLICATION_CONVERGENCE_RECALCULATION';refreshRecordHashes(prior,'convergenceRecords');}
  const failed=convergenceFailedConditions(metrics),id=allocateId(project,'convergenceRecords'),fields={CONVERGENCE_ID:id,ITERATION_ID:metrics.iterationId,REQUIREMENT_COVERAGE:metrics.requirementCoverage,VERIFICATION_COVERAGE:metrics.verificationCoverage,REGRESSION_SUCCESS:metrics.regressionSuccess,CRITICAL_DEFECT_COUNT:metrics.criticalDefects,MAJOR_DEFECT_COUNT:metrics.majorDefects,MANDATORY_UNRESOLVED_UNKNOWN_COUNT:metrics.mandatoryUnresolvedUnknowns,CORRECTNESS_AFFECTING_CONTRADICTION_COUNT:metrics.contradictions,CORRECTNESS_AFFECTING_AMBIGUITY_COUNT:metrics.ambiguities,UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT:metrics.unexplainedVariance,CONVERGED:Boolean(metrics.converged),FAILED_CONDITIONS:failed,RETURN_STAGES:convergenceReturnStages(failed),EVIDENCE:evidence};
  const record={id,stage:18,active:true,source:'APPLICATION_DERIVATION',scope:{...scope,iterationId:metrics.iterationId},relationships:{ITERATION_ID:metrics.iterationId},fields,...fields,createdAt:now()};refreshRecordHashes(record,'convergenceRecords');project.projectData.convergenceRecords.push(record);addHistory(project,'APPLICATION_CONVERGENCE_RECORDED',{stage:18,convergenceId:id,iterationId:metrics.iterationId,converged:Boolean(metrics.converged),evidence});recalculate(project);return record;
}
function recordReleaseDetermination(project){"""
if anchor not in s: raise SystemExit('release recorder anchor missing')
s=s.replace(anchor,helper,1)
# Make operational next action application-owned at Stage 18.
needle="""  if(stage===19){"""
insert="""  if(stage===18){
    const metrics=convergenceMetrics(project),rows=recordsForCurrentScope(project,'convergenceRecords').filter(r=>Number(r.stage)===18),expectedHash=hash.sha256Value({scope:currentScope(project),metrics}),currentRow=rows.length===1&&String(recordValue(rows[0],'EVIDENCE')||'')===expectedHash?rows[0]:null;
    if(!currentRow)return actionEnvelope(project,stage,{actionType:'CALCULATE_CONVERGENCE',heading:'Calculate current convergence',explanation:'The application will calculate mandatory requirement coverage, verification coverage, regression success, current defects, unknowns, contradictions, ambiguities, and unexplained variance from the latest corrected iteration and persist one current convergence record. No external agent response is required for this application-owned calculation.',primaryButton:'Calculate convergence'});
    if(!metrics.converged){const failed=convergenceFailedConditions(metrics),returns=convergenceReturnStages(failed);return actionEnvelope(project,stage,{actionType:'BLOCKED',heading:'Convergence is not yet established',explanation:`Current application metrics fail: ${failed.join(', ')}.${returns.length?' Return to Stage '+returns.join(', Stage ')+'.':''}`,blockingReason:'All convergence conditions must be simultaneously satisfied before unchanged confirmation can begin.'});}
  }
  if(stage===19){"""
if needle not in s: raise SystemExit('Stage 19 action anchor missing')
s=s.replace(needle,insert,1)
# Export recorder.
exp="recordHumanDecision,recordHumanInspectionEvidence,invalidateAcceptedResponse"
if exp not in s: raise SystemExit('engine export anchor missing')
s=s.replace(exp,"recordHumanDecision,recordHumanInspectionEvidence,recordConvergenceDetermination,invalidateAcceptedResponse",1)
p.write_text(s)

# app-core: expose button and lock response/prompt while convergence is application-owned.
p=Path('app-core.js');s=p.read_text()
s=s.replace("RUN_APP_TESTS:'Application',CALCULATE_RELEASE:'Application'", "RUN_APP_TESTS:'Application',CALCULATE_CONVERGENCE:'Application',CALCULATE_RELEASE:'Application'", 1)
s=s.replace("action.actionType==='RUN_APP_TESTS'?`<button class=\"primary\" id=\"run-native-tests\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='CALCULATE_RELEASE'?", "action.actionType==='RUN_APP_TESTS'?`<button class=\"primary\" id=\"run-native-tests\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='CALCULATE_CONVERGENCE'?`<button class=\"primary\" id=\"calculate-stage18-convergence\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='CALCULATE_RELEASE'?", 1)
for old,new in [
("['RUN_APP_TESTS','CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS'", "['RUN_APP_TESTS','CALCULATE_CONVERGENCE','CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS'"),
("new Set(['RUN_APP_TESTS','CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS'", "new Set(['RUN_APP_TESTS','CALCULATE_CONVERGENCE','CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS'")]:
    s=s.replace(old,new)
# Add specific explanation alongside release/evidence-chain application-only prompt text.
s=s.replace("displayedStageAction(n).actionType==='CALCULATE_RELEASE'?'No external instruction is used while the application calculates the release determination", "displayedStageAction(n).actionType==='CALCULATE_CONVERGENCE'?'No external instruction is used while the application calculates convergence from the latest current iteration. No agent or human may set the convergence result.':displayedStageAction(n).actionType==='CALCULATE_RELEASE'?'No external instruction is used while the application calculates the release determination", 1)
s=s.replace("displayedStageAction(n).actionType==='CALCULATE_RELEASE'?'No agent response belongs to the application-owned release calculation step.", "displayedStageAction(n).actionType==='CALCULATE_CONVERGENCE'?'No agent response belongs to the application-owned convergence calculation step. Calculate convergence first.':displayedStageAction(n).actionType==='CALCULATE_RELEASE'?'No agent response belongs to the application-owned release calculation step.", 1)
# Wire the action button.
wire="""function wire(){"""
replacement="""function wire(){if($('#calculate-stage18-convergence'))$('#calculate-stage18-convergence').onclick=async()=>{try{if(Number(current.activeStage)!==18)throw new Error('Convergence calculation belongs only to Stage 18.');const next=clone(current);engine.recordConvergenceDetermination(next);await persistReplacement(next);announce('convergence calculated');render();requestAnimationFrame(()=>$('#next-required-action')?.focus());}catch(error){announce('convergence calculation blocked');alert(error.message||error);}};"""
if wire not in s: raise SystemExit('wire anchor missing')
s=s.replace(wire,replacement,1)
s=s.replace("const RUNTIME_BUILD_ID='runtime-20260830-live-operator-64';", "const RUNTIME_BUILD_ID='runtime-20260830-live-operator-65';", 1)
p.write_text(s)

# Keep shared cache identity; no markup/CSS geometry changes.
for name in ['index.html','test-runtime.js']:
    f=Path(name);f.write_text(f.read_text().replace('runtime-20260830-live-operator-64','runtime-20260830-live-operator-65'))
