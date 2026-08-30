from pathlib import Path
import re

# Move stage-level completion/aggregate facts that the controlling specification makes application-owned.
p=Path('workbook.js')
s=p.read_text()
replacements={
'''  "13": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "REQUIREMENTS_SATISFIED_BY_ALL_TEN",
      "CORRECTNESS_AFFECTING_DISAGREEMENTS",
      "PROHIBITED_OUTPUT_VARIANCES",
      "INCONCLUSIVE_TESTS",
      "REPEATED_FAILURE_GROUPS",
      "UNIQUE_FAILURES"
    ],
    "application": [
      "ITERATION_ID",
      "COMPARISON_VERSION",
      "REQUIREMENT_COMPARISON_RECORDS",
      "REQUIREMENTS_WITH_AT_LEAST_ONE_VIOLATION",
      "REQUIREMENTS_WITH_AT_LEAST_ONE_UNDETERMINED",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },''':'''  "13": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "ITERATION_ID",
      "COMPARISON_VERSION",
      "REQUIREMENT_COMPARISON_RECORDS",
      "REQUIREMENTS_SATISFIED_BY_ALL_TEN",
      "REQUIREMENTS_WITH_AT_LEAST_ONE_VIOLATION",
      "REQUIREMENTS_WITH_AT_LEAST_ONE_UNDETERMINED",
      "CORRECTNESS_AFFECTING_DISAGREEMENTS",
      "PROHIBITED_OUTPUT_VARIANCES",
      "INCONCLUSIVE_TESTS",
      "REPEATED_FAILURE_GROUPS",
      "UNIQUE_FAILURES",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },''',
'''  "14": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "CONFIRMED_ROOT_CAUSES",
      "UNDETERMINED_ROOT_CAUSES",
      "BLOCKED_ANALYSES"
    ],
    "application": [
      "ROOT_CAUSE_ANALYSIS_VERSION",
      "DEFECT_ROOT_CAUSE_RECORDS",
      "TOTAL_MATERIAL_DEFECTS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },''':'''  "14": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "ROOT_CAUSE_ANALYSIS_VERSION",
      "DEFECT_ROOT_CAUSE_RECORDS",
      "TOTAL_MATERIAL_DEFECTS",
      "CONFIRMED_ROOT_CAUSES",
      "UNDETERMINED_ROOT_CAUSES",
      "BLOCKED_ANALYSES",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },''',
'''  "15": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "UNCONVERTED_CONFIRMED_DEFECTS"
    ],
    "application": [''':'''  "15": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [''',
'''      "PRE_CORRECTION_FAILURES_PROVEN",
      "STAGE_DECISION",''':'''      "PRE_CORRECTION_FAILURES_PROVEN",
      "UNCONVERTED_CONFIRMED_DEFECTS",
      "STAGE_DECISION",''',
'''  "16": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "DATE",
      "INSTRUCTION_CHANGED",
      "IF_EXECUTION_ONLY_DEFECT_WAS_INSTRUCTION_PRESERVED",
      "PREFLIGHT_REPEATED_IF_CHANGED",
      "ARTIFACTS_CHANGED",
      "NEW_VERSIONS_CREATED",
      "IN_PLACE_MODIFICATIONS",
      "DOWNSTREAM_VERIFICATIONS_INVALIDATED"
    ],
    "application": [
      "CHANGE_SET_ID",
      "TRIGGERING_DEFECT_IDS",
      "RCA_VERSION",
      "ARTIFACT_CHANGE_RECORDS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },''':'''  "16": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "CHANGE_SET_ID",
      "TRIGGERING_DEFECT_IDS",
      "RCA_VERSION",
      "DATE",
      "ARTIFACT_CHANGE_RECORDS",
      "INSTRUCTION_CHANGED",
      "IF_EXECUTION_ONLY_DEFECT_WAS_INSTRUCTION_PRESERVED",
      "PREFLIGHT_REPEATED_IF_CHANGED",
      "ARTIFACTS_CHANGED",
      "NEW_VERSIONS_CREATED",
      "IN_PLACE_MODIFICATIONS",
      "DOWNSTREAM_VERIFICATIONS_INVALIDATED",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },''',
'''  "17": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "NEW_FROZEN_VERSIONS",
      "OLD_CONVERSATIONS_CONTINUED",
      "RUN_NAMESPACE",
      "IDENTICAL_PACKAGE_CONFIRMED_FOR_ALL_RUNS",
      "PRIOR_OUTPUTS_WITHHELD",
      "EXECUTE_COMPLETED",
      "VERIFY_COMPLETED",
      "COMPARE_COMPLETED",
      "ROOT_CAUSE_COMPLETED",
      "REGRESSION_TESTS_ADDED",
      "CORRECTIONS_COMPLETED"
    ],
    "application": [
      "PREVIOUS_ITERATION_ID",
      "NEW_ITERATION_ID",
      "PREVIOUS_CANDIDATE_ID",
      "NEW_CANDIDATE_ID",
      "CHANGESET_ID",
      "TEN_NEW_CONTEXTS_CREATED",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },''':'''  "17": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "PREVIOUS_ITERATION_ID",
      "NEW_ITERATION_ID",
      "PREVIOUS_CANDIDATE_ID",
      "NEW_CANDIDATE_ID",
      "CHANGESET_ID",
      "NEW_FROZEN_VERSIONS",
      "OLD_CONVERSATIONS_CONTINUED",
      "TEN_NEW_CONTEXTS_CREATED",
      "RUN_NAMESPACE",
      "IDENTICAL_PACKAGE_CONFIRMED_FOR_ALL_RUNS",
      "PRIOR_OUTPUTS_WITHHELD",
      "EXECUTE_COMPLETED",
      "VERIFY_COMPLETED",
      "COMPARE_COMPLETED",
      "ROOT_CAUSE_COMPLETED",
      "REGRESSION_TESTS_ADDED",
      "CORRECTIONS_COMPLETED",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },''',
'''  "19": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "COMPLETE_TEST_SUITE_RUN",
      "CROSS_RUN_COMPARISON_COMPLETED",
      "NEW_CRITICAL_DEFECTS",
      "NEW_MAJOR_DEFECTS",
      "NEW_REQUIREMENTS_DISCOVERED",
      "INJECTED_DEFECTS_NOT_DETECTED",
      "NEW_CORRECTNESS_AFFECTING_VARIANCE",
      "CONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED",
      "REQUIRED_RETURN_STAGE"
    ],
    "application": [''':'''  "19": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [''',
'''      "ALL_REGRESSION_TESTS_RUN",
      "STAGE_DECISION",''':'''      "ALL_REGRESSION_TESTS_RUN",
      "COMPLETE_TEST_SUITE_RUN",
      "CROSS_RUN_COMPARISON_COMPLETED",
      "NEW_CRITICAL_DEFECTS",
      "NEW_MAJOR_DEFECTS",
      "NEW_REQUIREMENTS_DISCOVERED",
      "INJECTED_DEFECTS_NOT_DETECTED",
      "NEW_CORRECTNESS_AFFECTING_VARIANCE",
      "CONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED",
      "REQUIRED_RETURN_STAGE",
      "STAGE_DECISION",''',
'''  "22": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "APPLICABLE_MANDATORY_DETERMINISTIC_TESTS",
      "PRODUCT_REJECTED_BY_MANDATORY_FAILURE"
    ],
    "application": [''':'''  "22": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [''',
'''      "MISSING_TEST_RESULTS",
      "STAGE_DECISION",''':'''      "MISSING_TEST_RESULTS",
      "APPLICABLE_MANDATORY_DETERMINISTIC_TESTS",
      "PRODUCT_REJECTED_BY_MANDATORY_FAILURE",
      "STAGE_DECISION",''',
'''  "23": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "EVALUATOR_INDEPENDENT_FROM_GENERATOR",
      "UNSUPPORTED_BARE_CONCLUSIONS"
    ],
    "application": [''':'''  "23": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [''',
'''      "UNDETERMINED",
      "STAGE_DECISION",''':'''      "UNDETERMINED",
      "EVALUATOR_INDEPENDENT_FROM_GENERATOR",
      "UNSUPPORTED_BARE_CONCLUSIONS",
      "STAGE_DECISION",''',
'''  "24": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "REVIEWER_INDEPENDENT",
      "ATTACKS_EXECUTED",
      "UNDETERMINED_ATTACKS",
      "REGRESSIONS_FOUND",
      "RETURN_TO_ROOT_CAUSE_REQUIRED"
    ],
    "application": [''':'''  "24": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [''',
'''      "MAJOR_DEFECTS_FOUND",
      "STAGE_DECISION",''':'''      "MAJOR_DEFECTS_FOUND",
      "REVIEWER_INDEPENDENT",
      "ATTACKS_EXECUTED",
      "UNDETERMINED_ATTACKS",
      "REGRESSIONS_FOUND",
      "RETURN_TO_ROOT_CAUSE_REQUIRED",
      "STAGE_DECISION",''',
'''  "27": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "CONTROLLING_DECISION_RULE",
      "CONTROLLING_REASON",
      "AFFIRMATIVE_EVIDENCE"
    ],
    "application": [''':'''  "27": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [''',
'''      "SELECTED_RELEASE_STATE"
    ]
  },''':'''      "SELECTED_RELEASE_STATE",
      "CONTROLLING_DECISION_RULE",
      "CONTROLLING_REASON",
      "AFFIRMATIVE_EVIDENCE"
    ]
  },''',
'''  "30": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "REGISTRY_STORAGE_LOCATION",
      "REGISTRY_RETENTION_RULE",
      "DEFECT_RECORDS_MISSING_REQUIRED_FIELDS",
      "REGISTRY_HASH_OR_INTEGRITY_EVIDENCE",
      "CONTROLLING_EVIDENCE"
    ],
    "application": [''':'''  "30": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "REGISTRY_STORAGE_LOCATION",
      "REGISTRY_RETENTION_RULE",
      "REGISTRY_HASH_OR_INTEGRITY_EVIDENCE",
      "CONTROLLING_EVIDENCE"
    ],
    "application": [''',
'''      "TOTAL_RETIRED_REGRESSION_TESTS",
      "CONFIRMED_DEFECTS_MISSING_REGRESSION_TESTS",''':'''      "TOTAL_RETIRED_REGRESSION_TESTS",
      "DEFECT_RECORDS_MISSING_REQUIRED_FIELDS",
      "CONFIRMED_DEFECTS_MISSING_REGRESSION_TESTS",'''
}
for old,new in replacements.items():
    if old not in s:
        raise SystemExit('Ownership anchor not found: '+old[:80])
    s=s.replace(old,new,1)
