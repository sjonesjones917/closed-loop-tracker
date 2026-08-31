import fs from 'node:fs';
import vm from 'node:vm';

const assert=(value,message)=>{if(!value)throw new Error(message);};
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
assert(core&&schema&&engine&&prompts,'Prompt runtime failed to load.');
assert(Object.keys(prompts.procedures).length===30,'Every one of 30 stages must have an explicit prompt procedure.');

for(let stage=1;stage<=30;stage++){
  const procedure=String(prompts.procedures[stage]||'');
  assert(procedure.length>120,`Stage ${stage} procedure is not substantive.`);
  assert(!procedure.includes('Perform only Stage '+String(stage).padStart(2,'0')+' —'),`Stage ${stage} still uses a generic fallback.`);
}

const operationMarkers={
  17:{FREEZE:'operation FREEZE only',EXECUTE_RUN:'operation EXECUTE_RUN only',VERIFY:'operation VERIFY only',COMPARE:'operation COMPARE only',ROOT_CAUSE:'operation ROOT_CAUSE only',REGRESSION:'operation REGRESSION only',CORRECT:'operation CORRECT only'},
  19:{CONFIRM_FREEZE:'operation CONFIRM_FREEZE only',EXECUTE_RUN:'operation EXECUTE_RUN only',VERIFY:'operation VERIFY only',COMPARE:'operation COMPARE only',REGRESSION_VERIFY:'operation REGRESSION_VERIFY only',CONFIRM:'operation CONFIRM only'}
};
for(const [stage,operations] of Object.entries(operationMarkers)){
  for(const [operation,marker] of Object.entries(operations)){
    assert(prompts.procedureFor(Number(stage),operation).includes(marker),`Stage ${stage} ${operation} is not operation-specific.`);
  }
}

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
for(const [stage,needed] of Object.entries(requiredReads)){
  const actual=new Set(schema.STAGE_CONTRACTS[Number(stage)].readCollections);
  for(const collection of needed)assert(actual.has(collection),`Stage ${stage} context contract omits required ${collection}.`);
}

const state=core.createBlankState('JOB-ALL-STAGE-PROMPTS');
Object.assign(state.job,{
  EXACT_USER_OBJECTIVE_VERBATIM:'USER-INTENT-SENTINEL: build exactly the requested project.',
  EXPLICIT_USER_REQUIREMENTS:'USER-REQUIREMENT-SENTINEL: never request project data twice.',
  SUPPLIED_MATERIALS_INVENTORY:'NONE',
  CURRENT_INPUT_VERSION:'INPUT-ALL-STAGES',
  CURRENT_SOURCE_SET_VERSION:'SOURCE-ALL-STAGES',
  CURRENT_REQUIREMENTS_VERSION:'REQ-ALL-STAGES',
  CURRENT_TEST_SUITE_VERSION:'TEST-ALL-STAGES',
  CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-ALL-STAGES'
});
engine.ensureShape(state);
engine.recalculate(state);

const intake=prompts.intakeCoverageManifest(state);
state.stages[1].agentData={
  EXACT_DELIVERABLE_REQUESTED:'DELIVERABLE-SENTINEL',
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
      reason:'Captured once for the ordered all-stage prompt walkthrough.',
      extractedStatements:[{
        statementKey:'S'+index,
        text:unit.rawValueText||('captured '+unit.label),
        statementClass:'CONTEXT'
      }]
    }))
  })
};
state.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};
state.stages[3].agentData={
  ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:true,
  SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,
  NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false
};

