from pathlib import Path
import hashlib,re

def one(path,old,new,label):
    p=Path(path); s=p.read_text(); n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 anchor, found {n}')
    p.write_text(s.replace(old,new,1))

# workflow-schema.js: reuse freshContexts for Stage 9 reviewer independence; add only two exact set fields.
p=Path('workflow-schema.js'); s=p.read_text()
s=s.replace("9:['instructions','instructionTraces','requirements','tests']","9:['instructions','instructionTraces','requirements','tests','freshContexts']",1)
old="if(s>=9)keys.push('instructionVersion');if(s>=10&&s<=20)keys.push('iterationId','candidateId');"
new="if(s>=9)keys.push('instructionVersion');if(s===9)keys.push('contextId');if(s>=10&&s<=20)keys.push('iterationId','candidateId');"
if s.count(old)!=1: raise SystemExit('Stage 9 scope anchor mismatch')
s=s.replace(old,new,1)
# Ownership partitions.
anchor='  "comparisons": {\n    "human": [],\n    "humanDecision": [],\n    "agent": [\n      "RUN_DETERMINATIONS",'
repl='  "comparisons": {\n    "human": [],\n    "humanDecision": [],\n    "agent": [\n      "RUN_DETERMINATIONS",\n      "RUN_IDS",'
if s.count(anchor)!=1: raise SystemExit('comparison ownership anchor mismatch')
s=s.replace(anchor,repl,1)
anchor='  "changes": {\n    "human": [],\n    "humanDecision": [],\n    "agent": [\n      "TRIGGERING_DEFECT_IDS",'
repl='  "changes": {\n    "human": [],\n    "humanDecision": [],\n    "agent": [\n      "TRIGGERING_DEFECT_IDS",\n      "TRIGGERING_DEFECT_REFS",'
if s.count(anchor)!=1: raise SystemExit('changes ownership anchor mismatch')
s=s.replace(anchor,repl,1)
# Explicit type overrides avoid editing generated explicit metadata.
anchor="const RECORD_FIELD_TYPE_OVERRIDES=Object.freeze({\n  'TEST':"
repl="const RECORD_FIELD_TYPE_OVERRIDES=Object.freeze({\n  'COMPARISON':Object.freeze({RUN_IDS:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),\n  'CHANGESET':Object.freeze({TRIGGERING_DEFECT_REFS:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),\n  'TEST':"
if s.count(anchor)!=1: raise SystemExit('record type override anchor mismatch')
s=s.replace(anchor,repl,1)
# Record field lists and required sets.
old="'COMPARISON_ID','REQ_ID','RUN_DETERMINATIONS','ALL_TEN_SATISFIED'"
new="'COMPARISON_ID','REQ_ID','RUN_DETERMINATIONS','RUN_IDS','ALL_TEN_SATISFIED'"
if s.count(old)!=1: raise SystemExit('comparison field list anchor mismatch')
s=s.replace(old,new,1)
old="required:['RUN_DETERMINATIONS','INTERPRETATION_VARIANCE'"
new="required:['RUN_DETERMINATIONS','RUN_IDS','INTERPRETATION_VARIANCE'"
if s.count(old)!=1: raise SystemExit('comparison required anchor mismatch')
s=s.replace(old,new,1)
old="'CHANGESET_ID','TRIGGERING_DEFECT_IDS','ROOT_CAUSE_ANALYSIS'"
new="'CHANGESET_ID','TRIGGERING_DEFECT_IDS','TRIGGERING_DEFECT_REFS','ROOT_CAUSE_ANALYSIS'"
if s.count(old)!=1: raise SystemExit('changes field list anchor mismatch')
s=s.replace(old,new,1)
old="required:['TRIGGERING_DEFECT_IDS','ROOT_CAUSE_ANALYSIS'"
new="required:['TRIGGERING_DEFECT_IDS','TRIGGERING_DEFECT_REFS','ROOT_CAUSE_ANALYSIS'"
if s.count(old)!=1: raise SystemExit('changes required anchor mismatch')
s=s.replace(old,new,1)
# Stage 15 cannot require a correction that Stage 16 has not yet established.
old="'PRE_CORRECTION_EVIDENCE','CORRECTION','PERMANENT_TEST_LOCATION'"
new="'PRE_CORRECTION_EVIDENCE','PERMANENT_TEST_LOCATION'"
if s.count(old)!=1: raise SystemExit('Stage 15 correction chronology anchor mismatch')
s=s.replace(old,new,1)
p.write_text(s)

