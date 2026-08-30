from pathlib import Path

# Correct the structured Stage 01/04 accounting contract. The application
# validates rows structurally; these are not string blobs.
p=Path('workflow-schema.js');s=p.read_text()
s=s.replace("INTAKE_ACCOUNTING:Object.freeze({valueType:'STRING'","INTAKE_ACCOUNTING:Object.freeze({valueType:'OBJECT_ARRAY'")
s=s.replace("OBLIGATION_ACCOUNTING:Object.freeze({valueType:'STRING'","OBLIGATION_ACCOUNTING:Object.freeze({valueType:'OBJECT_ARRAY'")
if "INTAKE_ACCOUNTING:Object.freeze({valueType:'OBJECT_ARRAY'" not in s or "OBLIGATION_ACCOUNTING:Object.freeze({valueType:'OBJECT_ARRAY'" not in s:
    raise SystemExit('accounting type correction did not materialize')
p.write_text(s)

# Keep verify.mjs aligned with the /3 runtime contract. This block is idempotent.
p=Path('verify.mjs');s=p.read_text()
for old,new in [
    ("'workflow-schema.js','workflow-engine.js'","'workflow-schema.js','test-runtime.js','workflow-engine.js'"),
    ("'workflow-schema.js','workflow-engine.js','prompt-engine.js'","'workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'"),
    ("'Revise the Responsible Layer'","'Correct the Root Cause'"),
    ("'closed-loop-stage-response/2'","'closed-loop-stage-response/3'"),
    ("core.PROJECT_SCHEMA==='closed-loop-project/2'","core.PROJECT_SCHEMA==='closed-loop-project/3'"),
    ("schema.RESPONSE_SCHEMA==='closed-loop-stage-response/2'","schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3'"),
    ("'Response schema /2 is required.'","'Response schema /3 is required.'"),
]:
    s=s.replace(old,new)
old="for(let stage=1;stage<=30;stage++){const p=blank(`JOB-PROMPT-${stage}`);const record=prompts.buildPromptRecord(stage,p,syntheticPromptOptions(stage,p));"
new="for(let stage=1;stage<=30;stage++){const p=blank(`JOB-PROMPT-${stage}`);if(stage===4){const incomplete=blank('JOB-PROMPT-4-INCOMPLETE');let blocked=false;try{prompts.buildPromptRecord(4,incomplete,syntheticPromptOptions(4,incomplete));}catch(error){blocked=/Stage 04 prompt generation blocked: current Stage 01/.test(String(error?.message||error));}if(!blocked)throw new Error('Stage 04 prompt generation accepted incomplete upstream state.');p.stages[1].status='COMPLETE';p.stages[1].gate={...(p.stages[1].gate||{}),complete:true};p.stages[3].status='COMPLETE';p.stages[3].gate={...(p.stages[3].gate||{}),complete:true};}const record=prompts.buildPromptRecord(stage,p,syntheticPromptOptions(stage,p));"
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('synthetic prompt loop anchor missing')
p.write_text(s)

# Align the ingestion verifier with application-owned Stage 01/04 accounting.
p=Path('verify-ingestion.mjs');s=p.read_text()
s=s.replace("['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']","['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']")
old="function savePrompt(p,stage){\n  const options=stage===19?{operation:'COMPARE'}:stage===11?{scope:{runId:'RUN-INGESTION-FIXTURE',contextId:'CONTEXT-INGESTION-FIXTURE'}}:{};"
new="function savePrompt(p,stage){\n  if(stage===4){p.stages[1].status='COMPLETE';p.stages[1].gate={...(p.stages[1].gate||{}),complete:true};p.stages[3].status='COMPLETE';p.stages[3].gate={...(p.stages[3].gate||{}),complete:true};}\n  const options=stage===19?{operation:'COMPARE'}:stage===11?{scope:{runId:'RUN-INGESTION-FIXTURE',contextId:'CONTEXT-INGESTION-FIXTURE'}}:{};"
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('savePrompt anchor missing')
old="  if(stage===1)records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];"
new="  if(stage===1){const manifest=engine.buildIntakeCoverageManifest(p);stageData.INTAKE_ACCOUNTING=manifest.units.map(unit=>({id:unit.unitId,disposition:'incorporated into the job definition'}));records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];}\n  if(stage===4){const manifest=engine.buildObligationManifest(p);stageData.OBLIGATION_ACCOUNTING=manifest.items.map(item=>({id:item.obligationId,disposition:'retained nonnormative context'}));}"
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('Stage 01 envelope anchor missing')
s=s.replace("'{\"schema\":\"closed-loop-stage-response/2\"'","'{\"schema\":\"closed-loop-stage-response/3\"'")