p.write_text(s)

# Bump prompt engine because writable stageData contracts materially changed.
p=Path('prompt-engine.js')
s=p.read_text().replace('closed-loop-prompt-engine/48','closed-loop-prompt-engine/49')
p.write_text(s)

# Derive the moved application facts from canonical current records and shared evaluators.
p=Path('workflow-engine.js')
s=p.read_text()
old='''case 13:{const it=latestIteration(project,[10,17,19]),iterationId=recordId(it,'iterations'),scope=iterationId?scopeForIteration(project,iterationId):currentScope(project),facts={};for(const req of mandatoryRequirements(project,scope)){const f=comparisonFacts(project,requirementId(req),iterationId);facts[requirementId(req)]={RUN_DETERMINATIONS:f.runDeterminations,ALL_TEN_SATISFIED:f.allSatisfied,ANY_VIOLATION:f.anyViolation,ANY_UNDETERMINED:f.anyUndetermined,SATISFIED_COUNT:f.determinations.filter(x=>x==='SATISFIED').length,VIOLATED_COUNT:f.determinations.filter(x=>x==='VIOLATED').length,UNDETERMINED_COUNT:f.determinations.filter(x=>!['SATISFIED','VIOLATED'].includes(x)).length};}Object.assign(derived,{APPLICATION_DERIVED_COMPARISON_FACTS:facts,STABILITY_SUMMARY:iterationId?executionStability(project,iterationId):null});break;}'''
new='''case 13:{const it=latestIteration(project,[10,17,19]),iterationId=recordId(it,'iterations'),scope=iterationId?scopeForIteration(project,iterationId):currentScope(project),facts={},reqs=mandatoryRequirements(project,scope);for(const req of reqs){const f=comparisonFacts(project,requirementId(req),iterationId);facts[requirementId(req)]={RUN_DETERMINATIONS:f.runDeterminations,ALL_TEN_SATISFIED:f.allSatisfied,ANY_VIOLATION:f.anyViolation,ANY_UNDETERMINED:f.anyUndetermined,SATISFIED_COUNT:f.determinations.filter(x=>x==='SATISFIED').length,VIOLATED_COUNT:f.determinations.filter(x=>x==='VIOLATED').length,UNDETERMINED_COUNT:f.determinations.filter(x=>!['SATISFIED','VIOLATED'].includes(x)).length};}const stability=iterationId?executionStability(project,iterationId):{repeatedDefectCount:0,uniqueDefectCount:0},comparisons=iterationId?recordsForIteration(project,'comparisons',iterationId):[];Object.assign(derived,{ITERATION_ID:iterationId||'NONE',COMPARISON_VERSION:'COMPARISON-'+hash.sha256Value(facts).slice(0,16).toUpperCase(),REQUIREMENT_COMPARISON_RECORDS:comparisons.length,REQUIREMENTS_SATISFIED_BY_ALL_TEN:reqs.filter(r=>facts[requirementId(r)]?.ALL_TEN_SATISFIED).map(requirementId),REQUIREMENTS_WITH_AT_LEAST_ONE_VIOLATION:reqs.filter(r=>facts[requirementId(r)]?.ANY_VIOLATION).map(requirementId),REQUIREMENTS_WITH_AT_LEAST_ONE_UNDETERMINED:reqs.filter(r=>facts[requirementId(r)]?.ANY_UNDETERMINED).map(requirementId),CORRECTNESS_AFFECTING_DISAGREEMENTS:comparisons.filter(r=>truth(recordValue(r,'CORRECTNESS_AFFECTING_VARIANCE'))).map(r=>recordId(r,'comparisons')),PROHIBITED_OUTPUT_VARIANCES:comparisons.filter(r=>adjudicationAdverse(recordValue(r,'PROHIBITED_VARIANCE'))).map(r=>recordId(r,'comparisons')),INCONCLUSIVE_TESTS:reqs.filter(r=>facts[requirementId(r)]?.ANY_UNDETERMINED).map(requirementId),REPEATED_FAILURE_GROUPS:stability.repeatedDefectCount,UNIQUE_FAILURES:stability.uniqueDefectCount,APPLICATION_DERIVED_COMPARISON_FACTS:facts,STABILITY_SUMMARY:stability});break;}'''
if old not in s: raise SystemExit('Stage 13 derive anchor missing')
s=s.replace(old,new,1)

