from pathlib import Path
import re

# Regression execution phase/result are closed workflow vocabulary.
p=Path('workflow-schema.js'); s=p.read_text()
if "'REG-EXEC':Object.freeze" not in s:
    marker="\n});\nconst STAGE_FIELD_TYPE_OVERRIDES=Object.freeze({"
    assert marker in s
    entry=",\n  'REG-EXEC':Object.freeze({PHASE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['PRE_CORRECTION','POST_CORRECTION','UNCHANGED_CONFIRMATION']),nullable:false,normalizerKey:null,closedProperties:null}),RESULT:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['SATISFIED','VIOLATED','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})})"
    s=s.replace(marker,entry+marker,1)
    p.write_text(s)

p=Path('workflow-engine.js'); s=p.read_text()
old="function defectResolvedByRegression(project,defect){const defectId=recordId(defect,'defects'),linked=records(project,'regressions').filter(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'')===defectId&&upper(recordValue(r,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED');if(!linked.length)return false;return linked.every(reg=>{const id=recordId(reg,'regressions'),executions=records(project,'regressionExecutions').filter(x=>String(recordValue(x,'REG_ID')||x.relationships?.REG_ID||'')===id),latest=executions.at(-1);return Boolean(latest)&&upper(recordValue(latest,'PHASE'))!=='PRE_CORRECTION'&&['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(latest,'RESULT')));});}"
new="function defectResolvedByRegression(project,defect){const defectId=recordId(defect,'defects'),linked=records(project,'regressions').filter(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'')===defectId&&upper(recordValue(r,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED');if(!linked.length)return false;return linked.every(reg=>{const id=recordId(reg,'regressions'),executions=records(project,'regressionExecutions').filter(x=>String(recordValue(x,'REG_ID')||x.relationships?.REG_ID||'')===id),latest=executions.at(-1);return Boolean(latest)&&regressionExecutionSuccessful(latest);});}"
assert old in s; s=s.replace(old,new,1)

marker="function activeRegressions(project){"
assert marker in s and 'function regressionExecutionSuccessful(' not in s
helpers="function regressionExecutionSuccessful(record,requiredPhase=null){const phase=upper(recordValue(record,'PHASE')),result=upper(recordValue(record,'RESULT'));if(result!=='SATISFIED')return false;if(requiredPhase&&phase!==requiredPhase)return false;return ['POST_CORRECTION','UNCHANGED_CONFIRMATION'].includes(phase);}\nfunction requiredRegressionPhase(mode){return mode==='UNCHANGED_CONFIRMATION'?'UNCHANGED_CONFIRMATION':mode==='CORRECTED'?'POST_CORRECTION':null;}\nfunction iterationRegressionPhase(project,iterationId){const iteration=records(project,'iterations').find(r=>recordId(r,'iterations')===String(iterationId||''));return Number(iteration?.stage)===17?'POST_CORRECTION':Number(iteration?.stage)===19?'UNCHANGED_CONFIRMATION':null;}\n"
s=s.replace(marker,helpers+marker,1)

