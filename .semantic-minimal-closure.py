from pathlib import Path


def replace(path, old, new, count=1):
    p = Path(path)
    s = p.read_text()
    actual = s.count(old)
    if actual < count:
        raise SystemExit(f"{path}: expected at least {count} occurrence(s), found {actual}: {old[:120]!r}")
    p.write_text(s.replace(old, new, count))

# 1. Workbook declarations must describe the actual source model and Stage 15 chronology.
replace('workbook.js',
        "'Extract every material requirement, restriction, exception, condition, and dependency from the governing sources.'",
        "'Extract every material fact, requirement, restriction, exception, condition, dependency, recommendation, and evidentiary constraint from the accepted external source set while preserving each source role.'")
replace('workbook.js',
        "2:['Every governing source has a complete record','Every relied-upon supplied file was inspected','Authority hierarchy is recorded','Every controlling conflict is resolved or blocked'],3:['Every controlling source has a research record'",
        "2:['Every accepted independent external source has a complete record','Every relied-upon supplied file was inspected','Authority and evidentiary roles are recorded','Every controlling conflict is resolved or blocked'],3:['Every current accepted Stage 02 source has a research record'")
replace('workbook.js', "'POST_CORRECTION_SUCCESSES_PROVEN',", "")

# The canonical prompt authority is prompt-engine.js. Remove the old workbook prompt builder entirely.
p = Path('workbook.js')
s = p.read_text()
start = s.find('function buildStagePrompt(stage,state){')
end = s.find('const n=v=>', start)
if start < 0 or end < 0:
    raise SystemExit('workbook.js legacy buildStagePrompt block not found')
s = s[:start] + s[end:]
s = s.replace(',buildStagePrompt,validateStageDraft', ',validateStageDraft', 1)
p.write_text(s)

# 2. Source guidance must distinguish governing authority from other legitimate external evidence.
replace('prompt-engine.js',
        "If no legitimate external governing source applies, return SOURCE_APPLICABILITY_DETERMINATION = NO_APPLICABLE_EXTERNAL_SOURCE with evidence; never invent a source merely to satisfy a count.",
        "If no legitimate independent external source of any justified authority or evidentiary role applies, return SOURCE_APPLICABILITY_DETERMINATION = NO_APPLICABLE_EXTERNAL_SOURCE with evidence; never invent a source merely to satisfy a count.")
replace('workflow-engine.js',
        "Either at least one legitimate external governing source or an explicit NO_APPLICABLE_EXTERNAL_SOURCE determination is required.",
        "Either at least one legitimate independent external source or an explicit NO_APPLICABLE_EXTERNAL_SOURCE determination is required.")

# 3. Large-work recovery must not contradict Stage 01 deliverable normalization.
replace('prompt-engine.js',
        "- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, or incomplete canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. An unavailable external capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed. Work too large for the available environment requires BLOCKED with WORK_TOO_LARGE_FOR_ENVIRONMENT plus a complete implementation-ready specification; do not claim execution occurred. Self-contained deliverables that can actually be produced in the available environment should still be produced.",
        "- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, or incomplete canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. An unavailable external capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed. At Stage 01, when direct implementation is unavailable or materially too large but a complete implementation-ready specification, architecture, patch plan, acceptance package, or other reliable self-contained deliverable is feasible, propose that feasible deliverable in EXACT_DELIVERABLE_REQUESTED for human intent confirmation instead of blocking the entire project. At later stages, WORK_TOO_LARGE_FOR_ENVIRONMENT is blocking only when the currently approved deliverable itself cannot be completed reliably. Never claim unperformed implementation. Self-contained deliverables that can actually be produced in the available environment should still be produced.")

# 4. A human refinement of an already accepted answer must become controlling prompt context.
replace('workflow-engine.js',
        "const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;",
        "const proposal=safe(project.projectData.responseProposals).find(item=>item.proposalId===change.proposalId),operation=change.operation||proposal?.envelope?.operation||'COMPLETE',scope=clone(change.scope||proposal?.scope||proposal?.envelope?.scope||{});const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,promptId:change.promptId||proposal?.promptId||null,operation,scope,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;")
replace('prompt-engine.js',
        "const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));if(corrections.length)parts.push(`OPERATOR REQUESTED CORRECTIONS / REFINEMENTS\\n${show(corrections)}`);",
        "const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));if(corrections.length)parts.push(`OPERATOR REQUESTED CORRECTIONS / REFINEMENTS\\n${show(corrections)}`);const acceptedRefinements=(state?.projectData?.history||[]).filter(x=>x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId}));if(acceptedRefinements.length)parts.push(`ACCEPTED RESULT REFINEMENT REQUESTS\\n${show(acceptedRefinements)}`);")
replace('prompt-engine.js',
        "operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId})),latestValidationFailure:",
        "operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId})),acceptedResultRefinements:(state?.projectData?.history||[]).filter(x=>x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId})),latestValidationFailure:")