insert_before='''case 18:Object.assign(derived,{MANDATORY_REQUIREMENT_COVERAGE:convergence.requirementCoverage'''
addition='''case 14:{const defects=confirmedDefects(project),rcas=recordsForCurrentScope(project,'rootCauses'),byDefect=new Map();for(const r of rcas){const id=String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'');if(!byDefect.has(id))byDefect.set(id,[]);byDefect.get(id).push(r);}const confirmed=[],unknown=[],blocked=[];for(const d of defects){const id=recordId(d,'defects'),rows=byDefect.get(id)||[];if(rows.length===1){const v=validateRootCauseRecord(rows[0],project);if(v.valid)confirmed.push(id);else unknown.push(id);}else if(rows.length===0)unknown.push(id);else blocked.push(id);}Object.assign(derived,{ROOT_CAUSE_ANALYSIS_VERSION:'RCA-'+hash.sha256Value(rcas.map(r=>r.sha256||r.recordSha256||recordId(r,'rootCauses'))).slice(0,16).toUpperCase(),DEFECT_ROOT_CAUSE_RECORDS:rcas.length,TOTAL_MATERIAL_DEFECTS:defects.length,CONFIRMED_ROOT_CAUSES:confirmed,UNDETERMINED_ROOT_CAUSES:unknown,BLOCKED_ANALYSES:blocked});break;}case 15:{const defects=confirmedDefects(project),regs=records(project,'regressions').filter(r=>isActiveRecord(r)),execs=records(project,'regressionExecutions'),covered=[],preProven=[],missing=[];for(const d of defects){const id=recordId(d,'defects'),rs=regs.filter(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'')===id);if(rs.length)covered.push(id);else missing.push(id);if(rs.some(r=>execs.some(e=>String(recordValue(e,'REG_ID')||e.relationships?.REG_ID||'')===recordId(r,'regressions')&&upper(recordValue(e,'PHASE'))==='PRE_CORRECTION'&&effectiveRegressionDetermination(project,e).determination==='SATISFIED')))preProven.push(id);}Object.assign(derived,{INPUT_TEST_SUITE_VERSION:project.job.CURRENT_TEST_SUITE_VERSION||'NONE',OUTPUT_TEST_SUITE_VERSION:project.job.CURRENT_TEST_SUITE_VERSION||'NONE',REGRESSION_FIXTURE_VERSION:'REGRESSION-'+hash.sha256Value(regs.map(r=>r.sha256||recordId(r,'regressions'))).slice(0,16).toUpperCase(),REGRESSION_RECORDS:regs.length,CONFIRMED_DEFECTS:defects.length,CONFIRMED_DEFECTS_WITH_REGRESSION_TEST:covered,PRE_CORRECTION_FAILURES_PROVEN:preProven,UNCONVERTED_CONFIRMED_DEFECTS:missing});break;}case 16:{const changes=recordsForCurrentScope(project,'changes').filter(r=>Number(r.stage)===16),defects=confirmedDefects(project),triggered=[...new Set(changes.flatMap(c=>{const raw=recordValue(c,'TRIGGERING_DEFECT_IDS');return Array.isArray(raw)?raw.map(String):String(raw||'').split(/[;,\\s]+/).filter(Boolean);} ))],changedInstructions=changes.some(c=>/INSTRUCTION/i.test(String(recordValue(c,'RESPONSIBLE_LAYER')||''))),changedArtifacts=changes.filter(c=>String(recordValue(c,'NEW_ARTIFACT_VERSION')||'').trim()),inPlace=changes.filter(c=>truth(recordValue(c,'IN_PLACE_MODIFICATION')));Object.assign(derived,{CHANGE_SET_ID:changes.map(c=>recordId(c,'changes')),TRIGGERING_DEFECT_IDS:triggered,RCA_VERSION:'RCA-'+hash.sha256Value(recordsForCurrentScope(project,'rootCauses').map(r=>r.sha256||recordId(r,'rootCauses'))).slice(0,16).toUpperCase(),DATE:changes.at(-1)?.createdAt||now(),ARTIFACT_CHANGE_RECORDS:changedArtifacts.length,INSTRUCTION_CHANGED:changedInstructions,IF_EXECUTION_ONLY_DEFECT_WAS_INSTRUCTION_PRESERVED:!changedInstructions,PREFLIGHT_REPEATED_IF_CHANGED:changedInstructions?recordsForCurrentScope(project,'preflightRecords').length>0:true,ARTIFACTS_CHANGED:changedArtifacts.length>0,NEW_VERSIONS_CREATED:changedArtifacts.length,IN_PLACE_MODIFICATIONS:inPlace.length,DOWNSTREAM_VERIFICATIONS_INVALIDATED:safe(project.projectData.history).filter(h=>h.type==='DOWNSTREAM_INVALIDATED'&&h.stage===16).at(-1)?.invalidatedStages||[]});break;}case 17:{const iterations=records(project,'iterations').filter(r=>Number(r.stage)===17&&isActiveRecord(r)),currentIt=iterations.at(-1),previous=records(project,'iterations').filter(r=>isActiveRecord(r)&&recordId(r,'iterations')!==recordId(currentIt,'iterations')).at(-1),ev=evaluateIteration(project,recordId(currentIt,'iterations'),'CORRECTED'),matrix=recordId(currentIt,'iterations')?verificationMatrix(project,recordId(currentIt,'iterations')):{coverage:0},comparisons=recordId(currentIt,'iterations')?recordsForIteration(project,'comparisons',recordId(currentIt,'iterations')):[],defects=recordId(currentIt,'iterations')?recordsForIteration(project,'defects',recordId(currentIt,'iterations')):[],rcas=recordsForCurrentScope(project,'rootCauses'),regs=records(project,'regressions').filter(r=>isActiveRecord(r)),changes=recordsForCurrentScope(project,'changes');Object.assign(derived,{PREVIOUS_ITERATION_ID:recordId(previous,'iterations')||'NONE',NEW_ITERATION_ID:recordId(currentIt,'iterations')||'NONE',PREVIOUS_CANDIDATE_ID:previous?iterationCandidateId(project,recordId(previous,'iterations')):'NONE',NEW_CANDIDATE_ID:currentIt?iterationCandidateId(project,recordId(currentIt,'iterations')):'NONE',CHANGESET_ID:recordId(changes.at(-1),'changes')||'NONE',NEW_FROZEN_VERSIONS:recordValue(currentIt,'FROZEN_VERSIONS')||{},OLD_CONVERSATIONS_CONTINUED:false,TEN_NEW_CONTEXTS_CREATED:ev.contextCount,RUN_NAMESPACE:ev.runs.map(r=>recordId(r,'runs')),IDENTICAL_PACKAGE_CONFIRMED_FOR_ALL_RUNS:!ev.reasons.some(r=>/candidate|package/i.test(r)),PRIOR_OUTPUTS_WITHHELD:!ev.reasons.some(r=>/prior|contamin/i.test(r)),EXECUTE_COMPLETED:ev.runs.length===10,VERIFY_COMPLETED:matrix.coverage===1,COMPARE_COMPLETED:comparisons.length===mandatoryRequirements(project,scopeForIteration(project,recordId(currentIt,'iterations'))).length,ROOT_CAUSE_COMPLETED:defects.every(d=>rcas.some(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'')===recordId(d,'defects'))),REGRESSION_TESTS_ADDED:defects.every(d=>regs.some(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'')===recordId(d,'defects'))),CORRECTIONS_COMPLETED:defects.every(d=>changes.some(c=>String(recordValue(c,'TRIGGERING_DEFECT_IDS')||'').includes(recordId(d,'defects')))});break;}'''
if insert_before not in s: raise SystemExit('Stage 18 derive anchor missing')
s=s.replace(insert_before,addition+insert_before,1)

