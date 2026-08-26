from pathlib import Path


def replace(path, old, new, count=1):
    p=Path(path); s=p.read_text(); actual=s.count(old)
    if actual < count:
        raise SystemExit(f'{path}: expected {count} occurrence(s), found {actual}: {old[:120]!r}')
    p.write_text(s.replace(old,new,count))

# workbook.js remains stage-definition authority, never a second prompt engine.
replace('workbook.js',
"'Extract every material requirement, restriction, exception, condition, and dependency from the governing sources.'",
"'Extract every material fact, requirement, restriction, exception, condition, dependency, recommendation, and evidentiary constraint from the accepted external source set while preserving each source role.'")
replace('workbook.js',
"2:['Every governing source has a complete record','Every relied-upon supplied file was inspected','Authority hierarchy is recorded','Every controlling conflict is resolved or blocked'],3:['Every controlling source has a research record'",
"2:['Every accepted independent external source has a complete record','Every relied-upon supplied file was inspected','Authority and evidentiary roles are recorded','Every controlling conflict is resolved or blocked'],3:['Every current accepted Stage 02 source has a research record'")
replace('workbook.js',"'POST_CORRECTION_SUCCESSES_PROVEN',","")
p=Path('workbook.js'); s=p.read_text(); start=s.find('function buildStagePrompt(stage,state){'); end=s.find('const n=v=>',start)
if start < 0 or end < 0: raise SystemExit('workbook.js legacy buildStagePrompt block not found')
s=s[:start]+s[end:]
if ',buildStagePrompt,validateStageDraft' not in s: raise SystemExit('workbook.js legacy export not found')
s=s.replace(',buildStagePrompt,validateStageDraft',',validateStageDraft',1)
p.write_text(s)

# Stage-specific prompt semantics and recovery behavior.
replace('prompt-engine.js',
"1:'Initialize only this current job from this current job’s exact user input. Preserve the verbatim objective, exact deliverable, supplied-material inventory and provenance, inspection state, format requirements, temporal and geographic scope, user-supplied authority, tools, prohibitions, explicit user requirements, assumptions, unresolved unknowns, and controlled INPUT-vN identity. Assign and preserve this job’s unique JOB_ID before downstream artifacts. Do not create, prescribe, or instruct reuse of a master prompt, master job, reusable job definition, reusable target specification, or template for other jobs. Do not infer requirements for unrelated jobs from this job. Do not begin substantive external-source research or downstream production work.'",
"1:'Initialize only this current job from this current job’s exact user input. Preserve the verbatim objective, requested deliverable, supplied-material inventory and provenance, inspection state, format requirements, temporal and geographic scope, user-supplied authority, tools, prohibitions, explicit user requirements, assumptions, unresolved unknowns, and controlled INPUT-vN identity. Determine whether the requested deliverable can actually be produced reliably in the available execution environment. When direct implementation is unavailable or materially too large but a complete implementation-ready specification is feasible, propose that specification as EXACT_DELIVERABLE_REQUESTED and state the environment limitation explicitly; this is a valid proposed deliverable for human intent confirmation, not a claim that implementation occurred. Use HUMAN_INPUT_REQUIRED only when a genuine human choice is still needed. Assign and preserve this job’s unique JOB_ID before downstream artifacts. Do not create, prescribe, or instruct reuse of a master prompt, master job, reusable job definition, reusable target specification, or template for other jobs. Do not infer requirements for unrelated jobs from this job. Do not begin substantive external-source research or downstream production work.'")
replace('prompt-engine.js',
"Create SOURCE-SET-vN only from legitimate external governing sources actually established in this stage; if none are yet established, leave the source set uncreated and record UNKNOWN/BLOCKED as applicable.",
"Create SOURCE-SET-vN only from legitimate independent external sources actually established in this stage, preserving whether each source is controlling authority, primary evidence, official documentation/data, recognized standard, research, guidance, or another justified evidentiary role; if none are applicable, use the evidence-supported no-applicable-source determination rather than inventing a source.")
replace('prompt-engine.js',
"record type, mandatory/optional status, governing source or user-input relationship, exact source location when applicable, authority, applicability, dependencies",
"record type, mandatory/optional status, external-source or user-input provenance, exact source location when applicable, authority or evidentiary role, applicability, dependencies")
replace('prompt-engine.js',
"Preserve the defect, governing evidence, resolution or unresolved state",
"Preserve the defect, controlling or evidentiary basis, resolution or unresolved state")
replace('prompt-engine.js',
"21:'Generate this job’s finished target product here, in a fresh production context, using only the approved baseline materials. Before this stage the finished target product is not treated as existing. Assign PRODUCT_ID, PRODUCT_VERSION, BASELINE_ID, EXECUTION_ID, context, timestamps, instruction version, tool configuration, deviations, failures, and generated artifact inventory including filename, type, size, hash, and storage reference. No uncontrolled post-generation editing is permitted.'",
"21:'Produce this job’s approved Stage 01 deliverable in a fresh production context using only the approved baseline materials. If Stage 01 established a self-contained artifact, generate that artifact. If direct external-repository implementation was unavailable or too large and the human confirmed an implementation-ready specification as the deliverable, produce that specification as the finished product and do not claim repository implementation occurred. Before this stage the finished deliverable is not treated as existing. Assign PRODUCT_ID, PRODUCT_VERSION, BASELINE_ID, EXECUTION_ID, context, timestamps, instruction version, tool configuration, deviations, failures, and generated artifact inventory including filename, type, size, hash, and storage reference. No uncontrolled post-generation editing is permitted.'")
replace('prompt-engine.js',
"- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, or incomplete canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. An unavailable external capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed. Work too large for the available environment requires BLOCKED with WORK_TOO_LARGE_FOR_ENVIRONMENT plus a complete implementation-ready specification; do not claim execution occurred. Self-contained deliverables that can actually be produced in the available environment should still be produced.",
"- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, or incomplete canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. An unavailable external capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed. At Stage 01, when direct implementation is unavailable or materially too large but a complete implementation-ready specification is feasible, propose that specification as EXACT_DELIVERABLE_REQUESTED for human confirmation rather than blocking the entire job. At later stages, WORK_TOO_LARGE_FOR_ENVIRONMENT is blocking only when the currently approved deliverable itself cannot be completed reliably. Never claim unperformed implementation. Self-contained deliverables that can actually be produced in the available environment should still be produced.")

