from pathlib import Path
p=Path('verify-zero-loss-final.mjs')
text=p.read_text()
needle="import fs from 'node:fs';\nimport vm from 'node:vm';\n"
replacement="import fs from 'node:fs';\nimport vm from 'node:vm';\nglobalThis.Event ??= class Event { constructor(type){ this.type=type; } };\nglobalThis.dispatchEvent ??= (()=>true);\n"
if needle not in text: raise SystemExit('test polyfill target missing')
p.write_text(text.replace(needle,replacement,1))
