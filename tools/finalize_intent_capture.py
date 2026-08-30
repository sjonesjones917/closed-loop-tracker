from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def replace_once(text, old, new, label):
    require(old in text, f"missing anchor: {label}")
    return text.replace(old, new, 1)


# The implementation/full-spec-repair144 branch is the functional /3 base.
# This script only closes the user-intent / Stage 03 / Stage 04 zero-loss defects
# and restores the existing main visual shell without redesigning it.

# ---- workbook ----
t = read("workbook.js")
t = t.replace("const PROJECT_SCHEMA='closed-loop-project/2';", "const PROJECT_SCHEMA='closed-loop-project/3';")
t = t.replace("'REVISE THE RESPONSIBLE LAYER'", "'CORRECT THE ROOT CAUSE'")
write("workbook.js", t)

# ---- schema ownership/version ----
t = read("workflow-schema.js")
t = t.replace("const RESPONSE_SCHEMA='closed-loop-stage-response/2';", "const RESPONSE_SCHEMA='closed-loop-stage-response/3';")
t = t.replace("  'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',", "  'EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',")
if "const HUMAN_DECISION_JOB_FIELDS" not in t:
    t = replace_once(t, "const APPLICATION_JOB_FIELDS=Object.freeze([", "const HUMAN_DECISION_JOB_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER']);\nconst APPLICATION_JOB_FIELDS=Object.freeze([", "human decision job field declaration")
if "HUMAN_DECISION_JOB_FIELDS.includes(name)" not in t:
    t = replace_once(t, "function jobFieldDefinition(name){\n  if(APPLICATION_JOB_FIELDS.includes(name))", "function jobFieldDefinition(name){\n  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{provenanceRequired:false,nullable:true});\n  if(APPLICATION_JOB_FIELDS.includes(name))", "human decision job field producer")
t = t.replace("[...new Set([...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])].map", "[...new Set([...HUMAN_JOB_FIELDS,...HUMAN_DECISION_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])].map")
t = t.replace("JOB_FIELDS,HUMAN_JOB_FIELDS,APPLICATION_JOB_FIELDS,AGENT_JOB_FIELDS,HUMAN_INTAKE_FIELDS,", "JOB_FIELDS,HUMAN_JOB_FIELDS,HUMAN_DECISION_JOB_FIELDS,APPLICATION_JOB_FIELDS,AGENT_JOB_FIELDS,HUMAN_INTAKE_FIELDS,")
write("workflow-schema.js", t)

