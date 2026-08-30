from pathlib import Path
p=Path('verify-full-cycle.mjs')
s=p.read_text()
old="Object.assign(p.job,{JOB_TITLE:'Full lifecycle proof',EXACT_USER_OBJECTIVE_VERBATIM:'Prove one complete closed-loop lifecycle.',CURRENT_INPUT_VERSION:'INPUT-v001'});"
new="Object.assign(p.job,{JOB_TITLE:'Full lifecycle proof',EXACT_USER_OBJECTIVE_VERBATIM:'Prove one complete closed-loop lifecycle.',EXPLICIT_USER_REQUIREMENTS:'The deliverable must contain the required verified content.',CURRENT_INPUT_VERSION:'INPUT-v001'});"
if old not in s: raise SystemExit('full-cycle initial human-input anchor not found')
s=s.replace(old,new,1)
start=s.index("const s1=data(1,{stageData:")
end=s.index("engine.recordStageConfirmation",start)
replacement="""const intakeManifest=engine.stage01IntakeManifest(p);const intakeEntries=intakeManifest.entries||[];const requirementText='The deliverable must contain the required verified content.';const stage1IntentRecords=intakeEntries.map((entry,index)=>{const exact=typeof entry.value==='string'?entry.value:JSON.stringify(entry.value);const isRequirement=exact===requirementText;return recordProposal(schema,'intentStatements',{tempKey:`intent-statement-${index+1}`,overrides:{SOURCE_MATERIAL:String(entry.sourceIdentity||entry.sourceKind||'authorized human job input'),SOURCE_LOCATION:String(entry.location||entry.inputId||'controlled input'),EXACT_STATEMENT:exact,STATEMENT_KIND:isRequirement?'REQUIREMENT':'OTHER',REQUIREMENT_RELEVANCE:isRequirement?'REQUIREMENT':'CONTEXT_ONLY',NORMATIVE_FORCE:isRequirement?'MUST':'FACTUAL',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Full-cycle intake accounting fixture'}});});const stage1Accounting=intakeEntries.map((entry,index)=>({inputId:String(entry.inputId||''),disposition:'INCORPORATED_INTO_JOB_DEFINITION',statementTempKeys:[`intent-statement-${index+1}`],reason:''}));const s1=data(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'Verbatim job input plus clarification.',INTAKE_ACCOUNTING:stage1Accounting},records:{intentStatements:stage1IntentRecords}});const intentStatement=engine.recordsForCurrentScope(p,'intentStatements').find(r=>engine.recordValue(r,'EXACT_STATEMENT')===requirementText);const intentStatementId=engine.recordId(intentStatement,'intentStatements');"""
s=s[:start]+replacement+s[end:]
p.write_text(s)
