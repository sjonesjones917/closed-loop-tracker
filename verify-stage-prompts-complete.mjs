import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
if(!core||!schema||!engine||!prompts)throw new Error('Prompt audit runtime failed to load.');
const p=core.createBlankState('JOB-PROMPT-CLOSURE');
Object.assign(p.job,{JOB_ID:'JOB-PROMPT-CLOSURE',JOB_TITLE:'Prompt closure fixture',EXACT_USER_OBJECTIVE_VERBATIM:'Prove every stage prompt has the data and instructions needed for exactly its job.',EXPLICIT_USER_REQUIREMENTS:'Never ask the human to repeat project information already supplied.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-v001',CURRENT_REQUIREMENTS_VERSION:'REQ-v001',CURRENT_TEST_SUITE_VERSION:'TEST-v001',CURRENT_INSTRUCTION_VERSION:'INST-v001',CURRENT_ITERATION:'ITER-001',CURRENT_BASELINE_ID:'BASE-001',CURRENT_PRODUCT_ID:'PROD-001'});
engine.ensureShape(p);engine.recalculate(p);
const intake=engine.intakeCoverageManifest(p);
const capture={schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'retained as context',reason:'Prompt closure fixture preserves current human authority.',extractedStatements:[{statementKey:`statement-${index+1}`,text:unit.rawValueText||unit.label||unit.unitId,statementClass:'CONTEXT'}]}))};
p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Prompt closure fixture deliverable.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)};
p.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};
p.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:'TRUE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'};
for(let stage=1;stage<30;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}
if(!engine.evaluateIntakeAccounting(p).complete)throw new Error('Prompt closure fixture failed to establish current Stage 01 accounting.');
const requiredReads={
  5:['sources','candidateRequirements'],6:['sources','research'],8:['sources','sourceConflicts'],9:['failureTests','requirementResolutions','sources','sourceConflicts'],10:['artifacts'],13:['tests'],14:['requirements','tests','instructions','runs','research','sources','artifacts','evidenceRecords'],15:['requirements','tests','runs','verification','artifacts','evidenceRecords'],16:['requirements','tests','instructions','runs','artifacts','evidenceRecords'],18:['requirements','tests','rootCauses','changes'],20:['artifacts'],21:['instructions','artifacts'],23:['research','evidenceRecords'],24:['sources','research','evidenceRecords','artifacts'],26:['requirements','tests','instructions','runs','verification','regressionExecutions','confirmationRecords','evidenceRecords'],27:['products','baselines','confirmationRecords','regressions','evidenceRecords'],29:['adversarialResults','representationInspections','regressions','regressionExecutions','processAudits','productAudits','evidenceChains'],30:['requirements','evidenceRecords']
};
const operationRequiredReads={
  '4:COMPLETE':['research','candidateRequirements','sources','evidenceRecords','sourceConflicts'],
	  '4:DISPOSITION_CHALLENGE':['requirements','propositions','evidenceRecords'],
	  '4:ATOMICITY_CHALLENGE':['requirements','propositions','evidenceRecords'],
	  '4:RECONCILE_REQUIREMENTS':['research','candidateRequirements','sources','evidenceRecords','sourceConflicts','requirements','propositions','requirementCompilationChallengeReviews'],
	  '6:SEMANTIC_REVIEW':['requirements','tests','propositions','proofExpressions']
	};
