import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion;
const assert=(value,message)=>{if(!value)throw new Error(message);};
const mustThrow=(fn,code,message)=>{let error=null;try{fn();}catch(e){error=e;}assert(error&&error.code===code,message+` (received ${error?.code||'no error'})`);return error;};

assert(schema.STAGE_CONTRACTS[1].agentWritableCollections.includes('intentStatements'),'Stage 01 cannot write canonical intent statements.');
assert(schema.STAGE_CONTRACTS[3].readCollections.includes('intentStatements'),'Stage 03 cannot read canonical intent statements.');
assert(schema.STAGE_CONTRACTS[4].readCollections.includes('intentStatements'),'Stage 04 cannot read canonical intent statements.');

const p=core.createBlankState('JOB-ONE-TIME-INTENT');
Object.assign(p.job,{JOB_TITLE:'One-time intent proof',EXACT_USER_OBJECTIVE_VERBATIM:'Build exactly what the intent file requires.',SUPPLIED_MATERIALS_INVENTORY:'intent.txt',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'NOT APPLICABLE'});
engine.ensureShape(p);
const scope={inputVersion:'INPUT-v001'};
function statement(id,location,text){return {id,stage:1,active:true,scope,fields:{STATEMENT_ID:id,SOURCE_MATERIAL:'intent.txt',SOURCE_LOCATION:location,EXACT_STATEMENT:text,STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'',STATUS:'ACTIVE'}};}
p.projectData.intentStatements.push(statement('INTENT-STATEMENT-000001','line 1','The product must preserve all intent statements.'),statement('INTENT-STATEMENT-000002','line 2','The original intent file must never be reused after intake.'));

const stage1=prompts.buildPromptRecord(1,p);
assert(stage1.prompt.includes('Perform complete human-authority intake'),'Stage 01 prompt does not require complete human-authority intake.');
assert(stage1.prompt.includes('every application-enumerated controlled input unit'),'Stage 01 prompt does not require application-enumerated input accounting.');
assert(stage1.prompt.includes('BLOCKING_NOW')&&stage1.prompt.includes('ASK_NOW_NONBLOCKING')&&stage1.prompt.includes('LATER_RESOLVABLE'),'Stage 01 prompt does not require all three human-question classifications.');
assert(!/PATENT \/|SOFTWARE \/|BUILDING \/|PHYSICAL \/|OTHER DOMAINS/.test(stage1.prompt),'Stage 01 prompt contains a hard-coded project-subject branch.');

mustThrow(()=>prompts.buildPromptRecord(3,p),'INCOMPLETE_STAGE_01','Stage 03 prompt generation did not fail closed on incomplete Stage 01.');
mustThrow(()=>prompts.buildPromptRecord(4,p),'INCOMPLETE_STAGE_01','Stage 04 prompt generation did not fail closed on incomplete Stage 01.');
p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};
mustThrow(()=>prompts.buildPromptRecord(3,p),'INCOMPLETE_STAGE_02','Stage 03 prompt generation did not require complete Stage 02.');
p.stages[2].status='COMPLETE';p.stages[2].gate={complete:true,blocked:false,reasons:[]};

const p3={...prompts.buildPromptRecord(3,p),generatedAt:new Date().toISOString()};
assert(p3.prompt.includes('Exhaust the complete current accepted Stage 02 source set'),'Stage 03 prompt does not require exhaustive source-set research.');
assert(p3.prompt.includes('every requirement-relevant canonical Stage 01 intent statement'),'Stage 03 prompt does not require full Stage 01 obligation carry-forward.');
assert(!p3.prompt.includes('Attach or provide the original material'),'Stage 03 still permits original intent resupply.');
p.projectData.generatedPrompts.push(p3);

