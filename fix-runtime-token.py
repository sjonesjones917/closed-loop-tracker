from pathlib import Path
import hashlib
import re

runtime_files = [
    'workbook.js',
    'hash.js',
    'workflow-schema.js',
    'test-runtime.js',
    'workflow-engine.js',
    'prompt-engine.js',
    'response-ingestion.js',
    'project-store.js',
    'app-core.js',
]

def git_blob_sha(path: str) -> str:
    data = Path(path).read_bytes()
    header = f'blob {len(data)}\0'.encode()
    return hashlib.sha1(header + data).hexdigest()

manifest = ''.join(f'{path}:{git_blob_sha(path)}\n' for path in runtime_files).encode()
token = 'runtime-' + hashlib.sha256(manifest).hexdigest()[:16]

p = Path('index.html')
text = p.read_text()
for path in runtime_files:
    pattern = rf'(<script\s+defer\s+src="{re.escape(path)})(?:\?v=[^"]+)?("\s*></script>)'
    text, count = re.subn(pattern, rf'\1?v={token}\2', text, count=1)
    if count != 1:
        raise SystemExit(f'Could not set shared runtime token for {path}.')
p.write_text(text)

# The worker inherits the exact query string from test-runtime.js at runtime,
# avoiding any circular hard-coded token inside a hashed runtime file.
runtime = Path('test-runtime.js').read_text()
required = "if(source)url.search=new URL(source).search"
if required not in runtime:
    raise SystemExit('test-worker.js is not inheriting the test-runtime.js build identity.')

print(token)
