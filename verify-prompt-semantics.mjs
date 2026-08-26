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

const forbiddenProcedureSemantics=[
  [/Assign and preserve this job’s unique JOB_ID/i,'AGENT_ASSIGNS_JOB_ID'],
  [/Create SOURCE-SET-vN/i,'AGENT_CREATES_SOURCE_SET_VERSION'],
  [/Each REQ_ID must express/i,'AGENT_COORDINATES_REQUIREMENT_ID'],
  [/Calculate mandatory requirement-to-test coverage exactly/i,'AGENT_CALCULATES_COVERAGE'],
  [/Build this job’s MUTATION-SUITE-vN/i,'AGENT_ASSIGNS_MUTATION_SUITE_VERSION'],
  [/Assign CANDIDATE_ID and ITERATION_ID/i,'AGENT_ASSIGNS_CANDIDATE_ITERATION'],
  [/For each RUN_ID preserve context identity, timestamps/i,'AGENT_OWNS_RUN_LIFECYCLE'],
  [/create a complete new ten-execution iteration.*new ITERATION_ID and CANDIDATE_ID/i,'AGENT_ASSIGNS_REPEATED_ITERATION'],
  [/Determine convergence.*Calculate mandatory requirement coverage/i,'AGENT_CALCULATES_CONVERGENCE'],
  [/Assign BASELINE_ID/i,'AGENT_ASSIGNS_BASELINE'],
  [/Assign PRODUCT_ID, PRODUCT_VERSION, BASELINE_ID, EXECUTION_ID/i,'AGENT_ASSIGNS_PRODUCT_IDENTITY'],
  [/Apply this job’s release gate and produce exactly one determination/i,'AGENT_SETS_RELEASE'],
  [/verify exact artifact identity immediately before release\. Compare audited artifact identity/i,'AGENT_ASSERTS_BYTE_IDENTITY'],
  [/Preserve this job’s complete evidence chain for every mandatory requirement/i,'AGENT_CONSTRUCTS_EVIDENCE_GRAPH']
];
for(const [pattern,code] of forbiddenProcedureSemantics){for(const [stage,text] of Object.entries(prompts.procedures)){if(pattern.test(text))throw new Error(`Stage ${stage} prompt authority contradiction: ${code}`);}}