marker="function currentRegressionExecutions(project,iterationId){"
assert marker in s and 'function refreshComparisonDerivations(' not in s
deriv="function refreshComparisonDerivations(project){for(const comparison of records(project,'comparisons')){const reqId=String(recordValue(comparison,'REQ_ID')||comparison.relationships?.REQ_ID||''),iterationId=String(comparison.scope?.iterationId||'');if(!reqId||!iterationId)continue;const scope=scopeForIteration(project,iterationId),requirement=recordsForScope(project,'requirements',scope).find(r=>requirementId(r)===reqId);if(!requirement)continue;const testIds=applicableTests(project,requirement,scope).map(r=>recordId(r,'tests')),runs=recordsForIteration(project,'runs',iterationId).filter(r=>runIterationId(r)===iterationId),verification=recordsForIteration(project,'verification',iterationId),runDeterminations=[];for(const run of runs){const runId=recordId(run,'runs'),values=[];let incomplete=false;for(const testId of testIds){const matches=verification.filter(v=>String(recordValue(v,'REQ_ID')||v.relationships?.REQ_ID||'')===reqId&&String(recordValue(v,'RUN_ID')||v.relationships?.RUN_ID||'')===runId&&String(recordValue(v,'TEST_ID')||v.relationships?.TEST_ID||'')===testId);if(matches.length!==1){incomplete=true;continue;}values.push(upper(recordValue(matches[0],'DETERMINATION')));}let determination='UNDETERMINED';if(!incomplete&&testIds.length&&values.length===testIds.length){if(values.includes('VIOLATED'))determination='VIOLATED';else if(values.includes('UNDETERMINED'))determination='UNDETERMINED';else if(values.every(v=>v==='SATISFIED'))determination='SATISFIED';}runDeterminations.push({runId,determination});}const fields=comparison.fields||(comparison.fields={});fields.ALL_TEN_SATISFIED=runs.length===10&&runDeterminations.every(x=>x.determination==='SATISFIED');fields.ANY_VIOLATION=runDeterminations.some(x=>x.determination==='VIOLATED');fields.ANY_UNDETERMINED=runs.length!==10||runDeterminations.some(x=>x.determination==='UNDETERMINED');comparison.ALL_TEN_SATISFIED=fields.ALL_TEN_SATISFIED;comparison.ANY_VIOLATION=fields.ANY_VIOLATION;comparison.ANY_UNDETERMINED=fields.ANY_UNDETERMINED;if(comparison.contentSha256!==undefined)comparison.contentSha256=hash.contentRecordSha256(comparison,'COMPARISON_ID');if(comparison.recordSha256!==undefined||comparison.sha256!==undefined){comparison.recordSha256=hash.recordSha256(comparison);comparison.sha256=comparison.recordSha256;}}return project;}\n"
s=s.replace(marker,deriv+marker,1)

old="if(mode!=='INITIAL')for(const reg of activeRegressions(project)){const id=recordId(reg,'regressions'),xs=regExec.filter(x=>String(recordValue(x,'REG_ID')||x.relationships?.REG_ID||'')===id);if(xs.length!==1||!['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(xs[0],'RESULT'))))regFailures.push(id);}"
new="if(mode!=='INITIAL')for(const reg of activeRegressions(project)){const id=recordId(reg,'regressions'),xs=regExec.filter(x=>String(recordValue(x,'REG_ID')||x.relationships?.REG_ID||'')===id);if(xs.length!==1||!regressionExecutionSuccessful(xs[0],requiredRegressionPhase(mode)))regFailures.push(id);}"
assert old in s; s=s.replace(old,new,1)

old="const executions=currentRegressionExecutions(project,iterationId);const successful=new Set(executions.filter(r=>['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(r,'RESULT')))).map(r=>String(recordValue(r,'REG_ID')||r.relationships?.REG_ID||'')));"
new="const executions=currentRegressionExecutions(project,iterationId),requiredPhase=iterationRegressionPhase(project,iterationId);const successful=new Set(executions.filter(r=>regressionExecutionSuccessful(r,requiredPhase)).map(r=>String(recordValue(r,'REG_ID')||r.relationships?.REG_ID||'')));"
assert old in s; s=s.replace(old,new,1)

old="const passedReg=new Set(regExec.filter(r=>['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(r,'RESULT')))).map(r=>String(recordValue(r,'REG_ID')||r.relationships?.REG_ID||'')));"
new="const passedReg=new Set(regExec.filter(r=>regressionExecutionSuccessful(r,'UNCHANGED_CONFIRMATION')).map(r=>String(recordValue(r,'REG_ID')||r.relationships?.REG_ID||'')));"
assert old in s; s=s.replace(old,new,1)

old="if(!latest||!['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(latest,'RESULT'))))reasons.push('Latest applicable regression execution is not successful for '+id+'.');"
new="if(!latest||!regressionExecutionSuccessful(latest,'UNCHANGED_CONFIRMATION'))reasons.push('Latest applicable regression execution is not a successful unchanged-confirmation execution for '+id+'.');"
assert old in s; s=s.replace(old,new,1)

