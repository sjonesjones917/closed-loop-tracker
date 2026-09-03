from pathlib import Path
p=Path('verify-complete.mjs')
text=p.read_text(encoding='utf-8')
old="import fs from 'node:fs';\nimport vm from 'node:vm';\n"
new="import fs from 'node:fs';\nimport vm from 'node:vm';\nimport {execFileSync} from 'node:child_process';\n\nexecFileSync(process.execPath,['verify-stage01-disposition-contract.mjs'],{stdio:'inherit'});\n"
if text.count(old)!=1: raise SystemExit('verify-complete import anchor mismatch')
p.write_text(text.replace(old,new,1),encoding='utf-8',newline='\n')
