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
function procedureIssues(stage,task){
  const issues=[];
  if(stage===1&&/Assign and preserve this job’s unique JOB_ID/.test(task))issues.push('AGENT_ASSIGNS_JOB_ID');
  if(stage===2&&/Create SOURCE-SET-vN/.test(task))issues.push('AGENT_ASSIGNS_SOURCE_SET_VERSION');
  if(stage===4&&/Each REQ_ID must express/.test(task))issues.push('AGENT_ASSIGNS_REQUIREMENT_ID');
  if(stage===6&&(/valid TEST_ID/.test(task)||/Calculate mandatory requirement-to-test coverage/.test(task)))issues.push('AGENT_ASSIGN_TEST_OR_COVERAGE');
  if(stage===10&&(/Assign CANDIDATE_ID/.test(task)||/Assign .*ITERATION_ID/.test(task)))issues.push('AGENT_ASSIGNS_CANDIDATE_ID');
  if(stage===12&&!task.includes('REQ_ID × RUN_ID × TEST_ID triple'))issues.push('VERIFICATION_TRIPLE_MISSING');
  if(stage===15&&(!task.includes('Do not require or claim post-correction success at this stage')||/preserve[^.]*post-correction result and evidence/i.test(task)))issues.push('STAGE15_TEMPORAL_CONTRADICTION');
  if(stage===16&&/Create a controlled CHANGESET_ID/.test(task))issues.push('AGENT_ASSIGNS_CHANGESET_ID');
  if(stage===17&&/new ITERATION_ID and CANDIDATE_ID/.test(task))issues.push('AGENT_ASSIGNS_ITERATION_ID');
  if(stage===18&&(/Determine convergence/.test(task)||/Calculate mandatory requirement coverage/.test(task)))issues.push('AGENT_CALCULATES_CONVERGENCE');
  if(stage===20&&/assign BASELINE_ID/i.test(task))issues.push('AGENT_ASSIGNS_BASELINE_ID');
  if(stage===21&&(/Assign PRODUCT_ID/.test(task)||/Assign .*EXECUTION_ID/.test(task)))issues.push('AGENT_ASSIGNS_PRODUCT_ID');
  if(stage===25&&/Preserve artifact inventory, filename, version, byte size, SHA-256/.test(task))issues.push('AGENT_ASSERTS_FILE_FACTS');
  if(stage===27&&/produce exactly one determination/.test(task))issues.push('AGENT_SETS_RELEASE');
  if(stage===28&&/^Only after Stage 27 is ACCEPTED, verify exact artifact identity/.test(task))issues.push('AGENT_ASSERTS_ARTIFACT_IDENTITY');
  if(stage===29&&/^Preserve this job’s complete evidence chain/.test(task))issues.push('AGENT_CONSTRUCTS_EVIDENCE_CHAIN');
  return issues;
}
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
    if(!record.prompt.includes('primary, official, controlling'))issues.push('SOURCE_QUALITY_RULE_MISSING');
  }
  issues.push(...procedureIssues(record.stage,prompts.procedures[record.stage]||''));
  return [...new Set(issues)];
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
const authorityMutants=[
  [10,prompts.procedures[10].replace('the application assigns CANDIDATE_ID and ITERATION_ID','Assign CANDIDATE_ID and ITERATION_ID')],
  [18,prompts.procedures[18].replace('Review convergence evidence','Determine convergence')],
  [20,prompts.procedures[20].replace('the application assigns BASELINE_ID','assign BASELINE_ID')],
  [21,prompts.procedures[21].replace('The application assigns PRODUCT_ID and execution identity','Assign PRODUCT_ID and EXECUTION_ID')],
  [27,prompts.procedures[27].replace('Do not set a release state.','Apply the release gate and produce exactly one determination.')],
  [28,'Only after Stage 27 is ACCEPTED, verify exact artifact identity immediately before release.'],
  [29,'Preserve this job’s complete evidence chain for every mandatory requirement.']
];
for(const [stage,task] of authorityMutants)if(!procedureIssues(stage,task).length)throw new Error(`Stage ${stage} ownership contradiction mutation escaped detection.`);

if(!core.STAGES[11].completionGate.some(x=>x.includes('REQ_ID × RUN_ID × TEST_ID')))throw new Error('Stage 12 completion language is not the exact verification triple.');
if(core.STAGES[14].result.toLowerCase().includes('succeeds after correction')||core.STAGES[14].completionGate.some(x=>x.toLowerCase().includes('succeeds after correction')))throw new Error('Stage 15 incorrectly requires future post-correction success.');
{
 const p=baseProject();const r=prompts.buildPromptRecord(15,p,{operation:'COMPLETE'});if(!r.prompt.includes('Do not require or claim post-correction success at this stage'))throw new Error('Stage 15 prompt chronology is wrong.');
}
{
 const p=baseProject();p.projectData.responseValidations.push({validationId:'VALIDATION-X',stage:2,promptId:'PROMPT-X',valid:false,issues:[{code:'MISSING_PROVENANCE',path:'/evidence',message:'Evidence is required.'}]});const seed=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});p.projectData.generatedPrompts.push({...seed,instructionId:'PROMPT-X',promptId:'PROMPT-X'});const r=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});if(!r.prompt.includes('LATEST APPLICATION VALIDATION FAILURE TO CORRECT')||!r.prompt.includes('MISSING_PROVENANCE'))throw new Error('Validation failure is not correction context.');
}
{
 const p=baseProject();const r=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});if(!r.prompt.includes('audit, repair, migration, or modification of an existing target'))throw new Error('Existing-target audit/repair boundary is missing.');
}

console.log(JSON.stringify({promptSemanticContradictions:true,stageOperationsChecked:checked,mutationCasesRejected:mutants.length+authorityMutants.length,stage2SourceCount:true,insufficiencyRecovery:true,operationIsolation:true,authorityBoundaryChecks:true},null,2));

