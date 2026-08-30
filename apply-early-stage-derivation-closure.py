from pathlib import Path

# Correct stage-level producer boundaries where completion facts are application-observable.
p=Path('workbook.js')
s=p.read_text()
repls={
'''    "agent": [
      "BLOCKED_MANDATORY_REQUIREMENTS"
    ],
    "application": [
      "TEST_SUITE_VERSION",''':'''    "agent": [],
    "application": [
      "TEST_SUITE_VERSION",''',
'''      "MANDATORY_TEST_COVERAGE",
      "STAGE_DECISION",''':'''      "MANDATORY_TEST_COVERAGE",
      "BLOCKED_MANDATORY_REQUIREMENTS",
      "STAGE_DECISION",''',
'''    "agent": [
      "REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR",
      "EVERY_SENTENCE_REVIEWED",''':'''    "agent": [
      "EVERY_SENTENCE_REVIEWED",''',
'''      "PREFLIGHT_REVIEWER_ID",
      "SENTENCE_REVIEW_RECORDS",''':'''      "PREFLIGHT_REVIEWER_ID",
      "REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR",
      "SENTENCE_REVIEW_RECORDS",''',
'''    "agent": [
      "HASHES_RECORDED_WHERE_PRACTICAL",
      "CHANGES_ALLOWED_DURING_BATCH"
    ],
    "application": [
      "CANDIDATE_ID",''':'''    "agent": [],
    "application": [
      "CANDIDATE_ID",''',
'''      "ALL_RUNS_WILL_RECEIVE_IDENTICAL_FROZEN_MATERIALS",
      "STAGE_DECISION",''':'''      "ALL_RUNS_WILL_RECEIVE_IDENTICAL_FROZEN_MATERIALS",
      "HASHES_RECORDED_WHERE_PRACTICAL",
      "CHANGES_ALLOWED_DURING_BATCH",
      "STAGE_DECISION",''',
'''  "12": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "RUNS"
    ],
    "application": [
      "ITERATION_ID",''':'''  "12": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "ITERATION_ID",
      "RUNS",'''
}
for old,new in repls.items():
    if old not in s: raise SystemExit('workbook ownership anchor missing: '+old[:90])
    s=s.replace(old,new,1)
p.write_text(s)

# Correct gate authority and fill named application-derived fields for Stages 01-12.
p=Path('workflow-engine.js')
s=p.read_text()
old="""      const researchData=project.stages[3]?.agentData||{};
      if(!truth(researchData.ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED))reasons.push('Stage 03 has not established that all known controlling sources were examined.');
      if(!truth(researchData.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED))reasons.push('Stage 03 second conflict and exception pass is incomplete.');"""
new="""      const researchData=project.stages[3]?.agentData||{};
      const allKnownControllingSourcesExamined=sourceIds.length>0&&missing.length===0;
      if(!allKnownControllingSourcesExamined)reasons.push('Stage 03 has not established current research coverage for every controlling source.');
      if(!truth(researchData.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED))reasons.push('Stage 03 second conflict and exception pass is incomplete.');"""
if old not in s: raise SystemExit('Stage 03 gate authority anchor missing')
s=s.replace(old,new,1)

