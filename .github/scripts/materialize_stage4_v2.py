from pathlib import Path
import hashlib
import re
import subprocess

REPAIR_SHA='c62c21dfa89011a3ac24c71f107adf92cf2319c7'
REPAIR_BRANCH='fix/stage4-canonical-obligation-accounting'
WORKFLOW_PATH=Path('.github/workflows/materialize-stage4-v2.yml')
SELF_PATH=Path('.github/scripts/materialize_stage4_v2.py')


def run(*args, capture=False):
    return subprocess.run(args, check=True, text=False, stdout=subprocess.PIPE if capture else None).stdout if capture else None

def text(path):
    return Path(path).read_text()

def write(path, data):
    Path(path).write_text(data)

def replace_once(path, old, new):
    data=text(path)
    if old not in data:
        raise SystemExit(f'missing expected text in {path}: {old[:180]!r}')
    write(path, data.replace(old, new, 1))

def regex_once(path, pattern, replacement, flags=0):
    data=text(path)
    out,n=re.subn(pattern,replacement,data,count=1,flags=flags)
    if n!=1:
        raise SystemExit(f'expected one match in {path}, got {n}: {pattern}')
    write(path,out)

# Reuse the already-tested current-accounting implementation only for files that
# have not changed on main since the common base. Keep current-main UI/prompt/hash files.
run('git','fetch','origin',f'{REPAIR_BRANCH}:refs/remotes/origin/{REPAIR_BRANCH}')
copy_files=[
    'workflow-schema.js','workflow-engine.js','response-ingestion.js','workbook.js',
    'build-test-project.mjs','verify-full-cycle.mjs','verify-ingestion.mjs',
    'verify-one-time-intent-intake.mjs','verify-test-runtime.mjs'
]
for path in copy_files:
    content=run('git','show',f'{REPAIR_SHA}:{path}',capture=True)
    Path(path).write_bytes(content)

# Build the stronger accounting prompt on top of current prompt-engine /26.
prompt=Path('prompt-engine.js')
data=prompt.read_text()
if "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/26';" not in data:
    raise SystemExit('current-main prompt engine is not /26; refusing to overwrite a moving prompt contract')
data=data.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/26';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/27';",1)

stage4="4:'Compile the requirement specification from the complete APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST included in this controlling prompt. The application has already selected and identity-bound the current User Job Input, accepted Stage 01 job definition, human/material captures, accepted Stage 03 source research, and candidate external-source obligations. Do not rediscover the input universe and never ask the human to attach, resend, retype, summarize, reopen, or otherwise provide the original intent file again. For every OBLIGATION_ID return exactly one obligationDispositions record with DISPOSITION = REQUIREMENT, RETAINED_CONTEXT, INAPPLICABLE, or BLOCKED and a substantive reason. Every requirement record must contain OBLIGATION_IDS with one or more exact manifest identities. Every obligation marked REQUIREMENT must map to at least one atomic requirement. Multiple materially equivalent obligations may map to one requirement only when no distinction is lost; one obligation may map to multiple requirements when atomization requires it. A non-requirement disposition must not be mapped to a requirement. Preserve independent traceability for every original obligation identity. If canonical context is actually missing, return BLOCKED with MISSING_APPLICATION_CONTEXT and identify the responsible earlier stage; do not turn an application capture defect into another user upload request. The application assigns requirement IDs, disposition IDs, versions, hashes, counts, current scope, and closure.',"
data,n=re.subn(r"4:'Compile atomic requirement proposals only from the complete current canonical input union selected by the application:.*?Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior\.',",stage4,data,count=1,flags=re.S)
if n!=1:
    raise SystemExit('current-main Stage 04 procedure did not match expected /26 text')

old_rule="${stage===1?'- For HUMAN_INPUT_REQUIRED, every humanInputRequests item must contain exactly: temporaryKey, question, whyRequired, affectedStageFields, affectedRecords, answerType, allowedValues, blocking. Use a unique temporaryKey; use [] for affected arrays when none; use [] for allowedValues except CHOICE/MULTI_CHOICE; set blocking to true for a question that prevents Stage 01 completion. Do not invent requestKey, required, whyNeeded, expectedAnswer, or other undeclared question properties.\\n':''}- Never assign canonical application IDs"
new_rule="${stage===1?'- For HUMAN_INPUT_REQUIRED, every humanInputRequests item must contain exactly: temporaryKey, question, whyRequired, affectedStageFields, affectedRecords, answerType, allowedValues, blocking. Use a unique temporaryKey; use [] for affected arrays when none; use [] for allowedValues except CHOICE/MULTI_CHOICE; set blocking to true for a question that prevents Stage 01 completion. Do not invent requestKey, required, whyNeeded, expectedAnswer, or other undeclared question properties.\\n- For DATA_PROPOSAL, records.intentStatements must account for every INPUT-UNIT identity in the APPLICATION-OWNED INTAKE COVERAGE MANIFEST below. SOURCE_MATERIAL must equal the exact INPUT-UNIT ID. Split compound available material into as many statement records as needed and preserve exact statement text/location; do not collapse meaning-bearing content.\\n':''}- Never assign canonical application IDs"
if old_rule not in data:
    raise SystemExit('Stage 01 response rule anchor missing')
