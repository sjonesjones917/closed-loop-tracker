from pathlib import Path
import re

# Reconcile only the missing Stage 01 application-owned accounting onto current main.
# Preserve current intentStatements, Stage 03 exhaustion, Stage 04 accounting, UI and CSS.

engine=Path('workflow-engine.js')
text=engine.read_text()

new_intake=r'''const INTAKE_CAPTURE_SCHEMA='closed-loop-intake-capture/1';
const INTAKE_DISPOSITIONS=Object.freeze(['INCORPORATED','RETAINED_CONTEXT','UNRESOLVED_HUMAN_ONLY','LATER_RESOLVABLE','INAPPLICABLE']);
const INTAKE_STATEMENT_CLASSES=Object.freeze(['FACT','REQUIREMENT','CONSTRAINT','DECISION','PROHIBITION','REQUESTED_OUTPUT','ACCEPTANCE_CONDITION','MATERIAL_REFERENCE','UNRESOLVED_HUMAN_ONLY','CONTEXT','ASSUMPTION','QUESTION','DEFINITION','DEPENDENCY','EXCEPTION','OTHER']);
function materialIntakeValue(value){if(value===undefined||value===null)return '';if(typeof value==='string')return value.trim();try{return JSON.stringify(value);}catch{return String(value);}}
function parsedInventoryUnits(value){const raw=materialIntakeValue(value);if(!raw)return [];let parsed;try{parsed=JSON.parse(raw);}catch{return [{location:'/job/SUPPLIED_MATERIALS_INVENTORY',label:raw,rawValue:raw}];}const list=Array.isArray(parsed)?parsed:[parsed];return list.map((item,index)=>{const rawValue=materialIntakeValue(item),label=typeof item==='string'?item:(item?.exactNameOrReference||item?.name||item?.filename||item?.title||rawValue);return {location:`/job/SUPPLIED_MATERIALS_INVENTORY/${index}`,label:String(label||rawValue),rawValue};}).filter(item=>item.rawValue);}
function intakeCoverageManifest(project){
  ensureShape(project);const inputVersion=String(project.job.CURRENT_INPUT_VERSION||'UNVERSIONED_INPUT'),units=[];
  const add=(fieldName,location,label,rawValue)=>{const raw=materialIntakeValue(rawValue);if(!raw)return;const rawValueSha256=hash.sha256Value(raw),unitId='INPUT-UNIT-'+hash.sha256Value({inputVersion,fieldName,location,rawValueSha256}).slice(0,24).toUpperCase();units.push({unitId,fieldName,source:'USER_JOB_INPUT',sourceLocation:location,label:String(label||fieldName),rawValue:raw,rawValueSha256});};
  for(const [name,definition] of Object.entries(schema.JOB_FIELDS||{})){if(!['HUMAN','HUMAN_DECISION'].includes(definition?.producer))continue;const value=project.job?.[name];if(name==='SUPPLIED_MATERIALS_INVENTORY'){for(const item of parsedInventoryUnits(value))add(name,item.location,item.label,item.rawValue);continue;}if(Array.isArray(value)){value.forEach((item,index)=>add(name,`/job/${name}/${index}`,name,item));continue;}add(name,`/job/${name}`,name,value);}
  for(const [index,answer] of safe(project.projectData?.humanInputAnswers).entries()){const value=answer?.answer??answer?.value??answer?.response;add('HUMAN_INPUT_ANSWER',`/projectData/humanInputAnswers/${index}`,String(answer?.answerId||answer?.requestId||`ANSWER-${index+1}`),value);}
  const seen=new Set(),deduped=units.filter(unit=>seen.has(unit.unitId)?false:(seen.add(unit.unitId),true));const coreManifest={schema:'closed-loop-intake-manifest/1',jobId:String(project.job.JOB_ID||''),inputVersion,units:deduped};return {...coreManifest,unitCount:deduped.length,manifestSha256:hash.sha256Value(coreManifest)};
}
function stage01IntakeManifest(project){const manifest=intakeCoverageManifest(project);return {schema:manifest.schema,jobId:manifest.jobId,inputVersion:manifest.inputVersion,entries:manifest.units.map(unit=>({inputId:unit.unitId,sourceKind:unit.source,sourceIdentity:unit.fieldName,location:unit.sourceLocation,rawValueHash:unit.rawValueSha256,value:clone(unit.rawValue)})),coverageDenominator:manifest.unitCount,manifestSha256:manifest.manifestSha256};}
function parseIntakeCapture(capture){if(capture&&typeof capture==='object'&&!Array.isArray(capture))return clone(capture);const raw=String(capture??'').trim();if(!raw)return null;try{return JSON.parse(raw);}catch{return null;}}
function evaluateIntakeCoverage(project,captureInput){
  const manifest=intakeCoverageManifest(project),capture=parseIntakeCapture(captureInput===undefined?project?.stages?.[1]?.agentData?.INPUT_SET_CONTENTS:captureInput),errors=[];
  if(!capture){return {complete:false,coverage:0,unitCount:manifest.unitCount,accountedCount:0,missingUnitIds:manifest.units.map(u=>u.unitId),errors:['INPUT_SET_CONTENTS is not valid closed-loop-intake-capture/1 JSON.'],manifest,capture:null};}
  const allowedRoot=new Set(['schema','inputVersion','manifestSha256','units','conversationStatements']);for(const key of Object.keys(capture))if(!allowedRoot.has(key))errors.push(`Unknown intake-capture property ${key}.`);
  if(capture.schema!==INTAKE_CAPTURE_SCHEMA)errors.push(`Intake capture schema must be ${INTAKE_CAPTURE_SCHEMA}.`);if(String(capture.inputVersion||'')!==manifest.inputVersion)errors.push('Intake capture inputVersion does not match the current controlled input version.');if(String(capture.manifestSha256||'')!==manifest.manifestSha256)errors.push('Intake capture manifestSha256 does not match the current application manifest.');
  const expected=new Set(manifest.units.map(u=>u.unitId)),seen=new Set();if(!Array.isArray(capture.units))errors.push('Intake capture units must be an array.');else for(const [index,unit] of capture.units.entries()){if(!unit||typeof unit!=='object'||Array.isArray(unit)){errors.push(`Intake capture unit ${index} is not an object.`);continue;}const allowed=new Set(['sourceUnitId','disposition','reason','extractedStatements']);for(const key of Object.keys(unit))if(!allowed.has(key))errors.push(`Unknown intake unit property ${key} at ${index}.`);const id=String(unit.sourceUnitId||'');if(!expected.has(id))errors.push(`Unknown controlled input unit ${id||'MISSING'}.`);else if(seen.has(id))errors.push(`Controlled input unit ${id} is duplicated.`);else seen.add(id);if(!INTAKE_DISPOSITIONS.includes(String(unit.disposition||'')))errors.push(`Controlled input unit ${id||index} has invalid disposition.`);if(!Array.isArray(unit.extractedStatements))errors.push(`Controlled input unit ${id||index} extractedStatements must be an array.`);else{if(['INCORPORATED','RETAINED_CONTEXT','UNRESOLVED_HUMAN_ONLY','LATER_RESOLVABLE'].includes(String(unit.disposition||''))&&!unit.extractedStatements.length)errors.push(`Controlled input unit ${id||index} has no meaning-preserving extracted statement.`);const statementKeys=new Set();for(const statement of unit.extractedStatements){if(!statement||typeof statement!=='object'||Array.isArray(statement)){errors.push(`Controlled input unit ${id||index} contains an invalid extracted statement.`);continue;}const allowedStatement=new Set(['statementKey','text','statementClass']);for(const key of Object.keys(statement))if(!allowedStatement.has(key))errors.push(`Unknown extracted-statement property ${key} for ${id||index}.`);const sk=String(statement.statementKey||'').trim();if(!sk||statementKeys.has(sk))errors.push(`Controlled input unit ${id||index} has a missing or duplicate statementKey.`);statementKeys.add(sk);if(!String(statement.text||'').trim())errors.push(`Controlled input unit ${id||index} has an empty extracted statement.`);if(!INTAKE_STATEMENT_CLASSES.includes(String(statement.statementClass||'')))errors.push(`Controlled input unit ${id||index} has invalid statementClass.`);}}if(unit.disposition==='INAPPLICABLE'&&!String(unit.reason||'').trim())errors.push(`Controlled input unit ${id||index} marked INAPPLICABLE requires a reason.`);}
  if(capture.conversationStatements!==undefined){if(!Array.isArray(capture.conversationStatements))errors.push('conversationStatements must be an array when present.');else for(const [index,statement] of capture.conversationStatements.entries()){const allowed=new Set(['statementKey','question','text','statementClass','status']);if(!statement||typeof statement!=='object'||Array.isArray(statement)){errors.push(`conversationStatements ${index} is invalid.`);continue;}for(const key of Object.keys(statement))if(!allowed.has(key))errors.push(`Unknown conversation statement property ${key} at ${index}.`);if(!String(statement.statementKey||'').trim()||!String(statement.text||'').trim())errors.push(`conversationStatements ${index} requires statementKey and text.`);if(!INTAKE_STATEMENT_CLASSES.includes(String(statement.statementClass||'')))errors.push(`conversationStatements ${index} has invalid statementClass.`);if(!['ANSWERED','UNKNOWN','DEFERRED'].includes(String(statement.status||'')))errors.push(`conversationStatements ${index} has invalid status.`);}}
  const missing=manifest.units.map(u=>u.unitId).filter(id=>!seen.has(id));if(missing.length)errors.push(`Controlled input units omitted from Stage 01 capture: ${missing.join(', ')}.`);const accountedCount=manifest.unitCount-missing.length;return {complete:errors.length===0&&accountedCount===manifest.unitCount,coverage:manifest.unitCount?accountedCount/manifest.unitCount:1,unitCount:manifest.unitCount,accountedCount,missingUnitIds:missing,errors,manifest,capture};
}
'''
pattern=r"function stage01IntakeManifest\(project\)\{.*?\n\}\nfunction stage04ObligationManifest\(project\)\{"
match=re.search(pattern,text,re.S)
if not match: raise SystemExit('stage01/stage04 manifest boundary missing')
text=text[:match.start()]+new_intake+"function stage04ObligationManifest(project){"+text[match.end():]
# Stage 04 must consume the semantic capture, but retain current canonical intentStatements and newer mainline research logic.
old="for(const item of stage01IntakeManifest(project).entries)add('HUMAN_INPUT',item.inputId,item.location,item.value);\n  for(const fieldName of ['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'])add('STAGE01_JOB_DEFINITION','STAGE-01',fieldName,project.job?.[fieldName]);"
new="for(const unit of intakeCoverageManifest(project).units)add('HUMAN_INPUT',unit.unitId,unit.sourceLocation,unit.rawValue);\n  const intake=evaluateIntakeCoverage(project),capture=intake.capture;if(capture){for(const unit of safe(capture.units))for(const statement of safe(unit.extractedStatements))add('STAGE01_CAPTURE',`${unit.sourceUnitId}:${statement.statementKey}`,statement.statementKey,statement.text);for(const statement of safe(capture.conversationStatements))add('STAGE01_CONVERSATION',statement.statementKey,statement.question||statement.statementKey,statement.text);}\n  for(const fieldName of ['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION'])add('STAGE01_JOB_DEFINITION','STAGE-01',fieldName,project.job?.[fieldName]);"
if old not in text: raise SystemExit('stage04 human/stage01 union anchor missing')
text=text.replace(old,new,1)
# Stage 01 gate must reject incomplete accounting in addition to existing canonical intent-statement checks.
gate_anchor="case 1:{"
pos=text.find(gate_anchor)
if pos<0: raise SystemExit('stage1 gate anchor missing')
insert="case 1:{const intakeAccounting=evaluateIntakeCoverage(project);if(!intakeAccounting.complete)reasons.push(...intakeAccounting.errors.map(reason=>'Stage 01 intake accounting: '+reason));"
text=text[:pos]+insert+text[pos+len(gate_anchor):]
# Export the strict accounting helpers while retaining existing aliases used by current main.
export_old="operationalNextAction,stage01IntakeManifest,stage04ObligationManifest,operationalMetrics"
export_new="operationalNextAction,intakeCoverageManifest,evaluateIntakeCoverage,stage01IntakeManifest,stage04ObligationManifest,operationalMetrics"
if export_old not in text: raise SystemExit('workflow export anchor missing')
text=text.replace(export_old,export_new,1)
engine.write_text(text)

