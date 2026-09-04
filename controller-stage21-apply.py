from pathlib import Path
import re

engine_path=Path('workflow-engine.js')
engine=engine_path.read_text()

replacement=r'''function acceptedEmptyUniverseReview(project,metricId,scopeRule=currentScope(project)){
  const target='EMPTY_UNIVERSE:'+String(metricId||''),scope=scopeRule||currentScope(project),evidenceById=new Map(records(project,'evidenceRecords').map(record=>[recordId(record,'evidenceRecords'),record]));
  const reviews=recordsForScope(project,'semanticReviews',scope).filter(review=>{
    const author=String(recordValue(review,'AUTHOR_CONTEXT_ID')||''),reviewer=String(recordValue(review,'REVIEWER_CONTEXT_ID')||''),authorReservation=String(recordValue(review,'AUTHOR_RESERVATION_ID')||''),reviewerReservation=String(recordValue(review,'REVIEWER_RESERVATION_ID')||''),independence=upper(recordValue(review,'INDEPENDENCE_DETERMINATION')),result=upper(recordValue(review,'RESULT')),accepted=upper(recordValue(review,'ACCEPTED_DISPOSITION')),reconciliation=upper(recordValue(review,'RECONCILIATION_STATUS')),question=String(recordValue(review,'REVIEW_QUESTION')||'').trim(),evidenceIds=safe(review.evidenceRefs).map(String);
    if(question!==target||result!=='ACCEPTED'||accepted!=='EMPTY_UNIVERSE')return false;
    if(!['APPLICATION_ESTABLISHED','EXTERNALLY_SUPPORTED'].includes(independence)||!author||!reviewer||author===reviewer||!authorReservation||!reviewerReservation||authorReservation===reviewerReservation)return false;
    if(['REQUIRED','DISAGREED','UNKNOWN','BLOCKED'].includes(reconciliation))return false;
    if(!evidenceIds.length||evidenceIds.some(id=>!evidenceById.has(id)||!isActiveRecord(evidenceById.get(id))))return false;
    return true;
  });
  if(reviews.length!==1)return null;
  const review=reviews[0];return {review,evidenceIds:safe(review.evidenceRefs).map(String)};
}
function closedMetricFromUniverse(project,{metricId,universeDefinition='',universeIds=[],includedIds=[],excludedIds=[],scopeRule=currentScope(project),derivationIdentity='closed-loop-metric/1'}={}){
  const rawUniverse=safe(universeIds).map(String),rawIncluded=safe(includedIds).map(String),universe=[...new Set(rawUniverse)],included=[...new Set(rawIncluded)],duplicateUniverse=universe.length!==rawUniverse.length,duplicateIncluded=included.length!==rawIncluded.length,universeSet=new Set(universe),outside=included.filter(id=>!universeSet.has(id)),denominator=universe.length,numerator=included.filter(id=>universeSet.has(id)).length,base={metricId:String(metricId||''),universeDefinition:String(universeDefinition||''),numerator,denominator,includedIds:included.filter(id=>universeSet.has(id)),excludedIds:safe(excludedIds),scopeHash:hash.sha256Value(scopeRule||{}),derivationIdentity,evidenceReferences:[]};
  if(duplicateUniverse||duplicateIncluded||outside.length)return {...base,value:null,disposition:'BLOCKED',reasons:[duplicateUniverse?'DUPLICATE_UNIVERSE_ID':null,duplicateIncluded?'DUPLICATE_INCLUDED_ID':null,outside.length?'INCLUDED_ID_OUTSIDE_UNIVERSE':null].filter(Boolean)};
  if(denominator===0){const accepted=acceptedEmptyUniverseReview(project,metricId,scopeRule);if(!accepted)return {...base,value:null,disposition:'BLOCKED',reasons:['EMPTY_UNIVERSE_REVIEW_REQUIRED']};return {...base,value:1,disposition:'SATISFIED',evidenceReferences:[recordId(accepted.review,'semanticReviews'),...accepted.evidenceIds],reasons:[]};}
  const value=numerator/denominator;return {...base,value,disposition:numerator===denominator?'SATISFIED':'BLOCKED',reasons:numerator===denominator?[]:['INCOMPLETE_CLOSED_UNIVERSE']};
}
function stage18RegressionIsDue(record){
  if(!isActiveRecord(record)||upper(recordValue(record,'ACTIVE_RETIRED_STATE')||'ACTIVE')==='RETIRED')return false;
  const applicability=upper(recordValue(record,'APPLICABILITY'));if(['NOT APPLICABLE','INAPPLICABLE','FALSE'].includes(applicability))return false;
  const phase=upper(recordValue(record,'VERIFICATION_PHASE')||'PREPRODUCT_ITERATION');if(phase!=='PREPRODUCT_ITERATION')return false;
  const earliestRaw=recordValue(record,'EARLIEST_EXECUTABLE_STAGE'),requiredRaw=recordValue(record,'REQUIRED_BY_STAGE'),earliest=earliestRaw===undefined||earliestRaw===null||earliestRaw===''?15:Number(earliestRaw),required=requiredRaw===undefined||requiredRaw===null||requiredRaw===''?18:Number(requiredRaw);
  if(!Number.isFinite(earliest)||!Number.isFinite(required)||earliest>18||required>18)return false;
  return true;
}
function coverageMetrics(project,iterationIdOverride=null){
  const iterationId=iterationIdOverride||recordId(latestIteration(project,[10,17,19]),'iterations')||project.job.CURRENT_ITERATION||'',scope=iterationId?scopeForIteration(project,iterationId):currentScope(project),requirements=mandatoryRequirements(project,scope),tests=iterationId?recordsForScope(project,'tests',scope):recordsForCurrentScope(project,'tests'),covered=new Set(tests.map(testRequirementId).filter(Boolean)),requirementIds=requirements.map(requirementId),coveredRequirementIds=requirements.filter(req=>covered.has(requirementId(req))).map(requirementId),requirementMetric=closedMetricFromUniverse(project,{metricId:'stage18.requirementCoverage',universeDefinition:'Current applicable mandatory requirements in the corrected Stage 17 iteration scope.',universeIds:requirementIds,includedIds:coveredRequirementIds,scopeRule:scope}),matrix=verificationMatrix(project,iterationId),verificationIncluded=matrix.expected.filter(key=>matrix.counts.get(key)===1),verificationMetric=closedMetricFromUniverse(project,{metricId:'stage18.verificationCoverage',universeDefinition:'Due PREPRODUCT_ITERATION REQ × RUN × TEST relations for the corrected iteration.',universeIds:matrix.expected,includedIds:verificationIncluded,scopeRule:scope}),regressions=records(project,'regressions').filter(stage18RegressionIsDue),executions=currentRegressionExecutions(project,iterationId),successful=new Set(executions.filter(r=>upper(recordValue(r,'PHASE'))!=='PRE_CORRECTION'&&effectiveRegressionDetermination(project,r).determination==='SATISFIED').map(r=>String(recordValue(r,'REG_ID')||r.relationships?.REG_ID||''))),regressionIds=regressions.map(r=>recordId(r,'regressions')),successfulRegressionIds=regressions.filter(r=>successful.has(recordId(r,'regressions'))).map(r=>recordId(r,'regressions')),regressionMetric=closedMetricFromUniverse(project,{metricId:'stage18.regressionSuccess',universeDefinition:'Current applicable due PREPRODUCT_ITERATION regressions at Stage 18.',universeIds:regressionIds,includedIds:successfulRegressionIds,scopeRule:scope});
  return {mandatoryRequirementCount:requirements.length,requirementsWithTests:coveredRequirementIds.length,requirementCoverage:requirementMetric.value,requirementMetric,iterationRunCount:matrix.runs.length,expectedVerificationCount:matrix.expected.length,actualVerificationPairCount:verificationIncluded.length,actualVerificationTripleCount:verificationIncluded.length,verificationCoverage:verificationMetric.value,verificationMetric,missingVerificationTriples:matrix.missing,duplicateVerificationTriples:matrix.duplicates,activeRegressionCount:regressionMetric.denominator,successfulRegressionCount:regressionMetric.numerator,regressionSuccess:regressionMetric.value,regressionMetric};
}
function convergenceMetrics(project){
  const latest=latestIteration(project,[17]),iterationId=recordId(latest,'iterations'),coverage=coverageMetrics(project,iterationId),material=unresolvedMaterialDefects(project).filter(r=>!iterationId||!r.scope?.iterationId||r.scope.iterationId===iterationId),critical=material.filter(r=>upper(recordValue(r,'SEVERITY'))==='CRITICAL').length,major=material.filter(r=>upper(recordValue(r,'SEVERITY'))==='MAJOR').length,verification=iterationId?recordsForIteration(project,'verification',iterationId):recordsForCurrentScope(project,'verification'),mandatoryUnknowns=verification.filter(r=>effectiveDetermination('verification',r,testForResult(project,r),project)!=='SATISFIED').length+openBlockers(project).length,comparisons=iterationId?recordsForIteration(project,'comparisons',iterationId):recordsForCurrentScope(project,'comparisons'),contradictions=detectCurrentContradictions(project).filter(x=>x.severity==='RELEASE_MATERIAL').length,ambiguities=comparisons.filter(r=>adjudicationAdverse(recordValue(r,'INTERPRETATION_VARIANCE'))).length,unexplainedVariance=comparisons.filter(r=>adjudicationAdverse(recordValue(r,'CORRECTNESS_AFFECTING_VARIANCE'))&&!truth(recordValue(r,'AUTHORIZED_VARIANCE'))).length,result={iterationId,requirementCoverage:coverage.requirementCoverage,verificationCoverage:coverage.verificationCoverage,regressionSuccess:coverage.regressionSuccess,requirementMetric:coverage.requirementMetric,verificationMetric:coverage.verificationMetric,regressionMetric:coverage.regressionMetric,criticalDefects:critical,majorDefects:major,mandatoryUnresolvedUnknowns:mandatoryUnknowns,contradictions,ambiguities,unexplainedVariance};
  result.converged=Boolean(iterationId)&&result.requirementMetric.disposition==='SATISFIED'&&result.verificationMetric.disposition==='SATISFIED'&&result.regressionMetric.disposition==='SATISFIED'&&result.requirementCoverage===1&&result.verificationCoverage===1&&result.regressionSuccess===1&&critical===0&&major===0&&mandatoryUnknowns===0&&contradictions===0&&ambiguities===0&&unexplainedVariance===0;return result;
}
function convergenceEvidenceSha256(metrics){return hash.sha256Value({derivationKey:'stage18.convergence',iterationId:metrics.iterationId||'',requirementMetric:metrics.requirementMetric,verificationMetric:metrics.verificationMetric,regressionMetric:metrics.regressionMetric,criticalDefects:metrics.criticalDefects,majorDefects:metrics.majorDefects,mandatoryUnresolvedUnknowns:metrics.mandatoryUnresolvedUnknowns,contradictions:metrics.contradictions,ambiguities:metrics.ambiguities,unexplainedVariance:metrics.unexplainedVariance,converged:metrics.converged});}
function recordConvergenceDetermination(project){
  ensureShape(project);const metrics=convergenceMetrics(project),evidenceSha256=convergenceEvidenceSha256(metrics),scope=metrics.iterationId?scopeForIteration(project,metrics.iterationId):currentScope(project),current=recordsForScope(project,'convergenceRecords',scope).filter(isActiveRecord),existing=current.find(record=>record.convergenceEvidenceSha256===evidenceSha256);if(existing)return existing;
  for(const prior of current){prior.active=false;prior.validity='SUPERSEDED';prior.invalidatedBy='CONVERGENCE-DEPENDENCY-CHANGED';refreshRecordHashes(prior,'convergenceRecords');}
  const record=commandRecord(project,'convergenceRecords',{ITERATION_ID:metrics.iterationId||'UNKNOWN',REQUIREMENT_COVERAGE:metrics.requirementCoverage,VERIFICATION_COVERAGE:metrics.verificationCoverage,REGRESSION_SUCCESS:metrics.regressionSuccess,CRITICAL_DEFECT_COUNT:metrics.criticalDefects,MAJOR_DEFECT_COUNT:metrics.majorDefects,MANDATORY_UNRESOLVED_UNKNOWN_COUNT:metrics.mandatoryUnresolvedUnknowns,CORRECTNESS_AFFECTING_CONTRADICTION_COUNT:metrics.contradictions,CORRECTNESS_AFFECTING_AMBIGUITY_COUNT:metrics.ambiguities,UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT:metrics.unexplainedVariance,CONVERGED:metrics.converged},{stage:18,source:'APPLICATION_DERIVATION',scope});record.convergenceEvidenceSha256=evidenceSha256;record.closedMetrics={requirement:metrics.requirementMetric,verification:metrics.verificationMetric,regression:metrics.regressionMetric};refreshRecordHashes(record,'convergenceRecords');addHistory(project,'CONVERGENCE_DETERMINATION_CALCULATED',{stage:18,recordId:recordId(record,'convergenceRecords'),iterationId:metrics.iterationId||null,converged:metrics.converged,convergenceEvidenceSha256:evidenceSha256});recalculate(project);return record;
}'''