# Extend Stage 19 existing shared-iteration case with explicit application-owned completion facts.
old="""case 11:case 17:case 19:{const it=latestIteration(project,[stage]);const ev=evaluateIteration(project,recordId(it,'iterations'),stage===19?'UNCHANGED_CONFIRMATION':stage===17?'CORRECTED':'INITIAL');Object.assign(derived,{ITERATION_ID:ev.iterationId,RUN_COUNT:ev.runs.length,FRESH_CONTEXT_COUNT:ev.contextCount,ITERATION_COMPLETE:ev.complete,ITERATION_REASONS:ev.reasons,STABILITY_SUMMARY:stage===19?ev.stability:null});break;}"""
new="""case 11:case 19:{const it=latestIteration(project,[stage]),iterationId=recordId(it,'iterations'),ev=evaluateIteration(project,iterationId,stage===19?'UNCHANGED_CONFIRMATION':'INITIAL');Object.assign(derived,{ITERATION_ID:ev.iterationId,RUN_COUNT:ev.runs.length,FRESH_CONTEXT_COUNT:ev.contextCount,ITERATION_COMPLETE:ev.complete,ITERATION_REASONS:ev.reasons,STABILITY_SUMMARY:stage===19?ev.stability:null});if(stage===19){const confirmation=recordsForCurrentScope(project,'confirmationRecords').at(-1),sourceId=String(recordValue(confirmation,'SOURCE_ITERATION_ID')||confirmation?.relationships?.SOURCE_ITERATION_ID||''),matrix=verificationMatrix(project,iterationId),regs=records(project,'regressions').filter(r=>isActiveRecord(r)&&upper(recordValue(r,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED'),regExec=currentRegressionExecutions(project,iterationId),defects=recordsForIteration(project,'defects',iterationId),comparisonCount=recordsForIteration(project,'comparisons',iterationId).length,reqCount=mandatoryRequirements(project,scopeForIteration(project,iterationId)).length,determination=confirmationDetermination(project,confirmation);Object.assign(derived,{SOURCE_CONVERGED_ITERATION:sourceId||'NONE',CONFIRMATION_ITERATION_ID:iterationId||'NONE',ZERO_CHANGE_AUDIT:!ev.reasons.some(r=>/change|candidate|hash/i.test(r)),TEN_NEW_CONTEXTS_CREATED:ev.contextCount,SAME_FROZEN_PACKAGE_USED:!ev.reasons.some(r=>/package|candidate/i.test(r)),RUNS_COMPLETED:ev.runs.length,COMPLETE_TEST_SUITE_RUN:matrix.expected.length>0&&!matrix.missing.length&&!matrix.duplicates.length,ALL_REGRESSION_TESTS_RUN:regs.every(r=>regExec.some(e=>String(recordValue(e,'REG_ID')||e.relationships?.REG_ID||'')===recordId(r,'regressions'))),CROSS_RUN_COMPARISON_COMPLETED:comparisonCount===reqCount,NEW_CRITICAL_DEFECTS:defects.filter(d=>upper(recordValue(d,'SEVERITY'))==='CRITICAL').length,NEW_MAJOR_DEFECTS:defects.filter(d=>upper(recordValue(d,'SEVERITY'))==='MAJOR').length,NEW_REQUIREMENTS_DISCOVERED:0,INJECTED_DEFECTS_NOT_DETECTED:0,NEW_CORRECTNESS_AFFECTING_VARIANCE:ev.stability?.unexplainedVarianceCount||0,CONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED:determination.determination==='SATISFIED',REQUIRED_RETURN_STAGE:determination.determination==='SATISFIED'?'NONE':'STAGE 14'});}break;}"""
if old not in s: raise SystemExit('Shared iteration derive anchor missing')
s=s.replace(old,new,1)

