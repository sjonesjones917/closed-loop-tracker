from pathlib import Path

path = Path('verify-human-stage-walkthrough.mjs')
text = path.read_text()
old = """    engine.ensureShape(state);engine.recalculate(state);
    const checked=[],lane={runId:'RUN-001',contextId:'CTX-001',iterationId:'ITER-001',candidateId:'CAND-001',baselineId:'BASE-001',productId:'PROD-001'};
    for(let stage=1;stage<=30;stage++)for(const operation of schema.STAGE_CONTRACTS[stage].operations){
      const record=prompts.buildPromptRecord(stage,state,{operation,scope:lane}),text=record.prompt;
"""
new = """    engine.ensureShape(state);engine.recalculate(state);
    const intake=engine.intakeCoverageManifest(state);
    state.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,inspectionStatus:unit.kind==='SUPPLIED_MATERIAL'?'INSPECTED':'NOT_APPLICABLE',disposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'Captured by the sequential browser fixture.',extractedStatements:[{statementKey:'WALK-'+String(index+1),text:String(unit.rawValueText||unit.label||unit.unitId),statementClass:'CONTEXT',sourceLocation:String(unit.sourceLocation||'APPLICATION_INTAKE_UNIT')}]}))});
    state.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';
    const checked=[],lane={runId:'RUN-001',contextId:'CTX-001',iterationId:'ITER-001',candidateId:'CAND-001',baselineId:'BASE-001',productId:'PROD-001'};
    for(let stage=1;stage<=30;stage++){
      if(stage>1){state.stages[stage-1].status='COMPLETE';state.stages[stage-1].gate={complete:true,blocked:false,reasons:[]};}
      for(const operation of schema.STAGE_CONTRACTS[stage].operations){
      const record=prompts.buildPromptRecord(stage,state,{operation,scope:lane}),text=record.prompt;
"""
if old not in text:
    raise AssertionError('Sequential browser prompt loop fixture was not found.')
text = text.replace(old, new, 1)
old_close = """      checked.push(stage+':'+operation);
    }
    const workflowButton=document.querySelector('[data-view=\"Workflow\"]');"""
new_close = """      checked.push(stage+':'+operation);
      }
    }
    const workflowButton=document.querySelector('[data-view=\"Workflow\"]');"""
if old_close not in text:
    raise AssertionError('Sequential browser prompt loop closing brace was not found.')
text = text.replace(old_close, new_close, 1)
path.write_text(text)
print('Sequential browser stage walkthrough now advances through explicit predecessor completion and valid Stage 01 accounting instead of bypassing prompt gates.')
