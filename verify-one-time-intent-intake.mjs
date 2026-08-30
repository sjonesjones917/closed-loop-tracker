import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

globalThis.crypto=globalThis.crypto||crypto.webcrypto;
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion;

const p=core.createBlankState('JOB-ONE-TIME-INTENT');
Object.assign(p.job,{JOB_TITLE:'One-time intake proof',EXACT_USER_OBJECTIVE_VERBATIM:'Build exactly what the supplied project intent requires.',SUPPLIED_MATERIALS_INVENTORY:'intent.txt',EXPLICIT_USER_REQUIREMENTS:'Never ask the user to supply project information more than once.'});
engine.ensureShape(p);engine.recordHumanInputVersion(p,['JOB_TITLE','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY','EXPLICIT_USER_REQUIREMENTS']);engine.recalculate(p);
const intake=engine.stageOneAccounting(p);
assert.ok(intake.total>=3,'Stage 01 did not enumerate current human input.');
const stage1=prompts.buildPromptRecord(1,p);
assert.ok(stage1.prompt.includes('APPLICATION-OWNED INTAKE COVERAGE MANIFEST'));
for(const unit of intake.manifest)assert.ok(stage1.prompt.includes(unit.INPUT_UNIT_ID),`Stage 01 prompt omitted controlled input ${unit.INPUT_UNIT_ID}.`);
assert.ok(!schema.STAGE_CONTRACTS[3].readCollections.includes('intakeManifest'),'Stage 03 must not reconstruct human intake.');
assert.ok(!schema.STAGE_CONTRACTS[3].readCollections.includes('humanStatements'),'Stage 03 must not compile human-origin obligations.');

function evidence(){return [{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Controlled accounting proof',location:'verify-one-time-intent-intake.mjs',content:'controlled proof'}];}
function envelope(stage,prompt,records){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records,evidence:evidence(),unresolved:[],warnings:[],attachments:[]};}
function classification(unit,index){return {tempKey:`classification-${index}`,fields:{INPUT_UNIT_ID:unit.INPUT_UNIT_ID,DISPOSITION:'INCORPORATED_IN_JOB_DEFINITION',REASON:'Captured from current human authority.'},relationships:{},evidenceRefs:['evidence-1']};}
const statementUnit=intake.manifest.find(x=>x.SOURCE_LOCATION==='job.EXPLICIT_USER_REQUIREMENTS');
const statement={tempKey:'statement-1',fields:{INPUT_UNIT_ID:statementUnit.INPUT_UNIT_ID,EXACT_STATEMENT:'Never ask the user to supply project information more than once.',STATEMENT_CLASS:'REQUIREMENT',NORMATIVE_FORCE:'MUST',NOTES:'NONE'},relationships:{},evidenceRefs:['evidence-1']};
const p1={...stage1,generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(p1);
let missing=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope(1,p1,{intakeClassifications:intake.manifest.slice(1).map(classification),humanStatements:[statement]})),promptRecord:p1});
assert.equal(missing.validation.valid,false,'Stage 01 accepted omitted controlled input accounting.');
assert.ok(missing.validation.issues.some(x=>x.code==='INCOMPLETE_INTAKE_ACCOUNTING'));
let complete=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope(1,p1,{intakeClassifications:intake.manifest.map(classification),humanStatements:[statement]})),promptRecord:p1});
assert.equal(complete.validation.valid,true,JSON.stringify(complete.validation.issues));

