from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)


# workbook.js: Stage 04 response accounting is agent-authored semantic classification.
path = "workbook.js"
text = read(path)
old = "4:['REQUIREMENTS_VERSION','REQUIREMENT_RECORDS','ATOMICITY_REVIEW_RESULTS','DEFINED_TERM_GAPS','TOTAL_REQUIREMENTS','MANDATORY_REQUIREMENTS','CONDITIONAL_REQUIREMENTS','OPTIONAL_REQUIREMENTS','BLOCKED_REQUIREMENTS','STAGE_DECISION','DECISION_EVIDENCE']"
new = "4:['REQUIREMENTS_VERSION','REQUIREMENT_RECORDS','ATOMICITY_REVIEW_RESULTS','DEFINED_TERM_GAPS','TOTAL_REQUIREMENTS','MANDATORY_REQUIREMENTS','CONDITIONAL_REQUIREMENTS','OPTIONAL_REQUIREMENTS','BLOCKED_REQUIREMENTS','OBLIGATION_ACCOUNTING','STAGE_DECISION','DECISION_EVIDENCE']"
if old in text:
    text = replace_once(text, old, new, "workbook Stage 04 fields")
elif new not in text:
    raise SystemExit("workbook Stage 04 field anchor missing")
ownership_start = text.index("const STAGE_OWNERSHIP=Object.freeze({")
ownership_text = text[ownership_start:]
m = re.search(r'(?s)(\n\s*"4"\s*:\s*\{.*?"agent"\s*:\s*\[)(.*?)(\]\s*,\s*"application"\s*:)', ownership_text)
if not m:
    raise SystemExit("Stage 04 ownership block not found")
agent = m.group(2)
if '"OBLIGATION_ACCOUNTING"' not in agent:
    stripped = agent.rstrip()
    if stripped and not stripped.rstrip().endswith(','):
        stripped += ','
    agent = stripped + '\n      "OBLIGATION_ACCOUNTING"\n    '
    ownership_text = ownership_text[:m.start(2)] + agent + ownership_text[m.end(2):]
    text = text[:ownership_start] + ownership_text
write(path, text)

# workflow-schema.js: closed Stage 04 accounting object array.
path = "workflow-schema.js"
text = read(path)
old = "  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})})\n});"
new = "  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})}),\n  '4':Object.freeze({OBLIGATION_ACCOUNTING:Object.freeze({valueType:'OBJECT_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:Object.freeze(['obligationId','disposition','requirementTempKeys','reason'])})})\n});"
if old in text:
    text = replace_once(text, old, new, "schema Stage 04 type override")
elif "'4':Object.freeze({OBLIGATION_ACCOUNTING:" not in text:
    raise SystemExit("schema type override anchor missing")
write(path, text)

# prompt-engine.js: make the exact machine accounting contract explicit.
path = "prompt-engine.js"
text = read(path)
old = "Every obligationId in that manifest must receive a valid semantic disposition and no obligation may disappear. Use the canonical Stage 01 intake/job definition, intentStatements, Stage 03 candidateRequirements, and legitimately applicable Stage 03 external-source research already supplied by the application."
new = "Every obligationId in that manifest must receive a valid semantic disposition and no obligation may disappear. In stageData.OBLIGATION_ACCOUNTING return exactly one object for every manifest obligationId. Each object must contain only obligationId, disposition, requirementTempKeys, and reason. disposition must be REQUIREMENT, RETAINED_NONNORMATIVE_CONTEXT, INAPPLICABLE, or BLOCKED. REQUIREMENT must name one or more requirement response tempKeys in requirementTempKeys; all other dispositions must use an empty requirementTempKeys array and a nonempty reason. Do not return unknown or duplicate obligationIds. Use the canonical Stage 01 intake/job definition, intentStatements, Stage 03 candidateRequirements, and legitimately applicable Stage 03 external-source research already supplied by the application."
if old in text:
    text = replace_once(text, old, new, "Stage 04 prompt accounting instructions")
elif "stageData.OBLIGATION_ACCOUNTING return exactly one object" not in text:
    raise SystemExit("prompt Stage 04 anchor missing")
write(path, text)

