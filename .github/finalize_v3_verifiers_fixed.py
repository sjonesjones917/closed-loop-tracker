from pathlib import Path
import hashlib
import re

src=Path('.github/finalize_v3_verifiers.py').read_text()
marker="\ndirect=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']"
if marker not in src:
    raise SystemExit('valid finalizer prefix marker missing')
prefix=src.split(marker,1)[0]+'\n'
exec(compile(prefix,'.github/finalize_v3_verifiers.py:valid-prefix','exec'),globals(),globals())

# Prompt-engine identity must prove the current materialized prompt contract, not an obsolete literal.
p=Path('verify-prompt-semantics.mjs')
s=p.read_text()
old="if(prompts.version!=='closed-loop-prompt-engine/26')throw new Error('Persisted Stage 04 prompts were not invalidated after the canonical-input reuse repair.');"
new="if(prompts.version!=='closed-loop-prompt-engine/29')throw new Error('Persisted Stage 04 prompts were not invalidated after the current exhaustive-intake/canonical-input repair.');"
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('prompt-engine invalidation verifier anchor missing')
p.write_text(s)

direct=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
graph=direct+['test-worker.js']
rows=[]
for name in graph:
    data=Path(name).read_bytes()
    blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
    rows.append(f'{name}:{blob}\n')
identity='runtime-'+hashlib.sha256(''.join(rows).encode()).hexdigest()[:16]
p=Path('index.html')
html=p.read_text()
for name in direct:
    pattern=rf'(<script\s+defer\s+src="{re.escape(name)})(?:\?v=runtime-[0-9a-f]+)?("\s*></script>)'
    html,n=re.subn(pattern,rf'\1?v={identity}\2',html,count=1)
    if n!=1:
        raise SystemExit(f'Runtime script tag missing for {name}')
p.write_text(html)
print(identity)
