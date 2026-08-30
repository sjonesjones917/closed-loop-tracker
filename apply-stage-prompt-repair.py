from pathlib import Path
import re


def replace_once(path, old, new, label):
    p=Path(path)
    text=p.read_text()
    count=text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match in {path}, found {count}')
    p.write_text(text.replace(old,new,1))


def regex_once(path, pattern, replacement, label, flags=0):
    p=Path(path)
    text=p.read_text()
    updated,count=re.subn(pattern,replacement,text,count=1,flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one regex match in {path}, found {count}')
    p.write_text(updated)


read_collections="""const READ_COLLECTIONS=Object.freeze({
  1:[],
  2:['intentStatements'],
  3:['intentStatements','sources','sourceConflicts','evidenceRecords'],
  4:['intentStatements','research','candidateRequirements','sources','sourceConflicts','evidenceRecords'],
  5:['requirements','intentStatements','candidateRequirements','research','sources','sourceConflicts','evidenceRecords'],
  6:['requirements','requirementResolutions','intentStatements','sources','research','candidateRequirements','evidenceRecords'],
  7:['requirements','tests','failureTests','artifacts','evidenceRecords'],
  8:['requirements','tests','failureTests','requirementResolutions','intentStatements','sources','research','candidateRequirements','artifacts','evidenceRecords'],
  9:['instructions','instructionTraces','requirements','tests','failureTests','requirementResolutions','sources','research','artifacts'],
  10:['instructions','preflightRecords','requirements','tests','failureTests','artifacts'],
  11:['candidateFreezes','iterations','runs','freshContexts'],
  12:['runs','requirements','tests','freshContexts','artifacts'],
  13:['verification','runs','requirements','tests'],
  14:['defects','comparisons','verification','runs','requirements','tests','instructions','instructionTraces','requirementResolutions','preflightRecords','research','sources','candidateFreezes','artifacts','evidenceRecords'],
  15:['defects','rootCauses','requirements','tests','failureTests','regressions','regressionExecutions','artifacts','evidenceRecords'],
  16:['intentStatements','sources','sourceConflicts','research','candidateRequirements','requirements','requirementResolutions','tests','failureTests','instructions','instructionTraces','preflightRecords','candidateFreezes','defects','rootCauses','regressions','regressionExecutions','artifacts','evidenceRecords'],
  17:['changes','candidateFreezes','iterations','requirements','instructions','tests','failureTests','regressions','regressionExecutions','artifacts'],
  18:['iterations','candidateFreezes','runs','verification','comparisons','defects','rootCauses','regressions','regressionExecutions','changes','requirements','tests','blockers'],
  19:['convergenceRecords','candidateFreezes','iterations','runs','verification','comparisons','requirements','tests','regressions','regressionExecutions','defects','rootCauses','changes','artifacts'],
  20:['confirmationRecords','candidateFreezes','iterations','requirements','tests','instructions','artifacts'],
  21:['baselines','freshContexts','instructions','requirements','artifacts'],
  22:['products','requirements','tests','artifacts'],
  23:['products','requirements','tests','sources','research','artifacts'],
  24:['products','requirements','tests','regressions','regressionExecutions','artifacts'],
  25:['products','baselines','requirements','artifacts'],
  26:['products','baselines','requirements','tests','instructions','instructionTraces','runs','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','regressions','regressionExecutions','defects','blockers','evidenceRecords','artifacts'],
  27:['requirements','tests','products','baselines','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','releaseGateReviews','defects','blockers','regressionExecutions','evidenceRecords','artifactIdentities','artifacts'],
  28:['releaseRecords','artifactIdentities','artifacts','products','baselines'],
  29:['intentStatements','sources','research','requirements','instructions','instructionTraces','runs','products','tests','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','regressions','regressionExecutions','defects','blockers','releaseRecords','artifactIdentities','evidenceRecords','artifacts'],
  30:['defects','rootCauses','regressions','regressionExecutions','changes','baselines','evidenceRecords','artifacts']
});"""

operation_overrides="""const OPERATION_CONTRACT_OVERRIDES=Object.freeze({
  17:Object.freeze({
    FREEZE:Object.freeze({readCollections:['changes','candidateFreezes','iterations','requirements','instructions','preflightRecords','tests','failureTests','regressions','regressionExecutions','artifacts'],agentWritableCollections:[],allowedStageData:['NEW_FROZEN_VERSIONS','OLD_CONVERSATIONS_CONTINUED']}),
    EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts','artifacts'],agentWritableCollections:['runs'],allowedStageData:[]}),
    VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts','artifacts'],agentWritableCollections:['verification'],allowedStageData:[]}),
    COMPARE:Object.freeze({readCollections:['verification','runs','requirements','tests'],agentWritableCollections:['comparisons'],allowedStageData:[]}),
    ROOT_CAUSE:Object.freeze({readCollections:['defects','comparisons','verification','runs','requirements','tests','instructions','instructionTraces','requirementResolutions','preflightRecords','research','sources','candidateFreezes','artifacts','evidenceRecords'],agentWritableCollections:['defects','rootCauses'],allowedStageData:['ROOT_CAUSE_COMPLETED']}),
    REGRESSION:Object.freeze({readCollections:['defects','rootCauses','requirements','tests','failureTests','regressions','regressionExecutions','artifacts','evidenceRecords'],agentWritableCollections:['regressions','regressionExecutions'],allowedStageData:[]}),
    CORRECT:Object.freeze({readCollections:['intentStatements','sources','sourceConflicts','research','candidateRequirements','requirements','requirementResolutions','tests','failureTests','instructions','instructionTraces','preflightRecords','candidateFreezes','defects','rootCauses','regressions','regressionExecutions','changes','artifacts','evidenceRecords'],agentWritableCollections:['changes'],allowedStageData:['CORRECTIONS_COMPLETED']})
  }),
  19:Object.freeze({
    CONFIRM_FREEZE:Object.freeze({readCollections:['convergenceRecords','candidateFreezes','iterations','requirements','instructions','tests','regressions','artifacts'],agentWritableCollections:[],allowedStageData:[]}),
    EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts','artifacts'],agentWritableCollections:['runs'],allowedStageData:[]}),
    VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts','artifacts'],agentWritableCollections:['verification'],allowedStageData:[]}),
    COMPARE:Object.freeze({readCollections:['verification','runs','requirements','tests'],agentWritableCollections:['comparisons'],allowedStageData:[]}),
    REGRESSION_VERIFY:Object.freeze({readCollections:['regressions','regressionExecutions','runs','tests','artifacts'],agentWritableCollections:['regressionExecutions'],allowedStageData:[]}),
    CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','regressionExecutions','candidateFreezes','requirements','tests','defects','rootCauses','changes'],agentWritableCollections:['confirmationRecords'],allowedStageData:[]})
  })
});"""

regex_once('workflow-schema.js',r"const READ_COLLECTIONS=Object\.freeze\(\{.*?\}\);\nconst APPLICATION_COLLECTIONS=",read_collections+'\nconst APPLICATION_COLLECTIONS=','replace complete stage read contracts',re.S)
regex_once('workflow-schema.js',r"const OPERATION_CONTRACT_OVERRIDES=Object\.freeze\(\{.*?\}\);\nfunction operationContract",operation_overrides+'\nfunction operationContract','replace repeated-stage operation read contracts',re.S)

prompt=Path('prompt-engine.js').read_text()
replacements=[
    ("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/27';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/28';",'prompt-engine version'),
    ("return {contractVersion:'closed-loop-response-contract/2.5'","return {contractVersion:'closed-loop-response-contract/3'",'response-contract identity'),
    ("NEXT_REQUIRED_ACTION: ${j.NEXT_REQUIRED_ACTION||'UNKNOWN'}","NEXT_REQUIRED_ACTION: ${show(j.NEXT_REQUIRED_ACTION)}",'structured next action rendering'),
    ("EXECUTABLE_KIND = CUSTOM_PIPELINE","EXECUTABLE_KIND = TEST_IR",'Test IR executable kind'),
]
for old,new,label in replacements:
    count=prompt.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    prompt=prompt.replace(old,new,1)

stage2_old="2:'Discover, inspect, and classify only independent external sources and authorities for this current job. Stage 02 is not a supplied-project-material inventory stage."
stage2_new="2:'Discover, inspect, and classify only independent external sources and authorities for this current job. Use the complete active canonical Stage 01 intentStatements ledger and current User Job Input to determine what external authority or direct evidence must be discovered; account for every relevant intent statement as search context without converting it into an external source. The original Stage 01 intent file is prohibited input and must never be requested, attached, resent, reopened, or relied on. Stage 02 is not a supplied-project-material inventory stage."
if prompt.count(stage2_old)!=1:
    raise SystemExit('Stage 02 canonical-intent instruction anchor was not unique.')
prompt=prompt.replace(stage2_old,stage2_new,1)

duplicate="The original Stage 01 intent file is prohibited input: never request it, attach it, resend it, reopen it, or rely on an earlier conversation that contains it. The original Stage 01 intent file is prohibited input: never request it, attach it, resend it, reopen it, or rely on an earlier conversation that contains it."
if prompt.count(duplicate)!=1:
    raise SystemExit('Stage 04 duplicate intent-file prohibition was not found exactly once.')
prompt=prompt.replace(duplicate,"The original Stage 01 intent file is prohibited input: never request it, attach it, resend it, reopen it, or rely on an earlier conversation that contains it.",1)

fields_replacement=""" const fields=stageFields.length?stageFields.map(x=>{const definition=schema.STAGE_FIELDS[stage][x];return `- ${x}: ${definition.valueType}${definition.enumValues?.length?` enum(${definition.enumValues.join(' | ')})`:''}${definition.nullable?' nullable':''}`;}).join('\\n'):'- No agent-owned stageData fields for this operation; use permitted records/evidence only.';
 const projectDataRule=`PROJECT DATA EXECUTION RULE — MANDATORY\\nProject data embedded in this prompt is OPERATIVE INPUT. Use every relevant supplied and canonical project fact to perform the current stage transformation; do not merely restate, summarize, inventory, acknowledge, or discuss it. Project-relevant information supplied by the human is supplied once. If it exists in current canonical project state, persisted human answers, or this exact instruction, never ask the human to repeat, retype, summarize, resend, reopen, or reattach it. If required prior-stage capture is incomplete, return the exact earlier-stage deficiency and responsible stage instead of transferring that work back to the human. Never replace required stage work with generic advice about how somebody else should do it.`;
 const writable="""
prompt,count=re.subn(r" const fields=stageFields\.length\?.*?;\n const writable=",fields_replacement,prompt,count=1,flags=re.S)
if count!=1:
    raise SystemExit(f'Prompt stage-field rule consolidation matched {count} times.')
anchor="})()}STAGE-SPECIFIC TASK"
if prompt.count(anchor)!=1:
    raise SystemExit('Universal project-data rule insertion anchor was not unique.')
prompt=prompt.replace(anchor,"})()}${projectDataRule}\\n\\nSTAGE-SPECIFIC TASK",1)
Path('prompt-engine.js').write_text(prompt)

# Strengthen focused prompt semantics.
sem=Path('verify-prompt-semantics.mjs').read_text()
stage4_anchor="{\n const p=project(),scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'};"
stage2_test="""{
 const p=project(),scope={inputVersion:'INPUT-v001'};
 p.projectData.intentStatements=[{id:'STATEMENT-STAGE02',STATEMENT_ID:'STATEMENT-STAGE02',fields:{EXACT_STATEMENT:'CANONICAL_STAGE01_INTENT_FOR_SOURCE_DISCOVERY',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST'},scope,status:'ACTIVE'}];
 const r=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});
 for(const text of ['INTENT STATEMENTS','CANONICAL_STAGE01_INTENT_FOR_SOURCE_DISCOVERY','The original Stage 01 intent file is prohibited input for this stage.','must never be requested, attached, resent, reopened, or relied on'])assert.ok(r.prompt.includes(text),`Stage 02 prompt missing canonical-intent behavior ${text}`);
 assert.equal((r.prompt.match(/PROJECT DATA EXECUTION RULE — MANDATORY/g)||[]).length,1,'Stage 02 must contain one project-data execution rule.');
}
"""
if sem.count(stage4_anchor)!=1:
    raise SystemExit('Stage 04 semantics test anchor was not unique.')
sem=sem.replace(stage4_anchor,stage2_test+stage4_anchor,1)
old_stage6="""{
 const p=project();const r=prompts.buildPromptRecord(6,p,{operation:'COMPLETE'});for(const text of ['closed-loop-test-spec/1','APPLICATION_DETERMINISTIC','CLOSED_LOOP_TEST_IR','PARSE_XML','SELECT_XML'])assert.ok(r.prompt.includes(text),`Stage 06 Test IR prompt missing ${text}`);
}
"""
new_stage6="""{
 const p=project();const r=prompts.buildPromptRecord(6,p,{operation:'COMPLETE'});for(const text of ['closed-loop-test-spec/1','APPLICATION_DETERMINISTIC','CLOSED_LOOP_TEST_IR','PARSE_XML','SELECT_XML','EXECUTABLE_KIND = TEST_IR'])assert.ok(r.prompt.includes(text),`Stage 06 Test IR prompt missing ${text}`);
 assert.ok(!r.prompt.includes('EXECUTABLE_KIND = CUSTOM_PIPELINE'),'Stage 06 publishes a prohibited executable kind.');
 assert.equal((r.prompt.match(/PROJECT DATA EXECUTION RULE — MANDATORY/g)||[]).length,1,'Stage 06 must contain one project-data execution rule.');
}
"""
if sem.count(old_stage6)!=1:
    raise SystemExit('Stage 06 semantics test block was not unique.')
sem=sem.replace(old_stage6,new_stage6,1)
sem=sem.replace("console.log(JSON.stringify({subjectNeutral:true,stage1Exhaustive:true,stage4ClosedUnion:true,testIrPublished:true},null,2));","console.log(JSON.stringify({subjectNeutral:true,stage1Exhaustive:true,stage2CanonicalIntent:true,stage4ClosedUnion:true,testIrPublished:true,testIrContract:'TEST_IR'},null,2));",1)
Path('verify-prompt-semantics.mjs').write_text(sem)

# Exercise the exact generated prompts through the rendered application without changing layout.
browser=Path('verify-browser.mjs').read_text()
browser_anchor="assert(!(await evalValue(cdp,`document.querySelector('#generated-prompt')?.classList.contains('expanded')`)),'Prompt preview starts expanded instead of compact.');"
browser_checks="""const stage02PromptText=await evalValue(cdp,`document.querySelector('#generated-prompt')?.textContent||''`);for(const token of ['INTENT STATEMENTS',retained.job.EXACT_USER_OBJECTIVE_VERBATIM,'The original Stage 01 intent file is prohibited input for this stage.','PROJECT DATA EXECUTION RULE — MANDATORY'])assert(stage02PromptText.includes(token),`Rendered Stage 02 prompt omitted ${token}.`);assert((stage02PromptText.match(/PROJECT DATA EXECUTION RULE — MANDATORY/g)||[]).length===1,'Rendered Stage 02 prompt repeats the operative-project-data rule.');assert(!stage02PromptText.includes('NEXT_REQUIRED_ACTION: [object Object]'),'Rendered prompt stringified structured next action as [object Object].');const stage06PromptText=await evalValue(cdp,`(async()=>{const id=document.querySelector('#current-project-summary')?.textContent?.split(' · ')[0],all=await globalThis.closedLoopProjectStore.readAll(),p=all.find(x=>x.job?.JOB_ID===id);return globalThis.closedLoopPromptEngine.buildPromptRecord(6,p,{operation:'COMPLETE'}).prompt;})()`);assert(stage06PromptText.includes('EXECUTABLE_KIND = TEST_IR')&&!stage06PromptText.includes('EXECUTABLE_KIND = CUSTOM_PIPELINE'),'Rendered Stage 06 prompt publishes the wrong Test IR executable kind.');"""
if browser.count(browser_anchor)!=1:
    raise SystemExit('Browser prompt assertion anchor was not unique.')
browser=browser.replace(browser_anchor,browser_checks+browser_anchor,1)
Path('verify-browser.mjs').write_text(browser)

# Preserve the established prompt-box dimensions while giving the complete runtime graph one cache identity.
token='runtime-20260830-stage-prompts'
html=Path('index.html').read_text()
html,count=re.subn(r'(<script defer src="(?:workbook|hash|workflow-schema|test-runtime|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)[^"]+("[^>]*></script>)',lambda m:m.group(1)+token+m.group(2),html)
if count!=9:
    raise SystemExit(f'Expected nine shared script cache tokens, updated {count}.')
Path('index.html').write_text(html)
replace_once('app-core.js',"new Worker('test-worker.js')",f"new Worker('test-worker.js?v={token}')",'worker entry cache identity')
replace_once('test-worker.js',"importScripts('test-runtime.js');",f"importScripts('test-runtime.js?v={token}');",'worker runtime cache identity')

# Wire the permanent all-stage proof into syntax, test, deploy, live status, and acceptance coverage.
workflow=Path('.github/workflows/pages.yml').read_text()
workflow_replacements=[
("          node --check verify-prompt-semantics.mjs\n","          node --check verify-prompt-semantics.mjs\n          node --check verify-all-stage-prompts.mjs\n",'all-stage syntax check'),
("      - name: Prove semantic false-acceptance invariant\n        run: node verify-semantic-invariant.mjs\n","      - name: Verify every stage and operation prompt one by one\n        run: node verify-all-stage-prompts.mjs\n      - name: Prove semantic false-acceptance invariant\n        run: node verify-semantic-invariant.mjs\n",'all-stage test job'),
("node verify-full-cycle.mjs && node verify-prompt-semantics.mjs && node verify-semantic-invariant.mjs","node verify-full-cycle.mjs && node verify-prompt-semantics.mjs && node verify-all-stage-prompts.mjs && node verify-semantic-invariant.mjs",'all-stage deploy proof'),
("          node verify-complete.mjs > /tmp/verify-complete.out\n          node verify-semantic-invariant.mjs > /tmp/verify-semantic-invariant.out\n","          node verify-complete.mjs > /tmp/verify-complete.out\n          node verify-all-stage-prompts.mjs > /tmp/verify-all-stage-prompts.out\n          node verify-semantic-invariant.mjs > /tmp/verify-semantic-invariant.out\n",'all-stage acceptance execution'),
("          grep -q 'verify-one-time-intent-intake: PASS' /tmp/verify-one-time-intent-intake.out\n","          grep -q 'verify-one-time-intent-intake: PASS' /tmp/verify-one-time-intent-intake.out\n          grep -q 'verify-all-stage-prompts: PASS' /tmp/verify-all-stage-prompts.out\n",'all-stage acceptance assertion'),
("            stage04ObligationAccounting:1,\n","            stage04ObligationAccounting:1,\n            allStagePromptCoverage:1,\n            promptOperationsVerified:41,\n",'all-stage report fields'),
("              oneTimeIntentIntake:'verify-one-time-intent-intake.mjs',\n","              oneTimeIntentIntake:'verify-one-time-intent-intake.mjs',\n              allStagePromptCoverage:'verify-all-stage-prompts.mjs',\n",'all-stage report proof source'),
("'stage01ControlledInputAccounting','stage04ObligationAccounting','mandatoryEvidenceSufficiencyCoverage'","'stage01ControlledInputAccounting','stage04ObligationAccounting','allStagePromptCoverage','mandatoryEvidenceSufficiencyCoverage'",'all-stage coverage gate')
]
for old,new,label in workflow_replacements:
    count=workflow.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected one workflow anchor, found {count}')
    workflow=workflow.replace(old,new,1)
# Prove the worker and all directly loaded scripts use the same build/cache identity.
architecture_anchor="          if(tokens.size!==1)throw new Error('Mixed runtime build tokens');\n          NODE\n"
architecture_new=f"          if(tokens.size!==1)throw new Error('Mixed runtime build tokens');\n          const token=[...tokens][0],app=fs.readFileSync('app-core.js','utf8'),worker=fs.readFileSync('test-worker.js','utf8');\n          if(!app.includes(`test-worker.js?v=${{token}}`))throw new Error('Worker entry does not use the shared build token');\n          if(!worker.includes(`test-runtime.js?v=${{token}}`))throw new Error('Worker runtime import does not use the shared build token');\n          NODE\n"
if workflow.count(architecture_anchor)!=1:
    raise SystemExit('Shared worker cache identity workflow anchor was not unique.')
workflow=workflow.replace(architecture_anchor,architecture_new,1)
Path('.github/workflows/pages.yml').write_text(workflow)

# Exact postconditions. No visual declaration or prompt-height rule may change.
assert 'height:clamp(260px,45vh,520px)' in Path('index.html').read_text()
assert '.expandable-prompt{max-height:280px}' in Path('index.html').read_text()
assert 'EXECUTABLE_KIND = CUSTOM_PIPELINE' not in Path('prompt-engine.js').read_text()
assert Path('prompt-engine.js').read_text().count('PROJECT DATA EXECUTION RULE — MANDATORY')==1
assert "new Worker('test-worker.js?v=runtime-20260830-stage-prompts')" in Path('app-core.js').read_text()
assert "importScripts('test-runtime.js?v=runtime-20260830-stage-prompts');" in Path('test-worker.js').read_text()
print('apply-stage-prompt-repair: complete')
