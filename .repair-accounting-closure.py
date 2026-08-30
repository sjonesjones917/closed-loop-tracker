from pathlib import Path
import re


def replace_once(path, old, new):
    p=Path(path); s=p.read_text()
    if old not in s: raise SystemExit(f'missing anchor in {path}: {old[:160]!r}')
    p.write_text(s.replace(old,new,1))

# ---------- workflow-schema.js ----------
p=Path('workflow-schema.js'); s=p.read_text()
# New field types are additive /3 contract fields; no domain semantics.
anchor="const ADDITIONAL_RECORD_FIELD_TYPES=Object.freeze({\n  TEST:Object.freeze({"
insert="""const ADDITIONAL_RECORD_FIELD_TYPES=Object.freeze({
  'INTENT-STATEMENT':Object.freeze({
    INPUT_UNIT_ID:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),
    DISPOSITION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:Object.freeze(['INCORPORATED_JOB_DEFINITION','RETAINED_CONTEXT','UNRESOLVED_HUMAN_ONLY','LATER_RESOLVABLE','INAPPLICABLE']),nullable:false,normalizerKey:null,closedProperties:null}),
    CAPTURED_MEANING:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),
    REASON:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})
  }),
  'OBLIGATION-DISPOSITION':Object.freeze({
    OBLIGATION_ID:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),
    DISPOSITION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:Object.freeze(['REQUIREMENT','RETAINED_CONTEXT','INAPPLICABLE','BLOCKED']),nullable:false,normalizerKey:null,closedProperties:null}),
    REASON:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})
  }),
  REQ:Object.freeze({
    OBLIGATION_IDS:Object.freeze({valueType:VALUE_TYPES.STRING_ARRAY,enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})
  }),
  TEST:Object.freeze({"""
if anchor not in s: raise SystemExit('ADDITIONAL_RECORD_FIELD_TYPES anchor missing')
s=s.replace(anchor,insert,1)

# Add typed accounting collections before sources.
anchor="const RECORD_SCHEMAS=Object.freeze({\n  sources:recordSchema({"
insert="""const RECORD_SCHEMAS=Object.freeze({
  intentStatements:recordSchema({ownership:{human:[],humanDecision:[],agent:['INPUT_UNIT_ID','DISPOSITION','CAPTURED_MEANING','REASON'],application:['INTENT_STATEMENT_ID']},commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Stage 01 intake accounting',idField:'INTENT_STATEMENT_ID',prefix:'INTENT-STATEMENT',stage:1,fields:[
    'INTENT_STATEMENT_ID','INPUT_UNIT_ID','DISPOSITION','CAPTURED_MEANING','REASON'
  ],required:['INPUT_UNIT_ID','DISPOSITION','CAPTURED_MEANING','REASON']}),
  obligationDispositions:recordSchema({ownership:{human:[],humanDecision:[],agent:['OBLIGATION_ID','DISPOSITION','REASON'],application:['DISPOSITION_ID']},commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Stage 04 obligation accounting',idField:'DISPOSITION_ID',prefix:'OBLIGATION-DISPOSITION',stage:4,fields:[
    'DISPOSITION_ID','OBLIGATION_ID','DISPOSITION','REASON'
  ],required:['OBLIGATION_ID','DISPOSITION','REASON']}),
  sources:recordSchema({"""
if anchor not in s: raise SystemExit('RECORD_SCHEMAS anchor missing')
s=s.replace(anchor,insert,1)

# Requirements carry exact manifest trace IDs as agent semantic mapping, while canonical REQ_ID stays application-owned.
s=s.replace("requirements:recordSchema({ownership:RECORD_OWNERSHIP.requirements,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET", "requirements:recordSchema({ownership:{...RECORD_OWNERSHIP.requirements,agent:[...RECORD_OWNERSHIP.requirements.agent,'OBLIGATION_IDS']},commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET",1)
s=s.replace("'REQ_ID','OBLIGATION','REQUIREMENT_TYPE','MANDATORY_OPTIONAL_STATUS','SOURCE_ID'", "'REQ_ID','OBLIGATION_IDS','OBLIGATION','REQUIREMENT_TYPE','MANDATORY_OPTIONAL_STATUS','SOURCE_ID'",1)
s=s.replace("],required:['OBLIGATION','REQUIREMENT_TYPE','MANDATORY_OPTIONAL_STATUS','APPLICABILITY','OBSERVABLE_SATISFACTION_CONDITION'", "],required:['OBLIGATION_IDS','OBLIGATION','REQUIREMENT_TYPE','MANDATORY_OPTIONAL_STATUS','APPLICABILITY','OBSERVABLE_SATISFACTION_CONDITION'",1)

