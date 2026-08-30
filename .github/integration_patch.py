from pathlib import Path
import re

def replace_once(path, old, new):
    p=Path(path); t=p.read_text()
    if new in t: return
    if t.count(old)!=1: raise SystemExit(f'{path}: expected one anchor, found {t.count(old)}: {old[:120]!r}')
    p.write_text(t.replace(old,new,1))

def ensure_contains(path, needle):
    if needle not in Path(path).read_text(): raise SystemExit(f'{path}: missing required result {needle!r}')

# WORKBOOK: preserve current-main intent records while moving controlling identities/contracts to /3.
replace_once('workbook.js',"const PROJECT_SCHEMA='closed-loop-project/2';","const PROJECT_SCHEMA='closed-loop-project/3';")
replace_once('workbook.js',"'REVISE THE RESPONSIBLE LAYER'","'CORRECT THE ROOT CAUSE'")
replace_once('workbook.js',"'INPUT_SET_VERSION','INPUT_SET_CONTENTS','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS','STATUS_EVIDENCE']","'INPUT_SET_VERSION','INPUT_SET_CONTENTS','INTAKE_ACCOUNTING','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS','STATUS_EVIDENCE']")
replace_once('workbook.js',"'OPTIONAL_REQUIREMENTS','BLOCKED_REQUIREMENTS','STAGE_DECISION','DECISION_EVIDENCE']","'OPTIONAL_REQUIREMENTS','BLOCKED_REQUIREMENTS','OBLIGATION_ACCOUNTING','STAGE_DECISION','DECISION_EVIDENCE']")
# Add accounting ownership without disturbing existing intentStatements collection ownership.
w=Path('workbook.js'); t=w.read_text()
if '"INTAKE_ACCOUNTING"' not in t:
    t=t.replace('"INPUT_SET_CONTENTS"\n    ],','"INPUT_SET_CONTENTS",\n      "INTAKE_ACCOUNTING"\n    ],',1)
if '"OBLIGATION_ACCOUNTING"' not in t:
    marker='"BLOCKED_REQUIREMENTS"\n    ],'
    if marker not in t: raise SystemExit('workbook Stage 4 ownership anchor missing')
    # Scope this after Stage 4 by locating ownership block around REQUIREMENTS_VERSION.
    idx=t.find('"REQUIREMENTS_VERSION"'); pre=t[:idx]; pos=pre.rfind(marker)
    if pos<0: raise SystemExit('workbook Stage 4 agent ownership anchor missing')
    t=t[:pos]+t[pos:].replace(marker,'"BLOCKED_REQUIREMENTS",\n      "OBLIGATION_ACCOUNTING"\n    ],',1)
w.write_text(t)

# SCHEMA: retain intentStatements, add /3 ownership/accounting/Test IR deltas.
replace_once('workflow-schema.js',"const RESPONSE_SCHEMA='closed-loop-stage-response/2';","const RESPONSE_SCHEMA='closed-loop-stage-response/3';")
s=Path('workflow-schema.js'); t=s.read_text()
# Job title/owner are HUMAN_DECISION.
if 'const HUMAN_DECISION_JOB_FIELDS' not in t:
    t=t.replace("const HUMAN_JOB_FIELDS=Object.freeze([\n  'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',","const HUMAN_JOB_FIELDS=Object.freeze([\n  'EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',",1)
    t=t.replace("]);\nconst APPLICATION_JOB_FIELDS=Object.freeze([","]);\nconst HUMAN_DECISION_JOB_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER']);\nconst APPLICATION_JOB_FIELDS=Object.freeze([",1)
    t=t.replace("  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,","  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{requiredAtStage:null,provenanceRequired:false,nullable:true});\n  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,",1)
    t=t.replace("[...new Set([...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])].map","[...new Set([...HUMAN_JOB_FIELDS,...HUMAN_DECISION_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])].map",1)
# Stage accounting explicit types.
old="""const STAGE_FIELD_TYPE_OVERRIDES=Object.freeze({
  '1':Object.freeze({DESIRED_SOURCE_COUNT:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:true,normalizerKey:null,closedProperties:null})}),
  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})})
});"""
new="""const STAGE_FIELD_TYPE_OVERRIDES=Object.freeze({
  '1':Object.freeze({DESIRED_SOURCE_COUNT:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:true,normalizerKey:null,closedProperties:null}),INTAKE_ACCOUNTING:Object.freeze({valueType:'OBJECT',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:Object.freeze(['items'])})}),
  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})}),
  '4':Object.freeze({OBLIGATION_ACCOUNTING:Object.freeze({valueType:'OBJECT',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:Object.freeze(['items'])})})
});"""
if new not in t:
    if old not in t: raise SystemExit('schema stage type override anchor missing')
    t=t.replace(old,new,1)
