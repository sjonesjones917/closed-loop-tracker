from pathlib import Path
import re

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
new_required="const required1=[/complete human-authority intake/i,/enumerated every current controlled human-input unit/i,/classify every supplied unit exactly once/i,/derive the complete foreseeable set of genuinely human-only questions from the actual user request, accessible supplied materials, and current canonical context/i];"
t,n=re.subn(r"const required1=\[[^\n]*\];",new_required,t,count=1)
if n!=1:
    raise SystemExit('Stage 01 required1 declaration missing after locality materialization')
v.write_text(t)