# Stage contracts expose exactly the accounting collections required by the prompts.
s=s.replace("const STAGE_COLLECTIONS=Object.freeze({\n  1:[],", "const STAGE_COLLECTIONS=Object.freeze({\n  1:['intentStatements'],",1)
s=s.replace("  4:['requirements'],", "  4:['requirements','obligationDispositions'],",1)
s=s.replace("const READ_COLLECTIONS=Object.freeze({1:[],2:[],3:['sources','sourceConflicts'],4:['research','candidateRequirements','sources']", "const READ_COLLECTIONS=Object.freeze({1:[],2:[],3:['sources','sourceConflicts'],4:['intentStatements','research','candidateRequirements','sources']",1)
p.write_text(s)

# ---------- workflow-engine.js ----------
p=Path('workflow-engine.js'); s=p.read_text()
# Stage 01 manifest must enumerate human input only; accepted Stage 01 semantics enter Stage 04 separately.
s=s.replace("for(const name of ['EXACT_DELIVERABLE_REQUESTED','INPUT_SET_CONTENTS'])push(project.job?.[name]||project.stages?.[1]?.agentData?.[name],'stage01.'+name,'STAGE01_CAPTURE');", "",1)

old=re.search(r"function rebuildIntakeCoverageManifest\(project,\{acceptedChangeId=null\}=\{\}\)\{.*?\}\nfunction currentIntakeCoverageManifest",s,re.S)
if not old: raise SystemExit('rebuildIntakeCoverageManifest function anchor missing')
new="""function rebuildIntakeCoverageManifest(project,{acceptedChangeId=null}={}){
  ensureShape(project);const inputVersion=String(project.job?.CURRENT_INPUT_VERSION||'UNKNOWN'),units=enumerateProjectInputUnits(project),expected=new Set(units.map(x=>x.unitId)),statements=recordsForCurrentScope(project,'intentStatements').filter(r=>Number(r.stage)===1),seen=new Set(),validStatementIds=[];
  for(const r of statements){const id=String(recordValue(r,'INPUT_UNIT_ID')||'');if(expected.has(id)&&!seen.has(id)){seen.add(id);validStatementIds.push(recordId(r,'intentStatements'));}}
  const classifiedUnitCount=seen.size,coverage=units.length?classifiedUnitCount/units.length:1,manifestSha256=hash.sha256Value({inputVersion,units:units.map(x=>({unitId:x.unitId,sourceLocation:x.sourceLocation,rawValueSha256:x.rawValueSha256,origin:x.origin}))}),change=safe(project.projectData.acceptedChanges).find(x=>x.changeId===acceptedChangeId)||safe(project.projectData.acceptedChanges).filter(x=>Number(x.stage)===1&&!x.invalidatedBy).at(-1),manifest={manifestId:'INTAKE-MANIFEST-'+manifestSha256.slice(0,20).toUpperCase(),inputVersion,manifestSha256,unitCount:units.length,classifiedUnitCount,coverage,units,classificationRecordIds:validStatementIds,acceptedChangeId:acceptedChangeId||change?.changeId||null,rawResponseId:change?.rawResponseId||null,controllingPromptInstructionId:change?.promptInstructionId||change?.instructionId||null,projectRevision:Number(project.revision||0),producer:'APPLICATION',createdAt:now()};
  project.projectData.intakeCoverageManifests=safe(project.projectData.intakeCoverageManifests).filter(x=>String(x.inputVersion)!==inputVersion);project.projectData.intakeCoverageManifests.push(manifest);project.job.INPUT_SET_HASH_OR_MANIFEST=manifest.manifestId;return manifest;
}
function currentIntakeCoverageManifest"""
s=s[:old.start()]+new+s[old.end():]

# Stage 04 universe explicitly includes accepted Stage 01 job definition in addition to human input and Stage 03.
needle="for(const unit of intake.units||[])push(unit.rawValue,'HUMAN_INPUT',unit.unitId,{inputVersion:intake.inputVersion,sourceLocation:unit.sourceLocation});"
repl=needle+"for(const fieldName of ['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS']){const value=project.stages?.[1]?.agentData?.[fieldName]??project.job?.[fieldName];push(value,'STAGE01_JOB_DEFINITION','STAGE01:'+fieldName,{inputVersion:intake.inputVersion,field:fieldName});}"
if needle not in s: raise SystemExit('Stage 04 human obligation anchor missing')
s=s.replace(needle,repl,1)