# Test IR exact target grammar. Use branch's tested blocks by extracting from repair branch working merge when present is not possible here; patch current main declarations.
t=t.replace("executableKinds:Object.freeze(['NONE','CUSTOM_PIPELINE'])","executableKinds:Object.freeze(['NONE','TEST_IR'])")
t=t.replace("operations:Object.freeze(['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','SELECT_JSON_PATH','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','BYTE_COMPARE','ASSERT_EXISTS','ASSERT_TYPE','ASSERT_EQ','ASSERT_NE','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL'])","operations:Object.freeze(['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'])")
t=t.replace("limits:Object.freeze({maxSteps:64,maxTextBytes:16777216,maxCollectionItems:100000,maxRegexLength:2000,maxCsvCells:250000})","limits:Object.freeze({maxTotalInputBytes:16777216,maxDecompressedBytes:33554432,maxSteps:64,maxSelectorDepth:32,maxParsedDepth:64,maxCollectionItems:100000,maxRegexLength:2000,maxRegexInputBytes:1048576,workerExecutionMs:10000,maxArchiveExpansionBytes:33554432,maxCsvCells:250000})")
t=t.replace("EXECUTABLE_KIND must be CUSTOM_PIPELINE.","EXECUTABLE_KIND must be TEST_IR.").replace("toUpperCase()!=='CUSTOM_PIPELINE'","toUpperCase()!=='TEST_IR'")
# Preserve static producer authority: spec version/hash are application-owned.
t=t.replace('"EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC",','"EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC",')
t=t.replace('"TEST_ID",\n      "REQ_ID",\n      "STATUS"\n    ]\n  },\n  "failureTests"','"TEST_ID",\n      "REQ_ID",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC_SHA256",\n      "STATUS"\n    ]\n  },\n  "failureTests"',1)
# Test record field inventory and type.
t=t.replace("'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS'","'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC_SHA256','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS'",1)
if 'EXECUTABLE_SPEC_SHA256:Object.freeze' not in t:
    t=t.replace("EXECUTABLE_SPEC_VERSION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),","EXECUTABLE_SPEC_VERSION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC_SHA256:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),",1)
s.write_text(t)

# ENGINE: graft accounting onto current-main engine so intentStatements remain canonical.
e=Path('workflow-engine.js'); t=e.read_text()
if "'intakeCoverageManifests'" not in t:
    t=t.replace("'history','newJobResets','reviews','recoveredProjects','responseDispositions','executionFailures'","'history','newJobResets','reviews','recoveredProjects','responseDispositions','executionFailures','intakeCoverageManifests','obligationManifests','promptContextManifests','blindAliasMaps','nativeExecutionEvents'",1)
# Gate upgrades.
t=t.replace('case 1:{\n      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||\'\').trim())',"case 1:{const intakeManifest=currentIntakeCoverageManifest(project);if(!intakeManifest.complete)reasons.push(`Stage 01 intake accounting is incomplete: ${intakeManifest.classified}/${intakeManifest.total} controlled input units classified.`);\n      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())",1)
old3="requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);break;"
new3="requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);const s3=project.stages?.[3]?.agentData||{};if(!truth(s3.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED))reasons.push('Stage 03 second conflict and exception pass is not complete.');if(truth(s3.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS))reasons.push('Stage 03 latest pass found a new material category; research must continue until a complete pass finds none.');if(numeric(s3.LATEST_PASS_NUMBER)<2)reasons.push('Stage 03 requires at least two documented research passes before saturation can be established.');break;"
if new3 not in t:
    if old3 not in t: raise SystemExit('engine Stage3 gate anchor missing')
    t=t.replace(old3,new3,1)
if 'Stage 04 obligation accounting is incomplete:' not in t:
    t=t.replace('case 4:{\n      requireAccepted();requireCount(\'requirements\',1);',"case 4:{const intakeManifest=currentIntakeCoverageManifest(project),obligationManifest=currentObligationManifest(project);if(!intakeManifest.complete)reasons.push(`Stage 04 is blocked because Stage 01 controlled-input accounting is incomplete: ${intakeManifest.classified}/${intakeManifest.total}. Return to Stage 01; do not ask the human to resend existing project input.`);const stage3Gate=project.stages?.[3]?.gate;if(stage3Gate&&!stage3Gate.complete)reasons.push('Stage 04 is blocked because current Stage 03 research is not complete. Return to Stage 03; do not ask the human to resupply captured intent.');if(!obligationManifest.complete)reasons.push(`Stage 04 obligation accounting is incomplete: ${obligationManifest.classified}/${obligationManifest.total} obligations dispositioned.`);\n      requireAccepted();requireCount('requirements',1);",1)
