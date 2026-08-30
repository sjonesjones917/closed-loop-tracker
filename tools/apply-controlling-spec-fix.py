from pathlib import Path
import re
import json

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_exact(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def replace_regex(text, pattern, repl, label, flags=0):
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return out


# workbook.js: schema /3, Stage 16 visible wording, deterministic /2 migration.
p = 'workbook.js'
s = read(p)
s = replace_exact(s, "const PROJECT_SCHEMA='closed-loop-project/2';", "const PROJECT_SCHEMA='closed-loop-project/3';", 'project schema')
s = replace_exact(s, "'REVISE THE RESPONSIBLE LAYER'", "'CORRECT THE ROOT CAUSE'", 'stage 16 title')
old = """  if(p.schema!=='human-project/30')throw new Error(`Unsupported project schema: ${p.schema||'MISSING'}`);\n  const migrated=JSON.parse(JSON.stringify(p));\n  const original=JSON.parse(JSON.stringify(p));\n  migrated.schema=PROJECT_SCHEMA;migrated.workflow=WORKFLOW_ID;migrated.stageCount=STAGE_COUNT;migrated.revision=Number.isInteger(migrated.revision)?migrated.revision:0;\n"""
new = """  if(p.schema==='closed-loop-project/2'){\n    const migrated=JSON.parse(JSON.stringify(p)),original=JSON.parse(JSON.stringify(p));\n    migrated.schema=PROJECT_SCHEMA;migrated.workflow=WORKFLOW_ID;migrated.stageCount=STAGE_COUNT;migrated.revision=Number.isInteger(migrated.revision)?migrated.revision:0;\n    migrated.projectData=migrated.projectData&&typeof migrated.projectData==='object'?migrated.projectData:{};\n    migrated.projectData.migrationArchives=Array.isArray(migrated.projectData.migrationArchives)?migrated.projectData.migrationArchives:[];\n    migrated.projectData.historicalImportRecords=Array.isArray(migrated.projectData.historicalImportRecords)?migrated.projectData.historicalImportRecords:[];\n    migrated.projectData.migrationArchives.push({kind:'MIGRATION_SOURCE',schema:'closed-loop-project/2',preservedAt:new Date().toISOString(),payload:original});\n    if(!migrated.stages||Object.keys(migrated.stages).length!==STAGE_COUNT)throw new Error('Project /2 to /3 migration requires exactly 30 stages.');\n    return migrated;\n  }\n  if(p.schema!=='human-project/30')throw new Error(`Unsupported project schema: ${p.schema||'MISSING'}`);\n  const migrated=JSON.parse(JSON.stringify(p));\n  const original=JSON.parse(JSON.stringify(p));\n  migrated.schema=PROJECT_SCHEMA;migrated.workflow=WORKFLOW_ID;migrated.stageCount=STAGE_COUNT;migrated.revision=Number.isInteger(migrated.revision)?migrated.revision:0;\n"""
s = replace_exact(s, old, new, 'project /2 migration')
write(p, s)


# workflow-schema.js: /3 contract, ownership corrections, Test IR exact kind, Stage 04 typed trace.
p = 'workflow-schema.js'
s = read(p)
s = replace_exact(s, "const RESPONSE_SCHEMA='closed-loop-stage-response/2';", "const RESPONSE_SCHEMA='closed-loop-stage-response/3';", 'response schema')
s = s.replace("version:'closed-loop-workflow-schema/2'", "version:'closed-loop-workflow-schema/3'")

old = """const HUMAN_JOB_FIELDS=Object.freeze([\n  'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',\n  'REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','DESIRED_SOURCE_COUNT','KNOWN_AUTHORITATIVE_SOURCES',\n  'AVAILABLE_TOOLS','PROHIBITED_ACTIONS','EXPLICIT_USER_REQUIREMENTS'\n]);\n"""
new = """const HUMAN_JOB_FIELDS=Object.freeze([\n  'EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',\n  'REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','DESIRED_SOURCE_COUNT','KNOWN_AUTHORITATIVE_SOURCES',\n  'AVAILABLE_TOOLS','PROHIBITED_ACTIONS','EXPLICIT_USER_REQUIREMENTS'\n]);\nconst HUMAN_DECISION_JOB_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER']);\n"""
s = replace_exact(s, old, new, 'job producer partitions')
s = replace_exact(s,
"""  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});\n  if(AGENT_JOB_FIELDS.includes(name))return field(name,PRODUCER.AGENT,{requiredAtStage:1});\n""",
"""  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});\n  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{provenanceRequired:false,valueType:'STRING',nullable:true});\n  if(AGENT_JOB_FIELDS.includes(name))return field(name,PRODUCER.AGENT,{requiredAtStage:1});\n""", 'job field producer logic')
s = replace_regex(s, r"const JOB_FIELDS=Object\.freeze\(Object\.fromEntries\(\[\.\.\.new Set\(\[\.\.\.HUMAN_JOB_FIELDS,\.\.\.APPLICATION_JOB_FIELDS,\.\.\.AGENT_JOB_FIELDS\]\)\]\.map\(name=>\[name,jobFieldDefinition\(name\)\]\)\)\);",
"const JOB_FIELDS=Object.freeze(Object.fromEntries([...new Set([...HUMAN_JOB_FIELDS,...HUMAN_DECISION_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])].map(name=>[name,jobFieldDefinition(name)])));", 'job field union')

# Test IR ownership: version is application-owned; executable kind is TEST_IR.
s = replace_exact(s, '      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC",', '      "EXECUTABLE_SPEC",', 'remove Test IR version from agent ownership')
s = replace_exact(s, '      "TEST_ID",\n      "REQ_ID",\n      "STATUS"', '      "TEST_ID",\n      "REQ_ID",\n      "STATUS",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC_SHA256"', 'add Test IR version/hash to application ownership')
s = s.replace("executableKinds:Object.freeze(['NONE','CUSTOM_PIPELINE'])", "executableKinds:Object.freeze(['NONE','TEST_IR'])")
s = s.replace("toUpperCase()!=='CUSTOM_PIPELINE'", "toUpperCase()!=='TEST_IR'")
s = s.replace("EXECUTABLE_KIND must be CUSTOM_PIPELINE.", "EXECUTABLE_KIND must be TEST_IR.")

# Add required XML primitives and exact v1 primitive list. Keep implementation-owned limits centralized.
s = replace_regex(s,
    r"operations:Object\.freeze\(\[[^\]]+\]\),\n  limits:Object\.freeze\(\{[^}]+\}\)",
    "operations:Object.freeze(['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE']),\n  limits:Object.freeze({maxInputBytes:16777216,maxDecompressedBytes:33554432,maxSteps:64,maxSelectorDepth:32,maxParsedDepth:64,maxCollectionItems:100000,maxRegexLength:2000,maxRegexInputBytes:4194304,maxWorkerMs:5000,maxArchiveExpansionBytes:33554432,maxCsvCells:250000})",
    'Test IR operations and centralized limits', flags=re.S)

# Add application-owned spec hash type and Stage 04 obligation trace type.
s = replace_exact(s,
"""    EXECUTABLE_INPUT_BINDINGS:Object.freeze({valueType:VALUE_TYPES.OBJECT,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null})\n  }),\n""",
"""    EXECUTABLE_INPUT_BINDINGS:Object.freeze({valueType:VALUE_TYPES.OBJECT,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC_SHA256:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null})\n  }),\n  REQ:Object.freeze({\n    OBLIGATION_TRACE:Object.freeze({valueType:VALUE_TYPES.STRING_ARRAY,enumValues:[],nullable:false,normalizerKey:null,closedProperties:null})\n  }),\n""", 'additional Test IR / obligation types')

s = replace_exact(s, '      "NOTES"\n    ],\n    "application": [\n      "REQ_ID",', '      "NOTES",\n      "OBLIGATION_TRACE"\n    ],\n    "application": [\n      "REQ_ID",', 'requirements obligation trace ownership')
s = replace_exact(s, "'EXPECTED_EVIDENCE','FAILURE_CONDITION','SEVERITY','STATUS','NOTES'\n  ],required:", "'EXPECTED_EVIDENCE','FAILURE_CONDITION','SEVERITY','STATUS','NOTES','OBLIGATION_TRACE'\n  ],required:", 'requirements obligation trace field')

# Export the new partition and exact /3 identity.
s = replace_exact(s, 'JOB_FIELDS,HUMAN_JOB_FIELDS,APPLICATION_JOB_FIELDS,AGENT_JOB_FIELDS,HUMAN_INTAKE_FIELDS,', 'JOB_FIELDS,HUMAN_JOB_FIELDS,HUMAN_DECISION_JOB_FIELDS,APPLICATION_JOB_FIELDS,AGENT_JOB_FIELDS,HUMAN_INTAKE_FIELDS,', 'schema export producer partitions')
write(p, s)


# test-runtime.js: TEST_IR kind, exact primitive list, explicit CSV options, restricted XML selector, centralized limits.
p = 'test-runtime.js'
s = read(p)
s = s.replace("'CUSTOM_PIPELINE'", "'TEST_IR'")
s = replace_regex(s,
    r"const OPS=Object\.freeze\(\[[\s\S]*?\]\);\nconst LIMITS=Object\.freeze\(\{[^}]+\}\);",
    "const OPS=Object.freeze(['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE']);\nconst LIMITS=Object.freeze({maxInputBytes:16*1024*1024,maxDecompressedBytes:32*1024*1024,maxSteps:64,maxSelectorDepth:32,maxParsedDepth:64,maxCollectionItems:100000,maxRegexLength:2000,maxRegexInputBytes:4*1024*1024,maxWorkerMs:5000,maxArchiveExpansionBytes:32*1024*1024,maxCsvCells:250000});",
    'runtime operations/limits')
# Replace ambiguous CSV parser with explicit contract.
start = s.index('function parseCsv(')
end = s.index('function selectJsonPath', start)
new_csv = r'''function parseCsv(text,options={}){
  const delimiter=options.delimiter;if(typeof delimiter!=='string'||delimiter.length!==1)throw new Error('PARSE_CSV requires an explicit one-character delimiter.');
  if(typeof options.header!=='boolean')throw new Error('PARSE_CSV requires explicit header BOOLEAN.');
  if(!['DOUBLE_QUOTE'].includes(options.quoting))throw new Error('PARSE_CSV quoting must be DOUBLE_QUOTE.');
  if(!['LF','CRLF','AUTO'].includes(options.newline))throw new Error('PARSE_CSV newline must be LF, CRLF, or AUTO.');
  if(options.encoding!=='UTF-8')throw new Error('PARSE_CSV encoding must be UTF-8.');
  const rows=[];let row=[],cell='',quoted=false,cells=0;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;continue;}
    if(ch==='"'){if(cell.length)throw new Error('Malformed CSV: quote begins inside an unquoted field.');quoted=true;continue;}
    if(ch===delimiter){row.push(cell);cell='';cells++;}
    else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';cells++;}
    else if(ch==='\r'){if(text[i+1]==='\n')continue;row.push(cell);rows.push(row);row=[];cell='';cells++;}
    else cell+=ch;
    if(cells>LIMITS.maxCsvCells)throw new Error('CSV exceeds deterministic runtime cell limit.');
  }
  if(quoted)throw new Error('Malformed CSV: unterminated quoted field.');
  if(cell.length||row.length){row.push(cell);rows.push(row);}
  if(rows.length>LIMITS.maxCollectionItems)throw new Error('CSV exceeds deterministic runtime row limit.');
  if(!options.header)return rows;
  if(!rows.length)return [];
  const header=rows[0];if(new Set(header).size!==header.length)throw new Error('CSV header contains duplicate names.');
  return rows.slice(1).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]??''])));
}
function parseXmlRestricted(text){
  const src=String(text);if(/<!DOCTYPE|<!ENTITY/i.test(src))throw new Error('PARSE_XML forbids DTD and entity declarations.');
  const token=/<\/?[A-Za-z_][A-Za-z0-9_.:-]*(?:\s+[^<>]*?)?\/?>|[^<]+/g,root={name:'#document',children:[],text:''},stack=[root];let m;
  while((m=token.exec(src))){const t=m[0];if(t.startsWith('</')){const name=t.slice(2,-1).trim();const node=stack.pop();if(!node||node===root||node.name!==name)throw new Error('Malformed XML closing tag.');continue;}if(t.startsWith('<')){const self=/\/>$/.test(t),name=(t.match(/^<([A-Za-z_][A-Za-z0-9_.:-]*)/)||[])[1];if(!name)throw new Error('Malformed XML tag.');const node={name,children:[],text:''};stack.at(-1).children.push(node);if(!self)stack.push(node);continue;}stack.at(-1).text+=t;}
  if(stack.length!==1)throw new Error('Malformed XML: unclosed tag.');if(root.children.length!==1)throw new Error('PARSE_XML requires exactly one document element.');return root.children[0];
}
function selectXml(value,path){
  const parts=String(path||'').split('/').filter(Boolean);if(!parts.length||parts.length>LIMITS.maxSelectorDepth)throw new Error('SELECT_XML requires a bounded absolute element path.');
  let nodes=[value];if(nodes[0]?.name===parts[0])parts.shift();
  for(const part of parts){if(!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(part))throw new Error('Unsupported SELECT_XML selector token: '+part);nodes=nodes.flatMap(n=>(n?.children||[]).filter(c=>c.name===part));}
  return nodes;
}
'''
s = s[:start] + new_csv + s[end:]
s = s.replace("case 'PARSE_CSV':value=parseCsv(String(value));break;", "case 'PARSE_CSV':value=parseCsv(String(value),step);break;\n      case 'PARSE_XML':value=parseXmlRestricted(String(value));break;")
s = s.replace("case 'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);break;", "case 'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);break;\n      case 'SELECT_XML':value=selectXml(value,step.path);break;")
# Enforce regex input bound.
s = s.replace("case 'REGEX':{const r=new RegExp(String(step.pattern||''),String(step.flags||''));lastRegex=r;value=r.test(String(value));break;}", "case 'REGEX':{const input=String(value);if(new TextEncoder().encode(input).byteLength>LIMITS.maxRegexInputBytes)throw new Error('REGEX input exceeds deterministic runtime limit.');const r=new RegExp(String(step.pattern||''),String(step.flags||''));lastRegex=r;value=r.test(input);break;}")
write(p, s)


# workflow-engine.js: durable intake/obligation manifests and application-native capability authority.
p = 'workflow-engine.js'
s = read(p)
s = replace_exact(s,
"""  'history','newJobResets','reviews','recoveredProjects','responseDispositions','executionFailures'\n]);\n""",
"""  'history','newJobResets','reviews','recoveredProjects','responseDispositions','executionFailures','intakeCoverageManifests','obligationManifests','promptContextManifests','blindAliasMaps','nativeExecutionEvents'\n]);\n""", 'infra manifest collections')

anchor = "function recordStageConfirmation(project,stage,confirmed,statement,operatorLabel='HUMAN_OPERATOR',options={}){"
idx = s.index(anchor)
manifest_code = r'''
const INTAKE_DISPOSITIONS=Object.freeze(['INCORPORATED','RETAINED_CONTEXT','UNRESOLVED_HUMAN_ONLY','LATER_RESOLVABLE','INAPPLICABLE']);
const OBLIGATION_DISPOSITIONS=Object.freeze(['REQUIREMENT','RETAINED_NONNORMATIVE_CONTEXT','INAPPLICABLE','BLOCKED']);
function splitControlledUnits(value){
  if(value===undefined||value===null)return [];
  if(Array.isArray(value))return value.flatMap(splitControlledUnits);
  if(typeof value==='object')return Object.entries(value).flatMap(([k,v])=>splitControlledUnits(`${k}: ${typeof v==='string'?v:JSON.stringify(v)}`));
  const text=String(value).replace(/\r\n?/g,'\n').trim();if(!text)return [];
  const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);return lines.length?lines:[text];
}
function buildIntakeCoverageManifest(project){
  ensureShape(project);const inputVersion=String(project.job.CURRENT_INPUT_VERSION||'UNKNOWN'),latest=safe(project.projectData.inputVersions).filter(x=>String(x.version)===inputVersion).at(-1),units=[];
  const push=(sourceLocation,rawValue,kind='HUMAN_INPUT')=>{for(const [index,value] of splitControlledUnits(rawValue).entries()){const rawValueHash=hash.sha256Value(value),unitId='INPUT-UNIT-'+hash.sha256Value({inputVersion,sourceLocation,index,rawValueHash}).slice(0,20).toUpperCase();units.push({unitId,sourceLocation,index,kind,rawValueHash,rawValue:value});}};
  for(const name of schema.HUMAN_INTAKE_FIELDS||[])push(`JOB.${name}`,project.job[name]);
  for(const [index,item] of safe(latest?.payload?.clarifications||project.projectData.userEntered?.clarifications).entries())push(`CLARIFICATION.${index}`,item,'HUMAN_CLARIFICATION');
  const inputSha256=latest?.sha256||hash.sha256Value(units.map(x=>[x.unitId,x.rawValueHash]));const manifestId='INTAKE-MANIFEST-'+hash.sha256Value({inputVersion,inputSha256,units:units.map(x=>x.unitId)}).slice(0,20).toUpperCase();
  const manifest={manifestId,inputVersion,inputSha256,units,requiredUnitIds:units.map(x=>x.unitId),createdAt:now(),applicationOwned:true};const prior=safe(project.projectData.intakeCoverageManifests).find(x=>x.manifestId===manifestId);if(prior)return prior;project.projectData.intakeCoverageManifests.push(manifest);return manifest;
}
function currentIntakeCoverageManifest(project){ensureShape(project);return buildIntakeCoverageManifest(project);}
function buildObligationManifest(project){
  ensureShape(project);const scope=currentScope(project),intake=buildIntakeCoverageManifest(project),obligations=[],seen=new Set();
  const push=(originType,originId,sourceLocation,rawValue,provenance={})=>{for(const [index,value] of splitControlledUnits(rawValue).entries()){const rawValueHash=hash.sha256Value(value),obligationId='OBLIGATION-'+hash.sha256Value({scope,originType,originId,sourceLocation,index,rawValueHash}).slice(0,20).toUpperCase();if(seen.has(obligationId))continue;seen.add(obligationId);obligations.push({obligationId,originType,originId,sourceLocation,index,rawValueHash,rawValue:value,provenance});}};
  for(const unit of intake.units)push('HUMAN_INPUT',unit.unitId,unit.sourceLocation,unit.rawValue,{inputVersion:intake.inputVersion,inputManifestId:intake.manifestId});
  for(const name of ['EXACT_DELIVERABLE_REQUESTED','INPUT_SET_CONTENTS','ASSUMPTIONS','UNKNOWN_INFORMATION'])push('STAGE_01',`STAGE01.${name}`,name,project.job[name],{inputVersion:project.job.CURRENT_INPUT_VERSION||null,acceptedChangeId:acceptedChanges(project,1).at(-1)?.changeId||null});
  for(const record of recordsForCurrentScope(project,'candidateRequirements'))push('EXTERNAL_SOURCE',recordId(record,'candidateRequirements'),String(recordValue(record,'SOURCE_LOCATION')||'CANDIDATE_REQUIREMENT'),recordValue(record,'CANDIDATE_OBLIGATION'),{sourceId:String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''),researchVersion:project.job.CURRENT_RESEARCH_VERSION||null});
  for(const record of recordsForCurrentScope(project,'research'))for(const fieldName of ['MANDATORY_STATEMENTS','RECOMMENDATIONS','OPTIONAL_PRACTICES','PROHIBITIONS','EXCEPTIONS','DEPENDENCIES','APPLICABILITY_FACTS','RESTRICTIONS','INVALIDATING_MATERIAL'])push('SOURCE_RESEARCH',recordId(record,'research'),fieldName,recordValue(record,fieldName),{sourceId:String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||'')});
  const manifestId='OBLIGATION-MANIFEST-'+hash.sha256Value({scope,obligations:obligations.map(x=>[x.obligationId,x.rawValueHash])}).slice(0,20).toUpperCase();const manifest={manifestId,scope:clone(scope),inputManifestId:intake.manifestId,obligations,requiredObligationIds:obligations.map(x=>x.obligationId),createdAt:now(),applicationOwned:true};const prior=safe(project.projectData.obligationManifests).find(x=>x.manifestId===manifestId);if(prior)return prior;project.projectData.obligationManifests.push(manifest);return manifest;
}
function currentObligationManifest(project){ensureShape(project);return buildObligationManifest(project);}
function validateStageAccounting(project,envelope){
  const stage=Number(envelope?.stage),issues=[];if(envelope?.responseType!=='DATA_PROPOSAL')return issues;
  if(stage===1){const manifest=buildIntakeCoverageManifest(project),text=String(envelope?.stageData?.INPUT_SET_CONTENTS||'');for(const id of manifest.requiredUnitIds){const line=text.split(/\r?\n/).find(x=>x.includes(id))||'';if(!line)issues.push({code:'INCOMPLETE_INTAKE_ACCOUNTING',path:'/stageData/INPUT_SET_CONTENTS',message:`Stage 01 omitted controlled input unit ${id}.`});else if(!INTAKE_DISPOSITIONS.some(d=>line.includes(d)))issues.push({code:'INVALID_INTAKE_DISPOSITION',path:'/stageData/INPUT_SET_CONTENTS',message:`Stage 01 unit ${id} lacks a controlled semantic disposition.`});}}
  if(stage===4){const manifest=buildObligationManifest(project),requirements=safe(envelope?.records?.requirements),mapped=new Set(requirements.flatMap(r=>safe(r?.fields?.OBLIGATION_TRACE).map(String))),fallback=String(envelope?.stageData?.ATOMICITY_REVIEW_RESULTS||'')+'\n'+String(envelope?.stageData?.DEFINED_TERM_GAPS||'');for(const id of manifest.requiredObligationIds){if(mapped.has(id))continue;const line=fallback.split(/\r?\n/).find(x=>x.includes(id))||'';if(!line)issues.push({code:'INCOMPLETE_OBLIGATION_ACCOUNTING',path:'/records/requirements',message:`Stage 04 omitted obligation ${id}.`});else if(!OBLIGATION_DISPOSITIONS.slice(1).some(d=>line.includes(d)))issues.push({code:'INVALID_OBLIGATION_DISPOSITION',path:'/stageData/ATOMICITY_REVIEW_RESULTS',message:`Stage 04 obligation ${id} lacks a valid non-requirement disposition.`});}}
  return issues;
}
'''
s = s[:idx] + manifest_code + s[idx:]
# Make input versioning immediately persist the manifest.
s = replace_exact(s, "  addHistory(project,'USER_JOB_INPUT_VERSIONED',{recordId:record.inputVersionId,version,changedFields:[...changedFields],sha256});\n  return record;", "  addHistory(project,'USER_JOB_INPUT_VERSIONED',{recordId:record.inputVersionId,version,changedFields:[...changedFields],sha256});\n  buildIntakeCoverageManifest(project);\n  return record;", 'manifest on human input version')
# Native capabilities come from test-runtime, not a duplicate registry.
s = replace_regex(s, r"const APPLICATION_TEST_EXECUTORS=Object\.freeze\(\{\}\);\nfunction applicationTestCapabilities\(\)\{return Object\.freeze\(Object\.keys\(APPLICATION_TEST_EXECUTORS\)\);\}", "function applicationTestCapabilities(){const runtime=globalThis.closedLoopTestRuntime;return Object.freeze(runtime?.capabilities?Array.from(runtime.capabilities()):[]);}", 'native capability authority')
s = s.replace("if(mode==='APPLICATION_DETERMINISTIC')return Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,requiredCapability);", "if(mode==='APPLICATION_DETERMINISTIC')return applicationTestCapabilities().includes(requiredCapability);")
s = s.replace("applicationExecutorSupported=mode==='APPLICATION_DETERMINISTIC'&&Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,requiredCapability)", "applicationExecutorSupported=mode==='APPLICATION_DETERMINISTIC'&&applicationTestCapabilities().includes(requiredCapability)")
# Export manifest/accounting helpers.
s = replace_exact(s, 'recordHumanInputVersion,recordStageConfirmation,recordReleaseDetermination,acceptedControlEvents,constructEvidenceChains,verifyArtifactIdentity', 'recordHumanInputVersion,buildIntakeCoverageManifest,currentIntakeCoverageManifest,buildObligationManifest,currentObligationManifest,validateStageAccounting,INTAKE_DISPOSITIONS,OBLIGATION_DISPOSITIONS,recordStageConfirmation,recordReleaseDetermination,acceptedControlEvents,constructEvidenceChains,verifyArtifactIdentity', 'engine manifest exports')
write(p, s)


# prompt-engine.js: subject-neutral prompts, exact capture-once manifests, TEST_IR naming.
p = 'prompt-engine.js'
s = read(p)
s = s.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/26';", "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/27';")
s = s.replace('CUSTOM_PIPELINE', 'TEST_IR')
# Remove hard-coded project-subject branches. Replace the complete stage-domain catalogue with one generic algorithm.
start_marker = "${stage===1?`STAGE 01 DOMAIN INTAKE ADAPTATION"
end_marker = "${stage===1?`STAGE 01 CLARIFICATION EXPERIENCE"
start = s.find(start_marker);end = s.find(end_marker)
if start == -1 or end == -1 or end <= start:
    raise RuntimeError('domain-neutral prompt replacement markers not found')
generic = r'''${stage===1?`STAGE 01 SUBJECT-NEUTRAL INTAKE ADAPTATION
Derive the human-only questions required by this project from the actual human request, accessible supplied material, and current canonical context. Do not select questions from a hard-coded subject catalogue. Use domain knowledge only to recognize what information must genuinely come from the human; do not perform source research, requirement atomization, verification design, production design, artifact generation, filing, simulation, manufacturing, or product verification here.
`:`SUBJECT-NEUTRAL PROJECT ADAPTATION
Derive project-specific semantics only from the current project request, supplied material, accepted canonical records, applicable external authority, and the actual capability/tool context. Do not use hard-coded subject modes. Identify the concrete authorities, primitives, units, interfaces, toolchain constraints, artifact types, safety/regulatory constraints, and verification methods that are actually relevant to this project, and omit irrelevant concepts. Never invent a human-only fact or a capability that was not established.
`}

'''
s = s[:start] + generic + s[end:]
# Remove the production patent fixture from runtime prompt text; it remains a regression fixture in tests.
s = re.sub(r"For PATENT / REGULATED FILING jobs, when not already known from human input or supplied materials, ASK_NOW_NONBLOCKING includes:.*?Do not turn researchable legal strategy into a human question\.\n", "For every project, ASK_NOW_NONBLOCKING includes every foreseeable human-only fact or decision required to achieve the requested outcome that is not already supplied. Derive those questions from this project's actual content; do not use a subject-specific hard-coded list.\n", s, count=1, flags=re.S)
# Add exact application-owned manifests immediately before bounded context.
marker = "AUTHORIZED BOUNDED CONTEXT FOR THIS STAGE\n${contextFor(stage,state,operation,scope)}"
manifest_block = r'''${stage===1?`APPLICATION-OWNED INTAKE COVERAGE MANIFEST — ACCOUNT EVERY ID
${show(workflow.currentIntakeCoverageManifest(state))}
For the final DATA_PROPOSAL, INPUT_SET_CONTENTS must include one concise line for every unitId in this manifest. Each line must contain the exact unitId, exactly one disposition from INCORPORATED | RETAINED_CONTEXT | UNRESOLVED_HUMAN_ONLY | LATER_RESOLVABLE | INAPPLICABLE, and the faithful substantive content or reason. Do not omit an ID. This accounting is internal traceability; do not ask the human to review or re-enter information they already supplied.

`:''}${stage===4?`APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST — THIS IS THE COMPLETE INPUT UNIVERSE
${show(workflow.currentObligationManifest(state))}
Do not rediscover inputs and do not ask for the original intent file again. For every obligationId, either map it to one or more proposed requirement records by placing the exact obligationId in that requirement's OBLIGATION_TRACE array, or put one line in ATOMICITY_REVIEW_RESULTS containing the exact obligationId plus exactly one non-requirement disposition: RETAINED_NONNORMATIVE_CONTEXT | INAPPLICABLE | BLOCKED, followed by the reason. No obligationId may disappear. Multiple obligations may map to one requirement only when materially equivalent and no semantic distinction is lost.

`:''}AUTHORIZED BOUNDED CONTEXT FOR THIS STAGE
${contextFor(stage,state,operation,scope)}'''
s = replace_exact(s, marker, manifest_block, 'prompt manifest injection')
# Make Stage 04 task explicitly consume the manifest and prohibit any duplicate human request.
s = s.replace("The application must create and provide the obligation universe before this stage; do not rediscover an unspecified input universe.", "The application has created the complete obligation universe in APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST. Consume that exact manifest; do not rediscover an unspecified input universe.")
# Update response contract descriptor identity.
s = s.replace("contractVersion:'closed-loop-response-contract/2.4'", "contractVersion:'closed-loop-response-contract/3.0'")
write(p, s)


# response-ingestion.js: enforce intake/obligation closure before proposal planning.
p = 'response-ingestion.js'
s = read(p)
needle = "  if(envelope.responseType==='DATA_PROPOSAL'){\n    if(safe(envelope.humanInputRequests).some(request=>request.blocking!==false))issues.push(issue('MIXED_RESPONSE_TYPE','/humanInputRequests','A DATA_PROPOSAL cannot contain blocking human-input requests.'));"
replacement = "  if(envelope.responseType==='DATA_PROPOSAL'){\n    for(const accountingIssue of workflow.validateStageAccounting(project,envelope))issues.push(issue(accountingIssue.code,accountingIssue.path,accountingIssue.message));\n    if(safe(envelope.humanInputRequests).some(request=>request.blocking!==false))issues.push(issue('MIXED_RESPONSE_TYPE','/humanInputRequests','A DATA_PROPOSAL cannot contain blocking human-input requests.'));"
s = replace_exact(s, needle, replacement, 'accounting closure validation')
write(p, s)


# project-store.js: accept deterministic /2 -> /3 migration path rather than rejecting it before core migration.
p = 'project-store.js'
s = read(p)
s = s.replace("raw.schema!==core.SCHEMA&&raw.schema!=='human-project/30'", "raw.schema!==core.SCHEMA&&raw.schema!=='closed-loop-project/2'&&raw.schema!=='human-project/30'")
write(p, s)


# app-core.js: accept /2 imports through migration; restore prompt box to the existing .prompt dimensions; do not redesign other visuals.
p = 'app-core.js'
s = read(p)
s = s.replace("if(![core.SCHEMA,'human-project/30'].includes(raw?.schema))", "if(![core.SCHEMA,'closed-loop-project/2','human-project/30'].includes(raw?.schema))")
write(p, s)

p = 'index.html'
s = read(p)
s = s.replace('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}', '.expandable-prompt{max-height:80vh}.expandable-prompt.expanded{max-height:none}')
# CSP must explicitly permit the same-origin worker and nothing broader.
s = s.replace("connect-src 'self'; object-src 'none';", "connect-src 'self'; worker-src 'self'; object-src 'none';")
write(p, s)


# Permanent regression: capture once -> Stage 04 prompt contains canonical data; no original-file resend request.
verify = r'''import fs from 'node:fs';
import vm from 'node:vm';
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(new URL('./'+file,import.meta.url),'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompt=globalThis.closedLoopPromptEngine;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const p=core.createBlankState('JOB-CAPTURE-ONCE');engine.ensureShape(p);
p.job.JOB_TITLE='Capture once regression';
p.job.EXACT_USER_OBJECTIVE_VERBATIM='Build the requested product from the supplied intent without asking me to provide the same project information twice.';
p.job.EXPLICIT_USER_REQUIREMENTS='Requirement alpha must be preserved.\nRequirement beta must be preserved.';
p.job.SUPPLIED_MATERIALS_INVENTORY='intent.txt';
engine.recordHumanInputVersion(p,['EXACT_USER_OBJECTIVE_VERBATIM','EXPLICIT_USER_REQUIREMENTS','SUPPLIED_MATERIALS_INVENTORY']);
const intake=engine.currentIntakeCoverageManifest(p);
assert(intake.requiredUnitIds.length>=4,'intake manifest did not enumerate controlled human input units');
p.job.EXACT_DELIVERABLE_REQUESTED='The requested finished product.';
p.job.ASSUMPTIONS='NONE';p.job.UNKNOWN_INFORMATION='NONE';
p.job.INPUT_SET_CONTENTS=intake.units.map(u=>`${u.unitId} INCORPORATED — ${u.rawValue}`).join('\n');
p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:p.job.EXACT_DELIVERABLE_REQUESTED,ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:p.job.INPUT_SET_CONTENTS};
p.stages[1].acceptedData=p.stages[1].agentData;p.stages[1].status='COMPLETE';
p.stages[2].status='COMPLETE';p.stages[3].status='COMPLETE';
engine.recalculate(p);
const obligations=engine.currentObligationManifest(p);
assert(obligations.requiredObligationIds.length>=intake.requiredUnitIds.length,'Stage 04 obligation universe lost human input');
const rec=prompt.buildPromptRecord(4,p,{operation:'COMPLETE'});
assert(rec.prompt.includes('Requirement alpha must be preserved.'),'Stage 04 prompt omitted captured human requirement');
assert(rec.prompt.includes('Requirement beta must be preserved.'),'Stage 04 prompt omitted second captured human requirement');
assert(rec.prompt.includes(obligations.manifestId),'Stage 04 prompt omitted application obligation manifest');
assert(!/ask the human[^\n]{0,120}(attach|resend|retype|summarize) the original intent/i.test(rec.prompt),'Stage 04 prompt asks human to resupply original intent');
assert(schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3','response schema is not /3');
assert(core.PROJECT_SCHEMA==='closed-loop-project/3','project schema is not /3');
assert(schema.JOB_FIELDS.JOB_TITLE.producer==='HUMAN_DECISION'&&schema.JOB_FIELDS.JOB_OWNER.producer==='HUMAN_DECISION','job title/owner ownership is wrong');
assert(schema.TEST_IR.executableKinds.includes('TEST_IR')&&!schema.TEST_IR.executableKinds.includes('CUSTOM_PIPELINE'),'Test IR executable kind contract is wrong');
console.log('capture-once controlling-spec regression passed');
'''
write('verify-capture-once.mjs', verify)

# Update verification entrypoint when it has a simple list of node checks; otherwise the standalone file remains CI-callable.
p = '.github/workflows/pages.yml'
s = read(p)
if 'node verify-capture-once.mjs' not in s:
    # Put the permanent regression immediately before the build/deploy boundary when possible.
    marker = 'node verify-prompt-semantics.mjs'
    if marker in s:
        s = s.replace(marker, marker + '\n          node verify-capture-once.mjs', 1)
write(p, s)

# Remove one-time repair infrastructure from the resulting tree. Active verification remains.
for temp in ['tools/apply-controlling-spec-fix.py','.github/workflows/apply-controlling-spec-fix.yml']:
    f=ROOT/temp
    if f.exists(): f.unlink()

print('controlling-spec repair applied')
