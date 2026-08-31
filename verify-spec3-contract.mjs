import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=closedLoopCore,schema=closedLoopWorkflowSchema,runtime=closedLoopTestRuntime,engine=closedLoopWorkflowEngine,prompts=closedLoopPromptEngine;

assert.equal(core.PROJECT_SCHEMA,'closed-loop-project/3');
assert.equal(schema.RESPONSE_SCHEMA,'closed-loop-stage-response/3');
assert.equal(core.WORKFLOW_ID,'mobile-closed-loop/30');
assert.equal(core.STAGE_COUNT,30);
assert.equal(core.STAGES[15].title,'CORRECT THE ROOT CAUSE');
assert.equal(schema.JOB_FIELDS.JOB_TITLE.producer,'HUMAN_DECISION');
assert.equal(schema.JOB_FIELDS.JOB_OWNER.producer,'HUMAN_DECISION');
assert(runtime.OPS.includes('PARSE_XML')&&runtime.OPS.includes('SELECT_XML'));

const html=fs.readFileSync('index.html','utf8');
assert(!html.includes('.expandable-prompt{height:280px;max-height:280px}'));
assert(html.includes('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'));
assert(html.indexOf('workflow-schema.js')<html.indexOf('test-runtime.js')&&html.indexOf('test-runtime.js')<html.indexOf('workflow-engine.js'));
assert(html.includes("worker-src 'self'"));

const previous=core.createBlankState('J');
previous.schema='closed-loop-project/2';
previous.projectData.extensionX={x:1};
const migrated=schema.migrateProjectToCurrent(previous);
assert.equal(migrated.schema,'closed-loop-project/3');
assert.deepEqual(migrated.projectData.extensionX,{x:1});

const project=core.createBlankState('CAPTURE');
Object.assign(project.job,{
  EXACT_USER_OBJECTIVE_VERBATIM:'Build the requested thing',
  EXPLICIT_USER_REQUIREMENTS:'Never ask me for the same project data twice',
  SUPPLIED_MATERIALS_INVENTORY:'intent.pdf',
  EXACT_DELIVERABLE_REQUESTED:'finished product',
  CURRENT_INPUT_VERSION:'INPUT-v001'
});
engine.ensureShape(project);
engine.recalculate(project);
const coverage=prompts.buildPromptRecord(1,project).contextManifest.intakeCoverageManifest;
project.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({
  schema:'closed-loop-stage01-capture/1',
  inputVersion:coverage.inputVersion,
  manifestSha256:coverage.manifestSha256,
  units:coverage.units.map((unit,index)=>({
    sourceUnitId:unit.unitId,
    sourceRawValueSha256:unit.rawValueSha256,
    disposition:'incorporated into the job definition',
    reason:'Preserved for downstream reuse.',
    extractedStatements:[{
      statementKey:`S${index+1}`,
      text:unit.rawValueText||`Captured ${unit.label}`,
      statementClass:'FACT'
    }]
  }))
});
for(let stage=1;stage<=3;stage++){
  project.stages[stage].status='COMPLETE';
  project.stages[stage].gate={complete:true,blocked:false,reasons:[]};
}
project.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';

const intake=engine.intakeCoverageManifest(project);
const obligations=engine.obligationManifest(project);
assert(intake.units.length>=3);
assert(obligations.items.some(item=>String(item.text).includes('Never ask me')));
const stage04Prompt=prompts.buildPromptRecord(4,project).prompt;
for(const token of ['PROJECT DATA EXECUTION RULE — MANDATORY','Never ask the human','Never ask me for the same project data twice'])assert(stage04Prompt.includes(token),token);
assert(obligations.items.length>0,'Stage 04 application-owned obligation manifest is empty.');

console.log(JSON.stringify({
  projectSchema:core.PROJECT_SCHEMA,
  responseSchema:schema.RESPONSE_SCHEMA,
  stageCount:core.STAGE_COUNT,
  intake:intake.units.length,
  obligations:obligations.items.length,
  visualBaselineRestored:true,
  testRuntimeLoaded:true,
  migrationAuthority:'workflow-schema.js',
  stage04FixtureUsesAcceptedStage01:true
}));
