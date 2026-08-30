from pathlib import Path
import re

# Correct the structured Stage 01/04 accounting contract. The application
# validates rows structurally; these are not string blobs.
p=Path('workflow-schema.js');s=p.read_text()
s=s.replace("INTAKE_ACCOUNTING:Object.freeze({valueType:'STRING'","INTAKE_ACCOUNTING:Object.freeze({valueType:'OBJECT_ARRAY'")
s=s.replace("OBLIGATION_ACCOUNTING:Object.freeze({valueType:'STRING'","OBLIGATION_ACCOUNTING:Object.freeze({valueType:'OBJECT_ARRAY'")
if "INTAKE_ACCOUNTING:Object.freeze({valueType:'OBJECT_ARRAY'" not in s or "OBLIGATION_ACCOUNTING:Object.freeze({valueType:'OBJECT_ARRAY'" not in s:
    raise SystemExit('accounting type correction did not materialize')
p.write_text(s)

# Stage 04's obligation universe is application-selected and zero-loss. It must
# directly include current human job input, accepted Stage 01 data, Stage 01
# intent records, every current Stage 03 candidate/research value, and current
# source/evidence context. It must not depend on the agent having recopied the
# human's information into some other field first.
p=Path('workflow-engine.js');s=p.read_text()
new_build_obligation=r'''function buildObligationManifest(project){
  ensureShape(project);
  const inputVersion=String(project.job.CURRENT_INPUT_VERSION||'UNKNOWN');
  const sourceSetVersion=String(project.job.CURRENT_SOURCE_SET_VERSION||'UNKNOWN');
  const researchVersion=String(project.job.CURRENT_RESEARCH_VERSION||project.stages?.[3]?.derivedData?.RESEARCH_VERSION||project.stages?.[3]?.agentData?.RESEARCH_VERSION||'UNKNOWN');
  const manifestScope={inputVersion,sourceSetVersion,researchVersion};
  const items=[];
  const add=(origin,originId,location,value,extra={})=>{
    for(const [index,text] of coverageUnits(value).entries()){
      items.push({
        obligationId:`OBLIGATION-${hash.sha256Value({manifestScope,origin,originId,location,index,text}).slice(0,20)}`,
        origin,originId:String(originId||''),sourceLocation:`${location}[${index}]`,
        rawValueSha256:hash.sha256Value(text),text,...extra
      });
    }
  };

  const latestInput=safe(project.projectData.inputVersions).filter(x=>String(x.version||'')===inputVersion).at(-1);
  const humanPayload=latestInput?.payload||Object.fromEntries(schema.HUMAN_INTAKE_FIELDS.map(name=>[name,project.job?.[name]??'']));
  for(const name of schema.HUMAN_INTAKE_FIELDS){
    add('CURRENT_USER_JOB_INPUT',name,`job.${name}`,humanPayload?.[name],{inputField:name,inputVersion});
  }
  for(const [index,clarification] of safe(humanPayload?.clarifications).entries()){
    add('CURRENT_USER_CLARIFICATION',`CLARIFICATION-${index+1}`,`inputVersions.${inputVersion}.clarifications.${index}`,clarification,{inputVersion});
  }

  const stage1Agent=project.stages?.[1]?.agentData||{};
  for(const [name,value] of Object.entries(stage1Agent)){
    if(name==='INTAKE_ACCOUNTING')continue;
    add('STAGE_01_JOB_DEFINITION','STAGE-01',`stage01.agentData.${name}`,value,{stage1Field:name});
  }
  const stage1Human=project.stages?.[1]?.humanData||{};
  for(const [name,value] of Object.entries(stage1Human)){
    add('STAGE_01_HUMAN_DATA','STAGE-01',`stage01.humanData.${name}`,value,{stage1Field:name});
  }
  for(const record of recordsForCurrentScope(project,'intentStatements')){
    const sid=recordId(record,'intentStatements'),relevance=upper(recordValue(record,'REQUIREMENT_RELEVANCE'));
    add('HUMAN_INTENT_STATEMENT',sid,`intentStatements.${sid}.EXACT_STATEMENT`,recordValue(record,'EXACT_STATEMENT'),{statementId:sid,requirementRelevance:relevance});
  }

  const stage3Agent=project.stages?.[3]?.agentData||{};
  for(const [name,value] of Object.entries(stage3Agent)){
    if(name==='OBLIGATION_ACCOUNTING')continue;
    add('STAGE_03_ACCEPTED_DATA','STAGE-03',`stage03.agentData.${name}`,value,{stage3Field:name});
  }
  for(const record of recordsForCurrentScope(project,'candidateRequirements')){
    const id=recordId(record,'candidateRequirements');
    for(const [name,value] of Object.entries(recordFields(record))){
      if(['CANDIDATE_REQ_ID','STATUS'].includes(name))continue;
      add('STAGE_03_CANDIDATE_REQUIREMENT',id,`candidateRequirements.${id}.${name}`,value,{candidateRequirementId:id,candidateField:name,sourceId:String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||'')});
    }
  }
  for(const record of recordsForCurrentScope(project,'research')){
    const id=recordId(record,'research');
    for(const [name,value] of Object.entries(recordFields(record))){
      if(name==='RESEARCH_ID')continue;
      add('STAGE_03_RESEARCH',id,`research.${id}.${name}`,value,{researchId:id,researchField:name,sourceId:String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||'')});
    }
  }

  const currentSources=recordsForCurrentScope(project,'sources').map(record=>({
    sourceId:recordId(record,'sources'),fields:clone(recordFields(record)),relationships:clone(record.relationships||{}),sha256:record.sha256||null
  }));
  const currentSourceIds=new Set(currentSources.map(x=>x.sourceId).filter(Boolean));
  const currentEvidence=records(project,'evidenceRecords').filter(record=>{
    const sourceId=String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||'');
    return !sourceId||currentSourceIds.has(sourceId);
  }).map(record=>({
    evidenceId:recordId(record,'evidenceRecords'),fields:clone(recordFields(record)),relationships:clone(record.relationships||{}),sha256:record.sha256||null
  }));
  const intakeManifest=buildIntakeCoverageManifest(project);
  const stage1Context={agentData:clone(stage1Agent),humanData:clone(stage1Human),intentStatements:recordsForCurrentScope(project,'intentStatements').map(clone)};
  const stage3Context={agentData:clone(stage3Agent),candidateRequirements:recordsForCurrentScope(project,'candidateRequirements').map(clone),research:recordsForCurrentScope(project,'research').map(clone)};

  const unique=[...new Map(items.map(x=>[x.obligationId,x])).values()];
  const manifestSha256=hash.sha256Value({
    manifestScope,
    intakeManifestSha256:intakeManifest.manifestSha256,
    items:unique.map(({text,...x})=>({...x,textSha256:hash.sha256Value(text)})),
    stage1Context,stage3Context,currentSources,currentEvidence
  });
  const prior=safe(project.projectData.obligationManifests).find(x=>x.manifestSha256===manifestSha256);
  if(prior)return prior;
  const manifest={
    manifestId:allocateInfrastructureId(project,'OBLIGATION-MANIFEST','obligationManifests'),
    inputVersion,sourceSetVersion,researchVersion,
    intakeManifestId:intakeManifest.manifestId,intakeManifestSha256:intakeManifest.manifestSha256,
    manifestSha256,items:unique,stage1Context,stage3Context,sourceContext:currentSources,evidenceContext:currentEvidence,
    createdAt:now(),source:'APPLICATION'
  };
  project.projectData.obligationManifests.push(manifest);
  return manifest;
}'''
pattern=r"function buildObligationManifest\(project\)\{.*?\nfunction parseAccountingRows"
match=re.search(pattern,s,re.S)
if not match: raise SystemExit('buildObligationManifest anchor missing')
s=s[:match.start()]+new_build_obligation+"\nfunction parseAccountingRows"+s[match.end():]
p.write_text(s)