pattern=re.compile(r"function coverageMetrics\(project,iterationIdOverride=null\)\{.*?\}\nfunction convergenceMetrics\(project\)\{.*?\}\n(?=function releaseVerificationTrust)",re.S)
engine,count=pattern.subn(replacement+'\n',engine,count=1)
if count!=1: raise SystemExit(f'convergence metric patch count {count}')

old="""    case 18:{
      requireAccepted();const metrics=convergenceMetrics(project);
      if(!metrics.converged)reasons.push('All convergence conditions are not simultaneously satisfied.');
      break;
    }"""
new="""    case 18:{
      const metrics=convergenceMetrics(project),scope=metrics.iterationId?scopeForIteration(project,metrics.iterationId):currentScope(project),determination=recordsForScope(project,'convergenceRecords',scope).filter(isActiveRecord).at(-1),expectedEvidenceSha256=convergenceEvidenceSha256(metrics);
      if(!determination)reasons.push('The application has not recorded the current Stage 18 convergence determination.');
      else if(determination.convergenceEvidenceSha256!==expectedEvidenceSha256)reasons.push('The current Stage 18 convergence determination is stale for the current dependency closure.');
      if(!metrics.converged)reasons.push('All convergence conditions are not simultaneously satisfied.');
      break;
    }"""