const requiredProcedureSemantics={
  1:['application owns JOB_ID','does not connect to or modify an external repository'],
  2:['application assigns source-set version and canonical source identities','return fewer rather than adding weak or irrelevant sources'],
  4:['application assigns REQ_ID'],
  6:['application assigns TEST_ID','calculates exact mandatory requirement-to-test coverage'],
  10:['application assigns CANDIDATE_ID and ITERATION_ID','human selects authorized canonical components'],
  11:['application owns run/context IDs','hashes calculated from actual bytes'],
  12:['REQ_ID × RUN_ID × TEST_ID'],
  13:['application calculates all-ten'],
  15:['application assigns REG_ID','later actual regression execution'],
  16:['application assigns CHANGESET_ID','invalidates downstream work'],
  18:['application calculates mandatory requirement coverage','final convergence Boolean'],
  20:['application assigns BASELINE_ID','human authorizes the baseline'],
  21:['application assigns PRODUCT_ID','authoritative for actual file bytes'],
  25:['application derives filenames','byte sizes'],
  27:['Do not set a release state','application evaluates the complete current evidence'],
  28:['application performs the authoritative immediate pre-release byte comparison'],
  29:['application constructs the complete evidence graph'],
  30:['application maintains append-only defect and regression history']
};
for(const [stage,phrases] of Object.entries(requiredProcedureSemantics)){const text=prompts.procedures[Number(stage)];for(const phrase of phrases)if(!text.includes(phrase))throw new Error(`Stage ${stage} is missing required semantic authority text: ${phrase}`);}

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
  if(!record.prompt.includes('HUMAN_INPUT_REQUIRED')||!record.prompt.includes('EXECUTION_FAILED')||!record.prompt.includes('requires BLOCKED'))issues.push('INSUFFICIENCY_RECOVERY_MISSING');
  if(!record.prompt.includes('rejected data is not canonical'))issues.push('REFINEMENT_RULE_MISSING');
  if(!record.prompt.includes('implementation-ready specification rather than pretending implementation occurred'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');
  if(record.stage===2){
    if(!record.prompt.includes('DESIRED OR SUGGESTED SOURCE COUNT'))issues.push('SOURCE_COUNT_MISSING');
    if(!record.prompt.includes('no-applicable-source determination'))issues.push('NO_SOURCE_PATH_MISSING');
    if(!record.prompt.includes('primary, official, controlling'))issues.push('SOURCE_QUALITY_RULE_MISSING');
  }
  return issues;
}

const expectedOperationWrites={17:{FREEZE:[],EXECUTE_RUN:['runs'],VERIFY:['verification'],COMPARE:['comparisons'],ROOT_CAUSE:['defects','rootCauses'],REGRESSION:['regressions','regressionExecutions'],CORRECT:['changes']},19:{CONFIRM_FREEZE:[],EXECUTE_RUN:['runs'],VERIFY:['verification'],COMPARE:['comparisons'],REGRESSION_VERIFY:['regressionExecutions'],CONFIRM:['confirmationRecords']}};
for(const [stage,operations] of Object.entries(expectedOperationWrites))for(const [operation,writes] of Object.entries(operations)){const actual=schema.operationContract(Number(stage),operation).agentWritableCollections;if(!arraysEqual(actual,writes))throw new Error(`Stage ${stage} ${operation} has semantically wrong writable collections: ${actual.join(', ')}`);}
const runRead=schema.operationContract(17,'EXECUTE_RUN').readCollections;if(!runRead.includes('runs')||!runRead.includes('freshContexts'))throw new Error('Stage 17 EXECUTE_RUN cannot see reserved run/context slots.');

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

// A current prompt must not silently absorb historical records from a stale version scope.
const scoped=baseProject();
scoped.projectData.tests.push({id:'TEST-CURRENT',active:true,scope:{requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001'},fields:{STATUS:'READY'}});
scoped.projectData.tests.push({id:'TEST-STALE',active:true,scope:{requirementsVersion:'REQUIREMENTS-v000',testSuiteVersion:'TEST-SUITE-v000'},fields:{STATUS:'READY'}});
const scopedPrompt=prompts.buildPromptRecord(12,scoped,{operation:'VERIFY',scope:{projectRevision:0,inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001',instructionVersion:'INSTRUCTION-v001',iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-000001',contextId:'CONTEXT-000001'}});
const selectedTests=scopedPrompt.contextManifest.readCollections.tests||[];
if(!selectedTests.some(x=>x.id==='TEST-CURRENT')||selectedTests.some(x=>x.id==='TEST-STALE'))throw new Error('Current prompt context is not isolated from stale version-scoped records.');

const p=baseProject();
const original=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope:{projectRevision:0,inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001',instructionVersion:'INSTRUCTION-v001',iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-000001',contextId:'CONTEXT-000001'}});
const mutants=[
  {...original,contextManifest:{...original.contextManifest,readCollections:{verification:[]}}},
  {...original,prompt:original.prompt.replace(`OPERATION: ${original.operation}`,'OPERATION: VERIFY')},
  {...original,prompt:original.prompt.replace('rejected data is not canonical','rejected data may be reused')},
  {...original,prompt:original.prompt.replace('implementation-ready specification rather than pretending implementation occurred','assume implementation occurred')}
];
for(const mutant of mutants)if(!semanticIssues(mutant).length)throw new Error('Semantic contradiction mutation escaped detection.');

console.log(JSON.stringify({promptSemanticContradictions:true,stageOperationsChecked:checked,authorityProcedureChecks:Object.keys(requiredProcedureSemantics).length,currentScopeIsolation:true,mutationCasesRejected:mutants.length,stage2SourceCount:true,insufficiencyRecovery:true,operationIsolation:true},null,2));
