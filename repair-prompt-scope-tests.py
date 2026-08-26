from pathlib import Path
p=Path('verify.mjs'); s=p.read_text()
old="const generated=[];\nfor(let stage=1;stage<=30;stage++){const p=blank(`JOB-PROMPT-${stage}`);const record=prompts.buildPromptRecord(stage,p);generated.push(record.prompt);"
new="""function syntheticPromptOptions(stage,p){const operation=schema.STAGE_CONTRACTS[stage].operations[0],scope={};for(const key of schema.operationContract(stage,operation).scopeRequirements){if(key==='projectRevision')scope[key]=Number(p.revision||0);else if(key==='inputVersion')scope[key]=p.job.CURRENT_INPUT_VERSION;else if(key==='sourceSetVersion')scope[key]='SOURCE-SET-v001';else if(key==='requirementsVersion')scope[key]='REQUIREMENTS-v001';else if(key==='testSuiteVersion')scope[key]='TEST-SUITE-v001';else if(key==='instructionVersion')scope[key]='INSTRUCTION-v001';else if(key==='iterationId')scope[key]='ITERATION-000001';else if(key==='candidateId')scope[key]='CANDIDATE-000001';else if(key==='runId')scope[key]='RUN-000001';else if(key==='contextId')scope[key]='CONTEXT-000001';else if(key==='baselineId')scope[key]='BASELINE-000001';else if(key==='productId')scope[key]='PRODUCT-000001';}return {operation,scope};}
const generated=[];
for(let stage=1;stage<=30;stage++){const p=blank(`JOB-PROMPT-${stage}`);const record=prompts.buildPromptRecord(stage,p,syntheticPromptOptions(stage,p));generated.push(record.prompt);"""
if s.count(old)!=1: raise SystemExit(f'verify prompt loop anchor mismatch: {s.count(old)}')
s=s.replace(old,new,1);p.write_text(s)

p=Path('verify-ingestion.mjs');s=p.read_text()
old="function savePrompt(p,stage){\n  const options=stage===19?{operation:'COMPARE'}:{};\n  const record={...prompts.buildPromptRecord(stage,p,options),generatedAt:new Date().toISOString(),iteration:p.job.CURRENT_ITERATION||'NOT APPLICABLE'};"
new="function savePrompt(p,stage){\n  const options=stage===19?{operation:'COMPARE'}:stage===11?{scope:{runId:'RUN-INGESTION-FIXTURE',contextId:'CONTEXT-INGESTION-FIXTURE'}}:{};\n  const record={...prompts.buildPromptRecord(stage,p,options),generatedAt:new Date().toISOString(),iteration:p.job.CURRENT_ITERATION||'NOT APPLICABLE'};"
if s.count(old)!=1: raise SystemExit(f'ingestion savePrompt anchor mismatch: {s.count(old)}')
s=s.replace(old,new,1)
old="if(stage<30){const nextPrompt=prompts.buildPromptRecord(stage+1,reloaded).prompt;if(!nextPrompt.includes(`JOB_ID: ${p.job.JOB_ID}`)||!nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${stage+1} prompt did not consume accepted prior-stage context.`);}"
new="if(stage<30){const nextStage=stage+1,nextOptions=nextStage===11?{scope:{runId:'RUN-NEXT-FIXTURE',contextId:'CONTEXT-NEXT-FIXTURE'}}:{};const nextPrompt=prompts.buildPromptRecord(nextStage,reloaded,nextOptions).prompt;if(!nextPrompt.includes(`JOB_ID: ${p.job.JOB_ID}`)||!nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} prompt did not consume accepted prior-stage context.`);}"
if s.count(old)!=1: raise SystemExit(f'ingestion nextPrompt anchor mismatch: {s.count(old)}')
s=s.replace(old,new,1);p.write_text(s)
Path('repair-prompt-scope-tests.py').unlink(missing_ok=True)
