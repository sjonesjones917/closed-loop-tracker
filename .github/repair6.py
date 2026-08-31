from pathlib import Path

p=Path('prompt-engine.js')
s=p.read_text()
old="map(([k])=>[k,state?.job?.[k]])):null,originalUserEntered"
new="map(([k])=>[k,state?.job?.[k]===undefined?null:state.job[k]])):null,originalUserEntered"
count=s.count(old)
if count==1:
    p.write_text(s.replace(old,new))
elif count==0 and new in s:
    pass
else:
    raise SystemExit(f'prompt-engine.js: expected one undefined Stage 04 human-context sentinel, found {count}')