anchor="function persistObligationManifest(project,manifest){ensureShape(project);const value=clone(manifest||buildObligationManifest(project));project.projectData.obligationManifests=safe(project.projectData.obligationManifests).filter(x=>!(String(x.inputVersion)===String(value.inputVersion)&&String(x.sourceSetVersion)===String(value.sourceSetVersion)));project.projectData.obligationManifests.push(value);return value;}"
if anchor not in s: raise SystemExit('persistObligationManifest anchor missing')
helpers=anchor+"""
function intakeAccountingStatus(project){const manifest=currentIntakeCoverageManifest(project),expected=manifest.units.map(x=>x.unitId),rows=recordsForCurrentScope(project,'intentStatements').filter(r=>Number(r.stage)===1),ids=rows.map(r=>String(recordValue(r,'INPUT_UNIT_ID')||'')),counts=new Map();for(const id of ids)counts.set(id,(counts.get(id)||0)+1);const missing=expected.filter(id=>!counts.get(id)),duplicates=[...counts].filter(([,n])=>n!==1).map(([id])=>id),unknown=[...counts.keys()].filter(id=>!expected.includes(id));return {manifest,expected,rows,missing,duplicates,unknown,coverage:expected.length?(expected.length-missing.length)/expected.length:1,complete:missing.length===0&&duplicates.length===0&&unknown.length===0&&rows.length===expected.length};}
function currentObligationManifest(project){const scope=currentScope(project);return safe(project.projectData.obligationManifests).filter(x=>String(x.inputVersion)===String(scope.inputVersion)&&String(x.sourceSetVersion)===String(scope.sourceSetVersion)).at(-1)||buildObligationManifest(project);}
function obligationAccountingStatus(project){const manifest=currentObligationManifest(project),expected=manifest.obligations.map(x=>x.obligationId),rows=recordsForCurrentScope(project,'obligationDispositions').filter(r=>Number(r.stage)===4),counts=new Map(),dispositions=new Map();for(const r of rows){const id=String(recordValue(r,'OBLIGATION_ID')||''),d=upper(recordValue(r,'DISPOSITION'));counts.set(id,(counts.get(id)||0)+1);dispositions.set(id,d);}const missing=expected.filter(id=>!counts.get(id)),duplicates=[...counts].filter(([,n])=>n!==1).map(([id])=>id),unknown=[...counts.keys()].filter(id=>!expected.includes(id)),mapped=new Map(expected.map(id=>[id,0]));for(const req of recordsForCurrentScope(project,'requirements').filter(r=>Number(r.stage)===4))for(const id of safe(recordValue(req,'OBLIGATION_IDS')))mapped.set(String(id),(mapped.get(String(id))||0)+1);const badMappings=[];for(const id of expected){const d=dispositions.get(id),count=mapped.get(id)||0;if(d==='REQUIREMENT'&&count<1)badMappings.push(id+': REQUIREMENT has no atomic requirement mapping');if(d&&d!=='REQUIREMENT'&&count>0)badMappings.push(id+': '+d+' must not map to a requirement');if(d==='BLOCKED')badMappings.push(id+': obligation remains BLOCKED');}return {manifest,expected,rows,missing,duplicates,unknown,badMappings,coverage:expected.length?(expected.length-missing.length)/expected.length:1,complete:missing.length===0&&duplicates.length===0&&unknown.length===0&&badMappings.length===0&&rows.length===expected.length};}
function refreshObligationManifestAccounting(project,{acceptedChangeId=null}={}){const status=obligationAccountingStatus(project),value={...clone(status.manifest),dispositionRecordIds:status.rows.map(r=>recordId(r,'obligationDispositions')),accountedObligationCount:status.expected.length-status.missing.length,coverage:status.coverage,acceptedChangeId,projectRevision:Number(project.revision||0)};return persistObligationManifest(project,value);}
"""
s=s.replace(anchor,helpers,1)

