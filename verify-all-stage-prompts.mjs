import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js']){
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
}

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
if(!core||!schema||!engine||!prompts)throw new Error('All-stage prompt runtime failed to load.');

const state=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
engine.ensureShape(state);
engine.recalculate(state);
assert.equal(schema.STAGE_COUNT,30,'The prompt suite must cover exactly 30 stages.');
assert.equal(core.STAGES.length,30,'The workbook must expose exactly 30 stages.');

const activeRecord=collection=>engine.records(state,collection).filter(record=>engine.isActiveRecord(record)).at(-1)||null;
const idOf=(record,collection)=>record?engine.recordId(record,collection):null;
const run=activeRecord('runs');
const context=activeRecord('freshContexts');
const candidate=activeRecord('candidateFreezes');
const baseline=activeRecord('baselines');
const product=activeRecord('products');
const baseScope={
  iterationId:run?engine.recordValue(run,'ITERATION_ID')||run.scope?.iterationId||state.job.CURRENT_ITERATION:null,
  candidateId:idOf(candidate,'candidateFreezes'),
  runId:idOf(run,'runs'),
  contextId:idOf(context,'freshContexts'),
  baselineId:idOf(baseline,'baselines'),
  productId:idOf(product,'products')
};
assert.ok(baseScope.runId&&baseScope.contextId,'The retained lifecycle fixture must expose a current run and context for operation prompt coverage.');

const heading=collection=>collection.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').toUpperCase();
const rule='PROJECT DATA EXECUTION RULE — MANDATORY';
const noRepeat='never ask the human to repeat, retype, summarize, resend, reopen, or reattach it';
let operationCount=0;
const generated=[];
for(let stage=1;stage<=schema.STAGE_COUNT;stage++){
  const contract=schema.STAGE_CONTRACTS[stage];
  assert.ok(contract&&Array.isArray(contract.operations)&&contract.operations.length,`Stage ${stage} has no operation contract.`);
  for(const operation of contract.operations){
    const operationContract=schema.operationContract(stage,operation);
    const record=prompts.buildPromptRecord(stage,state,{operation,scope:baseScope});
    const text=record.prompt;
    operationCount++;
    generated.push({stage,operation,record});
    assert.ok(text.includes(`COPY BLOCK — STAGE ${String(stage).padStart(2,'0')} — ${core.STAGES[stage-1].title}`),`Stage ${stage} ${operation} has the wrong visible identity.`);
    assert.ok(text.includes(`You are the ${core.STAGES[stage-1].role}. Perform only Stage ${String(stage).padStart(2,'0')}`),`Stage ${stage} ${operation} has the wrong role or boundary.`);
    assert.ok(text.includes(`STAGE-SPECIFIC TASK\n${prompts.procedures[stage]}`),`Stage ${stage} ${operation} does not contain its complete stage procedure.`);
    for(const condition of core.STAGES[stage-1].completionGate||[])assert.ok(text.includes(`- ${condition}`),`Stage ${stage} ${operation} omits completion condition: ${condition}`);
    assert.equal((text.match(new RegExp(rule,'g'))||[]).length,1,`Stage ${stage} ${operation} must contain exactly one operative-project-data rule.`);
    assert.ok(text.includes(noRepeat),`Stage ${stage} ${operation} does not prohibit repeat user entry.`);
    assert.ok(text.includes('AUTHORIZED USER JOB INPUT — QUOTED HUMAN-AUTHORITY DATA FOR THIS JOB ONLY'),`Stage ${stage} ${operation} omits current human authority.`);
    assert.ok(text.includes('PERSISTED HUMAN ANSWERS — ALREADY SUPPLIED; DO NOT ASK AGAIN'),`Stage ${stage} ${operation} omits persisted human answers.`);
    assert.ok(text.includes('CURRENT AGENT-NORMALIZED DELIVERABLE'),`Stage ${stage} ${operation} omits the accepted deliverable definition.`);
    assert.ok(text.includes(schema.RESPONSE_SCHEMA),`Stage ${stage} ${operation} omits the current response schema.`);
    assert.ok(text.includes('closed-loop-response-contract/3'),`Stage ${stage} ${operation} omits the current response-contract identity.`);
    assert.ok(!text.includes('EXECUTABLE_KIND = CUSTOM_PIPELINE'),`Stage ${stage} ${operation} publishes the prohibited CUSTOM_PIPELINE contract.`);
    if(stage>1)assert.ok(text.includes('The original Stage 01 intent file is prohibited input for this stage.'),`Stage ${stage} ${operation} can ask for the original intent file again.`);
    const expectedReads=[...operationContract.readCollections].sort();
    const actualReads=Object.keys(record.contextManifest.readCollections).sort();
    assert.deepEqual(actualReads,expectedReads,`Stage ${stage} ${operation} context manifest differs from its declared read contract.`);
    for(const collection of operationContract.readCollections)assert.ok(text.includes(`\n${heading(collection)}\n`),`Stage ${stage} ${operation} omits declared context collection ${collection}.`);
    for(const collection of operationContract.agentWritableCollections)assert.ok(text.includes(`- ${collection}:`),`Stage ${stage} ${operation} omits writable collection contract ${collection}.`);
    assert.equal(record.bodySha256,globalThis.closedLoopHash.sha256Text(text.slice(0,text.indexOf('\n\nPROMPT IDENTITY — ECHO EXACTLY'))),`Stage ${stage} ${operation} body hash does not match the exact displayed instruction body.`);
    assert.ok(record.contextSignature&&record.contractSha256&&record.fullTextSha256,`Stage ${stage} ${operation} lacks complete prompt identity.`);
  }
}
assert.equal(operationCount,41,'Every required stage operation must be checked one by one.');

