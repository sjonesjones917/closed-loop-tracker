import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
if(!core||!schema||!engine||!prompts||!ingestion)throw new Error('Runtime modules failed to load.');

function project(id){
  const p=core.createBlankState(id);
  p.job.JOB_ID=id;
  p.job.JOB_TITLE='Semantic edge verification';
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='Verify fail-closed semantic ingestion.';
  p.job.CURRENT_INPUT_VERSION='INPUT-v001';
  engine.ensureShape(p);engine.recalculate(p);return p;
}
function savePrompt(p,stage,options={}){const record={...prompts.buildPromptRecord(stage,p,options),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(record);return record;}
function identity(pr){return {instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature};}
function evidence(key='ev-1'){return {temporaryKey:key,kind:'WORKFLOW_EVIDENCE',description:'Controlled semantic evidence',location:'semantic edge fixture',content:'exact controlled evidence'};}
function dataEnvelope(p,pr){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:pr.operation,promptIdentity:identity(pr),scope:{...pr.scope},responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{EXACT_DELIVERABLE_REQUESTED:'Controlled deliverable'},records:{},evidence:[evidence()],unresolved:[],warnings:[],attachments:[]};}
function question(key='q-1',blocking=true){return {temporaryKey:key,question:'Provide the exact human-only value.',whyRequired:'The stage cannot safely infer human authority.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking};}
function unresolved(key='u-1',blocking=true){return {temporaryKey:key,kind:'MISSING_HUMAN_INPUT',description:'A required human authority value is missing.',whyBlocking:'Proceeding would require invention.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],blocking};}
function assertIssue(prepared,code,label){if(prepared.validation.valid||!prepared.validation.issues.some(x=>x.code===code))throw new Error(`${label}: expected ${code}; got ${prepared.validation.issues.map(x=>x.code).join(', ')||'VALID'}.`);}

// REFERENCE and REFERENCE_ARRAY are real semantic types, not aliases for arbitrary JSON.
for(const [label,definition,value] of [
  ['REFERENCE object',{valueType:'REFERENCE',enumValues:[],nullable:false},{id:'REQ-1'}],
  ['REFERENCE empty',{valueType:'REFERENCE',enumValues:[],nullable:false},''],
  ['REFERENCE_ARRAY number',{valueType:'REFERENCE_ARRAY',enumValues:[],nullable:false},[42]],
  ['REFERENCE_ARRAY empty member',{valueType:'REFERENCE_ARRAY',enumValues:[],nullable:false},['']]
]){const issues=[];ingestion.validateValue(definition,value,`/${label}`,issues);if(!issues.some(x=>x.code==='WRONG_VALUE_TYPE'))throw new Error(`${label} was accepted.`);}

// Response dispositions must be mutually exclusive so accepted information cannot disappear.
{
  const p=project('JOB-MIXED-QUESTION'),pr=savePrompt(p,1),e=dataEnvelope(p,pr);e.humanInputRequests=[question('q-nonblock',false)];assertIssue(ingestion.prepare(p,{stage:1,text:JSON.stringify(e),promptRecord:pr}),'MIXED_RESPONSE_TYPE','DATA_PROPOSAL with question');
}
{
  const p=project('JOB-MIXED-UNRESOLVED'),pr=savePrompt(p,1),e=dataEnvelope(p,pr);e.unresolved=[unresolved('u-block',true)];assertIssue(ingestion.prepare(p,{stage:1,text:JSON.stringify(e),promptRecord:pr}),'MIXED_RESPONSE_TYPE','DATA_PROPOSAL with blocker');
}
{
  const p=project('JOB-FAILURE-QUESTION'),pr=savePrompt(p,1),e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:pr.operation,promptIdentity:identity(pr),scope:{...pr.scope},responseType:'EXECUTION_FAILED',humanInputRequests:[question()],stageData:{},records:{},evidence:[evidence()],unresolved:[{...unresolved(),kind:'TOOL_FAILURE'}],warnings:[],attachments:[]};assertIssue(ingestion.prepare(p,{stage:1,text:JSON.stringify(e),promptRecord:pr}),'MIXED_RESPONSE_TYPE','EXECUTION_FAILED with question');
}
{
  const p=project('JOB-BLOCKING-TYPE'),pr=savePrompt(p,1),e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:pr.operation,promptIdentity:identity(pr),scope:{...pr.scope},responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{...question(),blocking:'true'}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};assertIssue(ingestion.prepare(p,{stage:1,text:JSON.stringify(e),promptRecord:pr}),'WRONG_VALUE_TYPE','Non-Boolean blocking');
}

// Supporting evidence for accepted control dispositions must become canonical evidence.
for(const responseType of ['HUMAN_INPUT_REQUIRED','BLOCKED','EXECUTION_FAILED']){
  let p=project(`JOB-CONTROL-EVIDENCE-${responseType}`),pr=savePrompt(p,1);
  const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:pr.operation,promptIdentity:identity(pr),scope:{...pr.scope},responseType,humanInputRequests:responseType==='HUMAN_INPUT_REQUIRED'?[question()]:[],stageData:{},records:{},evidence:[evidence()],unresolved:responseType==='HUMAN_INPUT_REQUIRED'?[]:[{...unresolved(),kind:responseType==='EXECUTION_FAILED'?'TOOL_FAILURE':'MISSING_HUMAN_INPUT'}],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(e),promptRecord:pr});if(!prepared.validation.valid)throw new Error(`${responseType} fixture invalid: ${prepared.validation.issues.map(x=>x.code).join(', ')}`);
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'});p=committed.project;
  const evidenceId=engine.recordId(p.projectData.evidenceRecords.at(-1),'evidenceRecords');if(!evidenceId)throw new Error(`${responseType} did not commit canonical evidence.`);
  if(!committed.disposition?.evidenceIds?.includes(evidenceId))throw new Error(`${responseType} disposition is not linked to canonical evidence.`);
  if(!committed.receipt?.evidenceIds?.includes(evidenceId))throw new Error(`${responseType} receipt is not linked to canonical evidence.`);
  if(responseType==='HUMAN_INPUT_REQUIRED'&&!p.projectData.humanInputRequests.at(-1)?.evidenceIds?.includes(evidenceId))throw new Error('Human-input request lacks canonical evidence linkage.');
  if(responseType==='BLOCKED'&&!p.projectData.blockers.at(-1)?.evidenceRefs?.includes(evidenceId))throw new Error('Blocker lacks canonical evidence linkage.');
  if(responseType==='EXECUTION_FAILED'&&!p.projectData.executionFailures.at(-1)?.evidenceIds?.includes(evidenceId))throw new Error('Execution failure lacks canonical evidence linkage.');
}

