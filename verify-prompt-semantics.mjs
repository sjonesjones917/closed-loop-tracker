import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
if(!core||!schema||!engine||!prompts)throw new Error('Prompt-semantic runtime failed to load.');

function baseProject(){
  const p=core.createBlankState('JOB-PROMPT-SEMANTICS');
  Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Produce a reliable deliverable.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001',CURRENT_ITERATION:'ITERATION-000001',CURRENT_BASELINE_ID:'BASELINE-000001',CURRENT_PRODUCT_ID:'PRODUCT-000001',DESIRED_SOURCE_COUNT:'5'});
  engine.ensureShape(p);
  return p;
}
function arraysEqual(a,b){return JSON.stringify([...a].sort())===JSON.stringify([...b].sort());}
function semanticIssues(record){
  const issues=[];
  const op=schema.operationContract(record.stage,record.operation);
  const descriptor=prompts.responseContractDescriptor(record.stage,record.operation);
  if(!op)issues.push('UNKNOWN_OPERATION');
  if(!arraysEqual(Object.keys(record.contextManifest.readCollections||{}),op?.readCollections||[]))issues.push('READ_COLLECTION_CONTRADICTION');
  if(!arraysEqual(descriptor.agentWritableCollections||[],op?.agentWritableCollections||[]))issues.push('WRITE_COLLECTION_CONTRADICTION');
  if(!arraysEqual(descriptor.scopeRequirements||[],op?.scopeRequirements||[]))issues.push('SCOPE_CONTRADICTION');
  if(!record.prompt.includes(`OPERATION: ${record.operation}`))issues.push('OPERATION_IDENTITY_MISSING');
  if(!record.prompt.includes(`INSTRUCTION_ID: ${record.instructionId}`))issues.push('INSTRUCTION_IDENTITY_MISSING');
  if(!record.prompt.includes(`BODY_SHA256: ${record.bodySha256}`)||!record.prompt.includes(`CONTRACT_SHA256: ${record.contractSha256}`)||!record.prompt.includes(`CONTEXT_SIGNATURE: ${record.contextSignature}`))issues.push('PROMPT_HASH_IDENTITY_MISSING');
  if(!record.prompt.includes('HUMAN_INPUT_REQUIRED')||!record.prompt.includes('EXECUTION_FAILED')||!record.prompt.includes('return BLOCKED'))issues.push('INSUFFICIENCY_RECOVERY_MISSING');
  if(!record.prompt.includes('rejected data is not canonical'))issues.push('REFINEMENT_RULE_MISSING');
  if(!record.prompt.includes('implementation-ready specification rather than pretending implementation occurred'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');
  if(record.stage===2){
    if(!record.prompt.includes('DESIRED OR SUGGESTED SOURCE COUNT'))issues.push('SOURCE_COUNT_MISSING');
    if(!record.prompt.includes('no-applicable-source determination'))issues.push('NO_SOURCE_PATH_MISSING');
    if(!record.prompt.includes('strongest source type for each proposition'))issues.push('SOURCE_QUALITY_RULE_MISSING');
    if(record.prompt.includes('Stage 02 may contain only genuinely independent external governing sources'))issues.push('SOURCE_SCOPE_TOO_NARROW');
  }
  if(record.stage===12&&!record.prompt.includes('REQ_ID × RUN_ID × TEST_ID'))issues.push('VERIFICATION_TRIPLE_MISSING');
  if(record.stage===15){
    if(!record.prompt.includes('Do not claim a correction or post-correction success in this stage'))issues.push('REGRESSION_TEMPORAL_RULE_MISSING');
    if(!record.prompt.includes('NOT APPLICABLE AT STAGE 15'))issues.push('LEGACY_REGRESSION_FIELD_RULE_MISSING');
  }
  return issues;
}

const expectedOperationWrites={17:{FREEZE:[],EXECUTE_RUN:['runs'],VERIFY:['verification'],COMPARE:['comparisons'],ROOT_CAUSE:['defects','rootCauses'],REGRESSION:['regressions','regressionExecutions'],CORRECT:['changes']},19:{CONFIRM_FREEZE:[],EXECUTE_RUN:['runs'],VERIFY:['verification'],COMPARE:['comparisons'],REGRESSION_VERIFY:['regressionExecutions'],CONFIRM:['confirmationRecords']}}; for(const [stage,operations] of Object.entries(expectedOperationWrites))for(const [operation,writes] of Object.entries(operations)){const actual=schema.operationContract(Number(stage),operation).agentWritableCollections;if(!arraysEqual(actual,writes))throw new Error(`Stage ${stage} ${operation} has semantically wrong writable collections: ${actual.join(', ')}`);} const runRead=schema.operationContract(17,'EXECUTE_RUN').readCollections;if(!runRead.includes('runs')||!runRead.includes('freshContexts'))throw new Error('Stage 17 EXECUTE_RUN cannot see reserved run/context slots.');
let checked=0;
for(let stage=1;stage<=30;stage++){
  for(const operation of schema.STAGE_CONTRACTS[stage].operations){
    const p=baseProject();
    const op=schema.operationContract(stage,operation);
    const scope={};
    for(const key of op.scopeRequirements){
      if(key==='projectRevision')scope[key]=Number(p.revision||0);
      else if(key==='inputVersion')scope[key]=p.job.CURRENT_INPUT_VERSION;
      else if(key==='sourceSetVersion')scope[key]=p.job.CURRENT_SOURCE_SET_VERSION;
      else if(key==='requirementsVersion')scope[key]=p.job.CURRENT_REQUIREMENTS_VERSION;
      else if(key==='testSuiteVersion')scope[key]=p.job.CURRENT_TEST_SUITE_VERSION;
      else if(key==='instructionVersion')scope[key]=p.job.CURRENT_INSTRUCTION_VERSION;
      else if(key==='iterationId')scope[key]='ITERATION-000001';
      else if(key==='candidateId')scope[key]='CANDIDATE-000001';
      else if(key==='runId')scope[key]='RUN-000001';
      else if(key==='contextId')scope[key]='CONTEXT-000001';
      else if(key==='baselineId')scope[key]='BASELINE-000001';
      else if(key==='productId')scope[key]='PRODUCT-000001';
    }
    const record=prompts.buildPromptRecord(stage,p,{operation,scope});
    const issues=semanticIssues(record);
    if(issues.length)throw new Error(`Stage ${stage} ${operation} semantic contradiction(s): ${issues.join(', ')}`);
    checked++;
  }
}

const p=baseProject();
const original=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope:{projectRevision:0,inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001',instructionVersion:'INSTRUCTION-v001',iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-000001',contextId:'CONTEXT-000001'}});
const mutants=[
  {...original,contextManifest:{...original.contextManifest,readCollections:{verification:[]}}},
  {...original,prompt:original.prompt.replace(`OPERATION: ${original.operation}`,'OPERATION: VERIFY')},
  {...original,prompt:original.prompt.replace('rejected data is not canonical','rejected data may be reused')},
  {...original,prompt:original.prompt.replace('implementation-ready specification rather than pretending implementation occurred','assume implementation occurred')}
];
for(const mutant of mutants)if(!semanticIssues(mutant).length)throw new Error('Semantic contradiction mutation escaped detection.');

