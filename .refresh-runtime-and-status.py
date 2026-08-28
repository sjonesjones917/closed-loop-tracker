from pathlib import Path
import hashlib
import re

runtime_files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob_sha(path):
    data=Path(path).read_bytes()
    return hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()
manifest=''.join(f'{name}:{git_blob_sha(name)}\n' for name in runtime_files)
token='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]

html_path=Path('index.html')
html=html_path.read_text()
for name in runtime_files:
    pattern=rf'(<script\s+defer\s+src="{re.escape(name)}\?v=)runtime-[0-9a-f]+("\s*></script>)'
    html,count=re.subn(pattern,rf'\g<1>{token}\2',html,count=1)
    if count!=1:
        raise SystemExit(f'Expected exactly one runtime script token for {name}; found {count}')
html_path.write_text(html)

pages_path=Path('.github/workflows/pages.yml')
pages=pages_path.read_text()
old="DESCRIPTION='Source, semantic false-acceptance invariant, continuous 30-stage lifecycle, prompt semantics, persistence, browser workflow, and deployed-byte verification passed'"
new="DESCRIPTION='Semantic invariants, 30-stage lifecycle, prompts, persistence, browser, and deployed-byte verification passed'"
if pages.count(old)!=1:
    raise SystemExit(f'Expected one overlong success description, found {pages.count(old)}')
pages=pages.replace(old,new,1)
pages_path.write_text(pages)
if len(new.split("DESCRIPTION='",1)[1][:-1])>140:
    raise SystemExit('GitHub status description still exceeds 140 characters')

print(token)
