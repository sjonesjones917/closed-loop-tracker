from pathlib import Path
p=Path('controller3-repair.py')
s=p.read_text()
old="import {webcrypto} from 'node:crypto';\nglobalThis.crypto=webcrypto;"
new="import {webcrypto} from 'node:crypto';\nif(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});"
if old not in s: raise SystemExit('crypto verifier anchor missing')
s=s.replace(old,new,1)
old2="const cap={id:'CAPABILITY-TEST',active:true,scope:{},fields:{CAPABILITY_ID:'CAPABILITY-TEST'"
new2="const cap={id:'CAPABILITY-TEST',active:true,scope:{inputVersion:p.job.CURRENT_INPUT_VERSION},fields:{CAPABILITY_ID:'CAPABILITY-TEST'"
if old2 not in s: raise SystemExit('capability scope fixture anchor missing')
s=s.replace(old2,new2,1)
p.write_text(s)
