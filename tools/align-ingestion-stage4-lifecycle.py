from pathlib import Path

p=Path('verify-ingestion.mjs')
s=p.read_text()
anchor="""function savePrompt(p,stage){
  const options=stage===19?{operation:'COMPARE'}:stage===11?{scope:{runId:'RUN-INGESTION-FIXTURE',contextId:'CONTEXT-INGESTION-FIXTURE'}}:{};
  const record={...prompts.buildPromptRecord(stage,p,options),generatedAt:new Date().toISOString(),iteration:p.job.CURRENT_ITERATION||'NOT APPLICABLE'};
  p.projectData.generatedPrompts.push(record);
  return record;
}
"""
if anchor not in s: raise SystemExit('savePrompt anchor missing')
helper=anchor+"""function prepareStage4Prerequisites(p){
  const intake=engine.intakeCoverageManifest(p);
  p.job.EXACT_DELIVERABLE_REQUESTED='Verify the closed-loop response ingestion path.';
  p.job.ASSUMPTIONS='NONE';
  p.job.UNKNOWN_INFORMATION='NONE';
  p.job.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-intake-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((unit,index)=>({sourceUnitId:unit.sourceUnitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:'ingestion-stage4-prereq-'+(index+1),text:String(unit.text||unit.rawValue||unit.fieldName),statementClass:'PROJECT_INPUT'}]})),conversationStatements:[]});
  const stage1ChangeId='CHANGE-STAGE1-PREREQ';
  const stage3ChangeId='CHANGE-STAGE3-PREREQ';
  p.projectData.acceptedChanges=p.projectData.acceptedChanges.filter(change=>![1,3].includes(Number(change.stage)));
  p.projectData.acceptedChanges.push({changeId:stage1ChangeId,stage:1,operation:'COMPLETE',status:'COMMITTED',responseType:'DATA_PROPOSAL',scope:{inputVersion:p.job.CURRENT_INPUT_VERSION},invalidatedBy:null});
  p.projectData.stageConfirmations=p.projectData.stageConfirmations.filter(item=>Number(item.stage)!==1);
  p.projectData.stageConfirmations.push({confirmationId:'CONFIRM-STAGE1-PREREQ',stage:1,confirmed:true,acceptedChangeId:stage1ChangeId,inputVersion:p.job.CURRENT_INPUT_VERSION,invalidatedBy:null});
  p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:p.job.EXACT_DELIVERABLE_REQUESTED,ASSUMPTIONS:p.job.ASSUMPTIONS,UNKNOWN_INFORMATION:p.job.UNKNOWN_INFORMATION,INPUT_SET_CONTENTS:p.job.INPUT_SET_CONTENTS};
  p.stages[1].acceptedData={...p.stages[1].agentData};
  p.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};
  p.projectData.acceptedChanges.push({changeId:stage3ChangeId,stage:3,operation:'COMPLETE',status:'COMMITTED',responseType:'DATA_PROPOSAL',scope:{inputVersion:p.job.CURRENT_INPUT_VERSION,sourceSetVersion:'NOT APPLICABLE'},invalidatedBy:null});
  p.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:true,SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false,RESEARCH_GAPS_AND_BLOCKERS:'NONE'};
  p.stages[3].acceptedData={...p.stages[3].agentData};
  engine.recalculate(p);
  if(p.stages[1].status!=='COMPLETE'||p.stages[3].status!=='COMPLETE')throw new Error('Stage 4 prerequisite fixture did not become gate-complete: '+JSON.stringify({stage1:{status:p.stages[1].status,gate:p.stages[1].gate},stage3:{status:p.stages[3].status,gate:p.stages[3].gate}}));
  return p;
}
"""
s=s.replace(anchor,helper,1)
old="""  let p=project(`JOB-E2E-${String(stage).padStart(2,'0')}`);
  p.activeStage=stage;
  const promptRecord=savePrompt(p,stage);"""
new="""  let p=project(`JOB-E2E-${String(stage).padStart(2,'0')}`);
  p.activeStage=stage;
  if(stage===4)prepareStage4Prerequisites(p);
  const promptRecord=savePrompt(p,stage);"""
if old not in s: raise SystemExit('allStages setup anchor missing')
s=s.replace(old,new,1)
old="""  if(stage<30){const nextStage=stage+1,nextOptions=nextStage===11?{scope:{runId:'RUN-NEXT-FIXTURE',contextId:'CONTEXT-NEXT-FIXTURE'}}:{},nextPrompt=prompts.buildPromptRecord(nextStage,reloaded,nextOptions).prompt,isolated=[11,12,23,24].includes(nextStage);if(!nextPrompt.includes(`JOB_ID: ${p.job.JOB_ID}`))throw new Error(`Stage ${nextStage} prompt lost JOB_ID isolation.`);if(isolated&&nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} isolation prompt leaked generic prior-stage context.`);if(!isolated&&!nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} prompt did not consume accepted prior-stage context.`);}"""
new="""  if(stage<30){const nextStage=stage+1,nextOptions=nextStage===11?{scope:{runId:'RUN-NEXT-FIXTURE',contextId:'CONTEXT-NEXT-FIXTURE'}}:{};if(nextStage===4)prepareStage4Prerequisites(reloaded);const nextPrompt=prompts.buildPromptRecord(nextStage,reloaded,nextOptions).prompt,isolated=[11,12,23,24].includes(nextStage);if(!nextPrompt.includes(`JOB_ID: ${p.job.JOB_ID}`))throw new Error(`Stage ${nextStage} prompt lost JOB_ID isolation.`);if(isolated&&nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} isolation prompt leaked generic prior-stage context.`);if(!isolated&&!nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} prompt did not consume accepted prior-stage context.`);}"""
if old not in s: raise SystemExit('next prompt anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