# prompt-engine.js: exact review/set semantics, no prose inference.
p=Path('prompt-engine.js'); s=p.read_text()
old="9:'Preflight this job’s production instruction in an independent context where required. Review each material clause for multiple interpretations, undefined objects, unsupplied dependencies, internal conflicts, unavailable capabilities, objective verifiability, responsible operation, ordering, defined failure behavior, domain/toolchain completeness, and traceability. Preserve findings and evidence. If correction is required, identify the exact correction; the application controls versioning and repeated-review state. Do not execute target production during preflight.',"
new="9:'Preflight this job’s production instruction in the exact application-bound fresh external context supplied by this prompt. Return one preflight record for every required production-instruction field using CLAUSE exactly SECTION:<FIELD_NAME>, and one preflight record for every current instruction trace using CLAUSE exactly TRACE:<TRACE_ID>. Every record must reference the current INSTRUCTION_ID. Review each target for multiple interpretations, undefined objects, unsupplied dependencies, internal conflicts, unavailable capabilities, objective verifiability, responsible operation, ordering, defined failure behavior, domain/toolchain completeness, and traceability. Do not combine, omit, rename, or duplicate required review targets. Preserve findings and evidence. If correction is required, identify the exact correction; the application controls versioning and repeated-review state. Do not execute target production during preflight.',"
if s.count(old)!=1: raise SystemExit('Stage 9 procedure anchor mismatch')
s=s.replace(old,new,1)
old="13:'Compare all ten executions for this job requirement-by-requirement. Report every run’s substantive comparison observations, interpretation variance, output variance, authorized-versus-unauthorized variance evidence, inconclusive tests, repeated and unique failure patterns, correctness-affecting variance, linked defects, and evidence. The application calculates all-ten satisfaction, any-violation, any-undetermined, counts, and completeness. Never discard a run because another appears preferable.',"
new="13:'Compare all ten current Stage 11 executions for this job requirement-by-requirement. For every comparison, populate RUN_IDS with the exact ten application-assigned RUN_ID values covered by that comparison, with no missing, duplicate, stale, or extra run. Preserve the substantive run determinations, interpretation variance, output variance, authorized-versus-unauthorized variance evidence, inconclusive tests, repeated and unique failure patterns, correctness-affecting variance, linked defects, and evidence. The application validates exact ten-run membership and calculates all-ten satisfaction, any-violation, any-undetermined, counts, and completeness. Never discard a run because another appears preferable.',"
if s.count(old)!=1: raise SystemExit('Stage 13 procedure anchor mismatch')
s=s.replace(old,new,1)
old="15:'Convert every confirmed failure in this job into permanent regression-test proposals. Preserve the failure fixture and identity/hash claim when available, reproduction procedure, detection method, applicability, permanent test location, and an actual pre-correction execution with evidence that demonstrates the failure. Define the expected post-correction result. The application assigns REG_ID and lifecycle state. Do not claim post-correction success at Stage 15; that success must come from an actual later corrected execution.',"
new="15:'Convert every confirmed failure in this job into permanent regression-test proposals. Preserve the failure fixture and identity/hash claim when available, reproduction procedure, detection method, applicability, permanent test location, and an actual pre-correction execution with evidence that demonstrates the failure. Define the expected post-correction result, but do not represent a correction as already applied: Stage 16 establishes the controlled correction and later execution establishes post-correction success. The application assigns REG_ID and lifecycle state.',"
if s.count(old)!=1: raise SystemExit('Stage 15 procedure anchor mismatch')
s=s.replace(old,new,1)
old="16:'Revise only the responsible earliest defective layer for this job. Propose the exact responsible-layer correction and preserve triggering defects, RCA, old artifact version, exact modification, required reruns, instruction-change analysis, repeated preflight need, and justified unchanged artifacts. Human authority authorizes genuine decisions; the application assigns CHANGESET_ID, creates new controlled versions, and invalidates downstream work. Never overwrite a controlled version in place.',"
new="16:'Revise only the responsible earliest defective layer for this job. Each changeset must populate TRIGGERING_DEFECT_REFS with the exact canonical Stage 14 DEFECT_ID values it resolves; across the current Stage 16 changesets every confirmed Stage 14 defect must be covered and no unrelated defect may be claimed. Preserve triggering-defect explanation, RCA, old artifact version, exact modification, required reruns, instruction-change analysis, repeated preflight need, and justified unchanged artifacts. Human authority authorizes genuine decisions; the application assigns CHANGESET_ID, creates new controlled versions, and invalidates downstream work. Never overwrite a controlled version in place.',"
if s.count(old)!=1: raise SystemExit('Stage 16 procedure anchor mismatch')
s=s.replace(old,new,1)
p.write_text(s)