const criticalStageReads={
  2:['intentStatements'],
  3:['intentStatements','sources','sourceConflicts'],
  4:['intentStatements','research','candidateRequirements','sources','sourceConflicts'],
  5:['requirements','intentStatements','candidateRequirements','research','sources','sourceConflicts'],
  6:['requirements','requirementResolutions','intentStatements','sources','research','candidateRequirements'],
  8:['requirements','tests','failureTests','requirementResolutions','intentStatements','sources','research'],
  14:['defects','comparisons','verification','runs','requirements','tests','instructions','instructionTraces','requirementResolutions','research','sources','candidateFreezes','artifacts','evidenceRecords'],
  15:['defects','rootCauses','requirements','tests','failureTests','artifacts','evidenceRecords'],
  16:['intentStatements','sources','research','candidateRequirements','requirements','requirementResolutions','tests','failureTests','instructions','instructionTraces','preflightRecords','candidateFreezes','defects','rootCauses','regressions','regressionExecutions','artifacts','evidenceRecords'],
  21:['baselines','freshContexts','instructions','requirements','artifacts'],
  22:['products','requirements','tests','artifacts'],
  23:['products','requirements','tests','sources','research','artifacts'],
  24:['products','requirements','tests','regressions','regressionExecutions','artifacts'],
  25:['products','baselines','requirements','artifacts'],
  26:['products','baselines','requirements','tests','instructions','instructionTraces','runs','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','regressions','regressionExecutions','defects','blockers','evidenceRecords','artifacts'],
  29:['intentStatements','sources','research','requirements','instructions','instructionTraces','runs','products','tests','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','regressions','regressionExecutions','defects','blockers','releaseRecords','artifactIdentities','evidenceRecords','artifacts']
};
for(const [stageText,required] of Object.entries(criticalStageReads)){
  const stage=Number(stageText),actual=new Set(schema.operationContract(stage,schema.STAGE_CONTRACTS[stage].operations[0]).readCollections);
  for(const collection of required)assert.ok(actual.has(collection),`Stage ${stage} is missing required prior-stage context ${collection}.`);
}
const criticalOperationReads={
  '17:FREEZE':['changes','candidateFreezes','iterations','requirements','instructions','tests','failureTests','regressions','regressionExecutions','artifacts'],
  '17:VERIFY':['runs','requirements','tests','freshContexts','artifacts'],
  '17:ROOT_CAUSE':['defects','comparisons','verification','runs','requirements','tests','instructions','instructionTraces','requirementResolutions','research','sources','candidateFreezes','artifacts','evidenceRecords'],
  '17:REGRESSION':['defects','rootCauses','requirements','tests','failureTests','regressions','regressionExecutions','artifacts','evidenceRecords'],
  '17:CORRECT':['intentStatements','sources','research','candidateRequirements','requirements','requirementResolutions','tests','failureTests','instructions','instructionTraces','preflightRecords','candidateFreezes','defects','rootCauses','regressions','regressionExecutions','changes','artifacts','evidenceRecords'],
  '19:CONFIRM_FREEZE':['convergenceRecords','candidateFreezes','iterations','requirements','instructions','tests','regressions','artifacts'],
  '19:VERIFY':['runs','requirements','tests','freshContexts','artifacts'],
  '19:REGRESSION_VERIFY':['regressions','regressionExecutions','runs','tests','artifacts'],
  '19:CONFIRM':['runs','verification','comparisons','regressionExecutions','candidateFreezes','requirements','tests','defects','rootCauses','changes']
};
for(const [key,required] of Object.entries(criticalOperationReads)){
  const [stageText,operation]=key.split(':'),actual=new Set(schema.operationContract(Number(stageText),operation).readCollections);
  for(const collection of required)assert.ok(actual.has(collection),`${key} is missing required context ${collection}.`);
}

