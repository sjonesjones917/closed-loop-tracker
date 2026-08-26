from pathlib import Path
p=Path('.final-current-patch.py')
s=p.read_text()
old='pat=r"function scopeFor\\(stage,state,overrides=\\{\\}\\)\\{.*?\\n return value;\\n\\}"'
new='pat=r"function scopeFor\\(stage,state,overrides=\\{\\}\\)\\{.*?return value;\\}"'
if old not in s: raise SystemExit('scope matcher script anchor missing')
p.write_text(s.replace(old,new,1))