# Replace the first Stage 01-06 derive cases with complete named application output.
old="""switch(stage){case 1:Object.assign(derived,{JOB_ID:project.job.JOB_ID,DATE_OPENED:project.job.DATE_OPENED,INPUT_SET_VERSION:project.job.CURRENT_INPUT_VERSION,INPUT_SET_HASH_OR_MANIFEST:project.job.INPUT_SET_HASH_OR_MANIFEST||'UNKNOWN',JOB_RECORD_STATUS:project.stages[1].status==='COMPLETE'?'READY':'NOT READY'});break;case 2:Object.assign(derived,{SOURCE_SET_VERSION:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',SOURCE_RECORDS:ids('sources'),SOURCE_CONFLICT_RECORDS:ids('sourceConflicts')});break;case 4:Object.assign(derived,{REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',TOTAL_REQUIREMENTS:recordsForCurrentScope(project,'requirements').length,MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount});break;case 6:Object.assign(derived,{TEST_SUITE_VERSION:project.job.CURRENT_TEST_SUITE_VERSION||'NOT APPLICABLE',TOTAL_ACTIVE_MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount,ACTIVE_MANDATORY_REQUIREMENTS_WITH_AT_LEAST_ONE_READY_TEST:metrics.requirementsWithTests,MANDATORY_TEST_COVERAGE:metrics.requirementCoverage});break;"""
new="""switch(stage){case 1:{const intake=evaluateIntakeAccounting(project);Object.assign(derived,{JOB_ID:project.job.JOB_ID,DATE_OPENED:project.job.DATE_OPENED,INPUT_SET_VERSION:project.job.CURRENT_INPUT_VERSION,INPUT_SET_HASH_OR_MANIFEST:project.job.INPUT_SET_HASH_OR_MANIFEST||intake.manifest?.manifestSha256||'UNKNOWN',JOB_RECORD_STATUS:intake.complete&&acceptedChanges(project,1).length?'READY':'NOT READY',STATUS_EVIDENCE:intake.complete?`Application accounted ${intake.accountedUnitCount}/${intake.expectedUnitCount} controlled input units.`:intake.reasons.join('; ')});break;}case 2:{const conflicts=recordsForCurrentScope(project,'sourceConflicts'),unresolved=conflicts.filter(r=>['UNRESOLVED','BLOCKED','UNKNOWN','OPEN'].includes(upper(recordValue(r,'RESOLUTION_STATUS'))));Object.assign(derived,{SOURCE_SET_VERSION:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',SOURCE_RECORDS:ids('sources'),SOURCE_CONFLICT_RECORDS:ids('sourceConflicts'),UNRESOLVED_CONTROLLING_CONFLICTS:unresolved.map(r=>recordId(r,'sourceConflicts'))});break;}case 3:{const sourceIds=recordsForCurrentScope(project,'sources').map(r=>recordId(r,'sources')),research=recordsForCurrentScope(project,'research'),researched=new Set(research.map(r=>String(recordValue(r,'SOURCE_ID')||r.relationships?.SOURCE_ID||''))),candidate=recordsForCurrentScope(project,'candidateRequirements');Object.assign(derived,{RESEARCH_VERSION:project.job.CURRENT_RESEARCH_VERSION||'RESEARCH-'+hash.sha256Value(research.map(r=>r.recordSha256||r.sha256||recordId(r,'research'))).slice(0,16).toUpperCase(),SOURCE_RESEARCH_RECORDS:research.map(r=>recordId(r,'research')),CANDIDATE_REQUIREMENT_RECORDS:candidate.map(r=>recordId(r,'candidateRequirements')),ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:sourceIds.every(id=>researched.has(id))});break;}case 4:{const reqs=recordsForCurrentScope(project,'requirements'),atomicityIssues=reqs.filter(req=>{const obligation=String(recordValue(req,'OBLIGATION')||'').trim(),success=String(recordValue(req,'OBSERVABLE_SATISFACTION_CONDITION')||'').trim(),failure=String(recordValue(req,'FAILURE_CONDITION')||'').trim();return !obligation||!success||!failure;}).map(req=>recordId(req,'requirements'));Object.assign(derived,{REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',REQUIREMENT_RECORDS:reqs.map(r=>recordId(r,'requirements')),ATOMICITY_REVIEW_RESULTS:{reviewed:reqs.length,structurallyIncomplete:atomicityIssues},TOTAL_REQUIREMENTS:reqs.length,MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount});break;}case 5:{const resolutions=recordsForCurrentScope(project,'requirementResolutions'),unresolved=resolutions.filter(r=>['OPEN','UNRESOLVED','BLOCKED','UNKNOWN'].includes(upper(recordValue(r,'STATUS')))),blockers=openBlockers(project,5);Object.assign(derived,{INPUT_REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NONE',OUTPUT_REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NONE',REQUIREMENT_DEFECT_RECORDS:resolutions.map(r=>recordId(r,'requirementResolutions')),UNRESOLVED_CONFLICTS:unresolved.map(r=>recordId(r,'requirementResolutions')),MISSING_PREREQUISITES:blockers.filter(b=>/prerequisite/i.test(String(recordValue(b,'MISSING_ITEM_TYPE')||recordValue(b,'WHY_WORK_CANNOT_CONTINUE')||''))).map(b=>recordId(b,'blockers')),MANDATORY_BLOCKERS:blockers.map(b=>recordId(b,'blockers'))});break;}case 6:{const tests=recordsForCurrentScope(project,'tests'),mandatoryIds=new Set(mandatoryRequirements(project).map(requirementId)),mandatoryTests=tests.filter(t=>mandatoryIds.has(testRequirementId(t))),blocked=mandatoryTests.filter(t=>upper(recordValue(t,'EXECUTION_MODE'))==='UNAVAILABLE'||upper(recordValue(t,'STATUS'))==='BLOCKED'||(upper(recordValue(t,'EXECUTION_MODE'))==='APPLICATION_DETERMINISTIC'&&!applicationTestSupported(t)));Object.assign(derived,{TEST_SUITE_VERSION:project.job.CURRENT_TEST_SUITE_VERSION||'NOT APPLICABLE',TEST_RECORDS:tests.map(r=>recordId(r,'tests')),COVERAGE_RECORDS:mandatoryRequirements(project).map(req=>({requirementId:requirementId(req),testIds:tests.filter(t=>testRequirementId(t)===requirementId(req)).map(t=>recordId(t,'tests'))})),TOTAL_ACTIVE_MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount,ACTIVE_MANDATORY_REQUIREMENTS_WITH_AT_LEAST_ONE_READY_TEST:metrics.requirementsWithTests,MANDATORY_TEST_COVERAGE:metrics.requirementCoverage,BLOCKED_MANDATORY_REQUIREMENTS:blocked.map(t=>testRequirementId(t))});break;}"""
if old not in s: raise SystemExit('Stage 01-06 derive anchor missing')
s=s.replace(old,new,1)