# The generic next-stage assertion must respect the Stage 04 hard prerequisite.
# First prove an incomplete Stage 01/03 state is rejected; only then create the
# complete synthetic upstream state used to verify the Stage 04 prompt body.
old="  if(stage<30){const nextStage=stage+1,nextOptions=nextStage===11?{scope:{runId:'RUN-NEXT-FIXTURE',contextId:'CONTEXT-NEXT-FIXTURE'}}:{},nextPrompt=prompts.buildPromptRecord(nextStage,reloaded,nextOptions).prompt,isolated=[11,12,23,24].includes(nextStage);if(!nextPrompt.includes(`JOB_ID: ${p.job.JOB_ID}`))throw new Error(`Stage ${nextStage} prompt lost JOB_ID isolation.`);if(isolated&&nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} isolation prompt leaked generic prior-stage context.`);if(!isolated&&!nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} prompt did not consume accepted prior-stage context.`);}"
new="  if(stage<30){const nextStage=stage+1,nextOptions=nextStage===11?{scope:{runId:'RUN-NEXT-FIXTURE',contextId:'CONTEXT-NEXT-FIXTURE'}}:{};let promptState=reloaded;if(nextStage===4){let blocked=false;try{prompts.buildPromptRecord(4,promptState,nextOptions);}catch(error){blocked=/Stage 04 prompt generation blocked: current Stage 01|Stage 04 prompt generation blocked: current Stage 03/.test(String(error?.message||error));}if(!blocked)throw new Error('Stage 04 next-prompt verifier accepted incomplete upstream state.');promptState=JSON.parse(JSON.stringify(reloaded));engine.ensureShape(promptState);promptState.stages[1].status='COMPLETE';promptState.stages[1].gate={...(promptState.stages[1].gate||{}),complete:true};promptState.stages[3].status='COMPLETE';promptState.stages[3].gate={...(promptState.stages[3].gate||{}),complete:true};}const nextPrompt=prompts.buildPromptRecord(nextStage,promptState,nextOptions).prompt,isolated=[11,12,23,24].includes(nextStage);if(!nextPrompt.includes(`JOB_ID: ${p.job.JOB_ID}`))throw new Error(`Stage ${nextStage} prompt lost JOB_ID isolation.`);if(isolated&&nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} isolation prompt leaked generic prior-stage context.`);if(!isolated&&!nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} prompt did not consume accepted prior-stage context.`);}"
if old in s:
    s=s.replace(old,new,1)
elif "Stage 04 next-prompt verifier accepted incomplete upstream state." not in s:
    raise SystemExit('next-stage prompt anchor missing')

anchor="negative('wrong schema',(e)=>{e.schema='closed-loop-stage-response/999';},'WRONG_SCHEMA');"
extra="negative('wrong schema',(e)=>{e.schema='closed-loop-stage-response/999';},'WRONG_SCHEMA');\nnegativeAt('incomplete Stage 01 intake accounting',1,(e)=>{e.stageData.INTAKE_ACCOUNTING=e.stageData.INTAKE_ACCOUNTING.slice(1);},'INCOMPLETE_INTAKE_ACCOUNTING');"
if "incomplete Stage 01 intake accounting" not in s:
    if anchor not in s: raise SystemExit('negative-test anchor missing')
    s=s.replace(anchor,extra,1)
p.write_text(s)
