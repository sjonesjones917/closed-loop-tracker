from pathlib import Path

p=Path('app-core.js')
text=p.read_text()
old="artifacts:'artifacts',reviews:'reviews',history:'history'};"
new="artifacts:'artifacts',reviews:'reviews'};"
if text.count(old)!=1:
    raise SystemExit(f'expected one legacy active-history mapping, found {text.count(old)}')
p.write_text(text.replace(old,new,1))
