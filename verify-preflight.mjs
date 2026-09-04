import fs from 'node:fs';
import vm from 'node:vm';
import {recordProposal,evidence} from './test-fixtures.mjs';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion;
const assert=(v,m)=>{if(!v)throw new Error(m)};
function base(jobId){
  const p=core.createBlankState(jobId);
  Object.assign(p.job,{JOB_TITLE:'Stage 09 independent preflight proof',EXACT_USER_OBJECTIVE_VERBATIM:'Produce the required deliverable.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});
  engine.ensureShape(p);
  for(let n=1;n<=8;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true,blocked:false,reasons:[]};}
  const scope=engine.currentScope(p);
  const fields={INSTRUCTION_ID:'INSTRUCTION-1',OBJECTIVE:'Produce required content',AUTHORIZED_INPUTS:'Current canonical inputs',FAILURE_HANDLING:'Fail closed',AUTHORITY_RULES:'Use canonical authority',SCOPE:'Current job',PROHIBITIONS:'No invention',DEFINED_TERMS:'Defined',ORDERED_PROCEDURE:'Execute in order',TOOL_REQUIREMENTS:'Available tools only',OUTPUT_CONTRACT:'Structured output',FACTUAL_STATE_HANDLING:'Use explicit states',REJECTION_BLOCKING_RULES:'Block uncertainty',COMPLETION_CONDITIONS:'All gates pass',REQUIREMENT_TRACEABILITY:'Trace every requirement',INSTRUCTION_TEXT:'Controlled production instruction',STATUS:'CURRENT'};
  p.projectData.instructions.push({id:'INSTRUCTION-1',stage:8,active:true,scope:{...scope},fields:{...fields},...fields});
  return p;
}
function submit(p,{record=true,determination='SATISFIED'}){
  engine.registerFreshContext(p,{stage:9,externalContextIdentifier:`PREFLIGHT-${p.job.JOB_ID}`,operatorLabel:'STAGE13_VERIFIER',purpose:'REVIEWER'});
  const contextId=engine.recordId(engine.records(p,'freshContexts').at(-1),'freshContexts');
  const pr={...prompts.buildPromptRecord(9,p,{operation:'COMPLETE',scope:{contextId}}),generatedAt:new Date().toISOString()};
  p.projectData.generatedPrompts.push(pr);
  const records=record?{preflightRecords:[recordProposal(schema,'preflightRecords',{tempKey:'preflight',relationships:{INSTRUCTION_ID:{recordId:'INSTRUCTION-1'}},overrides:{CLAUSE:'Full current production instruction',DETERMINATION:determination,FINDINGS:determination==='SATISFIED'?'No material ambiguity, conflict, unavailable capability, or unverifiable clause remains.':'Material ambiguity remains unresolved.',EVIDENCE:'Independent preflight review evidence'}})]}:{preflightRecords:[]};
  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:9,operation:'COMPLETE',promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records,evidence:[evidence('stage-09-independent-preflight')],unresolved:[],warnings:[],attachments:[]};
  return {pr,prepared:ingestion.prepare(p,{stage:9,text:JSON.stringify(envelope),promptRecord:pr})};
}
{
  const p=base('JOB-STAGE13-MISSING-PREFLIGHT'),before=p.projectData.acceptedChanges.length,{prepared}=submit(p,{record:false});
  assert(prepared.validation.valid,`Missing-preflight fixture should reach the semantic gate: ${JSON.stringify(prepared.validation.issues)}`);
  assert(prepared.project.projectData.acceptedChanges.length===before,'Missing-preflight fixture mutated canonical state before acceptance.');
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'STAGE13_VERIFIER'}).project;
  for(let n=1;n<=8;n++){committed.stages[n].status='COMPLETE';committed.stages[n].gate={complete:true,blocked:false,reasons:[]};}
  const gate=engine.gate(9,committed);
  assert(!gate.complete,'Stage 09 gate accepted a response with no independent preflight record.');
}
{
  const p=base('JOB-STAGE13-MATERIAL-FINDING'),before=p.projectData.acceptedChanges.length,{prepared}=submit(p,{record:true,determination:'VIOLATED'});
  assert(prepared.validation.valid,`Material-finding fixture should reach the semantic gate: ${JSON.stringify(prepared.validation.issues)}`);
  assert(prepared.project.projectData.acceptedChanges.length===before,'Material-finding fixture mutated canonical state before acceptance.');
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'STAGE13_VERIFIER'}).project;
  for(let n=1;n<=8;n++){committed.stages[n].status='COMPLETE';committed.stages[n].gate={complete:true,blocked:false,reasons:[]};}
  const gate=engine.gate(9,committed);
  assert(!gate.complete,'Stage 09 gate accepted unresolved material preflight findings.');
}
{
  const p=base('JOB-STAGE13-REPAIRED'),before=p.projectData.acceptedChanges.length,{pr,prepared}=submit(p,{record:true,determination:'SATISFIED'});
  assert(prepared.validation.valid,`Repaired preflight proposal rejected: ${JSON.stringify(prepared.validation.issues)}`);
  assert(prepared.project.projectData.acceptedChanges.length===before,'Repaired preflight mutated canonical state before explicit acceptance.');
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'STAGE13_VERIFIER'}).project;
  for(let n=1;n<=8;n++){committed.stages[n].status='COMPLETE';committed.stages[n].gate={complete:true,blocked:false,reasons:[]};}
  const gate=engine.gate(9,committed);
  assert(gate.complete&&gate.reasons.length===0,`Repaired independent preflight did not progress: ${JSON.stringify(gate)}`);
  const prompt=pr.prompt.toLowerCase();
  for(const token of ['independent','preflight','without executing','material'])assert(prompt.includes(token),`Stage 09 prompt lacks controlling preflight semantic: ${token}`);
}
console.log(JSON.stringify({controllerStage:'13',applicationStage:'09',independentPreflight:'PASS',intentionalInvalidFixturesRejected:['missing-preflight-record','unresolved-material-finding'],repairedPathProgressed:true,noMutationBeforeAcceptance:true,promptSemanticsChecked:true,isolatedDisposableProjects:true},null,2));