# Strengthen Stage 01 gate.
old="""    case 1:{
      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      requireAccepted();
      const latest=changes.at(-1),confirmed=safe(project.projectData.stageConfirmations).some(item=>Number(item.stage)===1&&item.confirmed===true&&!item.invalidatedBy&&item.acceptedChangeId===latest?.changeId&&item.inputVersion===project.job.CURRENT_INPUT_VERSION);
      if(!confirmed)reasons.push('Human confirmation bound to the current accepted change and input version is required.');
      break;
    }"""
new="""    case 1:{
      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      requireAccepted();const accounting=intakeAccountingStatus(project);if(!accounting.complete)reasons.push(`Stage 01 intake accounting is incomplete: missing ${accounting.missing.length}, duplicate ${accounting.duplicates.length}, unknown ${accounting.unknown.length}; coverage ${(accounting.coverage*100).toFixed(2)}%.`);
      const latest=changes.at(-1),confirmed=safe(project.projectData.stageConfirmations).some(item=>Number(item.stage)===1&&item.confirmed===true&&!item.invalidatedBy&&item.acceptedChangeId===latest?.changeId&&item.inputVersion===project.job.CURRENT_INPUT_VERSION);
      if(!confirmed)reasons.push('Human confirmation bound to the current accepted change and input version is required.');
      break;
    }"""
if old not in s: raise SystemExit('Stage 1 gate anchor missing')
s=s.replace(old,new,1)

old="""    case 4:{
      requireAccepted();requireCount('requirements',1);
      for(const req of collection('requirements')){
        for(const name of schema.RECORD_SCHEMAS.requirements.required)if(!String(recordValue(req,name)||'').trim())reasons.push(`${recordId(req,'requirements')}: ${name} is missing.`);
        const sourceId=String(recordValue(req,'SOURCE_ID')||req.relationships?.SOURCE_ID||'').trim(),userRelationship=String(recordValue(req,'USER_INPUT_RELATIONSHIP')||'').trim();
        if(!sourceId&&!userRelationship)reasons.push(`${recordId(req,'requirements')}: requirement lacks source provenance or an explicit User Job Input relationship.`);
      }
      break;
    }"""
new="""    case 4:{
      requireAccepted();requireCount('requirements',1);const accounting=obligationAccountingStatus(project);if(!accounting.complete)reasons.push(`Stage 04 obligation accounting is incomplete: missing ${accounting.missing.length}, duplicate ${accounting.duplicates.length}, unknown ${accounting.unknown.length}; ${accounting.badMappings.join('; ')||'mapping closure failed'}.`);
      for(const req of collection('requirements')){
        for(const name of schema.RECORD_SCHEMAS.requirements.required){const value=recordValue(req,name);if(value===undefined||value===null||(typeof value==='string'&&!value.trim())||(Array.isArray(value)&&!value.length))reasons.push(`${recordId(req,'requirements')}: ${name} is missing.`);}
        const sourceId=String(recordValue(req,'SOURCE_ID')||req.relationships?.SOURCE_ID||'').trim(),userRelationship=String(recordValue(req,'USER_INPUT_RELATIONSHIP')||'').trim();
        if(!sourceId&&!userRelationship)reasons.push(`${recordId(req,'requirements')}: requirement lacks source provenance or an explicit User Job Input relationship.`);
      }
      break;
    }"""
if old not in s: raise SystemExit('Stage 4 gate anchor missing')
s=s.replace(old,new,1)

# Export the accounting evaluators alongside existing manifest helpers.
export_anchor="rebuildIntakeCoverageManifest,currentIntakeCoverageManifest,buildObligationManifest,persistObligationManifest"
if export_anchor not in s: raise SystemExit('workflow accounting export anchor missing')
s=s.replace(export_anchor,export_anchor+',intakeAccountingStatus,currentObligationManifest,obligationAccountingStatus,refreshObligationManifestAccounting',1)
p.write_text(s)