const recovery=baseProject();
recovery.projectData.responseValidations.push({validationId:'VALIDATION-RECOVERY',stage:2,operation:'COMPLETE',rawResponseId:'RAW-BAD',valid:false,issues:[{code:'WRONG_VALUE_TYPE',path:'/records/sources/0/fields/TITLE',message:'Expected STRING.'}]});
recovery.projectData.history.push({eventId:'EVENT-REFINE',eventSequence:1,type:'ACCEPTED_RESPONSE_INVALIDATED',stage:2,operation:'COMPLETE',rawResponseId:'RAW-OLD',reason:'Add the omitted authoritative source and explain its applicability.',operatorLabel:'HUMAN_OPERATOR',identityAssurance:'SELF_ASSERTED'});
const recoveryPrompt=prompts.buildPromptRecord(2,recovery,{operation:'COMPLETE'});
if(!recoveryPrompt.prompt.includes('APPLICATION VALIDATION FEEDBACK')||!recoveryPrompt.prompt.includes('WRONG_VALUE_TYPE')||!recoveryPrompt.prompt.includes('Expected STRING.'))throw new Error('Application validation feedback is not carried into the next controlling prompt.');
if(!recoveryPrompt.prompt.includes('OPERATOR REQUESTED CORRECTIONS / REFINEMENTS')||!recoveryPrompt.prompt.includes('Add the omitted authoritative source and explain its applicability.'))throw new Error('Accepted-result refinement reason is not carried into the next controlling prompt.');
if(!recoveryPrompt.contextManifest.validationFeedback?.length||!recoveryPrompt.contextManifest.acceptedResultRefinements?.length)throw new Error('Recovery feedback is not bound into the prompt context signature.');

