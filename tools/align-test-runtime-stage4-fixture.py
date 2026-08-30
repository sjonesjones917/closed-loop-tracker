from pathlib import Path

p=Path('verify-test-runtime.mjs')
s=p.read_text()
anchor="Object.assign(project.job,{JOB_ID:'JOB-STAGE04-CANONICAL-INPUT',EXACT_USER_OBJECTIVE_VERBATIM:'Compile the accepted researched obligations into atomic requirements.',SUPPLIED_MATERIALS_INVENTORY:'text 30(1).txt',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'NOT APPLICABLE',CURRENT_TEST_SUITE_VERSION:'NOT APPLICABLE',CURRENT_INSTRUCTION_VERSION:'NOT APPLICABLE',CURRENT_STAGE:'STAGE 04',CURRENT_STATE:'IN PROGRESS'});project.activeStage=4;"
if anchor not in s: raise SystemExit('Stage4 runtime fixture job anchor missing')
replacement=anchor+"\nconst runtimeIntake=engine.intakeCoverageManifest(project);project.job.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-intake-capture/1',inputVersion:runtimeIntake.inputVersion,manifestSha256:runtimeIntake.manifestSha256,units:runtimeIntake.units.map((unit,index)=>({sourceUnitId:unit.sourceUnitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:'runtime-stage4-'+(index+1),text:String(unit.text||unit.rawValue||unit.fieldName),statementClass:'PROJECT_INPUT'}]})),conversationStatements:[]});project.stages[1].status='COMPLETE';project.stages[3].status='COMPLETE';project.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:true,SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false,RESEARCH_GAPS_AND_BLOCKERS:'NONE'};"
s=s.replace(anchor,replacement,1)
p.write_text(s)