# ---- engine manifests, closure and stage gates ----
t = read("workflow-engine.js")
if "function stage1IntakeManifest(project)" not in t:
    anchor = "function unresolvedHumanRequests(project,stage){"
    require(anchor in t, "workflow-engine intake insertion anchor missing")
    helpers = r'''function manifestUnitId(prefix,payload){return prefix+'-'+hash.sha256Value(payload).slice(0,20).toUpperCase();}
function stage1IntakeManifest(project){
  ensureShape(project);
  const inputVersion=String(project.job.CURRENT_INPUT_VERSION||'UNVERSIONED'),units=[];
  for(const [name,definition] of Object.entries(schema.JOB_FIELDS||{})){
    if(definition?.producer!=='HUMAN')continue;
    const value=project.job?.[name];
    if(value===undefined||value===null||String(value).trim()==='')continue;
    const rawValueHash=hash.sha256Value(value),sourceLocation='job.'+name;
    units.push({inputUnitId:manifestUnitId('INPUT-UNIT',{inputVersion,sourceLocation,rawValueHash}),sourceLocation,rawValueHash,value:clone(value)});
  }
  for(const answer of safe(project.projectData.humanInputAnswers).filter(x=>!x.invalidatedBy&&String(x.inputVersion||inputVersion)===inputVersion)){
    const value=answer.value??answer.answer??answer.response;
    if(value===undefined||value===null||String(value).trim()==='')continue;
    const sourceLocation='humanInputAnswer.'+String(answer.answerId||answer.requestId||units.length+1),rawValueHash=hash.sha256Value(value);
    units.push({inputUnitId:manifestUnitId('INPUT-UNIT',{inputVersion,sourceLocation,rawValueHash}),sourceLocation,rawValueHash,value:clone(value)});
  }
  for(const artifact of records(project,'artifacts',{active:true}).filter(a=>String(recordValue(a,'ROLE')||recordValue(a,'role')||'').toUpperCase().includes('INPUT')||String(recordValue(a,'ROLE')||recordValue(a,'role')||'').toUpperCase().includes('INTENT'))){
    const artifactId=recordId(artifact,'artifacts'),value={artifactId,filename:recordValue(artifact,'FILENAME')||recordValue(artifact,'filename')||'',sha256:recordValue(artifact,'SHA256')||recordValue(artifact,'sha256')||'',availability:recordValue(artifact,'AVAILABILITY')||recordValue(artifact,'availability')||''},sourceLocation='artifact.'+artifactId,rawValueHash=hash.sha256Value(value);
    units.push({inputUnitId:manifestUnitId('INPUT-UNIT',{inputVersion,sourceLocation,rawValueHash}),sourceLocation,rawValueHash,value});
  }
  return {schema:'closed-loop-intake-manifest/1',inputVersion,units,unitCount:units.length,manifestSha256:hash.sha256Value({inputVersion,units:units.map(({inputUnitId,sourceLocation,rawValueHash})=>({inputUnitId,sourceLocation,rawValueHash}))})};
}
function stage4ObligationManifest(project){
  ensureShape(project);
  const inputVersion=String(project.job.CURRENT_INPUT_VERSION||'UNVERSIONED'),items=[];
  const push=(origin,sourceLocation,content,extra={})=>{if(content===undefined||content===null||String(content).trim()===''||['NONE','NOT APPLICABLE'].includes(upper(content)))return;const contentSha256=hash.sha256Value(content);items.push({obligationId:manifestUnitId('OBLIGATION',{inputVersion,origin,sourceLocation,contentSha256}),origin,sourceLocation,contentSha256,content:clone(content),...extra});};
  for(const unit of stage1IntakeManifest(project).units)push('HUMAN_INPUT',unit.sourceLocation,unit.value,{inputUnitId:unit.inputUnitId});
  const s1=project.stages?.[1]?.agentData||project.stages?.[1]?.acceptedData||{};
  for(const key of ['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'])push('STAGE_01','stage1.'+key,s1[key]);
  for(const record of recordsForCurrentScope(project,'research')){
    const rid=recordId(record,'research');
    for(const key of ['MANDATORY_STATEMENTS','RECOMMENDATIONS','OPTIONAL_PRACTICES','EXAMPLES','EXPLANATORY_MATERIAL','PROHIBITIONS','EXCEPTIONS','DEPENDENCIES','APPLICABILITY_FACTS','RESTRICTIONS','INVALIDATING_MATERIAL'])push('STAGE_03_RESEARCH',rid+'.'+key,recordValue(record,key),{researchId:rid,sourceId:String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||'')});
  }
  for(const record of recordsForCurrentScope(project,'candidateRequirements')){
    const cid=recordId(record,'candidateRequirements');
    push('STAGE_03_CANDIDATE',cid+'.CANDIDATE_OBLIGATION',recordValue(record,'CANDIDATE_OBLIGATION'),{candidateRequirementId:cid,sourceId:String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||'')});
  }
  return {schema:'closed-loop-obligation-manifest/1',inputVersion,sourceSetVersion:project.job.CURRENT_SOURCE_SET_VERSION||null,items,itemCount:items.length,manifestSha256:hash.sha256Value(items.map(({obligationId,origin,sourceLocation,contentSha256})=>({obligationId,origin,sourceLocation,contentSha256})))};
}
function parseAccountingString(value,label){try{const parsed=JSON.parse(String(value||''));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('root must be an object');return {parsed,reasons:[]};}catch(error){return {parsed:null,reasons:[label+' must be a JSON string using the required accounting structure: '+error.message]};}}
function validateStage1IntakeAccounting(value,manifest){
  const reasons=[],result=parseAccountingString(value,'Stage 01 INPUT_SET_CONTENTS');if(!result.parsed)return {valid:false,reasons:result.reasons};
  const rows=safe(result.parsed.coverage),expected=safe(manifest?.units).map(x=>x.inputUnitId),seen=new Map(),allowed=new Set(['INCORPORATED','CONTEXT','UNRESOLVED_HUMAN_ONLY','LATER_RESOLVABLE','INAPPLICABLE']);
  for(const row of rows){const id=String(row?.inputUnitId||'');seen.set(id,(seen.get(id)||0)+1);if(!allowed.has(upper(row?.disposition)))reasons.push('Invalid Stage 01 disposition for '+(id||'UNKNOWN')+'.');if(upper(row?.disposition)==='INAPPLICABLE'&&!String(row?.reason||'').trim())reasons.push('Stage 01 INAPPLICABLE disposition for '+id+' requires a reason.');}
  for(const id of expected)if(seen.get(id)!==1)reasons.push('Stage 01 intake unit '+id+' must be accounted for exactly once.');for(const id of seen.keys())if(id&&!expected.includes(id))reasons.push('Stage 01 accounting contains unknown input unit '+id+'.');
  return {valid:reasons.length===0,reasons,expectedCount:expected.length,accountedCount:expected.filter(id=>seen.get(id)===1).length};
}
function validateStage4ObligationAccounting(value,manifest,requirementRecords=[]){
  const reasons=[],result=parseAccountingString(value,'Stage 04 ATOMICITY_REVIEW_RESULTS');if(!result.parsed)return {valid:false,reasons:result.reasons};
  const rows=safe(result.parsed.obligationAccounting),expected=safe(manifest?.items).map(x=>x.obligationId),seen=new Map(),allowed=new Set(['REQUIREMENT','CONTEXT','INAPPLICABLE','BLOCKED']);
  for(const row of rows){const id=String(row?.obligationId||'');seen.set(id,(seen.get(id)||0)+1);const disposition=upper(row?.disposition);if(!allowed.has(disposition))reasons.push('Invalid Stage 04 disposition for '+(id||'UNKNOWN')+'.');if(disposition==='REQUIREMENT'&&!safe(requirementRecords).some(r=>JSON.stringify(r?.fields||r||{}).includes(id)))reasons.push('Stage 04 obligation '+id+' is classified as REQUIREMENT but no proposed requirement traces to that identity.');if(['INAPPLICABLE','BLOCKED'].includes(disposition)&&!String(row?.reason||'').trim())reasons.push('Stage 04 '+disposition+' disposition for '+id+' requires a reason.');}
  for(const id of expected)if(seen.get(id)!==1)reasons.push('Stage 04 obligation '+id+' must be accounted for exactly once.');for(const id of seen.keys())if(id&&!expected.includes(id))reasons.push('Stage 04 accounting contains unknown obligation '+id+'.');
  return {valid:reasons.length===0,reasons,expectedCount:expected.length,accountedCount:expected.filter(id=>seen.get(id)===1).length};
}

'''
    t=t.replace(anchor,helpers+anchor,1)