# Accounting functions, with canonical intentStatements included in Stage 4 input universe.
if 'function accountingUnitsFromValue' not in t:
    block=r'''
function accountingUnitsFromValue(value,sourcePath,sourceKind){
  const values=[];const add=(raw,path)=>{const text=String(raw??'').trim();if(!text)return;const lines=text.split(/\r?\n+/).map(x=>x.trim()).filter(Boolean);for(const [i,line] of (lines.length?lines:[text]).entries()){const rawValueSha256=hash.sha256Value(line),resolvedPath=`${path}${lines.length>1?`#line-${i+1}`:''}`,unitId=`UNIT-${hash.sha256Value({sourceKind,sourcePath:resolvedPath,rawValueSha256}).slice(0,20).toUpperCase()}`;values.push({unitId,sourceKind,sourcePath:resolvedPath,rawValue:line,rawValueSha256});}};if(Array.isArray(value))value.forEach((v,i)=>typeof v==='object'?Object.entries(v||{}).forEach(([k,x])=>add(x,`${sourcePath}/${i}/${k}`)):add(v,`${sourcePath}/${i}`));else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>add(v,`${sourcePath}/${k}`));else add(value,sourcePath);return values;
}
function buildIntakeCoverageManifest(project){ensureShape(project);const current=String(project.job.CURRENT_INPUT_VERSION||safe(project.projectData.inputVersions).at(-1)?.version||''),latest=safe(project.projectData.inputVersions).find(x=>String(x.version||x.inputVersionId||'')===current)||safe(project.projectData.inputVersions).at(-1),payload=latest?.payload||Object.fromEntries((schema.HUMAN_INTAKE_FIELDS||[]).map(name=>[name,project.job[name]??''])),units=[];for(const [name,value] of Object.entries(payload||{}))units.push(...accountingUnitsFromValue(value,`/humanInput/${name}`,'HUMAN_INPUT'));const unique=[...new Map(units.map(x=>[x.unitId,x])).values()],classification=project.stages?.[1]?.agentData?.INTAKE_ACCOUNTING,byId=new Map(safe(classification?.items||classification).map(x=>[String(x.unitId||''),x])),allowed=new Set(['INCORPORATED','RETAINED_CONTEXT','UNRESOLVED_HUMAN_ONLY','LATER_RESOLVABLE','INAPPLICABLE']),classified=unique.filter(x=>allowed.has(upper(byId.get(x.unitId)?.disposition))).length,manifestSha256=hash.sha256Value({inputVersion:current,units:unique.map(({rawValue,...x})=>x)});return {schema:'closed-loop-intake-manifest/1',manifestId:`INTAKE-${manifestSha256.slice(0,20).toUpperCase()}`,inputVersion:current,manifestSha256,units:unique,classifications:safe(classification?.items||classification),classified,total:unique.length,coverage:unique.length?classified/unique.length:1,complete:unique.length===classified};}
function buildObligationManifest(project){ensureShape(project);const items=[];const add=(value,sourcePath,sourceKind,provenance={})=>{for(const unit of accountingUnitsFromValue(value,sourcePath,sourceKind)){const obligationId=`OBL-${hash.sha256Value({unit,provenance}).slice(0,20).toUpperCase()}`;items.push({obligationId,sourceKind,sourcePath:unit.sourcePath,text:unit.rawValue,rawValueSha256:unit.rawValueSha256,provenance:clone(provenance)});}};const intake=buildIntakeCoverageManifest(project);for(const u of intake.units)add(u.rawValue,u.sourcePath,'HUMAN_ORIGIN',{inputUnitId:u.unitId,inputVersion:intake.inputVersion});for(const r of recordsForCurrentScope(project,'intentStatements')){const sid=recordId(r,'intentStatements'),meta={statementId:sid,sourceMaterial:recordValue(r,'SOURCE_MATERIAL'),sourceLocation:recordValue(r,'SOURCE_LOCATION'),statementKind:recordValue(r,'STATEMENT_KIND'),requirementRelevance:recordValue(r,'REQUIREMENT_RELEVANCE'),normativeForce:recordValue(r,'NORMATIVE_FORCE')};for(const key of ['EXACT_STATEMENT','DEPENDENCIES','EXCEPTIONS','CONFLICTS','NOTES'])add(recordValue(r,key),`/intentStatements/${sid}/${key}`,'STAGE01_INTENT_STATEMENT',meta);}for(const key of ['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'])add(project.stages?.[1]?.agentData?.[key],`/stage1/${key}`,'STAGE01_JOB_DEFINITION');for(const r of recordsForCurrentScope(project,'research'))for(const key of ['MANDATORY_STATEMENTS','RECOMMENDATIONS','OPTIONAL_PRACTICES','PROHIBITIONS','EXCEPTIONS','DEPENDENCIES','APPLICABILITY_FACTS','RESTRICTIONS','INVALIDATING_MATERIAL'])add(recordValue(r,key),`/research/${recordId(r,'research')}/${key}`,'STAGE03_RESEARCH',{researchId:recordId(r,'research'),sourceId:String(recordValue(r,'SOURCE_ID')||r.relationships?.SOURCE_ID||'')});for(const r of recordsForCurrentScope(project,'candidateRequirements'))add(recordValue(r,'CANDIDATE_OBLIGATION'),`/candidateRequirements/${recordId(r,'candidateRequirements')}`,'STAGE03_CANDIDATE',{candidateRequirementId:recordId(r,'candidateRequirements'),sourceId:String(recordValue(r,'SOURCE_ID')||r.relationships?.SOURCE_ID||'')});const unique=[...new Map(items.map(x=>[x.obligationId,x])).values()],classification=project.stages?.[4]?.agentData?.OBLIGATION_ACCOUNTING,rows=safe(classification?.items||classification),byId=new Map(rows.map(x=>[String(x.obligationId||''),x])),allowed=new Set(['REQUIREMENT','RETAINED_CONTEXT','INAPPLICABLE','BLOCKED']),classified=unique.filter(x=>allowed.has(upper(byId.get(x.obligationId)?.disposition))).length,manifestSha256=hash.sha256Value({inputVersion:intake.inputVersion,sourceSetVersion:project.job.CURRENT_SOURCE_SET_VERSION||null,items:unique});return {schema:'closed-loop-obligation-manifest/1',manifestId:`OBLIGATION-${manifestSha256.slice(0,20).toUpperCase()}`,inputVersion:intake.inputVersion,sourceSetVersion:project.job.CURRENT_SOURCE_SET_VERSION||null,manifestSha256,items:unique,classifications:rows,classified,total:unique.length,coverage:unique.length?classified/unique.length:1,complete:unique.length===classified};}
function refreshAccountingManifests(project){ensureShape(project);const intake=buildIntakeCoverageManifest(project),obligations=buildObligationManifest(project);project.projectData.intakeCoverageManifests=[...safe(project.projectData.intakeCoverageManifests).filter(x=>x.manifestId!==intake.manifestId),intake];project.projectData.obligationManifests=[...safe(project.projectData.obligationManifests).filter(x=>x.manifestId!==obligations.manifestId),obligations];return {intake,obligations};}
function currentIntakeCoverageManifest(project){return buildIntakeCoverageManifest(project);}
function currentObligationManifest(project){return buildObligationManifest(project);}
'''
    marker='function operationalMetrics(project){'
    if marker not in t: raise SystemExit('engine accounting insertion marker missing')
    t=t.replace(marker,block+marker,1)
