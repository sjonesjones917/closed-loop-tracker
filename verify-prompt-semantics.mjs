import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
if(!core||!schema||!engine||!prompts)throw new Error('Prompt runtime failed to load.');
const source=fs.readFileSync('prompt-engine.js','utf8');
for(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])assert.ok(!source.includes(forbidden),`Hard-coded project-subject branch remains: ${forbidden}`);
function project(){const p=core.createBlankState('JOB-PROMPT-CURRENT');Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Build the requested project exactly from supplied authority.',EXPLICIT_USER_REQUIREMENTS:'Preserve every supplied project requirement and never ask twice.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});engine.ensureShape(p);p.projectData.humanInputAnswers=[{answerId:'ANSWER-001',answer:'Human decision already supplied.'}];return p;}
{
 const p=project();const r=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});
 for(const text of ['STAGE 01 SUBJECT-NEUTRAL INTAKE','accessible supplied materials','Preserve every project-relevant human fact','BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','HUMAN COLLABORATION MODE'])assert.ok(r.prompt.includes(text),`Stage 01 prompt missing ${text}`);
 assert.ok(r.prompt.includes('Human decision already supplied.'),'Stage 01 prompt failed to carry persisted human answer.');
 assert.ok(r.prompt.includes('do not ask the human to re-enter facts that are already present'),'Stage 01 must forbid repeat entry.');
}
{
 const p=project(),scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'};
 p.projectData.intentStatements=[{id:'STATEMENT-001',STATEMENT_ID:'STATEMENT-001',fields:{EXACT_STATEMENT:'The output must preserve supplied requirement A.',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST'},scope,status:'ACTIVE'}];
 p.projectData.candidateRequirements=[{id:'CANDIDATE-REQ-001',CANDIDATE_REQ_ID:'CANDIDATE-REQ-001',fields:{CANDIDATE_OBLIGATION:'External source requires condition B.',APPLICABILITY:'APPLICABLE'},scope,status:'ACTIVE'}];
 p.projectData.research=[{id:'RESEARCH-001',RESEARCH_ID:'RESEARCH-001',fields:{MANDATORY_STATEMENTS:'Condition B is mandatory.',PROHIBITIONS:'Do not omit condition C.',EXCEPTIONS:'Exception D applies only when stated.'},scope,status:'ACTIVE'}];
 const r=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
 for(const text of ['STAGE 04 OBLIGATION MANIFEST','STATEMENT-001','The output must preserve supplied requirement A.','External source requires condition B.','Condition B is mandatory.','Do not omit condition C.','Exception D applies only when stated.','PROJECT DATA EXECUTION RULE — MANDATORY'])assert.ok(r.prompt.includes(text),`Stage 04 prompt missing operative input ${text}`);
 assert.ok(r.prompt.includes('The original Stage 01 intent file is prohibited input for this stage.'),'Stage 04 must prohibit original intent-file reuse.');
}
{
 const p=project();const r=prompts.buildPromptRecord(6,p,{operation:'COMPLETE'});for(const text of ['closed-loop-test-spec/1','APPLICATION_DETERMINISTIC','CLOSED_LOOP_TEST_IR','PARSE_XML','SELECT_XML'])assert.ok(r.prompt.includes(text),`Stage 06 Test IR prompt missing ${text}`);
}
for(const stage of [11,12,23,24]){const p=project();const operation=schema.STAGE_OPERATIONS[stage][0];const r=prompts.buildPromptRecord(stage,p,{operation});assert.ok(r.prompt.includes(`OPERATION: ${operation}`));assert.ok(r.prompt.includes('PROJECT-SCOPE BOUNDARY'));assert.ok(r.prompt.includes('FILES YOU MUST NOT RECEIVE')||r.prompt.includes('WITHHELD')||r.prompt.includes('withhold')||r.prompt.includes('must not receive'),`Stage ${stage} lacks context-withholding semantics.`);}
assert.deepEqual(engine.applicationTestCapabilities(),['CLOSED_LOOP_TEST_IR']);
console.log(JSON.stringify({subjectNeutral:true,stage1Exhaustive:true,stage4ClosedUnion:true,testIrPublished:true,contextIsolation:true},null,2));
