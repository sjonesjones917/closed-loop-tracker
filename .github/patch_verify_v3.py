from pathlib import Path
p=Path('verify.mjs');s=p.read_text()
s=s.replace("'workflow-schema.js','workflow-engine.js'","'workflow-schema.js','test-runtime.js','workflow-engine.js'")
s=s.replace("'workflow-schema.js','workflow-engine.js','prompt-engine.js'","'workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'")
s=s.replace("'Revise the Responsible Layer'","'Correct the Root Cause'")
s=s.replace("'closed-loop-stage-response/2'","'closed-loop-stage-response/3'")
s=s.replace("core.PROJECT_SCHEMA==='closed-loop-project/2'","core.PROJECT_SCHEMA==='closed-loop-project/3'")
s=s.replace("schema.RESPONSE_SCHEMA==='closed-loop-stage-response/2'","schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3'")
s=s.replace("'Response schema /2 is required.'","'Response schema /3 is required.'")
old="for(let stage=1;stage<=30;stage++){const p=blank(`JOB-PROMPT-${stage}`);const record=prompts.buildPromptRecord(stage,p,syntheticPromptOptions(stage,p));"
new="for(let stage=1;stage<=30;stage++){const p=blank(`JOB-PROMPT-${stage}`);if(stage===4){const incomplete=blank('JOB-PROMPT-4-INCOMPLETE');let blocked=false;try{prompts.buildPromptRecord(4,incomplete,syntheticPromptOptions(4,incomplete));}catch(error){blocked=/Stage 04 prompt generation blocked: current Stage 01/.test(String(error?.message||error));}if(!blocked)throw new Error('Stage 04 prompt generation accepted incomplete upstream state.');p.stages[1].status='COMPLETE';p.stages[1].gate={...(p.stages[1].gate||{}),complete:true};p.stages[3].status='COMPLETE';p.stages[3].gate={...(p.stages[3].gate||{}),complete:true};}const record=prompts.buildPromptRecord(stage,p,syntheticPromptOptions(stage,p));"
if old not in s: raise SystemExit('synthetic prompt loop anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
