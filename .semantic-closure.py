from pathlib import Path


def must_replace(path, old, new, count=1):
    p = Path(path)
    s = p.read_text()
    n = s.count(old)
    if n < count:
        raise SystemExit(f"{path}: expected {count} occurrence(s), found {n}: {old[:120]}")
    p.write_text(s.replace(old, new, count))

# workbook.js — source-role language, Stage 15 chronology, one prompt authority.
must_replace(
    'workbook.js',
    "'Extract every material requirement, restriction, exception, condition, and dependency from the governing sources.'",
    "'Extract every material fact, requirement, restriction, exception, condition, dependency, recommendation, and evidentiary constraint from the accepted external source set while preserving each source role.'",
)
must_replace(
    'workbook.js',
    "2:['Every governing source has a complete record','Every relied-upon supplied file was inspected','Authority hierarchy is recorded','Every controlling conflict is resolved or blocked'],3:['Every controlling source has a research record'",
    "2:['Every accepted independent external source has a complete record','Every relied-upon supplied file was inspected','Authority and evidentiary roles are recorded','Every controlling conflict is resolved or blocked'],3:['Every current accepted Stage 02 source has a research record'",
)
p = Path('workbook.js')
s = p.read_text()
s = s.replace("'POST_CORRECTION_SUCCESSES_PROVEN',", '')
s = s.replace('"POST_CORRECTION_SUCCESSES_PROVEN",', '')
s = s.replace(',"POST_CORRECTION_SUCCESSES_PROVEN"', '')
s = s.replace(",'POST_CORRECTION_SUCCESSES_PROVEN'", '')
if 'POST_CORRECTION_SUCCESSES_PROVEN' in s:
    raise SystemExit('workbook.js: obsolete Stage 15 future-success field remains')
start = s.find('function buildStagePrompt(stage,state){')
end = s.find('const n=v=>', start)
if start < 0 or end < 0:
    raise SystemExit('workbook.js: legacy buildStagePrompt block not found')
s = s[:start] + s[end:]
s = s.replace('buildStagePrompt,', '')
if 'buildStagePrompt' in s:
    raise SystemExit('workbook.js: competing prompt function remains')
p.write_text(s)

