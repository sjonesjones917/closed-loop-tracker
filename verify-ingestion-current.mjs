import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion;
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
assert(core&&schema&&engine&&prompts&&ingestion,'Ingestion runtime failed to load.');assert(core.STAGES.length===30,'Exactly 30 stages are required.');assert(schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3','Current response schema must be /3.');
function project(jobId='JOB-INGESTION-CURRENT'){const p=core.createBlankState(jobId);Object.assign(p.job,{JOB_ID:jobId,JOB_TITLE:'Lifecycle-valid ingestion verification',EXACT_USER_OBJECTIVE_VERBATIM:'Verify raw-first fail-closed response ingestion without bypassing workflow prerequisites.',CURRENT_INPUT_VERSION:'INPUT-v001'});engine.ensureShape(p);engine.recalculate(p);return p;}
function persistPrompt(p,stage,options={}){const pr={...prompts.buildPromptRecord(stage,p,options),generatedAt:new Date().toISOString(),iteration:p.job.CURRENT_ITERATION||'NOT APPLICABLE'};p.projectData.generatedPrompts.push(pr);return pr;}
function intakeCapture(p){const manifest=prompts.buildPromptRecord(1,p).contextManifest.intakeCoverageManifest;return JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,units:manifest.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'incorporated into the job definition',reason:'Preserved for downstream reuse.',extractedStatements:[{statementKey:`S${i+1}`,text:u.rawValueText||u.label,statementClass:'FACT'}]}))});}
function makeStage1Complete(p){p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:intakeCapture(p)};p.stages[1].acceptedData={...p.stages[1].agentData};p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};return p;}
function sourceProposal(tempKey='source-1',overrides={}){return {tempKey,fields:{TITLE:'Web Content Accessibility Guidelines (WCAG) 2.2',ISSUING_ORGANIZATION_OR_AUTHOR:'World Wide Web Consortium',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'W3C Recommendation',URL_REFERENCE:'https://www.w3.org/TR/WCAG22/',PUBLICATION_UPDATE_DATE:'2024-12-12',RETRIEVAL_DATE:'2026-08-31',AUTHORITY_LEVEL:'PRIMARY TECHNICAL AUTHORITY',AUTHORITY_ROLE:'GOVERNING WHERE APPLICABLE',RELEVANCE:'Independent accessibility authority',APPLICABLE_PORTIONS:'Conformance requirements',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'CONTROLLING WHERE APPLICABLE',NOTES:'Controlled fixture',...overrides},relationships:{},evidenceRefs:['evidence-1']};}
function envelope(p,stage,pr,{records,stageData,evidence,attachments}={}){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:{...pr.scope},responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:stageData||{},records:records||{},evidence:evidence||[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Controlled verification evidence',location:'verify-ingestion-current.mjs',content:`stage-${stage}-evidence`}],unresolved:[],warnings:[],attachments:attachments||[]};}
function stage2Fixture(jobId='JOB-STAGE2-FIXTURE'){const p=makeStage1Complete(project(jobId)),pr=persistPrompt(p,2),e=envelope(p,2,pr,{records:{sources:[sourceProposal()]}});return {p,pr,e};}
function prepare(p,stage,pr,e,files=[]){return ingestion.prepare(p,{stage,text:typeof e==='string'?e:JSON.stringify(e),promptRecord:pr,files});}
let negativeCount=0;
function rejectCase(name,mutate,expectedCode){const {p,pr,e}=stage2Fixture(`JOB-NEG-${name.replace(/[^A-Z0-9]/gi,'').toUpperCase()}`);const changed=mutate(e,p,pr),candidate=changed===undefined?e:changed,result=prepare(p,2,pr,candidate);assert(!result.validation.valid,`${name}: invalid response was accepted.`);if(expectedCode)assert(result.validation.issues.some(issue=>issue.code===expectedCode),`${name}: expected ${expectedCode}; got ${result.validation.issues.map(i=>i.code).join(', ')}.`);assert(result.project.projectData.acceptedChanges.length===0,`${name}: canonical state changed before acceptance.`);assert(result.project.projectData.rawResponses.length===1&&result.project.projectData.responseValidations.length===1,`${name}: raw response/validation was not preserved.`);negativeCount++;}
{
 let {p,pr,e}=stage2Fixture('JOB-INGEST-HAPPY');const prepared=prepare(p,2,pr,e);assert(prepared.validation.valid,`Valid Stage 02 response rejected: ${JSON.stringify(prepared.validation.issues)}`);assert(prepared.proposal?.status==='PENDING_OPERATOR_REVIEW','Valid response did not produce a pending proposal.');assert(prepared.project.projectData.acceptedChanges.length===0,'Canonical state mutated before acceptance.');const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'INGESTION_REGRESSION'});p=committed.project;assert(p.projectData.acceptedChanges.length===1,'Accepted response did not create one canonical change.');assert(p.projectData.extractionManifests.length===1,'Accepted response did not create an extraction manifest.');const reloaded=JSON.parse(JSON.stringify(p));engine.ensureShape(reloaded);assert(reloaded.projectData.rawResponses.at(-1)?.completeRawResponse===JSON.stringify(e),'Exact raw response did not survive reload.');
}
rejectCase('empty response',()=>'', 'EMPTY_RESPONSE');
rejectCase('malformed JSON',()=>'{"schema":}', 'MALFORMED_JSON');
rejectCase('truncated JSON',()=>'{"schema":"closed-loop-stage-response/3"', 'TRUNCATED_RESPONSE');
rejectCase('markdown wrapped',e=>'```json\n'+JSON.stringify(e)+'\n```','NON_JSON_WRAPPER');
rejectCase('duplicate member',e=>JSON.stringify(e).replace('"stage":2','"stage":2,"stage":3'),'DUPLICATE_JSON_MEMBER');
rejectCase('wrong root',()=> '[]','INVALID_ROOT');
rejectCase('unknown root property',e=>{e.unknown='forbidden';},'UNKNOWN_PROPERTY');
rejectCase('wrong schema',e=>{e.schema='closed-loop-stage-response/2';},'WRONG_SCHEMA');
rejectCase('wrong job',e=>{e.jobId='JOB-OTHER';},'WRONG_JOB_ID');
rejectCase('wrong stage',e=>{e.stage=3;},'WRONG_STAGE');
rejectCase('wrong operation',e=>{e.operation='NOT_THE_OPERATION';},'WRONG_OPERATION');
rejectCase('stale prompt id',e=>{e.promptIdentity.instructionId='INSTRUCTION-STALE';},'STALE_PROMPT_IDENTITY');
rejectCase('stale prompt hash',e=>{e.promptIdentity.bodySha256='0'.repeat(64);},'STALE_PROMPT_HASH');
rejectCase('stale contract hash',e=>{e.promptIdentity.contractSha256='0'.repeat(64);},'STALE_CONTRACT_HASH');
rejectCase('stale context signature',e=>{e.promptIdentity.contextSignature='0'.repeat(64);},'STALE_CONTEXT_SIGNATURE');
rejectCase('stale project revision',e=>{e.scope.projectRevision=Number(e.scope.projectRevision||0)+1;},'STALE_SCOPE');
rejectCase('stale input version',e=>{e.scope.inputVersion='INPUT-stale';},'STALE_SCOPE');
rejectCase('unknown collection',e=>{e.records.unknownCollection=[];},'UNKNOWN_COLLECTION');
rejectCase('unknown stage field',e=>{e.stageData.UNKNOWN_STAGE_FIELD='x';},'UNKNOWN_STAGE_FIELD');
rejectCase('application field override',e=>{e.stageData.SOURCE_SET_VERSION='SOURCE-SET-forged';},'FIELD_OWNERSHIP_VIOLATION');
rejectCase('unknown record field',e=>{e.records.sources[0].fields.UNKNOWN_FIELD='forbidden';},'UNKNOWN_RECORD_FIELD');
rejectCase('wrong value type',e=>{e.records.sources[0].fields.TITLE=42;},'WRONG_VALUE_TYPE');
rejectCase('prohibited null',e=>{e.records.sources[0].fields.TITLE=null;},'PROHIBITED_NULL');
rejectCase('empty required',e=>{e.records.sources[0].fields.TITLE='';},'EMPTY_REQUIRED_STRING');
rejectCase('placeholder value',e=>{e.records.sources[0].fields.TITLE='<value>';},'PLACEHOLDER_VALUE');
rejectCase('duplicate temp key',e=>{e.records.sources=[sourceProposal('dup'),sourceProposal('dup',{TITLE:'Second'})];},'DUPLICATE_TEMPORARY_KEY');
rejectCase('target plus temp key',e=>{e.records.sources[0].targetId='SOURCE-000001';},'INVALID_RECORD_IDENTITY');
rejectCase('missing provenance',e=>{e.evidence=[];},'MISSING_PROVENANCE');
rejectCase('bad evidence ref',e=>{e.records.sources[0].evidenceRefs=['missing'];},'UNRESOLVED_EVIDENCE_REFERENCE');
rejectCase('fabricated source authority',e=>{Object.assign(e.records.sources[0].fields,{TITLE:'Current application repository',ISSUING_ORGANIZATION_OR_AUTHOR:'Project repository',SOURCE_TYPE:'repository source code',PUBLICATION_ORIGIN:'current application',URL_REFERENCE:'https://github.com/sjonesjones917/closed-loop-tracker',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'target product',APPLICABLE_PORTIONS:'app-core.js',CONTROLLING_STATE:'CONTROLLING'});},'INVALID_EXTERNAL_SOURCE');
rejectCase('oversized raw response',()=> 'x'.repeat(schema.DEFAULT_RESOURCE_LIMITS.maxRawResponseBytes+1),'OVERSIZED_RESPONSE');
rejectCase('excessive JSON depth',()=> '['.repeat(schema.DEFAULT_RESOURCE_LIMITS.maxJsonDepth+1)+'0'+']'.repeat(schema.DEFAULT_RESOURCE_LIMITS.maxJsonDepth+1),'EXCESSIVE_JSON_DEPTH');
{
 const p=project('JOB-HUMAN-INPUT-CLOSED'),pr=persistPrompt(p,1),e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:{...pr.scope},responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'q',question:'Need value?',whyRequired:'Human authority required.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true,unexpected:'forbidden'}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};const result=prepare(p,1,pr,e);assert(!result.validation.valid&&result.validation.issues.some(i=>i.code==='UNKNOWN_PROPERTY'),'Unknown humanInputRequests property was accepted.');assert(result.project.projectData.acceptedChanges.length===0,'Invalid human-input request mutated canonical state.');negativeCount++;
}
{
 const {p,pr,e}=stage2Fixture('JOB-SMART-QUOTE');const canonical=JSON.stringify(e);let smart='',inside=false;for(let i=0;i<canonical.length;i++){const c=canonical[i];if(!inside&&c==='"'){smart+='“';inside=true;continue;}if(inside&&c==='"'){smart+='”';inside=false;continue;}smart+=c;}const result=prepare(p,2,pr,smart);assert(result.validation.valid,`Smart-quoted JSON rejected: ${JSON.stringify(result.validation.issues)}`);assert(result.validation.issues.some(i=>i.code==='JSON_TYPOGRAPHY_NORMALIZED'&&i.severity==='WARNING'),'Smart-quote normalization was not auditable.');assert(result.rawRecord.completeRawResponse===smart,'Smart-quote normalization changed preserved raw response.');assert(result.project.projectData.acceptedChanges.length===0,'Smart-quote parsing mutated canonical state before acceptance.');
}
{
 const exact={artifactId:'ARTIFACT-ATTACHMENT-1',name:'result.pdf',type:'application/pdf',size:48203,sha256:'a'.repeat(64)};const make=job=>{const f=stage2Fixture(job);f.e.attachments=[{temporaryKey:'attachment-1',filename:'result.pdf',mediaType:'application/pdf',byteSize:48203,sha256:'a'.repeat(64),required:true}];f.e.evidence[0].attachmentRef={tempKey:'attachment-1'};return f;};{const {p,pr,e}=make('JOB-ATTACHMENT-VALID'),result=prepare(p,2,pr,e,[exact]);assert(result.validation.valid,`Verified attachment rejected: ${JSON.stringify(result.validation.issues)}`);}for(const [label,files,change,code] of [['missing',[],()=>{},'MISSING_REQUIRED_ATTACHMENT'],['filename',[exact],e=>{e.attachments[0].filename='other.pdf';},'ATTACHMENT_FILENAME_MISMATCH'],['size',[exact],e=>{e.attachments[0].byteSize=48204;},'ATTACHMENT_BYTE_SIZE_MISMATCH'],['hash',[exact],e=>{e.attachments[0].sha256='b'.repeat(64);},'ATTACHMENT_SHA256_MISMATCH']]){const {p,pr,e}=make(`JOB-ATTACH-${label}`);change(e);const result=prepare(p,2,pr,e,files);assert(!result.validation.valid&&result.validation.issues.some(i=>i.code===code),`${label}: expected ${code}.`);assert(result.project.projectData.acceptedChanges.length===0,`${label}: attachment failure mutated canonical state.`);negativeCount++;}
}
{
 const {p,pr,e}=stage2Fixture('JOB-DUPLICATE-SEMANTIC'),first=prepare(p,2,pr,e);assert(first.validation.valid,'Duplicate fixture first response invalid.');const second=prepare(first.project,2,pr,JSON.stringify(e,null,2));assert(second.duplicate,'Whitespace-only duplicate was not recognized semantically.');assert(second.rawRecord.rawResponseId===first.rawRecord.rawResponseId,'Duplicate response created a second raw identity.');negativeCount++;
}
{
 const {p,pr,e}=stage2Fixture('JOB-STALE-PROPOSAL'),prepared=prepare(p,2,pr,e);assert(prepared.validation.valid,'Stale proposal fixture invalid.');prepared.project.revision=Number(prepared.project.revision||0)+1;let blocked=false;try{ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'INGESTION_REGRESSION'});}catch(error){blocked=error.code==='STALE_PROPOSAL';}assert(blocked,'Stale proposal was accepted.');assert(prepared.project.projectData.acceptedChanges.length===0,'Stale proposal mutated canonical state.');negativeCount++;
}
console.log(JSON.stringify({ingestionLifecycleValid:true,responseSchema:schema.RESPONSE_SCHEMA,rawFirst:true,atomicPrecommit:true,stage04ClosureProvenByDedicatedSuite:true,attachmentByteBinding:true,semanticDuplicateIdempotency:true,totalNegativeCases:negativeCount},null,2));
console.log('verify-ingestion-current: PASS');
