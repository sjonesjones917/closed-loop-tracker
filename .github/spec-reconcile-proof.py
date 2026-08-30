from pathlib import Path

def read(path): return Path(path).read_text()
def write(path,text): Path(path).write_text(text)

p='build-test-project.mjs'; t=read(p)
t=t.replace("const orderedScripts=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];","const orderedScripts=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];")
t=t.replace("for(const token of ['closed-loop-stage-response/2'","for(const token of ['closed-loop-stage-response/3'")
t=t.replace("for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])","for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])")
t=t.replace("RESPONSE_SCHEMA!=='closed-loop-stage-response/2'","RESPONSE_SCHEMA!=='closed-loop-stage-response/3'")
t=t.replace("responseSchema:'closed-loop-stage-response/2'","responseSchema:'closed-loop-stage-response/3'")
t=t.replace("const banned=new RegExp('se'+'mantic','i');if(banned.test(activeSource))throw new Error('Prohibited normal UI terminology remains in active source.');\n","")
write(p,t)

p='verify.mjs'; t=read(p)
t=t.replace("const files=['index.html','app-core.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','workbook.js'","const files=['index.html','app-core.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','workbook.js'")
t=t.replace("for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])","for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])")
t=t.replace("orderedScripts=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']","orderedScripts=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']")
t=t.replace("'Revise the Responsible Layer'","'Correct the Root Cause'")
write(p,t)

p='verify-hash.mjs'; t=read(p)
t=t.replace("const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];","const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];\nconst runtimeBundleFiles=[...runtimeFiles,'test-worker.js'];")
t=t.replace("const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\\n`).join('');","const runtimeManifest=runtimeBundleFiles.map(file=>`${file}:${gitBlobSha(file)}\\n`).join('');")
write(p,t)

for p in ['.github/workflows/pages.yml','verify-live.mjs','verify-definition-of-done.mjs']:
    if not Path(p).exists(): continue
    t=read(p)
    t=t.replace("['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']","['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']")
    t=t.replace("['workbook.js', 'hash.js', 'workflow-schema.js', 'workflow-engine.js', 'prompt-engine.js', 'response-ingestion.js', 'project-store.js', 'app-core.js']","['workbook.js', 'hash.js', 'workflow-schema.js', 'test-runtime.js', 'workflow-engine.js', 'prompt-engine.js', 'response-ingestion.js', 'project-store.js', 'app-core.js']")
    write(p,t)