# Prompt contract: the accounting values are native JSON arrays, not strings,
# and the serialized application manifest is the complete Stage 04 universe.
p=Path('prompt-engine.js');s=p.read_text()
s=s.replace('INTAKE_ACCOUNTING must be a JSON array encoded as the INTAKE_ACCOUNTING stageData string.','INTAKE_ACCOUNTING must be a JSON array in stageData.INTAKE_ACCOUNTING.')
s=s.replace('OBLIGATION_ACCOUNTING must be a JSON array encoded as the OBLIGATION_ACCOUNTING stageData string.','OBLIGATION_ACCOUNTING must be a JSON array in stageData.OBLIGATION_ACCOUNTING.')
required='This is the application-selected Stage 04 input universe. Do not rediscover it and do not ask the human for anything already represented here.'
replacement='This is the complete application-selected Stage 04 input universe, including current human job input, accepted Stage 01 data and intent records, all current Stage 03 candidate/research data, and applicable source/evidence context. Exhaust every item and all included context before compiling requirements. Do not rediscover it and do not ask the human for anything already represented here.'
s=s.replace(required,replacement)
if replacement not in s: raise SystemExit('Stage 04 prompt universe wording missing')
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
if old in s:s=s.replace(old,new,1)
elif new not in s:raise SystemExit('synthetic prompt loop anchor missing')
p.write_text(s)

