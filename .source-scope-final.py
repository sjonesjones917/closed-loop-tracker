from pathlib import Path

def replace(path, old, new):
    p=Path(path); s=p.read_text()
    if old not in s: raise SystemExit(f'{path}: pattern not found: {old[:120]!r}')
    p.write_text(s.replace(old,new,1))

replace('workbook.js',
        "'Extract every material requirement, restriction, exception, condition, and dependency from the governing sources.'",
        "'Extract every material fact, requirement, restriction, exception, condition, dependency, recommendation, and evidentiary constraint from the accepted external source set while preserving each source role.'")
replace('workbook.js',
        "2:['Every governing source has a complete record','Every relied-upon supplied file was inspected','Authority hierarchy is recorded','Every controlling conflict is resolved or blocked'],3:['Every controlling source has a research record'",
        "2:['Every accepted independent external source has a complete record','Every relied-upon supplied file was inspected','Authority and evidentiary roles are recorded','Every controlling conflict is resolved or blocked'],3:['Every current accepted Stage 02 source has a research record'")
replace('prompt-engine.js',
        "If no legitimate external governing source applies, return SOURCE_APPLICABILITY_DETERMINATION = NO_APPLICABLE_EXTERNAL_SOURCE with evidence; never invent a source merely to satisfy a count.",
        "If no legitimate independent external source of any justified authority or evidentiary role applies, return SOURCE_APPLICABILITY_DETERMINATION = NO_APPLICABLE_EXTERNAL_SOURCE with evidence; never invent a source merely to satisfy a count.")
replace('workflow-engine.js',
        "Either at least one legitimate external governing source or an explicit NO_APPLICABLE_EXTERNAL_SOURCE determination is required.",
        "Either at least one legitimate independent external source or an explicit NO_APPLICABLE_EXTERNAL_SOURCE determination is required.")
replace('response-ingestion.js',
        "const rawRecord={rawResponseId,outputId,jobId:next.job.JOB_ID,stage:stageNumber,role:globalThis.closedLoopCore?.STAGES?.[stageNumber-1]?.role||'UNKNOWN',contextId,iteration:next.job.CURRENT_ITERATION||'NOT APPLICABLE',promptInstructionId:",
        "const rawRecord={rawResponseId,outputId,jobId:next.job.JOB_ID,stage:stageNumber,role:globalThis.closedLoopCore?.STAGES?.[stageNumber-1]?.role||'UNKNOWN',contextId:prompt.scope?.contextId||contextId||'NOT APPLICABLE',runId:prompt.scope?.runId||'NOT APPLICABLE',iteration:prompt.scope?.iterationId||next.job.CURRENT_ITERATION||'NOT APPLICABLE',promptInstructionId:")

p=Path('verify-prompt-semantics.mjs'); s=p.read_text(); s += r'''

// Legitimate external evidence is not falsely required to be governing authority.
{
  const p=baseProject();
  const s2=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});
  if(!/no legitimate independent external source of any justified authority or evidentiary role/i.test(s2.prompt))throw new Error('Stage 02 no-source rule still incorrectly means no governing authority.');
  if(core.STAGES[1].completionGate.some(x=>/every governing source/i.test(x))||core.STAGES[2].completionGate.some(x=>/every controlling source/i.test(x)))throw new Error('Workbook source completion language still treats every useful external source as governing authority.');
}
'''; p.write_text(s)

p=Path('verify-ingestion.mjs'); s=p.read_text(); s += r'''

// Raw-response audit identity is controlled by the persisted prompt scope, not a caller hint.
{
  const p=project('JOB-RAW-SCOPE');
  p.job.CURRENT_ITERATION='ITERATION-SCOPE-001';
  const prompt=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope:{iterationId:'ITERATION-SCOPE-001',candidateId:'CANDIDATE-SCOPE-001',runId:'RUN-SCOPE-001',contextId:'CONTEXT-SCOPE-001'}});
  p.projectData.generatedPrompts.push({...prompt,generatedAt:new Date().toISOString()});
  const captured=ingestion.captureRaw(p,{stage:17,text:'{}',promptRecord:prompt,contextId:'MISLEADING-CALLER-CONTEXT'});
  if(captured.rawRecord.runId!=='RUN-SCOPE-001'||captured.rawRecord.contextId!=='CONTEXT-SCOPE-001'||captured.rawRecord.iteration!=='ITERATION-SCOPE-001')throw new Error('Raw-response audit identity is not bound to the controlling prompt scope.');
}
'''; p.write_text(s)