// Application-reserved target updates must bind to the exact controlling run/context lane.
{
  const p=project('JOB-RESERVED-SCOPE');p.activeStage=17;p.job.CURRENT_ITERATION='ITERATION-EDGE';
  const slots=engine.reserveRunBatch(p,{stage:17,iterationId:'ITERATION-EDGE',candidateId:'CANDIDATE-EDGE',count:10});
  const a=slots[0],b=slots[1];
  const pr=savePrompt(p,17,{operation:'EXECUTE_RUN',scope:{runId:a.runId,contextId:a.contextId,iterationId:'ITERATION-EDGE',candidateId:'CANDIDATE-EDGE'}});
  const def=schema.RECORD_SCHEMAS.runs,fields={};for(const name of def.required)if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT){const t=def.fieldDefinitions[name].valueType;fields[name]=t==='BOOLEAN'?true:t==='INTEGER'||t==='NUMBER'?1:t.endsWith('_ARRAY')?['verified']:'verified';}
  const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:17,operation:'EXECUTE_RUN',promptIdentity:identity(pr),scope:{...pr.scope},responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{runs:[{targetId:b.runId,fields,relationships:{},evidenceRefs:['ev-1']}]},evidence:[evidence()],unresolved:[],warnings:[],attachments:[]};
  assertIssue(ingestion.prepare(p,{stage:17,text:JSON.stringify(e),promptRecord:pr}),'INVALID_RESERVED_TARGET','Cross-run target update');
}

console.log(JSON.stringify({referenceTyping:true,responseTypeExclusivity:true,controlEvidenceCanonical:true,reservedTargetScope:true},null,2));
