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
  if(!record.prompt.includes('do not claim it occurred; produce the complete implementation-ready specification'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');
  if(record.stage===2){
    if(!record.prompt.includes('DESIRED OR SUGGESTED SOURCE COUNT'))issues.push('SOURCE_COUNT_MISSING');
    if(!record.prompt.includes('no-applicable-source determination'))issues.push('NO_SOURCE_PATH_MISSING');
    if(!record.prompt.includes('most authoritative and reputable sources appropriate to the information type'))issues.push('SOURCE_QUALITY_RULE_MISSING');
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


if(schema.JOB_FIELDS.DESIRED_SOURCE_COUNT?.producer!=='HUMAN'||schema.JOB_FIELDS.DESIRED_SOURCE_COUNT?.valueType!=='INTEGER')throw new Error('Desired source count is not a typed human-owned job input.');
{
  const p=baseProject(),s2=prompts.buildPromptRecord(2,p),s12=prompts.buildPromptRecord(12,p),s15=prompts.buildPromptRecord(15,p),s21=prompts.buildPromptRecord(21,p);
  if(!s2.prompt.includes('DESIRED / SUGGESTED SOURCE COUNT')||!s2.prompt.includes('\n5\n'))throw new Error('Stage 02 does not receive the actual desired source count.');
  if(!s12.prompt.includes('REQ_ID × RUN_ID × TEST_ID triple'))throw new Error('Stage 12 prompt does not require exact verification triples.');
  if(s15.prompt.includes('fails before correction and succeeds after correction'))throw new Error('Stage 15 still requires impossible future post-correction success.');
  if(!s21.prompt.includes('approved workflow deliverable')||!s21.prompt.includes('implementation-ready specification'))throw new Error('Stage 21 does not honor the confirmed specification fallback.');
  if(!s2.prompt.includes('current human input, current canonical application context')||!s2.prompt.includes('do not ask the human to manually reconstruct application-owned state')||!s2.prompt.includes('complete replacement response'))throw new Error('Recovery protocol does not distinguish sufficiency causes.');
}
{
  const p=baseProject();
  p.projectData.sources.push({id:'SOURCE-STALE',active:true,scope:{inputVersion:'INPUT-v000'},fields:{SOURCE_ID:'SOURCE-STALE',TITLE:'STALE-SHOULD-NOT-APPEAR'}});
  p.projectData.sources.push({id:'SOURCE-CURRENT',active:true,scope:{inputVersion:'INPUT-v001'},fields:{SOURCE_ID:'SOURCE-CURRENT',TITLE:'CURRENT-SHOULD-APPEAR'}});
  const r=prompts.buildPromptRecord(3,p),ids=r.contextManifest.readCollections.sources.map(x=>x.id);
  if(ids.includes('SOURCE-STALE')||!ids.includes('SOURCE-CURRENT')||r.prompt.includes('STALE-SHOULD-NOT-APPEAR')||!r.prompt.includes('CURRENT-SHOULD-APPEAR'))throw new Error('Prompt context is not current-scope fail-closed.');
}
{
  const p=baseProject();for(let i=1;i<=25;i++)p.projectData.blockers.push({id:`BLOCKER-${i}`,active:true,stage:2,fields:{BLOCKER_ID:`BLOCKER-${i}`,STATUS:'OPEN',WHY_MANDATORY_SATISFACTION_CANNOT_BE_ESTABLISHED:`BLOCKER-REASON-${i}`}});
  p.projectData.rejectedResponses.push({rejectedResponseId:'REJECTED-CORRECTION',stage:2,requestCorrection:true,reason:'Add the missing jurisdiction analysis.',operator:'HUMAN_OPERATOR',rejectedAt:'2099-01-01T00:00:00.000Z'});
  p.projectData.responseValidations.push({validationId:'VALIDATION-LATEST',stage:2,valid:false,createdAt:'2099-01-01T00:00:01.000Z',issues:[{code:'MISSING_PROVENANCE',message:'Evidence is required.'}]});
  const text=prompts.buildPromptRecord(2,p).prompt;
  if(!text.includes('BLOCKER-REASON-1')||!text.includes('BLOCKER-REASON-25'))throw new Error('Open blockers are silently truncated in prompt context.');
  if(!text.includes('Add the missing jurisdiction analysis.'))throw new Error('Operator correction guidance is not carried into the next prompt.');
  if(!text.includes('MISSING_PROVENANCE')||!text.includes('Evidence is required.'))throw new Error('Application validation feedback is not carried into the next prompt.');
}

const p=baseProject();
const original=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope:{projectRevision:0,inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001',instructionVersion:'INSTRUCTION-v001',iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-000001',contextId:'CONTEXT-000001'}});
const mutants=[
  {...original,contextManifest:{...original.contextManifest,readCollections:{verification:[]}}},
  {...original,prompt:original.prompt.replace(`OPERATION: ${original.operation}`,'OPERATION: VERIFY')},
  {...original,prompt:original.prompt.replace('rejected data is not canonical','rejected data may be reused')},
  {...original,prompt:original.prompt.replace('do not claim it occurred; produce the complete implementation-ready specification','assume implementation occurred')}
];
for(const mutant of mutants)if(!semanticIssues(mutant).length)throw new Error('Semantic contradiction mutation escaped detection.');

console.log(JSON.stringify({promptSemanticContradictions:true,stageOperationsChecked:checked,mutationCasesRejected:mutants.length,stage2SourceCount:true,insufficiencyRecovery:true,operationIsolation:true},null,2));
