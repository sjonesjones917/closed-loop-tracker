from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


p = Path("prompt-engine.js")
text = p.read_text()
anchor = "const samePromptScope=(a,b={})=>['iterationId','candidateId','runId','contextId','baselineId','productId'].every(key=>String(a?.[key]??'')===String(b?.[key]??''));\n"
helper = """const samePromptScope=(a,b={})=>['iterationId','candidateId','runId','contextId','baselineId','productId'].every(key=>String(a?.[key]??'')===String(b?.[key]??''));
function recoveryFeedback(state,stage,operation,scope={}){
 const lane=x=>Number(x?.stage)===stage&&(!x?.operation||x.operation===operation)&&(!x?.scope||samePromptScope(x.scope,scope));
 const accepted=(state?.projectData?.acceptedChanges||[]).filter(x=>lane(x)&&x.status==='COMMITTED'&&x.responseType==='DATA_PROPOSAL').at(-1);
 const rawOrder=new Map((state?.projectData?.rawResponses||[]).map((x,i)=>[x.rawResponseId,i]));
 const acceptedRawOrder=accepted?.rawResponseId&&rawOrder.has(accepted.rawResponseId)?rawOrder.get(accepted.rawResponseId):-1;
 const currentRaw=x=>{const rawId=x?.rawResponseId;return !accepted||!rawId||!rawOrder.has(rawId)||rawOrder.get(rawId)>acceptedRawOrder;};
 const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>lane(x)&&x.requestCorrection&&!x.invalidatedBy&&currentRaw(x)).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));
 const acceptedRefinements=(state?.projectData?.history||[]).filter(x=>lane(x)&&x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&(!accepted?.eventSequence||Number(x.eventSequence||0)>Number(accepted.eventSequence||0))).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId}));
 const validationFailures=(state?.projectData?.responseValidations||[]).filter(x=>Number(x.stage)===stage&&!x.valid&&currentRaw(x)).filter(x=>{const generated=(state?.projectData?.generatedPrompts||[]).find(g=>(g.instructionId||g.promptId)===x.promptId);return generated&&generated.operation===operation&&samePromptScope(generated.scope||{},scope);}).slice(-1).map(x=>({validationId:x.validationId,issues:(x.issues||[]).map(i=>({code:i.code,path:i.path,message:i.message}))}));
 return {corrections,acceptedRefinements,validationFailures};
}
"""
if text.count(anchor) != 1:
    raise SystemExit("prompt-engine.js: samePromptScope anchor mismatch")
text = text.replace(anchor, helper, 1)

ctx = text.index("function contextFor(stage,state,operation,scope={}){")
start = " const corrections=(state?.projectData?.rejectedResponses||[])"
end = " const op=schema.operationContract(stage,operation||schema.STAGE_CONTRACTS[stage].operations[0]);"
i = text.index(start, ctx)
j = text.index(end, i)
replacement = """ const feedback=recoveryFeedback(state,stage,operation,scope);
 if(feedback.corrections.length)parts.push(`OPERATOR REQUESTED CORRECTIONS / REFINEMENTS\\n${show(feedback.corrections)}`);
 if(feedback.acceptedRefinements.length)parts.push(`ACCEPTED RESULT REFINEMENT REQUESTS\\n${show(feedback.acceptedRefinements)}`);
 if(feedback.validationFailures.length)parts.push(`LATEST APPLICATION VALIDATION FAILURE TO CORRECT\\n${show(feedback.validationFailures.at(-1))}`);
"""
text = text[:i] + replacement + text[j:]

manifest_prefix = " const opContract=schema.operationContract(stage,operation);const scope=scopeFor(stage,state,options.scope||{}),contextManifest="
if text.count(manifest_prefix) != 1:
    raise SystemExit("prompt-engine.js: context manifest prefix mismatch")