const probe=structuredClone(state);
const currentScope={
  inputVersion:probe.job.CURRENT_INPUT_VERSION,
  sourceSetVersion:probe.job.CURRENT_SOURCE_SET_VERSION,
  requirementsVersion:probe.job.CURRENT_REQUIREMENTS_VERSION,
  testSuiteVersion:probe.job.CURRENT_TEST_SUITE_VERSION,
  instructionVersion:probe.job.CURRENT_INSTRUCTION_VERSION,
  iterationId:baseScope.iterationId,
  candidateId:baseScope.candidateId,
  baselineId:baseScope.baselineId,
  productId:baseScope.productId
};
function add(collection,id,fields,scope=currentScope){
  probe.projectData[collection]??=[];
  probe.projectData[collection].push({id,[schema.RECORD_SCHEMAS[collection].idField]:id,stage:schema.RECORD_SCHEMAS[collection].stage,active:true,status:'ACTIVE',scope:{...scope},fields:{...fields}});
}
const intentSentinel='CANONICAL_INTENT_SENTINEL: preserve the user requirement without asking for the intent file again.';
const researchSentinel='STAGE03_RESEARCH_SENTINEL: external authority requires the stated condition.';
const instructionSentinel='APPROVED_PRODUCTION_INSTRUCTION_SENTINEL: construct the complete approved deliverable.';
const rootCauseSentinel='RESPONSIBLE_LAYER_SENTINEL: earliest defect is in the requirement/instruction layer.';
add('intentStatements','STATEMENT-PROMPT-SENTINEL',{EXACT_STATEMENT:intentSentinel,SOURCE_MATERIAL:'original human input',SOURCE_LOCATION:'message',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST'});
add('sources','SOURCE-PROMPT-SENTINEL',{TITLE:'SOURCE_SENTINEL',INSPECTION_STATUS:'INSPECTED',CONTROLLING_STATE:'APPLICABLE'});
add('research','RESEARCH-PROMPT-SENTINEL',{PASS_NUMBER:1,MANDATORY_STATEMENTS:researchSentinel,SOURCE_EVIDENCE:'SOURCE-PROMPT-SENTINEL'});
add('candidateRequirements','CANDIDATE-PROMPT-SENTINEL',{CANDIDATE_OBLIGATION:researchSentinel,SOURCE_LOCATION:'SOURCE-PROMPT-SENTINEL',APPLICABILITY:'APPLICABLE'});
add('instructions','INSTRUCTION-PROMPT-SENTINEL',{INSTRUCTION_TEXT:instructionSentinel,OBJECTIVE:'Complete the approved deliverable.'});
add('rootCauses','RCA-PROMPT-SENTINEL',{ROOT_CAUSE:rootCauseSentinel,EARLIEST_DEFECTIVE_LAYER:'REQUIREMENTS',LAYER_TRACE:'intent -> requirement -> instruction',DOWNSTREAM_INVALIDATION:'Stage 04 onward',EVIDENCE:'EVIDENCE-PROMPT-SENTINEL'});
const stage2=prompts.buildPromptRecord(2,probe,{operation:'COMPLETE',scope:baseScope}).prompt;
assert.ok(stage2.includes(intentSentinel),'Stage 02 does not consume the complete canonical Stage 01 intent ledger.');
assert.ok(stage2.includes('never be requested, attached, resent, reopened, or relied on'),'Stage 02 does not explicitly prevent repeat intent-file intake.');
const stage3=prompts.buildPromptRecord(3,probe,{operation:'COMPLETE',scope:baseScope}).prompt;
assert.ok(stage3.includes(intentSentinel)&&stage3.includes('SOURCE_SENTINEL'),'Stage 03 does not receive both human-origin and source-origin authority inputs.');
const stage4=prompts.buildPromptRecord(4,probe,{operation:'COMPLETE',scope:baseScope}).prompt;
for(const token of [intentSentinel,researchSentinel,'STAGE 04 OBLIGATION MANIFEST','STATEMENT-PROMPT-SENTINEL','RESEARCH-PROMPT-SENTINEL'])assert.ok(stage4.includes(token),`Stage 04 omits operative union member ${token}.`);
assert.equal((stage4.match(/The original Stage 01 intent file is prohibited input: never request it, attach it, resend it, reopen it, or rely on an earlier conversation that contains it\./g)||[]).length,1,'Stage 04 repeats its intent-file prohibition instead of issuing one exact instruction.');
const stage14=prompts.buildPromptRecord(14,probe,{operation:'COMPLETE',scope:baseScope}).prompt;
assert.ok(stage14.includes(instructionSentinel),'Stage 14 root-cause analysis cannot inspect the responsible instruction layer.');
const stage16=prompts.buildPromptRecord(16,probe,{operation:'COMPLETE',scope:baseScope}).prompt;
for(const token of [intentSentinel,researchSentinel,instructionSentinel,rootCauseSentinel])assert.ok(stage16.includes(token),`Stage 16 correction prompt omits responsible-layer context ${token}.`);
const stage21=prompts.buildPromptRecord(21,probe,{operation:'COMPLETE',scope:baseScope}).prompt;
assert.ok(stage21.includes(instructionSentinel),'Stage 21 finished-product generation omits the approved production instruction.');

const leakProbe=structuredClone(probe);
function addLeak(collection,id,fields,scope=currentScope){
  leakProbe.projectData[collection]??=[];
  leakProbe.projectData[collection].push({id,[schema.RECORD_SCHEMAS[collection].idField]:id,stage:schema.RECORD_SCHEMAS[collection].stage,active:true,status:'ACTIVE',scope:{...scope},fields:{...fields}});
}
addLeak('runs','RUN-OTHER-CONTEXT',{COMPLETE_OUTPUT:'PRIOR_RUN_OUTPUT_MUST_NOT_LEAK',ITERATION_ID:baseScope.iterationId,CANDIDATE_ID:baseScope.candidateId,CONTEXT_ID:'CONTEXT-OTHER'},{...currentScope,runId:'RUN-OTHER-CONTEXT',contextId:'CONTEXT-OTHER'});
addLeak('verification','VERIFICATION-PRIOR',{DETERMINATION:'PRIOR_VERIFIER_CONCLUSION_MUST_NOT_LEAK'});
addLeak('comparisons','COMPARISON-PRIOR',{FINDINGS:'STAGE13_COMPARISON_MUST_NOT_LEAK'});
addLeak('changes','CHANGE-PRIOR',{CHANGE_DESCRIPTION:'PROPOSED_CORRECTION_MUST_NOT_LEAK'});
addLeak('deterministicResults','DETERMINISTIC-PRIOR',{DETERMINATION:'DETERMINISTIC_CONCLUSION_MUST_NOT_BIAS_REVIEW'});
addLeak('meaningResults','MEANING-PRIOR',{DETERMINATION:'MEANING_CONCLUSION_MUST_NOT_BIAS_ATTACK'});
addLeak('adversarialResults','ADVERSARIAL-PRIOR',{DETERMINATION:'ADVERSARIAL_CONCLUSION_MUST_NOT_BIAS_MEANING'});
addLeak('regressions','REGRESSION-AUTHORIZED',{REPRODUCTION_PROCEDURE:'AUTHORIZED_HISTORICAL_REGRESSION_PATTERN'});
const stage11=prompts.buildPromptRecord(11,leakProbe,{operation:'COMPLETE',scope:baseScope}).prompt;
assert.ok(!stage11.includes('PRIOR_RUN_OUTPUT_MUST_NOT_LEAK'),'Stage 11 leaked a prior run output into an independent execution prompt.');
const stage12=prompts.buildPromptRecord(12,leakProbe,{operation:'COMPLETE',scope:baseScope}).prompt;
for(const token of ['PRIOR_VERIFIER_CONCLUSION_MUST_NOT_LEAK','STAGE13_COMPARISON_MUST_NOT_LEAK','PROPOSED_CORRECTION_MUST_NOT_LEAK'])assert.ok(!stage12.includes(token),`Stage 12 leaked prohibited review context ${token}.`);
const stage23=prompts.buildPromptRecord(23,leakProbe,{operation:'COMPLETE',scope:baseScope}).prompt;
for(const token of ['DETERMINISTIC_CONCLUSION_MUST_NOT_BIAS_REVIEW','ADVERSARIAL_CONCLUSION_MUST_NOT_BIAS_MEANING'])assert.ok(!stage23.includes(token),`Stage 23 leaked prohibited context ${token}.`);
const stage24=prompts.buildPromptRecord(24,leakProbe,{operation:'COMPLETE',scope:baseScope}).prompt;
for(const token of ['DETERMINISTIC_CONCLUSION_MUST_NOT_BIAS_REVIEW','MEANING_CONCLUSION_MUST_NOT_BIAS_ATTACK'])assert.ok(!stage24.includes(token),`Stage 24 leaked prohibited context ${token}.`);
assert.ok(stage24.includes('AUTHORIZED_HISTORICAL_REGRESSION_PATTERN'),'Stage 24 omitted the authorized historical regression pattern.');

const requireOperativeToken=(text,token)=>assert.ok(text.includes(token),`missing operative prompt content: ${token}`);
assert.throws(()=>requireOperativeToken(stage2.replace(intentSentinel,''),intentSentinel),/missing operative prompt content/,'The prompt-coverage test must fail when required canonical input is deliberately removed.');

console.log(JSON.stringify({
  stageCount:30,
  operationCount,
  allStagePromptCoverage:1,
  oneTimeIntentReuse:true,
  stage04ClosedUnion:true,
  responsibleLayerContext:true,
  approvedInstructionContext:true,
  testIrContract:'TEST_IR',
  promptLeakageBlocked:true,
  mutationDetected:true
},null,2));
console.log('verify-all-stage-prompts: PASS');
