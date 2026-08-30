from pathlib import Path
import hashlib,re
files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def blob(file):
    b=Path(file).read_bytes()
    return hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
manifest=''.join(f'{f}:{blob(f)}\n' for f in files)
runtime='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
html=Path('index.html').read_text()
html=re.sub(r'(<script\s+defer\s+src="(?:workbook|hash|workflow-schema|test-runtime|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)runtime-[a-f0-9]{16}("\s*></script>)',lambda m:m.group(1)+runtime+m.group(2),html)
Path('index.html').write_text(html)
print(runtime)