if old not in engine: raise SystemExit('Stage 18 gate marker missing')
engine=engine.replace(old,new,1)

old_counts="TOTAL_STILL_APPLICABLE_REGRESSION_TESTS:regs.length,SUCCESSFUL_REGRESSION_TESTS:Math.round(regs.length*convergence.regressionSuccess),REGRESSION_TEST_SUCCESS:convergence.regressionSuccess"
new_counts="TOTAL_STILL_APPLICABLE_REGRESSION_TESTS:convergence.regressionMetric.denominator,SUCCESSFUL_REGRESSION_TESTS:convergence.regressionMetric.numerator,REGRESSION_TEST_SUCCESS:convergence.regressionSuccess"
if old_counts not in engine: raise SystemExit('Stage 18 derived regression counts marker missing')
engine=engine.replace(old_counts,new_counts,1)

old_actions="const ACTION_TYPES=Object.freeze(['RUN_APP_TESTS','CALCULATE_RELEASE'"
new_actions="const ACTION_TYPES=Object.freeze(['RUN_APP_TESTS','CALCULATE_CONVERGENCE','CALCULATE_RELEASE'"
if old_actions not in engine: raise SystemExit('ACTION_TYPES marker missing')
engine=engine.replace(old_actions,new_actions,1)

stage19_marker="""  if(stage===19){
    const iteration=latestIteration(project,[19]),iterationId=recordId(iteration,'iterations');"""
