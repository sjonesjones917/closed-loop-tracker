from pathlib import Path
import hashlib,re
runtime_files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob_sha(path):
    data=Path(path).read_bytes()
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
manifest=''.join(f'{name}:{git_blob_sha(name)}\n' for name in runtime_files).encode()
identity='runtime-'+hashlib.sha256(manifest).hexdigest()[:16]
p=Path('index.html'); text=p.read_text()
for name in runtime_files:
    pattern=rf'(<script\s+defer\s+src="{re.escape(name)}\?v=)[^"]+("\s*></script>)'
    text,count=re.subn(pattern,rf'\g<1>{identity}\g<2>',text,count=1)
    if count!=1: raise SystemExit(f'Could not update cache token for {name}')
p.write_text(text)
print(identity)
