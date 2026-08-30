from pathlib import Path

def replace_once(path,old,new):
    p=Path(path);s=p.read_text()
    if old not in s: raise SystemExit(f'Anchor not found in {path}: {old[:100]}')
    if s.count(old)!=1: raise SystemExit(f'Non-unique anchor in {path}: {s.count(old)}')
    p.write_text(s.replace(old,new,1))

# The stage gate must validate the exact manifest bound to the accepted controlling prompt,
# not silently regenerate a different identity universe after acceptance/confirmation.
replace_once('workflow-engine.js',
"const intakeManifest=stage01IntakeManifest(project),intakeAccounting=safe(project.stages[1]?.agentData?.INTAKE_ACCOUNTING),intakeSeen=new Set();for(const entry of intakeAccounting){const id=String(entry?.inputId||'');if(id)intakeSeen.add(id);}const missingIntake=safe(intakeManifest.entries).map(x=>String(x.inputId||'')).filter(id=>id&&!intakeSeen.has(id));if(missingIntake.length)reasons.push(`Stage 01 intake accounting is missing application-enumerated input unit(s): ${missingIntake.join(', ')}.`);",
"const stage1Accepted=acceptedChanges(project,1).at(-1),stage1Prompt=safe(project.projectData?.generatedPrompts).find(x=>String(x.instructionId||x.promptId||'')===String(stage1Accepted?.promptId||stage1Accepted?.instructionId||'')),intakeManifest=stage1Prompt?.contextManifest?.intakeManifest||stage01IntakeManifest(project),intakeAccounting=safe(project.stages[1]?.agentData?.INTAKE_ACCOUNTING),intakeSeen=new Set();for(const entry of intakeAccounting){const id=String(entry?.inputId||'');if(id)intakeSeen.add(id);}const missingIntake=safe(intakeManifest.entries).map(x=>String(x.inputId||'')).filter(id=>id&&!intakeSeen.has(id));if(missingIntake.length)reasons.push(`Stage 01 intake accounting is missing application-enumerated input unit(s): ${missingIntake.join(', ')}.`);")
replace_once('workflow-engine.js',
"const researchManifest=stage03ResearchManifest(project),researchAccounting=safe(project.stages[3]?.agentData?.RESEARCH_ACCOUNTING),researchSeen=new Set();for(const entry of researchAccounting){const id=String(entry?.researchUnitId||'');if(id)researchSeen.add(id);}const missingResearch=safe(researchManifest.entries).map(x=>String(x.researchUnitId||'')).filter(id=>id&&!researchSeen.has(id));if(missingResearch.length)reasons.push(`Stage 03 research accounting is missing application-enumerated research unit(s): ${missingResearch.join(', ')}.`);",
"const stage3Accepted=acceptedChanges(project,3).at(-1),stage3Prompt=safe(project.projectData?.generatedPrompts).find(x=>String(x.instructionId||x.promptId||'')===String(stage3Accepted?.promptId||stage3Accepted?.instructionId||'')),researchManifest=stage3Prompt?.contextManifest?.researchManifest||stage03ResearchManifest(project),researchAccounting=safe(project.stages[3]?.agentData?.RESEARCH_ACCOUNTING),researchSeen=new Set();for(const entry of researchAccounting){const id=String(entry?.researchUnitId||'');if(id)researchSeen.add(id);}const missingResearch=safe(researchManifest.entries).map(x=>String(x.researchUnitId||'')).filter(id=>id&&!researchSeen.has(id));if(missingResearch.length)reasons.push(`Stage 03 research accounting is missing application-enumerated research unit(s): ${missingResearch.join(', ')}.`);")

# Focused intake closure proof: persist controlling prompt and keep synthetic records current-scope.
p=Path('verify-intake-closure.mjs')
s=p.read_text()
old="const prompt1=prompts.buildPromptRecord(1,p);assert("
new="const prompt1=prompts.buildPromptRecord(1,p);p.projectData.generatedPrompts.push(prompt1);assert("
if old not in s: raise SystemExit('Prompt 1 persistence fixture anchor not found.')
s=s.replace(old,new,1)
old="scope:{sourceSetVersion:'SOURCE-SET-v001'}"
new="scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'}"
if old not in s: raise SystemExit('Stage 3 research current-scope fixture anchor not found.')
s=s.replace(old,new)
p.write_text(s)

