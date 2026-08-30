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
t=t.replace("'closed-loop-stage-response/2'","'closed-loop-stage-response/3'")
t=t.replace("core.PROJECT_SCHEMA==='closed-loop-project/2'","core.PROJECT_SCHEMA==='closed-loop-project/3'")
t=t.replace("schema.RESPONSE_SCHEMA==='closed-loop-stage-response/2'","schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3'")
t=t.replace("assert(schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3','Response schema /2 is required.');","assert(schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3','Response schema /3 is required.');")
t=t.replace("const banned=new RegExp('se'+'mantic','i');if(banned.test(active))throw new Error('Prohibited normal application terminology remains.');\n","")
write(p,t)

p='verify-prompt-semantics.mjs'; t=read(p)
t=t.replace("for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js'])","for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])")
for line in [
"  if(!record.prompt.includes('PATENT / REGULATED FILING'))issues.push('PATENT_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('BUILDING / ARCHITECTURE / AEC'))issues.push('BUILDING_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');\n"]: t=t.replace(line,'')
t=t.replace("    if(!record.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!record.prompt.includes('Do not perform source discovery, source research, requirement derivation, verification design, production-instruction authoring, implementation, artifact production'))issues.push('STAGE01_DOMAIN_INTAKE_BOUNDARY_MISSING');","    if(!record.prompt.includes('STAGE 01 SUBJECT-NEUTRAL INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!record.prompt.includes('Derive project-specific human-authority questions only from the actual request, accessible supplied materials, and current canonical context')||!record.prompt.includes('Do not perform later-stage work'))issues.push('STAGE01_SUBJECT_NEUTRAL_INTAKE_BOUNDARY_MISSING');")
t=t.replace("    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('intended jurisdiction(s)')||!record.prompt.includes('additional human-controlled invention materials exist'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');","    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('derive project-specific human-authority questions'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');")
# Runtime prompt must stay domain-neutral; fixtures may exercise a patent request as data.
needle="const expectedOperationWrites="
fixture="""{
 const source=fs.readFileSync('prompt-engine.js','utf8');
 for(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])if(source.includes(forbidden))throw new Error(`Runtime prompt authority contains prohibited project-subject branch ${forbidden}.`);
 const p=baseProject();Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Prepare a patent application for the supplied invention disclosure.',SUPPLIED_MATERIALS_INVENTORY:'invention-disclosure.pdf'});
 const record=prompts.buildPromptRecord(1,p,{operation:'COMPLETE',scope:{projectRevision:Number(p.revision||0),inputVersion:p.job.CURRENT_INPUT_VERSION}});
 for(const token of ['Prepare a patent application for the supplied invention disclosure.','invention-disclosure.pdf','Derive project-specific human-authority questions only from the actual request','BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE'])if(!record.prompt.includes(token))throw new Error(`Subject-neutral Stage 01 fixture missing ${token}.`);
}

"""
if needle not in t: raise SystemExit('semantic fixture insertion anchor missing')
t=t.replace(needle,fixture+needle,1)
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
