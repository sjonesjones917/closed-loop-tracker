from pathlib import Path

def rep(path, old, new, count=1):
    p=Path(path); s=p.read_text(); n=s.count(old)
    if n < count: raise SystemExit(f'{path}: expected {count}, found {n}: {old[:120]!r}')
    p.write_text(s.replace(old,new,count))

# One prompt authority only; Stage 15 cannot own evidence from a future corrected execution.
p=Path('workbook.js'); s=p.read_text()
if s.count("'POST_CORRECTION_SUCCESSES_PROVEN',")!=1 or s.count('      "POST_CORRECTION_SUCCESSES_PROVEN",\n')!=1:
    raise SystemExit('Stage 15 future-success field/ownership shape changed')
s=s.replace("'POST_CORRECTION_SUCCESSES_PROVEN',",'',1).replace('      "POST_CORRECTION_SUCCESSES_PROVEN",\n','',1)
a=s.find('function buildStagePrompt(stage,state){'); b=s.find('const n=v=>',a)
if a<0 or b<0 or ',buildStagePrompt,validateStageDraft' not in s: raise SystemExit('legacy workbook prompt block/export not found')
s=s[:a]+s[b:]; s=s.replace(',buildStagePrompt,validateStageDraft',',validateStageDraft',1); p.write_text(s)

# Stage 01 decides the feasible deliverable; later stages operate on that approved deliverable.
rep('prompt-engine.js',
"Determine whether the requested deliverable is feasible in the authorized execution environment and identify the smallest missing human-only information needed to proceed reliably.",
"Determine whether the requested deliverable is feasible in the authorized execution environment and identify the smallest missing human-only information needed to proceed reliably. If direct implementation or fabrication is unavailable or materially too large but a complete reliable self-contained substitute such as an implementation-ready, design-ready, manufacturing-ready, research, architecture, or other specification deliverable can satisfy the underlying objective, propose that feasible substitute as EXACT_DELIVERABLE_REQUESTED for human intent confirmation and state the execution limitation explicitly.")
rep('prompt-engine.js',
"- Work too large for the actually available environment, including large repositories or specialist CAD/CAM/simulation/manufacturing work without the required tool access, must not be represented as completed. Return BLOCKED with WORK_TOO_LARGE_FOR_ENVIRONMENT or MISSING_CAPABILITY as appropriate and provide the most complete implementation-ready, design-ready, manufacturing-ready, research, or specification deliverable that can be produced reliably within the approved scope.",
"- Work too large for the actually available environment, including large repositories or specialist CAD/CAM/simulation/manufacturing work without the required tool access, must not be represented as completed. At Stage 01, when a complete reliable implementation-ready, design-ready, manufacturing-ready, research, architecture, or other self-contained substitute deliverable can satisfy the underlying objective, propose that substitute as EXACT_DELIVERABLE_REQUESTED for human confirmation rather than blocking the whole job. After Stage 01, return WORK_TOO_LARGE_FOR_ENVIRONMENT or MISSING_CAPABILITY only when the currently approved deliverable itself cannot be completed reliably; otherwise complete the approved self-contained deliverable without claiming unavailable implementation or fabrication.")

# A human refinement of accepted data is controlling correction context, scoped to the same operation lane.
rep('workflow-engine.js',
"const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;",
"const proposal=safe(project.projectData.responseProposals).find(item=>item.proposalId===change.proposalId),operation=change.operation||proposal?.envelope?.operation||'COMPLETE',scope=clone(change.scope||proposal?.scope||proposal?.envelope?.scope||{});const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,promptId:change.promptId||proposal?.promptId||null,operation,scope,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;")
rep('prompt-engine.js',
"const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));if(corrections.length)parts.push(`OPERATOR REQUESTED CORRECTIONS / REFINEMENTS\\n${show(corrections)}`);",
"const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));if(corrections.length)parts.push(`OPERATOR REQUESTED CORRECTIONS / REFINEMENTS\\n${show(corrections)}`);const acceptedRefinements=(state?.projectData?.history||[]).filter(x=>x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId}));if(acceptedRefinements.length)parts.push(`ACCEPTED RESULT REFINEMENT REQUESTS\\n${show(acceptedRefinements)}`);")
rep('prompt-engine.js',
"operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId})),latestValidationFailure:",
"operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId})),acceptedResultRefinements:(state?.projectData?.history||[]).filter(x=>x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId})),latestValidationFailure:")

p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
if '// Residual recovery invariants after specialist-domain prompt hardening.' not in s:
    s += r'''

// Residual recovery invariants after specialist-domain prompt hardening.
{
 const p=baseProject();p.job.EXACT_USER_OBJECTIVE_VERBATIM='Implement a repository-scale application without repository write access.';
 const q=prompts.buildPromptRecord(1,p).prompt;
 if(!q.includes('EXACT_DELIVERABLE_REQUESTED')||!/human intent confirmation/i.test(q))throw new Error('Stage 01 does not establish a confirmable feasible substitute deliverable.');
 if(/Return BLOCKED with WORK_TOO_LARGE_FOR_ENVIRONMENT or MISSING_CAPABILITY as appropriate and provide/.test(q))throw new Error('Global too-large rule still contradicts Stage 01 feasible-deliverable recovery.');
 const wb=fs.readFileSync('workbook.js','utf8');if(/function\s+buildStagePrompt\s*\(/.test(wb))throw new Error('workbook.js still contains a competing prompt implementation.');
 if(core.STAGES[14].fields.includes('POST_CORRECTION_SUCCESSES_PROVEN'))throw new Error('Stage 15 still exposes future post-correction success.');
}
{
 const p=baseProject(),one=prompts.buildPromptRecord(2,p);p.projectData.generatedPrompts.push({...one,generatedAt:new Date().toISOString()});
 p.projectData.acceptedChanges.push({changeId:'CHANGE-R',stage:2,status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-R',proposalId:'PROP-R',promptId:one.instructionId,operation:'COMPLETE',scope:{...one.scope}});
 p.projectData.responseProposals.push({proposalId:'PROP-R',promptId:one.instructionId,stage:2,envelope:{operation:'COMPLETE',scope:{...one.scope}},scope:{...one.scope}});
 engine.invalidateAcceptedResponse(p,{stage:2,rawResponseId:'RAW-R',reason:'Add the omitted controlling source and return a complete replacement.'});
 const two=prompts.buildPromptRecord(2,p,{operation:'COMPLETE',scope:{...one.scope}});
 if(!two.prompt.includes('Add the omitted controlling source and return a complete replacement.'))throw new Error('Accepted-result refinement feedback is missing from the regenerated prompt.');
 if(two.contextSignature===one.contextSignature)throw new Error('Accepted-result refinement feedback did not change context identity.');
}
'''; p.write_text(s)
