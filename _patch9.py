from pathlib import Path
p=Path('app-core.js');s=p.read_text();s=s.replace("new Worker('test-worker.js?v=runtime-5859ee5a07f239ae')","new Worker(`test-worker.js?v=${encodeURIComponent(globalThis.CLOSED_LOOP_BUILD_IDENTITY||'')}`)").replace("new Worker('test-worker.js?v=runtime-b288410245b5dcfd')","new Worker(`test-worker.js?v=${encodeURIComponent(globalThis.CLOSED_LOOP_BUILD_IDENTITY||'')}`)");p.write_text(s)
p=Path('test-worker.js');s=p.read_text();s=s.replace("importScripts('test-runtime.js?v=runtime-5859ee5a07f239ae');","const BUILD_IDENTITY=new URL(self.location.href).searchParams.get('v')||'';\nimportScripts(`test-runtime.js?v=${encodeURIComponent(BUILD_IDENTITY)}`);").replace("importScripts('test-runtime.js?v=runtime-b288410245b5dcfd');","const BUILD_IDENTITY=new URL(self.location.href).searchParams.get('v')||'';\nimportScripts(`test-runtime.js?v=${encodeURIComponent(BUILD_IDENTITY)}`);");p.write_text(s)
p=Path('verify-hash.mjs');s=p.read_text().replace("'workflow-schema.js','workflow-engine.js'","'workflow-schema.js','test-runtime.js','workflow-engine.js'");p.write_text(s)
# token is computed from the nine runtime files after removing runtime-token literals from runtime source
import hashlib
files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];manifest=''
for f in files:
 b=Path(f).read_bytes();manifest+=f+':'+hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()+'\n'
token='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
p=Path('index.html');s=p.read_text();import re;s=re.sub(r'runtime-[0-9a-f]{16}',token,s);anchor='<script defer src="workbook.js?v='+token+'"></script>';s=s.replace(anchor,'<script>globalThis.CLOSED_LOOP_BUILD_IDENTITY="'+token+'";</script>\n'+anchor);p.write_text(s)
print(token)