from pathlib import Path
p=Path('prompt-engine.js'); t=p.read_text()
phrase='Derive subject-specific human-authority questions from the actual user request, accessible supplied materials, and current canonical context; do not use a hard-coded project-subject catalogue.'
if phrase not in t:
    anchor='Ask only genuinely human-only questions.'
    if anchor not in t: raise SystemExit('Stage 01 generic-question insertion anchor missing')
    t=t.replace(anchor,anchor+' '+phrase,1)
p.write_text(t)
print('Stage 01 generic project-derived questioning instruction present exactly once')