# Stage 1 gate must fail closed on incomplete accounting.
old="""      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      requireAccepted();
      const latest=changes.at(-1),confirmed=safe(project.projectData.stageConfirmations).some(item=>Number(item.stage)===1&&item.confirmed===true&&!item.invalidatedBy&&item.acceptedChangeId===latest?.changeId&&item.inputVersion===project.job.CURRENT_INPUT_VERSION);"""
if old in t:
    new="""      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      requireAccepted();
      for(const key of ['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'])if(!String(project.stages[1]?.agentData?.[key]??project.stages[1]?.acceptedData?.[key]??'').trim())reasons.push('Stage 01 '+key+' is required.');
      const latest=changes.at(-1),stage1Prompt=safe(project.projectData.generatedPrompts).find(p=>(p.instructionId||p.promptId)===latest?.promptId),intakeCheck=validateStage1IntakeAccounting(project.stages[1]?.agentData?.INPUT_SET_CONTENTS??project.stages[1]?.acceptedData?.INPUT_SET_CONTENTS,stage1Prompt?.contextManifest?.intakeManifest||stage1IntakeManifest(project));if(!intakeCheck.valid)reasons.push(...intakeCheck.reasons);
      const confirmed=safe(project.projectData.stageConfirmations).some(item=>Number(item.stage)===1&&item.confirmed===true&&!item.invalidatedBy&&item.acceptedChangeId===latest?.changeId&&item.inputVersion===project.job.CURRENT_INPUT_VERSION);"""
    t=t.replace(old,new,1)

