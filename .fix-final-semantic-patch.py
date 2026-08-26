from pathlib import Path
p=Path('.final-semantic-patch.py')
s=p.read_text()
old='elif " ] .filter" not in old:'
new='elif not old.startswith("] .filter"):'
if old not in s:
    raise SystemExit('patch-script guard anchor missing')
s=s.replace(old,new,1)
old2="if(wanted&&!(Number(stage)===17&&op==='FREEZE')&&String(scope.iterationId||'')!==wanted)continue;"
new2="const setupOperation=(Number(stage)===17&&op==='FREEZE')||(Number(stage)===19&&op==='CONFIRM_FREEZE');if(wanted&&!setupOperation&&String(scope.iterationId||'')!==wanted)continue;"
if old2 not in s:
    raise SystemExit('iteration setup-operation anchor missing')
s=s.replace(old2,new2,1)
p.write_text(s)
