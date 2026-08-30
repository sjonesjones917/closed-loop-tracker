from pathlib import Path

p=Path('prompt-engine.js')
s=p.read_text()
s=s.replace("PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/38'","PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/39'",1)
old="const PROMPT_CONTEXT_ADDITIONS=Object.freeze({8:Object.freeze(['research','sourceConflicts','evidenceRecords']),11:Object.freeze(['instructions','artifacts']),12:Object.freeze(['sources','research','evidenceRecords','artifacts']),14:Object.freeze(['sources','research','candidateRequirements','requirementResolutions','sourceConflicts','failureTests','preflightRecords','artifacts','evidenceRecords','changes']),18:Object.freeze(['requirements','tests','rootCauses','changes','evidenceRecords']),22:Object.freeze(['requirements','evidenceRecords']),24:Object.freeze(['sources','research']),25:Object.freeze(['baselines','tests','evidenceRecords'])});"
new="const PROMPT_CONTEXT_ADDITIONS=Object.freeze({2:Object.freeze(['intentStatements']),4:Object.freeze(['sourceConflicts']),5:Object.freeze(['intentStatements','candidateRequirements']),6:Object.freeze(['sources','research']),8:Object.freeze(['research','sourceConflicts','evidenceRecords']),9:Object.freeze(['failureTests','requirementResolutions','sources','sourceConflicts']),11:Object.freeze(['instructions','artifacts']),12:Object.freeze(['sources','research','evidenceRecords','artifacts']),14:Object.freeze(['sources','research','candidateRequirements','requirementResolutions','sourceConflicts','failureTests','preflightRecords','artifacts','evidenceRecords','changes']),18:Object.freeze(['requirements','tests','rootCauses','changes','evidenceRecords']),20:Object.freeze(['artifacts']),22:Object.freeze(['requirements','evidenceRecords']),23:Object.freeze(['research']),24:Object.freeze(['sources','research','artifacts']),25:Object.freeze(['baselines','tests','evidenceRecords']),26:Object.freeze(['confirmationRecords']),27:Object.freeze(['confirmationRecords','regressions']),29:Object.freeze(['evidenceChains']),30:Object.freeze(['requirements'])});"
if old not in s: raise SystemExit('PROMPT_CONTEXT_ADDITIONS marker missing')
s=s.replace(old,new,1)
old2="CONFIRM_FREEZE:Object.freeze(['artifacts','instructions'])"
new2="CONFIRM_FREEZE:Object.freeze(['requirements','tests','artifacts','instructions'])"
if old2 not in s: raise SystemExit('Stage 19 CONFIRM_FREEZE context marker missing')
s=s.replace(old2,new2,1)
marker="const procedures=stageSpecial;"
augment="""const procedureAugmentation=Object.freeze({
  2:'Continue source discovery until no new applicable controlling or correctness-relevant external source category is found. Do not stop at the first plausible source or at an arbitrary source count; source count is a search target, never permission to omit stronger authority or invent weaker sources.',
  5:'Resolve the current job requirement set exhaustively. After each semantic correction, repeat the defect review against the resulting current requirement set until every defect class has been resolved or is explicitly blocked; do not review only the changed rows.',
  9:'If any material correction is required, produce the correction for a new instruction version and then re-review the entire current instruction from the beginning; do not review only the edited clause. Do not execute target production during preflight.',
  14:'For each material defect, trace causality backward through product/output, execution, instruction, requirement, research, source, user input, tool/configuration, artifact, and audit/evidence layers as applicable, and identify the earliest defective layer supported by evidence.'
});
const procedures=Object.freeze(Object.fromEntries(Object.entries(stageSpecial).map(([stage,text])=>[stage,procedureAugmentation[stage]?`${text} ${procedureAugmentation[stage]}`:text])));"""
if marker not in s: raise SystemExit('procedures marker missing')
s=s.replace(marker,augment,1)
p.write_text(s)

p=Path('index.html')
s=p.read_text()
if 'runtime-20260830-live-operator-39' not in s: raise SystemExit('runtime token marker missing')
p.write_text(s.replace('runtime-20260830-live-operator-39','runtime-20260830-live-operator-40'))