# prompt-engine.js — feasible Stage 1 deliverable and exact Stage 21 output semantics.
must_replace(
    'prompt-engine.js',
    "1:'Initialize only this current job from this current job’s exact user input. Preserve the verbatim objective, exact deliverable, supplied-material inventory and provenance, inspection state, format requirements, temporal and geographic scope, user-supplied authority, tools, prohibitions, explicit user requirements, assumptions, unresolved unknowns, and controlled INPUT-vN identity. Assign and preserve this job’s unique JOB_ID before downstream artifacts. Do not create, prescribe, or instruct reuse of a master prompt, master job, reusable job definition, reusable target specification, or template for other jobs. Do not infer requirements for unrelated jobs from this job. Do not begin substantive external-source research or downstream production work.'",
    "1:'Initialize only this current job from this current job’s exact user input. Preserve the verbatim objective, requested deliverable, supplied-material inventory and provenance, inspection state, format requirements, temporal and geographic scope, user-supplied authority, tools, prohibitions, explicit user requirements, assumptions, unresolved unknowns, and controlled INPUT-vN identity. Determine whether the requested deliverable can actually be produced in the available execution environment. When direct implementation is unavailable or materially too large but a complete implementation-ready specification is feasible, set EXACT_DELIVERABLE_REQUESTED to that specification and state the environment limitation explicitly; this is a valid proposed deliverable for human intent confirmation, not a claim that implementation occurred. Use HUMAN_INPUT_REQUIRED only when a genuine human choice is still needed. Assign and preserve this job’s unique JOB_ID before downstream artifacts. Do not create, prescribe, or instruct reuse of a master prompt, master job, reusable job definition, reusable target specification, or template for other jobs. Do not infer requirements for unrelated jobs from this job. Do not begin substantive external-source research or downstream production work.'",
)
must_replace(
    'prompt-engine.js',
    "Create SOURCE-SET-vN only from legitimate external governing sources actually established in this stage; if none are yet established, leave the source set uncreated and record UNKNOWN/BLOCKED as applicable.",
    "Create SOURCE-SET-vN only from legitimate independent external sources actually established in this stage, preserving whether each source is controlling authority, primary evidence, official documentation/data, recognized standard, research, guidance, or another justified evidentiary role. If none are applicable, use the evidence-supported no-applicable-source determination rather than inventing a source.",
)
must_replace(
    'prompt-engine.js',
    "record type, mandatory/optional status, governing source or user-input relationship, exact source location when applicable, authority, applicability, dependencies",
    "record type, mandatory/optional status, external-source or user-input provenance, exact source location when applicable, authority or evidentiary role, applicability, dependencies",
)
must_replace(
    'prompt-engine.js',
    'Preserve the defect, governing evidence, resolution or unresolved state',
    'Preserve the defect, controlling or evidentiary basis, resolution or unresolved state',
)
must_replace(
    'prompt-engine.js',
    "21:'Generate this job’s finished target product here, in a fresh production context, using only the approved baseline materials. Before this stage the finished target product is not treated as existing. Assign PRODUCT_ID, PRODUCT_VERSION, BASELINE_ID, EXECUTION_ID, context, timestamps, instruction version, tool configuration, deviations, failures, and generated artifact inventory including filename, type, size, hash, and storage reference. No uncontrolled post-generation editing is permitted.'",
    "21:'Produce this job’s approved Stage 01 deliverable in a fresh production context using only the approved baseline materials. If Stage 01 established a self-contained artifact, generate that artifact. If direct external-repository implementation was unavailable or too large and the human confirmed an implementation-ready specification as the deliverable, produce that specification as the finished product and do not claim repository implementation occurred. Before this stage the finished deliverable is not treated as existing. Assign PRODUCT_ID, PRODUCT_VERSION, BASELINE_ID, EXECUTION_ID, context, timestamps, instruction version, tool configuration, deviations, failures, and generated artifact inventory including filename, type, size, hash, and storage reference. No uncontrolled post-generation editing is permitted.'",
)
must_replace(
    'prompt-engine.js',
    "- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, or incomplete canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. An unavailable external capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed. Work too large for the available environment requires BLOCKED with WORK_TOO_LARGE_FOR_ENVIRONMENT plus a complete implementation-ready specification; do not claim execution occurred. Self-contained deliverables that can actually be produced in the available environment should still be produced.",
    "- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, or incomplete canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. An unavailable external capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed. At Stage 01, when direct implementation is unavailable or materially too large but a complete implementation-ready specification is feasible, propose that specification as EXACT_DELIVERABLE_REQUESTED for human confirmation rather than blocking the entire job. At later stages, WORK_TOO_LARGE_FOR_ENVIRONMENT is blocking only when the currently approved deliverable itself cannot be completed reliably. Never claim unperformed implementation. Self-contained deliverables that can actually be produced in the available environment should still be produced.",
)

# accepted-result refinement reason becomes scoped prompt context.
must_replace(
    'workflow-engine.js',
    "const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;",
    "const proposal=safe(project.projectData.responseProposals).find(item=>item.proposalId===change.proposalId),operation=proposal?.envelope?.operation||'COMPLETE',scope=clone(proposal?.scope||proposal?.envelope?.scope||{});const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,promptId:change.promptId||proposal?.promptId||null,operation,scope,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;",
)
must_replace(
    'prompt-engine.js',
    "const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));if(corrections.length)parts.push(`OPERATOR REQUESTED CORRECTIONS / REFINEMENTS\\n${show(corrections)}`);",
    "const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));if(corrections.length)parts.push(`OPERATOR REQUESTED CORRECTIONS / REFINEMENTS\\n${show(corrections)}`);const acceptedRefinements=(state?.projectData?.history||[]).filter(x=>x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId}));if(acceptedRefinements.length)parts.push(`ACCEPTED RESULT REFINEMENT REQUESTS\\n${show(acceptedRefinements)}`);",
)
must_replace(
    'prompt-engine.js',
    "operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId})),latestValidationFailure:",
    "operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId})),acceptedResultRefinements:(state?.projectData?.history||[]).filter(x=>x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId})),latestValidationFailure:",
)

