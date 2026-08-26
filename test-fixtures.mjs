import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export function loadRuntime(root=process.cwd(),{includeStore=false}={}){
  globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
  globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
  const files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'];
  if(includeStore)files.push('project-store.js');
  for(const file of files){
    const globalName={
      'workbook.js':'closedLoopCore','hash.js':'closedLoopHash','workflow-schema.js':'closedLoopWorkflowSchema',
      'workflow-engine.js':'closedLoopWorkflowEngine','prompt-engine.js':'closedLoopPromptEngine',
      'response-ingestion.js':'closedLoopResponseIngestion','project-store.js':'closedLoopProjectStore'
    }[file];
    if(globalThis[globalName])continue;
    vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
  }
  return {
    core:globalThis.closedLoopCore,
    hash:globalThis.closedLoopHash,
    schema:globalThis.closedLoopWorkflowSchema,
    engine:globalThis.closedLoopWorkflowEngine,
    prompts:globalThis.closedLoopPromptEngine,
    ingestion:globalThis.closedLoopResponseIngestion,
    store:globalThis.closedLoopProjectStore||null
  };
}

export const runtime=loadRuntime();
const {core,hash,schema,engine,prompts,ingestion}=runtime;

export function assert(condition,message){if(!condition)throw new Error(message);}
export function canonicalCounts(project){return Object.fromEntries(Object.keys(schema.RECORD_SCHEMAS).map(name=>[name,(project.projectData?.[name]||[]).length]));}
export function assertNoCanonicalMutation(before,after,label='response preparation'){
  const a=canonicalCounts(before),b=canonicalCounts(after);
  for(const name of Object.keys(a))assert(a[name]===b[name],`${label} mutated canonical collection ${name} before acceptance (${a[name]} -> ${b[name]}).`);
  assert((before.projectData?.acceptedChanges||[]).length===(after.projectData?.acceptedChanges||[]).length,`${label} created an accepted change before acceptance.`);
}

export function createProject(jobId='JOB-FULL-CYCLE'){
  const project=core.createBlankState(jobId);
  Object.assign(project.job,{
    JOB_ID:jobId,
    JOB_TITLE:'Closed-loop full-cycle acceptance fixture',
    JOB_OWNER:'VERIFICATION_OPERATOR',
    EXACT_USER_OBJECTIVE_VERBATIM:'Create and release one exact text artifact containing the ASCII bytes Hello.',
    SUPPLIED_MATERIALS_INVENTORY:'No supplied files; one operator clarification is required.',
    REQUIRED_OUTPUT_FORMAT:'text/plain',
    DEADLINE_OR_TEMPORAL_SCOPE:'No deadline; current controlled test scope.',
    KNOWN_AUTHORITATIVE_SOURCES:'W3C Web Content Accessibility Guidelines 2.2 where applicable.',
    AVAILABLE_TOOLS:'Current Chromium, Node.js, Web Crypto, IndexedDB, exact byte comparison.',
    PROHIBITED_ACTIONS:'No invention, silent truncation, loose prose extraction, or metadata-only file authorization.',
    EXPLICIT_USER_REQUIREMENTS:'The released artifact bytes must equal Hello exactly.'
  });
  engine.ensureShape(project);
  engine.createNewJobReset(project);
  engine.recordHumanInputVersion(project,['INITIAL_INTAKE'],'VERIFICATION_OPERATOR');
  engine.recalculate(project);
  return project;
}

export function savePrompt(project,stage,{operation=null,runId=null,contextId=null}={}){
  const options={};
  if(operation)options.operation=operation;
  if(runId||contextId)options.scope={runId:runId||null,contextId:contextId||null};
  const record={...prompts.buildPromptRecord(stage,project,options),generatedAt:new Date().toISOString()};
  const slot=engine.promptSlotKey(record);for(const prior of (project.projectData.generatedPrompts||[]).filter(item=>engine.promptSlotKey(item)===slot&&!item.invalidatedBy))prior.invalidatedBy=`SUPERSEDED-BY-${record.instructionId}`;
  project.projectData.generatedPrompts.push(record);
  project.stages[stage].currentPromptId=record.instructionId;
  return record;
}

export function evidence(seed='fixture',overrides={}){
  return {temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:`Controlled ${seed} evidence`,authorityType:'CONTROLLED_TEST',location:`verify-full-cycle/${seed}`,content:`Deterministic acceptance evidence for ${seed}.`,...overrides};
}

export function valueFor(definition,name,seed='fixture'){
  if(definition?.enumValues?.length)return definition.enumValues[0];
  switch(definition?.valueType){
    case 'INTEGER':return 1;
    case 'NUMBER':return 1;
    case 'BOOLEAN':return false;
    case 'STRING_ARRAY':case 'REFERENCE_ARRAY':return [`${seed}-${name.toLowerCase()}`];
    case 'OBJECT':return {fixture:seed};
    case 'REFERENCE':return `${seed}-${name.toLowerCase()}`;
    default:return `${seed}-${name.toLowerCase().replaceAll('_','-')}`;
  }
}

