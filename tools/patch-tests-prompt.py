from pathlib import Path
P=Path('verify-prompt-semantics.mjs'); s=P.read_text()
if 'stage23PriorConclusionIsolation:true' not in s:
 s+=r'''

// reliability-hardening-final: generic prior-stage summaries may not bypass independent-review context projections.
{
 const p=baseProject();p.stages[22].agentData={DETERMINISTIC_TEST_RESULTS:'PRODUCT-GENERATOR-CLAIMS-PERFECT'};p.stages[22].derivedData={SATISFIED:999};const stage23=prompts.buildPromptRecord(23,p,{operation:'COMPLETE'}).prompt;if(stage23.includes('PRODUCT-GENERATOR-CLAIMS-PERFECT'))throw new Error('Stage 23 prompt leaked Stage 22 prior-stage conclusions through generic context.');
 p.stages[23].agentData={UNSUPPORTED_BARE_CONCLUSIONS:'MEANING-REVIEWER-SAYS-PERFECT'};p.stages[23].derivedData={SATISFIED:999};const stage24=prompts.buildPromptRecord(24,p,{operation:'COMPLETE'}).prompt;if(stage24.includes('MEANING-REVIEWER-SAYS-PERFECT'))throw new Error('Stage 24 prompt leaked Stage 23 prior-review conclusions through generic context.');
}
{
 const p=baseProject();p.stages[11].agentData={FROZEN_EXECUTION_PACKAGE:'PRIOR-STAGE-RUN-SUMMARY-SECRET'};const iterationId='ITERATION-000001',candidateId='CANDIDATE-000001';p.projectData.runs.push({id:'RUN-VERIFY-TARGET',stage:11,active:true,scope:{...engine.currentScope(p),iterationId,candidateId,runId:'RUN-VERIFY-TARGET',contextId:'CTX-GENERATOR'},fields:{RUN_ID:'RUN-VERIFY-TARGET',ITERATION_ID:iterationId,CANDIDATE_ID:candidateId,CONTEXT_ID:'CTX-GENERATOR',COMPLETE_OUTPUT:'target output'}});p.projectData.freshContexts.push({id:'CTX-GENERATOR',stage:11,active:true,scope:{...engine.currentScope(p),iterationId,candidateId,runId:'RUN-VERIFY-TARGET',contextId:'CTX-GENERATOR'},fields:{CONTEXT_ID:'CTX-GENERATOR'}});const r=prompts.buildPromptRecord(12,p,{operation:'COMPLETE',scope:{iterationId,candidateId,runId:'RUN-VERIFY-TARGET',contextId:'CTX-VERIFIER'}});if(r.prompt.includes('PRIOR-STAGE-RUN-SUMMARY-SECRET'))throw new Error('Stage 12 prompt leaked generic Stage 11 conclusions.');
}
console.log(JSON.stringify({stage23PriorConclusionIsolation:true,stage24PriorConclusionIsolation:true,stage12PriorSummaryIsolation:true},null,2));
'''
P.write_text(s)
print('prompt regressions staged')