# raw/receipt identity comes from exact controlling prompt run/context scope.
must_replace(
    'response-ingestion.js',
    "contextId:'UNKNOWN',iteration:project.job.CURRENT_ITERATION||'NOT APPLICABLE',runId:'NOT APPLICABLE',requestDateTime:",
    "contextId:promptRecord.scope?.contextId||rawRecord.contextId||'NOT APPLICABLE',iteration:promptRecord.scope?.iterationId||rawRecord.iteration||project.job.CURRENT_ITERATION||'NOT APPLICABLE',runId:promptRecord.scope?.runId||rawRecord.runId||'NOT APPLICABLE',requestDateTime:",
)
must_replace(
    'response-ingestion.js',
    "const rawRecord={rawResponseId,outputId,jobId:next.job.JOB_ID,stage:stageNumber,role:globalThis.closedLoopCore?.STAGES?.[stageNumber-1]?.role||'UNKNOWN',contextId,iteration:next.job.CURRENT_ITERATION||'NOT APPLICABLE',promptInstructionId:",
    "const rawRecord={rawResponseId,outputId,jobId:next.job.JOB_ID,stage:stageNumber,role:globalThis.closedLoopCore?.STAGES?.[stageNumber-1]?.role||'UNKNOWN',contextId:prompt.scope?.contextId||contextId||'NOT APPLICABLE',runId:prompt.scope?.runId||'NOT APPLICABLE',iteration:prompt.scope?.iterationId||next.job.CURRENT_ITERATION||'NOT APPLICABLE',promptInstructionId:",
)

# ten-run proof must cover each RUN_ID, not merely ten stage-level records.
p = Path('workflow-engine.js')
s = p.read_text()
old = "const stage=Number(runs[0]?.stage||0);const rawCount=safe(project.projectData.rawResponses).filter(x=>Number(x.stage)===stage&&!x.invalidatedBy).length;const receiptCount=safe(project.projectData.outputReceipts).filter(x=>Number(x.stage)===stage&&!x.invalidatedBy).length;"
if old not in s:
    raise SystemExit('workflow-engine.js: old stage-level response counting block not found')
new = "const stage=Number(runs[0]?.stage||0),runIds=new Set(runs.map(r=>recordId(r,'runs'))),currentAcceptedRawIds=new Set(acceptedChanges(project,stage).map(c=>c.rawResponseId));const acceptedRaw=safe(project.projectData.rawResponses).filter(x=>Number(x.stage)===stage&&!x.invalidatedBy&&currentAcceptedRawIds.has(x.rawResponseId)&&String(x.promptScope?.iterationId||x.iteration||'')===String(iterationId||'')&&runIds.has(String(x.promptScope?.runId||x.runId||''))),rawRunIds=new Set(acceptedRaw.map(x=>String(x.promptScope?.runId||x.runId||'')));const acceptedReceipts=safe(project.projectData.outputReceipts).filter(x=>Number(x.stage)===stage&&!x.invalidatedBy&&x.acceptedCanonicalChangeId&&x.acceptedCanonicalChangeId!=='NONE'&&String(x.iteration||'')===String(iterationId||'')&&runIds.has(String(x.runId||''))),receiptRunIds=new Set(acceptedReceipts.map(x=>String(x.runId||'')));"
s = s.replace(old, new, 1)
old2 = "if(rawCount<10)reasons.push('Complete raw outputs are not preserved for all ten runs.');if(receiptCount<10)reasons.push('Complete receipts are not preserved for all ten runs.');"
if old2 not in s:
    raise SystemExit('workflow-engine.js: old raw/receipt gate text not found')