function evidence(){return [{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Canonical intent coverage proof',location:'verify-one-time-intent-intake.mjs',content:'controlled proof'}];}
function envelope(stage,prompt,records){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records,evidence:evidence(),unresolved:[],warnings:[],attachments:[]};}
function candidate(key,id){return {tempKey:key,fields:{SOURCE_LOCATION:id,CANDIDATE_OBLIGATION:'Preserve '+id,CLASSIFICATION:'USER_REQUIREMENT',APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',EVIDENCE:'Canonical statement '+id},relationships:{},evidenceRefs:['evidence-1']};}
function requirement(key,id){return {tempKey:key,fields:{OBLIGATION:'Implement '+id,REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:id,APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',PROHIBITIONS:'NONE',DEFINED_TERMS:'NONE',OBSERVABLE_SATISFACTION_CONDITION:'Observed satisfied',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC',EXPECTED_EVIDENCE:'Verification evidence',FAILURE_CONDITION:'Requirement absent',SEVERITY:'MAJOR',NOTES:'NONE'},relationships:{},evidenceRefs:['evidence-1']};}
let prepared=ingestion.prepare(p,{stage:3,text:JSON.stringify(envelope(3,p3,{candidateRequirements:[candidate('candidate-1','INTENT-STATEMENT-000001')]})),promptRecord:p3});
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='MISSING_INTENT_STATEMENT_CANDIDATE'),'Stage 03 accepted incomplete intent-statement coverage.');
prepared=ingestion.prepare(p,{stage:3,text:JSON.stringify(envelope(3,p3,{candidateRequirements:[candidate('candidate-1','INTENT-STATEMENT-000001'),candidate('candidate-2','INTENT-STATEMENT-000002')]})),promptRecord:p3});
assert(prepared.validation.valid,`Stage 03 complete canonical coverage was rejected: ${JSON.stringify(prepared.validation.issues)}`);

mustThrow(()=>prompts.buildPromptRecord(4,p),'INCOMPLETE_STAGE_03','Stage 04 prompt generation did not require complete Stage 03.');
for(const [index,id] of ['INTENT-STATEMENT-000001','INTENT-STATEMENT-000002'].entries())p.projectData.candidateRequirements.push({id:`CANDIDATE-REQ-${String(index+1).padStart(6,'0')}`,stage:3,active:true,scope,fields:{CANDIDATE_REQ_ID:`CANDIDATE-REQ-${String(index+1).padStart(6,'0')}`,SOURCE_LOCATION:id,CANDIDATE_OBLIGATION:'Preserve '+id,CLASSIFICATION:'USER_REQUIREMENT',APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',EVIDENCE:'Canonical statement '+id,STATUS:'ACTIVE'}});
p.stages[3].status='COMPLETE';p.stages[3].gate={complete:true,blocked:false,reasons:[]};
const p4={...prompts.buildPromptRecord(4,p),generatedAt:new Date().toISOString()};
assert(p4.prompt.includes('STAGE 04 COMPLETE OBLIGATION INPUT UNION — APPLICATION SELECTED'),'Stage 04 prompt does not embed the complete application-selected input union.');
assert(p4.prompt.includes('Do not rediscover the universe'),'Stage 04 prompt does not prohibit rediscovery/resupply.');
assert(!p4.prompt.includes('Attach or provide the original material'),'Stage 04 still requests the original intent file.');
p.projectData.generatedPrompts.push(p4);

prepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[requirement('requirement-1','INTENT-STATEMENT-000001')]})),promptRecord:p4});
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='MISSING_INTENT_STATEMENT_REQUIREMENT'),'Stage 04 accepted incomplete intent-statement coverage.');
const generic=requirement('requirement-generic','INTENT-STATEMENT-000001');generic.fields.USER_INPUT_RELATIONSHIP='User Job Input';
prepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[generic,requirement('requirement-2','INTENT-STATEMENT-000002')]})),promptRecord:p4});
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='INVALID_INTENT_STATEMENT_REFERENCE'),'Stage 04 accepted a generic user-input label instead of an exact STATEMENT_ID.');
prepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[requirement('requirement-1','INTENT-STATEMENT-000001'),requirement('requirement-2','INTENT-STATEMENT-000002')]})),promptRecord:p4});
assert(prepared.validation.valid,`Stage 04 complete canonical coverage was rejected: ${JSON.stringify(prepared.validation.issues)}`);
console.log('verify-one-time-intent-intake: PASS');
