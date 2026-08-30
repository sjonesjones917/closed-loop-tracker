from pathlib import Path

# 1) Locked future stages must never present an executable-looking controlling prompt.
p = Path('app-core.js')
s = p.read_text()
old = "function currentStagePrompt(n){const saved=currentPromptRecord(n);if(saved?.prompt)return saved.prompt;if([23,24].includes(Number(n))&&!currentReviewerContext(n))return 'CONTROLLING INSTRUCTION UNAVAILABLE\\n\\nThis stage requires a fresh independent reviewer context before its controlling prompt can be created. Complete the prerequisite stages first. When this stage becomes current, register the new external reviewer context using the reviewer-context control shown on this stage. The application will then bind that identity into the controlling prompt before it can be saved or copied.';"
new = "function currentStagePrompt(n){const lock=stageLocked(n);if(lock&&current.stages[n]?.status!=='COMPLETE')return `CONTROLLING INSTRUCTION UNAVAILABLE\\n\\n${lock}\\n\\nThis stage is inspectable only. Complete the prerequisite stages in order before generating, saving, copying, sending, or responding to a controlling instruction for this stage.`;const saved=currentPromptRecord(n);if(saved?.prompt)return saved.prompt;if([23,24].includes(Number(n))&&!currentReviewerContext(n))return 'CONTROLLING INSTRUCTION UNAVAILABLE\\n\\nThis stage requires a fresh independent reviewer context before its controlling prompt can be created. Complete the prerequisite stages first. When this stage becomes current, register the new external reviewer context using the reviewer-context control shown on this stage. The application will then bind that identity into the controlling prompt before it can be saved or copied.';"
assert old in s, 'currentStagePrompt target not found'
s = s.replace(old, new, 1)
old = "retryPreview=!savedPrompt&&latestValidation&&!latestValidation.valid,promptIntro=savedPrompt?'This exact saved instruction is the controlling request. Its identity and strict response contract are embedded below.':retryPreview?'Updated correction instruction preview. The latest validation failure is included automatically. Save or copy this updated instruction before sending it to the agent; only the committed instruction identity is controlling.':'This is an unsaved preview. Save or copy it before sending it to an agent; only the committed instruction identity is controlling.';"
new = "retryPreview=!savedPrompt&&latestValidation&&!latestValidation.valid,promptIntro=locked?'This future stage is inspectable, but no controlling instruction is available until every prerequisite stage is complete.':savedPrompt?'This exact saved instruction is the controlling request. Its identity and strict response contract are embedded below.':retryPreview?'Updated correction instruction preview. The latest validation failure is included automatically. Save or copy this updated instruction before sending it to the agent; only the committed instruction identity is controlling.':'This is an unsaved preview. Save or copy it before sending it to an agent; only the committed instruction identity is controlling.';"
assert old in s, 'promptIntro target not found'
s = s.replace(old, new, 1)
old = "<div class=\"panel\"><h2 class=\"section-title\">Returned agent response</h2><p class=\"section-intro\">Paste only the final strict JSON from ChatGPT after the conversation is complete. If ChatGPT is still asking you questions, answer them there instead of pasting that conversation here. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the final response declares returned files, attach only those exact returned files when this stage shows a returned-file control. Never reattach the original Stage 01 intent file; Stages 03 and 04 consume the canonical captured intent and upstream records embedded in their controlling prompts.</p>"
new = "<div class=\"panel\"><h2 class=\"section-title\">Returned agent response</h2><p class=\"section-intro\">${locked?'No response belongs to this stage yet. Complete every prerequisite stage first; do not send a prompt or paste JSON for this stage.':'Paste only the final strict JSON from ChatGPT after the conversation is complete. If ChatGPT is still asking you questions, answer them there instead of pasting that conversation here. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the final response declares returned files, attach only those exact returned files when this stage shows a returned-file control. Never reattach the original Stage 01 intent file; later stages consume the canonical captured project authority and upstream records embedded in their controlling prompts.'}</p>"
assert old in s, 'response intro target not found'
s = s.replace(old, new, 1)
p.write_text(s)