# General ingestion suite: every valid fixture satisfies closed Stage 01/03 accounting.
p=Path('verify-ingestion.mjs');s=p.read_text()
old="""  if(stage===1)records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];
  if(!Object.keys(stageData).length&&stage!==1){"""
new="""  if(stage===1){
    records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];
    stageData.INTAKE_ACCOUNTING=engine.stage01IntakeManifest(p).entries.map(entry=>({inputId:String(entry.inputId||''),disposition:'INCORPORATED',statementTempKeys:['intent-statement-1'],reason:''}));
  }
  if(stage===3)stageData.RESEARCH_ACCOUNTING=engine.stage03ResearchManifest(p).entries.map(entry=>({researchUnitId:String(entry.researchUnitId||''),disposition:'BLOCKED',researchTempKeys:[],candidateTempKeys:[],reason:'Synthetic isolated ingestion fixture has no accepted Stage 02 source material to research.'}));
  if(!Object.keys(stageData).length&&stage!==1){"""
if old not in s: raise SystemExit('General ingestion Stage 01 fixture anchor not found.')
s=s.replace(old,new,1)
old="""  e.stageData={EXACT_DELIVERABLE_REQUESTED:'Patent application draft',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'Later filing-route facts',INPUT_SET_CONTENTS:'Human request and invention-packet.zip'};"""
new="""  e.stageData={EXACT_DELIVERABLE_REQUESTED:'Patent application draft',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'Later filing-route facts',INPUT_SET_CONTENTS:'Human request and invention-packet.zip',INTAKE_ACCOUNTING:e.stageData.INTAKE_ACCOUNTING};"""
if old not in s: raise SystemExit('Smart quote Stage 01 stageData fixture anchor not found.')
s=s.replace(old,new,1)
old="""  if(stageEntries.length!==4||stageEntries.some(x=>!Array.isArray(x.evidenceIds)||x.evidenceIds.length===0))throw new Error('StageData provenance is not linked to canonical response evidence.');"""
new="""  if(stageEntries.length!==5||stageEntries.some(x=>!Array.isArray(x.evidenceIds)||x.evidenceIds.length===0))throw new Error('StageData provenance is not linked to canonical response evidence.');"""
if old not in s: raise SystemExit('Smart quote stageData provenance count anchor not found.')
s=s.replace(old,new,1);p.write_text(s)

# Full-cycle lifecycle must satisfy the same accounting invariants.
p=Path('verify-full-cycle.mjs');s=p.read_text();marker=" if(stage===4&&!stageData.OBLIGATION_ACCOUNTING){"
if marker not in s: raise SystemExit('Full-cycle Stage 4 accounting marker not found.')
insert=""" if(stage===1&&!stageData.INTAKE_ACCOUNTING){const statementTempKeys=(records.intentStatements||[]).map(r=>String(r?.tempKey||'')).filter(Boolean),target=statementTempKeys[0];stageData.INTAKE_ACCOUNTING=engine.stage01IntakeManifest(p).entries.map(entry=>target?{inputId:String(entry.inputId||''),disposition:'INCORPORATED',statementTempKeys:[target],reason:''}:{inputId:String(entry.inputId||''),disposition:'RETAINED_CONTEXT',statementTempKeys:[],reason:'Full-cycle fixture retains this controlled human input as project context.'});}
 if(stage===3&&!stageData.RESEARCH_ACCOUNTING){const candidateTempKeys=(records.candidateRequirements||[]).map(r=>String(r?.tempKey||'')).filter(Boolean),candidate=candidateTempKeys[0];stageData.RESEARCH_ACCOUNTING=engine.stage03ResearchManifest(p).entries.map(entry=>entry.category==='INTENT_REQUIREMENT'&&candidate?{researchUnitId:String(entry.researchUnitId||''),disposition:'CAPTURED',researchTempKeys:[],candidateTempKeys:[candidate],reason:''}:{researchUnitId:String(entry.researchUnitId||''),disposition:'NONE_FOUND',researchTempKeys:[],candidateTempKeys:[],reason:'Full-cycle fixture has no applicable finding for this enumerated research unit.'});}
"""
s=s.replace(marker,insert+marker,1);p.write_text(s)