# Accepted-result refinements must become controlling prompt context, not disappear into history.
replace('workflow-engine.js',
"const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;",
"const proposal=safe(project.projectData.responseProposals).find(item=>item.proposalId===change.proposalId),operation=change.operation||proposal?.envelope?.operation||'COMPLETE',scope=clone(change.scope||proposal?.scope||proposal?.envelope?.scope||{});const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,promptId:change.promptId||proposal?.promptId||null,operation,scope,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;")
replace('prompt-engine.js',
"const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));if(corrections.length)parts.push(`OPERATOR REQUESTED CORRECTIONS / REFINEMENTS\\n${show(corrections)}`);",
"const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));if(corrections.length)parts.push(`OPERATOR REQUESTED CORRECTIONS / REFINEMENTS\\n${show(corrections)}`);const acceptedRefinements=(state?.projectData?.history||[]).filter(x=>x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId}));if(acceptedRefinements.length)parts.push(`ACCEPTED RESULT REFINEMENT REQUESTS\\n${show(acceptedRefinements)}`);")
replace('prompt-engine.js',
"operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId})),latestValidationFailure:",
"operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId})),acceptedResultRefinements:(state?.projectData?.history||[]).filter(x=>x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId})),latestValidationFailure:")

# Human-facing wording must match the prompt contract.
replace('app-core.js',
"If requested implementation is too large or unavailable in that environment, the workflow must fail closed and return a complete implementation-ready specification rather than claim work was performed.",
"If direct implementation is too large or unavailable in that environment, Stage 01 should establish a complete implementation-ready specification as the deliverable for human confirmation when that specification can be completed reliably; the workflow blocks only when the approved deliverable itself cannot be completed or a genuine human decision is still required. The application never claims unavailable implementation was performed.")

# First-class semantic contradiction tests.
p=Path('verify-prompt-semantics.mjs'); s=p.read_text(); marker='// Prompt closure: specification fallback and accepted-result refinement context.'
if marker not in s:
    s += r'''

// Prompt closure: specification fallback and accepted-result refinement context.
{
  const p=baseProject();
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='Implement a repository-scale application that is not directly writable from the available agent environment.';
  const s1=prompts.buildPromptRecord(1,p).prompt;
  if(!/implementation-ready specification/i.test(s1)||!/human intent confirmation/i.test(s1))throw new Error('Stage 01 does not establish a feasible specification fallback as a confirmable deliverable.');
  const s21=prompts.buildPromptRecord(21,p).prompt;
  if(!/approved Stage 01 deliverable/i.test(s21)||!/do not claim repository implementation occurred/i.test(s21))throw new Error('Stage 21 does not honor the approved specification deliverable boundary.');
  if(core.STAGES[14].fields.includes('POST_CORRECTION_SUCCESSES_PROVEN'))throw new Error('Stage 15 still exposes future post-correction success as a current-stage field.');
  const workbookText=fs.readFileSync('workbook.js','utf8');
  if(/function\s+buildStagePrompt\s*\(/.test(workbookText))throw new Error('workbook.js still contains a competing legacy prompt implementation.');
}
{
  const p=baseProject(),first=prompts.buildPromptRecord(2,p);p.projectData.generatedPrompts.push({...first,generatedAt:new Date().toISOString()});
  p.projectData.acceptedChanges.push({changeId:'CHANGE-REFINE',stage:2,status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-REFINE',proposalId:'PROPOSAL-REFINE',promptId:first.instructionId,operation:'COMPLETE',scope:{...first.scope}});
  p.projectData.responseProposals.push({proposalId:'PROPOSAL-REFINE',promptId:first.instructionId,stage:2,envelope:{operation:'COMPLETE',scope:{...first.scope}},scope:{...first.scope}});
  engine.invalidateAcceptedResponse(p,{stage:2,rawResponseId:'RAW-REFINE',reason:'The accepted source analysis omitted a material authority.'});
  const second=prompts.buildPromptRecord(2,p,{operation:'COMPLETE',scope:{...first.scope}});
  if(!second.prompt.includes('The accepted source analysis omitted a material authority.'))throw new Error('Accepted-result refinement reason is absent from regenerated prompt.');
  if(second.contextSignature===first.contextSignature)throw new Error('Accepted-result refinement did not change context identity.');
}
'''
    p.write_text(s)
