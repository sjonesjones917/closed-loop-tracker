from pathlib import Path

def rep(path, old, new, count=1):
    p=Path(path);s=p.read_text()
    if s.count(old)!=count: raise SystemExit(f'{path}: expected {count}, found {s.count(old)} for {old[:100]!r}')
    p.write_text(s.replace(old,new,count))

rep('workflow-engine.js',
"      ...prior,\n      number:stage,\n      authorizedFiles:safe(prior.authorizedFiles),revisions:safe(prior.revisions),agentData:prior.agentData&&typeof prior.agentData==='object'?prior.agentData:(prior.acceptedData&&typeof prior.acceptedData==='object'?prior.acceptedData:{}),humanData:prior.humanData&&typeof prior.humanData==='object'?prior.humanData:{},derivedData:prior.derivedData&&typeof prior.derivedData==='object'?prior.derivedData:{},acceptedDataChangeIds:safe(prior.acceptedDataChangeIds),acceptedControlEventIds:safe(prior.acceptedControlEventIds),acceptedResponseIds:safe(prior.acceptedResponseIds)\n    };",
"      ...prior,\n      number:stage,\n      authorizedFiles:safe(prior.authorizedFiles),revisions:safe(prior.revisions),agentData:prior.agentData&&typeof prior.agentData==='object'&&Object.keys(prior.agentData).length?prior.agentData:(prior.acceptedData&&typeof prior.acceptedData==='object'?prior.acceptedData:{}),humanData:prior.humanData&&typeof prior.humanData==='object'?prior.humanData:{},derivedData:prior.derivedData&&typeof prior.derivedData==='object'?prior.derivedData:{},acceptedDataChangeIds:safe(prior.acceptedDataChangeIds),acceptedControlEventIds:safe(prior.acceptedControlEventIds),acceptedResponseIds:safe(prior.acceptedResponseIds)\n    };\n    delete project.stages[stage].acceptedData;")
rep('workflow-engine.js',"acceptedData:project.stages[stage].acceptedData","agentData:project.stages[stage].agentData,humanData:project.stages[stage].humanData")
rep('workflow-engine.js',"return Boolean(Object.keys(project?.stages?.[stage]?.acceptedData||{}).length);","return Boolean(Object.keys(project?.stages?.[stage]?.agentData||{}).length||Object.keys(project?.stages?.[stage]?.humanData||{}).length);")
rep('response-ingestion.js',"state.agentData={...state.agentData,...clone(proposal.proposedStageData)};state.acceptedData=state.agentData;","state.agentData={...state.agentData,...clone(proposal.proposedStageData)};")
rep('app-core.js',"authorizedFiles:[],acceptedData:{},humanData:{},acceptedResponseIds:[]","authorizedFiles:[],agentData:{},humanData:{},acceptedResponseIds:[]")
rep('app-core.js',"authorizedFiles:safe(s.authorizedFiles),acceptedData:s.acceptedData&&typeof s.acceptedData==='object'?s.acceptedData:{},humanData:s.humanData&&typeof s.humanData==='object'?s.humanData:{}","authorizedFiles:safe(s.authorizedFiles),agentData:s.agentData&&typeof s.agentData==='object'?s.agentData:(s.acceptedData&&typeof s.acceptedData==='object'?s.acceptedData:{}),humanData:s.humanData&&typeof s.humanData==='object'?s.humanData:{}")