data=data.replace(old_rule,new_rule,1)

old_stage_rules="${stage===2?'- Stage 02 may contain only genuinely independent external sources appropriate to the job: governing/controlling authority where it exists, otherwise reputable direct evidence. Target-product and repository artifacts are implementation evidence, not independent external authority.\\n':''}${stage===3?'- Stage 03 may research only the accepted Stage 02 independent external source set.\\n':''}${stage===4?'- Stage 04 consumes the application-selected canonical input union. Do not ask the human to attach or resend the original intent file. Missing canonical prior-stage content is an earlier-stage defect, not a new file-transfer request.\\n':''}- Before substantive work"
new_stage_rules="${stage===2?'- Stage 02 may contain only genuinely independent external sources appropriate to the job: governing/controlling authority where it exists, otherwise reputable direct evidence. Target-product and repository artifacts are implementation evidence, not independent external authority.\\n':''}${stage===3?'- Stage 03 may research only the accepted Stage 02 independent external source set. It does not compile human-origin intent and must not request the original Stage 01 intent material.\\n':''}${stage===4?'- Stage 04 consumes the complete application-owned obligation manifest below. Every OBLIGATION_ID requires exactly one disposition; every requirement requires exact OBLIGATION_IDS. Do not ask the human to attach, resend, retype, summarize, reopen, or otherwise provide the original intent file again. Missing canonical prior-stage content is an earlier-stage defect, not a new file-transfer request.\\n':''}- Before substantive work"
if old_stage_rules not in data:
    raise SystemExit('stage-specific response rules anchor missing')
data=data.replace(old_stage_rules,new_stage_rules,1)

manifest_block="""${stage===1?`APPLICATION-OWNED INTAKE COVERAGE MANIFEST — EVERY CONTROLLED INPUT UNIT MUST BE ACCOUNTED FOR\n${JSON.stringify(workflow.intakeCoverageManifest(state),null,2)}\n\n`:''}${stage===4?`APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST — CLOSED ACCOUNTING REQUIRED\n${JSON.stringify(workflow.obligationManifest(state),null,2)}\n\n`:''}RECORD PROVENANCE — REQUIRED FOR EVERY PROPOSED AGENT RECORD"""
anchor='RECORD PROVENANCE — REQUIRED FOR EVERY PROPOSED AGENT RECORD'
if anchor not in data:
    raise SystemExit('prompt manifest insertion anchor missing')
data=data.replace(anchor,manifest_block,1)

old_context="const opContract=schema.operationContract(stage,operation);const scope=assertRequiredPromptScope(stage,operation,scopeFor(stage,state,options.scope||{})),feedback=recoveryFeedback(state,stage,operation,scope),batchPlan=verificationBatchPlan(stage,state,operation,scope),rawHandoff=workflow.executionHandoff(state,{stage,operation,testIds:batchPlan?.triples?.map(item=>item.testId),runIds:batchPlan?.triples?.map(item=>item.runId)}),handoff=stage===4?{...rawHandoff,send:[]}:rawHandoff,promptHandoff={send:handoff.send,withhold:handoff.withhold,expectBack:handoff.expectBack},contextManifest={stage,operation,scope,verificationBatchPlan:batchPlan,executionHandoff:promptHandoff,readCollections:"
new_context="const opContract=schema.operationContract(stage,operation);const scope=assertRequiredPromptScope(stage,operation,scopeFor(stage,state,options.scope||{})),feedback=recoveryFeedback(state,stage,operation,scope),batchPlan=verificationBatchPlan(stage,state,operation,scope),rawHandoff=workflow.executionHandoff(state,{stage,operation,testIds:batchPlan?.triples?.map(item=>item.testId),runIds:batchPlan?.triples?.map(item=>item.runId)}),handoff=stage===4?{...rawHandoff,send:[]}:rawHandoff,promptHandoff={send:handoff.send,withhold:handoff.withhold,expectBack:handoff.expectBack},intakeCoverage=stage===1?workflow.intakeCoverageManifest(state):null,stage04Obligations=stage===4?workflow.obligationManifest(state):null,contextManifest={stage,operation,scope,verificationBatchPlan:batchPlan,executionHandoff:promptHandoff,intakeCoverageManifest:intakeCoverage,obligationManifest:stage04Obligations,readCollections:"
if old_context not in data:
    raise SystemExit('prompt context-manifest anchor missing')
data=data.replace(old_context,new_context,1)
prompt.write_text(data)