# Stage 3 gate: every current source covered; semantic categories explicitly checked; saturation proven.
old3="""      requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);break;"""
if old3 in t:
    new3="""      requireCount('research',1);const researchRows=collection('research'),researched=new Set(researchRows.map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);for(const row of researchRows){const rid=recordId(row,'research');for(const key of ['MANDATORY_STATEMENTS','RECOMMENDATIONS','OPTIONAL_PRACTICES','EXAMPLES','EXPLANATORY_MATERIAL','PROHIBITIONS','EXCEPTIONS','DEPENDENCIES','APPLICABILITY_FACTS','RESTRICTIONS','INVALIDATING_MATERIAL','SATURATION_STATUS'])if(!String(recordValue(row,key)||'').trim())reasons.push(rid+': '+key+' must be explicitly populated, using NONE when exhaustively checked and absent.');const saturation=upper(recordValue(row,'SATURATION_STATUS'));if(!['SATURATED','COMPLETE','NO NEW MATERIAL','NO NEW MATERIAL FOUND'].includes(saturation))reasons.push(rid+': research is not demonstrated saturated.');}if(!truth(project.stages[3]?.agentData?.ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED))reasons.push('Stage 03 must affirm that all current controlling sources were examined.');if(!truth(project.stages[3]?.agentData?.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED))reasons.push('Stage 03 requires the second conflict and exception pass.');break;"""
    t=t.replace(old3,new3,1)

# Stage 4 defense in depth.
marker="""    case 4:{
      requireAccepted();requireCount('requirements',1);"""
if marker in t and "stage4Prompt=" not in t:
    repl="""    case 4:{
      requireAccepted();requireCount('requirements',1);
      const latest4=changes.at(-1),stage4Prompt=safe(project.projectData.generatedPrompts).find(p=>(p.instructionId||p.promptId)===latest4?.promptId),obligationCheck=validateStage4ObligationAccounting(project.stages[4]?.agentData?.ATOMICITY_REVIEW_RESULTS??project.stages[4]?.acceptedData?.ATOMICITY_REVIEW_RESULTS,stage4Prompt?.contextManifest?.obligationManifest||stage4ObligationManifest(project),collection('requirements'));if(!obligationCheck.valid)reasons.push(...obligationCheck.reasons);"""
    t=t.replace(marker,repl,1)

# Export helpers.
export_anchor="ensureShape,addHistory,allocateId,allocateInfrastructureId,nextVersion,registerStageVersion,"
if "stage1IntakeManifest,stage4ObligationManifest" not in t:
    require(export_anchor in t, "workflow-engine export anchor missing")
    t=t.replace(export_anchor,export_anchor+"stage1IntakeManifest,stage4ObligationManifest,validateStage1IntakeAccounting,validateStage4ObligationAccounting,",1)
write("workflow-engine.js", t)

# ---- prompt authority ----
t=read("prompt-engine.js")
t=re.sub(r"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/\d+';", "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/31';", t, count=1)

# Replace only stages 1, 3, 4; preserve every other stage instruction verbatim.
start=t.index("const procedures={")
end=t.index("\n};",start)
block=t[start:end+3]