old="""    case 1:{
      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      requireAccepted();
      const latest=changes.at(-1),confirmed=safe(project.projectData.stageConfirmations).some(item=>Number(item.stage)===1&&item.confirmed===true&&!item.invalidatedBy&&item.acceptedChangeId===latest?.changeId&&item.inputVersion===project.job.CURRENT_INPUT_VERSION);
      if(!confirmed)reasons.push('Human confirmation bound to the current accepted change and input version is required.');
      break;
    }"""
new="""    case 1:{
      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      requireAccepted();
      for(const name of ['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'])if(!String(project.stages[1]?.agentData?.[name]??'').trim())reasons.push(`Stage 01 accepted data is missing ${name}.`);
      const latest=changes.at(-1),confirmed=safe(project.projectData.stageConfirmations).some(item=>Number(item.stage)===1&&item.confirmed===true&&!item.invalidatedBy&&item.acceptedChangeId===latest?.changeId&&item.inputVersion===project.job.CURRENT_INPUT_VERSION);
      if(!confirmed)reasons.push('Human confirmation bound to the current accepted change and input version is required.');
      break;
    }"""
assert old in s; s=s.replace(old,new,1)

old="""    case 3:{
      requireAccepted();const sourceIds=all('sources').map(record=>recordId(record,'sources')),noSource=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(!sourceIds.length){if(!noSource)reasons.push('Stage 03 cannot proceed without a current Stage 02 source set or valid no-source determination.');break;}
      requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);break;
    }"""
new="""    case 3:{
      requireAccepted();const sourceIds=all('sources').map(record=>recordId(record,'sources')),noSource=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(!sourceIds.length){if(!noSource)reasons.push('Stage 03 cannot proceed without a current Stage 02 source set or valid no-source determination.');break;}
      requireCount('research',1);const stageData=project.stages[3]?.agentData||{},bySource=new Map(sourceIds.map(id=>[id,[]]));for(const item of collection('research')){const sourceId=String(recordValue(item,'SOURCE_ID')||item.relationships?.SOURCE_ID||'');if(bySource.has(sourceId))bySource.get(sourceId).push(item);}const missing=sourceIds.filter(id=>!bySource.get(id)?.length);if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);const incompletePasses=sourceIds.filter(id=>Math.max(0,...(bySource.get(id)||[]).map(item=>numeric(recordValue(item,'PASS_NUMBER'))))<2);if(incompletePasses.length)reasons.push(`At least two research passes are required for source(s): ${incompletePasses.join(', ')}.`);if(!truth(stageData.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED))reasons.push('The second conflict and exception pass is not established.');if(numeric(stageData.LATEST_PASS_NUMBER)<2)reasons.push('The latest research pass must be at least pass 2.');if(!falsey(stageData.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS))reasons.push('The latest research pass must affirmatively establish that no new material category was found.');break;
    }"""
assert old in s; s=s.replace(old,new,1)

old="""    case 9:
      requireAccepted();requireCount('preflightRecords',1);
      if(collection('preflightRecords').some(record=>['VIOLATED','UNDETERMINED','BLOCKED','REJECTED'].includes(upper(recordValue(record,'DETERMINATION')))))reasons.push('Instruction preflight contains an unresolved material finding.');
      break;"""
new="""    case 9:{
      requireAccepted();requireCount('preflightRecords',1);const stageData=project.stages[9]?.agentData||{};
      if(!truth(stageData.REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR))reasons.push('Stage 09 requires an independent review context.');
      if(!truth(stageData.EVERY_SENTENCE_REVIEWED))reasons.push('Stage 09 requires every sentence and material clause to be reviewed.');
      for(const name of ['KNOWN_MATERIAL_AMBIGUITIES','KNOWN_MATERIAL_CONFLICTS','UNAVAILABLE_REQUIRED_CAPABILITIES','UNVERIFIABLE_INSTRUCTIONS'])if(!falsey(stageData[name]))reasons.push(`Stage 09 cannot complete while ${name} is unresolved.`);
      if(collection('preflightRecords').some(record=>['VIOLATED','UNDETERMINED','BLOCKED','REJECTED'].includes(upper(recordValue(record,'DETERMINATION')))))reasons.push('Instruction preflight contains an unresolved material finding.');
      break;
    }"""
