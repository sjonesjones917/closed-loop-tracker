from pathlib import Path
p=Path('verify-intake-closure.mjs')
s=p.read_text()
old="const prompt1=prompts.buildPromptRecord(1,p);assert("
new="const prompt1=prompts.buildPromptRecord(1,p);p.projectData.generatedPrompts.push(prompt1);assert("
if old not in s:
    raise SystemExit('Prompt 1 persistence fixture anchor not found.')
s=s.replace(old,new,1)
old="scope:{sourceSetVersion:'SOURCE-SET-v001'}"
new="scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'}"
if old not in s:
    raise SystemExit('Stage 3 research current-scope fixture anchor not found.')
s=s.replace(old,new)
p.write_text(s)
