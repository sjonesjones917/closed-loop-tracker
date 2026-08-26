from pathlib import Path
p=Path('.final-semantic-patch.py')
s=p.read_text()
old='elif " ] .filter" not in old:'
new='elif not old.startswith("] .filter"):'
if old not in s:
    raise SystemExit('patch-script guard anchor missing')
p.write_text(s.replace(old,new,1))