# Insert Stage 07-10 derivations before existing Stage 11/19 block.
anchor="""case 11:case 19:{const it=latestIteration(project,[stage])"""
addition="""case 7:{const reqs=mandatoryRequirements(project),mutations=recordsForCurrentScope(project,'failureTests'),covered=new Set(mutations.map(testRequirementId)),acceptedInvalid=[],defective=[];for(const m of mutations){const actual=upper(recordValue(m,'ACTUAL_RESULT')),expected=upper(recordValue(m,'EXPECTED_REJECTION')),bad=expected.includes('REJECT')&&/\\b(?:ACCEPTED|ALLOWED|PASSED|NOT REJECTED|VALID)\\b/.test(actual)&&!/\\b(?:REJECTED|BLOCKED|FAILED|INVALID)\\b/.test(actual);if(bad){acceptedInvalid.push(recordId(m,'failureTests'));const defect=String(recordValue(m,'VALIDATOR_DEFECT_ID')||m.relationships?.VALIDATOR_DEFECT_ID||'');if(defect)defective.push(defect);}}Object.assign(derived,{MUTATION_SUITE_VERSION:project.job.CURRENT_MUTATION_SUITE_VERSION||'MUTATION-'+hash.sha256Value(mutations.map(r=>r.recordSha256||r.sha256||recordId(r,'failureTests'))).slice(0,16).toUpperCase(),FAILURE_TEST_RECORDS:mutations.map(r=>recordId(r,'failureTests')),ACTIVE_REQUIREMENTS:reqs.map(requirementId),REQUIREMENTS_WITH_AT_LEAST_ONE_FAILURE_TEST:reqs.filter(r=>covered.has(requirementId(r))).map(requirementId),FAILURE_TEST_COVERAGE:reqs.length?reqs.filter(r=>covered.has(requirementId(r))).length/reqs.length:1,INVALID_FIXTURES_ACCEPTED:acceptedInvalid,DEFECTIVE_VALIDATORS:[...new Set(defective)]});break;}case 8:{const instructions=recordsForCurrentScope(project,'instructions'),traces=recordsForCurrentScope(project,'instructionTraces');Object.assign(derived,{DRAFT_INSTRUCTION_VERSION:project.job.CURRENT_INSTRUCTION_VERSION||'NONE',INSTRUCTION_TRACE_RECORDS:traces.map(r=>recordId(r,'instructionTraces'))});break;}case 9:{const reviews=recordsForCurrentScope(project,'preflightRecords'),change=acceptedChanges(project,9).at(-1),contextId=String(change?.scope?.contextId||''),ind=evaluateContextIndependence(project,{role:'PREFLIGHT_REVIEW',reviewerContextId:contextId});Object.assign(derived,{INPUT_INSTRUCTION_VERSION:project.job.CURRENT_INSTRUCTION_VERSION||'NONE',OUTPUT_INSTRUCTION_VERSION:project.job.CURRENT_INSTRUCTION_VERSION||'NONE',PREFLIGHT_REVIEWER_ID:contextId||'UNKNOWN',REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR:ind.determination,SENTENCE_REVIEW_RECORDS:reviews.map(r=>recordId(r,'preflightRecords')),PREFLIGHT_ITERATION_RECORDS:safe(project.projectData.acceptedChanges).filter(c=>Number(c.stage)===9&&!c.invalidatedBy).map(c=>c.changeId)});break;}case 10:{const iteration=latestIteration(project,[10]),iterationId=recordId(iteration,'iterations'),candidateId=iterationCandidateId(project,iterationId),candidate=records(project,'candidateFreezes').find(r=>recordId(r,'candidateFreezes')===candidateId),manifest=safe(recordValue(candidate,'COMPONENT_MANIFEST')),hashes=recordValue(candidate,'COMPONENT_HASHES')||{};Object.assign(derived,{CANDIDATE_ID:candidateId||'NONE',ITERATION_ID:iterationId||'NONE',FREEZE_DATE:candidate?.createdAt||'NONE',FROZEN_COMPONENT_RECORDS:manifest.length,TOOL_CONFIGURATION_RECORDS:adjudicationEmpty(recordValue(candidate,'TOOL_CONFIGURATION'))?0:1,ALL_REQUIRED_COMPONENTS_PRESENT:manifest.length>0&&manifest.every(x=>x.artifactId&&x.filename&&x.sha256),ALL_RUNS_WILL_RECEIVE_IDENTICAL_FROZEN_MATERIALS:Boolean(candidateId&&candidateComponentIdentity(project,candidateId)),HASHES_RECORDED_WHERE_PRACTICAL:manifest.length>0&&Object.keys(hashes).length===manifest.length,CHANGES_ALLOWED_DURING_BATCH:'NO IN-PLACE MATERIAL CHANGES; ANY MATERIAL CHANGE REQUIRES A NEW CANDIDATE'});break;}"""
if anchor not in s: raise SystemExit('Stage 11 derive anchor missing')
s=s.replace(anchor,addition+anchor,1)