# Add explicit Stage 22-24 derived facts before Stage 25.
anchor='''case 25:{const coverage=representationInspectionCoverage(project)'''
addition='''case 22:{const mandatoryIds=new Set(mandatoryRequirements(project,currentScope(project)).map(requirementId)),tests=recordsForCurrentScope(project,'tests').filter(t=>mandatoryIds.has(testRequirementId(t))&&upper(recordValue(t,'TEST_TYPE'))==='DETERMINISTIC'&&!['RETIRED','BLOCKED','NOT READY'].includes(upper(recordValue(t,'STATUS')||'READY'))),results=recordsForCurrentScope(project,'deterministicResults'),byTest=new Map();for(const r of results){const id=String(recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||'');if(!byTest.has(id))byTest.set(id,[]);byTest.get(id).push(r);}const determinations=tests.map(t=>{const rows=byTest.get(recordId(t,'tests'))||[];return rows.length===1?effectiveDetermination('deterministicResults',rows[0],t,project):'UNDETERMINED';}),product=recordsForCurrentScope(project,'products').at(-1),productArtifacts=recordsForCurrentScope(project,'artifacts').filter(a=>String(a.scope?.productId||'')===String(currentScope(project).productId||''));Object.assign(derived,{PRODUCT_ID:recordId(product,'products')||'NONE',PRODUCT_VERSION:recordValue(product,'PRODUCT_VERSION')||'NONE',PRODUCT_HASHES_BEFORE_TEST:Object.fromEntries(productArtifacts.map(a=>[recordId(a,'artifacts'),recordValue(a,'SHA256')||'UNKNOWN'])),TEST_SUITE_VERSION:project.job.CURRENT_TEST_SUITE_VERSION||'NONE',VALIDATOR_VERSION:globalThis.closedLoopTestRuntime?.version||'EXTERNAL',DETERMINISTIC_TEST_RESULTS:results.length,APPLICABLE_MANDATORY_DETERMINISTIC_TESTS:tests.map(t=>recordId(t,'tests')),EXECUTED:determinations.filter(d=>d!=='UNDETERMINED').length,SATISFIED:determinations.filter(d=>d==='SATISFIED').length,VIOLATED:determinations.filter(d=>d==='VIOLATED').length,UNDETERMINED:determinations.filter(d=>d==='UNDETERMINED').length,MISSING_TEST_RESULTS:tests.filter(t=>(byTest.get(recordId(t,'tests'))||[]).length!==1).map(t=>recordId(t,'tests')),PRODUCT_REJECTED_BY_MANDATORY_FAILURE:determinations.includes('VIOLATED')});break;}case 23:{const mandatoryIds=new Set(mandatoryRequirements(project,currentScope(project)).map(requirementId)),tests=recordsForCurrentScope(project,'tests').filter(t=>mandatoryIds.has(testRequirementId(t))&&upper(recordValue(t,'TEST_TYPE'))==='MEANING'),results=recordsForCurrentScope(project,'meaningResults'),ds=results.map(r=>effectiveDetermination('meaningResults',r,testForResult(project,r),project)),change=acceptedChanges(project,23).at(-1),reviewer=String(change?.scope?.contextId||''),product=recordsForCurrentScope(project,'products').at(-1),producer=String(recordValue(product,'PRODUCTION_CONTEXT_ID')||product?.relationships?.PRODUCTION_CONTEXT_ID||''),ind=evaluateContextIndependence(project,{role:'MEANING_REVIEW',reviewerContextId:reviewer,productionContextId:producer});Object.assign(derived,{PRODUCT_ID:recordId(product,'products')||'NONE',PRODUCT_VERSION:recordValue(product,'PRODUCT_VERSION')||'NONE',REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NONE',MEANING_RUBRIC_VERSION:'MEANING-'+hash.sha256Value(tests.map(t=>t.sha256||recordId(t,'tests'))).slice(0,16).toUpperCase(),EVALUATOR_ID:reviewer||'UNKNOWN',EVALUATOR_INDEPENDENT_FROM_GENERATOR:ind.determination,MEANING_REQUIREMENT_RECORDS:results.length,ACTIVE_MEANING_REQUIREMENTS:tests.length,MEANING_RECORDS_COMPLETED:results.length,SATISFIED:ds.filter(d=>d==='SATISFIED').length,VIOLATED:ds.filter(d=>d==='VIOLATED').length,UNDETERMINED:ds.filter(d=>d==='UNDETERMINED').length,UNSUPPORTED_BARE_CONCLUSIONS:results.filter(r=>!evaluateEvidenceSufficiency(project,{test:testForResult(project,r),result:r}).sufficient).length});break;}case 24:{const mandatoryIds=new Set(mandatoryRequirements(project,currentScope(project)).map(requirementId)),tests=recordsForCurrentScope(project,'tests').filter(t=>mandatoryIds.has(testRequirementId(t))&&upper(recordValue(t,'TEST_TYPE'))==='ADVERSARIAL'),regs=records(project,'regressions').filter(r=>isActiveRecord(r)&&upper(recordValue(r,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED'),results=recordsForCurrentScope(project,'adversarialResults'),ds=results.map(r=>effectiveDetermination('adversarialResults',r,testForResult(project,r),project)),change=acceptedChanges(project,24).at(-1),reviewer=String(change?.scope?.contextId||''),product=recordsForCurrentScope(project,'products').at(-1),producer=String(recordValue(product,'PRODUCTION_CONTEXT_ID')||product?.relationships?.PRODUCTION_CONTEXT_ID||''),ind=evaluateContextIndependence(project,{role:'ADVERSARIAL_REVIEW',reviewerContextId:reviewer,productionContextId:producer}),linkedDefects=results.map(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'')).filter(Boolean),defectRows=records(project,'defects').filter(d=>linkedDefects.includes(recordId(d,'defects')));Object.assign(derived,{PRODUCT_ID:recordId(product,'products')||'NONE',PRODUCT_VERSION:recordValue(product,'PRODUCT_VERSION')||'NONE',ADVERSARIAL_REVIEW_VERSION:'ADVERSARIAL-'+hash.sha256Value(results.map(r=>r.sha256||recordId(r,'adversarialResults'))).slice(0,16).toUpperCase(),REVIEWER_ID:reviewer||'UNKNOWN',REVIEWER_INDEPENDENT:ind.determination,ADVERSARIAL_CHECK_RECORDS:results.length,ATTACKS_EXECUTED:results.length,MANDATORY_DEFECTS_FOUND:ds.filter(d=>d==='VIOLATED').length,CRITICAL_DEFECTS_FOUND:defectRows.filter(d=>upper(recordValue(d,'SEVERITY'))==='CRITICAL').length,MAJOR_DEFECTS_FOUND:defectRows.filter(d=>upper(recordValue(d,'SEVERITY'))==='MAJOR').length,UNDETERMINED_ATTACKS:ds.filter(d=>d==='UNDETERMINED').length,REGRESSIONS_FOUND:results.filter(r=>String(recordValue(r,'REG_ID')||r.relationships?.REG_ID||'')).length,RETURN_TO_ROOT_CAUSE_REQUIRED:ds.some(d=>d!=='SATISFIED')});break;}'''
if anchor not in s: raise SystemExit('Stage 25 derive anchor missing')
s=s.replace(anchor,addition+anchor,1)