assert old in s; s=s.replace(old,new,1)

old="""    case 13:{
      requireAccepted();const reqs=mandatoryRequirements(project),compared=new Set(collection('comparisons').map(record=>String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'')));
      const missing=reqs.filter(req=>!compared.has(requirementId(req))).map(requirementId);
      if(missing.length)reasons.push(`Cross-run comparison is missing for: ${missing.join(', ')}.`);
      break;
    }"""
new="""    case 13:{
      requireAccepted();const iteration=latestIteration(project,[10,17,19]),matrix=verificationMatrix(project,recordId(iteration,'iterations'));if(matrix.runs.length!==10||matrix.expected.length===0||matrix.coverage!==1||matrix.duplicates.length||matrix.invalid.length)reasons.push('Stage 13 requires the complete valid current REQ × RUN × TEST verification matrix before comparison.');const reqs=matrix.requirements,expectedIds=new Set(reqs.map(requirementId)),counts=new Map();for(const comparison of collection('comparisons')){const id=String(recordValue(comparison,'REQ_ID')||comparison.relationships?.REQ_ID||'');counts.set(id,(counts.get(id)||0)+1);if(truth(recordValue(comparison,'CORRECTNESS_AFFECTING_VARIANCE'))&&falsey(recordValue(comparison,'DEFECT_IDS')))reasons.push(`Comparison ${recordId(comparison,'comparisons')} has correctness-affecting variance without a linked defect.`);}const missing=[...expectedIds].filter(id=>counts.get(id)!==1),unexpected=collection('comparisons').filter(record=>!expectedIds.has(String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'')));if(missing.length)reasons.push(`Exactly one cross-run comparison is required for: ${missing.join(', ')}.`);if(unexpected.length)reasons.push('Unexpected comparison records exist outside the current mandatory requirement set.');
      break;
    }"""
assert old in s; s=s.replace(old,new,1)

old="function recalculate(project){\n  ensureShape(project);\n  let previousComplete=true;"
new="function recalculate(project){\n  ensureShape(project);\n  refreshComparisonDerivations(project);\n  let previousComplete=true;"
assert old in s; s=s.replace(old,new,1)
p.write_text(s)

# Truthful clipboard status.
p=Path('app-core.js'); s=p.read_text()
old="if($('#copy-prompt'))$('#copy-prompt').onclick=async()=>{const record=await savePromptRecord(current.activeStage);await navigator.clipboard?.writeText(record.prompt);announce('instruction saved and copied');};"
new="if($('#copy-prompt'))$('#copy-prompt').onclick=async()=>{const record=await savePromptRecord(current.activeStage);if(!navigator.clipboard?.writeText){announce('instruction saved; clipboard unavailable');return;}try{await navigator.clipboard.writeText(record.prompt);announce('instruction saved and copied');}catch{announce('instruction saved; clipboard copy failed');}};"
assert old in s; p.write_text(s.replace(old,new,1))

# Full-cycle Stage 09 fixture now supplies its already-declared completion assertions.
p=Path('verify-full-cycle.mjs'); s=p.read_text()
old="data(9,{records:{preflightRecords:[recordProposal(schema,'preflightRecords',{tempKey:'preflight',relationships:{INSTRUCTION_ID:{recordId:instructionId}},overrides:{CLAUSE:'Full instruction',DETERMINATION:'SATISFIED',FINDINGS:'No material ambiguity',EVIDENCE:'Independent preflight evidence'}})]}});complete(9);"
new="data(9,{stageData:{REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR:'TRUE',EVERY_SENTENCE_REVIEWED:'TRUE',KNOWN_MATERIAL_AMBIGUITIES:'NONE',KNOWN_MATERIAL_CONFLICTS:'NONE',UNAVAILABLE_REQUIRED_CAPABILITIES:'NONE',UNVERIFIABLE_INSTRUCTIONS:'NONE'},records:{preflightRecords:[recordProposal(schema,'preflightRecords',{tempKey:'preflight',relationships:{INSTRUCTION_ID:{recordId:instructionId}},overrides:{CLAUSE:'Full instruction',DETERMINATION:'SATISFIED',FINDINGS:'No material ambiguity',EVIDENCE:'Independent preflight evidence'}})]}});complete(9);"
assert old in s; p.write_text(s.replace(old,new,1))