# Expand Stage 11 named fields while preserving shared evaluator.
old="""Object.assign(derived,{ITERATION_ID:ev.iterationId,RUN_COUNT:ev.runs.length,FRESH_CONTEXT_COUNT:ev.contextCount,ITERATION_COMPLETE:ev.complete,ITERATION_REASONS:ev.reasons,STABILITY_SUMMARY:stage===19?ev.stability:null});if(stage===19){"""
new="""Object.assign(derived,{ITERATION_ID:ev.iterationId,RUN_COUNT:ev.runs.length,FRESH_CONTEXT_COUNT:ev.contextCount,ITERATION_COMPLETE:ev.complete,ITERATION_REASONS:ev.reasons,STABILITY_SUMMARY:stage===19?ev.stability:null});if(stage===11){const runs=ev.runs,contexts=runs.map(r=>String(recordValue(r,'CONTEXT_ID')||r.relationships?.CONTEXT_ID||''));Object.assign(derived,{CANDIDATE_ID:iterationCandidateId(project,iterationId)||'NONE',RUN_RECORDS:runs.map(r=>recordId(r,'runs')),FRESH_CONTEXTS_CREATED:new Set(contexts.filter(Boolean)).size,RUNS_RECEIVING_EXACT_PACKAGE:ev.reasons.some(r=>/candidate|package/i.test(r))?0:runs.length,CONTAMINATED_RUNS:runs.filter(r=>{const c=records(project,'freshContexts').find(x=>recordId(x,'freshContexts')===String(recordValue(r,'CONTEXT_ID')||r.relationships?.CONTEXT_ID||''));return ['YES','TRUE','CONTAMINATED'].includes(upper(recordValue(c,'CONTAMINATION_STATUS')||recordValue(r,'CONTAMINATION_CHECK')));}).map(r=>recordId(r,'runs')),OUTPUTS_SAVED_SEPARATELY:runs.filter(r=>!adjudicationEmpty(recordValue(r,'COMPLETE_OUTPUT'))).length});}if(stage===19){"""
if old not in s: raise SystemExit('Stage 11 shared derive assignment missing')
s=s.replace(old,new,1)