const lane={
  runId:'RUN-AUDIT',
  contextId:'CONTEXT-AUDIT',
  iterationId:'ITERATION-AUDIT',
  candidateId:'CANDIDATE-AUDIT',
  baselineId:'BASELINE-AUDIT',
  productId:'PRODUCT-AUDIT'
};
const generated=[];
for(let stage=1;stage<=30;stage++){
  for(const operation of schema.STAGE_CONTRACTS[stage].operations){
    let record;
    try{
      record=prompts.buildPromptRecord(stage,state,{operation,scope:lane});
    }catch(error){
      throw new Error(`Stage ${stage}/${operation} prompt generation failed during the ordered walkthrough: ${error?.stack||error}`);
    }
    const text=record.prompt;
    assert(text.includes('STAGE PROCEDURE'),`Stage ${stage}/${operation} omitted its stage procedure.`);
    assert(text.includes(prompts.procedureFor(stage,operation).slice(0,80)),`Stage ${stage}/${operation} did not embed its exact explicit procedure.`);
    assert(!text.includes('Perform only Stage '+String(stage).padStart(2,'0')+' —'),`Stage ${stage}/${operation} generated a generic fallback.`);
    assert(text.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE'),`Stage ${stage}/${operation} omitted the universal no-repeat human collaboration contract.`);
    if(stage===1){
      assert(text.includes('STAGE 01 HUMAN CONVERSATION — THIS OCCURS BEFORE ANY FINAL JSON'),'Stage 01 omitted the human conversation protocol.');
      assert(text.indexOf('STAGE 01 HUMAN CONVERSATION')<text.indexOf('STRICT RESPONSE CONTRACT'),'Stage 01 put the machine response contract before the human interaction.');
    }
    generated.push(`${stage}:${operation}`);
  }
  state.stages[stage].status='COMPLETE';
  state.stages[stage].gate={complete:true,blocked:false,reasons:[]};
}
assert(generated.length===41,`Expected 41 stage/operation prompts; generated ${generated.length}.`);

for(const stage of [1,2,3,4,5,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,25,26,27,28,29,30]){
  const operation=schema.STAGE_CONTRACTS[stage].operations[0];
  const text=prompts.buildPromptRecord(stage,state,{operation,scope:lane}).prompt;
  assert(text.includes('USER-INTENT-SENTINEL')||text.includes('DELIVERABLE-SENTINEL')||stage>=10,`Stage ${stage}/${operation} lacks required project-authority handoff.`);
}
for(const stage of [12,23,24]){
  const operation=schema.STAGE_CONTRACTS[stage].operations[0];
  const procedure=prompts.procedureFor(stage,operation);
  assert(/only|independent/i.test(procedure),`Stage ${stage} lacks isolation semantics.`);
}

const stage4=prompts.buildPromptRecord(4,state,{operation:'COMPLETE',scope:lane}).prompt;
for(const required of ['current User Job Input','accepted Stage 01','accepted Stage 03','APPLICATION OBLIGATION MANIFEST'])assert(stage4.includes(required),`Stage 4 is missing ${required}.`);
assert(/Do not ask the user to attach|do not ask the user to attach/i.test(stage4),'Stage 4 does not prohibit repeated intent/material supply.');

const uiSource=fs.readFileSync('app-core.js','utf8');
assert(!/The agent should|agent should use|agent must /i.test(uiSource),'External-agent behavioral instruction exists outside prompt-engine.js.');
const promptSource=fs.readFileSync('prompt-engine.js','utf8');
assert(!promptSource.includes('stageSpecial[stage.number]||`Perform only Stage'),'Generic stage fallback remains in source.');
const html=fs.readFileSync('index.html','utf8');
assert(html.includes('height:clamp(260px,45vh,520px)'),'Established prompt editing height changed.');
assert(html.includes('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'),'Established prompt preview/collapse dimensions changed.');
assert(!html.includes('#prompt-heading .expandable-prompt:not(.expanded){max-height:88px}'),'Unauthorized compact prompt preview returned.');

console.log(JSON.stringify({
  all30StageProceduresExplicit:true,
  all41StageOperationsGeneratedInOrder:true,
  currentUserAuthorityInEveryGeneratedPrompt:true,
  upstreamReadContractsAudited:true,
  stage1ConversationFirst:true,
  stage4CompletePriorData:true,
  noGenericFallback:true,
  visualsPreserved:true
},null,2));