def replace_stage(block,n,text):
    nextn=n+1
    if n<30:
        pattern=rf"\n{n}:'[\s\S]*?',\n{nextn}:'"
        replacement="\n"+str(n)+":"+repr(text).replace('\\x27',"'")+",\n"+str(nextn)+":'"
        # repr uses single quotes; strip exactly one outside pair.
        replacement="\n"+str(n)+":"+repr(text)+",\n"+str(nextn)+":'"
        out,count=re.subn(pattern,replacement,block,count=1)
        require(count==1,f"prompt procedure stage {n} replacement failed")
        return out
    raise AssertionError

p1=("Stage 01 is COMPLETE HUMAN-AUTHORITY INTAKE. Exhaust the user intent before Stage 01 can complete. Capture every human-supplied fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and foreseeable unresolved human-only issue relevant to defining the requested outcome. Never reduce the request to a generic summary that loses details. Inspect every supplied artifact whose bytes are actually available deeply enough to extract all human-authority statements relevant to job definition, but do not perform Stage 02 research, requirement atomization, test design, or production. Ask only genuinely human-only questions. Never ask for information already present in User Job Input, an available supplied artifact, a prior answer, or canonical project memory. Classify unresolved issues as BLOCKING_NOW, ASK_NOW_NONBLOCKING, or LATER_RESOLVABLE. Before final JSON, account for EVERY INPUT UNIT ID in the APPLICATION INTAKE COVERAGE MANIFEST exactly once. INPUT_SET_CONTENTS MUST be a JSON string with shape {\"coverage\":[{\"inputUnitId\":\"INPUT-UNIT-...\",\"disposition\":\"INCORPORATED|CONTEXT|UNRESOLVED_HUMAN_ONLY|LATER_RESOLVABLE|INAPPLICABLE\",\"reason\":\"...\"}],\"summary\":\"...\"}. Do not omit an ID. The application rejects incomplete accounting. Preserve the exact requested deliverable; do not downgrade it merely because a downstream viewing or execution tool is unavailable. Return HUMAN_INPUT_REQUIRED only for a genuinely human-only blocking question that remains unanswered after conversational clarification. Otherwise return a complete DATA_PROPOSAL.")
p3=("Exhaustively research every current accepted Stage 02 independent external source, source-by-source and pass-by-pass, until saturation is supported. For EACH source explicitly populate mandatory statements, recommendations, optional practices, examples, explanatory material, prohibitions, exceptions, dependencies, applicability facts, restrictions, invalidating material, conflicts, source evidence, and candidate obligations; use NONE when a category was checked and absent rather than silently omitting it. Perform the required second conflict-and-exception pass. Do not mark Stage 03 complete until all current sources have coverage, all categories were checked, and SATURATION_STATUS is established for every research record. Do not treat target implementation artifacts as independent authority.")
p4=("Compile the requirement specification ONLY from the complete APPLICATION OBLIGATION MANIFEST and the complete canonical input union supplied in this prompt. The application has already captured and versioned the human-authority information supplied earlier. Use that project memory. NEVER ask the human to reattach, resend, retype, restate, reconstruct, or summarize the original intent file or any project information already captured. Stage 04 must consume every detail from current User Job Input, accepted Stage 01, accessible supplied-material obligations, accepted Stage 03 research, candidate external-source obligations, source identities, and evidence. If an earlier stage is incomplete, return BLOCKED with INADEQUATE_PRIOR_OUTPUT naming the earliest responsible stage; do not make the user supply the same information again. For EVERY OBLIGATION ID, provide exactly one accounting disposition and never let an obligation disappear. ATOMICITY_REVIEW_RESULTS MUST be a JSON string with shape {\"obligationAccounting\":[{\"obligationId\":\"OBLIGATION-...\",\"disposition\":\"REQUIREMENT|CONTEXT|INAPPLICABLE|BLOCKED\",\"reason\":\"...\"}],\"atomicityReview\":\"...\"}. Every REQUIREMENT disposition must trace that exact obligationId in the proposed requirement fields. Split compound obligations into atomic independently testable requirements and preserve provenance, applicability, dependencies, prohibitions, defined terms, observable satisfaction condition, intended verification method, expected evidence, failure condition, severity, and notes. The application assigns canonical IDs, versions, hashes, counts, and scope.")
# Avoid Python repr escape behavior by a dedicated exact record parser.
def sub_proc(src,n,value):
    pattern=rf"(^|\n){n}:'((?:\\.|[^'])*)',\n{n+1}:'"
    escaped=value.replace('\\','\\\\').replace("'","\\'")
    repl=("\\1"+str(n)+":'"+escaped+"',\n"+str(n+1)+":'")
    out,count=re.subn(pattern,lambda m:m.group(1)+str(n)+":'"+escaped+"',\n"+str(n+1)+":'",src,count=1)
    require(count==1,f"stage {n} procedure anchor missing")
    return out