# response-ingestion.js: reject omission, duplication, unknown IDs and invalid mappings.
path = "response-ingestion.js"
text = read(path)
anchor = "    if(missing.length)issues.push(issue('MISSING_INTENT_STATEMENT_REQUIREMENT','/records/requirements',`Requirement coverage is missing for canonical intent statement(s): ${missing.join(', ')}.`));\n  }\n\n  if(envelope.responseType==='HUMAN_INPUT_REQUIRED'){"
block = """    if(missing.length)issues.push(issue('MISSING_INTENT_STATEMENT_REQUIREMENT','/records/requirements',`Requirement coverage is missing for canonical intent statement(s): ${missing.join(', ')}.`));
    const obligationManifest=workflow.stage04ObligationManifest(project),manifestIds=new Set(safe(obligationManifest?.entries).map(entry=>String(entry.obligationId||''))),accounting=safe(envelope.stageData?.OBLIGATION_ACCOUNTING),seenObligations=new Set(),requirementTempKeys=new Set(proposed.map(record=>String(record?.tempKey||'')).filter(Boolean)),allowedDispositions=new Set(['REQUIREMENT','RETAINED_NONNORMATIVE_CONTEXT','INAPPLICABLE','BLOCKED']);
    accounting.forEach((entry,index)=>{
      const path=`/stageData/OBLIGATION_ACCOUNTING/${index}`,keys=entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.keys(entry):[];
      if(!entry||typeof entry!=='object'||Array.isArray(entry)){issues.push(issue('INVALID_OBLIGATION_DISPOSITION',path,'Every obligation accounting entry must be an object.'));return;}
      const unknownKeys=keys.filter(key=>!['obligationId','disposition','requirementTempKeys','reason'].includes(key));if(unknownKeys.length)issues.push(issue('UNKNOWN_OBLIGATION_DISPOSITION_PROPERTY',path,`Unknown obligation accounting properties: ${unknownKeys.join(', ')}.`));
      const obligationId=String(entry.obligationId||'').trim(),disposition=String(entry.disposition||'').trim(),mapped=safe(entry.requirementTempKeys).map(value=>String(value||'').trim()).filter(Boolean),reason=String(entry.reason||'').trim();
      if(!manifestIds.has(obligationId))issues.push(issue('UNKNOWN_OBLIGATION_ID',`${path}/obligationId`,'obligationId must equal a current application-generated Stage 04 obligation identity.'));
      if(seenObligations.has(obligationId)&&obligationId)issues.push(issue('DUPLICATE_OBLIGATION_DISPOSITION',`${path}/obligationId`,`Obligation ${obligationId} appears more than once.`));else if(obligationId)seenObligations.add(obligationId);
      if(!allowedDispositions.has(disposition))issues.push(issue('INVALID_OBLIGATION_DISPOSITION',`${path}/disposition`,'Disposition must be REQUIREMENT, RETAINED_NONNORMATIVE_CONTEXT, INAPPLICABLE, or BLOCKED.'));
      if(disposition==='REQUIREMENT'){
        if(!mapped.length)issues.push(issue('MISSING_OBLIGATION_REQUIREMENT_MAPPING',`${path}/requirementTempKeys`,'REQUIREMENT disposition must map to one or more proposed requirement tempKeys.'));
        for(const tempKey of mapped)if(!requirementTempKeys.has(tempKey))issues.push(issue('INVALID_OBLIGATION_REQUIREMENT_MAPPING',`${path}/requirementTempKeys`,`Unknown proposed requirement tempKey ${tempKey}.`));
      }else if(allowedDispositions.has(disposition)){
        if(mapped.length)issues.push(issue('PROHIBITED_OBLIGATION_REQUIREMENT_MAPPING',`${path}/requirementTempKeys`,`${disposition} must not map to requirement tempKeys.`));
        if(!reason)issues.push(issue('MISSING_OBLIGATION_DISPOSITION_REASON',`${path}/reason`,`${disposition} requires a nonempty reason.`));
      }
    });
    const missingObligations=safe(obligationManifest?.entries).map(entry=>String(entry.obligationId||'')).filter(id=>id&&!seenObligations.has(id));
    if(missingObligations.length)issues.push(issue('MISSING_OBLIGATION_DISPOSITION','/stageData/OBLIGATION_ACCOUNTING',`Stage 04 obligation accounting is missing application-generated obligation(s): ${missingObligations.join(', ')}.`));
  }

  if(envelope.responseType==='HUMAN_INPUT_REQUIRED'){"""
if anchor in text:
    text = replace_once(text, anchor, block, "ingestion Stage 04 closure")
elif "MISSING_OBLIGATION_DISPOSITION" not in text:
    raise SystemExit("ingestion Stage 04 anchor missing")
write(path, text)

# workflow-engine.js: current Stage 04 gate independently verifies closure against current manifest.
path = "workflow-engine.js"
text = read(path)
old = "      const missingStatements=requiredStatementIds.filter(id=>!coveredIntentStatements.has(id));if(missingStatements.length)reasons.push(`Requirement coverage is missing for canonical intent statement(s): ${missingStatements.join(', ')}.`);\n      break;\n    }\n    case 5:"
new = "      const missingStatements=requiredStatementIds.filter(id=>!coveredIntentStatements.has(id));if(missingStatements.length)reasons.push(`Requirement coverage is missing for canonical intent statement(s): ${missingStatements.join(', ')}.`);\n      const obligationManifest=stage04ObligationManifest(project),accounting=safe(project.stages[4]?.agentData?.OBLIGATION_ACCOUNTING),accountedIds=new Set(accounting.map(entry=>String(entry?.obligationId||'')).filter(Boolean)),missingObligations=safe(obligationManifest?.entries).map(entry=>String(entry.obligationId||'')).filter(id=>id&&!accountedIds.has(id));if(missingObligations.length)reasons.push(`Stage 04 obligation accounting is missing application-generated obligation(s): ${missingObligations.join(', ')}.`);\n      break;\n    }\n    case 5:"
if old in text:
    text = replace_once(text, old, new, "engine Stage 04 gate")
