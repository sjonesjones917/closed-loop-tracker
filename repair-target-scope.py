from pathlib import Path

p=Path('workflow-schema.js'); s=p.read_text()
old="if(s===11){base.push('runId','contextId');}if(s>=20)base.push('baselineId');if(s>=21)base.push('productId');"
new="if([11,17,19].includes(s)){base.push('runId','contextId');}if(s>=21)base.push('baselineId','productId');"
if s.count(old)!=1: raise SystemExit(f'scope requirements anchor mismatch: {s.count(old)}')
s=s.replace(old,new,1);p.write_text(s)

p=Path('prompt-engine.js'); s=p.read_text()
old="function assertRequiredPromptScope(stage,operation,scope){const required=schema.operationContract(stage,operation)?.scopeRequirements||[],laneKeys=['runId','contextId'],missing=required.filter(key=>laneKeys.includes(key)&&scopePlaceholder(scope?.[key]));if(missing.length){const error=new Error(`Controlling instruction cannot be created until application execution-lane identity exists for: ${missing.join(', ')}.`);error.code='MISSING_REQUIRED_PROMPT_SCOPE';error.missingScope=missing;throw error;}return scope;}"
new="function assertRequiredPromptScope(stage,operation,scope){const required=schema.operationContract(stage,operation)?.scopeRequirements||[],targetKeys=['iterationId','candidateId','runId','contextId','baselineId','productId'],missing=required.filter(key=>targetKeys.includes(key)&&scopePlaceholder(scope?.[key]));if(missing.length){const error=new Error(`Controlling instruction cannot be created until application target identity exists for: ${missing.join(', ')}.`);error.code='MISSING_REQUIRED_PROMPT_SCOPE';error.missingScope=missing;throw error;}return scope;}"
if s.count(old)!=1: raise SystemExit(f'prompt target guard anchor mismatch: {s.count(old)}')
s=s.replace(old,new,1)
# Stage 10 is correctly a post-freeze review once target identity is enforced.
s=s.replace("10:'Review the exact verified artifact/component selection proposed for candidate freeze for this job.","10:'Review the exact candidate freeze for this job and iteration.",1)
p.write_text(s)

p=Path('verify-ingestion.mjs'); s=p.read_text()
old="function savePrompt(p,stage){\n  const options=stage===19?{operation:'COMPARE'}:stage===11?{scope:{runId:'RUN-INGESTION-FIXTURE',contextId:'CONTEXT-INGESTION-FIXTURE'}}:{};\n  const record={...prompts.buildPromptRecord(stage,p,options),generatedAt:new Date().toISOString(),iteration:p.job.CURRENT_ITERATION||'NOT APPLICABLE'};"
new="""function savePrompt(p,stage){
  const operation=stage===19?'COMPARE':schema.STAGE_CONTRACTS[stage].operations[0],scope={};for(const key of schema.operationContract(stage,operation).scopeRequirements){if(key==='iterationId')scope[key]='ITERATION-INGESTION-FIXTURE';else if(key==='candidateId')scope[key]='CANDIDATE-INGESTION-FIXTURE';else if(key==='runId')scope[key]='RUN-INGESTION-FIXTURE';else if(key==='contextId')scope[key]='CONTEXT-INGESTION-FIXTURE';else if(key==='baselineId')scope[key]='BASELINE-INGESTION-FIXTURE';else if(key==='productId')scope[key]='PRODUCT-INGESTION-FIXTURE';}
  const options={operation,scope};
  const record={...prompts.buildPromptRecord(stage,p,options),generatedAt:new Date().toISOString(),iteration:p.job.CURRENT_ITERATION||'NOT APPLICABLE'};"""
if s.count(old)!=1: raise SystemExit(f'ingestion savePrompt anchor mismatch: {s.count(old)}')
s=s.replace(old,new,1);p.write_text(s)

p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
anchor="  engine.ensureShape(p);\n  return p;\n}\n"
replacement="  engine.ensureShape(p);\n  p.projectData.candidateFreezes.push({id:'CANDIDATE-000001',stage:10,active:true,scope:{iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001'},fields:{CANDIDATE_ID:'CANDIDATE-000001',ITERATION_ID:'ITERATION-000001',COMPONENT_HASHES:{fixture:'a'.repeat(64)}}});\n  return p;\n}\n"
if s.count(anchor)!=1: raise SystemExit('baseProject anchor mismatch')
s=s.replace(anchor,replacement,1)
# Replace the pre-freeze wording test inserted by the artifact-context repair with target-contract assertions.
old="""{
 const p=baseProject(),r=prompts.buildPromptRecord(10,p,{operation:'COMPLETE'});if(r.prompt.includes('Review the exact candidate freeze for this job and iteration'))throw new Error('Stage 10 still requires inspection of a candidate freeze that does not yet exist.');if(!r.prompt.includes('proposed for candidate freeze'))throw new Error('Stage 10 does not describe the actual pre-freeze review sequence.');
}
"""
new="""{
 const blank=core.createBlankState('JOB-TARGET-SCOPE');blank.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(blank);let failure=null;try{prompts.buildPromptRecord(10,blank,{operation:'COMPLETE'});}catch(error){failure=error;}if(failure?.code!=='MISSING_REQUIRED_PROMPT_SCOPE'||!failure.missingScope?.includes('iterationId')||!failure.missingScope?.includes('candidateId'))throw new Error('Stage 10 can create a controlling review prompt before the application candidate/iteration freeze exists.');
 const run17=schema.operationContract(17,'EXECUTE_RUN').scopeRequirements,verify17=schema.operationContract(17,'VERIFY').scopeRequirements,compare17=schema.operationContract(17,'COMPARE').scopeRequirements,run19=schema.operationContract(19,'EXECUTE_RUN').scopeRequirements;if(!run17.includes('runId')||!run17.includes('contextId')||!verify17.includes('runId')||!verify17.includes('contextId')||compare17.includes('runId')||compare17.includes('contextId')||!run19.includes('runId')||!run19.includes('contextId'))throw new Error('Stage 17/19 operation scope does not bind run-specific operations to exact reserved run/context identities.');
 const s20=schema.operationContract(20,'COMPLETE').scopeRequirements,s21=schema.operationContract(21,'COMPLETE').scopeRequirements;if(s20.includes('baselineId')||!s20.includes('candidateId')||!s21.includes('baselineId')||!s21.includes('productId'))throw new Error('Baseline/product target scope is ordered incorrectly across Stage 20/21.');
}
"""
if old not in s: raise SystemExit('inserted stage10 test anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

Path('repair-target-scope.py').unlink(missing_ok=True)
