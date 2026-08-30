from pathlib import Path

# Focused intake closure proof: persist controlling prompt and keep synthetic records current-scope.
p=Path('verify-intake-closure.mjs')
s=p.read_text()
old="const prompt1=prompts.buildPromptRecord(1,p);assert("
new="const prompt1=prompts.buildPromptRecord(1,p);p.projectData.generatedPrompts.push(prompt1);assert("
if old not in s:
    raise SystemExit('Prompt 1 persistence fixture anchor not found.')
s=s.replace(old,new,1)
old="scope:{sourceSetVersion:'SOURCE-SET-v001'}"
new="scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'}"
if old not in s:
    raise SystemExit('Stage 3 research current-scope fixture anchor not found.')
s=s.replace(old,new)
p.write_text(s)

# General ingestion suite: a response described as valid must satisfy the new closed Stage 01/03 accounting contracts.
p=Path('verify-ingestion.mjs')
s=p.read_text()
old="""  if(stage===1)records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];
  if(!Object.keys(stageData).length&&stage!==1){"""
new="""  if(stage===1){
    records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];
    stageData.INTAKE_ACCOUNTING=engine.stage01IntakeManifest(p).entries.map(entry=>({inputId:String(entry.inputId||''),disposition:'INCORPORATED',statementTempKeys:['intent-statement-1'],reason:''}));
  }
  if(stage===3)stageData.RESEARCH_ACCOUNTING=engine.stage03ResearchManifest(p).entries.map(entry=>({researchUnitId:String(entry.researchUnitId||''),disposition:'BLOCKED',researchTempKeys:[],candidateTempKeys:[],reason:'Synthetic isolated ingestion fixture has no accepted Stage 02 source material to research.'}));
  if(!Object.keys(stageData).length&&stage!==1){"""
if old not in s:
    raise SystemExit('General ingestion Stage 01 fixture anchor not found.')
s=s.replace(old,new,1)
old="""  e.stageData={EXACT_DELIVERABLE_REQUESTED:'Patent application draft',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'Later filing-route facts',INPUT_SET_CONTENTS:'Human request and invention-packet.zip'};"""
new="""  e.stageData={EXACT_DELIVERABLE_REQUESTED:'Patent application draft',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'Later filing-route facts',INPUT_SET_CONTENTS:'Human request and invention-packet.zip',INTAKE_ACCOUNTING:e.stageData.INTAKE_ACCOUNTING};"""
if old not in s:
    raise SystemExit('Smart quote Stage 01 stageData fixture anchor not found.')
s=s.replace(old,new,1)
old="""  if(stageEntries.length!==4||stageEntries.some(x=>!Array.isArray(x.evidenceIds)||x.evidenceIds.length===0))throw new Error('StageData provenance is not linked to canonical response evidence.');"""
new="""  if(stageEntries.length!==5||stageEntries.some(x=>!Array.isArray(x.evidenceIds)||x.evidenceIds.length===0))throw new Error('StageData provenance is not linked to canonical response evidence.');"""
if old not in s:
    raise SystemExit('Smart quote stageData provenance count anchor not found.')
s=s.replace(old,new,1)
p.write_text(s)

# Full-cycle lifecycle must satisfy the same accounting invariants instead of bypassing them.
p=Path('verify-full-cycle.mjs')
s=p.read_text()
old="""function data(stage,{operation,stageData={},records={},scope={}}={}){const pr=prompt(stage,operation,scope);if(!Object.keys(stageData).length&&!Object.keys(records).length){const f=schema.STAGE_CONTRACTS[stage].allowedStageData[0];if(f)stageData[f]=schema.STAGE_FIELDS[stage][f].valueType==='BOOLEAN'?true:`fixture-${f.toLowerCase()}`;}
 if(stage===4&&!stageData.OBLIGATION_ACCOUNTING){const manifest=engine.stage04ObligationManifest(p),requirementTempKeys=(records.requirements||[]).map(r=>String(r?.tempKey||'')).filter(Boolean),requiredIntentIds=new Set(engine.recordsForCurrentScope(p,'intentStatements').filter(r=>String(engine.recordValue(r,'REQUIREMENT_RELEVANCE')||'').toUpperCase()==='REQUIREMENT').map(r=>engine.recordId(r,'intentStatements'));"""
# Keep anchor small because the Stage 4 line is minified and long; insert immediately before its marker.
marker=" if(stage===4&&!stageData.OBLIGATION_ACCOUNTING){"
if marker not in s:
    raise SystemExit('Full-cycle Stage 4 accounting marker not found.')
insert=""" if(stage===1&&!stageData.INTAKE_ACCOUNTING){const statementTempKeys=(records.intentStatements||[]).map(r=>String(r?.tempKey||'')).filter(Boolean),target=statementTempKeys[0];stageData.INTAKE_ACCOUNTING=engine.stage01IntakeManifest(p).entries.map(entry=>target?{inputId:String(entry.inputId||''),disposition:'INCORPORATED',statementTempKeys:[target],reason:''}:{inputId:String(entry.inputId||''),disposition:'RETAINED_CONTEXT',statementTempKeys:[],reason:'Full-cycle fixture retains this controlled human input as project context.'});}
 if(stage===3&&!stageData.RESEARCH_ACCOUNTING){const candidateTempKeys=(records.candidateRequirements||[]).map(r=>String(r?.tempKey||'')).filter(Boolean),candidate=candidateTempKeys[0];stageData.RESEARCH_ACCOUNTING=engine.stage03ResearchManifest(p).entries.map(entry=>entry.category==='INTENT_REQUIREMENT'&&candidate?{researchUnitId:String(entry.researchUnitId||''),disposition:'CAPTURED',researchTempKeys:[],candidateTempKeys:[candidate],reason:''}:{researchUnitId:String(entry.researchUnitId||''),disposition:'NONE_FOUND',researchTempKeys:[],candidateTempKeys:[],reason:'Full-cycle fixture has no applicable finding for this enumerated research unit.'});}
"""
s=s.replace(marker,insert+marker,1)
p.write_text(s)