s = s.replace(old2, "if(rawRunIds.size!==10||[...runIds].some(id=>!rawRunIds.has(id)))reasons.push('A current accepted raw output is not preserved for every RUN_ID.');if(receiptRunIds.size!==10||[...runIds].some(id=>!receiptRunIds.has(id)))reasons.push('A current accepted receipt is not preserved for every RUN_ID.');", 1)
s = s.replace("candidateIds:[...candidates],matrix,comparisonCount:", "candidateIds:[...candidates],acceptedRawRunCount:rawRunIds.size,acceptedReceiptRunCount:receiptRunIds.size,matrix,comparisonCount:", 1)
p.write_text(s)

# Human-facing explanation matches actual fallback semantics.
must_replace(
    'app-core.js',
    "If requested implementation is too large or unavailable in that environment, the workflow must fail closed and return a complete implementation-ready specification rather than claim work was performed.",
    "If direct implementation is too large or unavailable in that environment, Stage 01 should establish a complete implementation-ready specification as the deliverable for human confirmation when that specification can be completed reliably; the workflow blocks only when the approved deliverable itself cannot be completed or a genuine human decision is still required. The application never claims unavailable implementation was performed.",
)

# Existing Stage 11 synthetic fixture now models ten accepted run-scoped responses/receipts.
p = Path('verify-complete.mjs')
s = p.read_text()
old = "p.projectData.rawResponses.push({rawResponseId:`RAW-STAGE11-${i}`,stage:11});p.projectData.outputReceipts.push({receiptId:`RECEIPT-STAGE11-${i}`,stage:11});"
if old not in s:
    raise SystemExit('verify-complete.mjs: Stage11 raw/receipt fixture not found')
new = "const rawId=`RAW-STAGE11-${i}`,changeId=`CHANGE-STAGE11-${i}`;p.projectData.rawResponses.push({rawResponseId:rawId,stage:11,promptScope:{iterationId:'ITERATION-STAGE11',candidateId:'CANDIDATE-STAGE11',runId:`RUN-STAGE11-${i}`,contextId:`CONTEXT-STAGE11-${i}`}});p.projectData.acceptedChanges.push({changeId,stage:11,status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:rawId});p.projectData.outputReceipts.push({receiptId:`RECEIPT-STAGE11-${i}`,stage:11,iteration:'ITERATION-STAGE11',runId:`RUN-STAGE11-${i}`,acceptedCanonicalChangeId:changeId});"
s = s.replace(old, new, 1)
p.write_text(s)

# Semantic regression tests.
p = Path('verify-prompt-semantics.mjs')
s = p.read_text()
s += r'''

// Feasible specification fallback and Stage 15 temporal scope are explicit.
{
  const p=baseProject();p.job.EXACT_USER_OBJECTIVE_VERBATIM='Implement a repository-scale system that is not directly writable from the current agent environment.';
  const s1=prompts.buildPromptRecord(1,p).prompt,s21=prompts.buildPromptRecord(21,p).prompt;
  if(!/implementation-ready specification/i.test(s1)||!/human intent confirmation/i.test(s1))throw new Error('Stage 01 does not establish a feasible specification fallback for human confirmation.');
  if(!/approved Stage 01 deliverable/i.test(s21)||!/do not claim repository implementation occurred/i.test(s21))throw new Error('Stage 21 does not honor the approved specification deliverable boundary.');
  if(core.STAGES[14].fields.includes('POST_CORRECTION_SUCCESSES_PROVEN'))throw new Error('Stage 15 still exposes future post-correction success as current-stage state.');
  if(typeof core.buildStagePrompt==='function')throw new Error('workbook.js still exposes a competing legacy prompt generator.');
}

// Refining an accepted response must carry the exact operator reason into the next controlling prompt and identity.
{
  const p=baseProject(),first=prompts.buildPromptRecord(2,p);p.projectData.generatedPrompts.push({...first,generatedAt:new Date().toISOString()});
  p.projectData.acceptedChanges.push({changeId:'CHANGE-REFINE',stage:2,status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-REFINE',proposalId:'PROPOSAL-REFINE',promptId:first.instructionId});
  p.projectData.responseProposals.push({proposalId:'PROPOSAL-REFINE',promptId:first.instructionId,stage:2,scope:first.scope,envelope:{operation:first.operation,scope:first.scope}});
  engine.invalidateAcceptedResponse(p,{stage:2,rawResponseId:'RAW-REFINE',reason:'Add the missing authoritative source and explain the source-role distinction.',operatorLabel:'VERIFY'});
  const preview=JSON.parse(JSON.stringify(p));preview.revision=Number(p.revision||0)+1;const next=prompts.buildPromptRecord(2,preview);
  if(!next.prompt.includes('Add the missing authoritative source and explain the source-role distinction.'))throw new Error('Accepted-result refinement reason is absent from the next prompt.');
  if(next.contextSignature===first.contextSignature)throw new Error('Accepted-result refinement did not change context identity.');
}
'''
p.write_text(s)

