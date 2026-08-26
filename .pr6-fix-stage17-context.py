from pathlib import Path
p=Path('verify-full-cycle.mjs')
s=p.read_text()
old="TEN_NEW_CONTEXTS_CREATED:'YES',"
assert old in s
p.write_text(s.replace(old,'',1))
