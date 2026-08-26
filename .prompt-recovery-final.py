from pathlib import Path


def replace(path, old, new, count=1):
    p=Path(path); s=p.read_text(); actual=s.count(old)
    if actual < count:
        raise SystemExit(f'{path}: expected at least {count}, found {actual}: {old[:140]!r}')
    p.write_text(s.replace(old,new,count))

p=Path('workbook.js'); s=p.read_text()
s=s.replace("'POST_CORRECTION_SUCCESSES_PROVEN',",'',1)
s=s.replace('      "POST_CORRECTION_SUCCESSES_PROVEN",\n','',1)
start=s.find('function buildStagePrompt(stage,state){'); end=s.find('const n=v=>',start)
if start < 0 or end < 0: raise SystemExit('legacy workbook buildStagePrompt implementation not found')
s=s[:start]+s[end:]
if ',buildStagePrompt,validateStageDraft' not in s: raise SystemExit('legacy workbook buildStagePrompt export not found')
s=s.replace(',buildStagePrompt,validateStageDraft',',validateStageDraft',1)
p.write_text(s)

replace('prompt-engine.js',
"If required repository, runtime, account, network, deployment, or tool access is absent, do not pretend implementation occurred; define the most complete reliable implementation-ready specification, architecture, patch plan, acceptance criteria, or other feasible deliverable.",
"If required repository, runtime, account, network, deployment, or tool access is absent, do not pretend implementation occurred; when a complete reliable implementation-ready specification, architecture, patch plan, acceptance package, or other self-contained substitute can satisfy the underlying user objective, propose that feasible substitute as EXACT_DELIVERABLE_REQUESTED for human intent confirmation and state the execution limitation explicitly.")
replace('prompt-engine.js',
"- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, or incomplete canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. An unavailable external capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed. Work too large for the available environment requires BLOCKED with WORK_TOO_LARGE_FOR_ENVIRONMENT plus a complete implementation-ready specification; do not claim execution occurred. Self-contained deliverables that can actually be produced in the available environment should still be produced.",
"- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, or incomplete canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. An unavailable external capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed. At Stage 01, when direct implementation is unavailable or materially too large but a complete reliable self-contained substitute such as an implementation-ready specification is feasible, propose that substitute as EXACT_DELIVERABLE_REQUESTED for human confirmation instead of blocking the entire job. After Stage 01, WORK_TOO_LARGE_FOR_ENVIRONMENT is blocking only when the currently approved deliverable itself cannot be completed reliably in the authorized environment. Never claim unperformed implementation. Self-contained deliverables that can actually be produced in the available environment should still be produced.")
replace('workflow-engine.js',
"const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;",
"const proposal=safe(project.projectData.responseProposals).find(item=>item.proposalId===change.proposalId),operation=change.operation||proposal?.envelope?.operation||'COMPLETE',scope=clone(change.scope||proposal?.scope||proposal?.envelope?.scope||{});const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,promptId:change.promptId||proposal?.promptId||null,operation,scope,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;")
replace('prompt-engine.js',
"const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));if(corrections.length)parts.push(`OPERATOR REQUESTED CORRECTIONS / REFINEMENTS\\n${show(corrections)}`);",
"const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));if(corrections.length)parts.push(`OPERATOR REQUESTED CORRECTIONS / REFINEMENTS\\n${show(corrections)}`);const acceptedRefinements=(state?.projectData?.history||[]).filter(x=>x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId}));if(acceptedRefinements.length)parts.push(`ACCEPTED RESULT REFINEMENT REQUESTS\\n${show(acceptedRefinements)}`);")
replace('prompt-engine.js',
"operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId})),latestValidationFailure:",
"operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId})),acceptedResultRefinements:(state?.projectData?.history||[]).filter(x=>x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId})),latestValidationFailure:")

p=Path('verify-prompt-semantics.mjs'); s=p.read_text(); marker='// Residual prompt recovery invariants.'
if marker not in s:
    s += r'''

// Residual prompt recovery invariants.
{
  const p=baseProject();
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='Implement a repository-scale application that cannot be directly modified from the authorized environment.';
  const s1=prompts.buildPromptRecord(1,p).prompt;
  if(!/EXACT_DELIVERABLE_REQUESTED/.test(s1)||!/human intent confirmation/i.test(s1)||!/implementation-ready specification/i.test(s1))throw new Error('Stage 01 does not convert infeasible implementation into a confirmable feasible deliverable.');
  if(/Work too large for the available environment requires BLOCKED/.test(s1))throw new Error('Global prompt rules still contradict Stage 01 feasible-deliverable recovery.');
  const workbookText=fs.readFileSync('workbook.js','utf8');
  if(/function\s+buildStagePrompt\s*\(/.test(workbookText))throw new Error('workbook.js still contains a competing legacy prompt implementation.');
  if(core.STAGES[14].fields.includes('POST_CORRECTION_SUCCESSES_PROVEN'))throw new Error('Stage 15 still exposes future post-correction success as current-stage state.');
}
{
  const p=baseProject(), first=prompts.buildPromptRecord(2,p);p.projectData.generatedPrompts.push({...first,generatedAt:new Date().toISOString()});
  p.projectData.acceptedChanges.push({changeId:'CHANGE-REFINE',stage:2,status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-REFINE',proposalId:'PROPOSAL-REFINE',promptId:first.instructionId,operation:'COMPLETE',scope:{...first.scope}});
  p.projectData.responseProposals.push({proposalId:'PROPOSAL-REFINE',promptId:first.instructionId,stage:2,envelope:{operation:'COMPLETE',scope:{...first.scope}},scope:{...first.scope}});
  engine.invalidateAcceptedResponse(p,{stage:2,rawResponseId:'RAW-REFINE',reason:'The accepted result omitted a material source and must be more complete.'});
  const second=prompts.buildPromptRecord(2,p,{operation:'COMPLETE',scope:{...first.scope}});
  if(!second.prompt.includes('The accepted result omitted a material source and must be more complete.'))throw new Error('Accepted-result refinement reason is absent from the next controlling prompt.');
  if(second.contextSignature===first.contextSignature)throw new Error('Accepted-result refinement did not change prompt context identity.');
}
'''
    p.write_text(s)