block=sub_proc(block,1,p1)
block=sub_proc(block,3,p3)
block=sub_proc(block,4,p4)
t=t[:start]+block+t[end+3:]

# The task must be presented before project data; data is context, not the instruction.
if "YOUR TASK — DO THIS NOW" not in t:
    old="STAGE-SPECIFIC TASK\n${procedures[stage]}\n\n"
    if old in t:t=t.replace(old,"",1)
    anchor="PROJECT-SCOPE BOUNDARY\n"
    require(anchor in t,"prompt task-first anchor missing")
    lead="YOUR TASK — DO THIS NOW\n${procedures[stage]}\n\nCONTEXT AND PROJECT-DATA RULE\nThe task above is controlling. Everything below is bounded current project DATA/EVIDENCE. Use every relevant captured fact. Never ask the human to repeat information already present in canonical context or verified application custody. Missing information that should have been captured is MISSING_APPLICATION_CONTEXT or INADEQUATE_PRIOR_OUTPUT, not a new user re-entry request.\n\nPROJECT-SCOPE BOUNDARY\n"
    t=t.replace(anchor,lead,1)

# Stage-specific complete manifests and canonical memory.
context_anchor="function contextFor(stage,state,operation,scope={}){\n const parts=[];"
if "STAGE 04 COMPLETE CANONICAL INPUT UNION" not in t:
    require(context_anchor in t,"prompt contextFor anchor missing")
    insertion="""function contextFor(stage,state,operation,scope={}){
 const parts=[];
 if(stage===1){const intakeManifest=workflow.stage1IntakeManifest(state);parts.push(`APPLICATION INTAKE COVERAGE MANIFEST — ACCOUNT FOR EVERY ID\n${show(intakeManifest)}`);}
 if(stage===4){const obligationManifest=workflow.stage4ObligationManifest(state),s1=state?.stages?.[1]||{},s3=state?.stages?.[3]||{};parts.push(`STAGE 04 COMPLETE CANONICAL INPUT UNION — DO NOT ASK THE USER TO RESUPPLY IT\nCURRENT USER JOB INPUT\n${humanInputBlock(state?.job||{})}\n\nACCEPTED STAGE 01 JOB DEFINITION\n${show({agentData:s1.agentData||s1.acceptedData||{},humanData:s1.humanData||{},derivedData:s1.derivedData||{}})}\n\nACCEPTED STAGE 03 RESEARCH\n${show({agentData:s3.agentData||s3.acceptedData||{},research:workflow.recordsForCurrentScope(state,'research'),candidateRequirements:workflow.recordsForCurrentScope(state,'candidateRequirements'),sources:workflow.recordsForCurrentScope(state,'sources')})}\n\nAPPLICATION OBLIGATION MANIFEST — ACCOUNT FOR EVERY ID\n${show(obligationManifest)}`);}
"""
    t=t.replace(context_anchor,insertion,1)

