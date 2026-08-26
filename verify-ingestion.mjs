import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']){
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
}
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
if(!core||!schema||!engine||!prompts||!ingestion)throw new Error('Runtime modules failed to load.');
if(core.STAGES.length!==30)throw new Error(`Expected 30 stages; found ${core.STAGES.length}.`);

function project(jobId='JOB-INGESTION-TEST'){
  const p=core.createBlankState(jobId);
  p.job.JOB_ID=jobId;
  p.job.JOB_TITLE='Ingestion verification project';
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='Verify the closed-loop response ingestion path.';
  p.job.CURRENT_INPUT_VERSION='INPUT-v001';
  engine.ensureShape(p);
  engine.recalculate(p);
  return p;
}
function savePrompt(p,stage){
  const record={...prompts.buildPromptRecord(stage,p),generatedAt:new Date().toISOString(),iteration:p.job.CURRENT_ITERATION||'NOT APPLICABLE'};
  p.projectData.generatedPrompts.push(record);
  return record;
}
function safeValue(name){
  if(/URL_REFERENCE/.test(name))return 'https://www.w3.org/TR/WCAG22/';
  if(/SOURCE_TYPE/.test(name))return 'OFFICIAL_STANDARD';
  if(/TITLE/.test(name))return 'Web Content Accessibility Guidelines (WCAG) 2.2';
  if(/ISSUING_ORGANIZATION_OR_AUTHOR/.test(name))return 'World Wide Web Consortium';
  if(/PUBLICATION_ORIGIN/.test(name))return 'W3C Recommendation';
  if(/INSPECTION_STATUS/.test(name))return 'INSPECTED';
  if(/CURRENCY_STATUS/.test(name))return 'CURRENT';
  if(/SUPERSESSION_STATUS/.test(name))return 'NOT SUPERSEDED';
  if(/CONTROLLING_STATE/.test(name))return 'CONTROLLING WHERE APPLICABLE';
  if(/AUTHORITY_LEVEL|AUTHORITY_ROLE/.test(name))return 'PRIMARY TECHNICAL AUTHORITY';
  if(/STATUS|STATE|DETERMINATION|RESULT/.test(name))return 'SATISFIED';
  if(/PASS_NUMBER/.test(name))return 1;
  return `verified-${name.toLowerCase()}`;
}
function valueForDefinition(def){if(def.enumValues?.length)return def.enumValues[0];if(def.valueType==='INTEGER')return 1;if(def.valueType==='NUMBER')return 1;if(def.valueType==='BOOLEAN')return true;if(def.valueType==='STRING_ARRAY'||def.valueType==='REFERENCE_ARRAY')return ['verified'];if(def.valueType==='OBJECT')return {};return 'verified';}
function validEnvelope(p,stage,promptRecord){
  const contract=schema.STAGE_CONTRACTS[stage],operationContract=schema.operationContract(stage,promptRecord.operation),stageFields=operationContract?.allowedStageData||contract.allowedStageData;
  const stageData={};
  if(stageFields.length)stageData[stageFields[0]]=safeValue(stageFields[0]);
  const records={};
  if(!Object.keys(stageData).length){
    const collection=contract.allowedCollections.find(name=>name!=='blockers'&&schema.recordAgentFields(name).length)||contract.allowedCollections.find(name=>schema.recordAgentFields(name).length);
    if(!collection)return null;
    const def=schema.RECORD_SCHEMAS[collection];
    const fields={};
    for(const name of def.required){if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=safeValue(name);}
    if(!Object.keys(fields).length){const agentField=schema.recordAgentFields(collection)[0];if(agentField)fields[agentField]=safeValue(agentField);}
    records[collection]=[{tempKey:'record-1',fields,relationships:{},evidenceRefs:['evidence-1']}];
  }
  return {
    schema:schema.RESPONSE_SCHEMA,
    jobId:p.job.JOB_ID,
    stage,
    operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,
    responseType:'DATA_PROPOSAL',
    humanInputRequests:[],stageData,records,
    evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Controlled verification evidence',location:'verification fixture',content:`stage-${stage}-evidence`}],
    unresolved:[],warnings:[],attachments:[]
  };
}
function blockedEnvelope(p,stage,promptRecord){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:{...promptRecord.scope},responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'u-1',kind:'MISSING_CAPABILITY',description:'Controlled blocked fixture',whyBlocking:'Scope identity validation fixture.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};}
function sourceProposal(tempKey='source-1',overrides={}){return {tempKey,fields:{TITLE:'Web Content Accessibility Guidelines (WCAG) 2.2',ISSUING_ORGANIZATION_OR_AUTHOR:'World Wide Web Consortium',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'W3C Recommendation',URL_REFERENCE:'https://www.w3.org/TR/WCAG22/',PUBLICATION_UPDATE_DATE:'2024-12-12',RETRIEVAL_DATE:'2026-08-25',AUTHORITY_LEVEL:'PRIMARY TECHNICAL AUTHORITY',AUTHORITY_ROLE:'GOVERNING WHERE APPLICABLE',RELEVANCE:'Independent accessibility authority',APPLICABLE_PORTIONS:'Conformance requirements',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'CONTROLLING WHERE APPLICABLE',NOTES:'Controlled fixture',...overrides},relationships:{},evidenceRefs:['evidence-1']};}

const allStages=[];
for(let stage=1;stage<=30;stage++){
  let p=project(`JOB-E2E-${String(stage).padStart(2,'0')}`);
  p.activeStage=stage;
  const promptRecord=savePrompt(p,stage);
  const envelope=validEnvelope(p,stage,promptRecord);
  if(!envelope){
    const prohibited={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
    const rejected=ingestion.prepare(p,{stage,text:JSON.stringify(prohibited),promptRecord});
    if(rejected.validation.valid)throw new Error(`Stage ${stage} application-only contract accepted an empty agent DATA_PROPOSAL.`);
    allStages.push({stage,applicationControlled:true});
    continue;
  }
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord});
  if(!prepared.validation.valid)throw new Error(`Stage ${stage} valid response rejected: ${JSON.stringify(prepared.validation.issues)}`);
  if(!prepared.proposal||prepared.proposal.status!=='PENDING_OPERATOR_REVIEW')throw new Error(`Stage ${stage} did not create a pending proposal.`);
  if(prepared.project.projectData.acceptedChanges.length)throw new Error(`Stage ${stage} mutated canonical state before operator acceptance.`);
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFICATION_OPERATOR',reviewNote:'Controlled test acceptance.'});
  p=committed.project;
  if(!p.projectData.acceptedChanges.length)throw new Error(`Stage ${stage} did not create an accepted canonical change.`);
  if(!p.projectData.extractionManifests.length)throw new Error(`Stage ${stage} did not create an extraction manifest.`);
  const receipt=p.projectData.outputReceipts.at(-1);
  if(receipt.acceptedCanonicalChangeId==='NONE'||receipt.extractionManifestId==='NONE')throw new Error(`Stage ${stage} receipt was not linked through canonical acceptance.`);
  const serialized=JSON.stringify(p); const reloaded=JSON.parse(serialized); engine.ensureShape(reloaded);
  if(reloaded.projectData.rawResponses.at(-1)?.completeRawResponse!==JSON.stringify(envelope))throw new Error(`Stage ${stage} raw response did not survive reload.`);
  if(stage<30){const nextPrompt=prompts.buildPromptRecord(stage+1,reloaded).prompt;if(!nextPrompt.includes(`JOB_ID: ${p.job.JOB_ID}`)||!nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${stage+1} prompt did not consume accepted prior-stage context.`);}
  allStages.push({stage,proposal:prepared.proposal.proposalId,accepted:p.projectData.acceptedChanges.at(-1).changeId});
}

let negativeCount=0;
function negativeAt(name,stage,mutate,expectedCode){
  const p=project(`JOB-NEG-${name.replace(/[^A-Z0-9]/gi,'').toUpperCase()}`),promptRecord=savePrompt(p,stage);
  let envelope=validEnvelope(p,stage,promptRecord);if(!envelope)throw new Error(`${name}: Stage ${stage} has no agent envelope fixture.`);const mutated=mutate(envelope,p,promptRecord);if(mutated!==undefined)envelope=mutated;
  const text=typeof envelope==='string'?envelope:JSON.stringify(envelope);
  const prepared=ingestion.prepare(p,{stage,text,promptRecord});
  if(prepared.validation.valid)throw new Error(`${name}: invalid response was accepted.`);
  if(expectedCode&&!prepared.validation.issues.some(issue=>issue.code===expectedCode))throw new Error(`${name}: expected ${expectedCode}; got ${prepared.validation.issues.map(x=>x.code).join(', ')}.`);
  if(prepared.project.projectData.acceptedChanges.length)throw new Error(`${name}: canonical state changed on validation failure.`);
  if(!prepared.project.projectData.rawResponses.length||!prepared.project.projectData.responseValidations.length)throw new Error(`${name}: failed raw response/validation was not preserved.`);
  negativeCount++;
}
function scopeNegative(name,stage,key){const p=project(`JOB-SCOPE-${name.replace(/[^A-Z0-9]/gi,'').toUpperCase()}`),pr=savePrompt(p,stage),e=blockedEnvelope(p,stage,pr);e.scope[key]=`STALE-${key}`;const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='STALE_SCOPE'&&i.path===`/scope/${key}`))throw new Error(`${name}: stale ${key} was not rejected.`);if(prepared.project.projectData.acceptedChanges.length)throw new Error(`${name}: stale scope mutated canonical state.`);negativeCount++;}
const negative=(name,mutate,expectedCode)=>negativeAt(name,2,mutate,expectedCode);
negative('empty response',()=>'', 'EMPTY_RESPONSE');
negative('malformed JSON',()=>'{"schema":}','MALFORMED_JSON');
negative('truncated JSON',()=>'{"schema":"closed-loop-stage-response/2"','TRUNCATED_RESPONSE');
negative('markdown wrapped',(e)=>'```json\n'+JSON.stringify(e)+'\n```','NON_JSON_WRAPPER');
negative('duplicate JSON member',(e)=>JSON.stringify(e).replace('"stage":2','"stage":2,"stage":3'),'DUPLICATE_JSON_MEMBER');
negative('wrong root type',()=> '[]','INVALID_ROOT');
negative('unknown top-level property',(e)=>{e.unexpected='forbidden';},'UNKNOWN_PROPERTY');
negative('oversized response',()=> 'x'.repeat(schema.DEFAULT_RESOURCE_LIMITS.maxRawResponseBytes+1),'OVERSIZED_RESPONSE');
negative('excessive nesting',()=> '['.repeat(schema.DEFAULT_RESOURCE_LIMITS.maxJsonDepth+1)+'0'+']'.repeat(schema.DEFAULT_RESOURCE_LIMITS.maxJsonDepth+1),'EXCESSIVE_JSON_DEPTH');
negative('wrong schema',(e)=>{e.schema='closed-loop-stage-response/999';},'WRONG_SCHEMA');
negative('wrong job',(e)=>{e.jobId='JOB-OTHER';},'WRONG_JOB_ID');
negative('wrong stage',(e)=>{e.stage=3;},'WRONG_STAGE');
negative('wrong operation',(e)=>{e.operation='NOT_THE_OPERATION';},'WRONG_OPERATION');
negative('stale prompt id',(e)=>{e.promptIdentity.instructionId='INSTRUCTION-STALE';},'STALE_PROMPT_IDENTITY');
negative('stale prompt hash',(e)=>{e.promptIdentity.bodySha256='0'.repeat(64);},'STALE_PROMPT_HASH');
negative('stale contract hash',(e)=>{e.promptIdentity.contractSha256='0'.repeat(64);},'STALE_CONTRACT_HASH');
negative('stale context signature',(e)=>{e.promptIdentity.contextSignature='0'.repeat(64);},'STALE_CONTEXT_SIGNATURE');
for(const [name,stage,key] of [['project revision',2,'projectRevision'],['input version',2,'inputVersion'],['source set version',3,'sourceSetVersion'],['requirements version',5,'requirementsVersion'],['test suite version',7,'testSuiteVersion'],['instruction version',9,'instructionVersion'],['iteration',10,'iterationId'],['candidate',10,'candidateId'],['run',11,'runId'],['context',11,'contextId'],['baseline',20,'baselineId'],['product',21,'productId']])scopeNegative(name,stage,key);
negative('cross-project response',(e)=>{e.jobId='JOB-CROSS-PROJECT';},'WRONG_JOB_ID');
negative('unknown collection',(e)=>{e.records.unknownCollection=[];},'UNKNOWN_COLLECTION');
negative('unknown stage field',(e)=>{e.stageData.UNKNOWN_STAGE_FIELD='x';},'UNKNOWN_STAGE_FIELD');
negative('agent application field',(e)=>{e.stageData.SOURCE_SET_VERSION='SOURCE-SET-v999';},'FIELD_OWNERSHIP_VIOLATION');
negative('agent human field',(e)=>{e.records.blockers=[{tempKey:'blocker-1',fields:{OWNER:'agent-overwrite'},relationships:{},evidenceRefs:['evidence-1']}];},'FIELD_OWNERSHIP_VIOLATION');
{
  const candidate=Object.entries(schema.STAGE_FIELDS).flatMap(([stage,defs])=>Object.entries(defs).map(([name,def])=>({stage:Number(stage),name,def}))).find(x=>x.def.producer===schema.PRODUCER.HUMAN_DECISION);
  if(!candidate)throw new Error('No HUMAN_DECISION stage field exists to verify ownership.');const p=project('JOB-NEG-HUMAN-DECISION'),pr=savePrompt(p,candidate.stage),e=validEnvelope(p,candidate.stage,pr)||{schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:candidate.stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{},evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'ownership',location:'fixture',content:'ownership'}],unresolved:[],warnings:[],attachments:[]};e.stageData[candidate.name]=valueForDefinition(candidate.def);const prepared=ingestion.prepare(p,{stage:candidate.stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='FIELD_OWNERSHIP_VIOLATION'))throw new Error('Agent mutation of HUMAN_DECISION field was accepted.');negativeCount++;
}
negative('target product source',(e)=>{e.stageData={};e.records={sources:[sourceProposal('source-target',{TITLE:'Current application repository',ISSUING_ORGANIZATION_OR_AUTHOR:'Project repository',SOURCE_TYPE:'repository source code',PUBLICATION_ORIGIN:'current application',URL_REFERENCE:'https://github.com/sjonesjones917/closed-loop-tracker',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'target product',APPLICABLE_PORTIONS:'app-core.js',CONTROLLING_STATE:'CONTROLLING'})]};},'INVALID_EXTERNAL_SOURCE');
negative('duplicate temp key',(e)=>{e.stageData={};e.records={sources:[sourceProposal('dup'),sourceProposal('dup',{TITLE:'Second source'})]};},'DUPLICATE_TEMPORARY_KEY');
negative('unknown record field',(e)=>{e.stageData={};e.records={sources:[sourceProposal('source-unknown',{UNKNOWN_FIELD:'forbidden'})]};},'UNKNOWN_RECORD_FIELD');
negative('wrong value type',(e)=>{e.stageData={};const r=sourceProposal('source-type');r.fields.TITLE=42;e.records={sources:[r]};},'WRONG_VALUE_TYPE');
negative('prohibited null',(e)=>{e.stageData={};const r=sourceProposal('source-null');r.fields.TITLE=null;e.records={sources:[r]};},'PROHIBITED_NULL');
negative('empty required string',(e)=>{e.stageData={};const r=sourceProposal('source-empty');r.fields.TITLE='';e.records={sources:[r]};},'EMPTY_REQUIRED_STRING');
negative('placeholder value',(e)=>{e.stageData={};const r=sourceProposal('source-placeholder');r.fields.TITLE='<value>';e.records={sources:[r]};},'PLACEHOLDER_VALUE');
{const issues=[];ingestion.validateValue({valueType:'STRING',enumValues:['ALLOWED'],nullable:false},'__INVALID_ENUM__','/invalid-enum',issues,{required:true});if(!issues.some(i=>i.code==='INVALID_ENUM_VALUE'))throw new Error('invalid enum: expected INVALID_ENUM_VALUE.');negativeCount++;}
negative('missing evidence',(e)=>{e.evidence=[];},'MISSING_PROVENANCE');
negative('unresolved evidence reference',(e)=>{e.stageData={};const r=sourceProposal('source-evidence');r.evidenceRefs=['does-not-exist'];e.records={sources:[r]};},'UNRESOLVED_EVIDENCE_REFERENCE');
negative('unresolved evidence source',(e)=>{e.evidence[0].sourceRef={recordId:'SOURCE-NOT-THERE'};},'UNRESOLVED_EVIDENCE_SOURCE');
negative('unresolved evidence attachment',(e)=>{e.evidence[0].attachmentRef={recordId:'ARTIFACT-NOT-THERE'};},'UNRESOLVED_EVIDENCE_ATTACHMENT');
negative('invalid record identity',(e)=>{e.stageData={};const r=sourceProposal('source-both');r.targetId='SOURCE-ALSO';e.records={sources:[r]};},'INVALID_RECORD_IDENTITY');
negativeAt('unresolved relationship',3,(e)=>{e.stageData={};e.records={research:[{tempKey:'research-1',fields:{PASS_NUMBER:1,EXACT_PORTION_EXAMINED:'Controlled source portion',FINDING_CLASSIFICATION:'FACT',SOURCE_EVIDENCE:'Controlled evidence'},relationships:{SOURCE_ID:{recordId:'SOURCE-DOES-NOT-EXIST'}},evidenceRefs:['evidence-1']}]};},'UNRESOLVED_RELATIONSHIP');
negativeAt('wrong relationship type',14,(e)=>{e.stageData={};e.records={rootCauses:[{tempKey:'wrong-type',fields:{CATEGORY:'INSTRUCTION',LAYER_TRACE:'trace',EARLIEST_DEFECTIVE_LAYER:'INSTRUCTION',ROOT_CAUSE:'cause',EVIDENCE:'evidence',DOWNSTREAM_INVALIDATION:'downstream'},relationships:{DEFECT_ID:{tempKey:'wrong-type'}},evidenceRefs:['evidence-1']}]};},'WRONG_RELATIONSHIP_TYPE');
negativeAt('wrong relationship cardinality',3,(e)=>{e.stageData={};e.records={research:[{tempKey:'research-cardinality',fields:{PASS_NUMBER:1,EXACT_PORTION_EXAMINED:'Controlled source portion',FINDING_CLASSIFICATION:'FACT',SOURCE_EVIDENCE:'Controlled evidence'},relationships:{SOURCE_ID:[{recordId:'SOURCE-A'},{recordId:'SOURCE-B'}]},evidenceRefs:['evidence-1']}]};},'INVALID_RELATIONSHIP_REFERENCE');
negative('mixed human input response',(e)=>{e.responseType='HUMAN_INPUT_REQUIRED';e.humanInputRequests=[{temporaryKey:'q',question:'Need input?',whyRequired:'Human authority required.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}];},'MIXED_RESPONSE_TYPE');
negative('mixed blocked response',(e)=>{e.responseType='BLOCKED';e.unresolved=[{temporaryKey:'u',kind:'MISSING_AUTHORITY',description:'Missing authority',whyBlocking:'Cannot proceed',affectedStageFields:[],affectedRecords:[],blocking:true}];},'MIXED_RESPONSE_TYPE');
negative('mixed execution failed response',(e)=>{e.responseType='EXECUTION_FAILED';e.unresolved=[{temporaryKey:'u',kind:'EXECUTION_FAILURE',description:'Execution failed',whyBlocking:'Cannot proceed',affectedStageFields:[],affectedRecords:[],blocking:true}];},'MIXED_RESPONSE_TYPE');
negative('empty data proposal',(e)=>{e.stageData={};e.records={};},'EMPTY_DATA_PROPOSAL');
negative('evidence resource limit',(e)=>{const max=schema.STAGE_CONTRACTS[2].resourceLimits.maxEvidenceRecords;e.evidence=Array.from({length:max+1},(_,i)=>({temporaryKey:`e-${i}`,kind:'WORKFLOW_EVIDENCE',description:'e',location:'fixture',content:'e'}));},'RESOURCE_LIMIT_EXCEEDED');

// Attachment declarations are claims; only application-hashed supplied bytes may satisfy them.
{
  const exactFile={artifactId:'ARTIFACT-ATTACHMENT-1',name:'result.pdf',type:'application/pdf',size:48203,sha256:'a'.repeat(64)};
  const make=(job='JOB-ATTACHMENT')=>{const p=project(job),stage=2,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr);e.attachments=[{temporaryKey:'attachment-1',filename:'result.pdf',mediaType:'application/pdf',byteSize:48203,sha256:'a'.repeat(64),required:true}];e.evidence[0].attachmentRef={tempKey:'attachment-1'};return {p,stage,pr,e};};
  {const {p,stage,pr,e}=make('JOB-ATTACHMENT-VALID'),prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr,files:[exactFile]});if(!prepared.validation.valid)throw new Error(`Valid verified attachment rejected: ${JSON.stringify(prepared.validation.issues)}`);if(prepared.proposal.tempToCanonical['attachment-1']?.id!==exactFile.artifactId||prepared.proposal.evidence[0].ATTACHMENT_ID!==exactFile.artifactId)throw new Error('Verified attachment temporary key did not resolve to the canonical artifact ID.');}
  for(const [name,files,mutate,code] of [
    ['missing required attachment',[],()=>{},'MISSING_REQUIRED_ATTACHMENT'],
    ['wrong attachment filename',[exactFile],e=>{e.attachments[0].filename='other.pdf';},'ATTACHMENT_FILENAME_MISMATCH'],
    ['wrong attachment byte size',[exactFile],e=>{e.attachments[0].byteSize=48204;},'ATTACHMENT_BYTE_SIZE_MISMATCH'],
    ['wrong attachment hash',[exactFile],e=>{e.attachments[0].sha256='b'.repeat(64);},'ATTACHMENT_SHA256_MISMATCH']
  ]){const {p,stage,pr,e}=make(`JOB-${name.replace(/[^A-Z0-9]/gi,'').toUpperCase()}`);mutate(e);const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr,files});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code===code))throw new Error(`${name}: expected ${code}; got ${prepared.validation.issues.map(i=>i.code).join(', ')}.`);if(prepared.project.projectData.acceptedChanges.length)throw new Error(`${name}: canonical state changed.`);negativeCount++;}
}

// Duplicate response is semantic, not whitespace-sensitive.
{
  let p=project('JOB-NEG-DUPLICATE'),stage=2,promptRecord=savePrompt(p,stage),envelope=validEnvelope(p,stage,promptRecord),text=JSON.stringify(envelope);
  const first=ingestion.prepare(p,{stage,text,promptRecord});
  if(!first.validation.valid)throw new Error('Duplicate fixture first response unexpectedly invalid.');
  const reordered={...envelope,warnings:[...envelope.warnings]};const second=ingestion.prepare(first.project,{stage,text:JSON.stringify(reordered,null,2),promptRecord});
  if(!second.duplicate||second.rawRecord.rawResponseId!==first.rawRecord.rawResponseId||second.receipt.receiptId!==first.receipt.receiptId)throw new Error('Semantic duplicate with different whitespace did not return the existing response and receipt.');
  negativeCount++;
}

// Clarification loop: structured question -> accepted question record -> human answer -> INPUT version increments.
{
  let p=project('JOB-CLARIFICATION'),stage=1,promptRecord=savePrompt(p,stage);
  const envelope={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'question-1',question:'Which jurisdiction controls the requested release?',whyRequired:'The operator must establish jurisdictional scope.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord});
  if(!prepared.validation.valid)throw new Error(`Clarification envelope rejected: ${JSON.stringify(prepared.validation.issues)}`);
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFICATION_OPERATOR'});p=committed.project;
  const request=p.projectData.humanInputRequests.at(-1);if(!request||request.status!=='OPEN')throw new Error('Human clarification request was not created.');
  const before=p.job.CURRENT_INPUT_VERSION;
  const answered=ingestion.answerHumanInput(p,{[request.requestId]:'United States'},{operator:'VERIFICATION_OPERATOR'});p=answered.project;
  if(p.job.CURRENT_INPUT_VERSION===before)throw new Error('Clarification answer did not create a new User Job Input version.');
  if(engine.unresolvedHumanRequests(p,stage).length)throw new Error('Answered clarification remained open.');
}

// Exact primitive value-validator failures, including values JSON cannot represent faithfully.
for(const [name,definition,value,code] of [
  ['non-finite number',{valueType:'NUMBER',enumValues:[],nullable:false},Infinity,'WRONG_VALUE_TYPE'],
  ['integer required',{valueType:'INTEGER',enumValues:[],nullable:false},1.5,'WRONG_VALUE_TYPE'],
  ['boolean required',{valueType:'BOOLEAN',enumValues:[],nullable:false},'true','WRONG_VALUE_TYPE'],
  ['array required',{valueType:'STRING_ARRAY',enumValues:[],nullable:false},'x','WRONG_VALUE_TYPE'],
  ['empty required array',{valueType:'STRING_ARRAY',enumValues:[],nullable:false},[],'EMPTY_REQUIRED_ARRAY']
]){const issues=[];ingestion.validateValue(definition,value,`/${name}`,issues,{required:true});if(!issues.some(i=>i.code===code))throw new Error(`${name}: expected ${code}.`);negativeCount++;}

console.log(JSON.stringify({stagesExercised:allStages.length,responseSchema:schema.RESPONSE_SCHEMA,negativeCases:negativeCount,clarificationLoop:true,atomicPrecommit:true,extractionManifest:true,canonicalIdsApplicationAssigned:true,scopeIdentityMatrix:true,verifiedAttachmentBinding:true},null,2));

// PR3 transaction/disposition invariants.
{let p=project('JOB-PR3-IDEMP'),stage=2,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr);const first=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});const accepted=ingestion.commit(first.project,first.proposal.proposalId,{operator:'VERIFY'});const again=ingestion.commit(accepted.project,first.proposal.proposalId,{operator:'VERIFY'});if(!again.idempotent||again.project.projectData.acceptedChanges.length!==accepted.project.projectData.acceptedChanges.length)throw new Error('Repeat acceptance was not idempotent.');const repeated=ingestion.prepare(accepted.project,{stage,text:JSON.stringify(e),promptRecord:pr});if(!repeated.duplicate||repeated.receipt?.receiptId!==accepted.receipt?.receiptId)throw new Error('Repeated canonical envelope did not return existing receipt/disposition.');const manifest=accepted.manifest;if(!manifest.entries.some(x=>/^\/records\/[^/]+\/0\/fields\//.test(x.jsonPointer||''))&&!manifest.entries.some(x=>/^\/stageData\//.test(x.jsonPointer||'')))throw new Error('Extraction manifest does not contain exact response JSON pointers.');}
{let p=project('JOB-PR3-QUESTION'),stage=1,pr=savePrompt(p,stage);const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'q1',question:'Need number?',whyRequired:'Human-only value.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'NUMBER',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});const control=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'});p=control.project;if(p.projectData.acceptedChanges.length)throw new Error('Question set counted as accepted DATA change.');const q=p.projectData.humanInputRequests.at(-1);let bad=false;try{ingestion.answerHumanInput(p,{[q.requestId]:'3'},{operator:'VERIFY'});}catch{bad=true;}if(!bad)throw new Error('NUMBER answer accepted a string.');const oldPrompt=pr.instructionId;const answered=ingestion.answerHumanInput(p,{[q.requestId]:3},{operator:'VERIFY'});p=answered.project;if(p.projectData.generatedPrompts.find(x=>(x.instructionId||x.promptId)===oldPrompt)?.invalidatedBy==null)throw new Error('Clarification did not invalidate prior prompt.');if(!answered.generatedPromptIds[0]||answered.generatedPromptIds[0]===oldPrompt)throw new Error('Clarification did not regenerate the stage prompt.');}
{let p=project('JOB-PR3-REJECT'),stage=2,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr),prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});p=ingestion.reject(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY',reason:'Controlled rejection.'}).project;let blocked=false;try{ingestion.commit(p,prepared.proposal.proposalId,{operator:'VERIFY'});}catch(error){blocked=error.code==='PROPOSAL_NOT_ACCEPTABLE';}if(!blocked)throw new Error('Acceptance after rejection was not prohibited.');negativeCount++;}
{let p=project('JOB-PR3-STALE-REVISION'),stage=2,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr),prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});p=prepared.project;p.revision=Number(p.revision||0)+1;let stale=false;try{ingestion.commit(p,prepared.proposal.proposalId,{operator:'VERIFY'});}catch(error){stale=error.code==='STALE_PROPOSAL';}if(!stale)throw new Error('Proposal stale after project revision change was accepted.');negativeCount++;}
console.log(JSON.stringify({pr3Dispositions:true,preconditions:true,idempotentAcceptance:true,canonicalEnvelopeIdempotency:true,typedHumanAnswers:true,clarificationPromptInvalidation:true,exactManifestPointers:true,acceptanceAfterRejectionBlocked:true,staleProjectRevisionBlocked:true,totalNegativeCases:negativeCount},null,2));
// Rejected output refinement becomes explicit controlling prompt context.
{let p=project('JOB-REFINEMENT-LOOP'),stage=2,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr),prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});const result=ingestion.reject(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY',reason:'Add the missing controlling-source rationale and make the result more complete.',requestCorrection:true});p=result.project;const old=p.projectData.generatedPrompts.find(x=>(x.instructionId||x.promptId)===pr.instructionId),replacement=p.projectData.generatedPrompts.filter(x=>Number(x.stage)===stage&&!x.invalidatedBy).at(-1);if(!old?.invalidatedBy||!replacement||replacement.instructionId===pr.instructionId||!replacement.prompt.includes('Add the missing controlling-source rationale and make the result more complete.'))throw new Error('Correction request was not bound into a replacement prompt.');}
// EXECUTION_FAILED is fail-closed and a successful exact-scope replacement resolves it.
{let p=project('JOB-EXECUTION-FAIL-CLOSED'),stage=1,pr=savePrompt(p,stage);const fail={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'EXECUTION_FAILED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'failure-1',kind:'TOOL_FAILURE',description:'Required tool failed.',whyBlocking:'The operation could not be executed.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};let prepared=ingestion.prepare(p,{stage,text:JSON.stringify(fail),promptRecord:pr});p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;if(p.stages[stage].status!=='BLOCKED'||!engine.gate(stage,p).reasons.some(x=>x.includes('execution failure')))throw new Error('Accepted execution failure did not fail closed.');const replacement=validEnvelope(p,stage,pr);prepared=ingestion.prepare(p,{stage,text:JSON.stringify(replacement),promptRecord:pr});p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;if(p.projectData.executionFailures.some(x=>Number(x.stage)===stage&&!x.resolvedBy&&!x.invalidatedBy))throw new Error('Successful replacement did not resolve execution failure.');}

{let p=project('JOB-PARALLEL-PROMPT-VALIDATION'),stage=17;p.revision=0;const a={...prompts.buildPromptRecord(stage,{...p,revision:1},{operation:'EXECUTE_RUN',scope:{runId:'RUN-A',contextId:'CTX-A'}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(a);const b={...prompts.buildPromptRecord(stage,{...p,revision:1},{operation:'EXECUTE_RUN',scope:{runId:'RUN-B',contextId:'CTX-B'}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(b);const q={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:a.operation,promptIdentity:{instructionId:a.instructionId,bodySha256:a.bodySha256,contractSha256:a.contractSha256,contextSignature:a.contextSignature},scope:a.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'parallel-q',question:'Provide the missing run-specific value.',whyRequired:'The selected run cannot continue without it.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(q),promptRecord:a});if(!prepared.validation.valid)throw new Error('Unrelated newer run prompt incorrectly staled the controlling run prompt: '+JSON.stringify(prepared.validation.issues));}
{let p=project('JOB-SCOPED-CLARIFICATION'),stage=17;p.revision=0;const pr={...prompts.buildPromptRecord(stage,{...p,revision:1},{operation:'EXECUTE_RUN',scope:{runId:'RUN-CLARIFY',contextId:'CTX-CLARIFY'}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const q={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'scoped-q',question:'Provide the run-specific missing input.',whyRequired:'This exact run is missing required human authority.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};let prepared=ingestion.prepare(p,{stage,text:JSON.stringify(q),promptRecord:pr});if(!prepared.validation.valid)throw new Error('Scoped clarification response invalid: '+JSON.stringify(prepared.validation.issues));p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;const request=p.projectData.humanInputRequests.at(-1);p=ingestion.answerHumanInput(p,{[request.requestId]:'Exact run-specific answer'},{operator:'VERIFY'}).project;const active=p.projectData.generatedPrompts.filter(x=>Number(x.stage)===stage&&!x.invalidatedBy);if(!active.some(x=>x.operation==='EXECUTE_RUN'&&x.scope?.runId==='RUN-CLARIFY'&&x.scope?.contextId==='CTX-CLARIFY'))throw new Error('Scoped clarification did not regenerate the exact operation/run prompt.');if(active.some(x=>x.operation==='FREEZE'))throw new Error('Scoped clarification incorrectly regenerated the stage default operation.');}


// Raw capture audit scope must be controlled by the persisted prompt, not a caller-supplied context hint.
{
  const p=project('JOB-RAW-SCOPE');
  p.job.CURRENT_ITERATION='ITERATION-SCOPE-001';
  const prompt=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope:{iterationId:'ITERATION-SCOPE-001',candidateId:'CANDIDATE-SCOPE-001',runId:'RUN-SCOPE-001',contextId:'CONTEXT-SCOPE-001'}});
  p.projectData.generatedPrompts.push({...prompt,generatedAt:new Date().toISOString()});
  const captured=ingestion.captureRaw(p,{stage:17,text:'{}',promptRecord:prompt,contextId:'MISLEADING-CALLER-CONTEXT'});
  if(captured.rawRecord.runId!=='RUN-SCOPE-001'||captured.rawRecord.contextId!=='CONTEXT-SCOPE-001'||captured.rawRecord.iteration!=='ITERATION-SCOPE-001')throw new Error('Raw-response audit identity is not bound to the controlling prompt scope.');
}


// Accepted BLOCKED canonical blockers must carry a hash of the complete stored record.
{
  let p=project('JOB-BLOCKER-RECORD-HASH'),stage=2,pr=savePrompt(p,stage);
  const blocked={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'blocked-1',kind:'MISSING_APPLICATION_CONTEXT',description:'Required application context is unavailable.',whyBlocking:'The current stage cannot proceed reliably.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(blocked),promptRecord:pr});
  if(!prepared.validation.valid)throw new Error('Blocked-response regression fixture is invalid: '+JSON.stringify(prepared.validation.issues));
  p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;
  const blocker=p.projectData.blockers.at(-1),expected=globalThis.closedLoopHash.recordSha256(blocker);
  if(!blocker||blocker.recordSha256!==expected||blocker.sha256!==expected)throw new Error('Accepted BLOCKED canonical blocker does not carry a recomputable complete-record hash.');
}


// A later accepted replacement resolves only earlier agent BLOCKED records in the exact stage/operation/scope lane.
{
  let p=project('JOB-BLOCKER-RECOVERY'),stage=2,pr=savePrompt(p,stage);
  const blocked={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'blocked-recovery-1',kind:'MISSING_APPLICATION_CONTEXT',description:'Required application context is unavailable.',whyBlocking:'The current stage cannot proceed reliably.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};
  let prepared=ingestion.prepare(p,{stage,text:JSON.stringify(blocked),promptRecord:pr});
  if(!prepared.validation.valid)throw new Error('Blocked recovery fixture is invalid: '+JSON.stringify(prepared.validation.issues));
  p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;
  const agentBlocker=p.projectData.blockers.at(-1);if(!agentBlocker||engine.openBlockers(p,stage).length!==1)throw new Error('Accepted BLOCKED response did not create exactly one open agent blocker.');
  const humanBlocker=engine.createHumanBlocker(p,{stage,reason:'Independent human blocker must remain open.',operatorLabel:'VERIFY'});
  const replacementPrompt=savePrompt(p,stage),replacement=validEnvelope(p,stage,replacementPrompt);
  prepared=ingestion.prepare(p,{stage,text:JSON.stringify(replacement),promptRecord:replacementPrompt});
  if(!prepared.validation.valid)throw new Error('Replacement recovery fixture is invalid: '+JSON.stringify(prepared.validation.issues));
  p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;
  const resolved=p.projectData.blockers.find(x=>engine.recordId(x,'blockers')===engine.recordId(agentBlocker,'blockers')),stillOpen=p.projectData.blockers.find(x=>engine.recordId(x,'blockers')===engine.recordId(humanBlocker,'blockers'));
  if(engine.recordValue(resolved,'STATUS')!=='RESOLVED'||engine.recordValue(resolved,'RESOLUTION_EVIDENCE')==='NONE')throw new Error('Accepted replacement did not resolve the earlier exact-lane agent blocker.');
  if(engine.recordValue(stillOpen,'STATUS')!=='OPEN')throw new Error('Accepted replacement incorrectly resolved an unrelated human blocker.');
  if(resolved.recordSha256!==globalThis.closedLoopHash.recordSha256(resolved)||resolved.sha256!==resolved.recordSha256)throw new Error('Resolved blocker hash was not refreshed from complete canonical state.');
}


// Semantic response-type and reference validation must fail closed.
{
  const issues=[];
  ingestion.validateValue({valueType:'REFERENCE',nullable:false,enumValues:[]},123,'/ref',issues);
  if(!issues.some(x=>x.code==='WRONG_VALUE_TYPE'))throw new Error('Numeric scalar REFERENCE escaped type validation.');
  const arrayIssues=[];
  ingestion.validateValue({valueType:'REFERENCE_ARRAY',nullable:false,enumValues:[]},['REQ-1',2],'/refs',arrayIssues);
  if(!arrayIssues.some(x=>x.code==='WRONG_VALUE_TYPE'))throw new Error('Mixed REFERENCE_ARRAY escaped item validation.');
}
{
  const p=project('JOB-BLOCKED-SEMANTICS'),stage=1,pr={...prompts.buildPromptRecord(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);
  const base={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,humanInputRequests:[],stageData:{},records:{},evidence:[],warnings:[],attachments:[]};
  const nonblocking={...base,responseType:'BLOCKED',unresolved:[{temporaryKey:'u1',kind:'MISSING_EVIDENCE',description:'Nonblocking observation',whyBlocking:'It is explicitly not blocking.',affectedStageFields:[],affectedRecords:[],blocking:false}]};
  const blocked=ingestion.prepare(p,{stage,text:JSON.stringify(nonblocking),promptRecord:pr});
  if(blocked.validation.valid||!blocked.validation.issues.some(x=>x.code==='MISSING_BLOCKING_UNRESOLVED'))throw new Error('BLOCKED without an actual blocker was accepted.');
  const mixed={...base,responseType:'DATA_PROPOSAL',stageData:{EXACT_DELIVERABLE_REQUESTED:'Self-contained specification'},evidence:[{temporaryKey:'e1',kind:'WORKFLOW_EVIDENCE',description:'Fixture',location:'test',content:'fixture'}],unresolved:[{temporaryKey:'u2',kind:'MISSING_EVIDENCE',description:'Blocking missing evidence',whyBlocking:'Cannot proceed reliably.',affectedStageFields:[],affectedRecords:[],blocking:true}]};
  const mixedResult=ingestion.prepare(p,{stage,text:JSON.stringify(mixed),promptRecord:pr});
  if(mixedResult.validation.valid||!mixedResult.validation.issues.some(x=>x.code==='MIXED_RESPONSE_TYPE'&&x.path==='/unresolved'))throw new Error('DATA_PROPOSAL with a blocking unresolved item was accepted.');
  const failed={...base,responseType:'EXECUTION_FAILED',humanInputRequests:[{temporaryKey:'q1',question:'Supply value?',whyRequired:'Needed after failure.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],unresolved:[{temporaryKey:'u3',kind:'EXECUTION_FAILURE',description:'Execution failed',whyBlocking:'Execution did not complete.',affectedStageFields:[],affectedRecords:[],blocking:true}]};
  const failedResult=ingestion.prepare(p,{stage,text:JSON.stringify(failed),promptRecord:pr});
  if(failedResult.validation.valid||!failedResult.validation.issues.some(x=>x.code==='MIXED_RESPONSE_TYPE'))throw new Error('EXECUTION_FAILED silently accepted human-input requests that commit would discard.');
}

// Operation field surfaces and record identity modes are enforced fail closed.
{
  let p=project('JOB-NEG-OPERATION-STAGEDATA'),stage=17;const pr={...prompts.buildPromptRecord(stage,p,{operation:'EXECUTE_RUN',scope:{runId:'RUN-OP-1',contextId:'CTX-OP-1'}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{VERIFY_COMPLETED:'TRUE'},records:{},evidence:[{temporaryKey:'op-evidence',kind:'WORKFLOW_EVIDENCE',description:'operation isolation',location:'fixture',content:'operation isolation'}],unresolved:[],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='STAGE_OPERATION_FIELD_VIOLATION'))throw new Error('EXECUTE_RUN accepted VERIFY stageData.');negativeCount++;
}
{
  const p=project('JOB-NEG-NONRESERVED-TARGET'),stage=2,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr);e.stageData={};e.records={sources:[sourceProposal('source-policy')]};delete e.records.sources[0].tempKey;e.records.sources[0].targetId='SOURCE-000001';const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='INVALID_RECORD_IDENTITY'))throw new Error('Non-reserved collection accepted targetId update semantics.');negativeCount++;
}
function completeFields(collection){const definition=schema.RECORD_SCHEMAS[collection],fields={};for(const name of definition.required)if(definition.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=valueForDefinition(definition.fieldDefinitions[name]);return fields;}
function proposalEnvelope(p,stage,pr,records){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records,evidence:[{temporaryKey:'policy-evidence',kind:'WORKFLOW_EVIDENCE',description:'record identity policy',location:'fixture',content:'record identity policy'}],unresolved:[],warnings:[],attachments:[]};}
{
  let p=project('JOB-NEG-RESERVED-TEMPKEY'),stage=21;p.job.CURRENT_BASELINE_ID='BASELINE-000001';p.job.CURRENT_PRODUCT_ID='PRODUCT-000001';const pr={...prompts.buildPromptRecord(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const e=proposalEnvelope(p,stage,pr,{products:[{tempKey:'new-product',fields:completeFields('products'),relationships:{},evidenceRefs:['policy-evidence']}]});const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='INVALID_RECORD_IDENTITY'))throw new Error('Application-reserved collection accepted tempKey creation.');negativeCount++;
}
{
  let p=project('JOB-NEG-COMPLETED-TARGET'),stage=21,productId='PRODUCT-000001';p.job.CURRENT_BASELINE_ID='BASELINE-000001';p.job.CURRENT_PRODUCT_ID=productId;p.projectData.products.push({id:productId,stage,active:true,status:'COMPLETED',scope:{baselineId:'BASELINE-000001',productId},fields:{PRODUCT_ID:productId,BASELINE_ID:'BASELINE-000001',STATUS:'RESERVED'},PRODUCT_ID:productId,BASELINE_ID:'BASELINE-000001',STATUS:'RESERVED'});const pr={...prompts.buildPromptRecord(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const e=proposalEnvelope(p,stage,pr,{products:[{targetId:productId,fields:completeFields('products'),relationships:{},evidenceRefs:['policy-evidence']}]});const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='INVALID_RESERVED_TARGET'))throw new Error('Completed reserved target was agent-completable a second time.');negativeCount++;
}
{
  let p=project('JOB-NEG-TARGET-SCOPE'),stage=11,runId='RUN-SCOPE-B';p.projectData.runs.push({id:runId,stage,active:true,status:'RESERVED',scope:{},fields:{RUN_ID:runId,CONTEXT_ID:'CTX-SCOPE-B'},RUN_ID:runId,CONTEXT_ID:'CTX-SCOPE-B'});const pr={...prompts.buildPromptRecord(stage,p,{scope:{runId:'RUN-SCOPE-A',contextId:'CTX-SCOPE-A'}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const e=proposalEnvelope(p,stage,pr,{runs:[{targetId:runId,fields:completeFields('runs'),relationships:{},evidenceRefs:['policy-evidence']}]});const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='TARGET_SCOPE_MISMATCH'))throw new Error('Reserved target outside the controlling run/context scope was accepted.');negativeCount++;
}
console.log(JSON.stringify({operationStageDataIsolation:true,reservedTargetPolicy:true,completedReservedTargetBlocked:true,targetScopeIsolation:true,totalNegativeCases:negativeCount},null,2));