# app-core.js: if an operation requires only a context, choose the latest registered real stage context automatically.
p=Path('app-core.js'); s=p.read_text()
old="function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={runId,contextId};}}return options;}"
new="function promptOptions(n){const operation=selectedOperation(n),options={operation},required=schema.operationContract(n,operation)?.scopeRequirements||[],requiresRun=required.includes('runId'),requiresContext=required.includes('contextId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={runId,contextId};}}else if(requiresContext){const placeholder=new Set(['','UNKNOWN','NONE','NOT APPLICABLE','UNASSIGNED','PENDING']),context=engine.records(current,'freshContexts').filter(r=>Number(r.stage)===Number(n)&&engine.isActiveRecord(r)&&!placeholder.has(String(recordValue(r,'EXTERNAL_CONTEXT_IDENTIFIER')||'').trim().toUpperCase())).at(-1);if(context)options.scope={contextId:engine.recordId(context,'freshContexts')};}return options;}"
if s.count(old)!=1: raise SystemExit('promptOptions anchor mismatch')
s=s.replace(old,new,1)
p.write_text(s)

# workflow-engine.js: exact deterministic gate evidence.
p=Path('workflow-engine.js'); s=p.read_text()
old="    case 9:\n      requireAccepted();requireCount('preflightRecords',1);\n      if(collection('preflightRecords').some(record=>['VIOLATED','UNDETERMINED','BLOCKED','REJECTED'].includes(upper(recordValue(record,'DETERMINATION')))))reasons.push('Instruction preflight contains an unresolved material finding.');\n      break;"
new="""    case 9:{
      requireAccepted();const preflight=collection('preflightRecords'),instruction=all('instructions').filter(isActiveRecord).at(-1),instructionId=recordId(instruction,'instructions'),traces=records(project,'instructionTraces').filter(isActiveRecord),expected=[...schema.RECORD_SCHEMAS.instructions.required.map(name=>`SECTION:${name}`),...traces.map(trace=>`TRACE:${recordId(trace,'instructionTraces')}`)],actual=preflight.map(record=>String(recordValue(record,'CLAUSE')||'')),contextId=String(changes.at(-1)?.scope?.contextId||''),context=records(project,'freshContexts',{stage:9}).find(record=>recordId(record,'freshContexts')===contextId&&isActiveRecord(record)),placeholder=value=>['','UNKNOWN','NONE','NOT APPLICABLE','UNASSIGNED','PENDING'].includes(upper(value));
      if(!context||placeholder(recordValue(context,'EXTERNAL_CONTEXT_IDENTIFIER')))reasons.push('Stage 09 requires one application-bound registered fresh external review context.');
      if(!instructionId)reasons.push('The current controlled production instruction is unavailable for preflight.');
      const expectedSet=new Set(expected),actualSet=new Set(actual),missing=expected.filter(token=>!actualSet.has(token)),unexpected=actual.filter(token=>!expectedSet.has(token));
      if(preflight.length!==expected.length||actualSet.size!==actual.length||missing.length||unexpected.length)reasons.push(`Independent preflight must contain exactly one review for every required instruction section and current trace${missing.length?`; missing ${missing.join(', ')}`:''}${unexpected.length?`; unexpected ${unexpected.join(', ')}`:''}.`);
      if(preflight.some(record=>String(recordValue(record,'INSTRUCTION_ID')||record.relationships?.INSTRUCTION_ID||'')!==instructionId))reasons.push('A Stage 09 preflight record is not bound to the current instruction.');
      if(preflight.some(record=>String(record.scope?.contextId||'')!==contextId))reasons.push('A Stage 09 preflight record is not bound to the registered independent review context.');
      if(preflight.some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('Instruction preflight contains an unresolved material finding.');
      break;
    }"""
