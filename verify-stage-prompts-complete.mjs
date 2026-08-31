import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const assert=(value,message)=>{if(!value)throw new Error(message);};
assert(core&&schema&&engine&&prompts,'Prompt verification runtime failed to load.');
assert(!Object.prototype.hasOwnProperty.call(schema.RECORD_SCHEMAS,'intentStatements'),'A redundant second intent registry has been reintroduced.');

const project=core.createBlankState('JOB-PROMPT-CLOSURE');
Object.assign(project.job,{
  JOB_ID:'JOB-PROMPT-CLOSURE',
  JOB_TITLE:'Prompt closure fixture',
  JOB_OWNER:'Operator',
  EXACT_USER_OBJECTIVE_VERBATIM:'Prove every stage prompt has the data and instructions needed for exactly its job. The project has an intent file.',
  SUPPLIED_MATERIALS_INVENTORY:'intent.txt',
  EXPLICIT_USER_REQUIREMENTS:'Never ask the human to repeat project information already supplied.',
  CURRENT_INPUT_VERSION:'INPUT-v001',
  CURRENT_SOURCE_SET_VERSION:'SOURCE-v001',
  CURRENT_REQUIREMENTS_VERSION:'REQ-v001',
  CURRENT_TEST_SUITE_VERSION:'TEST-v001',
  CURRENT_INSTRUCTION_VERSION:'INST-v001',
  CURRENT_ITERATION:'ITER-001',
  CURRENT_BASELINE_ID:'BASE-001',
  CURRENT_PRODUCT_ID:'PROD-001'
});
engine.ensureShape(project);
engine.recalculate(project);

const intake=engine.intakeCoverageManifest(project);
project.stages[1].agentData={
  EXACT_DELIVERABLE_REQUESTED:'A complete verified deliverable implementing every captured project requirement.',
  ASSUMPTIONS:'NONE',
  UNKNOWN_INFORMATION:'NONE',
  INPUT_SET_CONTENTS:JSON.stringify({
    schema:'closed-loop-stage01-capture/1',
    inputVersion:intake.inputVersion,
    manifestSha256:intake.manifestSha256,
    units:intake.units.map((unit,index)=>({
      sourceUnitId:unit.unitId,
      sourceRawValueSha256:unit.rawValueSha256,
      disposition:'incorporated into the job definition',
      reason:'Captured once for complete ordered prompt verification.',
      extractedStatements:[{
        statementKey:`PROMPT-${String(index+1).padStart(3,'0')}`,
        text:unit.rawValueText,
        statementClass:'REQUIREMENT'
      }]
    }))
  })
};
project.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};
project.stages[3].agentData={
  ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:true,
  SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,
  NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false
};

const requiredReads={
  4:['research','candidateRequirements','sources','evidenceRecords'],
  5:['requirements','research','sources','sourceConflicts','evidenceRecords'],
  6:['requirements','requirementResolutions','artifacts'],
  7:['requirements','tests','artifacts','evidenceRecords'],
  8:['requirements','tests','failureTests','requirementResolutions','sources'],
  10:['instructions','preflightRecords','tests','failureTests','artifacts'],
  13:['verification','runs','requirements','tests'],
  14:['defects','comparisons','verification','requirements','tests','instructions','runs'],
  15:['defects','rootCauses','requirements','tests','artifacts','evidenceRecords'],
  16:['defects','rootCauses','regressions','regressionExecutions','requirements','instructions','tests','artifacts'],
  21:['baselines','instructions','artifacts','freshContexts'],
  23:['products','requirements','tests','sources','evidenceRecords'],
  24:['products','requirements','tests','regressions','regressionExecutions','evidenceRecords'],
  25:['products','artifacts','requirements'],
  26:['products','baselines','requirements','instructions','tests','runs','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','regressions','regressionExecutions','defects','blockers','evidenceRecords'],
  27:['requirements','tests','products','baselines','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers','regressionExecutions','evidenceRecords'],
  29:['sources','requirements','instructions','instructionTraces','runs','products','baselines','tests','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','regressions','regressionExecutions','releaseRecords','artifactIdentities','evidenceRecords'],
  30:['defects','rootCauses','regressions','regressionExecutions','changes','baselines','evidenceRecords']
};
for(const [stage,collections] of Object.entries(requiredReads)){
  const declared=new Set(schema.STAGE_CONTRACTS[Number(stage)].readCollections);
  for(const collection of collections)assert(declared.has(collection),`Stage ${stage} context contract omits required ${collection}.`);
}

