import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
const assert=(value,message)=>{if(!value)throw new Error(message);};
assert(core.PROJECT_SCHEMA==='closed-loop-project/3','One-time intent regression must run against project schema /3.');
assert(schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3','One-time intent regression must run against response schema /3.');

function baseProject(id){
  const p=core.createBlankState(id);engine.ensureShape(p);
  Object.assign(p.job,{
    JOB_ID:id,
    EXACT_USER_OBJECTIVE_VERBATIM:'Build exactly what the user supplied, preserving every project requirement without omission.',
    SUPPLIED_MATERIALS_INVENTORY:'intent.txt',
    EXPLICIT_USER_REQUIREMENTS:'The user supplies project information once. Never ask the user to supply the same project information again.',
    CURRENT_INPUT_VERSION:'INPUT-v001',
    CURRENT_SOURCE_SET_VERSION:'NOT APPLICABLE',
    CURRENT_REQUIREMENTS_VERSION:'NOT APPLICABLE',
    CURRENT_TEST_SUITE_VERSION:'NOT APPLICABLE',
    CURRENT_INSTRUCTION_VERSION:'NOT APPLICABLE'
  });
  return p;
}
function exhaustStage1(p){
  const manifest=engine.buildIntakeCoverageManifest(p);
  p.stages[1].agentData={
    EXACT_DELIVERABLE_REQUESTED:'The exact requested product described by the complete captured user authority.',
    ASSUMPTIONS:'NONE',
    UNKNOWN_INFORMATION:'NONE',
    INPUT_SET_CONTENTS:JSON.stringify({units:manifest.units.map((unit,index)=>({
      sourceUnitId:unit.unitId,
      disposition:'incorporated into the job definition',
      extractedStatements:[{statementKey:`S${index+1}`,text:unit.label==='EXACT_USER_OBJECTIVE_VERBATIM'?p.job.EXACT_USER_OBJECTIVE_VERBATIM:unit.label==='EXPLICIT_USER_REQUIREMENTS'?p.job.EXPLICIT_USER_REQUIREMENTS:`Captured supplied project material reference: ${unit.label}`,statementClass:unit.label==='SUPPLIED_MATERIALS_INVENTORY'?'MATERIAL_REFERENCE':'REQUIREMENT'}]
    }))})
  };
  p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};
  const accounting=engine.evaluateStage01IntakeAccounting(p);assert(accounting.complete,'Stage 01 exhaustive accounting fixture failed: '+accounting.reasons.join('; '));assert(accounting.coverage===1,'Stage 01 intake coverage is not 100%.');
  return accounting;
}
function exhaustStage3NoSource(p){
  p.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',AUTHORITY_HIERARCHY:'No applicable independent external authority in this controlled regression.',KNOWN_CONTROLLING_SOURCES_EXAMINED:'Complete no-source determination.'};p.stages[2].status='COMPLETE';p.stages[2].gate={complete:true,blocked:false,reasons:[]};
  p.stages[3].agentData={EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE'};p.stages[3].status='COMPLETE';p.stages[3].gate={complete:true,blocked:false,reasons:[]};
  const exhausted=engine.evaluateStage03Exhaustion(p);assert(exhausted.complete,'Stage 03 exhaustion fixture failed: '+exhausted.reasons.join('; '));return exhausted;
}

const p=baseProject('JOB-ONE-TIME-INTENT');
const stage1Prompt=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});
const intake=engine.buildIntakeCoverageManifest(p);
assert(intake.units.length>0,'Application intake manifest is empty.');
for(const unit of intake.units)assert(stage1Prompt.prompt.includes(unit.unitId),`Stage 01 prompt omitted intake unit ${unit.unitId}.`);
assert(stage1Prompt.prompt.includes('The user supplies project information once'),'Stage 01 prompt does not establish one-time input reuse.');
assert(stage1Prompt.prompt.includes('capture and reuse it rather than asking for it again'),'Stage 01 prompt does not forbid repeat questions for available project data.');
exhaustStage1(p);exhaustStage3NoSource(p);
const stage4=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
const obligations=engine.buildStage04ObligationManifest(p);
assert(obligations.obligationCount>0,'Stage 04 obligation universe is empty after exhaustive Stage 01 capture.');
for(const item of obligations.items)assert(stage4.prompt.includes(item.obligationId),`Stage 04 prompt omitted obligation ${item.obligationId}.`);
assert(stage4.prompt.includes(p.job.EXACT_USER_OBJECTIVE_VERBATIM),'Stage 04 prompt forgot the original user objective.');
assert(stage4.prompt.includes(p.job.EXPLICIT_USER_REQUIREMENTS),'Stage 04 prompt forgot the user one-time-input requirement.');
assert(stage4.prompt.includes('Do not ask the user to attach, restate, summarize, retype, or otherwise resupply'),'Stage 04 prompt does not explicitly prohibit repeated project input.');
const handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});
assert((handoff.send||[]).length===0,'Stage 04 incorrectly requires retransferring a filename-only Stage 01 material reference.');
assert(!Object.prototype.hasOwnProperty.call(handoff,'conversationMaterials'),'Stage 04 restored obsolete conversation-material resend behavior.');

const incompleteStage1=baseProject('JOB-INCOMPLETE-STAGE1');
incompleteStage1.stages[1].status='COMPLETE';incompleteStage1.stages[1].agentData={INPUT_SET_CONTENTS:JSON.stringify({units:[]})};exhaustStage3NoSource(incompleteStage1);
let blocked=false;try{prompts.buildPromptRecord(4,incompleteStage1,{operation:'COMPLETE'});}catch(error){blocked=error?.code==='STAGE4_UPSTREAM_INCOMPLETE';}assert(blocked,'Stage 04 generated despite incomplete Stage 01 accounting.');

const incompleteStage3=baseProject('JOB-INCOMPLETE-STAGE3');exhaustStage1(incompleteStage3);incompleteStage3.stages[3].status='COMPLETE';
blocked=false;try{prompts.buildPromptRecord(4,incompleteStage3,{operation:'COMPLETE'});}catch(error){blocked=error?.code==='STAGE4_UPSTREAM_INCOMPLETE';}assert(blocked,'Stage 04 generated despite incomplete Stage 03 exhaustion.');

console.log(JSON.stringify({oneTimeProjectInput:true,stage01IntakeCoverage:1,stage03ExhaustionRequired:true,stage04ObligationUniverseComplete:true,stage04RepeatAttachmentRequired:false},null,2));
console.log('verify-one-time-intent-intake: PASS');