if s.count(old)!=1: raise SystemExit('Stage 9 gate anchor mismatch')
s=s.replace(old,new,1)
old="""    case 13:{
      requireAccepted();const reqs=mandatoryRequirements(project),compared=new Set(collection('comparisons').map(record=>String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'')));
      const missing=reqs.filter(req=>!compared.has(requirementId(req))).map(requirementId);
      if(missing.length)reasons.push(`Cross-run comparison is missing for: ${missing.join(', ')}.`);
      break;
    }"""
new="""    case 13:{
      requireAccepted();const reqs=mandatoryRequirements(project),comparisons=collection('comparisons'),counts=new Map(),expectedRunIds=records(project,'runs',{stage:11}).map(run=>recordId(run,'runs')).sort(),expectedRunHash=hash.sha256Value(expectedRunIds);
      for(const record of comparisons){const reqId=String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||''),runIds=safe(recordValue(record,'RUN_IDS')).map(String),unique=[...new Set(runIds)].sort();counts.set(reqId,(counts.get(reqId)||0)+1);if(expectedRunIds.length!==10||runIds.length!==10||unique.length!==10||hash.sha256Value(unique)!==expectedRunHash)reasons.push(`${recordId(record,'comparisons')}: comparison does not cover the exact ten current Stage 11 runs.`);}
      const missing=reqs.filter(req=>counts.get(requirementId(req))!==1).map(requirementId);
      if(missing.length)reasons.push(`Exactly one complete cross-run comparison is required for: ${missing.join(', ')}.`);
      break;
    }"""
if s.count(old)!=1: raise SystemExit('Stage 13 gate anchor mismatch')
s=s.replace(old,new,1)
old="    case 16:requireAccepted();if(confirmedDefects(project).length&&!collection('changes').length)reasons.push('A responsible-layer changeset or blocker is required for confirmed defects.');break;"
new="""    case 16:{requireAccepted();const defects=records(project,'defects',{stage:14}).filter(record=>upper(recordValue(record,'STATUS')||'CONFIRMED')==='CONFIRMED'),expected=new Set(defects.map(record=>recordId(record,'defects'))),changes=collection('changes'),covered=new Set();for(const change of changes){const refs=safe(recordValue(change,'TRIGGERING_DEFECT_REFS')).map(String);for(const ref of refs){if(!expected.has(ref))reasons.push(`${recordId(change,'changes')}: changeset references unrelated or noncurrent defect ${ref}.`);else covered.add(ref);}}const missing=[...expected].filter(id=>!covered.has(id));if(expected.size&&!changes.length)reasons.push('A responsible-layer changeset is required for confirmed Stage 14 defects.');if(missing.length)reasons.push(`Controlled correction coverage is missing for confirmed defect(s): ${missing.join(', ')}.`);break;}"""
if s.count(old)!=1: raise SystemExit('Stage 16 gate anchor mismatch')
s=s.replace(old,new,1)
p.write_text(s)