# 5. Raw audit metadata must come from the controlling prompt scope, never an arbitrary caller hint.
replace('response-ingestion.js',
        "const rawRecord={rawResponseId,outputId,jobId:next.job.JOB_ID,stage:stageNumber,role:globalThis.closedLoopCore?.STAGES?.[stageNumber-1]?.role||'UNKNOWN',contextId,iteration:next.job.CURRENT_ITERATION||'NOT APPLICABLE',promptInstructionId:",
        "const rawRecord={rawResponseId,outputId,jobId:next.job.JOB_ID,stage:stageNumber,role:globalThis.closedLoopCore?.STAGES?.[stageNumber-1]?.role||'UNKNOWN',contextId:prompt.scope?.contextId||contextId||'NOT APPLICABLE',runId:prompt.scope?.runId||'NOT APPLICABLE',iteration:prompt.scope?.iterationId||next.job.CURRENT_ITERATION||'NOT APPLICABLE',promptInstructionId:")

# Regression tests for the semantic closure.
p = Path('verify-prompt-semantics.mjs')
s = p.read_text()
s += r'''

// Minimum semantic closure on current main.
{
  const source=fs.readFileSync('workbook.js','utf8');
  if(source.includes('function buildStagePrompt(stage,state){'))throw new Error('workbook.js still contains a competing legacy prompt implementation.');
  if(source.includes('POST_CORRECTION_SUCCESSES_PROVEN'))throw new Error('Stage 15 still declares future post-correction success as a current-stage field.');
  if(core.STAGES[1].completionGate.some(x=>/every governing source/i.test(x))||core.STAGES[2].completionGate.some(x=>/every controlling source/i.test(x)))throw new Error('Workbook source completion language still treats every useful external source as governing authority.');
}
{
  const p=baseProject();
  const s1=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});
  if(!/propose that feasible deliverable in EXACT_DELIVERABLE_REQUESTED/i.test(s1.prompt)||!/human intent confirmation/i.test(s1.prompt))throw new Error('Stage 01 large-work recovery does not convert feasible specification work into a confirmable deliverable.');
  const s2=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});
  if(!/no legitimate independent external source of any justified authority or evidentiary role/i.test(s2.prompt))throw new Error('Stage 02 no-source path still incorrectly means no governing authority rather than no legitimate external source.');
}
{
  const p=baseProject();
  const first=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});p.projectData.generatedPrompts.push({...first,generatedAt:new Date().toISOString()});
  const proposalId='PROPOSAL-REFINE';p.projectData.responseProposals.push({proposalId,stage:2,promptId:first.instructionId,scope:first.scope,envelope:{operation:'COMPLETE',scope:first.scope},status:'ACCEPTED'});
  p.projectData.acceptedChanges.push({changeId:'CHANGE-REFINE',stage:2,status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-REFINE',proposalId,promptId:first.instructionId,operation:'COMPLETE',scope:first.scope});
  const event=engine.invalidateAcceptedResponse(p,{stage:2,rawResponseId:'RAW-REFINE',reason:'Add the omitted applicability analysis.',operatorLabel:'TEST_OPERATOR'});
  const next=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});
  if(!next.prompt.includes('ACCEPTED RESULT REFINEMENT REQUESTS')||!next.prompt.includes('Add the omitted applicability analysis.'))throw new Error('Accepted-result refinement reason is absent from the replacement prompt.');
  if(!next.contextManifest.acceptedResultRefinements?.some(x=>x.eventId===event.eventId))throw new Error('Accepted-result refinement is absent from the prompt context identity.');
  if(next.contextSignature===first.contextSignature)throw new Error('Accepted-result refinement did not change prompt context identity.');
}
'''
p.write_text(s)

p = Path('verify-ingestion.mjs')
s = p.read_text()
s += r'''

// Raw capture audit scope must be controlled by the persisted prompt, not a caller-supplied context hint.
{
  const p=baseProject(17);
  p.job.CURRENT_ITERATION='ITERATION-SCOPE-001';
  const prompt=promptEngine.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope:{iterationId:'ITERATION-SCOPE-001',candidateId:'CANDIDATE-SCOPE-001',runId:'RUN-SCOPE-001',contextId:'CONTEXT-SCOPE-001'}});
  p.projectData.generatedPrompts.push({...prompt,generatedAt:new Date().toISOString()});
  const captured=ingestion.captureRaw(p,{stage:17,text:'{}',promptRecord:prompt,contextId:'MISLEADING-CALLER-CONTEXT'});
  if(captured.rawRecord.runId!=='RUN-SCOPE-001'||captured.rawRecord.contextId!=='CONTEXT-SCOPE-001'||captured.rawRecord.iteration!=='ITERATION-SCOPE-001')throw new Error('Raw-response audit identity is not bound to the controlling prompt scope.');
}
'''
p.write_text(s)