text = text.replace(manifest_prefix, " const opContract=schema.operationContract(stage,operation);const scope=scopeFor(stage,state,options.scope||{}),feedback=recoveryFeedback(state,stage,operation,scope),contextManifest=", 1)

old = "operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}))"
if text.count(old) != 1:
    raise SystemExit("prompt-engine.js: correction manifest expression mismatch")
text = text.replace(old, "operatorCorrectionRequests:feedback.corrections", 1)
old = "acceptedResultRefinements:(state?.projectData?.history||[]).filter(x=>x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId}))"
if text.count(old) != 1:
    raise SystemExit("prompt-engine.js: accepted refinement manifest expression mismatch")
text = text.replace(old, "acceptedResultRefinements:feedback.acceptedRefinements", 1)
old = "latestValidationFailure:(state?.projectData?.responseValidations||[]).filter(x=>Number(x.stage)===stage&&!x.valid).filter(x=>{const p=(state?.projectData?.generatedPrompts||[]).find(g=>(g.instructionId||g.promptId)===x.promptId);return p&&p.operation===operation&&samePromptScope(p.scope||{},scope);}).slice(-1).map(x=>({validationId:x.validationId,issues:(x.issues||[]).map(i=>({code:i.code,path:i.path,message:i.message}))}))"
if text.count(old) != 1:
    raise SystemExit("prompt-engine.js: validation manifest expression mismatch")
text = text.replace(old, "latestValidationFailure:feedback.validationFailures", 1)

rule = "- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, incomplete, or contradictory canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. Missing external authority or evidence requires BLOCKED with the appropriate unresolved kind. An unavailable required capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed."
if text.count(rule) != 1:
    raise SystemExit("prompt-engine.js: recovery rule mismatch")
text = text.replace(rule, rule + "\n- A materially inadequate accepted prior-stage agent result is distinct from missing application context. Return BLOCKED with INADEQUATE_PRIOR_OUTPUT, identify the earliest accepted stage/result that requires refinement, and state exactly what is missing, incorrect, or insufficient so that result can be corrected without restarting the project.", 1)

old_source = "If no legitimate external governing source applies, return SOURCE_APPLICABILITY_DETERMINATION = NO_APPLICABLE_EXTERNAL_SOURCE with evidence; never invent a source merely to satisfy a count."
if text.count(old_source) == 1:
    text = text.replace(old_source, "If no legitimate independent external source with a justified authority or evidentiary role applies, return SOURCE_APPLICABILITY_DETERMINATION = NO_APPLICABLE_EXTERNAL_SOURCE with evidence; never invent a source merely to satisfy a count.", 1)
elif "If no legitimate independent external source with a justified authority or evidentiary role applies" not in text:
    raise SystemExit("prompt-engine.js: Stage 2 no-source rule mismatch")
p.write_text(text)

replace_once(
    "response-ingestion.js",
    "'MISSING_HUMAN_INPUT','MISSING_APPLICATION_CONTEXT','MISSING_AUTHORITY'",
    "'MISSING_HUMAN_INPUT','MISSING_APPLICATION_CONTEXT','INADEQUATE_PRIOR_OUTPUT','MISSING_AUTHORITY'",
)

p = Path("verify-prompt-semantics.mjs")
text = p.read_text()
anchor = "  if(!record.prompt.includes('HUMAN_INPUT_REQUIRED')||!record.prompt.includes('EXECUTION_FAILED')||!record.prompt.includes('BLOCKED with MISSING_APPLICATION_CONTEXT')||!record.prompt.includes('BLOCKED with MISSING_CAPABILITY'))issues.push('INSUFFICIENCY_RECOVERY_MISSING');\n"
if text.count(anchor) != 1:
    raise SystemExit("verify-prompt-semantics.mjs: recovery assertion anchor mismatch")
