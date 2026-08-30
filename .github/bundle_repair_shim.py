from pathlib import Path
p=Path('.github/bundle_repair.py')
t=p.read_text()
old="""    if count is not None and found!=count:\n        raise SystemExit(f'guard failed: {path}: expected {count} occurrences, found {found}: {old[:120]!r}')\n    text=text.replace(old,new)\n"""
new="""    if count is not None and found<count:\n        raise SystemExit(f'guard failed: {path}: expected at least {count} occurrences, found {found}: {old[:120]!r}')\n    text=text.replace(old,new,count if count is not None else -1)\n"""
if old not in t: raise SystemExit('repair helper guard source not found')
t=t.replace(old,new,1)
# Correct the generated worker source opener so the resulting JavaScript begins with a literal quote, not a backslash.
t=t.replace("worker=r'''\\\\'use strict\\\\';", "worker=r'''\\'use strict\\';")
p.write_text(t)
exec(compile(t,str(p),'exec'),{'__file__':str(p),'__name__':'__main__'})