rep('prompt-engine.js',"const hash=globalThis.closedLoopHash;\nif(!core||!schema||!hash)throw new Error('workbook.js, hash.js, and workflow-schema.js must load before prompt-engine.js.');","const hash=globalThis.closedLoopHash;\nconst engine=globalThis.closedLoopWorkflowEngine;\nif(!core||!schema||!hash||!engine)throw new Error('workbook.js, hash.js, workflow-schema.js, and workflow-engine.js must load before prompt-engine.js.');")
p=Path('prompt-engine.js');s=p.read_text()
old="""function boundedCollection(state,collection){
 const list=Array.isArray(state?.projectData?.[collection])?state.projectData[collection]:[];if(!list.length)return 'NONE';
 const active=list.filter(x=>x?.active!==false&&!x?.invalidatedBy);
 return show({totalActive:active.length,records:active.map(record=>({id:recordId(record,collection),stage:record.stage??'UNKNOWN',scope:record.scope||{},fields:record.fields||record,relationships:record.relationships||{},contentSha256:record.contentSha256||record.sha256||'UNKNOWN'})),omitted:0,selectionRule:'All active records selected by the explicit stage readCollections contract; large artifact bytes are referenced by canonical artifact identity.'});
}
"""
new="""function contextRecords(stage,state,collection){
 const list=Array.isArray(state?.projectData?.[collection])?state.projectData[collection]:[];if(!list.length)return [];
 const active=list.filter(x=>x?.active!==false&&!x?.invalidatedBy);
 const policy=schema.RECORD_SCHEMAS[collection]?.commitPolicy;
 const permanent=Number(stage)===30||policy==='APPEND_ONLY'||collection==='regressions';
 const crossIteration=[17,19,20].includes(Number(stage))&&['iterations','candidateFreezes','changes'].includes(collection);
 return permanent||crossIteration?active:engine.recordsForCurrentScope(state,collection);
}
function boundedCollection(stage,state,collection){
 const selected=contextRecords(stage,state,collection);if(!selected.length)return 'NONE';
 return show({totalSelected:selected.length,records:selected.map(record=>({id:recordId(record,collection),stage:record.stage??'UNKNOWN',scope:record.scope||{},fields:record.fields||record,relationships:record.relationships||{},contentSha256:record.contentSha256||record.sha256||'UNKNOWN'})),omitted:0,selectionRule:'Current canonical scope selected by workflow-engine; only explicit permanent or cross-iteration history is retained.'});
}
"""
if s.count(old)!=1: raise SystemExit('prompt boundedCollection block changed')
s=s.replace(old,new,1)
if s.count("agentData:state.stages[stage-1].agentData||state.stages[stage-1].acceptedData||{}")!=1: raise SystemExit('prior stage acceptedData fallback changed')
s=s.replace("agentData:state.stages[stage-1].agentData||state.stages[stage-1].acceptedData||{}","agentData:state.stages[stage-1].agentData||{}",1)
if s.count("${boundedCollection(state,collection)}`);")!=1: raise SystemExit('boundedCollection call changed')
s=s.replace("${boundedCollection(state,collection)}`);","${boundedCollection(stage,state,collection)}`);",1)
needle=" const op=schema.operationContract(stage,operation||schema.STAGE_CONTRACTS[stage].operations[0]);"
feedback=""" const failedValidation=(state?.projectData?.responseValidations||[]).filter(x=>Number(x.stage)===Number(stage)&&x.valid===false&&!x.invalidatedBy).at(-1);
 if(failedValidation)parts.push(`LATEST APPLICATION VALIDATION FEEDBACK\\
${show({validationId:failedValidation.validationId,rawResponseId:failedValidation.rawResponseId,issues:(failedValidation.issues||[]).map(issue=>({code:issue.code,path:issue.path||null,message:issue.message||null}))})}`);
"""
if s.count(needle)!=1: raise SystemExit(f'prompt operation insertion point count {s.count(needle)}')
s=s.replace(needle,feedback+needle,1)
old_manifest="""contextManifest={stage,operation,scope,readCollections:Object.fromEntries((opContract?.readCollections||schema.STAGE_CONTRACTS[stage].readCollections||[]).map(collection=>[collection,(state?.projectData?.[collection]||[]).filter(x=>x?.active!==false&&!x?.invalidatedBy).map(record=>({id:recordId(record,collection),scope:record.scope||{},contentSha256:record.contentSha256||record.sha256||hash.sha256Value(record.fields||record)}))])),answeredHumanClarifications:(state?.projectData?.humanInputAnswers||[]).filter(x=>Number(x.stage)===stage).map(x=>({requestId:x.requestId,answerId:x.answerId,inputVersion:x.inputVersion||state?.job?.CURRENT_INPUT_VERSION||null})),operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}))};"""
new_manifest="""contextManifest={stage,operation,scope,readCollections:Object.fromEntries((opContract?.readCollections||schema.STAGE_CONTRACTS[stage].readCollections||[]).map(collection=>[collection,contextRecords(stage,state,collection).map(record=>({id:recordId(record,collection),scope:record.scope||{},contentSha256:record.contentSha256||record.sha256||hash.sha256Value(record.fields||record)}))])),answeredHumanClarifications:(state?.projectData?.humanInputAnswers||[]).filter(x=>Number(x.stage)===stage).map(x=>({requestId:x.requestId,answerId:x.answerId,inputVersion:x.inputVersion||state?.job?.CURRENT_INPUT_VERSION||null})),operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId})),latestValidationFailure:(state?.projectData?.responseValidations||[]).filter(x=>Number(x.stage)===stage&&x.valid===false&&!x.invalidatedBy).slice(-1).map(x=>({validationId:x.validationId,rawResponseId:x.rawResponseId,issues:(x.issues||[]).map(issue=>({code:issue.code,path:issue.path||null,message:issue.message||null}))}))[0]||null};"""
if s.count(old_manifest)!=1: raise SystemExit('prompt contextManifest expression changed')
s=s.replace(old_manifest,new_manifest,1);p.write_text(s)

