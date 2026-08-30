import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
if(!core||!engine||!prompts)throw new Error('Prompt runtime failed to load.');
const source=fs.readFileSync('prompt-engine.js','utf8');
for(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])assert.ok(!source.includes(forbidden),`Hard-coded project-subject branch remains: ${forbidden}`);
function project(){const p=core.createBlankState('JOB-PROMPT-CURRENT');Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Build the requested project exactly from supplied authority.',EXPLICIT_USER_REQUIREMENTS:'Preserve every supplied project requirement and never ask twice.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});engine.ensureShape(p);p.projectData.humanInputAnswers=[{answerId:'ANSWER-001',answer:'Human decision already supplied.'}];return p;}
{
 const p=project();const r=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});
 for(const text of ['STAGE 01 SUBJECT-NEUTRAL INTAKE','accessible supplied materials','Preserve every project-relevant human fact','BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','HUMAN COLLABORATION MODE'])assert.ok(r.prompt.includes(text),`Stage 01 prompt missing ${text}`);
 assert.ok(r.prompt.includes('Human decision already supplied.'),'Stage 01 prompt failed to carry persisted human answer.');
 assert.ok(r.prompt.includes('do not ask the human to re-enter facts that are already present'),'Stage 01 must forbid repeat entry.');
}
{
 const p=project(),scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'};
 p.projectData.intentStatements=[{id:'STATEMENT-001',STATEMENT_ID:'STATEMENT-001',fields:{EXACT_STATEMENT:'The output must preserve supplied requirement A.',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST'},scope,status:'ACTIVE'}];
 p.projectData.candidateRequirements=[{id:'CANDIDATE-REQ-001',CANDIDATE_REQ_ID:'CANDIDATE-REQ-001',fields:{CANDIDATE_OBLIGATION:'External source requires condition B.',APPLICABILITY:'APPLICABLE'},scope,status:'ACTIVE'}];
 p.projectData.research=[{id:'RESEARCH-001',RESEARCH_ID:'RESEARCH-001',fields:{MANDATORY_STATEMENTS:'Condition B is mandatory.',PROHIBITIONS:'Do not omit condition C.',EXCEPTIONS:'Exception D applies only when stated.'},scope,status:'ACTIVE'}];
 const r=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
 for(const text of ['STAGE 04 OBLIGATION MANIFEST','STATEMENT-001','The output must preserve supplied requirement A.','External source requires condition B.','Condition B is mandatory.','Do not omit condition C.','Exception D applies only when stated.','PROJECT DATA EXECUTION RULE — MANDATORY'])assert.ok(r.prompt.includes(text),`Stage 04 prompt missing operative input ${text}`);
 assert.ok(r.prompt.includes('The original Stage 01 intent file is prohibited input for this stage.'),'Stage 04 must prohibit original intent-file reuse.');
}
{
 const p=project();const r=prompts.buildPromptRecord(6,p,{operation:'COMPLETE'});for(const text of ['closed-loop-test-spec/1','APPLICATION_DETERMINISTIC','CLOSED_LOOP_TEST_IR','PARSE_XML','SELECT_XML'])assert.ok(r.prompt.includes(text),`Stage 06 Test IR prompt missing ${text}`);
}
assert.deepEqual(engine.applicationTestCapabilities(),['CLOSED_LOOP_TEST_IR']);

const requiredContextFamilies={
  1:[],2:['intentStatements'],3:['intentStatements','sources','sourceConflicts'],4:['intentStatements','research','candidateRequirements','sources','evidenceRecords'],
  5:['requirements','intentStatements','research','candidateRequirements','sources','sourceConflicts','evidenceRecords'],
  6:['requirements','requirementResolutions','sources','evidenceRecords'],7:['requirements','tests','research','sources','artifacts'],
  8:['requirements','tests','failureTests','requirementResolutions','sources'],9:['instructions','instructionTraces','requirements','tests','failureTests','sources'],
  10:['instructions','preflightRecords','requirements','tests','failureTests','artifacts'],11:['candidateFreezes','iterations','runs','freshContexts','instructions','artifacts'],
  12:['runs','requirements','tests','freshContexts','sources','evidenceRecords','artifacts'],13:['verification','runs','requirements','tests','evidenceRecords'],
  14:['defects','comparisons','verification','runs','requirements','tests','failureTests','instructions','instructionTraces','research','sources','artifacts','evidenceRecords'],
  15:['defects','rootCauses','requirements','tests','failureTests','artifacts','evidenceRecords'],
  16:['defects','rootCauses','regressions','regressionExecutions','requirements','tests','instructions','research','sources','artifacts','evidenceRecords'],
  17:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions','instructions','requirements','artifacts','evidenceRecords'],
  18:['iterations','runs','verification','comparisons','defects','requirements','tests','regressions','regressionExecutions','blockers','evidenceRecords'],
  19:['convergenceRecords','candidateFreezes','iterations','instructions','requirements','tests','regressions','regressionExecutions','artifacts','evidenceRecords'],
  20:['confirmationRecords','candidateFreezes','iterations','artifacts','regressions','regressionExecutions'],21:['baselines','freshContexts','instructions','requirements','artifacts'],
  22:['products','requirements','tests','artifacts','evidenceRecords'],23:['products','requirements','tests','sources','artifacts','evidenceRecords'],
  24:['products','requirements','tests','sources','regressions','regressionExecutions','defects','artifacts','evidenceRecords'],25:['products','baselines','requirements','tests','artifacts','defects','evidenceRecords'],
  26:['products','baselines','requirements','instructions','instructionTraces','runs','verification','comparisons','deterministicResults','meaningResults','adversarialResults','representationInspections','regressions','regressionExecutions','defects','blockers','evidenceRecords'],
  27:['products','baselines','requirements','tests','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers','regressionExecutions','evidenceRecords'],
  28:['releaseRecords','products','baselines','artifactIdentities','artifacts'],
  29:['sources','requirements','instructions','instructionTraces','runs','products','baselines','tests','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','regressions','regressionExecutions','defects','blockers','releaseRecords','artifactIdentities','artifacts','evidenceRecords'],
  30:['defects','rootCauses','regressions','regressionExecutions','changes','baselines','requirements','tests','iterations','products','artifacts','evidenceRecords']
};
const operationRequiredContext={
  '17:FREEZE':['changes','candidateFreezes','iterations','instructions','requirements','tests','regressions','regressionExecutions','artifacts','evidenceRecords'],
  '17:EXECUTE_RUN':['candidateFreezes','iterations','runs','freshContexts','instructions','artifacts'],
  '17:VERIFY':['runs','requirements','tests','freshContexts','sources','artifacts','evidenceRecords'],
  '17:COMPARE':['verification','runs','requirements','tests','evidenceRecords'],
  '17:ROOT_CAUSE':['defects','comparisons','verification','runs','requirements','tests','failureTests','instructions','instructionTraces','requirementResolutions','research','sources','candidateFreezes','artifacts','evidenceRecords'],
  '17:REGRESSION':['defects','rootCauses','regressions','regressionExecutions','requirements','tests','failureTests','artifacts','evidenceRecords'],
  '17:CORRECT':['defects','rootCauses','regressions','regressionExecutions','changes','requirements','tests','failureTests','instructions','instructionTraces','requirementResolutions','research','sources','artifacts','evidenceRecords'],
  '19:CONFIRM_FREEZE':['convergenceRecords','candidateFreezes','iterations','instructions','requirements','tests','regressions','artifacts','evidenceRecords'],
  '19:EXECUTE_RUN':['candidateFreezes','iterations','runs','freshContexts','instructions','artifacts'],
  '19:VERIFY':['runs','requirements','tests','freshContexts','sources','artifacts','evidenceRecords'],
  '19:COMPARE':['verification','runs','requirements','tests','evidenceRecords'],
  '19:REGRESSION_VERIFY':['regressions','regressionExecutions','runs','requirements','tests','artifacts','evidenceRecords'],
  '19:CONFIRM':['runs','verification','comparisons','regressionExecutions','candidateFreezes','requirements','tests','defects','artifacts','evidenceRecords']
};
for(const [key,required] of Object.entries(operationRequiredContext)){
  const [stageText,operation]=key.split(':');
  const contract=schema.operationContract(Number(stageText),operation);
  const actual=new Set(contract.readCollections||[]);
  for(const collection of required)assert.ok(actual.has(collection),`Stage ${stageText} ${operation} operation prompt omits required upstream collection ${collection}.`);
}

for(let stage=1;stage<=30;stage++){
  for(const operation of schema.STAGE_CONTRACTS[stage].operations){
    const operationContract=schema.operationContract(stage,operation);
    const nonAgentStageFields=(operationContract.allowedStageData||[]).filter(name=>schema.STAGE_FIELDS[stage]?.[name]?.producer!=='AGENT');
    assert.deepEqual(nonAgentStageFields,[],`Stage ${stage} ${operation} external response contract exposes non-agent stageData: ${nonAgentStageFields.join(', ')}`);
    const descriptor=prompts.responseContractDescriptor(stage,operation);
    assert.deepEqual(Object.keys(descriptor.stageData).sort(),(descriptor.agentStageFields||[]).slice().sort(),`Stage ${stage} ${operation} prompt response descriptor stageData mismatch.`);
    for(const field of Object.keys(descriptor.stageData))assert.equal(schema.STAGE_FIELDS[stage][field].producer,'AGENT',`Stage ${stage} ${operation} prompt instructs the agent to write ${field}, which is not AGENT-owned.`);
  }
}

for(let stage=1;stage<=30;stage++){
  for(const operation of schema.STAGE_CONTRACTS[stage].operations){
    const p=project();Object.assign(p.job,{CURRENT_ITERATION:'ITERATION-SENTINEL',CURRENT_BASELINE_ID:'BASELINE-SENTINEL',CURRENT_PRODUCT_ID:'PRODUCT-SENTINEL'});
    const scopeOverrides=stage===11?{runId:'RUN-SENTINEL',contextId:'CONTEXT-SENTINEL'}:{};
    const scope=prompts.scopeFor(stage,p,scopeOverrides),contract=schema.operationContract(stage,operation);
    for(const collection of contract.readCollections||[]){const sentinel=collection==='runs'&&scope.runId?String(scope.runId):collection==='freshContexts'&&scope.contextId?String(scope.contextId):`CTX-${String(stage).padStart(2,'0')}-${operation}-${collection}`;const record={id:sentinel,recordId:sentinel,stage,active:true,scope:engine.scopeForCanonicalRecord(collection,stage,scope),fields:{},relationships:{},contentSha256:`sha-${sentinel}`};p.projectData[collection]=[record];}
    const built=prompts.buildPromptRecord(stage,p,{operation,scope:scopeOverrides});
    for(const collection of contract.readCollections||[]){const sentinel=collection==='runs'&&scope.runId?String(scope.runId):collection==='freshContexts'&&scope.contextId?String(scope.contextId):`CTX-${String(stage).padStart(2,'0')}-${operation}-${collection}`;assert.ok(built.prompt.includes(sentinel),`Stage ${stage} ${operation} generated prompt omitted selected ${collection} context ${sentinel}.`);}
  }
}

for(let stage=1;stage<=30;stage++){
  const task=prompts.procedures[stage];
  assert.ok(typeof task==='string'&&task.length>=350,`Stage ${stage} task instruction is not complete enough to stand on its own.`);
  assert.ok(core.STAGES[stage-1].completionGate.length>0,`Stage ${stage} has no explicit completion conditions.`);
  const actual=new Set(globalThis.closedLoopWorkflowSchema.READ_COLLECTIONS[stage]||[]);
  for(const collection of requiredContextFamilies[stage])assert.ok(actual.has(collection),`Stage ${stage} prompt read contract omits required upstream collection ${collection}.`);
}
{
  const p=project();Object.assign(p.job,{CURRENT_ITERATION:'ITERATION-001',CURRENT_BASELINE_ID:'BASELINE-001',CURRENT_PRODUCT_ID:'PRODUCT-001'});
  const restrictedHuman='Build the requested project exactly from supplied authority.';
  for(const stage of [12,23,24]){
    const scope=stage===12?{iterationId:'ITERATION-001',candidateId:'CANDIDATE-001'}:{baselineId:'BASELINE-001',productId:'PRODUCT-001'};
    const r=prompts.buildPromptRecord(stage,p,{operation:'COMPLETE',scope});
    assert.ok(r.prompt.includes('WITHHELD BY THIS STAGE CONTEXT CONTRACT'),`Stage ${stage} must explicitly withhold unrestricted human/project history.`);
    assert.ok(!r.prompt.includes(`EXACT_USER_OBJECTIVE_VERBATIM:\n${restrictedHuman}`),`Stage ${stage} leaked unrestricted human job input into a restricted review prompt.`);
  }
}
console.log(JSON.stringify({subjectNeutral:true,stage1Exhaustive:true,stage4ClosedUnion:true,testIrPublished:true,allThirtyStageTasksAudited:true,allThirtyContextContractsAudited:true,blindReviewHumanContextWithheld:true,allOperationWritableFieldsAgentOwned:true,multiOperationContextContractsAudited:true},null,2));