export function agentFields(collection,overrides={},seed=collection){
  const definition=schema.RECORD_SCHEMAS[collection];
  if(!definition)throw new Error(`Unknown fixture collection ${collection}.`);
  const fields={};
  for(const name of definition.required){
    const fieldDefinition=definition.fieldDefinitions[name];
    if(fieldDefinition?.producer===schema.PRODUCER.AGENT)fields[name]=valueFor(fieldDefinition,name,seed);
  }
  return {...fields,...overrides};
}

export function proposal(collection,{tempKey=`${collection}-1`,targetId=null,fields={},relationships={},evidenceRefs=['evidence-1'],notes=''}={}){
  return {tempKey:targetId?null:tempKey,targetId:targetId||null,fields:agentFields(collection,fields,tempKey),relationships,evidenceRefs,notes};
}

export function envelope(project,promptRecord,{responseType='DATA_PROPOSAL',stageData={},records={},humanInputRequests=[],unresolved=[],warnings=[],attachments=[],evidenceRecords=null}={}){
  const hasData=Object.keys(stageData).length||Object.values(records).some(list=>Array.isArray(list)&&list.length);
  return {
    schema:schema.RESPONSE_SCHEMA,
    jobId:project.job.JOB_ID,
    stage:promptRecord.stage,
    operation:promptRecord.operation,
    promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},
    scope:structuredClone(promptRecord.scope),
    responseType,
    humanInputRequests:structuredClone(humanInputRequests),
    stageData:structuredClone(stageData),
    records:structuredClone(records),
    evidence:evidenceRecords===null?(responseType==='DATA_PROPOSAL'&&hasData?[evidence(`stage-${promptRecord.stage}-${promptRecord.operation}`)]:[]):structuredClone(evidenceRecords),
    unresolved:structuredClone(unresolved),
    warnings:structuredClone(warnings),
    attachments:structuredClone(attachments)
  };
}

export function acceptResponse(project,promptRecord,payload,{operator='VERIFICATION_OPERATOR',reviewNote='Controlled full-cycle acceptance.'}={}){
  const responseEnvelope=envelope(project,promptRecord,payload);
  const raw=JSON.stringify(responseEnvelope);
  const prepared=ingestion.prepare(project,{stage:promptRecord.stage,text:raw,promptRecord});
  assert(prepared.validation?.valid,`Stage ${promptRecord.stage} ${promptRecord.operation} rejected a valid fixture: ${JSON.stringify(prepared.validation?.issues,null,2)}`);
  assert(prepared.proposal?.status==='PENDING_OPERATOR_REVIEW',`Stage ${promptRecord.stage} did not create a pending proposal.`);
  assertNoCanonicalMutation(project,prepared.project,`Stage ${promptRecord.stage} ${promptRecord.operation} preparation`);
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator,reviewNote});
  const next=committed.project;
  assert(next.projectData.rawResponses.find(item=>item.rawResponseId===prepared.rawRecord.rawResponseId)?.completeRawResponse===raw,`Stage ${promptRecord.stage} raw response was not preserved exactly.`);
  assert(committed.receipt,`Stage ${promptRecord.stage} did not create a receipt.`);
  if(responseEnvelope.responseType==='DATA_PROPOSAL'){
    assert(committed.acceptedChange,`Stage ${promptRecord.stage} did not create an accepted data change.`);
    assert(committed.manifest?.entries?.length,`Stage ${promptRecord.stage} did not create a populated extraction manifest.`);
  }
  engine.recalculate(next);
  return {...committed,project:next,envelope:responseEnvelope,raw,prepared};
}

export function latestId(project,collection,{stage=null}={}){
  const records=engine.records(project,collection,stage===null?{}:{stage});
  return engine.recordId(records.at(-1),collection);
}
export function latestRecord(project,collection,{stage=null}={}){return engine.records(project,collection,stage===null?{}:{stage}).at(-1)||null;}
export function activeRecords(project,collection,options={}){return engine.records(project,collection,options);}

export function roundTrip(project){
  const serialized=JSON.stringify(project);
  const reloaded=JSON.parse(serialized);
  engine.ensureShape(reloaded);
  engine.recalculate(reloaded);
  assert(JSON.stringify(reloaded)===JSON.stringify(JSON.parse(JSON.stringify(reloaded))),'Project JSON round trip is unstable.');
  return reloaded;
}

export function assertStage(project,stage,expected='COMPLETE'){
  engine.recalculate(project);
  const state=project.stages[stage];
  assert(state.status===expected,`Stage ${String(stage).padStart(2,'0')} expected ${expected}; got ${state.status}: ${state.gate?.reasons?.join('; ')}`);
  return state;
}

export async function exactBytesArtifact(project,{stage,artifactId,filename,bytes,mediaType='text/plain',role='STAGE_ARTIFACT'}={}){
  const data=bytes instanceof Uint8Array?bytes:new TextEncoder().encode(String(bytes));
  const sha256=await hash.sha256Bytes(data);
  return engine.registerArtifactBytes(project,{stage,artifactId,filename,mediaType,byteSize:data.byteLength,sha256,lineage:{fixture:'verify-full-cycle'},role});
}

export {core,hash,schema,engine,prompts,ingestion};