stage18_action="""  if(stage===18){
    const metrics=convergenceMetrics(project),scope=metrics.iterationId?scopeForIteration(project,metrics.iterationId):currentScope(project),determination=recordsForScope(project,'convergenceRecords',scope).filter(isActiveRecord).at(-1),currentEvidenceSha256=convergenceEvidenceSha256(metrics);
    if(!determination||determination.convergenceEvidenceSha256!==currentEvidenceSha256)return actionEnvelope(project,stage,{actionType:'CALCULATE_CONVERGENCE',heading:'Calculate current convergence',explanation:'Stage 18 is application-owned. The application will calculate the complete current due PREPRODUCT_ITERATION requirement, verification, regression, contradiction, defect, unknown, ambiguity, and variance universes and record an idempotent convergence determination. No external DATA_PROPOSAL or human approval is used for this calculation.',primaryButton:'Calculate convergence'});
    if(!metrics.converged)return actionEnvelope(project,stage,{actionType:'BLOCKED',heading:'Convergence is not established',explanation:'The current application-owned convergence determination is preserved, but one or more required closed-universe conditions are not simultaneously satisfied. Correct the earliest responsible upstream layer and rerun the affected path.',blockingReason:gate(18,project).reasons.join('; ')});
  }
"""
if stage19_marker not in engine: raise SystemExit('Stage 19 action marker missing')
engine=engine.replace(stage19_marker,stage18_action+stage19_marker,1)

