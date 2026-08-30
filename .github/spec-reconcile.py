from pathlib import Path
import re, hashlib, json

def read(path): return Path(path).read_text()
def write(path,text): Path(path).write_text(text)
def once(text,old,new,label):
    n=text.count(old)
    if n!=1: raise SystemExit(f'{label}: expected one anchor, found {n}')
    return text.replace(old,new,1)

index_before=read('index.html')
style_before=re.search(r'<style>(.*?)</style>',index_before,re.S).group(1)

# Project identity and visible Stage 16 wording.
p='workbook.js'; s=read(p)
s=once(s,"const PROJECT_SCHEMA='closed-loop-project/2';","const PROJECT_SCHEMA='closed-loop-project/3';",'project schema')
s=once(s,"'REVISE THE RESPONSIBLE LAYER'","'CORRECT THE ROOT CAUSE'",'Stage 16 label')
write(p,s)

# Response /3 and exact Job ownership partitions.
p='workflow-schema.js'; s=read(p)
s=once(s,"const RESPONSE_SCHEMA='closed-loop-stage-response/2';","const RESPONSE_SCHEMA='closed-loop-stage-response/3';",'response schema')
old="const HUMAN_JOB_FIELDS=Object.freeze([\n  'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',\n  'REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','DESIRED_SOURCE_COUNT','KNOWN_AUTHORITATIVE_SOURCES',\n  'AVAILABLE_TOOLS','PROHIBITED_ACTIONS','EXPLICIT_USER_REQUIREMENTS'\n]);"
new="const HUMAN_JOB_FIELDS=Object.freeze([\n  'EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',\n  'REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','DESIRED_SOURCE_COUNT','KNOWN_AUTHORITATIVE_SOURCES',\n  'AVAILABLE_TOOLS','PROHIBITED_ACTIONS','EXPLICIT_USER_REQUIREMENTS'\n]);\nconst HUMAN_DECISION_JOB_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER']);"
s=once(s,old,new,'job ownership arrays')
old="function jobFieldDefinition(name){\n  if(APPLICATION_JOB_FIELDS.includes(name))return field(name,PRODUCER.APPLICATION,{derivation:`Application derives ${name} from canonical project state.`});\n  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});"
new="function jobFieldDefinition(name){\n  if(APPLICATION_JOB_FIELDS.includes(name))return field(name,PRODUCER.APPLICATION,{derivation:`Application derives ${name} from canonical project state.`});\n  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{requiredAtStage:null,provenanceRequired:false,valueType:'STRING',nullable:true});\n  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});"
s=once(s,old,new,'job producer dispatch')
s=once(s,"const JOB_FIELDS=Object.freeze(Object.fromEntries([...new Set([...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])].map(name=>[name,jobFieldDefinition(name)])));","const JOB_FIELDS=Object.freeze(Object.fromEntries([...new Set([...HUMAN_JOB_FIELDS,...HUMAN_DECISION_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])].map(name=>[name,jobFieldDefinition(name)])));",'job complete field set')
s=s.replace('CUSTOM_PIPELINE','TEST_IR')
write(p,s)

# Canonical Test IR naming everywhere current behavior refers to it.
for p in ['prompt-engine.js','workflow-engine.js','response-ingestion.js','test-runtime.js','verify-test-runtime.mjs','verify-complete.mjs','verify-prompt-semantics.mjs','verify-definition-of-done.mjs','verify-full-cycle.mjs','verify.mjs']:
    if Path(p).exists(): write(p,read(p).replace('CUSTOM_PIPELINE','TEST_IR'))

# Subject-neutral prompt authority; no project-subject branches or embedded patent fixture.
p='prompt-engine.js'; s=read(p)
s=s.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/26';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/27';")
start=s.find("${stage===1?`STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY")
end=s.find("${stage===1?`STAGE 01 CLARIFICATION EXPERIENCE",start)
if start<0 or end<0: raise SystemExit('domain prompt block not found')
generic="${stage===1?`STAGE 01 SUBJECT-NEUTRAL INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY\nDerive project-specific human-authority questions only from the actual request, accessible supplied materials, and current canonical context. Ask only genuinely human-only facts or decisions. The application runtime must not encode a project subject, profession, industry, jurisdiction, artifact family, or toolchain. Do not perform later-stage work.\n`:`SUBJECT-NEUTRAL STAGE ADAPTATION\nDerive domain semantics only from the accepted project request, current canonical records, supplied evidence, and this stage contract. Do not use hard-coded project-subject branches or catalogues. Do not force irrelevant fields.\n`}\n\n"
s=s[:start]+generic+s[end:]
ps=s.find('For PATENT / REGULATED FILING jobs,')
if ps>=0:
    pe=s.find('Before Stage 01 submission verify:',ps)
    if pe<0: raise SystemExit('patent runtime fixture terminator not found')
    s=s[:ps]+s[pe:]