p=Path('verify-complete.mjs');s=p.read_text();marker="// Stage 15 cannot require evidence from a correction that has not been executed yet."
if marker not in s: raise SystemExit('verify-complete insertion marker missing')
insert="""// Current schema has one active agent stage-data surface; legacy acceptedData migrates one-way only.
{
  const p=project('JOB-LEGACY-STAGE-DATA');p.stages[4].agentData={};p.stages[4].acceptedData={OBLIGATION:'legacy accepted value'};engine.ensureShape(p);
  assert(p.stages[4].agentData.OBLIGATION==='legacy accepted value','Legacy acceptedData did not migrate into agentData.');
  assert(!Object.prototype.hasOwnProperty.call(p.stages[4],'acceptedData'),'Legacy acceptedData remained as a competing active state surface.');
}

"""
s=s.replace(marker,insert+marker,1);p.write_text(s)

p=Path('verify-prompt-semantics.mjs');s=p.read_text();marker="const p=baseProject();\nconst original=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN'"
if marker not in s: raise SystemExit('verify-prompt stable marker missing')
insert="""{
  const p=baseProject();p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v002';
  const current={id:'REQ-CURRENT',active:true,stage:4,scope:{inputVersion:p.job.CURRENT_INPUT_VERSION,sourceSetVersion:p.job.CURRENT_SOURCE_SET_VERSION,requirementsVersion:'REQUIREMENTS-v002'},fields:{REQ_ID:'REQ-CURRENT',OBLIGATION:'CURRENT-SCOPE-ONLY'}};
  const stale={id:'REQ-STALE',active:true,stage:4,scope:{inputVersion:p.job.CURRENT_INPUT_VERSION,sourceSetVersion:p.job.CURRENT_SOURCE_SET_VERSION,requirementsVersion:'REQUIREMENTS-v001'},fields:{REQ_ID:'REQ-STALE',OBLIGATION:'STALE-SCOPE-MUST-NOT-APPEAR'}};
  p.projectData.requirements.push(current,stale);p.projectData.responseValidations.push({validationId:'VALIDATION-RETRY',rawResponseId:'RAW-RETRY',stage:6,valid:false,issues:[{code:'MISSING_PROVENANCE',path:'/records/tests/0',message:'Evidence is required.'}]});
  const r=prompts.buildPromptRecord(6,p);
  if(!r.prompt.includes('CURRENT-SCOPE-ONLY')||r.prompt.includes('STALE-SCOPE-MUST-NOT-APPEAR'))throw new Error('Prompt context is contaminated by a historical requirement version.');
  if(!r.prompt.includes('LATEST APPLICATION VALIDATION FEEDBACK')||!r.prompt.includes('MISSING_PROVENANCE'))throw new Error('Retry prompt omitted latest application validation feedback.');
  if(!r.contextManifest.latestValidationFailure||r.contextManifest.latestValidationFailure.validationId!=='VALIDATION-RETRY')throw new Error('Validation feedback is not bound into prompt context identity.');
}

"""
s=s.replace(marker,insert+marker,1);p.write_text(s)

p=Path('verify.mjs');s=p.read_text();anchor="if(fs.existsSync('app.js')||/document\\.write\\s*\\(/.test(html))throw new Error('Dynamic runtime injection remains.');"
if anchor not in s: raise SystemExit('verify structural anchor missing')
addition=anchor+"\nconst activeRuntime=['app-core.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'].map(f=>fs.readFileSync(f,'utf8')).join('\\n');if(/state\\.acceptedData\\s*=|stages\\[[^\\]]+\\]\\.acceptedData\\s*=/.test(activeRuntime))throw new Error('acceptedData remains an active write surface.');if(/All active records selected by the explicit stage readCollections contract/.test(activeRuntime))throw new Error('Prompt context still selects historical active records without current-scope filtering.');"
s=s.replace(anchor,addition,1);p.write_text(s)
