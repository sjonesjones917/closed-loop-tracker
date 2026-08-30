from pathlib import Path
import re
p=Path('.github/integration_patch.py')
t=p.read_text()
pattern=r"if new not in t:\n\s+if old not in t: raise SystemExit\('schema stage type override anchor missing'\)\n\s+t=t\.replace\(old,new,1\)"
replacement="if 'INTAKE_ACCOUNTING:Object.freeze' not in t:\n    if old not in t: raise SystemExit('schema stage type override anchor missing')\n    t=t.replace(old,new,1)"
t,n=re.subn(pattern,replacement,t,count=1)
if n!=1 and "if 'INTAKE_ACCOUNTING:Object.freeze' not in t:" not in t:
    raise SystemExit(f'could not normalize accounting override guard: {n}')
p.write_text(t)
exec(compile(t,str(p),'exec'),{'__file__':str(p),'__name__':'__main__'})