text = text.replace(anchor, anchor + "  if(!record.prompt.includes('INADEQUATE_PRIOR_OUTPUT'))issues.push('INADEQUATE_PRIOR_OUTPUT_RECOVERY_MISSING');\n", 1)
text += """

// Recovery feedback is current-cycle context, not permanent prompt baggage.
{
 const p=baseProject(), first=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});p.projectData.generatedPrompts.push({...first,generatedAt:'2026-08-26T01:00:00.000Z'});
 const lane={stage:2,operation:'COMPLETE',scope:{...first.scope}};
 p.projectData.rawResponses.push({rawResponseId:'RAW-OLD',stage:2,promptInstructionId:first.instructionId},{rawResponseId:'RAW-BAD',stage:2,promptInstructionId:first.instructionId},{rawResponseId:'RAW-REPLACEMENT',stage:2,promptInstructionId:first.instructionId});
 p.projectData.acceptedChanges.push({changeId:'CHANGE-OLD',status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-OLD',promptId:first.instructionId,eventSequence:10,...lane});
 p.projectData.rejectedResponses.push({rejectedResponseId:'REJECT-OLD',requestCorrection:true,reason:'OLD CORRECTION MUST EXPIRE',rawResponseId:'RAW-BAD',...lane});
 p.projectData.history.push({eventId:'EVENT-OLD-REFINE',eventSequence:12,type:'ACCEPTED_RESPONSE_INVALIDATED',reason:'OLD REFINEMENT MUST EXPIRE',rawResponseId:'RAW-OLD',promptId:first.instructionId,...lane});
 p.projectData.responseValidations.push({validationId:'VALIDATION-OLD',stage:2,promptId:first.instructionId,rawResponseId:'RAW-BAD',valid:false,issues:[{code:'OLD_VALIDATION_MUST_EXPIRE',path:'/',message:'old'}]});
 p.projectData.acceptedChanges.push({changeId:'CHANGE-REPLACEMENT',status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-REPLACEMENT',promptId:first.instructionId,eventSequence:20,...lane});
 const current=prompts.buildPromptRecord(2,p,{operation:'COMPLETE',scope:{...first.scope}});
 for(const stale of ['OLD CORRECTION MUST EXPIRE','OLD REFINEMENT MUST EXPIRE','OLD_VALIDATION_MUST_EXPIRE'])if(current.prompt.includes(stale))throw new Error(`Resolved recovery feedback leaked into a later prompt: ${stale}`);
 if(current.contextManifest.operatorCorrectionRequests.length||current.contextManifest.acceptedResultRefinements.length||current.contextManifest.latestValidationFailure.length)throw new Error('Resolved recovery feedback remains bound into the prompt context signature.');
}
"""
p.write_text(text)

p = Path("verify-ingestion.mjs")
text = p.read_text()
text += """

// Materially inadequate prior agent output is distinct from missing application context and fails closed without a data mutation.
{
 let p=project('JOB-INADEQUATE-PRIOR-OUTPUT'),stage=1,pr=savePrompt(p,stage);
 const envelope={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'prior-output-1',kind:'INADEQUATE_PRIOR_OUTPUT',description:'The prior accepted agent result omitted required material.',whyBlocking:'The owning earlier result must be refined before this stage can proceed reliably.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};
 const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord:pr});if(!prepared.validation.valid)throw new Error('INADEQUATE_PRIOR_OUTPUT was rejected by the response contract: '+JSON.stringify(prepared.validation.issues));
 const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'});p=committed.project;
 if(p.projectData.acceptedChanges.length)throw new Error('INADEQUATE_PRIOR_OUTPUT incorrectly became an accepted canonical data change.');
 if(!engine.records(p,'blockers').some(b=>String(b.MISSING_ITEM_TYPE||b.fields?.MISSING_ITEM_TYPE)==='INADEQUATE_PRIOR_OUTPUT'))throw new Error('INADEQUATE_PRIOR_OUTPUT did not create a distinct fail-closed blocker.');
}
"""
p.write_text(text)
