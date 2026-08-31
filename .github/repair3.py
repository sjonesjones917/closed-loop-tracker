from pathlib import Path
p=Path('verify-complete.mjs')
s=p.read_text()
old=" let p=project('JOB-SCOPED-ACCEPTED-REFINEMENT'),stage=11;const bytes=new TextEncoder().encode('refinement-candidate');"
new=" let p=project('JOB-SCOPED-ACCEPTED-REFINEMENT'),stage=11;p.stages[9].status='COMPLETE';p.stages[9].gate={complete:true};const bytes=new TextEncoder().encode('refinement-candidate');"
count=s.count(old)
if count==1:
    p.write_text(s.replace(old,new))
elif count==0 and new in s:
    pass
else:
    raise SystemExit(f'verify-complete.mjs: expected one Stage 09 prerequisite sentinel, found {count}')