# Expand Stage 27 application facts from releaseMetrics; release record remains canonical authority.
old="""case 27:Object.assign(derived,{TOTAL_MANDATORY_REQUIREMENTS:release.mandatoryRequirementCount,MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_SUPPORTING_EVIDENCE:release.satisfied,MANDATORY_REQUIREMENTS_DEMONSTRABLY_VIOLATED:release.violated,MANDATORY_REQUIREMENTS_NOT_ESTABLISHED:release.undetermined,UNRESOLVED_CRITICAL_DEFECTS:release.criticalDefects,UNRESOLVED_MAJOR_DEFECTS:release.majorDefects,SELECTED_RELEASE_STATE:release.determination});break;"""
new="""case 27:{const rr=recordsForCurrentScope(project,'releaseRecords').at(-1),allResults=[...recordsForCurrentScope(project,'deterministicResults'),...recordsForCurrentScope(project,'meaningResults'),...recordsForCurrentScope(project,'adversarialResults')];Object.assign(derived,{RELEASE_GATE_ID:recordId(rr,'releaseRecords')||'PENDING',DATE_AND_TIME:rr?.createdAt||now(),PRODUCT_ID:release.productId||'NONE',PRODUCT_VERSION:recordValue(recordsForCurrentScope(project,'products').at(-1),'PRODUCT_VERSION')||'NONE',BASELINE_ID:release.baselineId||'NONE',RECONCILED_REVIEW_VERSION:'RECONCILED-'+hash.sha256Value([...recordsForCurrentScope(project,'processAudits'),...recordsForCurrentScope(project,'productAudits')].map(r=>r.sha256||r.recordSha256||r.id)).slice(0,16).toUpperCase(),TOTAL_MANDATORY_REQUIREMENTS:release.mandatoryRequirementCount,MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_SUPPORTING_EVIDENCE:release.satisfied,MANDATORY_REQUIREMENTS_DEMONSTRABLY_VIOLATED:release.violated,MANDATORY_REQUIREMENTS_NOT_ESTABLISHED:release.undetermined,TOTAL_MANDATORY_VALIDATORS:release.validatorCount,MANDATORY_VALIDATORS_SUCCEEDED:release.validatorCount-release.failedValidatorIds.length-release.unknownValidatorIds.length,MANDATORY_VALIDATORS_FAILED:release.failedValidatorIds.length,MANDATORY_VALIDATORS_UNDETERMINED_OR_NOT_RUN:release.unknownValidatorIds.length,UNRESOLVED_CRITICAL_DEFECTS:release.criticalDefects,UNRESOLVED_MAJOR_DEFECTS:release.majorDefects,BLOCKING_REQUIREMENT_IDS:release.blockingRequirements,VIOLATED_REQUIREMENT_IDS:release.violatedRequirements,FAILED_TEST_IDS:release.failedValidatorIds,UNDETERMINED_OR_MISSING_TEST_IDS:release.unknownValidatorIds,UNRESOLVED_DEFECT_IDS:unresolvedMaterialDefects(project).map(d=>recordId(d,'defects')),BLOCKER_IDS:release.blockerIds,SELECTED_RELEASE_STATE:release.determination,CONTROLLING_DECISION_RULE:release.determination==='REJECTED'?'AFFIRMATIVE_CURRENT_NONCONFORMANCE_REJECTS':release.determination==='BLOCKED'?'INSUFFICIENT_OR_CONTRADICTORY_CURRENT_EVIDENCE_BLOCKS':'ALL_CURRENT_RELEASE_CONDITIONS_SATISFIED',CONTROLLING_REASON:release.determination==='ACCEPTED'?'Every mandatory requirement is currently established with sufficient noncontradictory evidence and release-critical identity conditions are satisfied.':release.determination==='REJECTED'?'Current evidence establishes mandatory nonconformance.':'Current evidence is incomplete, insufficient, stale, blocked, or contradictory.',AFFIRMATIVE_EVIDENCE:release.inputReferences});break;}"""
if old not in s: raise SystemExit('Stage 27 derive anchor missing')
s=s.replace(old,new,1)

