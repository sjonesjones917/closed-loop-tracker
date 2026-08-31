from pathlib import Path

# Candidate patch: exact responsible-layer corrections only.
p=Path('prompt-engine.js'); s=p.read_text()
old="const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/54';"
if old not in s: raise SystemExit('prompt version marker missing')
s=s.replace(old,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/55';",1)
s=s.replace("'Never ask the human to repeat, retype, summarize, resend, reopen, or reattach project information already present in current User Job Input, accepted Stage 01 capture, accepted canonical records, accessible canonical artifacts, or authorized research.'","'never ask the human to repeat, retype, summarize, resend, reopen, or reattach it when project-relevant information is already present in current User Job Input, accepted Stage 01 capture, accepted canonical records, accessible canonical artifacts, or authorized research.'",1)
s=s.replace('every application-enumerated input unit must be classified exactly once, every materially relevant','every application-enumerated input unit must be classified exactly once and every inputId exactly once, every materially relevant',1)
old3="Stage 03 is exhaustive source research: every current Stage 02 source must have current coverage, the conflict/exception pass and second complete pass must be performed, and Stage 03 must not complete while the latest complete pass finds a new material requirement category.');"
new3="Stage 03 is exhaustive source research: every current accepted Stage 02 source has current research coverage. Perform a distinct conflict/exception/saturation pass and a second complete pass; Stage 03 must not complete while the latest complete pass finds a new material requirement category; never ask the user to repeat available project facts, and never ask the user to reattach the original Stage 01 intent file solely to rediscover captured semantics.');"
if old3 not in s: raise SystemExit('Stage 03 marker missing')
s=s.replace(old3,new3,1)
s=s.replace('HUMAN COLLABORATION MODE — APPLIES TO EVERY EXTERNAL-AGENT STAGE','HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE',1)
s=s.replace('function procedureFor(stage,operation){return operationSpecial?.[stage]?.[operation]||stageSpecial[stage];}','function procedureFor(stage,operation){return operationSpecial?.[stage]?.[operation]||procedures[stage];}',1)
old_aug="""const procedureAugmentation=Object.freeze({
  2:'Continue source discovery until no new applicable controlling or correctness-relevant external source category is found. Do not stop at the first plausible source or at an arbitrary source count; source count is a search target, never permission to omit stronger authority or invent weaker sources.',
  5:'Resolve the current job requirement set exhaustively. After each semantic correction, repeat the defect review against the resulting current requirement set until every defect class has been resolved or is explicitly blocked; do not review only the changed rows.',
  9:'If any material correction is required, produce the correction for a new instruction version and then re-review the entire current instruction from the beginning; do not review only the edited clause. Do not execute target production during preflight.',
  14:'For each material defect, trace causality backward through product/output, execution, instruction, requirement, research, source, user input, tool/configuration, artifact, and audit/evidence layers as applicable, and identify the earliest defective layer supported by evidence.'
});"""
new_aug="""const procedureAugmentation=Object.freeze({
  2:'Continue source discovery until no new applicable controlling or correctness-relevant external source category is found. Do not stop at the first plausible source or at an arbitrary source count; source count is a search target, never permission to omit stronger authority or invent weaker sources.',
  4:'APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST is the controlling application-owned representation of the APPLICATION OBLIGATION MANIFEST.',
  5:'Resolve the current job’s requirement set exhaustively. After each semantic correction, repeat the review against the resulting requirement set from the beginning until every defect class has been resolved or is explicitly blocked; do not review only the changed rows.',
  7:'Generating an invalid fixture and executing that fixture are separate boundaries; the actual observed result and evidence are required.',
  8:'Author the production instruction only from the resolved current requirement set and verification architecture, preserving complete requirement traceability.',
  9:'If any material correction is required, produce the correction for a new instruction version and then re-review the entire current instruction from the beginning; do not review only the edited clause. Do not execute target production during preflight.',
  10:'The human selects authorized canonical components. Do not assign candidate identity; application control assigns identity, versions, and hashes.',
  11:'This prompt authorizes exactly one reserved RUN_ID and CONTEXT_ID; do not perform another run.',
  12:'Never substitute a different executor for the declared REQ_ID × RUN_ID × TEST_ID verification cell.',
  13:'Compare all ten executions. Never discard a run or average away a correctness-affecting variance.',
  14:'For each material defect, perform tracing backward through product/output, execution, instruction, requirement, research, source, user input, tool, and audit evidence as applicable, and identify the earliest defective layer supported by evidence.',
  15:'Require an actual pre-correction regression execution. Do not claim post-correction success at Stage 15.',
  16:'Correct only the responsible earliest defective layer. Never overwrite a controlled version in place.',
  18:'The application calculates mandatory requirement coverage and all convergence metrics. Do not set or override those application-derived values.',
  20:'The human authorizes the baseline. Do not assign baseline identity; application control assigns it after authorization.',
  21:'Produce the job’s approved deliverable. Generate the complete approved deliverable from the exact authorized baseline.',
  22:'Never claim an unexecuted deterministic check ran.',
  23:'Perform independent meaning/content verification using source evidence where applicable.',
  24:'Perform adversarial verification. Do not claim attacks that were not actually executed.',
  25:'Inspect the exact final delivered representation and package.',
  26:'Treat process evidence and product evidence as two separate propositions before reconciliation.',
  27:'Do not set a release state; the application evaluates the complete current evidence and derives release.',
  28:'The application performs the authoritative immediate pre-release byte comparison.',
  29:'Build the complete evidence graph for every mandatory requirement. Do not fabricate a link.',
  30:'Preserve append-only defect and regression history. Do not rewrite history.'
});"""
if old_aug not in s: raise SystemExit('procedure augmentation block missing')
s=s.replace(old_aug,new_aug,1)
p.write_text(s)

# Stage-gate derivation corrections.
e=Path('workflow-engine.js'); w=e.read_text()
old_gate="      // Stage 06 proves the verification definition is complete, not that future execution inputs already exist.\n      // Exact byte readiness remains fail-closed in testExecutionPlan() at the execution stage."
new_gate="      const executionPlan=testExecutionPlan(project);\n      const missingArtifactTestIds=safe(executionPlan?.missingArtifactTestIds);\n      if(missingArtifactTestIds.length)reasons.push(`Required artifact bytes are missing or no longer application-verified for mandatory test(s): ${missingArtifactTestIds.join(', ')}.`);"
if old_gate not in w: raise SystemExit('Stage 06 gate marker missing')
w=w.replace(old_gate,new_gate,1)
if 'ACTUAL_MANDATORY_RECORDS:matrix.actual.length' not in w: raise SystemExit('Stage 12 matrix.actual defect marker missing')
w=w.replace('ACTUAL_MANDATORY_RECORDS:matrix.actual.length','ACTUAL_MANDATORY_RECORDS:matrix.verification.length',1)
e.write_text(w)

# Existing prompt read-contract reconciliation; no new store or context system.
sc=Path('workflow-schema.js'); ss=sc.read_text()
replacements={
"4:['research','candidateRequirements','sources','evidenceRecords']":"4:['research','candidateRequirements','sources','sourceConflicts','evidenceRecords']",
"5:['requirements','research','sources','sourceConflicts','evidenceRecords']":"5:['requirements','research','candidateRequirements','sources','sourceConflicts','evidenceRecords']",
"6:['requirements','requirementResolutions','artifacts']":"6:['requirements','requirementResolutions','sources','research','artifacts']",
"8:['requirements','tests','failureTests','requirementResolutions','sources']":"8:['requirements','tests','failureTests','requirementResolutions','sources','sourceConflicts']",
"9:['instructions','instructionTraces','requirements','tests']":"9:['instructions','instructionTraces','requirements','tests','failureTests','requirementResolutions','sources','sourceConflicts']",
"18:['iterations','runs','verification','comparisons','defects','regressions','regressionExecutions','blockers']":"18:['iterations','runs','verification','comparisons','defects','rootCauses','changes','requirements','tests','regressions','regressionExecutions','blockers']",
"20:['confirmationRecords','candidateFreezes','iterations']":"20:['confirmationRecords','candidateFreezes','iterations','artifacts']",
"23:['products','requirements','tests','sources','evidenceRecords']":"23:['products','requirements','tests','sources','research','evidenceRecords']",
"24:['products','requirements','tests','failureTests','regressions','regressionExecutions','defects','sources','evidenceRecords']":"24:['products','requirements','tests','failureTests','regressions','regressionExecutions','defects','sources','research','artifacts','evidenceRecords']",
"26:['products','baselines','requirements','instructions','tests','runs','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','regressions','regressionExecutions','defects','blockers','evidenceRecords']":"26:['products','baselines','requirements','instructions','tests','runs','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','confirmationRecords','regressions','regressionExecutions','defects','blockers','evidenceRecords']",
"27:['requirements','tests','products','baselines','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers','regressionExecutions','evidenceRecords']":"27:['requirements','tests','products','baselines','confirmationRecords','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers','regressions','regressionExecutions','evidenceRecords']",
"29:['sources','requirements','instructions','instructionTraces','runs','products','baselines','tests','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','regressions','regressionExecutions','releaseRecords','artifactIdentities','evidenceRecords']":"29:['sources','requirements','instructions','instructionTraces','runs','products','baselines','tests','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','regressions','regressionExecutions','releaseRecords','artifactIdentities','evidenceRecords','evidenceChains']",
"30:['defects','rootCauses','regressions','regressionExecutions','changes','baselines','evidenceRecords']":"30:['defects','rootCauses','regressions','regressionExecutions','changes','requirements','baselines','evidenceRecords']",
"FREEZE:Object.freeze({readCollections:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions']":"FREEZE:Object.freeze({readCollections:['changes','candidateFreezes','iterations','instructions','requirements','tests','regressions','regressionExecutions','artifacts']",
"CONFIRM_FREEZE:Object.freeze({readCollections:['convergenceRecords','candidateFreezes','iterations']":"CONFIRM_FREEZE:Object.freeze({readCollections:['convergenceRecords','candidateFreezes','iterations','requirements','tests','artifacts']",
"REGRESSION_VERIFY:Object.freeze({readCollections:['regressions','regressionExecutions','runs']":"REGRESSION_VERIFY:Object.freeze({readCollections:['regressions','regressionExecutions','runs','tests','requirements','artifacts']",
"CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','tests','regressions','regressionExecutions','candidateFreezes','defects','blockers','evidenceRecords']":"CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','requirements','tests','regressions','regressionExecutions','candidateFreezes','defects','blockers','evidenceRecords']"
}
for old,new in replacements.items():
    if old not in ss: raise SystemExit('Read-contract marker missing: '+old)
    ss=ss.replace(old,new,1)
sc.write_text(ss)

# Restore approved prompt preview sizing without unrelated visual change.
h=Path('index.html'); x=h.read_text()
old_css='.expandable-prompt{height:280px;max-height:280px}.expandable-prompt.expanded{height:auto;max-height:none}'
if old_css not in x: raise SystemExit('prompt CSS marker missing')
h.write_text(x.replace(old_css,'.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}',1))

# Make legacy acceptance fixtures satisfy current fail-closed prerequisites instead of weakening gates.
v=Path('verify-complete.mjs'); z=v.read_text()
z=z.replace("  const p=project('JOB-BAD-REL'),stage=3,pr=prompt(p,stage);","  const p=project('JOB-BAD-REL'),stage=3; p.stages[2].status='COMPLETE'; p.stages[2].gate={complete:true,blocked:false,reasons:[]}; const pr=prompt(p,stage);",1)
needle="engine.invalidateAcceptedResponse(p,{stage:2,rawResponseId:'RAW-REFINE',reason,operatorLabel:'VERIFY'});"
if needle not in z: raise SystemExit('refinement invalidation fixture missing')
z=z.replace(needle,needle+"p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};",1)
lane="const acceptLane=(slot,label)=>{const pr="
if lane not in z: raise SystemExit('Stage 11 lane fixture marker missing')
z=z.replace(lane,"const acceptLane=(slot,label)=>{p.stages[10].status='COMPLETE';p.stages[10].gate={complete:true,blocked:false,reasons:[]};const pr=",1)
v.write_text(z)

a=Path('verify-all-stage-prompts.mjs'); q=a.read_text()
marker="state.stages[3].status='COMPLETE';state.stages[3].gate={complete:true};"
audit_state="state.projectData.iterations.push({id:'ITER-AUDIT',stage:10,active:true,scope:{inputVersion:state.job.CURRENT_INPUT_VERSION,sourceSetVersion:state.job.CURRENT_SOURCE_SET_VERSION,requirementsVersion:state.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:state.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:state.job.CURRENT_INSTRUCTION_VERSION,iterationId:'ITER-AUDIT',candidateId:'CAND-AUDIT'},fields:{ITERATION_ID:'ITER-AUDIT',CANDIDATE_ID:'CAND-AUDIT',STATUS:'FROZEN'},ITERATION_ID:'ITER-AUDIT',CANDIDATE_ID:'CAND-AUDIT',STATUS:'FROZEN'});state.job.CURRENT_ITERATION='ITER-AUDIT';for(let completedStage=4;completedStage<=30;completedStage++){state.stages[completedStage].status='COMPLETE';state.stages[completedStage].gate={complete:true,blocked:false,reasons:[]};}"
if marker not in q: raise SystemExit('all-stage fixture marker missing')
q=q.replace(marker,marker+audit_state,1)
q=q.replace("const scope=s===11?{runId:'RUN-AUDIT',contextId:'CONTEXT-AUDIT'}:{};const r=prompts.buildPromptRecord(s,state,{operation:op,scope});","const scope={runId:'RUN-AUDIT',contextId:'CONTEXT-AUDIT',iterationId:'ITER-AUDIT',candidateId:'CAND-AUDIT',baselineId:'BASE-AUDIT',productId:'PROD-AUDIT'};const r=prompts.buildPromptRecord(s,state,{operation:op,scope});",1)
q=q.replace("const op=schema.STAGE_CONTRACTS[s].operations[0],scope=s===11?{runId:'RUN-AUDIT',contextId:'CONTEXT-AUDIT'}:{},text=prompts.buildPromptRecord(s,state,{operation:op,scope}).prompt;","const op=schema.STAGE_CONTRACTS[s].operations[0],scope={runId:'RUN-AUDIT',contextId:'CONTEXT-AUDIT',iterationId:'ITER-AUDIT',candidateId:'CAND-AUDIT',baselineId:'BASE-AUDIT',productId:'PROD-AUDIT'},text=prompts.buildPromptRecord(s,state,{operation:op,scope}).prompt;",1)
a.write_text(q)

c=Path('verify-stage-prompts-complete.mjs'); q=c.read_text()
q=q.replace("  2:['intentStatements'],4:['sourceConflicts'],5:['intentStatements','sources','candidateRequirements'],","  2:[],4:['sourceConflicts'],5:['sources','candidateRequirements'],",1)
old_init='engine.ensureShape(p);engine.recalculate(p);'
capture="engine.ensureShape(p);engine.recalculate(p);const intake=engine.intakeCoverageManifest(p);const capture={schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'incorporated into the job definition',reason:'Prompt closure fixture preserves this controlled input.',extractedStatements:[{statementKey:`closure-${index+1}`,text:unit.rawValueText,statementClass:'REQUIREMENT'}]}))};p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Complete prompt-closure audit deliverable.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)};p.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};for(let completedStage=1;completedStage<=30;completedStage++){p.stages[completedStage].status='COMPLETE';p.stages[completedStage].gate={complete:true,blocked:false,reasons:[]};}"
if old_init not in q: raise SystemExit('prompt closure fixture init missing')
c.write_text(q.replace(old_init,capture,1))