const semantic={
  1:['BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','every application-enumerated input unit must be classified exactly once'],
  2:['until no new applicable controlling or correctness-relevant external source category is found','Do not stop at the first plausible source'],
  3:['every current accepted Stage 02 source has current research coverage','distinct conflict/exception/saturation pass'],
  4:['APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST','Every obligationId'],
  5:['Resolve the current job’s requirement set exhaustively','repeat the review against the resulting requirement set'],
  6:['closed-loop-test-spec/1','TEST_IR','how a defective product could falsely appear compliant'],
  7:['Fixture definition is not execution','actual observed result','evidence sufficient to prove the rejection behavior'],
  8:['production instruction only from the resolved current requirement set and verification architecture','requirement traceability'],
  9:['re-review the entire current instruction from the beginning','Do not execute target production during preflight'],
  10:['human selects authorized canonical components','Do not assign candidate identity'],
  11:['this prompt authorizes exactly one reserved RUN_ID and CONTEXT_ID','do not perform another run'],
  12:['REQ_ID × RUN_ID × TEST_ID','Never substitute a different executor'],
  13:['Compare all ten executions','Never discard a run'],
  14:['tracing backward through product/output, execution, instruction, requirement, research, source, user input','tool/configuration, artifact, and audit/evidence','earliest defective layer'],
  15:['actual pre-correction regression execution','Do not claim post-correction success at Stage 15'],
  16:['responsible earliest defective layer','Never overwrite a controlled version in place'],
  18:['application calculates mandatory requirement coverage','Do not set or override those application-derived values'],
  20:['human authorizes the baseline','Do not assign baseline identity'],
  21:['Produce the job’s approved deliverable','Generate the complete approved deliverable'],
  22:['Never claim an unexecuted deterministic check ran'],
  23:['independent meaning/content verification','source evidence where applicable'],
  24:['Perform adversarial verification','Do not claim attacks that were not actually executed'],
  25:['Inspect the exact final delivered representation and package'],
  26:['process evidence and product evidence as two separate propositions'],
  27:['Do not set a release state','application evaluates the complete current evidence'],
  28:['application performs the authoritative immediate pre-release byte comparison'],
  29:['complete evidence graph for every mandatory requirement','Do not fabricate a link'],
  30:['append-only defect and regression history','Do not rewrite history']
};
const lifecycleDependentOperations=new Set(['1:SEMANTIC_CHALLENGE','1:RECONCILE_INTAKE','2:SEARCH_ADEQUACY_REVIEW','4:DISPOSITION_CHALLENGE','4:ATOMICITY_CHALLENGE','4:RECONCILE_REQUIREMENTS','6:SEMANTIC_REVIEW']);
let promptContextSequence=0;
function preparedPrompt(stage,operation){
  const requirements=schema.operationContract(stage,operation)?.scopeRequirements||[],laneKeys=new Set(['iterationId','candidateId','runId','baselineId','productId']),scope=Object.fromEntries(requirements.filter(key=>laneKeys.has(key)).map(key=>[key,`${key.toUpperCase()}-PROMPT-CLOSURE`]));
  const independent=[9,12,23,24].includes(stage)||([17,19].includes(stage)&&operation==='VERIFY'),context=engine.registerFreshContext(p,{stage,externalContextIdentifier:`PROMPT-CLOSURE-${stage}-${operation}-${++promptContextSequence}`,operatorLabel:'PROMPT_CLOSURE_AUDIT',purpose:independent?'REVIEWER':'GENERAL'}),contextId=engine.recordId(context,'freshContexts');
  scope.contextId=contextId;
  for(let prior=1;prior<stage;prior++){p.stages[prior].status='COMPLETE';p.stages[prior].gate={complete:true,blocked:false,reasons:[]};}
  const prepared=engine.prepareCurrentOperationReservation(p,{stage,operation,contextId,scope,owningTabInstance:'PROMPT-CLOSURE-AUDIT'}),preview=engine.clone(p);
  preview.revision=prepared.expectedRevision;
  return prompts.buildPromptRecord(stage,preview,{operation,scope:prepared.scope,operationReservation:prepared});
}
let promptsChecked=0;const lifecycleDependentOperationsDeferred=[];let stage4ChallengeIsolationContractsChecked=0;
for(let stage=1;stage<=30;stage++){
  const contract=schema.STAGE_CONTRACTS[stage];
  for(const operation of contract.operations){
    const op=schema.operationContract(stage,operation);
    const operationKey=`${stage}:${operation}`,neededReads=operationRequiredReads[operationKey]||requiredReads[stage]||[];
    for(const needed of neededReads)if(!op.readCollections.includes(needed))throw new Error(`Stage ${stage} ${operation} missing required read collection ${needed}.`);
    if(stage===4&&['DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE'].includes(operation)){const forbidden=['research','candidateRequirements','sources','sourceConflicts','requirementCompilationChallengeReviews'];for(const name of forbidden)if(op.readCollections.includes(name))throw new Error(`Stage 4 ${operation} leaks non-target or prior-review collection ${name}.`);if(JSON.stringify(op.agentWritableCollections)!==JSON.stringify(['requirementCompilationChallengeReviews']))throw new Error(`Stage 4 ${operation} does not restrict writes to the canonical challenge-review family.`);if(op.allowedStageData.length)throw new Error(`Stage 4 ${operation} permits unbound stageData outside its exact target batch.`);stage4ChallengeIsolationContractsChecked++;}
    if(lifecycleDependentOperations.has(operationKey)){lifecycleDependentOperationsDeferred.push(operationKey);continue;}
    const prompt=preparedPrompt(stage,operation).prompt;
    promptsChecked++;
    for(const common of ['PROJECT DATA EXECUTION RULE — MANDATORY','Project-relevant information supplied by the human is supplied once','Never ask the human to repeat, retype, summarize, resend, reopen, or reattach project information already present','STRICT RESPONSE CONTRACT'])if(!prompt.includes(common))throw new Error(`Stage ${stage} ${operation} missing common prompt invariant: ${common}`);
    if(stage>1&&!prompt.includes('The original Stage 01 intent file is prohibited input for this stage.'))throw new Error(`Stage ${stage} ${operation} can regress to re-requesting original intent.`);
    if(prompt.includes('CUSTOM_PIPELINE'))throw new Error(`Stage ${stage} ${operation} still exposes prohibited CUSTOM_PIPELINE.`);
    for(const phrase of semantic[stage]||[])if(!prompt.toLowerCase().includes(String(phrase).toLowerCase()))throw new Error(`Stage ${stage} ${operation} missing stage-semantic instruction: ${phrase}`);
    if((stage===17||stage===19)&&!prompt.includes(`CURRENT DECLARED OPERATION: ${operation}`))throw new Error(`Stage ${stage} ${operation} lacks exact operation-specific instruction.`);
  }
}
const opNeed={
  '17:FREEZE':['instructions','requirements','artifacts'],'17:COMPARE':['tests'],'17:ROOT_CAUSE':['instructions','requirements','tests','runs'],'17:REGRESSION':['tests','runs','verification','artifacts'],'17:CORRECT':['instructions','requirements','tests','runs','artifacts'],
  '19:CONFIRM_FREEZE':['requirements','tests','artifacts'],'19:COMPARE':['tests'],'19:REGRESSION_VERIFY':['tests','requirements','artifacts'],'19:CONFIRM':['requirements','tests','regressions','defects','blockers']
};
for(const [key,needed] of Object.entries(opNeed)){const [stage,operation]=key.split(':');const c=schema.operationContract(Number(stage),operation);for(const x of needed)if(!c.readCollections.includes(x))throw new Error(`${key} missing ${x}.`);}
for(const [stage,forbidden] of [[11,['verification','comparisons','rootCauses','changes']],[12,['comparisons','rootCauses','changes']],[23,['deterministicResults','adversarialResults']],[24,['deterministicResults','meaningResults']]]){
  const c=schema.operationContract(stage,schema.STAGE_CONTRACTS[stage].operations[0]);for(const x of forbidden)if(c.readCollections.includes(x))throw new Error(`Stage ${stage} leaks forbidden ${x} through its declared read contract.`);
}
const browserSite=fs.mkdtempSync(path.join(process.cwd(),'.prompt-walkthrough-site-'));
let browserWalk;
try{
  const build=spawnSync(process.execPath,['build-static-site.mjs',browserSite],{encoding:'utf8',env:process.env});
  if(build.status!==0)throw new Error(`Sequential browser stage walkthrough site build failed.\n${build.stdout||''}\n${build.stderr||''}`);
  browserWalk=spawnSync(process.execPath,['verify-human-stage-walkthrough.mjs'],{encoding:'utf8',env:{...process.env,CLOSED_LOOP_STATIC_ROOT:browserSite}});
}finally{
  fs.rmSync(browserSite,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
if(browserWalk.status!==0)throw new Error(`Sequential browser stage walkthrough failed.\n${browserWalk.stdout||''}\n${browserWalk.stderr||''}`);
const browserProof=JSON.parse(String(browserWalk.stdout||'{}'));
if(browserProof.stages!==30||browserProof.oneTimeSupply!==true)throw new Error('Sequential browser stage walkthrough did not establish all 30 stages and one-time project input reuse.');
console.log(JSON.stringify({promptsChecked,lifecycleDependentOperationsDeferred,stage4ChallengeIsolationContractsChecked,stagesChecked:30,compositeOperationChecks:Object.keys(opNeed).length,customPipelineOccurrences:0,oneTimeHumanInputInvariant:true,browserStageWalkthrough:true,browserPromptsChecked:browserProof.prompts,promptVisual:browserProof.promptVisual},null,2));
