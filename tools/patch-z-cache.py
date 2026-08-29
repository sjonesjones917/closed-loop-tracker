from pathlib import Path
import hashlib,re
files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def blob_sha(path):
 b=Path(path).read_bytes(); return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
manifest=''.join(f'{f}:{blob_sha(f)}\n' for f in files).encode()
token='runtime-'+hashlib.sha256(manifest).hexdigest()[:16]
p=Path('index.html'); s=p.read_text(); s,n=re.subn(r'(?<=\?v=)runtime-[a-f0-9]{16}',token,s)
if n!=len(files): raise SystemExit(f'expected {len(files)} runtime tokens, found {n}')
p.write_text(s)
print('runtime cache identity',token)