const semantic={
  1:['STAGE 01 HUMAN CONVERSATION — THIS OCCURS BEFORE ANY FINAL JSON','ask the human in plain language to attach or provide the exact named material now','then stop and wait','BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','schema-valid but incomplete, generic, skeletal, placeholder, or low-detail proposal is prohibited','Classify every APPLICATION INTAKE MANIFEST unit exactly once'],
  2:['independent external sources','NO_APPLICABLE_EXTERNAL_SOURCE','Never invent a source'],
  3:['every current Stage 02 source must receive current research coverage','second complete pass','Repeat until the latest complete pass finds no new material'],
  4:['complete application-enumerated obligation universe','Process every obligationId exactly once','No obligation may disappear'],
  5:['complete current Stage 04 requirement set','COMPLETE corrected resulting requirements collection','Do not design tests or production instructions'],
  6:['closed-loop-test-spec/1','APPLICATION_DETERMINISTIC','how a defective product could falsely appear compliant','Never invent runtime semantics'],
  7:['Fixture definition is not execution','actually execute each fixture','actual observed result'],
  8:['complete current resolved requirement registry','requirement-to-instruction trace records','do not execute production'],
  9:['every sentence and material clause','full repeated preflight','Do not perform production'],
  10:['human selects authorized components','Do not invent candidate','Do not execute the candidate here'],
  11:['exactly one application-reserved run lane','Do not compare or verify runs here'],
  12:['REQ_ID × RUN_ID × TEST_ID','Do not self-validate','application determines independence'],
  13:['all ten current runs','correctness-affecting variance','do not perform RCA yet'],
  14:['earliest defective layer','evidence-supported causal trace','Do not implement the correction'],
  15:['pre-correction','statement that the test would have detected it is insufficient','never use the same execution as both pre- and post-correction proof'],
  16:['earliest defective layer','Do not ask the user to determine the responsible layer','create new versions rather than editing in place'],
  18:['latest completed current iteration','application owns all metrics','Do not set CONVERGED'],
  20:['Human baseline authorization','application assigns baseline identity','do not ask the human to transcribe'],
  21:['actual output bytes','fresh production context','approved baseline materials'],
  22:['application is running all mechanical tests','Native Test IR tests run automatically','unsupported deterministic tests route'],
  23:['independent interpretation','product location','observed meaning'],
  24:['every applicable attack category','active historical regression pattern','unresolved mandatory finding'],
  25:['every product, delivery artifact','page, view, transformation','No mandatory representation unknown'],
  26:['process evidence','product evidence','discrepancies and contradictions'],
  27:['application alone calculates','ACCEPTED, REJECTED, or BLOCKED','never set or override release state'],
  28:['No external agent operation is required','byte-identity','missing, extra, duplicate'],
  29:['application-generated graph','every mandatory requirement','never fabricate a link'],
  30:['append-only','every confirmed defect has a permanent regression','Never rewrite history']
};

