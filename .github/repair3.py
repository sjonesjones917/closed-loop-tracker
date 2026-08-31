from pathlib import Path
p=Path('verify-complete.mjs')
s=p.read_text()
old=" let p=project('JOB-SCOPED-ACCEPTED-REFINEMENT'),stage=11;const bytes=new TextEncoder().encode('refinement-candidate');"
new=" let p=project('JOB-SCOPED-ACCEPTED-REFINEMENT'),stage=11;p.stages[9].status='COMPLETE';p.stages[9].gate={complete:true};const bytes=new TextEncoder().encode('refinement-candidate');"
count=s.count(old)
if count==1:
    s=s.replace(old,new)
elif count==0 and new in s:
    pass
else:
    raise SystemExit(f'verify-complete.mjs: expected one Stage 09 prerequisite sentinel, found {count}')
old2=" const acceptLane=(slot,label)=>{const pr={...prompts.buildPromptRecord(stage,p,{scope:{runId:slot.runId,contextId:slot.contextId}}),generatedAt:new Date().toISOString()};"
new2=" const acceptLane=(slot,label)=>{p.stages[10].status='COMPLETE';p.stages[10].gate={complete:true};const pr={...prompts.buildPromptRecord(stage,p,{scope:{runId:slot.runId,contextId:slot.contextId}}),generatedAt:new Date().toISOString()};"
count2=s.count(old2)
if count2==1:
    s=s.replace(old2,new2)
elif count2==0 and new2 in s:
    pass
else:
    raise SystemExit(f'verify-complete.mjs: expected one Stage 10 scoped-lane prerequisite sentinel, found {count2}')
p.write_text(s)

p=Path('verify-stage-prompts-complete.mjs')
s=p.read_text()
old="1:['BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','every inputId exactly once']"
new="1:['BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','APPLICATION INTAKE MANIFEST unit exactly once']"
count=s.count(old)
if count==1:
    p.write_text(s.replace(old,new))
elif count==0 and new in s:
    pass
else:
    raise SystemExit(f'verify-stage-prompts-complete.mjs: expected one canonical Stage 01 phrase sentinel, found {count}')
