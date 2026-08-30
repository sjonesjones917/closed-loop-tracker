from pathlib import Path

p=Path('verify.mjs')
s=p.read_text()
old="for(let stage=1;stage<=30;stage++){const p=blank(`JOB-PROMPT-${stage}`);const record=prompts.buildPromptRecord(stage,p,syntheticPromptOptions(stage,p));"
new="for(let stage=1;stage<=30;stage++){const p=blank(`JOB-PROMPT-${stage}`);if(stage===4){const intake=engine.intakeCoverageManifest(p);p.job.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-intake-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((unit,index)=>({sourceUnitId:unit.sourceUnitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:'verify-stage4-'+(index+1),text:String(unit.text||unit.rawValue||unit.fieldName),statementClass:'PROJECT_INPUT'}]})),conversationStatements:[]});p.stages[1].status='COMPLETE';p.stages[3].status='COMPLETE';p.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:true,SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false,RESEARCH_GAPS_AND_BLOCKERS:'NONE'};}const record=prompts.buildPromptRecord(stage,p,syntheticPromptOptions(stage,p));"
if old not in s: raise SystemExit('verify.mjs stage prompt loop anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
