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
function validEnvelope(p,stage,promptRecord){
  const contract=schema.STAGE_CONTRACTS[stage];
  const stageData={};
  if(contract.allowedStageData.length)stageData[contract.allowedStageData[0]]=safeValue(contract.allowedStageData[0]);
  const records={};
  if(!Object.keys(stageData).length){
    const collection=contract.allowedCollections.find(name=>name!=='blockers')||contract.allowedCollections[0];
    if(!collection)throw new Error(`Stage ${stage} has no ingestible response surface.`);
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

const allStages=[];
for(let stage=1;stage<=30;stage++){
  let p=project(`JOB-E2E-${String(stage).padStart(2,'0')}`);
  p.activeStage=stage;
  const promptRecord=savePrompt(p,stage);
  const envelope=validEnvelope(p,stage,promptRecord);
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

function negative(name,mutate,expectedCode){
  const p=project(`JOB-NEG-${name.replace(/[^A-Z0-9]/gi,'').toUpperCase()}`),stage=2,promptRecord=savePrompt(p,stage);
  let envelope=validEnvelope(p,stage,promptRecord); const mutated=mutate(envelope,p,promptRecord); if(mutated!==undefined)envelope=mutated;
  const text=typeof envelope==='string'?envelope:JSON.stringify(envelope);
  const prepared=ingestion.prepare(p,{stage,text,promptRecord});
  if(prepared.validation.valid)throw new Error(`${name}: invalid response was accepted.`);
  if(expectedCode&&!prepared.validation.issues.some(issue=>issue.code===expectedCode))throw new Error(`${name}: expected ${expectedCode}; got ${prepared.validation.issues.map(x=>x.code).join(', ')}.`);
  if(prepared.project.projectData.acceptedChanges.length)throw new Error(`${name}: canonical state changed on validation failure.`);
  if(!prepared.project.projectData.rawResponses.length||!prepared.project.projectData.responseValidations.length)throw new Error(`${name}: failed raw response/validation was not preserved.`);
}
negative('malformed JSON',()=>'{"schema":}','MALFORMED_JSON');
negative('wrong job',(e)=>{e.jobId='JOB-OTHER';},'WRONG_JOB_ID');
negative('wrong stage',(e)=>{e.stage=3;},'WRONG_STAGE');
negative('stale prompt id',(e)=>{e.promptIdentity.instructionId='INSTRUCTION-STALE';},'STALE_PROMPT_IDENTITY');
negative('stale prompt hash',(e)=>{e.promptIdentity.bodySha256='0'.repeat(64);},'STALE_PROMPT_HASH');
negative('unknown collection',(e)=>{e.records.unknownCollection=[];},'UNKNOWN_COLLECTION');
negative('agent application field',(e)=>{e.stageData.SOURCE_SET_VERSION='SOURCE-SET-v999';},'FIELD_OWNERSHIP_VIOLATION');
negative('agent human field',(e)=>{e.records.blockers=[{tempKey:'blocker-1',fields:{OWNER:'agent-overwrite'},relationships:{},evidenceRefs:['evidence-1']}];},'FIELD_OWNERSHIP_VIOLATION');
negative('target product source',(e)=>{e.stageData={};e.records={sources:[{temporaryKey:'source-1',fields:{TITLE:'Current application repository',ISSUING_ORGANIZATION_OR_AUTHOR:'Project repository',SOURCE_TYPE:'repository source code',PUBLICATION_ORIGIN:'current application',URL_REFERENCE:'https://github.com/sjonesjones917/closed-loop-tracker',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'target product',APPLICABLE_PORTIONS:'app-core.js',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NONE',CONTROLLING_STATE:'CONTROLLING'},relationships:{},evidenceRefs:['evidence-1']}]};},'INVALID_EXTERNAL_SOURCE');
negative('duplicate temp key',(e)=>{e.records.blockers=[{tempKey:'dup',fields:{MISSING_ITEM_TYPE:'INPUT',MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE:'missing',WHY_WORK_CANNOT_CONTINUE:'blocked',ATTEMPTED_RESOLUTIONS:'none',DOWNSTREAM_WORK_STOPPED:'stage',STATUS:'OPEN'},relationships:{},evidenceRefs:['evidence-1']},{tempKey:'dup',fields:{MISSING_ITEM_TYPE:'INPUT',MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE:'missing',WHY_WORK_CANNOT_CONTINUE:'blocked',ATTEMPTED_RESOLUTIONS:'none',DOWNSTREAM_WORK_STOPPED:'stage',STATUS:'OPEN'},relationships:{},evidenceRefs:['evidence-1']}];},'DUPLICATE_TEMPORARY_KEY');
negative('missing evidence',(e)=>{e.evidence=[];},'MISSING_PROVENANCE');
negative('markdown wrapped',(e)=>'```json\n'+JSON.stringify(e)+'\n```','NON_JSON_WRAPPER');

// Duplicate response is detected only after the first raw response has been preserved.
{
  let p=project('JOB-NEG-DUPLICATE'),stage=2,promptRecord=savePrompt(p,stage),envelope=validEnvelope(p,stage,promptRecord),text=JSON.stringify(envelope);
  const first=ingestion.prepare(p,{stage,text,promptRecord});
  if(!first.validation.valid)throw new Error('Duplicate fixture first response unexpectedly invalid.');
  const second=ingestion.prepare(first.project,{stage,text,promptRecord});
  if(!second.duplicate||second.rawRecord.rawResponseId!==first.rawRecord.rawResponseId||second.receipt.receiptId!==first.receipt.receiptId)throw new Error('Duplicate canonical envelope did not return the existing response and receipt.');
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

console.log(JSON.stringify({stagesExercised:allStages.length,responseSchema:schema.RESPONSE_SCHEMA,negativeCases:12,clarificationLoop:true,atomicPrecommit:true,extractionManifest:true,canonicalIdsApplicationAssigned:true},null,2));

// PR3 transaction/disposition invariants.
{let p=project('JOB-PR3-IDEMP'),stage=2,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr);const first=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});const accepted=ingestion.commit(first.project,first.proposal.proposalId,{operator:'VERIFY'});const again=ingestion.commit(accepted.project,first.proposal.proposalId,{operator:'VERIFY'});if(!again.idempotent||again.project.projectData.acceptedChanges.length!==accepted.project.projectData.acceptedChanges.length)throw new Error('Repeat acceptance was not idempotent.');const repeated=ingestion.prepare(accepted.project,{stage,text:JSON.stringify(e),promptRecord:pr});if(!repeated.duplicate||repeated.receipt?.receiptId!==accepted.receipt?.receiptId)throw new Error('Repeated canonical envelope did not return existing receipt/disposition.');const manifest=accepted.manifest;if(!manifest.entries.some(x=>/^\/records\/[^/]+\/0\/fields\//.test(x.jsonPointer||''))&&!manifest.entries.some(x=>/^\/stageData\//.test(x.jsonPointer||'')))throw new Error('Extraction manifest does not contain exact response JSON pointers.');}
{let p=project('JOB-PR3-QUESTION'),stage=1,pr=savePrompt(p,stage);const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'q1',question:'Need number?',whyRequired:'Human-only value.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'NUMBER',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});const control=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'});p=control.project;if(p.projectData.acceptedChanges.length)throw new Error('Question set counted as accepted DATA change.');const q=p.projectData.humanInputRequests.at(-1);let bad=false;try{ingestion.answerHumanInput(p,{[q.requestId]:'3'},{operator:'VERIFY'});}catch{bad=true;}if(!bad)throw new Error('NUMBER answer accepted a string.');const oldPrompt=pr.instructionId;const answered=ingestion.answerHumanInput(p,{[q.requestId]:3},{operator:'VERIFY'});p=answered.project;if(p.projectData.generatedPrompts.find(x=>(x.instructionId||x.promptId)===oldPrompt)?.invalidatedBy==null)throw new Error('Clarification did not invalidate prior prompt.');if(!answered.generatedPromptIds[0]||answered.generatedPromptIds[0]===oldPrompt)throw new Error('Clarification did not regenerate the stage prompt.');}
console.log(JSON.stringify({pr3Dispositions:true,preconditions:true,idempotentAcceptance:true,canonicalEnvelopeIdempotency:true,typedHumanAnswers:true,clarificationPromptInvalidation:true,exactManifestPointers:true},null,2));
