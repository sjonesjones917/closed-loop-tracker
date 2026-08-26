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
const forbiddenProcedurePatterns=[
  /Assign and preserve this job.s unique JOB_ID/i,
  /Assign CANDIDATE_ID/i,
  /Assign BASELINE_ID/i,
  /Assign PRODUCT_ID/i,
  /Create a controlled CHANGESET_ID/i,
  /Determine convergence for this job/i,
  /Apply this job.s release gate and produce exactly one determination/i,
  /Create SOURCE-SET-vN/i
];
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
  if(!record.prompt.includes('Before performing the stage task, assess whether the combined human input'))issues.push('SUFFICIENCY_ASSESSMENT_MISSING');
  if(!record.prompt.includes('HUMAN_INPUT_REQUIRED')||!record.prompt.includes('EXECUTION_FAILED')||!record.prompt.includes('return BLOCKED'))issues.push('INSUFFICIENCY_RECOVERY_MISSING');
  if(!record.prompt.includes('rejected data is not canonical'))issues.push('REFINEMENT_RULE_MISSING');
  if(!record.prompt.includes('implementation-ready specification'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');
  if(!record.prompt.includes('no external repository access unless repository contents are actually supplied'))issues.push('REPOSITORY_CAPABILITY_RULE_MISSING');
  const procedure=prompts.procedures[record.stage]||'';
  if(forbiddenProcedurePatterns.some(pattern=>pattern.test(procedure)))issues.push('APPLICATION_AUTHORITY_CONTRADICTION');
  if(record.stage===2){
    if(!record.prompt.includes('DESIRED OR SUGGESTED SOURCE COUNT'))issues.push('SOURCE_COUNT_MISSING');
    if(!record.prompt.includes('no-applicable-source determination'))issues.push('NO_SOURCE_PATH_MISSING');
    if(!record.prompt.includes('primary, official, controlling'))issues.push('SOURCE_QUALITY_RULE_MISSING');
  }
  if(record.stage===12&&!record.prompt.includes('REQ_ID × RUN_ID × TEST_ID'))issues.push('VERIFICATION_TRIPLE_RULE_MISSING');
  if(record.stage===18&&!record.prompt.includes('The application deterministically calculates'))issues.push('CONVERGENCE_AUTHORITY_RULE_MISSING');
  if(record.stage===21&&!record.prompt.includes('Do not assign PRODUCT_ID'))issues.push('PRODUCT_ID_AUTHORITY_RULE_MISSING');
  if(record.stage===27&&!record.prompt.includes('The application alone computes and records exactly one current release determination'))issues.push('RELEASE_AUTHORITY_RULE_MISSING');
  if(record.stage===28&&!record.prompt.includes('The application performs the authoritative one-to-one comparison'))issues.push('ARTIFACT_IDENTITY_AUTHORITY_RULE_MISSING');
  if(record.stage===29&&!record.prompt.includes('The application constructs the canonical evidence graph'))issues.push('EVIDENCE_GRAPH_AUTHORITY_RULE_MISSING');
  return issues;
}

const expectedOperationWrites={17:{FREEZE:[],EXECUTE_RUN:['runs'],VERIFY:['verification'],COMPARE:['comparisons'],ROOT_CAUSE:['defects','rootCauses'],REGRESSION:['regressions','regressionExecutions'],CORRECT:['changes']},19:{CONFIRM_FREEZE:[],EXECUTE_RUN:['runs'],VERIFY:['verification'],COMPARE:['comparisons'],REGRESSION_VERIFY:['regressionExecutions'],CONFIRM:['confirmationRecords']}};
for(const [stage,operations] of Object.entries(expectedOperationWrites))for(const [operation,writes] of Object.entries(operations)){
  const actual=schema.operationContract(Number(stage),operation).agentWritableCollections;
  if(!arraysEqual(actual,writes))throw new Error(`Stage ${stage} ${operation} has semantically wrong writable collections: ${actual.join(', ')}`);
}
const runRead=schema.operationContract(17,'EXECUTE_RUN').readCollections;
if(!runRead.includes('runs')||!runRead.includes('freshContexts'))throw new Error('Stage 17 EXECUTE_RUN cannot see reserved run/context slots.');

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
  {...original,prompt:original.prompt.replace('implementation-ready specification','pretend implementation completed')},
  {...original,prompt:original.prompt.replace('Before performing the stage task, assess whether the combined human input','Proceed immediately without checking whether the combined human input')},
  {...original,prompt:original.prompt.replace('no external repository access unless repository contents are actually supplied','full external repository access')}
];
for(const mutant of mutants)if(!semanticIssues(mutant).length)throw new Error('Semantic contradiction mutation escaped detection.');

console.log(JSON.stringify({promptSemanticContradictions:true,stageOperationsChecked:checked,mutationCasesRejected:mutants.length,stage2SourceCount:true,insufficiencyRecovery:true,sufficiencyAssessment:true,repositoryCapabilityHonesty:true,applicationAuthorityIsolation:true,verificationTriples:true,operationIsolation:true},null,2));