export_marker="recordHumanInputVersion,recordStageConfirmation,recordReleaseDetermination,acceptedControlEvents"
export_replacement="recordHumanInputVersion,recordStageConfirmation,closedMetricFromUniverse,recordConvergenceDetermination,recordReleaseDetermination,acceptedControlEvents"
if export_marker not in engine: raise SystemExit('engine export marker missing')
engine=engine.replace(export_marker,export_replacement,1)
engine_path.write_text(engine)

app_path=Path('app-core.js')
app=app_path.read_text()
old="RUN_APP_TESTS:'Application',CALCULATE_RELEASE:'Application'"
new="RUN_APP_TESTS:'Application',CALCULATE_CONVERGENCE:'Application',CALCULATE_RELEASE:'Application'"
if old not in app: raise SystemExit('app action actor marker missing')
app=app.replace(old,new,1)
old="action.actionType==='RUN_APP_TESTS'?`<button class=\"primary\" id=\"run-native-tests\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='CALCULATE_RELEASE'"
new="action.actionType==='RUN_APP_TESTS'?`<button class=\"primary\" id=\"run-native-tests\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='CALCULATE_CONVERGENCE'?`<button class=\"primary\" id=\"calculate-stage18-convergence\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='CALCULATE_RELEASE'"
if old not in app: raise SystemExit('app action button marker missing')
app=app.replace(old,new,1)
old="if($('#run-native-tests'))$('#run-native-tests').onclick=()=>{if(Number(current.activeStage)!==22)"
handler="""if($('#calculate-stage18-convergence'))$('#calculate-stage18-convergence').onclick=async()=>{try{if(Number(current.activeStage)!==18)throw new Error('Convergence calculation belongs only to Stage 18.');const next=clone(current);engine.recordConvergenceDetermination(next);await persistReplacement(next);announce('convergence determination calculated');render();requestAnimationFrame(()=>$('#next-required-action')?.focus());}catch(error){announce('convergence calculation blocked');alert(error.message||error);}};"""
if old not in app: raise SystemExit('app wire marker missing')
app=app.replace(old,handler+old,1)
old="17:'The corrected candidate is rerun through the complete ten-execution verification loop.',19:'The unchanged final candidate"
new="17:'The corrected candidate is rerun through the complete ten-execution verification loop.',18:'The application calculates convergence only from current due preproduct requirements, verification, regressions, contradictions, defects, unknowns, ambiguity, and unexplained variance. No external response or human approval sets this calculation.',19:'The unchanged final candidate"
if old not in app: raise SystemExit('Stage purpose marker missing')
app=app.replace(old,new,1)
app_path.write_text(app)

cycle_path=Path('verify-full-cycle.mjs')
cycle=cycle_path.read_text()
old="data(18,{stageData:{RETURN_STAGE_FOR_EACH_FAILURE:'NONE'}});complete(18);"
new="engine.recordConvergenceDetermination(p);complete(18);"
if old not in cycle: raise SystemExit('full-cycle Stage 18 marker missing')
cycle_path.write_text(cycle.replace(old,new,1))