elif "Stage 04 obligation accounting is missing application-generated obligation(s)" not in text:
    raise SystemExit("engine Stage 04 gate anchor missing")
write(path, text)

# Focused regression: the complete application manifest is larger than the two intent statements and omission fails.
path = "verify-one-time-intent-intake.mjs"
text = read(path)
text = replace_once(
    text,
    "function envelope(stage,prompt,records){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records,evidence:evidence(),unresolved:[],warnings:[],attachments:[]};}",
    "function envelope(stage,prompt,records,stageData={}){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData,records,evidence:evidence(),unresolved:[],warnings:[],attachments:[]};}",
    "test envelope stageData support",
)
old = "const p4={...prompts.buildPromptRecord(4,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(p4);\nprepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[requirement('requirement-1','INTENT-STATEMENT-000001')]})),promptRecord:p4});"
new = "const p4={...prompts.buildPromptRecord(4,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(p4);\nconst obligationManifest=engine.stage04ObligationManifest(p);assert(obligationManifest.entries.length>2,'Stage 04 fixture did not include the complete human-input plus intent obligation universe.');\nconst completeAccounting=obligationManifest.entries.map(entry=>{const id=String(entry.obligationId),statementId=String(entry.sourceIdentity||'');if(statementId==='INTENT-STATEMENT-000001')return {obligationId:id,disposition:'REQUIREMENT',requirementTempKeys:['requirement-1'],reason:''};if(statementId==='INTENT-STATEMENT-000002')return {obligationId:id,disposition:'REQUIREMENT',requirementTempKeys:['requirement-2'],reason:''};return {obligationId:id,disposition:'RETAINED_NONNORMATIVE_CONTEXT',requirementTempKeys:[],reason:'Retained as controlling project context in this focused fixture.'};});\nprepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[requirement('requirement-1','INTENT-STATEMENT-000001')]},{OBLIGATION_ACCOUNTING:completeAccounting})),promptRecord:p4});"
text = replace_once(text, old, new, "test Stage 04 manifest fixture")
old_generic = "prepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[generic,requirement('requirement-2','INTENT-STATEMENT-000002')]})),promptRecord:p4});"
new_generic = "prepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[generic,requirement('requirement-2','INTENT-STATEMENT-000002')]},{OBLIGATION_ACCOUNTING:completeAccounting})),promptRecord:p4});"
text = replace_once(text, old_generic, new_generic, "test generic relationship accounting")
old = "prepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[requirement('requirement-1','INTENT-STATEMENT-000001'),requirement('requirement-2','INTENT-STATEMENT-000002')]})),promptRecord:p4});\nassert(prepared.validation.valid,`Stage 04 complete canonical coverage was rejected: ${JSON.stringify(prepared.validation.issues)}`);"
new = "prepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[requirement('requirement-1','INTENT-STATEMENT-000001'),requirement('requirement-2','INTENT-STATEMENT-000002')]},{OBLIGATION_ACCOUNTING:completeAccounting.slice(0,-1)})),promptRecord:p4});\nassert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='MISSING_OBLIGATION_DISPOSITION'),'Stage 04 accepted incomplete application-generated obligation accounting.');\nprepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[requirement('requirement-1','INTENT-STATEMENT-000001'),requirement('requirement-2','INTENT-STATEMENT-000002')]},{OBLIGATION_ACCOUNTING:completeAccounting})),promptRecord:p4});\nassert(prepared.validation.valid,`Stage 04 complete canonical and obligation coverage was rejected: ${JSON.stringify(prepared.validation.issues)}`);"
text = replace_once(text, old, new, "test Stage 04 complete accounting")
write(path, text)

# Browser verifier: the corrupt import rejection is expected and must not be counted as an unexpected dialog.
path = "verify-browser-extra.mjs"
text = read(path)
old = "assert(cdp.dialogs.length===0,`Unexpected browser dialogs: ${cdp.dialogs.join(' | ')}`);"
new = "const expectedDialogs=new Set(['Import rejected without changing existing projects: Imported project identity or stage count is invalid.']);const unexpectedDialogs=cdp.dialogs.filter(message=>!expectedDialogs.has(message));assert(unexpectedDialogs.length===0,`Unexpected browser dialogs: ${unexpectedDialogs.join(' | ')}`);"
if old in text:
    text = replace_once(text, old, new, "browser expected dialog accounting")
elif "const unexpectedDialogs=cdp.dialogs.filter" not in text:
    raise SystemExit("browser final-dialog assertion anchor missing")
write(path, text)