# Put the action before data so the prompt tells the executor what to do before showing context.
marker='AUTHORIZED BOUNDED CONTEXT FOR THIS STAGE\n${contextFor(stage,state,operation,scope)}'
if marker not in s: raise SystemExit('bounded context marker not found')
s=s.replace(marker,'STAGE-SPECIFIC TASK — DO THIS NOW\n${procedures[stage]}\n\n'+marker,1)
late="})()}STAGE-SPECIFIC TASK\n${procedures[stage]}\n\nPERMITTED AGENT-OWNED STAGE DATA"
if late not in s: raise SystemExit('late stage task anchor not found')
s=s.replace(late,"})()}PERMITTED AGENT-OWNED STAGE DATA",1)
write(p,s)

# Test IR exact primitive registry and central implementation limits. Existing semantics are preserved where valid.
p='test-runtime.js'; s=read(p)
ops_old="const OPS=Object.freeze([\n  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','SELECT_JSON_PATH',\n  'COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','BYTE_COMPARE',\n  'ASSERT_EXISTS','ASSERT_TYPE','ASSERT_EQ','ASSERT_NE','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE',\n  'ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL'\n]);"
ops_new="const OPS=Object.freeze([\n  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML',\n  'COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE',\n  'ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'\n]);"
s=once(s,ops_old,ops_new,'Test IR operations')
s=once(s,"const LIMITS=Object.freeze({maxSteps:64,maxTextBytes:16*1024*1024,maxCollectionItems:100000,maxRegexLength:2000,maxCsvCells:250000});","const LIMITS=Object.freeze({maxInputBytes:16*1024*1024,maxDecompressedBytes:16*1024*1024,maxSteps:64,maxSelectorDepth:32,maxParsedDepth:64,maxCollectionItems:100000,maxRegexLength:2000,maxRegexInputLength:2*1024*1024,maxWorkerMs:5000,maxArchiveExpansionBytes:16*1024*1024,maxCsvCells:250000});",'resource limits')
s=s.replace('LIMITS.maxTextBytes','LIMITS.maxInputBytes')
# Remove undeclared assertion execution branches.
s=re.sub(r"\n\s*case 'ASSERT_EXISTS':.*?break;",'',s)
s=re.sub(r"\n\s*case 'ASSERT_TYPE':\{.*?break;\}",'',s)
s=re.sub(r"\n\s*case 'ASSERT_NE':.*?break;",'',s)
# Add explicit XML parser/selectors before comparable helper.
anchor='function comparable(value){return value instanceof Uint8Array?[...value]:value;}'
xml="""function parseXml(text){const source=String(text||'').trim();if(!source.startsWith('<')||!source.endsWith('>'))throw new Error('Malformed XML.');return {__closedLoopXml:source};}\nfunction selectXml(value,path){const text=String(path||'').trim();if(!/^\\/?[A-Za-z_][\\w.-]*(?:\\/[A-Za-z_][\\w.-]*)*$/.test(text))throw new Error('SELECT_XML supports only simple element-name paths.');const parts=text.replace(/^\\//,'').split('/');if(parts.length>LIMITS.maxSelectorDepth)throw new Error('XML selector exceeds deterministic runtime depth limit.');let segment=String(value?.__closedLoopXml||'');if(!segment)throw new Error('SELECT_XML requires parsed XML.');for(const name of parts){const match=segment.match(new RegExp(`<${name}(?:\\\\s[^>]*)?>([\\\\s\\\\S]*?)<\\\\/${name}>`));if(!match)throw new Error('XML selector does not exist: '+text);segment=match[1];}return segment.replace(/<[^>]+>/g,'').trim();}\n"""
if anchor not in s: raise SystemExit('XML insertion anchor not found')
s=s.replace(anchor,xml+anchor,1)
# Add execution cases.
s=s.replace("      case 'PARSE_CSV':value=parseCsv(String(value));break;\n      case 'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);break;","      case 'PARSE_CSV':value=parseCsv(String(value));break;\n      case 'PARSE_XML':value=parseXml(String(value));break;\n      case 'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);break;\n      case 'SELECT_XML':value=selectXml(value,step.path);break;",1)
write(p,s)

# Worker executes the runtime core loaded with the same cache identity; no UI-thread test execution in browser.
p='test-worker.js'; worker=read(p)
worker="'use strict';\nconst token=new URL(self.location.href).searchParams.get('v')||'';\nimportScripts('test-runtime.js'+(token?'?v='+encodeURIComponent(token):''));\nself.onmessage=async event=>{\n  const {requestId,spec,artifacts}=event.data||{};\n  try{const result=await self.closedLoopTestRuntime.execute({spec,artifacts});self.postMessage({requestId,result});}\n  catch(error){self.postMessage({requestId,result:{status:'EXECUTION_FAILED',determination:'UNDETERMINED',error:String(error?.message||error),runtimeVersion:self.closedLoopTestRuntime?.VERSION||'UNKNOWN'}});}\n};\n"
write(p,worker)

