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
  Object.assign(p.job,{JOB_TITLE:'Stage 09 independent preflight proof',EXACT_USER_OBJECTIVE_VERBATIM:'Produce the current required deliverable.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_RESEARCH_VERSION:'RESEARCH-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});
  engine.ensureShape(p);
  for(let n=1;n<=7;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true,blocked:false,reasons:[]};}
  const scope=engine.currentScope(p),requirementScope={...scope,instructionVersion:null};
  p.projectData.requirements.push({id:'REQ-1',stage:4,active:true,scope:{...requirementScope},fields:{REQ_ID:'REQ-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE',OBLIGATION:'Produce the required deliverable.',OBSERVABLE_SATISFACTION_CONDITION:'Required output exists.',FAILURE_CONDITION:'Required output is absent.'}});
  p.projectData.propositions.push({id:'PROP-1',stage:4,active:true,scope:{...requirementScope},fields:{PROPOSITION_ID:'PROP-1',REQUIREMENT_ID:'REQ-1',PROPOSITION_TEXT:'The required deliverable is produced.',STATUS:'CURRENT'},relationships:{REQUIREMENT_ID:'REQ-1'}});
  p.projectData.applicabilityRecords.push({id:'APP-1',stage:5,active:true,scope:{...requirementScope},fields:{APPLICABILITY_ID:'APP-1',SUBJECT_ID:'PROP-1',PROPOSED_APPLICABILITY:'APPLICABLE',SELECTED_APPLICABILITY:'APPLICABLE',TRUTH_VALUE:'TRUE',EPISTEMIC_BASIS:'EXTERNALLY_SUPPORTED',CURRENT_SCOPE_STATUS:'CURRENT',FRESHNESS_STATUS:'CURRENT',CONTRADICTION_STATUS:'CLEAR',REASONS:['Current mandatory fixture applies.']},relationships:{SUBJECT_ID:'PROP-1'}});
  p.projectData.proofExpressions.push({id:'PROOF-1',stage:6,active:true,scope:{...requirementScope},fields:{PROOF_EXPRESSION_ID:'PROOF-1',TARGET_PROPOSITION_ID:'PROP-1',PROPOSED_EXPRESSION:{type:'LEAF',observationId:'OBS-FUTURE'},NORMALIZED_EXPRESSION:{type:'LEAF',observationId:'OBS-FUTURE'},SEMANTIC_EQUIVALENCE_DISPOSITION:'EQUIVALENT',ACCEPTED_SEMANTIC_REVIEW_IDS:['REVIEW-1']},relationships:{TARGET_PROPOSITION_ID:'PROP-1'}});
  return p;
}
function instruction(){return recordProposal(schema,'instructions',{tempKey:'instruction',overrides:{OBJECTIVE:'Produce required content',AUTHORIZED_INPUTS:'Current canonical inputs',FAILURE_HANDLING:'Fail closed',AUTHORITY_RULES:'Use canonical authority',SCOPE:'Current job',PROHIBITIONS:'No invention',DEFINED_TERMS:'Defined',ORDERED_PROCEDURE:'Execute in order',TOOL_REQUIREMENTS:'Available tools only',OUTPUT_CONTRACT:'Structured output',FACTUAL_STATE_HANDLING:'Use explicit states',REJECTION_BLOCKING_RULES:'Block uncertainty',COMPLETION_CONDITIONS:'All gates pass',REQUIREMENT_TRACEABILITY:'Trace every requirement',INSTRUCTION_TEXT:'Controlled production instruction'}})}
function trace(){return recordProposal(schema,'instructionTraces',{tempKey:'trace',relationships:{REQ_ID:{recordId:'REQ-1'},INSTRUCTION_ID:{tempKey:'instruction'}},overrides:{INSTRUCTION_LOCATION:'Instruction section 1',IMPLEMENTED_BEHAVIOR:'Implements required content'}})}
function submitStage8(p){
  const pr={...prompts.buildPromptRecord(8,p,{operation:'COMPLETE'}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);
  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:8,operation:'COMPLETE',promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{instructions:[instruction()],instructionTraces:[trace()]},evidence:[evidence('stage-08-independent-preflight-prerequisite')],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage:8,text:JSON.stringify(envelope),promptRecord:pr});
  assert(prepared.validation.valid,`Stage 08 prerequisite rejected: ${JSON.stringify(prepared.validation.issues)}`);
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'STAGE13_VERIFIER'}).project;
  for(let n=1;n<=7;n++){committed.stages[n].status='COMPLETE';committed.stages[n].gate={complete:true,blocked:false,reasons:[]};}
  const gate=engine.gate(8,committed);assert(gate.complete,`Stage 08 prerequisite did not complete: ${JSON.stringify(gate)}`);committed.stages[8].status='COMPLETE';committed.stages[8].gate=gate;
  return committed;
}
function reviewerContext(p,label){const ctx=engine.registerFreshContext(p,{stage:9,externalContextIdentifier:label,operatorLabel:'STAGE13_VERIFIER',purpose:'REVIEWER'});for(let n=1;n<=8;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true,blocked:false,reasons:[]};}return ctx;}
function preflightRecord(overrides={}){
  const instructionId=engine.recordId(engine.recordsForCurrentScope(globalThis.__stage13Project,'instructions').at(-1),'instructions');
  return recordProposal(schema,'preflightRecords',{tempKey:'preflight',relationships:{INSTRUCTION_ID:{recordId:instructionId}},overrides:{CLAUSE:'Controlled production instruction',MULTIPLE_INTERPRETATIONS:'NONE',UNDEFINED_OBJECTS:'NONE',UNSUPPLIED_DEPENDENCIES:'NONE',INTERNAL_CONFLICTS:'NONE',UNAVAILABLE_CAPABILITIES:'NONE',OBJECTIVELY_VERIFIABLE:'TRUE',RESPONSIBLE_OPERATION_ASSIGNED:'TRUE',ORDER_CLEAR:'TRUE',FAILURE_BEHAVIOR_DEFINED:'TRUE',TRACEABILITY:'REQ-1 -> instruction section 1',DETERMINATION:'SATISFIED',FINDINGS:'No material ambiguity',EVIDENCE:'Independent preflight evidence',...overrides}});
}
function submitStage9(p,contextId,overrides={}){
  globalThis.__stage13Project=p;
  const pr={...prompts.buildPromptRecord(9,p,{operation:'COMPLETE',scope:{contextId}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);
  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:9,operation:'COMPLETE',promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{preflightRecords:[preflightRecord(overrides)]},evidence:[evidence('stage-09-independent-preflight')],unresolved:[],warnings:[],attachments:[]};
  const beforeRevision=Number(p.revision||0),beforeAccepted=p.projectData.acceptedChanges.length,beforePreflight=engine.recordsForCurrentScope(p,'preflightRecords').length,prepared=ingestion.prepare(p,{stage:9,text:JSON.stringify(envelope),promptRecord:pr});
  assert(prepared.validation.valid,`Stage 09 response rejected before semantic gate: ${JSON.stringify(prepared.validation.issues)}`);
  assert(Number(prepared.project.revision||0)===beforeRevision,'Stage 09 proposal changed canonical project revision before explicit acceptance.');
  assert(prepared.project.projectData.acceptedChanges.length===beforeAccepted,'Stage 09 proposal created an accepted canonical change before explicit acceptance.');
  assert(engine.recordsForCurrentScope(prepared.project,'preflightRecords').length===beforePreflight,'Stage 09 proposal created a canonical preflight record before explicit acceptance.');
  return {pr,prepared};
}
function commitStage9(prepared){const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'STAGE13_VERIFIER'}).project;for(let n=1;n<=8;n++){committed.stages[n].status='COMPLETE';committed.stages[n].gate={complete:true,blocked:false,reasons:[]};}return committed;}