# ---------- response-ingestion.js ----------
p=Path('response-ingestion.js'); s=p.read_text()
insert_anchor="  if(Array.isArray(envelope.humanInputRequests))envelope.humanInputRequests.forEach((request,index)=>{"
if insert_anchor not in s: raise SystemExit('ingestion accounting insertion anchor missing')
block="""  if(envelope.responseType==='DATA_PROPOSAL'&&stageNumber===1){
    const manifest=promptRecord?.contextManifest?.intakeCoverageManifest||workflow.currentIntakeCoverageManifest(project),expected=new Set(safe(manifest?.units).map(x=>String(x.unitId))),rows=safe(envelope.records?.intentStatements),seen=new Map();
    if(!manifest||!expected.size)issues.push(issue('MISSING_INTAKE_MANIFEST','/records/intentStatements','The controlling Stage 01 prompt has no application-owned intake coverage manifest.'));
    rows.forEach((record,index)=>{const id=String(record?.fields?.INPUT_UNIT_ID||''),path=`/records/intentStatements/${index}/fields/INPUT_UNIT_ID`;if(!expected.has(id))issues.push(issue('UNKNOWN_INTAKE_IDENTITY',path,`INPUT_UNIT_ID ${id||'MISSING'} is not in the controlling intake manifest.`));seen.set(id,(seen.get(id)||0)+1);if(seen.get(id)>1)issues.push(issue('DUPLICATE_INTAKE_ACCOUNTING',path,`INPUT_UNIT_ID ${id} is classified more than once.`));});
    for(const id of expected)if((seen.get(id)||0)!==1)issues.push(issue('INCOMPLETE_INTAKE_ACCOUNTING','/records/intentStatements',`Stage 01 must classify intake identity ${id} exactly once.`));
  }
  if(envelope.responseType==='DATA_PROPOSAL'&&stageNumber===4){
    const manifest=promptRecord?.contextManifest?.obligationManifest||workflow.buildObligationManifest(project),expected=new Set(safe(manifest?.obligations).map(x=>String(x.obligationId))),rows=safe(envelope.records?.obligationDispositions),requirements=safe(envelope.records?.requirements),seen=new Map(),dispositions=new Map(),mapped=new Map();
    if(!manifest||!expected.size)issues.push(issue('MISSING_OBLIGATION_MANIFEST','/records/obligationDispositions','The controlling Stage 04 prompt has no application-owned obligation manifest.'));
    rows.forEach((record,index)=>{const id=String(record?.fields?.OBLIGATION_ID||''),d=upper(record?.fields?.DISPOSITION),path=`/records/obligationDispositions/${index}/fields/OBLIGATION_ID`;if(!expected.has(id))issues.push(issue('UNKNOWN_OBLIGATION_IDENTITY',path,`OBLIGATION_ID ${id||'MISSING'} is not in the controlling obligation manifest.`));seen.set(id,(seen.get(id)||0)+1);dispositions.set(id,d);if(seen.get(id)>1)issues.push(issue('DUPLICATE_OBLIGATION_ACCOUNTING',path,`OBLIGATION_ID ${id} has more than one disposition.`));});
    for(const id of expected)if((seen.get(id)||0)!==1)issues.push(issue('INCOMPLETE_OBLIGATION_ACCOUNTING','/records/obligationDispositions',`Stage 04 must disposition obligation ${id} exactly once.`));
    requirements.forEach((record,index)=>{const ids=record?.fields?.OBLIGATION_IDS;if(!Array.isArray(ids)||!ids.length)return;const local=new Set();for(const raw of ids){const id=String(raw),path=`/records/requirements/${index}/fields/OBLIGATION_IDS`;if(local.has(id))issues.push(issue('DUPLICATE_OBLIGATION_TRACE',path,`Requirement repeats obligation identity ${id}.`));local.add(id);if(!expected.has(id))issues.push(issue('UNKNOWN_OBLIGATION_TRACE',path,`Requirement references unknown obligation ${id}.`));mapped.set(id,(mapped.get(id)||0)+1);}});
    for(const id of expected){const d=dispositions.get(id),count=mapped.get(id)||0;if(d==='REQUIREMENT'&&count<1)issues.push(issue('UNMAPPED_REQUIREMENT_OBLIGATION','/records/requirements',`Obligation ${id} is dispositioned REQUIREMENT but maps to no atomic requirement.`));if(d&&d!=='REQUIREMENT'&&count>0)issues.push(issue('INVALID_NONREQUIREMENT_MAPPING','/records/requirements',`Obligation ${id} is dispositioned ${d} and must not map to a requirement.`));}
  }

"""
s=s.replace(insert_anchor,block+insert_anchor,1)
# Refresh durable application-owned manifests after canonical acceptance.
accept_anchor="if(stage===1)workflow.rebuildIntakeCoverageManifest(next,{acceptedChangeId:changeId});"
if accept_anchor not in s: raise SystemExit('Stage 1 acceptance manifest anchor missing')
s=s.replace(accept_anchor,accept_anchor+"if(stage===4)workflow.refreshObligationManifestAccounting(next,{acceptedChangeId:changeId});",1)
p.write_text(s)