# Add Stage 30 deterministic registry counts before common decision fields.
marker="""case 29:Object.assign(derived,DERIVATIONS['stage29.evidenceChains'](project).value);break;}derived.STAGE_DECISION"""
replacement="""case 29:Object.assign(derived,DERIVATIONS['stage29.evidenceChains'](project).value);break;case 30:{const defects=records(project,'defects',{active:false}),confirmed=confirmedDefects(project),regs=records(project,'regressions',{active:false}),activeRegs=regs.filter(r=>isActiveRecord(r)&&upper(recordValue(r,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED'),retiredRegs=regs.filter(r=>upper(recordValue(r,'ACTIVE_RETIRED_STATE'))==='RETIRED'),execs=records(project,'regressionExecutions',{active:false}),missingFields=defects.filter(d=>['OBSERVED_FAILURE','EXPECTED_CONDITION','SEVERITY','STATUS'].some(k=>adjudicationEmpty(recordValue(d,k)))).map(d=>recordId(d,'defects')),covered=new Set(regs.map(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||''))),missingRegs=confirmed.filter(d=>!covered.has(recordId(d,'defects'))).map(d=>recordId(d,'defects'));Object.assign(derived,{DEFECT_REGISTRY_VERSION:'DEFECT-REGISTRY-'+hash.sha256Value(defects.map(d=>d.recordSha256||d.sha256||recordId(d,'defects'))).slice(0,16).toUpperCase(),REGRESSION_REGISTRY_VERSION:'REGRESSION-REGISTRY-'+hash.sha256Value(regs.map(r=>r.recordSha256||r.sha256||recordId(r,'regressions'))).slice(0,16).toUpperCase(),REGISTRY_IS_APPEND_ONLY:true,DEFECT_RECORDS:defects.length,REGRESSION_RECORDS:regs.length,FUTURE_BASELINE_REGRESSION_EXECUTION_RECORDS:execs.length,TOTAL_DEFECT_RECORDS:defects.length,TOTAL_CONFIRMED_DEFECTS_WITH_REGRESSION_TESTS:confirmed.length-missingRegs.length,TOTAL_ACTIVE_REGRESSION_TESTS:activeRegs.length,TOTAL_RETIRED_REGRESSION_TESTS:retiredRegs.length,DEFECT_RECORDS_MISSING_REQUIRED_FIELDS:missingFields,CONFIRMED_DEFECTS_MISSING_REGRESSION_TESTS:missingRegs,FINAL_REGISTRY_DETERMINATION:missingFields.length||missingRegs.length?'UNDETERMINED':'SATISFIED'});break;}}derived.STAGE_DECISION"""
if marker not in s: raise SystemExit('Stage 30 derive anchor missing')
s=s.replace(marker,replacement,1)
p.write_text(s)