# Required runtime dependency order and explicit worker CSP. No CSS changes.
p='index.html'; s=read(p)
s=once(s,"object-src 'none'; base-uri 'none'","object-src 'none'; worker-src 'self'; base-uri 'none'",'worker CSP')
if 'test-runtime.js?v=' not in s:
    m=re.search(r'(<script defer src="workflow-schema\.js\?v=([^"]+)"></script>)',s)
    if not m: raise SystemExit('workflow-schema script tag not found')
    s=s.replace(m.group(1),m.group(1)+f'\n<script defer src="test-runtime.js?v={m.group(2)}"></script>',1)
write(p,s)

# Current acceptance references target /3; do not destroy explicit legacy source strings used for migration tests.
for p in ['README.md','verify.mjs','verify-complete.mjs','verify-definition-of-done.mjs','verify-full-cycle.mjs','verify-ingestion.mjs','verify-project-lifecycle.mjs','verify-browser.mjs','verify-browser-extra.mjs','.github/workflows/pages.yml']:
    if not Path(p).exists(): continue
    t=read(p)
    t=t.replace("RESPONSE_SCHEMA==='closed-loop-stage-response/2'","RESPONSE_SCHEMA==='closed-loop-stage-response/3'")
    t=t.replace("PROJECT_SCHEMA==='closed-loop-project/2'","PROJECT_SCHEMA==='closed-loop-project/3'")
    t=t.replace('"responseSchema": "closed-loop-stage-response/2"','"responseSchema": "closed-loop-stage-response/3"')
    write(p,t)

# Shared build identity includes all 9 main modules and the worker.
runtime_files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','test-worker.js']
manifest=''
for name in runtime_files:
    data=Path(name).read_bytes(); blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest(); manifest+=f'{name}:{blob}\n'
build='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
p='index.html'; s=read(p); s=re.sub(r'v=runtime-[A-Za-z0-9-]+',f'v={build}',s); write(p,s)

# Permanent regression against direct contradictions in the controlling specification.
audit="""import fs from 'node:fs';\nconst assert=(ok,msg)=>{if(!ok)throw new Error(msg)};\nconst read=p=>fs.readFileSync(p,'utf8');\nconst workbook=read('workbook.js'),schema=read('workflow-schema.js'),prompt=read('prompt-engine.js'),runtime=read('test-runtime.js'),worker=read('test-worker.js'),html=read('index.html');\nassert(workbook.includes(\"const PROJECT_SCHEMA='closed-loop-project/3';\"),'project schema must be /3');\nassert(schema.includes(\"const RESPONSE_SCHEMA='closed-loop-stage-response/3';\"),'response schema must be /3');\nassert(workbook.includes(\"'CORRECT THE ROOT CAUSE'\"),'Stage 16 visible label is wrong');\nfor(const bad of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])assert(!prompt.includes(bad),'prohibited project-subject prompt branch remains: '+bad);\nassert(!prompt.includes('CUSTOM_PIPELINE'),'CUSTOM_PIPELINE remains in prompt authority');\nassert(runtime.includes(\"'TEST_IR'\"),'runtime must require TEST_IR');\nfor(const op of ['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'])assert(runtime.includes(`'${op}'`),'missing Test IR primitive '+op);\nfor(const bad of ['ASSERT_EXISTS','ASSERT_TYPE','ASSERT_NE'])assert(!runtime.includes(`'${bad}'`),'undeclared Test IR primitive remains '+bad);\nassert(schema.includes(\"const HUMAN_DECISION_JOB_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER'])\"),'JOB_TITLE and JOB_OWNER must be HUMAN_DECISION');\nassert(prompt.indexOf('STAGE-SPECIFIC TASK — DO THIS NOW')<prompt.indexOf('AUTHORIZED BOUNDED CONTEXT FOR THIS STAGE'),'stage task must precede project context');\nassert(prompt.includes('Do not ask the human to attach, resend, retype, or summarize the original intent file'),'Stage 4 repeat-input prohibition missing');\nassert(html.includes(\"worker-src 'self'\"),'same-origin worker CSP missing');\nconst scripts=[...html.matchAll(/<script defer src=\"([^\"]+)\"/g)].map(x=>x[1].split('?')[0]);\nassert(JSON.stringify(scripts)===JSON.stringify(['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']),'runtime script order mismatch');\nassert(html.includes('.prompt{height:clamp(260px,45vh,520px);max-height:80vh')&&html.includes('.expandable-prompt{max-height:280px}'),'prompt box visual baseline changed');\nconsole.log(JSON.stringify({projectSchema3:true,responseSchema3:true,subjectNeutralPrompts:true,stage4CaptureOnce:true,testIrContract:true,visualBaseline:true}));\n"""
write('verify-controlling-spec.mjs',audit)

style_after=re.search(r'<style>(.*?)</style>',read('index.html'),re.S).group(1)
if style_before!=style_after: raise SystemExit('Visual CSS changed during this repair.')
print(json.dumps({'runtimeBuildIdentity':build,'visualCssUnchanged':True}))
