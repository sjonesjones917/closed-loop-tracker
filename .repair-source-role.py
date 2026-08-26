from pathlib import Path

p=Path('prompt-engine.js');s=p.read_text()
old='If no legitimate external governing source applies, return SOURCE_APPLICABILITY_DETERMINATION = NO_APPLICABLE_EXTERNAL_SOURCE with evidence; never invent a source merely to satisfy a count.'
new='If no legitimate independent external source of any justified authority or evidentiary role applies, return SOURCE_APPLICABILITY_DETERMINATION = NO_APPLICABLE_EXTERNAL_SOURCE with evidence; never invent a source merely to satisfy a count.'
if old not in s: raise SystemExit('Stage 2 no-source prompt anchor missing')
p.write_text(s.replace(old,new,1))

p=Path('workbook.js');s=p.read_text()
repls={
"'Extract every material requirement, restriction, exception, condition, and dependency from the governing sources.'":"'Extract every material fact, requirement, restriction, exception, condition, dependency, recommendation, and evidentiary constraint from the accepted external source set while preserving each source role.'",
"2:['Every governing source has a complete record','Every relied-upon supplied file was inspected','Authority hierarchy is recorded','Every controlling conflict is resolved or blocked']":"2:['Every accepted independent external source has a complete record','Every relied-upon supplied file was inspected','Authority and evidentiary roles are recorded','Every controlling conflict is resolved or blocked']",
"3:['Every controlling source has a research record','User, format, medium, delivery, and dependency requirements were considered','Conflict, restriction, and exception pass complete','Latest complete pass found no new material requirement category']":"3:['Every current accepted Stage 02 source has a current research record, unless Stage 02 validly determined no applicable external source exists','User, format, medium, delivery, and dependency requirements were considered','Conflict, restriction, and exception pass complete','Latest complete pass found no new material requirement category']"
}
for old,new in repls.items():
    if old not in s: raise SystemExit('Workbook source-role anchor missing: '+old[:80])
    s=s.replace(old,new,1)
p.write_text(s)

p=Path('verify-prompt-semantics.mjs');s=p.read_text()
marker='// Stage 02 distinguishes governing authority from legitimate independent evidentiary sources.'
if marker in s: raise SystemExit('source-role proof already exists')
insert=r'''
// Stage 02 distinguishes governing authority from legitimate independent evidentiary sources.
{
 const p=baseProject(),record=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});
 if(!/no legitimate independent external source of any justified authority or evidentiary role/i.test(record.prompt))throw new Error('Stage 02 no-source rule still means only no governing authority.');
 if(core.STAGES[1].completionGate.some(x=>/every governing source/i.test(x)))throw new Error('Stage 02 completion still requires every useful source to be governing authority.');
 if(core.STAGES[2].completionGate.some(x=>/every controlling source/i.test(x)))throw new Error('Stage 03 completion still ignores accepted non-controlling Stage 02 sources.');
 if(!core.STAGES[2].completionGate.some(x=>/every current accepted Stage 02 source/i.test(x)))throw new Error('Stage 03 does not require research for the complete current Stage 02 source set.');
}

'''
idx=s.rfind('console.log(JSON.stringify(')
if idx<0: raise SystemExit('semantic report anchor missing')
p.write_text(s[:idx]+insert+s[idx:])