# verify-full-cycle.mjs: normal-ingestion proof of every new exact boundary.
p=Path('verify-full-cycle.mjs'); s=p.read_text()
old="const instructionId=rid('instructions');complete(8);\ndata(9,{records:{preflightRecords:[recordProposal(schema,'preflightRecords',{tempKey:'preflight',relationships:{INSTRUCTION_ID:{recordId:instructionId}},overrides:{CLAUSE:'Full instruction',DETERMINATION:'SATISFIED',FINDINGS:'No material ambiguity',EVIDENCE:'Independent preflight evidence'}})]}});complete(9);"
new="""const instructionId=rid('instructions');complete(8);
engine.registerFreshContext(p,{stage:9,externalContextIdentifier:'PREFLIGHT-CONTEXT-1',operatorLabel:'FULL_CYCLE'});const preflightContextId=engine.recordId(engine.records(p,'freshContexts',{stage:9}).at(-1),'freshContexts'),traceIds=engine.records(p,'instructionTraces').filter(engine.isActiveRecord).map(r=>engine.recordId(r,'instructionTraces')),preflightTokens=[...schema.RECORD_SCHEMAS.instructions.required.map(name=>`SECTION:${name}`),...traceIds.map(id=>`TRACE:${id}`)];data(9,{scope:{contextId:preflightContextId},records:{preflightRecords:preflightTokens.map((token,index)=>recordProposal(schema,'preflightRecords',{tempKey:`preflight-${index}`,relationships:{INSTRUCTION_ID:{recordId:instructionId}},overrides:{CLAUSE:token,DETERMINATION:'SATISFIED',FINDINGS:'No material ambiguity',EVIDENCE:`Independent preflight evidence ${token}`}}))}});{const removed=p.projectData.preflightRecords.pop(),g=engine.gate(9,p);assert(!g.complete&&g.reasons.some(reason=>/every required instruction section and current trace/i.test(reason)),'Stage 09 completed with an omitted required preflight target.');p.projectData.preflightRecords.push(removed);}complete(9);"""
if s.count(old)!=1: raise SystemExit('full-cycle Stage 9 anchor mismatch')
s=s.replace(old,new,1)
old="data(13,{records:{comparisons:[recordProposal(schema,'comparisons',{tempKey:'comparison',relationships:{REQ_ID:{recordId:reqId}},overrides:{RUN_DETERMINATIONS:'All ten SATISFIED',"
new="data(13,{records:{comparisons:[recordProposal(schema,'comparisons',{tempKey:'comparison',relationships:{REQ_ID:{recordId:reqId}},overrides:{RUN_DETERMINATIONS:'All ten SATISFIED',RUN_IDS:initialSlots.map(slot=>slot.runId),"
if s.count(old)!=1: raise SystemExit('full-cycle Stage 13 comparison anchor mismatch')
s=s.replace(old,new,1)
old="}})]}});complete(13);\ndata(14,{records:"
new="}})]}});{const comparison=engine.records(p,'comparisons',{stage:13}).at(-1),saved=[...engine.recordValue(comparison,'RUN_IDS')];comparison.fields.RUN_IDS=saved.slice(0,9);comparison.RUN_IDS=comparison.fields.RUN_IDS;const g=engine.gate(13,p);assert(!g.complete&&g.reasons.some(reason=>/exact ten current Stage 11 runs/i.test(reason)),'Stage 13 completed with only nine compared runs.');comparison.fields.RUN_IDS=saved;comparison.RUN_IDS=saved;}complete(13);\ndata(14,{records:"
if s.count(old)!=1: raise SystemExit('full-cycle Stage 13 negative anchor mismatch')
s=s.replace(old,new,1)
# Stage 15 proves CORRECTION is not required by omitting the prior fixture override.
s=s.replace("PRE_CORRECTION_EVIDENCE:'Failure evidence',CORRECTION:'Controlled correction',POST_CORRECTION_RESULT:'PENDING'","PRE_CORRECTION_EVIDENCE:'Failure evidence',POST_CORRECTION_RESULT:'PENDING'",1)
old="data(16,{records:{changes:[recordProposal(schema,'changes',{tempKey:'change',overrides:{TRIGGERING_DEFECT_IDS:defectId,ROOT_CAUSE_ANALYSIS:"
new="data(16,{records:{changes:[recordProposal(schema,'changes',{tempKey:'change',overrides:{TRIGGERING_DEFECT_IDS:defectId,TRIGGERING_DEFECT_REFS:[defectId],ROOT_CAUSE_ANALYSIS:"
if s.count(old)!=1: raise SystemExit('full-cycle Stage 16 change anchor mismatch')
s=s.replace(old,new,1)
old="}})]}});complete(16);\ndata(17,{operation:'FREEZE'"
new="}})]}});{const change=engine.records(p,'changes',{stage:16}).at(-1),saved=[...engine.recordValue(change,'TRIGGERING_DEFECT_REFS')];change.fields.TRIGGERING_DEFECT_REFS=[];change.TRIGGERING_DEFECT_REFS=[];const g=engine.gate(16,p);assert(!g.complete&&g.reasons.some(reason=>/coverage is missing/i.test(reason)),'Stage 16 completed without exact confirmed-defect correction coverage.');change.fields.TRIGGERING_DEFECT_REFS=saved;change.TRIGGERING_DEFECT_REFS=saved;}complete(16);\ndata(17,{operation:'FREEZE'"
if s.count(old)!=1: raise SystemExit('full-cycle Stage 16 negative anchor mismatch')
s=s.replace(old,new,1)
# Later comparison operations use the same exact identity field.
old="overrides:{RUN_DETERMINATIONS:'All ten SATISFIED',INTERPRETATION_VARIANCE:'NONE'"
# There are two remaining occurrences for Stage 17 and Stage 19 after Stage 13 was already changed.
count=s.count(old)
if count!=2: raise SystemExit(f'expected 2 later comparison anchors, found {count}')
s=s.replace(old,"overrides:{RUN_DETERMINATIONS:'All ten SATISFIED',RUN_IDS:correctedSlots.map(slot=>slot.runId),INTERPRETATION_VARIANCE:'NONE'",1)
s=s.replace(old,"overrides:{RUN_DETERMINATIONS:'All ten SATISFIED',RUN_IDS:confirmSlots.map(slot=>slot.runId),INTERPRETATION_VARIANCE:'NONE'",1)
p.write_text(s)