# Align the ingestion verifier with application-owned Stage 01/04 accounting.
p=Path('verify-ingestion.mjs');s=p.read_text()
s=s.replace("['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']","['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']")
old="function savePrompt(p,stage){\n  const options=stage===19?{operation:'COMPARE'}:stage===11?{scope:{runId:'RUN-INGESTION-FIXTURE',contextId:'CONTEXT-INGESTION-FIXTURE'}}:{};"
new="function savePrompt(p,stage){\n  if(stage===4){p.stages[1].status='COMPLETE';p.stages[1].gate={...(p.stages[1].gate||{}),complete:true};p.stages[3].status='COMPLETE';p.stages[3].gate={...(p.stages[3].gate||{}),complete:true};}\n  const options=stage===19?{operation:'COMPARE'}:stage===11?{scope:{runId:'RUN-INGESTION-FIXTURE',contextId:'CONTEXT-INGESTION-FIXTURE'}}:{};"
if old in s:s=s.replace(old,new,1)
elif new not in s:raise SystemExit('savePrompt anchor missing')
old="  if(stage===1)records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];"
new="  if(stage===1){const manifest=engine.buildIntakeCoverageManifest(p);stageData.INTAKE_ACCOUNTING=manifest.units.map(unit=>({id:unit.unitId,disposition:'incorporated into the job definition'}));records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];}\n  if(stage===4){const manifest=engine.buildObligationManifest(p);stageData.OBLIGATION_ACCOUNTING=manifest.items.map(item=>({id:item.obligationId,disposition:'retained nonnormative context'}));}"
if old in s:s=s.replace(old,new,1)
elif new not in s:raise SystemExit('Stage 01 envelope anchor missing')
s=s.replace("'{\"schema\":\"closed-loop-stage-response/2\"'","'{\"schema\":\"closed-loop-stage-response/3\"'")
old="  if(stage<30){const nextStage=stage+1,nextOptions=nextStage===11?{scope:{runId:'RUN-NEXT-FIXTURE',contextId:'CONTEXT-NEXT-FIXTURE'}}:{},nextPrompt=prompts.buildPromptRecord(nextStage,reloaded,nextOptions).prompt,isolated=[11,12,23,24].includes(nextStage);if(!nextPrompt.includes(`JOB_ID: ${p.job.JOB_ID}`))throw new Error(`Stage ${nextStage} prompt lost JOB_ID isolation.`);if(isolated&&nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} isolation prompt leaked generic prior-stage context.`);if(!isolated&&!nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} prompt did not consume accepted prior-stage context.`);}"
new="  if(stage<30){const nextStage=stage+1,nextOptions=nextStage===11?{scope:{runId:'RUN-NEXT-FIXTURE',contextId:'CONTEXT-NEXT-FIXTURE'}}:{};let promptState=reloaded;if(nextStage===4){let blocked=false;try{prompts.buildPromptRecord(4,promptState,nextOptions);}catch(error){blocked=/Stage 04 prompt generation blocked: current Stage 01|Stage 04 prompt generation blocked: current Stage 03/.test(String(error?.message||error));}if(!blocked)throw new Error('Stage 04 next-prompt verifier accepted incomplete upstream state.');promptState=JSON.parse(JSON.stringify(reloaded));engine.ensureShape(promptState);promptState.stages[1].status='COMPLETE';promptState.stages[1].gate={...(promptState.stages[1].gate||{}),complete:true};promptState.stages[3].status='COMPLETE';promptState.stages[3].gate={...(promptState.stages[3].gate||{}),complete:true};}const nextPrompt=prompts.buildPromptRecord(nextStage,promptState,nextOptions).prompt,isolated=[11,12,23,24].includes(nextStage);if(!nextPrompt.includes(`JOB_ID: ${p.job.JOB_ID}`))throw new Error(`Stage ${nextStage} prompt lost JOB_ID isolation.`);if(isolated&&nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} isolation prompt leaked generic prior-stage context.`);if(!isolated&&!nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} prompt did not consume accepted prior-stage context.`);}"
if old in s:s=s.replace(old,new,1)
elif "Stage 04 next-prompt verifier accepted incomplete upstream state." not in s:raise SystemExit('next-stage prompt anchor missing')
old="  e.stageData={EXACT_DELIVERABLE_REQUESTED:'Patent application draft',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'Later filing-route facts',INPUT_SET_CONTENTS:'Human request and invention-packet.zip'};"
new="  e.stageData={...e.stageData,EXACT_DELIVERABLE_REQUESTED:'Patent application draft',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'Later filing-route facts',INPUT_SET_CONTENTS:'Human request and invention-packet.zip'};"
if old in s:s=s.replace(old,new,1)
elif new not in s:raise SystemExit('smart-quote Stage 01 fixture anchor missing')
s=s.replace("if(stageEntries.length!==4||stageEntries.some(x=>!Array.isArray(x.evidenceIds)||x.evidenceIds.length===0))","if(stageEntries.length!==5||stageEntries.some(x=>!Array.isArray(x.evidenceIds)||x.evidenceIds.length===0))")
anchor="negative('wrong schema',(e)=>{e.schema='closed-loop-stage-response/999';},'WRONG_SCHEMA');"
extra="negative('wrong schema',(e)=>{e.schema='closed-loop-stage-response/999';},'WRONG_SCHEMA');\nnegativeAt('incomplete Stage 01 intake accounting',1,(e)=>{e.stageData.INTAKE_ACCOUNTING=e.stageData.INTAKE_ACCOUNTING.slice(1);},'INCOMPLETE_INTAKE_ACCOUNTING');"
if "incomplete Stage 01 intake accounting" not in s:
    if anchor not in s:raise SystemExit('negative-test anchor missing')
    s=s.replace(anchor,extra,1)
p.write_text(s)