prompt=Path('prompt-engine.js'); ptext=prompt.read_text()
ptext=ptext.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/27';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/28';",1)
# Add the application manifest and exact classification contract without removing newer one-time intentStatements behavior.
proc_anchor="1:'ONE-TIME INTENT FILE INTAKE:"
proc_prefix="1:'APPLICATION-OWNED INTAKE ACCOUNTING: Before final Stage 01 JSON, account for every identity in APPLICATION INTAKE MANIFEST exactly once. INPUT_SET_CONTENTS must be a JSON string using schema closed-loop-intake-capture/1 with exact root keys schema, inputVersion, manifestSha256, units, and optional conversationStatements. units must contain exactly one object for every manifest unit with only sourceUnitId, disposition, reason, extractedStatements. Allowed dispositions: INCORPORATED, RETAINED_CONTEXT, UNRESOLVED_HUMAN_ONLY, LATER_RESOLVABLE, INAPPLICABLE. Every non-inapplicable unit must contain at least one meaning-preserving extractedStatements entry with only statementKey, text, statementClass. Allowed statementClass values: FACT, REQUIREMENT, CONSTRAINT, DECISION, PROHIBITION, REQUESTED_OUTPUT, ACCEPTANCE_CONDITION, MATERIAL_REFERENCE, UNRESOLVED_HUMAN_ONLY, CONTEXT, ASSUMPTION, QUESTION, DEFINITION, DEPENDENCY, EXCEPTION, OTHER. Never omit a manifest identity. This accounting complements, and does not replace, the canonical intentStatements ledger. ONE-TIME INTENT FILE INTAKE:"
if proc_anchor not in ptext: raise SystemExit('stage1 prompt procedure anchor missing')
ptext=ptext.replace(proc_anchor,proc_prefix,1)
# Supply exact application manifest to the agent; this is the set ingestion later verifies.
ctx_anchor="function contextFor(stage,state,operation,scope={}){\n const parts=[];"
ctx_new="function contextFor(stage,state,operation,scope={}){\n const parts=[];\n if(stage===1)parts.push('APPLICATION INTAKE MANIFEST\\n'+show(workflow.intakeCoverageManifest(state)));"
if ctx_anchor not in ptext: raise SystemExit('prompt context anchor missing')
ptext=ptext.replace(ctx_anchor,ctx_new,1)
prompt.write_text(ptext)

ingest=Path('response-ingestion.js'); itext=ingest.read_text()
# Fail closed before proposal creation when Stage 01 omits or invents controlled input identities.
anchor="  if(envelope.responseType==='DATA_PROPOSAL'&&stageNumber===4){"
block="""  if(envelope.responseType==='DATA_PROPOSAL'&&stageNumber===1){
    const accounting=workflow.evaluateIntakeCoverage(project,envelope.stageData?.INPUT_SET_CONTENTS);
    for(const message of accounting.errors)issues.push(issue('INCOMPLETE_INTAKE_ACCOUNTING','/stageData/INPUT_SET_CONTENTS',message));
  }

"""
if anchor not in itext: raise SystemExit('Stage 4 ingestion anchor missing')
if 'INCOMPLETE_INTAKE_ACCOUNTING' not in itext: itext=itext.replace(anchor,block+anchor,1)
ingest.write_text(itext)