# verify-prompt-semantics.mjs: first-class semantic contradictions for the new exact rules.
p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
insert="""
for(const [stage,required] of [[9,['SECTION:<FIELD_NAME>','TRACE:<TRACE_ID>','exact application-bound fresh external context']],[13,['RUN_IDS','exact ten application-assigned RUN_ID']],[15,['do not represent a correction as already applied']],[16,['TRIGGERING_DEFECT_REFS','every confirmed Stage 14 defect']]]){const p=baseProject();if(stage===9){p.job.CURRENT_INSTRUCTION_VERSION='INSTRUCTION-v001';p.projectData.freshContexts.push({id:'CONTEXT-PREFLIGHT',stage:9,active:true,scope:{inputVersion:p.job.CURRENT_INPUT_VERSION,instructionVersion:p.job.CURRENT_INSTRUCTION_VERSION},fields:{CONTEXT_ID:'CONTEXT-PREFLIGHT',EXTERNAL_CONTEXT_IDENTIFIER:'EXTERNAL-PREFLIGHT-1'}});}const options=stage===9?{scope:{contextId:'CONTEXT-PREFLIGHT'}}:{};const prompt=prompts.buildPromptRecord(stage,p,options).prompt;for(const text of required)if(!prompt.includes(text))throw new Error(`Stage ${stage} prompt omits exact gate-evidence semantic: ${text}`);}
if(schema.RECORD_SCHEMAS.regressions.required.includes('CORRECTION'))throw new Error('Stage 15 still requires a correction before Stage 16 establishes it.');
if(schema.RECORD_SCHEMAS.comparisons.fieldDefinitions.RUN_IDS?.valueType!=='STRING_ARRAY')throw new Error('Stage 13 RUN_IDS is not a typed exact identity array.');
if(schema.RECORD_SCHEMAS.changes.fieldDefinitions.TRIGGERING_DEFECT_REFS?.valueType!=='STRING_ARRAY')throw new Error('Stage 16 TRIGGERING_DEFECT_REFS is not a typed exact identity array.');
"""
marker="console.log(JSON.stringify({"
if s.count(marker)!=1: raise SystemExit('prompt semantic final marker mismatch')
s=s.replace(marker,insert+"\n"+marker,1)
p.write_text(s)

# Runtime cache identity must reflect exact changed runtime bytes.
runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
manifest=''.join(f'{f}:'+hashlib.sha1((f'blob {Path(f).stat().st_size}\\0').encode()+Path(f).read_bytes()).hexdigest()+'\\n' for f in runtime)
token='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
p=Path('index.html'); s=p.read_text(); s,n=re.subn(r'(<script\s+defer\s+src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)[^"]+("\s*></script>)',lambda m:m.group(1)+token+m.group(2),s)
if n!=8: raise SystemExit(f'Expected 8 runtime cache tokens, changed {n}')
p.write_text(s)
print(token)
