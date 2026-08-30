from pathlib import Path
import hashlib,re
files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','test-worker.js']
manifest=''
for name in files:
    data=Path(name).read_bytes()
    blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
    manifest+=f'{name}:{blob}\n'
token='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
p=Path('index.html');s=p.read_text();s,count=re.subn(r'v=runtime-[A-Za-z0-9-]+',f'v={token}',s)
if count!=9: raise SystemExit(f'Expected 9 main-thread runtime cache tokens, found {count}.')
p.write_text(s)
print(token)