// Exact operation scope must prevent cross-run output contamination.
{const p=baseProject();p.projectData.runs.push({id:'RUN-ISO-A',stage:17,active:true,scope:{iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-ISO-A',contextId:'CTX-ISO-A'},fields:{RUN_ID:'RUN-ISO-A',COMPLETE_OUTPUT:'SECRET-OTHER-RUN'}},{id:'RUN-ISO-B',stage:17,active:true,scope:{iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-ISO-B',contextId:'CTX-ISO-B'},fields:{RUN_ID:'RUN-ISO-B',COMPLETE_OUTPUT:''}});p.projectData.freshContexts.push({id:'CTX-ISO-A',stage:17,active:true,scope:{iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-ISO-A',contextId:'CTX-ISO-A'},fields:{CONTEXT_ID:'CTX-ISO-A'}},{id:'CTX-ISO-B',stage:17,active:true,scope:{iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-ISO-B',contextId:'CTX-ISO-B'},fields:{CONTEXT_ID:'CTX-ISO-B'}});const pr=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope:{iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-ISO-B',contextId:'CTX-ISO-B'}});if(pr.prompt.includes('SECRET-OTHER-RUN'))throw new Error('Run prompt leaked another run output.');if(pr.contextManifest.readCollections.runs.length!==1||pr.contextManifest.readCollections.runs[0].id!=='RUN-ISO-B')throw new Error('Run prompt manifest was not scoped to the selected run.');}
// Independent run prompts remain active simultaneously.
{const p=baseProject();p.revision=0;const a=prompts.buildPromptRecord(17,{...p,revision:1},{operation:'EXECUTE_RUN',scope:{runId:'RUN-A',contextId:'CTX-A'}});engine.registerGeneratedPrompt(p,a);p.revision=1;const b=prompts.buildPromptRecord(17,{...p,revision:2},{operation:'EXECUTE_RUN',scope:{runId:'RUN-B',contextId:'CTX-B'}});engine.registerGeneratedPrompt(p,b);const active=p.projectData.generatedPrompts.filter(x=>!x.invalidatedBy);if(!active.some(x=>x.instructionId===a.instructionId)||!active.some(x=>x.instructionId===b.instructionId))throw new Error('Independent run prompt was superseded.');}
// Desired source count participates in controlled User Job Input identity.
{const p=baseProject();p.job.DESIRED_SOURCE_COUNT=5;engine.recordHumanInputVersion(p,['DESIRED_SOURCE_COUNT'],'VERIFY');const before=p.job.CURRENT_INPUT_VERSION;p.job.DESIRED_SOURCE_COUNT=9;engine.recordHumanInputVersion(p,['DESIRED_SOURCE_COUNT'],'VERIFY');if(p.job.CURRENT_INPUT_VERSION===before)throw new Error('Desired source count did not version User Job Input.');}


// Residual prompt recovery invariants.
{
  const p=baseProject();
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='Implement a repository-scale application that cannot be directly modified from the authorized environment.';
  const s1=prompts.buildPromptRecord(1,p).prompt;
  if(!/EXACT_DELIVERABLE_REQUESTED/.test(s1)||!/human intent confirmation/i.test(s1)||!/implementation-ready specification/i.test(s1))throw new Error('Stage 01 does not convert infeasible implementation into a confirmable feasible deliverable.');
  if(/Work too large for the available environment requires BLOCKED/.test(s1))throw new Error('Global prompt rules still contradict Stage 01 feasible-deliverable recovery.');
  const workbookText=fs.readFileSync('workbook.js','utf8');
  if(/function\s+buildStagePrompt\s*\(/.test(workbookText))throw new Error('workbook.js still contains a competing legacy prompt implementation.');
  if(core.STAGES[14].fields.includes('POST_CORRECTION_SUCCESSES_PROVEN'))throw new Error('Stage 15 still exposes future post-correction success as current-stage state.');
}
{
  const p=baseProject(), first=prompts.buildPromptRecord(2,p);p.projectData.generatedPrompts.push({...first,generatedAt:new Date().toISOString()});
  p.projectData.acceptedChanges.push({changeId:'CHANGE-REFINE',stage:2,status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-REFINE',proposalId:'PROPOSAL-REFINE',promptId:first.instructionId,operation:'COMPLETE',scope:{...first.scope}});
  p.projectData.responseProposals.push({proposalId:'PROPOSAL-REFINE',promptId:first.instructionId,stage:2,envelope:{operation:'COMPLETE',scope:{...first.scope}},scope:{...first.scope}});
  engine.invalidateAcceptedResponse(p,{stage:2,rawResponseId:'RAW-REFINE',reason:'The accepted result omitted a material source and must be more complete.'});
  const second=prompts.buildPromptRecord(2,p,{operation:'COMPLETE',scope:{...first.scope}});
  if(!second.prompt.includes('The accepted result omitted a material source and must be more complete.'))throw new Error('Accepted-result refinement reason is absent from the next controlling prompt.');
  if(second.contextSignature===first.contextSignature)throw new Error('Accepted-result refinement did not change prompt context identity.');
}


// Stage 02 must distinguish controlling authority from other legitimate independent external evidence.
{
  const p=baseProject();
  const s2=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});
  if(!/no legitimate independent external source of any justified authority or evidentiary role/i.test(s2.prompt))throw new Error('Stage 02 no-source rule still incorrectly means no governing authority.');
  if(core.STAGES[1].completionGate.some(x=>/every governing source/i.test(x))||core.STAGES[2].completionGate.some(x=>/every controlling source/i.test(x)))throw new Error('Workbook source completion language still treats every useful external source as governing authority.');
}