# Extend current-main prompt semantic verification instead of replacing it with the older branch file.
vp=Path('verify-prompt-semantics.mjs')
vdata=vp.read_text()
stage1_anchor="""    if(!record.prompt.includes('do not require the human to know those formats in advance')||!record.prompt.includes('absence of a downstream authoring, viewing, compiling, importing, simulation, manufacturing, filing, deployment, or other consuming system is not by itself a reason to downgrade an artifact to prose')||!record.prompt.includes('Only propose an implementation-ready'))issues.push('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING');
  }
"""
stage1_repl="""    if(!record.prompt.includes('do not require the human to know those formats in advance')||!record.prompt.includes('absence of a downstream authoring, viewing, compiling, importing, simulation, manufacturing, filing, deployment, or other consuming system is not by itself a reason to downgrade an artifact to prose')||!record.prompt.includes('Only propose an implementation-ready'))issues.push('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING');
    if(!record.prompt.includes('APPLICATION-OWNED INTAKE COVERAGE MANIFEST')||!record.prompt.includes('INPUT-UNIT-')||!record.prompt.includes('records.intentStatements'))issues.push('STAGE01_APPLICATION_ACCOUNTING_MANIFEST_MISSING');
  }
  if(record.stage===3&&record.contextManifest.readCollections?.intentStatements)issues.push('STAGE03_HUMAN_INTENT_RESEARCH_LEAK');
  if(record.stage===4){
    if(!record.prompt.includes('APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST')||!record.prompt.includes('obligationDispositions')||!record.prompt.includes('OBLIGATION_IDS'))issues.push('STAGE04_APPLICATION_OBLIGATION_MANIFEST_MISSING');
    if(!record.prompt.includes('never ask the human to attach, resend, retype, summarize, reopen, or otherwise provide the original intent file again'))issues.push('STAGE04_REPEAT_INTENT_REQUEST_NOT_PROHIBITED');
  }
"""
if stage1_anchor not in vdata:
    raise SystemExit('verify-prompt-semantics Stage 01 anchor missing')
vdata=vdata.replace(stage1_anchor,stage1_repl,1)
contract_anchor="""{
 const test=schema.RECORD_SCHEMAS.tests;
"""
contract_repl="""{
 if(!schema.STAGE_CONTRACTS[1].agentWritableCollections.includes('intentStatements'))throw new Error('Stage 01 cannot persist semantic intent capture.');
 if(schema.STAGE_CONTRACTS[3].readCollections.includes('intentStatements'))throw new Error('Stage 03 must remain external-source-only.');
 if(!schema.STAGE_CONTRACTS[4].agentWritableCollections.includes('obligationDispositions'))throw new Error('Stage 04 cannot close its application-owned obligation manifest.');
 const req=schema.RECORD_SCHEMAS.requirements;
 if(req.fieldDefinitions.OBLIGATION_IDS?.valueType!=='STRING_ARRAY'||!req.required.includes('OBLIGATION_IDS'))throw new Error('Stage 04 requirements lack typed exact obligation traces.');
 const test=schema.RECORD_SCHEMAS.tests;
"""
if contract_anchor not in vdata:
    raise SystemExit('verify-prompt-semantics schema assertion anchor missing')
vdata=vdata.replace(contract_anchor,contract_repl,1)
vp.write_text(vdata)

# Keep the current visual baseline and make the Stage 04 record visible through the existing generic accepted-record renderer.
# No app-core rewrite is necessary; repeat-input prevention is canonical data flow, exactly as current verify-hash requires.

# Run the permanent new regression in CI and syntax-check it.
pages=Path('.github/workflows/pages.yml')
pdata=pages.read_text()
if 'node --check verify-one-time-intent-intake.mjs' not in pdata:
    pdata=pdata.replace('          node --check verify-test-runtime.mjs\n','          node --check verify-test-runtime.mjs\n          node --check verify-one-time-intent-intake.mjs\n',1)
if 'node verify-one-time-intent-intake.mjs' not in pdata:
    pdata=pdata.replace('          node verify-ingestion.mjs\n          node verify-complete.mjs\n','          node verify-ingestion.mjs\n          node verify-one-time-intent-intake.mjs\n          node verify-complete.mjs\n',1)
pages.write_text(pdata)

# Runtime cache identity is derived from the exact final runtime bytes, matching verify-hash.mjs.
runtime_files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
manifest=''
for file in runtime_files:
    b=Path(file).read_bytes()
    blob=hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
    manifest+=f'{file}:{blob}\n'
build='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
html=Path('index.html')
hdata=html.read_text()
hdata,n=re.subn(r'(?<=\\?v=)[A-Za-z0-9._-]+',build,hdata)
if n!=len(runtime_files):
    raise SystemExit(f'expected {len(runtime_files)} runtime cache tokens, changed {n}')
html.write_text(hdata)

# Temporary materialization infrastructure must not survive the final commit.
SELF_PATH.unlink(missing_ok=True)
WORKFLOW_PATH.unlink(missing_ok=True)
