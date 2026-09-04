from pathlib import Path
p=Path('controller3-repair.py')
s=p.read_text()
old="import {webcrypto} from 'node:crypto';\nglobalThis.crypto=webcrypto;"
new="import {webcrypto} from 'node:crypto';\nif(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});"
if old not in s: raise SystemExit('crypto verifier anchor missing')
p.write_text(s.replace(old,new,1))
