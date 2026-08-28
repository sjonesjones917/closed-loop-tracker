from pathlib import Path
import hashlib
import re

runtime_files = [
    'workbook.js',
    'hash.js',
    'workflow-schema.js',
    'workflow-engine.js',
    'prompt-engine.js',
    'response-ingestion.js',
    'project-store.js',
    'app-core.js',
]

def git_blob_sha(path: str) -> str:
    data = Path(path).read_bytes()
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

manifest = ''.join(f'{path}:{git_blob_sha(path)}\n' for path in runtime_files).encode()
identity = 'runtime-' + hashlib.sha256(manifest).hexdigest()[:16]
html_path = Path('index.html')
html = html_path.read_text()
for runtime_file in runtime_files:
    html = re.sub(re.escape(runtime_file) + r'(?:\?v=runtime-[a-f0-9]+)?', f'{runtime_file}?v={identity}', html)
html_path.write_text(html)
print(identity)
