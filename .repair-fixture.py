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