# Replace Stage 12 terse counts with full application-owned matrix facts.
old="""case 12:Object.assign(derived,{ACTIVE_MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount,RUNS:metrics.iterationRunCount,EXPECTED_MANDATORY_RECORDS:metrics.expectedVerificationCount,ACTUAL_MANDATORY_RECORDS:metrics.actualVerificationTripleCount,MISSING_RECORDS:metrics.missingVerificationTriples.length,VERIFICATION_COVERAGE:metrics.verificationCoverage});break;"""
new="""case 12:{const iteration=latestIteration(project,[10,17,19]),iterationId=recordId(iteration,'iterations'),matrix=verificationMatrix(project,iterationId),rows=recordsForIteration(project,'verification',iterationId),ds=rows.map(r=>effectiveDetermination('verification',r,testForResult(project,r),project)),selfValidated=rows.filter(r=>{const runId=String(recordValue(r,'RUN_ID')||r.relationships?.RUN_ID||''),run=records(project,'runs').find(x=>recordId(x,'runs')===runId),generator=String(recordValue(run,'CONTEXT_ID')||run?.relationships?.CONTEXT_ID||''),reviewer=resultContextIdentity(project,r);return generator&&reviewer&&generator===reviewer;});Object.assign(derived,{ITERATION_ID:iterationId||'NONE',REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NONE',TEST_SUITE_VERSION:project.job.CURRENT_TEST_SUITE_VERSION||'NONE',VERIFICATION_RECORDS:rows.map(r=>recordId(r,'verification')),ACTIVE_MANDATORY_REQUIREMENTS:mandatoryRequirements(project,scopeForIteration(project,iterationId)).map(requirementId),RUNS:matrix.runs.map(r=>recordId(r,'runs')),EXPECTED_MANDATORY_RECORDS:matrix.expected.length,ACTUAL_MANDATORY_RECORDS:matrix.actual.length,MISSING_RECORDS:matrix.missing.length,SATISFIED_RECORDS:ds.filter(d=>d==='SATISFIED').length,VIOLATED_RECORDS:ds.filter(d=>d==='VIOLATED').length,UNDETERMINED_RECORDS:ds.filter(d=>d==='UNDETERMINED').length,SELF_VALIDATED_RECORDS:selfValidated.length,VERIFICATION_COVERAGE:matrix.coverage});break;}"""
if old not in s: raise SystemExit('Stage 12 derive anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

# Make application-only UI language use the structured action itself instead of a native-test fallback.
p=Path('app-core.js')
s=p.read_text()
old=""":displayedStageAction(n).actionType==='CALCULATE_RELEASE'?'No external instruction is used while the application calculates the release determination from current evidence. No agent or human may select the release state.':'The application must run the pending native deterministic verification before any external handoff. No agent prompt or final JSON is required for the pending native work.'):savedPrompt?"""
new=""":displayedStageAction(n).actionType==='CALCULATE_RELEASE'?'No external instruction is used while the application calculates the release determination from current evidence. No agent or human may select the release state.':`${displayedStageAction(n).heading||'Complete the current application control step'}. ${displayedStageAction(n).explanation||''} Do not send an agent prompt or paste final JSON until this control step is complete.`):savedPrompt?"""
if old not in s: raise SystemExit('prompt intro application-only anchor missing')
s=s.replace(old,new,1)
old2=""":displayedStageAction(n).actionType==='CALCULATE_RELEASE'?'No agent response belongs to the application-owned release calculation step. Calculate the release determination first.':'No agent response belongs to the pending application-native verification. Run the application verification first.'):String(s.status||'').toUpperCase()==='COMPLETE'"""
new2=""":displayedStageAction(n).actionType==='CALCULATE_RELEASE'?'No agent response belongs to the application-owned release calculation step. Calculate the release determination first.':`No agent response belongs to the current control step: ${displayedStageAction(n).heading||displayedStageAction(n).actionType}. ${displayedStageAction(n).explanation||''}`):String(s.status||'').toUpperCase()==='COMPLETE'"""
if old2 not in s: raise SystemExit('response intro application-only anchor missing')
s=s.replace(old2,new2,1)
s=s.replace('runtime-20260830-live-operator-52','runtime-20260830-live-operator-53')
p.write_text(s)
p=Path('index.html')
s=p.read_text().replace('runtime-20260830-live-operator-52','runtime-20260830-live-operator-53')
p.write_text(s)
