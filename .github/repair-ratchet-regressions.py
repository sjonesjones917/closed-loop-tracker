from pathlib import Path


def replace_exact(path, old, new, expected=1):
    p=Path(path)
    text=p.read_text(encoding='utf-8')
    count=text.count(old)
    if count!=expected:
        raise SystemExit(f'{path}: expected {expected} occurrences, found {count}: {old[:120]!r}')
    p.write_text(text.replace(old,new),encoding='utf-8',newline='\n')

# Exact Stage 01 closed contract: do not case-normalize external values into validity.
replace_exact(
    'workflow-engine.js',
    "const disposition=String(unit?.disposition||'').trim().toUpperCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))",
    "const disposition=String(unit?.disposition||'').trim();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))"
)

# A locked future-stage action is still a structured operator action and must carry its compact checks.
replace_exact(
    'app-core.js',
    "function displayedStageAction(n){const stage=Number(n||canonicalCurrentStage()),lock=stageLocked(stage);if(stage!==canonicalCurrentStage()&&lock)return {actionType:'BLOCKED',heading:'This stage is not ready',explanation:`${lock} Complete the prerequisite stages in order. Do not send a prompt or select a response file for this stage yet.`,primaryButton:null,secondaryAction:null,filesToSend:[],filesToWithhold:[],expectedReturnFiles:[],blockingReason:lock,canonicalStateChanged:false,acceptedChange:null,downstreamInvalidated:[],newPromptRequired:false};return currentNextAction();}",
    "function displayedStageAction(n){const stage=Number(n||canonicalCurrentStage()),lock=stageLocked(stage);if(stage!==canonicalCurrentStage()&&lock)return {actionType:'BLOCKED',heading:'This stage is not ready',explanation:`${lock} Complete the prerequisite stages in order. Do not send a prompt or select a response file for this stage yet.`,primaryButton:null,secondaryAction:null,filesToSend:[],filesToWithhold:[],expectedReturnFiles:[],operatorChecks:[`Complete the prerequisite stages in order before acting on Stage ${String(stage).padStart(2,'0')}.`,'Do not send a prompt, package, or response for this locked stage.','Return to the current required stage and follow its structured next action.'],blockingReason:lock,canonicalStateChanged:false,acceptedChange:null,downstreamInvalidated:[],newPromptRequired:false};return currentNextAction();}"
)

# Restore the permanent terminal human-authority regression removed by the immediately prior change.
p=Path('verify-complete.mjs'); text=p.read_text(encoding='utf-8')
terminal="await import('./verify-terminal-human-authority.mjs');"
if terminal not in text:
    anchor="await import('./verify-operation-scope-classification.mjs');"
    if text.count(anchor)!=1: raise SystemExit('verify-complete terminal import anchor mismatch')
    text=text.replace(anchor,anchor+"\n\n"+terminal,1)
    p.write_text(text,encoding='utf-8',newline='\n')

# Strengthen the Stage 01 regression so normalization cannot silently reappear.
p=Path('verify-stage01-disposition-contract.mjs'); text=p.read_text(encoding='utf-8')
old="const legacy=structuredClone(base);legacy.units[0].disposition='retained as context';assert.equal(e.evaluateIntakeAccounting(x,{capture:JSON.stringify(legacy)}).complete,false);"
new="for(const legacyValue of ['retained as context','retained_as_context','extracted_relevant_information','Retained_As_Context']){const legacy=structuredClone(base);legacy.units[0].disposition=legacyValue;assert.equal(e.evaluateIntakeAccounting(x,{capture:JSON.stringify(legacy)}).complete,false,`noncanonical disposition was accepted: ${legacyValue}`);}"
if text.count(old)!=1: raise SystemExit('Stage 01 noncanonical-disposition regression anchor mismatch')
p.write_text(text.replace(old,new,1),encoding='utf-8',newline='\n')

# Restore the live DOM proof instead of accepting an engine-only substitute.
p=Path('verify-human-stage-walkthrough.mjs'); text=p.read_text(encoding='utf-8')
anchor="const picker=document.querySelector('#stage-picker');if(!picker)throw new Error('Stage picker is missing after opening Workflow.');"
dom="const operatorChecks=document.querySelector('#next-required-action .operator-checks');if(!operatorChecks)throw new Error('Current operator action does not expose the compact double-check guide.');\n    const checkSummary=operatorChecks.querySelector('summary');if(!checkSummary||!checkSummary.textContent.includes('Double-check before you continue'))throw new Error('Operator double-check guide is not clearly labeled.');\n    if(operatorChecks.open)throw new Error('Operator double-check guide must be collapsed by default to avoid visual overload.');"
if dom not in text:
    if text.count(anchor)!=1: raise SystemExit('browser DOM operator-check anchor mismatch')
    text=text.replace(anchor,anchor+'\n    '+dom,1)
p.write_text(text,encoding='utf-8',newline='\n')
