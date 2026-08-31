from pathlib import Path
p=Path('workflow-engine.js')
s=p.read_text()
old="case 10:requireAccepted();requireCount('iterations',1);requireCount('candidateFreezes',1);break;"
new="case 10:requireCount('iterations',1);requireCount('candidateFreezes',1);break;"
count=s.count(old)
if count==1:
    p.write_text(s.replace(old,new))
elif count==0 and new in s:
    pass
else:
    raise SystemExit(f'workflow-engine.js: expected one Stage 10 gate sentinel, found {count}')