# Bind manifests into prompt identity/context signature.
cm="contextManifest={stage,operation,scope,verificationBatchPlan:batchPlan,executionHandoff:promptHandoff,"
if "intakeManifest:stage===1" not in t:
    require(cm in t,"prompt context manifest anchor missing")
    t=t.replace(cm,"contextManifest={stage,operation,scope,intakeManifest:stage===1?workflow.stage1IntakeManifest(state):null,obligationManifest:stage===4?workflow.stage4ObligationManifest(state):null,verificationBatchPlan:batchPlan,executionHandoff:promptHandoff,",1)
write("prompt-engine.js",t)

# ---- ingestion: reject incomplete semantic accounting before canonical mutation ----
t=read("response-ingestion.js")
anchor="  const canonicalEnvelopeSha256=hash.canonicalEnvelopeSha256(envelope);"
if "INCOMPLETE_STAGE_01_INTAKE_ACCOUNTING" not in t:
    require(anchor in t,"ingestion accounting insertion anchor missing")
    checks="""  if(stageNumber===1&&envelope.responseType==='DATA_PROPOSAL'){const result=workflow.validateStage1IntakeAccounting(envelope.stageData?.INPUT_SET_CONTENTS,promptRecord?.contextManifest?.intakeManifest||workflow.stage1IntakeManifest(project));for(const reason of result.reasons)issues.push(issue('INCOMPLETE_STAGE_01_INTAKE_ACCOUNTING','/stageData/INPUT_SET_CONTENTS',reason));}
  if(stageNumber===4&&envelope.responseType==='DATA_PROPOSAL'){const result=workflow.validateStage4ObligationAccounting(envelope.stageData?.ATOMICITY_REVIEW_RESULTS,promptRecord?.contextManifest?.obligationManifest||workflow.stage4ObligationManifest(project),safe(envelope.records?.requirements));for(const reason of result.reasons)issues.push(issue('INCOMPLETE_STAGE_04_OBLIGATION_ACCOUNTING','/stageData/ATOMICITY_REVIEW_RESULTS',reason));}

"""
    t=t.replace(anchor,checks+anchor,1)
write("response-ingestion.js",t)

# ---- UI: Stage 04 never asks user to reattach intent; preserve all other UI ----
t=read("app-core.js")
if "function artifactControlMarkup(n,locked){if(n===4)return '';" not in t:
    require("function artifactControlMarkup(n,locked){" in t,"app-core artifact control anchor missing")
    t=t.replace("function artifactControlMarkup(n,locked){","function artifactControlMarkup(n,locked){if(n===4)return '';",1)
write("app-core.js",t)

# ---- final assertions ----
engine=read("workflow-engine.js");prompt=read("prompt-engine.js");ing=read("response-ingestion.js");app=read("app-core.js");schema=read("workflow-schema.js");workbook=read("workbook.js")
require("closed-loop-project/3" in workbook,"project schema /3 missing")
require("closed-loop-stage-response/3" in schema,"response schema /3 missing")
require("stage1IntakeManifest(project)" in engine,"Stage 01 intake manifest missing")
require("stage4ObligationManifest(project)" in engine,"Stage 04 obligation manifest missing")
require("INCOMPLETE_STAGE_01_INTAKE_ACCOUNTING" in ing,"Stage 01 ingestion closure missing")
require("INCOMPLETE_STAGE_04_OBLIGATION_ACCOUNTING" in ing,"Stage 04 ingestion closure missing")
require("APPLICATION INTAKE COVERAGE MANIFEST — ACCOUNT FOR EVERY ID" in prompt,"Stage 01 manifest absent from generated prompt")
require("STAGE 04 COMPLETE CANONICAL INPUT UNION — DO NOT ASK THE USER TO RESUPPLY IT" in prompt,"Stage 04 full union absent from generated prompt")
require("NEVER ask the human to reattach, resend, retype, restate, reconstruct, or summarize" in prompt,"Stage 04 repeat-input prohibition missing")
require("Exhaustively research every current accepted Stage 02" in prompt,"Stage 03 exhaustion missing")
require("function artifactControlMarkup(n,locked){if(n===4)return '';" in app,"Stage 04 attachment control still present")
print("deterministic intent-capture repair applied")