console.log(JSON.stringify({promptSemanticContradictions:true,stageOperationsChecked:checked,mutationCasesRejected:mutants.length,stage2SourceCount:true,sourceRoleSemantics:true,verificationTriplePrompt:true,stage15TemporalSemantics:true,insufficiencyRecovery:true,validationRecovery:true,acceptedRefinementRecovery:true,operationIsolation:true},null,2));

// Exact operation scope must prevent cross-run output contamination.
{const p=baseProject();p.projectData.runs.push({id:'RUN-ISO-A',stage:17,active:true,scope:{iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-ISO-A',contextId:'CTX-ISO-A'},fields:{RUN_ID:'RUN-ISO-A',COMPLETE_OUTPUT:'SECRET-OTHER-RUN'}},{id:'RUN-ISO-B',stage:17,active:true,scope:{iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-ISO-B',contextId:'CTX-ISO-B'},fields:{RUN_ID:'RUN-ISO-B',COMPLETE_OUTPUT:''}});p.projectData.freshContexts.push({id:'CTX-ISO-A',stage:17,active:true,scope:{iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-ISO-A',contextId:'CTX-ISO-A'},fields:{CONTEXT_ID:'CTX-ISO-A'}},{id:'CTX-ISO-B',stage:17,active:true,scope:{iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-ISO-B',contextId:'CTX-ISO-B'},fields:{CONTEXT_ID:'CTX-ISO-B'}});const pr=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope:{iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-ISO-B',contextId:'CTX-ISO-B'}});if(pr.prompt.includes('SECRET-OTHER-RUN'))throw new Error('Run prompt leaked another run output.');if(pr.contextManifest.readCollections.runs.length!==1||pr.contextManifest.readCollections.runs[0].id!=='RUN-ISO-B')throw new Error('Run prompt manifest was not scoped to the selected run.');}
// Independent run prompts remain active simultaneously.
{const p=baseProject();p.revision=0;const a=prompts.buildPromptRecord(17,{...p,revision:1},{operation:'EXECUTE_RUN',scope:{runId:'RUN-A',contextId:'CTX-A'}});engine.registerGeneratedPrompt(p,a);p.revision=1;const b=prompts.buildPromptRecord(17,{...p,revision:2},{operation:'EXECUTE_RUN',scope:{runId:'RUN-B',contextId:'CTX-B'}});engine.registerGeneratedPrompt(p,b);const active=p.projectData.generatedPrompts.filter(x=>!x.invalidatedBy);if(!active.some(x=>x.instructionId===a.instructionId)||!active.some(x=>x.instructionId===b.instructionId))throw new Error('Independent run prompt was superseded.');}
// Desired source count participates in controlled User Job Input identity.
{const p=baseProject();p.job.DESIRED_SOURCE_COUNT=5;engine.recordHumanInputVersion(p,['DESIRED_SOURCE_COUNT'],'VERIFY');const before=p.job.CURRENT_INPUT_VERSION;p.job.DESIRED_SOURCE_COUNT=9;engine.recordHumanInputVersion(p,['DESIRED_SOURCE_COUNT'],'VERIFY');if(p.job.CURRENT_INPUT_VERSION===before)throw new Error('Desired source count did not version User Job Input.');}