# 2) Every later stage receives the upstream evidence/records needed to do its whole stage job.
p = Path('workflow-schema.js')
s = p.read_text()
replacements = {
"12:['runs','requirements','tests','freshContexts']": "12:['runs','requirements','tests','freshContexts','sources','evidenceRecords']",
"14:['defects','comparisons','verification','requirements','tests','instructions','runs']": "14:['defects','comparisons','verification','requirements','tests','instructions','instructionTraces','runs','candidateFreezes','failureTests','requirementResolutions','candidateRequirements','research','sources','sourceConflicts','artifacts','evidenceRecords']",
"15:['defects','rootCauses','requirements','tests','artifacts','evidenceRecords']": "15:['defects','rootCauses','comparisons','verification','runs','requirements','tests','failureTests','instructions','candidateFreezes','artifacts','evidenceRecords']",
"16:['defects','rootCauses','regressions','regressionExecutions','requirements','requirementResolutions','instructions','tests','failureTests','artifacts','changes']": "16:['defects','rootCauses','regressions','regressionExecutions','comparisons','verification','runs','requirements','requirementResolutions','candidateRequirements','research','sources','instructions','instructionTraces','tests','failureTests','candidateFreezes','artifacts','evidenceRecords','changes']",
"24:['products','requirements','tests','regressions','regressionExecutions','evidenceRecords']": "24:['products','requirements','tests','failureTests','regressions','regressionExecutions','defects','sources','evidenceRecords']",
"25:['products','artifacts','requirements']": "25:['products','baselines','artifacts','requirements','tests','evidenceRecords']"
}
for old,new in replacements.items():
    assert old in s, f'READ_COLLECTIONS target missing: {old}'
    s=s.replace(old,new,1)
# Stage 17 operation contexts must preserve the same information boundaries as the corresponding base stages.
ops = {
"VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts']": "VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts','sources','evidenceRecords']",
"COMPARE:Object.freeze({readCollections:['verification','runs','requirements']": "COMPARE:Object.freeze({readCollections:['verification','runs','requirements','tests']",
"ROOT_CAUSE:Object.freeze({readCollections:['defects','comparisons','verification']": "ROOT_CAUSE:Object.freeze({readCollections:['defects','comparisons','verification','requirements','tests','instructions','instructionTraces','runs','candidateFreezes','failureTests','requirementResolutions','candidateRequirements','research','sources','sourceConflicts','artifacts','evidenceRecords']",
"REGRESSION:Object.freeze({readCollections:['defects','rootCauses','regressions','regressionExecutions']": "REGRESSION:Object.freeze({readCollections:['defects','rootCauses','comparisons','verification','runs','requirements','tests','failureTests','instructions','candidateFreezes','artifacts','evidenceRecords','regressions','regressionExecutions']",
"CORRECT:Object.freeze({readCollections:['defects','rootCauses','regressions','regressionExecutions','changes']": "CORRECT:Object.freeze({readCollections:['defects','rootCauses','regressions','regressionExecutions','comparisons','verification','runs','requirements','requirementResolutions','candidateRequirements','research','sources','instructions','instructionTraces','tests','failureTests','candidateFreezes','artifacts','evidenceRecords','changes']"
}
for old,new in ops.items():
    assert old in s, f'operation target missing: {old}'
    s=s.replace(old,new,1)
# Stage 19 VERIFY has the same substring a second time after Stage 17 was replaced; replace the remaining base form.
old="VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts']"
new="VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts','sources','evidenceRecords']"
assert old in s, 'Stage 19 VERIFY target missing'
s=s.replace(old,new,1)
old="COMPARE:Object.freeze({readCollections:['verification','runs','requirements']"
new="COMPARE:Object.freeze({readCollections:['verification','runs','requirements','tests']"
assert old in s, 'Stage 19 COMPARE target missing'
s=s.replace(old,new,1)
old="CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','regressionExecutions','candidateFreezes']"
new="CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','tests','regressions','regressionExecutions','candidateFreezes','defects','blockers','evidenceRecords']"
assert old in s, 'Stage 19 CONFIRM target missing'
s=s.replace(old,new,1)
p.write_text(s)

# 3) Invalidate every pre-repair saved prompt so the application cannot reuse a prompt built from the old context contract.
p=Path('prompt-engine.js')
s=p.read_text()
old="const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/35';"
new="const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/36';"
assert old in s, 'prompt engine version target not found'
s=s.replace(old,new,1)
p.write_text(s)