p = Path('verify-complete.mjs')
s = p.read_text()
s += r'''

// Ten responses for one RUN_ID must not satisfy ten-run evidence preservation.
{
  const p=project('JOB-RUN-EVIDENCE-COVERAGE');p.job.CURRENT_ITERATION='ITERATION-RUN-COVERAGE';
  const iteration=record('iterations',11,{CANDIDATE_ID:'CANDIDATE-RUN-COVERAGE',STATUS:'FROZEN'},'ITERATION-RUN-COVERAGE');iteration.scope={iterationId:'ITERATION-RUN-COVERAGE',candidateId:'CANDIDATE-RUN-COVERAGE'};p.projectData.iterations.push(iteration);
  for(let i=0;i<10;i++){const runId=`RUN-COVER-${i}`,ctxId=`CTX-COVER-${i}`,run=record('runs',11,{ITERATION_ID:'ITERATION-RUN-COVERAGE',CANDIDATE_ID:'CANDIDATE-RUN-COVERAGE',CONTEXT_ID:ctxId,CONTAMINATION_CHECK:'NONE',COMPLETE_OUTPUT:`out-${i}`},runId);run.scope={iterationId:'ITERATION-RUN-COVERAGE',candidateId:'CANDIDATE-RUN-COVERAGE',runId,contextId:ctxId};p.projectData.runs.push(run);const ctx=record('freshContexts',11,{EXTERNAL_CONTEXT_IDENTIFIER:`external-${i}`,ITERATION_ID:'ITERATION-RUN-COVERAGE',RUN_ID:runId},ctxId);ctx.scope={iterationId:'ITERATION-RUN-COVERAGE',candidateId:'CANDIDATE-RUN-COVERAGE',runId,contextId:ctxId};p.projectData.freshContexts.push(ctx);}
  for(let i=0;i<10;i++){const rawId=`RAW-DUP-${i}`,changeId=`CHANGE-DUP-${i}`;p.projectData.rawResponses.push({rawResponseId:rawId,stage:11,promptScope:{iterationId:'ITERATION-RUN-COVERAGE',candidateId:'CANDIDATE-RUN-COVERAGE',runId:'RUN-COVER-0',contextId:'CTX-COVER-0'}});p.projectData.acceptedChanges.push({changeId,stage:11,status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:rawId});p.projectData.outputReceipts.push({receiptId:`RECEIPT-DUP-${i}`,stage:11,iteration:'ITERATION-RUN-COVERAGE',runId:'RUN-COVER-0',acceptedCanonicalChangeId:changeId});}
  const ev=engine.evaluateIteration(p,'ITERATION-RUN-COVERAGE','INITIAL');if(ev.complete||!ev.reasons.some(r=>/every RUN_ID/.test(r)))throw new Error('Ten stage-level responses/receipts for one run falsely satisfied iteration evidence coverage.');
}
'''
p.write_text(s)
