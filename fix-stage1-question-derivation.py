from pathlib import Path

p=Path('prompt-engine.js')
text=p.read_text()
old="Classify every supplied unit exactly once and preserve every materially relevant fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue. INPUT_SET_CONTENTS"
new="Classify every supplied unit exactly once and preserve every materially relevant fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue. Derive the complete foreseeable set of genuinely human-only questions from the actual user request, accessible supplied materials, and current canonical context; do not rely on a hard-coded project-subject checklist. INPUT_SET_CONTENTS"
if old not in text:
    raise SystemExit('Stage 01 generic question-derivation insertion anchor missing')
text=text.replace(old,new,1)
p.write_text(text)

v=Path('verify-prompt-semantics.mjs')
t=v.read_text()
old_required="const required1=[/complete human-authority intake/i,/enumerated every current controlled human-input unit/i,/classify every supplied unit exactly once/i,/Do not perform Stage 02 source inventory or Stage 03 source research here/i,/Do not atomize the final requirement specification, design tests, author production instructions, or generate the final product here/i];"
new_required="const required1=[/Perform complete human-authority intake only/i,/application has enumerated every current controlled human-input unit/i,/Classify every supplied unit exactly once/i,/derive the complete foreseeable set of genuinely human-only questions from the actual user request, accessible supplied materials, and current canonical context/i,/Do not perform source research, requirement atomization, test design, production, filing, simulation, manufacturing, or product verification/i];"
if old_required not in t:
    raise SystemExit('materialized Stage 01 locality required1 anchor missing')
t=t.replace(old_required,new_required,1)
v.write_text(t)