# Recalculate persists manifests; exports expose helpers.
if 'refreshAccountingManifests(project);' not in t:
    t=t.replace('function recalculate(project){\n  ensureShape(project);','function recalculate(project){\n  ensureShape(project);\n  refreshAccountingManifests(project);',1)
if 'buildIntakeCoverageManifest,currentIntakeCoverageManifest' not in t:
    t=t.replace('operationalNextAction,operationalMetrics,gate,deriveStageData','operationalNextAction,operationalMetrics,buildIntakeCoverageManifest,currentIntakeCoverageManifest,buildObligationManifest,currentObligationManifest,refreshAccountingManifests,gate,deriveStageData',1)
e.write_text(t)

# PROMPT: preserve stronger current-main one-time label; accounting block already merged from repair.
p=Path('prompt-engine.js'); t=p.read_text().replace('PERSISTED PROJECT INPUT\nEXACT_DELIVERABLE_REQUESTED:','ACCEPTED STAGE 01 JOB DEFINITION — CANONICAL INPUT, DO NOT ASK THE HUMAN TO RESEND IT\nEXACT_DELIVERABLE_REQUESTED:')
p.write_text(t)

# Assertions: no loss of current-main intent architecture and no visual sizing changes.
for path,needle in [('workflow-schema.js','intentStatements:recordSchema'),('prompt-engine.js','CONTROLLED INPUT ACCOUNTING MANIFEST'),('prompt-engine.js','STAGE 04 OBLIGATION MANIFEST'),('workflow-engine.js','STAGE01_INTENT_STATEMENT'),('workflow-engine.js','Stage 03 second conflict and exception pass is not complete.'),('index.html','.prompt{height:clamp(260px,45vh,520px)')]: ensure_contains(path,needle)
print('main-preserving v3 integration patch complete')