// Persist semantic capture fixture and prove Stage 04 builds its own complete obligation universe.
p.projectData.humanStatements=[{id:'HUMAN-STATEMENT-001',stage:1,active:true,scope:statementUnit.scope,fields:{STATEMENT_ID:'HUMAN-STATEMENT-001',INPUT_UNIT_ID:statementUnit.INPUT_UNIT_ID,EXACT_STATEMENT:statement.fields.EXACT_STATEMENT,STATEMENT_CLASS:'REQUIREMENT',NORMATIVE_FORCE:'MUST',NOTES:'NONE',STATUS:'ACTIVE'},STATEMENT_ID:'HUMAN-STATEMENT-001',INPUT_UNIT_ID:statementUnit.INPUT_UNIT_ID,EXACT_STATEMENT:statement.fields.EXACT_STATEMENT,STATEMENT_CLASS:'REQUIREMENT',NORMATIVE_FORCE:'MUST',NOTES:'NONE',STATUS:'ACTIVE'}];
engine.buildObligationManifest(p);
const obligations=engine.recordsForCurrentScope(p,'obligationManifest');
const target=obligations.find(x=>String(x.OBLIGATION_TEXT).includes('more than once'));
assert.ok(target,'Captured human requirement did not enter Stage 04 obligation manifest.');
const stage4=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
assert.ok(stage4.prompt.includes(target.OBLIGATION_ID));
assert.ok(stage4.prompt.includes('APPLICATION-OWNED STAGE 04 OBLIGATION INPUT MANIFEST'));
assert.equal(engine.executionHandoff(p,{stage:4,operation:'COMPLETE'}).send.length,0,'Stage 04 inferred a repeat attachment from historical supplied material.');
assert.equal(engine.operationalNextAction(p,4).actionType,'CONTINUE_AGENT_CONVERSATION');
assert.ok(engine.operationalNextAction(p,4).explanation.includes('Do not attach or resend the original intent file.'));

function req(refs,key='req-1'){return {tempKey:key,fields:{OBLIGATION:'Never request already supplied project information again.',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',OBLIGATION_REFERENCES:refs,APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',PROHIBITIONS:'Repeated user transcription',DEFINED_TERMS:'NONE',OBSERVABLE_SATISFACTION_CONDITION:'Later stages use canonical state without asking for prior project input again.',INTENDED_VERIFICATION_METHOD:'BEHAVIORAL',EXPECTED_EVIDENCE:'Prompt and canonical-state evidence',FAILURE_CONDITION:'A later stage asks for the same project information again.',SEVERITY:'MAJOR',NOTES:'NONE'},relationships:{},evidenceRefs:['evidence-1']};}
const p4={...stage4,generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(p4);
let omitted=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[req([])],obligationDispositions:[]})),promptRecord:p4});
assert.equal(omitted.validation.valid,false,'Stage 04 accepted an unaccounted obligation.');
assert.ok(omitted.validation.issues.some(x=>['MISSING_OBLIGATION_REFERENCE','INCOMPLETE_OBLIGATION_ACCOUNTING'].includes(x.code)));
let mapped=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[req([target.OBLIGATION_ID])],obligationDispositions:obligations.filter(x=>x.OBLIGATION_ID!==target.OBLIGATION_ID).map((o,i)=>({tempKey:`disp-${i}`,fields:{OBLIGATION_ID:o.OBLIGATION_ID,DISPOSITION:'RETAINED_NONNORMATIVE_CONTEXT',REASON:'Not independently normative in this fixture.'},relationships:{},evidenceRefs:['evidence-1']}))})),promptRecord:p4});
assert.equal(mapped.validation.valid,true,JSON.stringify(mapped.validation.issues));
let both=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[req([target.OBLIGATION_ID])],obligationDispositions:obligations.map((o,i)=>({tempKey:`both-${i}`,fields:{OBLIGATION_ID:o.OBLIGATION_ID,DISPOSITION:'RETAINED_NONNORMATIVE_CONTEXT',REASON:'fixture'},relationships:{},evidenceRefs:['evidence-1']}))})),promptRecord:p4});
assert.equal(both.validation.valid,false,'Stage 04 accepted the same obligation as both mapped and disposed.');
assert.ok(both.validation.issues.some(x=>x.code==='CONFLICTING_OBLIGATION_DISPOSITION'));
console.log('verify-one-time-intent-intake: PASS');