# Focused permanent adversarial proofs.
p=Path('verify-complete.mjs'); s=p.read_text(); anchor=s.rfind('\nconsole.log(JSON.stringify('); assert anchor>0
tests=r'''

// Stage 01 cannot complete from confirmation alone when the accepted normalized agent result is incomplete.
{
  const p=project('JOB-STAGE1-COMPLETE');p.projectData.acceptedChanges.push({changeId:'CHANGE-S1',stage:1,status:'COMMITTED',responseType:'DATA_PROPOSAL'});p.projectData.stageConfirmations.push({stage:1,confirmed:true,acceptedChangeId:'CHANGE-S1',inputVersion:p.job.CURRENT_INPUT_VERSION});const g=engine.gate(1,p);assert(!g.complete&&g.reasons.some(r=>/accepted data is missing/i.test(r)),'Stage 01 completed without the required accepted normalized agent result.');
}
// Stage 03 cannot complete after one source-research pass.
{
  const p=project('JOB-STAGE3-SATURATION');p.stages[2].status='COMPLETE';p.projectData.acceptedChanges.push({changeId:'CHANGE-S3',stage:3,status:'COMMITTED',responseType:'DATA_PROPOSAL'});p.projectData.sources.push(record('sources',2,{TITLE:'Authority'},'SOURCE-S3'));p.projectData.research.push(record('research',3,{SOURCE_ID:'SOURCE-S3',PASS_NUMBER:1,EXACT_PORTION_EXAMINED:'First pass',FINDING_CLASSIFICATION:'FACT',SOURCE_EVIDENCE:'evidence'},'RESEARCH-S3'));const g=engine.gate(3,p);assert(!g.complete&&g.reasons.some(r=>/two research passes|second conflict|latest research pass/i.test(r)),'Stage 03 completed after only one research pass.');
}
// Stage 09 cannot reduce preflight to one satisfied record without independence/full-review assertions.
{
  const p=project('JOB-STAGE9-COMPLETE');p.stages[8].status='COMPLETE';p.projectData.acceptedChanges.push({changeId:'CHANGE-S9',stage:9,status:'COMMITTED',responseType:'DATA_PROPOSAL'});p.projectData.preflightRecords.push(record('preflightRecords',9,{CLAUSE:'One clause only',DETERMINATION:'SATISFIED',EVIDENCE:'partial review'},'PREFLIGHT-S9'));const g=engine.gate(9,p);assert(!g.complete&&g.reasons.some(r=>/independent review context|every sentence/i.test(r)),'Stage 09 completed without independent full-instruction review.');
}
// Wrong regression phase cannot satisfy corrected-iteration regression success.
{
  const p=project('JOB-REG-PHASE');const iteration=record('iterations',17,{CANDIDATE_ID:'CANDIDATE-REG',STATUS:'FROZEN'},'ITERATION-REG');iteration.scope={iterationId:'ITERATION-REG',candidateId:'CANDIDATE-REG'};p.projectData.iterations.push(iteration);p.projectData.regressions.push(record('regressions',15,{ACTIVE_RETIRED_STATE:'ACTIVE'},'REG-PHASE'));const execution=record('regressionExecutions',19,{REG_ID:'REG-PHASE',ITERATION_ID:'ITERATION-REG',CANDIDATE_ID:'CANDIDATE-REG',PHASE:'UNCHANGED_CONFIRMATION',RESULT:'SATISFIED'},'REG-EXEC-PHASE');execution.scope={iterationId:'ITERATION-REG',candidateId:'CANDIDATE-REG'};p.projectData.regressionExecutions.push(execution);const metrics=engine.coverageMetrics(p,'ITERATION-REG');assert(metrics.successfulRegressionCount===0&&metrics.regressionSuccess===0,'Wrong-phase regression success satisfied the corrected iteration.');const phaseDef=schema.RECORD_SCHEMAS.regressionExecutions.fieldDefinitions.PHASE,resultDef=schema.RECORD_SCHEMAS.regressionExecutions.fieldDefinitions.RESULT;assert(phaseDef.enumValues.includes('POST_CORRECTION')&&phaseDef.enumValues.includes('UNCHANGED_CONFIRMATION'),'Regression PHASE is not closed.');assert(JSON.stringify(resultDef.enumValues)===JSON.stringify(['SATISFIED','VIOLATED','UNDETERMINED']),'Regression RESULT is not closed.');
}
// Application derives comparison truth from exact verification records, not agent prose.
{
  const p=project('JOB-COMPARISON-DERIVATION');p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-CMP';p.job.CURRENT_TEST_SUITE_VERSION='TESTS-CMP';p.job.CURRENT_ITERATION='ITERATION-CMP';const scope={requirementsVersion:'REQUIREMENTS-CMP',testSuiteVersion:'TESTS-CMP',iterationId:'ITERATION-CMP',candidateId:'CANDIDATE-CMP'};const iteration=record('iterations',10,{CANDIDATE_ID:'CANDIDATE-CMP',STATUS:'FROZEN'},'ITERATION-CMP');iteration.scope={...scope};p.projectData.iterations.push(iteration);const req=record('requirements',4,{OBLIGATION:'Requirement',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'yes',INTENDED_VERIFICATION_METHOD:'deterministic',EXPECTED_EVIDENCE:'e',FAILURE_CONDITION:'f',SEVERITY:'MAJOR',STATUS:'ACTIVE'},'REQ-CMP');req.scope={requirementsVersion:'REQUIREMENTS-CMP'};p.projectData.requirements.push(req);const test=record('tests',6,{REQ_ID:'REQ-CMP',TEST_TYPE:'DETERMINISTIC',STATUS:'READY'},'TEST-CMP');test.scope={requirementsVersion:'REQUIREMENTS-CMP',testSuiteVersion:'TESTS-CMP'};p.projectData.tests.push(test);for(let i=0;i<10;i++){const runId=`RUN-CMP-${i}`,run=record('runs',11,{ITERATION_ID:'ITERATION-CMP',CANDIDATE_ID:'CANDIDATE-CMP'},runId);run.scope={...scope};p.projectData.runs.push(run);const verification=record('verification',12,{REQ_ID:'REQ-CMP',RUN_ID:runId,TEST_ID:'TEST-CMP',INDEPENDENCE_STATUS:'INDEPENDENT',EXACT_EVIDENCE:'evidence',DETERMINATION:'SATISFIED'},`VERIFY-CMP-${i}`);verification.scope={...scope};p.projectData.verification.push(verification);}const comparison=record('comparisons',13,{REQ_ID:'REQ-CMP',RUN_DETERMINATIONS:'agent prose must not control application truth',CORRECTNESS_AFFECTING_VARIANCE:'FALSE',DEFECT_IDS:'NONE'},'COMPARE-CMP');comparison.scope={...scope};p.projectData.comparisons.push(comparison);engine.recalculate(p);assert(comparison.fields.ALL_TEN_SATISFIED===true&&comparison.fields.ANY_VIOLATION===false&&comparison.fields.ANY_UNDETERMINED===false,'Comparison truth was not derived from the verification matrix.');p.projectData.verification[0].fields.DETERMINATION='VIOLATED';p.projectData.verification[0].DETERMINATION='VIOLATED';engine.recalculate(p);assert(comparison.fields.ALL_TEN_SATISFIED===false&&comparison.fields.ANY_VIOLATION===true,'Verification violation did not update comparison truth.');
}
'''
s=s[:anchor]+tests+s[anchor:]; p.write_text(s)

# Rotate one shared runtime cache identity after runtime semantic changes.
p=Path('index.html'); s=p.read_text(); names='(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)'; updated,n=re.subn(rf'({names}\.js)\?v=[^\"]+',r'\1?v=20260826-semantic-gates-1',s); assert n==8, n; p.write_text(updated)
