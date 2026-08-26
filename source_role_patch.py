from pathlib import Path

p=Path('prompt-engine.js'); s=p.read_text()
old='If no legitimate external governing source applies, return SOURCE_APPLICABILITY_DETERMINATION = NO_APPLICABLE_EXTERNAL_SOURCE with evidence; never invent a source merely to satisfy a count.'
new='If no legitimate independent external source of any justified authority or evidentiary role applies, return SOURCE_APPLICABILITY_DETERMINATION = NO_APPLICABLE_EXTERNAL_SOURCE with evidence; never invent a source merely to satisfy a count.'
if old not in s: raise SystemExit('Stage 2 no-source wording changed unexpectedly')
s=s.replace(old,new,1); p.write_text(s)

p=Path('workbook.js'); s=p.read_text()
old='Extract every material requirement, restriction, exception, condition, and dependency from the governing sources.'
new='Extract every material fact, requirement, restriction, exception, condition, dependency, recommendation, and evidentiary constraint from the accepted external source set while preserving each source role.'
if old not in s: raise SystemExit('Stage 3 result wording changed unexpectedly')
s=s.replace(old,new,1)
old='Every governing source is researched independently, with at least two passes and explicit conflict, exception, and invalidation analysis.'
new='Every accepted external source is researched according to its actual authority or evidentiary role, with at least two passes and explicit conflict, exception, and invalidation analysis where applicable.'
if old in s: s=s.replace(old,new,1)
old='Every controlling source has at least one complete research record with exact source linkage and evidence.'
new='Every accepted external source that materially informs, controls, or proves correctness has at least one complete research record with exact source linkage and evidence.'
if old in s: s=s.replace(old,new,1)
p.write_text(s)

p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
if 'Legitimate external evidence is not falsely required to be governing authority.' not in s:
    s += '''\n\n// Legitimate external evidence is not falsely required to be governing authority.\n{\n const p=baseProject();\n const s2=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});\n if(!/no legitimate independent external source of any justified authority or evidentiary role/i.test(s2.prompt))throw new Error('Stage 02 no-source rule still incorrectly means no governing authority.');\n if(core.STAGES[1].completionGate.some(x=>/every governing source/i.test(x))||core.STAGES[2].completionGate.some(x=>/every controlling source/i.test(x)))throw new Error('Workbook source completion language still treats every useful external source as governing authority.');\n}\n'''
p.write_text(s)