let promptSemanticsChecked=false;
{
  const p=submitStage8(base('JOB-STAGE13-MISSING-REVIEWER'));
  const action=engine.operationalNextAction(p,9),gate=engine.gate(9,p);
  assert(!gate.complete,'Stage 09 completed without any accepted independent preflight review.');
  assert(action.actionType==='AI_REVIEW'&&/fresh independent reviewer context|reviewer context/i.test(`${action.heading} ${action.explanation}`),'Stage 09 operator path did not require a fresh independent reviewer context before preflight.');
}
{
  const p=submitStage8(base('JOB-STAGE13-MATERIAL-AMBIGUITY')),ctx=reviewerContext(p,'PREFLIGHT-CONTEXT-MATERIAL-AMBIGUITY'),before=p.projectData.acceptedChanges.length;
  const {pr,prepared}=submitStage9(p,ctx.id,{MULTIPLE_INTERPRETATIONS:'TRUE',FINDINGS:'MATERIAL AMBIGUITY',DETERMINATION:'SATISFIED'});
  assert(prepared.project.projectData.acceptedChanges.length===before,'Material-ambiguity response mutated canonical state before acceptance.');
  const committed=commitStage9(prepared),row=engine.recordsForCurrentScope(committed,'preflightRecords').at(-1),effective=engine.evaluateResultConsistency('preflightRecords',row,null,committed),gate=engine.gate(9,committed);
  assert(effective.determination==='UNDETERMINED',`Claimed favorable preflight with material ambiguity was not downgraded: ${JSON.stringify(effective)}`);
  assert(!gate.complete&&gate.reasons.some(r=>/MULTIPLE_INTERPRETATIONS|material|preflight/i.test(r)),`Material ambiguity escaped Stage 09 gate: ${JSON.stringify(gate)}`);
  const prompt=pr.prompt.toLowerCase();
  for(const token of ['preflight','without executing','independent'])assert(prompt.includes(token),`Stage 09 prompt lacks controlling preflight semantic: ${token}`);
  promptSemanticsChecked=true;
}
{
  const p=submitStage8(base('JOB-STAGE13-CONTAMINATED-REVIEWER')),ctx=reviewerContext(p,'PREFLIGHT-CONTEXT-CONTAMINATED'),{prepared}=submitStage9(p,ctx.id),committed=commitStage9(prepared),context=engine.records(committed,'freshContexts').find(r=>engine.recordId(r,'freshContexts')===ctx.id);
  context.fields.CONTAMINATION_STATUS='CONTAMINATED';context.CONTAMINATION_STATUS='CONTAMINATED';engine.refreshRecordHashes(context,'freshContexts');engine.recalculate(committed);
  const independence=engine.evaluateContextIndependence(committed,{role:'PREFLIGHT_REVIEW',reviewerContextId:ctx.id}),gate=engine.gate(9,committed);
  assert(independence.determination==='VIOLATED','Contaminated Stage 09 reviewer context did not violate independence.');
  assert(!gate.complete&&gate.reasons.some(r=>/independence|contamin/i.test(r)),`Contaminated reviewer escaped Stage 09 gate: ${JSON.stringify(gate)}`);
}
let repairedIndependenceBasis='';
{
  const p=submitStage8(base('JOB-STAGE13-REPAIRED')),ctx=reviewerContext(p,'PREFLIGHT-CONTEXT-CLEAN'),before=p.projectData.acceptedChanges.length,{prepared}=submitStage9(p,ctx.id);
  assert(prepared.project.projectData.acceptedChanges.length===before,'Clean Stage 09 proposal mutated canonical state before acceptance.');
  const committed=commitStage9(prepared),gate=engine.gate(9,committed),independence=engine.evaluateContextIndependence(committed,{role:'PREFLIGHT_REVIEW',reviewerContextId:ctx.id});
  repairedIndependenceBasis=independence.determination;
  assert(gate.complete&&gate.reasons.length===0,`Clean independent preflight did not progress: ${JSON.stringify(gate)}`);
  assert(engine.recordsForCurrentScope(committed,'preflightRecords').length===1,'Clean Stage 09 did not create exactly one current preflight record.');
  assert(independence.determination==='EXTERNALLY_SUPPORTED',`Stage 09 overclaimed unobservable provider independence as ${independence.determination}.`);
}
delete globalThis.__stage13Project;
console.log(JSON.stringify({controllerStage:'13',applicationStage:'09',independentPreflight:'PASS',intentionalInvalidFixturesRejected:['missing-independent-reviewer','material-ambiguity-with-favorable-claim','contaminated-reviewer-context'],repairedPathProgressed:true,independenceEpistemicLimitPreserved:repairedIndependenceBasis==='EXTERNALLY_SUPPORTED',noMutationBeforeAcceptance:true,promptSemanticsChecked,isolatedDisposableProjects:true},null,2));
