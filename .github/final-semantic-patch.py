from pathlib import Path

p = Path("prompt-engine.js")
text = p.read_text()
anchor = "const samePromptScope=(a,b={})=>['iterationId','candidateId','runId','contextId','baselineId','productId'].every(key=>String(a?.[key]??'')===String(b?.[key]??''));\n"
helper = """const samePromptScope=(a,b={})=>['iterationId','candidateId','runId','contextId','baselineId','productId'].every(key=>String(a?.[key]??'')===String(b?.[key]??''));
function recoveryFeedback(state,stage,operation,scope={}){
 const lane=x=>Number(x?.stage)===stage&&(!x?.operation||x.operation===operation)&&(!x?.scope||samePromptScope(x.scope,scope));
 const history=state?.projectData?.history||[];
 const accepted=(state?.projectData?.acceptedChanges||[]).filter(x=>lane(x)&&x.status==='COMMITTED'&&x.responseType==='DATA_PROPOSAL').at(-1);
 const cutoff=Number(accepted?.eventSequence||0);
 const eventAfter=(field,id)=>!cutoff||history.some(event=>String(event?.[field]||'')===String(id||'')&&Number(event?.eventSequence||0)>cutoff);
 const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>lane(x)&&x.requestCorrection&&!x.invalidatedBy&&eventAfter('rejectedResponseId',x.rejectedResponseId)).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));
 const acceptedRefinements=history.filter(x=>lane(x)&&x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&(!cutoff||Number(x.eventSequence||0)>cutoff)).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId}));
 const validationFailures=(state?.projectData?.responseValidations||[]).filter(x=>Number(x.stage)===stage&&!x.valid&&eventAfter('validationId',x.validationId)).filter(x=>{const generated=(state?.projectData?.generatedPrompts||[]).find(g=>(g.instructionId||g.promptId)===x.promptId);return generated&&generated.operation===operation&&samePromptScope(generated.scope||{},scope);}).slice(-1).map(x=>({validationId:x.validationId,issues:(x.issues||[]).map(i=>({code:i.code,path:i.path,message:i.message}))}));
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

replacements = {
"operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}))": "operatorCorrectionRequests:feedback.corrections",
"acceptedResultRefinements:(state?.projectData?.history||[]).filter(x=>x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId}))": "acceptedResultRefinements:feedback.acceptedRefinements",
"latestValidationFailure:(state?.projectData?.responseValidations||[]).filter(x=>Number(x.stage)===stage&&!x.valid).filter(x=>{const p=(state?.projectData?.generatedPrompts||[]).find(g=>(g.instructionId||g.promptId)===x.promptId);return p&&p.operation===operation&&samePromptScope(p.scope||{},scope);}).slice(-1).map(x=>({validationId:x.validationId,issues:(x.issues||[]).map(i=>({code:i.code,path:i.path,message:i.message}))}))": "latestValidationFailure:feedback.validationFailures",
}
for old, new in replacements.items():
    if text.count(old) != 1:
        raise SystemExit(f"prompt-engine.js: manifest expression mismatch: {old[:80]}")
    text = text.replace(old, new, 1)
p.write_text(text)

p = Path("verify-prompt-semantics.mjs")
text = p.read_text()
text += """

// Recovery feedback is current-cycle context, ordered by monotonic eventSequence rather than browser clock time.
{
 const p=baseProject(), first=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});p.projectData.generatedPrompts.push({...first,generatedAt:'2026-08-26T01:00:00.000Z'});
 const lane={stage:2,operation:'COMPLETE',scope:{...first.scope}};
 p.projectData.acceptedChanges.push({changeId:'CHANGE-OLD',status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-OLD',promptId:first.instructionId,eventSequence:10,...lane});
 p.projectData.rejectedResponses.push({rejectedResponseId:'REJECT-OLD',requestCorrection:true,reason:'OLD CORRECTION MUST EXPIRE',rawResponseId:'RAW-BAD',...lane});
 p.projectData.responseValidations.push({validationId:'VALIDATION-OLD',stage:2,promptId:first.instructionId,rawResponseId:'RAW-BAD',valid:false,issues:[{code:'OLD_VALIDATION_MUST_EXPIRE',path:'/',message:'old'}]});
 p.projectData.history.push({eventId:'EVENT-REJECT',eventSequence:11,type:'CORRECTION_REQUESTED',rejectedResponseId:'REJECT-OLD',stage:2});
 p.projectData.history.push({eventId:'EVENT-REFINE',eventSequence:12,type:'ACCEPTED_RESPONSE_INVALIDATED',reason:'OLD REFINEMENT MUST EXPIRE',rawResponseId:'RAW-OLD',promptId:first.instructionId,...lane});
 p.projectData.history.push({eventId:'EVENT-VALIDATION',eventSequence:13,type:'RESPONSE_VALIDATION_FAILED',validationId:'VALIDATION-OLD',stage:2});
 const duringRecovery=prompts.buildPromptRecord(2,p,{operation:'COMPLETE',scope:{...first.scope}});
 for(const expected of ['OLD CORRECTION MUST EXPIRE','OLD REFINEMENT MUST EXPIRE','OLD_VALIDATION_MUST_EXPIRE'])if(!duringRecovery.prompt.includes(expected))throw new Error(`Current recovery feedback missing before replacement acceptance: ${expected}`);
 p.projectData.acceptedChanges.push({changeId:'CHANGE-REPLACEMENT',status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-REPLACEMENT',promptId:first.instructionId,eventSequence:20,...lane});
 const afterRecovery=prompts.buildPromptRecord(2,p,{operation:'COMPLETE',scope:{...first.scope}});
 for(const stale of ['OLD CORRECTION MUST EXPIRE','OLD REFINEMENT MUST EXPIRE','OLD_VALIDATION_MUST_EXPIRE'])if(afterRecovery.prompt.includes(stale))throw new Error(`Resolved recovery feedback leaked into a later prompt: ${stale}`);
 if(afterRecovery.contextManifest.operatorCorrectionRequests.length||afterRecovery.contextManifest.acceptedResultRefinements.length||afterRecovery.contextManifest.latestValidationFailure.length)throw new Error('Resolved recovery feedback remains bound into the prompt context signature.');
}
"""
p.write_text(text)
