from pathlib import Path

prompt = Path('prompt-engine.js')
source = prompt.read_text()
old = 'Never ask the human to repeat information already supplied anywhere in the current conversation or current authorized project input.'
new = 'Never solve a missing-input question by asking the human to repeat information already present or already supplied anywhere in the current conversation or current authorized project input.'
if old not in source:
    raise SystemExit('One-time input wording anchor was not found.')
source = source.replace(old, new, 1)
conversation_anchor = 'You are speaking directly with the human who requested the project. You are not responding to an API, filling a form, or producing a report for a machine.\nDO NOT return final JSON'
conversation_replacement = 'You are speaking directly with the human who requested the project. You are not responding to an API, filling a form, or producing a report for a machine.\nThe user supplies project information once. Capture it completely, preserve it as durable project authority, and reuse it instead of asking for it again.\nClassify every APPLICATION INTAKE MANIFEST unit exactly once.\nINPUT_SET_CONTENTS must preserve the complete durable meaning needed by later stages.\nDO NOT return final JSON'
if conversation_anchor not in source:
    raise SystemExit('Stage 01 one-time conversation anchor was not found.')
source = source.replace(conversation_anchor, conversation_replacement, 1)
stage3_anchor = 'Never ask the human to repeat available project facts or reattach the original Stage 01 intent file.'
stage3_replacement = 'The controlling interaction rule is: never ask the user to repeat available project facts or reattach the original Stage 01 intent file.'
if stage3_anchor not in source:
    raise SystemExit('Stage 03 no-repeat rule anchor was not found.')
source = source.replace(stage3_anchor, stage3_replacement, 1)
common_anchor = 'Project-relevant information supplied by the human is supplied once. Stage 01 is the one-time capture boundary and accepted project meaning must be carried forward in canonical context.'
common_replacement = 'Project-relevant information supplied by the human is supplied once; never ask the human to repeat, retype, summarize, resend, reopen, or reattach it. Stage 01 is the one-time capture boundary and accepted project meaning must be carried forward in canonical context.'
if common_anchor not in source:
    raise SystemExit('Universal no-repeat prompt rule anchor was not found.')
source = source.replace(common_anchor, common_replacement, 1)
prompt.write_text(source)

html = Path('index.html')
markup = html.read_text()
old_css = '.expandable-prompt{height:280px;max-height:280px}.expandable-prompt.expanded{height:auto;max-height:none}'
new_css = '.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'
if old_css not in markup:
    raise SystemExit('Established prompt preview CSS repair anchor was not found.')
html.write_text(markup.replace(old_css, new_css, 1))

engine = Path('workflow-engine.js')
engine_source = engine.read_text()
old_matrix_count = 'ACTUAL_MANDATORY_RECORDS:matrix.actual.length'
new_matrix_count = 'ACTUAL_MANDATORY_RECORDS:matrix.verification.length'
if old_matrix_count not in engine_source:
    raise SystemExit('Stage 12 actual matrix count defect anchor was not found.')
engine.write_text(engine_source.replace(old_matrix_count, new_matrix_count, 1))

walkthrough = Path('verify-human-stage-walkthrough.mjs')
walk = walkthrough.read_text()
start = walk.find("    const checked=[],lane={")
end = walk.find("    const workflowButton=", start)
if start < 0 or end < 0:
    raise SystemExit('Sequential browser prompt-walkthrough anchors were not found.')
replacement = r'''    const checked=[],lane={runId:'RUN-001',contextId:'CTX-001',iterationId:'ITER-001',candidateId:'CAND-001',baselineId:'BASE-001',productId:'PROD-001'};
    for(let stage=1;stage<=30;stage++){
      let intakeManifest=null;
      for(const operation of schema.STAGE_CONTRACTS[stage].operations){
        let record;
        try{record=prompts.buildPromptRecord(stage,state,{operation,scope:lane});}
        catch(error){throw new Error('Stage '+stage+' '+operation+' prompt generation failed: '+(error?.stack||error));}
        const text=record.prompt;
        if(!text||text.length<200)throw new Error('Stage '+stage+' '+operation+' generated an incomplete prompt.');
        if(!text.includes('PROJECT DATA EXECUTION RULE — MANDATORY'))throw new Error('Stage '+stage+' '+operation+' omitted the one-time project-data rule.');
        if(stage>1&&!text.includes('The original Stage 01 intent file is prohibited input for this stage.'))throw new Error('Stage '+stage+' '+operation+' can request the original intent again.');
        if(!text.includes('STRICT RESPONSE CONTRACT'))throw new Error('Stage '+stage+' '+operation+' omitted its response contract.');
        if(stage===1){
          intakeManifest=record.contextManifest?.intakeCoverageManifest;
          if(!text.includes('STAGE 01 HUMAN CONVERSATION — THIS OCCURS BEFORE ANY FINAL JSON'))throw new Error('Stage 01 did not begin with the human conversation protocol.');
          if(text.indexOf('STAGE 01 HUMAN CONVERSATION')>text.indexOf('STRICT RESPONSE CONTRACT'))throw new Error('Stage 01 machine contract appears before the human conversation.');
          if(!text.includes('intent.txt')||!text.includes('ask the human in plain language to attach or provide the exact named material now'))throw new Error('Stage 01 did not request the named intake file when unavailable.');
        }
        checked.push(stage+':'+operation);
      }
      if(stage===1){
        if(!intakeManifest?.units?.length)throw new Error('Stage 01 intake manifest was not generated.');
        state.stages[1].agentData.EXACT_DELIVERABLE_REQUESTED='One complete subject-neutral deliverable implementing every supplied project requirement.';
        state.stages[1].agentData.ASSUMPTIONS='NONE';
        state.stages[1].agentData.UNKNOWN_INFORMATION='NONE';
        state.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({
          inputVersion:intakeManifest.inputVersion,
          manifestSha256:intakeManifest.manifestSha256,
          units:intakeManifest.units.map((unit,index)=>({
            sourceUnitId:unit.unitId,
            sourceRawValueSha256:unit.rawValueSha256,
            disposition:'incorporated into the job definition',
            reason:'Captured once for the ordered browser walkthrough.',
            extractedStatements:[{statementKey:'WALK-'+String(index+1),text:unit.rawValueText||unit.label||'Captured authorized project input.',statementClass:'FACT'}]
          }))
        });
      }
      if(stage===2)state.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(stage===3)Object.assign(state.stages[3].agentData,{ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:'TRUE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'});
      state.stages[stage].status='COMPLETE';
      state.stages[stage].gate={complete:true,blocked:false,reasons:[]};
    }
'''
walkthrough.write_text(walk[:start] + replacement + walk[end:])