# ---------- verify-ingestion.mjs ----------
p=Path('verify-ingestion.mjs'); s=p.read_text()
# Make generic valid fixtures honor exhaustive Stage 01/04 manifest contracts.
return_anchor="""  return {
    schema:schema.RESPONSE_SCHEMA,"""
if return_anchor not in s: raise SystemExit('validEnvelope return anchor missing')
pre="""  if(stage===1){
    const manifest=promptRecord.contextManifest?.intakeCoverageManifest||engine.currentIntakeCoverageManifest(p);records.intentStatements=(manifest.units||[]).map((u,i)=>({tempKey:`intent-${i+1}`,fields:{INPUT_UNIT_ID:u.unitId,DISPOSITION:'INCORPORATED_JOB_DEFINITION',CAPTURED_MEANING:u.rawValue,REASON:'Captured from the exact controlled input unit.'},relationships:{},evidenceRefs:['evidence-1']}));
  }
  if(stage===4){
    const manifest=promptRecord.contextManifest?.obligationManifest||engine.buildObligationManifest(p),ids=(manifest.obligations||[]).map(x=>x.obligationId);records.obligationDispositions=ids.map((id,i)=>({tempKey:`disp-${i+1}`,fields:{OBLIGATION_ID:id,DISPOSITION:'REQUIREMENT',REASON:'The obligation is normative and is compiled into the atomic requirement set.'},relationships:{},evidenceRefs:['evidence-1']}));
    const def=schema.RECORD_SCHEMAS.requirements,fields={OBLIGATION_IDS:ids,USER_INPUT_RELATIONSHIP:'Application-owned Stage 04 obligation manifest'};for(const name of def.required)if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT&&fields[name]===undefined)fields[name]=safeValue(name);records.requirements=[{tempKey:'requirement-1',fields,relationships:{},evidenceRefs:['evidence-1']}];
  }
"""
s=s.replace(return_anchor,pre+return_anchor,1)
# Add permanent negative accounting mutations before the smart punctuation block.
marker="// Mobile/chat smart punctuation is normalized while the exact raw response remains preserved for audit."
if marker not in s: raise SystemExit('negative test insertion marker missing')
neg="""
negativeAt('stage1 omitted input identity',1,(e)=>{e.records.intentStatements.pop();},'INCOMPLETE_INTAKE_ACCOUNTING');
negativeAt('stage1 duplicate input identity',1,(e)=>{e.records.intentStatements.push(JSON.parse(JSON.stringify(e.records.intentStatements[0])));e.records.intentStatements.at(-1).tempKey='intent-duplicate';},'DUPLICATE_INTAKE_ACCOUNTING');
negativeAt('stage1 unknown input identity',1,(e)=>{e.records.intentStatements[0].fields.INPUT_UNIT_ID='INPUT-UNIT-UNKNOWN';},'UNKNOWN_INTAKE_IDENTITY');
negativeAt('stage4 omitted obligation disposition',4,(e)=>{e.records.obligationDispositions.pop();},'INCOMPLETE_OBLIGATION_ACCOUNTING');
negativeAt('stage4 duplicate obligation disposition',4,(e)=>{e.records.obligationDispositions.push(JSON.parse(JSON.stringify(e.records.obligationDispositions[0])));e.records.obligationDispositions.at(-1).tempKey='disp-duplicate';},'DUPLICATE_OBLIGATION_ACCOUNTING');
negativeAt('stage4 unknown obligation identity',4,(e)=>{e.records.obligationDispositions[0].fields.OBLIGATION_ID='OBL-UNKNOWN';},'UNKNOWN_OBLIGATION_IDENTITY');
negativeAt('stage4 unknown requirement obligation trace',4,(e)=>{e.records.requirements[0].fields.OBLIGATION_IDS=['OBL-UNKNOWN'];},'UNKNOWN_OBLIGATION_TRACE');
negativeAt('stage4 requirement disposition not mapped',4,(e)=>{e.records.requirements[0].fields.OBLIGATION_IDS=e.records.requirements[0].fields.OBLIGATION_IDS.slice(1);},'UNMAPPED_REQUIREMENT_OBLIGATION');
"""
s=s.replace(marker,neg+'\n'+marker,1)
p.write_text(s)