const scope={
  runId:'RUN-001',
  contextId:'CTX-001',
  iterationId:'ITER-001',
  candidateId:'CAND-001',
  baselineId:'BASE-001',
  productId:'PROD-001'
};
let promptsChecked=0;
for(let stage=1;stage<=30;stage++){
  const contract=schema.STAGE_CONTRACTS[stage];
  for(const operation of contract.operations){
    const prompt=prompts.buildPromptRecord(stage,project,{operation,scope}).prompt;
    promptsChecked++;
    for(const common of [
      'PROJECT DATA EXECUTION RULE — MANDATORY',
      'Project-relevant information supplied by the human is supplied once',
      'never ask the human to repeat, retype, summarize, resend, reopen, or reattach it',
      'HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE',
      'STRICT RESPONSE CONTRACT'
    ])assert(prompt.includes(common),`Stage ${stage} ${operation} is missing common prompt invariant: ${common}`);
    if(stage>1)assert(prompt.includes('The original Stage 01 intent file is prohibited input for this stage.'),`Stage ${stage} ${operation} can regress to requesting the original intent again.`);
    assert(!prompt.includes('CUSTOM_PIPELINE'),`Stage ${stage} ${operation} exposes prohibited CUSTOM_PIPELINE.`);
    for(const phrase of semantic[stage]||[])assert(prompt.toLowerCase().includes(String(phrase).toLowerCase()),`Stage ${stage} ${operation} is missing stage-semantic instruction: ${phrase}`);
    if(stage===17||stage===19){const operationProcedure=prompts.procedureFor(stage,operation);assert(prompt.includes(operationProcedure),`Stage ${stage} ${operation} does not embed its operation-specific procedure.`);assert(operationProcedure.includes(`operation ${operation} only`),`Stage ${stage} ${operation} is not restricted to its declared operation.`);}
    if(stage===1){
      assert(prompt.indexOf('STAGE 01 HUMAN CONVERSATION')<prompt.indexOf('STRICT RESPONSE CONTRACT'),'Stage 01 machine output contract precedes the human conversation.');
      assert(prompt.includes('intent.txt'),'Stage 01 omitted the named supplied file.');
    }
  }
  project.stages[stage].status='COMPLETE';
  project.stages[stage].gate={complete:true,blocked:false,reasons:[]};
}
assert(promptsChecked===41,`Expected 41 current stage/operation prompts; checked ${promptsChecked}.`);

const operationNeeds={
  '17:FREEZE':['instructions','requirements','artifacts'],
  '17:COMPARE':['tests'],
  '17:ROOT_CAUSE':['instructions','requirements','tests','runs'],
  '17:REGRESSION':['tests','runs','verification','artifacts'],
  '17:CORRECT':['instructions','requirements','tests','runs','artifacts'],
  '19:CONFIRM_FREEZE':['requirements','tests','artifacts'],
  '19:COMPARE':['tests'],
  '19:REGRESSION_VERIFY':['tests','requirements','artifacts'],
  '19:CONFIRM':['requirements','tests','regressions','defects','blockers']
};
for(const [key,needed] of Object.entries(operationNeeds)){
  const [stage,operation]=key.split(':');
  const contract=schema.operationContract(Number(stage),operation);
  for(const collection of needed)assert(contract.readCollections.includes(collection),`${key} context omits ${collection}.`);
}

for(const [stage,forbidden] of [
  [11,['verification','comparisons','rootCauses','changes']],
  [12,['comparisons','rootCauses','changes']],
  [23,['deterministicResults','adversarialResults']],
  [24,['deterministicResults','meaningResults']]
]){
  const contract=schema.operationContract(stage,schema.STAGE_CONTRACTS[stage].operations[0]);
  for(const collection of forbidden)assert(!contract.readCollections.includes(collection),`Stage ${stage} leaks forbidden ${collection} through its declared context.`);
}

const browserWalk=spawnSync(process.execPath,['verify-human-stage-walkthrough.mjs'],{encoding:'utf8',env:process.env});
if(browserWalk.status!==0)throw new Error(`Sequential browser stage walkthrough failed.\n${browserWalk.stdout||''}\n${browserWalk.stderr||''}`);
const browserProof=JSON.parse(String(browserWalk.stdout||'{}'));
assert(browserProof.stages===30&&browserProof.oneTimeSupply===true,'Sequential browser stage walkthrough did not establish all 30 stages and one-time project input reuse.');
assert(browserProof.first==='1:COMPLETE'&&browserProof.last==='30:COMPLETE','Browser walkthrough did not use the complete stage order.');

console.log(JSON.stringify({
  promptsChecked,
  stagesChecked:30,
  compositeOperationChecks:Object.keys(operationNeeds).length,
  customPipelineOccurrences:0,
  oneTimeHumanInputInvariant:true,
  stage1ConversationFirst:true,
  requiredStage1FileRequest:true,
  browserStageWalkthrough:true,
  browserPromptsChecked:browserProof.prompts,
  promptVisualBaseline:browserProof.promptVisualBaseline===true
},null,2));
