from pathlib import Path

p = Path('prompt-engine.js')
s = p.read_text()
s = s.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/35';", "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/36';")

marker = "function contextFor(stage,state,operation,scope={}){const parts=[];"
if marker not in s:
    raise SystemExit('prompt context insertion point not found')

addition = """const PROMPT_CONTEXT_ADDITIONS=Object.freeze({
  8:Object.freeze(['research','sourceConflicts','evidenceRecords']),
  11:Object.freeze(['instructions','artifacts']),
  12:Object.freeze(['sources','research','evidenceRecords','artifacts']),
  14:Object.freeze(['sources','research','candidateRequirements','requirementResolutions','sourceConflicts','failureTests','preflightRecords','artifacts','evidenceRecords','changes']),
  18:Object.freeze(['requirements','tests','rootCauses','changes','evidenceRecords']),
  22:Object.freeze(['requirements','evidenceRecords']),
  24:Object.freeze(['sources','research']),
  25:Object.freeze(['baselines','tests','evidenceRecords'])
});
const PROMPT_OPERATION_CONTEXT_ADDITIONS=Object.freeze({
  17:Object.freeze({
    FREEZE:Object.freeze(['instructions','preflightRecords','failureTests','artifacts','requirements','requirementResolutions']),
    EXECUTE_RUN:Object.freeze(['instructions','artifacts']),
    VERIFY:Object.freeze(['sources','research','evidenceRecords','artifacts']),
    COMPARE:Object.freeze(['tests']),
    ROOT_CAUSE:Object.freeze(['requirements','tests','instructions','runs','sources','research','candidateRequirements','requirementResolutions','failureTests','preflightRecords','artifacts','evidenceRecords','changes']),
    REGRESSION:Object.freeze(['requirements','tests','artifacts','evidenceRecords','runs']),
    CORRECT:Object.freeze(['requirements','requirementResolutions','instructions','tests','failureTests','artifacts','evidenceRecords'])
  }),
  19:Object.freeze({
    CONFIRM_FREEZE:Object.freeze(['artifacts','instructions']),
    EXECUTE_RUN:Object.freeze(['instructions','artifacts']),
    VERIFY:Object.freeze(['sources','research','evidenceRecords','artifacts']),
    COMPARE:Object.freeze(['tests']),
    REGRESSION_VERIFY:Object.freeze(['requirements','tests','artifacts','evidenceRecords','candidateFreezes']),
    CONFIRM:Object.freeze(['requirements','tests','defects','rootCauses','evidenceRecords','blockers'])
  })
});
function promptReadCollections(stage,operation){
  const op=schema.operationContract(stage,operation||schema.STAGE_CONTRACTS[stage].operations[0]);
  return [...new Set([...(op?.readCollections||schema.STAGE_CONTRACTS[stage].readCollections||[]),...(PROMPT_CONTEXT_ADDITIONS[stage]||[]),...(PROMPT_OPERATION_CONTEXT_ADDITIONS[stage]?.[operation]||[])])];
}
"""
if 'const PROMPT_CONTEXT_ADDITIONS=' not in s:
    s = s.replace(marker, addition + marker)

old_loop = "for(const collection of op?.readCollections||schema.STAGE_CONTRACTS[stage].readCollections||[]){"
new_loop = "for(const collection of promptReadCollections(stage,operation)){"
if old_loop not in s:
    raise SystemExit('contextFor read-collection loop not found')
s = s.replace(old_loop, new_loop, 1)

old_manifest = "readCollections:Object.fromEntries((opContract?.readCollections||schema.STAGE_CONTRACTS[stage].readCollections||[]).map(collection=>[collection,contextRecordsFor(state,collection,scope,batchPlan,stage).map(record=>({id:recordId(record,collection),scope:record.scope||{},contentSha256:record.contentSha256||record.sha256||hash.sha256Value(recordFields(record))}))]))"
new_manifest = "readCollections:Object.fromEntries(promptReadCollections(stage,operation).map(collection=>[collection,contextRecordsFor(state,collection,scope,batchPlan,stage).map(record=>({id:recordId(record,collection),scope:record.scope||{},contentSha256:record.contentSha256||record.sha256||hash.sha256Value(recordFields(record))}))]))"
if old_manifest not in s:
    raise SystemExit('context manifest read-collection expression not found')
s = s.replace(old_manifest, new_manifest, 1)
p.write_text(s)

h = Path('index.html')
x = h.read_text()
old_css = '.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'
new_css = '.expandable-prompt{height:280px;max-height:280px}.expandable-prompt.expanded{height:auto;max-height:none}'
if old_css not in x:
    raise SystemExit('current prompt surface rule not found')
x = x.replace(old_css, new_css, 1)
x = x.replace('runtime-20260830-prompt-authority-35', 'runtime-20260830-prompt-authority-36')
h.write_text(x)
